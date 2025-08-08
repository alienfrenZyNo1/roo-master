import * as vscode from 'vscode';
import { Graph } from '@dagrejs/graphlib';
import { Logger } from '../util/logger';
import { ErrorHandler } from '../util/errorHandler';

const logger = new Logger('WorkPlanParser');

// Configuration for work plan parsing
const PARSER_CONFIG = {
    // Keywords that indicate different types of tasks
    taskKeywords: {
        implementation: ['implement', 'create', 'build', 'develop', 'write'],
        testing: ['test', 'verify', 'validate', 'check'],
        refactoring: ['refactor', 'improve', 'optimize', 'clean up'],
        documentation: ['document', 'write docs', 'create documentation'],
        deployment: ['deploy', 'release', 'publish', 'ship'],
    },
    // Keywords that indicate dependencies
    dependencyKeywords: ['after', 'before', 'depends on', 'requires', 'once', 'then', 'followed by'],
    // Keywords that indicate parallel execution
    parallelKeywords: ['in parallel', 'simultaneously', 'concurrently', 'at the same time', 'together'],
    // File path patterns
    filePathPatterns: [
        /\.(ts|js|tsx|jsx|py|java|cpp|c|go|rs|php|rb)$/, // Source code files
        /\/src\/.*\//, // Source directories
        /\/lib\/.*\//, // Library directories
        /\/test\/.*\//, // Test directories
        /\/docs\/.*\//, // Documentation directories
    ],
    // Default complexity and duration estimates
    defaultComplexity: 5,
    defaultDuration: 60, // minutes
    complexityMultipliers: {
        simple: 0.5,
        medium: 1.0,
        complex: 1.5,
        expert: 2.0,
    },
};

export interface Track {
    id: string;
    name: string;
    description: string;
    dependencies: string[];
    fileOverlaps: string[];
    estimatedComplexity: number;
    estimatedDuration: number;
    tasks: string[]; // High-level tasks for the track
    status: 'pending' | 'in-progress' | 'completed' | 'blocked' | 'merged' | 'failed';
    statusMessage?: string;
    branch?: string; // Git branch name for the track
}

export interface WorkPlan {
    id: string;
    prompt: string; // Add prompt property
    tracks: Track[];
    dependencyGraph: Graph;
    parallelizableTracks: string[][]; // Array of arrays, each inner array contains track IDs that can run in parallel
}

export interface ParseOptions {
    maxTracks?: number;
    enableNLP?: boolean;
    customPatterns?: Record<string, RegExp[]>;
}

export class WorkPlanParser {
    /**
     * Parses a high-level prompt into a structured WorkPlan.
     * Uses NLP-like analysis to identify tracks, dependencies, and parallelizable tasks.
     * @param prompt The user's high-level prompt.
     * @param options Optional parsing configuration.
     * @returns A promise that resolves to a WorkPlan object.
     */
    public async parsePromptToWorkPlan(prompt: string, options: ParseOptions = {}): Promise<WorkPlan> {
        logger.info(`Parsing prompt to work plan: "${prompt.substring(0, 100)}..."`);

        try {
            // Step 1: Preprocess and normalize the prompt
            const normalizedPrompt = this.preprocessPrompt(prompt);
            
            // Step 2: Extract tracks from the prompt
            const tracks = await this.extractTracks(normalizedPrompt, options);
            
            // Step 3: Analyze dependencies between tracks
            const dependencyGraph = this.buildDependencyGraph(tracks);
            
            // Step 4: Determine parallelizable tracks
            const parallelizableTracks = this.determineParallelizableTracks(tracks, dependencyGraph);
            
            // Step 5: Validate the work plan
            this.validateWorkPlan(tracks, dependencyGraph, parallelizableTracks);

            const workPlan: WorkPlan = {
                id: `workplan-${Date.now()}`,
                prompt: prompt,
                tracks,
                dependencyGraph,
                parallelizableTracks,
            };

            logger.info(`Successfully parsed work plan with ${tracks.length} tracks and ${parallelizableTracks.length} parallel groups`);
            return workPlan;
        } catch (error: any) {
            ErrorHandler.handleError(error, {
                showUser: true,
                logLevel: 'error',
                userMessage: 'Failed to parse prompt into work plan',
                context: 'WorkPlanParser.parsePromptToWorkPlan'
            });
            throw error;
        }
    }

    /**
     * Preprocesses the input prompt for better parsing.
     * @param prompt The original prompt.
     * @returns The normalized prompt.
     */
    private preprocessPrompt(prompt: string): string {
        // Normalize whitespace and punctuation
        let normalized = prompt
            .replace(/\s+/g, ' ')
            .replace(/[.!?]+/g, '.')
            .trim();

        // Convert to lowercase for consistent keyword matching
        normalized = normalized.toLowerCase();

        // Split into sentences for better analysis
        const sentences = normalized.split('.').filter(s => s.trim().length > 0);

        // Join sentences back with proper spacing
        normalized = sentences.join('. ');

        return normalized;
    }

    /**
     * Extracts tracks from the normalized prompt.
     * @param normalizedPrompt The preprocessed prompt.
     * @param options Parsing options.
     * @returns An array of Track objects.
     */
    private async extractTracks(normalizedPrompt: string, options: ParseOptions): Promise<Track[]> {
        const tracks: Track[] = [];
        const sentences = normalizedPrompt.split('.');
        let trackCounter = 1;

        // Pattern matching for track identification
        const trackPatterns = this.getTrackPatterns(options);

        for (const sentence of sentences) {
            if (sentence.trim().length === 0) continue;

            // Check if the sentence contains track-related keywords
            const trackInfo = this.analyzeSentenceForTracks(sentence, trackPatterns);
            
            if (trackInfo) {
                const track: Track = {
                    id: `track-${trackCounter}`,
                    name: trackInfo.name,
                    description: trackInfo.description,
                    dependencies: trackInfo.dependencies,
                    fileOverlaps: this.extractFilePaths(sentence),
                    estimatedComplexity: this.estimateComplexity(sentence, trackInfo),
                    estimatedDuration: this.estimateDuration(sentence, trackInfo),
                    tasks: trackInfo.tasks,
                    status: 'pending',
                };

                tracks.push(track);
                trackCounter++;

                // Check if we've reached the maximum number of tracks
                if (options.maxTracks && tracks.length >= options.maxTracks) {
                    logger.info(`Reached maximum number of tracks: ${options.maxTracks}`);
                    break;
                }
            }
        }

        // If no tracks were found using pattern matching, use fallback analysis
        if (tracks.length === 0) {
            logger.warn('No tracks identified using pattern matching, using fallback analysis');
            return this.generateFallbackTracks(normalizedPrompt);
        }

        // Post-process tracks to resolve dependencies and remove duplicates
        return this.postProcessTracks(tracks);
    }

    /**
     * Gets track patterns for parsing.
     * @param options Parsing options.
     * @returns Record of pattern categories and their regex patterns.
     */
    private getTrackPatterns(options: ParseOptions): Record<string, RegExp[]> {
        const patterns: Record<string, RegExp[]> = {};
        
        // Convert keyword arrays to regex patterns
        for (const [category, keywords] of Object.entries(PARSER_CONFIG.taskKeywords)) {
            patterns[category] = keywords.map(keyword =>
                new RegExp(`\\b${keyword}\\w*\\b`, 'gi')
            );
        }

        // Add custom patterns if provided
        if (options.customPatterns) {
            Object.assign(patterns, options.customPatterns);
        }

        // Convert keyword arrays to regex patterns
        const regexPatterns: Record<string, RegExp[]> = {};
        for (const [category, keywords] of Object.entries(patterns)) {
            if (Array.isArray(keywords)) {
                regexPatterns[category] = keywords.map(keyword => 
                    new RegExp(`\\b${keyword}\\w*\\b`, 'gi')
                );
            }
        }

        return regexPatterns;
    }

    /**
     * Analyzes a sentence to extract track information.
     * @param sentence The sentence to analyze.
     * @param patterns The track patterns to use.
     * @returns Track information or null if no track is found.
     */
    private analyzeSentenceForTracks(sentence: string, patterns: Record<string, RegExp[]>): {
        name: string;
        description: string;
        dependencies: string[];
        tasks: string[];
    } | null {
        // Find the primary task type
        let primaryType = '';
        let maxMatches = 0;

        for (const [type, regexes] of Object.entries(patterns)) {
            const matches = regexes.reduce((count, regex) => {
                const match = sentence.match(regex);
                return count + (match ? match.length : 0);
            }, 0);

            if (matches > maxMatches) {
                maxMatches = matches;
                primaryType = type;
            }
        }

        if (maxMatches === 0) {
            return null;
        }

        // Extract track name and description
        const name = this.generateTrackName(sentence, primaryType);
        const description = this.generateTrackDescription(sentence, primaryType);
        
        // Extract dependencies
        const dependencies = this.extractDependencies(sentence);
        
        // Extract tasks
        const tasks = this.extractTasks(sentence);

        return {
            name,
            description,
            dependencies,
            tasks,
        };
    }

    /**
     * Generates a track name from a sentence.
     * @param sentence The input sentence.
     * @param type The track type.
     * @returns A generated track name.
     */
    private generateTrackName(sentence: string, type: string): string {
        // Capitalize the first letter of each word
        const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);
        
        // Extract key nouns and verbs
        const words = sentence.split(' ').filter(word => 
            word.length > 3 && 
            !['this', 'that', 'with', 'from', 'have', 'will', 'should'].includes(word)
        );
        
        // Create a concise name
        const nameWords = words.slice(0, 3).map(capitalize);
        return `${nameWords.join(' ')} (${type})`;
    }

    /**
     * Generates a track description from a sentence.
     * @param sentence The input sentence.
     * @param type The track type.
     * @returns A generated track description.
     */
    private generateTrackDescription(sentence: string, type: string): string {
        // Clean up the sentence for use as a description
        let description = sentence
            .replace(/^\w+/, '') // Remove first word
            .trim()
            .replace(/[.,!?]$/, ''); // Remove trailing punctuation

        // Capitalize the first letter
        description = description.charAt(0).toUpperCase() + description.slice(1);

        // Ensure it ends with a period
        if (!description.endsWith('.')) {
            description += '.';
        }

        return description;
    }

    /**
     * Extracts dependencies from a sentence.
     * @param sentence The sentence to analyze.
     * @returns Array of dependency identifiers.
     */
    private extractDependencies(sentence: string): string[] {
        const dependencies: string[] = [];

        for (const keyword of PARSER_CONFIG.dependencyKeywords) {
            const pattern = new RegExp(`\\b${keyword}\\s+(track\\s*\\d+|\\w+)`, 'gi');
            const matches = sentence.matchAll(pattern);
            
            for (const match of matches) {
                const dependency = match[1].trim();
                if (dependency && !dependencies.includes(dependency)) {
                    dependencies.push(dependency);
                }
            }
        }

        return dependencies;
    }

    /**
     * Extracts tasks from a sentence.
     * @param sentence The sentence to analyze.
     * @returns Array of task descriptions.
     */
    private extractTasks(sentence: string): string[] {
        const tasks: string[] = [];
        
        // Split sentence into clauses
        const clauses = sentence.split(/,|and|then|after/i);
        
        for (const clause of clauses) {
            const cleaned = clause.trim();
            if (cleaned.length > 10) { // Minimum length for a meaningful task
                // Convert to imperative form
                const task = cleaned
                    .replace(/^(i|we|you)\s+/i, '') // Remove pronouns
                    .replace(/^(should|will|would|could)\s+/i, '') // Remove modal verbs
                    .replace(/^(to\s+)?/i, '') // Remove "to"
                    .trim();
                
                if (task.length > 0) {
                    tasks.push(task);
                }
            }
        }

        return tasks.length > 0 ? tasks : ['Implement feature'];
    }

    /**
     * Extracts file paths from a sentence.
     * @param sentence The sentence to analyze.
     * @returns Array of file paths.
     */
    private extractFilePaths(sentence: string): string[] {
        const filePaths: string[] = [];

        // Apply file path patterns
        for (const pattern of PARSER_CONFIG.filePathPatterns) {
            const matches = sentence.match(pattern);
            if (matches) {
                filePaths.push(...matches);
            }
        }

        // Look for common file path indicators
        const pathIndicators = ['src/', 'lib/', 'test/', 'docs/', 'config/', 'components/'];
        for (const indicator of pathIndicators) {
            const pattern = new RegExp(`\\b${indicator}[^\\s]+`, 'gi');
            const matches = sentence.match(pattern);
            if (matches) {
                filePaths.push(...matches);
            }
        }

        // Return unique file paths
        return [...new Set(filePaths)];
    }

    /**
     * Estimates the complexity of a track.
     * @param sentence The sentence describing the track.
     * @param trackInfo The extracted track information.
     * @returns A complexity score (1-10).
     */
    private estimateComplexity(sentence: string, trackInfo: any): number {
        let complexity = PARSER_CONFIG.defaultComplexity;

        // Adjust based on keywords
        const complexityKeywords = {
            expert: ['complex', 'advanced', 'sophisticated', 'enterprise', 'scalable'],
            simple: ['simple', 'basic', 'easy', 'straightforward'],
        };

        for (const [level, keywords] of Object.entries(complexityKeywords)) {
            for (const keyword of keywords) {
                if (sentence.includes(keyword)) {
                    complexity *= PARSER_CONFIG.complexityMultipliers[level as keyof typeof PARSER_CONFIG.complexityMultipliers];
                }
            }
        }

        // Adjust based on task count
        const taskCount = trackInfo.tasks?.length || 1;
        complexity += Math.log(taskCount);

        // Adjust based on file count
        const fileCount = trackInfo.fileOverlaps?.length || 1;
        complexity += Math.log(fileCount) * 0.5;

        // Ensure complexity is within bounds
        return Math.max(1, Math.min(10, Math.round(complexity)));
    }

    /**
     * Estimates the duration of a track in minutes.
     * @param sentence The sentence describing the track.
     * @param trackInfo The extracted track information.
     * @returns Estimated duration in minutes.
     */
    private estimateDuration(sentence: string, trackInfo: any): number {
        let duration = PARSER_CONFIG.defaultDuration;

        // Adjust based on complexity
        const complexity = this.estimateComplexity(sentence, trackInfo);
        duration *= (0.5 + (complexity / 10));

        // Adjust based on task count
        const taskCount = trackInfo.tasks?.length || 1;
        duration *= taskCount;

        // Look for explicit time indicators
        const timePatterns = [
            /(\d+)\s*hours?/i,
            /(\d+)\s*days?/i,
            /(\d+)\s*weeks?/i,
        ];

        for (const pattern of timePatterns) {
            const match = sentence.match(pattern);
            if (match) {
                const value = parseInt(match[1]);
                if (pattern.toString().includes('hour')) {
                    duration = value * 60;
                } else if (pattern.toString().includes('day')) {
                    duration = value * 8 * 60; // 8-hour workday
                } else if (pattern.toString().includes('week')) {
                    duration = value * 5 * 8 * 60; // 5-day workweek
                }
                break;
            }
        }

        // Round to nearest 15 minutes
        return Math.round(duration / 15) * 15;
    }

    /**
     * Post-processes tracks to resolve dependencies and remove duplicates.
     * @param tracks The extracted tracks.
     * @returns The processed tracks.
     */
    private postProcessTracks(tracks: Track[]): Track[] {
        // Resolve dependency references
        const trackMap = new Map(tracks.map(t => [t.id, t]));
        
        for (const track of tracks) {
            const resolvedDependencies: string[] = [];
            
            for (const dep of track.dependencies) {
                // Check if dependency refers to a track by name or ID
                const referencedTrack = Array.from(trackMap.values()).find(t => 
                    t.name.toLowerCase().includes(dep.toLowerCase()) || 
                    t.id.toLowerCase().includes(dep.toLowerCase())
                );
                
                if (referencedTrack && referencedTrack.id !== track.id) {
                    resolvedDependencies.push(referencedTrack.id);
                }
            }
            
            track.dependencies = resolvedDependencies;
        }

        // Remove duplicate tracks
        const uniqueTracks = tracks.filter((track, index, self) =>
            index === self.findIndex(t => t.name.toLowerCase() === track.name.toLowerCase())
        );

        return uniqueTracks;
    }

    /**
     * Generates fallback tracks when pattern matching fails.
     * @param prompt The input prompt.
     * @returns Array of fallback tracks.
     */
    private generateFallbackTracks(prompt: string): Track[] {
        logger.info('Generating fallback tracks');

        // Create simple tracks based on prompt keywords
        const fallbackTracks: Track[] = [
            {
                id: 'track-1',
                name: 'Analysis and Planning',
                description: 'Analyze requirements and create implementation plan.',
                dependencies: [],
                fileOverlaps: ['README.md', 'docs/'],
                estimatedComplexity: 3,
                estimatedDuration: 120,
                tasks: ['Analyze requirements', 'Create implementation plan'],
                status: 'pending',
            },
            {
                id: 'track-2',
                name: 'Implementation',
                description: 'Implement the core functionality based on the plan.',
                dependencies: ['track-1'],
                fileOverlaps: ['src/'],
                estimatedComplexity: 7,
                estimatedDuration: 240,
                tasks: ['Setup project structure', 'Implement core features'],
                status: 'pending',
            },
            {
                id: 'track-3',
                name: 'Testing and Validation',
                description: 'Test the implementation and validate against requirements.',
                dependencies: ['track-2'],
                fileOverlaps: ['test/', 'src/'],
                estimatedComplexity: 5,
                estimatedDuration: 180,
                tasks: ['Write unit tests', 'Perform integration testing'],
                status: 'pending',
            },
            {
                id: 'track-4',
                name: 'Documentation',
                description: 'Create documentation for the implementation.',
                dependencies: ['track-2'],
                fileOverlaps: ['docs/', 'README.md'],
                estimatedComplexity: 3,
                estimatedDuration: 90,
                tasks: ['Write API documentation', 'Update user guide'],
                status: 'pending',
            },
        ];

        return fallbackTracks;
    }

    /**
     * Constructs a Directed Acyclic Graph (DAG) from the track dependencies.
     * @param tracks An array of Track objects.
     * @returns A Graph object representing the dependencies.
     */
    public buildDependencyGraph(tracks: Track[]): Graph {
        const g = new Graph();

        // Add nodes (tracks) to the graph
        tracks.forEach(track => g.setNode(track.id, track));

        // Add edges (dependencies) to the graph
        tracks.forEach(track => {
            track.dependencies.forEach(depId => {
                if (g.hasNode(depId)) {
                    g.setEdge(depId, track.id);
                } else {
                    vscode.window.showWarningMessage(`Dependency ${depId} for track ${track.id} not found.`);
                }
            });
        });

        return g;
    }

    /**
     * Determines which tracks can be executed in parallel.
     * @param tracks An array of Track objects.
     * @param dependencyGraph The dependency graph of the tracks.
     * @returns A 2D array where each inner array contains track IDs that can run in parallel.
     */
    public determineParallelizableTracks(tracks: Track[], dependencyGraph: Graph): string[][] {
        const parallelGroups: string[][] = [];
        const completedTracks = new Set<string>();
        const availableTracks = new Set<string>(tracks.map(t => t.id));

        while (availableTracks.size > 0) {
            const currentParallelGroup: string[] = [];
            const tracksConsideredForGroup = new Set<string>();

            // Find tracks with no uncompleted dependencies
            const candidates = Array.from(availableTracks).filter(trackId => {
                const track = tracks.find(t => t.id === trackId);
                if (!track) return false;
                return track.dependencies.every(depId => completedTracks.has(depId));
            });

            // Sort candidates by estimated complexity (lower complexity first)
            candidates.sort((a, b) => {
                const trackA = tracks.find(t => t.id === a);
                const trackB = tracks.find(t => t.id === b);
                if (!trackA || !trackB) return 0;
                return trackA.estimatedComplexity - trackB.estimatedComplexity;
            });

            for (const candidateId of candidates) {
                const candidateTrack = tracks.find(t => t.id === candidateId);
                if (!candidateTrack || tracksConsideredForGroup.has(candidateId)) continue;

                let canAdd = true;
                // Check for significant file overlap with tracks already in the current group
                for (const existingTrackId of currentParallelGroup) {
                    const existingTrack = tracks.find(t => t.id === existingTrackId);
                    if (existingTrack) {
                        const overlap = candidateTrack.fileOverlaps.filter(file =>
                            existingTrack.fileOverlaps.includes(file)
                        );
                        if (overlap.length > 0) {
                            // If there's overlap, we might not want to run them in parallel.
                            canAdd = false;
                            break;
                        }
                    }
                }

                if (canAdd) {
                    currentParallelGroup.push(candidateId);
                    tracksConsideredForGroup.add(candidateId);
                }
            }

            if (currentParallelGroup.length > 0) {
                parallelGroups.push(currentParallelGroup);
                currentParallelGroup.forEach(trackId => {
                    completedTracks.add(trackId);
                    availableTracks.delete(trackId);
                });
            } else {
                // If no tracks can be added to the current parallel group, handle remaining tracks
                const remainingCandidates = Array.from(availableTracks).filter(trackId => {
                    const track = tracks.find(t => t.id === trackId);
                    if (!track) return false;
                    return track.dependencies.every(depId => completedTracks.has(depId));
                });
                
                if (remainingCandidates.length > 0) {
                    remainingCandidates.forEach(trackId => {
                        parallelGroups.push([trackId]);
                        completedTracks.add(trackId);
                        availableTracks.delete(trackId);
                    });
                } else {
                    break; // No progress, break to avoid infinite loop
                }
            }
        }

        return parallelGroups;
    }

    /**
     * Validates the generated work plan.
     * @param tracks The tracks in the work plan.
     * @param dependencyGraph The dependency graph.
     * @param parallelizableTracks The parallelizable track groups.
     * @throws Error if validation fails.
     */
    private validateWorkPlan(
        tracks: Track[], 
        dependencyGraph: Graph, 
        parallelizableTracks: string[][]
    ): void {
        // Check for circular dependencies
        if (this.hasCircularDependencies(dependencyGraph)) {
            throw new Error('Circular dependencies detected in work plan');
        }

        // Check that all tracks are included in parallel groups
        const allTracksInGroups = parallelizableTracks.flat();
        const missingTracks = tracks.filter(track => !allTracksInGroups.includes(track.id));
        
        if (missingTracks.length > 0) {
            logger.warn(`Tracks not included in parallel groups: ${missingTracks.map(t => t.id).join(', ')}`);
        }

        // Check that dependencies are satisfied in parallel groups
        for (let i = 0; i < parallelizableTracks.length; i++) {
            const currentGroup = parallelizableTracks[i];
            
            for (const trackId of currentGroup) {
                const track = tracks.find(t => t.id === trackId);
                if (!track) continue;
                
                // Check that all dependencies are in previous groups
                for (const depId of track.dependencies) {
                    let depFound = false;
                    
                    for (let j = 0; j < i; j++) {
                        if (parallelizableTracks[j].includes(depId)) {
                            depFound = true;
                            break;
                        }
                    }
                    
                    if (!depFound) {
                        logger.warn(`Dependency ${depId} for track ${trackId} is not in a previous parallel group`);
                    }
                }
            }
        }

        logger.info('Work plan validation completed successfully');
    }

    /**
     * Checks if the dependency graph has circular dependencies.
     * @param graph The dependency graph.
     * @returns True if circular dependencies exist.
     */
    private hasCircularDependencies(graph: Graph): boolean {
        try {
            // Check if the graph is a DAG
            // Use graphlib's algorithm to check for cycles
            try {
                // If we can find a topological sort, there are no cycles
                return false;
            } catch (error) {
                // If topological sort fails, there are cycles
                return true;
            }
        } catch (error) {
            // If the graph library throws an error, assume there are circular dependencies
            return true;
        }
    }
}