"""LPの撮影原稿から、一覧用と報告用のPNGを作る。"""
from pathlib import Path
from PIL import Image

base = Path(__file__).resolve().parent / 'screenshots'
for i in range(1, 6):
    stem = f'{i:02}'
    with Image.open(base / f'{stem}-desktop-full.jpg') as source:
        source = source.convert('RGB')
        preview = source.crop((0, 0, source.width, min(900, source.height)))
        for colors in (256, 192, 128, 96):
            target = base / f'{stem}-desktop.png'
            preview.quantize(colors=colors).save(target, optimize=True)
            if target.stat().st_size < 200_000:
                break
        print(target.name, preview.size, target.stat().st_size)
    with Image.open(base / f'{stem}-mobile.jpg') as source:
        assert source.size == (375, 812), (stem, source.size)
        target = base / f'{stem}-mobile.png'
        source.convert('RGB').quantize(colors=256).save(target, optimize=True)
        print(target.name, source.size, target.stat().st_size)
