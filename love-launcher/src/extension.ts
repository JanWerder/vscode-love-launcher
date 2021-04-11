'use strict';
import * as vscode from 'vscode';
var exec = require('child_process').execFile;
let currentInstances = [];
/* 
This method is called when extension is activated. The extension is activated the very first
time the command is executed - BUT ONCE ONLY! 
*/
export function activate(context: vscode.ExtensionContext) {
    var maxInstances = vscode.workspace.getConfiguration('lövelauncher').get('maxInstances');
    var overWrite = vscode.workspace.getConfiguration('lövelauncher').get('overWrite');
    /* 
    The command has been defined in the package.json file. Now provide the implementation of the
    command with registerCommand. The commandId parameter must match the command field in package.json.
    */
    let disposable = vscode.commands.registerCommand('lövelauncher.launch', () => {
        /* Code placed here will be executed every time the command is executed. */
        /* 
        Since "vscode.workspace.rootPath" has been deprecated, "vscode.workspace.workspaceFolders" should be used.
        However, due to the multi-root workspaces of VSCode, it would be more prudent to identify the current active
        file (being open in the VSCode editor), and look for it's root folder amongst the others. Start by getting 
        the currently-being-edited document from the VSCode editor.
        */
        var ActDocPath = vscode.window.activeTextEditor.document.uri.fsPath;
        /* Check if a workspace folder has been opened and is active; 'undefined' leads to error msg - see furhter down. */
        if (ActDocPath != undefined) {        
            /* 
            Since the above uri path includes the reference to the actual file being edited (as: 
            ...\<workspace root>\<filename.extension>), we have to find the last "\" (MS) or "/" (Mac or Unix) in the uri 
            string and cut off all characters thereafter, to only have the folder uri (as: ...\<workspace root>).
            */
            var pathlen = ActDocPath.length;
            for (let i = 0; i < pathlen; i++) {
                /* Search from end of uri string to beginning (right to left) */
                var char2eval = actvDocPath.charAt(pathlen - i);
                if (char2eval == '\\' || char2eval == '/' ) {
                    /* After finding the first "\" OR "/" (from the right hand side), slice off all text after that. */
                    ActDocPath = ActDocPath.slice(0,pathlen-i);
                    break;
                }
            }
            if(currentInstances.length < maxInstances || overWrite){
                var path : string = vscode.workspace.getConfiguration('lövelauncher').get('path').toString();
                var useConsoleSubsystem = vscode.workspace.getConfiguration('lövelauncher').get('useConsoleSubsystem');
                var saveAllonLaunch = vscode.workspace.getConfiguration('lövelauncher').get('saveAllonLaunch');
                if (saveAllonLaunch){
                    vscode.workspace.saveAll();
                }
                if (overWrite){
                    currentInstances.forEach(function(instance){
                        if (instance != undefined){
                            instance.kill();
                        }
                    });
                }
                if(!useConsoleSubsystem){
                    var process = exec(path, [vscode.workspace.rootPath], function(err, data) {

                    });
                    process.on('exit', on_exit.bind(null,process));
                    currentInstances[process.pid] = process;
                }else{
                    var process = exec(path, [vscode.workspace.rootPath, "--console"], function (err, data) {

                    });
                    process.on('exit', on_exit.bind(null,process));
                    currentInstances[process.pid] = process;
                }
            }else{
                vscode.window.showErrorMessage("You have reached your max concurrent Löve instances. You can change this setting in your config.");
            }
        }else {
            /* Undefined workspace folder leads to error msg. */
            vscode.window.showErrorMessage("vscode.workspace.workspaceFolders is undefined. Please check that you have opened you project as a work space.");
        }
    });
    context.subscriptions.push(disposable);
}

export function deactivate() {
}

function on_exit(oprocess){
    currentInstances.splice(oprocess.pid, 1);
    currentInstances = currentInstances.filter(Boolean);
}