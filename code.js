'use strict';

/**
 * @typedef {object} storesInfoType storesInfoの各要素の型
 * @property {string} storeName ストア名
 * @property {string} keyPath データを区別するためのキー名
 */

/**
 * @constructor
 * @classdesc IndexedDBの処理をまとめたクラス
 * @param {string} databaseName データベース名
 * @param {storesInfoType[]} storesInfo オブジェクトストアの情報
 * @param {number} version データベースのバージョン(引数を省略した場合は1)
 */
let IndexedDBManager = function (databaseName, storesInfo, version = 1) {
    this.database = null;
    this.loadingError = false;
    this.databaseName = databaseName;
    this.storesInfo = storesInfo;
    this.version = version;
};
IndexedDBManager.prototype = {
    openDatabase: function () {
        return new Promise((resolve, reject) => {
            if (this.database !== null) {
                resolve(null);
                return;
            }
            if (typeof window.indexedDB === 'undefined') {
                this.loadingError = true;
                reject('IndexedDB is not supported.');
                return;
            }

            let openRequest = indexedDB.open(this.databaseName, this.version);
            openRequest.onupgradeneeded = (event) => {
                for (let obj of this.storesInfo) {
                    event.target.result.createObjectStore(obj.storeName, {keyPath: obj.keyPath});
                }
                console.info('Database was created.');
            };
            openRequest.onerror = (event) => {
                this.loadingError = true;
                reject('Failed to get database.');
            };
            openRequest.onsuccess = (event) => {
                this.database = event.target.result;
                this.loadingError = false;
                resolve(null);
            };
        });
    },
    getValue: function (storeName, key) {
        return new Promise(async (resolve, reject) => {
            if(this.loadingError){
                reject('Failed to get database.');
                return;
            }
            if(this.database === null){
                try {
                    await this.openDatabase();
                }
                catch (err) {
                    reject(err);
                    return;
                }
            }
            
            let trans = this.database.transaction(storeName, 'readonly');
            let store = trans.objectStore(storeName);
            let getRequest = store.get(key);
            getRequest.onerror = (event) => {
                reject('Failed to get value.');
            };
            getRequest.onsuccess = (event) => {
                resolve(event.target.result);
            };
        });
    },
};

///////////////

let myDatabase = new IndexedDBManager('myDatabase', [{storeName: 'myStore', keyPath: 'key'}]);
let asyncTasks = async () => {
    try {
        await myDatabase.openDatabase();
        let res = await myDatabase.getValue('myStore', 'key1');
        console.log('Succeeded: ' + res);
    }
    catch (err) {
        console.warn('Failed: ' + err);
    }
};

asyncTasks();
