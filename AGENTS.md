# hy218355-bit.github.io

GitHub Pages のサイト。いまの中心は、高校吹奏楽部の顧問になって部員を育てるゲーム「吹奏楽部のつくりかた」。

## ゲームの場所

| 場所 | 中身 |
| --- | --- |
| `tsukurikata/` | ゲーム本体（HTML・JavaScript だけ。ビルドなし） |
| `tsukurikata-ios/` | iPhone / iPad アプリ（SwiftUI＋WKWebView）。ビルド時に `../tsukurikata` を丸ごと同梱する |
| `tsukurikata-support/`・`tsukurikata-privacy/` | App Store 用のサポート・プライバシーポリシーのページ |
| `.github/workflows/ios.yml` | push のたびに、ビルドとシミュレータでのセルフテスト・スクリーンショット |
| `.github/workflows/testflight.yml` | 署名して TestFlight に上げる（App Store Connect の API キーが要る） |

作業ブランチは `claude/high-school-music-sim-game-nof0pm`（PR #1）。

## ゲームの組み立て（`tsukurikata/js/`）

`index.html` が次の順に `<script>` で読み込む。モジュールではなく、すべてグローバル。

- `util.js`：乱数（`hash`・`gauss` は種から決まる）や小道具
- `instruments.js`：楽器・パート・セクションのデータと音づくり
- `venues.js`：会場の響き（物理計算したインパルス応答）
- `samples.js`：楽器の録音（`snd/`）を読み込んで鳴らす
- `scores.js`：5曲の楽譜と編曲。`arrangement()` が全39席ぶんの楽譜を作り、`reduction()` が少人数のとき、いない人の旋律・低音・内声を、いる人に小節ごとに持ち替えさせる
- `band.js`：部員と席、`perform()`（部員一人ずつの実力から1音ずつのずれを決める）、`analyze()`・`judge()`（採点と講評）
- `game.js`：1年間の流れ
  - 毎週の個別練習と方針（`practiceWeek`・`decideMenu`）
  - 評判と入部（`gainRep`）
  - オーディション（`runAudition`・`setLineup`）
  - 演奏会・コンクール・引退・新年度
  - セーブ（`load()` に古いセーブの移しかえ）
- `engine.js`：再生と書き出し
- `conduct.js`・`announce.js`・`tunegame.js`：指揮・結果発表・耳でチューニング
- `ui.js`：画面

## 決まりごと

- この説明は Claude Code（`CLAUDE.md` から読み込む）と Codex の両方が読む。書き足すときはこのファイルに書く。
- 同じフォルダを Claude と Codex で使うので、作業の区切りごとにコミットする。両方で同時に同じファイルを直さない（同時に進めるときは `git worktree` で別のフォルダとブランチに分ける）。始める前に `git pull`。

- 画面の文章とコードのコメントは日本語。画面の文章は、ゲームを知らない人にも分かる、ふつうの言葉で書く。
- セーブの形を変えたら、`game.js` の `load()` に、前のセーブを新しい形へ移す処理を足す（前のセーブがそのまま続けられること）。
- 楽器の録音（`snd/`）は `tools/build_samples.py` で作ったもの。気軽に作り直さない。

## 確かめ方

- ブラウザで遊ぶ：`cd tsukurikata && python3 -m http.server 8000` → http://localhost:8000/
- 何年分かを画面なしで早送りして、バランスを見る：`node tsukurikata/tools/sim.js 5 auto radetzky best`
  - 引数は年数・方針・曲・オーディション（`best` でおすすめのメンバー、`all` で全員）
- iPhone に入れる：`bash tsukurikata-ios/run-on-iphone.sh`
  - チームは Mac の開発用証明書から見つける
  - シミュレータは選ばず、ケーブルか同じ Wi-Fi の実機に入れて起動する
- iOS の CI：push すると `ios.yml` が走る
- TestFlight に上げる：Actions から `testflight.yml`、またはコミットメッセージに `[testflight]` を入れて `claude/` のブランチに push する
