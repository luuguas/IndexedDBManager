'use strict';

/**
 * @typedef {object} storesInfoType オブジェクトストアの情報をまとめたオブジェクト
 * @property {string} storeName ストア名
 * @property {string} keyPath データを区別するためのキー名
 */

/**
 * IndexedDBの処理をまとめたクラス
 * @constructor
 * @param {string} databaseName データベース名
 * @param {storesInfoType[]} storesInfo オブジェクトストアの情報
 * @param {number} [version=1] データベースのバージョン
 */
let IndexedDBManager = function (databaseName, storesInfo, version = 1) {
    this.database = null;
    this.loadingError = false;
    this.databaseName = databaseName;
    this.storesInfo = storesInfo;
    this.version = version;
};
IndexedDBManager.prototype = {
    /**
     * データベースを開く非同期関数
     * @param {boolean} [requestDespiteError=true] 以前のリクエストでデータベースの読み込みエラーが発生していた場合にリクエストを送るかどうか
     * @return {Promise<null>}
     */
    openDatabase(requestDespiteError = true) {
        return new Promise((resolve, reject) => {
            if(!requestDespiteError && this.loadingError) {
                reject('Database is not loaded due to error.');
                return;
            }
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
                reject(`Failed to get database. (${event.target.error})`);
            };
            openRequest.onsuccess = (event) => {
                this.database = event.target.result;
                this.loadingError = false;
                resolve(null);
            };
        });
    },
    /**
     * ストアからデータを入手する非同期関数
     * @param {string} storeName ストア名
     * @param {string} key 入手するデータのキー名
     * @return {Promise<?object>} データを返す(該当するデータがなければnullを返す)
     */
    getData(storeName, key) {
        return new Promise(async (resolve, reject) => {
            try {
                await this.openDatabase(false);
            }
            catch (err) {
                reject(err);
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
     * @returns {Promise<object[]>} 条件に一致するデータを要素に持つ配列を返す
     */
    getAllMatchedData(storeName, filter) {
        return new Promise(async (resolve, reject) => {
            try {
                await this.openDatabase(false);
            }
            catch (err) {
                reject(err);
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
     * ストアにデータを追加する非同期関数 既に同じキーを持つデータがあればそれを上書きする
     * @param {string} storeName ストア名
     * @param {object} data 追加するデータ(keyPathで指定したキーのプロパティを持つ)
     * @return {Promise<null>}
     */
    setData(storeName, data) {
        return new Promise(async (resolve, reject) => {
            try {
                await this.openDatabase(false);
            }
            catch (err) {
                reject(err);
                return;
            }
            
            let trans = this.database.transaction(storeName, 'readwrite');
            let getRequest = trans.objectStore(storeName).put(data);
            getRequest.onerror = (event) => {
                reject(`Failed to set data. (${event.target.error})`);
            };
            getRequest.onsuccess = (event) => {
                resolve(null);
            };
        });
    },
    /**
     * ストアからデータを削除する非同期関数
     * @param {string} storeName ストア名
     * @param {string} key 削除するデータのキー名
     * @return {Promise<null>}
     */
    deleteData(storeName, key) {
        return new Promise(async (resolve, reject) => {
            try {
                await this.openDatabase(false);
            }
            catch (err) {
                reject(err);
                return;
            }
            
            let trans = this.database.transaction(storeName, 'readwrite');
            let getRequest = trans.objectStore(storeName).delete(key);
            getRequest.onerror = (event) => {
                reject(`Failed to delete data. (${event.target.error})`);
            };
            getRequest.onsuccess = (event) => {
                resolve(null);
            };
        });
    },
};

///////////////

let myDatabase = new IndexedDBManager('myDatabase', [{storeName: 'myStore', keyPath: 'key'}]);
let asyncTasks = async () => {
    let value = new Date();
    let key = value.getSeconds() % 10;
    try {
        await myDatabase.openDatabase();
        let oldData = await myDatabase.getData('myStore', key);
        await myDatabase.setData('myStore', {key, value});
        let data = await myDatabase.getData('myStore', key);
        console.log(`Succeeded: data = {key: ${data.key}, value: ${data.value.toLocaleString()}}`);
        if(oldData) {
            console.log(`Info: oldData = {key: ${oldData.key}, value: ${oldData.value.toLocaleString()}}`);
        }

        let matchedData = await myDatabase.getAllMatchedData('myStore', (data) => {return (data.value.getMinutes() % 10) >= 5;});
        console.log(matchedData);
    }
    catch (err) {
        console.warn(`Failed: ${err}`);
    }
};

asyncTasks();
