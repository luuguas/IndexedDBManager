import { NULL_IDB_DATABASE } from '../src/null';

describe('NULL_IDB_DATABASEのテスト', () => {
    test('メンバ変数やメンバ関数を参照すると例外を発生させる', () => {
        expect(() => { return NULL_IDB_DATABASE.name; }).toThrow(ReferenceError);
        expect(() => { return NULL_IDB_DATABASE.version; }).toThrow(ReferenceError);
        expect(() => { return NULL_IDB_DATABASE.objectStoreNames; }).toThrow(ReferenceError);

        expect(() => { return NULL_IDB_DATABASE.onclose; }).toThrow(ReferenceError);
        expect(() => { return NULL_IDB_DATABASE.onversionchange; }).toThrow(ReferenceError);
        expect(() => { return NULL_IDB_DATABASE.onabort; }).toThrow(ReferenceError);
        expect(() => { return NULL_IDB_DATABASE.onerror; }).toThrow(ReferenceError);

        expect(() => { NULL_IDB_DATABASE.close(); }).toThrow(ReferenceError);
        expect(() => { NULL_IDB_DATABASE.createObjectStore(''); }).toThrow(ReferenceError);
        expect(() => { NULL_IDB_DATABASE.deleteObjectStore(''); }).toThrow(ReferenceError);
        expect(() => { NULL_IDB_DATABASE.transaction(''); }).toThrow(ReferenceError);

        expect(() => { NULL_IDB_DATABASE.addEventListener('', null); }).toThrow(ReferenceError);
        expect(() => { NULL_IDB_DATABASE.removeEventListener('', null); }).toThrow(ReferenceError);
        expect(() => { NULL_IDB_DATABASE.dispatchEvent(null); }).toThrow(ReferenceError);
    });
});
