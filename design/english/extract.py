#!/usr/bin/env python3
# 翻訳候補を読み取り専用で集める。ゲームの値やJavaScriptは書き換えない。
from pathlib import Path
import re,json,html
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parents[2]
JP=re.compile('[ぁ-んァ-ヶ一-龯]')
def literals(src):
 out=[];n=len(src)
 def quoted(i):
  mark=src[i];i+=1;buf='';idx=0
  while i<n:
   c=src[i]
   if c=='\\' and i+1<n:
    c=src[i+1];buf+=dict(n='\n',r='\r',t='\t').get(c,c);i+=2;continue
   if c==mark:
    out.append(buf);return i+1
   if mark=='`' and src[i:i+2]=='${':
    i=code(i+2,True);buf+='{'+str(idx)+'}';idx+=1;continue
   buf+=c;i+=1
  return i
 def code(i,nested=False):
  depth=0
  while i<n:
   if src[i:i+2]=='//':
    pos=src.find('\n',i+2);i=n if pos<0 else pos+1;continue
   if src[i:i+2]=='/*':
    pos=src.find('*/',i+2);i=n if pos<0 else pos+2;continue
   if src[i] in "'\"`":i=quoted(i);continue
   if nested:
    if src[i]=='{':depth+=1
    if src[i]=='}':
     if depth==0:return i+1
     depth-=1
   i+=1
  return i
 code(0);return out
class Texts(HTMLParser):
 def __init__(self):super().__init__();self.out=[];self.skip=0
 def handle_starttag(self,tag,attrs):
  if tag in ['script','style','pre']:self.skip+=1
  if not self.skip:
   self.out += [v for k,v in attrs if k in ['title','aria-label','placeholder','data-tip','alt'] and v]
 def handle_endtag(self,tag):
  if tag in ['script','style','pre']:self.skip=max(0,self.skip-1)
 def handle_data(self,data):
  if not self.skip:self.out.append(data)
result={}
def add(s,file):
 s=html.unescape(s).strip()
 if s and JP.search(s):result.setdefault(s,[]).append(file)
for f in (ROOT/'tsukurikata/js').rglob('*.js'):
 # 名前と配役は翻訳の対象から分け、言語を変えても本人を変えない。
 if f.name in ['face-cast.js','faces.js']:continue
 for s in literals(f.read_text()):
  if '<' in s and '>' in s:
   p=Texts()
   try:p.feed(s)
   except Exception:continue
   for text in p.out:add(text,str(f.relative_to(ROOT)))
  else:add(s,str(f.relative_to(ROOT)))
p=Texts();p.feed((ROOT/'tsukurikata/index.html').read_text())
for s in p.out:add(s,'tsukurikata/index.html')
path=Path(__file__).with_name('catalog.json');path.write_text(json.dumps({s:sorted(set(v)) for s,v in result.items()},ensure_ascii=False,indent=2)+'\n')
print('候補',len(result),'文字数',sum(map(len,result)))
for f in ['ui.js','game.js','advisor.js','onboarding.js']:
 print(f,sum(any(x.endswith('/'+f) for x in files) for files in result.values()))
