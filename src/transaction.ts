export interface IDBMKeyRange {
    lower?: IDBValidKey;
    upper?: IDBValidKey;
    lowerOpen?: boolean;
    upperOpen?: boolean;
}

export class IDBMTransaction {
    protected db: IDBDatabase;
    protected tx: IDBTransaction;

    protected active: boolean;
    protected error: Error | null;
    protected settlement: Promise<void>;

    protected static txNotActiveError(): DOMException {
        return new DOMException('The transaction is not active.', 'TransactionInactiveError');
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

    constructor(
        db: IDBDatabase,
        storeNames: string | string[],
        mode?: 'readonly' | 'readwrite',
        durability?: IDBTransactionDurability,
    ) {
        this.db = db;
        this.tx = db.transaction(storeNames, mode, { durability });
        this.active = true;
        this.error = null;
        this.settlement = new Promise((resolve, reject) => {
            this.tx.onerror = () => { this.active = false; };
            this.tx.onabort = () => {
                this.active = false;
                if (this.tx.error) { reject(this.tx.error); }
                else if (this.error) { reject(this.error); }
                else { reject(new DOMException('The transaction failed for some reason.', 'AbortError')); }
            };
            this.tx.oncomplete = () => {
                this.active = false;
                resolve();
            };
        });
    }

    isActive(): boolean { return this.active; }
    getSettlement(): Promise<void> { return this.settlement; }

    abort(error?: Error | null): void {
        if (!this.isActive()) { throw IDBMTransaction.txNotActiveError(); }
        this.active = false;
        this.error = error || null;
        this.tx.abort();
    }
    commit(): void {
        if (!this.isActive()) { throw IDBMTransaction.txNotActiveError(); }
        this.active = false;
        this.tx.commit();
    }

    addItem<TItem>(
        storeName: string,
        item: TItem,
        key?: IDBValidKey,
    ): Promise<IDBValidKey> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const addReq = store.add(item, key);
                addReq.onerror = () => {
                    if (this.isActive()) { this.abort(addReq.error); }
                    reject(addReq.error);
                };
                addReq.onsuccess = () => { resolve(addReq.result); };
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    addItems<TItem>(
        storeName: string,
        items: TItem[],
        keys?: (IDBValidKey | undefined)[],
    ): Promise<IDBValidKey[]> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }
            if (keys instanceof Array && items.length !== keys.length) {
                const error = new TypeError('The length of items and keys must be the same.');
                if (this.isActive()) { this.abort(error); }
                reject(error);
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const promises: Promise<IDBValidKey>[] = items.map((item, idx) => {
                    return new Promise((res, rej) => {
                        const addReq = store.add(item, keys?.[idx]);
                        addReq.onerror = () => { rej(addReq.error); };
                        addReq.onsuccess = () => { res(addReq.result); };
                    });
                });
                Promise.all(promises)
                    .then((response: IDBValidKey[]) => { resolve(response); })
                    .catch((error: Error) => {
                        if (this.isActive()) { this.abort(error); }
                        reject(error);
                    });
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    setItem<TItem>(
        storeName: string,
        item: TItem,
        key?: IDBValidKey,
    ): Promise<IDBValidKey> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const putReq = store.put(item, key);
                putReq.onerror = () => {
                    if (this.isActive()) { this.abort(putReq.error); }
                    reject(putReq.error);
                };
                putReq.onsuccess = () => { resolve(putReq.result); };
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    setItems<TItem>(
        storeName: string,
        items: TItem[],
        keys?: (IDBValidKey | undefined)[],
    ): Promise<IDBValidKey[]> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }
            if (keys instanceof Array && items.length !== keys.length) {
                const error = new TypeError('The length of items and keys must be the same.');
                if (this.isActive()) { this.abort(error); }
                reject(error);
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
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
                        if (this.isActive()) { this.abort(error); }
                        reject(error);
                    });
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    removeItem(storeName: string, key: IDBValidKey): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const deleteReq = store.delete(key);
                deleteReq.onerror = () => {
                    if (this.isActive()) { this.abort(deleteReq.error); }
                    reject(deleteReq.error);
                };
                deleteReq.onsuccess = () => { resolve(); };
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    removeItems(storeName: string, keys: IDBValidKey[]): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
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
                        if (this.isActive()) { this.abort(error); }
                        reject(error);
                    });
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    clearItems(storeName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const clearReq = store.clear();
                clearReq.onerror = () => {
                    if (this.isActive()) { this.abort(clearReq.error); }
                    reject(clearReq.error);
                };
                clearReq.onsuccess = () => { resolve(); };
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    getItem<TItem>(storeName: string, key: IDBValidKey): Promise<TItem | undefined> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const getReq = store.get(key);
                getReq.onerror = () => {
                    if (this.isActive()) { this.abort(getReq.error); }
                    reject(getReq.error);
                };
                getReq.onsuccess = () => { resolve(getReq.result as TItem | undefined); };
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    getFirstItem<TItem>(storeName: string, keyRange?: IDBMKeyRange): Promise<TItem | undefined> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const rawKeyRange = IDBMTransaction.generateRawKeyRange(keyRange);
                const cursorReq = store.openCursor(rawKeyRange, 'next');
                cursorReq.onerror = () => {
                    if (this.isActive()) { this.abort(cursorReq.error); }
                    reject(cursorReq.error);
                };
                cursorReq.onsuccess = () => {
                    const cursor = cursorReq.result;

                    if (cursor) { resolve(cursor.value as TItem); }
                    else { resolve(undefined); }
                };
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    getLastItem<TItem>(storeName: string, keyRange?: IDBMKeyRange): Promise<TItem | undefined> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const rawKeyRange = IDBMTransaction.generateRawKeyRange(keyRange);
                const cursorReq = store.openCursor(rawKeyRange, 'prev');
                cursorReq.onerror = () => {
                    if (this.isActive()) { this.abort(cursorReq.error); }
                    reject(cursorReq.error);
                };
                cursorReq.onsuccess = () => {
                    const cursor = cursorReq.result;

                    if (cursor) { resolve(cursor.value as TItem); }
                    else { resolve(undefined); }
                };
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    getFirstKey(storeName: string, keyRange?: IDBMKeyRange): Promise<IDBValidKey | undefined> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const rawKeyRange = IDBMTransaction.generateRawKeyRange(keyRange);
                const cursorReq = store.openKeyCursor(rawKeyRange, 'next');
                cursorReq.onerror = () => {
                    if (this.isActive()) { this.abort(cursorReq.error); }
                    reject(cursorReq.error);
                };
                cursorReq.onsuccess = () => {
                    const cursor = cursorReq.result;

                    if (cursor) { resolve(cursor.key); }
                    else { resolve(undefined); }
                };
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    getLastKey(storeName: string, keyRange?: IDBMKeyRange): Promise<IDBValidKey | undefined> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const rawKeyRange = IDBMTransaction.generateRawKeyRange(keyRange);
                const cursorReq = store.openKeyCursor(rawKeyRange, 'prev');
                cursorReq.onerror = () => {
                    if (this.isActive()) { this.abort(cursorReq.error); }
                    reject(cursorReq.error);
                };
                cursorReq.onsuccess = () => {
                    const cursor = cursorReq.result;

                    if (cursor) { resolve(cursor.key); }
                    else { resolve(undefined); }
                };
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    hasItem(storeName: string, key: IDBValidKey): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const getReq = store.getKey(key);
                getReq.onerror = () => {
                    if (this.isActive()) { this.abort(getReq.error); }
                    reject(getReq.error);
                };
                getReq.onsuccess = () => { resolve(typeof getReq.result !== 'undefined'); };
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    getItems<TItem>(storeName: string, keys: IDBValidKey[]): Promise<(TItem | undefined)[]>;
    getItems<TItem>(storeName: string, keyRange?: IDBMKeyRange): Promise<TItem[]>;
    getItems<TItem>(
        storeName: string,
        keysOrKeyRange: IDBValidKey[] | IDBMKeyRange | undefined,
    ): Promise<(TItem | undefined)[]> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);

                if (Array.isArray(keysOrKeyRange)) {
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
                            if (this.isActive()) { this.abort(error); }
                            reject(error);
                        });
                }
                else {
                    // keyRange?: IDBMKeyRange
                    const rawKeyRange = IDBMTransaction.generateRawKeyRange(keysOrKeyRange);
                    const getAllReq = store.getAll(rawKeyRange);
                    getAllReq.onerror = () => {
                        if (this.isActive()) { this.abort(getAllReq.error); }
                        reject(getAllReq.error);
                    };
                    getAllReq.onsuccess = () => { resolve(getAllReq.result as TItem[]); };
                }
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    getKeys(
        storeName: string,
        keyRange?: IDBMKeyRange,
    ): Promise<IDBValidKey[]> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const rawKeyRange = IDBMTransaction.generateRawKeyRange(keyRange);
                const getAllReq = store.getAllKeys(rawKeyRange);
                getAllReq.onerror = () => {
                    if (this.isActive()) { this.abort(getAllReq.error); }
                    reject(getAllReq.error);
                };
                getAllReq.onsuccess = () => { resolve(getAllReq.result); };
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    countItems(storeName: string, keyRange?: IDBMKeyRange): Promise<number> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const rawKeyRange = IDBMTransaction.generateRawKeyRange(keyRange);
                const countReq = store.count(rawKeyRange || undefined);
                countReq.onerror = () => {
                    if (this.isActive()) { this.abort(countReq.error); }
                    reject(countReq.error);
                };
                countReq.onsuccess = () => { resolve(countReq.result); };
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    hasAnyItems(storeName: string, keyRange?: IDBMKeyRange): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const rawKeyRange = IDBMTransaction.generateRawKeyRange(keyRange);
                const cursorReq = store.openKeyCursor(rawKeyRange);
                cursorReq.onerror = () => {
                    if (this.isActive()) { this.abort(cursorReq.error); }
                    reject(cursorReq.error);
                };
                cursorReq.onsuccess = () => { resolve(cursorReq.result !== null); };
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }
}
