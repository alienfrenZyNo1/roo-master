import { runInContainer } from '../exec/runInContainer';
import * as fs from 'fs/promises';

export interface LintFixOutput {
  success: boolean;
  exitCode: number | null;
  log: string;
}

export async function lintFix(
  containerName: string,
  onLog: (log: string) => void
): Promise<LintFixOutput> {
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

  const lintCommand = packageManager === 'pnpm' ? 'pnpm lint --fix' : 'npm run lint -- --fix';

  onLog(`Executing lint fix command: ${lintCommand} in container ${containerName}`);
  const result = await runInContainer(containerName, lintCommand, onLog);

  return {
    success: result.success,
    exitCode: result.exitCode,
    log: result.log,
  };
}