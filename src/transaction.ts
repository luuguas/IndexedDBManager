export class IDBMTransaction {
    protected db: IDBDatabase;
    protected tx: IDBTransaction;

    protected active: boolean;
    protected error: Error | null;
    protected settlement: Promise<void>;

    protected static txNotActiveError(): DOMException {
        return new DOMException('The transaction is not active.', 'TransactionInactiveError');
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
}
