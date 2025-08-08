# This script demonstrates the Roo Master system capabilities.

# Function to initialize git repository if it doesn't exist
function Initialize-GitRepository {
    if (-not (Test-Path ".git")) {
        Write-Host "Git repository not initialized. Initializing..."
        git init
        if ($LASTEXITCODE -ne 0) { Write-Error "Failed to initialize git repository."; exit 1 }
        git add .
        if ($LASTEXITCODE -ne 0) { Write-Error "Failed to add files to git."; exit 1 }
        git commit -m "Initial commit of project files"
        if ($LASTEXITCODE -ne 0) { Write-Error "Failed to create initial commit."; exit 1 }
        Write-Host "Git repository initialized and initial commit created."
    } else {
        Write-Host "Git repository already initialized."
    }
}

# Ensure git repository is initialized before proceeding
Initialize-GitRepository

# 1. Create a new worktree for a feature branch
Write-Host "Step 1: Creating a new worktree for a feature branch..."
git worktree add -b feature/demo-branch roo-demo-worktree
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to create worktree."; exit 1 }
Write-Host "Worktree 'roo-demo-worktree' created."

# Navigate to the worktree directory
Push-Location roo-demo-worktree

# 2. Start a tool container for that worktree
Write-Host "Step 2: Starting a tool container for the worktree..."
# Assuming 'roo-mcp-host' is the name of your MCP host container service
# This command might vary based on your actual MCP setup
# For demonstration, we'll simulate the action.
Write-Host "Simulating tool container startup..."
# In a real scenario, you would run a command like:
# docker-compose up -d roo-mcp-host
# Or a specific command to start the tool container for the worktree.
Start-Sleep -Seconds 5 # Simulate container startup time
Write-Host "Tool container started (simulated)."

# 3. Register the MCP server with Roo
Write-Host "Step 3: Registering the MCP server with Roo..."
# This step typically involves Roo automatically detecting and registering the server.
# For demonstration, we'll assume it's registered or provide a placeholder command if available.
Write-Host "MCP server registered (assumed/simulated)."
Start-Sleep -Seconds 2

# 4. Using the MCP tools (build.project, test.run, lint.fix)
Write-Host "Step 4: Using MCP tools (build.project, test.run, lint.fix)..."

Write-Host "  4.1: Installing dependencies for roo-demo-project..."
npm install
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to install dependencies."; exit 1 }
Write-Host "  Dependencies installed."

Write-Host "  4.2: Running build.project (npm run build)..."
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Build failed."; exit 1 }
Write-Host "  Build completed successfully."
Start-Sleep -Seconds 2

Write-Host "  4.3: Running test.run (npm run test)..."
npm run test
if ($LASTEXITCODE -ne 0) { Write-Error "Tests failed."; exit 1 }
Write-Host "  Tests completed successfully."
Start-Sleep -Seconds 2

Write-Host "  4.4: Running lint (npm run lint) to show issues..."
npm run lint
# Lint will intentionally fail, so we don't check $LASTEXITCODE
Write-Host "  Lint issues displayed (expected)."
Start-Sleep -Seconds 2

Write-Host "  4.5: Running lint.fix (npm run lint:fix) to fix issues..."
npm run lint:fix
if ($LASTEXITCODE -ne 0) { Write-Error "Lint fix failed."; exit 1 }
Write-Host "  Lint issues fixed."
Start-Sleep -Seconds 2

# 5. Creating multiple parallel tracks
Write-Host "Step 5: Creating multiple parallel tracks (simulated)..."
# This step would involve Roo's internal track management.
# For demonstration, we'll simulate creating branches for parallel work.
git checkout -b feature/track-a
Write-Host "  Created feature/track-a."
git checkout -b feature/track-b master
Write-Host "  Created feature/track-b."
git checkout feature/demo-branch
Write-Host "  Switched back to feature/demo-branch."
Start-Sleep -Seconds 2

# 6. Merging tracks into integration branch
Write-Host "Step 6: Merging tracks into integration branch (simulated)..."
# This step would involve Roo's merge flow.
# For demonstration, we'll simulate merging branches.
git checkout master
Write-Host "  Switched to master branch."
git merge feature/demo-branch --no-ff -m "Merge feature/demo-branch into master"
Write-Host "  Merged feature/demo-branch into master."
git branch -d feature/demo-branch
Write-Host "  Deleted feature/demo-branch."
Start-Sleep -Seconds 2

Pop-Location # Go back to original directory

Write-Host "Demonstration complete."