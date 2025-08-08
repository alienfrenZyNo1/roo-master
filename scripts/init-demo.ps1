# This script initializes the git repository for the demo project.

Write-Host "Initializing git repository..."
git init
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to initialize git repository."; exit 1 }

Write-Host "Adding all project files..."
git add .
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to add files to git."; exit 1 }

Write-Host "Creating initial commit..."
git commit -m "Initial commit of project files for demo setup"
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to create initial commit."; exit 1 }

Write-Host "Git repository setup complete for demo."