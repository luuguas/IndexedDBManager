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
                if (this.isActive()) {
                    if (error instanceof Error) { this.abort(error); }
                    else { this.abort(); }
                }
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
                if (this.isActive()) {
                    if (error instanceof Error) { this.abort(error); }
                    else { this.abort(); }
                }
                reject(error);
            }
        });
    }
}
