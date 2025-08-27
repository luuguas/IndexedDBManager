import 'fake-indexeddb/auto';
import { IDBManager, IDBMStoreInfo } from '../src/script';
import { PublicIDBManager } from './env/public';

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
        const exp = expect(idb2.openDatabase());
        await exp.rejects.toThrow(ReferenceError);
        await exp.rejects.toThrow('The database cannot be upgraded because another instance has the database open.');

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
        const exp = expect(wrongIDB.openDatabase());
        await exp.rejects.toThrow(TypeError);
        await exp.rejects.toThrow('storeInfos does not match the object stores in the database. The database version should be upgraded.');

        // アップグレード(バージョンアップ)するとDBを開ける
        const newIDB = new IDBManager(dbName, 2, newStoreInfos);
        await expect(newIDB.openDatabase()).resolves.toBeUndefined();
        newIDB.closeDatabase();
    });
    test('DBを開いていないときverifyObjectStores(protectedなメンバ関数)を呼び出すとエラー', () => {
        const dbName = createDBName();
        const idb = new PublicIDBManager(dbName, 1, []);

        expect(() => { idb.p_verifyObjectStoreNames(); }).toThrow(ReferenceError);
    });
});

describe('単体データの追加・更新・削除テスト', () => {
    beforeAll(() => {
        window.indexedDB = new IDBFactory(); // refresh the mocked IndexedDB
    });

    const dbName = createDBName();
    const storeInfos: IDBMStoreInfo[] = [
        { name: 'MyStore1' },
        { name: 'MyStore2', keyPath: 'key' },
        { name: 'MyStore3', autoIncrement: true },
        { name: 'MyStore4', keyPath: 'key', autoIncrement: true },
    ];
    const idb = new IDBManager(dbName, 1, storeInfos);

    beforeEach(async () => {
        await idb.openDatabase();
    });
    afterEach(() => {
        idb.closeDatabase();
    });

    test('単体データを追加する', async () => {
        // keyPath: なし, autoIncrement: false
        // itemは任意の値
        await expect(idb.setItem('MyStore1', 'Apple', 'A')).resolves.toBe('A');
        await expect(idb.getItem('MyStore1', 'A')).resolves.toBe('Apple');

        // keyPath: あり, autoIncrement: false
        // itemはオブジェクトのみ
        await expect(idb.setItem('MyStore2', { key: 'B', value: 'Banana' })).resolves.toBe('B');
        await expect(idb.getItem('MyStore2', 'B')).resolves.toEqual({ key: 'B', value: 'Banana' });

        // keyPath: なし, autoIncrement: true
        // itemは任意の値
        await expect(idb.setItem('MyStore3', 'Cherry')).resolves.toBe(1); // 外部キー指定なし、連番が割り当てられる
        await expect(idb.setItem('MyStore3', { name: 'Donut' }, 'D')).resolves.toBe('D'); // 外部キー指定あり
        await expect(idb.setItem('MyStore3', ['Egg', 'Eggplant'])).resolves.toBe(2); // 連番は外部キー指定ありのとき増えない
        await expect(idb.getItem('MyStore3', 1)).resolves.toBe('Cherry');
        await expect(idb.getItem('MyStore3', 'D')).resolves.toEqual({ name: 'Donut' });
        await expect(idb.getItem('MyStore3', 2)).resolves.toEqual(['Egg', 'Eggplant']);

        // keyPath: あり, autoIncrement: true
        // itemはオブジェクトのみ
        await expect(idb.setItem('MyStore4', { key: 'F', value: 'Fish' })).resolves.toBe('F'); // 内部キー指定あり
        await expect(idb.setItem('MyStore4', { value: 'Grape' })).resolves.toBe(1); // 内部キー指定なし、連番が割り当てられる
        await expect(idb.getItem('MyStore4', 'F')).resolves.toEqual({ key: 'F', value: 'Fish' });
        await expect(idb.getItem('MyStore4', 1)).resolves.toEqual({ key: 1, value: 'Grape' }); // 内部キー指定なし、itemにkeyプロパティが増える
    });
    test('単体データを更新する', async () => {
        await expect(idb.getItem('MyStore1', 'A')).resolves.toBe('Apple'); // 更新前
        await expect(idb.setItem('MyStore1', 'Alice', 'A')).resolves.toBe('A');
        await expect(idb.getItem('MyStore1', 'A')).resolves.toBe('Alice'); // 更新後
    });
    test('単体データを削除する', async () => {
        await expect(idb.getItem('MyStore1', 'A')).resolves.toBeDefined(); // 削除前
        await expect(idb.removeItem('MyStore1', 'A')).resolves.toBeUndefined();
        await expect(idb.getItem('MyStore1', 'A')).resolves.toBeUndefined(); // 削除後
        await expect(idb.removeItem('MyStore1', 'A')).resolves.toBeUndefined(); // ストアに存在しないデータを指定しても成功(何もしない)
    });

    test('キー指定を間違えると追加できない', async () => {
        // keyPath: なし, autoIncrement: false
        await expect(idb.setItem('MyStore1', 'Hamburger')).rejects.toThrow(DOMException); // 外部キー指定なし

        // keyPath: あり, autoIncrement: false
        await expect(idb.setItem('MyStore2', { key: 'I', value: 'Icecream' }, 'I')).rejects.toThrow(DOMException); // 外部キー指定あり
        await expect(idb.setItem('MyStore2', { value: 'Icecream' })).rejects.toThrow(DOMException); // 内部キー指定なし
        await expect(idb.setItem('MyStore2', { value: 'Icecream' }, 'I')).rejects.toThrow(DOMException); // 内部キー指定なし・外部キー指定あり

        // keyPath: あり, autoIncrement: true
        await expect(idb.setItem('MyStore4', { key: 'J', value: 'Juice' }, 'J')).rejects.toThrow(DOMException); // 外部キー指定あり
        await expect(idb.setItem('MyStore4', { value: 'Juice' }, 'J')).rejects.toThrow(DOMException); // 内部キー指定なし・外部キー指定あり
    });
    test('itemの種類を間違えると追加できない', async () => {
        // keyPath: あり, autoIncrement: false
        await expect(idb.setItem('MyStore2', 'Kiwi')).rejects.toThrow(DOMException);

        // keyPath: あり, autoIncrement: true
        await expect(idb.setItem('MyStore4', 'Lemon')).rejects.toThrow(DOMException);
    });
});
