import * as vscode from 'vscode';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { Logger } from '../util/logger';
import { findOpenPort } from '../util/ports';

const logger = new Logger('McpServerLauncher');

interface McpServerProcess {
    process: ChildProcessWithoutNullStreams;
    port: number;
    worktreePath: string;
}

export class McpServerLauncher {
    private activeMcpServers: Map<string, McpServerProcess> = new Map();

    public async launchMcpServer(worktreePath: string): Promise<number> {
        if (this.activeMcpServers.has(worktreePath)) {
            logger.info(`MCP server already running for ${worktreePath} on port ${this.activeMcpServers.get(worktreePath)?.port}`);
            return this.activeMcpServers.get(worktreePath)!.port;
        }

        const port = await findOpenPort(8000, 9000); // Find an available port
        logger.info(`Launching MCP server for ${worktreePath} on port ${port}...`);

        const mcpHostPath = vscode.Uri.joinPath(vscode.Uri.file(vscode.extensions.getExtension('RooVeterinaryInc.roo-master')!.extensionPath), 'packages', 'mcp-host').fsPath;
        
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

        this.activeMcpServers.set(worktreePath, { process: serverProcess, port, worktreePath });
        logger.info(`MCP server launched for ${worktreePath} on port ${port}`);
        return port;
    }

    public stopMcpServer(worktreePath: string): void {
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

    public async useTool(serverName: string, toolName: string, args: any): Promise<any> {
        // This is a placeholder for the actual MCP tool usage logic.
        // In a real scenario, this would involve making an HTTP request to the MCP server.
        logger.info(`Simulating use of tool '${toolName}' on server '${serverName}' with args: ${JSON.stringify(args)}`);
        // Simulate a delay for tool execution
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { success: true, message: `Tool '${toolName}' executed successfully.` };
    }
}