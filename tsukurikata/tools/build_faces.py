"""新しい顔の原画を、減色パレットを使わずWebPへ圧縮する。切り分けずCSSで表示する。"""
from pathlib import Path
from PIL import Image
import json
import sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'tsukurikata/img/faces'
OUT.mkdir(parents=True, exist_ok=True)
if len(sys.argv) != 4:
    raise SystemExit('使い方: python3 tsukurikata/tools/build_faces.py 原画1.png 原画2.png 原画3.png')
manifest = []
offset = 0
for number, (source, cols, female) in enumerate(zip(sys.argv[1:], [4, 4, 5], [9, 10, 12]), 1):
    image = Image.open(source).convert('RGB')
    target = OUT / f'portraits-{number:02d}.webp'
    # 元の画素数を保ち、容量に収まる範囲でいちばん高い品質を使う。
    for quality in range(95, 39, -1):
        image.save(target, 'WEBP', quality=quality, method=6)
        if target.stat().st_size <= 200000:
            break
    else:
        raise ValueError('原画のまま200KBに収まらない: ' + str(source))
    manifest.append({'file': target.name, 'width': image.width, 'height': image.height,
                     'cols': cols, 'rows': 3, 'female': female, 'male': cols * 3 - female,
                     'offset': offset, 'quality': quality, 'bytes': target.stat().st_size,
                     'source': str(Path(source).resolve())})
    offset += cols * 3
    print(target.name, image.size, quality, target.stat().st_size, flush=True)
(OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
