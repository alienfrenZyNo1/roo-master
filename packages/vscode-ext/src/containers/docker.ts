import { exec } from 'child_process';
import { Logger } from '../util/logger';
import { ErrorHandler } from '../util/errorHandler';
import { RetryHandler } from '../util/retryHandler';

const logger = new Logger('DockerContainer');

export interface DockerContainer {
    id: string;
    name: string;
    image: string;
    status: string;
    ports: string;
}

export async function startToolContainer(imageName: string, containerName: string, portBindings: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        // Input validation
        if (!imageName || imageName.trim() === '') {
            const errorMsg = 'Docker image name is required';
            logger.error(errorMsg);
            return reject(new Error(errorMsg));
        }

        if (!containerName || containerName.trim() === '') {
            const errorMsg = 'Container name is required';
            logger.error(errorMsg);
            return reject(new Error(errorMsg));
        }

        // Check if Docker is available
        exec('docker --version', (error) => {
            if (error) {
                const errorMsg = 'Docker is not available or not installed';
                logger.error(errorMsg);
                return reject(new Error(errorMsg));
            }

            // Check if container with same name already exists
            exec(`docker ps -a --filter "name=${containerName}" --format "{{.Names}}"`, (error, stdout) => {
                if (!error && stdout.trim() === containerName) {
                    const errorMsg = `Container with name '${containerName}' already exists`;
                    logger.error(errorMsg);
                    return reject(new Error(errorMsg));
                }

                // Apply security hardening measures
                const securityFlags = [
                    '--read-only',                    // Make container's filesystem read-only
                    '--cap-drop=ALL',                 // Drop all Linux capabilities
                    '--security-opt=no-new-privileges', // Prevent privilege escalation
                    '--pids-limit=512',               // Limit number of processes
                    '--memory=4g',                    // Limit memory usage to 4GB
                    '--cpus=2',                       // Limit CPU usage to 2 cores
                    '--user 1000:1000',               // Run as non-root user
                    '--network none'                  // Isolate container from network access
                ];
                
                // Port bindings are removed for security - no ports should be exposed
                // Network isolation is the default behavior
                const command = `docker run -d --name ${containerName} ${securityFlags.join(' ')} ${imageName}`;
                logger.info(`Starting container: ${command}`);
                
                exec(command, (error, stdout, stderr) => {
                    if (error) {
                        const errorMsg = `Error starting container ${containerName}: ${stderr}`;
                        logger.error(errorMsg);
                        
                        // Provide more specific error messages
                        if (stderr.includes('Unable to find image')) {
                            return reject(new Error(`Docker image '${imageName}' not found. Please pull the image first.`));
                        } else if (stderr.includes('port is already allocated')) {
                            return reject(new Error(`Port already in use. Please check your port bindings.`));
                        } else if (stderr.includes('Conflict. The container name')) {
                            return reject(new Error(`Container name '${containerName}' is already in use.`));
                        }
                        
                        return reject(new Error(errorMsg));
                    }
                    
                    const containerId = stdout.trim();
                    logger.info(`Container ${containerName} started with ID: ${containerId}`);
                    
                    // Verify container is actually running
                    setTimeout(() => {
                        exec(`docker ps --filter "id=${containerId}" --format "{{.Status}}"`, (verifyError, verifyStdout) => {
                            if (verifyError || !verifyStdout.includes('Up')) {
                                const errorMsg = `Container ${containerName} failed to start properly`;
                                logger.error(errorMsg);
                                return reject(new Error(errorMsg));
                            }
                            
                            logger.info(`Container ${containerName} is running: ${verifyStdout.trim()}`);
                            resolve(containerId);
                        });
                    }, 1000); // Wait a second for container to fully start
                });
            });
        });
    });
}

export async function stopToolContainer(containerName: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const command = `docker stop ${containerName}`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                logger.error(`Error stopping container ${containerName}: ${stderr}`);
                return reject(error);
            }
            logger.info(`Container ${containerName} stopped: ${stdout.trim()}`);
            resolve();
        });
    });
}

export async function listToolContainers(): Promise<DockerContainer[]> {
    return new Promise((resolve, reject) => {
        const command = `docker ps -a --format "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                logger.error(`Error listing containers: ${stderr}`);
                return reject(error);
            }

            const lines = stdout.trim().split('\n');
            const containers: DockerContainer[] = [];
            for (const line of lines) {
                const [id, name, image, status, ports] = line.split('\t');
                containers.push({ id, name, image, status, ports });
            }
            resolve(containers);
        });
    });
}