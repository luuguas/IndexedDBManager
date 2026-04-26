export class IDBMTransaction {
    protected db: IDBDatabase;
    protected tx: IDBTransaction;

    protected active: boolean;
    protected errorMessage: string | null;
    protected settlement: Promise<void>;

    constructor(
        db: IDBDatabase,
        storeNames: string | string[],
        mode?: 'readonly' | 'readwrite',
        durability?: IDBTransactionDurability,
    ) {
        this.db = db;
        this.tx = db.transaction(storeNames, mode, { durability });
        this.active = true;
        this.errorMessage = null;
        this.settlement = new Promise((resolve, reject) => {
            this.tx.onerror = () => {
                this.active = true;
                if (this.tx.error) { reject(this.tx.error); }
                else if (this.errorMessage) { reject(new DOMException(this.errorMessage, 'AbortError')); }
                else { reject(new DOMException('The transaction failed for some reason.', 'AbortError')); }
            };
            this.tx.oncomplete = () => {
                this.active = true;
                resolve();
            };
        });
    }

    isActive(): boolean { return this.active; }
    getSettlement(): Promise<void> { return this.settlement; }

    abort(): void {
        if (!this.isActive()) { throw new DOMException('The transaction is not active.', 'TransactionInactiveError'); }
        this.tx.abort();
    }
    commit(): void {
        if (!this.isActive()) { throw new DOMException('The transaction is not active.', 'TransactionInactiveError'); }
        this.tx.commit();
    }
}
