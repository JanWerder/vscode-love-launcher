'use strict';
import * as vscode from 'vscode';
var exec = require('child_process').execFile;


export function activate(context: vscode.ExtensionContext) {

    var currentInstances = 0;
    var maxInstances = vscode.workspace.getConfiguration('lövelauncher').get('maxInstances');
  

    let disposable = vscode.commands.registerCommand('lövelauncher.launch', () => {

          console.log(maxInstances);

        if(currentInstances < maxInstances){
            var path = vscode.workspace.getConfiguration('lövelauncher').get('path');
            
            currentInstances++;
            exec(path, [vscode.workspace.rootPath], function(err, data) {  
                currentInstances--;                
            });  
        }else{
            vscode.window.showErrorMessage("You have reached your max concurrent Löve instances. You can change this setting in your config.");
        }
        
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
}