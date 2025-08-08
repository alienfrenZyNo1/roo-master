# Roo Master Build All Script for Windows
# This script builds all components of the Roo Master project

param(
    [switch]$Force = $false
)

# Version
$VERSION = "1.0.0"

# Colors for output (Windows 10+ supports ANSI escape codes)
$GREEN = "`e[0;32m"
$RED = "`e[0;31m"
$YELLOW = "`e[1;33m"
$BLUE = "`e[0;34m"
$NC = "`e[0m" # No Color

Write-Host "${GREEN}Roo Master Build All Script v$VERSION${NC}" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Yellow

# Function to build VS Code extension
function Build-VSCodeExtension {
    Write-Host "${BLUE}Building VS Code extension...${NC}" -ForegroundColor Blue
    
    Push-Location "packages\vscode-ext"
    
    try {
        # Install dependencies
        if (Test-Path "package.json" -PathType Leaf) {
            Write-Host "Installing dependencies..." -ForegroundColor Cyan
            npm install
        }
        
        # Build the extension
        Write-Host "Running build..." -ForegroundColor Cyan
        npm run compile
        
        # Package the extension
        Write-Host "Creating VSIX package..." -ForegroundColor Cyan
        vsce package
        
        if (Test-Path "roo-master-$VERSION.vsix" -PathType Leaf) {
            Write-Host "${GREEN}VS Code extension built successfully: roo-master-$VERSION.vsix${NC}" -ForegroundColor Green
        } else {
            Write-Host "${RED}Error: VS Code extension build failed${NC}" -ForegroundColor Red
            exit 1
        }
    }
    finally {
        Pop-Location
    }
}

# Function to build MCP host server
function Build-MCPHost {
    Write-Host "${BLUE}Building MCP host server...${NC}" -ForegroundColor Blue
    
    Push-Location "packages\mcp-host"
    
    try {
        # Install dependencies
        if (Test-Path "package.json" -PathType Leaf) {
            Write-Host "Installing dependencies..." -ForegroundColor Cyan
            npm install
        }
        
        # Build the project
        Write-Host "Running build..." -ForegroundColor Cyan
        npm run build
        
        # Create package
        Write-Host "Creating npm package..." -ForegroundColor Cyan
        npm pack
        
        if (Test-Path "roo-mcp-host-$VERSION.tgz" -PathType Leaf) {
            Write-Host "${GREEN}MCP host server built successfully: roo-mcp-host-$VERSION.tgz${NC}" -ForegroundColor Green
        } else {
            Write-Host "${RED}Error: MCP host server build failed${NC}" -ForegroundColor Red
            exit 1
        }
    }
    finally {
        Pop-Location
    }
}

# Function to build Docker image
function Build-DockerImage {
    Write-Host "${BLUE}Building Docker tool image...${NC}" -ForegroundColor Blue
    
    Push-Location "packages\tool-image"
    
    try {
        # Build the Docker image
        Write-Host "Building Docker image..." -ForegroundColor Cyan
        $result = docker build -t "roo-master/tool-image:$VERSION" .
        if ($LASTEXITCODE -eq 0) {
            Write-Host "${GREEN}Docker image built successfully: roo-master/tool-image:$VERSION${NC}" -ForegroundColor Green
        } else {
            Write-Host "${RED}Error: Docker image build failed${NC}" -ForegroundColor Red
            exit 1
        }
    }
    finally {
        Pop-Location
    }
}

# Function to create distribution package
function Create-Distribution {
    Write-Host "${BLUE}Creating distribution package...${NC}" -ForegroundColor Blue
    
    if (Test-Path "scripts\create-distribution.ps1" -PathType Leaf) {
        & .\scripts\create-distribution.ps1 -Force:$Force
    } else {
        Write-Host "${YELLOW}Distribution package script not found. Skipping...${NC}" -ForegroundColor Yellow
    }
}

# Function to display build summary
function Display-Summary {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Yellow
    Write-Host "${GREEN}Build Summary${NC}" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Yellow
    
    # VS Code Extension
    if (Test-Path "packages\vscode-ext\roo-master-$VERSION.vsix" -PathType Leaf) {
        Write-Host "${GREEN}✓${NC} VS Code Extension: packages\vscode-ext\roo-master-$VERSION.vsix" -ForegroundColor Green
    } else {
        Write-Host "${RED}✗${NC} VS Code Extension: Build failed" -ForegroundColor Red
    }
    
    # MCP Host Server
    if (Test-Path "packages\mcp-host\roo-mcp-host-$VERSION.tgz" -PathType Leaf) {
        Write-Host "${GREEN}✓${NC} MCP Host Server: packages\mcp-host\roo-mcp-host-$VERSION.tgz" -ForegroundColor Green
    } else {
        Write-Host "${RED}✗${NC} MCP Host Server: Build failed" -ForegroundColor Red
    }
    
    # Docker Image
    $dockerImages = docker images --format "{{.Repository}}:{{.Tag}}"
    if ($dockerImages -match "roo-master/tool-image:$VERSION") {
        Write-Host "${GREEN}✓${NC} Docker Image: roo-master/tool-image:$VERSION" -ForegroundColor Green
    } else {
        Write-Host "${RED}✗${NC} Docker Image: Build failed" -ForegroundColor Red
    }
    
    # Distribution Package
    if (Test-Path "roo-master-$VERSION-distribution.zip" -PathType Leaf) {
        Write-Host "${GREEN}✓${NC} Distribution Package: roo-master-$VERSION-distribution.zip" -ForegroundColor Green
    } else {
        Write-Host "${YELLOW}⚠${NC} Distribution Package: Not created" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "${BLUE}Next steps:${NC}" -ForegroundColor Blue
    Write-Host "1. Test the components individually" -ForegroundColor Cyan
    Write-Host "2. Run the installation scripts to verify they work" -ForegroundColor Cyan
    Write-Host "3. Create a distribution package for release" -ForegroundColor Cyan
    Write-Host "4. Publish components to their respective registries" -ForegroundColor Cyan
}

# Main function
function Main {
    Write-Host "This script will build all components of Roo Master:" -ForegroundColor Cyan
    Write-Host "1. VS Code Extension" -ForegroundColor Cyan
    Write-Host "2. MCP Host Server" -ForegroundColor Cyan
    Write-Host "3. Docker Tool Image" -ForegroundColor Cyan
    Write-Host "4. Distribution Package" -ForegroundColor Cyan
    Write-Host ""
    
    if (-not $Force) {
        $response = Read-Host "Do you want to continue? (y/N)"
        if ($response -ne "y" -and $response -ne "Y") {
            Write-Host "Build cancelled." -ForegroundColor Yellow
            exit 0
        }
    }
    
    # Build components
    Build-VSCodeExtension
    Build-MCPHost
    Build-DockerImage
    Create-Distribution
    
    # Display summary
    Display-Summary
    
    Write-Host ""
    Write-Host "${GREEN}All components built successfully!${NC}" -ForegroundColor Green
}

# Function to check for required tools
function Check-Requirements {
    Write-Host "${BLUE}Checking requirements...${NC}" -ForegroundColor Blue
    
    # Check Node.js
    if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
        Write-Host "${RED}Error: Node.js is not installed.${NC}" -ForegroundColor Red
        exit 1
    }
    
    # Check npm
    if (-not (Get-Command "npm" -ErrorAction SilentlyContinue)) {
        Write-Host "${RED}Error: npm is not installed.${NC}" -ForegroundColor Red
        exit 1
    }
    
    # Check Docker
    if (-not (Get-Command "docker" -ErrorAction SilentlyContinue)) {
        Write-Host "${RED}Error: Docker is not installed.${NC}" -ForegroundColor Red
        exit 1
    }
    
    # Check if Docker is running
    try {
        $null = docker info 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "${RED}Error: Docker is not running.${NC}" -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host "${RED}Error: Docker is not running.${NC}" -ForegroundColor Red
        exit 1
    }
    
    # Check vsce
    if (-not (Get-Command "vsce" -ErrorAction SilentlyContinue)) {
        Write-Host "${YELLOW}Warning: vsce is not installed. VS Code extension packaging will fail.${NC}" -ForegroundColor Yellow
        Write-Host "Install with: npm install -g @vscode/vsce" -ForegroundColor Cyan
    }
    
    Write-Host "${GREEN}All requirements met.${NC}" -ForegroundColor Green
}

# Run checks
Check-Requirements

# Run main function
Main