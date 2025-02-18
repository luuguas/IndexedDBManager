export class IDBManager {
    private db: IDBDatabase | null;
    private dbName: string;
    private dbVersion: number;

    constructor(dbName: string, dbVersion: number) {
        this.db = null;
        this.dbName = dbName;
        this.dbVersion = dbVersion;
    }
}
