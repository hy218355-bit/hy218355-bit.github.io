# 初回公開の画像と配布準備

最新：11月3日19:52、説明付きの掲載画像を日英それぞれiPhone5枚・iPad5枚、計20枚へ全面更新して再提出し、審査待ちを確認した。現在の原稿・画像・提出記録は[`../store-features/`](../store-features/README.md)。以下は初回準備時の履歴。

2026年11月3日。無料・広告なし・アプリ内課金なし。日本だけでの初回配信をオーナーが指定した。続いて、ゲーム内で日本語と英語を切り替えられる版も依頼されたため、英語対応後には配布用ビルド・掲載素材を改めて確認する。

## 実際のiOSアプリからの撮影

- 掲載用：iPhone 17 Pro（1206×2622）5枚、iPad Pro 13インチ（2064×2752）3枚。App Store Connectの下書きへアップロードし、それぞれ5枚・3枚の登録を確認。
- 大きいiPhone向けの原寸：1320×2868、5枚。別枠用の予備。
- 375pxの確認：iPhone 13 mini、練習と部員カードのライト・ダーク4枚。
- 全17枚はRGB PNGでアルファチャンネルなし。`checks.json`に画面幅・画像の欠落・フォント・上部の帯・PNGの検証を記録。
- `index.html`は掲載用8枚の一覧、`store-preview.jpg`はその縮小一覧。`preview.jpg`は375pxや予備も含む検証用の一覧。
- `make-fixture.js`で製品の進行関数を使って2026年から2028年5月まで育てた39人。実力の上書きは行わず、セーブは実際の利用者のものを使わない。
- スクリーンショット内の画面や絵は加工しない。形式をRGBAからRGBへ変え、一覧画像に縮小して並べるだけ。ゲーム内の設定「演出：なし」を使い、通知が消えてから撮影する。

撮影専用アプリは`/private/tmp/tsukurikata-store-capture/`にあるコピー。既存のセルフテスト用スクリプトを、このコピー内だけで`capture.js`へ差し替えた。配布用IPA・製品のSwift・JavaScriptは撮影処理を含まない。同梱ゲームの全193ファイルが製品と一致することを撮影前に確認した。

再撮影：

```sh
node design/app-store/make-fixture.js
# 先にシミュレータ用ビルドを /private/tmp/tsukurikata-store-sim に作る
python3 design/app-store/capture.py --device <撮影専用シミュレータのID> --name iphone-medium
```

オーナーの実機へは導入せず、iPhoneミラーリングは使っていない。

## 撮影で見つかった修正

季節の3pxの線が`body::before`を上書きし、スクロールした内容がステータスバーへ重なっていた。季節の線を`body::after`へ分け、上部の紙の背景を残した（`831c604`）。375pxのライト・ダークでも確認した。上部の帯は375pxの端末で50px、大きいiPhoneで62px、iPadで32px。ゲームの文字や進行・採点・音・セーブは変更しない。

## ビルドと検証

- 最新のローカルArchive：`/private/tmp/tsukurikata-release-candidate-20261103.xcarchive`。
- App Store向けのIPA：`/private/tmp/tsukurikata-store-export-final-20261103/Tsukurikata.ipa`、約41.4MiB。
- Archive・Exportとも成功。Apple Distributionで署名し、`get-task-allow`はfalse。深い署名検証と同梱ゲーム193ファイルのハッシュ比較が成功。
- 詳細は`../release-candidate/20261103.json`。開発用署名の11月2日のArchiveとは別。
- 撮影用ではない製品アプリでセルフテスト成功（`native-selftest.txt`）。WebKitで全15曲の予約、実音の生成、会場の響き、WAVからm4aへの保存を確認。NaN 0、ピーク0.758、音声ファイル253,783 bytes。
- `build_legal.py --check`成功。`git diff --check`成功。フォント検査は従来の不足11字に、新しいコードコメント中の「疑」「覆」が加わる。画面の表示文は追加していないため、フォントの取得・変更はしない。

App Storeへのビルド送信とApple側の配布検証・審査提出は未実施。ローカルの署名検証を審査済みと扱わない。

## App Store Connectの下書き

アプリ：[吹奏楽部のつくりかた](https://appstoreconnect.apple.com/apps/6830030864/distribution/ios/version/inflight)、Apple ID `6830030864`、SKU `tsukurikata-ios`。

保存済み：日本語の名前・副題、ゲーム／シミュレーション、セカンダリのミュージック、プロモーション文、説明、キーワード、サポートURL、Copyright、審査メモ、ログイン不要、手動公開。MacとVision Pro向けの自動配信は外した。掲載画像はiPhone5枚・iPad3枚。配信地域は「Japan Available on App Release」の1地域を確認した。

残り：無料価格の確定（0円を選んだが確認段階へ進まないため、保存済みとは扱わない）、年齢・プライバシー・権利の回答、審査連絡先、英語版、ビルドの送信と審査。更新規約への同意はオーナーから完了の返信あり。

公開用4ページは11月3日のGETでも404。原稿はローカルで整備済み。GitHubへのpushは行っていない。
