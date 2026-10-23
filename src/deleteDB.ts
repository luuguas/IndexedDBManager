export function deleteDB(dbName: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const deleteReq = window.indexedDB.deleteDatabase(dbName);
        deleteReq.onblocked = () => {
            // eslint-disable-next-line no-console
            console.warn(`Warning from IndexedDBManager: The request to delete the database "${dbName}" will be pending until all connections to the database are closed.`);
        };
        deleteReq.onerror = () => reject(deleteReq.error);
        deleteReq.onsuccess = () => resolve();
    });
}
