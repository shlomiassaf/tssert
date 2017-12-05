import * as chokidar from 'chokidar';

export enum FileChangeEvent {
  Add = 1 << 0,
  Change = 1 << 1,
  Delete = 1 << 2,
  Dir = 1 << 3
}

export class Watcher {
  private watcher: chokidar.FSWatcher;
  private _ready: Promise<void> | boolean;
  private listeners: Array<(event: { type: FileChangeEvent; path: string }) => void> = [];

  get ready(): Promise<this> {
    if (this._ready) {
      return Promise.resolve<any>(this._ready).then( () => this );
    } else {
      return Promise.reject(new Error('watch is not activated.'));
    }
  }

  constructor(public basePath: string, public options: chokidar.WatchOptions) { }

  watch(): this {
    if (!this.watcher) {
      this.listeners = [];
      this.watcher = chokidar.watch(this.basePath, this.options);
      this.watcher.on('all', (event: string, path: string) => {
        let eventType: FileChangeEvent;
        switch (event) {
          case 'change':
            eventType = FileChangeEvent.Change;
            break;
          case 'unlink':
            eventType = FileChangeEvent.Delete;
            break;
          case 'add':
            eventType = FileChangeEvent.Add;
            break;
          case 'unlinkDir':
            eventType = FileChangeEvent.Delete | FileChangeEvent.Dir;
            break;
          case 'addDir':
            eventType = FileChangeEvent.Add | FileChangeEvent.Dir;
            break;
          default:
            return;
        }
        this.listeners.forEach( cb => cb({ type: eventType, path }));
      });

      this._ready = new Promise( resolve => this.watcher.on('ready', () => {
        this._ready = true;
        resolve();
      }));
    }
    return this;
  }

  listen(cb: (event: { type: FileChangeEvent; path: string }) => void): this {
    this.listeners.push(cb);
    return this;
  }

  close(): void {
    if (this.watcher) {
      this.listeners = [];
      this.watcher.close();
      this.watcher = this._ready = undefined;
    }
  }

  static create(basePath: string, options: chokidar.WatchOptions): Watcher {
    return new Watcher(basePath, options);
  }
}
