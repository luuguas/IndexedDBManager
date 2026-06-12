import { NULL_IDB_DATABASE } from './null';
import { IDBMTransaction, IDBMKeyRange } from './transaction';

export interface IDBMIndexInfo {
    indexName: string;
    keyPath: string | string[],
    unique?: boolean;
    multiEntry?: boolean;
}
export interface IDBMStoreInfo {
    name: string;
    keyPath?: string | string[] | null;
    autoIncrement?: boolean;
    resetOnUpgrade?: 'all' | 'index' | 'none';
    indexInfos?: IDBMIndexInfo[];
}
interface IDBMStoreUpgradeInfo {
    type: 'create' | 'unchanged' | 'remove' | 'resetAll' | 'resetIndex' | 'exist';
    keyPath?: string | string[] | null;
    autoIncrement?: boolean;
    indexInfos?: IDBMIndexInfo[];
}

export class IDBManager {
    protected db: IDBDatabase;
    protected dbName: string;
    protected dbVersion: number;
    protected storeInfos: IDBMStoreInfo[];

    protected static dbNotOpenError(): ReferenceError {
        return new ReferenceError('The database is not open.');
    }

    constructor(dbName: string, dbVersion: number, storeInfos: IDBMStoreInfo[]) {
        this.db = NULL_IDB_DATABASE;
        this.dbName = dbName;
        this.dbVersion = dbVersion;
        this.storeInfos = storeInfos;
    }

    isClose(): boolean { return this.db === NULL_IDB_DATABASE; }
    isOpen(): boolean { return !this.isClose(); }

    // DB上のオブジェクトストア名とstoreInfosのオブジェクトストア名が全て一致しているかを返す
    protected verifyObjectStoreNames(): boolean {
        if (this.isClose()) { throw IDBManager.dbNotOpenError(); }

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

    static generateRawKeyRange(keyRange?: IDBMKeyRange): IDBKeyRange | null {
        if (typeof keyRange === 'undefined') { return null; }

        const lowerUnbounded = (typeof keyRange.lower === 'undefined');
        const upperUnbounded = (typeof keyRange.upper === 'undefined');

        if (lowerUnbounded && upperUnbounded) {
            return null;
        }
        if (lowerUnbounded) {
            return window.IDBKeyRange.upperBound(keyRange.upper, keyRange.upperOpen);
        }
        if (upperUnbounded) {
            return window.IDBKeyRange.lowerBound(keyRange.lower, keyRange.lowerOpen);
        }
        return window.IDBKeyRange
            .bound(keyRange.lower, keyRange.upper, keyRange.lowerOpen, keyRange.upperOpen);
    }

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
                    reject(new TypeError('The storeInfos does not match the object stores in the database. The database version needs upgrading.'));
                    return;
                }
                resolve();
            };

            openReq.onblocked = () => {
                reject(new ReferenceError('The database cannot be upgraded because it is currently open on another instance.'));
            };
            openReq.onupgradeneeded = () => {
                const db = openReq.result;
                const existingStoreNames = Array.from(db.objectStoreNames);
                const mp = new Map<string, IDBMStoreUpgradeInfo>();

                existingStoreNames.forEach((storeName) => {
                    mp.set(storeName, { type: 'exist' });
                });
                this.storeInfos.forEach((storeInfo) => {
                    if (!mp.has(storeInfo.name)) {
                        mp.set(storeInfo.name, {
                            type: 'create',
                            keyPath: storeInfo.keyPath,
                            autoIncrement: storeInfo.autoIncrement,
                            indexInfos: storeInfo.indexInfos,
                        });
                    }
                    else if (storeInfo.resetOnUpgrade === 'all') {
                        mp.set(storeInfo.name, {
                            type: 'resetAll',
                            keyPath: storeInfo.keyPath,
                            autoIncrement: storeInfo.autoIncrement,
                            indexInfos: storeInfo.indexInfos,
                        });
                    }
                    else if (storeInfo.resetOnUpgrade === 'index') {
                        mp.set(storeInfo.name, {
                            type: 'resetIndex',
                            indexInfos: storeInfo.indexInfos,
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
                    let store: IDBObjectStore;
                    switch (storeUpgradeInfo.type) {
                        case 'create':
                            store = db.createObjectStore(storeName, storeUpgradeInfo);
                            storeUpgradeInfo.indexInfos?.forEach((indexInfo) => {
                                const option: IDBIndexParameters = {
                                    unique: indexInfo.unique,
                                    multiEntry: indexInfo.multiEntry,
                                };
                                store.createIndex(indexInfo.indexName, indexInfo.keyPath, option);
                            });
                            break;
                        case 'remove':
                            db.deleteObjectStore(storeName);
                            break;
                        case 'resetAll':
                            db.deleteObjectStore(storeName);
                            store = db.createObjectStore(storeName, storeUpgradeInfo);
                            storeUpgradeInfo.indexInfos?.forEach((indexInfo) => {
                                const option: IDBIndexParameters = {
                                    unique: indexInfo.unique,
                                    multiEntry: indexInfo.multiEntry,
                                };
                                store.createIndex(indexInfo.indexName, indexInfo.keyPath, option);
                            });
                            break;
                        case 'resetIndex':
                            if (!openReq.transaction) {
                                throw new ReferenceError('There is no transaction for upgrading the version.');
                            }
                            store = openReq.transaction.objectStore(storeName);
                            Array.from(store.indexNames).forEach((indexName) => {
                                store.deleteIndex(indexName);
                            });
                            storeUpgradeInfo.indexInfos?.forEach((indexInfo) => {
                                const option: IDBIndexParameters = {
                                    unique: indexInfo.unique,
                                    multiEntry: indexInfo.multiEntry,
                                };
                                store.createIndex(indexInfo.indexName, indexInfo.keyPath, option);
                            });
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

    transaction<TResult>(
        storeNames: string | string[],
        callback: (inner: IDBMTransaction) => Promise<TResult>,
        mode?: 'readonly' | 'readwrite',
    ): Promise<TResult> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            const inner = new IDBMTransaction(this.db, storeNames, mode);
            callback(inner)
                .then(
                    (response: TResult) => {
                        if (inner.isActive()) { inner.commit(); }
                        inner.getSettlement()
                            .then(() => { resolve(response); })
                            .catch((err) => { reject(err); });
                    },
                    (error) => {
                        if (inner.isActive()) {
                            if (error instanceof Error) { inner.abort(error); }
                            else { inner.abort(); }
                        }
                        inner.getSettlement().catch((err) => { reject(err); });
                    },
                );
        });
    }

    addItem<TItem>(
        storeName: string,
        item: TItem,
        key?: IDBValidKey,
    ): Promise<IDBValidKey> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.addItem(storeName, item, key);
            }, 'readwrite')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    addItems<TItem>(
        storeName: string,
        items: TItem[],
        keys?: (IDBValidKey | undefined)[],
    ): Promise<IDBValidKey[]> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.addItems(storeName, items, keys);
            }, 'readwrite')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    setItem<TItem>(
        storeName: string,
        item: TItem,
        key?: IDBValidKey,
    ): Promise<IDBValidKey> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.setItem(storeName, item, key);
            }, 'readwrite')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    setItems<TItem>(
        storeName: string,
        items: TItem[],
        keys?: (IDBValidKey | undefined)[],
    ): Promise<IDBValidKey[]> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.setItems(storeName, items, keys);
            }, 'readwrite')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    removeItem(storeName: string, key: IDBValidKey): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.removeItem(storeName, key);
            }, 'readwrite')
                .then(() => { resolve(); })
                .catch((error) => { reject(error); });
        });
    }

    removeItems(storeName: string, keys: IDBValidKey[]): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.removeItems(storeName, keys);
            }, 'readwrite')
                .then(() => { resolve(); })
                .catch((error) => { reject(error); });
        });
    }

    clearItems(storeName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.clearItems(storeName);
            }, 'readwrite')
                .then(() => { resolve(); })
                .catch((error) => { reject(error); });
        });
    }

    getItem<TItem>(storeName: string, key: IDBValidKey): Promise<TItem | undefined> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.getItem<TItem>(storeName, key);
            }, 'readonly')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    getFirstItem<TItem>(storeName: string, keyRange?: IDBMKeyRange): Promise<TItem | undefined> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.getFirstItem<TItem>(storeName, keyRange);
            }, 'readonly')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    getLastItem<TItem>(storeName: string, keyRange?: IDBMKeyRange): Promise<TItem | undefined> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.getLastItem<TItem>(storeName, keyRange);
            }, 'readonly')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    getFirstKey(storeName: string, keyRange?: IDBMKeyRange): Promise<IDBValidKey | undefined> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.getFirstKey(storeName, keyRange);
            }, 'readonly')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    getLastKey(storeName: string, keyRange?: IDBMKeyRange): Promise<IDBValidKey | undefined> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.getLastKey(storeName, keyRange);
            }, 'readonly')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    hasItem(storeName: string, key: IDBValidKey): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.hasItem(storeName, key);
            }, 'readonly')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    getItems<TItem>(storeName: string, keys: IDBValidKey[]): Promise<(TItem | undefined)[]>;
    getItems<TItem>(storeName: string, keyRange?: IDBMKeyRange): Promise<TItem[]>;
    getItems<TItem>(
        storeName: string,
        keysOrKeyRange: IDBValidKey[] | IDBMKeyRange | undefined,
    ): Promise<(TItem | undefined)[]> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                if (Array.isArray(keysOrKeyRange)) {
                    // keys: IDBValidKey[]
                    return inner.getItems<TItem>(storeName, keysOrKeyRange);
                }
                // keyRange?: IDBMKeyRange
                return inner.getItems<TItem>(storeName, keysOrKeyRange);
            }, 'readonly')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    getKeys(
        storeName: string,
        keyRange?: IDBMKeyRange,
    ): Promise<IDBValidKey[]> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.getKeys(storeName, keyRange);
            }, 'readonly')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    countItems(storeName: string, keyRange?: IDBMKeyRange): Promise<number> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.countItems(storeName, keyRange);
            }, 'readonly')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    hasAnyItems(storeName: string, keyRange?: IDBMKeyRange): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.hasAnyItems(storeName, keyRange);
            }, 'readonly')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    getIterator<TItem>(
        storeName: string,
        keyRange?: IDBMKeyRange,
    ): AsyncIterableIterator<TItem> {
        if (this.isClose()) {
            throw IDBManager.dbNotOpenError();
        }

        const tx = new IDBMTransaction(this.db, storeName, 'readonly');
        tx.getSettlement().catch(() => { /* do nothing */ });
        return tx.getIterator<TItem>(storeName, keyRange);
    }

    getReversedIterator<TItem>(
        storeName: string,
        keyRange?: IDBMKeyRange,
    ): AsyncIterableIterator<TItem> {
        if (this.isClose()) {
            throw IDBManager.dbNotOpenError();
        }

        const tx = new IDBMTransaction(this.db, storeName, 'readonly');
        tx.getSettlement().catch(() => { /* do nothing */ });
        return tx.getReversedIterator<TItem>(storeName, keyRange);
    }

    getKeyIterator(
        storeName: string,
        keyRange?: IDBMKeyRange,
    ): AsyncIterableIterator<IDBValidKey> {
        if (this.isClose()) {
            throw IDBManager.dbNotOpenError();
        }

        const tx = new IDBMTransaction(this.db, storeName, 'readonly');
        tx.getSettlement().catch(() => { /* do nothing */ });
        return tx.getKeyIterator(storeName, keyRange);
    }

    getReversedKeyIterator(
        storeName: string,
        keyRange?: IDBMKeyRange,
    ): AsyncIterableIterator<IDBValidKey> {
        if (this.isClose()) {
            throw IDBManager.dbNotOpenError();
        }

        const tx = new IDBMTransaction(this.db, storeName, 'readonly');
        tx.getSettlement().catch(() => { /* do nothing */ });
        return tx.getReversedKeyIterator(storeName, keyRange);
    }
}
