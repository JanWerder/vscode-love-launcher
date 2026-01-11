import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

let currentInstances: Map<number, cp.ChildProcess> = new Map();
let statusBarItem: vscode.StatusBarItem | undefined;
let outputChannel: vscode.OutputChannel | undefined;

const FIRST_RUN_KEY = 'lövelauncher.firstRunCompleted';
const FLATPAK_APP_ID = 'org.love2d.love2d';
const FLATPAK_MARKER = '__flatpak__';

function isFlatpakInstalled(): boolean {
	const flatpakPath = findExecutableInPath('flatpak');
	if (!flatpakPath) {
		return false;
	}

	try {
		const result = cp.spawnSync('flatpak', ['info', FLATPAK_APP_ID], {
			encoding: 'utf-8',
			timeout: 5000
		});
		return result.status === 0;
	} catch {
		return false;
	}
}

function getDefaultLovePath(): string {
	const platform = os.platform();
	if (platform === 'win32') {
		return 'C:\\Program Files\\LOVE\\love.exe';
	} else if (platform === 'darwin') {
		return 'love';
	} else {
		return 'love';
	}
}

function findExecutableInPath(executable: string): string | null {
	const pathEnv = process.env.PATH || '';
	const pathSeparator = os.platform() === 'win32' ? ';' : ':';
	const paths = pathEnv.split(pathSeparator);

	for (const dir of paths) {
		const fullPath = path.join(dir, executable);
		if (fs.existsSync(fullPath)) {
			try {
				fs.accessSync(fullPath, fs.constants.X_OK);
				return fullPath;
			} catch {
				continue;
			}
		}
	}
	return null;
}

function validateLovePath(lovePath: string, platform: string): { valid: boolean; resolvedPath: string; isFlatpak?: boolean; error?: string } {
	if (platform === 'darwin') {
		return { valid: true, resolvedPath: lovePath };
	}

	if (path.isAbsolute(lovePath)) {
		if (fs.existsSync(lovePath)) {
			return { valid: true, resolvedPath: lovePath };
		}
		return {
			valid: false,
			resolvedPath: lovePath,
			error: `LOVE executable not found at: ${lovePath}`
		};
	}

	const resolvedPath = findExecutableInPath(lovePath);
	if (resolvedPath) {
		return { valid: true, resolvedPath };
	}

	if (platform === 'linux') {
		if (isFlatpakInstalled()) {
			return { valid: true, resolvedPath: FLATPAK_MARKER, isFlatpak: true };
		}

		return {
			valid: false,
			resolvedPath: lovePath,
			error: `LOVE executable "${lovePath}" not found in PATH. Install LOVE (e.g., 'sudo apt install love' or 'flatpak install flathub org.love2d.love2d') or set the full path in settings.`
		};
	}

	return {
		valid: false,
		resolvedPath: lovePath,
		error: `LOVE executable "${lovePath}" not found. Please configure the correct path in settings.`
	};
}

function checkFirstRun(context: vscode.ExtensionContext): boolean {
	return !context.globalState.get<boolean>(FIRST_RUN_KEY, false);
}

function isLoveProject(): boolean {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) {
		return false;
	}

	const rootPath = workspaceFolders[0].uri.fsPath;
	const mainLuaPath = path.join(rootPath, 'main.lua');
	const confLuaPath = path.join(rootPath, 'conf.lua');

	return fs.existsSync(mainLuaPath) || fs.existsSync(confLuaPath);
}

function updateStatusBar(): void {
	if (!isLoveProject()) {
		statusBarItem?.hide();
		return;
	}

	if (!statusBarItem) {
		statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	}

	if (currentInstances.size > 0) {
		statusBarItem.text = '$(debug-stop) Stop LOVE';
		statusBarItem.tooltip = 'Stop running LOVE instance';
		statusBarItem.command = 'lövelauncher.stop';
	} else {
		statusBarItem.text = '$(play) Run LOVE';
		statusBarItem.tooltip = 'Launch LOVE project (Alt+L)';
		statusBarItem.command = 'lövelauncher.launch';
	}
	statusBarItem.show();
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

	outputChannel = vscode.window.createOutputChannel('LOVE');
	context.subscriptions.push(outputChannel);

	updateStatusBar();

	const fileWatcher = vscode.workspace.createFileSystemWatcher('**/{main,conf}.lua');
	fileWatcher.onDidCreate(() => updateStatusBar());
	fileWatcher.onDidDelete(() => updateStatusBar());
	context.subscriptions.push(fileWatcher);

	vscode.workspace.onDidChangeWorkspaceFolders(() => updateStatusBar());

	const stopCommand = vscode.commands.registerCommand('lövelauncher.stop', () => {
		currentInstances.forEach((instance) => {
			if (!instance.killed) {
				instance.kill();
			}
		});
		currentInstances.clear();
		updateStatusBar();
	});
	context.subscriptions.push(stopCommand);

	const saveListener = vscode.workspace.onDidSaveTextDocument((document) => {
		const autoRestart = Boolean(vscode.workspace.getConfiguration('lövelauncher').get('autoRestartOnSave'));

		if (autoRestart && document.languageId === 'lua' && currentInstances.size > 0) {
			vscode.commands.executeCommand('lövelauncher.launch');
		}
	});
	context.subscriptions.push(saveListener);

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
				const platform = os.platform();
				let lovePath: string = String(vscode.workspace.getConfiguration('lövelauncher').get('path'));

				const windowsDefault = 'C:\\Program Files\\LOVE\\love.exe';
				if (lovePath === windowsDefault && platform !== 'win32') {
					lovePath = getDefaultLovePath();
				}

				const validation = validateLovePath(lovePath, platform);
				if (!validation.valid) {
					const result = await vscode.window.showErrorMessage(
						validation.error || 'LOVE executable not found.',
						'Open Settings'
					);
					if (result === 'Open Settings') {
						await vscode.commands.executeCommand(
							'workbench.action.openSettings',
							'lövelauncher.path'
						);
					}
					return;
				}

				const resolvedLovePath = validation.resolvedPath;
				const useFlatpak = validation.isFlatpak === true;
				const useConsoleSubsystem: boolean = Boolean(vscode.workspace.getConfiguration('lövelauncher').get('useConsoleSubsystem'));
				const saveAllOnLaunch: boolean = Boolean(vscode.workspace.getConfiguration('lövelauncher').get('saveAllOnLaunch'));
				const customArgsStr: string = String(vscode.workspace.getConfiguration('lövelauncher').get('customArgs') || '');
				const customArgs: string[] = customArgsStr.split(/\s+/).filter(arg => arg.length > 0);

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
					outputChannel?.clear();
				}

				const Folders = vscode.workspace.workspaceFolders;
				let loveProjectPath = actDocPath;
				if (Folders) {
					loveProjectPath = Folders[0].uri.fsPath;
				}

				let process: cp.ChildProcess;

				if (platform === 'win32') {
					const args = useConsoleSubsystem ? [loveProjectPath, "--console", ...customArgs] : [loveProjectPath, ...customArgs];
					process = cp.spawn(resolvedLovePath, args);
				} else if (platform === 'darwin') {
					process = cp.spawn('open', ['-n', '-a', 'love', '--args', loveProjectPath, ...customArgs]);
				} else if (useFlatpak) {
					process = cp.spawn('flatpak', ['run', FLATPAK_APP_ID, loveProjectPath, ...customArgs]);
				} else {
					process = cp.spawn(resolvedLovePath, [loveProjectPath, ...customArgs]);
				}

				if (process.pid) {
					currentInstances.set(process.pid, process);
					updateStatusBar();
				}

				if (process.stdout) {
					process.stdout.on('data', (data: Buffer) => {
						outputChannel?.append(data.toString());
					});
				}
				if (process.stderr) {
					process.stderr.on('data', (data: Buffer) => {
						outputChannel?.append(data.toString());
					});
				}
				outputChannel?.show(true);

				process.on('error', async (err: Error) => {
					const result = await vscode.window.showErrorMessage(
						`Failed to launch LOVE: ${err.message}`,
						'Open Settings'
					);
					if (result === 'Open Settings') {
						await vscode.commands.executeCommand(
							'workbench.action.openSettings',
							'lövelauncher.path'
						);
					}
					if (process.pid) {
						currentInstances.delete(process.pid);
					}
					updateStatusBar();
				});

				process.on('exit', () => {
					if (process.pid) {
						currentInstances.delete(process.pid);
					}
					updateStatusBar();
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

	if (statusBarItem) {
		context.subscriptions.push(statusBarItem);
	}
}

export function deactivate() {
	statusBarItem?.dispose();
}
