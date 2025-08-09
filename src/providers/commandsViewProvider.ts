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
						<button class="btn btn-secondary save-override-btn" data-name="${this.escapeHtml(name)}" title="Salvar override temporário">💾</button>
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
			<title>CickCMD</title>
			${this.getWebviewStyles()}
		</head>
		<body>
			<div class="container">
				<header class="header">
					<h2>🎯 CickCMD</h2>
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
			<title>CickCMD - Erro</title>
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
