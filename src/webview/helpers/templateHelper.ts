import * as fs from 'fs';
import * as path from 'path';

export class TemplateHelper {
	private readonly templatesDir: string;

	constructor(contextPath: string) {
		this.templatesDir = path.join(contextPath, 'src', 'webview', 'templates');
	}

	loadTemplate(templateName: string): string {
		const filePath = path.join(this.templatesDir, `${templateName}.html`);
		try {
			return fs.readFileSync(filePath, 'utf-8');
		} catch (error) {
			console.error(`Could not load template: ${templateName}`);
			return '';
		}
	}

	replaceTokens(template: string, tokens: Record<string, string>): string {
		let result = template;
		Object.keys(tokens).forEach(token => {
			const regex = new RegExp(`{{${token}}}`, 'g');
			result = result.replace(regex, tokens[token]);
		});
		return result;
	}
}
