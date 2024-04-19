import 'fake-indexeddb/auto';
import { IDBManager } from '../src/script';

describe('openDatabaseのテスト', () => {
    test('正常にデータベースを開く', async () => {
        const idb = new IDBManager('MyDB', 1);
        await expect(idb.openDatabase()).resolves.toBe(true);
    });
});
