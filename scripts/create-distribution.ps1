# Roo Master Distribution Archive Creation Script for Windows CI
# This script creates a distribution archive containing all components

param(
    [string]$Version = "1.0.0",
    [switch]$Force = $false
)

$VERSION = $Version
$DIST_NAME = "roo-master-$Version"
$DIST_FILE = "$DIST_NAME-distribution.zip"

# Check if running in CI environment
$CI = if ($env:CI -eq "true") { $true } else { $false }

# Colors for output (Windows 10+ supports ANSI escape codes)
$GREEN = "`e[0;32m"
$RED = "`e[0;31m"
$YELLOW = "`e[1;33m"
$NC = "`e[0m" # No Color

Write-Host "${GREEN}Roo Master Distribution Archive Creation Script v$VERSION${NC}" -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Yellow

# Function to check if required files exist
function Check-Files {
    Write-Host "${YELLOW}Checking for required files...${NC}" -ForegroundColor Yellow
    
    $errors = 0
    
    # Check VS Code extension
    if (-not (Test-Path "packages\vscode-ext\roo-master-$Version.vsix" -PathType Leaf)) {
        Write-Host "${RED}Error: VS Code extension package not found.${NC}" -ForegroundColor Red
        Write-Host "Expected: packages\vscode-ext\roo-master-$Version.vsix" -ForegroundColor Cyan
        $errors++
    }
    
    # Check MCP host server
    if (-not (Test-Path "packages\mcp-host\roo-mcp-host-$Version.tgz" -PathType Leaf)) {
        Write-Host "${RED}Error: MCP host server package not found.${NC}" -ForegroundColor Red
        Write-Host "Expected: packages\mcp-host\roo-mcp-host-$Version.tgz" -ForegroundColor Cyan
        $errors++
    }
    
    # Check Dockerfile
    if (-not (Test-Path "packages\tool-image\Dockerfile" -PathType Leaf)) {
        Write-Host "${RED}Error: Dockerfile not found.${NC}" -ForegroundColor Red
        Write-Host "Expected: packages\tool-image\Dockerfile" -ForegroundColor Cyan
        $errors++
    }
    
    # Check installation scripts
    if (-not (Test-Path "scripts\install.sh" -PathType Leaf)) {
        Write-Host "${RED}Error: Linux/macOS installation script not found.${NC}" -ForegroundColor Red
        Write-Host "Expected: scripts\install.sh" -ForegroundColor Cyan
        $errors++
    }
    
    if (-not (Test-Path "scripts\install.ps1" -PathType Leaf)) {
        Write-Host "${RED}Error: Windows installation script not found.${NC}" -ForegroundColor Red
        Write-Host "Expected: scripts\install.ps1" -ForegroundColor Cyan
        $errors++
    }
    
    # Check distribution guide
    if (-not (Test-Path "docs\DISTRIBUTION.md" -PathType Leaf)) {
        Write-Host "${RED}Error: Distribution guide not found.${NC}" -ForegroundColor Red
        Write-Host "Expected: docs\DISTRIBUTION.md" -ForegroundColor Cyan
        $errors++
    }
    
    # Check LICENSE file
    if (-not (Test-Path "LICENSE" -PathType Leaf)) {
        Write-Host "${RED}Error: LICENSE file not found.${NC}" -ForegroundColor Red
        Write-Host "Expected: LICENSE" -ForegroundColor Cyan
        $errors++
    }
    
    if ($errors -gt 0) {
        Write-Host "${RED}Total errors: $errors${NC}" -ForegroundColor Red
        Write-Host "Please ensure all required files are present before creating the distribution." -ForegroundColor Yellow
        if (-not $Force) {
            exit 1
        }
    }
    
    Write-Host "${GREEN}All required files found.${NC}" -ForegroundColor Green
}

# Create temporary directory
function Create-TempDir {
    Write-Host "${YELLOW}Creating temporary directory...${NC}" -ForegroundColor Yellow
    
    $TEMP_DIR = Join-Path $env:TEMP "roo-master-dist-$([System.Guid]::NewGuid().ToString())"
    $DIST_DIR = Join-Path $TEMP_DIR $DIST_NAME
    
    New-Item -ItemType Directory -Path $DIST_DIR -Force | Out-Null
    
    Write-Host "Temporary directory created: $TEMP_DIR" -ForegroundColor Cyan
    
    return $TEMP_DIR
}

# Copy files to distribution directory
function Copy-Files {
    param([string]$DIST_DIR)
    
    Write-Host "${YELLOW}Copying files to distribution directory...${NC}" -ForegroundColor Yellow
    
    # Create directory structure
    $vscodeExtDir = Join-Path $DIST_DIR "packages\vscode-ext"
    $mcpHostDir = Join-Path $DIST_DIR "packages\mcp-host"
    $toolImageDir = Join-Path $DIST_DIR "packages\tool-image"
    $scriptsDir = Join-Path $DIST_DIR "scripts"
    $docsDir = Join-Path $DIST_DIR "docs"
    
    New-Item -ItemType Directory -Path $vscodeExtDir -Force | Out-Null
    New-Item -ItemType Directory -Path $mcpHostDir -Force | Out-Null
    New-Item -ItemType Directory -Path $toolImageDir -Force | Out-Null
    New-Item -ItemType Directory -Path $scriptsDir -Force | Out-Null
    New-Item -ItemType Directory -Path $docsDir -Force | Out-Null
    
    # Copy package files
    Copy-Item "packages\vscode-ext\roo-master-$Version.vsix" $vscodeExtDir -Force
    Copy-Item "packages\mcp-host\roo-mcp-host-$Version.tgz" $mcpHostDir -Force
    Copy-Item "packages\tool-image\Dockerfile" $toolImageDir -Force
    Copy-Item "packages\tool-image\push-image.sh" $toolImageDir -Force
    Copy-Item "packages\tool-image\push-image.ps1" $toolImageDir -Force
    
    # Copy Docker image tarball if it exists
    if (Test-Path "packages\tool-image\roo-tool-image-$Version-windows-amd64.tar" -PathType Leaf) {
        Copy-Item "packages\tool-image\roo-tool-image-$Version-windows-amd64.tar" $toolImageDir -Force
        Write-Host "Docker image tarball copied: packages\tool-image\roo-tool-image-$Version-windows-amd64.tar" -ForegroundColor Cyan
    }
    
    # Copy scripts
    Copy-Item "scripts\install.sh" $scriptsDir -Force
    Copy-Item "scripts\install.ps1" $scriptsDir -Force
    Copy-Item "scripts\create-distribution.sh" $scriptsDir -Force
    Copy-Item "scripts\create-distribution.ps1" $scriptsDir -Force
    
    # Copy documentation
    Copy-Item "docs\DISTRIBUTION.md" $docsDir -Force
    
    # Copy LICENSE
    Copy-Item "LICENSE" $DIST_DIR -Force
    
    # Create README for distribution
    $readmeContent = @"
# Roo Master v$VERSION

This is the distribution package for Roo Master, containing all components needed for installation and setup.

## Included Components

1. **VS Code Extension** (`packages\vscode-ext\roo-master-$VERSION.vsix`)
   - AI-powered development orchestration within VS Code

2. **MCP Host Server** (`packages\mcp-host\roo-mcp-host-$VERSION.tgz`)
   - A standalone server for managing MCP connections

3. **Docker Tool Image** (`packages\tool-image\`)
   - Dockerfile and scripts for building the tool execution container

## Installation

### Quick Installation

Run the appropriate installation script for your platform:

- **Linux/macOS**: `./scripts/install.sh`
- **Windows**: `.\scripts\install.ps1`

### Manual Installation

For detailed installation instructions, see `docs\DISTRIBUTION.md`.

## Support

For issues, questions, or feedback, please visit:
- GitHub Issues: https://github.com/roo-master/roo-master/issues
- Documentation: https://github.com/roo-master/roo-master/wiki

## License

Roo Master is licensed under the MIT License. See the `LICENSE` file for details.
"@
    
    Set-Content -Path (Join-Path $DIST_DIR "README.md") -Value $readmeContent -Force
    
    Write-Host "Files copied successfully." -ForegroundColor Green
}

# Create archive
function Create-Archive {
    param(
        [string]$TEMP_DIR,
        [string]$DIST_FILE
    )
    
    Write-Host "${YELLOW}Creating distribution archive...${NC}" -ForegroundColor Yellow
    
    # Save current location
    $currentLocation = Get-Location
    
    try {
        # Change to temp directory
        Set-Location $TEMP_DIR
        
        # Create the ZIP archive
        if (Get-Command Compress-Archive -ErrorAction SilentlyContinue) {
            # PowerShell 5+ has Compress-Archive
            Compress-Archive -Path $DIST_NAME -DestinationPath $DIST_FILE -Force
        } else {
            # Fallback to .NET compression for older PowerShell versions
            Add-Type -AssemblyName "System.IO.Compression.FileSystem"
            [System.IO.Compression.ZipFile]::CreateFromDirectory($DIST_NAME, (Join-Path $currentLocation $DIST_FILE))
        }
        
        # Return to original directory
        Set-Location $currentLocation
        
        Write-Host "${GREEN}Distribution archive created: $DIST_FILE${NC}" -ForegroundColor Green
    }
    catch {
        Write-Host "${RED}Error creating archive: $_${NC}" -ForegroundColor Red
        Set-Location $currentLocation
        throw
    }
}

# Cleanup
function Cleanup {
    param([string]$TEMP_DIR)
    
    Write-Host "${YELLOW}Cleaning up temporary files...${NC}" -ForegroundColor Yellow
    
    if (Test-Path $TEMP_DIR) {
        Remove-Item -Path $TEMP_DIR -Recurse -Force
    }
    
    Write-Host "Cleanup completed." -ForegroundColor Green
}

# Calculate checksums
function Create-Checksums {
    param([string]$DIST_FILE)
    
    Write-Host "${YELLOW}Creating checksums...${NC}" -ForegroundColor Yellow
    
    # Create SHA256 checksum
    try {
        $sha256 = Get-FileHash -Path $DIST_FILE -Algorithm SHA256
        $sha256.Hash + " *" + $DIST_FILE | Out-File "$DIST_FILE.sha256" -Encoding ASCII
        
        # Create MD5 checksum
        $md5 = Get-FileHash -Path $DIST_FILE -Algorithm MD5
        $md5.Hash + " *" + $DIST_FILE | Out-File "$DIST_FILE.md5" -Encoding ASCII
        
        Write-Host "${GREEN}Checksums created:${NC}" -ForegroundColor Green
        Write-Host "SHA256: $DIST_FILE.sha256" -ForegroundColor Cyan
        Write-Host "MD5: $DIST_FILE.md5" -ForegroundColor Cyan
    }
    catch {
        Write-Host "${RED}Error creating checksums: $_${NC}" -ForegroundColor Red
    }
}

# Display archive information
function Display-Info {
    param([string]$DIST_FILE)
    
    $fileInfo = Get-Item $DIST_FILE
    
    Write-Host ""
    Write-Host "=========================================================" -ForegroundColor Yellow
    Write-Host "${GREEN}Distribution Archive Information${NC}" -ForegroundColor Green
    Write-Host "=========================================================" -ForegroundColor Yellow
    Write-Host "Archive file: $DIST_FILE" -ForegroundColor Cyan
    Write-Host "Archive size: $([math]::Round($fileInfo.Length / 1MB, 2)) MB" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Contents:" -ForegroundColor Cyan
    Write-Host "  - VS Code Extension: packages\vscode-ext\roo-master-$Version.vsix" -ForegroundColor Cyan
    Write-Host "  - MCP Host Server: packages\mcp-host\roo-mcp-host-$Version.tgz" -ForegroundColor Cyan
    Write-Host "  - Docker Image: packages\tool-image\" -ForegroundColor Cyan
    Write-Host "  - Installation Scripts: scripts\" -ForegroundColor Cyan
    Write-Host "  - Documentation: docs\" -ForegroundColor Cyan
    Write-Host "  - License: LICENSE" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Checksums:" -ForegroundColor Cyan
    if (Test-Path "$DIST_FILE.sha256") {
        Write-Host "  - SHA256: $DIST_FILE.sha256" -ForegroundColor Cyan
    }
    if (Test-Path "$DIST_FILE.md5") {
        Write-Host "  - MD5: $DIST_FILE.md5" -ForegroundColor Cyan
    }
    Write-Host ""
    Write-Host "To extract: Expand-Archive -Path $DIST_FILE" -ForegroundColor Cyan
    Write-Host "To install: cd $DIST_NAME ; .\scripts\install.ps1 (or ./scripts/install.sh on Linux/macOS)" -ForegroundColor Cyan
}

# Main function
function Main {
    # Check files
    Check-Files
    
    # Create temporary directory
    $TEMP_DIR = Create-TempDir
    $DIST_DIR = Join-Path $TEMP_DIR $DIST_NAME
    
    try {
        # Copy files
        Copy-Files -DIST_DIR $DIST_DIR
        
        # Create archive
        Create-Archive -TEMP_DIR $TEMP_DIR -DIST_FILE $DIST_FILE
        
        # Create checksums
        Create-Checksums -DIST_FILE $DIST_FILE
        
        # Display information
        Display-Info -DIST_FILE $DIST_FILE
        
        Write-Host ""
        Write-Host "${GREEN}Distribution archive created successfully!${NC}" -ForegroundColor Green
    }
    finally {
        # Cleanup
        Cleanup -TEMP_DIR $TEMP_DIR
    }
}

# Check if running in CI environment
if ($env:CI -eq "true") {
    $Force = $true
}

# Run main function
Main