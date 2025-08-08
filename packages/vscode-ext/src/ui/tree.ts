import * as vscode from 'vscode';
import * as path from 'path';
import { GitWorktree, listWorktrees } from '../worktree/gitWorktree';
import { DockerContainer, listToolContainers } from '../containers/docker';
import { getActiveMcpServers } from '../mcp/launcher';
import { log } from '../util/logger';

type TreeItemType = 'worktree' | 'container' | 'mcpServer';

export class RooMasterTreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | void> = new vscode.EventEmitter<TreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor(private workspaceRoot: string | undefined) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: TreeItem): Promise<TreeItem[]> {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('No worktree in empty workspace');
            return [];
        }

        if (element) {
            // Handle children of existing elements (e.g., container details)
            if (element.contextValue === 'worktree') {
                const worktreePath = element.resourceUri!.fsPath;
                const children: TreeItem[] = [];

                // Add MCP Server status
                const activeMcpServersMap = getActiveMcpServers();
                if (activeMcpServersMap.has(worktreePath)) {
                    const mcpServer = activeMcpServersMap.get(worktreePath)!;
                    children.push(new TreeItem(
                        `MCP Server (Port: ${mcpServer.port})`,
                        vscode.TreeItemCollapsibleState.None,
                        'mcpServer',
                        undefined,
                        new vscode.ThemeIcon('plug')
                    ));
                } else {
                    children.push(new TreeItem(
                        'MCP Server (Inactive)',
                        vscode.TreeItemCollapsibleState.None,
                        'mcpServer',
                        undefined,
                        new vscode.ThemeIcon('plug')
                    ));
                }

                // Add Docker containers
                try {
                    const containers = await listToolContainers();
                    const worktreeContainers = containers.filter(c => c.name.startsWith(`roo-worktree-${path.basename(worktreePath)}-`));
                    worktreeContainers.forEach(container => {
                        children.push(new TreeItem(
                            `Container: ${container.name} (${container.status})`,
                            vscode.TreeItemCollapsibleState.None,
                            'container',
                            undefined,
                            new vscode.ThemeIcon('container')
                        ));
                    });
                } catch (error: any) {
                    log(`Error listing containers for worktree ${worktreePath}: ${error.message}`);
                }

                return children;
            }
            return [];
        } else {
            // Top-level elements: Worktrees
            try {
                const worktrees = await listWorktrees(this.workspaceRoot);
                return worktrees.map(worktree => {
                    const resourceUri = vscode.Uri.file(worktree.path);
                    return new TreeItem(
                        `${path.basename(worktree.path)} (${worktree.branch})`,
                        vscode.TreeItemCollapsibleState.Collapsed, // Worktrees can be expanded to show containers/MCP
                        'worktree',
                        resourceUri,
                        new vscode.ThemeIcon('git-branch')
                    );
                });
            } catch (error: any) {
                log(`Error listing worktrees: ${error.message}`);
                return [];
            }
        }
    }
}

export class TreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: TreeItemType,
        public readonly resourceUri?: vscode.Uri,
        public readonly iconPath?: string | vscode.ThemeIcon,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.contextValue = contextValue;
        this.resourceUri = resourceUri;
        this.iconPath = iconPath;
        this.command = command;
    }
}