# Roo Master Distribution Guide

This guide provides information on how to package, distribute, and install the Roo Master project components.

## Overview

The Roo Master project consists of three main components:

1. **VS Code Extension** (`packages/vscode-ext`) - Provides AI-powered development orchestration within VS Code
2. **MCP Host Server** (`packages/mcp-host`) - A standalone server for managing MCP connections
3. **Docker Tool Image** (`packages/tool-image`) - A Docker container for tool execution

## Package Files

### VS Code Extension

The VS Code extension is packaged as a `.vsix` file:

- **File**: `packages/vscode-ext/roo-master-1.0.0.vsix`
- **Size**: ~118.6 KB
- **Installation**: See [VS Code Extension Installation](#vs-code-extension-installation)

### MCP Host Server

The MCP host server is packaged as an npm tarball:

- **File**: `packages/mcp-host/roo-mcp-host-1.0.0.tgz`
- **Size**: ~4.5 KB
- **Installation**: See [MCP Host Server Installation](#mcp-host-server-installation)

### Docker Tool Image

The Docker tool image is available as a Docker image:

- **Image**: `roo-master/tool-image:1.0.0`
- **Size**: ~500 MB (compressed)
- **Registry**: Can be pushed to any Docker registry
- **Installation**: See [Docker Tool Image Installation](#docker-tool-image-installation)

## Installation Instructions

### VS Code Extension Installation

#### Method 1: Install from VSIX File

1. Open VS Code
2. Go to the Extensions view (Ctrl+Shift+X or Cmd+Shift+X)
3. Click the "..." menu in the Extensions view
4. Select "Install from VSIX..."
5. Navigate to and select the `roo-master-1.0.0.vsix` file
6. Wait for the installation to complete
7. Reload VS Code when prompted

#### Method 2: Install from VS Code Marketplace (when published)

1. Open VS Code
2. Go to the Extensions view (Ctrl+Shift+X or Cmd+Shift+X)
3. Search for "Roo Master"
4. Click "Install" on the extension published by "roo-master"

### MCP Host Server Installation

#### Prerequisites

- Node.js (version 18 or higher)
- npm or pnpm package manager

#### Method 1: Install from npm Tarball

1. Navigate to the directory containing `roo-mcp-host-1.0.0.tgz`
2. Run the following command:
   ```bash
   npm install -g roo-mcp-host-1.0.0.tgz
   ```
   Or using pnpm:
   ```bash
   pnpm install -g roo-mcp-host-1.0.0.tgz
   ```

#### Method 2: Install from npm Registry (when published)

1. Run the following command:
   ```bash
   npm install -g @roo/mcp-host
   ```
   Or using pnpm:
   ```bash
   pnpm install -g @roo/mcp-host
   ```

#### Starting the MCP Host Server

After installation, you can start the server with:

```bash
roo-mcp-host
```

Or if you installed it locally:

```bash
npx roo-mcp-host
```

### Docker Tool Image Installation

#### Prerequisites

- Docker (version 20.0.0 or higher)
- Docker daemon running

#### Method 1: Build from Source

1. Navigate to the `packages/tool-image` directory
2. Run the following command:
   ```bash
   docker build -t roo-master/tool-image:1.0.0 .
   ```

#### Method 2: Pull from Registry

1. Run the following command:
   ```bash
   docker pull roo-master/tool-image:1.0.0
   ```

#### Running the Docker Container

To run the container:

```bash
docker run -it --rm roo-master/tool-image:1.0.0
```

For more advanced usage with volume mounts:

```bash
docker run -it --rm \
  -v /path/to/your/workspace:/work \
  roo-master/tool-image:1.0.0
```

## Publishing Packages

### Publishing the VS Code Extension

#### To VS Code Marketplace

1. Create a publisher account on [VS Code Marketplace](https://marketplace.visualstudio.com/manage)
2. Install the vsce tool:
   ```bash
   npm install -g @vscode/vsce
   ```
3. Login to your publisher account:
   ```bash
   vsce login <publisher-name>
   ```
4. Publish the extension:
   ```bash
   cd packages/vscode-ext
   vsce publish
   ```

#### To Open VSX Registry

1. Create an account on [Open VSX](https://open-vsx.org/)
2. Install the ovsx tool:
   ```bash
   npm install -g @vscode/ovsx
   ```
3. Login to your account:
   ```bash
   ovsx login <pat>
   ```
4. Publish the extension:
   ```bash
   cd packages/vscode-ext
   ovsx publish
   ```

### Publishing the MCP Host Server

#### To npm Registry

1. Create an account on [npm](https://www.npmjs.com/)
2. Login to npm:
   ```bash
   npm login
   ```
3. Publish the package:
   ```bash
   cd packages/mcp-host
   npm publish
   ```

### Publishing the Docker Image

#### To Docker Hub

1. Create an account on [Docker Hub](https://hub.docker.com/)
2. Login to Docker:
   ```bash
   docker login
   ```
3. Tag and push the image:
   ```bash
   # Using the provided script
   cd packages/tool-image
   ./push-image.sh docker.io/your-username
   
   # Or manually
   docker tag roo-master/tool-image:1.0.0 your-username/tool-image:1.0.0
   docker push your-username/tool-image:1.0.0
   ```

#### To Other Registries

For AWS ECR, Google Container Registry, or other registries, use the appropriate scripts:

```bash
# For AWS ECR
./push-image.sh aws_account_id.dkr.ecr.region.amazonaws.com

# For Google Container Registry
./push-image.sh gcr.io/your-project-id
```

## Distribution Package

### Creating a Distribution Archive

To create a single archive containing all packages:

1. Navigate to the project root
2. Run the following script:
   ```bash
   # For Linux/macOS
   ./scripts/create-distribution.sh
   
   # For Windows
   .\scripts\create-distribution.ps1
   ```

This will create a `roo-master-1.0.0-distribution.tar.gz` file containing:
- VS Code extension (.vsix)
- MCP host server (.tgz)
- Docker image (as a tarball)
- Installation scripts
- Documentation

### Installing from Distribution Archive

1. Extract the archive:
   ```bash
   tar -xzf roo-master-1.0.0-distribution.tar.gz
   cd roo-master-1.0.0
   ```

2. Run the installation script:
   ```bash
   # For Linux/macOS
   ./install.sh
   
   # For Windows
   .\install.ps1
   ```

The installation script will guide you through installing all components.

## Version Management

### Version Numbers

All components use semantic versioning (major.minor.patch):

- **Current Version**: 1.0.0
- **Version Coordination**: All components should have the same version number

### Updating Versions

To update the version number:

1. Update the version in all package.json files:
   - `packages/vscode-ext/package.json`
   - `packages/mcp-host/package.json`
   - Root `package.json` (if exists)

2. Update any version references in:
   - Docker image tags
   - Documentation
   - Scripts

3. Rebuild and repackage all components:
   ```bash
   # From project root
   ./scripts/build-all.sh
   ```

## Support and Feedback

For issues, questions, or feedback:

- GitHub Issues: [https://github.com/roo-master/roo-master/issues](https://github.com/roo-master/roo-master/issues)
- Documentation: [https://github.com/roo-master/roo-master/wiki](https://github.com/roo-master/roo-master/wiki)
- Discussions: [https://github.com/roo-master/roo-master/discussions](https://github.com/roo-master/roo-master/discussions)

## License

Roo Master is licensed under the MIT License. See the [LICENSE](../LICENSE) file for details.