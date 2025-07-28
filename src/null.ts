type Listener = ((this: IDBDatabase, ev: Event) => unknown) | null;

class NullIDBDatabase implements IDBDatabase {
    private errorMessage: string = 'Referenced a null database.';

    get name(): string { throw new ReferenceError(this.errorMessage); }
    get version(): number { throw new ReferenceError(this.errorMessage); }
    get objectStoreNames(): DOMStringList { throw new ReferenceError(this.errorMessage); }

    close(): void { throw new ReferenceError(this.errorMessage); }
    createObjectStore(name: string, options?: IDBObjectStoreParameters): IDBObjectStore {
        throw new ReferenceError(this.errorMessage);
    }
    deleteObjectStore(name: string): void { throw new ReferenceError(this.errorMessage); }
    transaction(storeNames: unknown, mode?: unknown, options?: unknown): IDBTransaction {
        throw new ReferenceError(this.errorMessage);
    }

    get onclose(): Listener { throw new ReferenceError(this.errorMessage); }
    set onclose(listener: Listener) { throw new ReferenceError(this.errorMessage); }
    get onversionchange(): Listener { throw new ReferenceError(this.errorMessage); }
    set onversionchange(listener: Listener) { throw new ReferenceError(this.errorMessage); }
    get onabort(): Listener { throw new ReferenceError(this.errorMessage); }
    set onabort(listener: Listener) { throw new ReferenceError(this.errorMessage); }
    get onerror(): Listener { throw new ReferenceError(this.errorMessage); }
    set onerror(listener: Listener) { throw new ReferenceError(this.errorMessage); }

    addEventListener(type: unknown, listener: unknown, options?: unknown): void {
        throw new ReferenceError(this.errorMessage);
    }
    removeEventListener(type: unknown, listener: unknown, options?: unknown): void {
        throw new ReferenceError(this.errorMessage);
    }
    dispatchEvent(event: Event): boolean { throw new ReferenceError(this.errorMessage); }
}

export const NULL_IDB_DATABASE = new NullIDBDatabase();
