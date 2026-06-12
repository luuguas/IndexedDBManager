import 'fake-indexeddb/auto';
import { IDBMStoreInfo } from '../src/manager';
import { IDBMTransaction } from '../src/transaction';
import { PublicIDBManager } from './env/public';

/* eslint-disable no-restricted-syntax */

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
        await expect(tx.getItems('')).rejects.toThrow(DOMException);
        await expect(tx.getKeys('')).rejects.toThrow(DOMException);
        await expect(tx.countItems('')).rejects.toThrow(DOMException);
        await expect(tx.hasAnyItems('')).rejects.toThrow(DOMException);
        expect(() => { tx.getIterator(''); }).toThrow(DOMException);
        expect(() => { tx.getReversedIterator(''); }).toThrow(DOMException);
        expect(() => { tx.getKeyIterator(''); }).toThrow(DOMException);
        expect(() => { tx.getReversedKeyIterator(''); }).toThrow(DOMException);
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

        tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        await expect(tx.getItems('MyStoreX')).rejects.toThrow(DOMException);
        await expect(tx.getSettlement()).rejects.toThrow(DOMException);

        tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        await expect(tx.getKeys('MyStoreX')).rejects.toThrow(DOMException);
        await expect(tx.getSettlement()).rejects.toThrow(DOMException);

        tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        await expect(tx.countItems('MyStoreX')).rejects.toThrow(DOMException);
        await expect(tx.getSettlement()).rejects.toThrow(DOMException);

        tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        await expect(tx.hasAnyItems('MyStoreX')).rejects.toThrow(DOMException);
        await expect(tx.getSettlement()).rejects.toThrow(DOMException);

        tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        expect(() => { tx.getIterator('MyStoreX'); }).toThrow(DOMException);
        await expect(tx.getSettlement()).rejects.toThrow(DOMException);

        tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        expect(() => { tx.getReversedIterator('MyStoreX'); }).toThrow(DOMException);
        await expect(tx.getSettlement()).rejects.toThrow(DOMException);

        tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        expect(() => { tx.getKeyIterator('MyStoreX'); }).toThrow(DOMException);
        await expect(tx.getSettlement()).rejects.toThrow(DOMException);

        tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        expect(() => { tx.getReversedKeyIterator('MyStoreX'); }).toThrow(DOMException);
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

describe('イテレータのテスト', () => {
    beforeAll(() => {
        window.indexedDB = new IDBFactory(); // refresh the mocked IndexedDB
    });

    const pidb = new PublicIDBManager(dbName, 1, storeInfos);

    const items = ['Banana', 'Donut', 'Egg', 'Grape', 'Juice', 'Lemon', 'Noodle', 'Orange', 'Strawberry', 'Vegetable'];
    const keys = ['B', 'D', 'E', 'G', 'J', 'L', 'N', 'O', 'S', 'V'];

    beforeAll(async () => {
        await pidb.openDatabase();
        await pidb.setItems('MyStore1', items, keys);
        pidb.closeDatabase();
    });

    beforeEach(async () => {
        await pidb.openDatabase();
    });
    afterEach(() => {
        pidb.closeDatabase();
    });

    test('イテレータで全件取得', async () => {
        // getIterator
        const tx1 = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        const iter1 = tx1.getIterator<string>('MyStore1');
        const result1: string[] = [];
        for await (const item of iter1) {
            result1.push(item);
        }
        expect(result1).toEqual(items);

        // トランザクション完了後に next() を呼び出すとエラー
        await expect(tx1.getSettlement()).resolves.toBeUndefined();
        await expect(iter1.next()).rejects.toThrow(DOMException);

        // getReversedIterator
        const tx2 = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        const iter2 = tx2.getReversedIterator<string>('MyStore1');
        const result2: string[] = [];
        for await (const item of iter2) {
            result2.push(item);
        }
        expect(result2).toEqual(items.slice().reverse());

        await expect(tx2.getSettlement()).resolves.toBeUndefined();
        await expect(iter2.next()).rejects.toThrow(DOMException);

        // getKeyIterator
        const tx3 = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        const iter3 = tx3.getKeyIterator('MyStore1');
        const result3: IDBValidKey[] = [];
        for await (const key of iter3) {
            result3.push(key);
        }
        expect(result3).toEqual(keys);

        await expect(tx3.getSettlement()).resolves.toBeUndefined();
        await expect(iter3.next()).rejects.toThrow(DOMException);

        // getReversedKeyIterator
        const tx4 = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        const iter4 = tx4.getReversedKeyIterator('MyStore1');
        const result4: IDBValidKey[] = [];
        for await (const key of iter4) {
            result4.push(key);
        }
        expect(result4).toEqual(keys.slice().reverse());

        await expect(tx4.getSettlement()).resolves.toBeUndefined();
        await expect(iter4.next()).rejects.toThrow(DOMException);
    });

    test('走査中にトランザクションをcommitするとエラー', async () => {
        // getIterator
        const tx1 = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        const iter1 = tx1.getIterator<string>('MyStore1');
        const result1: string[] = [];
        const p1 = (async () => {
            for await (const item of iter1) {
                result1.push(item);
                tx1.commit();
            }
        })();
        await expect(p1).rejects.toThrow(DOMException);
        await expect(p1).rejects.toThrow('The transaction is not active.');

        // 更に next() を呼び出すと (prevError) => { ... } 節でrejectされる
        await expect(iter1.next()).rejects.toThrow(DOMException);
        await expect(iter1.next()).rejects.toThrow('The transaction is not active.');

        await expect(tx1.getSettlement()).resolves.toBeUndefined();

        // getReversedIterator
        const tx2 = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        const iter2 = tx2.getReversedIterator<string>('MyStore1');
        const result2: string[] = [];
        await expect(async () => {
            for await (const item of iter2) {
                result2.push(item);
                tx2.commit();
            }
        }).rejects.toThrow(DOMException);
        await expect(iter2.next()).rejects.toThrow(DOMException);

        await expect(tx2.getSettlement()).resolves.toBeUndefined();

        // getKeyIterator
        const tx3 = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        const iter3 = tx3.getKeyIterator('MyStore1');
        const result3: IDBValidKey[] = [];
        await expect(async () => {
            for await (const item of iter3) {
                result3.push(item);
                tx3.commit();
            }
        }).rejects.toThrow(DOMException);
        await expect(iter3.next()).rejects.toThrow(DOMException);

        await expect(tx3.getSettlement()).resolves.toBeUndefined();

        // getReversedKeyIterator
        const tx4 = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        const iter4 = tx4.getReversedKeyIterator('MyStore1');
        const result4: IDBValidKey[] = [];
        await expect(async () => {
            for await (const item of iter4) {
                result4.push(item);
                tx4.commit();
            }
        }).rejects.toThrow(DOMException);
        await expect(iter4.next()).rejects.toThrow(DOMException);

        await expect(tx4.getSettlement()).resolves.toBeUndefined();
    });
    test('走査中にトランザクションをabortするとエラー', async () => {
        // getIterator
        const tx1 = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        const iter1 = tx1.getIterator<string>('MyStore1');
        const result1: string[] = [];
        await expect(async () => {
            for await (const item of iter1) {
                result1.push(item);
                tx1.abort(new Error('Oops'));
            }
        }).rejects.toThrow(DOMException);

        await expect(tx1.getSettlement()).rejects.toThrow('Oops');

        // getReversedIterator
        const tx2 = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        const iter2 = tx2.getReversedIterator<string>('MyStore1');
        const result2: string[] = [];
        await expect(async () => {
            for await (const item of iter2) {
                result2.push(item);
                tx2.abort(new Error('Oops'));
            }
        }).rejects.toThrow(DOMException);

        await expect(tx2.getSettlement()).rejects.toThrow('Oops');

        // getKeyIterator
        const tx3 = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        const iter3 = tx3.getKeyIterator('MyStore1');
        const result3: IDBValidKey[] = [];
        await expect(async () => {
            for await (const key of iter3) {
                result3.push(key);
                tx3.abort(new Error('Oops'));
            }
        }).rejects.toThrow(DOMException);

        await expect(tx3.getSettlement()).rejects.toThrow('Oops');

        // getReversedKeyIterator
        const tx4 = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readonly');
        const iter4 = tx4.getReversedKeyIterator('MyStore1');
        const result4: IDBValidKey[] = [];
        await expect(async () => {
            for await (const key of iter4) {
                result4.push(key);
                tx4.abort(new Error('Oops'));
            }
        }).rejects.toThrow(DOMException);

        await expect(tx4.getSettlement()).rejects.toThrow('Oops');
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
