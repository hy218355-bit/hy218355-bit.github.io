'use strict';
/* 承認された39人の原画をSVGパーツへ分けて組み立てる。名前やセーブは使わない。 */
const Faces=(()=>{
const root=new URL('../img/faces/',document.currentScript.src).href;
const featuresCache=new Map(),partsCache=new Map(),urls=new Map(),loading=new Set(),orders=new Map();
const parts=['underpaint','outline','skin','hair','eyes','brows','mouth','cheeks','accessories'];
const h=(id,part)=>hash(id,'portrait-parts-v1',part);
function features(id){
id=String(id);if(featuresCache.has(id))return featuresCache.get(id);
const m=/-(?:j|n)(\d+)$/.exec(id);
let base;
if(m){
  /* 通し番号を、hashで並べた39人に一つずつ合わせる。近い代で顔が重なりにくくする。 */
  const seq=Number(m[1]),cycle=0;
  if(!orders.has(cycle))orders.set(cycle,Array.from({length:39},(_,i)=>i).sort((a,b)=>hash('portrait-order',cycle,a)-hash('portrait-order',cycle,b)));
  base=orders.get(cycle)[seq%39];
}else base=Math.floor(h(id,'outline')*39);
const f={base,hair:Math.floor(h(id,'hair-color')*6),skin:Math.floor(h(id,'skin')*4),eyes:Math.floor(h(id,'eyes')*5),brows:Math.floor(h(id,'brows')*4),mouth:Math.floor(h(id,'mouth')*4),cheeks:Math.floor(h(id,'cheeks')*3)};
featuresCache.set(id,f);return f;
}
function svg(id,mood='normal'){
const f=features(id),data=partsCache.get(f.base);if(!data)return null;
const eye=mood==='tired'?.78:mood==='zone'?1.05:1;
const eyeTone=[.96,.98,1,1.02,1.04][f.eyes],mouthTone=[.96,.99,1.02,1.04][f.mouth];
const filter={
skin:`brightness(${[.98,.995,1.01,1.02][f.skin]})`,
hair:`brightness(${[.94,.98,1.02,1.06,1.10,1.13][f.hair]}) saturate(${[.85,.95,1,1.05,.90,.98][f.hair]})`,
eyes:`brightness(${eyeTone})`,brows:`brightness(${[.94,.98,1.02,1.06][f.brows]})`,
mouth:`brightness(${mouthTone})`,cheeks:`saturate(${[.85,1,1.12][f.cheeks]})`
};
return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 224 224">'+parts.map(part=>`<g stroke-width=".45" stroke-linejoin="round"${filter[part]?` style="filter:${filter[part]}"`:''}${part==='eyes'&&eye!==1?` transform="translate(0 ${100*(1-eye)}) scale(1 ${eye})"`:''}>${data[part]||''}</g>`).join('')+'</svg>';
}
function url(id,mood){
const key=String(id)+'|'+mood;if(urls.has(key))return urls.get(key);
const source=svg(id,mood);if(!source)return null;
const value=URL.createObjectURL(new Blob([source],{type:'image/svg+xml'}));urls.set(key,value);
// 今も画面に出ている顔は残し、古い顔のキャッシュに上限をつける。
if(urls.size>160){const used=new Set([...document.querySelectorAll('.member-face')].map(img=>img.src));for(const [oldKey,oldUrl] of urls){if(urls.size<=160)break;if(oldKey!==key&&!used.has(oldUrl)){URL.revokeObjectURL(oldUrl);urls.delete(oldKey);}}}
return value;
}
function load(base){
if(loading.has(base)||partsCache.has(base))return;loading.add(base);
const script=document.createElement('script');script.src=root+'face-'+String(base+1).padStart(2,'0')+'.js';script.onload=()=>script.remove();script.onerror=()=>{loading.delete(base);script.remove();};document.head.append(script);
}
function register(base,source){
const data={};for(const match of source.matchAll(/<g id="([^"]+)"[^>]*>(.*?)<\/g>/gs))data[match[1]]=match[2];
partsCache.set(base,data);
for(const img of document.querySelectorAll('.member-face[data-template="'+base+'"]')){const value=url(img.dataset.face,img.dataset.mood);if(value)img.src=value;}
}
function image(member,size=36,options={}){
const id=String(typeof member==='object'?member.id:member),f=features(id);
const mood=options.mood||(typeof member==='object'&&(member.sta??100)<30?'tired':'normal');
const source=url(id,mood)||root+'face-'+String(f.base+1).padStart(2,'0')+'.svg';
return `<img class="member-face" src="${source}" width="${size}" height="${size}" style="--face-size:${size}px" data-template="${f.base}" data-face="${esc(id)}" data-mood="${mood}" alt="" decoding="async" loading="lazy">`;
}
// 隠れた一覧の顔まで一度に読み込まず、顔が出るときにパーツを読む。
document.addEventListener('load',event=>{const img=event.target;if(img?.matches?.('.member-face'))load(Number(img.dataset.template));},true);
return {image,features,svg,register,fingerprint:id=>Object.values(features(id)).join(':'),cacheSize:()=>urls.size};
})();
const memberFace=(m,size,options)=>Faces.image(m,size,options);

