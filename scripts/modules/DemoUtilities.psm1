# This module contains common functions used by the demo scripts

# Function to remove the demo worktree if it exists
function Remove-DemoWorktree {
    Write-Host "Checking for existing worktree 'roo-demo-worktree'..."
    $worktreePath = "roo-demo-worktree"
    $worktreeExistsInGit = $false
    $gitWorktreeList = git worktree list --porcelain 2>&1

    # Check if the worktree is listed by Git
    if ($LASTEXITCODE -eq 0) {
        $gitWorktreeList | ForEach-Object {
            if ($_ -match "^worktree $worktreePath$") {
                $worktreeExistsInGit = $true
            }
        }
    }

    $directoryExists = Test-Path $worktreePath -PathType Container

    if ($worktreeExistsInGit) {
        Write-Host "Git reports worktree '$worktreePath' exists. Attempting to remove..."
        $result = git worktree remove $worktreePath --force 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to remove worktree '$worktreePath' from Git. Error: $result"; exit 1
        }
        Write-Host "Worktree '$worktreePath' successfully removed from Git."
    } elseif ($directoryExists) {
        Write-Host "Git does not report worktree '$worktreePath', but directory exists. Attempting to remove directory..."
        try {
            Remove-Item -Recurse -Force $worktreePath -ErrorAction Stop
            Write-Host "Directory '$worktreePath' successfully removed."
        } catch {
            Write-Error "Failed to remove directory '$worktreePath'. Error: $($_.Exception.Message)"; exit 1
        }
    } else {
        Write-Host "Worktree '$worktreePath' not found by Git and directory does not exist. No cleanup needed."
    }

    Write-Host "Pruning git worktrees..."
    $result = git worktree prune 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to prune worktrees. Error: $result"; exit 1
    }
    Write-Host "Git worktrees pruned."
}

# Function to delete the demo branch if it exists
function Delete-DemoBranch {
    $branchName = "feature/demo-branch"
    Write-Host "Checking for existing branch '$branchName'..."
    $branchCheck = git branch --list $branchName 2>&1
    if ($branchCheck -match $branchName) {
        Write-Host "Branch '$branchName' found. Attempting to delete..."
        $result = git branch -D $branchName 2>&1
        if ($LASTEXITCODE -ne 0 -and $result -notmatch "branch '$branchName' not found") {
            # Check if the error is because the branch is checked out in a worktree
            if ($result -match "checked out at") {
                Write-Host "Branch '$branchName' is checked out in a worktree and cannot be deleted. This is expected behavior."
                Write-Host "The branch will be automatically removed when the worktree is cleaned up."
            } else {
                Write-Error "Failed to delete branch '$branchName'. Error: $result"; exit 1
            }
        } else {
            Write-Host "Branch '$branchName' deleted successfully."
        }
    } else {
        Write-Host "Branch '$branchName' does not exist. No cleanup needed."
    }
}

# Function to initialize git repository if it doesn't exist
function Initialize-GitRepository {
    if (-not (Test-Path ".git")) {
        Write-Host "Git repository not initialized. Initializing..."
        git init
        if ($LASTEXITCODE -ne 0) { Write-Error "Failed to initialize git repository."; exit 1 }
        git add .
        if ($LASTEXITCODE -ne 0) { Write-Error "Failed to add files to git."; exit 1 }
        git commit -m "Initial commit of project files for demo setup"
        if ($LASTEXITCODE -ne 0) { Write-Error "Failed to create initial commit."; exit 1 }
        Write-Host "Git repository initialized and initial commit created."
    } else {
        Write-Host "Git repository already initialized."
    }
}

# Function to check if an npm script exists
function Test-NpmScript {
    param(
        [string]$Path,
        [string]$ScriptName
    )
    $resolvedPath = if ([System.IO.Path]::IsPathRooted($Path)) {
        $Path
    } else {
        Join-Path (Get-Location).Path $Path
    }
    $packageJsonPath = Join-Path $resolvedPath "package.json"
    # Write-Host "Checking for package.json at: $packageJsonPath"
    if (-not (Test-Path $packageJsonPath)) {
        Write-Error "Error: package.json not found at $packageJsonPath"
        return $false
    }
    $packageJson = Get-Content $packageJsonPath | ConvertFrom-Json
    
    # Special handling for built-in npm commands
    $builtInCommands = @("install", "ci", "update", "uninstall", "link", "unlink")
    if ($ScriptName -in $builtInCommands) {
        return $true
    }
    
    if (-not $packageJson.scripts.($ScriptName)) {
        Write-Error "Error: npm script '$ScriptName' not found in $packageJsonPath"
        return $false
    }
    return $true
}

# Function to run an npm script with error handling
function Run-NpmScript {
    param(
        [string]$Path,
        [string]$Command,
        [string]$ErrorMessage,
        [switch]$AllowFailure
    )
    Write-Host "  Running npm $Command in $Path..."
    $originalLocation = Get-Location
    Push-Location $Path
    Write-Host "Current directory: $(Get-Location)"
    try {
        # Determine if it's a built-in npm command or a custom script by checking package.json
        # If the command exists as a script in package.json, use 'npm run'. Otherwise, use direct 'npm'.
        $builtInCommands = @("install", "ci", "update", "uninstall", "link", "unlink")
        if (Test-NpmScript "." $Command -ErrorAction SilentlyContinue) {
            if ($Command -in $builtInCommands) {
                $output = npm $Command *>&1 # Built-in npm command
            } else {
                $output = npm run $Command *>&1 # Custom script
            }
        } else {
            $output = npm $Command *>&1 # Built-in npm command (fallback)
        }

        if ($LASTEXITCODE -ne 0) {
            Write-Error "$ErrorMessage (npm $Command failed with exit code $LASTEXITCODE)"
            if ($Command -eq "build") {
                Write-Error "TypeScript compilation failed. Please check the following errors:"
                $output | ForEach-Object {
                    if ($_ -match "error TS") {
                        Write-Error "  $_"
                    }
                }
            } elseif ($Command -eq "install" -or $Command -eq "ci") {
                Write-Error "Dependency installation failed. Please check the following output for details:"
                $output | ForEach-Object { Write-Error "  $_" }
            }
            if (-not $AllowFailure) {
                Pop-Location
                exit 1
            }
        }
    } catch {
        Write-Error "$ErrorMessage (An unexpected error occurred: $($_.Exception.Message))"
        if (-not $AllowFailure) {
            Pop-Location
            exit 1
        }
    }
    Pop-Location
    Write-Host "Current directory: $(Get-Location)"
    if ($LASTEXITCODE -eq 0 -or $AllowFailure) {
        Write-Host "  npm $Command completed successfully."
    }
}

# Export the functions
Export-ModuleMember -Function Remove-DemoWorktree, Delete-DemoBranch, Initialize-GitRepository, Test-NpmScript, Run-NpmScript