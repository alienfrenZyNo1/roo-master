# This script demonstrates the Roo Master system capabilities.

# Import the shared demo utilities module
Import-Module (Join-Path $PSScriptRoot "modules/DemoUtilities.psm1") -Force

# Ensure git repository is initialized before proceeding
Initialize-GitRepository

# Add proper cleanup at the beginning of the script
Write-Host "Performing cleanup before starting the demo..."
Remove-DemoWorktree
Delete-DemoBranch
Write-Host "Cleanup complete."

# 1. Create a new worktree for a feature branch
Write-Host "Step 1: Creating a new worktree for a feature branch..."
git worktree add -b feature/demo-branch roo-demo-worktree
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to create worktree."; exit 1 }
Write-Host "Worktree 'roo-demo-worktree' created."

Write-Host "Copying roo-demo-project to roo-demo-worktree/roo-demo-project..."
$targetDemoProjectPath = Join-Path "roo-demo-worktree" "roo-demo-project"
if (-not (Test-Path $targetDemoProjectPath)) {
    New-Item -ItemType Directory -Path $targetDemoProjectPath | Out-Null
}
Copy-Item -Path "roo-demo-project\*" -Destination $targetDemoProjectPath -Recurse -Force
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to copy roo-demo-project contents to worktree."; exit 1 }
Write-Host "roo-demo-project contents copied to worktree."

# Navigate to the worktree directory
Push-Location roo-demo-worktree
Write-Host "Current directory: $(Get-Location)"

# Define the path to the demo project within the worktree
$demoProjectPath = "roo-demo-project"


# 2. Start a tool container for that worktree
Write-Host "Step 2: Starting a tool container for the worktree..."
Write-Host "Current directory: $(Get-Location)"
# Assuming 'roo-mcp-host' is the name of your MCP host container service
# This command might vary based on your actual MCP setup
# For demonstration, we'll simulate the action.
Write-Host "Simulating tool container startup..."
# In a real scenario, you would run a command like:
# docker-compose up -d roo-mcp-host
# Or a specific command to start the tool container for the worktree.
Start-Sleep -Seconds 5 # Simulate container startup time
Write-Host "Tool container started (simulated)."
Write-Host "Current directory: $(Get-Location)"

# 3. Register the MCP server with Roo
Write-Host "Step 3: Registering the MCP server with Roo..."
Write-Host "Current directory: $(Get-Location)"
# This step typically involves Roo automatically detecting and registering the server.
# For demonstration, we'll assume it's registered or provide a placeholder command if available.
Write-Host "MCP server registered (assumed/simulated)."
Start-Sleep -Seconds 2
Write-Host "Current directory: $(Get-Location)"

# 4. Using the MCP tools (build.project, test.run, lint.fix)
Write-Host "Step 4: Using MCP tools (build.project, test.run, lint.fix)..."
Write-Host "Current directory: $(Get-Location)"

Write-Host "  4.1: Installing dependencies for roo-demo-project..."
Run-NpmScript $demoProjectPath "install" "Failed to install dependencies for roo-demo-project."
Write-Host "Current directory: $(Get-Location)"

Write-Host "  4.2: Running build.project (npm run build)..."
if (-not (Test-NpmScript $demoProjectPath "build")) { exit 1 }
Run-NpmScript $demoProjectPath "build" "Build failed. Please check the output for compilation errors."
Start-Sleep -Seconds 2
Write-Host "Current directory: $(Get-Location)"

Write-Host "  4.3: Running test.run (npm test)..."
if (-not (Test-NpmScript $demoProjectPath "test")) { exit 1 }
Run-NpmScript $demoProjectPath "test" "Tests failed. Please review the test results."
Start-Sleep -Seconds 2
Write-Host "Current directory: $(Get-Location)"

Write-Host "  4.4: Running lint (npm lint) to show issues..."
if (-not (Test-NpmScript $demoProjectPath "lint")) { exit 1 }
Run-NpmScript $demoProjectPath "lint" "Lint check completed with issues (expected)." -AllowFailure
Start-Sleep -Seconds 2
Write-Host "Current directory: $(Get-Location)"

Write-Host "  4.5: Running lint.fix (npm run lint:fix) to fix issues..."
if (-not (Test-NpmScript $demoProjectPath "lint:fix")) { exit 1 }
Run-NpmScript $demoProjectPath "lint:fix" "Lint fix failed. Check the linting rules and output."
Start-Sleep -Seconds 2
Write-Host "Current directory: $(Get-Location)"

# 5. Creating multiple parallel tracks
Write-Host "Step 5: Creating multiple parallel tracks (simulated)..."
Write-Host "Current directory: $(Get-Location)"
# This step would involve Roo's internal track management.
# For demonstration, we'll simulate creating branches for parallel work.
git checkout -b feature/track-a
Write-Host "  Created feature/track-a."
Write-Host "Current directory: $(Get-Location)"
git checkout -b feature/track-b master
Write-Host "  Created feature/track-b."
Write-Host "Current directory: $(Get-Location)"
git checkout feature/demo-branch
Write-Host "  Switched back to feature/demo-branch."
Write-Host "Current directory: $(Get-Location)"
Start-Sleep -Seconds 2
Write-Host "Current directory: $(Get-Location)"

# 6. Merging tracks into integration branch
Write-Host "Step 6: Merging tracks into integration branch (simulated)..."
Write-Host "Current directory: $(Get-Location)"
# This step would involve Roo's merge flow.
# For demonstration, we'll simulate merging branches.
git checkout master
Write-Host "  Switched to master branch."
Write-Host "Current directory: $(Get-Location)"
git merge feature/demo-branch --no-ff -m "Merge feature/demo-branch into master"
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to merge feature/demo-branch into master."; exit 1 }
Write-Host "  Merged feature/demo-branch into master."
Write-Host "Current directory: $(Get-Location)"
Delete-DemoBranch # Use the cleanup function from shared module
Write-Host "Current directory: $(Get-Location)"
Start-Sleep -Seconds 2
Write-Host "Current directory: $(Get-Location)"

Pop-Location # Go back to original directory
Write-Host "Current directory: $(Get-Location)"

Write-Host "Demonstration complete."