'use strict';
import * as vscode from 'vscode';
var exec = require('child_process').execFile;


export function activate(context: vscode.ExtensionContext) {

    var currentInstances = 0;
    var maxInstances = vscode.workspace.getConfiguration('lövelauncher').get('maxInstances');
  

    let disposable = vscode.commands.registerCommand('lövelauncher.launch', () => {

        if(currentInstances < maxInstances){
            var path : string = vscode.workspace.getConfiguration('lövelauncher').get('path').toString();
            var useConsoleSubsystem = vscode.workspace.getConfiguration('lövelauncher').get('useConsoleSubsystem');
            
            currentInstances++;
            if(!useConsoleSubsystem){
                exec(path, [vscode.workspace.rootPath], function(err, data) {  
                    currentInstances--;                
                });  
            }else{
                path = path.substr(0,path.lastIndexOf(".")) + "c.exe";
                exec(path, [vscode.workspace.rootPath], function(err, data) {  
                    currentInstances--;                
                });  
            }
        }else{
            vscode.window.showErrorMessage("You have reached your max concurrent Löve instances. You can change this setting in your config.");
        }
        
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
}