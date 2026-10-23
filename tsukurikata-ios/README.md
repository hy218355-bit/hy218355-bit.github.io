# 吹奏楽部のつくりかた iOSアプリ

`../tsukurikata/`（Webで遊べるゲーム本体）を、そのままアプリに同梱して動かす iPhone / iPad アプリです。
ゲームのHTML・JavaScript・録音・会場の響き・フォントをすべてアプリに入れるので、通信なしで遊べます。

## 仕組み

| ファイル | 役割 |
| --- | --- |
| `Tsukurikata/TsukurikataApp.swift` | アプリの入口。消音スイッチが入っていても音が出るように、オーディオを「再生」扱いにする |
| `Tsukurikata/GameViewController.swift` | WKWebView でゲームを表示。ページからの知らせ（セーブ・演奏中・エラー）を受ける |
| `Tsukurikata/BundleSchemeHandler.swift` | `app://tsukurikata/…` で同梱ファイルを配る（`file://` だと `fetch()` で録音を読めないため） |
| `Tsukurikata/SaveStore.swift` | セーブ（localStorage）をアプリ側にも控え、WebKit が消してしまっても書き戻す |
| `Tsukurikata/selftest.js` | CI用。起動引数 `-selftest` のときだけ、数小節を書き出して音が出るか確かめる |
| `Tsukurikata/PrivacyInfo.xcprivacy` | プライバシーマニフェスト（追跡なし・データ収集なし） |

- ゲーム本体は `../tsukurikata` をビルド時にアプリの `Game/tsukurikata/` へコピーします。Web版を直せば、次のビルドでアプリにも入ります。
- 演奏を聴いているあいだは画面が暗くならないようにしています（ロックされると音が止まるため）。
- Debug ビルドでは、Mac の Safari の「開発」メニューからアプリ内のページを調べられます。

## iPhone に入れる（いちばん早い）

```
bash tsukurikata-ios/run-on-iphone.sh
```

Mac にある開発用の証明書からチームを見つけ、ケーブルか同じ Wi-Fi でつながっている iPhone（シミュレータは選ばない）にビルドして入れ、起動します。

## Mac で動かす

1. `Tsukurikata.xcodeproj` を Xcode（16 以降）で開く
2. ターゲット Tsukurikata →「Signing & Capabilities」で Team を選ぶ
3. 必要なら Bundle Identifier（いまは `io.github.hy218355-bit.tsukurikata`）を自分のものに変える
4. iPhone をつないで ▶︎ で実行

## TestFlight に上げる（GitHub Actions から）

`../.github/workflows/testflight.yml` を Actions の画面から手動で実行すると、署名して TestFlight に上げます。Mac がなくても、iPhone の TestFlight アプリから入れられます。

1. App Store Connect でアプリを作る（Bundle ID は `io.github.hy218355-bit.tsukurikata`。変えるときはリポジトリの Variables に `TSUKURIKATA_BUNDLE_ID` を入れる）
2. App Store Connect →「ユーザとアクセス」→「統合」→ App Store Connect API で、アクセスが Admin のキーを作る
3. リポジトリの Settings → Secrets and variables → Actions の Secrets に入れる
   - `ASC_KEY_ID`：キーID
   - `ASC_ISSUER_ID`：発行者ID
   - `ASC_KEY_P8`：ダウンロードした `.p8` ファイルの中身（テキストのまま）
   - `APPLE_TEAM_ID`：チームID（10文字）
4. Actions →「TestFlight」→ Run workflow。main に入る前は、`testflight-` で始まるタグ（例：`testflight-1`）を push するか、`claude/` のブランチにメッセージに `[testflight]` を含むコミットを push すると動く

署名は Xcode の自動署名にまかせ、ビルド番号はアップロードのときに Xcode が重ならないよう決めます。

## App Store に出すとき

- Product → Archive → Distribute App → App Store Connect
- App Store Connect に入れる項目の例
  - サポートURL：`https://hy218355-bit.github.io/tsukurikata-support/`
  - プライバシーポリシーURL：`https://hy218355-bit.github.io/tsukurikata-privacy/`
  - App のプライバシー：「データの収集なし」
  - カテゴリ：ゲーム（シミュレーション）／ミュージック
  - 年齢制限：4+（暴力・課金・広告・通信なし）
  - 輸出コンプライアンス：暗号化を使わない（`ITSAppUsesNonExemptEncryption = NO` 設定済み）
- 上の2つのページは、このブランチを main に入れると GitHub Pages で公開されます。
- バージョンはターゲットの `MARKETING_VERSION`（1.0）と `CURRENT_PROJECT_VERSION`（1）。
- 名前・説明・キーワードなど、App Store Connect に貼る文章は `AppStore.md` にまとめてあります。

## 自動チェック（GitHub Actions）

`../.github/workflows/ios.yml` が、push のたびに macOS で次を行います。

1. iPhone 用（Release・署名なし）とシミュレータ用にビルド
2. シミュレータでアプリを `-selftest` 付きで起動し、録音と会場の響きを読み込んで数小節を書き出す（WebKit で音の処理が動くかの確認）
3. ふつうに起動した画面（ライト・ダーク）のスクリーンショットを成果物として保存

## 素材のライセンス

- 楽器の録音：VSCO 2 Community Edition・VCSL（CC0）、Weresax（CC BY 3.0）。詳細は `../tsukurikata/snd/CREDITS.md`
- フォント：Zen Kaku Gothic New、Klee One、Dela Gothic One、Share Tech Mono（SIL Open Font License 1.1）。`../tsukurikata/fonts/OFL-*.txt`
- 曲：ドヴォルザーク《新世界より》、ベートーヴェン《第九》、オッフェンバック《天国と地獄》、エルガー「威風堂々」、ヨハン・シュトラウス1世「ラデツキー行進曲」、ヴェルディ《アイーダ》、ヘンデル《ユダス・マカベウス》、ホルスト《惑星》、ブラームス「ハンガリー舞曲第5番」、チャイコフスキー《くるみ割り人形》《白鳥の湖》、ロッシーニ《ウィリアム・テル》、ビゼー《カルメン》、ヴィヴァルディ《四季》、パッヘルベル「カノン」（すべてパブリックドメイン）。楽器の受け持ちは IMSLP にあるパブリックドメインの総譜（できるだけ作曲者のころの版）から読み、一部の曲は PDMX（CC0）の楽譜データも使っています。使った楽譜（IMSLP の番号とページ）は、曲ごとのファイル `../tsukurikata/js/pieces/<曲>.js` の先頭に書いてあります
