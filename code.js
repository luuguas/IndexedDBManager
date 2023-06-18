'use strict';

/**
 * IndexedDBの処理をまとめたクラス
 * @constructor
 * @param {string} databaseName データベース名
 */
let IndexedDBManager = function (databaseName) {
    this.database = null;
    this.databaseName = databaseName;
};
IndexedDBManager.prototype = {
    /**
     * @typedef {object} storeInfosType オブジェクトストアの情報をまとめたオブジェクト
     * @property {string} storeName ストア名
     * @property {string} keyPath データを区別するためのキー名
     */
    /**
     * データベースを開く非同期関数
     * データベースが新規作成もしくはバージョンが更新された場合のみ、追加でストアの作成・削除をおこなう
     * データベースに存在せずstoreInfosに含まれるストアを作成し、データベースに存在してstoreInfosに含まれないストアを削除する
     * @param {storeInfosType[]} storeInfos オブジェクトストアの情報
     * @param {version} データベースのバージョン
     * @return {Promise<null>}
     */
    openDatabase(storeInfos, version) {
        return new Promise((resolve, reject) => {
            if (this.database !== null) {
                resolve(null);
                return;
            }
            if (typeof window.indexedDB === 'undefined') {
                reject('IndexedDB is not supported.');
                return;
            }

            let openRequest = indexedDB.open(this.databaseName, version);
            openRequest.onupgradeneeded = (event) => {
                let database = event.target.result;
                let m = new Map();
                for(let name of database.objectStoreNames) {
                    m.set(name, {status: 1, keyPath: null});
                }
                for(let info of storeInfos) {
                    if(m.get(info.storeName)) {
                        m.set(info.storeName, {status: 2, keyPath: info.keyPath});
                    }
                    else {
                        m.set(info.storeName, {status: 0, keyPath: info.keyPath});
                    }
                }
                for(let [name, info] of m) {
                    if(info.status === 0) {
                        database.createObjectStore(name, {keyPath: info.keyPath});
                    }
                    else if(info.status === 1) {
                        database.deleteObjectStore(name);
                    }
                }
                console.info('Database was created or upgraded.');
            };
            openRequest.onerror = (event) => {
                this.database = null;
                reject(`Failed to get database. (${event.target.error})`);
            };
            openRequest.onsuccess = (event) => {
                this.database = event.target.result;
                resolve(null);
            };
        });
    },
    /**
     * データベースが開かれているかを返す関数
     * @return {boolean} データベースが開かれているならtrue、そうでないならfalseを返す
     */
    isOpened() {
        return this.database !== null;
    },
    /**
     * ストアからデータを入手する非同期関数
     * @param {string} storeName ストア名
     * @param {string} key 入手するデータのキー
     * @return {Promise<?object>} オブジェクト型のデータを返す 該当するデータがなければnullを返す
     */
    getData(storeName, key) {
        return new Promise((resolve, reject) => {
            if(!this.isOpened()) {
                reject('Database is not loaded.');
                return;
            }
            
            let trans = this.database.transaction(storeName, 'readonly');
            let getRequest = trans.objectStore(storeName).get(key);
            getRequest.onerror = (event) => {
                reject(`Failed to get data. (${event.target.error})`);
            };
            getRequest.onsuccess = (event) => {
                if(event.target.result) {
                    resolve(event.target.result);
                }
                else {
                    resolve(null);
                }
            };
        });
    },
    /**
     * ストアから条件に一致するデータ全てを入手する非同期関数
     * @param {string} storeName ストア名
     * @param {(data: object) => boolean} filter 引数に与えられたデータが条件に一致する場合にtrueを返すコールバック関数
     * @return {Promise<object[]>} 条件に一致するデータを要素に持つ配列を返す
     */
    getAllMatchedData(storeName, filter) {
        return new Promise((resolve, reject) => {
            if(!this.isOpened()) {
                reject('Database is not loaded.');
                return;
            }
            
            let trans = this.database.transaction(storeName, 'readonly');
            let cursorRequest = trans.objectStore(storeName).openCursor();
            let res = [];
            cursorRequest.onerror = (event) => {
                reject(`Failed to get cursor. (${event.target.error})`);
            };
            cursorRequest.onsuccess = (event) => {
                let cursor = event.target.result;
                if(cursor) {
                    if(filter(cursor.value)) {
                        res.push(cursor.value);
                    }
                    cursor.continue();
                }
                else {
                    resolve(res);
                }
            };
        });
    },
    /**
     * ストア内のデータの個数を返す非同期関数
     * @param {string} storeName ストア名
     * @return {Promise<number>} データの個数を返す
     */
    countData(storeName) {
        return new Promise((resolve, reject) => {
            if(!this.isOpened()) {
                reject('Database is not loaded.');
                return;
            }
            
            let trans = this.database.transaction(storeName, 'readonly');
            let countRequest = trans.objectStore(storeName).count();
            countRequest.onerror = (event) => {
                reject(`Failed to count data. (${event.target.error})`);
            };
            countRequest.onsuccess = (event) => {
                resolve(event.target.result);
            };
        });
    },
    /**
     * ストアにデータを追加する非同期関数 既に同じキーを持つデータがあれば上書きする
     * @param {string} storeName ストア名
     * @param {object} data 追加するデータ keyPathで指定したキーのプロパティを持つ
     * @return {Promise<null>}
     */
    setData(storeName, data) {
        return new Promise((resolve, reject) => {
            if(!this.isOpened()) {
                reject('Database is not loaded.');
                return;
            }
            
            let trans = this.database.transaction(storeName, 'readwrite');
            let setRequest = trans.objectStore(storeName).put(data);
            setRequest.onerror = (event) => {
                reject(`Failed to set data. (${event.target.error})`);
            };
            setRequest.onsuccess = (event) => {
                resolve(null);
            };
        });
    },
    /**
     * ストアからデータを削除する非同期関数
     * @param {string} storeName ストア名
     * @param {string} key 削除するデータのキー
     * @return {Promise<null>}
     */
    deleteData(storeName, key) {
        return new Promise((resolve, reject) => {
            if(!this.isOpened()) {
                reject('Database is not loaded.');
                return;
            }
            
            let trans = this.database.transaction(storeName, 'readwrite');
            let deleteRequest = trans.objectStore(storeName).delete(key);
            deleteRequest.onerror = (event) => {
                reject(`Failed to delete data. (${event.target.error})`);
            };
            deleteRequest.onsuccess = (event) => {
                resolve(null);
            };
        });
    },
    /**
     * ストアから全てのデータを削除する非同期関数
     * @param {string} storeName ストア名
     * @return {Promise<null>}
     */
    deleteAllData(storeName) {
        return new Promise((resolve, reject) => {
            if(!this.isOpened()) {
                reject('Database is not loaded.');
                return;
            }
            
            let trans = this.database.transaction(storeName, 'readwrite');
            let deleteRequest = trans.objectStore(storeName).clear();
            deleteRequest.onerror = (event) => {
                reject(`Failed to delete all data. (${event.target.error})`);
            };
            deleteRequest.onsuccess = (event) => {
                resolve(null);
            };
        });
    },
};

/**
 * データベースを削除する非同期関数
 * @param {string} データベース名
 * @return {Promise<null>}
 */
function deleteDatabase(databaseName) {
    return new Promise((resolve, reject) => {
        let deleteRequest = indexedDB.deleteDatabase(databaseName);
        deleteRequest.onerror = (event) => {
            reject(`Failed to delete database. (${event.target.error})`);
        };
        deleteRequest.onsuccess = (event) => {
            console.info('Database was deleted.');
            resolve(null);
        };
    });
}
