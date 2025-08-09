import * as vscode from 'vscode';
import { CmmdsConfig, WebviewMessage, EffectiveConfig } from '../types';
import { ConfigManager } from '../managers/configManager';
import { Logger } from '../utils/logger';
import { WebviewBuilder } from '../webview/webviewBuilder';

/**
 * WebView provider for commands view
 */
export class CommandsViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'cickcmd.commands';
	private view?: vscode.WebviewView;
	private watcher?: vscode.FileSystemWatcher;
	private webviewBuilder: WebviewBuilder;

	constructor(
		private readonly context: vscode.ExtensionContext, 
		private readonly configManager: ConfigManager,
		private readonly logger: Logger
	) {
		this.webviewBuilder = new WebviewBuilder(context);
	}

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
			const html = this.webviewBuilder.generateMainContent(config, effective, this.view.webview);
			
			this.logger.debug(`HTML gerado com ${html.length} caracteres`);
			this.view.webview.html = html;
			
			this.logger.info('Conteúdo do webview atualizado com sucesso');
		} catch (error) {
			this.logger.error('Failed to update webview content:', error);
			this.view.webview.html = this.webviewBuilder.generateErrorContent();
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

	dispose(): void {
		this.watcher?.dispose();
	}
}
