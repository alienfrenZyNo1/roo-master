import { spawn } from 'child_process';
import { LogStream } from '../util/logStream';

export async function runInContainer(
  containerName: string,
  command: string,
  onLog: (log: string) => void
): Promise<{ success: boolean; exitCode: number | null; log: string }> {
  const logStream = new LogStream(onLog);
  const shellCommand = `docker exec -i ${containerName} bash -lc "${command}"`;

  return new Promise((resolve) => {
    const child = spawn(shellCommand, { shell: true, cwd: '/work' });

    child.stdout.pipe(logStream);
    child.stderr.pipe(logStream);

    child.on('close', (code) => {
      resolve({ success: code === 0, exitCode: code, log: logStream.log });
    });

    child.on('error', (err) => {
      onLog(`Failed to start subprocess: ${err.message}`);
      resolve({ success: false, exitCode: 1, log: logStream.log + err.message });
    });
  });
}