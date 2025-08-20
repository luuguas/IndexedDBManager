import 'fake-indexeddb/auto';
import { IDBManager, IDBMStoreInfo } from '../src/script';

// データベース名を連番で生成するクロージャ
function dbNameGenerator(prefix: string, digits: number): () => string {
    let count = 1;
    return () => {
        const dbName = `${prefix}${count.toString().padStart(digits, '0')}`;
        count += 1;
        return dbName;
    };
}

const createDBName: () => string = dbNameGenerator('MyDB', 3);

describe('DBの開閉テスト(オブジェクトストアなし)', () => {
    beforeAll(() => {
        window.indexedDB = new IDBFactory(); // refresh the mocked IndexedDB
    });

    test('DBを正常に開いて閉じる', async () => {
        const dbName = createDBName();
        const idb = new IDBManager(dbName, 1, []);

        // 開く前
        expect(idb.isOpen()).toBe(false);
        expect(idb.isClose()).toBe(true);
        // 開いた後
        await expect(idb.openDatabase()).resolves.toBeUndefined();
        expect(idb.isOpen()).toBe(true);
        expect(idb.isClose()).toBe(false);
        // 閉じた後
        expect(idb.closeDatabase()).toBeUndefined();
        expect(idb.isOpen()).toBe(false);
        expect(idb.isClose()).toBe(true);
    });
    test('(open|close)Databaseを連続で呼び出す', async () => {
        const dbName = createDBName();
        const idb = new IDBManager(dbName, 1, []);

        await expect(idb.openDatabase()).resolves.toBeUndefined();
        await expect(idb.openDatabase()).resolves.toBeUndefined();
        expect(idb.closeDatabase()).toBeUndefined();
        expect(idb.closeDatabase()).toBeUndefined();
    });
    test('複数のインスタンスでDBを開く', async () => {
        const dbName = createDBName();
        const idb1 = new IDBManager(dbName, 1, []);
        const idb2 = new IDBManager(dbName, 1, []);

        await expect(idb1.openDatabase()).resolves.toBeUndefined();
        await expect(idb2.openDatabase()).resolves.toBeUndefined();
        idb1.closeDatabase(); idb2.closeDatabase();
    });

    test('不正なバージョンを指定するとDBを開けない', async () => {
        const dbName = createDBName();
        const idb = new IDBManager(dbName, 0, []);

        await expect(idb.openDatabase()).rejects.toThrow(TypeError); // IDBRequest.onerror は呼び出されない
        expect(idb.isClose()).toBe(true);
    });
    test('バージョンのダウングレードはできない', async () => {
        const dbName = createDBName();
        const idb1 = new IDBManager(dbName, 2, []);
        const idb2 = new IDBManager(dbName, 1, []);

        await expect(idb1.openDatabase()).resolves.toBeUndefined();
        idb1.closeDatabase();
        await expect(idb2.openDatabase())
            .rejects.toThrow(DOMException); // IDBRequest.onerror が呼び出される
    });
    test('他のインスタンスでDBを開いている状態ではアップグレードできない', async () => {
        const dbName = createDBName();
        const idb1 = new IDBManager(dbName, 1, []);
        const idb2 = new IDBManager(dbName, 2, []);

        await expect(idb1.openDatabase()).resolves.toBeUndefined();
        await expect(idb2.openDatabase()).rejects.toThrow(ReferenceError);

        // DBを閉じるとアップグレードできる
        idb1.closeDatabase();
        await expect(idb2.openDatabase()).resolves.toBeUndefined();
        idb2.closeDatabase();
    });
});

describe('DBの開閉テスト(オブジェクトストアあり)', () => {
    beforeAll(() => {
        window.indexedDB = new IDBFactory(); // refresh the mocked IndexedDB
    });

    const oldStoreInfos: IDBMStoreInfo[] = [
        { name: 'MyStore1' },
        { name: 'MyStore2', keyPath: 'key' },
        { name: 'MyStore3', autoIncrement: true },
    ];
    const newStoreInfos: IDBMStoreInfo[] = [
        // create
        { name: 'MyStore4', keyPath: 'key', autoIncrement: true },
        // unchanged
        { name: 'MyStore1' },
        // remove
        // { name: 'MyStore2', keyPath: 'key' },
        // reset
        { name: 'MyStore3', autoIncrement: false, resetOnUpgrade: true },
    ];

    test('オブジェクトストアを作成してDBを開く', async () => {
        const dbName = createDBName();
        const idb = new IDBManager(dbName, 1, oldStoreInfos);

        await expect(idb.openDatabase()).resolves.toBeUndefined();
        idb.closeDatabase();
    });
    test('オブジェクトストアの構成を更新する(アップグレード)', async () => {
        const dbName = createDBName();
        const oldIDB = new IDBManager(dbName, 1, oldStoreInfos);

        await expect(oldIDB.openDatabase()).resolves.toBeUndefined();
        oldIDB.closeDatabase();

        const newIDB = new IDBManager(dbName, 2, newStoreInfos);
        await expect(newIDB.openDatabase()).resolves.toBeUndefined();
        newIDB.closeDatabase();
    });
    test('アップグレードせずにstoreInfosを変更するとDBを開けない', async () => {
        const dbName = createDBName();
        const oldIDB = new IDBManager(dbName, 1, oldStoreInfos);

        await expect(oldIDB.openDatabase()).resolves.toBeUndefined();
        oldIDB.closeDatabase();

        const wrongIDB = new IDBManager(dbName, 1, newStoreInfos);
        await expect(wrongIDB.openDatabase()).rejects.toThrow(TypeError);

        // アップグレード(バージョンアップ)するとDBを開ける
        const newIDB = new IDBManager(dbName, 2, newStoreInfos);
        await expect(newIDB.openDatabase()).resolves.toBeUndefined();
        newIDB.closeDatabase();
    });
});
