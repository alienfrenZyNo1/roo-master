#!/bin/bash

# Roo Master Distribution Archive Creation Script
# This script creates a distribution archive containing all components

set -e

# Version
VERSION=${1:-"1.0.0"}
DIST_NAME="roo-master-${VERSION}"
DIST_FILE="${DIST_NAME}-distribution.tar.gz"

# Check if running in CI environment
CI=${CI:-false}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Roo Master Distribution Archive Creation Script v${VERSION}${NC}"
echo "========================================================"

# Check if required files exist
check_files() {
    echo -e "${YELLOW}Checking for required files...${NC}"
    
    local errors=0
    
    # Check VS Code extension
    if [[ ! -f "packages/vscode-ext/roo-master-${VERSION}.vsix" ]]; then
        echo -e "${RED}Error: VS Code extension package not found.${NC}"
        echo "Expected: packages/vscode-ext/roo-master-${VERSION}.vsix"
        ((errors++))
    fi
    
    # Check MCP host server
    if [[ ! -f "packages/mcp-host/roo-mcp-host-${VERSION}.tgz" ]]; then
        echo -e "${RED}Error: MCP host server package not found.${NC}"
        echo "Expected: packages/mcp-host/roo-mcp-host-${VERSION}.tgz"
        ((errors++))
    fi
    
    # Check Dockerfile
    if [[ ! -f "packages/tool-image/Dockerfile" ]]; then
        echo -e "${RED}Error: Dockerfile not found.${NC}"
        echo "Expected: packages/tool-image/Dockerfile"
        ((errors++))
    fi
    
    # Check installation scripts
    if [[ ! -f "scripts/install.sh" ]]; then
        echo -e "${RED}Error: Linux/macOS installation script not found.${NC}"
        echo "Expected: scripts/install.sh"
        ((errors++))
    fi
    
    if [[ ! -f "scripts/install.ps1" ]]; then
        echo -e "${RED}Error: Windows installation script not found.${NC}"
        echo "Expected: scripts/install.ps1"
        ((errors++))
    fi
    
    # Check distribution guide
    if [[ ! -f "docs/DISTRIBUTION.md" ]]; then
        echo -e "${RED}Error: Distribution guide not found.${NC}"
        echo "Expected: docs/DISTRIBUTION.md"
        ((errors++))
    fi
    
    # Check LICENSE file
    if [[ ! -f "LICENSE" ]]; then
        echo -e "${RED}Error: LICENSE file not found.${NC}"
        echo "Expected: LICENSE"
        ((errors++))
    fi
    
    if [[ $errors -gt 0 ]]; then
        echo -e "${RED}Total errors: $errors${NC}"
        echo "Please ensure all required files are present before creating the distribution."
        exit 1
    fi
    
    echo -e "${GREEN}All required files found.${NC}"
}

# Create temporary directory
create_temp_dir() {
    echo -e "${YELLOW}Creating temporary directory...${NC}"
    
    TEMP_DIR=$(mktemp -d)
    DIST_DIR="${TEMP_DIR}/${DIST_NAME}"
    
    mkdir -p "${DIST_DIR}"
    
    echo "Temporary directory created: ${TEMP_DIR}"
}

# Copy files to distribution directory
copy_files() {
    echo -e "${YELLOW}Copying files to distribution directory...${NC}"
    
    # Create directory structure
    mkdir -p "${DIST_DIR}/packages/vscode-ext"
    mkdir -p "${DIST_DIR}/packages/mcp-host"
    mkdir -p "${DIST_DIR}/packages/tool-image"
    mkdir -p "${DIST_DIR}/scripts"
    mkdir -p "${DIST_DIR}/docs"
    
    # Copy package files
    cp "packages/vscode-ext/roo-master-${VERSION}.vsix" "${DIST_DIR}/packages/vscode-ext/"
    cp "packages/mcp-host/roo-mcp-host-${VERSION}.tgz" "${DIST_DIR}/packages/mcp-host/"
    cp "packages/tool-image/Dockerfile" "${DIST_DIR}/packages/tool-image/"
    cp "packages/tool-image/push-image.sh" "${DIST_DIR}/packages/tool-image/"
    cp "packages/tool-image/push-image.ps1" "${DIST_DIR}/packages/tool-image/"
    
    # Check if Docker image tarball exists and copy it
    if [[ -f "packages/tool-image/roo-tool-image-${VERSION}-linux-amd64.tar.gz" ]]; then
        cp "packages/tool-image/roo-tool-image-${VERSION}-linux-amd64.tar.gz" "${DIST_DIR}/packages/tool-image/"
        echo "Docker image tarball copied: packages/tool-image/roo-tool-image-${VERSION}-linux-amd64.tar.gz"
    fi
    
    if [[ -f "packages/tool-image/roo-tool-image-${VERSION}-darwin-amd64.tar.gz" ]]; then
        cp "packages/tool-image/roo-tool-image-${VERSION}-darwin-amd64.tar.gz" "${DIST_DIR}/packages/tool-image/"
        echo "Docker image tarball copied: packages/tool-image/roo-tool-image-${VERSION}-darwin-amd64.tar.gz"
    fi
    
    if [[ -f "packages/tool-image/roo-tool-image-${VERSION}-windows-amd64.tar.gz" ]]; then
        cp "packages/tool-image/roo-tool-image-${VERSION}-windows-amd64.tar.gz" "${DIST_DIR}/packages/tool-image/"
        echo "Docker image tarball copied: packages/tool-image/roo-tool-image-${VERSION}-windows-amd64.tar.gz"
    fi
    
    # Copy scripts
    cp "scripts/install.sh" "${DIST_DIR}/scripts/"
    cp "scripts/install.ps1" "${DIST_DIR}/scripts/"
    cp "scripts/create-distribution.sh" "${DIST_DIR}/scripts/"
    
    # Copy documentation
    cp "docs/DISTRIBUTION.md" "${DIST_DIR}/docs/"
    
    # Copy LICENSE
    cp "LICENSE" "${DIST_DIR}/"
    
    # Create README for distribution
    cat > "${DIST_DIR}/README.md" << EOF
# Roo Master v${VERSION}

This is the distribution package for Roo Master, containing all components needed for installation and setup.

## Included Components

1. **VS Code Extension** (\`packages/vscode-ext/roo-master-${VERSION}.vsix\`)
   - AI-powered development orchestration within VS Code

2. **MCP Host Server** (\`packages/mcp-host/roo-mcp-host-${VERSION}.tgz\`)
   - A standalone server for managing MCP connections

3. **Docker Tool Image** (\`packages/tool-image/\`)
   - Dockerfile and scripts for building the tool execution container

## Installation

### Quick Installation

Run the appropriate installation script for your platform:

- **Linux/macOS**: \`./scripts/install.sh\`
- **Windows**: \`.\scripts\install.ps1\`

### Manual Installation

For detailed installation instructions, see \`docs/DISTRIBUTION.md\`.

## Support

For issues, questions, or feedback, please visit:
- GitHub Issues: https://github.com/roo-master/roo-master/issues
- Documentation: https://github.com/roo-master/roo-master/wiki

## License

Roo Master is licensed under the MIT License. See the \`LICENSE\` file for details.
EOF
    
    echo "Files copied successfully."
}

# Create archive
create_archive() {
    echo -e "${YELLOW}Creating distribution archive...${NC}"
    
    # Change to temp directory
    cd "${TEMP_DIR}"
    
    # Create the archive
    tar -czf "${DIST_FILE}" "${DIST_NAME}/"
    
    # Move the archive to the original directory
    mv "${DIST_FILE}" "${OLDPWD}/"
    
    # Return to original directory
    cd "${OLDPWD}"
    
    echo -e "${GREEN}Distribution archive created: ${DIST_FILE}${NC}"
}

# Cleanup
cleanup() {
    echo -e "${YELLOW}Cleaning up temporary files...${NC}"
    
    if [[ -n "${TEMP_DIR}" && -d "${TEMP_DIR}" ]]; then
        rm -rf "${TEMP_DIR}"
    fi
    
    echo "Cleanup completed."
}

# Calculate checksums
create_checksums() {
    echo -e "${YELLOW}Creating checksums...${NC}"
    
    # Create SHA256 checksum
    if [[ "$OSTYPE" == "darwin"* ]]; then
        shasum -a 256 "${DIST_FILE}" > "${DIST_FILE}.sha256"
    else
        sha256sum "${DIST_FILE}" > "${DIST_FILE}.sha256"
    fi
    
    # Create MD5 checksum
    if [[ "$OSTYPE" == "darwin"* ]]; then
        md5 "${DIST_FILE}" > "${DIST_FILE}.md5"
    else
        md5sum "${DIST_FILE}" > "${DIST_FILE}.md5"
    fi
    
    echo -e "${GREEN}Checksums created:${NC}"
    echo "SHA256: ${DIST_FILE}.sha256"
    echo "MD5: ${DIST_FILE}.md5"
}

# Display archive information
display_info() {
    echo ""
    echo "========================================================"
    echo -e "${GREEN}Distribution Archive Information${NC}"
    echo "========================================================"
    echo "Archive file: ${DIST_FILE}"
    echo "Archive size: $(du -h "${DIST_FILE}" | cut -f1)"
    echo ""
    echo "Contents:"
    echo "  - VS Code Extension: packages/vscode-ext/roo-master-${VERSION}.vsix"
    echo "  - MCP Host Server: packages/mcp-host/roo-mcp-host-${VERSION}.tgz"
    echo "  - Docker Image: packages/tool-image/"
    echo "  - Installation Scripts: scripts/"
    echo "  - Documentation: docs/"
    echo "  - License: LICENSE"
    echo ""
    echo "Checksums:"
    echo "  - SHA256: ${DIST_FILE}.sha256"
    echo "  - MD5: ${DIST_FILE}.md5"
    echo ""
    echo "To extract: tar -xzf ${DIST_FILE}"
    echo "To install: cd ${DIST_NAME} && ./scripts/install.sh (or .\\scripts\\install.ps1 on Windows)"
}

# Main function
main() {
    # Check files
    check_files
    
    # Create temporary directory
    create_temp_dir
    
    # Copy files
    copy_files
    
    # Create archive
    create_archive
    
    # Create checksums
    create_checksums
    
    # Display information
    display_info
    
    # Cleanup
    cleanup
    
    echo ""
    echo -e "${GREEN}Distribution archive created successfully!${NC}"
}

# Run main function
main "$@"