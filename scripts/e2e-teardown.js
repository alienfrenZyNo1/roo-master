const fs = require('fs-extra');
const path = require('path');

const workspaceRoot = process.cwd(); // This will be roo-master root
const testRepoPath = path.join(workspaceRoot, 'test-repo');

async function teardown() {
    console.log('E2E Teardown: Cleaning up test repository...');
    await fs.remove(testRepoPath);
    console.log('E2E Teardown: Test repository cleaned up.');
}

teardown().catch(err => {
    console.error('E2E Teardown failed:', err);
    process.exit(1);
});