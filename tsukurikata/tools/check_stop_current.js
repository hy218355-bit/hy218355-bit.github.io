'use strict';
/* 停止後に今の譜面へ戻り、次の演奏や本番の終了処理を消さないことを確かめる。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ui=fs.readFileSync(path.join(__dirname,'../js/ui.js'),'utf8');
const ctx=vm.createContext({console,assert,setTimeout,clearTimeout});
vm.runInContext(`
let S={week:1},calls=[];
const U={playing:true,shown:{week:0},shownLabel:'前の週',perfNow:{week:1},refreshT:0,onEnd:null};
const nodes={};const $=s=>nodes[s]||=( {} );
const window={},nativePost=()=>{},cancelAnimationFrame=()=>{},clearRecordedMember=()=>{},renderPiece=()=>{},setNowPlaying=()=>{},renderDiag=()=>{},drawIdle=()=>{};
const playbackStopFocus=()=>null,restorePlaybackStopFocus=()=>{};
const renderSelectors=()=>{},renderCurrentMemberListening=()=>{};
const currentPerformance=()=>({week:S.week}),analyze=perf=>({week:perf.week}),nowLabel=()=>'第'+S.week+'週';
const wait=()=>new Promise(r=>setTimeout(r,40));
`,ctx);
vm.runInContext(ui.slice(ui.indexOf('function refreshNow(){'),ui.indexOf('function setNowPlaying(){')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function endPlay('),ui.indexOf('function stopPlay(){')),ctx);
const dates=vm.createContext({assert});
vm.runInContext(`
let S={phase:'winter',week:26,winter:{step:0}};
const U={venue:'room'},VENUE={room:{name:'音楽室'}},winterStep=s=>[{m:11},{m:1},{m:3}][s.winter.step],wkLabel=w=>'週'+w;
`,dates);
vm.runInContext(ui.slice(ui.indexOf('const nowWhen ='),ui.indexOf('const busy =')),dates);
vm.runInContext(`
for(const [step,month] of [[0,11],[1,1],[2,3]]){S.winter.step=step;assert.equal(nowWhen(),month+'月');assert.equal(nowLabel(),'いまの音（'+month+'月・音楽室）');}
for(const phase of ['choose','chooseSet']){S.phase=phase;assert.equal(nowWhen(),'選曲前');}
S.phase='week';assert.equal(nowWhen(),'週26');
`,dates);
(async()=>{
 await vm.runInContext(`(async()=>{
 const before=JSON.stringify(S);U.onEnd=natural=>calls.push(natural);endPlay(false);await wait();
 assert.equal(U.playing,false);assert.equal(U.shown.week,1);assert.equal(U.shown,U.perfNow);assert.equal(U.shownLabel,'第1週');assert.equal(U.diag.week,1);assert.equal(JSON.stringify(S),before);assert.deepEqual(calls,[false]);
 U.playing=true;U.shown={week:0};U.shownLabel='前の週';
 U.onEnd=natural=>{assert.equal(natural,true);U.playing=true;U.shown={kind:'次の本番'};U.shownLabel='自由曲';};
 endPlay(true);await wait();assert.equal(U.shown.kind,'次の本番');assert.equal(U.shownLabel,'自由曲');assert.equal(U.playing,true);
 // 作り直しのタイマーは、音源待ちの曲と表示名を上書きしない。
 U.playing=false;const queued={kind:'音源待ち'};U.waitPlay={perf:queued};U.shown=queued;U.shownLabel='待っている曲';
 refreshNow();await wait();assert.equal(U.shown,queued);assert.equal(U.shownLabel,'待っている曲');assert.equal(U.perfNow.week,1);
 U.waitPlay=null;
 U.playing=true;U.onEnd=()=>{S={week:2};};endPlay(false);await wait();
 assert.equal(U.shown.week,2);assert.equal(U.shownLabel,'第2週');assert.equal(U.shown,U.perfNow);assert.equal(U.onEnd,null);
 })()`,ctx);
 console.log('週を進めたあとの停止で今の音と譜面へ戻る／元の部を変えない／終了の通知は1回／次の本番を上書きしない／終了処理後の最新状態を使う：確認済み');
})().catch(e=>{console.error(e);process.exitCode=1;});
