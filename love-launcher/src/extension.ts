import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as os from 'os';

let currentInstances: Map<number, cp.ChildProcess> = new Map();

const FIRST_RUN_KEY = 'lövelauncher.firstRunCompleted';

function checkFirstRun(context: vscode.ExtensionContext): boolean {
	return !context.globalState.get<boolean>(FIRST_RUN_KEY, false);
}

async function showWelcomeMessage(context: vscode.ExtensionContext): Promise<boolean> {
	const platform = os.platform();

	let message: string;
	let needsConfiguration: boolean;

	if (platform === 'darwin') {
		message = 'Welcome to LOVE Launcher! On macOS, the extension works out of the box. Press Alt+L to launch your LOVE project.';
		needsConfiguration = false;
	} else if (platform === 'win32') {
		message = 'Welcome to LOVE Launcher! Please configure the path to your LOVE executable to get started.';
		needsConfiguration = true;
	} else {
		message = 'Welcome to LOVE Launcher! Please configure the path to your LOVE executable (or ensure "love" is in your PATH).';
		needsConfiguration = true;
	}

	const buttons: string[] = needsConfiguration
		? ['Open Settings', 'Dismiss']
		: ['OK'];

	const result = await vscode.window.showInformationMessage(message, ...buttons);

	if (result === 'Open Settings') {
		await vscode.commands.executeCommand(
			'workbench.action.openSettings',
			'lövelauncher.path'
		);
	}

	await context.globalState.update(FIRST_RUN_KEY, true);

	return needsConfiguration;
}

export function activate(context: vscode.ExtensionContext) {

	var maxInstances: number = Number(vscode.workspace.getConfiguration('lövelauncher').get('maxInstances'));
	var overwrite: boolean = Boolean(vscode.workspace.getConfiguration('lövelauncher').get('overwrite'));
	
	let disposable = vscode.commands.registerCommand('lövelauncher.launch', async () => {
		// Check for first run and show welcome message
		if (checkFirstRun(context)) {
			const needsConfiguration = await showWelcomeMessage(context);
			if (needsConfiguration) {
				return;
			}
		}

		// Get the directory of the currently active file as fallback
		let actDocPath = vscode.window.activeTextEditor?.document.uri.fsPath;
		if (actDocPath) {
			actDocPath = path.dirname(actDocPath);
		}
		// Check if we have a valid path to work with
		if (actDocPath !== undefined) {

			if (currentInstances.size < maxInstances || overwrite) {
				const lovePath: string = String(vscode.workspace.getConfiguration('lövelauncher').get('path'));
				const useConsoleSubsystem: boolean = Boolean(vscode.workspace.getConfiguration('lövelauncher').get('useConsoleSubsystem'));
				const saveAllOnLaunch: boolean = Boolean(vscode.workspace.getConfiguration('lövelauncher').get('saveAllOnLaunch'));

				if (saveAllOnLaunch) {
					vscode.workspace.saveAll();
				}

				if (overwrite) {
					currentInstances.forEach((instance) => {
						if (!instance.killed) {
							instance.kill();
						}
					});
					currentInstances.clear();
				}

				const Folders = vscode.workspace.workspaceFolders;
				let loveProjectPath = actDocPath;
				if (Folders) {
					loveProjectPath = Folders[0].uri.fsPath;
				}

				let process: cp.ChildProcess;
				const platform = os.platform();

				if (platform === 'win32') {
					const args = useConsoleSubsystem ? [loveProjectPath, "--console"] : [loveProjectPath];
					process = cp.spawn(lovePath, args);
				} else if (platform === 'darwin') {
					process = cp.spawn('open', ['-n', '-a', 'love', '--args', loveProjectPath]);
				} else {
					// Linux and other Unix-like systems
					process = cp.spawn(lovePath, [loveProjectPath]);
				}

				if (process.pid) {
					currentInstances.set(process.pid, process);
				}

				process.on('error', (err: Error) => {
					vscode.window.showErrorMessage(`Failed to launch LOVE: ${err.message}`);
					if (process.pid) {
						currentInstances.delete(process.pid);
					}
				});

				process.on('exit', () => {
					if (process.pid) {
						currentInstances.delete(process.pid);
					}
				});
			} else {
				vscode.window.showErrorMessage("You have reached your max concurrent Löve instances. You can change this setting in your config.");
			}
		} else {
			/* Undefined workspace folder leads to error msg. */
			vscode.window.showErrorMessage("vscode.workspace.workspaceFolders is undefined. Please check that you have opened you project as a workspace.");
		}

	});

	context.subscriptions.push(disposable);
}
