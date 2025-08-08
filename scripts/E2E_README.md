# E2E Test Scripts

This directory contains scripts for setting up and tearing down test environments for end-to-end (E2E) testing of the Roo Master system.

## Scripts

### e2e-setup.js

**Purpose**: Initializes a test repository for E2E testing.

**What it does**:
- Creates a clean test repository at `test-repo/` in the workspace root
- Initializes it as a Git repository
- Sets up basic Git configuration (user name and email)
- Creates an initial commit
- Sets the main branch name to 'main'
- Adds a dummy remote origin

**Usage**:
```bash
node scripts/e2e-setup.js
```

**When to use**:
- Before running E2E tests that require a clean Git repository
- When you need a standardized test environment for testing Git-related functionality

### e2e-teardown.js

**Purpose**: Cleans up the test repository after E2E testing.

**What it does**:
- Removes the test repository directory created by e2e-setup.js
- Ensures no artifacts remain from testing

**Usage**:
```bash
node scripts/e2e-teardown.js
```

**When to use**:
- After completing E2E tests
- Before starting a new test run to ensure a clean state

## Integration with Demo Scripts

These E2E scripts are separate from the main demo scripts (`run-demo.ps1`, `clean-demo.ps1`, etc.) and serve a different purpose:

- **Demo scripts**: Demonstrate the Roo Master system's capabilities using the `roo-demo-project` and `roo-demo-worktree`
- **E2E scripts**: Provide a clean, isolated environment for automated end-to-end testing

The E2E scripts are typically used in automated testing scenarios, while the demo scripts are for manual demonstration of features.

## Requirements

- Node.js (for running JavaScript scripts)
- fs-extra package (`npm install fs-extra`)
- Git (for repository operations)

## Important Notes

- These scripts operate on a `test-repo/` directory in the workspace root
- The setup script will remove any existing `test-repo/` directory before creating a new one
- Always run teardown after completing tests to clean up the test environment
- These scripts are designed to be run programmatically as part of a test suite