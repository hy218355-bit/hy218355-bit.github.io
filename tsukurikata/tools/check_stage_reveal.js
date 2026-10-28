'use strict';
/* 合奏を直接始めた場合だけ舞台と停止を示し、カードからの試聴はその場所を保つ。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ui=fs.readFileSync(path.join(__dirname,'../js/ui.js'),'utf8'),ctx=vm.createContext({assert,console,clearTimeout});
vm.runInContext(`
let handler,plays=[],scrolls=[],focus='',rect={top:160,bottom:442},hidden=false,success=true,wait=false,builds=0;
const S={members:[{id:'本人'}]},U={playing:false,waitPlay:null,perfNow:{notes:[{mid:'本人'}]},refreshT:0},narrow={matches:true};
const stop={hidden:false,focus(opts){focus='stop';assert.equal(opts.preventScroll,true);}},panel={scrollIntoView(opts){scrolls.push(opts);}};
const $=s=>s==='#btnNow'?{addEventListener(_,fn){handler=fn;}}:s==='#btnStop'?stop:s==='.col-stage'?panel:s==='#stage'?{getBoundingClientRect(){return rect;}}:{getBoundingClientRect(){return {top:539};}};
const cdVisible=el=>!el.hidden,tabHidden=()=>hidden,getComputedStyle=()=>({scrollMarginTop:'14px'}),renderDiag=()=>{},analyze=()=>({}),nowLabel=()=>'今の音';
const currentPerformance=()=>{builds++;return {notes:[{mid:'本人'}]};},playPerf=perf=>{plays.push(perf);U.playing=success&&!wait;U.waitPlay=wait?{perf}:null;};
function fresh(){plays=[];scrolls=[];focus='now';rect={top:160,bottom:442};hidden=false;success=true;wait=false;builds=0;stop.hidden=false;narrow.matches=true;U.playing=false;U.waitPlay=null;U.perfNow={notes:[{mid:'本人'}]};}
`,ctx);
vm.runInContext(ui.slice(ui.indexOf('function revealStagePlayback(){'),ui.indexOf('function setVenue(')),ctx);
vm.runInContext(ui.slice(ui.indexOf("  $('#btnNow').addEventListener('click'"),ui.indexOf("  $('#btnLiveNow').addEventListener('click'")),ctx);
vm.runInContext(`
let n=0;
for(const pos of [{top:-962,bottom:-680},{top:400,bottom:682},{top:160,bottom:442}]){
 fresh();rect=pos;const p=U.perfNow,state=JSON.stringify(S),sound=JSON.stringify(p);handler({isTrusted:true});assert.equal(focus,'stop');assert.equal(plays.length,1);assert.equal(plays[0],p);assert.equal(builds,0);
 assert.equal(scrolls.length,pos.top<14||pos.bottom>527?1:0);if(scrolls.length)assert.deepEqual(scrolls[0],{block:'start',behavior:'auto'});
 assert.equal(JSON.stringify(S),state);assert.equal(JSON.stringify(p),sound);n++;
}
for(const event of [undefined,{isTrusted:false}]){fresh();rect={top:-962,bottom:-680};handler(event);assert.equal(focus,'now');assert.deepEqual(scrolls,[]);assert.equal(plays.length,1);n++;}
fresh();wait=true;rect={top:-962,bottom:-680};handler({isTrusted:true});assert.ok(U.waitPlay);assert.equal(focus,'stop');assert.equal(scrolls.length,1);n++;
fresh();success=false;handler({isTrusted:true});assert.equal(focus,'now');assert.deepEqual(scrolls,[]);n++;
fresh();narrow.matches=false;rect={top:-962,bottom:-680};handler({isTrusted:true});assert.equal(focus,'stop');assert.deepEqual(scrolls,[]);n++;
fresh();hidden=true;handler({isTrusted:true});assert.equal(focus,'now');assert.deepEqual(scrolls,[]);n++;
fresh();U.perfNow=null;handler({isTrusted:true});assert.equal(builds,1);assert.equal(plays[0],U.perfNow);n++;
console.log('合奏開始の'+n+'通り／舞台が隠れるときだけ表示／停止へ操作先を渡す／部員カードなどの試聴は移動しない／待機・失敗・広い画面・別タブを区別／同じ音を一度だけ再生／部と音を保持：確認済み');
`,ctx);
