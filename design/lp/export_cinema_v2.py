"""②案改善版の撮影原稿を、比較用の画像に書き出す。"""
from pathlib import Path
from PIL import Image

base = Path(__file__).resolve().parent / 'screenshots'
with Image.open(base / 'cinema-v2-desktop-full.jpg') as source:
    image = source.convert('RGB')
    cover = image.crop((0, 0, image.width, min(900, image.height)))
    cover.save(base / 'cinema-v2-desktop.jpg', quality=92, optimize=True)
    for colors in (256, 192, 128, 96, 64):
        target = base / 'cinema-v2-desktop.png'
        cover.quantize(colors=colors).save(target, optimize=True)
        if target.stat().st_size < 200_000:
            break
with Image.open(base / 'cinema-v2-mobile.jpg') as source:
    assert source.size == (375, 812), source.size
    source.convert('RGB').quantize(colors=256).save(base / 'cinema-v2-mobile.png', optimize=True)
for name in ('cinema-v2-desktop.jpg', 'cinema-v2-desktop.png', 'cinema-v2-mobile.png'):
    path = base / name
    with Image.open(path) as image:
        print(name, image.size, path.stat().st_size)
