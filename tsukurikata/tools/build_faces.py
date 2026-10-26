"""承認済みの39人を保ち、新原画を追加して100人の顔候補を作る。"""
from pathlib import Path
from PIL import Image
from io import BytesIO
import json
import sys
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'tsukurikata/img/faces'
specs = json.loads(Path(sys.argv[1]).read_text())
previous = json.loads((OUT / 'manifest.json').read_text())
sheets, cast = previous['sheets'][:4], previous['cast'][:39]
for spec in specs:
    source = Path(spec['source'])
    picture = Image.open(source).convert('RGB')
    low, high, best = 40, 95, None
    # 原画の画素数を保ち、200KB以内でいちばん高い圧縮品質にする。
    while low <= high:
        quality = (low + high) // 2
        buffer = BytesIO()
        picture.save(buffer, 'WEBP', quality=quality, method=6)
        if buffer.tell() <= 200000:
            best = (quality, buffer.getvalue())
            low = quality + 1
        else:
            high = quality - 1
    if best is None:
        raise ValueError(str(source))
    quality, data = best
    (OUT / spec['file']).write_bytes(data)
    index = len(sheets)
    sheets.append(dict(file=spec['file'], width=picture.width, height=picture.height,
                       cols=spec['cols'], rows=spec['rows'], quality=quality,
                       bytes=len(data), source=str(source)))
    for cell in range(spec['cols'] * spec['rows']):
        traits = spec.get('cells', [{}] * 10)[cell]
        cast.append(dict(base=len(cast), sheet=index, cell=cell,
                         style=traits.get('style', spec['style']),
                         standout=traits.get('standout', spec['standout'])))
    print(spec['file'], quality, len(data), flush=True)
# 同じ承認済み原画に描かれ、まだ使っていなかった男子一人も候補に加える。
cast.append(dict(base=len(cast), sheet=3, cell=10, style='male', standout=True))
assert len(cast) == 100
record = dict(version='cast100-20261026-1', sheets=sheets, cast=cast)
(OUT / 'manifest.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
data = dict(version=record['version'], sheets=[{k: s[k] for k in ['file', 'cols', 'rows']} for s in sheets], cast=cast)
(ROOT / 'tsukurikata/js/face-cast.js').write_text("'use strict';\n/* 100人の顔候補。見た目だけの情報で、セーブには入れない。 */\nconst FACE_CAST=" + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
