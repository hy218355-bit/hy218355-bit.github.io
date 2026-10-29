'use strict';
/* 製品と同じ画面を使い、確認専用の保存先で最初から操作する。オーナーのセーブは読まない。 */
const oq=new URLSearchParams(location.search),osession=oq.get('session')||'preview';
const okey='onboarding-check:'+osession,omode=oq.get('mode')||'fresh',oerrors=[];
const oread=k=>{try{return JSON.parse(localStorage.getItem(okey+':'+k)||'null');}catch(e){return null;}};
const owrite=(k,v)=>{try{localStorage.setItem(okey+':'+k,JSON.stringify(v));}catch(e){}};
save=s=>owrite('game',s);
load=()=>{
 const stored=oread('game');if(stored)return stored;
 if(omode!=='existing')return null;
 let s=freshState(2026);s=choosePiece(assignRecruits(s,autoAssign(s)),'galop');
 // 前のセーブの途中を用意する。初回の案内は始めない。
 s.week=4;return s;
};
saveUI=()=>{};loadUI=()=>{U.sfx=false;U.fxMode='off';};
readOnboarding=()=>oread('guide');saveOnboarding=()=>owrite('guide',U.onboarding);
document.documentElement.dataset.theme=oq.get('theme')==='dark'?'dark':'light';
window.addEventListener('error',e=>oerrors.push(e.message));
function onboardingRecord(){
 let out=document.querySelector('#onboardingResult');if(!out){out=document.createElement('output');out.hidden=true;out.id='onboardingResult';document.body.append(out);}
 const box=document.querySelector('#onboarding'),active=document.activeElement;
 out.textContent=JSON.stringify({year:S.year,week:S.week,phase:S.phase,tab:U.tab,state:hash(JSON.stringify(S)),guide:U.onboarding,step:box&&!box.hidden?box.dataset.step:null,title:box&&!box.hidden?box.querySelector('h3').textContent:null,playing:U.playing,waiting:!!U.waitPlay,focus:active.id||active.dataset.act||active.dataset.onboard||active.dataset.tabgo||active.tagName,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,portrait:box?.querySelector('img')?{loaded:box.querySelector('img').complete,natural:box.querySelector('img').naturalWidth}:null,boot:JSON.parse(document.querySelector('#bootResult')?.textContent||'null'),errors:oerrors});
}
document.addEventListener('DOMContentLoaded',()=>{U.fxMode='off';FX.q=[];clearTimeout(FX.timer);FX.on=false;document.querySelector('#fx').hidden=true;onboardingRecord();setTimeout(onboardingRecord,1000);});
for(const kind of ['click','keyup','play','toggle'])document.addEventListener(kind,()=>{setTimeout(onboardingRecord,30);setTimeout(onboardingRecord,400);},true);
