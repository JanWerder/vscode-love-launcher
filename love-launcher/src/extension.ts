'use strict';
import * as vscode from 'vscode';
var exec = require('child_process').execFile;


export function activate(context: vscode.ExtensionContext) {

    var isRunning = false;

    let disposable = vscode.commands.registerCommand('lövelauncher.launch', () => {

        if(!isRunning){
            var path = vscode.workspace.getConfiguration('lövelauncher.path')[0];
            
            isRunning = true;
            exec(path, [vscode.workspace.rootPath], function(err, data) {  
                isRunning = false;                 
            });  
        }else{
            vscode.window.showErrorMessage("You still have an active Löve instance");
        }
        
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
}