import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { writeJsonFile, ensureDir } from '../util/fsx';
import { McpServerLauncher } from './launcher';
import { Logger } from '../util/logger';
import { ErrorHandler } from '../util/errorHandler';
import { RetryHandler } from '../util/retryHandler';

const logger = new Logger('McpServerRegistration');

export interface McpConfig {
    port: number;
    // Add other MCP configuration properties as needed
}

export class McpServerRegistration {
    private mcpServerLauncher: McpServerLauncher;

    constructor(mcpServerLauncher: McpServerLauncher) {
        this.mcpServerLauncher = mcpServerLauncher;
    }

    public async writeMcpConfig(worktreePath: string, config: McpConfig): Promise<void> {
        // Validate input
        ErrorHandler.validateRequired(worktreePath, 'worktreePath', 'McpServerRegistration.writeMcpConfig');
        ErrorHandler.validateRequired(config, 'config', 'McpServerRegistration.writeMcpConfig');
        
        const rooDir = path.join(worktreePath, '.roo');
        const configFile = path.join(rooDir, 'mcp.local.json');

        try {
            await ensureDir(rooDir);
            await writeJsonFile(configFile, config);
            logger.info(`MCP configuration written to ${configFile}`);
        } catch (error: any) {
            ErrorHandler.handleError(error, {
                showUser: true,
                logLevel: 'error',
                userMessage: `Failed to write MCP configuration: ${error.message}`,
                context: 'McpServerRegistration.writeMcpConfig'
            });
        }
    }

    public async registerServer(worktreePath: string): Promise<void> {
        // Input validation
        ErrorHandler.validateRequired(worktreePath, 'worktreePath', 'McpServerRegistration.registerServer');
        ErrorHandler.validatePath(worktreePath, 'directory', 'McpServerRegistration.registerServer');

        try {

            // Check for existing MCP server configuration
            const rooDir = path.join(worktreePath, '.roo');
            const configFile = path.join(rooDir, 'mcp.local.json');

            if (fs.existsSync(configFile)) {
                logger.info(`MCP server configuration already exists for ${worktreePath}`);
                const existingConfig = await this.readMcpConfig(configFile);
                
                // Verify the server is actually running
                if (existingConfig && existingConfig.port) {
                    const isHealthy = await this.mcpServerLauncher.checkServerHealth(worktreePath);
                    if (isHealthy) {
                        logger.info(`MCP server is already running and healthy for ${worktreePath}`);
                        return;
                    } else {
                        logger.warn(`Existing MCP server configuration found but server is not healthy for ${worktreePath}`);
                        // Continue with registration to restart the server
                    }
                }
            }

            // Launch a new MCP server
            logger.info(`Launching new MCP server for ${worktreePath}`);
            const port = await this.mcpServerLauncher.launchMcpServer(worktreePath);

            // Write the configuration
            const config: McpConfig = { port };
            await this.writeMcpConfig(worktreePath, config);

            // Verify the server is healthy after registration
            const maxRetries = 3;
            let retryCount = 0;
            let isHealthy = false;

            while (retryCount < maxRetries && !isHealthy) {
                logger.info(`Verifying server health (attempt ${retryCount + 1}/${maxRetries})...`);
                isHealthy = await this.mcpServerLauncher.checkServerHealth(worktreePath);
                
                if (!isHealthy) {
                    retryCount++;
                    if (retryCount < maxRetries) {
                        // Wait before retry
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
            }

            if (!isHealthy) {
                const errorMsg = `MCP server registration failed: server is not healthy after ${maxRetries} attempts`;
                ErrorHandler.handleError(errorMsg, {
                    showUser: true,
                    logLevel: 'error',
                    context: 'McpServerRegistration.registerServer.healthCheck'
                });
                throw new Error(errorMsg);
            }

            logger.info(`MCP server registered successfully for ${worktreePath} on port ${port}`);
        } catch (error: any) {
            ErrorHandler.handleError(error, {
                showUser: true,
                logLevel: 'error',
                userMessage: `Failed to register MCP server for ${worktreePath}: ${error.message}`,
                context: 'McpServerRegistration.registerServer'
            });
            
            // Attempt cleanup on failure
            try {
                this.mcpServerLauncher.stopMcpServer(worktreePath);
            } catch (cleanupError: any) {
                ErrorHandler.handleError(cleanupError, {
                    showUser: false,
                    logLevel: 'error',
                    context: 'McpServerRegistration.registerServer.cleanup'
                });
            }
            
            throw error;
        }
    }

    private async readMcpConfig(configFile: string): Promise<McpConfig | null> {
        // Validate input
        ErrorHandler.validateRequired(configFile, 'configFile', 'McpServerRegistration.readMcpConfig');
        
        try {
            if (!fs.existsSync(configFile)) {
                return null;
            }

            const configContent = fs.readFileSync(configFile, 'utf8');
            return JSON.parse(configContent) as McpConfig;
        } catch (error: any) {
            ErrorHandler.handleError(error, {
                showUser: false,
                logLevel: 'error',
                context: 'McpServerRegistration.readMcpConfig'
            });
            return null;
        }
    }
}