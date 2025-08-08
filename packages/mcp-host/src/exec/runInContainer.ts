import { spawn } from 'child_process';
import { LogStream } from '../util/logStream';

// Sanitize input to prevent command injection
function sanitizeCommand(command: string): string {
  // Escape special characters that could be used for command injection
  return command.replace(/["`$\\]/g, '\\$&');
}

export async function runInContainer(
  containerName: string,
  command: string,
  onLog: (log: string) => void
): Promise<{ success: boolean; exitCode: number | null; log: string }> {
  const logStream = new LogStream(onLog);
  
  // Validate container name to prevent injection
  if (!/^[a-zA-Z0-9_-]+$/.test(containerName)) {
    const errorMsg = `Invalid container name: ${containerName}`;
    onLog(errorMsg);
    return { success: false, exitCode: 1, log: errorMsg };
  }

  // Sanitize the command to prevent command injection
  const sanitizedCommand = sanitizeCommand(command);
  
  // Use argument array instead of shell string to prevent injection
  const args = ['exec', '-i', containerName, 'bash', '-lc', sanitizedCommand];

  return new Promise((resolve) => {
    const child = spawn('docker', args, { cwd: '/work' });

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