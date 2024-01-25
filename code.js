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
    #warningEnabled;
    
    #storeUpdateType = Object.freeze({ 'remain': 0, 'new': 1, 'delete': 2, 'reset': 3 });
    #storeOptions = Object.freeze([ 'keyPath', 'autoIncrement' ]);
    #indexOptions = Object.freeze([ 'unique', 'multiEntry' ]);
    
    #addDatabaseEventHandler() {
        this.#db.onclose = (e) => {
            if (this.#warningEnabled) console.warn(`\'${this.databaseName}\' database was unexpectedly closed.`);
            this.#db = null;
        };
        this.#db.onversionchange = (e) => {
            if (this.#warningEnabled) console.warn(`\'${this.databaseName}\' database was closed due to a request to change its structure.`);
            this.closeDatabase();
        };
    }
    #startTransaction(storeName) {
        if (this.#txs.has(storeName)) return;
        
        const tx = this.#db.transaction(storeName, 'readwrite');
        tx.onabort = (e) => {
            if (this.#warningEnabled) console.warn(`The transaction of \'${storeName}\' object store was aborted.`);
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
        else throw new TypeError(`${objName} must have at least one of \'full: true\', \'lower\', and \'upper\' properties.`);
    }
    #throwDatabaseNotOpenError() { if (!this.isOpen) throw new ReferenceError('Database is not open.'); }
    #throwStoreNotExistError(storeName) { if (!this.#hasKey.has(storeName)) throw new ReferenceError(`The database does not have a object store named \'${storeName}\'.`); }
    
    constructor(warningEnabled = false) {
        this.#db = null;
        this.#txs = new Map();
        this.#hasKey = new Map();
        this.#warningEnabled = warningEnabled;
    }

    get isOpen() { return this.#db !== null; }
    get databaseName() { return this.#db ? this.#db.name : null; }
    get databaseVersion() { return this.#db ? this.#db.version : null; }    
    get warningEnabled() { return this.#warningEnabled; }
    set warningEnabled(bool) { if (typeof bool === 'boolean') this.#warningEnabled = bool; }
    
    //*は省略可
    //objectStoreInfos = [ storeInfo1, storeInfo2, ... ]
    //storeInfo = { name, *keyPath, *autoIncrement, *indexInfos, *reset }
    //indexInfos = [ indexInfo1, indexInfo2, ... ]
    //indexInfo = { name, keyPath, *unique, *multiEntry }
    openDatabase(databaseName, version, objectStoreInfos) {
        return new Promise((resolve, reject) => {
            let upgraded = false;
            const openRequest = window.indexedDB.open(databaseName, version);
            
            openRequest.onblocked = (e) => { if (this.#warningEnabled) console.warn(`The request to open \'${databaseName}\' database is paused until all connections to the database are closed.`); };
            openRequest.onerror = (e) => { reject(e.target.error); };
            openRequest.onsuccess = (e) => {
                if (this.isOpen) this.closeDatabase();
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
                        if (storeInfo.reset) m.set(storeInfo.name, { type: this.#storeUpdateType['reset'], options, indexInfos: storeInfo.indexInfos });
                        else m.set(storeInfo.name, { type: this.#storeUpdateType['remain'], options: null, indexInfos: null });
                    } else {
                        m.set(storeInfo.name, { type: this.#storeUpdateType['new'], options, indexInfos: storeInfo.indexInfos });
                    }
                }
                
                for (const [name, obj] of m) {
                    let store = null;
                    switch (obj.type) {
                        case this.#storeUpdateType['delete']:
                            db.deleteObjectStore(name);
                            break;
                        case this.#storeUpdateType['reset']:
                            db.deleteObjectStore(name);
                        case this.#storeUpdateType['new']:
                            store = db.createObjectStore(name, obj.options);
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
    async closeDatabase() {
        if (this.isOpen) {
            this.#db.close();
            this.#db = null;
        }
        return;
    }
    static deleteDatabase(databaseName, warningEnabled = false) {
        return new Promise((resolve, reject) => {
            const deleteRequest = window.indexedDB.deleteDatabase(databaseName);
            deleteRequest.onblocked = (e) => { if (warningEnabled) console.warn(`The request to delete \'${databaseName}\' database is paused until all connections to the database are closed.`); };
            deleteRequest.onerror = (e) => { reject(e.target.error); };
            deleteRequest.onsuccess = (e) => { resolve(); };
        });
    }
    
    setItem(storeName, value, key) {
        return new Promise((resolve, reject) => {
            this.#throwDatabaseNotOpenError();
            storeName = (storeName).toString();
            this.#throwStoreNotExistError(storeName);
            this.#startTransaction(storeName);
            const store = this.#txs.get(storeName).objectStore(storeName);
            
            const putRequest = store.put(value, key);
            putRequest.onerror = (e) => { reject(e.target.error); };
            putRequest.onsuccess = (e) => { resolve(e.target.result); };
        });
    }
    setItems(storeName, entries) {
        return new Promise((resolve, reject) => {
            this.#throwDatabaseNotOpenError();
            storeName = (storeName).toString();
            this.#throwStoreNotExistError(storeName);
            if (!Array.isArray(entries)) throw new TypeError('entries must be an Array.');
            this.#startTransaction(storeName);
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
                    if (!val.hasOwnProperty('key') || !val.hasOwnProperty('value')) throw new TypeError('the elements in entries must have key and value properties.');
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
            this.#throwDatabaseNotOpenError();
            storeName = (storeName).toString();
            this.#throwStoreNotExistError(storeName);
            if (key instanceof window.IDBKeyRange) throw new TypeError('IDBKeyRange is not available as key for deleteItem; please use deleteItems.');
            this.#startTransaction(storeName);
            const store = this.#txs.get(storeName).objectStore(storeName);
            
            const deleteRequest = store.delete(key);
            deleteRequest.onerror = (e) => { reject(e.target.error); };
            deleteRequest.onsuccess = (e) => { resolve(e.target.result); };
        });
    }
    deleteItems(storeName, rangeOrArray) {
        return new Promise((resolve, reject) => {
            this.#throwDatabaseNotOpenError();
            storeName = (storeName).toString();
            this.#throwStoreNotExistError(storeName);
            this.#startTransaction(storeName);
            const store = this.#txs.get(storeName).objectStore(storeName);
            
            let deleteRequest = null;
            if (rangeOrArray instanceof window.IDBKeyRange) {
                deleteRequest = store.delete(rangeOrArray);
            } else if (Array.isArray(rangeOrArray)) {
                const tasks = rangeOrArray.map((val, idx) => {
                    return new Promise((resolve, reject) => {
                        const deleteRequest = store.delete(val);
                        deleteRequest.onerror = (e) => { reject(e.target.error); };
                        deleteRequest.onsuccess = (e) => { resolve(e.target.result); };
                    });
                });
                Promise.all(tasks).then((response) => { resolve(); }, (error) => { reject(error); });
            } else if (typeof rangeOrArray === 'object') {
                const keyRange = this.#createKeyRange(rangeOrArray, 'rangeOrArray');
                if (keyRange) deleteRequest = store.delete(keyRange);
                else deleteRequest = store.clear();
            } else {
                throw new TypeError('A single key is not available as rangeOrArray for deleteItems; please use deleteItem.');
            }
            
            if (deleteRequest) {
                deleteRequest.onerror = (e) => { reject(e.target.error); };
                deleteRequest.onsuccess = (e) => { resolve(e.target.result); };
            }
        });
    }
    
    getItem(storeName, key) {
        return new Promise((resolve, reject) => {
            this.#throwDatabaseNotOpenError();
            storeName = (storeName).toString();
            this.#throwStoreNotExistError(storeName);
            if (key instanceof window.IDBKeyRange) throw new TypeError('IDBKeyRange is not available as key for getItem; please use getFirstItem or getItems.');
            this.#startTransaction(storeName);
            const store = this.#txs.get(storeName).objectStore(storeName);
            
            const getRequest = store.get(key);
            getRequest.onerror = (e) => { reject(e.target.error); };
            getRequest.onsuccess = (e) => { resolve(e.target.result); };
        });
    }
    getFirstItem(storeName, range) {
        return new Promise((resolve, reject) => {
            this.#throwDatabaseNotOpenError();
            storeName = (storeName).toString();
            this.#throwStoreNotExistError(storeName);
            this.#startTransaction(storeName);
            const store = this.#txs.get(storeName).objectStore(storeName);
            
            let getRequest = null;
            if (range instanceof window.IDBKeyRange) {
                getRequest = store.get(range);
            } else if (typeof range === 'object') {
                const keyRange = this.#createKeyRange(range, 'range');
                if (keyRange) getRequest = store.get(keyRange);
                else {
                    const getRequest = store.openCursor();
                    getRequest.onerror = (e) => { reject(e.target.error); };
                    getRequest.onsuccess = (e) => {
                        const cursor = e.target.result;
                        if (cursor) resolve(cursor.value);
                        else resolve();
                    };
                }
            } else {
                throw new TypeError('A single key is not available as range for getFirstItem; please use getItem.');
            }
            
            if (getRequest) {
                getRequest.onerror = (e) => { reject(e.target.error); };
                getRequest.onsuccess = (e) => { resolve(e.target.result); };
            }
        });
    }
    getLastItem(storeName, range) {
        return new Promise((resolve, reject) => {
            this.#throwDatabaseNotOpenError();
            storeName = (storeName).toString();
            this.#throwStoreNotExistError(storeName);
            this.#startTransaction(storeName);
            const store = this.#txs.get(storeName).objectStore(storeName);
            
            let getRequest = null;
            if (range instanceof window.IDBKeyRange) {
                getRequest = store.openCursor(range, 'prev');
            } else if (typeof range === 'object') {
                const keyRange = this.#createKeyRange(range, 'range');
                if (keyRange) getRequest = store.openCursor(keyRange, 'prev');
                else getRequest = store.openCursor(null, 'prev');
            } else {
                throw new TypeError('A single key is not available as range for getLastItem; please use getItem.');
            }
            
            if (getRequest) {
                getRequest.onerror = (e) => { reject(e.target.error); };
                getRequest.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) resolve(cursor.value);
                    else resolve();
                };
            }
        });
    }
    
    async getIterator(storeName, range) {
        this.#throwDatabaseNotOpenError();
        storeName = (storeName).toString();
        this.#throwStoreNotExistError(storeName);
        this.#startTransaction(storeName);
        const store = this.#txs.get(storeName).objectStore(storeName);
        
        if (range instanceof window.IDBKeyRange) 'd(`・ω・´)ｸﾞｯ';
        else if (typeof range === 'object') range = this.#createKeyRange(range, 'range');
        else throw new TypeError('A single key is not available as range for getIterator; please use getItem or getFirstItem.');
        
        return {
            [Symbol.asyncIterator]() {
                let lastPromise = Promise.resolve();
                let cursorRequest = null;
                let prevCursor = null;
                return {
                    next() {
                        const prev = lastPromise;
                        const p = new Promise((outerResolve, outerReject) => {
                            prev.then(() => {
                                return new Promise((resolve, reject) => {
                                    if (!cursorRequest) {
                                        cursorRequest = store.openCursor(range);
                                    } else if (!prevCursor) {
                                        resolve({ done: true });
                                        return;
                                    }
                                    
                                    cursorRequest.onerror = (e) => { reject(e.target.error); };
                                    cursorRequest.onsuccess = (e) => {
                                        const cursor = e.target.result;
                                        prevCursor = cursor;
                                        if (cursor) resolve({ value: cursor.value, done: false });
                                        else resolve({ done: true });
                                    };
                                    
                                    if (prevCursor) prevCursor.continue();
                                });
                            })
                            .then(
                                (response) => { outerResolve(response); },
                                (error) => { outerReject(error); }
                            );
                        });
                        lastPromise = p;
                        return p;
                    }
                };
            }
        };
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
        
        const buttons = [
            { name: 'open', label: 'Open', func: 'openDatabase', args: [ databaseName, 1, objectStoreInfos ] },
            { name: 'close', label: 'Close', func: 'closeDatabase', args: [] },
            { name: 'set', label: 'Set Items', func: 'setItems',
              args: [ objectStoreInfos[1].name,
                      [ { key: 'aaa', value: 998244353 },
                        { key: 'bbb', value: 1000000007 },
                        { key: 'ccc', value: 'Takahashi' },
                        { key: 'ddd', value: 57 } ]
                    ]
            },
            { name: 'get', label: 'Get Item', func: 'getItem', args: [ objectStoreInfos[1].name, 'bbb' ] },
            { name: 'get first', label: 'Get First Item', func: 'getFirstItem', args: [ objectStoreInfos[1].name, { full: true } ] },
            { name: 'get last', label: 'Get Last Item', func: 'getLastItem', args: [ objectStoreInfos[1].name, { full: true } ] },
            { name: 'delete', label: 'Delete Items', func: 'deleteItems', args: [ objectStoreInfos[1].name, { lower: 'aaa', upper: 'ccc', lowerOpen: true, upperOpen: false } ] }
        ]
        
        //テスト用ボタン追加
        
        const style = document.createElement('style');
        style.textContent = `
        .test {
            margin: 10px 0px;
            width: 200px;
            display: flex;
            flex-direction: column;
        }
        .test > button {
            margin: 5px;
        }
        `;
        document.getElementsByTagName('head')[0].appendChild(style);
        
        const div = document.createElement('div');
        div.classList.add('test');
        document.getElementsByTagName('body')[0].appendChild(div);
        
        buttons.forEach((val, idx) => {
            const button = document.createElement('button');
            button.textContent = val.label;
            button.addEventListener('click', (e) => {
                idb[val.func](...val.args)
                .then((response) => {
                    console.log(`${val.name} success`);
                    console.log(response);
                })
                .catch((error) => {
                    console.log(`${val.name} error`);
                    console.error(error);
                });
            });
            div.appendChild(button);
        });
        
        const iterButton = document.createElement('button');
        iterButton.textContent = 'Get Iterator';
        iterButton.addEventListener('click', async (e) => {
            const iterable = await idb.getIterator(objectStoreInfos[1].name, { full: true });
            const iter = iterable[Symbol.asyncIterator]();
            
            console.groupCollapsed('get iterator...');
            const nexts = [];
            for (let i = 0; i < 5; ++i) {
                const n = iter.next();
                n.then((response) => {
                    console.log(`${i + 1}...`);
                    console.log(response);
                });
                nexts.push(n);
            }
            Promise.all(nexts)
            .then((response) => {
                console.groupEnd();
                console.log(`get iterator success`);
                console.log(response);
            })
            .catch((error) => {
                console.groupEnd();
                console.log(`get iterator error`);
                console.error(error);
            });
        });
        div.appendChild(iterButton);
        
        const iterButton2 = document.createElement('button');
        iterButton2.textContent = 'Get Iterator 2';
        iterButton2.addEventListener('click', async (e) => {
            const iterable = await idb.getIterator(objectStoreInfos[1].name, { lower: 'aaa', upper: 'ccc', lowerOpen: true });
            console.groupCollapsed('get iterator 2...');
            for await (const value of iterable) {
                console.log(value);
            }
            console.groupEnd();
            console.log('get iterator 2 success');
        });
        div.appendChild(iterButton2);
        
    } catch (error) {
        console.log('error');
        console.error(error);
    }
})();
