export function deleteDB(dbName: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const deleteReq = window.indexedDB.deleteDatabase(dbName);
        deleteReq.onblocked = () => reject(new ReferenceError('Failed to delete the database because it is currently open in another instance.'));
        deleteReq.onerror = () => reject(deleteReq.error);
        deleteReq.onsuccess = () => resolve();
    });
}
