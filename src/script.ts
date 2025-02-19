import { NULL_IDB_DATABASE } from './null';

export class IDBManager {
    private db: IDBDatabase;
    private dbName: string;
    private dbVersion: number;

    constructor(dbName: string, dbVersion: number) {
        this.db = NULL_IDB_DATABASE;
        this.dbName = dbName;
        this.dbVersion = dbVersion;
    }

    isClose(): boolean { return this.db === NULL_IDB_DATABASE; }
    isOpen(): boolean { return !this.isClose(); }

    openDatabase(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.isOpen()) {
                resolve();
                return;
            }

            const openReq = window.indexedDB.open(this.dbName, this.dbVersion);

            openReq.onerror = (e) => { reject(openReq.error); };
            openReq.onsuccess = (e) => {
                this.db = openReq.result;
                resolve();
            };
        });
    }

    closeDatabase(): void {
        if (this.isOpen()) {
            this.db.close();
            this.db = NULL_IDB_DATABASE;
        }
    }
}
