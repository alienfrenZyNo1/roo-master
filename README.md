# Roo Master

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](CHANGELOG.md)
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

#### Option 2: Install from Distribution Package

1. Download the latest distribution package from the [Releases](https://github.com/roo-master/roo-master/releases) page
2. Extract the package:
   ```bash
   tar -xzf roo-master-1.0.0-distribution.tar.gz
   cd roo-master-1.0.0
   ```
3. Run the installation script for your platform

#### Option 3: Manual Installation

1. **Install VS Code Extension**
   - Download the `.vsix` file from the [Releases](https://github.com/roo-master/roo-master/releases) page
   - In VS Code, go to Extensions → "..." → "Install from VSIX..."
   - Select the downloaded `.vsix` file

2. **Install MCP Host Server**
   ```bash
   npm install -g @roo/mcp-host
   ```

3. **Setup Docker Image**
   ```bash
   docker pull roo-master/tool-image:1.0.0
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
  roo-master/tool-image:1.0.0
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

To create distribution packages:

```bash
# Linux/macOS
./scripts/create-distribution.sh

# Windows
.\scripts\create-distribution.ps1
```

This will create a complete distribution archive with all components.

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