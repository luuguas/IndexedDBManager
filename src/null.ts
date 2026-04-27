type Listener = ((this: IDBDatabase, ev: Event) => unknown) | null;

class NullIDBDatabase implements IDBDatabase {
    // eslint-disable-next-line class-methods-use-this
    protected nullDBError(): ReferenceError {
        return new ReferenceError('Referenced a null database.');
    }

    get name(): string { throw this.nullDBError(); }
    get version(): number { throw this.nullDBError(); }
    get objectStoreNames(): DOMStringList { throw this.nullDBError(); }

    close(): void { throw this.nullDBError(); }
    createObjectStore(name: string, options?: IDBObjectStoreParameters): IDBObjectStore {
        throw this.nullDBError();
    }
    deleteObjectStore(name: string): void { throw this.nullDBError(); }
    transaction(storeNames: unknown, mode?: unknown, options?: unknown): IDBTransaction {
        throw this.nullDBError();
    }

    get onclose(): Listener { throw this.nullDBError(); }
    set onclose(listener: Listener) { throw this.nullDBError(); }
    get onversionchange(): Listener { throw this.nullDBError(); }
    set onversionchange(listener: Listener) { throw this.nullDBError(); }
    get onabort(): Listener { throw this.nullDBError(); }
    set onabort(listener: Listener) { throw this.nullDBError(); }
    get onerror(): Listener { throw this.nullDBError(); }
    set onerror(listener: Listener) { throw this.nullDBError(); }

    addEventListener(type: unknown, listener: unknown, options?: unknown): void {
        throw this.nullDBError();
    }
    removeEventListener(type: unknown, listener: unknown, options?: unknown): void {
        throw this.nullDBError();
    }
    dispatchEvent(event: Event): boolean { throw this.nullDBError(); }
}

export const NULL_IDB_DATABASE = new NullIDBDatabase();
