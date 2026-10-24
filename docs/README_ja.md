# IndexedDBManager

A Promise wrapper for simple IndexedDB operations

シンプルにIndexedDBを扱えるPromiseラッパー

- [各種リンク](#各種リンク)
- [インストール](#インストール)
  - [パッケージマネージャー](#パッケージマネージャー)
  - [CDN](#cdn)
- [使い方](#使い方)
  - [Quick Start](#quick-start)
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

### Quick Start

```js
const db = new IDBManager('MyDB', 1, [{ name: 'MyStore' }]);

async function doSomething() {
    // まずはデータベースを開きましょう!
    await db.openDB();

    // キーが'A'、値が'Apple'のデータを追加します
    await db.put('MyStore', 'Apple', 'A');
    // オブジェクトも値として使えます
    await db.put('MyStore', { name: 'Banana', time: new Date() }, 'B');

    // キーを指定して値を調べます
    let value = await db.get('MyStore', 'B');
    console.log(`${value.name} arrived at ${value.time.toLocaleString()}`);
}

doSomething(); // 出力: Banana arrived at 2026/10/21 23:00:04
```

ほとんどの機能は`Promise`オブジェクトを返すため、`async`/`await`構文や`.then()`/`.catch()`メソッドを利用してデータベースを操作できます。

## API
