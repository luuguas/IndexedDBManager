import 'fake-indexeddb/auto';
import { IDBManager } from '../src/script';

function dbNameGenerator(dbNamePrefix: string) {
    const prefix: string = dbNamePrefix;
    let count: number = 1;

    return () => {
        const newDBName = `${prefix}${count}`;
        count += 1;
        return newDBName;
    };
}
const getNewDBName = dbNameGenerator('MyDB');

describe('openDatabaseのテスト', () => {
    test('正常にデータベースを開く', async () => {
        const idb = new IDBManager(getNewDBName(), 1, []);
        await expect(idb.openDatabase()).resolves.toBe(true);
    });
    test('不正なバージョンを指定した場合は失敗する', async () => {
        const idb = new IDBManager(getNewDBName(), 0, []);
        await expect(idb.openDatabase()).rejects.toThrow(TypeError);
    });

    test('オブジェクトストアを作成する', async () => {
        const idb = new IDBManager(getNewDBName(), 1, [{ name: 'MyStore1' }]);
        await expect(idb.openDatabase()).resolves.toBe(true);
        expect(idb.objectStoreNames).toContain('MyStore1');
    });
});
