# 活字と線画で組み直すアイコン

2026年11月2日。文字入りの生成画像への「AIぽい」という指摘を受け、文字は実フォントの輪郭から組版し、トランペットは自作のパスで描き直した。画像生成は使っていない。主案は紙色の`paper.svg`。濃色の`navy.svg`は配色の確認用。

- 題名「吹奏楽部」：ゲームの日誌と同じKlee One 600。
- 添え字「のつくりかた」：ゲームの本文と同じZen Kaku Gothic New 500。
- `fontTools`で既存の同梱woff2から字形を取り、SVGのpathとして並べた。生成した文字や擬似的な日本語ではない。
- 楽器：手でパスを書いた線画。生成された楽器の輪郭のトレースはしていない。3本のピストンと管を整理して、紙とインクのグラフィックにした。精密な構造図ではない。
- 書体の加工は絵としてのアウトライン化のみ。元のフォントファイルは変更しない。ライセンスは`../../tsukurikata/fonts/OFL-kleeone.txt`と`OFL-zenkakugothicnew.txt`。
- 追加のフォント・外部素材・ダウンロードなし。

## ファイルと確認

`build.py`が自作の形と組版の原稿。1024pxの`paper.svg`・`navy.svg`を生成する。

```sh
python3 design/icon-typeset/build.py
CLANG_MODULE_CACHE_PATH=/private/tmp/tsukurikata-icon-clang SWIFT_MODULECACHE_PATH=/private/tmp/tsukurikata-icon-swift swift design/icon-polish/render.swift design/icon-typeset/paper.svg design/icon-typeset/navy.svg
```

同じ原稿から1024・256・180・64・60pxのRGB PNGを作成。1024pxも両配色で200KB未満。`preview.png`で主案の340pxと等倍60pxを明暗の背景に置き、原稿と縮小後の字形・線を目視確認した。これは比較シートで、ブラウザのスクリーンショットではない。`index.html`のブラウザ検証は未実施。

2026年11月2日、オーナーの「おk」で紙色の案を採用。`paper.svg`と承認された各サイズのPNGを、製品の`tsukurikata/img/app-icon.svg`・`icon-180.png`・`icon-64.png`・iOSの`icon-1024.png`へそのまま反映した。出典と使用書体も製品のクレジットに記載。ゲーム内容・画面の文章・セーブ・音源は変更しない。反映の確認は`adoption-check.json`。pushはしない。

## 採用後の確認

承認済みのSVG・PNGとの完全一致、RGB・透過なし・寸法・各200KB未満を確認。iPhone用Releaseビルドと厳密な署名検証が成功し、全134個の同梱ゲームファイルを作業フォルダと照合した。iPhone用120px・iPad用152pxにコンパイルされた画像をPNG最適化から戻し、原稿との配色と画素の平均誤差を確認。結果と比較用画像は`adoption-check.json`・`compiled-iphone-icon.png`・`compiled-ipad-icon.png`。

実機へアンインストールせず上書き更新し、起動を確認。ミラーリングは使っていない。ゲームのレイアウト・文字・内容・セーブは変更なし。ブラウザでの画面確認は未実施。`build_legal.py --check`は一致、`check_glyphs.py`は従来の11文字のみ。
