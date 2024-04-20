/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable max-len */
class NullIDBDatabase implements IDBDatabase {
    private errorMessage: string = 'Referenced a database in the null state.';

    get name(): string { throw new ReferenceError(this.errorMessage); }
    get version(): number { throw new ReferenceError(this.errorMessage); }
    get objectStoreNames(): DOMStringList { throw new ReferenceError(this.errorMessage); }

    get onclose(): ((this: IDBDatabase, ev: Event) => void) | null { throw new ReferenceError(this.errorMessage); }
    get onversionchange(): ((this: IDBDatabase, ev: IDBVersionChangeEvent) => void) | null { throw new ReferenceError(this.errorMessage); }
    get onabort(): ((this: IDBDatabase, ev: Event) => void) | null { throw new ReferenceError(this.errorMessage); }
    get onerror(): ((this: IDBDatabase, ev: Event) => void) | null { throw new ReferenceError(this.errorMessage); }

    close(): void { throw new ReferenceError(this.errorMessage); }
    createObjectStore(name: unknown, options?: unknown): IDBObjectStore { throw new ReferenceError(this.errorMessage); }
    deleteObjectStore(name: unknown): void { throw new ReferenceError(this.errorMessage); }
    transaction(storeNames: unknown, mode?: unknown, options?: unknown): IDBTransaction { throw new ReferenceError(this.errorMessage); }

    addEventListener(type: unknown, listener: unknown, options?: unknown): void { throw new ReferenceError(this.errorMessage); }
    removeEventListener(type: unknown, listener: unknown, options?: unknown): void { throw new ReferenceError(this.errorMessage); }
    dispatchEvent(event: unknown): boolean { throw new ReferenceError(this.errorMessage); }
}

export const NULL_IDB_DATABASE = new NullIDBDatabase();
