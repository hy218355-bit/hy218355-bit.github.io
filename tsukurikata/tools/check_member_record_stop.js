'use strict';
/* 個人録音の停止・待機の中止・全員への切り替えで、本人だけの指定を残さない。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const pieces=[...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]);
const ctx=vm.createContext({console,assert,tick:()=>new Promise(setImmediate)});
for(const f of ['util','instruments','venues','scores',...pieces,'band','game'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f+'.js'});
vm.runInContext(`
// 案内の画面更新は別の検証で確かめ、ここでは従来の再生操作を比べる。
const onboardingPlayed=()=>{},renderOnboarding=()=>{},renderGrowthListening=()=>{};
let S,release,plays=[],selectorStates=[];
const SAMPLES={use:true,ready:false,error:null,loading:null};
const U={venue:'room',solo:'all',playing:false,waitPlay:null,shown:null,shownLabel:'',perfNow:null,onEnd:null};
const window={},nodes={},$=s=>nodes[s]||=({});
const document={activeElement:null};
const E={solo:{type:'all'},pb:null,ac:{currentTime:0},ensure:()=>true,unlock(){},setSolo(s){this.solo=s;},stop(){this.pb=null;},play(perf){
 this.stop();this.pb={perf};plays.push({perf,solo:{...this.solo}});return this.pb;
}};
const cancelAnimationFrame=()=>{},requestAnimationFrame=()=>0;
const updateMini=()=>{},renderPlayButtons=()=>{},setNowPlaying=()=>{},clearRecordedMember=()=>{},renderPiece=()=>{},drawIdle=()=>{};
const refreshNow=()=>{U.perfNow=null;},renderSelectors=()=>{selectorStates.push(U.solo);},setVenue=id=>{U.venue=id;};
function fresh(ready=false){
 S=freshState(2026);S=assignRecruits(S,autoAssign(S));S=choosePiece(S,'galop');
 S.members=fullBand({pitch:68,rhythm:72,tone:64,expr:61});S.year=2028;S.week=26;S.recs=[];
 const early=clone(S);early.year=2026;early.week=0;early.members.forEach(m=>{m.stats={pitch:15,rhythm:12,tone:18,expr:10};});
 addRec(early,'入部したころ',{venue:'room'});S.recs=clone(early.recs);addRec(S,'最後の本番',{venue:'hall'});
 U.solo='all';U.playing=false;U.waitPlay=null;U.shown=null;U.onEnd=null;U.recordMember=null;E.pb=null;E.solo={type:'all'};plays=[];selectorStates=[];
 SAMPLES.ready=ready;SAMPLES.error=null;SAMPLES.loading=new Promise(r=>{release=()=>{SAMPLES.ready=true;r();};});
}
const ids=perf=>[...new Set([...perf.notes,...perf.hits].map(n=>n.mid))];
`,ctx);
const ui=fs.readFileSync(path.join(root,'js/ui.js'),'utf8'),conduct=fs.readFileSync(path.join(root,'js/conduct.js'),'utf8');
vm.runInContext(ui.slice(ui.indexOf('const STAGE_PERFORMERS ='),ui.indexOf('function levelAt(')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function playPerf('),ui.indexOf('function setVenue(')),ctx);
vm.runInContext(conduct.slice(conduct.indexOf('const recPerf ='),conduct.indexOf('const recFileName =')),ctx);
(async()=>{
 await vm.runInContext(`(async()=>{
 fresh();let before=JSON.stringify(S),m=S.members[2];playMemberRec(S.recs[0],m,'本人');
 assert.ok(U.waitPlay);assert.equal(U.solo,'member:'+m.id);
 assert.equal(U.shown,U.waitPlay.perf);assert.equal(U.shownLabel,'本人');assert.ok(recordingPlayback());
 assert.deepEqual([...U.stageMembers.values()].map(m=>m.id).sort(),S.recs[0].snap.members.map(m=>m.id).sort());
 stopPlay();assert.equal(recordingPlayback(),false);
 assert.equal(U.waitPlay,null);assert.equal(U.solo,'all');assert.equal(E.solo.type,'all');
 release();await tick();assert.equal(plays.length,0);assert.equal(U.playing,false);assert.equal(JSON.stringify(S),before);
 // 読み込み待ちの個人録音を、全員の録音へ切り替える。
 fresh();before=JSON.stringify(S);m=S.members[2];playMemberRec(S.recs[0],m,'本人');playRecording(S.recs[1],'全員');
 assert.equal(U.solo,'all');release();await tick();assert.equal(plays.length,1);assert.equal(plays[0].solo.type,'all');
 assert.equal(U.shownLabel,'全員');assert.equal(ids(U.shown).length,39);assert.equal(JSON.stringify(S),before);
 // 鳴っている個人録音からでも、終了の処理を行ってから全員へ切り替える。
 fresh(true);m=S.members[2];playMemberRec(S.recs[0],m,'本人');assert.equal(plays.at(-1).solo.id,m.id);
 playRecording(S.recs[1],'全員');assert.equal(U.solo,'all');assert.equal(plays.at(-1).solo.type,'all');assert.equal(U.shownLabel,'全員');
 // 別の本人へ切り替えるときは、前の終了処理で新しい指定を消さない。
 fresh(true);playMemberRec(S.recs[0],S.members[2],'前の本人');playMemberRec(S.recs[1],S.members[5],'次の本人');
 assert.equal(U.solo,'member:'+S.members[5].id);assert.equal(plays.at(-1).solo.id,S.members[5].id);
 E.pb=null;endPlay(true);assert.equal(U.solo,'all');assert.equal(E.solo.type,'all');
 // 本番などの終了処理は、読み込み待ちを止めただけでは勝手に呼ばない。
 fresh();let ended=0;const p=recPerf(S.recs[0]);playPerf(p,'本番',()=>ended++);stopPlay();release();await tick();assert.equal(ended,0);assert.equal(plays.length,0);
 // 現在の合奏の本人指定は、そのまま再開できるように保つ。
 fresh();U.solo='member:'+S.members[2].id;E.setSolo({type:'member',id:S.members[2].id});playPerf(recPerf(S.recs[0]),'試聴');stopPlay();
 assert.equal(U.solo,'member:'+S.members[2].id);
 // 中止の通知は一度だけ。通知の中で始めた次の音を止めない。
 fresh();let cancelled=0;const next=recPerf(S.recs[1]);playPerf(recPerf(S.recs[0]),'待機',null,{},()=>{cancelled++;SAMPLES.ready=true;playPerf(next,'次の音');});
 stopPlay();assert.equal(cancelled,1);assert.equal(U.playing,true);assert.equal(U.shown,next);assert.equal(U.shownLabel,'次の音');
 // 通知の中で別の読み込み待ちを始めた場合も、次の曲と本人の表示を保つ。
 fresh();const queuedNext=recPerf(S.recs[1]);playPerf(recPerf(S.recs[0]),'前の待機',null,{},()=>playPerf(queuedNext,'次の待機'));
 stopPlay();assert.equal(U.waitPlay.perf,queuedNext);assert.equal(U.shown,queuedNext);assert.equal(U.shownLabel,'次の待機');assert.ok(recordingPlayback());
 release();await tick();assert.equal(plays.length,1);assert.equal(plays[0].perf,queuedNext);
 })()`,ctx);
 console.log('個人録音の待機中止・実際の停止・全員や別の本人への切替／古い待機が鳴らない／本番の終了処理を呼ばない／次の音を止めない／部と録音を変えない：確認済み');
})().catch(e=>{console.error(e);process.exitCode=1;});
