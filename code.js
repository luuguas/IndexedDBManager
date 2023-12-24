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
    #outputWarning;
        
    #storeUpdateType = Object.freeze({ 'remain': 0, 'new': 1, 'delete': 2, 'recreate': 3 });
    #storeOptions = Object.freeze([ 'keyPath', 'autoIncrement' ]);
    #indexOptions = Object.freeze([ 'unique', 'multiEntry', 'locale' ]);
    
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
    
    constructor(outputWarning = false) {
        this.#db = null;
        this.#outputWarning = outputWarning;
    }
    
    get outputWarning() { return this.#outputWarning; }
    set outputWarning(bool) { if (typeof bool === 'boolean') this.#outputWarning = bool; }
    get databaseName() { return this.#db ? this.#db.name : null; }
    
    //*は省略可
    //objectStoreInfos = [ storeInfo1, storeInfo2, ... ]
    //storeInfo = { name, *keyPath, *autoIncrement, *indexInfos }
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
}

(async function() {
    try {
        const databaseName = 'MyDatabase';
        const objectStoreInfos = [
            { name: 'ObjectStore1' },
            { name: 'ObjectStore2', keyPath: 'key' },
            { name: 'ObjectStore3', autoIncrement: true },
            { name: 'ObjectStore4', keyPath: 'hoge', autoIncrement: true },
            { name: 'ObjectStore5', recreate: true, keyPath: 'name', indexInfos: [ { name: 'by_age', keyPath: 'age' }, { name: 'by_email', keyPath: 'email', unique: true } ] },
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
        
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.addEventListener('click', (e) => {
            idb.closeDatabase()
                .then((response) => {
                    console.log('close success');
                    console.log(response);
                })
                .catch((error) => {
                    console.log('close error');
                    console.error(error);
                });
        });
        
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', (e) => {
            IDBManager.deleteDatabase(databaseName, true)
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
        document.getElementsByTagName('body')[0].appendChild(closeButton);
        document.getElementsByTagName('body')[0].appendChild(deleteButton);
        
    } catch (error) {
        console.log('error');
        console.error(error);
    }
})();
