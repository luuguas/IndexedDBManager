let IDBManager = function (databaseName) { this.database = null; this.databaseName = databaseName; };
IDBManager.prototype = {
    openDatabase(storeInfos, version) {
        return new Promise((resolve, reject) => {
            if (this.database !== null) { resolve(null); return; }
            if (typeof window.indexedDB === 'undefined') { reject('IndexedDB is not supported.'); return; }
            let openRequest = indexedDB.open(this.databaseName, version);
            openRequest.onupgradeneeded = (event) => {
                let database = event.target.result;
                let m = new Map();
                for (let name of database.objectStoreNames) m.set(name, { status: 1, keyPath: null });
                for (let info of storeInfos) {
                    if (m.get(info.storeName)) m.set(info.storeName, { status: 2, keyPath: info.keyPath });
                    else m.set(info.storeName, { status: 0, keyPath: info.keyPath });
                }
                for (let [name, info] of m) {
                    if (info.status === 0) database.createObjectStore(name, { keyPath: info.keyPath });
                    else if (info.status === 1) database.deleteObjectStore(name);
                }
                console.info('Database was created or upgraded.');
            };
            openRequest.onerror = (event) => { this.database = null; reject(`Failed to get database. (${event.target.error})`); };
            openRequest.onsuccess = (event) => { this.database = event.target.result; resolve(null); };
        });
    },
    isOpened() { return this.database !== null; },
    getData(storeName, key) {
        return new Promise((resolve, reject) => {
            if (!this.isOpened()) { reject('Database is not loaded.'); return; }
            let trans = this.database.transaction(storeName, 'readonly');
            let getRequest = trans.objectStore(storeName).get(key);
            getRequest.onerror = (event) => { reject(`Failed to get data. (${event.target.error})`); };
            getRequest.onsuccess = (event) => {
                if (event.target.result) resolve(event.target.result);
                else resolve(null);
            };
        });
    },
    getAllMatchedData(storeName, filter) {
        return new Promise((resolve, reject) => {
            if (!this.isOpened()) { reject('Database is not loaded.'); return; }
            let trans = this.database.transaction(storeName, 'readonly');
            let cursorRequest = trans.objectStore(storeName).openCursor();
            let res = [];
            cursorRequest.onerror = (event) => { reject(`Failed to get cursor. (${event.target.error})`); };
            cursorRequest.onsuccess = (event) => {
                let cursor = event.target.result;
                if (cursor) {
                    if (filter(cursor.value)) res.push(cursor.value);
                    cursor.continue();
                }
                else resolve(res);
            };
        });
    },
    countData(storeName) {
        return new Promise((resolve, reject) => {
            if (!this.isOpened()) { reject('Database is not loaded.'); return; }
            let trans = this.database.transaction(storeName, 'readonly');
            let countRequest = trans.objectStore(storeName).count();
            countRequest.onerror = (event) => { reject(`Failed to count data. (${event.target.error})`); };
            countRequest.onsuccess = (event) => { resolve(event.target.result); };
        });
    },
    setData(storeName, data) {
        return new Promise((resolve, reject) => {
            if (!this.isOpened()) { reject('Database is not loaded.'); return; }
            let trans = this.database.transaction(storeName, 'readwrite');
            let setRequest = trans.objectStore(storeName).put(data);
            setRequest.onerror = (event) => { reject(`Failed to set data. (${event.target.error})`); };
            setRequest.onsuccess = (event) => { resolve(null); };
        });
    },
    deleteData(storeName, key) {
        return new Promise((resolve, reject) => {
            if (!this.isOpened()) { reject('Database is not loaded.'); return; }
            let trans = this.database.transaction(storeName, 'readwrite');
            let deleteRequest = trans.objectStore(storeName).delete(key);
            deleteRequest.onerror = (event) => { reject(`Failed to delete data. (${event.target.error})`); };
            deleteRequest.onsuccess = (event) => { resolve(null); };
        });
    },
    deleteAllData(storeName) {
        return new Promise((resolve, reject) => {
            if (!this.isOpened()) { reject('Database is not loaded.'); return; }
            let trans = this.database.transaction(storeName, 'readwrite');
            let deleteRequest = trans.objectStore(storeName).clear();
            deleteRequest.onerror = (event) => { reject(`Failed to delete all data. (${event.target.error})`); };
            deleteRequest.onsuccess = (event) => { resolve(null); };
        });
    },
};

function deleteDatabase(databaseName) {
    return new Promise((resolve, reject) => {
        let deleteRequest = indexedDB.deleteDatabase(databaseName);
        deleteRequest.onerror = (event) => { reject(`Failed to delete database. (${event.target.error})`); };
        deleteRequest.onsuccess = (event) => { console.info('Database was deleted.'); resolve(null); };
    });
}
