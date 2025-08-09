import * as vscode from 'vscode';
import { CmmdsConfig, WebviewMessage, EffectiveConfig } from '../types';
import { ConfigManager } from '../managers/configManager';
import { Logger } from '../utils/logger';

/**
 * WebView provider for commands view
 */
export class CommandsViewProvider implements vscode.WebviewViewProvider {
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
					terminal = vscode.window.createTerminal({ name: 'CickCMD' });
				}
				terminal.show(true);
				terminal.sendText(command, true);
			} else {
				const terminal = vscode.window.createTerminal({ 
					name: `CickCMD: ${commandName}`, 
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

	private generateWebviewContent(config: CmmdsConfig, effective: EffectiveConfig): string {
		const nonce = this.getNonce();
		
		// Determine toggle button state
		const isCurrentTerminal = effective.runInCurrentTerminal;
		const toggleButtonClass = isCurrentTerminal ? 'btn-toggle-active' : 'btn-toggle-inactive';
		const toggleButtonText = isCurrentTerminal ? 'Current Terminal' : 'Create Terminals';
		
		const commandRows = Object.entries(effective.commands).map(([name, cmd]) => {
			const tempValue = config.temporary?.commands?.[name] || '';
			const escapedValue = this.escapeHtml(tempValue);
			
			// Check if this command has a temporary override
			const hasTemporaryOverride = config.temporary?.commands?.[name] !== undefined;
			const displayName = hasTemporaryOverride ? `${name}*` : name;
			const nameClass = hasTemporaryOverride ? 'command-name-temporary' : 'command-name';
			
			return `
				<div class="command-row">
					<div class="command-header">
						<div class="command-info">
							<div class="command-name-row">
								<span class="${nameClass}">${this.escapeHtml(displayName)}</span>:
								<code class="command-preview">${this.escapeHtml(cmd.length > 50 ? cmd.substring(0, 50) + '...' : cmd)}</code>
							</div>
						</div>
						<div class="command-actions">
							<button class="btn btn-secondary edit-btn" data-name="${this.escapeHtml(name)}" title="Edit command">
								${this.getIconSvg('edit')}
							</button>
							<button class="btn btn-secondary clear-override-btn" data-name="${this.escapeHtml(name)}" title="Clear override">
								${this.getIconSvg('close')}
							</button>
							<button class="btn btn-primary run-btn" data-name="${this.escapeHtml(name)}">
								${this.getIconSvg('play_arrow')}
								<span class="btn-text">Run</span>
							</button>
						</div>
					</div>
					<div class="command-edit">
						<input 
							class="override-input" 
							data-name="${this.escapeHtml(name)}" 
							type="text" 
							placeholder="Temporary override..."
							value="${escapedValue}"
						/>
						<button class="btn btn-secondary save-override-btn" data-name="${this.escapeHtml(name)}" title="Save override">
							${this.getIconSvg('save')}
						</button>
					</div>
				</div>
			`;
		}).join('');

		return `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${this.view?.webview.cspSource}; script-src 'nonce-${nonce}';">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>ClickCMD</title>
			${this.getWebviewStyles()}
		</head>
		<body>
			<div class="container">
				<header class="header">
					<h2>
						<span class="target-icon">${this.getIconSvg('gps_fixed')}</span>
						ClickCMD
					</h2>
					<div class="header-controls">
						<button class="btn ${toggleButtonClass} toggle-terminal-btn" id="toggleTerminalBtn">
							${this.getIconSvg('terminal')}
							<span class="btn-text">${toggleButtonText}</span>
						</button>
						<button class="btn btn-outline" id="openConfigBtn">
							${this.getIconSvg('edit')}
							<span class="btn-text">Edit file</span>
						</button>
						<button class="btn btn-outline" id="refreshBtn">
							${this.getIconSvg('refresh')}
							<span class="btn-text">Reload</span>
						</button>
						<button class="btn btn-outline" id="clearTempBtn">
							${this.getIconSvg('cleaning_services')}
							<span class="btn-text">Clear Changes</span>
						</button>
					</div>
				</header>

				<main class="content">
					${commandRows ? commandRows : `<div class="empty-state">${this.getIconSvg('code')} No commands found. Click "Edit" to add commands.</div>`}
				</main>
			</div>

			${this.getWebviewScript(nonce)}
		</body>
		</html>`;
	}

	private generateErrorContent(): string {
		return `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>ClickCMD - Error</title>
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
				<h3>⚠️ Error</h3>
				<p>Failed to load configuration. Please check the .cmmds file and try again.</p>
			</div>
		</body>
		</html>`;
	}

	private getWebviewStyles(): string {
		return `<style>
			:root {
				/* VSCode Theme Variables */
				--vscode-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
				--base-font-size: max(11px, calc(var(--vscode-editor-font-size, 14px) - 2px));
				--vscode-foreground: var(--vscode-foreground);
				--vscode-editor-background: var(--vscode-editor-background);
				--vscode-panel-border: var(--vscode-panel-border);
				--vscode-list-hoverBackground: var(--vscode-list-hoverBackground);
				--vscode-button-background: var(--vscode-button-background);
				--vscode-button-foreground: var(--vscode-button-foreground);
				--vscode-button-hoverBackground: var(--vscode-button-hoverBackground);
				--vscode-button-secondaryBackground: var(--vscode-button-secondaryBackground);
				--vscode-button-secondaryForeground: var(--vscode-button-secondaryForeground);
				--vscode-input-border: var(--vscode-input-border);
				--vscode-input-background: var(--vscode-input-background);
				--vscode-input-foreground: var(--vscode-input-foreground);
				--vscode-focusBorder: var(--vscode-focusBorder);
				--vscode-descriptionForeground: var(--vscode-descriptionForeground);
				--vscode-textCodeBlock-background: var(--vscode-textCodeBlock-background);
				--vscode-editor-font-family: var(--vscode-editor-font-family);
			}

			* { 
				box-sizing: border-box; 
			}

			body {
				font-family: var(--vscode-font-family);
				font-size: var(--base-font-size);
				color: var(--vscode-foreground);
				background: var(--vscode-editor-background);
				margin: 0;
				padding: 0;
				line-height: 1.4;
			}

			.container {
				padding: 8px;
				min-width: 0;
			}

			.header {
				display: flex;
				flex-direction: row;
				align-items: center;
				justify-content: space-between;
				gap: 8px;
				margin-bottom: 12px;
				padding-bottom: 8px;
				border-bottom: 1px solid var(--vscode-panel-border);
				flex-wrap: wrap;
			}

			.header h2 {
				margin: 0;
				font-size: calc(var(--base-font-size) + 2px);
				font-weight: 600;
				display: flex;
				align-items: center;
				gap: 6px;
				min-width: 0;
				flex-shrink: 0;
			}

			.header-controls {
				display: flex;
				align-items: center;
				gap: 4px;
				flex-wrap: wrap;
				flex-shrink: 1;
				min-width: 0;
			}

			.toggle-label {
				display: flex;
				align-items: center;
				gap: 4px;
				cursor: pointer;
				font-size: var(--base-font-size);
				white-space: nowrap;
			}

			.btn {
				padding: 4px 6px;
				border: 1px solid var(--vscode-panel-border);
				border-radius: 3px;
				font-size: var(--base-font-size);
				cursor: pointer;
				display: flex;
				align-items: center;
				gap: 3px;
				transition: all 0.2s ease;
				min-width: 0;
				white-space: nowrap;
			}

			.btn-text {
				display: inline;
			}

			/* Medium screens - optimize spacing */
			@media (max-width: 350px) {
				.header {
					gap: 6px;
				}
				.header-controls {
					gap: 3px;
				}
			}

			/* Hide command preview on small screens */
			@media (max-width: 300px) {
				.command-preview {
					display: none;
				}
			}

			/* Hide button text on very small screens */
			@media (max-width: 250px) {
				.btn-text {
					display: none;
				}
				.header {
					flex-direction: column;
					align-items: stretch;
					gap: 4px;
				}
				.header h2 {
					font-size: var(--base-font-size);
				}
				.header-controls {
					gap: 2px;
					justify-content: center;
				}
				.btn {
					padding: 3px 4px;
					min-width: 24px;
					justify-content: center;
				}
			}

			.btn-primary {
				background: var(--vscode-button-background);
				color: var(--vscode-button-foreground);
				border-color: var(--vscode-button-background);
			}
			.btn-primary:hover { 
				background: var(--vscode-button-hoverBackground); 
			}

			.btn-secondary {
				background: var(--vscode-button-secondaryBackground);
				color: var(--vscode-button-secondaryForeground);
				border-color: var(--vscode-button-secondaryBackground);
			}
			.btn-secondary:hover { 
				background: #4a4a4a; 
			}

			.btn-outline {
				background: transparent;
				color: var(--vscode-foreground);
			}
			.btn-outline:hover { 
				background: var(--vscode-list-hoverBackground); 
			}

			.btn-toggle-active {
				background: var(--vscode-button-background);
				color: var(--vscode-button-foreground);
				border-color: var(--vscode-button-background);
			}
			.btn-toggle-active:hover { 
				background: var(--vscode-button-hoverBackground); 
			}

			.btn-toggle-inactive {
				background: #d32f2f;
				color: #ffffff;
				border-color: #d32f2f;
			}
			.btn-toggle-inactive:hover { 
				background: #b71c1c; 
			}

			.command-row {
				border: 1px solid var(--vscode-panel-border);
				border-radius: 4px;
				margin-bottom: 6px;
				overflow: hidden;
				transition: all 0.2s ease;
			}

			.command-row:hover {
				background: var(--vscode-list-hoverBackground);
			}

			.command-header {
				display: flex;
				flex-direction: row;
				align-items: center;
				justify-content: space-between;
				gap: 8px;
				padding: 8px;
			}

			.command-info {
				display: flex;
				flex-direction: column;
				gap: 4px;
				min-width: 0;
				flex: 1;
			}

			.command-name-row {
				display: flex;
				align-items: center;
				gap: 6px;
				flex-wrap: wrap;
				min-width: 0;
			}

			.command-name {
				font-weight: 600;
				font-size: var(--base-font-size);
				white-space: nowrap;
			}

			.command-name-temporary {
				font-weight: 600;
				font-size: var(--base-font-size);
				white-space: nowrap;
				color: #ff9800;
			}

			.command-preview {
				font-family: var(--vscode-editor-font-family);
				font-size: calc(var(--base-font-size) - 1px);
				color: var(--vscode-descriptionForeground);
				background: var(--vscode-textCodeBlock-background);
				padding: 2px 4px;
				border-radius: 3px;
				border: 1px solid var(--vscode-panel-border);
				word-break: break-all;
				flex: 1;
				min-width: 0;
			}

			.command-actions {
				display: flex;
				align-items: center;
				gap: 4px;
				flex-wrap: wrap;
				flex-shrink: 0;
			}

			.command-edit {
				padding: 8px;
				background: rgba(255, 255, 255, 0.02);
				border-top: 1px solid var(--vscode-panel-border);
				display: none;
				flex-direction: column;
				gap: 6px;
			}

			/* Horizontal layout for edit area on larger screens */
			@media (min-width: 250px) {
				.command-edit {
					flex-direction: row;
					align-items: center;
				}
			}

			.override-input {
				flex: 1;
				padding: 4px 6px;
				border: 1px solid var(--vscode-input-border);
				border-radius: 3px;
				background: var(--vscode-input-background);
				color: var(--vscode-input-foreground);
				font-size: var(--base-font-size);
				font-family: var(--vscode-font-family);
				min-width: 0;
			}

			.override-input:focus {
				border-color: var(--vscode-focusBorder);
				outline: none;
				box-shadow: 0 0 0 1px var(--vscode-focusBorder);
			}

			.btn svg {
				flex-shrink: 0;
			}

			.empty-state {
				text-align: center;
				padding: 20px 10px;
				color: var(--vscode-descriptionForeground);
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 6px;
				font-size: var(--base-font-size);
			}

			.target-icon {
				color: #4CAF50;
				display: flex;
				align-items: center;
				flex-shrink: 0;
			}

			.target-icon svg {
				color: #4CAF50;
			}
		</style>`;
	}

	private getWebviewScript(nonce: string): string {
		return `<script nonce="${nonce}">
			const vscode = acquireVsCodeApi();

			// Get initial state from server-side rendered content
			const initialButton = document.getElementById('toggleTerminalBtn');
			let runInCurrentTerminal = initialButton.classList.contains('btn-toggle-active');

			// Terminal toggle functionality
			const toggleTerminalBtn = document.getElementById('toggleTerminalBtn');
			const toggleTerminalState = () => {
				runInCurrentTerminal = !runInCurrentTerminal;
				console.log('Toggling to:', runInCurrentTerminal);
				updateTerminalButton();
				vscode.postMessage({ type: 'toggleRunMode', value: runInCurrentTerminal });
			};

			const updateTerminalButton = () => {
				const textSpan = toggleTerminalBtn.querySelector('.btn-text');
				if (runInCurrentTerminal) {
					// Active state: Current Terminal (blue)
					toggleTerminalBtn.className = 'btn btn-toggle-active toggle-terminal-btn';
					if (textSpan) textSpan.textContent = 'Current Terminal';
				} else {
					// Inactive state: Create Terminals (red)
					toggleTerminalBtn.className = 'btn btn-toggle-inactive toggle-terminal-btn';
					if (textSpan) textSpan.textContent = 'Create Terminals';
				}
			};

			toggleTerminalBtn.addEventListener('click', toggleTerminalState);

			// Event listeners
			document.getElementById('openConfigBtn').addEventListener('click', () => {
				vscode.postMessage({ type: 'openConfig' });
			});

			document.getElementById('refreshBtn').addEventListener('click', () => {
				vscode.postMessage({ type: 'refresh' });
			});

			document.getElementById('clearTempBtn').addEventListener('click', () => {
				console.log('Clear Changes button clicked!');
				if (confirm('Clear all temporary overrides and reset to default settings?')) {
					console.log('User confirmed, clearing temporary overrides...');
					// Clear all temporary command overrides
					document.querySelectorAll('.clear-override-btn').forEach(clearBtn => {
						const name = clearBtn.dataset.name;
						const input = document.querySelector('.override-input[data-name="' + name + '"]');
						if (input && input.value.trim() !== '') {
							input.value = '';
							vscode.postMessage({ type: 'override', name, value: '' });
						}
					});
					
					console.log('All temporary overrides cleared');
				} else {
					console.log('User cancelled clear operation');
				}
			});

			// Toggle edit area visibility
			document.querySelectorAll('.edit-btn').forEach(btn => {
				btn.addEventListener('click', () => {
					const row = btn.closest('.command-row');
					const editArea = row.querySelector('.command-edit');
					const isVisible = editArea.style.display === 'flex';
					editArea.style.display = isVisible ? 'none' : 'flex';
					
					// Focus input when opening
					if (!isVisible) {
						const input = editArea.querySelector('.override-input');
						setTimeout(() => input.focus(), 100);
					}
				});
			});

			// Clear override buttons
			document.querySelectorAll('.clear-override-btn').forEach(btn => {
				btn.addEventListener('click', () => {
					const name = btn.dataset.name;
					const input = document.querySelector('.override-input[data-name="' + name + '"]');
					input.value = '';
					vscode.postMessage({ type: 'override', name, value: '' });
				});
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

	private getIconSvg(iconName: string): string {
		const icons: { [key: string]: string } = {
			'gps_fixed': '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>',
			'terminal': '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 3h20c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H2c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2zm0 16h20V5H2v14zM6 8.5L9.5 12 6 15.5 7.5 17l5-5-5-5L6 8.5zm6 6.5h6v1.5h-6V15z"/></svg>',
			'edit': '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>',
			'close': '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
			'play_arrow': '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
			'save': '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>',
			'refresh': '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>',
			'cleaning_services': '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11h1V3c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v8h1c1.1 0 2 .9 2 2v8c0 1.1.9 2 2 2s2-.9 2-2v-8c0-1.1.9-2 2-2zm-6 0V3H9v8h1zm2-8h2v8h-2V3z"/></svg>',
			'code': '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0L19.2 12l-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>'
		};
		return icons[iconName] || '';
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
