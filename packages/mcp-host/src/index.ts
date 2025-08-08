import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { buildProject } from './tools/buildProject';
import { testRun } from './tools/testRun';
import { lintFix } from './tools/lintFix';

import { BuildProjectInputs, BuildProjectOutput } from './tools/buildProject';
import { TestRunInputs, TestRunOutput } from './tools/testRun';
import { LintFixOutput } from './tools/lintFix';

// Initialize MCP server
const server = new Server(
  {
    name: 'roo-mcp-host',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Helper function to get container name with validation
function getContainerName(): string {
  const containerName = process.env.CONTAINER_NAME || 'roo-container';
  
  // Validate container name format
  if (!/^[a-zA-Z0-9_-]+$/.test(containerName)) {
    throw new Error(`Invalid container name: ${containerName}`);
  }
  
  return containerName;
}

// Register build project tool
server.setRequestHandler(
  CallToolRequestSchema,
  async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const containerName = getContainerName();
      
      switch (name) {
        case 'build.project': {
          const inputs: BuildProjectInputs = args || {};
          const onLog = (log: string) => {
            server.sendLoggingMessage({
              level: 'info',
              data: log,
            });
          };
          
          onLog(`Starting build process in container: ${containerName}`);
          const result = await buildProject(containerName, inputs, onLog);
          return {
            content: [
              {
                type: 'text',
                text: result.log,
              },
            ],
            isError: !result.success,
          };
        }
        
        case 'test.run': {
          const inputs: TestRunInputs = args || {};
          const onLog = (log: string) => {
            server.sendLoggingMessage({
              level: 'info',
              data: log,
            });
          };
          
          onLog(`Starting test execution in container: ${containerName}`);
          const result = await testRun(containerName, inputs, onLog);
          return {
            content: [
              {
                type: 'text',
                text: result.log,
              },
            ],
            isError: !result.success,
          };
        }
        
        case 'lint.fix': {
          const onLog = (log: string) => {
            server.sendLoggingMessage({
              level: 'info',
              data: log,
            });
          };
          
          onLog(`Starting lint fix in container: ${containerName}`);
          const result = await lintFix(containerName, onLog);
          return {
            content: [
              {
                type: 'text',
                text: result.log,
              },
            ],
            isError: !result.success,
          };
        }
        
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await server.sendLoggingMessage({
        level: 'error',
        data: errorMessage,
      });
      
      return {
        content: [
          {
            type: 'text',
            text: errorMessage,
          },
        ],
        isError: true,
      };
    }
  }
);

// List available tools
server.setRequestHandler(
  ListToolsRequestSchema,
  async () => {
  return {
    tools: [
      {
        name: 'build.project',
        description: 'Builds the project using the detected package manager.',
        inputSchema: {
          type: 'object',
          properties: {
            install: {
              type: 'boolean',
              description: 'Whether to run install command before building (default: true)',
              default: true,
            },
            target: {
              type: 'string',
              enum: ['dev', 'prod'],
              description: 'Build target (default: "dev")',
              default: 'dev',
            },
          },
          required: [],
        },
      },
      {
        name: 'test.run',
        description: 'Runs tests using the detected package manager.',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'Optional test pattern to run specific tests.',
            },
          },
          required: [],
        },
      },
      {
        name: 'lint.fix',
        description: 'Runs lint fix using the detected package manager.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    ],
  };
});

// Start the MCP server with error handling
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('MCP host server started successfully');
  } catch (error) {
    console.error('Failed to start MCP host server:', error);
    process.exit(1);
  }
}

main();