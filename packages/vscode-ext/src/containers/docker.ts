import { exec } from 'child_process';
import { log } from '../util/logger';

export interface DockerContainer {
    id: string;
    name: string;
    image: string;
    status: string;
    ports: string;
}

export async function startToolContainer(imageName: string, containerName: string, portBindings: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        const portArgs = portBindings.map(pb => `-p ${pb}`).join(' ');
        const command = `docker run -d --name ${containerName} ${portArgs} ${imageName}`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                log(`Error starting container ${containerName}: ${stderr}`);
                return reject(error);
            }
            log(`Container ${containerName} started: ${stdout.trim()}`);
            resolve(stdout.trim());
        });
    });
}

export async function stopToolContainer(containerName: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const command = `docker stop ${containerName}`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                log(`Error stopping container ${containerName}: ${stderr}`);
                return reject(error);
            }
            log(`Container ${containerName} stopped: ${stdout.trim()}`);
            resolve();
        });
    });
}

export async function listToolContainers(): Promise<DockerContainer[]> {
    return new Promise((resolve, reject) => {
        const command = `docker ps -a --format "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                log(`Error listing containers: ${stderr}`);
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