export class IDBManager {
    private db: IDBDatabase | null;
    private dbName: string;
    private dbVersion: number;

    constructor(dbName: string, dbVersion: number) {
        this.db = null;
        this.dbName = dbName;
        this.dbVersion = dbVersion;
    }

    openDatabase(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.db !== null) { return; }

            const openReq = window.indexedDB.open(this.dbName, this.dbVersion);

            openReq.onerror = (e) => { reject(openReq.error); };
            openReq.onsuccess = (e) => {
                this.db = openReq.result;
                resolve();
            };
        });
    }

    closeDatabase(): void {
        this.db?.close();
        this.db = null;
    }
}
