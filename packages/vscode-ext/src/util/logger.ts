import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel;

export function initializeLogger() {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel('Roo Master');
    }
}

export class Logger {
    private prefix: string;

    constructor(prefix: string = 'Roo Master') {
        this.prefix = prefix;
        initializeLogger(); // Ensure the output channel is initialized
    }

    public info(message: string) {
        this.log(`INFO [${this.prefix}]: ${message}`);
    }

    public warn(message: string) {
        this.log(`WARN [${this.prefix}]: ${message}`);
    }

    public error(message: string) {
        this.log(`ERROR [${this.prefix}]: ${message}`);
    }

    public debug(message: string) {
        // Only log debug messages if a debug mode is enabled, or similar
        this.log(`DEBUG [${this.prefix}]: ${message}`);
    }

    private log(message: string) {
        if (outputChannel) {
            outputChannel.appendLine(message);
        } else {
            console.log(message);
        }
    }

    public showLogs() {
        if (outputChannel) {
            outputChannel.show();
        }
    }
}