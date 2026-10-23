#!/bin/bash
# 吹部日誌をビルドして、つないだ iPhone（ケーブルか同じ Wi-Fi）に入れて起動する
#   bash suibu-ios/run-on-iphone.sh
# チームは Mac にある開発用の証明書から見つける（TEAM=XXXXXXXXXX で指定もできる）。CONFIG=Debug にすると Debug ビルド
set -eo pipefail
cd "$(dirname "$0")/.."
CONFIG=${CONFIG:-Release}
DD=${DERIVED:-/tmp/suibu-dd}
TEAM=${TEAM:-$(security find-certificate -a -c "Apple Development" -p | openssl x509 -noout -subject -nameopt multiline | awk -F' = ' '/organizationalUnitName/{print $2; exit}')}
[ -n "$TEAM" ] || { echo "Apple Development の証明書が見つからない（Xcode → Settings → Accounts でサインインして）"; exit 1; }
echo "チーム: $TEAM"

# 入れられる実機を探す（sameMachine はシミュレータなので除く。ケーブル → Wi-Fi の順）
J=$(mktemp)
xcrun devicectl list devices --json-output "$J" >/dev/null
# Mac の /bin/bash（3.2）は <( ) の中のヒアドキュメントを読み違えるので、いったんファイルに書き出す
python3 - "$J" > "$J.dev" <<'PY'
import json, sys
ds = json.load(open(sys.argv[1]))['result']['devices']
can = lambda d: 'com.apple.coredevice.feature.installapp' in {c.get('featureIdentifier') for c in d.get('capabilities', [])}
ok = [d for d in ds if can(d) and d.get('connectionProperties', {}).get('transportType') in ('wired', 'localNetwork')]
ok.sort(key=lambda d: d['connectionProperties']['transportType'] != 'wired')
if ok: print(ok[0]['identifier'], ok[0].get('deviceProperties', {}).get('name', '').strip() or '(名前なし)')
PY
read -r DEV_ID DEV_NAME < "$J.dev" || true
rm -f "$J" "$J.dev"
[ -n "$DEV_ID" ] || { echo "アプリを入れられる iPhone が見つからない。ロック解除・「このコンピュータを信頼」・デベロッパモード（設定 → プライバシーとセキュリティ）を確かめて、もう一度"; exit 1; }
echo "iPhone: $DEV_NAME"

echo "ビルド中…"
xcodebuild -project suibu-ios/Suibu.xcodeproj -scheme Suibu -configuration "$CONFIG" \
  -destination 'generic/platform=iOS' -derivedDataPath "$DD" -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$TEAM" CODE_SIGN_STYLE=Automatic build 2>&1 | tail -25
xcrun devicectl device install app --device "$DEV_ID" "$DD/Build/Products/$CONFIG-iphoneos/Suibu.app"
xcrun devicectl device process launch --device "$DEV_ID" io.github.hy218355-bit.suibu >/dev/null \
  && echo "iPhone に入れて起動しました" \
  || echo "iPhone に入れました（自動で起動できなかったので、ロックを解除してアイコンから開いてください）"
