# Roo Master

[![Version](https://img.shields.io/badge/version-0.0.24-blue.svg)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](#installation)

Roo Master is an AI-powered development orchestration platform that enables parallel track management, container execution, and intelligent development workflows.

## Features

- **AI-Powered Development**: Leverage AI for intelligent code analysis and development assistance
- **Parallel Track Management**: Work on multiple features or experiments simultaneously
- **Container Execution**: Run tools and commands in isolated containerized environments
- **Git Integration**: Seamless integration with Git repositories and worktrees
- **VS Code Extension**: Rich IDE integration for enhanced developer experience
- **MCP Host Server**: Standalone server for Model Context Protocol connections
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Quick Start

### Prerequisites

- **VS Code**: Latest version recommended
- **Node.js**: Version 18 or higher
- **Docker**: Version 20.0.0 or higher
- **Git**: Latest version recommended

### Installation

#### Option 1: Automated Installation (Recommended)

Run the appropriate installation script for your platform:

```bash
# Linux/macOS
./scripts/install.sh

# Windows
.\scripts\install.ps1
```

#### Option 2: Install from GitHub Releases

1. Find the latest release on our [GitHub Releases page](https://github.com/roo-master/roo-master/releases)
2. Download the appropriate distribution file for your platform:
   - `roo-[version]-dist.tar.gz` - General distribution package
   - `roo-master-[version].vsix` - VS Code extension package
3. Verify the checksums:
   ```bash
   # Linux/macOS
   sha256sum roo-[version]-dist.tar.gz
   # Compare with the SHA256 checksums provided in the release
   
   # Windows (PowerShell)
   Get-FileHash -Path roo-[version]-dist.tar.gz -Algorithm SHA256
   # Compare with the SHA256 checksums provided in the release
   ```
4. Extract the package:
   ```bash
   # Linux/macOS
   tar -xzf roo-[version]-dist.tar.gz
   cd roo-master-[version]
   
   # Windows
   tar -xzf roo-[version]-dist.tar.gz
   cd roo-master-[version]
   ```
5. Run the installation script for your platform:
   ```bash
   # Linux/macOS
   ./scripts/install.sh
   
   # Windows
   .\scripts\install.ps1
   ```

#### Option 3: Manual Installation

1. **Install VS Code Extension**
   - Download the `.vsix` file from the latest [GitHub Release](https://github.com/roo-master/roo-master/releases)
   - In VS Code, go to Extensions → "..." → "Install from VSIX..."
   - Select the downloaded `.vsix` file

2. **Install MCP Host Server**
   - Download the appropriate package for your platform from the latest [GitHub Release](https://github.com/roo-master/roo-master/releases)
   - Extract the package and install it globally:
   ```bash
   # Linux/macOS
   tar -xzf roo-master-[version]-linux.tar.gz
   cd roo-master-[version]
   npm install -g packages/mcp-host
   
   # Or from npm registry (if available)
   npm install -g @roo/mcp-host
   
   # Windows
   Expand-Archive -Path roo-master-[version]-windows.zip -DestinationPath .
   cd roo-master-[version]
   npm install -g packages/mcp-host
   ```

3. **Setup Docker Image**
   ```bash
   docker pull roo-master/tool-image:latest
   # Or for a specific version:
   docker pull roo-master/tool-image:[version]
   ```

## Usage

### VS Code Extension

After installing the extension, you can:

1. Open a repository in VS Code
2. Use the Roo Master panel to create and manage parallel tracks
3. Execute commands in isolated environments
4. Leverage AI assistance for development tasks

### MCP Host Server

Start the MCP host server:

```bash
roo-mcp-host
```

The server will start listening for MCP connections on the default port.

### Docker Tool Image

Run the Docker container:

```bash
docker run -it --rm \
  -v /path/to/your/workspace:/work \
  roo-master/tool-image:latest
```

Or for a specific version:

```bash
docker run -it --rm \
  -v /path/to/your/workspace:/work \
  roo-master/tool-image:[version]
```

## Components

### VS Code Extension (`packages/vscode-ext`)

- AI-powered development orchestration within VS Code
- Support for parallel track management
- Integration with MCP (Model Context Protocol)
- Git integration and worktree management
- Container execution capabilities

### MCP Host Server (`packages/mcp-host`)

- Standalone server for managing MCP connections
- Tool execution capabilities
- Project building and testing tools
- Logging and streaming utilities

### Docker Tool Image (`packages/tool-image`)

- Containerized environment for tool execution
- Pre-configured with Node.js, pnpm, git, and core utilities
- Non-root user setup for security
- Health checks for container monitoring

## Documentation

- [Distribution Guide](docs/DISTRIBUTION.md) - Detailed packaging and distribution instructions
- [Changelog](CHANGELOG.md) - Version history and release notes
- [LICENSE](LICENSE) - MIT License

## Releases

Roo Master uses automated GitHub Actions workflows to create releases. This ensures consistent and reliable releases across all platforms.

### Automated Release Process

- **Trigger**: Releases are automatically created when a tag is pushed to the repository
- **Build**: All components are built and tested in a CI environment
- **Package**: Distribution packages are created for all supported platforms
- **Upload**: Release artifacts are uploaded to GitHub Releases

### Release Artifacts

Each release includes the following files:

- `roo-[version]-dist.tar.gz` - General distribution package with all components
- `roo-master-[version].vsix` - VS Code extension package
- `roo-[version]-dist.tar.gz.sha256` - SHA256 checksum for distribution package
- `roo-[version]-dist.tar.gz.md5` - MD5 checksum for distribution package

### Verifying Release Integrity

To verify the integrity of downloaded files:

1. Download the release artifacts and checksum files
2. Verify the checksums:
   ```bash
   # Linux/macOS
   sha256sum -c roo-[version]-dist.tar.gz.sha256
   
   # Windows (PowerShell)
   $expectedHash = Get-Content roo-[version]-dist.tar.gz.sha256
   $actualHash = Get-FileHash -Path roo-[version]-dist.tar.gz -Algorithm SHA256
   $expectedHash -eq $actualHash.Hash
   ```

### Finding Releases

You can find all releases on our [GitHub Releases page](https://github.com/roo-master/roo-master/releases). The latest stable release is recommended for most users.

## Development

### Building from Source

1. Clone the repository:
   ```bash
   git clone https://github.com/roo-master/roo-master.git
   cd roo-master
   ```

2. Install dependencies:
   ```bash
   # Using pnpm (recommended)
   pnpm install
   
   # Or using npm
   npm install
   ```

3. Build all components:
   ```bash
   # Linux/macOS
   ./scripts/build-all.sh
   
   # Windows
   .\scripts\build-all.ps1
   ```

### Creating Distribution Packages

Distribution packages are automatically created when a new tag is pushed to the repository. However, if you need to create distribution packages manually for testing purposes:

```bash
# Linux/macOS
./scripts/create-distribution.sh

# Windows
.\scripts\create-distribution.ps1
```

This will create a complete distribution archive with all components. For official releases, use the automated release process by pushing a version tag to the repository.

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

- **Issues**: [GitHub Issues](https://github.com/roo-master/roo-master/issues)
- **Documentation**: [Project Wiki](https://github.com/roo-master/roo-master/wiki)
- **Discussions**: [GitHub Discussions](https://github.com/roo-master/roo-master/discussions)

## License

Roo Master is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [VS Code](https://code.visualstudio.com/) for the excellent editor platform
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) for enabling AI tool use
- [Docker](https://www.docker.com/) for containerization technology
- [Node.js](https://nodejs.org/) for the runtime environment