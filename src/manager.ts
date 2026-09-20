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
                        inner
                            .then(() => { resolve(response); })
                            .catch((err) => { reject(err); });
                    },
                    (error) => {
                        if (inner.isActive()) {
                            if (error instanceof Error) { inner.abort(error); }
                            else { inner.abort(); }
                        }
                        inner.catch((err) => { reject(err); });
                    },
                );
        });
    }

    add<TValue>(
        storeName: string,
        value: TValue,
        key?: IDBValidKey,
    ): Promise<IDBValidKey> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.add(storeName, value, key);
            }, 'readwrite')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    addMany<TValue>(
        storeName: string,
        values: TValue[],
        keys?: (IDBValidKey | undefined)[],
    ): Promise<IDBValidKey[]> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.addMany(storeName, values, keys);
            }, 'readwrite')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    put<TValue>(
        storeName: string,
        value: TValue,
        key?: IDBValidKey,
    ): Promise<IDBValidKey> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.put(storeName, value, key);
            }, 'readwrite')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    putMany<TValue>(
        storeName: string,
        values: TValue[],
        keys?: (IDBValidKey | undefined)[],
    ): Promise<IDBValidKey[]> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.putMany(storeName, values, keys);
            }, 'readwrite')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    delete(storeName: string, key: IDBValidKey): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.delete(storeName, key);
            }, 'readwrite')
                .then(() => { resolve(); })
                .catch((error) => { reject(error); });
        });
    }

    deleteMany(storeName: string, keys: IDBValidKey[]): Promise<void>;
    deleteMany(storeName: string, keyRange: IDBMKeyRange): Promise<void>;
    deleteMany(
        storeName: string,
        keysOrKeyRange: IDBValidKey[] | IDBMKeyRange,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                if (Array.isArray(keysOrKeyRange)) {
                    // keys: IDBValidKey[]
                    return inner.deleteMany(storeName, keysOrKeyRange);
                }
                // keyRange: IDBMKeyRange
                return inner.deleteMany(storeName, keysOrKeyRange);
            }, 'readwrite')
                .then(() => { resolve(); })
                .catch((error) => { reject(error); });
        });
    }

    clear(storeName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.clear(storeName);
            }, 'readwrite')
                .then(() => { resolve(); })
                .catch((error) => { reject(error); });
        });
    }

    get<TValue>(storeName: string, key: IDBValidKey): Promise<TValue | undefined> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.get<TValue>(storeName, key);
            }, 'readonly')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    getFirst<TValue>(storeName: string, keyRange?: IDBMKeyRange): Promise<TValue | undefined> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.getFirst<TValue>(storeName, keyRange);
            }, 'readonly')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    getLast<TValue>(storeName: string, keyRange?: IDBMKeyRange): Promise<TValue | undefined> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.getLast<TValue>(storeName, keyRange);
            }, 'readonly')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    getKey(storeName: string, key: IDBValidKey): Promise<IDBValidKey | undefined> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.getKey(storeName, key);
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

    has(storeName: string, key: IDBValidKey): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.has(storeName, key);
            }, 'readonly')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    getMany<TValue>(storeName: string, keys: IDBValidKey[]): Promise<(TValue | undefined)[]>;
    getMany<TValue>(storeName: string, keyRange?: IDBMKeyRange): Promise<TValue[]>;
    getMany<TValue>(
        storeName: string,
        keysOrKeyRange: IDBValidKey[] | IDBMKeyRange | undefined,
    ): Promise<(TValue | undefined)[]> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                if (Array.isArray(keysOrKeyRange)) {
                    // keys: IDBValidKey[]
                    return inner.getMany<TValue>(storeName, keysOrKeyRange);
                }
                // keyRange?: IDBMKeyRange
                return inner.getMany<TValue>(storeName, keysOrKeyRange);
            }, 'readonly')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    getManyKeys(
        storeName: string,
        keyRange?: IDBMKeyRange,
    ): Promise<IDBValidKey[]> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.getManyKeys(storeName, keyRange);
            }, 'readonly')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    count(storeName: string, keyRange?: IDBMKeyRange): Promise<number> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.count(storeName, keyRange);
            }, 'readonly')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    hasAny(storeName: string, keyRange?: IDBMKeyRange): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.hasAny(storeName, keyRange);
            }, 'readonly')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    iterator<TValue>(
        storeName: string,
        keyRange?: IDBMKeyRange,
    ): AsyncIterableIterator<TValue> {
        if (this.isClose()) {
            throw IDBManager.dbNotOpenError();
        }

        const tx = new IDBMTransaction(this.db, storeName, 'readonly');
        tx.catch(() => { /* do nothing */ });
        return tx.iterator<TValue>(storeName, keyRange);
    }

    reverseIterator<TValue>(
        storeName: string,
        keyRange?: IDBMKeyRange,
    ): AsyncIterableIterator<TValue> {
        if (this.isClose()) {
            throw IDBManager.dbNotOpenError();
        }

        const tx = new IDBMTransaction(this.db, storeName, 'readonly');
        tx.catch(() => { /* do nothing */ });
        return tx.reverseIterator<TValue>(storeName, keyRange);
    }

    keyIterator(
        storeName: string,
        keyRange?: IDBMKeyRange,
    ): AsyncIterableIterator<IDBValidKey> {
        if (this.isClose()) {
            throw IDBManager.dbNotOpenError();
        }

        const tx = new IDBMTransaction(this.db, storeName, 'readonly');
        tx.catch(() => { /* do nothing */ });
        return tx.keyIterator(storeName, keyRange);
    }

    reverseKeyIterator(
        storeName: string,
        keyRange?: IDBMKeyRange,
    ): AsyncIterableIterator<IDBValidKey> {
        if (this.isClose()) {
            throw IDBManager.dbNotOpenError();
        }

        const tx = new IDBMTransaction(this.db, storeName, 'readonly');
        tx.catch(() => { /* do nothing */ });
        return tx.reverseKeyIterator(storeName, keyRange);
    }

    getByIndex<TValue>(
        storeName: string,
        indexName: string,
        key: IDBValidKey,
    ): Promise<TValue | undefined> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.getByIndex<TValue>(storeName, indexName, key);
            }, 'readonly')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    getFirstByIndex<TValue>(
        storeName: string,
        indexName: string,
        keyRange?: IDBMKeyRange,
    ): Promise<TValue | undefined> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.getFirstByIndex<TValue>(storeName, indexName, keyRange);
            }, 'readonly')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    getLastByIndex<TValue>(
        storeName: string,
        indexName: string,
        keyRange?: IDBMKeyRange,
    ): Promise<TValue | undefined> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.getLastByIndex<TValue>(storeName, indexName, keyRange);
            }, 'readonly')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    getKeyByIndex(
        storeName: string,
        indexName: string,
        key: IDBValidKey,
    ): Promise<IDBValidKey | undefined> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.getKeyByIndex(storeName, indexName, key);
            }, 'readonly')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    getFirstKeyByIndex(
        storeName: string,
        indexName: string,
        keyRange?: IDBMKeyRange,
    ): Promise<IDBValidKey | undefined> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.getFirstKeyByIndex(storeName, indexName, keyRange);
            }, 'readonly')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    getLastKeyByIndex(
        storeName: string,
        indexname: string,
        keyRange?: IDBMKeyRange,
    ): Promise<IDBValidKey | undefined> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.getLastKeyByIndex(storeName, indexname, keyRange);
            }, 'readonly')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    hasByIndex(
        storeName: string,
        indexName: string,
        key: IDBValidKey,
    ): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.hasByIndex(storeName, indexName, key);
            }, 'readonly')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    deleteManyByIndex(storeName: string, indexName: string, keys: IDBValidKey[]): Promise<void>;
    deleteManyByIndex(storeName: string, indexName: string, keyRange: IDBMKeyRange): Promise<void>;
    deleteManyByIndex(
        storeName: string,
        indexName: string,
        keysOrKeyRange: IDBValidKey[] | IDBMKeyRange,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                if (Array.isArray(keysOrKeyRange)) {
                    // keys: IDBValidKey[]
                    return inner.deleteManyByIndex(storeName, indexName, keysOrKeyRange);
                }
                // keyRange: IDBMKeyRange
                return inner.deleteManyByIndex(storeName, indexName, keysOrKeyRange);
            }, 'readwrite')
                .then(() => { resolve(); })
                .catch((error) => { reject(error); });
        });
    }

    getManyByIndex<TValue>(
        storeName: string, indexName: string, keys: IDBValidKey[]): Promise<(TValue | undefined)[]>;
    getManyByIndex<TValue>(
        storeName: string, indexName: string, keyRange?: IDBMKeyRange): Promise<TValue[]>;
    getManyByIndex<TValue>(
        storeName: string,
        indexName: string,
        keysOrKeyRange: IDBValidKey[] | IDBMKeyRange | undefined,
    ): Promise<(TValue | undefined)[]> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                if (Array.isArray(keysOrKeyRange)) {
                    // keys: IDBValidKey[]
                    return inner.getManyByIndex<TValue>(storeName, indexName, keysOrKeyRange);
                }
                // keyRange?: IDBMKeyRange
                return inner.getManyByIndex<TValue>(storeName, indexName, keysOrKeyRange);
            }, 'readonly')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    getManyKeysByIndex(
        storeName: string,
        indexName: string,
        keyRange?: IDBMKeyRange,
    ): Promise<IDBValidKey[]> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.getManyKeysByIndex(storeName, indexName, keyRange);
            }, 'readonly')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    countByIndex(
        storeName: string,
        indexName: string,
        keyRange?: IDBMKeyRange,
    ): Promise<number> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.countByIndex(storeName, indexName, keyRange);
            }, 'readonly')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    hasAnyByIndex(
        storeName: string,
        indexName: string,
        keyRange?: IDBMKeyRange,
    ): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            this.transaction(storeName, (inner) => {
                return inner.hasAnyByIndex(storeName, indexName, keyRange);
            }, 'readonly')
                .then((response) => { resolve(response); })
                .catch((error) => { reject(error); });
        });
    }

    iteratorByIndex<TValue>(
        storeName: string,
        indexName: string,
        keyRange?: IDBMKeyRange,
    ): AsyncIterableIterator<TValue> {
        if (this.isClose()) {
            throw IDBManager.dbNotOpenError();
        }

        const tx = new IDBMTransaction(this.db, storeName, 'readonly');
        tx.catch(() => { /* do nothing */ });
        return tx.iteratorByIndex<TValue>(storeName, indexName, keyRange);
    }

    reverseIteratorByIndex<TValue>(
        storeName: string,
        indexName: string,
        keyRange?: IDBMKeyRange,
    ): AsyncIterableIterator<TValue> {
        if (this.isClose()) {
            throw IDBManager.dbNotOpenError();
        }

        const tx = new IDBMTransaction(this.db, storeName, 'readonly');
        tx.catch(() => { /* do nothing */ });
        return tx.reverseIteratorByIndex<TValue>(storeName, indexName, keyRange);
    }

    keyIteratorByIndex(
        storeName: string,
        indexName: string,
        keyRange?: IDBMKeyRange,
    ): AsyncIterableIterator<IDBValidKey> {
        if (this.isClose()) {
            throw IDBManager.dbNotOpenError();
        }

        const tx = new IDBMTransaction(this.db, storeName, 'readonly');
        tx.catch(() => { /* do nothing */ });
        return tx.keyIteratorByIndex(storeName, indexName, keyRange);
    }

    reverseKeyIteratorByIndex(
        storeName: string,
        indexName: string,
        keyRange?: IDBMKeyRange,
    ): AsyncIterableIterator<IDBValidKey> {
        if (this.isClose()) {
            throw IDBManager.dbNotOpenError();
        }

        const tx = new IDBMTransaction(this.db, storeName, 'readonly');
        tx.catch(() => { /* do nothing */ });
        return tx.reverseKeyIteratorByIndex(storeName, indexName, keyRange);
    }
}
