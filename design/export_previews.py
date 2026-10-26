"""ブラウザで保存したスクリーンショットを、報告用PNGに整える。"""
from pathlib import Path
from PIL import Image

base = Path(__file__).resolve().parent
for source in sorted((base / 'screenshots').glob('*.jpg')):
    image = Image.open(source).convert('RGB')
    image.quantize(colors=128).save(source.with_suffix('.png'), optimize=True)
    if source.name.startswith('icon-'):
        letter = source.name.split('-')[1]
        image.quantize(colors=128).save(base / 'icons' / f'{letter}-1024.png', optimize=True)
        image.resize((60, 60), Image.Resampling.LANCZOS).save(base / 'icons' / f'{letter}-60.png', optimize=True)

for p in sorted(base.rglob('*.png')):
    with Image.open(p) as image:
        print(f'{p.relative_to(base)}: {image.width}×{image.height}, {p.stat().st_size:,} bytes')
