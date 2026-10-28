# 現在のソースに対する検査と、実ブラウザの完成確認を照合する。
from pathlib import Path
import json
from PIL import Image
folder=Path(__file__).resolve().parent
read=lambda f:json.loads((folder/f).read_text())
checks=read('checks.json');assert len(checks)==39 and all(c['exit']==0 for c in checks)
summary=read('summary.json');assert summary['screenshots']==24
for view in summary['views']:
 for theme in ['light','dark']:
  name=view['key']+'-'+theme;r=read(name+'.json')
  assert r['theme']==theme and r['width']==r['scrollWidth']==375
  assert r['boot']['loaded']==r['boot']['scripts']==33 and not r['boot']['failed'] and not r['boot']['errors']
  assert all(len(x)==1 and x in 'GFEDCBAS' for x in r['rankText'])
  assert r['cache']['images']<=10 and r['cache']['stamps']<=100
  assert all(x.startswith('http://127.0.0.1:8005/') for x in r['scriptSources'])
  assert all(x=='none' or x.startswith('url("http://127.0.0.1:8005/') for x in r['imageSources'])
  if view['key'] in ['stage','watch','conduct']:assert r['stagePortraits']==39
  if view['key']=='watch':assert r['watchPortraits']==39
  if view['key']=='conduct':
   assert r['conduct']['phase']=='count' and r['focus']['inside']
   assert all(x['inert'] for x in r['focus']['background'] if x['id'] in ['app','mini','tabbar'])
  if view['key']=='grad':assert r['gradOpen'] and r['selectedGraduate'] is not None
  image=Image.open(folder/'screenshots'/(name+'.png'));assert image.size==(375,812) and image.format=='PNG'
lines=read('practice-lines.json');assert len(lines)==5
assert all(x['nameHeight']<=float(x['lineHeight'].removesuffix('px'))+.1 for x in lines)
assert read('console-check.json')['current']==[]
assets=read('assets.json');assert len(assets['faces'])==10 and all(f['bytes']<=200000 for f in assets['faces'])
assert [x['size'] for x in assets['icons']]==[[180,180],[64,64],[1024,1024]]
assert all(x['mode']=='RGB' for x in assets['icons'])
assert assets['creditsPresent'] and len(assets['fontLicenses'])==4
native=json.loads((folder.parent/'native-export/native-check.json').read_text())
assert native['buildSucceeded'] and all(f['match'] for f in native['files'])
assert read('signature.json')['exit']==0
assert not native['installed'] and read('device-status.json')['installableCount']==0
print('39検査成功／375pxの24画面／横はみ出しなし／名前一行／G〜S／顔100候補と使い回し／本番39人／指揮の操作範囲／卒業式／ローカル素材／アイコン寸法・透過なし／出典／現行ソースのiOSビルド：確認済み。実機導入・起動は接続待ち。')
