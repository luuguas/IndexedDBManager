import { NULL_IDB_DATABASE } from './null';
import { IDBMTransaction } from './transaction';

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

export interface IDBMKeyRange {
    lower?: IDBValidKey;
    upper?: IDBValidKey;
    lowerOpen?: boolean;
    upperOpen?: boolean;
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

            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);

            const getReq = store.get(key);
            getReq.onerror = () => { reject(getReq.error); };
            getReq.onsuccess = () => { resolve(getReq.result as TItem | undefined); };
        });
    }

    getFirstItem<TItem>(storeName: string, keyRange?: IDBMKeyRange): Promise<TItem | undefined> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);

            const rawKeyRange = IDBManager.generateRawKeyRange(keyRange);
            const cursorReq = store.openCursor(rawKeyRange, 'next');
            cursorReq.onerror = () => { reject(cursorReq.error); };
            cursorReq.onsuccess = () => {
                const cursor = cursorReq.result;

                if (cursor) { resolve(cursor.value as TItem); }
                else { resolve(undefined); }
            };
        });
    }

    getLastItem<TItem>(storeName: string, keyRange?: IDBMKeyRange): Promise<TItem | undefined> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);

            const rawKeyRange = IDBManager.generateRawKeyRange(keyRange);
            const cursorReq = store.openCursor(rawKeyRange, 'prev');
            cursorReq.onerror = () => { reject(cursorReq.error); };
            cursorReq.onsuccess = () => {
                const cursor = cursorReq.result;

                if (cursor) { resolve(cursor.value as TItem); }
                else { resolve(undefined); }
            };
        });
    }

    getFirstKey(storeName: string, keyRange?: IDBMKeyRange): Promise<IDBValidKey | undefined> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);

            const rawKeyRange = IDBManager.generateRawKeyRange(keyRange);
            const cursorReq = store.openKeyCursor(rawKeyRange, 'next');
            cursorReq.onerror = () => { reject(cursorReq.error); };
            cursorReq.onsuccess = () => {
                const cursor = cursorReq.result;

                if (cursor) { resolve(cursor.key); }
                else { resolve(undefined); }
            };
        });
    }

    getLastKey(storeName: string, keyRange?: IDBMKeyRange): Promise<IDBValidKey | undefined> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);

            const rawKeyRange = IDBManager.generateRawKeyRange(keyRange);
            const cursorReq = store.openKeyCursor(rawKeyRange, 'prev');
            cursorReq.onerror = () => { reject(cursorReq.error); };
            cursorReq.onsuccess = () => {
                const cursor = cursorReq.result;

                if (cursor) { resolve(cursor.key); }
                else { resolve(undefined); }
            };
        });
    }

    hasItem(storeName: string, key: IDBValidKey): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);

            const getReq = store.getKey(key);
            getReq.onerror = () => { reject(getReq.error); };
            getReq.onsuccess = () => { resolve(typeof getReq.result !== 'undefined'); };
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

            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);

            if (keysOrKeyRange instanceof Array) {
                // keys: IDBValidKey[]
                const promises: Promise<TItem | undefined>[] = keysOrKeyRange.map((key) => {
                    return new Promise((res, rej) => {
                        const getReq = store.get(key);
                        getReq.onerror = () => { rej(getReq.error); };
                        getReq.onsuccess = () => { res(getReq.result as TItem | undefined); };
                    });
                });

                Promise.all(promises)
                    .then((response: (TItem | undefined)[]) => { resolve(response); })
                    .catch((error: DOMException) => {
                        tx.abort();
                        reject(error);
                    });
            }
            else {
                // keyRange?: IDBMKeyRange
                const rawKeyRange = IDBManager.generateRawKeyRange(keysOrKeyRange);
                const getAllReq = store.getAll(rawKeyRange);
                getAllReq.onerror = () => { reject(getAllReq.error); };
                getAllReq.onsuccess = () => { resolve(getAllReq.result as TItem[]); };
            }
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

            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);

            const rawKeyRange = IDBManager.generateRawKeyRange(keyRange);
            const getAllReq = store.getAllKeys(rawKeyRange);
            getAllReq.onerror = () => { reject(getAllReq.error); };
            getAllReq.onsuccess = () => { resolve(getAllReq.result); };
        });
    }

    countItems(storeName: string, keyRange?: IDBMKeyRange): Promise<number> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);

            const rawKeyRange = IDBManager.generateRawKeyRange(keyRange);
            const countReq = store.count(rawKeyRange || undefined);
            countReq.onerror = () => { reject(countReq.error); };
            countReq.onsuccess = () => { resolve(countReq.result); };
        });
    }

    hasAnyItems(storeName: string, keyRange?: IDBMKeyRange): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(IDBManager.dbNotOpenError());
                return;
            }

            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);

            const rawKeyRange = IDBManager.generateRawKeyRange(keyRange);
            const cursorReq = store.openKeyCursor(rawKeyRange);
            cursorReq.onerror = () => { reject(cursorReq.error); };
            cursorReq.onsuccess = () => { resolve(cursorReq.result !== null); };
        });
    }

    getIterator<TItem>(
        storeName: string,
        keyRange?: IDBMKeyRange,
    ): AsyncIterableIterator<TItem> {
        if (this.isClose()) {
            throw IDBManager.dbNotOpenError();
        }

        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);

        const rawKeyRange = IDBManager.generateRawKeyRange(keyRange);
        const cursorReq = store.openCursor(rawKeyRange, 'next');

        let prev: Promise<IteratorResult<TItem | void>> = Promise.resolve(
            { value: undefined, done: false },
        );
        return {
            next(): Promise<IteratorResult<TItem>> {
                const p = prev.then(
                    (prevResponse) => {
                        return new Promise<IteratorResult<TItem>>((resolve, reject) => {
                            if (prevResponse.done) {
                                resolve({ value: undefined, done: true });
                                return;
                            }

                            cursorReq.onerror = () => { reject(cursorReq.error); };
                            cursorReq.onsuccess = () => {
                                const cursor = cursorReq.result;

                                if (cursor) {
                                    resolve({ value: cursor.value as TItem, done: false });
                                    cursor.continue();
                                }
                                else {
                                    resolve({ value: undefined, done: true });
                                }
                            };
                        });
                    },
                    (prevError) => { return Promise.reject(prevError); },
                );
                prev = p;
                return p;
            },
            [Symbol.asyncIterator](): AsyncIterableIterator<TItem> { return this; },
        };
    }

    getReversedIterator<TItem>(
        storeName: string,
        keyRange?: IDBMKeyRange,
    ): AsyncIterableIterator<TItem> {
        if (this.isClose()) {
            throw IDBManager.dbNotOpenError();
        }

        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);

        const rawKeyRange = IDBManager.generateRawKeyRange(keyRange);
        const cursorReq = store.openCursor(rawKeyRange, 'prev');

        let prev: Promise<IteratorResult<TItem | void>> = Promise.resolve(
            { value: undefined, done: false },
        );
        return {
            next(): Promise<IteratorResult<TItem>> {
                const p = prev.then(
                    (prevResponse) => {
                        return new Promise<IteratorResult<TItem>>((resolve, reject) => {
                            if (prevResponse.done) {
                                resolve({ value: undefined, done: true });
                                return;
                            }

                            cursorReq.onerror = () => { reject(cursorReq.error); };
                            cursorReq.onsuccess = () => {
                                const cursor = cursorReq.result;

                                if (cursor) {
                                    resolve({ value: cursor.value as TItem, done: false });
                                    cursor.continue();
                                }
                                else {
                                    resolve({ value: undefined, done: true });
                                }
                            };
                        });
                    },
                    (prevError) => { return Promise.reject(prevError); },
                );
                prev = p;
                return p;
            },
            [Symbol.asyncIterator](): AsyncIterableIterator<TItem> { return this; },
        };
    }

    getKeyIterator(
        storeName: string,
        keyRange?: IDBMKeyRange,
    ): AsyncIterableIterator<IDBValidKey> {
        if (this.isClose()) {
            throw IDBManager.dbNotOpenError();
        }

        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);

        const rawKeyRange = IDBManager.generateRawKeyRange(keyRange);
        const cursorReq = store.openKeyCursor(rawKeyRange, 'next');

        let prev: Promise<IteratorResult<IDBValidKey | void>> = Promise.resolve(
            { value: undefined, done: false },
        );
        return {
            next(): Promise<IteratorResult<IDBValidKey>> {
                const p = prev.then(
                    (prevResponse) => {
                        return new Promise<IteratorResult<IDBValidKey>>((resolve, reject) => {
                            if (prevResponse.done) {
                                resolve({ value: undefined, done: true });
                                return;
                            }

                            cursorReq.onerror = () => { reject(cursorReq.error); };
                            cursorReq.onsuccess = () => {
                                const cursor = cursorReq.result;

                                if (cursor) {
                                    resolve({ value: cursor.key, done: false });
                                    cursor.continue();
                                }
                                else {
                                    resolve({ value: undefined, done: true });
                                }
                            };
                        });
                    },
                    (prevError) => { return Promise.reject(prevError); },
                );
                prev = p;
                return p;
            },
            [Symbol.asyncIterator](): AsyncIterableIterator<IDBValidKey> { return this; },
        };
    }

    getReversedKeyIterator(
        storeName: string,
        keyRange?: IDBMKeyRange,
    ): AsyncIterableIterator<IDBValidKey> {
        if (this.isClose()) {
            throw IDBManager.dbNotOpenError();
        }

        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);

        const rawKeyRange = IDBManager.generateRawKeyRange(keyRange);
        const cursorReq = store.openKeyCursor(rawKeyRange, 'prev');

        let prev: Promise<IteratorResult<IDBValidKey | void>> = Promise.resolve(
            { value: undefined, done: false },
        );
        return {
            next(): Promise<IteratorResult<IDBValidKey>> {
                const p = prev.then(
                    (prevResponse) => {
                        return new Promise<IteratorResult<IDBValidKey>>((resolve, reject) => {
                            if (prevResponse.done) {
                                resolve({ value: undefined, done: true });
                                return;
                            }

                            cursorReq.onerror = () => { reject(cursorReq.error); };
                            cursorReq.onsuccess = () => {
                                const cursor = cursorReq.result;

                                if (cursor) {
                                    resolve({ value: cursor.key, done: false });
                                    cursor.continue();
                                }
                                else {
                                    resolve({ value: undefined, done: true });
                                }
                            };
                        });
                    },
                    (prevError) => { return Promise.reject(prevError); },
                );
                prev = p;
                return p;
            },
            [Symbol.asyncIterator](): AsyncIterableIterator<IDBValidKey> { return this; },
        };
    }
}
