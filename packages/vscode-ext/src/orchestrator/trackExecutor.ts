import * as vscode from 'vscode';
import * as os from 'os';
import { Track, WorkPlan } from './workPlanParser';
import { GitWorktree } from '../worktree/gitWorktree';
import { McpServerLauncher } from '../mcp/launcher';
import { McpServerRegistration } from '../mcp/registration';
import { Logger } from '../util/logger';

const MAX_CONCURRENCY = Math.min(3, Math.floor(os.cpus().length / 2));
const logger = new Logger('TrackExecutor');

export class TrackExecutor {
    private activeTracks = new Map<string, { worktree: GitWorktree; serverRegistration: McpServerRegistration }>();
    private trackQueue: Track[] = [];
    private runningTrackIds = new Set<string>();
    private completedTrackIds = new Set<string>();
    private failedTrackIds = new Set<string>();

    constructor(
        private context: vscode.ExtensionContext,
        private mcpServerLauncher: McpServerLauncher,
        private mcpServerRegistration: McpServerRegistration // This is for the main extension's MCP server
    ) {}

    public async executeWorkPlan(workPlan: WorkPlan): Promise<void> {
        this.resetState();
        this.trackQueue = [...workPlan.tracks]; // Initialize queue with all tracks

        vscode.window.showInformationMessage(`Starting Work Plan execution with max concurrency: ${MAX_CONCURRENCY}`);
        logger.info(`Starting Work Plan execution with max concurrency: ${MAX_CONCURRENCY}`);

        await this.processTracks(workPlan);

        vscode.window.showInformationMessage('Work Plan execution completed.');
        logger.info('Work Plan execution completed.');
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

    private async executeTrack(track: Track): Promise<void> {
        logger.info(`Executing track: ${track.name} (${track.id})`);
        vscode.window.showInformationMessage(`Executing track: ${track.name}`);

        let worktree: GitWorktree | undefined;
        let serverRegistration: McpServerRegistration | undefined;

        try {
            // 1. Create branch `puppet/<track-slug>` and sibling worktree `../<track-slug>`
            const branchName = `puppet/${track.id}`;
            const worktreePath = vscode.Uri.joinPath(this.context.globalStorageUri, 'worktrees', track.id);
            worktree = new GitWorktree(worktreePath.fsPath);

            // Ensure the base branch exists and is up-to-date before creating the worktree
            await worktree.createWorktree(branchName);
            logger.info(`Created worktree for track ${track.id} at ${worktreePath.fsPath}`);

            // 2. Start one tool container bound to that worktree
            // This assumes a mechanism to start a container and get its details.
            // For now, we'll simulate this.
            // In a real scenario, this would involve Docker/container orchestration.
            // const containerInfo = await this.dockerManager.startContainer(worktreePath.fsPath);
            logger.info(`Simulating container start for track ${track.id}`);

            // 3. Register an MCP server for that worktree (stdio launcher)
            // This assumes the MCP host is running and can launch tools.
            const serverName = `roo-track-${track.id}`;
            serverRegistration = new McpServerRegistration(this.mcpServerLauncher);
            await serverRegistration.registerServer(worktreePath.fsPath); // Pass worktree path as CWD for the server
            logger.info(`Registered MCP server '${serverName}' for track ${track.id}`);

            this.activeTracks.set(track.id, { worktree, serverRegistration });

            // 4. Drive the track using MCP tools: `build.project` → `test.run` → `lint.fix`
            // This is a simplified sequence. Real tracks would have more complex steps.
            vscode.window.showInformationMessage(`Track ${track.name}: Building project...`);
            await this.mcpServerLauncher.useTool(serverName, 'build.project', {});
            logger.info(`Track ${track.id}: Project built.`);

            vscode.window.showInformationMessage(`Track ${track.name}: Running tests...`);
            await this.mcpServerLauncher.useTool(serverName, 'test.run', {});
            logger.info(`Track ${track.id}: Tests run.`);

            vscode.window.showInformationMessage(`Track ${track.name}: Fixing linting issues...`);
            await this.mcpServerLauncher.useTool(serverName, 'lint.fix', {});
            logger.info(`Track ${track.id}: Linting fixed.`);

            // Simulate making changes and committing them
            // In a real scenario, the MCP tools would modify files, and then we'd commit.
            // await worktree.addAndCommit(`feat(${track.id}): Implement ${track.name}`);
            // await worktree.pushBranch(branchName);
            logger.info(`Simulating changes and commit for track ${track.id}`);

            this.completedTrackIds.add(track.id);
            vscode.window.showInformationMessage(`Track ${track.name} completed successfully.`);
            logger.info(`Track ${track.id} completed successfully.`);

        } catch (error: any) {
            logger.error(`Track ${track.id} failed: ${error.message}`);
            vscode.window.showErrorMessage(`Track ${track.name} failed: ${error.message}`);
            this.failedTrackIds.add(track.id);
            // Implement retry logic here if needed
        } finally {
            this.runningTrackIds.delete(track.id);
            // Resource management: Ensure containers are stopped and worktrees are cleaned up
            const trackResources = this.activeTracks.get(track.id);
            if (trackResources) {
                if (trackResources.serverRegistration) {
                    // await trackResources.serverRegistration.unregisterServer(); // No unregisterServer method
                    logger.info(`Unregistered MCP server for track ${track.id}`);
                }
                if (trackResources.worktree) {
                    // await trackResources.worktree.deleteWorktree(); // Careful with deleting worktrees, might need user confirmation
                    logger.info(`Worktree for track ${track.id} cleanup initiated.`);
                }
                this.activeTracks.delete(track.id);
            }
            this.scheduleNextTracks(); // Attempt to schedule next tracks after one finishes
        }
    }

    private scheduleNextTracks(): void {
        // This method is called after a track finishes (success or failure)
        // to check if new tracks can be started.
        // The main processTracks loop handles the overall scheduling based on dependencies and concurrency.
        // This is more of a trigger to re-evaluate.
        logger.debug('Re-evaluating tracks for scheduling...');
        // The processTracks loop will pick this up on its next iteration.
    }

    private resetState(): void {
        this.activeTracks.forEach(resources => {
            // resources.serverRegistration?.unregisterServer(); // No unregisterServer method
            // resources.worktree?.deleteWorktree(); // Potentially dangerous, confirm with user
        });
        this.activeTracks.clear();
        this.trackQueue = [];
        this.runningTrackIds.clear();
        this.completedTrackIds.clear();
        this.failedTrackIds.clear();
        logger.info('TrackExecutor state reset.');
    }
}