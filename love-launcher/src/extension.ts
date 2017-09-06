'use strict';
import * as vscode from 'vscode';
var exec = require('child_process').execFile;
var currentInstances = [];

export function activate(context: vscode.ExtensionContext) {
    var maxInstances = vscode.workspace.getConfiguration('lövelauncher').get('maxInstances');
    var overWrite = vscode.workspace.getConfiguration('lövelauncher').get('overWrite');

    let disposable = vscode.commands.registerCommand('lövelauncher.launch', () => {
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

    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
}

function on_exit(oprocess){
    currentInstances.splice(oprocess.pid, 1);
    currentInstances = currentInstances.filter(Boolean);
}
