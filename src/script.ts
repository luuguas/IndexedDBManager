export class IDBManager {
    db: IDBDatabase | null;

    constructor(databaseName: string, version: number) {
        this.db = null;

        const openReq = window.indexedDB.open(databaseName, version);
        openReq.onsuccess = (e) => {
            if (!(e.target instanceof IDBOpenDBRequest)) return;

            this.db = e.target.result;
        };
    }

    getDB(): IDBDatabase | null {
        return this.db;
    }
}
