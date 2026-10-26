"""375pxの実ゲームの撮影を、単独PNGとライト・ダークの比較へ書き出す。"""
from pathlib import Path
from PIL import Image
base=Path(__file__).resolve().parent
out=base/'screenshots'
def save(im,target):
    for colors in (256,192,128,96,64,48,32):
        im.quantize(colors=colors).save(target,optimize=True)
        if target.stat().st_size<200000:return
    raise ValueError(str(target))
for source in out.glob('*.jpg'):
    im=Image.open(source).convert('RGB')
    assert im.size==(375,812),(source,im.size)
    save(im,source.with_suffix('.png'))
for name in ('intake','week','stage','members','log','member','consult','conduct','announce','grad'):
    left=Image.open(out/f'{name}-light.jpg').convert('RGB')
    right=Image.open(out/f'{name}-dark.jpg').convert('RGB')
    pair=Image.new('RGB',(750,812));pair.paste(left,(0,0));pair.paste(right,(375,0))
    save(pair,out/f'{name}-pair.png')
print('単独PNGと比較PNGを書き出した。最大',max(p.stat().st_size for p in out.glob('*.png')),'bytes')

