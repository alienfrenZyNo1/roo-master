const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

const workspaceRoot = process.cwd(); // This will be roo-master root
const testRepoPath = path.join(workspaceRoot, 'test-repo');

async function setup() {
    console.log('E2E Setup: Initializing test repository...');
    await fs.remove(testRepoPath);
    await fs.mkdirp(testRepoPath);

    // Initialize git repo
    execSync('git init', { cwd: testRepoPath, stdio: 'inherit' });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath, stdio: 'inherit' });
    execSync('git config user.name "Test User"', { cwd: testRepoPath, stdio: 'inherit' });
    execSync('git add .', { cwd: testRepoPath, stdio: 'inherit' });
    execSync('git commit -m "Initial commit"', { cwd: testRepoPath, stdio: 'inherit' });
    execSync('git branch -M main', { cwd: testRepoPath, stdio: 'inherit' });
    execSync('git remote add origin https://github.com/test/test-repo.git', { cwd: testRepoPath, stdio: 'inherit' });
    console.log('E2E Setup: Test repository initialized.');
}

setup().catch(err => {
    console.error('E2E Setup failed:', err);
    process.exit(1);
});