import { NULL_IDB_DATABASE } from '../src/null';

describe('NullIDBDatabaseのテスト', () => {
    test('メンバ変数を参照すると例外が発生する', () => {
        expect(() => { return NULL_IDB_DATABASE.name; }).toThrow(ReferenceError);
        expect(() => { return NULL_IDB_DATABASE.version; }).toThrow(ReferenceError);
        expect(() => { return NULL_IDB_DATABASE.objectStoreNames; }).toThrow(ReferenceError);
    });
    test('メンバ関数を呼び出すと例外が発生する', () => {
        expect(() => { NULL_IDB_DATABASE.close(); }).toThrow(ReferenceError);
        expect(() => { NULL_IDB_DATABASE.createObjectStore(''); }).toThrow(ReferenceError);
        expect(() => { NULL_IDB_DATABASE.deleteObjectStore(''); }).toThrow(ReferenceError);
        expect(() => { NULL_IDB_DATABASE.transaction(''); }).toThrow(ReferenceError);
    });
    test('イベントハンドラにアクセスすると例外が発生する', () => {
        expect(() => { return NULL_IDB_DATABASE.onclose; }).toThrow(ReferenceError);
        expect(() => { NULL_IDB_DATABASE.onclose = null; }).toThrow(ReferenceError);
        expect(() => { return NULL_IDB_DATABASE.onversionchange; }).toThrow(ReferenceError);
        expect(() => { NULL_IDB_DATABASE.onversionchange = null; }).toThrow(ReferenceError);
        expect(() => { return NULL_IDB_DATABASE.onabort; }).toThrow(ReferenceError);
        expect(() => { NULL_IDB_DATABASE.onabort = null; }).toThrow(ReferenceError);
        expect(() => { return NULL_IDB_DATABASE.onerror; }).toThrow(ReferenceError);
        expect(() => { NULL_IDB_DATABASE.onerror = null; }).toThrow(ReferenceError);
    });
    test('その他のイベント関連の関数を呼び出すと例外が発生する', () => {
        expect(() => { NULL_IDB_DATABASE.addEventListener('', () => {}); }).toThrow(ReferenceError);
        expect(() => { NULL_IDB_DATABASE.removeEventListener('', () => {}); }).toThrow(ReferenceError);
        expect(() => { NULL_IDB_DATABASE.dispatchEvent(new Event('')); }).toThrow();
    });
});
