import 'fake-indexeddb/auto';
import { IDBManager, IDBMStoreInfo } from '../src/manager';
import { IDBMKeyRange } from '../src/transaction';
import { PublicIDBManager } from './env/public';

/* eslint-disable no-restricted-syntax */

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
        const p = idb2.openDatabase();
        await expect(p).rejects.toThrow(ReferenceError);
        await expect(p).rejects.toThrow('The database cannot be upgraded because it is currently open on another instance.');

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
        { name: 'MyStore3', autoIncrement: false, resetOnUpgrade: 'all' },
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
        const p = wrongIDB.openDatabase();
        await expect(p).rejects.toThrow(TypeError);
        await expect(p).rejects.toThrow('The storeInfos does not match the object stores in the database. The database version needs upgrading.');

        // アップグレード(バージョンアップ)するとDBを開ける
        const newIDB = new IDBManager(dbName, 2, newStoreInfos);
        await expect(newIDB.openDatabase()).resolves.toBeUndefined();
        newIDB.closeDatabase();
    });
    test('DBを開いていないときverifyObjectStores(protectedなメンバ関数)を呼び出すとエラー', () => {
        const dbName = createDBName();
        const pidb = new PublicIDBManager(dbName, 1, []);

        expect(() => { pidb.p_verifyObjectStoreNames(); }).toThrow(ReferenceError);
    });
});

describe('CRUDs共通の例外処理', () => {
    beforeAll(() => {
        window.indexedDB = new IDBFactory(); // refresh the mocked IndexedDB
    });

    test('DBを開いていない状態で呼び出すとエラー', async () => {
        const idb = new IDBManager('', 1, []);

        await expect(idb.add('', {})).rejects.toThrow(ReferenceError);
        await expect(idb.addMany('', [])).rejects.toThrow(ReferenceError);
        await expect(idb.put('', {})).rejects.toThrow(ReferenceError);
        await expect(idb.putMany('', [])).rejects.toThrow(ReferenceError);
        await expect(idb.delete('', '')).rejects.toThrow(ReferenceError);
        await expect(idb.deleteMany('', [])).rejects.toThrow(ReferenceError);
        await expect(idb.clear('')).rejects.toThrow(ReferenceError);

        await expect(idb.get('', '')).rejects.toThrow(ReferenceError);
        await expect(idb.getFirst('')).rejects.toThrow(ReferenceError);
        await expect(idb.getLast('')).rejects.toThrow(ReferenceError);
        await expect(idb.getKey('', '')).rejects.toThrow(ReferenceError);
        await expect(idb.getFirstKey('')).rejects.toThrow(ReferenceError);
        await expect(idb.getLastKey('')).rejects.toThrow(ReferenceError);
        await expect(idb.has('', '')).rejects.toThrow(ReferenceError);
        await expect(idb.getMany('')).rejects.toThrow(ReferenceError);
        await expect(idb.getManyKeys('')).rejects.toThrow(ReferenceError);
        await expect(idb.count('')).rejects.toThrow(ReferenceError);
        await expect(idb.hasAny('')).rejects.toThrow(ReferenceError);
        expect(() => { idb.iterator(''); }).toThrow(ReferenceError);
        expect(() => { idb.reverseIterator(''); }).toThrow(ReferenceError);
        expect(() => { idb.keyIterator(''); }).toThrow(ReferenceError);
        expect(() => { idb.reverseKeyIterator(''); }).toThrow(ReferenceError);

        await expect(idb.getByIndex('', '', '')).rejects.toThrow(ReferenceError);
        await expect(idb.getFirstByIndex('', '')).rejects.toThrow(ReferenceError);
        await expect(idb.getLastByIndex('', '')).rejects.toThrow(ReferenceError);
        await expect(idb.getKeyByIndex('', '', '')).rejects.toThrow(ReferenceError);
        await expect(idb.getFirstKeyByIndex('', '')).rejects.toThrow(ReferenceError);
        await expect(idb.getLastKeyByIndex('', '')).rejects.toThrow(ReferenceError);
        await expect(idb.hasByIndex('', '', '')).rejects.toThrow(ReferenceError);
        await expect(idb.getManyByIndex('', '')).rejects.toThrow(ReferenceError);
        await expect(idb.getManyKeysByIndex('', '')).rejects.toThrow(ReferenceError);
        await expect(idb.countByIndex('', '')).rejects.toThrow(ReferenceError);
        await expect(idb.hasAnyByIndex('', '')).rejects.toThrow(ReferenceError);
        expect(() => { idb.iteratorByIndex('', ''); }).toThrow(ReferenceError);
        expect(() => { idb.reverseIteratorByIndex('', ''); }).toThrow(ReferenceError);
        expect(() => { idb.keyIteratorByIndex('', ''); }).toThrow(ReferenceError);
        expect(() => { idb.reverseKeyIteratorByIndex('', ''); }).toThrow(ReferenceError);
    });
    test('存在しないオブジェクトストアを指定するとエラー', async () => {
        const dbName = createDBName();
        const idb = new IDBManager(dbName, 1, [{ name: 'MyStore1' }]);
        await expect(idb.openDatabase()).resolves.toBeUndefined();

        await expect(idb.add('MyStoreX', {})).rejects.toThrow(DOMException);
        await expect(idb.addMany('MyStoreX', [])).rejects.toThrow(DOMException);
        await expect(idb.put('MyStoreX', {})).rejects.toThrow(DOMException);
        await expect(idb.putMany('MyStoreX', [])).rejects.toThrow(DOMException);
        await expect(idb.delete('MyStoreX', '')).rejects.toThrow(DOMException);
        await expect(idb.deleteMany('MyStoreX', [])).rejects.toThrow(DOMException);
        await expect(idb.clear('MyStoreX')).rejects.toThrow(DOMException);

        await expect(idb.get('MyStoreX', '')).rejects.toThrow(DOMException);
        await expect(idb.getFirst('MyStoreX')).rejects.toThrow(DOMException);
        await expect(idb.getLast('MyStoreX')).rejects.toThrow(DOMException);
        await expect(idb.getKey('MyStoreX', '')).rejects.toThrow(DOMException);
        await expect(idb.getFirstKey('MyStoreX')).rejects.toThrow(DOMException);
        await expect(idb.getLastKey('MyStoreX')).rejects.toThrow(DOMException);
        await expect(idb.has('MyStoreX', '')).rejects.toThrow(DOMException);
        await expect(idb.getMany('MyStoreX')).rejects.toThrow(DOMException);
        await expect(idb.getManyKeys('MyStoreX')).rejects.toThrow(DOMException);
        await expect(idb.count('MyStoreX')).rejects.toThrow(DOMException);
        await expect(idb.hasAny('MyStoreX')).rejects.toThrow(DOMException);
        expect(() => { idb.iterator('MyStoreX'); }).toThrow(DOMException);
        expect(() => { idb.reverseIterator('MyStoreX'); }).toThrow(DOMException);
        expect(() => { idb.keyIterator('MyStoreX'); }).toThrow(DOMException);
        expect(() => { idb.reverseKeyIterator('MyStoreX'); }).toThrow(DOMException);

        await expect(idb.getByIndex('MyStoreX', '', '')).rejects.toThrow(DOMException);
        await expect(idb.getFirstByIndex('MyStoreX', '')).rejects.toThrow(DOMException);
        await expect(idb.getLastByIndex('MyStoreX', '')).rejects.toThrow(DOMException);
        await expect(idb.getKeyByIndex('MyStoreX', '', '')).rejects.toThrow(DOMException);
        await expect(idb.getFirstKeyByIndex('MyStoreX', '')).rejects.toThrow(DOMException);
        await expect(idb.getLastKeyByIndex('MyStoreX', '')).rejects.toThrow(DOMException);
        await expect(idb.hasByIndex('MyStoreX', '', '')).rejects.toThrow(DOMException);
        await expect(idb.getManyByIndex('MyStoreX', '')).rejects.toThrow(DOMException);
        await expect(idb.getManyKeysByIndex('MyStoreX', '')).rejects.toThrow(DOMException);
        await expect(idb.countByIndex('MyStoreX', '')).rejects.toThrow(DOMException);
        await expect(idb.hasAnyByIndex('MyStoreX', '')).rejects.toThrow(DOMException);
        expect(() => { idb.iteratorByIndex('MyStoreX', ''); }).toThrow(DOMException);
        expect(() => { idb.reverseIteratorByIndex('MyStoreX', ''); }).toThrow(DOMException);
        expect(() => { idb.keyIteratorByIndex('MyStoreX', ''); }).toThrow(DOMException);
        expect(() => { idb.reverseKeyIteratorByIndex('MyStoreX', ''); }).toThrow(DOMException);
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

    test('1個のデータを追加する(add, put)', async () => {
        // keyPath: なし, autoIncrement: false
        // valueは任意の値
        await expect(idb.add('MyStore1', 'Apple', 'A')).resolves.toBe('A');
        await expect(idb.get('MyStore1', 'A')).resolves.toBe('Apple');

        // keyPath: あり, autoIncrement: false
        // valueはオブジェクトのみ
        await expect(idb.add('MyStore2', { key: 'B', value: 'Banana' })).resolves.toBe('B');
        await expect(idb.get('MyStore2', 'B')).resolves.toEqual({ key: 'B', value: 'Banana' });

        // keyPath: なし, autoIncrement: true
        // valueは任意の値
        await expect(idb.put('MyStore3', 'Cherry', undefined)).resolves.toBe(1); // 外部キー指定なし、連番が割り当てられる
        await expect(idb.put('MyStore3', { name: 'Donut' }, 'D')).resolves.toBe('D'); // 外部キー指定あり
        await expect(idb.put('MyStore3', ['Egg', 'Eggplant'])).resolves.toBe(2); // 連番は外部キー指定ありのとき増えない
        await expect(idb.get('MyStore3', 1)).resolves.toBe('Cherry');
        await expect(idb.get('MyStore3', 'D')).resolves.toEqual({ name: 'Donut' });
        await expect(idb.get('MyStore3', 2)).resolves.toEqual(['Egg', 'Eggplant']);

        // keyPath: あり, autoIncrement: true
        // valueはオブジェクトのみ
        await expect(idb.put('MyStore4', { key: 'F', value: 'Fish' })).resolves.toBe('F'); // 内部キー指定あり
        await expect(idb.put('MyStore4', { value: 'Grape' })).resolves.toBe(1); // 内部キー指定なし、連番が割り当てられる
        await expect(idb.get('MyStore4', 'F')).resolves.toEqual({ key: 'F', value: 'Fish' });
        await expect(idb.get('MyStore4', 1)).resolves.toEqual({ key: 1, value: 'Grape' }); // 内部キー指定なし、valueにkeyプロパティが増える
    });
    test('1個のデータを更新する', async () => {
        await expect(idb.get('MyStore1', 'A')).resolves.toBe('Apple'); // 更新前
        await expect(idb.put('MyStore1', 'Alice', 'A')).resolves.toBe('A');
        await expect(idb.get('MyStore1', 'A')).resolves.toBe('Alice'); // 更新後
    });
    test('1個のデータを削除する', async () => {
        await expect(idb.get('MyStore1', 'A')).resolves.toBeDefined(); // 削除前
        await expect(idb.delete('MyStore1', 'A')).resolves.toBeUndefined();
        await expect(idb.get('MyStore1', 'A')).resolves.toBeUndefined(); // 削除後
        await expect(idb.delete('MyStore1', 'A')).resolves.toBeUndefined(); // ストアに存在しないデータを指定しても成功(何もしない)
    });

    test('addに既存のキーを指定すると追加できない', async () => {
        // keyPath: なし, autoIncrement: false
        await expect(idb.put('MyStore1', 'Apple', 'A')).resolves.toBe('A');
        await expect(idb.add('MyStore1', 'Avocado', 'A')).rejects.toThrow(DOMException);

        // keyPath: あり, autoIncrement: false
        await expect(idb.add('MyStore2', { key: 'B', value: 'Blueberry' })).rejects.toThrow(DOMException);

        // keyPath: なし, autoIncrement: true
        await expect(idb.add('MyStore3', 'Chocolate', 1)).rejects.toThrow(DOMException);

        // keyPath: あり, autoIncrement: true
        await expect(idb.add('MyStore4', { key: 'F', value: 'French fries' })).rejects.toThrow(DOMException);
    });
    test('キー指定を間違えると追加できない', async () => {
        // keyPath: なし, autoIncrement: false
        await expect(idb.put('MyStore1', 'Hamburger')).rejects.toThrow(DOMException); // 外部キー指定なし

        // keyPath: あり, autoIncrement: false
        await expect(idb.put('MyStore2', { key: 'I', value: 'Icecream' }, 'I')).rejects.toThrow(DOMException); // 外部キー指定あり
        await expect(idb.put('MyStore2', { value: 'Icecream' })).rejects.toThrow(DOMException); // 内部キー指定なし
        await expect(idb.put('MyStore2', { value: 'Icecream' }, 'I')).rejects.toThrow(DOMException); // 内部キー指定なし・外部キー指定あり

        // keyPath: あり, autoIncrement: true
        await expect(idb.put('MyStore4', { key: 'J', value: 'Juice' }, 'J')).rejects.toThrow(DOMException); // 外部キー指定あり
        await expect(idb.put('MyStore4', { value: 'Juice' }, 'J')).rejects.toThrow(DOMException); // 内部キー指定なし・外部キー指定あり
    });
    test('valueの種類を間違えると追加できない', async () => {
        // keyPath: あり, autoIncrement: false
        await expect(idb.put('MyStore2', 'Kiwi')).rejects.toThrow(DOMException);

        // keyPath: あり, autoIncrement: true
        await expect(idb.put('MyStore4', 'Lemon')).rejects.toThrow(DOMException);
    });
    test('不正なキーを渡すと削除できない', async () => {
        await expect(idb.delete('MyStore1', null as unknown as IDBValidKey)).rejects.toThrow(DOMException);
    });
});

describe('複数データの追加・更新・削除テスト', () => {
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

    test('複数のデータを追加する(addMany, putMany)', async () => {
        // keyPath: なし, autoIncrement: false
        // valueは任意の値
        const values1 = ['Apple', { name: 'Banana' }];
        const keys1 = ['A', 'B'];
        await expect(idb.addMany('MyStore1', values1, keys1)).resolves.toEqual(keys1);
        await expect(idb.get('MyStore1', 'A')).resolves.toBe('Apple');
        await expect(idb.get('MyStore1', 'B')).resolves.toEqual({ name: 'Banana' });

        // keyPath: あり, autoIncrement: false
        // valueはオブジェクトのみ
        const values2 = [{ key: 'C', value: 'Cherry' }, { key: 'D', value: 'Donut' }];
        await expect(idb.addMany('MyStore2', values2)).resolves.toEqual(['C', 'D']);
        await expect(idb.get('MyStore2', 'C')).resolves.toEqual({ key: 'C', value: 'Cherry' });
        await expect(idb.get('MyStore2', 'D')).resolves.toEqual({ key: 'D', value: 'Donut' });

        // keyPath: なし, autoIncrement: true
        // valueは任意の値
        const values3 = ['Egg', { name: 'Fish' }, ['Grape', 'Grapefruit']];
        const keys3 = [undefined, 'F', undefined];
        await expect(idb.putMany('MyStore3', values3, keys3)).resolves.toEqual([1, 'F', 2]);
        await expect(idb.get('MyStore3', 1)).resolves.toBe('Egg');
        await expect(idb.get('MyStore3', 'F')).resolves.toEqual({ name: 'Fish' });
        await expect(idb.get('MyStore3', 2)).resolves.toEqual(['Grape', 'Grapefruit']);

        // keyPath: あり, autoIncrement: true
        // valueはオブジェクトのみ
        const values4 = [{ key: 'H', value: 'Hamburger' }, { value: 'Icecream' }];
        await expect(idb.putMany('MyStore4', values4)).resolves.toEqual(['H', 1]);
        await expect(idb.get('MyStore4', 'H')).resolves.toEqual({ key: 'H', value: 'Hamburger' });
        await expect(idb.get('MyStore4', 1)).resolves.toEqual({ key: 1, value: 'Icecream' });
    });
    test('複数のデータを更新する', async () => {
        const values = [{ name: 'Alice' }, 'Bob', ['Chris', 'Charlie']]; // 最後は追加データ
        const keys = ['A', 'B', 'C'];

        // 更新前
        await expect(idb.get('MyStore1', 'A')).resolves.toBe('Apple');
        await expect(idb.get('MyStore1', 'B')).resolves.toEqual({ name: 'Banana' });
        await expect(idb.get('MyStore1', 'C')).resolves.toBeUndefined();

        await expect(idb.putMany('MyStore1', values, keys)).resolves.toEqual(keys);

        // 更新後
        await expect(idb.get('MyStore1', 'A')).resolves.toEqual({ name: 'Alice' });
        await expect(idb.get('MyStore1', 'B')).resolves.toBe('Bob');
        await expect(idb.get('MyStore1', 'C')).resolves.toEqual(['Chris', 'Charlie']);
    });
    test('複数のデータを削除する', async () => {
        // keys: IDBValidKey[]

        // 削除前
        await expect(idb.get('MyStore1', 'A')).resolves.toBeDefined();
        await expect(idb.get('MyStore1', 'B')).resolves.toBeDefined();
        await expect(idb.get('MyStore1', 'C')).resolves.toBeDefined();

        await expect(idb.deleteMany('MyStore1', ['B', 'C'])).resolves.toBeUndefined();

        // 削除後
        await expect(idb.get('MyStore1', 'A')).resolves.toBeDefined();
        await expect(idb.get('MyStore1', 'B')).resolves.toBeUndefined();
        await expect(idb.get('MyStore1', 'C')).resolves.toBeUndefined();

        // keyRange: IDBKeyRange

        await expect(idb.addMany('MyStore1', ['Book', 'Car', 'Desk'], ['B', 'C', 'D'])).resolves.toEqual(['B', 'C', 'D']);

        // 削除前
        await expect(idb.get('MyStore1', 'A')).resolves.toBeDefined();
        await expect(idb.get('MyStore1', 'B')).resolves.toBeDefined();
        await expect(idb.get('MyStore1', 'C')).resolves.toBeDefined();
        await expect(idb.get('MyStore1', 'D')).resolves.toBeDefined();

        await expect(idb.deleteMany('MyStore1', { lower: 'B', upper: 'C' })).resolves.toBeUndefined();

        // 削除後
        await expect(idb.get('MyStore1', 'A')).resolves.toBeDefined();
        await expect(idb.get('MyStore1', 'B')).resolves.toBeUndefined();
        await expect(idb.get('MyStore1', 'C')).resolves.toBeUndefined();
        await expect(idb.get('MyStore1', 'D')).resolves.toBeDefined();

        // 全範囲削除
        await expect(idb.deleteMany('MyStore1', {})).resolves.toBeUndefined();

        await expect(idb.get('MyStore1', 'A')).resolves.toBeUndefined();
        await expect(idb.get('MyStore1', 'B')).resolves.toBeUndefined();
        await expect(idb.get('MyStore1', 'C')).resolves.toBeUndefined();
        await expect(idb.get('MyStore1', 'D')).resolves.toBeUndefined();
    });
    test('全てのデータを削除する', async () => {
        // 削除前
        await expect(idb.get('MyStore2', 'C')).resolves.toBeDefined();
        await expect(idb.get('MyStore2', 'D')).resolves.toBeDefined();

        await expect(idb.clear('MyStore2')).resolves.toBeUndefined();

        // 削除後
        await expect(idb.get('MyStore2', 'C')).resolves.toBeUndefined();
        await expect(idb.get('MyStore2', 'D')).resolves.toBeUndefined();
    });

    test('addManyに既存のキーを指定すると追加できない', async () => {
        const values1 = ['Apple', { name: 'Banana' }];
        const keys1 = ['A', 'B'];
        await expect(idb.putMany('MyStore1', values1, keys1)).resolves.toEqual(keys1);

        const values2 = ['Chocolate', { name: 'Blueberry' }];
        const keys2 = ['C', 'B'];
        await expect(idb.addMany('MyStore1', values2, keys2)).rejects.toThrow(DOMException);
        await expect(idb.get('MyStore1', 'C')).resolves.toBeUndefined(); // ロールバック
    });
    test('キー指定を間違えると追加できない', async () => {
        // keyPath: なし, autoIncrement: false
        const values1 = ['Juice', 'Kiwi'];
        const keys1 = ['J', undefined]; // keys[1]: 外部キー指定なし
        await expect(idb.addMany('MyStore1', values1, keys1)).rejects.toThrow(DOMException);
        await expect(idb.putMany('MyStore1', values1, keys1)).rejects.toThrow(DOMException);
        await expect(idb.get('MyStore1', 'J')).resolves.toBeUndefined(); // ロールバック

        // keyPath: あり, autoIncrement: false
        const values2 = [{ key: 'L', value: 'Lemon' }, { value: 'Melon' }];
        const keys2 = ['L', undefined]; // keys2[0]: 外部キー指定あり / keys2[1]: 内部キー指定なし
        await expect(idb.putMany('MyStore2', values2, keys2)).rejects.toThrow(DOMException);

        // keyPath: あり, autoIncrement: true
        const values4 = [{ key: 'N', value: 'Noodle' }, { key: 'O', value: 'Orange' }];
        const keys4 = [undefined, 'O']; // keys[1]: 外部キー指定あり
        await expect(idb.putMany('MyStore4', values4, keys4)).rejects.toThrow(DOMException);
        await expect(idb.get('MyStore1', 'N')).resolves.toBeUndefined(); // ロールバック
    });
    test('valuesとkeysの長さが違うと追加できない', async () => {
        const values = ['Pear', 'Quince'];
        const keys = ['P', 'Q', 'R'];
        await expect(idb.addMany('MyStore1', values, keys)).rejects.toThrow(TypeError);
        await expect(idb.putMany('MyStore1', values, keys)).rejects.toThrow(TypeError);
    });
    test('不正なキーを渡すと削除できない', async () => {
        const keys = ['A', null];
        await expect(idb.deleteMany('MyStore1', keys as IDBValidKey[])).rejects.toThrow(DOMException);
        await expect(idb.get('MyStore1', 'A')).resolves.toBeDefined(); // ロールバック
    });
});

describe('generateKeyRangeの動作テスト', () => {
    type IDBKeyRangeInfo = {
        lower: unknown,
        upper: unknown,
        lowerOpen: boolean,
        upperOpen: boolean,
    } | null;
    function getKeyRangeInfo(rawKeyRange: IDBKeyRange | null): IDBKeyRangeInfo {
        if (rawKeyRange) {
            return {
                lower: rawKeyRange.lower,
                upper: rawKeyRange.upper,
                lowerOpen: rawKeyRange.lowerOpen,
                upperOpen: rawKeyRange.upperOpen,
            };
        }
        return null;
    }

    const testCases: { exp: IDBMKeyRange, toEq: IDBKeyRangeInfo }[] = [
        // 下限なし・上限なし (全範囲)
        { exp: {}, toEq: null },
        { exp: { lowerOpen: true, upperOpen: false }, toEq: null }, // lowerOpen, upperOpen は無視
        // 下限あり・上限なし
        {
            exp: { lower: 'A' },
            toEq: {
                lower: 'A', upper: undefined, lowerOpen: false, upperOpen: true,
            },
        },
        {
            exp: { lower: 'A', lowerOpen: true, upperOpen: false }, // upperOpen は無視
            toEq: {
                lower: 'A', upper: undefined, lowerOpen: true, upperOpen: true,
            },
        },
        // 下限なし・上限あり
        {
            exp: { upper: 'Z' },
            toEq: {
                lower: undefined, upper: 'Z', lowerOpen: true, upperOpen: false,
            },
        },
        {
            exp: { upper: 'Z', lowerOpen: false, upperOpen: true }, // lowerOpen は無視
            toEq: {
                lower: undefined, upper: 'Z', lowerOpen: true, upperOpen: true,
            },
        },
        // 下限あり・上限あり
        {
            exp: { lower: 'A', upper: 'Z' },
            toEq: {
                lower: 'A', upper: 'Z', lowerOpen: false, upperOpen: false,
            },
        },
        {
            exp: { lower: 'A', upper: 'Z', upperOpen: true },
            toEq: {
                lower: 'A', upper: 'Z', lowerOpen: false, upperOpen: true,
            },
        },
        {
            exp: {
                lower: 'A', upper: 'Z', lowerOpen: true, upperOpen: true,
            },
            toEq: {
                lower: 'A', upper: 'Z', lowerOpen: true, upperOpen: true,
            },
        },
    ];

    test('引数なしの場合はnullを返す', () => {
        expect(IDBManager.generateRawKeyRange()).toBeNull();
    });
    test('引数にIDBMKeyRangeを渡すとプロパティに応じてIDBKeyRangeまたはnullを返す', () => {
        testCases.forEach((val) => {
            expect(getKeyRangeInfo(IDBManager.generateRawKeyRange(val.exp))).toEqual(val.toEq);
        });
    });

    test('キー指定を間違えると失敗する', () => {
        // キーがIDBValidkeyでない
        expect(() => {
            IDBManager.generateRawKeyRange({ lower: 'A', upper: null as unknown as IDBValidKey });
        }).toThrow(DOMException);
        // lower > upper
        expect(() => {
            IDBManager.generateRawKeyRange({ lower: 'Z', upper: 'A' });
        }).toThrow(DOMException);
        // lower == upper かついずれかの境界が開いている
        expect(() => {
            IDBManager.generateRawKeyRange({ lower: 'A', upper: 'A', lowerOpen: true });
        }).toThrow(DOMException);
    });
});

describe('単体データの取得テスト', () => {
    beforeAll(() => {
        window.indexedDB = new IDBFactory(); // refresh the mocked IndexedDB
    });

    const dbName = createDBName();
    const storeInfos: IDBMStoreInfo[] = [{ name: 'MyStore' }];
    const idb = new IDBManager(dbName, 1, storeInfos);

    const values = ['Banana', 'Donut', 'Egg', 'Grape', 'Juice', 'Lemon', 'Noodle', 'Orange', 'Strawberry', 'Vegetable'];
    const keys = ['B', 'D', 'E', 'G', 'J', 'L', 'N', 'O', 'S', 'V'];

    beforeAll(async () => {
        await idb.openDatabase();
        await idb.putMany('MyStore', values, keys);
        idb.closeDatabase();
    });

    beforeEach(async () => {
        await idb.openDatabase();
    });
    afterEach(() => {
        idb.closeDatabase();
    });

    test('get', async () => {
        await expect(idb.get('MyStore', 'B')).resolves.toBe('Banana');
        await expect(idb.get('MyStore', 'G')).resolves.toBe('Grape');
        await expect(idb.get('MyStore', 'M')).resolves.toBeUndefined();
    });
    test('getFirst', async () => {
        // lower指定なし
        await expect(idb.getFirst('MyStore')).resolves.toBe('Banana');
        await expect(idb.getFirst('MyStore', {})).resolves.toBe('Banana');
        await expect(idb.getFirst('MyStore', { upper: 'M' })).resolves.toBe('Banana');
        await expect(idb.getFirst('MyStore', { upper: 'A' })).resolves.toBeUndefined();
        await expect(idb.getFirst('MyStore', { upper: 'B', upperOpen: true })).resolves.toBeUndefined();

        // lower指定あり
        await expect(idb.getFirst('MyStore', { lower: 'A' })).resolves.toBe('Banana');
        await expect(idb.getFirst('MyStore', { lower: 'B' })).resolves.toBe('Banana');
        await expect(idb.getFirst('MyStore', { lower: 'B', lowerOpen: true })).resolves.toBe('Donut');
        await expect(idb.getFirst('MyStore', { lower: 'V' })).resolves.toBe('Vegetable');
        await expect(idb.getFirst('MyStore', { lower: 'V', lowerOpen: true })).resolves.toBeUndefined();
        await expect(idb.getFirst('MyStore', { lower: 'P', upper: 'R' })).resolves.toBeUndefined();
    });
    test('getLast', async () => {
        // upper指定なし
        await expect(idb.getLast('MyStore')).resolves.toBe('Vegetable');
        await expect(idb.getLast('MyStore', {})).resolves.toBe('Vegetable');
        await expect(idb.getLast('MyStore', { lower: 'H' })).resolves.toBe('Vegetable');
        await expect(idb.getLast('MyStore', { lower: 'W' })).resolves.toBeUndefined();
        await expect(idb.getLast('MyStore', { lower: 'V', lowerOpen: true })).resolves.toBeUndefined();

        // upper指定あり
        await expect(idb.getLast('MyStore', { upper: 'Z' })).resolves.toBe('Vegetable');
        await expect(idb.getLast('MyStore', { upper: 'V' })).resolves.toBe('Vegetable');
        await expect(idb.getLast('MyStore', { upper: 'V', upperOpen: true })).resolves.toBe('Strawberry');
        await expect(idb.getLast('MyStore', { upper: 'B' })).resolves.toBe('Banana');
        await expect(idb.getLast('MyStore', { upper: 'B', upperOpen: true })).resolves.toBeUndefined();
        await expect(idb.getLast('MyStore', { lower: 'P', upper: 'R' })).resolves.toBeUndefined();
    });
    test('getKey', async () => {
        await expect(idb.getKey('MyStore', 'B')).resolves.toBe('B');
        await expect(idb.getKey('MyStore', 'G')).resolves.toBe('G');
        await expect(idb.getKey('MyStore', 'M')).resolves.toBeUndefined();
    });
    test('getFirstKey', async () => {
        // lower指定なし
        await expect(idb.getFirstKey('MyStore')).resolves.toBe('B');
        await expect(idb.getFirstKey('MyStore', {})).resolves.toBe('B');
        await expect(idb.getFirstKey('MyStore', { upper: 'M' })).resolves.toBe('B');
        await expect(idb.getFirstKey('MyStore', { upper: 'A' })).resolves.toBeUndefined();
        await expect(idb.getFirstKey('MyStore', { upper: 'B', upperOpen: true })).resolves.toBeUndefined();

        // lower指定あり
        await expect(idb.getFirstKey('MyStore', { lower: 'A' })).resolves.toBe('B');
        await expect(idb.getFirstKey('MyStore', { lower: 'B' })).resolves.toBe('B');
        await expect(idb.getFirstKey('MyStore', { lower: 'B', lowerOpen: true })).resolves.toBe('D');
        await expect(idb.getFirstKey('MyStore', { lower: 'V' })).resolves.toBe('V');
        await expect(idb.getFirstKey('MyStore', { lower: 'V', lowerOpen: true })).resolves.toBeUndefined();
        await expect(idb.getFirstKey('MyStore', { lower: 'P', upper: 'R' })).resolves.toBeUndefined();
    });
    test('getLastKey', async () => {
        // upper指定なし
        await expect(idb.getLastKey('MyStore')).resolves.toBe('V');
        await expect(idb.getLastKey('MyStore', {})).resolves.toBe('V');
        await expect(idb.getLastKey('MyStore', { lower: 'H' })).resolves.toBe('V');
        await expect(idb.getLastKey('MyStore', { lower: 'W' })).resolves.toBeUndefined();
        await expect(idb.getLastKey('MyStore', { lower: 'V', lowerOpen: true })).resolves.toBeUndefined();

        // upper指定あり
        await expect(idb.getLastKey('MyStore', { upper: 'Z' })).resolves.toBe('V');
        await expect(idb.getLastKey('MyStore', { upper: 'V' })).resolves.toBe('V');
        await expect(idb.getLastKey('MyStore', { upper: 'V', upperOpen: true })).resolves.toBe('S');
        await expect(idb.getLastKey('MyStore', { upper: 'B' })).resolves.toBe('B');
        await expect(idb.getLastKey('MyStore', { upper: 'B', upperOpen: true })).resolves.toBeUndefined();
        await expect(idb.getLastKey('MyStore', { lower: 'P', upper: 'R' })).resolves.toBeUndefined();
    });
    test('has', async () => {
        await expect(idb.has('MyStore', 'B')).resolves.toBe(true);
        await expect(idb.has('MyStore', 'G')).resolves.toBe(true);
        await expect(idb.has('MyStore', 'M')).resolves.toBe(false);
    });
});

describe('複数データの取得テスト', () => {
    beforeAll(() => {
        window.indexedDB = new IDBFactory(); // refresh the mocked IndexedDB
    });

    const dbName = createDBName();
    const storeInfos: IDBMStoreInfo[] = [{ name: 'MyStore' }];
    const idb = new IDBManager(dbName, 1, storeInfos);

    const values = ['Banana', 'Donut', 'Egg', 'Grape', 'Juice', 'Lemon', 'Noodle', 'Orange', 'Strawberry', 'Vegetable'];
    const keys = ['B', 'D', 'E', 'G', 'J', 'L', 'N', 'O', 'S', 'V'];

    beforeAll(async () => {
        await idb.openDatabase();
        await idb.putMany('MyStore', values, keys);
        idb.closeDatabase();
    });

    beforeEach(async () => {
        await idb.openDatabase();
    });
    afterEach(() => {
        idb.closeDatabase();
    });

    test('getMany', async () => {
        // keys: IDBValidKey[]
        const keys1 = ['L', 'E', 'M', 'O', 'N'];
        await expect(idb.getMany('MyStore', keys1)).resolves.toEqual(['Lemon', 'Egg', undefined, 'Orange', 'Noodle']);

        // keyRange?: IDBMKeyRange
        await expect(idb.getMany('MyStore')).resolves.toEqual(values); // 全範囲
        const keyRange1 = { lower: 'E', upper: 'O', lowerOpen: true };
        await expect(idb.getMany('MyStore', keyRange1)).resolves.toEqual(['Grape', 'Juice', 'Lemon', 'Noodle', 'Orange']);
        const keyRange2 = { lower: 'P', upper: 'R' };
        await expect(idb.getMany('MyStore', keyRange2)).resolves.toEqual([]);
    });
    test('getManyKeys', async () => {
        await expect(idb.getManyKeys('MyStore')).resolves.toEqual(keys); // 全範囲
        const keyRange1 = { lower: 'E', upper: 'O', lowerOpen: true };
        await expect(idb.getManyKeys('MyStore', keyRange1)).resolves.toEqual(['G', 'J', 'L', 'N', 'O']);
        const keyRange2 = { lower: 'P', upper: 'R' };
        await expect(idb.getManyKeys('MyStore', keyRange2)).resolves.toEqual([]);
    });
    test('count', async () => {
        await expect(idb.count('MyStore')).resolves.toEqual(10); // 全範囲
        const keyRange1 = { lower: 'E', upper: 'O', lowerOpen: true };
        await expect(idb.count('MyStore', keyRange1)).resolves.toEqual(5);
        const keyRange2 = { lower: 'P', upper: 'R' };
        await expect(idb.count('MyStore', keyRange2)).resolves.toEqual(0);
    });
    test('hasAny', async () => {
        await expect(idb.hasAny('MyStore')).resolves.toBe(true); // 全範囲
        const keyRange1 = { lower: 'E', upper: 'O', lowerOpen: true };
        await expect(idb.hasAny('MyStore', keyRange1)).resolves.toBe(true);
        const keyRange2 = { lower: 'P', upper: 'R' };
        await expect(idb.hasAny('MyStore', keyRange2)).resolves.toBe(false);
    });

    test('getManyで不正なキーを渡すと取得できない', async () => {
        const keys1 = ['A', null];
        await expect(idb.getMany('MyStore', keys1 as IDBValidKey[])).rejects.toThrow(DOMException);
    });

    test('iterator(範囲指定なし)', async () => {
        // for await ... of による取得
        const iter1 = idb.iterator<string>('MyStore');
        const result1: string[] = [];
        for await (const value of iter1) {
            result1.push(value);
        }
        expect(result1).toEqual(values);

        // 列挙後に追加で next() を呼び出しても正常に返す
        await expect(iter1.next()).resolves.toEqual({ value: undefined, done: true });

        // イテレータの next() を await なしで呼び出して取得
        const iter2 = idb.iterator<string>('MyStore');
        const promises = [];
        for (let i = 0; i < values.length; i += 1) {
            // eslint-disable-next-line @typescript-eslint/no-loop-func
            promises.push(iter2.next().then((response) => {
                expect(response).toEqual({ value: values[i], done: false });
            }));
        }
        promises.push(iter2.next().then((response) => {
            expect(response).toEqual({ value: undefined, done: true });
        }));
        await expect(Promise.all(promises)).resolves.toBeDefined();
    });
    test('iterator(範囲指定あり)', async () => {
        const iter1 = idb.iterator<string>('MyStore', { lower: 'E', upper: 'O', lowerOpen: true });
        const result1: string[] = [];
        for await (const value of iter1) {
            result1.push(value);
        }
        expect(result1).toEqual(['Grape', 'Juice', 'Lemon', 'Noodle', 'Orange']);

        const iter2 = idb.iterator<string>('MyStore', { lower: 'P', upper: 'R' });
        const result2: string[] = [];
        for await (const value of iter2) {
            result2.push(value);
        }
        expect(result2).toEqual([]);
    });
    test('reverseIterator', async () => {
        const iter1 = idb.reverseIterator<string>('MyStore');
        const result1: string[] = [];
        for await (const value of iter1) {
            result1.push(value);
        }
        expect(result1).toEqual(Array.from(values).reverse());

        // 列挙後に追加で next() を呼び出しても正常に返す
        await expect(iter1.next()).resolves.toEqual({ value: undefined, done: true });

        const iter2 = idb.reverseIterator<string>('MyStore', { lower: 'E', upper: 'O', lowerOpen: true });
        const result2: string[] = [];
        for await (const value of iter2) {
            result2.push(value);
        }
        expect(result2).toEqual(['Orange', 'Noodle', 'Lemon', 'Juice', 'Grape']);

        const iter3 = idb.reverseIterator<string>('MyStore', { lower: 'P', upper: 'R' });
        const result3: string[] = [];
        for await (const value of iter3) {
            result3.push(value);
        }
        expect(result3).toEqual([]);
    });
    test('keyIterator', async () => {
        const iter1 = idb.keyIterator('MyStore');
        const result1: IDBValidKey[] = [];
        for await (const key of iter1) {
            result1.push(key);
        }
        expect(result1).toEqual(keys);

        // 列挙後に追加で next() を呼び出しても正常に返す
        await expect(iter1.next()).resolves.toEqual({ value: undefined, done: true });

        const iter2 = idb.keyIterator('MyStore', { lower: 'E', upper: 'O', lowerOpen: true });
        const result2: IDBValidKey[] = [];
        for await (const key of iter2) {
            result2.push(key);
        }
        expect(result2).toEqual(['G', 'J', 'L', 'N', 'O']);

        const iter3 = idb.keyIterator('MyStore', { lower: 'P', upper: 'R' });
        const result3: IDBValidKey[] = [];
        for await (const key of iter3) {
            result3.push(key);
        }
        expect(result3).toEqual([]);
    });
    test('reverseKeyIterator', async () => {
        const iter1 = idb.reverseKeyIterator('MyStore');
        const result1: IDBValidKey[] = [];
        for await (const key of iter1) {
            result1.push(key);
        }
        expect(result1).toEqual(Array.from(keys).reverse());

        // 列挙後に追加で next() を呼び出しても正常に返す
        await expect(iter1.next()).resolves.toEqual({ value: undefined, done: true });

        const iter2 = idb.reverseKeyIterator('MyStore', { lower: 'E', upper: 'O', lowerOpen: true });
        const result2: IDBValidKey[] = [];
        for await (const key of iter2) {
            result2.push(key);
        }
        expect(result2).toEqual(['O', 'N', 'L', 'J', 'G']);

        const iter3 = idb.reverseKeyIterator('MyStore', { lower: 'P', upper: 'R' });
        const result3: IDBValidKey[] = [];
        for await (const key of iter3) {
            result3.push(key);
        }
        expect(result3).toEqual([]);
    });
});

describe('DBの開閉テスト(インデックスあり)', () => {
    beforeAll(() => {
        window.indexedDB = new IDBFactory(); // refresh the mocked IndexedDB
    });

    type Person = {
        name: string,
        age: number,
        address: string,
    };
    type Item = {
        item: string,
        id: number,
        weight: number,
        value: number,
        color: string,
    };

    const oldStoreInfos: IDBMStoreInfo[] = [
        {
            name: 'MyStore1',
            keyPath: 'name',
            indexInfos: [
                { indexName: 'ageIdx', keyPath: 'age' },
                { indexName: 'addressIdx', keyPath: 'address' },
            ],
        },
        {
            name: 'MyStore2',
            keyPath: 'item',
            indexInfos: [
                { indexName: 'idIdx', keyPath: 'id', unique: true },
                { indexName: 'weightIdx', keyPath: 'weight' },
                { indexName: 'valueIdx', keyPath: 'value' },
            ],
        },
    ];
    const newStoreInfos: IDBMStoreInfo[] = [
        {
            name: 'MyStore1',
            keyPath: 'name',
            indexInfos: [
                { indexName: 'ageIdx', keyPath: 'age' },
            ],
            resetOnUpgrade: 'all',
        },
        {
            name: 'MyStore2',
            keyPath: 'item',
            indexInfos: [
                { indexName: 'idIdx', keyPath: 'id' },
                { indexName: 'weightIdx', keyPath: 'weight' },
                { indexName: 'colorIdx', keyPath: 'color' },
            ],
            resetOnUpgrade: 'index',
        },
    ];

    const dbName = createDBName();

    test('インデックス付きオブジェクトストアを作成してDBを開く', async () => {
        const pidb = new PublicIDBManager(dbName, 1, oldStoreInfos);
        await expect(pidb.openDatabase()).resolves.toBeUndefined();

        await expect(pidb.put<Person>('MyStore1', {
            name: 'Alice', age: 20, address: 'US',
        })).resolves.toBe('Alice');

        // インデックスが作成されていることをテスト
        const tx = pidb.p_db.transaction(['MyStore1', 'MyStore2'], 'readonly');
        const indexNames1 = Array.from(tx.objectStore('MyStore1').indexNames).sort();
        expect(indexNames1).toEqual(['addressIdx', 'ageIdx']);
        const indexNames2 = Array.from(tx.objectStore('MyStore2').indexNames).sort();
        expect(indexNames2).toEqual(['idIdx', 'valueIdx', 'weightIdx']);

        pidb.closeDatabase();
    });
    test('uniqueオプションのテスト', async () => {
        const idb = new IDBManager(dbName, 1, oldStoreInfos);
        await expect(idb.openDatabase()).resolves.toBeUndefined();

        await expect(idb.putMany<Item>('MyStore2', [
            {
                item: 'Apple', id: 1, weight: 20, value: 100, color: 'red',
            },
            {
                item: 'Banana', id: 2, weight: 15, value: 150, color: 'yellow',
            },
        ])).resolves.toEqual(['Apple', 'Banana']);

        // 重複するidを指定すると失敗
        await expect(idb.put<Item>('MyStore2', {
            item: 'Cherry', id: 2, weight: 5, value: 50, color: 'red',
        })).rejects.toThrow(DOMException);

        idb.closeDatabase();
    });
    test('オブジェクトストア内のインデックスの構成を更新する(アップグレード)', async () => {
        const pidb = new PublicIDBManager(dbName, 2, newStoreInfos);
        await expect(pidb.openDatabase()).resolves.toBeUndefined();

        // インデックスが変更されていることをテスト
        const tx = pidb.p_db.transaction(['MyStore1', 'MyStore2'], 'readonly');
        const indexNames1 = Array.from(tx.objectStore('MyStore1').indexNames).sort();
        expect(indexNames1).toEqual(['ageIdx']);
        const indexNames2 = Array.from(tx.objectStore('MyStore2').indexNames).sort();
        expect(indexNames2).toEqual(['colorIdx', 'idIdx', 'weightIdx']);

        // resetOnUpgrade: 'all' のとき、データもリセット
        await expect(pidb.has('MyStore1', 'Alice')).resolves.toBe(false);
        // resetOnUpgrade: 'index' のとき、データは残る
        await expect(pidb.has('MyStore2', 'Apple')).resolves.toBe(true);

        pidb.closeDatabase();
    });
});

describe('単体データのインデックスによる取得テスト', () => {
    beforeAll(() => {
        window.indexedDB = new IDBFactory(); // refresh the mocked IndexedDB
    });

    type Item = {
        item: string,
        id: number,
        value: number,
        color: string,
    };

    const dbName = createDBName();
    const storeInfos: IDBMStoreInfo[] = [
        {
            name: 'MyStore1',
            keyPath: 'item',
            indexInfos: [
                { indexName: 'idIdx', keyPath: 'id', unique: true },
                { indexName: 'valueIdx', keyPath: 'value' },
                { indexName: 'colorIdx', keyPath: 'color' },
            ],
        },
    ];
    const items: Item[] = [
        {
            item: 'Apple', id: 1, value: 100, color: 'red',
        },
        {
            item: 'Banana', id: 2, value: 80, color: 'yellow',
        },
        {
            item: 'Chocolate', id: 3, value: 120, color: 'brown',
        },
        {
            item: 'Donut', id: 4, value: 90, color: 'pink',
        },
        {
            item: 'Egg', id: 5, value: 70, color: 'white',
        },
    ];

    const idb = new IDBManager(dbName, 1, storeInfos);

    beforeAll(async () => {
        await idb.openDatabase();
        await idb.addMany<Item>('MyStore1', items);
        idb.closeDatabase();
    });

    beforeEach(async () => {
        await idb.openDatabase();
    });
    afterEach(() => {
        idb.closeDatabase();
    });

    test('getByIndex', async () => {
        await expect(
            idb.getByIndex<Item>('MyStore1', 'idIdx', 3),
        ).resolves.toEqual(items[2]);
        await expect(
            idb.getByIndex<Item>('MyStore1', 'valueIdx', 90),
        ).resolves.toEqual(items[3]);
        await expect(
            idb.getByIndex<Item>('MyStore1', 'colorIdx', 'red'),
        ).resolves.toEqual(items[0]);

        await expect(
            idb.getByIndex<Item>('MyStore1', 'idIdx', 0),
        ).resolves.toBeUndefined();
    });
    test('getFirstByIndex', async () => {
        await expect(
            idb.getFirstByIndex<Item>('MyStore1', 'idIdx', { lower: 2 }),
        ).resolves.toEqual(items[1]);
        await expect(
            idb.getFirstByIndex<Item>('MyStore1', 'valueIdx', { upper: 100 }),
        ).resolves.toEqual(items[4]);
        await expect(
            idb.getFirstByIndex<Item>('MyStore1', 'colorIdx', { lower: 'pink', upper: 'white', lowerOpen: true }),
        ).resolves.toEqual(items[0]);

        await expect(
            idb.getFirstByIndex<Item>('MyStore1', 'idIdx', { lower: 6 }),
        ).resolves.toBeUndefined();
    });
    test('getLastByIndex', async () => {
        await expect(
            idb.getLastByIndex<Item>('MyStore1', 'idIdx', { lower: 2 }),
        ).resolves.toEqual(items[4]);
        await expect(
            idb.getLastByIndex<Item>('MyStore1', 'valueIdx', { upper: 100 }),
        ).resolves.toEqual(items[0]);
        await expect(
            idb.getLastByIndex<Item>('MyStore1', 'colorIdx', { lower: 'black', upper: 'red', upperOpen: true }),
        ).resolves.toEqual(items[3]);

        await expect(
            idb.getLastByIndex<Item>('MyStore1', 'idIdx', { lower: 6 }),
        ).resolves.toBeUndefined();
    });
    test('getKeyByIndex', async () => {
        await expect(
            idb.getKeyByIndex('MyStore1', 'idIdx', 3),
        ).resolves.toEqual('Chocolate');
        await expect(
            idb.getKeyByIndex('MyStore1', 'valueIdx', 90),
        ).resolves.toEqual('Donut');
        await expect(
            idb.getKeyByIndex('MyStore1', 'colorIdx', 'red'),
        ).resolves.toEqual('Apple');

        await expect(
            idb.getKeyByIndex('MyStore1', 'idIdx', 0),
        ).resolves.toBeUndefined();
    });
    test('getFirstKeyByIndex', async () => {
        await expect(
            idb.getFirstKeyByIndex('MyStore1', 'idIdx', { lower: 2 }),
        ).resolves.toEqual('Banana');
        await expect(
            idb.getFirstKeyByIndex('MyStore1', 'valueIdx', { upper: 100 }),
        ).resolves.toEqual('Egg');
        await expect(
            idb.getFirstKeyByIndex('MyStore1', 'colorIdx', { lower: 'pink', upper: 'white', lowerOpen: true }),
        ).resolves.toEqual('Apple');

        await expect(
            idb.getFirstKeyByIndex('MyStore1', 'idIdx', { lower: 6 }),
        ).resolves.toBeUndefined();
    });
    test('getLastKeyByIndex', async () => {
        await expect(
            idb.getLastKeyByIndex('MyStore1', 'idIdx', { lower: 2 }),
        ).resolves.toEqual('Egg');
        await expect(
            idb.getLastKeyByIndex('MyStore1', 'valueIdx', { upper: 100 }),
        ).resolves.toEqual('Apple');
        await expect(
            idb.getLastKeyByIndex('MyStore1', 'colorIdx', { lower: 'black', upper: 'red', upperOpen: true }),
        ).resolves.toEqual('Donut');

        await expect(
            idb.getLastKeyByIndex('MyStore1', 'idIdx', { lower: 6 }),
        ).resolves.toBeUndefined();
    });
    test('hasByIndex', async () => {
        await expect(
            idb.hasByIndex('MyStore1', 'idIdx', 3),
        ).resolves.toBe(true);
        await expect(
            idb.hasByIndex('MyStore1', 'valueIdx', 110),
        ).resolves.toBe(false);
        await expect(
            idb.hasByIndex('MyStore1', 'colorIdx', 'yellow'),
        ).resolves.toBe(true);
    });
});

describe('複数データのインデックスによる取得テスト(multiEntryオプションのテストを含む)', () => {
    beforeAll(() => {
        window.indexedDB = new IDBFactory(); // refresh the mocked IndexedDB
    });

    type Item = {
        item: string,
        id: number,
        value: number,
        tags: string[],
    };

    const dbName = createDBName();
    const storeInfos: IDBMStoreInfo[] = [
        {
            name: 'MyStore1',
            keyPath: 'item',
            indexInfos: [
                { indexName: 'idIdx', keyPath: 'id', unique: true },
                { indexName: 'valueIdx', keyPath: 'value' },
                { indexName: 'tagsIdx', keyPath: 'tags', multiEntry: true },
            ],
        },
    ];
    const items: Item[] = [
        {
            item: 'Apple', id: 1, value: 100, tags: ['fruit'],
        },
        {
            item: 'Banana', id: 2, value: 80, tags: ['fruit', 'on sale', 'new'],
        },
        {
            item: 'Chocolate', id: 3, value: 120, tags: ['snack'],
        },
        {
            item: 'Donut', id: 4, value: 90, tags: ['snack', 'on sale'],
        },
        {
            item: 'Egg', id: 5, value: 70, tags: ['food', 'new'],
        },
    ];
    const itemsSortedByValue = [
        items[4], items[1], items[3], items[0], items[2],
    ];

    const idb = new IDBManager(dbName, 1, storeInfos);

    beforeAll(async () => {
        await idb.openDatabase();
        await idb.addMany<Item>('MyStore1', items);
        idb.closeDatabase();
    });

    beforeEach(async () => {
        await idb.openDatabase();
    });
    afterEach(() => {
        idb.closeDatabase();
    });

    test('getManyByIndex', async () => {
        // keys: IDBValidKey[]
        await expect(
            idb.getManyByIndex<Item>('MyStore1', 'idIdx', [2, 4, 6]),
        ).resolves.toEqual([items[1], items[3], undefined]);

        // keyRange?: IDBMKeyRange
        await expect(
            idb.getManyByIndex<Item>('MyStore1', 'idIdx', { lower: 3 }),
        ).resolves.toEqual([items[2], items[3], items[4]]);
        await expect(
            idb.getManyByIndex<Item>('MyStore1', 'valueIdx', { upper: 90 }),
        ).resolves.toEqual([items[4], items[1], items[3]]);

        // multiEntryオプションをオンにすると、配列の要素をキーとして検索できる
        await expect(
            idb.getManyByIndex<Item>('MyStore1', 'tagsIdx', { lower: 'on sale', upper: 'on sale' }),
        ).resolves.toEqual([items[1], items[3]]);
        await expect(
            // tags に food, fruit, new のいずれかを含むデータを取得する
            // 条件を満たす要素が複数ある場合は重複して返される
            idb.getManyByIndex<Item>('MyStore1', 'tagsIdx', { lower: 'food', upper: 'new' }),
        ).resolves.toEqual([items[4], items[0], items[1], items[1], items[4]]);
    });
    test('getManyKeysByIndex', async () => {
        await expect(
            idb.getManyKeysByIndex('MyStore1', 'idIdx', { lower: 3 }),
        ).resolves.toEqual(['Chocolate', 'Donut', 'Egg']);
        await expect(
            idb.getManyKeysByIndex('MyStore1', 'valueIdx', { upper: 90 }),
        ).resolves.toEqual(['Egg', 'Banana', 'Donut']);
        await expect(
            idb.getManyKeysByIndex('MyStore1', 'tagsIdx', { lower: 'food', upper: 'new' }),
        ).resolves.toEqual(['Egg', 'Apple', 'Banana', 'Banana', 'Egg']);
    });
    test('countByIndex', async () => {
        await expect(idb.countByIndex('MyStore1', 'idIdx')).resolves.toEqual(5); // 全範囲
        await expect(idb.countByIndex('MyStore1', 'tagsIdx')).resolves.toEqual(9); // 全範囲

        await expect(
            idb.countByIndex('MyStore1', 'idIdx', { lower: 3 }),
        ).resolves.toEqual(3);
        await expect(
            idb.countByIndex('MyStore1', 'valueIdx', { upper: 100 }),
        ).resolves.toEqual(4);
        await expect(
            idb.countByIndex('MyStore1', 'tagsIdx', { lower: 'food', upper: 'new' }),
        ).resolves.toEqual(5);
    });
    test('hasAnyByIndex', async () => {
        await expect(
            idb.hasAnyByIndex('MyStore1', 'idIdx', { lower: 3 }),
        ).resolves.toBe(true);
        await expect(
            idb.hasAnyByIndex('MyStore1', 'valueIdx', { upper: 60 }),
        ).resolves.toBe(false);
        await expect(
            idb.hasAnyByIndex('MyStore1', 'tagsIdx', { lower: 'popular', upper: 'popular' }),
        ).resolves.toBe(false);
    });

    test('getManyByIndexで不正なキーを渡すと取得できない', async () => {
        const keys1 = [3, null];
        await expect(
            idb.getManyByIndex<Item>('MyStore1', 'idIdx', keys1 as IDBValidKey[]),
        ).rejects.toThrow(DOMException);
    });

    test('iteratorByIndex(範囲指定なし)', async () => {
        // for await ... of による取得
        const iter1 = idb.iteratorByIndex<string>('MyStore1', 'idIdx');
        const result1: string[] = [];
        for await (const value of iter1) {
            result1.push(value);
        }
        expect(result1).toEqual(items);

        // 列挙後に追加で next() を呼び出しても正常に返す
        await expect(iter1.next()).resolves.toEqual({ value: undefined, done: true });

        // イテレータの next() を await なしで呼び出して取得
        const iter2 = idb.iteratorByIndex<string>('MyStore1', 'valueIdx');
        const promises = [];
        for (let i = 0; i < itemsSortedByValue.length; i += 1) {
            // eslint-disable-next-line @typescript-eslint/no-loop-func
            promises.push(iter2.next().then((response) => {
                expect(response).toEqual({ value: itemsSortedByValue[i], done: false });
            }));
        }
        promises.push(iter2.next().then((response) => {
            expect(response).toEqual({ value: undefined, done: true });
        }));
        await expect(Promise.all(promises)).resolves.toBeDefined();
    });
    test('iteratorByIndex(範囲指定あり)', async () => {
        const iter1 = idb.iteratorByIndex<string>('MyStore1', 'valueIdx', { lower: 80, upper: 110 });
        const result1: string[] = [];
        for await (const value of iter1) {
            result1.push(value);
        }
        expect(result1).toEqual([items[1], items[3], items[0]]);

        const iter2 = idb.iteratorByIndex<string>('MyStore1', 'idIdx', { lower: 6 });
        const result2: string[] = [];
        for await (const value of iter2) {
            result2.push(value);
        }
        expect(result2).toEqual([]);
    });
    test('reverseIteratorByIndex', async () => {
        const iter1 = idb.reverseIteratorByIndex<string>('MyStore1', 'idIdx');
        const result1: string[] = [];
        for await (const value of iter1) {
            result1.push(value);
        }
        expect(result1).toEqual(Array.from(items).reverse());

        // 列挙後に追加で next() を呼び出しても正常に返す
        await expect(iter1.next()).resolves.toEqual({ value: undefined, done: true });

        const iter2 = idb.reverseIteratorByIndex<string>('MyStore1', 'valueIdx', { lower: 80, upper: 110 });
        const result2: string[] = [];
        for await (const value of iter2) {
            result2.push(value);
        }
        expect(result2).toEqual([items[0], items[3], items[1]]);

        const iter3 = idb.reverseIteratorByIndex<string>('MyStore1', 'idIdx', { lower: 6 });
        const result3: string[] = [];
        for await (const value of iter3) {
            result3.push(value);
        }
        expect(result3).toEqual([]);
    });
    test('keyIteratorByIndex', async () => {
        const iter1 = idb.keyIteratorByIndex('MyStore1', 'idIdx');
        const result1: IDBValidKey[] = [];
        for await (const key of iter1) {
            result1.push(key);
        }
        expect(result1).toEqual(['Apple', 'Banana', 'Chocolate', 'Donut', 'Egg']);

        // 列挙後に追加で next() を呼び出しても正常に返す
        await expect(iter1.next()).resolves.toEqual({ value: undefined, done: true });

        const iter2 = idb.keyIteratorByIndex('MyStore1', 'valueIdx', { lower: 80, upper: 110 });
        const result2: IDBValidKey[] = [];
        for await (const key of iter2) {
            result2.push(key);
        }
        expect(result2).toEqual(['Banana', 'Donut', 'Apple']);

        const iter3 = idb.keyIteratorByIndex('MyStore1', 'idIdx', { lower: 6 });
        const result3: IDBValidKey[] = [];
        for await (const key of iter3) {
            result3.push(key);
        }
        expect(result3).toEqual([]);
    });
    test('reverseKeyIteratorByIndex', async () => {
        const iter1 = idb.reverseKeyIteratorByIndex('MyStore1', 'idIdx');
        const result1: IDBValidKey[] = [];
        for await (const key of iter1) {
            result1.push(key);
        }
        expect(result1).toEqual(['Egg', 'Donut', 'Chocolate', 'Banana', 'Apple']);

        // 列挙後に追加で next() を呼び出しても正常に返す
        await expect(iter1.next()).resolves.toEqual({ value: undefined, done: true });

        const iter2 = idb.reverseKeyIteratorByIndex('MyStore1', 'valueIdx', { lower: 80, upper: 110 });
        const result2: IDBValidKey[] = [];
        for await (const key of iter2) {
            result2.push(key);
        }
        expect(result2).toEqual(['Apple', 'Donut', 'Banana']);

        const iter3 = idb.reverseKeyIteratorByIndex('MyStore1', 'idIdx', { lower: 6 });
        const result3: IDBValidKey[] = [];
        for await (const key of iter3) {
            result3.push(key);
        }
        expect(result3).toEqual([]);
    });
});

describe('複数データのインデックスによる削除テスト(deleteManyByIndex)', () => {
    beforeAll(() => {
        window.indexedDB = new IDBFactory(); // refresh the mocked IndexedDB
    });

    type Item = {
        item: string,
        id: number,
        value: number,
        tags: string[],
    };

    const dbName = createDBName();
    const storeInfos: IDBMStoreInfo[] = [
        {
            name: 'MyStore1',
            keyPath: 'item',
            indexInfos: [
                { indexName: 'idIdx', keyPath: 'id', unique: true },
                { indexName: 'valueIdx', keyPath: 'value' },
                { indexName: 'tagsIdx', keyPath: 'tags', multiEntry: true },
            ],
        },
    ];
    const items: Item[] = [
        {
            item: 'Apple', id: 1, value: 100, tags: ['fruit'],
        },
        {
            item: 'Banana', id: 2, value: 80, tags: ['fruit', 'on sale', 'new'],
        },
        {
            item: 'Chocolate', id: 3, value: 120, tags: ['snack'],
        },
        {
            item: 'Donut', id: 4, value: 90, tags: ['snack', 'on sale'],
        },
        {
            item: 'Egg', id: 5, value: 70, tags: ['food', 'new'],
        },
    ];

    const idb = new IDBManager(dbName, 1, storeInfos);

    beforeEach(async () => {
        await idb.openDatabase();
        await idb.addMany<Item>('MyStore1', items);
    });
    afterEach(async () => {
        await idb.clear('MyStore1');
        idb.closeDatabase();
    });

    test('idのキー範囲で削除する', async () => {
        await expect(
            idb.deleteManyByIndex('MyStore1', 'idIdx', { lower: 2, upper: 4 }),
        ).resolves.toBeUndefined();
        await expect(idb.getManyKeys('MyStore1')).resolves.toEqual(['Apple', 'Egg']);
    });
    test('valueのキー範囲で削除する', async () => {
        await expect(
            idb.deleteManyByIndex('MyStore1', 'valueIdx', { lower: 100 }),
        ).resolves.toBeUndefined();
        await expect(idb.getManyKeys('MyStore1')).resolves.toEqual(['Banana', 'Donut', 'Egg']);
    });
    test('tagsのキー範囲で削除する', async () => {
        await expect(
            idb.deleteManyByIndex('MyStore1', 'tagsIdx', { lower: 'food', upper: 'on sale' }),
        ).resolves.toBeUndefined();
        await expect(idb.getManyKeys('MyStore1')).resolves.toEqual(['Chocolate']);
    });

    test('0個のキーを指定して削除する(何も削除されない)', async () => {
        await expect(
            idb.deleteManyByIndex('MyStore1', 'idIdx', []),
        ).resolves.toBeUndefined();
        await expect(idb.getManyKeys('MyStore1')).resolves.toEqual(['Apple', 'Banana', 'Chocolate', 'Donut', 'Egg']);
    });

    test('idを1個指定して削除する', async () => {
        await expect(
            idb.deleteManyByIndex('MyStore1', 'idIdx', [2]),
        ).resolves.toBeUndefined();
        await expect(idb.getManyKeys('MyStore1')).resolves.toEqual(['Apple', 'Chocolate', 'Donut', 'Egg']);
    });
    test('tagsを1個指定して削除する(multiEntryオプションあり)', async () => {
        await expect(
            idb.deleteManyByIndex('MyStore1', 'tagsIdx', ['on sale']),
        ).resolves.toBeUndefined();
        await expect(idb.getManyKeys('MyStore1')).resolves.toEqual(['Apple', 'Chocolate', 'Egg']);
    });

    test('idの配列で削除する', async () => {
        await expect(
            idb.deleteManyByIndex('MyStore1', 'idIdx', [1, 3, 5]),
        ).resolves.toBeUndefined();
        await expect(idb.getManyKeys('MyStore1')).resolves.toEqual(['Banana', 'Donut']);
    });
    test('tagsの配列で削除する(multiEntryオプションあり)', async () => {
        await expect(
            idb.deleteManyByIndex('MyStore1', 'tagsIdx', ['fruit', 'snack', 'wow']),
        ).resolves.toBeUndefined();
        await expect(idb.getManyKeys('MyStore1')).resolves.toEqual(['Egg']);
    });

    test('不正なキーを渡すと削除できない', async () => {
        await expect(
            idb.deleteManyByIndex('MyStore1', 'idIdx', [2, { wow: null }] as IDBValidKey[]),
        ).rejects.toThrow(DOMException);
        await expect(idb.getManyKeys('MyStore1')).resolves.toEqual(['Apple', 'Banana', 'Chocolate', 'Donut', 'Egg']); // ロールバック
    });
});

describe('トランザクションのテスト', () => {
    beforeAll(() => {
        window.indexedDB = new IDBFactory(); // refresh the mocked IndexedDB
    });

    const dbName = createDBName();
    const storeInfos: IDBMStoreInfo[] = [
        { name: 'MyStore1' },
        { name: 'MyStore2', keyPath: 'key' },
        { name: 'MyStore3', autoIncrement: true },
    ];
    const pidb = new PublicIDBManager(dbName, 1, storeInfos);

    beforeEach(async () => {
        await pidb.openDatabase();
    });
    afterEach(() => {
        pidb.closeDatabase();
    });

    test('トランザクションを作成する', async () => {
        const tx = pidb.transaction('MyStore1', async () => {});
        await expect(tx).resolves.toBeUndefined();
    });
    test('トランザクション内で複数の操作を行う', async () => {
        const tx = pidb.transaction('MyStore1', async (inner) => {
            const result = await inner.add('MyStore1', 'Apple', 'A');
            await inner.add('MyStore1', 'Banana', 'B');
            return result;
        }, 'readwrite');
        await expect(tx).resolves.toBe('A');

        // トランザクション内で追加したデータが取得できることをテスト
        await expect(pidb.get('MyStore1', 'A')).resolves.toBe('Apple');
        await expect(pidb.get('MyStore1', 'B')).resolves.toBe('Banana');
    });

    test('コールバック関数内で例外を投げる', async () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        const tx1 = pidb.transaction('MyStore1', async (inner) => {
            // eslint-disable-next-line @typescript-eslint/no-throw-literal
            throw 'Oops';
        });
        // Errorオブジェクト以外を投げるとDOMExceptionになる
        await expect(tx1).rejects.toThrow(DOMException);
        await expect(tx1).rejects.toThrow('The transaction failed for some reason.');

        // eslint-disable-next-line @typescript-eslint/require-await
        const tx2 = pidb.transaction('MyStore1', async () => {
            throw new Error('Oops');
        });
        await expect(tx2).rejects.toThrow('Oops');
    });
    test('データベースが閉じているときにトランザクションを作成すると失敗する', async () => {
        pidb.closeDatabase();
        const tx = pidb.transaction('MyStore1', async () => {});
        await expect(tx).rejects.toThrow(ReferenceError);
    });
    test('存在しないオブジェクトストアを指定すると失敗する', async () => {
        const tx = pidb.transaction('MyStoreX', async () => {});
        await expect(tx).rejects.toThrow(DOMException);
    });
    test('トランザクションのモードを間違えると失敗する', async () => {
        const tx = pidb.transaction('MyStore1', (inner) => {
            return inner.add('MyStore1', 'Cherry', 'C');
        }, 'readonly');
        await expect(tx).rejects.toThrow(DOMException);
        await expect(tx).rejects.toThrow('The mutating operation was attempted in a "readonly" transaction.');
    });
    test('トランザクション内の操作でエラーが発生するとロールバックする', async () => {
        const tx = pidb.transaction('MyStore1', async (inner) => {
            await inner.add('MyStore1', 'Cherry', 'C');
            await inner.add('MyStore1', 'Blueberry', 'B');
        }, 'readwrite');
        await expect(tx).rejects.toThrow(DOMException);

        // トランザクション実行前の状態に戻っていることをテスト
        await expect(pidb.get('MyStore1', 'C')).resolves.toBeUndefined();
        await expect(pidb.get('MyStore1', 'B')).resolves.toBe('Banana');
    });
});
