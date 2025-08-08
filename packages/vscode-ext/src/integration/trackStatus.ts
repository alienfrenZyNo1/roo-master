import * as vscode from 'vscode';
import { Track } from '../orchestrator/workPlanParser';
import { Logger } from '../util/logger';

const logger = new Logger('TrackStatus');

export { Track } from '../orchestrator/workPlanParser';

export class TrackStatus {
    private tracks: Map<string, Track> = new Map();
    private _onDidChangeTreeData: vscode.EventEmitter<Track | undefined | null | void> = new vscode.EventEmitter<Track | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<Track | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor() {
        // Initialize with any persisted state or empty
    }

    public addTrack(track: Track): void {
        this.tracks.set(track.id, track);
        this._onDidChangeTreeData.fire(track);
        logger.info(`Track added: ${track.id}`);
    }

    public updateTrackStatus(trackId: string, status: 'pending' | 'in-progress' | 'completed' | 'blocked' | 'merged' | 'failed', message?: string): void {
        const track = this.tracks.get(trackId);
        if (track) {
            track.status = status;
            if (message) {
                track.statusMessage = message;
            }
            this.tracks.set(trackId, track); // Update the map with the modified track
            this._onDidChangeTreeData.fire(track);
            logger.info(`Track ${trackId} status updated to: ${status}`);
        } else {
            logger.warn(`Attempted to update status for non-existent track: ${trackId}`);
        }
    }

    public getTracks(): Track[] {
        return Array.from(this.tracks.values());
    }

    public getTrack(trackId: string): Track | undefined {
        return this.tracks.get(trackId);
    }

    public refresh(): void {
        this._onDidChangeTreeData.fire();
    }
}