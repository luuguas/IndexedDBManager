import { NULL_IDB_DATABASE } from './null';

export interface IDBMStoreInfo {
    name: string;
    keyPath?: string | string[] | null;
    autoIncrement?: boolean;
    resetOnUpgrade?: boolean;
}
interface IDBMStoreUpgradeInfo {
    type: 'create' | 'unchanged' | 'remove' | 'reset' | 'exist';
    keyPath?: string | string[] | null;
    autoIncrement?: boolean;
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

    protected dbNotOpenErrMsg: string = 'The database is not open.';

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
        if (this.isClose()) { throw new ReferenceError(this.dbNotOpenErrMsg); }

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

    setItem<TItem>(
        storeName: string,
        item: TItem,
        key?: IDBValidKey,
    ): Promise<IDBValidKey> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(new ReferenceError(this.dbNotOpenErrMsg));
                return;
            }

            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);

            const putReq = store.put(item, key);
            putReq.onerror = () => { reject(putReq.error); };
            putReq.onsuccess = () => { resolve(putReq.result); };
        });
    }

    setItems<TItem>(
        storeName: string,
        items: TItem[],
        keys?: (IDBValidKey | undefined)[],
    ): Promise<IDBValidKey[]> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(new ReferenceError(this.dbNotOpenErrMsg));
                return;
            }
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
                .then((response: IDBValidKey[]) => { resolve(response); })
                .catch((error: DOMException) => {
                    tx.abort();
                    reject(error);
                });
        });
    }

    removeItem(storeName: string, key: IDBValidKey): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(new ReferenceError(this.dbNotOpenErrMsg));
                return;
            }

            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);

            const deleteReq = store.delete(key);
            deleteReq.onerror = () => { reject(deleteReq.error); };
            deleteReq.onsuccess = () => { resolve(); };
        });
    }

    removeItems(storeName: string, keys: IDBValidKey[]): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(new ReferenceError(this.dbNotOpenErrMsg));
                return;
            }

            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);

            const promises: Promise<void>[] = keys.map((key) => {
                return new Promise((res, rej) => {
                    const deleteReq = store.delete(key);
                    deleteReq.onerror = () => { rej(deleteReq.error); };
                    deleteReq.onsuccess = () => { res(); };
                });
            });

            Promise.all(promises)
                .then(() => { resolve(); })
                .catch((error: DOMException) => {
                    tx.abort();
                    reject(error);
                });
        });
    }

    clearItems(storeName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(new ReferenceError(this.dbNotOpenErrMsg));
                return;
            }

            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);

            const clearReq = store.clear();
            clearReq.onerror = () => { reject(clearReq.error); };
            clearReq.onsuccess = () => { resolve(); };
        });
    }

    getItem<TItem>(storeName: string, key: IDBValidKey): Promise<TItem | undefined> {
        return new Promise((resolve, reject) => {
            if (this.isClose()) {
                reject(new ReferenceError(this.dbNotOpenErrMsg));
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
                reject(new ReferenceError(this.dbNotOpenErrMsg));
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
                reject(new ReferenceError(this.dbNotOpenErrMsg));
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
                reject(new ReferenceError(this.dbNotOpenErrMsg));
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
                reject(new ReferenceError(this.dbNotOpenErrMsg));
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
                reject(new ReferenceError(this.dbNotOpenErrMsg));
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
                reject(new ReferenceError(this.dbNotOpenErrMsg));
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
                reject(new ReferenceError(this.dbNotOpenErrMsg));
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
                reject(new ReferenceError(this.dbNotOpenErrMsg));
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
                reject(new ReferenceError(this.dbNotOpenErrMsg));
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
            throw new ReferenceError(this.dbNotOpenErrMsg);
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
            throw new ReferenceError(this.dbNotOpenErrMsg);
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
            throw new ReferenceError(this.dbNotOpenErrMsg);
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
            throw new ReferenceError(this.dbNotOpenErrMsg);
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
