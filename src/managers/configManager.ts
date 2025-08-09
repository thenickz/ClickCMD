import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import { CmmdsConfig, EffectiveConfig } from '../types';
import { Logger } from '../utils/logger';

/**
 * Manages .cmmds configuration file operations
 */
export class ConfigManager {
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

			const yamlContent = '# CickCMD Configuration\n' + yaml.dump(sampleConfig, {
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

	getEffectiveConfig(config: CmmdsConfig): EffectiveConfig {
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
