'use strict';
/* 今の部員を聴くとき、別の録音の中から探して無音にしないことを確かめる。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const pieces=[...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]);
const ctx=vm.createContext({console,assert,clearTimeout});
for(const f of ['util','instruments','venues','scores',...pieces,'band','game'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f+'.js'});
vm.runInContext(`
let S,plays=[],stops=0,afterStop=null;
const U={piece:null,range:'all',venue:'room',playing:true,shown:null,perfNow:null,solo:'all',sel:null};
const E={solo:{type:'all'},setSolo(s){this.solo=s;}};
const nodes={};const $=s=>nodes[s]||=({addEventListener(_,fn){this.click=fn;}});
const playPiece=()=>U.piece||S.pieceId||'largo',rememberStageMembers=perf=>perf;
const renderSelectors=()=>{},renderMemberCard=()=>{},renderDiag=()=>{},memberById=id=>S.members.find(m=>m.id===id);
const stopPlay=()=>{stops++;U.playing=false;U.waitPlay=null;U.perfNow=null;const cb=afterStop;afterStop=null;cb?.();};
const playPerf=(perf,label)=>{plays.push(perf);U.shown=perf;U.shownLabel=label;U.playing=true;};
function fresh(){
 S=freshState(2026);S=assignRecruits(S,autoAssign(S));S=choosePiece(S,'galop');
 S.members=fullBand({pitch:68,rhythm:72,tone:64,expr:61});S.members.forEach((m,i)=>m.id='now-'+i);S.year=2031;S.week=10;
 const old=clone(S);old.year=2027;old.members.forEach((m,i)=>{m.id='then-'+i;m.stats={pitch:30,rhythm:30,tone:30,expr:30};m.fam={galop:100};});
 old.recs=[];addRec(old,'昔の本番',{venue:'room'});S.recs=clone(old.recs);
 U.piece=null;U.range='all';U.venue='room';U.perfNow=currentPerformance();U.shown=U.perfNow;U.playing=true;U.waitPlay=null;U.solo='all';U.sel=S.members[0].id;plays=[];stops=0;afterStop=null;
}
const sound=p=>JSON.stringify(p),members=p=>new Set([...p.notes,...p.hits].map(n=>n.mid));
`,ctx);
const ui=fs.readFileSync(path.join(root,'js/ui.js'),'utf8');
vm.runInContext(ui.slice(ui.indexOf('function rangeSpan('),ui.indexOf('const busy =')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function currentCtx(){'),ui.indexOf('function refreshNow(){')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function applySolo(){'),ui.indexOf('/* ===== ホワイトボード')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function listenCurrentMember('),ui.indexOf('function startStage(){')),ctx);
const start=ui.indexOf("  $('#btnNow').addEventListener('click'");
vm.runInContext(ui.slice(start,ui.indexOf("  $('#btnRec').addEventListener",start)),ctx);
vm.runInContext(`
for(const section of [false,true]){
 fresh();U.shown=perform(recCtx(S.recs[0]));const before=JSON.stringify(S),id=S.members[1].id;
 assert.ok(!members(U.shown).has(id));afterStop=()=>{U.solo='all';E.setSolo({type:'all'});};
 listenCurrentMember(id,section);
 assert.equal(stops,1);assert.equal(plays.length,1);assert.ok(members(U.shown).has(id));
 assert.ok(sound(U.shown)===sound(perform(currentCtx())));assert.equal(U.sel,id);
 assert.equal(E.solo.type,section?'sec':'member');assert.equal(E.solo.id,section?SEAT[S.members[1].seat].sec:id);
 assert.equal(JSON.stringify(S),before,'試聴で部員も昔の録音も書き換えない');
}
// 読み込み待ちの別の人選を中止してから、今いる本人の音を作る。
fresh();U.playing=false;U.shown=perform(recCtx(S.recs[0]));U.waitPlay={perf:U.shown};
listenCurrentMember(S.members[1].id);assert.equal(stops,1);assert.equal(U.waitPlay,null);assert.equal(plays.length,1);assert.equal(U.solo,'member:'+S.members[1].id);
// 同じidでも、昔の力で鳴らしていたら今の演奏へ切り替える。
fresh();const same=clone(S);same.members[0].stats.pitch=20;U.shown=perform(perfCtx(same));const expected=sound(perform(currentCtx()));
listenCurrentMember(S.members[0].id);assert.equal(stops,1);assert.ok(sound(U.shown)===expected);
// 今の合奏を聴いている途中なら、止めずに本人とパートを切り替える。
fresh();const playing=U.shown;listenCurrentMember(S.members[1].id);listenCurrentMember(S.members[1].id,true);
assert.equal(stops,0);assert.equal(plays.length,0);assert.equal(U.shown,playing);
// 聴いている間に部が育った場合も、次の本人の試聴では今の力を使う。
fresh();S.members[1].stats.pitch=80;U.perfNow=null;listenCurrentMember(S.members[1].id);
assert.equal(stops,1);assert.ok(sound(U.shown)===sound(perform(currentCtx())));
// 停止時の処理で席を外れた場合と、初めから控えの場合は、古い席から鳴らさない。
fresh();U.shown=perform(recCtx(S.recs[0]));afterStop=()=>{S.members[1].seat=null;};listenCurrentMember(S.members[1].id);assert.equal(plays.length,0);
fresh();S.members[1].seat=null;listenCurrentMember(S.members[1].id,true);assert.equal(stops,0);assert.equal(plays.length,0);
`,ctx);
console.log('昔の録音・同じidの昔の力から今の本人とパートへ／現在の合奏は止めずに切替／育った後も今の力／停止時の席変更を再確認／部員と録音を変えない：確認済み');
