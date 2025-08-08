import * as vscode from 'vscode';
import { exec } from 'child_process';
import { Logger } from '../util/logger';
import { ErrorHandler } from '../util/errorHandler';
import { RetryHandler } from '../util/retryHandler';
import * as fs from 'fs';
import * as path from 'path';

const logger = new Logger('GitWorktree');

export interface GitWorktreeInfo {
    path: string;
    branch: string;
    head: string;
}

export class GitWorktree {
    private _repoPath: string;

    constructor(repoPath: string) {
        // Validate input
        ErrorHandler.validateRequired(repoPath, 'repoPath', 'GitWorktree.constructor');
        ErrorHandler.validatePath(repoPath, 'directory', 'GitWorktree.constructor');
        
        // Check if it's a git repository
        const gitDir = path.join(repoPath, '.git');
        if (!fs.existsSync(gitDir)) {
            const errorMsg = `Not a git repository: ${repoPath}`;
            ErrorHandler.handleError(errorMsg, {
                showUser: false,
                logLevel: 'error',
                context: 'GitWorktree.constructor'
            });
            throw new Error(errorMsg);
        }
        
        this._repoPath = repoPath;
    }

    /**
     * Gets the repository path.
     * @returns The repository path.
     */
    public get repoPath(): string {
        return this._repoPath;
    }

    public async createWorktree(
        branchName: string,
        newWorktreePath?: string
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            // Input validation
            ErrorHandler.validateRequired(branchName, 'branchName', 'GitWorktree.createWorktree');

            const worktreePath = newWorktreePath || `${this._repoPath}-${branchName.replace(/\//g, '-')}-worktree`;
            
            // Validate worktree path doesn't already exist
            if (fs.existsSync(worktreePath)) {
                const errorMsg = `Worktree path already exists: ${worktreePath}`;
                logger.error(errorMsg);
                return reject(new Error(errorMsg));
            }

            // Ensure parent directory exists
            const parentDir = path.dirname(worktreePath);
            if (!fs.existsSync(parentDir)) {
                try {
                    fs.mkdirSync(parentDir, { recursive: true });
                } catch (error: any) {
                    ErrorHandler.handleError(error, {
                        showUser: false,
                        logLevel: 'error',
                        context: 'GitWorktree.createWorktree.parentDirectory'
                    });
                    return reject(new Error(`Failed to create parent directory for worktree: ${error.message}`));
                }
            }

            const command = `git -C "${this._repoPath}" worktree add -b "${branchName}" "${worktreePath}"`;
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    ErrorHandler.handleError(stderr, {
                        showUser: true,
                        logLevel: 'error',
                        userMessage: `Failed to create worktree: ${stderr}`,
                        context: 'GitWorktree.createWorktree'
                    });
                    return reject(new Error(`Failed to create worktree: ${stderr}`));
                }
                logger.info(`Worktree created: ${stdout}`);
                resolve();
            });
        });
    }

    public async checkoutWorktree(branchName: string, worktreePath?: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const targetPath = worktreePath || this._repoPath;
            const command = `git -C "${targetPath}" checkout "${branchName}"`;
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    logger.error(`Error checking out branch in worktree: ${stderr}`);
                    return reject(new Error(`Failed to checkout branch: ${stderr}`));
                }
                logger.info(`Checked out branch ${branchName} in ${targetPath}: ${stdout}`);
                resolve();
            });
        });
    }

    public async mergeBranch(branchToMerge: string, worktreePath?: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const targetPath = worktreePath || this._repoPath;
            const command = `git -C "${targetPath}" merge "${branchToMerge}" --no-ff`; // Use --no-ff to always create a merge commit
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    // Check for merge conflicts
                    if (stderr.includes('Automatic merge failed') || stdout.includes('Automatic merge failed')) {
                        logger.warn(`Merge conflict detected: ${stderr || stdout}`);
                        return resolve('Automatic merge failed'); // Indicate conflict
                    }
                    logger.error(`Error merging branch: ${stderr}`);
                    return reject(new Error(`Failed to merge branch: ${stderr}`));
                }
                logger.info(`Branch merged: ${stdout}`);
                resolve(stdout);
            });
        });
    }

    public async addAndCommitAll(message: string, worktreePath?: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const targetPath = worktreePath || this._repoPath;
            const addCommand = `git -C "${targetPath}" add .`;
            exec(addCommand, (error, stdout, stderr) => {
                if (error) {
                    logger.error(`Error adding files: ${stderr}`);
                    return reject(new Error(`Failed to add files: ${stderr}`));
                }
                const commitCommand = `git -C "${targetPath}" commit -m "${message}"`;
                exec(commitCommand, (error, stdout, stderr) => {
                    if (error) {
                        logger.error(`Error committing changes: ${stderr}`);
                        return reject(new Error(`Failed to commit changes: ${stderr}`));
                    }
                    logger.info(`Changes committed: ${stdout}`);
                    resolve();
                });
            });
        });
    }

    public async getStatus(worktreePath?: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const targetPath = worktreePath || this._repoPath;
            const command = `git -C "${targetPath}" status`;
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    logger.error(`Error getting git status: ${stderr}`);
                    return reject(new Error(`Failed to get git status: ${stderr}`));
                }
                logger.info(`Git status: ${stdout}`);
                resolve(stdout);
            });
        });
    }

    public async listWorktrees(): Promise<GitWorktreeInfo[]> {
        return new Promise((resolve, reject) => {
            const command = `git -C "${this._repoPath}" worktree list --porcelain`;
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    logger.error(`Error listing worktrees: ${stderr}`);
                    return reject(new Error(`Failed to list worktrees: ${stderr}`));
                }

                const lines = stdout.trim().split('\n');
                const worktrees: GitWorktreeInfo[] = [];
                let currentWorktree: Partial<GitWorktreeInfo> = {};

                for (const line of lines) {
                    if (line.startsWith('worktree ')) {
                        if (currentWorktree.path) {
                            worktrees.push(currentWorktree as GitWorktreeInfo);
                        }
                        currentWorktree = { path: line.substring('worktree '.length) };
                    } else if (line.startsWith('branch ')) {
                        currentWorktree.branch = line.substring('branch '.length);
                    } else if (line.startsWith('HEAD ')) {
                        currentWorktree.head = line.substring('HEAD '.length);
                    }
                }
                if (currentWorktree.path) {
                    worktrees.push(currentWorktree as GitWorktreeInfo);
                }
                resolve(worktrees);
            });
        });
    }

    public async removeWorktree(branchName: string, worktreePath?: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const targetPath = worktreePath || `${this._repoPath}-${branchName.replace(/\//g, '-')}-worktree`;
            const command = `git worktree remove "${targetPath}" --force`; // Use --force to remove even if not clean
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    logger.error(`Error removing worktree: ${stderr}`);
                    return reject(new Error(`Failed to remove worktree: ${stderr}`));
                }
                logger.info(`Worktree removed: ${stdout}`);
                resolve();
            });
        });
    }
}