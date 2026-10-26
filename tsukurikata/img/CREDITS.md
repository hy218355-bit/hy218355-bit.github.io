# 絵と画面の出典

- `music-room.webp`：本作品のデザイン案のため、組み込みimage_genで制作したオリジナルの音楽室。LPで承認された原画を使用。生成記録は `design/lp/assets/after-school-v2.prompt.txt`。外部作品の画像は使用していない。
- 画面の部品とSVGアイコンは本作品のために自作。
- フォントは既存の同梱ファイルを使用。出典とライセンスは `../fonts/OFL-*.txt`。新しいダウンロードなし。

## 部員の顔

- `faces/classmates-01.webp`〜`classmates-03.webp`：以前承認された高1寄りの39人の原画。`design/after-school/assets/faces-art-direction-v4.prompt.txt`、`design/after-school/cast39/assets/sheet02.prompt.txt`・`sheet03.prompt.txt` に制作記録がある。
- `faces/portraits-01.webp`：前回の描き直しの原画から、かわいい女子8人とかっこいい男子1人の枠を使う。制作記録は `design/face-revision/prompts.json`。
- `faces/classmates-04.webp`：自然な顔立ちの男子4人を組み込みimage_genで本作品のために追加制作。制作と最終編集のプロンプトは `design/cast-balance/prompts.json`。外部作品の絵は使っていない。
- 原画の画素数のままWebPへ圧縮。減色パレットやSVG化を使わず、CSSで各枠を表示する。どの枠を使うかは `faces/manifest.json`・`js/face-cast.js`。39人の中で女子8人と男子1人だけを整った顔立ちとし、残り30人は自然な個性を保つ。各画像は200KB以下。
- 名前は元のリストと生成処理のまま。オーナーの指定に合わせ、この作品内の名前の配役に顔を対応させる。顔の選択はidと配役から決まり、既存名を変更せず、セーブに性別や顔の情報を追加しない。

## アプリアイコン

- `app-icon.svg`：LPとゲームの校章・音符を共通にした自作SVG。オーナーが承認した紺と真鍮の案を使用。
- `../icon-180.png`・`../icon-64.png`・iOSの `icon-1024.png`：同じSVGをローカルブラウザで描画した1024px原稿から書き出し・縮小した。透過なし。外部素材・新しいダウンロードなし。
