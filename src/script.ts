export class IDBManager {
    db: IDBDatabase | null;
    dbName: string;
    dbVersion: number;

    constructor(databaseName: string, version: number) {
        this.db = null;
        this.dbName = databaseName;
        this.dbVersion = version;
    }
    openDatabase(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const openReq = window.indexedDB.open(this.dbName, this.dbVersion);

            openReq.onerror = (e) => {
                const target = e.target as IDBOpenDBRequest;
                reject(target.error);
            };
            openReq.onsuccess = (e) => {
                const target = e.target as IDBOpenDBRequest;
                this.db = target.result;
                resolve(true);
            };
        });
    }
}
