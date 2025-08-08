import * as vscode from 'vscode';
import { Graph } from '@dagrejs/graphlib';

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
}

export interface WorkPlan {
    id: string;
    prompt: string; // Add prompt property
    tracks: Track[];
    dependencyGraph: Graph;
    parallelizableTracks: string[][]; // Array of arrays, each inner array contains track IDs that can run in parallel
}

export class WorkPlanParser {
    /**
     * Parses a high-level prompt into a structured WorkPlan.
     * This is a placeholder; actual parsing logic would involve NLP and deeper analysis.
     * @param prompt The user's high-level prompt.
     * @returns A promise that resolves to a WorkPlan object.
     */
    public async parsePromptToWorkPlan(prompt: string): Promise<WorkPlan> {
        // Placeholder for actual prompt parsing and track identification
        // In a real scenario, this would involve sophisticated NLP and domain knowledge.
        // For now, we'll create a dummy work plan.

        const dummyTracks: Track[] = [
            {
                id: 'track-1',
                name: 'Implement User Authentication',
                description: 'Set up user login, registration, and session management.',
                dependencies: [],
                fileOverlaps: ['src/auth.ts', 'src/user.ts'],
                estimatedComplexity: 5,
                estimatedDuration: 120,
                tasks: ['Create auth routes', 'Implement JWT generation', 'Develop user model'],
                status: 'pending',
            },
            {
                id: 'track-2',
                name: 'Design Database Schema',
                description: 'Define tables and relationships for user data and other entities.',
                dependencies: [],
                fileOverlaps: ['src/db.ts', 'src/user.ts'],
                estimatedComplexity: 3,
                estimatedDuration: 60,
                tasks: ['Define user table', 'Define product table', 'Set up ORM'],
                status: 'pending',
            },
            {
                id: 'track-3',
                name: 'Build Product Catalog Page',
                description: 'Develop the frontend and backend for displaying products.',
                dependencies: ['track-2'],
                fileOverlaps: ['src/product.ts', 'src/frontend/catalog.tsx'],
                estimatedComplexity: 4,
                estimatedDuration: 90,
                tasks: ['Fetch product data', 'Render product list', 'Implement search'],
                status: 'pending',
            },
            {
                id: 'track-4',
                name: 'Integrate Payment Gateway',
                description: 'Connect to a payment service for processing transactions.',
                dependencies: ['track-1', 'track-3'],
                fileOverlaps: ['src/payment.ts', 'src/frontend/checkout.tsx'],
                estimatedComplexity: 6,
                estimatedDuration: 180,
                tasks: ['Set up payment API client', 'Create checkout flow', 'Handle webhooks'],
                status: 'pending',
            },
        ];

        const dependencyGraph = this.buildDependencyGraph(dummyTracks);
        const parallelizableTracks = this.determineParallelizableTracks(dummyTracks, dependencyGraph);

        return {
            id: `workplan-${Date.now()}`, // Add id
            prompt: prompt, // Add prompt
            tracks: dummyTracks,
            dependencyGraph,
            parallelizableTracks,
        };
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
     * Determines which tracks can be executed in parallel by minimizing file overlap.
     * This algorithm prioritizes tracks with no dependencies first, then considers file overlaps.
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

            // Sort candidates by estimated complexity (or other heuristics) if needed
            // candidates.sort((a, b) => { ... });

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
                            // This is a simplified check; a more advanced algorithm might
                            // quantify overlap and decide based on a threshold.
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
                // If no tracks can be added to the current parallel group, it means
                // either all remaining tracks have unfulfilled dependencies (a cycle, which shouldn't happen in a DAG)
                // or all remaining tracks have unavoidable file overlaps.
                // For this simplified model, we'll assume a linear execution for remaining if no parallel group can be formed.
                // In a more robust system, this might indicate a problem or require user intervention.
                console.warn('No more parallelizable tracks found. Remaining tracks might have unresolved dependencies or significant overlaps.');
                // To prevent infinite loops in case of unexpected graph states, break if no progress is made.
                if (candidates.length > 0 && currentParallelGroup.length === 0) {
                    // This means candidates exist but couldn't be added due to overlap.
                    // If no parallelization is possible due to overlaps, add remaining candidates one by one.
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
                } else {
                    break; // No candidates left or no progress
                }
            }
        }

        return parallelGroups;
    }
}