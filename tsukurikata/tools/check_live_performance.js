'use strict';
/* 相談や冬の練習のあと、描き直しより早く押しても最新の部で鳴ることを確かめる。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const pieces=[...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]);
const ctx=vm.createContext({console,assert});
for(const f of ['util','instruments','venues','scores',...pieces,'band','game'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f+'.js'});
vm.runInContext(`
let S,played,saved,refreshes=0,nextTimer=0;
const timers=new Map(),setTimeout=run=>{timers.set(++nextTimer,run);return nextTimer;},clearTimeout=id=>timers.delete(id);
const U={piece:null,range:'all',venue:'room',playing:false,moveUndo:null,perfNow:null,shown:null};
const nodes={};const $=s=>nodes[s]||=( {remove(){},addEventListener(_,fn){this.click=fn;}} );
save=s=>{saved=JSON.stringify(s);};
const rememberStageMembers=perf=>perf,setNowPlaying=()=>{},renderDiag=()=>{},drawIdle=()=>{};
const playPiece=()=>U.piece||S.pieceId||'largo';
const playPerf=(perf,label)=>{played={perf,label};U.shown=perf;U.shownLabel=label;U.playing=true;};
const flush=()=>{for(const [id,run] of [...timers]){timers.delete(id);run();refreshes++;}};
const json=perf=>JSON.stringify(perf);
function fresh(){
 S=freshState(2026);S=assignRecruits(S,autoAssign(S));S=choosePiece(S,'galop');
 S.members=fullBand({pitch:68,rhythm:72,tone:64,expr:61});S.year=2028;S.week=10;
 S.members.forEach((m,i)=>{m.grade=i%3+1;m.sta=95;});
 U.piece=null;U.range='all';U.venue='room';U.playing=false;U.perfNow=currentPerformance();U.shown=U.perfNow;timers.clear();played=null;
}
function checkNext(next){
 const old=U.perfNow;commit(next);assert.equal(U.perfNow,null);assert.equal(U.shown,old,'保存だけでは表示中の演奏を差し替えない');
 const state=JSON.stringify(S),expected=perform(currentCtx());
 assert.ok(json(expected)!==json(old),'練習の前後で実際に音が変わる見本を使う');
 $('#btnNow').click();assert.ok(json(played.perf)===json(expected),'最新の部員と同じ演奏になる');assert.equal(JSON.stringify(S),state);assert.equal(saved,state);
}
`,ctx);
const ui=fs.readFileSync(path.join(root,'js/ui.js'),'utf8');
vm.runInContext(ui.slice(ui.indexOf('function rangeSpan('),ui.indexOf('const busy =')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function commit(next)'),ui.indexOf('function setNowPlaying(){')),ctx);
const start=ui.indexOf("  $('#btnNow').addEventListener('click'");
vm.runInContext(ui.slice(start,ui.indexOf("  $('#btnRec').addEventListener",start)),ctx);
vm.runInContext(`
fresh();S.cohesion=39;S.consult={id:'atmos',mid:S.members[0].id};U.perfNow=U.shown=currentPerformance();checkNext(resolveConsult(S,1));assert.equal(played.perf.cohesion,.43);
fresh();S.week=26;S=startWinter(S);U.perfNow=U.shown=currentPerformance();checkNext(chooseWinterPlan(S,'kiso'));
fresh();S.outing={id:'orch'};checkNext(resolveOuting(S,S.members.slice(0,3).map(m=>m.id)));
fresh();S.week=26;U.perfNow=U.shown=currentPerformance();checkNext(startWinter(S));
// 会場や範囲を変え、描き直しを待たずに再生する。
fresh();const all=U.perfNow;U.range='0';U.venue='hall';refreshNow();assert.equal(U.perfNow,null);$('#btnNow').click();
assert.ok(json(played.perf)===json(perform(currentCtx())));assert.ok(json(played.perf)!==json(all));
const listening=U.shown,label=U.shownLabel;flush();assert.equal(U.shown,listening);assert.equal(U.shownLabel,label);
// 続けて変更したときは最後の状態で一度だけ作り直す。再生中の録音は上書きしない。
fresh();U.playing=true;const recording=U.shown;U.shownLabel='昔の録音';const count=refreshes;
commit({...S,cohesion:41});refreshNow();commit({...S,cohesion:43});refreshNow();assert.equal(timers.size,1);flush();
assert.equal(refreshes,count+1);assert.equal(U.perfNow.cohesion,.43);assert.equal(U.shown,recording);assert.equal(U.shownLabel,'昔の録音');
U.playing=false;refreshNow();flush();assert.equal(U.shown,U.perfNow);assert.equal(U.shownLabel,nowLabel());
`,ctx);
console.log('相談・冬の練習・行事・新体制後の初回再生／範囲と会場の変更直後／連続更新／再生中の録音を保つ／再生でセーブを書き換えない：確認済み');
