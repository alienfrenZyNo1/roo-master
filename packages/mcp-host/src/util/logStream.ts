import { Writable } from 'stream';

export class LogStream extends Writable {
  private _log = '';

  constructor(private readonly onLog: (log: string) => void) {
    super();
  }

  _write(chunk: any, encoding: string, callback: (error?: Error | null) => void): void {
    this._log += chunk.toString();
    this.onLog(chunk.toString());
    callback();
  }

  get log(): string {
    return this._log;
  }
}