'use strict';
/* 表示だけを切り替える。ゲームのデータ・セーブ・操作用の属性は翻訳しない。 */
(function(){
 const KEY='suibu-language-v1', japanese=/[ぁ-んァ-ヶ一-龯]/;
 let language='ja';try{language=localStorage.getItem(KEY)||(/^ja\b/i.test(navigator.language)?'ja':'en');}catch(e){}
 if(!['ja','en'].includes(language))language='ja';
 const exact=new Map(),patterns=[],sentences=[],cache=new Map(),rawText=new WeakMap(),rawAttrs=new WeakMap();
 let memberNames=new Set();
 const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const balanced=text=>{
  const pairs={'（':'）','「':'」','『':'』'},stack=[];
  for(const ch of text){if(pairs[ch])stack.push(pairs[ch]);else if(['）','」','』'].includes(ch)&&stack.pop()!==ch)return false;}
  return !stack.length;
 };
 function splitTop(text,delimiters){
  const pairs={'（':'）','「':'」','『':'』','【':'】'},stack=[],parts=[];let buffer='';
  const emit=ch=>{parts.push(buffer,ch);buffer='';};
  for(const ch of text){
   if(pairs[ch]){if(!stack.length&&delimiters.includes(ch))emit(ch);else buffer+=ch;stack.push(pairs[ch]);}
   else if(Object.values(pairs).includes(ch)){if(stack.at(-1)===ch)stack.pop();if(!stack.length&&delimiters.includes(ch))emit(ch);else buffer+=ch;}
   else if(!stack.length&&delimiters.includes(ch))emit(ch);else buffer+=ch;
  }
  parts.push(buffer);return parts;
 }
 function add(source,target){
  if(!source||target===undefined||target===null)return;
  if(!/\{\d+\}/.test(source)){exact.set(source,target);return;}
  const fixed=source.replace(/\{\d+\}/g,'');
  if(/^(から|を|の|と|は|が|へ|に)$/.test(fixed.replace(/[\s・：:／/。→（）「」]/g,'')))return;
  const numeric=/^\{\d+\}(?:人|年|月|週|席|件|つ|年間|年度|人目|点)[・。]?$/u.test(source);
  const grade=/^\{\d+\}年・\{\d+\}$/u.test(source);
  // 一文字の助詞だけでどの文にも合う翻訳を作らない。短い単位は数値に限る。
  if(fixed.length<3&&!numeric&&!grade&&!['【{0}】{1}','{0}：{1}','{0}連続','{0}点','+{0}点','−{0}点','部の{0}','体力{0}','{0}だけ','{1}だけ','{0}曲'].includes(source))return;
  const ids=[],nameSlots=[];let from=0,body='';
  for(const match of source.matchAll(/\{(\d+)\}/g)){
   body+=escape(source.slice(from,match.index));const id=Number(match[1]),prior=ids.indexOf(id);
   const numberSlot=/^(?:年|月|週|人|点|か所|席|件|文字|回|%|％)/u.test(source.slice(match.index+match[0].length))||/Lv$/.test(source.slice(0,match.index));
   if(/^(は|が|の夢|と|を)/.test(source.slice(match.index+match[0].length)))nameSlots.push(ids.length+1);
   if(prior>=0)body+='\\'+(prior+1);else{ids.push(id);body+=numeric||numberSlot||(grade&&ids.length===1)?'([0-9.,+−-]+)':source.slice(match.index+match[0].length).startsWith(' スキル')?'([^／]+?)':'([\\s\\S]+?)';}
   from=match.index+match[0].length;
  }
  body+=escape(source.slice(from));patterns.push({re:new RegExp('^'+body+'$'),ids,nameSlots,target,weight:source.replace(/\{\d+\}/g,'').length});
 }
 function translate(value,depth=0){
  const text=String(value??'');if(language==='ja'||!japanese.test(text))return text;
  if(memberNames.has(text.trim()))return text;
  if(cache.has(depth+':'+text))return cache.get(depth+':'+text);
  const trim=text.trim();let result=exact.get(trim);
  const skill=/^(.*)([○◎])$/.exec(trim);
  if(result===undefined&&skill&&exact.has(skill[1]))result=exact.get(skill[1])+skill[2];
  if(result===undefined&&trim.startsWith('→')&&depth<20)result='→ '+translate(trim.slice(1).trim(),depth+1);
  if(result===undefined&&/[。.]+$/.test(trim)&&exact.has(trim.replace(/[。.]+$/,'')))result=exact.get(trim.replace(/[。.]+$/,''))+'.';
  if(result===undefined&&/(?:高等学校|高校)$/.test(trim)){
   const a={'桜':'Sakura','青':'Ao','緑':'Midori','白':'Shira','若':'Waka','朝':'Asa','夕':'Yu','星':'Hoshi','月':'Tsuki','汐':'Shio','潮':'Shio','風':'Kaze','松':'Matsu','柳':'Yanagi','梅':'Ume','藤':'Fuji','楓':'Kaede','椿':'Tsubaki','葵':'Aoi','鈴':'Suzu','霞':'Kasumi','萩':'Hagi'};
   const b={'ヶ丘':'gaoka','台':'dai','浜':'hama','野':'no','が原':'gahara','坂':'saka','川':'kawa','崎':'saki','見':'mi','里':'sato','森':'mori','沢':'sawa'};
   const name=trim.replace(/^(県立|市立|私立)/,'').replace(/高等学校$|高校$/,'');
   for(const [first,reading]of Object.entries(a))if(name.startsWith(first)&&b[name.slice(first.length)])result=reading+b[name.slice(first.length)]+' High School';
  }
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const date=/^(?:(\d{4})年)?(1[0-2]|[1-9])月(?:\s*第?(\d+)週)?$/.exec(trim);
  const joined=/^(\d{4})年(1[0-2]|[1-9])月の入部から$/.exec(trim);
  if(joined)result='Since joining in '+months[Number(joined[2])-1]+' '+joined[1];
  const ranks=/^([GFSABCDE])から([GFSABCDE])$/.exec(trim);
  if(ranks)result=ranks[1]+' → '+ranks[2];
  if(date)result=months[Number(date[2])-1]+(date[1]?' '+date[1]:'')+(date[3]?' · Week '+date[3]:'');
  if(result===undefined&&depth<20){
   for(const p of patterns){const m=p.re.exec(trim);if(m&&m.slice(1).every(balanced)&&p.nameSlots.every(i=>!/[。]/.test(m[i]))){result=p.target.replace(/\{\d+\}(?:\{\d+\})*/g,group=>translate([...group.matchAll(/\{(\d+)\}/g)].map(([,id])=>m[p.ids.indexOf(Number(id))+1]||'').join(''),depth+1));break;}}
  }
  if(result===undefined&&depth<20){
   const sentence=sentences.find(([source])=>trim.startsWith(source));
   if(sentence){const at=trim.indexOf(sentence[0]);result=translate(trim.slice(0,at),depth+1)+sentence[1]+translate(trim.slice(at+sentence[0].length),depth+1);}
  }
  if(result===undefined&&depth<20){
   // 複数の講評がつながっていても、元の二文以上のまとまりを先に試す。
   const ends=[...trim.matchAll(/。/g)].map(m=>m.index+1).filter(i=>i<trim.length).reverse();
   for(const end of ends){const first=trim.slice(0,end);if(!balanced(first))continue;
    if(patterns.some(p=>{const m=p.weight>=6&&p.re.exec(first);return m&&m.slice(1).every(balanced)&&p.nameSlots.every(i=>!/[。]/.test(m[i]));})){
     result=translate(first,depth+1)+' '+translate(trim.slice(end).trim(),depth+1);break;
    }
   }
  }
  if(result===undefined&&depth<20){
   // 日誌や選択欄でつながった短い表示は、意味の切れ目ごとに訳す。
   let parts=/。\s*（/.test(trim)?splitTop(trim,'（）'):[trim];
   for(const delimiters of ['／/','・','：:','【】','（）'])if(parts.length===1)parts=splitTop(trim,delimiters);
   const at=trim.indexOf('。');
   if(parts.length===1&&at>=0&&at<trim.length-1&&balanced(trim.slice(0,at+1)))parts=[trim.slice(0,at+1),' ',trim.slice(at+1).trim()];
   if(parts.length===1)parts=splitTop(trim,'「」○◎→、\n');
   if(parts.length===1)parts=trim.split(/((?<=。)\s*|[\s　]+)/u);
   if(parts.length>1)result=parts.map(part=>({ '・':' · ','／':' / ','：':': ','「':'“','」':'”','【':'[','】':']','（':' (','）':')','→':'→ ' }[part]??translate(part,depth+1))).join('');
   else{
    const stat=/^(.+?)([+−-][0-9.]+)$/.exec(trim);
    if(stat&&exact.has(stat[1]))result=exact.get(stat[1])+stat[2];
    const count=/^([0-9]+(?:[／/][0-9]+)?)人$/.exec(trim);
    if(count)result=count[1].replace('／','/')+' players';
   }
  }
  if(result===undefined)return text;
  result=result.replace(/\b1 (players|weeks|recordings|seats|characters)\b/g,(_,word)=>'1 '+word.slice(0,-1));
  result=text.slice(0,text.indexOf(trim))+result+text.slice(text.indexOf(trim)+trim.length);
  if(cache.size>2000)cache.clear();cache.set(depth+':'+text,result);return result;
 }
 function original(node,current,map){
  const previous=map.get(node);
  return previous&&current===previous.last?previous.source:current;
 }
 function textNode(node){
  const parent=node.parentElement;if(!parent||parent.closest('script,style,pre,textarea,input,[data-no-i18n]'))return;
  const current=node.nodeValue,source=original(node,current,rawText);
  const short=language==='en'&&parent.matches?.('.cal .contest')?{'県':'P','支部':'R','全国':'N'}[source.trim()]:undefined;
  const next=short??translate(source);
  if(current!==next)node.nodeValue=next;
  rawText.set(node,{source,last:next});
 }
 const attrs=['title','aria-label','placeholder','alt','data-tip','data-tipname'];
 function element(el){
  if(el.closest('script,style,pre,[data-no-i18n]'))return;
  let saved=rawAttrs.get(el);if(!saved){saved=new Map();rawAttrs.set(el,saved);}
  for(const key of attrs){
   if(!el.hasAttribute(key))continue;
   const current=el.getAttribute(key),previous=saved.get(key),source=previous&&current===previous.last?previous.source:current,next=translate(source);
   if(next!==current)el.setAttribute(key,next);saved.set(key,{source,last:next});
  }
 }
 function apply(root=document.body){
  if(!root)return;
  if(root.nodeType===Node.TEXT_NODE){textNode(root);return;}
  if(root.nodeType!==Node.ELEMENT_NODE)return;
  element(root);const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
  let n;while((n=walker.nextNode())){if(n.nodeType===Node.TEXT_NODE)textNode(n);else element(n);}
 }
 let observer=null,frame=0;const pending=new Set();
 function flush(){
  frame=0;observer?.disconnect();
  try{for(const node of pending)if(node.isConnected)apply(node);}finally{pending.clear();observe();}
 }
 function observe(){observer?.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attrs});}
 function controls(){
  for(const button of document.querySelectorAll('[data-language]'))button.setAttribute('aria-pressed',String(button.dataset.language===language));
 }
 function setLanguage(next){
  if(!['ja','en'].includes(next))return;
  language=next;cache.clear();try{localStorage.setItem(KEY,next);}catch(e){}
  document.documentElement.lang=next;document.title=translate('吹奏楽部のつくりかた');observer?.disconnect();apply();controls();observe();
  document.dispatchEvent(new CustomEvent('languagechange',{detail:{language:next}}));
 }
 function boot(){
  for(const [source,target]of Object.entries(window.TSUKURIKATA_EN||{})){
   if(window.SUIBU_SCHOOL_FRAGMENTS?.includes(source))continue;
   add(source,target);
  }
  patterns.sort((a,b)=>b.weight-a.weight);document.documentElement.lang=language;document.title=translate('吹奏楽部のつくりかた');
  sentences.push(...[...exact].filter(([s])=>s.length>=5&&s.endsWith('。')).sort((a,b)=>b[0].length-a[0].length));
  apply();controls();
  observer=new MutationObserver(records=>{
   for(const r of records){if(r.type==='childList')for(const n of r.addedNodes)pending.add(n);else pending.add(r.target);}
   if(!frame)frame=requestAnimationFrame(flush);
  });observe();
  document.addEventListener('click',e=>{const button=e.target.closest('[data-language]');if(button)setLanguage(button.dataset.language);});
 }
 window.SuibuLanguage={get:()=>language,set:setLanguage,text:translate,apply,names:values=>{memberNames=new Set(values);cache.clear();}};
 for(const name of ['alert','confirm','prompt']){
  const original=window[name];if(typeof original==='function')window[name]=function(message,...args){return original.call(window,translate(message),...args);};
 }
 for(const name of ['fillText','strokeText','measureText']){
  const original=CanvasRenderingContext2D.prototype[name];
  CanvasRenderingContext2D.prototype[name]=function(text,...args){return original.call(this,translate(text),...args);};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
