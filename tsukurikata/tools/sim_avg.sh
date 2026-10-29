#!/bin/bash
# 3年分の早送りを何回か回して、春の演奏会の出来・県大会の平均点・部員数の平均を出す（毎回少しずつ結果が変わるため）
#   bash tsukurikata/tools/sim_avg.sh <曲のid...>   回数は N=10（既定）
#   例：bash tsukurikata/tools/sim_avg.sh galop aida
set -euo pipefail
cd "$(dirname "$0")/../.."
N=${N:-10}
case "$N" in ''|*[!0-9]*|0) echo '回数Nは1以上の整数にしてください' >&2; exit 2;; esac
SIM_POLICY=${SIM_POLICY:-auto}
for pc in "$@"; do
  for i in $(seq "$N"); do SIM_RUN="$i" node tsukurikata/tools/sim.js 3 "$SIM_POLICY" "$pc" best | grep -E "県大会|新入生歓迎" | sed -E 's/.*出来 ([0-9]+)点.*/Q \1/; s/.*平均([0-9.]+) \{"部員":([0-9]+).*/C \1 \2/' | tr '\n' ' '; echo; done |
  awk -v p="$pc" -v n="$N" '{q=0; c=0; for(i=1;i<=NF;i++){ if($i=="Q"){Q[q++]+=$(i+1)} if($i=="C"){S[c]+=$(i+1); M[c++]+=$(i+2)} } k++; if(q!=3||c!=3)bad=1}
    END{if(bad||k!=n){print p "：3年分の結果か回数が不足しています" > "/dev/stderr"; exit 1} printf "%-10s（%d回）春の演奏会:", p, n; for(y=0;y<3;y++) printf " %.0f", Q[y]/k; printf "  県大会:"; for(y=0;y<3;y++) printf " %.1f点(%.1f人)", S[y]/k, M[y]/k; print ""}'
done
