import { NULL_IDB_DATABASE } from './null';

interface ObjectStoreInfo {
    readonly name: string;
    readonly reset?: boolean;
    readonly keyPath?: string;
    readonly autoIncrement?: boolean;
}

export class IDBManager {
    private db: IDBDatabase;
    private dbName: string;
    private dbVersion: number;
    private storeInfos: ObjectStoreInfo[];

    constructor(databaseName: string, version: number, objectStoreInfos: ObjectStoreInfo[]) {
        this.db = NULL_IDB_DATABASE;
        this.dbName = databaseName;
        this.dbVersion = version;
        this.storeInfos = objectStoreInfos;
    }

    isClose(): boolean { return this.db === NULL_IDB_DATABASE; }
    isOpen(): boolean { return !this.isClose(); }

    getObjectStoreNames(): string[] {
        if (this.isClose()) throw new ReferenceError('Database is not open.');
        return Array.from(this.db.objectStoreNames);
    }

    openDatabase(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            // 既にデータベースを開いていたら何もしない
            if (this.isOpen()) {
                resolve(false);
                return;
            }

            const openReq = window.indexedDB.open(this.dbName, this.dbVersion);
            let upgraded = false;

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
