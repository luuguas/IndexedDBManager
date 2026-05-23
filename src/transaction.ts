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
        this.error = error || null;
        this.tx.abort();
    }
    commit(): void {
        if (!this.isActive()) { throw IDBMTransaction.txNotActiveError(); }
        this.tx.commit();
    }
}
