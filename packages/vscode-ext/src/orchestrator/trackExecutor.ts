import * as vscode from 'vscode';
import * as os from 'os';
import { Track, WorkPlan } from './workPlanParser';
import { GitWorktree } from '../worktree/gitWorktree';
import { McpServerLauncher } from '../mcp/launcher';
import { McpServerRegistration } from '../mcp/registration';
import { Logger } from '../util/logger';
import { ErrorHandler, RecoveryAction, CircuitBreaker } from '../util/errorHandler';
import { startToolContainer, stopToolContainer } from '../containers/docker';

const MAX_CONCURRENCY = Math.min(3, Math.floor(os.cpus().length / 2));
const logger = new Logger('TrackExecutor');

// Configuration for retry logic
const RETRY_CONFIG = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffFactor: 2,
};

// Configuration for container management
const CONTAINER_CONFIG = {
    imageName: 'roo-master/tool-image:latest',
    containerNamePrefix: 'roo-track-',
    securityFlags: [
        '--read-only',
        '--cap-drop=ALL',
        '--security-opt=no-new-privileges',
        '--pids-limit=512',
        '--memory=4g',
        '--cpus=2',
        '--user 1000:1000',
    ],
};

export interface TrackExecutionResult {
    trackId: string;
    success: boolean;
    message?: string;
    retryCount: number;
    executionTimeMs: number;
}

export interface ProgressReport {
    totalTracks: number;
    completedTracks: number;
    failedTracks: number;
    runningTracks: number;
    currentTrack?: string;
    currentProgress?: number;
}

export class TrackExecutor {
    private activeTracks = new Map<string, { 
        worktree: GitWorktree; 
        serverRegistration: McpServerRegistration;
        containerId?: string;
        startTime: number;
        retryCount: number;
    }>();
    private trackQueue: Track[] = [];
    private runningTrackIds = new Set<string>();
    private completedTrackIds = new Set<string>();
    private failedTrackIds = new Set<string>();
    private progressReport: ProgressReport;
    private progressEmitter = new vscode.EventEmitter<ProgressReport>();
    public onProgressUpdate = this.progressEmitter.event;

    constructor(
        private context: vscode.ExtensionContext,
        private mcpServerLauncher: McpServerLauncher,
        private mcpServerRegistration: McpServerRegistration // This is for the main extension's MCP server
    ) {
        this.progressReport = {
            totalTracks: 0,
            completedTracks: 0,
            failedTracks: 0,
            runningTracks: 0,
        };
    }

    public async executeWorkPlan(workPlan: WorkPlan): Promise<void> {
        this.resetState();
        this.trackQueue = [...workPlan.tracks]; // Initialize queue with all tracks
        this.progressReport.totalTracks = workPlan.tracks.length;

        vscode.window.showInformationMessage(`Starting Work Plan execution with max concurrency: ${MAX_CONCURRENCY}`);
        logger.info(`Starting Work Plan execution with max concurrency: ${MAX_CONCURRENCY}`);

        try {
            await this.processTracks(workPlan);

            if (this.failedTrackIds.size > 0) {
                vscode.window.showWarningMessage(`Work Plan execution completed with ${this.failedTrackIds.size} failed tracks.`);
                logger.warn(`Work Plan execution completed with ${this.failedTrackIds.size} failed tracks.`);
            } else {
                vscode.window.showInformationMessage('Work Plan execution completed successfully.');
                logger.info('Work Plan execution completed successfully.');
            }
        } catch (error: any) {
            ErrorHandler.handleError(error, {
                showUser: true,
                logLevel: 'error',
                userMessage: 'Work Plan execution failed',
                context: 'TrackExecutor.executeWorkPlan'
            });
            throw error;
        }
    }

    private async processTracks(workPlan: WorkPlan): Promise<void> {
        while (this.completedTrackIds.size + this.failedTrackIds.size < workPlan.tracks.length) {
            // Identify tracks that are ready to run
            const readyTracks = workPlan.tracks.filter(track =>
                !this.runningTrackIds.has(track.id) &&
                !this.completedTrackIds.has(track.id) &&
                !this.failedTrackIds.has(track.id) &&
                track.dependencies.every(depId => this.completedTrackIds.has(depId))
            );

            // Filter for tracks that can run in parallel based on the work plan's parallelizable groups
            const executableTracksInThisCycle: Track[] = [];
            for (const parallelGroup of workPlan.parallelizableTracks) {
                const potentialTracks = parallelGroup.map(id => workPlan.tracks.find(t => t.id === id)).filter((t): t is Track => !!t);
                
                // Check if any of these potential tracks are ready and not already running
                const runnableInGroup = potentialTracks.filter(pt =>
                    readyTracks.some(rt => rt.id === pt.id) &&
                    !this.runningTrackIds.has(pt.id)
                );

                // Add to executable if we have capacity
                for (const track of runnableInGroup) {
                    if (this.runningTrackIds.size < MAX_CONCURRENCY) {
                        executableTracksInThisCycle.push(track);
                        this.runningTrackIds.add(track.id);
                    } else {
                        break; // Max concurrency reached
                    }
                }
                if (this.runningTrackIds.size >= MAX_CONCURRENCY) {
                    break; // Max concurrency reached across all groups
                }
            }

            if (executableTracksInThisCycle.length === 0 && this.runningTrackIds.size === 0) {
                // No tracks ready to run and nothing is currently running.
                // This could indicate a deadlock (circular dependency) or all remaining tracks
                // are blocked by failed dependencies.
                const blockedTracks = workPlan.tracks.filter(track =>
                    !this.completedTrackIds.has(track.id) &&
                    !this.failedTrackIds.has(track.id) &&
                    !this.runningTrackIds.has(track.id)
                );
                if (blockedTracks.length > 0) {
                    logger.error('Work Plan execution stalled. Possible circular dependencies or unresolvable blocks.');
                    vscode.window.showErrorMessage('Work Plan execution stalled. Check logs for details.');
                    // Mark remaining as failed to unblock the loop
                    blockedTracks.forEach(track => this.failedTrackIds.add(track.id));
                }
                break; // Exit loop if no progress can be made
            }

            // Start executing the identified tracks in parallel
            const executionPromises = executableTracksInThisCycle.map(track => this.executeTrack(track));
            await Promise.allSettled(executionPromises);

            // Small delay to prevent busy-waiting and allow other VS Code operations
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    private async executeTrack(track: Track): Promise<TrackExecutionResult> {
        const startTime = Date.now();
        let retryCount = 0;
        let lastError: Error | null = null;

        logger.info(`Executing track: ${track.name} (${track.id})`);
        vscode.window.showInformationMessage(`Executing track: ${track.name}`);

        // Update progress report
        this.progressReport.currentTrack = track.name;
        this.progressReport.currentProgress = 0;
        this.progressEmitter.fire(this.progressReport);

        try {
            // Get circuit breaker for this track
            const circuitBreaker = ErrorHandler.getCircuitBreaker(`track-${track.id}`, {
                failureThreshold: 3,
                resetTimeout: 30000, // 30 seconds
                monitoringPeriod: 60000 // 1 minute
            });

            // Execute track with circuit breaker protection
            const result = await circuitBreaker.execute(async () => {
                return await this.executeTrackWithRetry(track, retryCount);
            });

            // Update progress on success
            this.progressReport.currentProgress = 100;
            this.progressEmitter.fire(this.progressReport);
            
            return result;
        } catch (error: any) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Track ${track.id} failed: ${errorMessage}`);
            
            // Try to recover from the error
            const recoveryResult = await this.attemptTrackRecovery(track, retryCount, error);
            
            if (recoveryResult.success && recoveryResult.result) {
                return recoveryResult.result;
            }

            // Update progress on failure
            this.failedTrackIds.add(track.id);
            this.progressEmitter.fire(this.progressReport);
            
            // Show error to user with recovery actions
            await ErrorHandler.handleError(error, {
                showUser: true,
                logLevel: 'error',
                context: `TrackExecutor:${track.id}`,
                recoveryActions: this.getTrackRecoveryActions(track, retryCount)
            });

            return {
                trackId: track.id,
                success: false,
                message: errorMessage,
                retryCount,
                executionTimeMs: Date.now() - startTime,
            };
        }
    }

    private async executeTrackAttempt(track: Track, retryCount: number): Promise<TrackExecutionResult> {
        const startTime = Date.now();
        let worktree: GitWorktree | undefined;
        let serverRegistration: McpServerRegistration | undefined;
        let containerId: string | undefined;

        try {
            // 1. Create branch `puppet/<track-slug>` and sibling worktree `../<track-slug>`
            const branchName = `puppet/${track.id}`;
            const worktreePath = vscode.Uri.joinPath(this.context.globalStorageUri, 'worktrees', track.id);
            worktree = new GitWorktree(worktreePath.fsPath);

            // Ensure the base branch exists and is up-to-date before creating the worktree
            await worktree.createWorktree(branchName);
            logger.info(`Created worktree for track ${track.id} at ${worktreePath.fsPath}`);

            // 2. Start one tool container bound to that worktree
            const containerName = `${CONTAINER_CONFIG.containerNamePrefix}${track.id}`;
            containerId = await startToolContainer(
                CONTAINER_CONFIG.imageName,
                containerName,
                [] // No port bindings for security
            );
            logger.info(`Started container ${containerName} for track ${track.id}`);

            // 3. Register an MCP server for that worktree (stdio launcher)
            serverRegistration = new McpServerRegistration(this.mcpServerLauncher);
            await serverRegistration.registerServer(worktreePath.fsPath);
            logger.info(`Registered MCP server for track ${track.id}`);

            // Store active track information
            this.activeTracks.set(track.id, { 
                worktree, 
                serverRegistration, 
                containerId,
                startTime,
                retryCount,
            });

            // 4. Drive the track using MCP tools with progress reporting
            const totalSteps = 3;
            let currentStep = 0;

            // Step 1: Build project
            currentStep++;
            this.progressReport.currentProgress = Math.round((currentStep / totalSteps) * 100);
            this.progressEmitter.fire(this.progressReport);
            
            vscode.window.showInformationMessage(`Track ${track.name}: Building project...`);
            await this.mcpServerLauncher.useTool(worktreePath.fsPath, 'build.project', {});
            logger.info(`Track ${track.id}: Project built.`);

            // Step 2: Run tests
            currentStep++;
            this.progressReport.currentProgress = Math.round((currentStep / totalSteps) * 100);
            this.progressEmitter.fire(this.progressReport);
            
            vscode.window.showInformationMessage(`Track ${track.name}: Running tests...`);
            await this.mcpServerLauncher.useTool(worktreePath.fsPath, 'test.run', {});
            logger.info(`Track ${track.id}: Tests run.`);

            // Step 3: Fix linting issues
            currentStep++;
            this.progressReport.currentProgress = Math.round((currentStep / totalSteps) * 100);
            this.progressEmitter.fire(this.progressReport);
            
            vscode.window.showInformationMessage(`Track ${track.name}: Fixing linting issues...`);
            await this.mcpServerLauncher.useTool(worktreePath.fsPath, 'lint.fix', {});
            logger.info(`Track ${track.id}: Linting fixed.`);

            // Commit changes made by the tools
            await worktree.addAndCommitAll(`feat(${track.id}): Implement ${track.name}`);
            logger.info(`Changes committed for track ${track.id}`);

            this.completedTrackIds.add(track.id);
            vscode.window.showInformationMessage(`Track ${track.name} completed successfully.`);
            logger.info(`Track ${track.id} completed successfully.`);

            return {
                trackId: track.id,
                success: true,
                retryCount,
                executionTimeMs: Date.now() - startTime,
            };

        } catch (error: any) {
            logger.error(`Track ${track.id} execution failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Determines if an error is retryable.
     * @param error The error to evaluate.
     * @returns True if the error is retryable.
     */
    private isRetryableError(error: Error): boolean {
        const errorMessage = error.message.toLowerCase();
        
        // Network-related errors are usually retryable
        const retryablePatterns = [
            'connection refused',
            'timeout',
            'network error',
            'econnrefused',
            'econnreset',
            'etimedout',
            'temporary',
            'temporary failure',
            'resource temporarily unavailable',
        ];
        
        return retryablePatterns.some(pattern => errorMessage.includes(pattern));
    }

    /**
     * Cleans up resources associated with a track.
     * @param trackId The ID of the track to clean up.
     */
    private async cleanupTrackResources(trackId: string): Promise<void> {
        const trackResources = this.activeTracks.get(trackId);
        if (!trackResources) return;

        try {
            // Stop MCP server
            if (trackResources.serverRegistration) {
                this.mcpServerLauncher.stopMcpServer(trackResources.worktree.repoPath);
                logger.info(`Stopped MCP server for track ${trackId}`);
            }

            // Stop container
            if (trackResources.containerId) {
                const containerName = `${CONTAINER_CONFIG.containerNamePrefix}${trackId}`;
                try {
                    await stopToolContainer(containerName);
                    logger.info(`Stopped container for track ${trackId}`);
                } catch (error: any) {
                    logger.warn(`Failed to stop container for track ${trackId}: ${error.message}`);
                }
            }

            // Clean up worktree
            if (trackResources.worktree) {
                try {
                    const branchName = `puppet/${trackId}`;
                    await trackResources.worktree.removeWorktree(branchName);
                    logger.info(`Cleaned up worktree for track ${trackId}`);
                } catch (error: any) {
                    logger.warn(`Failed to clean up worktree for track ${trackId}: ${error.message}`);
                }
            }

            this.activeTracks.delete(trackId);
        } catch (error: any) {
            ErrorHandler.handleError(error, {
                showUser: false,
                logLevel: 'error',
                context: 'TrackExecutor.cleanupTrackResources'
            });
        }
    }

    /**
     * Attempts to recover from a track execution error
     * @param track The track that failed
     * @param retryCount The current retry count
     * @param error The error that occurred
     * @returns Recovery result with success flag and optional result
     */
    private async attemptTrackRecovery(
        track: Track,
        retryCount: number,
        error: any
    ): Promise<{ success: boolean; result?: TrackExecutionResult }> {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.info(`Attempting recovery for track ${track.id}: ${errorMessage}`);

        // Try to clean up resources first
        try {
            await this.cleanupTrackResources(track.id);
        } catch (cleanupError: any) {
            logger.error(`Failed to cleanup track resources during recovery: ${cleanupError.message}`);
        }

        // If we haven't exceeded max retry count, try to retry
        if (retryCount < RETRY_CONFIG.maxRetries) {
            try {
                logger.info(`Retrying track execution (attempt ${retryCount + 1}/${RETRY_CONFIG.maxRetries})`);
                
                // Re-execute the track with exponential backoff
                const delayMs = Math.min(
                    RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffFactor, retryCount),
                    RETRY_CONFIG.maxDelayMs
                );
                
                logger.info(`Waiting ${delayMs}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));

                // Get circuit breaker for this track and reset it
                const circuitBreaker = ErrorHandler.getCircuitBreaker(`track-${track.id}`);
                circuitBreaker.reset();

                // Execute track with increased retry count
                const result = await this.executeTrackWithRetry(track, retryCount + 1);
                
                return {
                    success: true,
                    result
                };
            } catch (retryError: any) {
                logger.error(`Track retry failed: ${retryError.message}`);
                return { success: false };
            }
        }

        return { success: false };
    }

    /**
     * Gets recovery actions for a failed track
     * @param track The track that failed
     * @param retryCount The current retry count
     * @returns Array of recovery actions
     */
    private getTrackRecoveryActions(track: Track, retryCount: number): RecoveryAction[] {
        const actions: RecoveryAction[] = [];

        // Add retry action if we haven't exceeded max retries
        if (retryCount < RETRY_CONFIG.maxRetries) {
            actions.push({
                id: 'retry',
                label: 'Retry Track',
                callback: async () => {
                    try {
                        // Reset circuit breaker
                        const circuitBreaker = ErrorHandler.getCircuitBreaker(`track-${track.id}`);
                        circuitBreaker.reset();
                        
                        // Re-execute the track
                        const result = await this.executeTrackWithRetry(track, retryCount + 1);
                        return result.success;
                    } catch (error: any) {
                        logger.error(`Failed to retry track ${track.id}: ${error.message}`);
                        return false;
                    }
                },
                description: `Retry the track execution (attempt ${retryCount + 1}/${RETRY_CONFIG.maxRetries})`
            });
        }

        // Add cleanup action
        actions.push({
            id: 'cleanup',
            label: 'Cleanup Resources',
            callback: async () => {
                try {
                    await this.cleanupTrackResources(track.id);
                    return true;
                } catch (error: any) {
                    logger.error(`Failed to cleanup track ${track.id}: ${error.message}`);
                    return false;
                }
            },
            description: 'Clean up all resources associated with this track'
        });

        // Add reset action
        actions.push({
            id: 'reset',
            label: 'Reset Circuit Breaker',
            callback: async () => {
                try {
                    const circuitBreaker = ErrorHandler.getCircuitBreaker(`track-${track.id}`);
                    circuitBreaker.reset();
                    logger.info(`Reset circuit breaker for track ${track.id}`);
                    return true;
                } catch (error: any) {
                    logger.error(`Failed to reset circuit breaker for track ${track.id}: ${error.message}`);
                    return false;
                }
            },
            description: 'Reset the circuit breaker for this track'
        });

        return actions;
    }

    /**
     * Executes a track with retry logic
     * @param track The track to execute
     * @param retryCount The current retry count
     * @returns Track execution result
     */
    private async executeTrackWithRetry(track: Track, retryCount: number): Promise<TrackExecutionResult> {
        while (retryCount <= RETRY_CONFIG.maxRetries) {
            try {
                if (retryCount > 0) {
                    const delayMs = Math.min(
                        RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffFactor, retryCount - 1),
                        RETRY_CONFIG.maxDelayMs
                    );
                    
                    logger.info(`Retrying track ${track.id} (attempt ${retryCount}/${RETRY_CONFIG.maxRetries}) after ${delayMs}ms delay`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }

                const result = await this.executeTrackAttempt(track, retryCount);
                
                // Update progress on success
                this.progressReport.currentProgress = 100;
                this.progressEmitter.fire(this.progressReport);
                
                return result;
            } catch (error: any) {
                logger.warn(`Track ${track.id} attempt ${retryCount + 1} failed: ${error.message}`);
                
                // Check if this is a retryable error
                if (!this.isRetryableError(error) || retryCount >= RETRY_CONFIG.maxRetries) {
                    throw error;
                }
                
                // Clean up resources before retry
                await this.cleanupTrackResources(track.id);
                retryCount++;
            }
        }

        // This should never be reached due to the throw in the loop
        throw new Error(`Track ${track.id} failed after ${RETRY_CONFIG.maxRetries} retries`);
    }

    private scheduleNextTracks(): void {
        // This method is called after a track finishes (success or failure)
        // to check if new tracks can be started.
        // The main processTracks loop handles the overall scheduling based on dependencies and concurrency.
        // This is more of a trigger to re-evaluate.
        logger.debug('Re-evaluating tracks for scheduling...');
        this.updateProgressReport();
        // The processTracks loop will pick this up on its next iteration.
    }

    private resetState(): void {
        // Clean up all active tracks
        const cleanupPromises = Array.from(this.activeTracks.keys()).map(trackId => 
            this.cleanupTrackResources(trackId)
        );
        
        Promise.allSettled(cleanupPromises).then(() => {
            this.activeTracks.clear();
            this.trackQueue = [];
            this.runningTrackIds.clear();
            this.completedTrackIds.clear();
            this.failedTrackIds.clear();
            
            // Reset progress report
            this.progressReport = {
                totalTracks: 0,
                completedTracks: 0,
                failedTracks: 0,
                runningTracks: 0,
            };
            this.progressEmitter.fire(this.progressReport);
            
            logger.info('TrackExecutor state reset.');
        });
    }

    /**
     * Updates the progress report and emits the update event.
     */
    private updateProgressReport(): void {
        this.progressReport.completedTracks = this.completedTrackIds.size;
        this.progressReport.failedTracks = this.failedTrackIds.size;
        this.progressReport.runningTracks = this.runningTrackIds.size;
        this.progressEmitter.fire(this.progressReport);
    }

    /**
     * Gets the current progress report.
     * @returns The current progress report.
     */
    public getProgressReport(): ProgressReport {
        return { ...this.progressReport };
    }

    /**
     * Cancels execution of all tracks and cleans up resources.
     */
    public async cancelExecution(): Promise<void> {
        logger.info('Cancelling track execution...');
        
        // Cancel all running tracks
        const runningTrackIds = Array.from(this.runningTrackIds);
        for (const trackId of runningTrackIds) {
            await this.cleanupTrackResources(trackId);
            this.failedTrackIds.add(trackId);
        }
        
        this.runningTrackIds.clear();
        this.updateProgressReport();
        
        vscode.window.showInformationMessage('Track execution cancelled.');
        logger.info('Track execution cancelled.');
    }
}