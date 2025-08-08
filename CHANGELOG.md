# Changelog

All notable changes to Roo Master will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-08-08

### Added

- Initial release of Roo Master
- **VS Code Extension** (`packages/vscode-ext`)
  - AI-powered development orchestration within VS Code
  - Support for parallel track management
  - Integration with MCP (Model Context Protocol)
  - Git integration and worktree management
  - Container execution capabilities
  - UI components for enhanced user experience
- **MCP Host Server** (`packages/mcp-host`)
  - Standalone server for managing MCP connections
  - Tool execution capabilities
  - Project building and testing tools
  - Logging and streaming utilities
- **Docker Tool Image** (`packages/tool-image`)
  - Containerized environment for tool execution
  - Pre-configured with Node.js, pnpm, git, and core utilities
  - Non-root user setup for security
  - Health checks for container monitoring
- **Distribution Package**
  - Complete installation scripts for Windows, macOS, and Linux
  - Distribution archive creation scripts
  - Comprehensive documentation and installation guide
  - Checksum verification for package integrity

### Technical Details

- Built with TypeScript for type safety
- Uses modern npm/pnpm workspace structure
- Supports multiple container registries for Docker image distribution
- Comprehensive error handling and user feedback in installation scripts
- Cross-platform compatibility with PowerShell and Bash scripts

### Documentation

- Detailed distribution guide (`docs/DISTRIBUTION.md`)
- Installation instructions for all components
- Publishing guidelines for package registries
- Version management and compatibility information

### Known Limitations

- Docker image must be built manually or pulled from a registry
- VS Code extension requires manual installation from VSIX file until published to marketplace
- MCP host server requires Node.js 18 or higher
- Installation requires administrative privileges on some systems

---

## [Unreleased]

### Planned

- Automated publishing workflows for all components
- Integration tests for installation and package integrity
- Documentation website with interactive guides
- Support for additional container runtimes
- Enhanced security features for the Docker image
- Performance optimizations for all components
- Additional tool integrations for the MCP host server