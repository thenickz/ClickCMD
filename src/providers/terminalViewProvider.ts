import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

/**
 * WebView provider for terminal view (currently disabled but preserved)
 */
export class TerminalViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'cickcmd.terminal';
	private view?: vscode.WebviewView;

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly logger: Logger
	) {}

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		this.logger.info('Terminal view resolved (currently disabled)');
		
		this.view = webviewView;
		const webview = webviewView.webview;
		
		webview.options = { 
			enableScripts: true, 
			localResourceRoots: [this.context.extensionUri] 
		};

		// Show disabled message
		this.updateWebviewContent();
	}

	private async updateWebviewContent(): Promise<void> {
		if (!this.view) {
			return;
		}

		this.view.webview.html = this.generateDisabledContent();
	}

	private generateDisabledContent(): string {
		return `<!DOCTYPE html>
		<html lang="pt-br">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>CickCMD - Terminal</title>
			<style>
				body { 
					font-family: var(--vscode-font-family); 
					padding: 20px; 
					color: var(--vscode-foreground); 
					background: var(--vscode-editor-background);
					text-align: center;
				}
				.disabled-message {
					color: var(--vscode-descriptionForeground);
					font-style: italic;
				}
				.icon {
					font-size: 48px;
					margin-bottom: 16px;
				}
			</style>
		</head>
		<body>
			<div class="disabled-message">
				<div class="icon">🚧</div>
				<h3>Terminal View</h3>
				<p>Esta view está temporariamente desabilitada.</p>
				<p>Use a view de Commands para executar comandos.</p>
			</div>
		</body>
		</html>`;
	}

	dispose(): void {
		// Cleanup if needed
	}
}
