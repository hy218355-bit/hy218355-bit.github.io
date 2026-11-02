#!/usr/bin/env python3
"""自作SVGの書き出しから、サイズ別の画像と比較用の見本を作る。製品ファイルは変更しない。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json
import unicodedata

ROOT=Path(__file__).resolve().parent
fonts=list(Path('/System/Library/Fonts').glob('*.ttc'))
font_path=next(p for p in fonts if unicodedata.normalize('NFC',p.name)=='ヒラギノ角ゴシック W3.ttc')
font=lambda n: ImageFont.truetype(str(font_path),n)
data=[('a','A','放課後のトランペット','楽器が伝わる、すっきりした一枚。'),('b','B','ふたつの音','クリーム色に、深緑とキャメル。'),('c','C','音楽室の窓','夕方の音楽室を、小さな風景に。')]
sizes={}
for key,_,_,_ in data:
    im=Image.open(ROOT/f'{key}.png').convert('RGB')
    im.save(ROOT/f'{key}.png',optimize=True)
    for n in [256,180,64,60]:
        im.resize((n,n),Image.Resampling.LANCZOS).save(ROOT/f'{key}-{n}.png',optimize=True)
    sizes[key]=(ROOT/f'{key}.png').stat().st_size
    assert sizes[key]<200*1024

board=Image.new('RGB',(1080,648),'#F4F1E9')
draw=ImageDraw.Draw(board)
draw.text((36,26),'吹奏楽部のつくりかた',font=font(26),fill='#243E41')
draw.text((36,65),'APP ICON  /  余白とやわらかい色で、3つの方向。',font=font(13),fill='#69746C')
for i,(key,letter,title,desc) in enumerate(data):
    x=36+i*352
    draw.text((x,108),f'{letter}  {title}',font=font(19),fill='#243E41')
    im=Image.open(ROOT/f'{key}.png').convert('RGB').resize((280,280),Image.Resampling.LANCZOS)
    mask=Image.new('L',(280,280));ImageDraw.Draw(mask).rounded_rectangle((0,0,279,279),radius=63,fill=255)
    board.paste(im,(x+14,150),mask)
    draw.text((x,450),desc,font=font(13),fill='#57665F')
    draw.text((x,486),'ホーム画面に近い60px',font=font(12),fill='#69746C')
    draw.rounded_rectangle((x,512,x+144,622),radius=16,fill='#E9E7DB')
    draw.rounded_rectangle((x+154,512,x+298,622),radius=16,fill='#172D32')
    small=Image.open(ROOT/f'{key}-60.png').convert('RGB')
    m=Image.new('L',(60,60));ImageDraw.Draw(m).rounded_rectangle((0,0,59,59),radius=14,fill=255)
    board.paste(small,(x+42,525),m);board.paste(small,(x+196,525),m)
    draw.text((x+55,596),'LIGHT',font=font(9),fill='#67746B')
    draw.text((x+211,596),'DARK',font=font(9),fill='#B8C6BB')
board.save(ROOT/'comparison.png',optimize=True)
(ROOT/'sources.json').write_text(json.dumps({'制作日':'2026-11-02','方式':'自作SVG。macOS標準のNSImageでPNG化。製品のアイコンは未変更。','外部素材':'なし','ダウンロード':'なし','1024px画像のバイト数':sizes},ensure_ascii=False,indent=2)+'\n')
