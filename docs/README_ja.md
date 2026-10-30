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
  - [データの追加・更新](#データの追加更新)
  - [データの削除](#データの削除)
  - [キーの範囲の指定方法](#キーの範囲の指定方法)
  - [データの検索](#データの検索)
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

    // キーを指定して値を検索します
    let value = await db.get('MyStore', 'B');
    console.log(`${value.name} arrived at ${value.time.toLocaleString()}`);
}

doSomething(); // ログ: Banana arrived at 2026/10/21 23:00:04
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
await db.open();
```

データベース名は文字列、バージョンは1以上の整数を指定します。

オブジェクトストアの設定では、オブジェクトストア名、キーの供給方法、更新時のリセット、インデックスを指定します。
(インデックスについては[インデックスの使用](#インデックスの使用)で詳述)

#### キーの供給方法

データを識別するためのキーの供給方法には2種類のオプションがあります。

- 内部キー(`keyPath`): このオプションを有効にすると、保存できるデータの値はオブジェクトのみになり、`keyPath`に指定した文字列と同じ名称のプロパティをキーとして利用します。データを追加・更新する際に、値とは別にキーを供給しようとするとエラーが発生します。
- キージェネレーター(`autoIncrement`): このオプションを`true`にすると、キーを省略したデータを追加する際に、自動的にキーとして連番の整数が割り当てられます。

#### 更新時のリセット

`resetOnUpgrade`オプションを有効にすると、データベースのバージョンを上げる際にオブジェクトストアの構成を再設定できます。

- `'all'`: キーの供給方法およびインデックスを再設定します。オブジェクトストア内のデータはすべて削除されます。
- `'index'`: インデックスのみを再設定します。オブジェクトストア内のデータは保持されます。
- `'none'`: 再設定は行いません。(`resetOnUpgrade`オプションを指定しない場合と同じ)

### データの追加・更新

データベースを作成したら、早速オブジェクトストアにデータを追加しましょう。

データを追加するには`add`メソッドを使います。

```js
await db.add(storeName, value, key);
// 内部キーまたはキージェネレーターを使う場合
await db.add(storeName, value);
```

引数には追加先のオブジェクトストア名、値、キーを順に渡します。
内部キーまたはキージェネレーターを使う場合は、第3引数は不要です。

オブジェクトストア内に同一のキーを持つデータが存在する場合は、データの追加に失敗して例外を投げます。

データを追加する他の方法として、`put`メソッドも存在します。

```js
await db.put(storeName, value, key);
// 内部キーまたはキージェネレーターを使う場合
await db.put(storeName, value);
```

機能は`add`メソッドとほぼ同じですが、オブジェクトストア内に同ーのキーを持つデータが存在する場合、`add`メソッドと異なり`put`メソッドはそのデータを新しい値で更新します。

#### 複数のデータの追加・更新

複数のデータをまとめて追加・更新するには、`addMany`, `putMany`メソッドを使います。

```js
await db.addMany(storeName, values, keys);
await db.putMany(storeName, values, keys);
// 内部キーまたはキージェネレーターを使う場合
await db.addMany(storeName, values);
await db.putMany(storeName, values);
```

`values`, `keys`には値の配列、キーの配列をそれぞれ指定します。
`values[0]`と`keys[0]`のペア、`values[1]`と`keys[1]`のペア、… が各データとして扱われます。

例:

```js
const values = ['Apple', 'Banana', 'Chocolate'];
const keys = ['A', 'B', 'C'];
await db.addMany('MyStore', values, keys);
```

### データの削除

オブジェクトストア内に存在するデータを削除するには`delete`メソッドを使います。

```js
await db.delete(storeName, key);
```

指定されたキーに一致するデータがオブジェクトストア内に存在する場合は、そのデータを削除します。
(一致するデータが存在しない場合は、何も行わず例外も投げません)

#### 複数のデータの削除

複数のデータを削除するには`deleteMany`メソッドを使います。
また、オブジェクトストア内の全データを削除するには`clear`メソッドを使います。

```js
// キーの配列
await db.deleteMany(storeName, keys);
// キーの範囲
await db.deleteMany(storeName, keyRange);
// 全データの削除
await db.clear(storeName);
```

`deleteMany`メソッドでは、削除したいデータのキーを2種類の方法で指定できます。

- キーの配列: 削除したいデータを個別に指定します。
- キーの範囲: その範囲に含まれる全てのデータを指定します。([キーの範囲の指定方法](#キーの範囲の指定方法)を参照)

例:

```js
// キーの配列
await db.deleteMany('MyStore', ['B', 'C']);
// キーの範囲 ('B'以上'Q'以下)
await db.deleteMany('MyStore', { lower: 'B', upper: 'Q' });
```
### キーの範囲の指定方法

`deleteMany`メソッドおよびデータを検索する一部のメソッドでは、操作対象のデータをキーの範囲で指定できます。

キーの範囲の指定には、以下のプロパティを持つオブジェクトを使います。

- `lower`: キーの範囲の下限です。
- `lowerOpen`: `true`の場合、`lower`の値はキーの範囲に含まれません。
- `upper`: キーの範囲の上限です。
- `upperOpen`: `true`の場合、`upper`の値はキーの範囲に含まれません。

|範囲|プロパティ|
|:--|:--|
|x ≦ key|`{ lower: x }`|
|x ＜ key|`{ lower: x, lowerOpen: true }`|
|x ≧ key|`{ upper: x }`|
|x ＞ key|`{ upper: x, upperOpen: true }`|
|x ≦ key ≦ y|`{ lower: x, upper: y }`|
|x ＜ key ≦ y|`{ lower: x, upper: y, lowerOpen: true }`|
|x ≦ key ＜ y|`{ lower: x, upper: y, upperOpen: true }`|
|x ＜ key ＜ y|`{ lower: x, upper: y, lowerOpen: true, upperOpen: true }`|
|全範囲|`{}` または 引数の省略|

### データの検索

オブジェクトストアにデータを追加した後は、様々な方法でデータを検索できます。

#### 1件のデータの取得

`get`メソッドは引数として渡されたキーに一致するデータを検索し、データが存在すればその値を返します。
一致するデータが存在しない場合は`undefined`を返します。

```js
const value = await db.get(storeName, key);
```

`getFirst`, `getLast`メソッドは、キーの範囲に含まれるデータのうち最小・最大のキーを持つデータの値をそれぞれ返します。

```js
const value1 = await db.getFirst(storeName, keyRange);
const value2 = await db.getLast(storeName, keyRange);
```

#### 複数のデータの取得

キーの配列またはキーの範囲で指定した全てのデータの値を配列で取得するには、`getMany`メソッドを使います。

```js
// キーの配列
const values1 = await db.getMany(storeName, keys);
// キーの範囲
const values2 = await db.getMany(storeName, keyRange);
```

#### データの存在確認とカウント

値を取得する必要はないがデータが存在するかを調べたい場合は、`has`, `hasAny`メソッドを使います。

```js
const bool1 = await db.has(storeName, key);
const bool2 = await db.hasAny(storeName, keyRange);
```
`has`メソッドは、指定したキーに一致するデータが存在すれば`true`、存在しなければ`false`を返します。
`hasAny`メソッドは、指定したキーの範囲に含まれるデータが1件以上存在すれば`true`、1件も存在しなければ`false`を返します。

指定したキーの範囲に含まれるデータの個数を調べたい場合は、`count`メソッドを使います。

```js
const num = await db.count(storeName, keyRange);
```

## API
