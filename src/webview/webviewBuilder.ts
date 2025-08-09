import * as vscode from 'vscode';
import { CmmdsConfig, EffectiveConfig } from '../types';
import { IconHelper } from './helpers/iconHelper';
import { HtmlHelper } from './helpers/htmlHelper';
import { StyleHelper } from './helpers/styleHelper';
import { TemplateHelper } from './helpers/templateHelper';
import { HeaderComponent } from './components/headerComponent';
import { CommandRowComponent } from './components/commandRowComponent';
import { WebviewScript } from './scripts/webviewScript';

export class WebviewBuilder {
	private iconHelper: IconHelper;
	private htmlHelper: HtmlHelper;
	private styleHelper: StyleHelper;
	private templateHelper: TemplateHelper;
	private headerComponent: HeaderComponent;
	private commandRowComponent: CommandRowComponent;
	private webviewScript: WebviewScript;

	constructor(private context: vscode.ExtensionContext) {
		this.iconHelper = new IconHelper();
		this.htmlHelper = new HtmlHelper();
		this.styleHelper = new StyleHelper(context);
		this.templateHelper = new TemplateHelper(context.extensionPath);
		this.headerComponent = new HeaderComponent(this.iconHelper);
		this.commandRowComponent = new CommandRowComponent(this.iconHelper, this.htmlHelper);
		this.webviewScript = new WebviewScript();
	}

	generateMainContent(config: CmmdsConfig, effective: EffectiveConfig, webview: vscode.Webview): string {
		const nonce = this.htmlHelper.getNonce();
		
		// Determine toggle button state
		const isCurrentTerminal = effective.runInCurrentTerminal;
		const toggleButtonClass = isCurrentTerminal ? 'btn-toggle-active' : 'btn-toggle-inactive';
		const toggleButtonText = isCurrentTerminal ? 'Current Terminal' : 'Create Terminals';
		
		// Generate command rows
		const commandRows = this.generateCommandRows(config, effective);
		const content = commandRows.length > 0 ? commandRows.join('') : this.commandRowComponent.generateEmptyState();
		
		// Load main template
		const template = this.templateHelper.loadTemplate('main');
		
		// Replace tokens
		const tokens = {
			cspSource: webview.cspSource,
			nonce: nonce,
			styles: this.styleHelper.getStyles(),
			header: this.headerComponent.generate(isCurrentTerminal, toggleButtonClass, toggleButtonText),
			content: content,
			script: this.webviewScript.generate(nonce)
		};
		
		return this.templateHelper.replaceTokens(template, tokens);
	}

	generateErrorContent(): string {
		return this.templateHelper.loadTemplate('error');
	}

	private generateCommandRows(config: CmmdsConfig, effective: EffectiveConfig): string[] {
		return Object.entries(effective.commands).map(([name, cmd]) => {
			const tempValue = config.temporary?.commands?.[name] || '';
			const hasTemporaryOverride = config.temporary?.commands?.[name] !== undefined;
			
			return this.commandRowComponent.generate(name, cmd, tempValue, hasTemporaryOverride);
		});
	}
}
