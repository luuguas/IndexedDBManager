interface ObjectStoreInfo {
    readonly name: string;
    readonly reset?: boolean;
    readonly keyPath?: string;
    readonly autoIncrement?: boolean;
}

export class IDBManager {
    db: IDBDatabase | null;
    dbName: string;
    dbVersion: number;
    storeInfos: ObjectStoreInfo[];

    constructor(databaseName: string, version: number, objectStoreInfos: ObjectStoreInfo[]) {
        this.db = null;
        this.dbName = databaseName;
        this.dbVersion = version;
        this.storeInfos = objectStoreInfos;
    }
    openDatabase(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const openReq = window.indexedDB.open(this.dbName, this.dbVersion);
            let upgraded: boolean = false;

            openReq.onerror = (e) => {
                const target = e.target as IDBOpenDBRequest;
                reject(target.error);
            };
            openReq.onsuccess = (e) => {
                const target = e.target as IDBOpenDBRequest;
                this.db = target.result;
                resolve(upgraded);
            };

            openReq.onupgradeneeded = (e) => {
                const target = e.target as IDBOpenDBRequest;
                const db = target.result;
                upgraded = true;

                this.storeInfos.forEach((storeInfo) => {
                    db.createObjectStore(storeInfo.name, storeInfo);
                });
            };
        });
    }
}
