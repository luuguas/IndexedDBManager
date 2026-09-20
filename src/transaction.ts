export interface IDBMKeyRange {
    lower?: IDBValidKey;
    upper?: IDBValidKey;
    lowerOpen?: boolean;
    upperOpen?: boolean;
}

export class IDBMTransaction implements PromiseLike<void> {
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

    then<TResult1 = void, TResult2 = never>(
        onFulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | undefined | null,
        onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null,
    ): Promise<TResult1 | TResult2> {
        return this.settlement.then(onFulfilled, onRejected);
    }
    catch<TResult = never>(
        onRejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | undefined | null,
    ): Promise<void | TResult> {
        return this.settlement.catch(onRejected);
    }
    finally(onFinally?: (() => void) | undefined | null): Promise<void> {
        return this.settlement.finally(onFinally);
    }

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

    add<TValue>(
        storeName: string,
        value: TValue,
        key?: IDBValidKey,
    ): Promise<IDBValidKey> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const addReq = store.add(value, key);
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

    addMany<TValue>(
        storeName: string,
        values: TValue[],
        keys?: (IDBValidKey | undefined)[],
    ): Promise<IDBValidKey[]> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }
            if (Array.isArray(keys) && values.length !== keys.length) {
                const error = new TypeError('The length of values and keys must be the same.');
                if (this.isActive()) { this.abort(error); }
                reject(error);
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const promises: Promise<IDBValidKey>[] = values.map((value, idx) => {
                    return new Promise((res, rej) => {
                        const addReq = store.add(value, keys?.[idx]);
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

    put<TValue>(
        storeName: string,
        value: TValue,
        key?: IDBValidKey,
    ): Promise<IDBValidKey> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const putReq = store.put(value, key);
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

    putMany<TValue>(
        storeName: string,
        values: TValue[],
        keys?: (IDBValidKey | undefined)[],
    ): Promise<IDBValidKey[]> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }
            if (Array.isArray(keys) && values.length !== keys.length) {
                const error = new TypeError('The length of values and keys must be the same.');
                if (this.isActive()) { this.abort(error); }
                reject(error);
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const promises: Promise<IDBValidKey>[] = values.map((value, idx) => {
                    return new Promise((res, rej) => {
                        const putReq = store.put(value, keys?.[idx]);
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

    delete(storeName: string, key: IDBValidKey): Promise<void> {
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

    deleteMany(storeName: string, keys: IDBValidKey[]): Promise<void>;
    deleteMany(storeName: string, keyRange: IDBMKeyRange): Promise<void>;
    deleteMany(
        storeName: string,
        keysOrKeyRange: IDBValidKey[] | IDBMKeyRange,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);

                if (Array.isArray(keysOrKeyRange)) {
                    // keys: IDBValidKey[]
                    const promises: Promise<void>[] = keysOrKeyRange.map((key) => {
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
                else {
                    // keyRange: IDBMKeyRange
                    const rawKeyRange = IDBMTransaction.generateRawKeyRange(keysOrKeyRange);
                    const deleteReq = rawKeyRange ? store.delete(rawKeyRange) : store.clear();
                    deleteReq.onerror = () => {
                        if (this.isActive()) { this.abort(deleteReq.error); }
                        reject(deleteReq.error);
                    };
                    deleteReq.onsuccess = () => { resolve(); };
                }
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    clear(storeName: string): Promise<void> {
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

    get<TValue>(storeName: string, key: IDBValidKey): Promise<TValue | undefined> {
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
                getReq.onsuccess = () => { resolve(getReq.result as TValue | undefined); };
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    getFirst<TValue>(storeName: string, keyRange?: IDBMKeyRange): Promise<TValue | undefined> {
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

                    if (cursor) { resolve(cursor.value as TValue); }
                    else { resolve(undefined); }
                };
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    getLast<TValue>(storeName: string, keyRange?: IDBMKeyRange): Promise<TValue | undefined> {
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

                    if (cursor) { resolve(cursor.value as TValue); }
                    else { resolve(undefined); }
                };
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    getKey(storeName: string, key: IDBValidKey): Promise<IDBValidKey | undefined> {
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
                getReq.onsuccess = () => { resolve(getReq.result); };
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

                    if (cursor) { resolve(cursor.primaryKey); }
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

                    if (cursor) { resolve(cursor.primaryKey); }
                    else { resolve(undefined); }
                };
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    has(storeName: string, key: IDBValidKey): Promise<boolean> {
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

    getMany<TValue>(storeName: string, keys: IDBValidKey[]): Promise<(TValue | undefined)[]>;
    getMany<TValue>(storeName: string, keyRange?: IDBMKeyRange): Promise<TValue[]>;
    getMany<TValue>(
        storeName: string,
        keysOrKeyRange: IDBValidKey[] | IDBMKeyRange | undefined,
    ): Promise<(TValue | undefined)[]> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);

                if (Array.isArray(keysOrKeyRange)) {
                    // keys: IDBValidKey[]
                    const promises: Promise<TValue | undefined>[] = keysOrKeyRange.map((key) => {
                        return new Promise((res, rej) => {
                            const getReq = store.get(key);
                            getReq.onerror = () => { rej(getReq.error); };
                            getReq.onsuccess = () => { res(getReq.result as TValue | undefined); };
                        });
                    });

                    Promise.all(promises)
                        .then((response: (TValue | undefined)[]) => { resolve(response); })
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
                    getAllReq.onsuccess = () => { resolve(getAllReq.result as TValue[]); };
                }
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    getManyKeys(
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

    count(storeName: string, keyRange?: IDBMKeyRange): Promise<number> {
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

    hasAny(storeName: string, keyRange?: IDBMKeyRange): Promise<boolean> {
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

    iterator<TValue>(
        storeName: string,
        keyRange?: IDBMKeyRange,
    ): AsyncIterableIterator<TValue> {
        if (!this.isActive()) {
            throw IDBMTransaction.txNotActiveError();
        }

        try {
            const store = this.tx.objectStore(storeName);
            const rawKeyRange = IDBMTransaction.generateRawKeyRange(keyRange);
            const cursorReq = store.openCursor(rawKeyRange, 'next');

            const isActive = () => { return this.isActive(); };
            const abort = (error?: Error | null) => { this.abort(error); };

            let prev: Promise<IteratorResult<TValue | void>> = Promise.resolve(
                { value: undefined, done: false },
            );
            return {
                next(): Promise<IteratorResult<TValue>> {
                    const p = prev.then(
                        (prevResponse) => {
                            return new Promise<IteratorResult<TValue>>((resolve, reject) => {
                                if (!isActive()) {
                                    reject(IDBMTransaction.txNotActiveError());
                                    return;
                                }
                                if (prevResponse.done) {
                                    resolve({ value: undefined, done: true });
                                    return;
                                }

                                cursorReq.onerror = () => {
                                    if (isActive()) { abort(cursorReq.error); }
                                    reject(cursorReq.error);
                                };
                                cursorReq.onsuccess = () => {
                                    const cursor = cursorReq.result;

                                    if (cursor) {
                                        resolve({ value: cursor.value as TValue, done: false });
                                        if (isActive()) { cursor.continue(); }
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
                [Symbol.asyncIterator](): AsyncIterableIterator<TValue> { return this; },
            };
        }
        catch (error) {
            if (this.isActive()) { this.abort(error as Error); }
            throw error;
        }
    }

    reverseIterator<TValue>(
        storeName: string,
        keyRange?: IDBMKeyRange,
    ): AsyncIterableIterator<TValue> {
        if (!this.isActive()) {
            throw IDBMTransaction.txNotActiveError();
        }

        try {
            const store = this.tx.objectStore(storeName);
            const rawKeyRange = IDBMTransaction.generateRawKeyRange(keyRange);
            const cursorReq = store.openCursor(rawKeyRange, 'prev');

            const isActive = () => { return this.isActive(); };
            const abort = (error?: Error | null) => { this.abort(error); };

            let prev: Promise<IteratorResult<TValue | void>> = Promise.resolve(
                { value: undefined, done: false },
            );
            return {
                next(): Promise<IteratorResult<TValue>> {
                    const p = prev.then(
                        (prevResponse) => {
                            return new Promise<IteratorResult<TValue>>((resolve, reject) => {
                                if (!isActive()) {
                                    reject(IDBMTransaction.txNotActiveError());
                                    return;
                                }
                                if (prevResponse.done) {
                                    resolve({ value: undefined, done: true });
                                    return;
                                }

                                cursorReq.onerror = () => {
                                    if (isActive()) { abort(cursorReq.error); }
                                    reject(cursorReq.error);
                                };
                                cursorReq.onsuccess = () => {
                                    const cursor = cursorReq.result;

                                    if (cursor) {
                                        resolve({ value: cursor.value as TValue, done: false });
                                        if (isActive()) { cursor.continue(); }
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
                [Symbol.asyncIterator](): AsyncIterableIterator<TValue> { return this; },
            };
        }
        catch (error) {
            if (this.isActive()) { this.abort(error as Error); }
            throw error;
        }
    }

    keyIterator(
        storeName: string,
        keyRange?: IDBMKeyRange,
    ): AsyncIterableIterator<IDBValidKey> {
        if (!this.isActive()) {
            throw IDBMTransaction.txNotActiveError();
        }

        try {
            const store = this.tx.objectStore(storeName);
            const rawKeyRange = IDBMTransaction.generateRawKeyRange(keyRange);
            const cursorReq = store.openKeyCursor(rawKeyRange, 'next');

            const isActive = () => { return this.isActive(); };
            const abort = (error?: Error | null) => { this.abort(error); };

            let prev: Promise<IteratorResult<IDBValidKey | void>> = Promise.resolve(
                { value: undefined, done: false },
            );
            return {
                next(): Promise<IteratorResult<IDBValidKey>> {
                    const p = prev.then(
                        (prevResponse) => {
                            return new Promise<IteratorResult<IDBValidKey>>((resolve, reject) => {
                                if (!isActive()) {
                                    reject(IDBMTransaction.txNotActiveError());
                                    return;
                                }
                                if (prevResponse.done) {
                                    resolve({ value: undefined, done: true });
                                    return;
                                }

                                cursorReq.onerror = () => {
                                    if (isActive()) { abort(cursorReq.error); }
                                    reject(cursorReq.error);
                                };
                                cursorReq.onsuccess = () => {
                                    const cursor = cursorReq.result;

                                    if (cursor) {
                                        resolve({ value: cursor.primaryKey, done: false });
                                        if (isActive()) { cursor.continue(); }
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
        catch (error) {
            if (this.isActive()) { this.abort(error as Error); }
            throw error;
        }
    }

    reverseKeyIterator(
        storeName: string,
        keyRange?: IDBMKeyRange,
    ): AsyncIterableIterator<IDBValidKey> {
        if (!this.isActive()) {
            throw IDBMTransaction.txNotActiveError();
        }

        try {
            const store = this.tx.objectStore(storeName);
            const rawKeyRange = IDBMTransaction.generateRawKeyRange(keyRange);
            const cursorReq = store.openKeyCursor(rawKeyRange, 'prev');

            const isActive = () => { return this.isActive(); };
            const abort = (error?: Error | null) => { this.abort(error); };

            let prev: Promise<IteratorResult<IDBValidKey | void>> = Promise.resolve(
                { value: undefined, done: false },
            );
            return {
                next(): Promise<IteratorResult<IDBValidKey>> {
                    const p = prev.then(
                        (prevResponse) => {
                            return new Promise<IteratorResult<IDBValidKey>>((resolve, reject) => {
                                if (!isActive()) {
                                    reject(IDBMTransaction.txNotActiveError());
                                    return;
                                }
                                if (prevResponse.done) {
                                    resolve({ value: undefined, done: true });
                                    return;
                                }

                                cursorReq.onerror = () => {
                                    if (isActive()) { abort(cursorReq.error); }
                                    reject(cursorReq.error);
                                };
                                cursorReq.onsuccess = () => {
                                    const cursor = cursorReq.result;

                                    if (cursor) {
                                        resolve({ value: cursor.primaryKey, done: false });
                                        if (isActive()) { cursor.continue(); }
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
        catch (error) {
            if (this.isActive()) { this.abort(error as Error); }
            throw error;
        }
    }

    deleteManyByIndex(storeName: string, indexName: string, keys: IDBValidKey[]): Promise<void>;
    deleteManyByIndex(storeName: string, indexName: string, keyRange: IDBMKeyRange): Promise<void>;
    deleteManyByIndex(
        storeName: string,
        indexName: string,
        keysOrkeyRange: IDBValidKey[] | IDBMKeyRange,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const idx = store.index(indexName);

                if (Array.isArray(keysOrkeyRange)) {
                    // keys: IDBValidKey[]
                    const promises: Promise<void>[] = keysOrkeyRange.map((key) => {
                        return new Promise((res, rej) => {
                            const cursorReq = idx.openCursor(key);
                            cursorReq.onerror = () => { rej(cursorReq.error); };
                            cursorReq.onsuccess = () => {
                                const cursor = cursorReq.result;

                                if (cursor) {
                                    cursor.delete();
                                    cursor.continue();
                                }
                                else {
                                    res();
                                }
                            };
                        });
                    });

                    Promise.all(promises)
                        .then(() => { resolve(); })
                        .catch((error: DOMException) => {
                            if (this.isActive()) { this.abort(error); }
                            reject(error);
                        });
                }
                else {
                    // keyRange: IDBMKeyRange
                    const rawKeyRange = IDBMTransaction.generateRawKeyRange(keysOrkeyRange);
                    const cursorReq = idx.openCursor(rawKeyRange);

                    cursorReq.onerror = () => {
                        if (this.isActive()) { this.abort(cursorReq.error); }
                        reject(cursorReq.error);
                    };
                    cursorReq.onsuccess = () => {
                        const cursor = cursorReq.result;

                        if (cursor) {
                            cursor.delete();
                            cursor.continue();
                        }
                        else {
                            resolve();
                        }
                    };
                }
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    getByIndex<TValue>(
        storeName: string,
        indexName: string,
        key: IDBValidKey,
    ): Promise<TValue | undefined> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const idx = store.index(indexName);
                const getReq = idx.get(key);
                getReq.onerror = () => {
                    if (this.isActive()) { this.abort(getReq.error); }
                    reject(getReq.error);
                };
                getReq.onsuccess = () => { resolve(getReq.result as TValue | undefined); };
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    getFirstByIndex<TValue>(
        storeName: string,
        indexName: string,
        keyRange?: IDBMKeyRange,
    ): Promise<TValue | undefined> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const idx = store.index(indexName);
                const rawKeyRange = IDBMTransaction.generateRawKeyRange(keyRange);
                const cursorReq = idx.openCursor(rawKeyRange, 'next');
                cursorReq.onerror = () => {
                    if (this.isActive()) { this.abort(cursorReq.error); }
                    reject(cursorReq.error);
                };
                cursorReq.onsuccess = () => {
                    const cursor = cursorReq.result;

                    if (cursor) { resolve(cursor.value as TValue); }
                    else { resolve(undefined); }
                };
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    getLastByIndex<TValue>(
        storeName: string,
        indexName: string,
        keyRange?: IDBMKeyRange,
    ): Promise<TValue | undefined> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const idx = store.index(indexName);
                const rawKeyRange = IDBMTransaction.generateRawKeyRange(keyRange);
                const cursorReq = idx.openCursor(rawKeyRange, 'prev');
                cursorReq.onerror = () => {
                    if (this.isActive()) { this.abort(cursorReq.error); }
                    reject(cursorReq.error);
                };
                cursorReq.onsuccess = () => {
                    const cursor = cursorReq.result;

                    if (cursor) { resolve(cursor.value as TValue); }
                    else { resolve(undefined); }
                };
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    getKeyByIndex(
        storeName: string,
        indexName: string,
        key: IDBValidKey,
    ): Promise<IDBValidKey | undefined> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const idx = store.index(indexName);
                const getReq = idx.getKey(key);
                getReq.onerror = () => {
                    if (this.isActive()) { this.abort(getReq.error); }
                    reject(getReq.error);
                };
                getReq.onsuccess = () => { resolve(getReq.result); };
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    getFirstKeyByIndex(
        storeName: string,
        indexName: string,
        keyRange?: IDBMKeyRange,
    ): Promise<IDBValidKey | undefined> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const idx = store.index(indexName);
                const rawKeyRange = IDBMTransaction.generateRawKeyRange(keyRange);
                const cursorReq = idx.openKeyCursor(rawKeyRange, 'next');
                cursorReq.onerror = () => {
                    if (this.isActive()) { this.abort(cursorReq.error); }
                    reject(cursorReq.error);
                };
                cursorReq.onsuccess = () => {
                    const cursor = cursorReq.result;

                    if (cursor) { resolve(cursor.primaryKey); }
                    else { resolve(undefined); }
                };
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    getLastKeyByIndex(
        storeName: string,
        indexname: string,
        keyRange?: IDBMKeyRange,
    ): Promise<IDBValidKey | undefined> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const idx = store.index(indexname);
                const rawKeyRange = IDBMTransaction.generateRawKeyRange(keyRange);
                const cursorReq = idx.openKeyCursor(rawKeyRange, 'prev');
                cursorReq.onerror = () => {
                    if (this.isActive()) { this.abort(cursorReq.error); }
                    reject(cursorReq.error);
                };
                cursorReq.onsuccess = () => {
                    const cursor = cursorReq.result;

                    if (cursor) { resolve(cursor.primaryKey); }
                    else { resolve(undefined); }
                };
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    hasByIndex(
        storeName: string,
        indexName: string,
        key: IDBValidKey,
    ): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const idx = store.index(indexName);
                const getReq = idx.getKey(key);
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
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const idx = store.index(indexName);

                if (Array.isArray(keysOrKeyRange)) {
                    // keys: IDBValidKey[]
                    const promises: Promise<TValue | undefined>[] = keysOrKeyRange.map((key) => {
                        return new Promise((res, rej) => {
                            const getReq = idx.get(key);
                            getReq.onerror = () => { rej(getReq.error); };
                            getReq.onsuccess = () => { res(getReq.result as TValue | undefined); };
                        });
                    });

                    Promise.all(promises)
                        .then((response: (TValue | undefined)[]) => { resolve(response); })
                        .catch((error: DOMException) => {
                            if (this.isActive()) { this.abort(error); }
                            reject(error);
                        });
                }
                else {
                    // keyRange?: IDBMKeyRange
                    const rawKeyRange = IDBMTransaction.generateRawKeyRange(keysOrKeyRange);
                    const getAllReq = idx.getAll(rawKeyRange);
                    getAllReq.onerror = () => {
                        if (this.isActive()) { this.abort(getAllReq.error); }
                        reject(getAllReq.error);
                    };
                    getAllReq.onsuccess = () => { resolve(getAllReq.result as TValue[]); };
                }
            }
            catch (error) {
                if (this.isActive()) { this.abort(error as Error); }
                reject(error);
            }
        });
    }

    getManyKeysByIndex(
        storeName: string,
        indexName: string,
        keyRange?: IDBMKeyRange,
    ): Promise<IDBValidKey[]> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const idx = store.index(indexName);
                const rawKeyRange = IDBMTransaction.generateRawKeyRange(keyRange);
                const getAllReq = idx.getAllKeys(rawKeyRange);
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

    countByIndex(
        storeName: string,
        indexName: string,
        keyRange?: IDBMKeyRange,
    ): Promise<number> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const idx = store.index(indexName);
                const rawKeyRange = IDBMTransaction.generateRawKeyRange(keyRange);
                const countReq = idx.count(rawKeyRange || undefined);
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

    hasAnyByIndex(
        storeName: string,
        indexName: string,
        keyRange?: IDBMKeyRange,
    ): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (!this.isActive()) {
                reject(IDBMTransaction.txNotActiveError());
                return;
            }

            try {
                const store = this.tx.objectStore(storeName);
                const idx = store.index(indexName);
                const rawKeyRange = IDBMTransaction.generateRawKeyRange(keyRange);
                const cursorReq = idx.openKeyCursor(rawKeyRange);
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

    iteratorByIndex<TValue>(
        storeName: string,
        indexName: string,
        keyRange?: IDBMKeyRange,
    ): AsyncIterableIterator<TValue> {
        if (!this.isActive()) {
            throw IDBMTransaction.txNotActiveError();
        }

        try {
            const store = this.tx.objectStore(storeName);
            const idx = store.index(indexName);
            const rawKeyRange = IDBMTransaction.generateRawKeyRange(keyRange);
            const cursorReq = idx.openCursor(rawKeyRange, 'next');

            const isActive = () => { return this.isActive(); };
            const abort = (error?: Error | null) => { this.abort(error); };

            let prev: Promise<IteratorResult<TValue | void>> = Promise.resolve(
                { value: undefined, done: false },
            );
            return {
                next(): Promise<IteratorResult<TValue>> {
                    const p = prev.then(
                        (prevResponse) => {
                            return new Promise<IteratorResult<TValue>>((resolve, reject) => {
                                if (!isActive()) {
                                    reject(IDBMTransaction.txNotActiveError());
                                    return;
                                }
                                if (prevResponse.done) {
                                    resolve({ value: undefined, done: true });
                                    return;
                                }

                                cursorReq.onerror = () => {
                                    if (isActive()) { abort(cursorReq.error); }
                                    reject(cursorReq.error);
                                };
                                cursorReq.onsuccess = () => {
                                    const cursor = cursorReq.result;

                                    if (cursor) {
                                        resolve({ value: cursor.value as TValue, done: false });
                                        if (isActive()) { cursor.continue(); }
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
                [Symbol.asyncIterator](): AsyncIterableIterator<TValue> { return this; },
            };
        }
        catch (error) {
            if (this.isActive()) { this.abort(error as Error); }
            throw error;
        }
    }

    reverseIteratorByIndex<TValue>(
        storeName: string,
        indexName: string,
        keyRange?: IDBMKeyRange,
    ): AsyncIterableIterator<TValue> {
        if (!this.isActive()) {
            throw IDBMTransaction.txNotActiveError();
        }

        try {
            const store = this.tx.objectStore(storeName);
            const idx = store.index(indexName);
            const rawKeyRange = IDBMTransaction.generateRawKeyRange(keyRange);
            const cursorReq = idx.openCursor(rawKeyRange, 'prev');

            const isActive = () => { return this.isActive(); };
            const abort = (error?: Error | null) => { this.abort(error); };

            let prev: Promise<IteratorResult<TValue | void>> = Promise.resolve(
                { value: undefined, done: false },
            );
            return {
                next(): Promise<IteratorResult<TValue>> {
                    const p = prev.then(
                        (prevResponse) => {
                            return new Promise<IteratorResult<TValue>>((resolve, reject) => {
                                if (!isActive()) {
                                    reject(IDBMTransaction.txNotActiveError());
                                    return;
                                }
                                if (prevResponse.done) {
                                    resolve({ value: undefined, done: true });
                                    return;
                                }

                                cursorReq.onerror = () => {
                                    if (isActive()) { abort(cursorReq.error); }
                                    reject(cursorReq.error);
                                };
                                cursorReq.onsuccess = () => {
                                    const cursor = cursorReq.result;

                                    if (cursor) {
                                        resolve({ value: cursor.value as TValue, done: false });
                                        if (isActive()) { cursor.continue(); }
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
                [Symbol.asyncIterator](): AsyncIterableIterator<TValue> { return this; },
            };
        }
        catch (error) {
            if (this.isActive()) { this.abort(error as Error); }
            throw error;
        }
    }

    keyIteratorByIndex(
        storeName: string,
        indexName: string,
        keyRange?: IDBMKeyRange,
    ): AsyncIterableIterator<IDBValidKey> {
        if (!this.isActive()) {
            throw IDBMTransaction.txNotActiveError();
        }

        try {
            const store = this.tx.objectStore(storeName);
            const idx = store.index(indexName);
            const rawKeyRange = IDBMTransaction.generateRawKeyRange(keyRange);
            const cursorReq = idx.openKeyCursor(rawKeyRange, 'next');

            const isActive = () => { return this.isActive(); };
            const abort = (error?: Error | null) => { this.abort(error); };

            let prev: Promise<IteratorResult<IDBValidKey | void>> = Promise.resolve(
                { value: undefined, done: false },
            );
            return {
                next(): Promise<IteratorResult<IDBValidKey>> {
                    const p = prev.then(
                        (prevResponse) => {
                            return new Promise<IteratorResult<IDBValidKey>>((resolve, reject) => {
                                if (!isActive()) {
                                    reject(IDBMTransaction.txNotActiveError());
                                    return;
                                }
                                if (prevResponse.done) {
                                    resolve({ value: undefined, done: true });
                                    return;
                                }

                                cursorReq.onerror = () => {
                                    if (isActive()) { abort(cursorReq.error); }
                                    reject(cursorReq.error);
                                };
                                cursorReq.onsuccess = () => {
                                    const cursor = cursorReq.result;

                                    if (cursor) {
                                        resolve({ value: cursor.primaryKey, done: false });
                                        if (isActive()) { cursor.continue(); }
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
        catch (error) {
            if (this.isActive()) { this.abort(error as Error); }
            throw error;
        }
    }

    reverseKeyIteratorByIndex(
        storeName: string,
        indexName: string,
        keyRange?: IDBMKeyRange,
    ): AsyncIterableIterator<IDBValidKey> {
        if (!this.isActive()) {
            throw IDBMTransaction.txNotActiveError();
        }

        try {
            const store = this.tx.objectStore(storeName);
            const idx = store.index(indexName);
            const rawKeyRange = IDBMTransaction.generateRawKeyRange(keyRange);
            const cursorReq = idx.openKeyCursor(rawKeyRange, 'prev');

            const isActive = () => { return this.isActive(); };
            const abort = (error?: Error | null) => { this.abort(error); };

            let prev: Promise<IteratorResult<IDBValidKey | void>> = Promise.resolve(
                { value: undefined, done: false },
            );
            return {
                next(): Promise<IteratorResult<IDBValidKey>> {
                    const p = prev.then(
                        (prevResponse) => {
                            return new Promise<IteratorResult<IDBValidKey>>((resolve, reject) => {
                                if (!isActive()) {
                                    reject(IDBMTransaction.txNotActiveError());
                                    return;
                                }
                                if (prevResponse.done) {
                                    resolve({ value: undefined, done: true });
                                    return;
                                }

                                cursorReq.onerror = () => {
                                    if (isActive()) { abort(cursorReq.error); }
                                    reject(cursorReq.error);
                                };
                                cursorReq.onsuccess = () => {
                                    const cursor = cursorReq.result;

                                    if (cursor) {
                                        resolve({ value: cursor.primaryKey, done: false });
                                        if (isActive()) { cursor.continue(); }
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
        catch (error) {
            if (this.isActive()) { this.abort(error as Error); }
            throw error;
        }
    }
}
