'use strict';
import * as vscode from 'vscode';
var exec = require('child_process').execFile;


export function activate(context: vscode.ExtensionContext) {


    let disposable = vscode.commands.registerCommand('extension.launch', () => {

        //TODO: Make this dynamic (Ask via vscode.window.showInputBox and store that value) 
        var path = 'C:\\Program Files\\LOVE\\love.exe';
        
        console.log(path);
        exec(path, [vscode.workspace.rootPath], function(err, data) {  
            console.log(err)
            console.log(data.toString());                       
        });  
        
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
}