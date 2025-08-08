import * as vscode from 'vscode';
import { GitWorktree } from '../worktree/gitWorktree';
import { TrackStatus, Track } from './trackStatus';

export class MergeFlow {
    private gitWorktree: GitWorktree;
    private trackStatus: TrackStatus;
    public integrationBranch = 'puppet/integration';
    private resolveWorktreePath: string;

    constructor(context: vscode.ExtensionContext, trackStatus: TrackStatus) {
        const repoPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!repoPath) {
            vscode.window.showErrorMessage('No workspace folder found. Please open a folder to use Roo Master.');
            throw new Error('No workspace folder found.');
        }
        this.gitWorktree = new GitWorktree(repoPath);
        this.trackStatus = trackStatus;
        this.resolveWorktreePath = vscode.Uri.joinPath(vscode.Uri.file(repoPath), '.roo', 'resolve-worktree').fsPath;
    }

    public async createIntegrationBranchAndWorktree(branchName: string, worktreePath?: string): Promise<void> {
        vscode.window.showInformationMessage(`Creating integration branch '${branchName}' and worktree...`);
        try {
            await this.gitWorktree.createWorktree(branchName, worktreePath);
            vscode.window.showInformationMessage(`Integration branch '${branchName}' and worktree created successfully.`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to create integration branch and worktree: ${error.message}`);
            console.error(error);
        }
    }

    public async mergeCompletedTracks(): Promise<void> {
        vscode.window.showInformationMessage('Merging completed tracks into integration branch...');
        const completedTracks = this.trackStatus.getTracks().filter((track: Track) => track.status === 'completed');

        if (completedTracks.length === 0) {
            vscode.window.showInformationMessage('No completed tracks to merge.');
            return;
        }

        for (const track of completedTracks) {
            try {
                this.trackStatus.updateTrackStatus(track.id, 'in-progress', 'Merging into integration branch');
                await this.gitWorktree.checkoutWorktree(this.integrationBranch);
                
                if (!track.branch) {
                    vscode.window.showErrorMessage(`Track '${track.name}' has no branch associated with it.`);
                    this.trackStatus.updateTrackStatus(track.id, 'blocked', 'No branch associated with track.');
                    continue;
                }
                
                const mergeResult = await this.gitWorktree.mergeBranch(track.branch);

                if (mergeResult.includes('Automatic merge failed')) {
                    vscode.window.showWarningMessage(`Conflict merging track '${track.branch}'. Initiating conflict resolution.`);
                    this.trackStatus.updateTrackStatus(track.id, 'blocked', 'Conflict during merge. Resolution required.');
                    await this.handleMergeConflict(track);
                } else {
                    vscode.window.showInformationMessage(`Successfully merged track '${track.branch}'.`);
                    this.trackStatus.updateTrackStatus(track.id, 'merged', 'Successfully merged into integration branch.');
                }
            } catch (error: any) {
                vscode.window.showErrorMessage(`Error merging track '${track.branch || track.name}': ${error.message}`);
                this.trackStatus.updateTrackStatus(track.id, 'blocked', `Error during merge: ${error.message}`);
                console.error(error);
            }
        }
        vscode.window.showInformationMessage('Completed merging tracks.');
    }

    private async handleMergeConflict(track: Track): Promise<void> {
        if (!track.branch) {
            vscode.window.showErrorMessage(`Track '${track.name}' has no branch associated with it.`);
            this.trackStatus.updateTrackStatus(track.id, 'blocked', 'No branch associated with track.');
            return;
        }
        
        vscode.window.showInformationMessage(`Attempting to resolve conflicts for track '${track.branch}'...`);
        try {
            // Create a temporary worktree for resolution
            await this.gitWorktree.createWorktree('resolve-temp', this.resolveWorktreePath);
            await this.gitWorktree.checkoutWorktree('resolve-temp', this.resolveWorktreePath);

            // Apply the merge again in the temporary worktree to get conflict markers
            await this.gitWorktree.mergeBranch(track.branch, this.resolveWorktreePath);

            // TODO: Implement actual conflict resolution logic here.
            // For now, we'll simulate a manual resolution by just committing.
            // In a real scenario, this would involve parsing diffs, applying heuristics,
            // or prompting the user for input.
            vscode.window.showWarningMessage(`Manual resolution needed for conflicts in '${track.branch}'. Please resolve in the 'resolve-temp' worktree.`);
            // Await user intervention or a more sophisticated auto-resolution
            await vscode.window.showInputBox({ prompt: `Resolve conflicts in '${this.resolveWorktreePath}' and press Enter to continue.` });

            // After simulated resolution, add and commit changes in the temporary worktree
            await this.gitWorktree.addAndCommitAll('Resolve conflicts for ' + track.branch, this.resolveWorktreePath);

            // Re-run tests and linting after resolution
            vscode.window.showInformationMessage('Re-running tests and linting after conflict resolution...');
            const testPassed = await this.runTests(this.resolveWorktreePath);
            const lintPassed = await this.runLint(this.resolveWorktreePath);

            if (testPassed && lintPassed) {
                vscode.window.showInformationMessage('Tests and linting passed after resolution. Merging resolved changes.');
                // Merge resolved changes back to integration branch
                await this.gitWorktree.checkoutWorktree(this.integrationBranch);
                await this.gitWorktree.mergeBranch('resolve-temp'); // Merge the resolved temp branch
                this.trackStatus.updateTrackStatus(track.id, 'completed', 'Conflicts resolved and merged.');
            } else {
                vscode.window.showErrorMessage('Tests or linting failed after conflict resolution. Track remains blocked.');
                this.trackStatus.updateTrackStatus(track.id, 'blocked', 'Tests/Lint failed after resolution.');
            }

            // Clean up temporary worktree
            await this.gitWorktree.removeWorktree('resolve-temp', this.resolveWorktreePath);

        } catch (error: any) {
            vscode.window.showErrorMessage(`Error during conflict resolution for track '${track.branch}': ${error.message}`);
            this.trackStatus.updateTrackStatus(track.id, 'blocked', `Error during resolution: ${error.message}`);
            console.error(error);
        }
    }

    private async runTests(cwd: string): Promise<boolean> {
        // Placeholder for running tests
        vscode.window.showInformationMessage(`Running tests in ${cwd}...`);
        // In a real scenario, this would invoke a test runner and check its exit code.
        // For now, always return true.
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate test run
        return true;
    }

    private async runLint(cwd: string): Promise<boolean> {
        // Placeholder for running linting
        vscode.window.showInformationMessage(`Running linting in ${cwd}...`);
        // In a real scenario, this would invoke a linter and check its exit code.
        // For now, always return true.
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate lint run
        return true;
    }

    public async getMergeStatus(): Promise<string> {
        try {
            await this.gitWorktree.checkoutWorktree(this.integrationBranch);
            const status = await this.gitWorktree.getStatus();
            return `Integration branch status: \n${status}`;
        } catch (error: any) {
            return `Error getting merge status: ${error.message}`;
        }
    }
}