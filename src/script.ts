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
            openReq.onerror = () => {
                reject(openReq.error);
            };
            openReq.onsuccess = () => {
                this.db = openReq.result;
                if (!this.verifyObjectStoreNames()) {
                    this.db.close();
                    this.db = NULL_IDB_DATABASE;
                    reject(new TypeError('storeInfos does not match the object stores in the database. The database version should be upgraded.'));
                    return;
                }
                resolve();
            };

            openReq.onblocked = () => {
                reject(new ReferenceError('The database cannot be upgraded because another instance has the database open.'));
            };
            openReq.onupgradeneeded = () => {
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
    private verifyObjectStoreNames(): boolean {
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

    setItem<ItemT>(
        storeName: string,
        item: ItemT,
        key?: IDBValidKey,
    ): Promise<IDBValidKey> {
        return new Promise<IDBValidKey>((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);

            const putReq = store.put(item, key);
            putReq.onerror = () => { reject(putReq.error); };
            putReq.onsuccess = () => { resolve(putReq.result); };
        });
    }

    setItems<ItemT>(
        storeName: string,
        items: ItemT[],
        keys?: IDBValidKey[],
    ): Promise<IDBValidKey[]> {
        return new Promise<IDBValidKey[]>((resolve, reject) => {
            if (keys instanceof Array && items.length !== keys.length) {
                reject(new TypeError('The length of items and keys must be the same.'));
                return;
            }

            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);

            const promises: Promise<IDBValidKey>[] = items.map((item, idx) => {
                return new Promise((res, rej) => {
                    const putReq = store.put(item, keys?.[idx]);
                    putReq.onerror = () => { rej(putReq.error); };
                    putReq.onsuccess = () => { res(putReq.result); };
                });
            });

            Promise.all(promises)
                .then((value: IDBValidKey[]) => { resolve(value); })
                .catch((reason: DOMException) => { reject(reason); });
        });
    }

    removeItem(storeName: string, key: IDBValidKey): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);

            const deleteReq = store.delete(key);
            deleteReq.onerror = () => { reject(deleteReq.error); };
            deleteReq.onsuccess = () => { resolve(); };
        });
    }

    removeItems(storeName: string, keys: IDBValidKey[]): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);

            const promises: Promise<void>[] = keys.map((key) => {
                return new Promise<void>((res, rej) => {
                    const deleteReq = store.delete(key);
                    deleteReq.onerror = () => { rej(deleteReq.error); };
                    deleteReq.onsuccess = () => { res(); };
                });
            });

            Promise.all(promises)
                .then((value: void[]) => { resolve(); })
                .catch((reason: DOMException) => { reject(reason); });
        });
    }

    clearItems(storeName: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);

            const clearReq = store.clear();
            clearReq.onerror = () => { reject(clearReq.error); };
            clearReq.onsuccess = () => { resolve(); };
        });
    }

    getItem<RecordT>(storeName: string, key: IDBValidKey): Promise<RecordT | void> {
        return new Promise<RecordT | void>((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);

            const getReq = store.get(key);
            getReq.onerror = () => { reject(getReq.error); };
            getReq.onsuccess = () => { resolve(getReq.result as RecordT | void); };
        });
    }
}
