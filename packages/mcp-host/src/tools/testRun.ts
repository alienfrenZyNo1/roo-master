import { runInContainer } from '../exec/runInContainer';
import * as fs from 'fs/promises';

export interface TestRunInputs {
  pattern?: string;
}

export interface TestRunOutput {
  success: boolean;
  exitCode: number | null;
  log: string;
}

export async function testRun(
  containerName: string,
  inputs: TestRunInputs,
  onLog: (log: string) => void
): Promise<TestRunOutput> {
  const { pattern } = inputs;

  let packageManager = 'npm'; // Default to npm

  try {
    await fs.access('/work/pnpm-lock.yaml');
    packageManager = 'pnpm';
  } catch (error) {
    // pnpm-lock.yaml not found, fallback to npm
    try {
      await fs.access('/work/package-lock.json');
      packageManager = 'npm';
    } catch (error) {
      onLog('Neither pnpm-lock.yaml nor package-lock.json found. Assuming npm.');
    }
  }

  let testCommand = '';
  if (packageManager === 'pnpm') {
    testCommand = pattern ? `pnpm test ${pattern}` : 'pnpm test';
  } else {
    testCommand = pattern ? `npm test ${pattern}` : 'npm test';
  }

  onLog(`Executing test command: ${testCommand} in container ${containerName}`);
  const result = await runInContainer(containerName, testCommand, onLog);

  return {
    success: result.success,
    exitCode: result.exitCode,
    log: result.log,
  };
}