import 'fake-indexeddb/auto';
import { IDBManager } from '../src/script';

// データベース名を連番で生成するクロージャ
function dbNameGenerator(prefix: string, digits: number): () => string {
    let count = 1;
    return () => {
        const dbName = `${prefix}${(count).toString().padStart(digits, '0')}`;
        count += 1;
        return dbName;
    };
}

const createDBName: () => string = dbNameGenerator('MyDB', 3);

describe('DBの開閉テスト(オブジェクトストアなし)', () => {
    test('DBを開く前', () => {
        const dbName = createDBName();
        const idb = new IDBManager(dbName, 1, []);

        expect(idb.isOpen()).toBe(false);
        expect(idb.isClose()).toBe(true);
    });
    test('DBを正常に開いて閉じる', async () => {
        const dbName = createDBName();
        const idb = new IDBManager(dbName, 1, []);

        await expect(idb.openDatabase()).resolves.toBe(true);
        expect(idb.isOpen()).toBe(true);
        expect(idb.isClose()).toBe(false);

        expect(idb.closeDatabase()).toBeUndefined();
        expect(idb.isOpen()).toBe(false);
        expect(idb.isClose()).toBe(true);
    });

    test('DBを連続で開く/閉じる', async () => {
        const dbName = createDBName();
        const idb = new IDBManager(dbName, 1, []);

        await expect(idb.openDatabase()).resolves.toBe(true);
        await expect(idb.openDatabase()).resolves.toBe(false);
        expect(idb.closeDatabase()).toBeUndefined();
        expect(idb.closeDatabase()).toBeUndefined();
    });
    test('不正なバージョンを指定するとDBを開けない', async () => {
        const dbName = createDBName();
        const idb = new IDBManager(dbName, 0, []);

        await expect(idb.openDatabase()).rejects.toThrow(TypeError);
    });
});
