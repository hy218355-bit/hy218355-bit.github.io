# アプリアイコンを軽やかにする3案

2026年11月2日。オーナーの「オシャレに」に合わせた比較案。3案ともオーナーが見送りとした。製品のアイコンは差し替えていない。比較の履歴として残す。

- A「放課後のトランペット」：深緑、クリーム、やわらかい真鍮色。大きな楽器を斜めに置き、吹奏楽のアプリと分かる形にする。
- B「ふたつの音」：温かい白地に深緑とキャメル。丸い音符を、余白と色の切り替えで整える。
- C「音楽室の窓」：セージ色に、丸い窓と夕日と音符。部活の放課後を小さな風景で表す。

すべて自作SVG。外部素材・ダウンロード・追加フォントなし。`a.svg`〜`c.svg`が原稿。`render.swift`でmacOS標準のNSImageから1024pxへ描画し、`build_preview.py`でRGBのPNG・256/180/64/60pxと比較画像を作る。1024pxは各200KB未満。ホーム画面の角丸は比較画像とHTMLでのみ付け、元のPNGは透過なし・四角のまま。

`comparison.png`は生成した図案の比較シート。ブラウザのスクリーンショットではない。60pxを明るい背景・暗い背景へ等倍で置き、画像を目視確認した。HTMLは`index.html`、375pxでは1列へ折り返す。ブラウザでの表示検証は今回行っていない。

生成コマンド（リポジトリのルートから）：

```sh
CLANG_MODULE_CACHE_PATH=/private/tmp/tsukurikata-icon-clang SWIFT_MODULECACHE_PATH=/private/tmp/tsukurikata-icon-swift swift design/icon-polish/render.swift design/icon-polish/a.svg design/icon-polish/b.svg design/icon-polish/c.svg
python3 design/icon-polish/build_preview.py
```

この3案は採用しない。次の質感のある提案は`../icon-cinematic/`。新しい案への承認前に製品を差し替えない。
