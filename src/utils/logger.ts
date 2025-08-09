import * as vscode from 'vscode';

/**
 * Logger utility for CickCMD extension
 */
export class Logger {
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
