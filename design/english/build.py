#!/usr/bin/env python3
# 原稿の番号を日本語の原文へ戻し、オフライン用の辞書を生成する。
from pathlib import Path
import json,re
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
source=json.loads((HERE/'source-strings.json').read_text());translated={}
for p in sorted(HERE.glob('en-*.json')):
 for k,v in json.loads(p.read_text()).items():
  if k in translated:raise ValueError('翻訳番号が重複: '+k)
  translated[k]=v
ignored={119,120,160,161,1025,1196,1298,1672,1673,1674}
missing=[i for i in range(len(source)) if str(i) not in translated and i not in ignored]
if missing:raise ValueError('未翻訳: '+str(missing))
out={source[int(i)]:v for i,v in translated.items()}
out.update({
 '{0}年・{1}':'Year {0} · {1}',
 '{0}の今週の練習を見る':"View {0}'s practice this week",
 '言語':'Language',
 '設定（言語・効果音・演出）':'Settings · language, sound and effects',
 '録音を書き出しています… 0%':'Exporting audio… 0%',
 '録音を書き出しています… {0}%':'Exporting audio… {0}%',
 '保存の準備をしています…':'Preparing to save…',
 '書き出しました':'Export ready',
 '保存できなかった':'Could not save',
 '保存できませんでした。':'Could not save.',
 '{0}で録音':'Recorded at {0}',
 '{0}さん':'{0}',
 '{0}先輩':'{0}',
 '{0}年生':'Year {0}',
 '{0}文字':'{0} characters',
 '{0}席':'{0} seats',
 'フルート':'Flute','クラリネット':'Clarinet','サックス':'Saxophone','トランペット':'Trumpet','ホルン':'Horn','トロンボーン':'Trombone',
})
out.update(json.loads((HERE/'extra.json').read_text()))
# 元の文にない変数を参照すると、名前や数値が抜けるので生成を止める。
for ja,en in out.items():
 if not isinstance(en,str):raise ValueError(ja)
 if not set(re.findall(r'\{\d+\}',en)).issubset(set(re.findall(r'\{\d+\}',ja))):raise ValueError('変数の不一致: '+ja)
p=ROOT/'tsukurikata/js/i18n-en.js'
(ROOT/'tsukurikata/js/i18n.js').write_text((HERE/'i18n.js').read_text())
p.write_text("'use strict';\n/* 英語の表示用原稿。design/english/build.pyで生成する。 */\nwindow.TSUKURIKATA_EN="+json.dumps(out,ensure_ascii=False,separators=(',',':'))+';\nwindow.SUIBU_SCHOOL_FRAGMENTS='+json.dumps([source[i] for i in range(1748,1781)],ensure_ascii=False,separators=(',',':'))+';\n')
(HERE/'translation-check.json').write_text(json.dumps({'catalog':len(source),'translated':len(translated),'nonDisplayOrNamePools':sorted(ignored),'entries':len(out),'bytes':p.stat().st_size},ensure_ascii=False,indent=2)+'\n')
print('英語の原稿',len(out),'件',p.stat().st_size,'bytes')
