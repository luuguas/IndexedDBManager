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
        expect(tx.isActive()).toBe(true);
        await expect(tx.getSettlement()).resolves.toBeUndefined();
        expect(tx.isActive()).toBe(false); // トランザクション終了後に変化
    });
    test('トランザクションのabort', async () => {
        const tx = new IDBMTransaction(pidb.p_db, 'MyStore1');
        expect(tx.isActive()).toBe(true);

        tx.abort();
        expect(tx.isActive()).toBe(true);
        const exp = expect(tx.getSettlement());
        await exp.rejects.toThrow(DOMException);
        await exp.rejects.toThrow('The transaction failed for some reason.');
        expect(tx.isActive()).toBe(false); // トランザクション終了後に変化
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

    test('存在しないオブジェクトストアを指定するとエラー', async () => {
        let tx: IDBMTransaction;

        // eslint-disable-next-line prefer-const
        tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readwrite');
        await expect(tx.addItem('MyStoreX', 'Apple', 'A')).rejects.toThrow(DOMException);
        // settlementもrejectされることをexpectで確認する これをしないとテストが落ちる
        await expect(tx.getSettlement()).rejects.toThrow(DOMException);
    });
});

describe('addItemのテスト', () => {
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

    test('キー指定を間違えるとabort', async () => {
        const tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readwrite');
        await expect(tx.addItem('MyStore1', 'Banana', 'B')).resolves.toBe('B');
        // addReq.add() が直接例外を投げる addReq.onerror は発火しない
        await expect(tx.addItem('MyStore1', 'Cherry', undefined)).rejects.toThrow(DOMException);

        await expect(tx.getSettlement()).rejects.toThrow(DOMException);
        // トランザクションがabortされているため、データは追加されていない
        await expect(pidb.getItem('MyStore1', 'B')).resolves.toBeUndefined();
    });
    test('既に存在するキーを指定するとエラー', async () => {
        const tx = new IDBMTransaction(pidb.p_db, 'MyStore1', 'readwrite');
        await expect(tx.addItem('MyStore1', 'Banana', 'B')).resolves.toBe('B');
        // addReq.onerror が発火する
        await expect(tx.addItem('MyStore1', 'Bread', 'B')).rejects.toThrow(DOMException);

        await expect(tx.getSettlement()).rejects.toThrow(DOMException);
        // トランザクションがabortされているため、データは追加されていない
        await expect(pidb.getItem('MyStore1', 'B')).resolves.toBeUndefined();
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
