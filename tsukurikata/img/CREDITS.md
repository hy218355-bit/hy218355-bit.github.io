# 絵と画面の出典

- `music-room.webp`：本作品のデザイン案のため、組み込みimage_genで制作したオリジナルの音楽室。LPで承認された原画を使用。生成記録は `design/lp/assets/after-school-v2.prompt.txt`。外部作品の画像は使用していない。
- 画面の部品とSVGアイコンは本作品のために自作。
- フォントは既存の同梱ファイルを使用。出典とライセンスは `../fonts/OFL-*.txt`。新しいダウンロードなし。

## 部員の顔

- `faces/face-01.svg`〜`face-39.svg`：承認された39人の絵柄見本を、`tools/build_faces.py` の自作のベクター変換処理でSVGへ変換した。下塗り・輪郭・肌・髪・目・眉・口・ほお・小物に分け、描き込みを色面として残した。ビットマップの埋め込みはない。1枚224px四方、最大171,206 bytes。
- 元の原画は組み込みimage_genで本作品のために制作。前の12人は `design/after-school/assets/faces-art-direction-v4.prompt.txt`、追加27人は `design/after-school/cast39/assets/sheet02.prompt.txt`・`sheet03.prompt.txt` に最終プロンプトと原稿の保存先を記録。外部作品の絵は使っていない。
- 対応する `.js` は同じSVGパーツの読み込み用。iPhoneのローカルファイルでも外部SVG参照に頼らず組み立てるためのもので、必要な顔だけ読み込み、idごとの結果をBlobの画像として使い回す。
- 顔の型はidの通し番号の39人ごとにhashで並べ替え、髪・肌・目・眉・口・ほおの色の差をidからhashで決める。名前・性別・学年を入力にせず、セーブに何も追加しない。原画の女子35人／男子4人の構成を維持する。
