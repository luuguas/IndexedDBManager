import { describe, test, expect, beforeAll } from 'vitest';
import { IDBManager } from '../src/manager';
import { deleteDB } from '../src/deleteDB';

describe('DBの削除テスト', () => {
    beforeAll(() => {
        window.indexedDB = new IDBFactory(); // refresh the mocked IndexedDB
    });

    test('DBを作って削除する', async () => {
        const dbName = 'MyDB';
        const idb = new IDBManager(dbName, 1, []);
        await expect(idb.openDB()).resolves.toBeUndefined();
        await expect(window.indexedDB.databases()).resolves.toEqual([{ name: dbName, version: 1 }]);

        idb.closeDB();
        await expect(deleteDB(dbName)).resolves.toBeUndefined();
        await expect(window.indexedDB.databases()).resolves.toEqual([]);
    });
    test('存在しないDBを削除しようとすると何も起きない(エラーにならない)', async () => {
        const dbName = 'WowDB';
        await expect(deleteDB(dbName)).resolves.toBeUndefined();
        await expect(window.indexedDB.databases()).resolves.toEqual([]);
    });

    test('DBを開いている状態で削除しようとすると失敗する', async () => {
        const dbName = 'MyDB';
        const idb = new IDBManager(dbName, 1, []);
        await expect(idb.openDB()).resolves.toBeUndefined();
        await expect(window.indexedDB.databases()).resolves.toEqual([{ name: dbName, version: 1 }]);

        await expect(deleteDB(dbName)).rejects.toThrow(new ReferenceError('Failed to delete the database because it is currently open in another instance.'));
        expect(idb.isOpen()).toBe(true); // データベースは開いたまま
        await expect(window.indexedDB.databases()).resolves.toEqual([{ name: dbName, version: 1 }]);
    });
});
