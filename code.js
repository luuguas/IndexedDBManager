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
    openDB: function () {
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
};

///////////////

let myDatabase = new IndexedDBManager('myDatabase', [{storeName: 'myStore', keyPath: 'key'}]);
myDatabase.openDB()
.then(() => {
    console.log('Succeeded!');
})
.catch((err) => {
    console.warn('Failed... (Error: ' + err + ')');
});
