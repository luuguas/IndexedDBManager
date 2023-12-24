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
    #storeUpdateType = Object.freeze({ 'remain': 0, 'new': 1, 'delete': 2, 'recreate': 3 });
    #storeOptions = Object.freeze([ 'keyPath', 'autoIncrement' ]);
    #indexOptions = Object.freeze([ 'unique', 'multiEntry', 'locale' ]);
    
    constructor() { this.#db = null; }
    
    //*は省略可
    //objectStoreInfos = [ storeInfo1, storeInfo2, ... ]
    //storeInfo = { name, *keyPath, *autoIncrement, *indexInfos }
    //indexInfos = [ indexInfo1, indexInfo2, ... ]
    //indexInfo = { name, keyPath, *unique, *multiEntry }
    openDatabase(databaseName, version, objectStoreInfos) {
        return new Promise((resolve, reject) => {
            const openRequest = window.indexedDB.open(databaseName, version);
            let upgraded = false;
            
            openRequest.onblocked = (e) => { reject(e.target.error); };
            openRequest.onerror = (e) => { reject(e.target.error); };
            openRequest.onsuccess = (e) => {
                this.db = e.target.result;
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
                        if (storeInfo.recreate) {
                            m.set(storeInfo.name, { type: this.#storeUpdateType['recreate'], options, indexInfos: storeInfo.indexInfos });
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
                        case this.#storeUpdateType['recreate']:
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
}

(function() {
    const idb = new IDBManager();
    const objectStoreInfos = [
        { name: 'ObjectStore1' },
        { name: 'ObjectStore2', keyPath: 'key' },
        { name: 'ObjectStore3', autoIncrement: true },
        { name: 'ObjectStore4', keyPath: 'hoge', autoIncrement: true },
        { name: 'ObjectStore5', recreate: true, keyPath: 'name', indexInfos: [ { name: 'by_age', keyPath: 'age' }, { name: 'by_email', keyPath: 'email', unique: true } ] },
    ];
    
    idb.openDatabase('MyDatabase', 1, objectStoreInfos)
        .then((response) => {
            console.log('success');
            console.log(response);
        })
        .catch((error) => {
            console.log('error');
            console.error(error);
        });
})();
