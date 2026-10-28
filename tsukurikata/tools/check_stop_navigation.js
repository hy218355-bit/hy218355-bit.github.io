'use strict';
/* 手動停止・自然終了・待機中止の後、消える停止ボタンに操作先を残さない。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),ui=fs.readFileSync(path.join(root,'js/ui.js'),'utf8'),conduct=fs.readFileSync(path.join(root,'js/conduct.js'),'utf8');
const ctx=vm.createContext({assert,console});
vm.runInContext(`
let S={week:7},focuses=[],ended=0,cancelled=0;
const document={body:{id:'body'},documentElement:{id:'html'},activeElement:null};
const node=id=>({id,hidden:false,disabled:false,inert:false,isConnected:true,visibility:'visible',display:true,closest(){return this.hidden||this.inert?{}:null;},matches(){return this.disabled;},getClientRects(){return this.display?[{}]:[];},focus(opts){document.activeElement=this;focuses.push({id:this.id,opts});}});
const main=node('btnStop'),now=node('btnNow'),mini=node('miniStop'),tab=node('members'),other=node('another'),heading=node('result');
const nodes={'#btnStop':main,'#btnNow':now,'#miniStop':mini,'#tabbar [aria-current="page"]':tab};const $=s=>nodes[s];
const U={playing:true,waitPlay:null,onEnd:null,shown:{piece:'galop'},perfNow:null,raf:0};
const E={stop(){this.stops++;},stops:0},window={},nativePost=()=>{},cancelAnimationFrame=()=>{};
const clearRecordedMember=()=>{},renderPiece=()=>{},refreshNow=()=>{},drawIdle=()=>{};
const updateMini=()=>{mini.hidden=!(U.playing||U.waitPlay);},renderPlayButtons=()=>{main.hidden=!(U.playing||U.waitPlay);now.hidden=!main.hidden;},setNowPlaying=()=>{updateMini();renderPlayButtons();};
const getComputedStyle=el=>({visibility:el.visibility});
function fresh(origin=main,waiting=false){U.playing=!waiting;U.waitPlay=waiting?{onCancel(){cancelled++;}}:null;U.onEnd=()=>ended++;U.shown={piece:'galop'};document.activeElement=origin;for(const el of [main,now,mini,tab,other,heading]){el.hidden=false;el.disabled=false;el.inert=false;el.isConnected=true;el.display=true;el.visibility='visible';}now.hidden=true;focuses=[];E.stops=0;ended=0;cancelled=0;}
`,ctx);
vm.runInContext(conduct.slice(conduct.indexOf('const cdVisible ='),conduct.indexOf('function cdDialogRelease(')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function endPlay('),ui.indexOf('function setVenue(')),ctx);
vm.runInContext(`
for(const origin of [main,mini]){
 for(const natural of [false,true]){
  fresh(origin);const before=JSON.stringify(S),shown=U.shown;
  if(natural)endPlay(true);else stopPlay();
  assert.equal(document.activeElement,origin===main?now:tab);assert.deepEqual(focuses[0].opts,{preventScroll:true});assert.equal(U.playing,false);assert.equal(U.waitPlay,null);assert.equal(ended,1);assert.equal(E.stops,natural?0:1);assert.equal(U.shown,shown);assert.equal(JSON.stringify(S),before);
 }
 fresh(origin,true);stopPlay();assert.equal(cancelled,1);assert.equal(ended,0);assert.equal(document.activeElement,origin===main?now:tab);assert.equal(E.stops,0);
}
// 終了の通知が次の演奏や待機を始めたときは、消さずにそのまま渡す。
for(const waiting of [false,true]){
 fresh(main);U.onEnd=()=>{U.playing=!waiting;U.waitPlay=waiting?{next:true}:null;};stopPlay();assert.equal(focuses.length,0);assert.equal(U.playing,!waiting);assert.equal(!!U.waitPlay,waiting);
 fresh(main,true);U.waitPlay.onCancel=()=>{U.playing=!waiting;U.waitPlay=waiting?{next:true}:null;};stopPlay();assert.equal(focuses.length,0);assert.equal(U.playing,!waiting);assert.equal(!!U.waitPlay,waiting);
}
// 結果の見出しや別の操作へ移った場合、その操作先を奪わない。
fresh(main);U.onEnd=()=>{document.activeElement=heading;};stopPlay();assert.equal(document.activeElement,heading);assert.equal(focuses.length,0);
fresh(other);endPlay(true);assert.equal(document.activeElement,other);assert.equal(focuses.length,0);
fresh(main,true);U.waitPlay.onCancel=()=>{document.activeElement=other;};stopPlay();assert.equal(document.activeElement,other);
// 隠れたタブ・無効な操作・モーダルの裏へは戻さない。
for(const target of [now,tab])for(const mode of ['hidden','disabled','inert','isConnected','display','visibility']){
 fresh(target===now?main:mini);target[mode]=mode==='isConnected'||mode==='display'?false:mode==='visibility'?'hidden':true;
 if(mode==='hidden')U.onEnd=()=>{target.hidden=true;};
 stopPlay();assert.equal(focuses.length,0,mode);
}
// bodyへ落ちた場合は補い、元のスクロール位置を変えない指定で戻す。
fresh(main);U.onEnd=()=>{document.activeElement=document.body;};stopPlay();assert.equal(document.activeElement,now);
fresh(main,true);U.waitPlay.onCancel=()=>{document.activeElement=document.documentElement;};stopPlay();assert.equal(document.activeElement,now);
console.log('合奏・小さな再生バーの停止と自然終了／待機の中止／元の部と演奏を保持／終了の通知は1回／次の音と待機・結果・別の操作を保つ／隠れた操作とモーダルの裏へ戻さない／スクロールを動かさない：確認済み');
`,ctx);
