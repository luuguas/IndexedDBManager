import { NULL_IDB_DATABASE } from './null';

export interface ObjectStoreInfo {
    name: string;
    keyPath?: string | string[] | null;
    autoIncrement?: boolean;
    resetOnUpgrade?: boolean;
}
interface ObjectStoreUpgradeInfo {
    type: 'create' | 'unchanged' | 'remove' | 'reset' | 'exist';
    keyPath?: string | string[] | null;
    autoIncrement?: boolean;
}

export class IDBManager {
    private db: IDBDatabase;
    private dbName: string;
    private dbVersion: number;
    private storeInfos: ObjectStoreInfo[];

    private dbNotOpenErrMsg: string = 'Database is not open.';

    constructor(dbName: string, dbVersion: number, storeInfos: ObjectStoreInfo[]) {
        this.db = NULL_IDB_DATABASE;
        this.dbName = dbName;
        this.dbVersion = dbVersion;
        this.storeInfos = storeInfos;
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

            openReq.onerror = (e) => {
                reject(openReq.error);
            };
            openReq.onsuccess = (e) => {
                this.db = openReq.result;
                if (!this.verifyObjectStoreNames()) {
                    reject(new TypeError('storeInfos does not match the object stores in the database. The database version should be upgraded.'));
                    return;
                }
                resolve();
            };

            openReq.onblocked = (e) => {
                reject(new ReferenceError('The database cannot be upgraded because another instance has the database open.'));
            };
            openReq.onupgradeneeded = (e) => {
                const db = openReq.result;
                const existingStoreNames = Array.from(db.objectStoreNames);
                const mp = new Map<string, ObjectStoreUpgradeInfo>();

                existingStoreNames.forEach((storeName) => {
                    mp.set(storeName, { type: 'exist' });
                });
                this.storeInfos.forEach((storeInfo) => {
                    if (!mp.has(storeInfo.name)) {
                        mp.set(storeInfo.name, {
                            type: 'create',
                            keyPath: storeInfo.keyPath,
                            autoIncrement: storeInfo.autoIncrement,
                        });
                    }
                    else if (storeInfo.resetOnUpgrade) {
                        mp.set(storeInfo.name, {
                            type: 'reset',
                            keyPath: storeInfo.keyPath,
                            autoIncrement: storeInfo.autoIncrement,
                        });
                    }
                    else {
                        mp.set(storeInfo.name, { type: 'unchanged' });
                    }
                });
                existingStoreNames.forEach((storeName) => {
                    if (mp.get(storeName)?.type === 'exist') {
                        mp.set(storeName, { type: 'remove' });
                    }
                });

                mp.forEach((storeUpgradeInfo, storeName) => {
                    switch (storeUpgradeInfo.type) {
                        case 'create':
                            db.createObjectStore(storeName, storeUpgradeInfo);
                            break;
                        case 'remove':
                            db.deleteObjectStore(storeName);
                            break;
                        case 'reset':
                            db.deleteObjectStore(storeName);
                            db.createObjectStore(storeName, storeUpgradeInfo);
                            break;

                        default:
                            break;
                    }
                });
            };
        });
    }

    closeDatabase(): void {
        if (this.isOpen()) {
            this.db.close();
            this.db = NULL_IDB_DATABASE;
        }
    }

    // DB上のオブジェクトストア名とstoreInfosのオブジェクトストア名が全て一致しているかを返す
    verifyObjectStoreNames(): boolean {
        if (this.isClose()) { throw ReferenceError(this.dbNotOpenErrMsg); }

        const existingStoreNames = Array.from(this.db.objectStoreNames);
        const st = new Set<string>();

        this.storeInfos.forEach((storeInfo) => {
            st.add(storeInfo.name);
        });
        return this.storeInfos.length === existingStoreNames.length
            && existingStoreNames.every((storeName) => {
                return st.has(storeName);
            });
    }
}
