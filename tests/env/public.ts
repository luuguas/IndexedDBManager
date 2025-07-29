import { IDBManager, IDBMStoreInfo } from '../../src/script';

export class PublicIDBManager extends IDBManager {
    // accessor methods for testing protected members
    get p_dbName(): string { return this.dbName; }
    set p_dbName(value: string) { this.dbName = value; }
    get p_db(): IDBDatabase { return this.db; }
    set p_db(value: IDBDatabase) { this.db = value; }
    get p_dbVersion(): number { return this.dbVersion; }
    set p_dbVersion(value: number) { this.dbVersion = value; }
    get p_storeInfos(): IDBMStoreInfo[] { return this.storeInfos; }
    set p_storeInfos(value: IDBMStoreInfo[]) { this.storeInfos = value; }
    get p_dbNotOpenErrMsg(): string { return this.dbNotOpenErrMsg; }

    p_verifyObjectStoreNames(): boolean { return this.verifyObjectStoreNames(); }
}
