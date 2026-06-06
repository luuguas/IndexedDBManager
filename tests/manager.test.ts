import 'fake-indexeddb/auto';
import { IDBManager, IDBMStoreInfo, IDBMKeyRange } from '../src/manager';
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
        const exp = expect(idb2.openDatabase());
        await exp.rejects.toThrow(ReferenceError);
        await exp.rejects.toThrow('The database cannot be upgraded because it is currently open on another instance.');

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
        const exp = expect(wrongIDB.openDatabase());
        await exp.rejects.toThrow(TypeError);
        await exp.rejects.toThrow('The storeInfos does not match the object stores in the database. The database version needs upgrading.');

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

        await expect(idb.addItem('', {})).rejects.toThrow(ReferenceError);
        await expect(idb.addItems('', [])).rejects.toThrow(ReferenceError);
        await expect(idb.setItem('', {})).rejects.toThrow(ReferenceError);
        await expect(idb.setItems('', [])).rejects.toThrow(ReferenceError);
        await expect(idb.removeItem('', '')).rejects.toThrow(ReferenceError);
        await expect(idb.removeItems('', [])).rejects.toThrow(ReferenceError);
        await expect(idb.clearItems('')).rejects.toThrow(ReferenceError);

        await expect(idb.getItem('', '')).rejects.toThrow(ReferenceError);
        await expect(idb.getFirstItem('')).rejects.toThrow(ReferenceError);
        await expect(idb.getLastItem('')).rejects.toThrow(ReferenceError);
        await expect(idb.getFirstKey('')).rejects.toThrow(ReferenceError);
        await expect(idb.getLastKey('')).rejects.toThrow(ReferenceError);
        await expect(idb.hasItem('', '')).rejects.toThrow(ReferenceError);
        await expect(idb.getItems('')).rejects.toThrow(ReferenceError);
        await expect(idb.getKeys('')).rejects.toThrow(ReferenceError);
        await expect(idb.countItems('')).rejects.toThrow(ReferenceError);
        await expect(idb.hasAnyItems('')).rejects.toThrow(ReferenceError);
        expect(() => { idb.getIterator(''); }).toThrow(ReferenceError);
        expect(() => { idb.getReversedIterator(''); }).toThrow(ReferenceError);
        expect(() => { idb.getKeyIterator(''); }).toThrow(ReferenceError);
        expect(() => { idb.getReversedKeyIterator(''); }).toThrow(ReferenceError);
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

    test('1個のデータを追加する(addItem, setItem)', async () => {
        // keyPath: なし, autoIncrement: false
        // itemは任意の値
        await expect(idb.addItem('MyStore1', 'Apple', 'A')).resolves.toBe('A');
        await expect(idb.getItem('MyStore1', 'A')).resolves.toBe('Apple');

        // keyPath: あり, autoIncrement: false
        // itemはオブジェクトのみ
        await expect(idb.addItem('MyStore2', { key: 'B', value: 'Banana' })).resolves.toBe('B');
        await expect(idb.getItem('MyStore2', 'B')).resolves.toEqual({ key: 'B', value: 'Banana' });

        // keyPath: なし, autoIncrement: true
        // itemは任意の値
        await expect(idb.setItem('MyStore3', 'Cherry', undefined)).resolves.toBe(1); // 外部キー指定なし、連番が割り当てられる
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
    test('1個のデータを更新する', async () => {
        await expect(idb.getItem('MyStore1', 'A')).resolves.toBe('Apple'); // 更新前
        await expect(idb.setItem('MyStore1', 'Alice', 'A')).resolves.toBe('A');
        await expect(idb.getItem('MyStore1', 'A')).resolves.toBe('Alice'); // 更新後
    });
    test('1個のデータを削除する', async () => {
        await expect(idb.getItem('MyStore1', 'A')).resolves.toBeDefined(); // 削除前
        await expect(idb.removeItem('MyStore1', 'A')).resolves.toBeUndefined();
        await expect(idb.getItem('MyStore1', 'A')).resolves.toBeUndefined(); // 削除後
        await expect(idb.removeItem('MyStore1', 'A')).resolves.toBeUndefined(); // ストアに存在しないデータを指定しても成功(何もしない)
    });

    test('addItemに既存のキーを指定すると追加できない', async () => {
        // keyPath: なし, autoIncrement: false
        await expect(idb.setItem('MyStore1', 'Apple', 'A')).resolves.toBe('A');
        await expect(idb.addItem('MyStore1', 'Avocado', 'A')).rejects.toThrow(DOMException);

        // keyPath: あり, autoIncrement: false
        await expect(idb.addItem('MyStore2', { key: 'B', value: 'Blueberry' })).rejects.toThrow(DOMException);

        // keyPath: なし, autoIncrement: true
        await expect(idb.addItem('MyStore3', 'Chocolate', 1)).rejects.toThrow(DOMException);

        // keyPath: あり, autoIncrement: true
        await expect(idb.addItem('MyStore4', { key: 'F', value: 'French fries' })).rejects.toThrow(DOMException);
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

    test('複数のデータを追加する(addItems, setItems)', async () => {
        // keyPath: なし, autoIncrement: false
        // itemは任意の値
        const items1 = ['Apple', { name: 'Banana' }];
        const keys1 = ['A', 'B'];
        await expect(idb.addItems('MyStore1', items1, keys1)).resolves.toEqual(keys1);
        await expect(idb.getItem('MyStore1', 'A')).resolves.toBe('Apple');
        await expect(idb.getItem('MyStore1', 'B')).resolves.toEqual({ name: 'Banana' });

        // keyPath: あり, autoIncrement: false
        // itemはオブジェクトのみ
        const items2 = [{ key: 'C', value: 'Cherry' }, { key: 'D', value: 'Donut' }];
        await expect(idb.addItems('MyStore2', items2)).resolves.toEqual(['C', 'D']);
        await expect(idb.getItem('MyStore2', 'C')).resolves.toEqual({ key: 'C', value: 'Cherry' });
        await expect(idb.getItem('MyStore2', 'D')).resolves.toEqual({ key: 'D', value: 'Donut' });

        // keyPath: なし, autoIncrement: true
        // itemは任意の値
        const items3 = ['Egg', { name: 'Fish' }, ['Grape', 'Grapefruit']];
        const keys3 = [undefined, 'F', undefined];
        await expect(idb.setItems('MyStore3', items3, keys3)).resolves.toEqual([1, 'F', 2]);
        await expect(idb.getItem('MyStore3', 1)).resolves.toBe('Egg');
        await expect(idb.getItem('MyStore3', 'F')).resolves.toEqual({ name: 'Fish' });
        await expect(idb.getItem('MyStore3', 2)).resolves.toEqual(['Grape', 'Grapefruit']);

        // keyPath: あり, autoIncrement: true
        // itemはオブジェクトのみ
        const items4 = [{ key: 'H', value: 'Hamburger' }, { value: 'Icecream' }];
        await expect(idb.setItems('MyStore4', items4)).resolves.toEqual(['H', 1]);
        await expect(idb.getItem('MyStore4', 'H')).resolves.toEqual({ key: 'H', value: 'Hamburger' });
        await expect(idb.getItem('MyStore4', 1)).resolves.toEqual({ key: 1, value: 'Icecream' });
    });
    test('複数のデータを更新する', async () => {
        const items = [{ name: 'Alice' }, 'Bob', ['Chris', 'Charlie']]; // 最後は追加データ
        const keys = ['A', 'B', 'C'];

        // 更新前
        await expect(idb.getItem('MyStore1', 'A')).resolves.toBe('Apple');
        await expect(idb.getItem('MyStore1', 'B')).resolves.toEqual({ name: 'Banana' });
        await expect(idb.getItem('MyStore1', 'C')).resolves.toBeUndefined();

        await expect(idb.setItems('MyStore1', items, keys)).resolves.toEqual(keys);

        // 更新後
        await expect(idb.getItem('MyStore1', 'A')).resolves.toEqual({ name: 'Alice' });
        await expect(idb.getItem('MyStore1', 'B')).resolves.toBe('Bob');
        await expect(idb.getItem('MyStore1', 'C')).resolves.toEqual(['Chris', 'Charlie']);
    });
    test('複数のデータを削除する', async () => {
        const keys = ['B', 'C'];

        // 削除前
        await expect(idb.getItem('MyStore1', 'A')).resolves.toBeDefined();
        await expect(idb.getItem('MyStore1', 'B')).resolves.toBeDefined();
        await expect(idb.getItem('MyStore1', 'C')).resolves.toBeDefined();

        await expect(idb.removeItems('MyStore1', keys)).resolves.toBeUndefined();

        // 削除後
        await expect(idb.getItem('MyStore1', 'A')).resolves.toBeDefined();
        await expect(idb.getItem('MyStore1', 'B')).resolves.toBeUndefined();
        await expect(idb.getItem('MyStore1', 'C')).resolves.toBeUndefined();
    });
    test('全てのデータを削除する', async () => {
        // 削除前
        await expect(idb.getItem('MyStore2', 'C')).resolves.toBeDefined();
        await expect(idb.getItem('MyStore2', 'D')).resolves.toBeDefined();

        await expect(idb.clearItems('MyStore2')).resolves.toBeUndefined();

        // 削除後
        await expect(idb.getItem('MyStore2', 'C')).resolves.toBeUndefined();
        await expect(idb.getItem('MyStore2', 'D')).resolves.toBeUndefined();
    });

    test('addItemsに既存のキーを指定すると追加できない', async () => {
        const items1 = ['Apple', { name: 'Banana' }];
        const keys1 = ['A', 'B'];
        await expect(idb.setItems('MyStore1', items1, keys1)).resolves.toEqual(keys1);

        const items2 = ['Chocolate', { name: 'Blueberry' }];
        const keys2 = ['C', 'B'];
        await expect(idb.addItems('MyStore1', items2, keys2)).rejects.toThrow(DOMException);
        await expect(idb.getItem('MyStore1', 'C')).resolves.toBeUndefined(); // ロールバック
    });
    test('キー指定を間違えると追加できない', async () => {
        // keyPath: なし, autoIncrement: false
        const items1 = ['Juice', 'Kiwi'];
        const keys1 = ['J', undefined]; // keys[1]: 外部キー指定なし
        await expect(idb.addItems('MyStore1', items1, keys1)).rejects.toThrow(DOMException);
        await expect(idb.setItems('MyStore1', items1, keys1)).rejects.toThrow(DOMException);
        await expect(idb.getItem('MyStore1', 'J')).resolves.toBeUndefined(); // ロールバック

        // keyPath: あり, autoIncrement: false
        const items2 = [{ key: 'L', value: 'Lemon' }, { value: 'Melon' }];
        const keys2 = ['L', undefined]; // keys2[0]: 外部キー指定あり / keys2[1]: 内部キー指定なし
        await expect(idb.setItems('MyStore2', items2, keys2)).rejects.toThrow(DOMException);

        // keyPath: あり, autoIncrement: true
        const items4 = [{ key: 'N', value: 'Noodle' }, { key: 'O', value: 'Orange' }];
        const keys4 = [undefined, 'O']; // keys[1]: 外部キー指定あり
        await expect(idb.setItems('MyStore4', items4, keys4)).rejects.toThrow(DOMException);
        await expect(idb.getItem('MyStore1', 'N')).resolves.toBeUndefined(); // ロールバック
    });
    test('itemsとkeysの長さが違うと追加できない', async () => {
        const items = ['Pear', 'Quince'];
        const keys = ['P', 'Q', 'R'];
        await expect(idb.addItems('MyStore1', items, keys)).rejects.toThrow(TypeError);
        await expect(idb.setItems('MyStore1', items, keys)).rejects.toThrow(TypeError);
    });
    test('不正なキーを渡すと削除できない', async () => {
        const keys = ['A', null];
        await expect(idb.removeItems('MyStore1', keys as IDBValidKey[])).rejects.toThrow(DOMException);
        await expect(idb.getItem('MyStore1', 'A')).resolves.toBeDefined(); // ロールバック
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

    const items = ['Banana', 'Donut', 'Egg', 'Grape', 'Juice', 'Lemon', 'Noodle', 'Orange', 'Strawberry', 'Vegetable'];
    const keys = ['B', 'D', 'E', 'G', 'J', 'L', 'N', 'O', 'S', 'V'];

    beforeAll(async () => {
        await idb.openDatabase();
        await idb.setItems('MyStore', items, keys);
        idb.closeDatabase();
    });

    beforeEach(async () => {
        await idb.openDatabase();
    });
    afterEach(() => {
        idb.closeDatabase();
    });

    test('getItem', async () => {
        await expect(idb.getItem('MyStore', 'B')).resolves.toBe('Banana');
        await expect(idb.getItem('MyStore', 'G')).resolves.toBe('Grape');
        await expect(idb.getItem('MyStore', 'M')).resolves.toBeUndefined();
    });

    test('getFirstItem', async () => {
        // lower指定なし
        await expect(idb.getFirstItem('MyStore')).resolves.toBe('Banana');
        await expect(idb.getFirstItem('MyStore', {})).resolves.toBe('Banana');
        await expect(idb.getFirstItem('MyStore', { upper: 'M' })).resolves.toBe('Banana');
        await expect(idb.getFirstItem('MyStore', { upper: 'A' })).resolves.toBeUndefined();
        await expect(idb.getFirstItem('MyStore', { upper: 'B', upperOpen: true })).resolves.toBeUndefined();

        // lower指定あり
        await expect(idb.getFirstItem('MyStore', { lower: 'A' })).resolves.toBe('Banana');
        await expect(idb.getFirstItem('MyStore', { lower: 'B' })).resolves.toBe('Banana');
        await expect(idb.getFirstItem('MyStore', { lower: 'B', lowerOpen: true })).resolves.toBe('Donut');
        await expect(idb.getFirstItem('MyStore', { lower: 'V' })).resolves.toBe('Vegetable');
        await expect(idb.getFirstItem('MyStore', { lower: 'V', lowerOpen: true })).resolves.toBeUndefined();
        await expect(idb.getFirstItem('MyStore', { lower: 'P', upper: 'R' })).resolves.toBeUndefined();
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
    test('getLastItem', async () => {
        // upper指定なし
        await expect(idb.getLastItem('MyStore')).resolves.toBe('Vegetable');
        await expect(idb.getLastItem('MyStore', {})).resolves.toBe('Vegetable');
        await expect(idb.getLastItem('MyStore', { lower: 'H' })).resolves.toBe('Vegetable');
        await expect(idb.getLastItem('MyStore', { lower: 'W' })).resolves.toBeUndefined();
        await expect(idb.getLastItem('MyStore', { lower: 'V', lowerOpen: true })).resolves.toBeUndefined();

        // upper指定あり
        await expect(idb.getLastItem('MyStore', { upper: 'Z' })).resolves.toBe('Vegetable');
        await expect(idb.getLastItem('MyStore', { upper: 'V' })).resolves.toBe('Vegetable');
        await expect(idb.getLastItem('MyStore', { upper: 'V', upperOpen: true })).resolves.toBe('Strawberry');
        await expect(idb.getLastItem('MyStore', { upper: 'B' })).resolves.toBe('Banana');
        await expect(idb.getLastItem('MyStore', { upper: 'B', upperOpen: true })).resolves.toBeUndefined();
        await expect(idb.getLastItem('MyStore', { lower: 'P', upper: 'R' })).resolves.toBeUndefined();
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
    test('hasItem', async () => {
        await expect(idb.hasItem('MyStore', 'B')).resolves.toBe(true);
        await expect(idb.hasItem('MyStore', 'G')).resolves.toBe(true);
        await expect(idb.hasItem('MyStore', 'M')).resolves.toBe(false);
    });
});

describe('複数データの取得テスト', () => {
    beforeAll(() => {
        window.indexedDB = new IDBFactory(); // refresh the mocked IndexedDB
    });

    const dbName = createDBName();
    const storeInfos: IDBMStoreInfo[] = [{ name: 'MyStore' }];
    const idb = new IDBManager(dbName, 1, storeInfos);

    const items = ['Banana', 'Donut', 'Egg', 'Grape', 'Juice', 'Lemon', 'Noodle', 'Orange', 'Strawberry', 'Vegetable'];
    const keys = ['B', 'D', 'E', 'G', 'J', 'L', 'N', 'O', 'S', 'V'];

    beforeAll(async () => {
        await idb.openDatabase();
        await idb.setItems('MyStore', items, keys);
        idb.closeDatabase();
    });

    beforeEach(async () => {
        await idb.openDatabase();
    });
    afterEach(() => {
        idb.closeDatabase();
    });

    test('getItems', async () => {
        // keys: IDBValidKey[]
        const keys1 = ['L', 'E', 'M', 'O', 'N'];
        await expect(idb.getItems('MyStore', keys1)).resolves.toEqual(['Lemon', 'Egg', undefined, 'Orange', 'Noodle']);

        // keyRange?: IDBMKeyRange
        await expect(idb.getItems('MyStore')).resolves.toEqual(items); // 全範囲
        const keyRange1 = { lower: 'E', upper: 'O', lowerOpen: true };
        await expect(idb.getItems('MyStore', keyRange1)).resolves.toEqual(['Grape', 'Juice', 'Lemon', 'Noodle', 'Orange']);
        const keyRange2 = { lower: 'P', upper: 'R' };
        await expect(idb.getItems('MyStore', keyRange2)).resolves.toEqual([]);
    });
    test('getKeys', async () => {
        await expect(idb.getKeys('MyStore')).resolves.toEqual(keys); // 全範囲
        const keyRange1 = { lower: 'E', upper: 'O', lowerOpen: true };
        await expect(idb.getKeys('MyStore', keyRange1)).resolves.toEqual(['G', 'J', 'L', 'N', 'O']);
        const keyRange2 = { lower: 'P', upper: 'R' };
        await expect(idb.getKeys('MyStore', keyRange2)).resolves.toEqual([]);
    });
    test('countItems', async () => {
        await expect(idb.countItems('MyStore')).resolves.toEqual(10); // 全範囲
        const keyRange1 = { lower: 'E', upper: 'O', lowerOpen: true };
        await expect(idb.countItems('MyStore', keyRange1)).resolves.toEqual(5);
        const keyRange2 = { lower: 'P', upper: 'R' };
        await expect(idb.countItems('MyStore', keyRange2)).resolves.toEqual(0);
    });
    test('hasAnyItems', async () => {
        await expect(idb.hasAnyItems('MyStore')).resolves.toBe(true); // 全範囲
        const keyRange1 = { lower: 'E', upper: 'O', lowerOpen: true };
        await expect(idb.hasAnyItems('MyStore', keyRange1)).resolves.toBe(true);
        const keyRange2 = { lower: 'P', upper: 'R' };
        await expect(idb.hasAnyItems('MyStore', keyRange2)).resolves.toBe(false);
    });

    test('getItemsで不正なキーを渡すと取得できない', async () => {
        const keys1 = ['A', null];
        await expect(idb.getItems('MyStore', keys1 as IDBValidKey[])).rejects.toThrow(DOMException);
    });

    test('getIterator(範囲指定なし)', async () => {
        // for await ... of による取得
        const iter1 = idb.getIterator<string>('MyStore');
        const result1: string[] = [];
        for await (const item of iter1) {
            result1.push(item);
        }
        expect(result1).toEqual(items);

        // 列挙後に追加で next() を呼び出しても正常に返す
        await expect(iter1.next()).resolves.toEqual({ value: undefined, done: true });

        // イテレータの next() を await なしで呼び出して取得
        const iter2 = idb.getIterator<string>('MyStore');
        const promises = [];
        for (let i = 0; i < items.length; i += 1) {
            // eslint-disable-next-line @typescript-eslint/no-loop-func
            promises.push(iter2.next().then((response) => {
                expect(response).toEqual({ value: items[i], done: false });
            }));
        }
        promises.push(iter2.next().then((response) => {
            expect(response).toEqual({ value: undefined, done: true });
        }));
        await expect(Promise.all(promises)).resolves.toBeDefined();
    });
    test('getIterator(範囲指定あり)', async () => {
        const iter1 = idb.getIterator<string>('MyStore', { lower: 'E', upper: 'O', lowerOpen: true });
        const result1: string[] = [];
        for await (const item of iter1) {
            result1.push(item);
        }
        expect(result1).toEqual(['Grape', 'Juice', 'Lemon', 'Noodle', 'Orange']);

        const iter2 = idb.getIterator<string>('MyStore', { lower: 'P', upper: 'R' });
        const result2: string[] = [];
        for await (const item of iter2) {
            result2.push(item);
        }
        expect(result2).toEqual([]);
    });
    test('getReversedIterator', async () => {
        const iter1 = idb.getReversedIterator<string>('MyStore');
        const result1: string[] = [];
        for await (const item of iter1) {
            result1.push(item);
        }
        expect(result1).toEqual(Array.from(items).reverse());

        // 列挙後に追加で next() を呼び出しても正常に返す
        await expect(iter1.next()).resolves.toEqual({ value: undefined, done: true });

        const iter2 = idb.getReversedIterator<string>('MyStore', { lower: 'E', upper: 'O', lowerOpen: true });
        const result2: string[] = [];
        for await (const item of iter2) {
            result2.push(item);
        }
        expect(result2).toEqual(['Orange', 'Noodle', 'Lemon', 'Juice', 'Grape']);

        const iter3 = idb.getReversedIterator<string>('MyStore', { lower: 'P', upper: 'R' });
        const result3: string[] = [];
        for await (const item of iter3) {
            result3.push(item);
        }
        expect(result3).toEqual([]);
    });
    test('getKeyIterator', async () => {
        const iter1 = idb.getKeyIterator('MyStore');
        const result1: IDBValidKey[] = [];
        for await (const key of iter1) {
            result1.push(key);
        }
        expect(result1).toEqual(keys);

        // 列挙後に追加で next() を呼び出しても正常に返す
        await expect(iter1.next()).resolves.toEqual({ value: undefined, done: true });

        const iter2 = idb.getKeyIterator('MyStore', { lower: 'E', upper: 'O', lowerOpen: true });
        const result2: IDBValidKey[] = [];
        for await (const key of iter2) {
            result2.push(key);
        }
        expect(result2).toEqual(['G', 'J', 'L', 'N', 'O']);

        const iter3 = idb.getKeyIterator('MyStore', { lower: 'P', upper: 'R' });
        const result3: IDBValidKey[] = [];
        for await (const key of iter3) {
            result3.push(key);
        }
        expect(result3).toEqual([]);
    });
    test('getReversedKeyIterator', async () => {
        const iter1 = idb.getReversedKeyIterator('MyStore');
        const result1: IDBValidKey[] = [];
        for await (const key of iter1) {
            result1.push(key);
        }
        expect(result1).toEqual(Array.from(keys).reverse());

        // 列挙後に追加で next() を呼び出しても正常に返す
        await expect(iter1.next()).resolves.toEqual({ value: undefined, done: true });

        const iter2 = idb.getReversedKeyIterator('MyStore', { lower: 'E', upper: 'O', lowerOpen: true });
        const result2: IDBValidKey[] = [];
        for await (const key of iter2) {
            result2.push(key);
        }
        expect(result2).toEqual(['O', 'N', 'L', 'J', 'G']);

        const iter3 = idb.getReversedKeyIterator('MyStore', { lower: 'P', upper: 'R' });
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
                { indexName: 'weightIdx', keyPath: 'weight', multiEntry: true },
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
                { indexName: 'weightIdx', keyPath: 'weight', multiEntry: true },
                { indexName: 'colorIdx', keyPath: 'color' },
            ],
            resetOnUpgrade: 'index',
        },
    ];

    const dbName = createDBName();

    test('インデックス付きオブジェクトストアを作成してDBを開く', async () => {
        const pidb = new PublicIDBManager(dbName, 1, oldStoreInfos);
        await expect(pidb.openDatabase()).resolves.toBeUndefined();

        await expect(pidb.setItem<Person>('MyStore1', {
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

        await expect(idb.setItems<Item>('MyStore2', [
            {
                item: 'Apple', id: 1, weight: 20, value: 100, color: 'red',
            },
            {
                item: 'Banana', id: 2, weight: 15, value: 150, color: 'yellow',
            },
        ])).resolves.toEqual(['Apple', 'Banana']);

        // 重複するidを指定すると失敗
        await expect(idb.setItem<Item>('MyStore2', {
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
        await expect(pidb.hasItem('MyStore1', 'Alice')).resolves.toBe(false);
        // resetOnUpgrade: 'index' のとき、データは残る
        await expect(pidb.hasItem('MyStore2', 'Apple')).resolves.toBe(true);

        pidb.closeDatabase();
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
            const result = await inner.addItem('MyStore1', 'Apple', 'A');
            await inner.addItem('MyStore1', 'Banana', 'B');
            return result;
        }, 'readwrite');
        await expect(tx).resolves.toBe('A');

        // トランザクション内で追加したデータが取得できることをテスト
        await expect(pidb.getItem('MyStore1', 'A')).resolves.toBe('Apple');
        await expect(pidb.getItem('MyStore1', 'B')).resolves.toBe('Banana');
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
    test('トランザクションのモードを間違えると失敗する', async () => {
        const tx = pidb.transaction('MyStore1', (inner) => {
            return inner.addItem('MyStore1', 'Cherry', 'C');
        }, 'readonly');
        await expect(tx).rejects.toThrow(DOMException);
        await expect(tx).rejects.toThrow('The mutating operation was attempted in a "readonly" transaction.');
    });
    test('トランザクション内の操作でエラーが発生するとロールバックする', async () => {
        const tx = pidb.transaction('MyStore1', async (inner) => {
            await inner.addItem('MyStore1', 'Cherry', 'C');
            await inner.addItem('MyStore1', 'Blueberry', 'B');
        }, 'readwrite');
        await expect(tx).rejects.toThrow(DOMException);

        // トランザクション実行前の状態に戻っていることをテスト
        await expect(pidb.getItem('MyStore1', 'C')).resolves.toBeUndefined();
        await expect(pidb.getItem('MyStore1', 'B')).resolves.toBe('Banana');
    });
});
