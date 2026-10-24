# IndexedDBManager

A Promise wrapper for simple IndexedDB operations

シンプルにIndexedDBを扱えるPromiseラッパー

- [Links](#links)
- [Installation](#installation)
  - [Package manager](#package-manager)
  - [CDN](#cdn)
- [Usage](#usage)
  - [Quick Start](#quick-start)
- [API](#api)

## Links

- About IndexedDB: [IndexedDB API - Web APIs | MDN](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- API Reference: 
- 日本語版 README: [README_ja.md](docs/README_ja.md)
- 日本語版 APIリファレンス: 

## Installation

### Package manager

#### npm

```sh
npm i @luuguas/idbmanager
```

#### Yarn

```sh
yarn add @luuguas/idbmanager
```

#### Import modules in code

```js
import { IDBManager } from '@luuguas/idbmanager'

const db = new IDBManager(...);
```

### CDN

#### External script reference

```html
<script src="https://cdn.jsdelivr.net/npm/@luuguas/idbmanager@2.0.0/dist/umd.min.js"></script>
<script>
    const db = new idbmanager.IDBManager(...);
</script>
```

You can access each module via the global variable `idbmanager`.

#### Import modules directly via jsDelivr

```html
<script type="module">
    import { IDBManager } from 'https://cdn.jsdelivr.net/npm/@luuguas/idbmanager@2.0.0/+esm'

    const db = new IDBManager(...);
</script>
```

## Usage

### Quick Start

```js
const db = new IDBManager('MyDB', 1, [{ name: 'MyStore' }]);

async function doSomething() {
    // First, open the database!
    await db.openDB();

    // Add data with key 'A' and value 'Apple'
    await db.put('MyStore', 'Apple', 'A');
    // Object can also be used as value
    await db.put('MyStore', { name: 'Banana', time: new Date() }, 'B');

    // Look up the value by key
    let value = await db.get('MyStore', 'B');
    console.log(`${value.name} arrived at ${value.time.toLocaleString()}`);
}

doSomething(); // Console: Banana arrived at 2026/10/21 23:00:04
```

Since most functions return a `Promise` object, you can interact with the database using the `async`/`await` syntax or the `.then()`/`.catch()` methods.

## API
