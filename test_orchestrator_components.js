const { PromptAnalyzer } = require('./packages/vscode-ext/src/orchestrator/promptAnalyzer');
const { WorkPlanParser } = require('./packages/vscode-ext/src/orchestrator/workPlanParser');
const { TrackExecutor } = require('./packages/vscode-ext/src/orchestrator/trackExecutor');

// Mock VS Code API
const mockVscode = {
    window: {
        showInformationMessage: jest.fn(),
        showWarningMessage: jest.fn(),
        showErrorMessage: jest.fn()
    },
    Uri: {
        joinPath: jest.fn().mockReturnValue({ fsPath: '/test/path' })
    },
    EventEmitter: jest.fn().mockImplementation(() => ({
        event: jest.fn(),
        fire: jest.fn()
    })),
    ExtensionContext: jest.fn()
};

// Mock logger
const mockLogger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
};

// Mock error handler
const mockErrorHandler = {
    handleError: jest.fn(),
    getCircuitBreaker: jest.fn().mockReturnValue({
        execute: jest.fn().mockImplementation(fn => fn()),
        reset: jest.fn()
    })
};

// Mock Git worktree
const mockGitWorktree = {
    createWorktree: jest.fn(),
    removeWorktree: jest.fn(),
    addAndCommitAll: jest.fn()
};

// Mock MCP server launcher
const mockMcpServerLauncher = {
    useTool: jest.fn(),
    stopMcpServer: jest.fn()
};

// Mock MCP server registration
const mockMcpServerRegistration = {
    registerServer: jest.fn()
};

// Mock Docker functions
const mockStartToolContainer = jest.fn().mockResolvedValue('container-id');
const mockStopToolContainer = jest.fn();

// Set up mocks
jest.mock('vscode', () => mockVscode);
jest.mock('../packages/vscode-ext/src/util/logger', () => ({
    Logger: jest.fn().mockImplementation(() => mockLogger)
}));
jest.mock('../packages/vscode-ext/src/util/errorHandler', () => ({
    ErrorHandler: mockErrorHandler,
    RecoveryAction: jest.fn(),
    CircuitBreaker: jest.fn()
}));
jest.mock('../packages/vscode-ext/src/worktree/gitWorktree', () => ({
    GitWorktree: jest.fn().mockImplementation(() => mockGitWorktree)
}));
jest.mock('../packages/vscode-ext/src/mcp/launcher', () => ({
    McpServerLauncher: jest.fn().mockImplementation(() => mockMcpServerLauncher)
}));
jest.mock('../packages/vscode-ext/src/mcp/registration', () => ({
    McpServerRegistration: jest.fn().mockImplementation(() => mockMcpServerRegistration)
}));
jest.mock('../packages/vscode-ext/src/containers/docker', () => ({
    startToolContainer: mockStartToolContainer,
    stopToolContainer: mockStopToolContainer
}));

describe('Orchestrator Components', () => {
    let promptAnalyzer;
    let workPlanParser;
    let trackExecutor;

    beforeEach(() => {
        jest.clearAllMocks();
        promptAnalyzer = new PromptAnalyzer();
        workPlanParser = new WorkPlanParser();
        trackExecutor = new TrackExecutor(
            mockVscode.ExtensionContext,
            mockMcpServerLauncher,
            mockMcpServerRegistration
        );
    });

    describe('PromptAnalyzer', () => {
        test('should analyze prompts and generate work plans', async () => {
            const prompt = 'Implement a user authentication system and create a user profile page';
            
            const workPlan = await promptAnalyzer.analyzePrompt(prompt);
            
            expect(workPlan).toBeDefined();
            expect(workPlan.id).toBeDefined();
            expect(workPlan.prompt).toBe(prompt);
            expect(workPlan.tracks).toBeDefined();
            expect(Array.isArray(workPlan.tracks)).toBe(true);
            expect(workPlan.dependencyGraph).toBeDefined();
            expect(Array.isArray(workPlan.parallelizableTracks)).toBe(true);
        });

        test('should handle complex prompts with dependencies', async () => {
            const prompt = 'First, implement the database schema, then create the API endpoints, and finally build the frontend components after the API is ready';
            
            const workPlan = await promptAnalyzer.analyzePrompt(prompt);
            
            expect(workPlan.tracks.length).toBeGreaterThan(0);
            expect(workPlan.dependencyGraph).toBeDefined();
            
            // Check that dependencies are correctly identified
            const hasDependencies = workPlan.tracks.some(track => 
                track.dependencies && track.dependencies.length > 0
            );
            expect(hasDependencies).toBe(true);
        });

        test('should identify parallelizable tasks', async () => {
            const prompt = 'Implement the user authentication system and create the admin dashboard in parallel';
            
            const workPlan = await promptAnalyzer.analyzePrompt(prompt);
            
            expect(workPlan.parallelizableTracks.length).toBeGreaterThan(0);
            
            // Check that at least one group has multiple tracks for parallel execution
            const hasParallelGroup = workPlan.parallelizableTracks.some(group => 
                Array.isArray(group) && group.length > 1
            );
            expect(hasParallelGroup).toBe(true);
        });
    });

    describe('WorkPlanParser', () => {
        test('should parse prompts into work plans', async () => {
            const prompt = 'Create a new React component for user profiles';
            
            const workPlan = await workPlanParser.parsePromptToWorkPlan(prompt);
            
            expect(workPlan).toBeDefined();
            expect(workPlan.id).toBeDefined();
            expect(workPlan.prompt).toBe(prompt);
            expect(workPlan.tracks).toBeDefined();
            expect(Array.isArray(workPlan.tracks)).toBe(true);
            expect(workPlan.tracks.length).toBeGreaterThan(0);
        });

        test('should extract tasks from prompts', async () => {
            const prompt = 'Implement user authentication, create database models, and write API endpoints';
            
            const workPlan = await workPlanParser.parsePromptToWorkPlan(prompt);
            
            // Check that tasks are extracted
            const hasTasks = workPlan.tracks.some(track => 
                track.tasks && track.tasks.length > 0
            );
            expect(hasTasks).toBe(true);
        });

        test('should build dependency graphs', async () => {
            const prompt = 'First create the database schema, then implement the API endpoints';
            
            const workPlan = await workPlanParser.parsePromptToWorkPlan(prompt);
            
            expect(workPlan.dependencyGraph).toBeDefined();
            
            // Check that dependencies are represented in the graph
            const hasEdges = workPlan.dependencyGraph.edges().length > 0;
            expect(hasEdges).toBe(true);
        });

        test('should determine parallelizable tracks', async () => {
            const prompt = 'Create user authentication and user profile management';
            
            const workPlan = await workPlanParser.parsePromptToWorkPlan(prompt);
            
            expect(workPlan.parallelizableTracks).toBeDefined();
            expect(Array.isArray(workPlan.parallelizableTracks)).toBe(true);
        });
    });

    describe('TrackExecutor', () => {
        test('should execute work plans', async () => {
            const mockWorkPlan = {
                id: 'test-workplan',
                prompt: 'Test prompt',
                tracks: [
                    {
                        id: 'track-1',
                        name: 'Test Track',
                        description: 'A test track',
                        dependencies: [],
                        fileOverlaps: [],
                        estimatedComplexity: 5,
                        estimatedDuration: 60,
                        tasks: ['Test task'],
                        status: 'pending'
                    }
                ],
                dependencyGraph: {
                    nodes: jest.fn().mockReturnValue(['track-1']),
                    edges: jest.fn().mockReturnValue([])
                },
                parallelizableTracks: [['track-1']]
            };

            // Mock the successful execution of a track
            mockGitWorktree.createWorktree.mockResolvedValue(undefined);
            mockStartToolContainer.mockResolvedValue('container-id');
            mockMcpServerRegistration.registerServer.mockResolvedValue(undefined);
            mockMcpServerLauncher.useTool.mockResolvedValue({ success: true });
            mockGitWorktree.addAndCommitAll.mockResolvedValue(undefined);

            await trackExecutor.executeWorkPlan(mockWorkPlan);

            expect(mockVscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('Starting Work Plan execution')
            );
        });

        test('should handle track execution failures gracefully', async () => {
            const mockWorkPlan = {
                id: 'test-workplan',
                prompt: 'Test prompt',
                tracks: [
                    {
                        id: 'track-1',
                        name: 'Test Track',
                        description: 'A test track',
                        dependencies: [],
                        fileOverlaps: [],
                        estimatedComplexity: 5,
                        estimatedDuration: 60,
                        tasks: ['Test task'],
                        status: 'pending'
                    }
                ],
                dependencyGraph: {
                    nodes: jest.fn().mockReturnValue(['track-1']),
                    edges: jest.fn().mockReturnValue([])
                },
                parallelizableTracks: [['track-1']]
            };

            // Mock the failure of track execution
            mockGitWorktree.createWorktree.mockRejectedValue(new Error('Test error'));

            await trackExecutor.executeWorkPlan(mockWorkPlan);

            expect(mockVscode.window.showWarningMessage).toHaveBeenCalledWith(
                expect.stringContaining('failed tracks')
            );
        });

        test('should provide progress updates during execution', async () => {
            const mockWorkPlan = {
                id: 'test-workplan',
                prompt: 'Test prompt',
                tracks: [
                    {
                        id: 'track-1',
                        name: 'Test Track',
                        description: 'A test track',
                        dependencies: [],
                        fileOverlaps: [],
                        estimatedComplexity: 5,
                        estimatedDuration: 60,
                        tasks: ['Test task'],
                        status: 'pending'
                    }
                ],
                dependencyGraph: {
                    nodes: jest.fn().mockReturnValue(['track-1']),
                    edges: jest.fn().mockReturnValue([])
                },
                parallelizableTracks: [['track-1']]
            };

            // Mock successful execution
            mockGitWorktree.createWorktree.mockResolvedValue(undefined);
            mockStartToolContainer.mockResolvedValue('container-id');
            mockMcpServerRegistration.registerServer.mockResolvedValue(undefined);
            mockMcpServerLauncher.useTool.mockResolvedValue({ success: true });
            mockGitWorktree.addAndCommitAll.mockResolvedValue(undefined);

            // Set up progress emitter spy
            const progressSpy = jest.fn();
            trackExecutor.onProgressUpdate(progressSpy);

            await trackExecutor.executeWorkPlan(mockWorkPlan);

            expect(progressSpy).toHaveBeenCalled();
        });

        test('should cancel execution when requested', async () => {
            const mockWorkPlan = {
                id: 'test-workplan',
                prompt: 'Test prompt',
                tracks: [
                    {
                        id: 'track-1',
                        name: 'Test Track',
                        description: 'A test track',
                        dependencies: [],
                        fileOverlaps: [],
                        estimatedComplexity: 5,
                        estimatedDuration: 60,
                        tasks: ['Test task'],
                        status: 'pending'
                    }
                ],
                dependencyGraph: {
                    nodes: jest.fn().mockReturnValue(['track-1']),
                    edges: jest.fn().mockReturnValue([])
                },
                parallelizableTracks: [['track-1']]
            };

            // Mock execution that takes time
            mockGitWorktree.createWorktree.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
            mockStartToolContainer.mockResolvedValue('container-id');
            mockMcpServerRegistration.registerServer.mockResolvedValue(undefined);
            mockMcpServerLauncher.useTool.mockResolvedValue({ success: true });
            mockGitWorktree.addAndCommitAll.mockResolvedValue(undefined);

            // Start execution but cancel immediately
            const executionPromise = trackExecutor.executeWorkPlan(mockWorkPlan);
            await trackExecutor.cancelExecution();

            expect(mockVscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('cancelled')
            );
        });
    });
});

// Run the tests
if (require.main === module) {
    // Simple test runner for Node.js environment
    console.log('Running orchestrator component tests...\n');
    
    // Test PromptAnalyzer
    console.log('Testing PromptAnalyzer...');
    const analyzer = new PromptAnalyzer();
    analyzer.analyzePrompt('Implement a user authentication system and create a user profile page')
        .then(workPlan => {
            console.log('✓ PromptAnalyzer successfully analyzed prompt and generated work plan');
            console.log(`  - Generated ${workPlan.tracks.length} tracks`);
            console.log(`  - Identified ${workPlan.parallelizableTracks.length} parallel groups`);
        })
        .catch(error => {
            console.log('✗ PromptAnalyzer test failed:', error.message);
        });
    
    // Test WorkPlanParser
    console.log('\nTesting WorkPlanParser...');
    const parser = new WorkPlanParser();
    parser.parsePromptToWorkPlan('Create a new React component for user profiles')
        .then(workPlan => {
            console.log('✓ WorkPlanParser successfully parsed prompt into work plan');
            console.log(`  - Generated ${workPlan.tracks.length} tracks`);
            console.log(`  - Built dependency graph with ${workPlan.dependencyGraph.nodeCount()} nodes`);
        })
        .catch(error => {
            console.log('✗ WorkPlanParser test failed:', error.message);
        });
    
    console.log('\nOrchestrator component tests initiated.');
}