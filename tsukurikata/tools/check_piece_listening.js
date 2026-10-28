'use strict';
/* 選曲の試聴で、前の本人だけの指定・終了処理・読み込み待ちを次の曲へ残さない。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),ctx=vm.createContext({console,assert,clearTimeout,setTimeout,tick:()=>new Promise(setImmediate)});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),pieces=[...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]);
for(const f of ['util','instruments','venues','scores',...pieces,'band','game'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f+'.js'});
vm.runInContext(`
let S,release,plays=[],failed=false;
const U={piece:null,range:'all',venue:'room',solo:'all',playing:false,waitPlay:null,shown:null,shownLabel:'',perfNow:null,onEnd:null,pieceListen:null,refreshT:0},CD={phase:'idle'};
const SAMPLES={use:true,ready:true,error:null,loading:null},window={};
const element=dataset=>({dataset,attrs:{},innerHTML:'',setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k]??null;},remove(){}});
const buttons=PIECE_IDS.flatMap(pid=>['model','preview'].map(act=>element({act,pid}))),cards=PIECE_IDS.map(pieceCard=>element({pieceCard}));
const document={querySelectorAll:s=>s==='[data-piece-card]'?cards:buttons};
const nodes={},$=s=>nodes[s]||=element({});
const E={pb:null,solo:{type:'all'},venueId:'room',ac:{currentTime:0},ensure:()=>true,unlock(){},setSolo(s){this.solo=s;},setVenue(id){this.venueId=id;},stop(){this.pb=null;},play(perf){if(failed)return null;this.pb={perf};plays.push({perf,solo:{...this.solo},venue:this.venueId});return this.pb;}};
const cancelAnimationFrame=()=>{},requestAnimationFrame=()=>0,updateMini=()=>{},clearRecordedMember=()=>{},renderPiece=()=>{},renderDiag=()=>{},drawIdle=()=>{},renderSelectors=()=>{},renderMemberCard=()=>{};
const ensembleListening=()=>null,busy=()=>!!(S.pending&&!S.pending.revealed),playPiece=()=>U.piece||S.pieceId||'largo';
const setNowPlaying=()=>renderPieceListening(),renderPlayButtons=()=>renderPieceListening(),refreshNow=()=>{U.perfNow=null;},setVenue=id=>{U.venue=id;E.setVenue(id);refreshNow();};
save=()=>{};
function fresh(ready=true){
 S=freshState(2028);S.members=fullBand({pitch:47,rhythm:59,tone:63,expr:38}).slice(0,5);S.pieceId='galop';S.recs=[];S.phase='choose';S.members.forEach(m=>{m.fam={largo:25,galop:42};m.sta=75;});
 U.piece=null;U.range='0';U.venue='room';U.solo='member:前の本人';U.playing=false;U.waitPlay=null;U.shown=null;U.onEnd=null;U.pieceListen=null;U.recordMember=null;U.perfNow=null;U.refreshT=0;
 E.pb=null;E.solo={type:'member',id:'前の本人'};E.venueId='room';plays=[];failed=false;CD.phase='idle';SAMPLES.ready=ready;SAMPLES.error=null;
 SAMPLES.loading=new Promise(r=>{release=()=>{SAMPLES.ready=true;r();};});renderPieceListening();
}
const on=()=>buttons.filter(b=>b.attrs['aria-pressed']==='true');
`,ctx);
const ui=fs.readFileSync(path.join(root,'js/ui.js'),'utf8'),icons=fs.readFileSync(path.join(root,'js/icons.js'),'utf8');
vm.runInContext(icons.slice(0,icons.indexOf('// テンポの1拍')),ctx);
vm.runInContext(ui.slice(ui.indexOf('const STAGE_PERFORMERS ='),ui.indexOf('function levelAt(')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function rangeSpan('),ui.indexOf('const busy =')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function currentCtx(){'),ui.indexOf('function refreshNow(){')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function playPerf('),ui.indexOf('function setVenue(')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function applySolo(){'),ui.indexOf('// 録音の参照は')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function soloAll(){'),ui.indexOf('// 今の部員の試聴は')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function modelPerf('),ui.indexOf('// 曲のカード（')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function commit(next)'),ui.indexOf('/* ===== いまの演奏')),ctx);
(async()=>{
 await vm.runInContext(`(async()=>{
 let checked=0;
 for(const pid of PIECE_IDS)for(const kind of ['model','preview']){
  fresh();const before=JSON.stringify(S),venue=kind==='model'?'hall':'room',expected=kind==='model'?modelPerf(pid):perform(perfCtx(S,{pieceId:pid,venue,from:0,to:PIECES[pid].beats}));
  listenPiece(pid,kind);assert.equal(U.playing,true);assert.equal(E.solo.type,'all');assert.equal(plays[0].venue,venue);assert.equal(plays[0].solo.type,'all');assert.equal(JSON.stringify(U.shown),JSON.stringify(expected));assert.equal(on().length,1);assert.equal(on()[0].dataset.pid,pid);assert.equal(on()[0].dataset.act,kind);assert.equal(cards.filter(c=>c.dataset.listening==='true').length,1);assert.equal(JSON.stringify(S),before);checked++;
 }
 // 同じボタンは停止。別の聴き方や曲では前の終了処理を済ませる。
 fresh();listenPiece('largo','model');const button=on()[0];listenPiece('largo','model');assert.equal(U.playing,false);assert.equal(U.pieceListen,null);assert.equal(on().length,0);
 listenPiece('largo','model');listenPiece('largo','preview');assert.equal(pieceListening().kind,'preview');assert.equal(on().length,1);assert.equal(on()[0].dataset.act,'preview');assert.equal(E.solo.type,'all');assert.equal(U.shown.venue,'hall');
 listenPiece('ode','preview');assert.equal(on()[0].dataset.pid,'ode');E.pb=null;endPlay(true);assert.equal(on().length,0);assert.equal(U.pieceListen,null);assert.ok(button.innerHTML.includes('お手本'));
 // 前の音の終了処理で本人指定が戻っても、その後で全員へそろえる。
 fresh();let ended=0;U.playing=true;U.shown=currentPerformance();U.onEnd=()=>{ended++;U.solo='member:前の人';applySolo();};listenPiece('galop','model');assert.equal(ended,1);assert.equal(E.solo.type,'all');assert.equal(U.playing,true);
 // 前の読み込みを解放しても、新しく選んだ曲だけを鳴らす。
 fresh(false);listenPiece('largo','model');assert.ok(U.waitPlay);assert.ok(on()[0].innerHTML.includes('読み込み中'));listenPiece('ode','preview');release();await tick();assert.equal(plays.length,1);assert.equal(U.shown.pieceId,'ode');assert.equal(pieceListening().kind,'preview');
 fresh(false);listenPiece('largo','model');listenPiece('largo','model');release();await tick();assert.equal(plays.length,0);assert.equal(U.waitPlay,null);assert.equal(U.pieceListen,null);
 // 作り直しの予約を残して、今の演奏の参照を後から差し替えない。
 fresh();U.refreshT=setTimeout(()=>{U.perfNow={stale:true};},0);listenPiece('galop','preview');await new Promise(r=>setTimeout(r,10));assert.equal(U.shown,U.perfNow);
 // 部を保存する操作では、待機を含めて古い試聴を止める。
 for(const ready of [true,false]){fresh(ready);listenPiece('largo','preview');const next=renameMember(S,S.members[0].id,'山田 花音');commit(next);assert.equal(S,next);assert.equal(U.playing,false);assert.equal(U.waitPlay,null);assert.equal(U.pieceListen,null);const n=plays.length;release();await tick();assert.equal(plays.length,n);}
 fresh();U.playing=true;U.shown=currentPerformance();const normal=U.shown;commit({...S,cohesion:43});assert.equal(U.playing,true);assert.equal(U.shown,normal,'通常の合奏は保存だけでは止めない');
 // 終了処理で部が変わった場合、古い部で音を作らない。
 fresh();U.playing=true;U.onEnd=()=>{S={...S,cohesion:80};};listenPiece('largo','preview');assert.equal(plays.length,0);
 fresh();S.pending={revealed:false};listenPiece('largo','model');assert.equal(plays.length,0);fresh();CD.phase='watch';listenPiece('largo','model');assert.equal(plays.length,0);
 fresh();failed=true;listenPiece('largo','preview');assert.equal(U.pieceListen,null);assert.equal(on().length,0);assert.equal(U.playing,false);
 console.log('全15曲×お手本・いまの部の'+checked+'通りの実際の音／本人指定を解消／表示どおりの会場／同じボタンで停止／切替・自然終了・待機中止／古い予約を鳴らさない／最新の部・通常の再生を保持／失敗時の印を解除：確認済み');
 })()`,ctx);
})().catch(e=>{console.error(e);process.exitCode=1;});
