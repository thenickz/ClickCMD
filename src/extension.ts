// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as yaml from 'js-yaml';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "botoes-para-comandos" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('botoes-para-comandos.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from ClickCmds — Botões para Comandos!');
	});

	context.subscriptions.push(disposable);
}

type Cmmds = {
	settings?: { runInCurrentTerminal?: boolean };
	commands?: Record<string, string>;
	temporary?: {
		settings?: { runInCurrentTerminal?: boolean };
		commands?: Record<string, string>;
	};
};

class ConfigManager {
	private readonly fileName = '.cmmds';
	private readonly workspaceFolder: vscode.WorkspaceFolder | undefined;

	constructor() {
		this.workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	}

	getUri(): vscode.Uri | undefined {
		if (!this.workspaceFolder) return undefined;
		return vscode.Uri.joinPath(this.workspaceFolder.uri, this.fileName);
	}

	async ensureSample(): Promise<void> {
		const uri = this.getUri();
		if (!uri) return;
		try {
			await vscode.workspace.fs.stat(uri);
			return;
		} catch {
			const sample: Cmmds = {
				settings: { runInCurrentTerminal: true },
				commands: {
					"build": "echo Building...",
					"test": "echo Running tests...",
					"deploy": "echo Deploying..."
				},
				temporary: {
					settings: { },
					commands: { }
				}
			};
			const content = new TextEncoder().encode('# Arquivo de comandos ClickCmds (.cmmds)\n' + yaml.dump(sample));
			await vscode.workspace.fs.writeFile(uri, content);
		}
	}

	async read(): Promise<Cmmds> {
		const uri = this.getUri();
		if (!uri) return {};
		try {
			const bytes = await vscode.workspace.fs.readFile(uri);
			const text = new TextDecoder('utf-8').decode(bytes);
			const data = (yaml.load(text) as Cmmds) || {};
			return data;
		} catch {
			return {};
		}
	}

	async write(updated: Cmmds): Promise<void> {
		const uri = this.getUri();
		if (!uri) return;
		const content = new TextEncoder().encode(yaml.dump(updated));
		await vscode.workspace.fs.writeFile(uri, content);
	}

	mergeEffective(cfg: Cmmds): { commands: Record<string, string>; runInCurrentTerminal: boolean } {
		const baseCmds = cfg.commands ?? {};
		const tmpCmds = cfg.temporary?.commands ?? {};
		const commands = { ...baseCmds, ...tmpCmds };
		const baseRun = cfg.settings?.runInCurrentTerminal;
		const tmpRun = cfg.temporary?.settings?.runInCurrentTerminal;
		const runInCurrentTerminal = tmpRun ?? baseRun ?? true;
		return { commands, runInCurrentTerminal };
	}

	async setTempCommand(name: string, value: string | undefined) {
		const cfg = await this.read();
		cfg.temporary = cfg.temporary ?? {};
		cfg.temporary.commands = cfg.temporary.commands ?? {};
		if (!value || value.trim() === '') {
			delete cfg.temporary.commands[name];
		} else {
			cfg.temporary.commands[name] = value;
		}
		await this.write(cfg);
	}

	async setTempRunInCurrentTerminal(value: boolean) {
		const cfg = await this.read();
		cfg.temporary = cfg.temporary ?? {};
		cfg.temporary.settings = cfg.temporary.settings ?? {};
		cfg.temporary.settings.runInCurrentTerminal = value;
		await this.write(cfg);
	}
}

class ClickCmdsViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'clickcmds.view';
	private view?: vscode.WebviewView;
	private watcher?: vscode.FileSystemWatcher;

	constructor(private readonly context: vscode.ExtensionContext, private readonly config: ConfigManager) {}

	resolveWebviewView(webviewView: vscode.WebviewView) {
		this.view = webviewView;
		const webview = webviewView.webview;
		webview.options = { enableScripts: true, localResourceRoots: [this.context.extensionUri] };
		this.setHtml();

		webview.onDidReceiveMessage(async (msg) => {
			switch (msg.type) {
				case 'run':
					await this.runCommand(msg.name);
					break;
				case 'override': {
					await this.config.setTempCommand(msg.name, msg.value);
					await this.refresh();
					break;
				}
				case 'toggleRunMode': {
					await this.config.setTempRunInCurrentTerminal(!!msg.value);
					await this.refresh();
					break;
				}
				case 'openConfig':
					await openConfig(this.config);
					break;
				case 'refresh':
					await this.refresh();
					break;
			}
		});

		this.setupWatcher();
	}

	private setupWatcher() {
		const uri = this.config.getUri();
		if (!uri) return;
		this.watcher?.dispose();
		this.watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.workspace.workspaceFolders![0], '.cmmds'));
		this.watcher.onDidChange(() => this.refresh());
		this.watcher.onDidCreate(() => this.refresh());
		this.watcher.onDidDelete(() => this.refresh());
	}

	async refresh() {
		await this.setHtml();
	}

	private async setHtml() {
		await this.config.ensureSample();
		const data = await this.config.read();
		const eff = this.config.mergeEffective(data);

		const iconUri = this.context.asAbsolutePath('media/clickcmds.svg');
		const nonce = String(Math.random()).slice(2);

		const rows = Object.entries(eff.commands).map(([name, cmd]) => `
			<div class="row">
				<div class="cmd-name" title="${name}">${name}</div>
				<button class="run" data-name="${name}">Executar</button>
				<input class="override" data-name="${name}" type="text" placeholder="override temporário" value="${(data.temporary?.commands?.[name] ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')}" />
				<button class="eye" data-name="${name}" title="Salvar override temporário">👁</button>
			</div>
		`).join('');

		const html = `<!DOCTYPE html>
		<html lang="pt-br">
		<head>
			<meta charset="UTF-8" />
			<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${this.view?.webview.cspSource} 'self' data:; style-src 'unsafe-inline' ${this.view?.webview.cspSource}; script-src 'nonce-${nonce}';" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			<title>ClickCmds</title>
			<style>
				body { font-family: var(--vscode-font-family); padding: 8px; }
				.header { display:flex; gap:8px; align-items:center; margin-bottom: 8px; }
				.row { display:flex; gap:8px; align-items:center; margin: 6px 0; }
				.cmd-name { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
				.run, .eye { padding: 4px 8px; }
				.override { flex:2; }
			</style>
		</head>
		<body>
			<div class="header">
				<strong>ClickCmds</strong>
				<label style="margin-left:auto;">
					<input id="runInCurrent" type="checkbox" ${eff.runInCurrentTerminal ? 'checked' : ''} /> usar terminal atual
				</label>
				<button id="openConfig">Abrir .cmmds</button>
				<button id="refresh">Recarregar</button>
			</div>
			<div>${rows || '<em>Nenhum comando encontrado em .cmmds</em>'}</div>
			<script nonce="${nonce}">
				const vscode = acquireVsCodeApi();
				document.getElementById('openConfig').addEventListener('click', () => vscode.postMessage({ type: 'openConfig' }));
				document.getElementById('refresh').addEventListener('click', () => vscode.postMessage({ type: 'refresh' }));
				document.getElementById('runInCurrent').addEventListener('change', (e) => {
					vscode.postMessage({ type: 'toggleRunMode', value: e.target.checked });
				});
				for (const btn of document.querySelectorAll('button.run')) {
					btn.addEventListener('click', () => {
						vscode.postMessage({ type: 'run', name: btn.dataset.name });
					});
				}
				for (const eye of document.querySelectorAll('button.eye')) {
					eye.addEventListener('click', () => {
						const name = eye.dataset.name;
						const input = document.querySelector('input.override[data-name="' + name + '"]');
						vscode.postMessage({ type: 'override', name, value: input.value });
					});
				}
			</script>
		</body>
		</html>`;

		this.view!.webview.html = html;
	}

	private async runCommand(name: string) {
		const cfg = await this.config.read();
		const eff = this.config.mergeEffective(cfg);
		const cmd = eff.commands[name];
		if (!cmd) {
			vscode.window.showWarningMessage(`Comando não encontrado: ${name}`);
			return;
		}

		if (eff.runInCurrentTerminal) {
			let term = vscode.window.activeTerminal;
			if (!term) term = vscode.window.createTerminal({ name: 'ClickCmds' });
			term.show(true);
			term.sendText(cmd, true);
		} else {
			const term = vscode.window.createTerminal({ name: `ClickCmds:${name}`, hideFromUser: true });
			term.sendText(cmd, true);
		}
	}
}

async function openConfig(config: ConfigManager) {
	const uri = config.getUri();
	if (!uri) {
		vscode.window.showWarningMessage('Nenhuma pasta de workspace aberta.');
		return;
	}
	await config.ensureSample();
	await vscode.window.showTextDocument(uri);
}
