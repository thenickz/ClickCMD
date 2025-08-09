/**
 * Type definitions for CickCMD extension
 */

export interface CommandConfig {
	name: string;
	command: string;
	description?: string;
}

export interface CmmdsConfig {
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

export interface WebviewMessage {
	type: 'run' | 'override' | 'toggleRunMode' | 'openConfig' | 'refresh' | 'clearTemporary';
	name?: string;
	value?: string | boolean;
}

export interface EffectiveConfig {
	commands: Record<string, string>;
	runInCurrentTerminal: boolean;
}
