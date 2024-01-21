// ==UserScript==
// @name         IDBManagerTest
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://example.com*
// @grant        none
// ==/UserScript==

'use strict';

class IDBManager {
    #db;
    #txs;
    #hasKey;
    #outputWarning;
    
    #storeUpdateType = Object.freeze({ 'remain': 0, 'new': 1, 'delete': 2, 'reset': 3 });
    #storeOptions = Object.freeze([ 'keyPath', 'autoIncrement' ]);
    #indexOptions = Object.freeze([ 'unique', 'multiEntry' ]);
    
    #addDatabaseEventHandler() {
        this.#db.onclose = (e) => {
            if (this.#outputWarning) console.warn(`\'${this.databaseName}\' database was unexpectedly closed.`);
            this.#db = null;
        };
        this.#db.onversionchange = (e) => {
            if (this.#outputWarning) console.warn(`\'${this.databaseName}\' database was closed due to a request to change its structure.`);
            this.closeDatabase();
        };
    }
    #createTransaction(storeName) {
        if (this.#txs.has(storeName)) return;
        
        const tx = this.#db.transaction(storeName, 'readwrite');
        tx.onabort = (e) => {
            if (this.#outputWarning) console.warn(`The transaction of \'${storeName}\' object store was aborted.`);
            this.#txs.delete(storeName);
        };
        tx.oncomplete = (e) => { this.#txs.delete(storeName); };
        
        this.#txs.set(storeName, tx);
    }
    #createKeyRange(obj, objName) {
        if (typeof obj.full === 'boolean' && obj.full) return null;
        if (obj.hasOwnProperty('lower') && obj.hasOwnProperty('upper')) return window.IDBKeyRange.bound(obj.lower, obj.upper, obj.lowerOpen, obj.upperOpen);
        else if (obj.hasOwnProperty('lower')) return window.IDBKeyRange.lowerBound(obj.lower, obj.lowerOpen);
        else if (obj.hasOwnProperty('upper')) return window.IDBKeyRange.upperBound(obj.upper, obj.upperOpen);
        else throw new TypeError(`${objName} must have at least one of \'full\', \'lower\', and \'upper\' properties.`);
    }
    #throwNonExistentStoreError(storeName) { if (!this.#hasKey.has(storeName)) throw new ReferenceError(`The database does not have a object store named \'${storeName}\'.`); }
    
    constructor(outputWarning = false) {
        this.#db = null;
        this.#txs = new Map();
        this.#hasKey = new Map();
        this.#outputWarning = outputWarning;
    }

    get databaseName() { return this.#db ? this.#db.name : null; }
    get databaseVersion() { return this.#db ? this.#db.version : null; }    
    get outputWarning() { return this.#outputWarning; }
    set outputWarning(bool) { if (typeof bool === 'boolean') this.#outputWarning = bool; }
    
    //*は省略可
    //objectStoreInfos = [ storeInfo1, storeInfo2, ... ]
    //storeInfo = { name, *keyPath, *autoIncrement, *indexInfos, *reset }
    //indexInfos = [ indexInfo1, indexInfo2, ... ]
    //indexInfo = { name, keyPath, *unique, *multiEntry }
    openDatabase(databaseName, version, objectStoreInfos) {
        return new Promise((resolve, reject) => {
            let upgraded = false;
            const openRequest = window.indexedDB.open(databaseName, version);
            
            openRequest.onblocked = (e) => { if (this.#outputWarning) console.warn(`The request to open \'${databaseName}\' database is paused until all connections to the database are closed.`); };
            openRequest.onerror = (e) => { reject(e.target.error); };
            openRequest.onsuccess = (e) => {
                if (this.#db) this.closeDatabase();
                this.#db = e.target.result;
                this.#addDatabaseEventHandler();
                
                for (const storeInfo of objectStoreInfos) {
                    this.#hasKey.set(storeInfo.name, false);
                    for (const op of this.#storeOptions) {
                        if (storeInfo.hasOwnProperty(op)) this.#hasKey.set(storeInfo.name, true);
                    }
                }
                resolve(upgraded);
            };
            
            openRequest.onupgradeneeded = (e) => {
                upgraded = true;
                const db = e.target.result;
                
                const m = new Map();
                for (const name of db.objectStoreNames) {
                    m.set(name, { type: this.#storeUpdateType['delete'], options: null, indexInfos: null });
                }
                for (const storeInfo of objectStoreInfos) {
                    const options = {};
                    for (const op of this.#storeOptions) {
                        if (storeInfo.hasOwnProperty(op)) options[op] = storeInfo[op];
                    }
                    
                    if (m.has(storeInfo.name)) {
                        if (storeInfo.reset) {
                            m.set(storeInfo.name, { type: this.#storeUpdateType['reset'], options, indexInfos: storeInfo.indexInfos });
                        } else {
                            m.set(storeInfo.name, { type: this.#storeUpdateType['remain'], options: null, indexInfos: null });
                        }
                    } else {
                        m.set(storeInfo.name, { type: this.#storeUpdateType['new'], options, indexInfos: storeInfo.indexInfos });
                    }
                }
                
                for (const [name, obj] of m) {
                    switch (obj.type) {
                        case this.#storeUpdateType['delete']:
                            db.deleteObjectStore(name);
                            break;
                        case this.#storeUpdateType['reset']:
                            db.deleteObjectStore(name);
                        case this.#storeUpdateType['new']:
                            const store = db.createObjectStore(name, obj.options);
                            if (obj.indexInfos) {
                                for (const indexInfo of obj.indexInfos) {
                                    const options = {};
                                    for (const op of this.#indexOptions) {
                                        if (indexInfo.hasOwnProperty(op)) options[op] = indexInfo[op];
                                    }
                                    store.createIndex(indexInfo.name, indexInfo.keyPath, options);
                                }
                            }
                            break;
                    }
                }
            };
        });
    }
    closeDatabase() {
        return new Promise((resolve, reject) => {
            if (this.#db) {
                this.#db.close();
                this.#db = null;
            }
            resolve(null);
        });
    }
    static deleteDatabase(databaseName, outputWarning = false) {
        return new Promise((resolve, reject) => {
            const deleteRequest = window.indexedDB.deleteDatabase(databaseName);
            deleteRequest.onblocked = (e) => { if (outputWarning) console.warn(`The request to delete \'${databaseName}\' database is paused until all connections to the database are closed.`); };
            deleteRequest.onerror = (e) => { reject(e.target.error); };
            deleteRequest.onsuccess = (e) => { resolve(null); };
        });
    }
    
    setItem(storeName, value, key) {
        return new Promise((resolve, reject) => {
            storeName = (storeName).toString();
            this.#throwNonExistentStoreError(storeName);
            this.#createTransaction(storeName);
            const store = this.#txs.get(storeName).objectStore(storeName);
            
            const putRequest = store.put(value, key);
            putRequest.onerror = (e) => { reject(e.target.error); };
            putRequest.onsuccess = (e) => { resolve(e.target.result); };
        });
    }
    setItems(storeName, entries) {
        return new Promise((resolve, reject) => {
            if (!Array.isArray(entries)) { throw new TypeError('entries must be an Array.'); }
            storeName = (storeName).toString();
            this.#throwNonExistentStoreError(storeName);
            this.#createTransaction(storeName);
            const store = this.#txs.get(storeName).objectStore(storeName);
            
            const tasks = entries.map((val, idx) => {
                if (this.#hasKey.get(storeName)) {
                    return new Promise((resolve, reject) => {
                        const putRequest = store.put(val);
                        putRequest.onerror = (e) => { reject(e.target.error); };
                        putRequest.onsuccess = (e) => { resolve(e.target.result); };
                    });
                }
                else {
                    if (!val.hasOwnProperty('key') || !val.hasOwnProperty('value')) throw new TypeError('One of the elements in entries does not have \'key\' or \'value\' property.');
                    return new Promise((resolve, reject) => {
                        const putRequest = store.put(val.value, val.key);
                        putRequest.onerror = (e) => { reject(e.target.error); };
                        putRequest.onsuccess = (e) => { resolve(e.target.result); };
                    });
                }
            });
            Promise.all(tasks).then((response) => { resolve(response); }, (error) => { reject(error); });
        });
    }
    
    deleteItem(storeName, key) {
        return new Promise((resolve, reject) => {
            storeName = (storeName).toString();
            this.#throwNonExistentStoreError(storeName);
            if (key instanceof window.IDBKeyRange) throw new TypeError('IDBKeyRange is not available as key for deleteItem; please use deleteItems.');
            this.#createTransaction(storeName);
            const store = this.#txs.get(storeName).objectStore(storeName);
            
            const deleteRequest = store.delete(key);
            deleteRequest.onerror = (e) => { reject(e.target.error); };
            deleteRequest.onsuccess = (e) => { resolve(e.target.result); };
        });
    }
    deleteItems(storeName, rangeOrArray) {
        return new Promise((resolve, reject) => {
            storeName = (storeName).toString();
            this.#throwNonExistentStoreError(storeName);
            this.#createTransaction(storeName);
            const store = this.#txs.get(storeName).objectStore(storeName);
            
            if (rangeOrArray instanceof window.IDBKeyRange) {
                const deleteRequest = store.delete(rangeOrArray);
                deleteRequest.onerror = (e) => { reject(e.target.error); };
                deleteRequest.onsuccess = (e) => { resolve(e.target.result); };
            }
            else if (Array.isArray(rangeOrArray)) {
                const tasks = rangeOrArray.map((val, idx) => {
                    return new Promise((resolve, reject) => {
                        const deleteRequest = store.delete(val);
                        deleteRequest.onerror = (e) => { reject(e.target.error); };
                        deleteRequest.onsuccess = (e) => { resolve(e.target.result); };
                    });
                });
                Promise.all(tasks).then((response) => { resolve(/* undefined */); }, (error) => { reject(error); });
            }
            else if (typeof rangeOrArray === 'object') {
                const keyRange = this.#createKeyRange(rangeOrArray, 'rangeOrArray');
                if (keyRange) {
                    const deleteRequest = store.delete(keyRange);
                    deleteRequest.onerror = (e) => { reject(e.target.error); };
                    deleteRequest.onsuccess = (e) => { resolve(e.target.result); };
                }
                else {
                    const clearRequest = store.clear();
                    clearRequest.onerror = (e) => { reject(e.target.error); };
                    clearRequest.onsuccess = (e) => { resolve(e.target.result); };
                }
            }
            else throw new TypeError('A single key is not available as rangeOrArray for deleteItems; please use deleteItem.');
        });
    }
    deleteAllItems(storeName) {
        storeName = (storeName).toString();
        this.#throwNonExistentStoreError(storeName);
        this.#createTransaction(storeName);
        const store = this.#txs.get(storeName).objectStore(storeName);
        
        const clearRequest = store.clear();
        clearRequest.onerror = (e) => { reject(e.target.error); };
        clearRequest.onsuccess = (e) => { resolve(e.target.result); };
    }
}

(async function() {
    try {
        const databaseName = 'MyDatabase';
        const objectStoreInfos = [
            { name: 'ObjectStore1' },
            { name: 'ObjectStore2', keyPath: 'key' },
            { name: 'ObjectStore3', autoIncrement: true },
            { name: 'ObjectStore4', keyPath: 'hoge', autoIncrement: true },
            { name: 'ObjectStore5', reset: true, keyPath: 'name', indexInfos: [ { name: 'by_age', keyPath: 'age' }, { name: 'by_email', keyPath: 'email', unique: true } ] },
        ];
        
        const idb = new IDBManager(true);
        
        const openButton = document.createElement('button');
        openButton.textContent = 'Open';
        openButton.addEventListener('click', (e) => {
            idb.openDatabase(databaseName, 1, objectStoreInfos)
                .then((response) => {
                    console.log('open success');
                    console.log(response);
                })
                .catch((error) => {
                    console.log('open error');
                    console.error(error);
                });
        });
        
        const setButton = document.createElement('button');
        setButton.textContent = 'Set Item';
        setButton.addEventListener('click', (e) => {
            idb.setItems(objectStoreInfos[1].name, [{key: 'aaa', value: 998244353}, {key: 'bbb', value: 1000000007}, {key: 'ccc', value: 100}, {key: 'ddd', value: 57}])
                .then((response) => {
                    console.log('set success');
                    console.log(response);
                })
                .catch((error) => {
                    console.log('set error');
                    console.error(error);
                });
        });
        
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete Item';
        deleteButton.addEventListener('click', (e) => {
            idb.deleteItems(objectStoreInfos[1].name, { lower: 'aaa', upper: 'ccc', lowerOpen: true, upperOpen: false })
                .then((response) => {
                    console.log('delete success');
                    console.log(response);
                })
                .catch((error) => {
                    console.log('delete error');
                    console.error(error);
                });
        });
        
        document.getElementsByTagName('body')[0].appendChild(openButton);
        document.getElementsByTagName('body')[0].appendChild(setButton);
        document.getElementsByTagName('body')[0].appendChild(deleteButton);
        
    } catch (error) {
        console.log('error');
        console.error(error);
    }
})();
