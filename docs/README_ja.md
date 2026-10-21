# IndexedDBManager

A Promise wrapper for simple IndexedDB operations

シンプルにIndexedDBを扱えるPromiseラッパー

- [各種リンク](#各種リンク)
- [インストール](#インストール)
  - [パッケージマネージャー](#パッケージマネージャー)
  - [CDN](#cdn)
- [使い方](#使い方)
- [API](#api)

## 各種リンク

- IndexedDBについて: [IndexedDB API - Web APIs | MDN](https://developer.mozilla.org/ja/docs/Web/API/IndexedDB_API)
- APIリファレンス: 
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

#### 外部スクリプト参照

```html
<script src="https://cdn.jsdelivr.net/npm/@luuguas/idbmanager@2.0.0/dist/umd.min.js"></script>
<script>
    const db = new idbmanager.IDBManager(...);
</script>
```

グローバル変数`idbmanager`を経由して各モジュールを利用できます。

#### jsDelivr経由で直接インポート

```html
<script type="module">
    import { IDBManager } from 'https://cdn.jsdelivr.net/npm/@luuguas/idbmanager@2.0.0/+esm'

    const db = new IDBManager(...);
</script>
```

## 使い方

## API
