jconv
====================

> Pure JavaScript Iconv for Japanese encodings.

[![Build Status](https://secure.travis-ci.org/narirou/jconv.png?branch=master)](https://travis-ci.org/narirou/jconv)
[![NPM version](https://badge.fury.io/js/jconv.png)](http://badge.fury.io/js/jconv)

 * *Shift_JIS(CP932)、ISO-2022-JP(-1)、EUC-JP、UTF8、UNICODE* の相互変換を行うモジュールです。
 * JavaScriptのみで書かれているため、コンパイルは必要ありません。
 * [node-iconv](https://github.com/bnoordhuis/node-iconv)よりも高速に変換を行います。

## インストール
```
npm install jconv
```

## 使い方
**EUC-JP** から **Shift_JIS** に変換したい場合は、次のようにします。

```javascript
var jconv = require( 'jconv' );

var SJISBuffer = jconv.convert( EUCJPBuffer, 'EUCJP', 'SJIS' );
```

**iconv-lite** 形式のAPIも利用可能です。

```javascript
var string = jconv.decode( buffer, fromEncoding );

var buffer = jconv.encode( string, toEncoding );
```

## API
 * **jconv( input, fromEncoding, toEncoding )**  
 * **jconv.convert( input, fromEncoding, toEncoding )**  
    * `input` {Buffer} または {String}  
    * `fromEncoding`, `toEncoding` {String}:  
      変換元のエンコードと、変換先のエンコードを指定します。  
      *Shift_JIS(SJIS,CP932)、ISO-2022-JP(JIS)、EUCJP、UTF8、UNICODE(UCS2,UTF16LE)* のいずれかを指定してください。  
    * `return` {Buffer}  

 * **jconv.decode( inputBuffer, fromEncoding )**  
    * `return` {String}  

 * **jconv.encode( inputString, toEncoding )**  
    * `return` {Buffer}  

 * **jconv.encodingExists( encodingName )**  
    * `return` {Boolean}

## 速度
node-iconv@2.0.7 との変換速度の比較です。[夏目漱石 こころ](http://www.aozora.gr.jp/cards/000148/files/773_14560.html)
のテキストを、 [Benchmark.js](https://github.com/bestiejs/benchmark.js) を利用して変換速度を計測したものになります。  
環境は *Windows7, core i5 2405-S, mem8G, Node 0.10.22*です。 (利用する環境で計測してみてください。)  
`グレー`がiconv、`青色`がjconvで、高い方がより高速です。  

![jconv - encoding speed test chart](./test/chart/speedLog.png)
[[latest log]](./test/chart/speedLog.txt)  
<!-- https://raw.github.com/narirou/jconv/master/ -->

## エンコードについて
 * Shift_JIS(CP932), ISO-2022-JP(-1), EUC-JP, UTF8, UNICODE(UCS2) の相互変換をサポートしています。   
   「秀丸エディタ」とほぼ同じ変換内容になります。 

 * Windowsの機種依存文字を変換できます。  
[(問題詳細)](http://support.microsoft.com/default.aspx?scid=kb;ja;JP170559)  

 * "JIS X 0208"、"JIS X 0212"、"CP932" には、ユニコード変換テーブルに相違点があり、
   いくつかの特殊な文字 ( ～￠￡∥ など ) では、デフォルトで相互変換を行うことが出来ません。  
   このモジュールでは、テーブルの修正を行い相互変換できるようにしていますが、
   定義に厳格な変換を行いたい場合は、 node-iconv に libiconv の日本語用修正パッチを当てたモジュールを用いることが推奨されます。  
[(問題詳細)](http://www8.plala.or.jp/tkubota1/unicode-symbols-map2.html)  

## 参考
 * [iconv-lite](https://github.com/ashtuchkin/iconv-lite) by ashtuchkin.
 * [Encoding.js](https://github.com/polygonplanet/Unzipper.js) by polygonplanet.
 * [iconv-js](https://github.com/Hikaru02/iconv-js) by Hikaru02.
 * [node-iconv](https://github.com/bnoordhuis/node-iconv) by bnoordhuis.
 * [libiconv-1.9.1-ja-patch Description](http://www2d.biglobe.ne.jp/~msyk/software/libiconv-1.9.1-patch.html) by 森山 将之.

ありがとうございます。

