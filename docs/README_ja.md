# IndexedDBManager

A Promise wrapper for simple IndexedDB handling

IndexedDB をシンプルに扱える Promise ラッパー

- [各種リンク](#各種リンク)
- [インストール](#インストール)
  - [パッケージマネージャー](#パッケージマネージャー)
  - [CDN](#cdn)
- [使い方](#使い方)
- [API](#api)

## 各種リンク

- IndexedDB について: [IndexedDB API - Web APIs | MDN](https://developer.mozilla.org/ja/docs/Web/API/IndexedDB_API)
- API リファレンス: 
- README (English ver.): [README.md](../README.md)
- API Reference (English ver.): 

## インストール

### パッケージマネージャー

#### npm

```sh
npm i @luuguas/idbmanager
```

#### Yarn

```sh
yarn add @luuguas/idbmanager
```

#### コード内でインポート

```js
import { IDBManager } from '@luuguas/idbmanager'

const db = new IDBManager(...);
```

### CDN

#### 外部ファイル参照

```html
<script src="https://cdn.jsdelivr.net/npm/@luuguas/idbmanager@[version]/[file].min.js"></script>
<script>
    const db = new IDBManager(...);
</script>
```

#### jsDelivr 経由で直接インポート

```html
<script type="module">
    import { IDBManager } from 'https://cdn.jsdelivr.net/npm/@luuguas/idbmanager@[version]/+esm'

    const db = new IDBManager(...);
</script>
```

## 使い方

## API
