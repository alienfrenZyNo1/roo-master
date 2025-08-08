import { runInContainer } from '../exec/runInContainer';
import * as fs from 'fs/promises';

export interface BuildProjectInputs {
  install?: boolean;
  target?: 'dev' | 'prod';
}

export interface BuildProjectOutput {
  success: boolean;
  exitCode: number | null;
  log: string;
}

export async function buildProject(
  containerName: string,
  inputs: BuildProjectInputs,
  onLog: (log: string) => void
): Promise<BuildProjectOutput> {
  const { install = true, target = 'dev' } = inputs;

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

  let installCommand = '';
  if (install) {
    installCommand = packageManager === 'pnpm' ? 'pnpm install && ' : 'npm install && ';
  }

  const buildCommand = packageManager === 'pnpm' ? `pnpm run build:${target}` : `npm run build:${target}`;
  const fullCommand = `${installCommand}${buildCommand}`;

  onLog(`Executing build command: ${fullCommand} in container ${containerName}`);
  const result = await runInContainer(containerName, fullCommand, onLog);

  return {
    success: result.success,
    exitCode: result.exitCode,
    log: result.log,
  };
}