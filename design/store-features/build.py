#!/usr/bin/env python3
"""実画面に見出しを添え、掲載用の画像と確認ページを生成する。"""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
FONTS = Path('/System/Library/Fonts')
INK = '#203d47'
PAPER = '#f3f0e7'
BRASS = '#b8914c'
COPY = {
 'ja': [
  ('音で育てる、吹奏楽部。', ['育てたぶんだけ、', '音が変わる。'], '練習の成果を、実際の合奏で聴こう。', 'play'),
  ('ひとりひとりに、物語。', ['この子の成長が、', 'うれしくなる。'], '得意も苦手も違う部員を、あなたの指導で。', 'member'),
  ('一週間ずつ、うまくなる。', ['今日の練習が、', '明日の音に。'], '基礎・譜読み・合奏。ひとりずつ練習を選ぼう。', 'week'),
  ('あなたがつくる、あなたの部。', ['どんな部にするか、', 'あなた次第。'], '楽器とメンバーを選び、ひとつの音をつくろう。', 'members'),
  ('音も、思い出も、残して。', ['卒業しても、', 'この音は残る。'], '成長を振り返り、録音であの日の演奏をもう一度。', 'graduation'),
 ],
 'en': [
  ('A SCHOOL BAND, SHAPED BY YOU', ['Grow your band.', 'Hear the change.'], 'Hear your practice come to life in every performance.', 'play'),
  ('EVERY MEMBER HAS A STORY', ['Little steps.', 'Big moments.'], 'Help each musician grow, one practice at a time.', 'member'),
  ('MAKE EVERY WEEK COUNT', ['Today’s practice.', 'Tomorrow’s sound.'], 'Choose fundamentals, score reading or band rehearsal.', 'week'),
  ('YOUR MEMBERS. YOUR SOUND.', ['Your band.', 'Your way.'], 'Choose the instruments and musicians that shape your sound.', 'members'),
  ('KEEP THE SOUND. KEEP THE MEMORIES.', ['They graduate.', 'The music stays.'], 'Look back on their growth. Replay the moments you made.', 'graduation'),
 ]
}

def font(lang, size, bold=False):
 if lang == 'ja':
  name = 'ヒラギノ角ゴシック W7.ttc' if bold else 'ヒラギノ角ゴシック W3.ttc'
  return ImageFont.truetype(str(FONTS/name), int(size))
 return ImageFont.truetype(str(FONTS/'Avenir Next.ttc'), int(size), index=0 if bold else 7)

def text(draw, pos, content, lang, size, color, bold=False, max_width=None):
 f = font(lang, size, bold)
 if max_width:
  while draw.textlength(content, font=f) > max_width:
   size -= 1
   f = font(lang, size, bold)
 assert size >= 26, '文字を小さくしすぎない'
 draw.text(pos, content, font=f, fill=color, anchor='lt')
 return size

def make(lang, device, number):
 eyebrow, headline, sub, scene = COPY[lang][number-1]
 src = HERE/'screenshots'/f'{lang}-{device}-{scene}-light.png'
 shot = Image.open(src).convert('RGB')
 w, h = (1206,2622) if device == 'iphone' else (2064,2752)
 assert shot.size == (w,h)
 dark = number in (1,5)
 bg = INK if dark else (PAPER if number != 4 else '#e6edea')
 fg = '#fffaf0' if dark else INK
 muted = '#d6ded8' if dark else '#52676d'
 im = Image.new('RGB',(w,h),bg)
 d = ImageDraw.Draw(im)
 pad = 100 if device == 'iphone' else 150
 # 紙と真鍮色の細い線を、ゲームのアイコンと共通の目印にする。
 d.line((pad,94,w-pad,94),fill=BRASS,width=3)
 text(d,(pad,132),eyebrow,lang,31 if device=='iphone' else 41,BRASS,True,max_width=w-2*pad-110)
 text(d,(w-pad-70,132),f'{number:02d}', 'en',32 if device=='iphone' else 42,BRASS,True)
 y = 242 if device == 'iphone' else 245
 size = 112 if device == 'iphone' else 145
 for line in headline:
  text(d,(pad,y),line,lang,size,fg,True,max_width=w-2*pad)
  y += 143 if device == 'iphone' else 175
 # 説明は一行。実画面の中に文を足したり、存在しない操作を描いたりしない。
 text(d,(pad,y+20),sub,lang,38 if device=='iphone' else 51,muted,max_width=w-2*pad)
 crop = None
 if device == 'ipad':
  # 余白が広いiPadでは、実画面の該当部分を切り出して大きく見せる。
  crop = {'play':(30,300,2030,2410),'member':(30,175,2030,1840),'week':(1320,175,2005,1360),'members':(30,70,2030,2300),'graduation':(470,730,1590,1935)}[scene]
  shot = shot.crop(crop)
 sw = 850 if device == 'iphone' else (1100 if scene == 'week' else 1460 if scene == 'graduation' else 1764)
 sh = round(shot.height*sw/shot.width)
 x = (w-sw)//2
 sy = 680 if device == 'iphone' else (850 if scene in ('member','graduation') else 700)
 border = 15 if device == 'iphone' else 20
 rad = 62 if device == 'iphone' else 38
 box = (x-border,sy-border,x+sw+border,sy+sh+border)
 shadow = Image.new('RGBA',(w,h))
 ImageDraw.Draw(shadow).rounded_rectangle((box[0],box[1]+30,box[2],box[3]+30),rad,fill=(0,0,0,80))
 im = Image.alpha_composite(im.convert('RGBA'),shadow.filter(ImageFilter.GaussianBlur(35)))
 d = ImageDraw.Draw(im)
 d.rounded_rectangle(box,rad,fill='#142b32',outline='#75827d',width=2)
 resized = shot.resize((sw,sh),Image.Resampling.LANCZOS)
 mask = Image.new('L',(sw,sh))
 ImageDraw.Draw(mask).rounded_rectangle((0,0,sw-1,sh-1),rad-border,fill=255)
 im.paste(resized,(x,sy),mask)
 if device == 'ipad':
  text(ImageDraw.Draw(im),(pad,2674),'実際のiPad画面の一部を拡大' if lang=='ja' else 'Detail from the actual iPad app',lang,28,muted)
 out = HERE/'exports'/f'{lang}-{device}-{number:02d}-{scene}.png'
 out.parent.mkdir(exist_ok=True)
 im.convert('RGB').save(out,optimize=True)
 with Image.open(out) as check:
  assert check.mode == 'RGB' and check.size == (w,h)
 return dict(file=str(out.relative_to(HERE)),source=str(src.relative_to(HERE)),sourceCrop=crop,language=lang,device=device,order=number,headline=' '.join(headline),description=sub,width=w,height=h,bytes=out.stat().st_size,sha256=hashlib.sha256(out.read_bytes()).hexdigest())

manifest = [make(lang,device,n) for lang in ('ja','en') for device in ('iphone','ipad') for n in range(1,6)]
(HERE/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
for lang in ('ja','en'):
 for device in ('iphone','ipad'):
  rows = [m for m in manifest if m['language']==lang and m['device']==device]
  thumb_w = 300
  thumb_h = round(rows[0]['height']*thumb_w/rows[0]['width'])
  sheet = Image.new('RGB',(5*thumb_w+6*16,thumb_h+32),'#deded5')
  for i,m in enumerate(rows):
   sheet.paste(Image.open(HERE/m['file']).resize((thumb_w,thumb_h),Image.Resampling.LANCZOS),(16+i*(thumb_w+16),16))
  sheet.save(HERE/f'{lang}-{device}-overview.jpg',quality=94)
sections = ''
for lang in ('ja','en'):
 for device in ('iphone','ipad'):
  cards = ''.join(f'<a href="{m["file"]}"><img src="{m["file"]}" alt="{m["headline"]}" loading="lazy"><span>{m["order"]}. {m["headline"]}</span></a>' for m in manifest if m['language']==lang and m['device']==device)
  sections += f'<section><h2>{"日本語" if lang=="ja" else "English"} · {"iPhone" if device=="iphone" else "iPad"}</h2><div class="grid">{cards}</div></section>'
(HERE/'index.html').write_text('''<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>吹奏楽部のつくりかた — App Store掲載画像</title><style>
:root[data-theme="light"]{--bg:#f3f0e7;--ink:#203d47;--card:#fffaf0}:root[data-theme="dark"]{--bg:#14272f;--ink:#f3f0e7;--card:#203d47}button{font:inherit;padding:10px 16px;margin:4px;border:1px solid #b8914c;background:var(--card);color:var(--ink);border-radius:8px;cursor:pointer}:root{color-scheme:light dark;--bg:#f3f0e7;--ink:#203d47;--card:#fffaf0}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,sans-serif}main{max-width:1600px;margin:auto;padding:28px 20px}h1{font-size:24px}p{line-height:1.7;font-size:14px}h2{font-size:18px;margin:34px 0 16px}.grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px}a{color:inherit;text-decoration:none;background:var(--card);border-radius:10px;overflow:hidden}img{display:block;width:100%;height:auto}span{display:block;padding:12px;font-size:12px;line-height:1.6}@media(max-width:700px){.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}h1{font-size:20px}}@media(prefers-color-scheme:dark){:root{--bg:#14272f;--ink:#f3f0e7;--card:#203d47}}
</style><main><h1>App Store 掲載画像</h1><div><button onclick="document.documentElement.dataset.theme='light'">ライト</button><button onclick="document.documentElement.dataset.theme='dark'">ダーク</button></div><p>実際のアプリ画面に、大きな見出しと一行の説明を添えた全20枚。画像を押すと原寸を表示します。</p>'''+sections+'</main></html>')
print(json.dumps({'images':len(manifest),'maxBytes':max(m['bytes'] for m in manifest)},ensure_ascii=False))
