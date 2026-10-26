"""承認された原画を、色面を保ったSVGの顔パーツへベクター化する。"""
from pathlib import Path
from PIL import Image, ImageFilter
import numpy as np
import json,sys
from collections import defaultdict
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'tsukurikata/img/faces'
OUT.mkdir(parents=True,exist_ok=True)
SHEETS=[(ROOT/'design/after-school/assets/faces-art-direction-v4.webp',4,3),(ROOT/'design/after-school/cast39/assets/sheet02.webp',4,3),(ROOT/'design/after-school/cast39/assets/sheet03.webp',5,3)]
PARTS=['outline','skin','hair','eyes','brows','mouth','cheeks','accessories']
N=224
def simplify(points,eps=.65):
    pts=np.asarray(points,dtype=float)
    def run(a):
        if len(a)<3:return a
        d=a[-1]-a[0];norm=np.linalg.norm(d)
        dist=np.abs(d[0]*(a-a[0])[:,1]-d[1]*(a-a[0])[:,0])/norm if norm else np.linalg.norm(a-a[0],axis=1)
        i=int(np.argmax(dist))
        if dist[i]>eps:return np.vstack([run(a[:i+1])[:-1],run(a[i:])])
        return a[[0,-1]]
    if len(pts)<5:return pts
    k=len(pts)//2
    return np.vstack([run(pts[:k+1])[:-1],run(np.vstack([pts[k:],pts[:1]]))[:-1]])
def paths(mask):
    # 色面の境界をたどり、穴も含めた輪郭を作る。
    edges=defaultdict(list)
    ys,xs=np.nonzero(mask & ~np.pad(mask[:-1],((1,0),(0,0))))
    for y,x in zip(ys,xs):edges[(int(x),int(y))].append((int(x+1),int(y)))
    ys,xs=np.nonzero(mask & ~np.pad(mask[:,1:],((0,0),(0,1))))
    for y,x in zip(ys,xs):edges[(int(x+1),int(y))].append((int(x+1),int(y+1)))
    ys,xs=np.nonzero(mask & ~np.pad(mask[1:],((0,1),(0,0))))
    for y,x in zip(ys,xs):edges[(int(x+1),int(y+1))].append((int(x),int(y+1)))
    ys,xs=np.nonzero(mask & ~np.pad(mask[:,:-1],((0,0),(1,0))))
    for y,x in zip(ys,xs):edges[(int(x),int(y+1))].append((int(x),int(y)))
    out=[]
    while edges:
        start=next(iter(edges));now=start;loop=[]
        while now in edges:
            loop.append(now);nxt=edges[now].pop()
            if not edges[now]:del edges[now]
            now=nxt
            if now==start:break
        if len(loop)<4:continue
        area=abs(sum(loop[i][0]*loop[(i+1)%len(loop)][1]-loop[(i+1)%len(loop)][0]*loop[i][1] for i in range(len(loop))))/2
        if area<2.5:continue
        poly=simplify(loop)
        if len(poly)<3:continue
        out.append('M'+' '.join(f'{x:g},{y:g}' for x,y in poly)+'Z')
    return ''.join(out)
meta=[];seq=0
limit=int(sys.argv[1]) if len(sys.argv)>1 else 39
for source,cols,rows in SHEETS:
    sheet=Image.open(source).convert('RGB')
    for row in range(rows):
        for col in range(cols):
            seq+=1
            if seq>limit:break
            crop=sheet.crop((round(col*sheet.width/cols),round(row*sheet.height/rows),round((col+1)*sheet.width/cols),round((row+1)*sheet.height/rows)))
            im=crop.resize((N,N),Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(.3))
            q=im.quantize(colors=40,method=Image.Quantize.MEDIANCUT)
            pix=np.asarray(q);pal=np.array(q.getpalette()[:120]).reshape(-1,3)
            a=np.asarray(im).astype(int);r,g,b=a[:,:,0],a[:,:,1],a[:,:,2]
            y,x=np.indices((N,N));xf=x/N;yf=y/N
            cls=np.zeros((N,N),dtype=np.uint8)
            skin=(r>110)&(r-g>7)&(g-b>6)&(yf>.16)&(yf<.90)
            cls[skin]=1
            center=((xf-.50)/.30)**2+((yf-.50)/.31)**2<1
            hair=(r<145)&(g<132)&(yf<.75)&((yf<.32)|~center)
            cls[hair]=2
            dark=(r<174)&(yf<.70)&(xf>.24)&(xf<.78)
            cls[dark&(yf>.395)&(yf<.505)]=3
            cls[dark&(yf>.32)&(yf<=.395)]=4
            cls[(r-g>16)&(r<195)&(xf>.36)&(xf<.66)&(yf>.565)&(yf<.68)]=5
            cls[skin&(xf>.27)&(xf<.74)&(yf>.50)&(yf<.60)&(r-g>40)]=6
            if seq in [12,19,24,29]:
                cls[(cls==3)&((xf<.37)|(xf>.63)|(yf<.43))]=7
            # 小さい色面を省いても白い穴を残さないよう、粗い色面を下塗りする。
            low=im.resize((56,56),Image.Resampling.BOX).quantize(colors=20)
            lp=np.asarray(low);lc=np.array(low.getpalette()[:60]).reshape(-1,3)
            under=[]
            for ci,color in enumerate(lc):
                commands=[]
                for yy in range(56):
                    xx=0
                    while xx<56:
                        if lp[yy,xx]!=ci:xx+=1;continue
                        stop=xx+1
                        while stop<56 and lp[yy,stop]==ci:stop+=1
                        commands.append(f'M{xx*4},{yy*4}h{(stop-xx)*4}v4h-{(stop-xx)*4}Z')
                        xx=stop
                paint='#'+''.join(f'{v:02x}' for v in color)
                under.append(f'<path fill="var(--under-c{ci},{paint})" d="'+''.join(commands)+'"/>')
            groups=['<g id="underpaint">'+''.join(under)+'</g>']
            for pi,name in enumerate(PARTS):
                pieces=[]
                for ci,rgb in enumerate(pal):
                    mask=(cls==pi)&(pix==ci)
                    if np.count_nonzero(mask)<2:continue
                    d=paths(mask)
                    if not d:continue
                    color='#'+''.join(f'{v:02x}' for v in rgb)
                    pieces.append(f'<path fill="var(--portrait-c{ci},{color})" stroke="var(--portrait-c{ci},{color})" d="{d}"/>')
                groups.append(f'<g id="{name}" stroke-width=".45" stroke-linejoin="round">'+''.join(pieces)+'</g>')
            body=''.join(groups)
            svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {N} {N}"><title>部員の顔の原画パーツ{seq:02d}</title>'+body+'</svg>'
            target=OUT/f'face-{seq:02d}.svg';target.write_text(svg)
            (OUT/f'face-{seq:02d}.js').write_text(f'/* 顔のSVGパーツ{seq:02d}。原稿は制作記録を参照。 */\nFaces.register({seq-1},`{svg}`);\n')
            skin_color=np.median(a[skin],axis=0).astype(int) if np.any(skin) else np.array([222,187,157])
            meta.append({'index':seq-1,'file':target.name,'bytes':target.stat().st_size,'skin':'#'+''.join(f'{v:02x}' for v in skin_color)})
            print(target.name,target.stat().st_size,flush=True)
        if seq>limit:break
    if seq>limit:break
(OUT/'manifest.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')

