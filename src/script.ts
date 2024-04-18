export class IDBManager {
    db: IDBDatabase | null;
    dbName: string;
    dbVersion: number;

    constructor(databaseName: string, version: number) {
        this.db = null;
        this.dbName = databaseName;
        this.dbVersion = version;
    }
}
