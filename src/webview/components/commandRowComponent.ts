import { IconHelper } from '../helpers/iconHelper';
import { HtmlHelper } from '../helpers/htmlHelper';

export class CommandRowComponent {
	constructor(
		private iconHelper: IconHelper,
		private htmlHelper: HtmlHelper
	) {}

	generate(name: string, cmd: string, tempValue: string, hasTemporaryOverride: boolean): string {
		const escapedValue = this.htmlHelper.escapeHtml(tempValue);
		const displayName = hasTemporaryOverride ? `${name}*` : name;
		const nameClass = hasTemporaryOverride ? 'command-name-temporary' : 'command-name';
		
		return `
			<div class="command-row">
				<div class="command-header">
					<div class="command-info">
						<div class="command-name-row">
							<span class="${nameClass}">${this.htmlHelper.escapeHtml(displayName)}</span>:
							<code class="command-preview">${this.htmlHelper.escapeHtml(cmd.length > 50 ? cmd.substring(0, 50) + '...' : cmd)}</code>
						</div>
					</div>
					<div class="command-actions">
						<button class="btn btn-secondary edit-btn" data-name="${this.htmlHelper.escapeHtml(name)}" title="Edit command">
							${this.iconHelper.getIconSvg('edit')}
						</button>
						<button class="btn btn-secondary clear-override-btn" data-name="${this.htmlHelper.escapeHtml(name)}" title="Clear override">
							${this.iconHelper.getIconSvg('close')}
						</button>
						<button class="btn btn-primary run-btn" data-name="${this.htmlHelper.escapeHtml(name)}">
							${this.iconHelper.getIconSvg('play_arrow')}
							<span class="btn-text">Run</span>
						</button>
					</div>
				</div>
				<div class="command-edit">
					<input 
						class="override-input" 
						data-name="${this.htmlHelper.escapeHtml(name)}" 
						type="text" 
						placeholder="Temporary override..."
						value="${escapedValue}"
					/>
					<button class="btn btn-secondary save-override-btn" data-name="${this.htmlHelper.escapeHtml(name)}" title="Save override">
						${this.iconHelper.getIconSvg('save')}
					</button>
				</div>
			</div>
		`;
	}

	generateEmptyState(): string {
		return `<div class="empty-state">${this.iconHelper.getIconSvg('code')} No commands found. Click "Edit" to add commands.</div>`;
	}
}
