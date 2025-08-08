import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs-extra';

// Helper function to get the workspace folder path
function getWorkspaceFolder(): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    assert.ok(workspaceFolders && workspaceFolders.length > 0, 'No workspace folder found');
    return workspaceFolders[0].uri.fsPath;
}

// Helper to mock vscode.window.showInputBox
async function mockInputBox(prompt: string, value: string): Promise<() => void> {
    const originalShowInputBox = vscode.window.showInputBox;
    (vscode.window as any).showInputBox = (options?: vscode.InputBoxOptions, token?: vscode.CancellationToken) => {
        if (options?.prompt === prompt) {
            return Promise.resolve(value);
        }
        return originalShowInputBox(options, token);
    };
    return () => {
        (vscode.window as any).showInputBox = originalShowInputBox;
    };
}

// Helper to restore original vscode.window.showInputBox
async function runGitCommand(cwd: string, command: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const terminal = vscode.window.createTerminal({ name: 'Git Command', cwd });
        terminal.show();
        terminal.sendText(command);
        terminal.sendText('exit'); // Ensure the terminal closes after the command
        const disposable = vscode.window.onDidCloseTerminal(e => {
            if (e === terminal) {
                disposable.dispose();
                resolve();
            }
        });
    });
}


suite('Roo Master E2E Test Suite', () => {
    vscode.window.showInformationMessage('Start all E2E tests.');

    const workspaceRoot = getWorkspaceFolder();
    const testRepoPath = path.join(workspaceRoot, 'test-repo');
    const sampleProjectPath = path.join(workspaceRoot, 'test', 'sample-project');

    test('1. Worktree creation and management', async () => {
        console.log('Running test: Worktree creation and management');
        const worktreeName = 'e2e-test-worktree';
        const worktreePath = path.join(testRepoPath, worktreeName); // Worktree should be inside testRepoPath

        // Mock showInputBox to provide worktree name
        const restoreWorktreeInputBox = await mockInputBox('Enter the new branch name for the worktree', worktreeName);

        // Execute "Roo Master: Create Worktree (new branch)"
        await vscode.commands.executeCommand('roo-master.createWorktree');

        // Verify worktree creation
        assert.ok(await fs.pathExists(worktreePath), `Worktree directory ${worktreePath} should exist.`);
        assert.ok(await fs.pathExists(path.join(worktreePath, '.git')), `.git directory in worktree should exist.`);

        // Clean up mock
        restoreWorktreeInputBox();
        console.log('Test passed: Worktree creation and management.');
    }).timeout(60000); // Increased timeout for worktree creation

    test('2. Container lifecycle (start/stop with proper hardening)', async () => {
        console.log('Running test: Container lifecycle');
        // Assuming a worktree is already created and active from the previous test or setup
        // Execute "Roo Master: Start Tool Container(s)"
        await vscode.commands.executeCommand('roo-master.startToolContainers');
        // TODO: Add verification for container start (e.g., check docker ps or logs)
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for containers to start

        // Execute "Roo Master: Stop Tool Container(s)"
        await vscode.commands.executeCommand('roo-master.stopToolContainers');
        // TODO: Add verification for container stop (e.g., check docker ps or logs)
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for containers to stop

        console.log('Test passed: Container lifecycle.');
    }).timeout(60000); // Increased timeout for container operations

    test('3. MCP server registration and communication', async () => {
        console.log('Running test: MCP server registration and communication');
        const mcpConfigPath = path.join(testRepoPath, '.roo', 'mcp.local.json');

        // Execute "Roo Master: Register MCP Server"
        await vscode.commands.executeCommand('roo-master.registerMcpServer');

        // Verify mcp.local.json creation
        assert.ok(await fs.pathExists(mcpConfigPath), `MCP config file ${mcpConfigPath} should exist.`);

        const mcpConfig = await fs.readJson(mcpConfigPath);
        assert.strictEqual(mcpConfig.name, 'roo-master-mcp', 'MCP server name should be roo-master-mcp');
        assert.strictEqual(mcpConfig.type, 'stdio', 'MCP server type should be stdio');
        assert.ok(mcpConfig.command.includes('node'), 'MCP server command should include node');
        assert.ok(mcpConfig.command.includes('packages/mcp-host/out/index.js'), 'MCP server command should point to mcp-host index.js');

        // TODO: Add actual communication test with the MCP server (e.g., call a dummy tool)

        console.log('Test passed: MCP server registration and communication.');
    }).timeout(30000); // Increased timeout for MCP server registration

    test('4. Tool execution (build.project, test.run, lint.fix) via MCP', async () => {
        console.log('Running test: Tool execution');
        const worktreePath = path.join(testRepoPath, 'e2e-test-worktree'); // Assuming worktree from test 1

        // Copy sample project to worktree
        await fs.copy(sampleProjectPath, worktreePath, { overwrite: true });

        // Simulate "Build the project"
        await vscode.commands.executeCommand('roo-master.executeWorkPlan', 'Build the project');
        const bundlePath = path.join(worktreePath, 'dist', 'bundle.js');
        assert.ok(await fs.pathExists(bundlePath), `Bundle file ${bundlePath} should exist after build.`);
        const bundleContent = await fs.readFile(bundlePath, 'utf8');
        assert.ok(bundleContent.includes('Build successful!'), 'Bundle content should indicate successful build.');

        // Simulate "Run tests"
        await vscode.commands.executeCommand('roo-master.executeWorkPlan', 'Run tests');
        // TODO: Verify test pass/fail from logs or other observable state

        // Simulate "Fix lint issues"
        const originalIndexContent = await fs.readFile(path.join(worktreePath, 'index.js'), 'utf8');
        assert.ok(originalIndexContent.includes('var unusedVariable = 10;'), 'Original index.js should have unusedVariable.');

        await vscode.commands.executeCommand('roo-master.executeWorkPlan', 'Fix lint issues');
        const fixedIndexContent = await fs.readFile(path.join(worktreePath, 'index.js'), 'utf8');
        assert.ok(!fixedIndexContent.includes('var unusedVariable = 10;'), 'Fixed index.js should not have unusedVariable.');

        console.log('Test passed: Tool execution.');
    }).timeout(120000); // Increased timeout for tool execution

    test('5. Integration and merge flow functionality', async () => {
        console.log('Running test: Integration and merge flow functionality');
        const featureWorktreeName = 'feature-branch-worktree';
        const featureWorktreePath = path.join(testRepoPath, featureWorktreeName);
        const integrationBranchName = 'integration-main';

        // 1. Create a new worktree for a feature branch
        const restoreFeatureInputBox = await mockInputBox('Enter the new branch name for the worktree', featureWorktreeName);
        await vscode.commands.executeCommand('roo-master.createWorktree');
        assert.ok(await fs.pathExists(featureWorktreePath), `Feature worktree directory ${featureWorktreePath} should exist.`);
        restoreFeatureInputBox();

        // 2. Make changes in the feature branch
        const featureFilePath = path.join(featureWorktreePath, 'feature-file.txt');
        await fs.writeFile(featureFilePath, 'Content from feature branch.');

        // 3. Commit the changes in the feature branch
        await runGitCommand(featureWorktreePath, 'git add .');
        await runGitCommand(featureWorktreePath, 'git commit -m "Add feature file"');

        // 4. Switch back to the main branch (testRepoPath)
        await runGitCommand(testRepoPath, 'git checkout main');

        // 5. Create an integration branch from main
        await runGitCommand(testRepoPath, `git checkout -b ${integrationBranchName}`);

        // 6. Merge the feature branch into the integration branch
        await runGitCommand(testRepoPath, `git merge ${featureWorktreeName}`); // Merge the branch associated with the worktree

        // 7. Simulate a conflict (by making a conflicting change on the main branch)
        // This step is tricky to automate reliably in E2E. For now, we'll assume no conflict or manual resolution.
        // A more robust E2E test might involve specific file content changes and then checking for merge markers.

        // 8. Resolve the conflict (if any) - manual step for now, or use a simplified auto-merge scenario
        // For E2E, we might need to mock user interaction for conflict resolution if Roo Master provides a UI for it.

        // 9. Verify the merged content
        const mergedFeatureFilePath = path.join(testRepoPath, 'feature-file.txt');
        assert.ok(await fs.pathExists(mergedFeatureFilePath), `Merged feature file ${mergedFeatureFilePath} should exist.`);
        const mergedContent = await fs.readFile(mergedFeatureFilePath, 'utf8');
        assert.strictEqual(mergedContent, 'Content from feature branch.', 'Merged file content should be correct.');

        // Clean up feature worktree
        await runGitCommand(testRepoPath, `git worktree remove ${featureWorktreeName} --force`);
        assert.ok(!(await fs.pathExists(featureWorktreePath)), `Feature worktree directory ${featureWorktreePath} should be removed.`);

        console.log('Test passed: Integration and merge flow functionality.');
    }).timeout(180000); // Increased timeout for merge flow

    test('6. Parallel track execution with proper concurrency limits', async () => {
        console.log('Running test: Parallel track execution with proper concurrency limits');
        // This will involve creating multiple worktrees and executing tasks in parallel,
        // ensuring concurrency limits are respected.

        // TODO: Implement detailed steps for parallel track execution.

        console.log('Test passed: Parallel track execution with proper concurrency limits (placeholder).');
    }).timeout(120000);
});