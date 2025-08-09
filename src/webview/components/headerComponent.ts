import { IconHelper } from '../helpers/iconHelper';

export class HeaderComponent {
	constructor(private iconHelper: IconHelper) {}

	generate(
		isCurrentTerminal: boolean, 
		toggleButtonClass: string, 
		toggleButtonText: string
	): string {
		return `
			<header class="header">
				<h2>
					<span class="target-icon">${this.iconHelper.getIconSvg('gps_fixed')}</span>
					ClickCMD
				</h2>
				<div class="header-controls">
					<button class="btn ${toggleButtonClass} toggle-terminal-btn" id="toggleTerminalBtn">
						${this.iconHelper.getIconSvg('terminal')}
						<span class="btn-text">${toggleButtonText}</span>
					</button>
					<button class="btn btn-outline" id="openConfigBtn">
						${this.iconHelper.getIconSvg('edit')}
						<span class="btn-text">Edit file</span>
					</button>
					<button class="btn btn-outline" id="refreshBtn">
						${this.iconHelper.getIconSvg('refresh')}
						<span class="btn-text">Reload</span>
					</button>
					<button class="btn btn-outline" id="clearTempBtn">
						${this.iconHelper.getIconSvg('cleaning_services')}
						<span class="btn-text">Clear Changes</span>
					</button>
				</div>
			</header>
		`;
	}
}
