import * as vscode from 'vscode';
import cp = require('child_process');
import { ChildProcess } from 'node:child_process';
const os = require('os');

let currentInstances: cp.ChildProcess[] = [];

export function activate(context: vscode.ExtensionContext) {

	var maxInstances: number = Number(vscode.workspace.getConfiguration('lövelauncher').get('maxInstances'));
	var overwrite: boolean = Boolean(vscode.workspace.getConfiguration('lövelauncher').get('overwrite'));
	
	let disposable = vscode.commands.registerCommand('lövelauncher.launch', () => {

		/* 
		Since "vscode.workspace.rootPath" has been deprecated, "vscode.workspace.workspaceFolders" should be used.
		However, due to the multi-root workspaces of VSCode, it would be more prudent to identify the current active
		file (being open in the VSCode editor), and look for it's root folder amongst the others. Start by getting 
		the currently-being-edited document from the VSCode editor.
		*/
		var actDocPath = vscode.window.activeTextEditor?.document.uri.fsPath;
		var pathlen = actDocPath?.length;
		/* 
		Since the above uri path includes the reference to the actual file being edited (as: 
		...\<workspace root>\<filename.extension>), we have to find the last "\" in the uri string
		and cut off all characters thereafter, to only have the folder uri (as: ...\<workspace root>).
		*/

		var pathSeperator: string = (os.platform() === 'win32'? '\\': '/');

		if (pathlen && actDocPath) {
			for (let i = 0; i < pathlen; i++) {
				/* Search from end of uri string to beginning */
				if (actDocPath.charAt(pathlen - i) === pathSeperator) {
					/* After finding the first "\" (from the right hand side), slice off all text after that. */
					actDocPath = actDocPath.slice(0, pathlen - i);
					break;
				}
			}
		}
		/* Check if a workspace folder has been opened and is active; 'undefined' leads to error msg - see furhter down. */
		if (actDocPath !== undefined) {

			if (currentInstances.length < maxInstances || overwrite) {
				var path: string = String(vscode.workspace.getConfiguration('lövelauncher').get('path'));
				var useConsoleSubsystem: boolean = Boolean(vscode.workspace.getConfiguration('lövelauncher').get('useConsoleSubsystem'));
				var saveAllOnLaunch: boolean = Boolean(vscode.workspace.getConfiguration('lövelauncher').get('saveAllOnLaunch'));

				if (saveAllOnLaunch) {
					vscode.workspace.saveAll();
				}

				if (overwrite) {
					currentInstances.forEach(function (instance) {
						if (instance.killed === false) {
							instance.kill();
						}
					});
				}

				var process = null;
				const Folders = vscode.workspace.workspaceFolders;
				let loveProjectPath = actDocPath;
				if (Folders){
					loveProjectPath = Folders[0].uri.fsPath
				}

				if (os.platform() === 'win32'){
					if (!useConsoleSubsystem) {
						process = cp.spawn(path, [loveProjectPath]);
						currentInstances[Number(process.pid)] = process;
					} else {
						process = cp.spawn(path, [loveProjectPath, "--console"]);
						currentInstances[Number(process.pid)] = process;
					}
				}else{
					process = cp.exec('open -n -a love ' + actDocPath);
					currentInstances[Number(process.pid)] = process;
				}
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
