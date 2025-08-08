import { StdioMCPHost } from '@modelcontextprotocol/server';
import { buildProject } from './tools/buildProject';
import { testRun } from './tools/testRun';
import { lintFix } from './tools/lintFix';

const host = new StdioMCPHost();

import { BuildProjectInputs, BuildProjectOutput } from './tools/buildProject';
import { TestRunInputs, TestRunOutput } from './tools/testRun';
import { LintFixOutput } from './tools/lintFix';

host.registerTool({
  name: 'build.project',
  description: 'Builds the project using the detected package manager.',
  schema: {
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
  },
  handler: async (inputs: BuildProjectInputs, onLog: (log: string) => void): Promise<BuildProjectOutput> => {
    const containerName = process.env.CONTAINER_NAME || 'roo-container'; // Replace with actual container name
    return buildProject(containerName, inputs, onLog);
  },
});

host.registerTool({
  name: 'test.run',
  description: 'Runs tests using the detected package manager.',
  schema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Optional test pattern to run specific tests.',
      },
    },
  },
  handler: async (inputs: TestRunInputs, onLog: (log: string) => void): Promise<TestRunOutput> => {
    const containerName = process.env.CONTAINER_NAME || 'roo-container'; // Replace with actual container name
    return testRun(containerName, inputs, onLog);
  },
});

host.registerTool({
  name: 'lint.fix',
  description: 'Runs lint fix using the detected package manager.',
  schema: {
    type: 'object',
    properties: {},
  },
  handler: async (inputs: {}, onLog: (log: string) => void): Promise<LintFixOutput> => {
    const containerName = process.env.CONTAINER_NAME || 'roo-container'; // Replace with actual container name
    return lintFix(containerName, onLog);
  },
});

host.start();