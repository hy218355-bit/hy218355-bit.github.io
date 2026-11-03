#!/usr/bin/env python3
# 撮影専用のシミュレータとアプリのコピーを使う。製品・実機・実際のセーブは変更しない。
import argparse, hashlib, json, shutil, subprocess, time
from pathlib import Path
from PIL import Image
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
BUILT=Path('/private/tmp/tsukurikata-store-sim/Build/Products/Debug-iphonesimulator/Tsukurikata.app')
COPY=Path('/private/tmp/tsukurikata-english-capture/Tsukurikata.app')
BUNDLE='io.github.hy218355-bit.tsukurikata'
def run(*args,check=True,timeout=60):
 return subprocess.run(args,check=check,timeout=timeout,capture_output=True,text=True)
def prepare():
 if COPY.exists(): shutil.rmtree(COPY)
 shutil.copytree(BUILT,COPY)
 js=(HERE/'capture.js').read_text().replace('__FIXTURE__',(HERE.parent/'app-store/fixture.json').read_text())
 (COPY/'selftest.js').write_text(js)
 files=list((ROOT/'tsukurikata').rglob('*'))
 checked=0
 for src in files:
  if src.is_file():
   dst=COPY/'Game/tsukurikata'/src.relative_to(ROOT/'tsukurikata')
   if not dst.is_file() or hashlib.sha256(src.read_bytes()).digest()!=hashlib.sha256(dst.read_bytes()).digest():
    raise RuntimeError('同梱ゲームが一致しません: '+str(src))
   checked+=1
 return checked
p=argparse.ArgumentParser();p.add_argument('--device',required=True);p.add_argument('--name',required=True);p.add_argument('--shots',nargs='+',default=['week:light','play:light','members:light','member:light','play:dark']);args=p.parse_args()
checked=prepare()
run('xcrun','simctl','install',args.device,str(COPY),timeout=120)
run('xcrun','simctl','status_bar',args.device,'override','--time','9:41','--batteryState','charged','--batteryLevel','100','--cellularBars','4','--wifiBars','3')
out=HERE/'screenshots';out.mkdir(exist_ok=True)
manifest=[]
for spec in args.shots:
 scene,theme=spec.split(':');name=f'{args.name}-{scene}-{theme}'
 run('xcrun','simctl','terminate',args.device,BUNDLE,check=False)
 run('xcrun','simctl','ui',args.device,'appearance',theme)
 data=Path(run('xcrun','simctl','get_app_container',args.device,BUNDLE,'data').stdout.strip())
 report=data/'Documents/selftest.txt';report.unlink(missing_ok=True)
 result=run('xcrun','simctl','launch',args.device,BUNDLE,'-selftest','-tab',scene)
 deadline=time.monotonic()+100;logs=''
 while time.monotonic()<deadline:
  logs=report.read_text() if report.exists() else ''
  if 'CAPTURE_FAILED' in logs or '[web] error:' in logs or '[web] rejection:' in logs:raise RuntimeError(logs)
  lines=[x for x in logs.splitlines() if 'CAPTURE_READY ' in x]
  if lines:break
  time.sleep(.5)
 else:raise RuntimeError('撮影の準備が時間切れ: '+logs)
 meta=json.loads(lines[-1].split('CAPTURE_READY ',1)[1])
 if meta['scrollWidth']>meta['width'] or meta['brokenImages']:raise RuntimeError(str(meta))
 run('xcrun','simctl','io',args.device,'screenshot',str(out/(name+'.png')))
 # App Storeはアルファチャンネルを受け付けないため、見た目を保ってRGBで保存する。
 Image.open(out/(name+'.png')).convert('RGB').save(out/(name+'.png'))
 (out/(name+'.log')).write_text(logs)
 meta.update(file=name+'.png',matchingGameResources=checked)
 manifest.append(meta);print(json.dumps({k:v for k,v in meta.items() if k!='texts'},ensure_ascii=False),flush=True)
 run('xcrun','simctl','terminate',args.device,BUNDLE,check=False)
(HERE/(args.name+'-checks.json')).write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
