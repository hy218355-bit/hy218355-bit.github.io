# 吹部日誌 iOSアプリ

`../suibu/`（Webで遊べるゲーム本体）を、そのままアプリに同梱して動かす iPhone / iPad アプリです。
ゲームのHTML・JavaScript・録音・会場の響き・フォントをすべてアプリに入れるので、通信なしで遊べます。

## 仕組み

| ファイル | 役割 |
| --- | --- |
| `Suibu/SuibuApp.swift` | アプリの入口。消音スイッチが入っていても音が出るように、オーディオを「再生」扱いにする |
| `Suibu/GameViewController.swift` | WKWebView でゲームを表示。ページからの知らせ（セーブ・演奏中・エラー）を受ける |
| `Suibu/BundleSchemeHandler.swift` | `app://suibu/…` で同梱ファイルを配る（`file://` だと `fetch()` で録音を読めないため） |
| `Suibu/SaveStore.swift` | セーブ（localStorage）をアプリ側にも控え、WebKit が消してしまっても書き戻す |
| `Suibu/selftest.js` | CI用。起動引数 `-selftest` のときだけ、数小節を書き出して音が出るか確かめる |
| `Suibu/PrivacyInfo.xcprivacy` | プライバシーマニフェスト（追跡なし・データ収集なし） |

- ゲーム本体は `../suibu` をビルド時にアプリの `Game/suibu/` へコピーします。Web版を直せば、次のビルドでアプリにも入ります。
- 演奏を聴いているあいだは画面が暗くならないようにしています（ロックされると音が止まるため）。
- Debug ビルドでは、Mac の Safari の「開発」メニューからアプリ内のページを調べられます。

## Mac で動かす

1. `Suibu.xcodeproj` を Xcode（16 以降）で開く
2. ターゲット Suibu →「Signing & Capabilities」で Team を選ぶ
3. 必要なら Bundle Identifier（いまは `io.github.hy218355-bit.suibu`）を自分のものに変える
4. iPhone をつないで ▶︎ で実行

## App Store に出すとき

- Product → Archive → Distribute App → App Store Connect
- App Store Connect に入れる項目の例
  - サポートURL：`https://hy218355-bit.github.io/suibu-support/`
  - プライバシーポリシーURL：`https://hy218355-bit.github.io/suibu-privacy/`
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

- 楽器の録音：VSCO 2 Community Edition・VCSL（CC0）、Weresax（CC BY 3.0）。詳細は `../suibu/snd/CREDITS.md`
- フォント：Zen Kaku Gothic New、Klee One、Dela Gothic One、Share Tech Mono（SIL Open Font License 1.1）。`../suibu/fonts/OFL-*.txt`
- 曲：ドヴォルザーク《新世界より》、ベートーヴェン《第九》、オッフェンバック《天国と地獄》、エルガー「威風堂々」、ヨハン・シュトラウス1世「ラデツキー行進曲」（すべてパブリックドメイン。音は Mutopia Project と PDMX（CC0）の楽譜データで確かめています）
