import 'fake-indexeddb/auto';
import { IDBManager } from '../src/script';

// データベース名を連番で生成するクロージャ
function dbNameGenerator(dbNamePrefix: string): () => string {
    const prefix = dbNamePrefix;
    let count = 1;

    return () => {
        const newDBName = `${prefix}${count}`;
        count += 1;
        return newDBName;
    };
}
const getNewDBName = dbNameGenerator('MyDB');

describe('openDatabase()のテスト (オブジェクトストアなし)', () => {
    const FirstDBName = getNewDBName();

    test('正常にデータベースを開く', async () => {
        const idb = new IDBManager(FirstDBName, 1, []);
        await expect(idb.openDatabase()).resolves.toBe(true);
    });
    test('不正なバージョンを指定した場合は失敗する', async () => {
        const idb = new IDBManager(getNewDBName(), 0, []);
        await expect(idb.openDatabase()).rejects.toThrow(TypeError);
    });

    test('openDatabase()を複数回呼び出したらfalseを返す', async () => {
        const idb = new IDBManager(getNewDBName(), 1, []);
        await expect(idb.openDatabase()).resolves.toBe(true);
        await expect(idb.openDatabase()).resolves.toBe(false);
    });
    test('既に存在するデータベースを開いたらfalseを返す', async () => {
        const idb = new IDBManager(FirstDBName, 1, []);
        await expect(idb.openDatabase()).resolves.toBe(false);
    });
});

describe('openDatabase()のテスト (オブジェクトストアあり)', () => {
    test('オブジェクトストアを作成する', async () => {
        const idb = new IDBManager(getNewDBName(), 1, [{ name: 'MyStore1' }]);
        await expect(idb.openDatabase()).resolves.toBe(true);
        expect(idb.getObjectStoreNames()).toContain('MyStore1');
    });
});
