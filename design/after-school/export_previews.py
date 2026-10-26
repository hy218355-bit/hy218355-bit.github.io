"""ブラウザの撮影原稿を、提案用PNGとアイコンの縮小見本へ書き出す。"""
from pathlib import Path
from PIL import Image

base=Path(__file__).resolve().parent
for source in sorted((base/'screenshots').glob('*.jpg')):
    image=Image.open(source).convert('RGB')
    for colors in (256,192,128,96,64):
        target=source.with_suffix('.png')
        image.quantize(colors=colors).save(target,optimize=True)
        if target.stat().st_size < 200000:
            break
    if source.name=='app-icon-1024.jpg':
        assert image.size==(1024,1024),image.size
        image.quantize(colors=256).save(base/'assets/app-icon-1024.png',optimize=True)
        image.resize((60,60),Image.Resampling.LANCZOS).save(base/'assets/app-icon-60.png',optimize=True)
    print(target.name,image.size,target.stat().st_size)

for screen in ('week','stage','member','grad'):
    for theme in ('light','dark'):
        with Image.open(base/'screenshots'/f'{screen}-{theme}.png') as image:
            assert image.size==(375,812),(screen,theme,image.size)
