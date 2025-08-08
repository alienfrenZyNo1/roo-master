# Roo Master Installation Script for Windows
# This script installs all Roo Master components

param(
    [switch]$Force = $false
)

# Version
$VERSION = "1.0.0"

# Colors for output (Windows 10+ supports ANSI escape codes)
$GREEN = "`e[0;32m"
$RED = "`e[0;31m"
$YELLOW = "`e[1;33m"
$NC = "`e[0m" # No Color

# Check if running on Windows
if ($env:OS -ne "Windows_NT") {
    Write-Host "${RED}Error: This script is designed for Windows only.${NC}" -ForegroundColor Red
    exit 1
}

Write-Host "${GREEN}Roo Master Installation Script v$VERSION${NC}" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Yellow

# Function to check if command exists
function Test-Command {
    param([string]$Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

# Function to install VS Code extension
function Install-VSCodeExtension {
    Write-Host "${YELLOW}Installing VS Code extension...${NC}" -ForegroundColor Yellow
    
    if (-not (Test-Command "code")) {
        Write-Host "${RED}Error: VS Code is not installed. Please install VS Code first.${NC}" -ForegroundColor Red
        Write-Host "Download from: https://code.visualstudio.com/" -ForegroundColor Cyan
        return $false
    }
    
    # Check if the extension is already installed
    $installedExtensions = code --list-extensions 2>$null
    if ($installedExtensions -match "roo-master.roo-master") {
        Write-Host "${GREEN}VS Code extension is already installed.${NC}" -ForegroundColor Green
        return $true
    }
    
    # Find the .vsix file
    $vsixPaths = @(
        ".\packages\vscode-ext\roo-master-$VERSION.vsix",
        ".\roo-master-$VERSION\packages\vscode-ext\roo-master-$VERSION.vsix",
        "$PSScriptRoot\..\packages\vscode-ext\roo-master-$VERSION.vsix"
    )
    
    $VSIX_PATH = ""
    foreach ($path in $vsixPaths) {
        if (Test-Path $path -PathType Leaf) {
            $VSIX_PATH = $path
            break
        }
    }
    
    if ([string]::IsNullOrEmpty($VSIX_PATH)) {
        Write-Host "${RED}Error: VS Code extension package not found.${NC}" -ForegroundColor Red
        Write-Host "Please ensure the .vsix file is available." -ForegroundColor Yellow
        return $false
    }
    
    # Install the extension
    Write-Host "Installing from: $VSIX_PATH" -ForegroundColor Cyan
    try {
        code --install-extension $VSIX_PATH
        if ($LASTEXITCODE -eq 0) {
            Write-Host "${GREEN}VS Code extension installed successfully.${NC}" -ForegroundColor Green
            return $true
        } else {
            Write-Host "${RED}Error: Failed to install VS Code extension.${NC}" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "${RED}Error: Failed to install VS Code extension: $_${NC}" -ForegroundColor Red
        return $false
    }
}

# Function to install MCP host server
function Install-MCPHost {
    Write-Host "${YELLOW}Installing MCP host server...${NC}" -ForegroundColor Yellow
    
    if (-not (Test-Command "node")) {
        Write-Host "${RED}Error: Node.js is not installed. Please install Node.js 18 or higher.${NC}" -ForegroundColor Red
        Write-Host "Download from: https://nodejs.org/" -ForegroundColor Cyan
        return $false
    }
    
    # Check Node.js version
    try {
        $nodeVersionOutput = node --version
        $majorVersion = [int]($nodeVersionOutput.Substring(1).Split('.')[0])
        if ($majorVersion -lt 18) {
            Write-Host "${RED}Error: Node.js version 18 or higher is required. Current version: $nodeVersionOutput${NC}" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "${RED}Error: Failed to check Node.js version.${NC}" -ForegroundColor Red
        return $false
    }
    
    # Find the .tgz file
    $tgzPaths = @(
        ".\packages\mcp-host\roo-mcp-host-$VERSION.tgz",
        ".\roo-master-$VERSION\packages\mcp-host\roo-mcp-host-$VERSION.tgz",
        "$PSScriptRoot\..\packages\mcp-host\roo-mcp-host-$VERSION.tgz"
    )
    
    $TGZ_PATH = ""
    foreach ($path in $tgzPaths) {
        if (Test-Path $path -PathType Leaf) {
            $TGZ_PATH = $path
            break
        }
    }
    
    if ([string]::IsNullOrEmpty($TGZ_PATH)) {
        Write-Host "${YELLOW}MCP host server package not found. Installing from npm registry...${NC}" -ForegroundColor Yellow
        # Try to install from npm registry
        try {
            if (Test-Command "pnpm") {
                pnpm install -g @roo/mcp-host
            } else {
                npm install -g @roo/mcp-host
            }
        } catch {
            Write-Host "${RED}Error: Failed to install MCP host server from npm registry.${NC}" -ForegroundColor Red
            return $false
        }
    } else {
        Write-Host "Installing from: $TGZ_PATH" -ForegroundColor Cyan
        # Install from local file
        try {
            if (Test-Command "pnpm") {
                pnpm install -g $TGZ_PATH
            } else {
                npm install -g $TGZ_PATH
            }
        } catch {
            Write-Host "${RED}Error: Failed to install MCP host server from local file.${NC}" -ForegroundColor Red
            return $false
        }
    }
    
    if (Test-Command "roo-mcp-host") {
        Write-Host "${GREEN}MCP host server installed successfully.${NC}" -ForegroundColor Green
        Write-Host "Run 'roo-mcp-host' to start the server." -ForegroundColor Cyan
        return $true
    } else {
        Write-Host "${RED}Error: Failed to install MCP host server.${NC}" -ForegroundColor Red
        return $false
    }
}

# Function to setup Docker image
function Setup-DockerImage {
    Write-Host "${YELLOW}Setting up Docker tool image...${NC}" -ForegroundColor Yellow
    
    if (-not (Test-Command "docker")) {
        Write-Host "${RED}Error: Docker is not installed. Please install Docker first.${NC}" -ForegroundColor Red
        Write-Host "Download from: https://www.docker.com/get-started" -ForegroundColor Cyan
        return $false
    }
    
    # Check if Docker is running
    try {
        $null = docker info 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "${RED}Error: Docker is not running. Please start Docker.${NC}" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "${RED}Error: Docker is not running. Please start Docker.${NC}" -ForegroundColor Red
        return $false
    }
    
    # Check if image exists locally
    $dockerImages = docker images --format "{{.Repository}}:{{.Tag}}"
    if ($dockerImages -match "roo-master/tool-image:$VERSION") {
        Write-Host "${GREEN}Docker image is already available locally.${NC}" -ForegroundColor Green
        return $true
    }
    
    # Try to pull from registry
    Write-Host "Attempting to pull image from registry..." -ForegroundColor Cyan
    try {
        $null = docker pull "roo-master/tool-image:$VERSION" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "${GREEN}Docker image pulled successfully.${NC}" -ForegroundColor Green
            return $true
        }
    } catch {
        # Continue to build from source
    }
    
    # Find the Dockerfile
    $dockerfilePaths = @(
        ".\packages\tool-image\Dockerfile",
        ".\roo-master-$VERSION\packages\tool-image\Dockerfile",
        "$PSScriptRoot\..\packages\tool-image\Dockerfile"
    )
    
    $DOCKERFILE_PATH = ""
    foreach ($path in $dockerfilePaths) {
        if (Test-Path $path -PathType Leaf) {
            $DOCKERFILE_PATH = $path
            break
        }
    }
    
    if ([string]::IsNullOrEmpty($DOCKERFILE_PATH)) {
        Write-Host "${YELLOW}Dockerfile not found. Please pull the image manually:${NC}" -ForegroundColor Yellow
        Write-Host "docker pull roo-master/tool-image:$VERSION" -ForegroundColor Cyan
        return $false
    }
    
    # Build the image
    Write-Host "Building Docker image..." -ForegroundColor Cyan
    $dockerfileDir = Split-Path $DOCKERFILE_PATH -Parent
    Push-Location $dockerfileDir
    try {
        $null = docker build -t "roo-master/tool-image:$VERSION" .
        if ($LASTEXITCODE -eq 0) {
            Write-Host "${GREEN}Docker image built successfully.${NC}" -ForegroundColor Green
            return $true
        } else {
            Write-Host "${RED}Error: Failed to build Docker image.${NC}" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "${RED}Error: Failed to build Docker image: $_${NC}" -ForegroundColor Red
        return $false
    } finally {
        Pop-Location
    }
}

# Main installation process
function Main {
    Write-Host ""
    Write-Host "This script will install the following components:" -ForegroundColor Cyan
    Write-Host "1. VS Code Extension" -ForegroundColor Cyan
    Write-Host "2. MCP Host Server" -ForegroundColor Cyan
    Write-Host "3. Docker Tool Image" -ForegroundColor Cyan
    Write-Host ""
    
    if (-not $Force) {
        $response = Read-Host "Do you want to continue? (y/N)"
        if ($response -ne "y" -and $response -ne "Y") {
            Write-Host "Installation cancelled." -ForegroundColor Yellow
            exit 0
        }
    }
    
    # Install components
    $INSTALL_ERRORS = 0
    
    if (-not (Install-VSCodeExtension)) {
        $INSTALL_ERRORS++
    }
    
    if (-not (Install-MCPHost)) {
        $INSTALL_ERRORS++
    }
    
    if (-not (Setup-DockerImage)) {
        $INSTALL_ERRORS++
    }
    
    # Summary
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Yellow
    if ($INSTALL_ERRORS -eq 0) {
        Write-Host "${GREEN}All components installed successfully!${NC}" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "1. Start VS Code and use the Roo Master extension" -ForegroundColor Cyan
        Write-Host "2. Run 'roo-mcp-host' to start the MCP server" -ForegroundColor Cyan
        Write-Host "3. Use 'docker run -it roo-master/tool-image:$VERSION' to run the tool container" -ForegroundColor Cyan
    } else {
        Write-Host "${RED}Installation completed with $INSTALL_ERRORS error(s).${NC}" -ForegroundColor Red
        Write-Host "Please review the error messages above and try again." -ForegroundColor Yellow
        exit 1
    }
}

# Run main function
Main