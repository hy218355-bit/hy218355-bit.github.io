"""39人の原画を共有し、かわいい女子8人・かっこいい男子1人だけを差し替える。"""
from pathlib import Path
from PIL import Image
import json

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'tsukurikata/img/faces'
GENERATED = Path('/Users/yh/.codex/generated_images/01a175a5-1e3d-71b0-810a-8797cdde01e1')
SOURCES = [('classmates-01.webp', 'exec-3c1c56b5-ae88-4c4a-8e66-bd401a8066ad.png', 4, 3),
           ('classmates-02.webp', 'exec-0e784d25-a837-4adf-b9f5-a3a5801fa599.png', 4, 3),
           ('classmates-03.webp', 'exec-acab5355-1188-4b78-a9f0-0dc87cfb74cb.png', 5, 3),
           ('portraits-01.webp', 'exec-464d9f7a-e058-4ce7-9aca-b672dc8150fc.png', 4, 3),
           ('classmates-04.webp', 'exec-d041c999-d0f1-4eb0-8ec4-d3e432d35d3f.png', 2, 2)]
sheets=[]
for file, original, cols, rows in SOURCES:
    source = GENERATED / original
    image = Image.open(source).convert('RGB')
    target = OUT / file
    # 原画の画素数を保ち、減色パレットを使わず容量に収める。
    for quality in range(95, 39, -1):
        image.save(target, 'WEBP', quality=quality, method=6)
        if target.stat().st_size <= 200000:
            break
    else:
        raise ValueError(str(source))
    sheets.append({'file': file, 'width': image.width, 'height': image.height, 'cols': cols, 'rows': rows,
                   'quality': quality, 'bytes': target.stat().st_size, 'source': str(source)})
    print(file, quality, target.stat().st_size, flush=True)
cast=[]
for sheet, count in enumerate([12,12,15]):
    for cell in range(count):
        base=len(cast)
        cast.append({'base':base,'sheet':sheet,'cell':cell,'style':'male' if base in [0,4,9,11] else 'female','standout':False})
# 元の39人の中の9人だけ、前に描き直した原画へ入れ替える。
for base, cell in zip([1,3,6,8,14,17,21,28],[0,1,2,3,4,5,6,8]):
    cast[base].update(sheet=3,cell=cell,standout=True)
cast[9].update(sheet=3,cell=9,standout=True)
# 前の31人・8人の構成を保ち、男子の残りも自然な顔にする。
for cell,base in enumerate([12,19,24,35]):
    cast[base].update(sheet=4,cell=cell,style='male')
record={'version':'cast-balance-20261026-1','sheets':sheets,'cast':cast}
(OUT/'manifest.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
# ゲームではfetchを増やさず、同じ配役表を読み込む。
data={'version':record['version'],'sheets':[{k:s[k] for k in ['file','cols','rows']} for s in sheets],'cast':cast}
(ROOT/'tsukurikata/js/face-cast.js').write_text("'use strict';\n/* 39人の顔の配役。見た目だけの情報で、セーブには入れない。 */\nconst FACE_CAST="+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n')
for name in ['portraits-02.webp','portraits-03.webp']:
    (OUT/name).unlink(missing_ok=True)
