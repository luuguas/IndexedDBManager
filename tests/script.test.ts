import 'fake-indexeddb/auto';
import { IDBManager, IDBMStoreInfo, IDBMKeyRange } from '../src/script';
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

describe('CRUDs共通の例外処理', () => {
    beforeAll(() => {
        window.indexedDB = new IDBFactory(); // refresh the mocked IndexedDB
    });

    test('DBを開いていない状態で呼び出すとエラー', async () => {
        const idb = new IDBManager('', 1, []);

        await expect(idb.setItem('', {})).rejects.toThrow(ReferenceError);
        await expect(idb.setItems('', [])).rejects.toThrow(ReferenceError);
        await expect(idb.removeItem('', '')).rejects.toThrow(ReferenceError);
        await expect(idb.removeItems('', [])).rejects.toThrow(ReferenceError);
        await expect(idb.clearItems('')).rejects.toThrow(ReferenceError);
        await expect(idb.getItem('', '')).rejects.toThrow(ReferenceError);
        await expect(idb.getFirstItem('')).rejects.toThrow(ReferenceError);
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

    test('1個のデータを追加する', async () => {
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

    test('複数のデータを追加する', async () => {
        // keyPath: なし, autoIncrement: false
        // itemは任意の値
        const items1 = ['Apple', { name: 'Banana' }];
        const keys1 = ['A', 'B'];
        await expect(idb.setItems('MyStore1', items1, keys1)).resolves.toEqual(keys1);
        await expect(idb.getItem('MyStore1', 'A')).resolves.toBe('Apple');
        await expect(idb.getItem('MyStore1', 'B')).resolves.toEqual({ name: 'Banana' });

        // keyPath: あり, autoIncrement: false
        // itemはオブジェクトのみ
        const items2 = [{ key: 'C', value: 'Cherry' }, { key: 'D', value: 'Donut' }];
        await expect(idb.setItems('MyStore2', items2)).resolves.toEqual(['C', 'D']);
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

    test('キー指定を間違えると追加できない', async () => {
        // keyPath: なし, autoIncrement: false
        const items1 = ['Juice', 'Kiwi'];
        const keys1 = ['J', undefined]; // keys[1]: 外部キー指定なし
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
});
