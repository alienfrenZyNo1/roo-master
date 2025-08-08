import * as vscode from 'vscode';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { Logger } from '../util/logger';
import { ErrorHandler } from '../util/errorHandler';
import { RetryHandler } from '../util/retryHandler';
import { findOpenPort } from '../util/ports';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';

const logger = new Logger('McpServerLauncher');

interface McpServerProcess {
    process: ChildProcessWithoutNullStreams;
    port: number;
    worktreePath: string;
}

export class McpServerLauncher {
    private activeMcpServers: Map<string, McpServerProcess> = new Map();

    public async launchMcpServer(worktreePath: string): Promise<number> {
        // Path validation
        ErrorHandler.validateRequired(worktreePath, 'worktreePath', 'McpServerLauncher.launchMcpServer');
        ErrorHandler.validatePath(worktreePath, 'directory', 'McpServerLauncher.launchMcpServer');

        if (this.activeMcpServers.has(worktreePath)) {
            logger.info(`MCP server already running for ${worktreePath} on port ${this.activeMcpServers.get(worktreePath)?.port}`);
            return this.activeMcpServers.get(worktreePath)!.port;
        }

        const port = await findOpenPort(8000, 9000); // Find an available port
        logger.info(`Launching MCP server for ${worktreePath} on port ${port}...`);

        const mcpHostPath = vscode.Uri.joinPath(vscode.Uri.file(vscode.extensions.getExtension('RooVeterinaryInc.roo-master')!.extensionPath), 'packages', 'mcp-host').fsPath;
        
        // Validate MCP host path
        ErrorHandler.validateRequired(mcpHostPath, 'mcpHostPath', 'McpServerLauncher.launchMcpServer');
        ErrorHandler.validatePath(mcpHostPath, 'directory', 'McpServerLauncher.launchMcpServer');
        
        const serverProcess = spawn('npm', ['start'], {
            cwd: mcpHostPath,
            env: { ...process.env, PORT: port.toString() },
            shell: true
        });

        serverProcess.stdout.on('data', (data) => {
            logger.info(`MCP Server [${worktreePath}]: ${data.toString().trim()}`);
        });

        serverProcess.stderr.on('data', (data) => {
            logger.error(`MCP Server Error [${worktreePath}]: ${data.toString().trim()}`);
        });

        serverProcess.on('close', (code) => {
            logger.info(`MCP server for ${worktreePath} exited with code ${code}`);
            this.activeMcpServers.delete(worktreePath);
        });

        serverProcess.on('error', (error) => {
            ErrorHandler.handleError(error, {
                showUser: false,
                logLevel: 'error',
                context: 'McpServerLauncher.launchMcpServer.processError'
            });
            this.activeMcpServers.delete(worktreePath);
        });

        this.activeMcpServers.set(worktreePath, { process: serverProcess, port, worktreePath });
        
        // Wait for server to start and perform health check
        try {
            await this.waitForServerStartup(port, worktreePath);
            logger.info(`MCP server launched successfully for ${worktreePath} on port ${port}`);
            return port;
        } catch (error: any) {
            ErrorHandler.handleError(error, {
                showUser: false,
                logLevel: 'error',
                context: 'McpServerLauncher.launchMcpServer'
            });
            this.stopMcpServer(worktreePath);
            throw error;
        }
    }

    private async waitForServerStartup(port: number, worktreePath: string, timeoutMs: number = 30000): Promise<void> {
        const startTime = Date.now();
        const healthCheckUrl = `http://localhost:${port}/health`;
        
        return new Promise((resolve, reject) => {
            const interval = setInterval(() => {
                if (Date.now() - startTime > timeoutMs) {
                    clearInterval(interval);
                    reject(new Error(`MCP server startup timeout after ${timeoutMs}ms for ${worktreePath}`));
                    return;
                }

                const req = http.get(healthCheckUrl, (res) => {
                    if (res.statusCode === 200) {
                        clearInterval(interval);
                        resolve();
                    } else {
                        logger.warn(`Health check returned status ${res.statusCode} for ${worktreePath}`);
                    }
                });

                req.on('error', (err) => {
                    logger.debug(`Health check failed for ${worktreePath}: ${err.message}`);
                    // Don't reject here, we'll retry until timeout
                });

                req.setTimeout(5000, () => {
                    req.destroy();
                    logger.debug(`Health check timeout for ${worktreePath}`);
                });
            }, 1000);
        });
    }

    public stopMcpServer(worktreePath: string): void {
        // Validate input
        ErrorHandler.validateRequired(worktreePath, 'worktreePath', 'McpServerLauncher.stopMcpServer');
        
        const server = this.activeMcpServers.get(worktreePath);
        if (server) {
            server.process.kill();
            this.activeMcpServers.delete(worktreePath);
            logger.info(`MCP server for ${worktreePath} stopped.`);
        } else {
            logger.warn(`No MCP server found for ${worktreePath}.`);
        }
    }

    public getActiveMcpServers(): Map<string, McpServerProcess> {
        return this.activeMcpServers;
    }

    public async useTool(worktreePath: string, toolName: string, args: any): Promise<any> {
        // Validate input
        ErrorHandler.validateRequired(worktreePath, 'worktreePath', 'McpServerLauncher.useTool');
        ErrorHandler.validateRequired(toolName, 'toolName', 'McpServerLauncher.useTool');
        
        const server = this.activeMcpServers.get(worktreePath);
        
        if (!server) {
            const errorMsg = `No active MCP server found for ${worktreePath}`;
            ErrorHandler.handleError(errorMsg, {
                showUser: false,
                logLevel: 'error',
                context: 'McpServerLauncher.useTool'
            });
            throw new Error(errorMsg);
        }

        const toolUrl = `http://localhost:${server.port}/tools/${toolName}`;
        
        logger.info(`Using tool '${toolName}' on server for ${worktreePath} with args: ${JSON.stringify(args)}`);

        return new Promise((resolve, reject) => {
            const postData = JSON.stringify(args);
            const postOptions = {
                hostname: 'localhost',
                port: server.port,
                path: `/tools/${toolName}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = http.request(postOptions, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            const result = JSON.parse(data);
                            logger.info(`Tool '${toolName}' executed successfully for ${worktreePath}`);
                            resolve(result);
                        } catch (parseError: any) {
                            const errorMsg = `Failed to parse tool response for ${toolName}: ${parseError.message}`;
                            ErrorHandler.handleError(parseError, {
                                showUser: false,
                                logLevel: 'error',
                                context: 'McpServerLauncher.useTool.parseError'
                            });
                            reject(new Error(errorMsg));
                        }
                    } else {
                        const errorMsg = `Tool execution failed with status ${res.statusCode}: ${data}`;
                        ErrorHandler.handleError(errorMsg, {
                            showUser: false,
                            logLevel: 'error',
                            context: 'McpServerLauncher.useTool.executionFailed'
                        });
                        reject(new Error(errorMsg));
                    }
                });
            });

            req.on('error', (error) => {
                ErrorHandler.handleError(error, {
                    showUser: false,
                    logLevel: 'error',
                    context: 'McpServerLauncher.useTool.communicationError'
                });
                const errorMsg = `Error communicating with MCP server for tool '${toolName}': ${error.message}`;
                reject(new Error(errorMsg));
            });

            req.setTimeout(30000, () => {
                req.destroy();
                const errorMsg = `Tool execution timeout for '${toolName}' after 30 seconds`;
                ErrorHandler.handleError(errorMsg, {
                    showUser: false,
                    logLevel: 'error',
                    context: 'McpServerLauncher.useTool.timeout'
                });
                reject(new Error(errorMsg));
            });

            req.write(postData);
            req.end();
        });
    }

    public async checkServerHealth(worktreePath: string): Promise<boolean> {
        // Validate input
        ErrorHandler.validateRequired(worktreePath, 'worktreePath', 'McpServerLauncher.checkServerHealth');
        
        const server = this.activeMcpServers.get(worktreePath);
        
        if (!server) {
            ErrorHandler.handleError(`No active MCP server found for ${worktreePath}`, {
                showUser: false,
                logLevel: 'warn',
                context: 'McpServerLauncher.checkServerHealth'
            });
            return false;
        }

        const healthUrl = `http://localhost:${server.port}/health`;
        
        return new Promise((resolve) => {
            const req = http.get(healthUrl, (res) => {
                resolve(res.statusCode === 200);
            });

            req.on('error', () => {
                resolve(false);
            });

            req.setTimeout(5000, () => {
                req.destroy();
                resolve(false);
            });
        });
    }
}