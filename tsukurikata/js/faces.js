'use strict';
/* 顔は原画のまま表示する。名前はこの作品の配役表に合わせ、顔の情報をセーブに足さない。 */
const Faces=(()=>{
const root=new URL('../img/faces/',document.currentScript.src).href;
const sheets=FACE_CAST.sheets,atlas=FACE_CAST.cast;
const pools=Object.fromEntries(['female','male'].map(style=>[style,atlas.filter(face=>face.style===style).sort((a,b)=>hash('portrait-cast-v2',a.base)-hash('portrait-cast-v2',b.base))]));
const legacyPools=Object.fromEntries(['female','male'].map(style=>[style,pools[style].filter(face=>face.base<39)]));
const draws=new Map();
const featuresCache=new Map();
const stageImages=new Map(),stageStamps=new Map();
function features(member){
  const m=typeof member==='object'?member:{id:String(member)},id=String(m.id),style=namePresentation(m),key=id+'|'+style;
  if(featuresCache.has(key))return featuresCache.get(key);
  const match=/-(?:j|n)(\d+)$/.exec(id),seq=match?Number(match[1]):null;
  const newer=/-(?:j|n)(\d+)-([0-9a-f]+)$/.exec(id);
  let pool=seq!==null?legacyPools[style]:pools[style];
  if(newer){
    const drawKey=newer[2]+'|'+style;
    if(!draws.has(drawKey)){
      if(draws.size>=32)draws.delete(draws.keys().next().value);
      draws.set(drawKey,pool.slice().sort((a,b)=>hash('cast100',drawKey,a.base)-hash('cast100',drawKey,b.base)));
    }
    pool=draws.get(drawKey);
  }
  // 昔のidは元の39人から同じ顔、新しいidはセーブごとに混ぜた100人から選ぶ。
  const index=newer?(Number(newer[1])-1)%pool.length:seq!==null&&seq>0?(seq-1)%pool.length:Math.floor(hash(id,'portrait-cast-v2',style)*pool.length);
  const face=Object.freeze({...pool[index%pool.length]});
  if(featuresCache.size>=256)featuresCache.delete(featuresCache.keys().next().value);
  featuresCache.set(key,face);return face;
}
function portrait(face,size,extra=''){
  const sheet=sheets[face.sheet],col=face.cell%sheet.cols,row=Math.floor(face.cell/sheet.cols);
  const x=100*col/(sheet.cols-1),y=100*row/(sheet.rows-1);
  // 同じ原画をブラウザが使い回す。画素を減らすSVG化や顔ごとの絵のコピーはしない。
  return `<span class="member-face" aria-hidden="true" data-template="${face.base}" data-presentation="${face.style}" data-standout="${face.standout}" ${extra} style="--face-size:${size}px;background-image:url('${root+sheet.file+'?v='+FACE_CAST.version}');background-size:${sheet.cols*100}% ${sheet.rows*100}%;background-position:${x}% ${y}%"></span>`;
}
function image(member,size=36,options={}){
  const m=typeof member==='object'?member:{id:String(member)},mood=options.mood||((m.sta??100)<30?'tired':'normal');
  return portrait(features(m),size,`data-face="${esc(String(m.id))}" data-mood="${mood}"`);
}
// 舞台の顔は原画を一度だけ読み、丸い小さな絵を作って毎フレーム使い回す。
function stageStamp(face){
  if(stageStamps.has(face.base))return stageStamps.get(face.base);
  const sheet=sheets[face.sheet];
  let img=stageImages.get(face.sheet);
  if(!img){
    img=new Image();img.decoding='async';stageImages.set(face.sheet,img);
    img.onload=()=>document.dispatchEvent(new Event('facesready'));
    img.src=root+sheet.file+'?v='+FACE_CAST.version;
  }
  if(!img.complete||!img.naturalWidth)return null;
  const stamp=document.createElement('canvas');stamp.width=stamp.height=128;
  const g=stamp.getContext('2d'),w=img.naturalWidth/sheet.cols,h=img.naturalHeight/sheet.rows;
  const col=face.cell%sheet.cols,row=Math.floor(face.cell/sheet.cols);
  g.beginPath();g.arc(64,64,64,0,Math.PI*2);g.clip();
  g.drawImage(img,(col+.08)*w,(row+.02)*h,w*.84,h*.84,0,0,128,128);
  stageStamps.set(face.base,stamp);return stamp;
}
function draw(g,member,x,y,size){
  const stamp=stageStamp(features(member));if(!stamp)return false;
  g.drawImage(stamp,x-size/2,y-size/2,size,size);return true;
}
return {image,draw,features,catalog:atlas,preview:(base,size=112)=>portrait(atlas[base],size),fingerprint:member=>features(member).base,cacheSize:()=>featuresCache.size,stageCacheSize:()=>({images:stageImages.size,stamps:stageStamps.size})};
})();
const memberFace=(m,size,options)=>Faces.image(m,size,options);
