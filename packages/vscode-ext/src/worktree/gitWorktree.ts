import * as vscode from 'vscode';
import { exec } from 'child_process';
import { Logger } from '../util/logger';

const logger = new Logger('GitWorktree');

export interface GitWorktreeInfo {
    path: string;
    branch: string;
    head: string;
}

export class GitWorktree {
    private repoPath: string;

    constructor(repoPath: string) {
        this.repoPath = repoPath;
    }

    public async createWorktree(
        branchName: string,
        newWorktreePath?: string
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const worktreePath = newWorktreePath || `${this.repoPath}-${branchName.replace(/\//g, '-')}-worktree`;
            const command = `git -C "${this.repoPath}" worktree add -b "${branchName}" "${worktreePath}"`;
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    logger.error(`Error creating worktree: ${stderr}`);
                    return reject(new Error(`Failed to create worktree: ${stderr}`));
                }
                logger.info(`Worktree created: ${stdout}`);
                resolve();
            });
        });
    }

    public async checkoutWorktree(branchName: string, worktreePath?: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const targetPath = worktreePath || this.repoPath;
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
            const targetPath = worktreePath || this.repoPath;
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
            const targetPath = worktreePath || this.repoPath;
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
            const targetPath = worktreePath || this.repoPath;
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
            const command = `git -C "${this.repoPath}" worktree list --porcelain`;
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
            const targetPath = worktreePath || `${this.repoPath}-${branchName.replace(/\//g, '-')}-worktree`;
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