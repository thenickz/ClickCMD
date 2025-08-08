# CickCMD - One-Click Terminal Commands for VS Code

**Tired of remembering and typing long, complex commands for your team projects?** CickCMD is a VS Code extension that provides a GUI to run predefined terminal commands with a single click. Configure your project's common routines in a single file, ensuring consistency and saving valuable time for every member of your team. Perfect for projects with numerous command-line tasks.

![CickCMD Demo](https://via.placeholder.com/600x400/1e1e1e/ffffff?text=CickCMD+Extension+Demo)

## ✨ Features

- **🎯 One-Click Execution**: Run complex commands with a single button click
- **📁 Project-Based Configuration**: Each workspace has its own `.cmmds` file
- **🔄 Temporary Overrides**: Modify commands on-the-fly without editing the config
- **🖥️ Terminal Control**: Choose between current terminal or new terminal instances
- **⚡ Live Reload**: Automatically updates when you modify the `.cmmds` file
- **👥 Team Collaboration**: Share command configurations across your team
- **🎨 VS Code Integration**: Seamlessly integrated into the VS Code sidebar

## 🚀 Quick Start

1. **Install the extension** from the VS Code Marketplace
2. **Open a workspace** in VS Code
3. **Create a `.cmmds` file** in your workspace root (or let the extension create one for you)
4. **Configure your commands** in YAML format
5. **Open the CickCMD panel** in the sidebar and start clicking!

## 📝 Configuration

Create a `.cmmds` file in your workspace root with the following structure:

```yaml
# Global settings
settings:
  runInCurrentTerminal: true  # Use active terminal vs. create new one

# Your project commands
commands:
  install: npm install
  build: npm run build
  test: npm test
  start: npm start
  deploy: npm run build && npm run deploy
  docker-up: docker-compose up -d
  docker-down: docker-compose down
  lint: npm run lint && npm run format
  clean: rm -rf node_modules dist

# Temporary overrides (managed by the extension UI)
temporary:
  settings: {}
  commands: {}
```

## 🎮 Usage

### Main Interface
- **▶️ Run Button**: Execute any command instantly
- **💾 Override Field**: Temporarily modify commands without editing the file
- **🔄 Terminal Toggle**: Switch between current terminal and new terminal modes
- **📝 Edit Button**: Quick access to edit the `.cmmds` file
- **🧹 Clear Temp**: Remove all temporary overrides

### Available Commands
- `CickCMD: Open .cmmds` - Open the configuration file
- `CickCMD: Refresh` - Reload the commands panel

## 🛠️ Configuration Options

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `settings.runInCurrentTerminal` | boolean | `true` | Execute commands in the active terminal instead of creating new ones |
| `commands.*` | string | - | Command definitions (name: command) |
| `temporary.settings.*` | any | - | UI-managed temporary setting overrides |
| `temporary.commands.*` | string | - | UI-managed temporary command overrides |

## 💡 Use Cases

### Frontend Development
```yaml
commands:
  install: npm install
  dev: npm run dev
  build: npm run build
  test: npm test
  lint: npm run lint
  format: npm run prettier
```

### Full-Stack Development
```yaml
commands:
  setup: npm install && cd backend && npm install
  dev-frontend: npm run dev
  dev-backend: cd backend && npm run dev
  build-all: npm run build && cd backend && npm run build
  test-all: npm test && cd backend && npm test
```

### DevOps & Docker
```yaml
commands:
  docker-build: docker build -t myapp .
  docker-run: docker run -p 3000:3000 myapp
  k8s-deploy: kubectl apply -f k8s/
  helm-install: helm install myapp ./helm-chart
```

## 🔧 Development

Want to contribute or run the extension locally?

### Prerequisites
- VS Code 1.102.0 or higher
- Node.js 16+ and npm

### Setup
```bash
# Clone the repository
git clone https://github.com/yourusername/cickcmd-vscode.git
cd cickcmd-vscode

# Install dependencies
npm install

# Open in VS Code
code .
```

### Running
1. Press `F5` to launch the Extension Development Host
2. Open a workspace with a `.cmmds` file
3. The CickCMD panel should appear in the sidebar

### Building
```bash
# Compile TypeScript
npm run compile

# Package the extension
npm run package
```

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **🐛 Report Issues**: Found a bug? [Open an issue](https://github.com/yourusername/cickcmd-vscode/issues)
2. **💡 Suggest Features**: Have an idea? We'd love to hear it!
3. **🔧 Submit PRs**: Fork, branch, code, and create a pull request
4. **📖 Improve Docs**: Help us make the documentation better

### Development Guidelines
- Follow the existing code style
- Add tests for new features
- Update documentation as needed
- Use conventional commit messages

## 📈 Project Status & Monetization

This extension is **dual-licensed** to provide flexibility for different use cases while protecting commercial rights. Choose the license that best fits your needs:

**📋 License Options:**
- ✅ **Non-Commercial License**: Free for personal, educational, and non-commercial use
- 💼 **Commercial License**: Required for commercial use, distribution, or monetization
- 🛡️ **Trademark Protection**: "CickCMD" name and branding are protected

**🎯 What this means:**
- Personal/educational use → **Free** (Non-Commercial License)
- Commercial use/selling → **Contact for Commercial License**
- Fork with different name → **Free** (but can't use "CickCMD" trademark)

Contributors should note that all contributions are voluntary and made under the project's dual license structure.

## 📄 License

This project is **dual-licensed**:

1. **Non-Commercial License** - Free for personal and educational use
2. **Commercial License** - Required for commercial use and distribution

The **"CickCMD" trademark** is separately protected regardless of license choice.

See the [LICENSE](LICENSE) file for complete terms, or contact us for commercial licensing inquiries.

## 🙏 Acknowledgments

- Built with ❤️ for the VS Code community
- Inspired by the need for simpler command execution in complex projects
- Thanks to all contributors who help make this extension better

---

**⭐ If this extension helps you, please consider giving it a star on GitHub!**

**🐛 Found an issue?** [Report it here](https://github.com/yourusername/cickcmd-vscode/issues)

**💬 Have questions?** [Start a discussion](https://github.com/yourusername/cickcmd-vscode/discussions)
