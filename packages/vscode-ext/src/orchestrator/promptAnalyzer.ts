import * as vscode from 'vscode';
import * as os from 'os';
import { Logger } from '../util/logger';
import { ErrorHandler } from '../util/errorHandler';
import { WorkPlan, Track, WorkPlanParser } from './workPlanParser';
import { Graph } from '@dagrejs/graphlib';

const logger = new Logger('PromptAnalyzer');

// Configuration for AI prompt analysis
const PROMPT_ANALYSIS_CONFIG = {
    // Maximum number of parallel tracks based on system resources
    maxParallelTracks: Math.min(4, Math.floor(os.cpus().length / 2)),
    // Default complexity threshold for parallel execution
    parallelComplexityThreshold: 6,
    // Keywords that indicate parallelizable tasks
    parallelKeywords: ['in parallel', 'simultaneously', 'concurrently', 'at the same time'],
    // Keywords that indicate sequential dependencies
    dependencyKeywords: ['after', 'before', 'depends on', 'once', 'then', 'followed by'],
    // File overlap threshold for determining parallelizability
    fileOverlapThreshold: 0.3, // 30% overlap is acceptable for parallel execution
};

export interface PromptAnalysisResult {
    tracks: Track[];
    dependencyGraph: Graph;
    parallelizableTracks: string[][];
    systemResourceUsage: {
        cpuCores: number;
        maxConcurrency: number;
        recommendedConcurrency: number;
    };
}

export class PromptAnalyzer {
    private workPlanParser: WorkPlanParser;

    constructor() {
        this.workPlanParser = new WorkPlanParser();
    }

    /**
     * Analyzes a high-level user prompt and generates a detailed work plan.
     * Uses AI integration to parse user prompts and identify parallelizable tracks.
     * @param prompt The high-level user prompt.
     * @returns A Promise that resolves to a WorkPlan object.
     */
    public async analyzePrompt(prompt: string): Promise<WorkPlan> {
        logger.info(`Analyzing prompt: "${prompt}"`);

        try {
            // Step 1: Parse the prompt to identify tracks using NLP-like analysis
            const tracks = await this.parsePromptToTracks(prompt);
            
            // Step 2: Analyze dependencies between tracks
            const dependencyGraph = this.analyzeTrackDependencies(tracks, prompt);
            
            // Step 3: Determine optimal concurrency based on system resources
            const systemResourceUsage = this.analyzeSystemResources();
            
            // Step 4: Identify parallelizable tracks
            const parallelizableTracks = this.determineParallelizableTracks(
                tracks,
                dependencyGraph,
                systemResourceUsage
            );

            const workPlan: WorkPlan = {
                id: `workplan-${Date.now()}`,
                prompt: prompt,
                tracks,
                dependencyGraph,
                parallelizableTracks,
            };

            logger.info(`Generated work plan with ${workPlan.tracks.length} tracks and ${parallelizableTracks.length} parallel groups.`);
            return workPlan;
        } catch (error: any) {
            ErrorHandler.handleError(error, {
                showUser: true,
                logLevel: 'error',
                userMessage: 'Failed to analyze prompt and generate work plan',
                context: 'PromptAnalyzer.analyzePrompt'
            });
            throw error;
        }
    }

    /**
     * Parses a user prompt into a set of executable tracks.
     * Uses keyword analysis and pattern matching to identify tasks.
     * @param prompt The user prompt to parse.
     * @returns A Promise that resolves to an array of Track objects.
     */
    private async parsePromptToTracks(prompt: string): Promise<Track[]> {
        logger.debug('Parsing prompt to identify tracks');

        // Normalize the prompt for analysis
        const normalizedPrompt = prompt.toLowerCase().trim();
        
        // Use the WorkPlanParser to generate tracks from the prompt
        // This leverages the existing implementation while we enhance it
        const workPlan = await this.workPlanParser.parsePromptToWorkPlan(prompt);
        
        // Enhance the tracks with additional analysis
        const enhancedTracks = workPlan.tracks.map((track, index) => {
            // Analyze track complexity based on description and tasks
            const complexity = this.analyzeTrackComplexity(track, normalizedPrompt);
            
            // Estimate duration based on complexity and task count
            const duration = this.estimateTrackDuration(track, complexity);
            
            // Identify file overlaps with other tracks
            const fileOverlaps = this.identifyFileOverlaps(track, workPlan.tracks);
            
            return {
                ...track,
                estimatedComplexity: complexity,
                estimatedDuration: duration,
                fileOverlaps,
                status: 'pending' as const,
            };
        });

        logger.debug(`Identified ${enhancedTracks.length} tracks from prompt`);
        return enhancedTracks;
    }

    /**
     * Analyzes dependencies between tracks based on the prompt content.
     * @param tracks The array of tracks to analyze.
     * @param prompt The original user prompt.
     * @returns A Graph object representing the track dependencies.
     */
    private analyzeTrackDependencies(tracks: Track[], prompt: string): Graph {
        logger.debug('Analyzing track dependencies');

        const graph = new Graph();
        
        // Add all tracks as nodes
        tracks.forEach(track => {
            graph.setNode(track.id, track);
        });

        // Analyze dependencies based on keyword patterns
        const normalizedPrompt = prompt.toLowerCase();
        
        tracks.forEach(track => {
            // Check for explicit dependency keywords in the prompt
            const dependencies: string[] = [];
            
            PROMPT_ANALYSIS_CONFIG.dependencyKeywords.forEach(keyword => {
                const pattern = new RegExp(`(${keyword})\\s+.*?(track\\s*\\d+|${track.name.toLowerCase()})`, 'gi');
                const matches = normalizedPrompt.matchAll(pattern);
                
                for (const match of matches) {
                    // Find which track this dependency refers to
                    const referencedTrack = tracks.find(t =>
                        match[0].includes(t.name.toLowerCase()) ||
                        match[0].includes(t.id.replace('track-', ''))
                    );
                    
                    if (referencedTrack && referencedTrack.id !== track.id) {
                        dependencies.push(referencedTrack.id);
                    }
                }
            });

            // Add dependencies to the graph
            dependencies.forEach(depId => {
                if (graph.hasNode(depId)) {
                    graph.setEdge(depId, track.id);
                    logger.debug(`Added dependency: ${depId} -> ${track.id}`);
                }
            });
        });

        // Use the WorkPlanParser's dependency analysis as a fallback
        if (graph.edgeCount() === 0) {
            const fallbackGraph = this.workPlanParser.buildDependencyGraph(tracks);
            fallbackGraph.edges().forEach(edge => {
                graph.setEdge(edge.v, edge.w);
            });
        }

        logger.debug(`Built dependency graph with ${graph.nodeCount()} nodes and ${graph.edgeCount()} edges`);
        return graph;
    }

    /**
     * Analyzes system resources to determine optimal concurrency.
     * @returns System resource usage information.
     */
    private analyzeSystemResources() {
        logger.debug('Analyzing system resources for concurrency optimization');

        const cpuCores = os.cpus().length;
        const totalMemoryGB = os.totalmem() / (1024 * 1024 * 1024);
        const freeMemoryGB = os.freemem() / (1024 * 1024 * 1024);
        
        // Calculate max concurrency based on CPU cores (50% utilization)
        const maxConcurrency = Math.min(
            PROMPT_ANALYSIS_CONFIG.maxParallelTracks,
            Math.max(1, Math.floor(cpuCores / 2))
        );
        
        // Adjust recommended concurrency based on available memory
        let recommendedConcurrency = maxConcurrency;
        if (freeMemoryGB < 2) {
            recommendedConcurrency = Math.max(1, Math.floor(maxConcurrency / 2));
        } else if (freeMemoryGB < 4) {
            recommendedConcurrency = Math.max(1, Math.floor(maxConcurrency * 0.75));
        }

        const resourceUsage = {
            cpuCores,
            maxConcurrency,
            recommendedConcurrency,
        };

        logger.debug(`System resources: ${JSON.stringify(resourceUsage)}`);
        return resourceUsage;
    }

    /**
     * Determines which tracks can be executed in parallel.
     * @param tracks The array of tracks to analyze.
     * @param dependencyGraph The dependency graph.
     * @param systemResourceUsage System resource information.
     * @returns A 2D array of track IDs that can run in parallel.
     */
    private determineParallelizableTracks(
        tracks: Track[],
        dependencyGraph: Graph,
        systemResourceUsage: { recommendedConcurrency: number }
    ): string[][] {
        logger.debug('Determining parallelizable tracks');

        // Use the WorkPlanParser's parallelization algorithm
        let parallelGroups = this.workPlanParser.determineParallelizableTracks(tracks, dependencyGraph);
        
        // Adjust groups based on system resources
        if (systemResourceUsage.recommendedConcurrency < parallelGroups.length) {
            // Merge smaller groups to fit within resource constraints
            parallelGroups = this.mergeParallelGroups(parallelGroups, systemResourceUsage.recommendedConcurrency);
        }

        // Filter groups based on file overlap analysis
        parallelGroups = parallelGroups.filter(group => {
            return this.hasAcceptableFileOverlap(group, tracks);
        });

        logger.debug(`Determined ${parallelGroups.length} parallel groups`);
        return parallelGroups;
    }

    /**
     * Analyzes the complexity of a track based on its description and tasks.
     * @param track The track to analyze.
     * @param prompt The normalized user prompt.
     * @returns A complexity score (1-10).
     */
    private analyzeTrackComplexity(track: Track, prompt: string): number {
        // Base complexity from description length and task count
        let complexity = Math.min(10, Math.max(1, track.tasks.length));
        
        // Adjust based on description keywords
        const complexityKeywords = {
            high: ['complex', 'difficult', 'advanced', 'sophisticated', 'enterprise'],
            medium: ['implement', 'develop', 'create', 'build'],
            low: ['simple', 'basic', 'setup', 'configure']
        };
        
        Object.entries(complexityKeywords).forEach(([level, keywords]) => {
            if (keywords.some(keyword => track.description.toLowerCase().includes(keyword))) {
                const adjustment = level === 'high' ? 2 : level === 'medium' ? 1 : -1;
                complexity = Math.min(10, Math.max(1, complexity + adjustment));
            }
        });
        
        return complexity;
    }

    /**
     * Estimates the duration of a track in minutes.
     * @param track The track to estimate duration for.
     * @param complexity The track's complexity score.
     * @returns Estimated duration in minutes.
     */
    private estimateTrackDuration(track: Track, complexity: number): number {
        // Base duration: 30 minutes per task
        let duration = track.tasks.length * 30;
        
        // Adjust based on complexity
        duration *= (0.5 + (complexity / 10));
        
        // Round to nearest 15 minutes
        return Math.round(duration / 15) * 15;
    }

    /**
     * Identifies file overlaps between tracks.
     * @param track The track to analyze.
     * @param allTracks All tracks in the work plan.
     * @returns Array of file paths that overlap with other tracks.
     */
    private identifyFileOverlaps(track: Track, allTracks: Track[]): string[] {
        const overlaps: string[] = [];
        
        allTracks.forEach(otherTrack => {
            if (otherTrack.id !== track.id) {
                const overlappingFiles = track.fileOverlaps.filter(file =>
                    otherTrack.fileOverlaps.includes(file)
                );
                overlaps.push(...overlappingFiles);
            }
        });
        
        // Return unique overlaps
        return [...new Set(overlaps)];
    }

    /**
     * Merges parallel groups to fit within concurrency constraints.
     * @param groups The original parallel groups.
     * @param maxGroups The maximum number of groups allowed.
     * @returns Merged parallel groups.
     */
    private mergeParallelGroups(groups: string[][], maxGroups: number): string[][] {
        if (groups.length <= maxGroups) {
            return groups;
        }
        
        const merged: string[][] = [];
        const skipIndices = new Set<number>();
        
        for (let i = 0; i < groups.length && merged.length < maxGroups; i++) {
            if (skipIndices.has(i)) continue;
            
            let currentGroup = [...groups[i]];
            
            // Try to merge with the next group if we have capacity
            if (merged.length < maxGroups - 1 && i + 1 < groups.length) {
                currentGroup = [...currentGroup, ...groups[i + 1]];
                skipIndices.add(i + 1);
            }
            
            merged.push(currentGroup);
        }
        
        return merged;
    }

    /**
     * Checks if a group has acceptable file overlap for parallel execution.
     * @param group The group of track IDs.
     * @param tracks All tracks.
     * @returns True if the group has acceptable file overlap.
     */
    private hasAcceptableFileOverlap(group: string[], tracks: Track[]): boolean {
        if (group.length <= 1) return true;
        
        const groupTracks = group.map(id => tracks.find(t => t.id === id)).filter(Boolean) as Track[];
        
        for (let i = 0; i < groupTracks.length; i++) {
            for (let j = i + 1; j < groupTracks.length; j++) {
                const track1 = groupTracks[i];
                const track2 = groupTracks[j];
                
                const overlapCount = track1.fileOverlaps.filter(file =>
                    track2.fileOverlaps.includes(file)
                ).length;
                
                const overlapRatio = overlapCount / Math.max(track1.fileOverlaps.length, track2.fileOverlaps.length);
                
                if (overlapRatio > PROMPT_ANALYSIS_CONFIG.fileOverlapThreshold) {
                    logger.debug(`Group rejected due to file overlap: ${track1.id} <-> ${track2.id} (${overlapRatio.toFixed(2)})`);
                    return false;
                }
            }
        }
        
        return true;
    }
}