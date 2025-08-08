import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
    try {
        // The folder containing the Extension Test Runner and the Extension Host
        const extensionTestsPath = path.resolve(__dirname, './e2e/extension.test.js');

        // Download VS Code, unzip it and run the integration test
        await runTests({
            extensionTestsPath,
            launchArgs: [
                '--disable-extensions',
                '--disable-gpu',
            ],
            mocha: {
                reporter: 'mocha-junit-reporter',
                reporterOptions: {
                    mochaFile: path.resolve(__dirname, '../../test-results/e2e-test-results.xml')
                }
            }
        });
    } catch (err) {
        console.error('Failed to run tests');
        process.exit(1);
    }
}

main();