#!/bin/bash

# Roo Master Build All Script
# This script builds all components of the Roo Master project

set -e

# Version
VERSION="1.0.0"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}Roo Master Build All Script v${VERSION}${NC}"
echo "============================================"

# Function to build VS Code extension
build_vscode_extension() {
    echo -e "${BLUE}Building VS Code extension...${NC}"
    
    cd packages/vscode-ext
    
    # Install dependencies
    if [[ -f "package.json" ]]; then
        echo "Installing dependencies..."
        npm install
    fi
    
    # Build the extension
    echo "Running build..."
    npm run compile
    
    # Package the extension
    echo "Creating VSIX package..."
    vsce package
    
    if [[ -f "roo-master-${VERSION}.vsix" ]]; then
        echo -e "${GREEN}VS Code extension built successfully: roo-master-${VERSION}.vsix${NC}"
    else
        echo -e "${RED}Error: VS Code extension build failed${NC}"
        exit 1
    fi
    
    cd ../..
}

# Function to build MCP host server
build_mcp_host() {
    echo -e "${BLUE}Building MCP host server...${NC}"
    
    cd packages/mcp-host
    
    # Install dependencies
    if [[ -f "package.json" ]]; then
        echo "Installing dependencies..."
        npm install
    fi
    
    # Build the project
    echo "Running build..."
    npm run build
    
    # Create package
    echo "Creating npm package..."
    npm pack
    
    if [[ -f "roo-mcp-host-${VERSION}.tgz" ]]; then
        echo -e "${GREEN}MCP host server built successfully: roo-mcp-host-${VERSION}.tgz${NC}"
    else
        echo -e "${RED}Error: MCP host server build failed${NC}"
        exit 1
    fi
    
    cd ../..
}

# Function to build Docker image
build_docker_image() {
    echo -e "${BLUE}Building Docker tool image...${NC}"
    
    cd packages/tool-image
    
    # Build the Docker image
    echo "Building Docker image..."
    if docker build -t "roo-master/tool-image:${VERSION}" .; then
        echo -e "${GREEN}Docker image built successfully: roo-master/tool-image:${VERSION}${NC}"
    else
        echo -e "${RED}Error: Docker image build failed${NC}"
        exit 1
    fi
    
    cd ../..
}

# Function to create distribution package
create_distribution() {
    echo -e "${BLUE}Creating distribution package...${NC}"
    
    if [[ -f "scripts/create-distribution.sh" ]]; then
        chmod +x scripts/create-distribution.sh
        ./scripts/create-distribution.sh
    else
        echo -e "${YELLOW}Distribution package script not found. Skipping...${NC}"
    fi
}

# Function to display build summary
display_summary() {
    echo ""
    echo "============================================"
    echo -e "${GREEN}Build Summary${NC}"
    echo "============================================"
    
    # VS Code Extension
    if [[ -f "packages/vscode-ext/roo-master-${VERSION}.vsix" ]]; then
        echo -e "${GREEN}✓${NC} VS Code Extension: packages/vscode-ext/roo-master-${VERSION}.vsix"
    else
        echo -e "${RED}✗${NC} VS Code Extension: Build failed"
    fi
    
    # MCP Host Server
    if [[ -f "packages/mcp-host/roo-mcp-host-${VERSION}.tgz" ]]; then
        echo -e "${GREEN}✓${NC} MCP Host Server: packages/mcp-host/roo-mcp-host-${VERSION}.tgz"
    else
        echo -e "${RED}✗${NC} MCP Host Server: Build failed"
    fi
    
    # Docker Image
    if docker images | grep -q "roo-master/tool-image" | grep -q "${VERSION}"; then
        echo -e "${GREEN}✓${NC} Docker Image: roo-master/tool-image:${VERSION}"
    else
        echo -e "${RED}✗${NC} Docker Image: Build failed"
    fi
    
    # Distribution Package
    if [[ -f "roo-master-${VERSION}-distribution.tar.gz" ]]; then
        echo -e "${GREEN}✓${NC} Distribution Package: roo-master-${VERSION}-distribution.tar.gz"
    else
        echo -e "${YELLOW}⚠${NC} Distribution Package: Not created"
    fi
    
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Test the components individually"
    echo "2. Run the installation scripts to verify they work"
    echo "3. Create a distribution package for release"
    echo "4. Publish components to their respective registries"
}

# Main function
main() {
    echo "This script will build all components of Roo Master:"
    echo "1. VS Code Extension"
    echo "2. MCP Host Server"
    echo "3. Docker Tool Image"
    echo "4. Distribution Package"
    echo ""
    
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Build cancelled."
        exit 0
    fi
    
    # Build components
    build_vscode_extension
    build_mcp_host
    build_docker_image
    create_distribution
    
    # Display summary
    display_summary
    
    echo ""
    echo -e "${GREEN}All components built successfully!${NC}"
}

# Check for required tools
check_requirements() {
    echo -e "${BLUE}Checking requirements...${NC}"
    
    # Check Node.js
    if ! command -v node >/dev/null 2>&1; then
        echo -e "${RED}Error: Node.js is not installed.${NC}"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm >/dev/null 2>&1; then
        echo -e "${RED}Error: npm is not installed.${NC}"
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker >/dev/null 2>&1; then
        echo -e "${RED}Error: Docker is not installed.${NC}"
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        echo -e "${RED}Error: Docker is not running.${NC}"
        exit 1
    fi
    
    # Check vsce
    if ! command -v vsce >/dev/null 2>&1; then
        echo -e "${YELLOW}Warning: vsce is not installed. VS Code extension packaging will fail.${NC}"
        echo "Install with: npm install -g @vscode/vsce"
    fi
    
    echo -e "${GREEN}All requirements met.${NC}"
}

# Run checks
check_requirements

# Run main function
main "$@"