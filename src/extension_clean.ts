// import * as vscode from 'vscode';
// import { Logger } from './utils/logger';
// import { ConfigManager } from './managers/configManager';
// import { CommandsViewProvider } from './providers/commandsViewProvider';
// import { TerminalViewProvider } from './providers/terminalViewProvider';

// export function activate(context: vscode.ExtensionContext): void {
// 	const outputChannel = vscode.window.createOutputChannel('CickCMD');
// 	const logger = new Logger(outputChannel);
	
// 	logger.info('CickCMD activating...');

// 	try {
// 		const configManager = new ConfigManager(logger);
// 		const commandsViewProvider = new CommandsViewProvider(context, configManager, logger);
// 		const terminalViewProvider = new TerminalViewProvider(context, logger);

// 		logger.info('Registering WebviewViewProviders...');
		
// 		// Register Commands View Provider
// 		const commandsViewDisposable = vscode.window.registerWebviewViewProvider(
// 			CommandsViewProvider.viewType, 
// 			commandsViewProvider, 
// 			{ webviewOptions: { retainContextWhenHidden: true } }
// 		);
		
// 		// Register Terminal View Provider (disabled but preserved)
// 		const terminalViewDisposable = vscode.window.registerWebviewViewProvider(
// 			TerminalViewProvider.viewType, 
// 			terminalViewProvider, 
// 			{ webviewOptions: { retainContextWhenHidden: true } }
// 		);
		
// 		context.subscriptions.push(commandsViewDisposable, terminalViewDisposable);
// 		logger.info('WebviewViewProviders registered successfully');

// 		// Register commands
// 		const commands = [
// 			vscode.commands.registerCommand('cickcmd.openConfig', () => configManager.openConfigFile()),
// 			vscode.commands.registerCommand('cickcmd.refresh', () => commandsViewProvider.refresh()),
// 			vscode.commands.registerCommand('cickcmd.openPanel', () => 
// 				vscode.commands.executeCommand('workbench.panel.cickcmd-panel.focus')
// 			),
// 			vscode.commands.registerCommand('cickcmd.clearTemporary', () => configManager.clearTemporary()),
// 			vscode.commands.registerCommand('cickcmd.runCommand', async (commandName?: string) => {
// 				if (!commandName) {
// 					// If no command passed, show list to choose from
// 					const config = await configManager.readConfig();
// 					const effective = configManager.getEffectiveConfig(config);
// 					const commandNames = Object.keys(effective.commands);
					
// 					if (commandNames.length === 0) {
// 						vscode.window.showWarningMessage('No commands found in .cmmds');
// 						return;
// 					}
					
// 					const selected = await vscode.window.showQuickPick(commandNames, {
// 						placeHolder: 'Select a command to execute'
// 					});
					
// 					if (selected) {
// 						await commandsViewProvider.runCommandByName(selected);
// 					}
// 				} else {
// 					// Execute specific command
// 					await commandsViewProvider.runCommandByName(commandName);
// 				}
// 			})
// 		];

// 		context.subscriptions.push(...commands, outputChannel);
// 		logger.info('CickCMD activated successfully');
// 	} catch (error) {
// 		logger.error('Failed to activate CickCMD:', error);
// 	}
// }

// export function deactivate(): void {
// 	// Cleanup resources if needed
// }
