# IndexedDBManager

A Promise wrapper for simple IndexedDB handling

IndexedDB をシンプルに扱える Promise ラッパー

- [Links](#links)
- [Installation](#installation)
  - [Package manager](#package-manager)
  - [CDN](#cdn)
- [Usage](#usage)
- [API](#api)

## Links

- About IndexedDB: [IndexedDB API - Web APIs | MDN](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- API Reference: 
- 日本語版 README: [README_ja.md](docs/README_ja.md)
- 日本語版 API リファレンス: 

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
<script src="https://cdn.jsdelivr.net/npm/@luuguas/idbmanager@[version]/[file].min.js"></script>
<script>
    const db = new IDBManager(...);
</script>
```

#### Import modules directly via jsDelivr

```html
<script type="module">
    import { IDBManager } from 'https://cdn.jsdelivr.net/npm/@luuguas/idbmanager@[version]/+esm'

    const db = new IDBManager(...);
</script>
```

## Usage

## API
