# App Store公開の前に

2026年11月1日時点。アプリ内の案内・原稿・ビルドの整備と、外部で行う公開・申請を区別する。この文書の作成だけで公開や審査が済んだことにはならない。

## アプリへ用意したもの

- 日誌 →「このアプリについて」：プライバシーポリシー、利用規約、サポート、クレジット。すべて同梱され、読むだけなら通信不要。
- ポリシー：端末保存・OSバックアップ・削除・手動の共有・任意のメール問い合わせ・Web配信時の通信を分けて説明。
- 窓口：既存の公開メール `hy218355@gmail.com`、運営者表記 Yu Studio。
- クレジット：録音の作者・元ページ・加工内容・CC BY 3.0のリンクと公開用の表記例、フォント4種の著作権表示とOFL全文、絵の制作方法。
- プライバシーマニフェスト：追跡なし・収集データなし。UserDefaultsの`CA92.1`（アプリ内のセーブ控え・起動設定）、FileTimestampの`C617.1`（`-selftest`で同一アプリ領域の書き出したファイルサイズを確認）。ゲームの情報を外部へ送る機能は追加していない。
- 個人データへのアクセス権限：カメラ・マイク・位置情報・連絡先は使わず、不要な許可ダイアログや追跡同意画面は追加していない。
- 原稿の場所：`tsukurikata/legal/documents.json`。`python3 tsukurikata/tools/build_legal.py`で更新し、`--check`で一致を確認する。公開用4ページとアプリ内の全文は同じ。
- 使用許諾：Appleの標準EULAを利用する。今回の案内を独自EULAとしてApp Store Connectに登録しない。

## 公開・申請時に行うこと（この作業では未実施）

1. オーナーの指示で配信ブランチに反映し、GitHub Pagesで公開する。サポート・プライバシー・規約・クレジットの4URLと問い合わせメールが実際に使えることを確認する。未pushのローカルページを公開済みと扱わない。
2. 運営者・Copyright表記と既存メールが現在の窓口として正しいか最終確認する。App Store Connectの販売者の本人情報はApple Developerの登録に合わせる。
3. App Store ConnectにサポートURL・プライバシーポリシーURLを入力する。原稿は`AppStore.md`を参照。
4. Appのプライバシーの質問に回答する。現在のゲームは端末内のみで処理し、SDK・広告・追跡なし。任意のメール問い合わせは利用者の意思で送られ、対応用途だけに使う運用としている。Appleの任意開示の条件を満たすか実際の運用も確認して「データの収集なし」の回答を確定する。後で解析・課金・オンライン機能などを加えたら、ポリシー・マニフェスト・回答を再確認する。
5. 年齢レーティングの質問票に、実際の内容（架空の高校生の恋愛の話を含む）で回答する。4+をあらかじめ保証しない。広告や課金がないことは年齢回答の代わりにならない。
6. 現在のアプリを示すiPhone／対応iPadのスクリーンショット、説明、アイコン、バージョンと重複しないビルド番号、審査連絡先をそろえる。審査用アカウントは不要。
7. iPhone実機での最終確認（ミラーリングは使わない）を行い、Archiveした配布用ビルドの検証を通してから、オーナーの指示でアップロード・審査提出する。今回のビルド成功は審査承認を意味しない。

## Appleの一次資料

- [App Review Guidelines 5.1.1・1.5](https://developer.apple.com/app-store/review/guidelines/)：アプリ内とストアのポリシー、利用者が問い合わせできる窓口。
- [App privacy details](https://developer.apple.com/app-store/app-privacy-details/)：端末内だけの処理と収集の区別、任意の問い合わせに関する開示条件。
- [標準EULAと独自の使用許諾](https://developer.apple.com/help/app-store-connect/manage-app-information/provide-a-custom-license-agreement/)：独自EULAを指定しなければ標準EULAが適用される。
- [Required reason APIのカテゴリと理由](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype)：`CA92.1`・`C617.1`の根拠。

## 今回の検証範囲

検証の記録は`design/app-legal/README.md`。ブラウザがWork設定で無効だったため、375pxのライト・ダークの目視とスクリーンショットは未実施。静的なHTML・リンク・配色の整合、ゲーム部分に変更がないこと、生成の一致、フォントの対象、iPhone用ビルド・署名・同梱物を確認する。
