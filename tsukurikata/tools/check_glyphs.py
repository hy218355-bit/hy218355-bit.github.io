# 画面に出てくる字のうち、同梱のフォント（本文の Zen Kaku Gothic New）に入っていない字を調べる
# 使い方: python3 tsukurikata/tools/check_glyphs.py
# 文章を足したら確かめる。足りない字があれば tools/build_fonts.py でフォントを作り直す
# （いまわざと入っていないのは ▶♩♮⤓𝄪 の5つ。端末の標準フォントで出る）
import os, glob
from fontTools.ttLib import TTFont
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
src = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
src += ''.join(open(f, encoding='utf-8').read() for f in sorted(glob.glob(os.path.join(ROOT, 'js/**/*.js'), recursive=True)))
chars = {c for c in src if ord(c) > 0x7f}
for f in sorted(glob.glob(os.path.join(ROOT, 'fonts/zen-kaku-gothic-new-*.woff2'))):
    cmap = TTFont(f).getBestCmap()
    miss = sorted(c for c in chars if ord(c) not in cmap)
    print(os.path.basename(f), len(miss), ''.join(miss))
