# IndexedDBManager

A Promise wrapper for simple IndexedDB operations

シンプルにIndexedDBを扱えるPromiseラッパー

- [各種リンク](#各種リンク)
- [インストール](#インストール)
  - [パッケージマネージャー](#パッケージマネージャー)
  - [CDN](#cdn)
- [使い方](#使い方)
  - [IndexedDBとは](#indexeddbとは)
  - [Quick Start](#quick-start)
  - [データベースを開く](#データベースを開く)
  - [データベースの構成](#データベースの構成)
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

### IndexedDBとは

[IndexedDB](https://developer.mozilla.org/ja/docs/Web/API/IndexedDB_API)は、Webブラウザ内に大量の構造化データを保存できるAPIです。
[localStorage](https://developer.mozilla.org/ja/docs/Web/API/Window/localStorage)と機能は似ていますが、localStorageよりも大容量で、文字列だけでなく数値やオブジェクトなども保存できます。

IndexedDBでは、1つのデータベースが複数のオブジェクトストア(テーブル)を持ち、各オブジェクトストアにはデータがキーと値のペアとして保存されます。

本パッケージでは、`IDBManager`クラスを利用することで、簡潔なコードでIndexedDBデータベースを操作できます。

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

### データベースを開く

データベースでどのような操作をするにも、まずはデータベースを開く必要があります。

```js
const db = new IDBManager(dbName, dbVersion, storeInfos);
await db.openDB();
```

1. データベースの構成 (データベース名、バージョン、オブジェクトストアの設定) を引数として渡し、`IDBManager`のインスタンスを作成します。
2. `db.openDB()`でデータベースを開きます。このとき、
   1. 同名のデータベースが無い場合は、新しいデータベースが作られます。
   2. 同名でより古いバージョンのデータベースが存在する場合は、データベースの構成を更新してバージョンアップします。

### データベースの構成

データベースを作成または更新する際に、データベースの構成を設定することができます。

```js
// データベース名
const dbName = 'MyDB';
// バージョン
const dbVersion = 1;
// 各オブジェクトストアの設定
const storeInfos = [
    {
        name: 'MyStore1',
        keyPath: 'item',
        autoIncrement: true,
    },
    {
        name: 'MyStore2',
        resetOnUpgrade: 'all',
    },
    ...
];

const db = new IDBManager(dbName, dbVersion, storeInfos);
```

データベース名は文字列、バージョンは1以上の整数を指定します。

オブジェクトストアの設定では、オブジェクトストア名、キーの供給方法、更新時のリセット、インデックスを指定します。
(インデックスの詳細は[インデックスの使用](#インデックスの使用)で後述)

#### キーの供給方法

データを識別するためのキーの供給方法には2種類のオプションがあります。

- 内部キー(`keyPath`): このオプションを有効にすると、保存できるデータの値はオブジェクトのみになり、`keyPath`に指定した文字列と同じ名称のプロパティをキーとして利用します。データを追加・更新する際に、値とは別にキーを供給しようとするとエラーが発生します。
- キージェネレーター(`autoIncrement`): このオプションを`true`にすると、キーを省略したデータを追加する際に、自動でキーに連番で整数が割り当てられます。

#### 更新時のリセット

`resetOnUpgrade`オプションを有効にすると、データベースのバージョンを上げる際にオブジェクトストアの構成を再設定できます。

- `'all'`: キーの供給方法およびインデックスを再設定します。オブジェクトストア内のデータはすべて削除されます。
- `'index'`: インデックスのみを再設定します。オブジェクトストア内のデータは保持されます。
- `'none'`: 再設定は行いません。(`resetOnUpgrade`オプションを指定しない場合と同じ)

## API
