import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext): void {
	const outputChannel = vscode.window.createOutputChannel('CickCMD');
	const logger = new Logger(outputChannel);
	
	logger.info('CickCMD activating...');

	try {
		const configManager = new ConfigManager(logger);
		const commandsViewProvider = new CommandsViewProvider(context, configManager, logger);

		logger.info('Registering WebviewViewProviders...');
		
		// Register Commands View Provider
		const commandsViewDisposable = vscode.window.registerWebviewViewProvider(
			CommandsViewProvider.viewType, 
			commandsViewProvider, 
			{ webviewOptions: { retainContextWhenHidden: true } }
		);
		
		context.subscriptions.push(commandsViewDisposable);
		logger.info('WebviewViewProviders registered successfully');

		// Register commands
		const commands = [
			vscode.commands.registerCommand('cickcmd.openConfig', () => configManager.openConfigFile()),
			vscode.commands.registerCommand('cickcmd.refresh', () => commandsViewProvider.refresh()),
			vscode.commands.registerCommand('cickcmd.openPanel', () => 
				vscode.commands.executeCommand('workbench.panel.cickcmd-panel.focus')
			),
			vscode.commands.registerCommand('cickcmd.clearTemporary', () => configManager.clearTemporary()),
			vscode.commands.registerCommand('cickcmd.runCommand', async (commandName?: string) => {
				if (!commandName) {
					// If no command passed, show list to choose from
					const config = await configManager.readConfig();
					const effective = configManager.getEffectiveConfig(config);
					const commandNames = Object.keys(effective.commands);
					
					if (commandNames.length === 0) {
						vscode.window.showWarningMessage('No commands found in .cmmds');
						return;
					}
					
					const selected = await vscode.window.showQuickPick(commandNames, {
						placeHolder: 'Select a command to execute'
					});
					
					if (selected) {
						await commandsViewProvider.runCommandByName(selected);
					}
				} else {
					// Execute specific command
					await commandsViewProvider.runCommandByName(commandName);
				}
			})
		];

		context.subscriptions.push(...commands, outputChannel);
		logger.info('CickCMD activated successfully');
	} catch (error) {
		logger.error('Failed to activate CickCMD:', error);
	}
}

interface CommandConfig {
	name: string;
	command: string;
	description?: string;
}

interface CmmdsConfig {
	settings?: {
		runInCurrentTerminal?: boolean;
		shell?: string;
	};
	commands?: Record<string, string>;
	temporary?: {
		settings?: {
			runInCurrentTerminal?: boolean;
		};
		commands?: Record<string, string>;
	};
}

interface WebviewMessage {
	type: 'run' | 'override' | 'toggleRunMode' | 'openConfig' | 'refresh' | 'clearTemporary';
	name?: string;
	value?: string | boolean;
}

class Logger {
	constructor(private readonly outputChannel: vscode.OutputChannel) {}

	info(message: string): void {
		this.outputChannel.appendLine(`[INFO] ${new Date().toISOString()}: ${message}`);
	}

	error(message: string, error?: unknown): void {
		const errorMsg = error instanceof Error ? error.message : String(error);
		this.outputChannel.appendLine(`[ERROR] ${new Date().toISOString()}: ${message} ${errorMsg}`);
	}

	debug(message: string): void {
		this.outputChannel.appendLine(`[DEBUG] ${new Date().toISOString()}: ${message}`);
	}
}

class ConfigManager {
	private readonly fileName = '.cmmds';
	private readonly workspaceFolder: vscode.WorkspaceFolder | undefined;

	constructor(private readonly logger: Logger) {
		this.workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	}

	getConfigUri(): vscode.Uri | undefined {
		if (!this.workspaceFolder) {
			return undefined;
		}
		return vscode.Uri.joinPath(this.workspaceFolder.uri, this.fileName);
	}

	async ensureSampleConfig(): Promise<void> {
		const uri = this.getConfigUri();
		if (!uri) {
			return;
		}

		try {
			await vscode.workspace.fs.stat(uri);
			return;
		} catch {
			const sampleConfig: CmmdsConfig = {
				settings: { 
					runInCurrentTerminal: true 
				},
				commands: {
					"build": "echo 'Building project...'",
					"test": "echo 'Running tests...'",
					"dev": "echo 'Starting dev server...'",
					"deploy": "echo 'Deploying application...'"
				},
				temporary: {
					settings: {},
					commands: {}
				}
			};

			const yamlContent = '# ClickCmds Configuration\n' + yaml.dump(sampleConfig, {
				indent: 2,
				lineWidth: 120,
				noRefs: true
			});

			const content = new TextEncoder().encode(yamlContent);
			await vscode.workspace.fs.writeFile(uri, content);
			this.logger.info('Created sample .cmmds configuration');
		}
	}

	async readConfig(): Promise<CmmdsConfig> {
		const uri = this.getConfigUri();
		if (!uri) {
			return {};
		}

		try {
			const bytes = await vscode.workspace.fs.readFile(uri);
			const text = new TextDecoder('utf-8').decode(bytes);
			const data = (yaml.load(text) as CmmdsConfig) || {};
			return data;
		} catch (error) {
			this.logger.error('Failed to read config:', error);
			return {};
		}
	}

	async writeConfig(config: CmmdsConfig): Promise<void> {
		const uri = this.getConfigUri();
		if (!uri) {
			return;
		}

		try {
			const yamlContent = yaml.dump(config, {
				indent: 2,
				lineWidth: 120,
				noRefs: true
			});
			const content = new TextEncoder().encode(yamlContent);
			await vscode.workspace.fs.writeFile(uri, content);
		} catch (error) {
			this.logger.error('Failed to write config:', error);
		}
	}

	getEffectiveConfig(config: CmmdsConfig): { commands: Record<string, string>; runInCurrentTerminal: boolean } {
		const baseCommands = config.commands ?? {};
		const tempCommands = config.temporary?.commands ?? {};
		const commands = { ...baseCommands, ...tempCommands };

		const baseRunInCurrent = config.settings?.runInCurrentTerminal;
		const tempRunInCurrent = config.temporary?.settings?.runInCurrentTerminal;
		const runInCurrentTerminal = tempRunInCurrent ?? baseRunInCurrent ?? true;

		return { commands, runInCurrentTerminal };
	}

	async setTemporaryCommand(name: string, value: string | undefined): Promise<void> {
		const config = await this.readConfig();
		config.temporary = config.temporary ?? {};
		config.temporary.commands = config.temporary.commands ?? {};

		if (!value || value.trim() === '') {
			delete config.temporary.commands[name];
		} else {
			config.temporary.commands[name] = value;
		}

		await this.writeConfig(config);
		this.logger.debug(`Set temporary command: ${name} = ${value}`);
	}

	async setTemporaryRunInCurrentTerminal(value: boolean): Promise<void> {
		const config = await this.readConfig();
		config.temporary = config.temporary ?? {};
		config.temporary.settings = config.temporary.settings ?? {};
		config.temporary.settings.runInCurrentTerminal = value;

		await this.writeConfig(config);
		this.logger.debug(`Set temporary runInCurrentTerminal: ${value}`);
	}

	async clearTemporary(): Promise<void> {
		const config = await this.readConfig();
		config.temporary = {
			settings: {},
			commands: {}
		};

		await this.writeConfig(config);
		this.logger.info('Cleared all temporary settings');
		vscode.window.showInformationMessage('Configurações temporárias limpas');
	}

	async openConfigFile(): Promise<void> {
		const uri = this.getConfigUri();
		if (!uri) {
			vscode.window.showWarningMessage('Nenhuma pasta de workspace aberta');
			return;
		}

		await this.ensureSampleConfig();
		
		try {
			await vscode.window.showTextDocument(uri);
		} catch (error) {
			this.logger.error('Failed to open config file:', error);
			vscode.window.showErrorMessage('Falha ao abrir arquivo de configuração');
		}
	}
}

class CommandsViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'cickcmd.commands';
	private view?: vscode.WebviewView;
	private watcher?: vscode.FileSystemWatcher;

	constructor(
		private readonly context: vscode.ExtensionContext, 
		private readonly configManager: ConfigManager,
		private readonly logger: Logger
	) {}

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		this.logger.info('resolveWebviewView called - initializing commands view');
		
		this.view = webviewView;
		const webview = webviewView.webview;
		
		webview.options = { 
			enableScripts: true, 
			localResourceRoots: [this.context.extensionUri] 
		};

		this.logger.info('Updating webview content...');
		this.updateWebviewContent();

		webview.onDidReceiveMessage(async (message: WebviewMessage) => {
			this.logger.debug(`Received message: ${message.type}`);
			try {
				await this.handleMessage(message);
			} catch (error) {
				this.logger.error('Error handling webview message:', error);
				vscode.window.showErrorMessage('Error processing command');
			}
		});

		this.logger.info('Setting up file watcher...');
		this.setupFileWatcher();
		
		this.logger.info('resolveWebviewView completed');
	}

	private async handleMessage(message: WebviewMessage): Promise<void> {
		switch (message.type) {
			case 'run':
				if (message.name) {
					await this.runCommand(message.name);
				}
				break;
			
			case 'override':
				if (message.name) {
					await this.configManager.setTemporaryCommand(message.name, message.value as string);
					await this.refresh();
				}
				break;
			
			case 'toggleRunMode':
				await this.configManager.setTemporaryRunInCurrentTerminal(!!message.value);
				await this.refresh();
				break;
			
			case 'openConfig':
				await this.configManager.openConfigFile();
				break;
			
			case 'refresh':
				await this.refresh();
				break;

			case 'clearTemporary':
				await this.configManager.clearTemporary();
				await this.refresh();
				break;
		}
	}

	private setupFileWatcher(): void {
		const uri = this.configManager.getConfigUri();
		if (!uri) {
			return;
		}

		this.watcher?.dispose();
		
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			return;
		}

		// Usar padrão absoluto para evitar warnings de resource scoped configuration
		const pattern = new vscode.RelativePattern(workspaceFolder, '.cmmds');
		this.watcher = vscode.workspace.createFileSystemWatcher(pattern, false, false, false);

		this.watcher.onDidChange(() => {
			this.logger.debug('Config file changed, refreshing view');
			this.refresh();
		});
		this.watcher.onDidCreate(() => {
			this.logger.debug('Config file created, refreshing view');
			this.refresh();
		});
		this.watcher.onDidDelete(() => {
			this.logger.debug('Config file deleted, refreshing view');
			this.refresh();
		});

		// Adicionar o watcher aos subscriptions para cleanup
		if (this.context) {
			this.context.subscriptions.push(this.watcher);
		}
	}

	async refresh(): Promise<void> {
		await this.updateWebviewContent();
	}

	private async updateWebviewContent(): Promise<void> {
		this.logger.debug('updateWebviewContent iniciado');
		
		if (!this.view) {
			this.logger.error('updateWebviewContent: view não está definida');
			return;
		}

		try {
			this.logger.debug('Garantindo config sample...');
			await this.configManager.ensureSampleConfig();
			
			this.logger.debug('Lendo configuração...');
			const config = await this.configManager.readConfig();
			
			this.logger.debug('Calculando configuração efetiva...');
			const effective = this.configManager.getEffectiveConfig(config);

			this.logger.info(`Comandos encontrados: ${Object.keys(effective.commands).length}`);
			
			this.logger.debug('Gerando HTML do webview...');
			const html = this.generateWebviewContent(config, effective);
			
			this.logger.debug(`HTML gerado com ${html.length} caracteres`);
			this.view.webview.html = html;
			
			this.logger.info('Conteúdo do webview atualizado com sucesso');
		} catch (error) {
			this.logger.error('Failed to update webview content:', error);
			this.view.webview.html = this.generateErrorContent();
		}
	}

	private generateWebviewContent(config: CmmdsConfig, effective: { commands: Record<string, string>; runInCurrentTerminal: boolean }): string {
		const nonce = this.getNonce();
		
		const commandRows = Object.entries(effective.commands).map(([name, cmd]) => {
			const tempValue = config.temporary?.commands?.[name] || '';
			const escapedValue = this.escapeHtml(tempValue);
			
			return `
				<div class="command-row">
					<div class="command-info">
						<span class="command-name" title="${this.escapeHtml(cmd)}">${this.escapeHtml(name)}</span>
						<code class="command-preview">${this.escapeHtml(cmd.substring(0, 50))}${cmd.length > 50 ? '...' : ''}</code>
					</div>
					<div class="command-controls">
						<button class="btn btn-primary run-btn" data-name="${this.escapeHtml(name)}">▶️ Executar</button>
						<input 
							class="override-input" 
							data-name="${this.escapeHtml(name)}" 
							type="text" 
							placeholder="Override temporário..."
							value="${escapedValue}"
						/>
						<button class="btn btn-secondary save-override-btn" data-name="${this.escapeHtml(name)}" title="Salvar override temporário">�</button>
					</div>
				</div>
			`;
		}).join('');

		return `<!DOCTYPE html>
		<html lang="pt-br">
		<head>
			<meta charset="UTF-8">
			<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${this.view?.webview.cspSource}; script-src 'nonce-${nonce}';">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>ClickCmds</title>
			${this.getWebviewStyles()}
		</head>
		<body>
			<div class="container">
				<header class="header">
					<h2>🎯 ClickCmds</h2>
					<div class="header-controls">
						<label class="toggle-label">
							<input id="runInCurrent" type="checkbox" ${effective.runInCurrentTerminal ? 'checked' : ''}>
							<span>Terminal atual</span>
						</label>
						<button class="btn btn-outline" id="openConfigBtn">📝 Editar</button>
						<button class="btn btn-outline" id="refreshBtn">🔄 Recarregar</button>
						<button class="btn btn-outline" id="clearTempBtn">🧹 Limpar Temp</button>
					</div>
				</header>

				<main class="content">
					${commandRows ? commandRows : '<div class="empty-state">📝 Nenhum comando encontrado. Clique em "Editar" para adicionar comandos.</div>'}
				</main>
			</div>

			${this.getWebviewScript(nonce)}
		</body>
		</html>`;
	}

	private generateErrorContent(): string {
		return `<!DOCTYPE html>
		<html lang="pt-br">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>ClickCmds - Erro</title>
			<style>
				body { 
					font-family: var(--vscode-font-family); 
					padding: 20px; 
					color: var(--vscode-foreground); 
					background: var(--vscode-editor-background);
				}
				.error { color: var(--vscode-errorForeground); }
			</style>
		</head>
		<body>
			<div class="error">
				<h3>⚠️ Erro</h3>
				<p>Falha ao carregar configuração. Verifique o arquivo .cmmds e tente novamente.</p>
			</div>
		</body>
		</html>`;
	}

	private getWebviewStyles(): string {
		return `<style>
			:root {
				--border-color: var(--vscode-panel-border);
				--hover-color: var(--vscode-list-hoverBackground);
			}

			* { box-sizing: border-box; }
			
			body {
				font-family: var(--vscode-font-family);
				font-size: var(--vscode-font-size);
				color: var(--vscode-foreground);
				background: var(--vscode-editor-background);
				margin: 0;
				padding: 0;
			}

			.container {
				padding: 12px;
			}

			.header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: 16px;
				padding-bottom: 12px;
				border-bottom: 1px solid var(--border-color);
			}

			.header h2 {
				margin: 0;
				font-size: 16px;
				font-weight: 600;
			}

			.header-controls {
				display: flex;
				align-items: center;
				gap: 8px;
			}

			.toggle-label {
				display: flex;
				align-items: center;
				gap: 6px;
				cursor: pointer;
				font-size: 12px;
			}

			.btn {
				padding: 4px 8px;
				border: 1px solid var(--vscode-button-border);
				border-radius: 3px;
				font-size: 11px;
				cursor: pointer;
				white-space: nowrap;
			}

			.btn-primary {
				background: var(--vscode-button-background);
				color: var(--vscode-button-foreground);
			}

			.btn-primary:hover {
				background: var(--vscode-button-hoverBackground);
			}

			.btn-secondary {
				background: var(--vscode-button-secondaryBackground);
				color: var(--vscode-button-secondaryForeground);
			}

			.btn-outline {
				background: transparent;
				color: var(--vscode-foreground);
			}

			.btn-outline:hover {
				background: var(--hover-color);
			}

			.command-row {
				display: flex;
				flex-direction: column;
				gap: 8px;
				padding: 12px;
				border: 1px solid var(--border-color);
				border-radius: 4px;
				margin-bottom: 8px;
			}

			.command-row:hover {
				background: var(--hover-color);
			}

			.command-info {
				display: flex;
				flex-direction: column;
				gap: 4px;
			}

			.command-name {
				font-weight: 600;
				font-size: 13px;
			}

			.command-preview {
				font-family: var(--vscode-editor-font-family);
				font-size: 11px;
				color: var(--vscode-descriptionForeground);
				background: var(--vscode-textCodeBlock-background);
				padding: 2px 4px;
				border-radius: 2px;
			}

			.command-controls {
				display: flex;
				align-items: center;
				gap: 6px;
			}

			.run-btn {
				flex-shrink: 0;
			}

			.override-input {
				flex: 1;
				padding: 4px 8px;
				border: 1px solid var(--vscode-input-border);
				border-radius: 2px;
				background: var(--vscode-input-background);
				color: var(--vscode-input-foreground);
				font-size: 11px;
			}

			.override-input:focus {
				border-color: var(--vscode-focusBorder);
				outline: none;
			}

			.save-override-btn {
				flex-shrink: 0;
			}

			.empty-state {
				text-align: center;
				padding: 40px 20px;
				color: var(--vscode-descriptionForeground);
			}
		</style>`;
	}

	private getWebviewScript(nonce: string): string {
		return `<script nonce="${nonce}">
			const vscode = acquireVsCodeApi();

			// Event listeners
			document.getElementById('runInCurrent').addEventListener('change', (e) => {
				vscode.postMessage({ type: 'toggleRunMode', value: e.target.checked });
			});

			document.getElementById('openConfigBtn').addEventListener('click', () => {
				vscode.postMessage({ type: 'openConfig' });
			});

			document.getElementById('refreshBtn').addEventListener('click', () => {
				vscode.postMessage({ type: 'refresh' });
			});

			document.getElementById('clearTempBtn').addEventListener('click', () => {
				if (confirm('Limpar todas as configurações temporárias?')) {
					vscode.postMessage({ type: 'clearTemporary' });
				}
			});

			// Command buttons
			document.querySelectorAll('.run-btn').forEach(btn => {
				btn.addEventListener('click', () => {
					const name = btn.dataset.name;
					vscode.postMessage({ type: 'run', name });
				});
			});

			// Save override buttons
			document.querySelectorAll('.save-override-btn').forEach(btn => {
				btn.addEventListener('click', () => {
					const name = btn.dataset.name;
					const input = document.querySelector('.override-input[data-name="' + name + '"]');
					vscode.postMessage({ type: 'override', name, value: input.value });
				});
			});

			// Enter key on override inputs
			document.querySelectorAll('.override-input').forEach(input => {
				input.addEventListener('keypress', (e) => {
					if (e.key === 'Enter') {
						const name = input.dataset.name;
						vscode.postMessage({ type: 'override', name, value: input.value });
					}
				});
			});
		</script>`;
	}

	private async runCommand(commandName: string): Promise<void> {
		try {
			const config = await this.configManager.readConfig();
			const effective = this.configManager.getEffectiveConfig(config);
			const command = effective.commands[commandName];

			if (!command) {
				vscode.window.showWarningMessage(`Comando não encontrado: ${commandName}`);
				return;
			}

			this.logger.info(`Executing command: ${commandName} -> ${command}`);

			if (effective.runInCurrentTerminal) {
				let terminal = vscode.window.activeTerminal;
				if (!terminal) {
					terminal = vscode.window.createTerminal({ name: 'ClickCmds' });
				}
				terminal.show(true);
				terminal.sendText(command, true);
			} else {
				const terminal = vscode.window.createTerminal({ 
					name: `ClickCmds: ${commandName}`, 
					hideFromUser: false 
				});
				terminal.sendText(command, true);
				terminal.show();
			}

		} catch (error) {
			this.logger.error(`Failed to run command ${commandName}:`, error);
			vscode.window.showErrorMessage(`Falha ao executar comando: ${commandName}`);
		}
	}

	// Método público para ser chamado externamente
	async runCommandByName(commandName: string): Promise<void> {
		await this.runCommand(commandName);
	}

	private escapeHtml(unsafe: string): string {
		return unsafe
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	private getNonce(): string {
		let text = '';
		const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		for (let i = 0; i < 32; i++) {
			text += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		return text;
	}

	dispose(): void {
		this.watcher?.dispose();
	}
}

class TerminalViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'cickcmd.terminal';
	private view?: vscode.WebviewView;
	private terminals: vscode.Terminal[] = [];

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly logger: Logger
	) {
		// Listen for terminal events
		vscode.window.onDidCloseTerminal(terminal => {
			this.terminals = this.terminals.filter(t => t !== terminal);
			this.updateWebviewContent();
		});

		vscode.window.onDidChangeActiveTerminal(() => {
			this.updateWebviewContent();
		});
	}

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		this.logger.info('resolveWebviewView called - initializing terminal view');
		
		this.view = webviewView;
		const webview = webviewView.webview;
		
		webview.options = { 
			enableScripts: true, 
			localResourceRoots: [this.context.extensionUri] 
		};

		this.updateWebviewContent();

		webview.onDidReceiveMessage(async (message: any) => {
			switch (message.type) {
				case 'createTerminal':
					this.createNewTerminal();
					break;
				case 'focusTerminal':
					if (message.name) {
						this.focusTerminal(message.name);
					}
					break;
				case 'closeTerminal':
					if (message.name) {
						this.closeTerminal(message.name);
					}
					break;
			}
		});
	}

	createNewTerminal(): void {
		const terminal = vscode.window.createTerminal(`CickCMD Terminal ${this.terminals.length + 1}`);
		this.terminals.push(terminal);
		terminal.show();
		this.updateWebviewContent();
	}

	private focusTerminal(name: string): void {
		const terminal = this.terminals.find(t => t.name === name);
		if (terminal) {
			terminal.show();
		}
	}

	private closeTerminal(name: string): void {
		const terminal = this.terminals.find(t => t.name === name);
		if (terminal) {
			terminal.dispose();
		}
	}

	private async updateWebviewContent(): Promise<void> {
		if (!this.view) {
			return;
		}

		const activeTerminal = vscode.window.activeTerminal;
		const allTerminals = vscode.window.terminals;

		this.view.webview.html = this.getHtmlContent(allTerminals, activeTerminal);
	}

	private getHtmlContent(terminals: readonly vscode.Terminal[], activeTerminal?: vscode.Terminal): string {
		const nonce = this.getNonce();

		const terminalsList = terminals.map(terminal => `
			<div class="terminal-item ${terminal === activeTerminal ? 'active' : ''}" data-name="${this.escapeHtml(terminal.name)}">
				<div class="terminal-info">
					<span class="terminal-name">${this.escapeHtml(terminal.name)}</span>
					<span class="terminal-status">${terminal === activeTerminal ? '(Active)' : ''}</span>
				</div>
				<div class="terminal-actions">
					<button class="btn btn-outline" onclick="focusTerminal('${this.escapeHtml(terminal.name)}')">Focus</button>
					<button class="btn btn-outline" onclick="closeTerminal('${this.escapeHtml(terminal.name)}')">Close</button>
				</div>
			</div>
		`).join('');

		return `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
			<title>CickCMD Terminal</title>
			${this.getTerminalWebviewStyles()}
		</head>
		<body>
			<div class="container">
				<div class="header">
					<h2>Terminals</h2>
					<button class="btn btn-primary" onclick="createTerminal()">New Terminal</button>
				</div>
				
				<div class="terminals-list">
					${terminalsList || '<div class="empty-state">No terminals open</div>'}
				</div>
			</div>

			<script nonce="${nonce}">
				const vscode = acquireVsCodeApi();

				function createTerminal() {
					vscode.postMessage({ type: 'createTerminal' });
				}

				function focusTerminal(name) {
					vscode.postMessage({ type: 'focusTerminal', name: name });
				}

				function closeTerminal(name) {
					vscode.postMessage({ type: 'closeTerminal', name: name });
				}
			</script>
		</body>
		</html>`;
	}

	private getTerminalWebviewStyles(): string {
		return `<style>
			* { box-sizing: border-box; }
			
			body {
				font-family: var(--vscode-font-family);
				font-size: var(--vscode-font-size);
				color: var(--vscode-foreground);
				background: var(--vscode-editor-background);
				margin: 0;
				padding: 0;
			}

			.container {
				padding: 12px;
			}

			.header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: 16px;
				padding-bottom: 12px;
				border-bottom: 1px solid var(--vscode-panel-border);
			}

			.header h2 {
				margin: 0;
				font-size: 16px;
				font-weight: 600;
			}

			.btn {
				padding: 6px 12px;
				border: 1px solid var(--vscode-button-border);
				border-radius: 3px;
				font-size: 12px;
				cursor: pointer;
				white-space: nowrap;
			}

			.btn-primary {
				background: var(--vscode-button-background);
				color: var(--vscode-button-foreground);
			}

			.btn-primary:hover {
				background: var(--vscode-button-hoverBackground);
			}

			.btn-outline {
				background: transparent;
				color: var(--vscode-foreground);
				font-size: 11px;
				padding: 4px 8px;
			}

			.btn-outline:hover {
				background: var(--vscode-list-hoverBackground);
			}

			.terminals-list {
				display: flex;
				flex-direction: column;
				gap: 8px;
			}

			.terminal-item {
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: 12px;
				border: 1px solid var(--vscode-panel-border);
				border-radius: 4px;
				background: var(--vscode-editor-background);
			}

			.terminal-item.active {
				border-color: var(--vscode-focusBorder);
				background: var(--vscode-list-activeSelectionBackground);
			}

			.terminal-info {
				display: flex;
				flex-direction: column;
				gap: 4px;
			}

			.terminal-name {
				font-weight: 600;
				font-size: 13px;
			}

			.terminal-status {
				font-size: 11px;
				color: var(--vscode-descriptionForeground);
			}

			.terminal-actions {
				display: flex;
				gap: 8px;
			}

			.empty-state {
				text-align: center;
				padding: 32px;
				color: var(--vscode-descriptionForeground);
				font-style: italic;
			}
		</style>`;
	}

	private escapeHtml(unsafe: string): string {
		return unsafe
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	private getNonce(): string {
		let text = '';
		const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		for (let i = 0; i < 32; i++) {
			text += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		return text;
	}
}

export function deactivate(): void {
	// Cleanup resources if needed
}
