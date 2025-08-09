export class WebviewScript {
	generate(nonce: string): string {
		return `<script nonce="${nonce}">
			const vscode = acquireVsCodeApi();

			// Get initial state from server-side rendered content
			const initialButton = document.getElementById('toggleTerminalBtn');
			let runInCurrentTerminal = initialButton.classList.contains('btn-toggle-active');

			// Terminal toggle functionality
			const toggleTerminalBtn = document.getElementById('toggleTerminalBtn');
			const toggleTerminalState = () => {
				runInCurrentTerminal = !runInCurrentTerminal;
				console.log('Toggling to:', runInCurrentTerminal);
				updateTerminalButton();
				vscode.postMessage({ type: 'toggleRunMode', value: runInCurrentTerminal });
			};

			const updateTerminalButton = () => {
				const textSpan = toggleTerminalBtn.querySelector('.btn-text');
				if (runInCurrentTerminal) {
					// Active state: Current Terminal (blue)
					toggleTerminalBtn.className = 'btn btn-toggle-active toggle-terminal-btn';
					if (textSpan) textSpan.textContent = 'Current Terminal';
				} else {
					// Inactive state: Create Terminals (red)
					toggleTerminalBtn.className = 'btn btn-toggle-inactive toggle-terminal-btn';
					if (textSpan) textSpan.textContent = 'Create Terminals';
				}
			};

			// Event delegation for dynamic content
			const setupEventDelegation = () => {
				document.addEventListener('click', handleClick);
				document.addEventListener('keypress', handleKeypress);
			};

			const handleClick = (event) => {
				const target = event.target;
				const button = target.closest('button');
				
				if (!button) return;

				// Header buttons
				if (button.id === 'toggleTerminalBtn') {
					toggleTerminalState();
				} else if (button.id === 'openConfigBtn') {
					vscode.postMessage({ type: 'openConfig' });
				} else if (button.id === 'refreshBtn') {
					vscode.postMessage({ type: 'refresh' });
				} else if (button.id === 'clearTempBtn') {
					handleClearTemp();
				}
				// Command buttons
				else if (button.classList.contains('edit-btn')) {
					handleEditButton(button);
				} else if (button.classList.contains('clear-override-btn')) {
					handleClearOverride(button);
				} else if (button.classList.contains('run-btn')) {
					handleRunButton(button);
				} else if (button.classList.contains('save-override-btn')) {
					handleSaveOverride(button);
				}
			};

			const handleKeypress = (event) => {
				if (event.key === 'Enter' && event.target.classList.contains('override-input')) {
					const name = event.target.dataset.name;
					vscode.postMessage({ type: 'override', name, value: event.target.value });
				}
			};

			const handleClearTemp = () => {
				console.log('Clear Changes button clicked!');
				if (confirm('Clear all temporary overrides and reset to default settings?')) {
					console.log('User confirmed, clearing temporary overrides...');
					document.querySelectorAll('.clear-override-btn').forEach(clearBtn => {
						const name = clearBtn.dataset.name;
						const input = document.querySelector('.override-input[data-name="' + name + '"]');
						if (input && input.value.trim() !== '') {
							input.value = '';
							vscode.postMessage({ type: 'override', name, value: '' });
						}
					});
					console.log('All temporary overrides cleared');
				} else {
					console.log('User cancelled clear operation');
				}
			};

			const handleEditButton = (button) => {
				const row = button.closest('.command-row');
				const editArea = row.querySelector('.command-edit');
				const isVisible = editArea.style.display === 'flex';
				editArea.style.display = isVisible ? 'none' : 'flex';
				
				if (!isVisible) {
					const input = editArea.querySelector('.override-input');
					setTimeout(() => input.focus(), 100);
				}
			};

			const handleClearOverride = (button) => {
				const name = button.dataset.name;
				const input = document.querySelector('.override-input[data-name="' + name + '"]');
				input.value = '';
				vscode.postMessage({ type: 'override', name, value: '' });
			};

			const handleRunButton = (button) => {
				const name = button.dataset.name;
				vscode.postMessage({ type: 'run', name });
			};

			const handleSaveOverride = (button) => {
				const name = button.dataset.name;
				const input = document.querySelector('.override-input[data-name="' + name + '"]');
				vscode.postMessage({ type: 'override', name, value: input.value });
			};

			// Initialize when DOM is ready
			if (document.readyState === 'loading') {
				document.addEventListener('DOMContentLoaded', setupEventDelegation);
			} else {
				setupEventDelegation();
			}
		</script>`;
	}
}
