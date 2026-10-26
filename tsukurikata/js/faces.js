'use strict';
/* 顔は原画のまま表示する。名前はこの作品の配役表に合わせ、顔の情報をセーブに足さない。 */
const Faces=(()=>{
const root=new URL('../img/faces/',document.currentScript.src).href;
const sheets=[{file:'portraits-01.webp',cols:4,rows:3,offset:0,female:9,count:12},{file:'portraits-02.webp',cols:4,rows:3,offset:12,female:10,count:12},{file:'portraits-03.webp',cols:5,rows:3,offset:24,female:12,count:15}];
const atlas=sheets.flatMap((sheet,sheetIndex)=>Array.from({length:sheet.count},(_,cell)=>({base:sheet.offset+cell,sheet:sheetIndex,cell,style:cell<sheet.female?'female':'male'})));
const pools=Object.fromEntries(['female','male'].map(style=>[style,atlas.filter(face=>face.style===style).sort((a,b)=>hash('portrait-cast-v2',a.base)-hash('portrait-cast-v2',b.base))]));
const featuresCache=new Map();
function features(member){
  const m=typeof member==='object'?member:{id:String(member)},id=String(m.id),style=namePresentation(m),key=id+'|'+style;
  if(featuresCache.has(key))return featuresCache.get(key);
  const match=/-(?:j|n)(\d+)$/.exec(id),seq=match?Number(match[1]):null,pool=pools[style];
  let index;
  if(seq!==null&&seq>0&&(seq%5===0?'male':'female')===style){
    // 新しい5人の組では、同じ配役の顔を順に使って重複を減らす。
    index=style==='male'?Math.floor(seq/5)-1:seq-1-Math.floor(seq/5);
  }else index=Math.floor(hash(id,'portrait-cast-v2',style)*pool.length);
  const face=Object.freeze({...pool[index%pool.length]});
  if(featuresCache.size>=256)featuresCache.delete(featuresCache.keys().next().value);
  featuresCache.set(key,face);return face;
}
function portrait(face,size,extra=''){
  const sheet=sheets[face.sheet],col=face.cell%sheet.cols,row=Math.floor(face.cell/sheet.cols);
  const x=100*col/(sheet.cols-1),y=100*row/(sheet.rows-1);
  // 同じ3枚をブラウザが使い回す。画素を減らすSVG化や顔ごとの絵のコピーはしない。
  return `<span class="member-face" aria-hidden="true" data-template="${face.base}" data-presentation="${face.style}" ${extra} style="--face-size:${size}px;background-image:url('${root+sheet.file+'?v=20261026-3'}');background-size:${sheet.cols*100}% ${sheet.rows*100}%;background-position:${x}% ${y}%"></span>`;
}
function image(member,size=36,options={}){
  const m=typeof member==='object'?member:{id:String(member)},mood=options.mood||((m.sta??100)<30?'tired':'normal');
  return portrait(features(m),size,`data-face="${esc(String(m.id))}" data-mood="${mood}"`);
}
return {image,features,preview:(base,size=112)=>portrait(atlas[base],size),fingerprint:member=>features(member).base,cacheSize:()=>featuresCache.size};
})();
const memberFace=(m,size,options)=>Faces.image(m,size,options);
