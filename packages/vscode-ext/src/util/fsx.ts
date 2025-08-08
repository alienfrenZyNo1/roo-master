import * as fs from 'fs';
import * as path from 'path';

export function fileExists(filePath: string): Promise<boolean> {
    return new Promise(resolve => {
        fs.access(filePath, fs.constants.F_OK, (err) => {
            resolve(!err);
        });
    });
}

export function readFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

export function writeFile(filePath: string, content: string): Promise<void> {
    return new Promise((resolve, reject) => {
        fs.writeFile(filePath, content, 'utf8', (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

export function ensureDir(dirPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        fs.mkdir(dirPath, { recursive: true }, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

export async function readJsonFile<T>(filePath: string): Promise<T | undefined> {
    if (!(await fileExists(filePath))) {
        return undefined;
    }
    const content = await readFile(filePath);
    return JSON.parse(content) as T;
}

export async function writeJsonFile(filePath: string, obj: any): Promise<void> {
    await ensureDir(path.dirname(filePath));
    await writeFile(filePath, JSON.stringify(obj, null, 2));
}