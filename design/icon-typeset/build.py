#!/usr/bin/env python3
"""既存の実フォントの輪郭と自作の線画でアイコンを組む。画像生成・外部取得なし。"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
import html

ROOT=Path(__file__).resolve().parents[2]
OUT=Path(__file__).resolve().parent
font_body=TTFont(ROOT/'tsukurikata/fonts/zen-kaku-gothic-new-500.woff2')
font_hand=TTFont(ROOT/'tsukurikata/fonts/klee-one-600.woff2')

def lettering(text,font,size,baseline,fill,tracking=0):
    glyphs=font.getGlyphSet();cmap=font.getBestCmap();units=font['head'].unitsPerEm
    widths=[font['hmtx'][cmap[ord(c)]][0]*size/units for c in text]
    width=sum(widths)+tracking*(len(text)-1)
    x=(1024-width)/2
    paths=[]
    for c,w in zip(text,widths):
        pen=SVGPathPen(glyphs);glyphs[cmap[ord(c)]].draw(pen)
        paths.append(f'<path d="{pen.getCommands()}" transform="translate({x:.3f} {baseline}) scale({size/units:.6f} {-size/units:.6f})" fill="{fill}"/>')
        x+=w+tracking
    return '\n'.join(paths)

# 縮小しても形が残る太さへ整理し、写真の質感を使わず管とベルを描く。
instrument='''
<g transform="rotate(-8 512 700) translate(0 106)" stroke-linecap="round" stroke-linejoin="round">
<path d="M440 647H313c-43 0-74-31-74-75s31-75 74-75h371" fill="none" stroke="{ink}" stroke-width="20"/>
<path d="M676 497c87 0 135-32 201-76v174c-66-44-114-78-201-78z" fill="{ink}"/>
<path d="M854 438v140" fill="none" stroke="{brass}" stroke-width="12"/>
<path d="M442 619h-53c-24 0-39 15-39 33s15 33 39 33h53" fill="none" stroke="{ink}" stroke-width="18"/>
<path d="M550 657H357c-28 0-44 18-44 43s16 43 44 43h193" fill="none" stroke="{ink}" stroke-width="18"/>
<path d="M207 571h553c40 0 62 25 62 56s-22 58-62 58H551" fill="none" stroke="{ink}" stroke-width="20"/>
<path d="M159 554h20l25 10v14l-25 10h-20z" fill="{ink}"/>
<path d="M149 550v42" fill="none" stroke="{ink}" stroke-width="12"/>
<path d="M431 526h22v179h-22zm55 0h22v179h-22zm55 0h22v179h-22z" fill="{paper}" stroke="{ink}" stroke-width="13"/>
<path d="M442 520v-39m55 39v-39m55 39v-39" fill="none" stroke="{ink}" stroke-width="12"/>
<path d="M426 475h32m23 0h32m23 0h32" fill="none" stroke="{brass}" stroke-width="14"/>
<path d="M428 710h28m27 0h28m27 0h28" fill="none" stroke="{ink}" stroke-width="12"/>
</g>
'''

def make(name,paper,ink,brass):
    body=f'''<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><title>吹奏楽部のつくりかた・活字と線画</title><path d="M0 0h1024v1024H0z" fill="{paper}"/>
'''
    body+=lettering('吹奏楽部',font_hand,188,316,ink,3)
    body+=lettering('のつくりかた',font_body,63,418,ink,4)
    body+=f'<path d="M474 479h76" stroke="{brass}" stroke-width="8" stroke-linecap="round"/>'
    body+=instrument.format(paper=paper,ink=ink,brass=brass)
    body+='</svg>\n'
    (OUT/f'{name}.svg').write_text(body)

make('paper','#F1EBDD','#1E3844','#AB733C')
make('navy','#1B3542','#F3EDDE','#C89A5C')
print('活字と線画のSVGを作成しました。')
