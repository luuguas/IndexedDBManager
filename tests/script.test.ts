import 'fake-indexeddb/auto';
import { IDBManager } from '../src/script';

describe('openDatabaseのテスト', () => {
    test('正常にデータベースを開く', async () => {
        const idb = new IDBManager('MyDB', 1);
        await expect(idb.openDatabase()).resolves.toBe(true);
    });
    test('不正なバージョンを指定した場合は失敗する', async () => {
        const idb = new IDBManager('MyDB', 0);
        await expect(idb.openDatabase()).rejects.toThrow(TypeError);
    });
});
