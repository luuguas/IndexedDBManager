import 'fake-indexeddb/auto';
import { IDBMStoreInfo } from '../src/manager';
import { IDBMTransaction } from '../src/transaction';
import { PublicIDBManager } from './env/public';

const dbName = 'MyDB001';
const storeInfos: IDBMStoreInfo[] = [
    { name: 'MyStore1' },
    { name: 'MyStore2', keyPath: 'key' },
    { name: 'MyStore3', autoIncrement: true },
];

describe('トランザクションの生成テスト', () => {
    beforeAll(() => {
        window.indexedDB = new IDBFactory(); // refresh the mocked IndexedDB
    });

    const pidb = new PublicIDBManager(dbName, 1, storeInfos);

    beforeEach(async () => {
        await pidb.openDatabase();
    });
    afterEach(() => {
        pidb.closeDatabase();
    });

    test('トランザクションの開始とcommit', async () => {
        const tx = new IDBMTransaction(pidb.p_db, 'MyStore1');
        expect(tx.isActive()).toBe(true);

        tx.commit();
        expect(tx.isActive()).toBe(false);
        await expect(tx.getSettlement()).resolves.toBeUndefined();
    });
    test('トランザクションのabort', async () => {
        const tx = new IDBMTransaction(pidb.p_db, 'MyStore1');
        expect(tx.isActive()).toBe(true);

        tx.abort();
        expect(tx.isActive()).toBe(false);
        const exp = expect(tx.getSettlement());
        await exp.rejects.toThrow(DOMException);
        await exp.rejects.toThrow('The transaction failed for some reason.');
    });
    test('例外を引数に渡してabort', async () => {
        const tx = new IDBMTransaction(pidb.p_db, 'MyStore1');

        tx.abort(new TypeError('Oops'));
        const exp = expect(tx.getSettlement());
        await exp.rejects.toThrow(TypeError);
        await exp.rejects.toThrow('Oops');
    });

    test('非アクティブ時にabortまたはcommitするとエラー', async () => {
        const tx = new IDBMTransaction(pidb.p_db, 'MyStore1');

        tx.commit();
        await expect(tx.getSettlement()).resolves.toBeUndefined();

        expect(() => { tx.abort(); }).toThrow(DOMException);
        expect(() => { tx.abort(); }).toThrow('The transaction is not active.');
        expect(() => { tx.commit(); }).toThrow(DOMException);
        expect(() => { tx.commit(); }).toThrow('The transaction is not active.');
    });
    test('存在しないオブジェクトストアを指定するとエラー', () => {
        expect(() => {
            const tx = new IDBMTransaction(pidb.p_db, 'MyStoreX');
            tx.commit();
        }).toThrow(DOMException);
    });
});

describe('CRUD共通の例外処理', () => {
    beforeAll(() => {
        window.indexedDB = new IDBFactory(); // refresh the mocked IndexedDB
    });

    const pidb = new PublicIDBManager(dbName, 1, storeInfos);

    beforeEach(async () => {
        await pidb.openDatabase();
    });
    afterEach(() => {
        pidb.closeDatabase();
    });

    test('トランザクションが非アクティブなときに呼び出すとエラー', async () => {
        const tx = new IDBMTransaction(pidb.p_db, 'MyStore1');
        tx.commit();
        await expect(tx.getSettlement()).resolves.toBeUndefined();

        await expect(tx.addItem('', {})).rejects.toThrow(DOMException);
        await expect(tx.addItem('', {})).rejects.toThrow('The transaction is not active.');
        await expect(tx.addItems('', [])).rejects.toThrow(DOMException);
        await expect(tx.setItem('', {})).rejects.toThrow(DOMException);
        await expect(tx.setItems('', [])).rejects.toThrow(DOMException);
        await expect(tx.removeItem('', '')).rejects.toThrow(DOMException);
        await expect(tx.removeItems('', [])).rejects.toThrow(DOMException);
        await expect(tx.clearItems('')).rejects.toThrow(DOMException);

        await expect(tx.getItem('', '')).rejects.toThrow(DOMException);
        await expect(tx.getFirstItem('')).rejects.toThrow(DOMException);
        await expect(tx.getLastItem('')).rejects.toThrow(DOMException);
        await expect(tx.getFirstKey('')).rejects.toThrow(DOMException);
        await expect(tx.getLastKey('')).rejects.toThrow(DOMException);
        await expect(tx.hasItem('', '')).rejects.toThrow(DOMException);
    });
    test('存在しないオブジェクトストアを指定するとエラー', async () => {
        let tx: IDBMTransaction;

        // 追加・更新・削除関数

        tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readwrite');
        const exp = expect(tx.addItem('MyStoreX', {}));
        await exp.rejects.toThrow(DOMException);
        await exp.rejects.toThrow('The operation failed because the requested database object could not be found. For example, an object store did not exist but was being opened.');
        // settlementもrejectされることをexpectで確認する これをしないとテストが落ちる
        await expect(tx.getSettlement()).rejects.toThrow(DOMException);

        tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readwrite');
        await expect(tx.addItems('MyStoreX', [])).rejects.toThrow(DOMException);
        await expect(tx.getSettlement()).rejects.toThrow(DOMException);

        tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readwrite');
        await expect(tx.setItem('MyStoreX', {})).rejects.toThrow(DOMException);
        await expect(tx.getSettlement()).rejects.toThrow(DOMException);

        tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readwrite');
        await expect(tx.setItems('MyStoreX', [])).rejects.toThrow(DOMException);
        await expect(tx.getSettlement()).rejects.toThrow(DOMException);

        tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readwrite');
        await expect(tx.removeItem('MyStoreX', '')).rejects.toThrow(DOMException);
        await expect(tx.getSettlement()).rejects.toThrow(DOMException);

        tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readwrite');
        await expect(tx.removeItems('MyStoreX', [])).rejects.toThrow(DOMException);
        await expect(tx.getSettlement()).rejects.toThrow(DOMException);

        tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readwrite');
        await expect(tx.clearItems('MyStoreX')).rejects.toThrow(DOMException);
        await expect(tx.getSettlement()).rejects.toThrow(DOMException);

        // 取得関数

        tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        await expect(tx.getItem('MyStoreX', '')).rejects.toThrow(DOMException);
        await expect(tx.getSettlement()).rejects.toThrow(DOMException);

        tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        await expect(tx.getFirstItem('MyStoreX')).rejects.toThrow(DOMException);
        await expect(tx.getSettlement()).rejects.toThrow(DOMException);

        tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        await expect(tx.getLastItem('MyStoreX')).rejects.toThrow(DOMException);
        await expect(tx.getSettlement()).rejects.toThrow(DOMException);

        tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        await expect(tx.getFirstKey('MyStoreX')).rejects.toThrow(DOMException);
        await expect(tx.getSettlement()).rejects.toThrow(DOMException);

        tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        await expect(tx.getLastKey('MyStoreX')).rejects.toThrow(DOMException);
        await expect(tx.getSettlement()).rejects.toThrow(DOMException);

        tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        await expect(tx.hasItem('MyStoreX', '')).rejects.toThrow(DOMException);
        await expect(tx.getSettlement()).rejects.toThrow(DOMException);
    });
    test('トランザクションのモードがreadonlyのときに更新系の関数を呼び出すとエラー', async () => {
        let tx: IDBMTransaction;

        tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        const exp = expect(tx.addItem('MyStore1', {}));
        await exp.rejects.toThrow(DOMException);
        await exp.rejects.toThrow('The mutating operation was attempted in a "readonly" transaction.');
        await expect(tx.getSettlement()).rejects.toThrow(DOMException);

        tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        await expect(tx.addItems('MyStore1', ['Apple'], ['A'])).rejects.toThrow(DOMException);
        await expect(tx.getSettlement()).rejects.toThrow(DOMException);

        tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        await expect(tx.setItem('MyStore1', {})).rejects.toThrow(DOMException);
        await expect(tx.getSettlement()).rejects.toThrow(DOMException);

        tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        await expect(tx.setItems('MyStore1', ['Apple'], ['A'])).rejects.toThrow(DOMException);
        await expect(tx.getSettlement()).rejects.toThrow(DOMException);

        tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        await expect(tx.removeItem('MyStore1', '')).rejects.toThrow(DOMException);
        await expect(tx.getSettlement()).rejects.toThrow(DOMException);

        tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        await expect(tx.removeItems('MyStore1', ['A'])).rejects.toThrow(DOMException);
        await expect(tx.getSettlement()).rejects.toThrow(DOMException);

        tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        await expect(tx.clearItems('MyStore1')).rejects.toThrow(DOMException);
        await expect(tx.getSettlement()).rejects.toThrow(DOMException);
    });
});

describe('addItemのテスト', () => {
    beforeAll(() => {
        window.indexedDB = new IDBFactory(); // refresh the mocked IndexedDB
    });

    const pidb = new PublicIDBManager(dbName, 1, storeInfos);

    beforeEach(async () => {
        await pidb.openDatabase();
    });
    afterEach(() => {
        pidb.closeDatabase();
    });

    test('アイテムを追加する', async () => {
        const tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readwrite');
        await expect(tx.addItem('MyStore1', 'Apple', 'A')).resolves.toBe('A');
        await expect(tx.getSettlement()).resolves.toBeUndefined();
        await expect(pidb.getItem('MyStore1', 'A')).resolves.toBe('Apple');
    });

    test('キー指定を間違えると追加できない', async () => {
        const tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readwrite');
        await expect(tx.addItem('MyStore1', 'Banana', 'B')).resolves.toBe('B');
        // addReq.add() が直接例外を投げる addReq.onerror は発火しない
        await expect(tx.addItem('MyStore1', 'Cherry', undefined)).rejects.toThrow(DOMException);

        await expect(tx.getSettlement()).rejects.toThrow(DOMException);
        // トランザクションがabortされているため、データは追加されていない
        await expect(pidb.getItem('MyStore1', 'B')).resolves.toBeUndefined();
    });
    test('既に存在するキーを指定すると追加できない', async () => {
        const tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readwrite');
        await expect(tx.addItem('MyStore1', 'Banana', 'B')).resolves.toBe('B');
        // addReq.onerror が発火する
        await expect(tx.addItem('MyStore1', 'Bread', 'B')).rejects.toThrow(DOMException);

        await expect(tx.getSettlement()).rejects.toThrow(DOMException);
        // トランザクションがabortされているため、データは追加されていない
        await expect(pidb.getItem('MyStore1', 'B')).resolves.toBeUndefined();
    });
});

describe('addItemsのテスト', () => {
    beforeAll(() => {
        window.indexedDB = new IDBFactory(); // refresh the mocked IndexedDB
    });

    const pidb = new PublicIDBManager(dbName, 1, storeInfos);

    beforeEach(async () => {
        await pidb.openDatabase();
    });
    afterEach(() => {
        pidb.closeDatabase();
    });

    test('複数のアイテムを追加する', async () => {
        const tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readwrite');
        const items1 = ['Apple', { name: 'Banana' }];
        const keys1 = ['A', 'B'];
        await expect(tx.addItems('MyStore1', items1, keys1)).resolves.toEqual(keys1);

        await expect(tx.getSettlement()).resolves.toBeUndefined();
        await expect(pidb.getItem('MyStore1', 'A')).resolves.toBe('Apple');
        await expect(pidb.getItem('MyStore1', 'B')).resolves.toEqual({ name: 'Banana' });
    });

    test('itemsとkeysの長さが違うと追加できない', async () => {
        const tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readwrite');
        const items = ['Cherry', 'Donuts'];
        const keys = ['C', 'D', 'E'];
        await expect(tx.addItems('MyStore1', items, keys)).rejects.toThrow(TypeError);
        await expect(tx.getSettlement()).rejects.toThrow(TypeError);
    });
    test('キー指定を間違えると追加できない', async () => {
        const tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readwrite');
        const items = ['Cherry', 'Donuts'];
        const keys = ['C', undefined];
        await expect(tx.addItems('MyStore1', items, keys)).rejects.toThrow(DOMException);

        await expect(tx.getSettlement()).rejects.toThrow(DOMException);
        // トランザクションがabortされているため、データは追加されていない
        await expect(pidb.getItem('MyStore1', 'C')).resolves.toBeUndefined();
        await expect(pidb.getItem('MyStore1', 'D')).resolves.toBeUndefined();
    });
    test('既存のキーを指定すると追加できない', async () => {
        const tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readwrite');
        const items1 = ['Cherry', { name: 'Blueberry' }];
        const keys1 = ['C', 'B'];
        await expect(tx.addItems('MyStore1', items1, keys1)).rejects.toThrow(DOMException);

        await expect(tx.getSettlement()).rejects.toThrow(DOMException);
        // トランザクションがabortされているため、データは追加されていない
        await expect(pidb.getItem('MyStore1', 'C')).resolves.toBeUndefined();
        await expect(pidb.getItem('MyStore1', 'B')).resolves.toEqual({ name: 'Banana' });
    });
});

/*
tx.onabort と tx.onerror の発火関係メモ
Case1: tx.abort() した場合
    tx.onabort のみ発火(undefined)
Case2: const addReq = tx.store.add() で既に存在するキーを指定した場合
    addReq.onerror が発火(ConstraintError) -> tx.onerror が発火(undefined)
    -> tx.onabort(ConstraintError) が発火
Case3: const addReq = tx.store.add() でキー指定を間違えたとき
    tx.store.add() が直接例外を投げるので、addReq.onerror は発火せず、tx.onerror および tx.onabort も発火しない
    ゆえにtx.abort()してあげる必要がある
*/
