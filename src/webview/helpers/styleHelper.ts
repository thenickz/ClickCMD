import * as vscode from 'vscode';

export class StyleHelper {
	constructor(private context: vscode.ExtensionContext) {}

	getStyles(): string {
		// For now, return inline styles until we implement proper asset loading
		// In the future, this could load from separate CSS files via webview.asWebviewUri
		return `<style>
			/* CSS Variables for VS Code Theme Integration */
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

			/* Base styles and layout */
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

			/* Button component styles */
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

			.btn svg {
				flex-shrink: 0;
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
				background: #2f3fd3ff;
				color: #ffffff;
				border-color: #2f3fd3ff;
			}

			.btn-toggle-inactive:hover { 
				background: #273ae9ff; 
			}

			/* Header component styles */
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

			/* Command row component styles */
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

			/* Responsive design styles */
			@media (max-width: 350px) {
				.header {
					gap: 6px;
				}
				.header-controls {
					gap: 3px;
				}
			}

			@media (max-width: 300px) {
				.command-preview {
					display: none;
				}
			}

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

			@media (min-width: 250px) {
				.command-edit {
					flex-direction: row;
					align-items: center;
				}
			}
		</style>`;
	}
}
