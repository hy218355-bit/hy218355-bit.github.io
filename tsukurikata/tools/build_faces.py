"""整った9人の原画を保ち、ほか30人を素朴な新原画にする。"""
from pathlib import Path
from PIL import Image
from io import BytesIO
import json
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'tsukurikata/img/faces'
GENERATED=Path('/Users/yh/.codex/generated_images/01a175a5-1e3d-71b0-810a-8797cdde01e1')
previous=json.loads((OUT/'manifest.json').read_text())
SOURCES=[('plain-01.webp','exec-c0a8884f-353a-40c3-b144-ad278fc30867.png'),('plain-02.webp','exec-76534552-bc9b-4186-915a-fc87f29e9afa.png'),('plain-03.webp','exec-7310a454-cd3a-43c1-858a-3d659c499b6c.png')]
sheets=[]
for file,original in SOURCES:
    source=GENERATED/original
    image=Image.open(source).convert('RGB')
    low,high=40,95
    best=None
    # 最大6回ほどの比較で、容量に収まるいちばん高い品質を探す。
    while low<=high:
        quality=(low+high)//2
        buffer=BytesIO();image.save(buffer,'WEBP',quality=quality,method=6)
        if buffer.tell()<=200000:
            best=(quality,buffer.getvalue());low=quality+1
        else:high=quality-1
    if best is None:raise ValueError(str(source))
    quality,data=best;(OUT/file).write_bytes(data)
    sheets.append({'file':file,'width':image.width,'height':image.height,'cols':5,'rows':2,'quality':quality,'bytes':len(data),'source':str(source)})
    print(file,quality,len(data),flush=True)
# 8人の女子と1人の男子の原画は、圧縮し直さず、そのまま使う。
sheets.append(next(s for s in previous['sheets'] if s['file']=='portraits-01.webp'))
cast=previous['cast']
female=[f for f in cast if not f['standout'] and f['style']=='female']
male=[f for f in cast if not f['standout'] and f['style']=='male']
for i,f in enumerate(female):f.update(sheet=i//10,cell=i%10)
for i,f in enumerate(male):f.update(sheet=2,cell=i+3)
for f in cast:
    if f['standout']:f['sheet']=3
record={'version':'stage-faces-20261026-2','sheets':sheets,'cast':cast}
(OUT/'manifest.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
data={'version':record['version'],'sheets':[{k:s[k] for k in ['file','cols','rows']} for s in sheets],'cast':cast}
(ROOT/'tsukurikata/js/face-cast.js').write_text("'use strict';\n/* 39人の顔の配役。見た目だけの情報で、セーブには入れない。 */\nconst FACE_CAST="+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n')
for file in OUT.glob('classmates-*.webp'):file.unlink()
