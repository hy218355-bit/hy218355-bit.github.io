# デザイン案の出典

- 顔、髪、表情、小物、舞台、アプリアイコン、画面中のSVGアイコン：本デザイン案のために自作。外部素材なし。
- フォント：既存の `tsukurikata/fonts/` の同梱ファイルを参照。ライセンスは同フォルダの `OFL-*.txt`。新しいダウンロードなし。
- モックの決定的な乱数：既存の `tsukurikata/js/util.js` の `hash` を読み取り参照。
- 変更前の画像：本リポジトリのゲームをローカルブラウザで撮影。
- 提案のPNG：独立HTML/SVGのブラウザスクリーンショット。`export_previews.py` でPNG化、1024pxと60pxのアイコンを書き出した。

ゲーム本体の `tsukurikata/img/CREDITS.md` には、【2】で採用した素材だけを記載する。

## LPの5案

`lp/` のロゴ・音符・楽器・音楽室・舞台・波形と画面イメージは、本デザイン案のために自作したSVG／HTML／CSS。外部素材なし。フォントは既存のZen Kaku Gothic New 400／700を参照し、新規ダウンロードなし。LPの撮影画像はローカルブラウザで撮影した。

## ②案の改善版

`lp/assets/after-school-v2.webp`：組み込みimage_genで、本提案のために制作したオリジナルの音楽室の画像。既存作品の画像を素材に使用していない。最終プロンプト・生成原稿・書き出し情報は `lp/assets/after-school-v2.prompt.txt`。改善版のロゴ、舞台、画面例と操作アイコンは自作SVG／HTML／CSS。ゲーム本体にはまだ採用しない。

## 放課後の音楽室：ゲーム画面と顔

`after-school/assets/faces-art-direction.webp`：組み込みimage_genで本提案のために制作した12人の絵柄見本。光と色の参照は自作の音楽室。画面内の仮配置はCSSで各枠を表示し、原画の意味や内容は編集していない。ゲーム用の完成素材とは扱わない。生成原稿と最終プロンプトは同フォルダの `faces-art-direction.prompt.txt`。

`after-school/faces.js` と `after-school/assets/faces/*.svg`：絵柄見本とは別に、SVGパーツで自作した試作。原画の画素は含まない。グラデーション、顔の各パーツ、小物も自作。

`after-school/assets/faces-art-direction-v2.webp`：オーナーの指摘に合わせ、上の自作見本を組み込みimage_genで編集した年齢感の修正版。1〜3年生で共通に使う顔の絵柄確認用。前の原稿を保持し、ゲーム本体やSVG試作には未反映。生成原稿と最終プロンプトは `faces-art-direction-v2.prompt.txt`。

`after-school/assets/app-icon-1024.svg`：LPで使った校章と音符のマークから自作したアイコン。PNGはローカルブラウザで描画した原稿から書き出した。ゲームのアイコンファイルはまだ変更しない。
