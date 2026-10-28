# ブラウザの実画面と確認用の端末受け渡しから得た記録を照合する。
from pathlib import Path
import json
folder=Path(__file__).resolve().parent
read=lambda name:json.loads((folder/(name+'.json')).read_text())
before=read('baseline')
assert before['messages'] and not before['acknowledgements'] and not before['saving']
assert all(not b['disabled'] for b in before['buttons'])
names=['waiting-light','wrong-notice','completed','waiting-dark','failed','motion-full','motion-short','motion-off','retried']
rows=[read(name) for name in names]
assert len({r['export']['state'] for r in rows})==1
assert len({r['export']['records'] for r in rows})==1
for r in rows:
 assert r['width']==r['scrollWidth']==375
 assert r['boot']['scripts']==r['boot']['loaded']==33
 assert not r['boot']['failed'] and not r['boot']['errors']
 if not r['export']['toastHidden']:
  assert r['toast']['left']>=16 and r['toast']['right']<=359
  assert r['toast']['bottom']<r['tabs']['top']
 assert all(b['rect']['width']>=44 and b['rect']['height']>=44 for b in r['buttons'])
for name in ['waiting-light','waiting-dark','wrong-notice','motion-full','motion-short','motion-off']:
 r=read(name)['export'];assert r['saving'] and r['librarySaving']
 assert all(b['disabled'] for b in r['buttons'])
 assert sum(b['busy']=='true' for b in r['buttons'])==1
 assert all((b['saving']=='true')==(b['busy']=='true') for b in r['buttons'])
 assert any(b['label'].endswith('を保存中') for b in r['buttons'])
assert len(read('wrong-notice')['export']['messages'])==len(read('waiting-light')['export']['messages'])==3
for name in ['completed','failed','retried']:
 r=read(name)['export'];assert not r['saving'] and r['librarySaving'] is None
 assert all(not b['disabled'] and b['busy']=='false' for b in r['buttons'])
assert read('completed')['export']['toastHidden']
assert '書き出せませんでした' in read('failed')['export']['toast']
assert read('retried')['export']['toastHidden']
for name in ['motion-short','motion-off']:
 assert all(b['animation']=='none' for b in read(name)['buttons'])
assert sum(b['animation']=='fxspin' for b in read('motion-full')['buttons'])==1
result=[read(n) for n in ['result-waiting','result-closed-waiting','result-finished']]
assert len({r['export']['state'] for r in result})==1
assert len({r['export']['records'] for r in result})==1
assert result[0]['export']['saving'] and result[1]['export']['saving'] and not result[2]['export']['saving']
controls=read('result-controls')
assert controls['disabled'] and controls['busy']=='true' and controls['toastInside']
assert controls['toast']['left']>=0 and controls['toast']['right']<=375
ready=read('browser-ready')
assert ready['inside'] and ready['saveEnabled'] and ready['button']['height']>=44
assert ready['toast']['left']>=16 and ready['toast']['right']<=359
assert ready['width']==ready['scrollWidth']==375
year=read('year-check');assert year['year']==2027 and year['steps']==49
assert not year['boot']['failed'] and not year['boot']['errors']
assert read('console-check')==[]
native=read('native-check');assert native['buildSucceeded'] and all(f['match'] for f in native['files'])
assert not native['mirroringUsed']
print('保存中の保持／完了通知の照合／成功・失敗・再試行／保存中だけの印／演出3設定／指揮結果と閉じた後の完了／ブラウザの44px保存操作／部と録音の不変／375px両テーマ・49操作で新年度／iOSビルドと同梱一致：確認済み。実機への導入は端末不在のため未完了。')
