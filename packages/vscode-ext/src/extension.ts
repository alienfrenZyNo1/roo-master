import * as vscode from 'vscode';
import * as path from 'path';
import { Logger, initializeLogger } from './util/logger';
import { ErrorHandler } from './util/errorHandler';
import { GitWorktree, GitWorktreeInfo } from './worktree/gitWorktree';
import { startToolContainer, stopToolContainer, listToolContainers } from './containers/docker';
import { McpServerLauncher } from './mcp/launcher';
import { McpServerRegistration } from './mcp/registration';
import { RooMasterTreeDataProvider } from './ui/tree'; // Keep this for now, it's for the worktree view
import { TrackStatusTreeDataProvider } from './ui/trackStatusTreeDataProvider'; // New import
import { MergeFlow } from './integration/mergeFlow';
import { TrackStatus } from './integration/trackStatus';
import { WorkPlanParser } from './orchestrator/workPlanParser';
import { TrackExecutor } from './orchestrator/trackExecutor';
import { PromptAnalyzer } from './orchestrator/promptAnalyzer'; // New import

// Global variables for resource cleanup
let mcpServerLauncher: McpServerLauncher | null = null;
let rooMasterTreeDataProvider: RooMasterTreeDataProvider | null = null;
let trackStatusTreeDataProvider: TrackStatusTreeDataProvider | null = null;

export function activate(context: vscode.ExtensionContext) {
    initializeLogger();
    const logger = new Logger('Extension');
    logger.info('Roo Master extension is now active!');

    const rootPath = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
        ? vscode.workspace.workspaceFolders[0].uri.fsPath
        : undefined;

    if (!rootPath) {
        ErrorHandler.handleError('No workspace folder found. Roo Master requires an open workspace.', {
            showUser: true,
            logLevel: 'error',
            userMessage: 'No workspace folder found. Please open a folder to use Roo Master.',
            context: 'Extension.activate'
        });
        return;
    }

    // Register the existing Roo Master Explorer
    rooMasterTreeDataProvider = new RooMasterTreeDataProvider(rootPath);
    vscode.window.registerTreeDataProvider('rooMasterExplorer', rooMasterTreeDataProvider);

    mcpServerLauncher = new McpServerLauncher();
    const mcpServerRegistration = new McpServerRegistration(mcpServerLauncher);

    // Initialize TrackStatus and MergeFlow
    const trackStatus = new TrackStatus();
    const mergeFlow = new MergeFlow(context, trackStatus);
    const workPlanParser = new WorkPlanParser(); // Keep this for now, PromptAnalyzer uses it internally
    const promptAnalyzer = new PromptAnalyzer(); // New instance
    const trackExecutor = new TrackExecutor(context, mcpServerLauncher, mcpServerRegistration);

    // Register the new Track Status Tree View
    trackStatusTreeDataProvider = new TrackStatusTreeDataProvider(trackStatus);
    vscode.window.registerTreeDataProvider('rooMasterTrackStatusView', trackStatusTreeDataProvider);

    context.subscriptions.push(
        vscode.commands.registerCommand('roo-master.createWorktree', async () => {
            const branchName = await vscode.window.showInputBox({ prompt: 'Enter new branch name for worktree' });
            if (!branchName) {
                return;
            }
            const worktreeName = await vscode.window.showInputBox({ prompt: 'Enter worktree directory name (optional)' });
            const worktreePath = worktreeName ? path.join(path.dirname(rootPath!), worktreeName) : undefined;

            try {
                // Use the mergeFlow's gitWorktree instance
                await mergeFlow.createIntegrationBranchAndWorktree(branchName, worktreePath);
                vscode.window.showInformationMessage(`Worktree for branch '${branchName}' created successfully.`);
                rooMasterTreeDataProvider?.refresh();
            } catch (error: any) {
                ErrorHandler.handleError(error, {
                    showUser: true,
                    logLevel: 'error',
                    userMessage: `Failed to create worktree: ${error.message}`,
                    context: 'Extension.createWorktree'
                });
            }
        }),
        vscode.commands.registerCommand('roo-master.openWorktree', async (item?: any) => {
            let worktreePath: string | undefined;
            if (item && item.resourceUri) {
                worktreePath = item.resourceUri.fsPath;
            } else {
                const gitWorktree = new GitWorktree(rootPath); // Instantiate to use listWorktrees
                const worktrees = rootPath ? await gitWorktree.listWorktrees() : [];
                const selectedWorktree = await vscode.window.showQuickPick(
                    worktrees.map(wt => ({ label: path.basename(wt.path), description: wt.branch, path: wt.path })),
                    { placeHolder: 'Select a worktree to open' }
                );
                if (!selectedWorktree) {
                    return;
                }
                worktreePath = selectedWorktree.path;
            }

            if (worktreePath) {
                const uri = vscode.Uri.file(worktreePath);
                await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
            }
        }),
        vscode.commands.registerCommand('roo-master.startToolContainers', async () => {
            const imageName = await vscode.window.showInputBox({ prompt: 'Enter Docker image name' });
            if (!imageName) {
                return;
            }
            const containerName = await vscode.window.showInputBox({ prompt: 'Enter container name' });
            if (!containerName) {
                return;
            }
            const portBindingsInput = await vscode.window.showInputBox({ prompt: 'Enter port bindings (e.g., 8080:80, 9000:9000)' });
            const portBindings = portBindingsInput ? portBindingsInput.split(',').map(p => p.trim()) : [];

            try {
                const containerId = await startToolContainer(imageName, containerName, portBindings);
                vscode.window.showInformationMessage(`Container '${containerName}' started with ID: ${containerId}`);
                rooMasterTreeDataProvider?.refresh();
            } catch (error: any) {
                ErrorHandler.handleError(error, {
                    showUser: true,
                    logLevel: 'error',
                    userMessage: `Failed to start container: ${error.message}`,
                    context: 'Extension.startToolContainers'
                });
            }
        }),
        vscode.commands.registerCommand('roo-master.stopToolContainers', async () => {
            const containers = await listToolContainers();
            const selectedContainer = await vscode.window.showQuickPick(
                containers.map(c => ({ label: c.name, description: c.status, id: c.id })),
                    { placeHolder: 'Select a container to stop' }
                );
            if (!selectedContainer) {
                return;
            }
            try {
                await stopToolContainer(selectedContainer.label);
                vscode.window.showInformationMessage(`Container '${selectedContainer.label}' stopped.`);
                rooMasterTreeDataProvider?.refresh();
            } catch (error: any) {
                ErrorHandler.handleError(error, {
                    showUser: true,
                    logLevel: 'error',
                    userMessage: `Failed to stop container: ${error.message}`,
                    context: 'Extension.stopToolContainers'
                });
            }
        }),
        vscode.commands.registerCommand('roo-master.registerMcpServer', async (item?: any) => {
            let worktreePath: string | undefined;
            if (item && item.resourceUri) {
                worktreePath = item.resourceUri.fsPath;
            } else if (rootPath) {
                const gitWorktree = new GitWorktree(rootPath); // Instantiate to use listWorktrees
                const worktrees = await gitWorktree.listWorktrees();
                const selectedWorktree = await vscode.window.showQuickPick(
                    worktrees.map(wt => ({ label: path.basename(wt.path), description: wt.branch, path: wt.path })),
                    { placeHolder: 'Select a worktree to register MCP server for' }
                );
                if (!selectedWorktree) {
                    return;
                }
                worktreePath = selectedWorktree.path;
            } else {
                logger.error('No worktree selected and no workspace folder open.');
                vscode.window.showErrorMessage('No worktree selected and no workspace folder open.');
                return;
            }

            if (worktreePath) {
                try {
                    const port = await mcpServerLauncher!.launchMcpServer(worktreePath);
                    await mcpServerRegistration.writeMcpConfig(worktreePath, { port });
                    vscode.window.showInformationMessage(`MCP Server registered and launched for ${path.basename(worktreePath)} on port ${port}.`);
                    rooMasterTreeDataProvider?.refresh();
                } catch (error: any) {
                    ErrorHandler.handleError(error, {
                        showUser: true,
                        logLevel: 'error',
                        userMessage: `Failed to register/launch MCP Server: ${error.message}`,
                        context: 'Extension.registerMcpServer'
                    });
                }
            }
        }),
        vscode.commands.registerCommand('roo-master.showLogs', () => {
            logger.showLogs();
        }),
        // New commands for merge flow and track status
        vscode.commands.registerCommand('roo-master.createIntegrationBranch', async () => {
            // This command will now create the specific puppet/integration branch and worktree
            await mergeFlow.createIntegrationBranchAndWorktree(mergeFlow.integrationBranch);
        }),
        vscode.commands.registerCommand('roo-master.mergeCompletedTracks', async () => {
            await mergeFlow.mergeCompletedTracks();
        }),
        vscode.commands.registerCommand('roo-master.showTrackStatus', () => {
            // This command will now open the Tree View for track status
            vscode.commands.executeCommand('workbench.view.extension.rooMasterTrackStatusView');
        }),
        vscode.commands.registerCommand('roo-master.executeWorkPlan', async () => {
            const prompt = await vscode.window.showInputBox({ prompt: 'Enter your high-level prompt for the work plan' });
            if (!prompt) {
                return;
            }

            try {
                logger.info('Parsing prompt and generating work plan...');
                const workPlan = await promptAnalyzer.analyzePrompt(prompt); // Use PromptAnalyzer
                logger.info('Work plan generated. Executing tracks...');
                
                // Add all tracks to trackStatus for display
                workPlan.tracks.forEach(track => trackStatus.addTrack(track));

                await trackExecutor.executeWorkPlan(workPlan);
                vscode.window.showInformationMessage('Work plan execution completed.');
                trackStatus.refresh();
            } catch (error: any) {
                ErrorHandler.handleError(error, {
                    showUser: true,
                    logLevel: 'error',
                    userMessage: `Work plan execution failed: ${error.message}`,
                    context: 'Extension.executeWorkPlan'
                });
            }
        })
    );
}

export function deactivate() {
    const logger = new Logger('Extension');
    logger.info('Roo Master extension is deactivating.');
    
    // Clean up MCP servers
    try {
        if (mcpServerLauncher) {
            const activeServers = mcpServerLauncher.getActiveMcpServers();
            logger.info(`Stopping ${activeServers.size} active MCP servers...`);
            
            for (const [worktreePath, server] of activeServers) {
                try {
                    mcpServerLauncher.stopMcpServer(worktreePath);
                    logger.info(`Stopped MCP server for ${worktreePath}`);
                } catch (error: any) {
                    ErrorHandler.handleError(error, {
                        showUser: false,
                        logLevel: 'error',
                        context: 'Extension.deactivate.mcpServerCleanup'
                    });
                }
            }
        }
    } catch (error: any) {
        ErrorHandler.handleError(error, {
            showUser: false,
            logLevel: 'error',
            context: 'Extension.deactivate.mcpServerCleanup'
        });
    }
    
    // Clean up any other resources
    try {
        // Dispose of tree data providers
        if (rooMasterTreeDataProvider) {
            // No explicit dispose method needed for TreeDataProvider
            logger.info('Tree data providers will be automatically disposed');
        }
        
        if (trackStatusTreeDataProvider) {
            // No explicit dispose method needed for TreeDataProvider
            logger.info('Track status tree data provider will be automatically disposed');
        }
        
        // Clean up Docker containers if needed
        logger.info('Checking for active Docker containers...');
        // Note: We don't automatically stop containers as users might want them to continue running
        
        logger.info('Roo Master extension deactivated successfully.');
    } catch (error: any) {
        ErrorHandler.handleError(error, {
            showUser: false,
            logLevel: 'error',
            context: 'Extension.deactivate.resourceCleanup'
        });
    }
}