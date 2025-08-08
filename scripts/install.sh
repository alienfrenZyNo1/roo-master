#!/bin/bash

# Roo Master Installation Script for Linux/macOS
# This script installs all Roo Master components

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Version
VERSION="1.0.0"

echo -e "${GREEN}Roo Master Installation Script v${VERSION}${NC}"
echo "=========================================="

# Check if running on Linux or macOS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
else
    echo -e "${RED}Error: Unsupported operating system: $OSTYPE${NC}"
    exit 1
fi

echo -e "${YELLOW}Detected OS: $OS${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install VS Code extension
install_vscode_extension() {
    echo -e "${YELLOW}Installing VS Code extension...${NC}"
    
    if ! command_exists code; then
        echo -e "${RED}Error: VS Code is not installed. Please install VS Code first.${NC}"
        echo "Download from: https://code.visualstudio.com/"
        return 1
    fi
    
    # Check if the extension is already installed
    if code --list-extensions 2>/dev/null | grep -q "roo-master.roo-master"; then
        echo -e "${GREEN}VS Code extension is already installed.${NC}"
        return 0
    fi
    
    # Find the .vsix file
    VSIX_PATH=""
    for path in \
        "./packages/vscode-ext/roo-master-${VERSION}.vsix" \
        "./roo-master-${VERSION}/packages/vscode-ext/roo-master-${VERSION}.vsix" \
        "$(dirname "$0")/../packages/vscode-ext/roo-master-${VERSION}.vsix"; do
        if [[ -f "$path" ]]; then
            VSIX_PATH="$path"
            break
        fi
    done
    
    if [[ -z "$VSIX_PATH" ]]; then
        echo -e "${RED}Error: VS Code extension package not found.${NC}"
        echo "Please ensure the .vsix file is available."
        return 1
    fi
    
    # Install the extension
    echo "Installing from: $VSIX_PATH"
    if code --install-extension "$VSIX_PATH"; then
        echo -e "${GREEN}VS Code extension installed successfully.${NC}"
        return 0
    else
        echo -e "${RED}Error: Failed to install VS Code extension.${NC}"
        return 1
    fi
}

# Function to install MCP host server
install_mcp_host() {
    echo -e "${YELLOW}Installing MCP host server...${NC}"
    
    if ! command_exists node; then
        echo -e "${RED}Error: Node.js is not installed. Please install Node.js 18 or higher.${NC}"
        echo "Download from: https://nodejs.org/"
        return 1
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ "$NODE_VERSION" -lt 18 ]]; then
        echo -e "${RED}Error: Node.js version 18 or higher is required. Current version: $(node --version)${NC}"
        return 1
    fi
    
    # Find the .tgz file
    TGZ_PATH=""
    for path in \
        "./packages/mcp-host/roo-mcp-host-${VERSION}.tgz" \
        "./roo-master-${VERSION}/packages/mcp-host/roo-mcp-host-${VERSION}.tgz" \
        "$(dirname "$0")/../packages/mcp-host/roo-mcp-host-${VERSION}.tgz"; do
        if [[ -f "$path" ]]; then
            TGZ_PATH="$path"
            break
        fi
    done
    
    if [[ -z "$TGZ_PATH" ]]; then
        echo -e "${YELLOW}MCP host server package not found. Installing from npm registry...${NC}"
        # Try to install from npm registry
        if command_exists pnpm; then
            pnpm install -g @roo/mcp-host
        else
            npm install -g @roo/mcp-host
        fi
    else
        echo "Installing from: $TGZ_PATH"
        # Install from local file
        if command_exists pnpm; then
            pnpm install -g "$TGZ_PATH"
        else
            npm install -g "$TGZ_PATH"
        fi
    fi
    
    if command_exists roo-mcp-host; then
        echo -e "${GREEN}MCP host server installed successfully.${NC}"
        echo "Run 'roo-mcp-host' to start the server."
        return 0
    else
        echo -e "${RED}Error: Failed to install MCP host server.${NC}"
        return 1
    fi
}

# Function to setup Docker image
setup_docker_image() {
    echo -e "${YELLOW}Setting up Docker tool image...${NC}"
    
    if ! command_exists docker; then
        echo -e "${RED}Error: Docker is not installed. Please install Docker first.${NC}"
        echo "Download from: https://www.docker.com/get-started"
        return 1
    fi
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        echo -e "${RED}Error: Docker is not running. Please start Docker.${NC}"
        return 1
    fi
    
    # Check if image exists locally
    if docker images | grep -q "roo-master/tool-image" | grep -q "$VERSION"; then
        echo -e "${GREEN}Docker image is already available locally.${NC}"
        return 0
    fi
    
    # Try to pull from registry
    echo "Attempting to pull image from registry..."
    if docker pull "roo-master/tool-image:$VERSION" 2>/dev/null; then
        echo -e "${GREEN}Docker image pulled successfully.${NC}"
        return 0
    fi
    
    # Find the Dockerfile
    DOCKERFILE_PATH=""
    for path in \
        "./packages/tool-image/Dockerfile" \
        "./roo-master-${VERSION}/packages/tool-image/Dockerfile" \
        "$(dirname "$0")/../packages/tool-image/Dockerfile"; do
        if [[ -f "$path" ]]; then
            DOCKERFILE_PATH="$path"
            break
        fi
    done
    
    if [[ -z "$DOCKERFILE_PATH" ]]; then
        echo -e "${YELLOW}Dockerfile not found. Please pull the image manually:${NC}"
        echo "docker pull roo-master/tool-image:$VERSION"
        return 1
    fi
    
    # Build the image
    echo "Building Docker image..."
    cd "$(dirname "$DOCKERFILE_PATH")"
    if docker build -t "roo-master/tool-image:$VERSION" .; then
        echo -e "${GREEN}Docker image built successfully.${NC}"
        return 0
    else
        echo -e "${RED}Error: Failed to build Docker image.${NC}"
        return 1
    fi
}

# Main installation process
main() {
    echo ""
    echo "This script will install the following components:"
    echo "1. VS Code Extension"
    echo "2. MCP Host Server"
    echo "3. Docker Tool Image"
    echo ""
    
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation cancelled."
        exit 0
    fi
    
    # Install components
    INSTALL_ERRORS=0
    
    if ! install_vscode_extension; then
        ((INSTALL_ERRORS++))
    fi
    
    if ! install_mcp_host; then
        ((INSTALL_ERRORS++))
    fi
    
    if ! setup_docker_image; then
        ((INSTALL_ERRORS++))
    fi
    
    # Summary
    echo ""
    echo "=========================================="
    if [[ $INSTALL_ERRORS -eq 0 ]]; then
        echo -e "${GREEN}All components installed successfully!${NC}"
        echo ""
        echo "Next steps:"
        echo "1. Start VS Code and use the Roo Master extension"
        echo "2. Run 'roo-mcp-host' to start the MCP server"
        echo "3. Use 'docker run -it roo-master/tool-image:$VERSION' to run the tool container"
    else
        echo -e "${RED}Installation completed with $INSTALL_ERRORS error(s).${NC}"
        echo "Please review the error messages above and try again."
        exit 1
    fi
}

# Run main function
main "$@"