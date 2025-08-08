# This script cleans up the demo environment by removing the worktree and deleting the feature branch.

# Import the shared demo utilities module
Import-Module (Join-Path $PSScriptRoot "modules/DemoUtilities.psm1") -Force

Write-Host "Starting demo environment cleanup..."
Remove-DemoWorktree
Delete-DemoBranch
Write-Host "Demo environment cleanup complete."