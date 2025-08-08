import * as vscode from 'vscode';
import { Track } from '../orchestrator/workPlanParser';
import { TrackStatus } from '../integration/trackStatus';

export class TrackStatusTreeDataProvider implements vscode.TreeDataProvider<Track> {
    constructor(private trackStatus: TrackStatus) {
        this.trackStatus.onDidChangeTreeData(track => this._onDidChangeTreeData.fire(track));
    }

    private _onDidChangeTreeData: vscode.EventEmitter<Track | undefined | null | void> = new vscode.EventEmitter<Track | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<Track | undefined | null | void> = this._onDidChangeTreeData.event;

    getTreeItem(track: Track): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(track.id, vscode.TreeItemCollapsibleState.None);
        treeItem.description = track.status;
        treeItem.tooltip = track.statusMessage || `Status: ${track.status}`;
        treeItem.iconPath = this.getIconPath(track.status);
        return treeItem;
    }

    getChildren(element?: Track): Thenable<Track[]> {
        if (element) {
            return Promise.resolve([]); // No children for individual tracks for now
        } else {
            return Promise.resolve(this.trackStatus.getTracks());
        }
    }

    private getIconPath(status: string): vscode.ThemeIcon {
        switch (status) {
            case 'pending':
                return new vscode.ThemeIcon('circle-outline');
            case 'in-progress':
                return new vscode.ThemeIcon('sync');
            case 'completed':
                return new vscode.ThemeIcon('check');
            case 'blocked':
                return new vscode.ThemeIcon('stop');
            case 'merged':
                return new vscode.ThemeIcon('merge');
            case 'failed':
                return new vscode.ThemeIcon('error');
            default:
                return new vscode.ThemeIcon('info');
        }
    }
}