import 'fake-indexeddb/auto';
import { IDBMStoreInfo } from '../src/manager';
import { IDBMTransaction } from '../src/transaction';
import { PublicIDBManager } from './env/public';

describe('トランザクションの生成テスト', () => {
    beforeAll(() => {
        window.indexedDB = new IDBFactory(); // refresh the mocked IndexedDB
    });

    const dbName = 'MyDB001';
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
        expect(() => { tx.abort(); }).toThrow('The transaction is not active.');
    });
});
