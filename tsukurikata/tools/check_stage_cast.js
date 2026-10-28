'use strict';
/* 出場者と鳴る部員を分け、当日の記録と音を変えずに舞台へ表示する。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),ctx=vm.createContext({assert,console});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),pieces=[...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]);
for(const file of ['util','instruments','venues','scores',...pieces,'band','game'])vm.runInContext(fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'),ctx,{filename:file+'.js'});
const ui=fs.readFileSync(path.join(root,'js/ui.js'),'utf8'),conduct=fs.readFileSync(path.join(root,'js/conduct.js'),'utf8');
vm.runInContext('let S;const CD={};',ctx);
vm.runInContext(ui.slice(ui.indexOf('const STAGE_PERFORMERS ='),ui.indexOf('function levelAt(')),ctx);
vm.runInContext(conduct.slice(conduct.indexOf('function stagePerformance('),conduct.indexOf('// stage を渡すと')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function memberSays('),ui.indexOf('function closeMemberNameForm(')),ctx);
vm.runInContext(`
let silent=0,checked=0;
for(const pieceId of PIECE_IDS){
 S=freshState(2028);S.members=fullBand({pitch:68,rhythm:72,tone:64,expr:61});S.pieceId=pieceId;S.recs=[];
 const rec=addRec(S,'本番',{venue:'hall'}),before=JSON.stringify(S),sound=perform(recCtx(rec)),perf=stagePerformance(rec);
 assert.equal(JSON.stringify(perf),JSON.stringify(sound),'舞台の表示で'+pieceId+'の演奏を変えない');
 assert.equal(STAGE_PERFORMERS.get(perf).recorded,false,'現在の本番を過去の録音の再生と混ぜない');
 cdSetMembers(perf);
 assert.equal(CD.stageMembers.size,rec.snap.members.length);assert.equal(CD.who.size,rec.snap.members.length);
 assert.deepEqual([...CD.who].sort(),rec.snap.members.map(m=>m.id).sort());
 assert.deepEqual([...CD.sounding].sort(),[...new Set([...sound.notes,...sound.hits].map(n=>n.mid))].sort());
 for(const m of rec.snap.members){assert.deepEqual(cdMemberById(m.id),m);if(!CD.sounding.has(m.id))silent++;}
 assert.equal(cdMemberById('出ていない人'),undefined);
 assert.equal(JSON.stringify(S),before);checked++;
}
// 選んだ人だけが出場し、出番のない人もその中に残る。
S=freshState(2028);S.members=fullBand({pitch:68,rhythm:72,tone:64,expr:61});S.pieceId='swan';S.recs=[];
const ids=S.members.slice(23,28).map(m=>m.id),rec=addRec(S,'少人数',{venue:'civic',only:ids}),before=JSON.stringify(S);
const perf=stagePerformance(rec);cdSetMembers(perf);assert.deepEqual([...CD.who].sort(),ids.slice().sort());assert.ok(CD.who.size>CD.sounding.size);
// 改名・席替え・卒業後でも、同じidの現在の部員へ入れ替えない。
const saved=JSON.stringify(rec),member=rec.snap.members[0];S.members=S.members.map(m=>({...m,name:'今の名前',grade:1,seat:null,stats:{pitch:1,rhythm:1,tone:1,expr:1}}));
assert.equal(cdMemberById(member.id).name,member.name);assert.deepEqual(cdMemberById(member.id).stats,member.stats);assert.equal(cdMemberById(member.id).seat,member.seat);
S.members=[];assert.deepEqual(cdMemberById(member.id),member);assert.equal(JSON.stringify(rec),saved);
// アンサンブルは育つ前の本番の力を見せる。音や結果を再計算して保存しない。
S=freshState(2028);S.members=fullBand({pitch:39.7,rhythm:72,tone:49.7,expr:61});S.members.forEach(m=>{m.grade=1;m.mental=39;});S.pieceId='galop';S.phase='winter';S.winter={step:1,plan:'kiso'};
S=runEnsemble(S,S.members.slice(0,5).map(m=>m.id));const e=S.winter.ens,r=S.recs.find(r=>r.id===e.recId),s=JSON.stringify(S);cdSetMembers(stagePerformance(r));
assert.ok(cdMemberById(e.ids[0]).stats.pitch<S.members[0].stats.pitch);assert.equal(cdMemberById(e.ids[0]).mental,39);assert.equal(S.members[0].mental,44);assert.equal(JSON.stringify(S),s);
// 当日の譜読みを使い、課題曲の話を自由曲と呼ばない。選曲前にも落ちない。
S.week=0;S.pieceId='galop';const m={id:'say',grade:2,stats:{pitch:90,rhythm:90,tone:90,expr:90},pfams:PIECES.largo.spans.map(()=>100)};
assert.ok(memberSays(m,'largo').includes('この曲、だいぶ'));m.pfams=m.pfams.map(()=>0);assert.ok(memberSays(m,'largo').includes('この曲、まだ楽譜'));delete m.pfams;assert.equal(typeof memberSays(m,null),'string');
console.log('全'+checked+'曲の音と記録の不変／音符のない延べ'+silent+'人を含む全出場者／少人数の人選／改名・席替え・卒業後も当時の本人／アンサンブルで育つ前の力／当日の曲と譜読みのひとこと：確認済み');
`,ctx);

// 実際の本番の進行でも、課題曲から自由曲へ当日の顔を渡す。
vm.runInContext(`
const U={piece:null,range:'all'},E={ac:null,applaud(){}},jobs=[],opened=[],played=[];
let ended=null,applauded=0,conducted=null;
const stopPlay=()=>{},soloAll=()=>{},commit=next=>{S=next;},setVenue=()=>{},renderAll=()=>{},fxCalm=()=>true;
const cdMsg=()=>{},setTimeout=(fn,ms)=>{jobs.push({fn,ms});},stageCurtainClose=()=>{};
const openWatch=(perf,title)=>{CD.phase='watch';CD.perf=perf;cdSetMembers(perf);opened.push({perf,title,members:[...CD.stageMembers.values()]});};
const playPerf=(perf,label,done)=>{played.push(perf);ended=done;};
const applaudThenReveal=()=>{applauded++;},reveal=()=>{},closeWatch=()=>{CD.phase='idle';},openConduct=stage=>{conducted=stage;};
function prepareStage(){S=freshState(2028);S.members=fullBand({pitch:68,rhythm:72,tone:64,expr:61});S.pieceId='swan';S.setPiece='ode';S.division='A';S.week=PREF_WEEK;S.recs=[];S.phase='week';}
`,ctx);
vm.runInContext(ui.slice(ui.indexOf('function startStage(){'),ui.indexOf('function reveal(){')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function playEnsemble(){'),ui.indexOf('function playRec(')),ctx);
vm.runInContext(`
prepareStage();startStage();const frozen=JSON.stringify(S);
assert.equal(opened.at(-1).perf.pieceId,'ode');assert.equal(CD.who.size,39);assert.equal(opened.at(-1).members.length,39);
ended(true);jobs.find(j=>j.ms===1600).fn();assert.equal(opened.at(-1).perf.pieceId,'swan');assert.equal(CD.who.size,39);assert.equal(CD.sounding.size,34);
for(const perf of played)assert.equal(JSON.stringify(perf),JSON.stringify(perform(recCtx(S.recs.find(r=>r.pieceId===perf.pieceId)))));
ended(true);assert.equal(applauded,1);assert.equal(JSON.stringify(S),frozen);
prepareStage();jobs.length=0;startStageConduct();assert.equal(opened.at(-1).perf.pieceId,'ode');assert.equal(CD.who.size,39);ended(true);jobs.find(j=>j.ms===1600).fn();assert.equal(conducted.rec.pieceId,'swan');
S=freshState(2028);S.members=fullBand({pitch:39.7,rhythm:72,tone:49.7,expr:61});S.members.forEach(m=>m.grade=1);S.pieceId='galop';S.phase='winter';S.winter={step:1,plan:'kiso'};S=runEnsemble(S,S.members.slice(0,5).map(m=>m.id));
const ensState=JSON.stringify(S);playEnsemble();assert.equal(CD.who.size,5);assert.equal(opened.at(-1).members[0].stats.pitch,39.7);assert.equal(JSON.stringify(S),ensState);
console.log('A部門の課題曲→自由曲と拍手／課題曲→自由曲の指揮／アンサンブルの実際の開始／出場人数・当日の力・音と結果の保持：確認済み');
`,ctx);

// 当日の人を、空の舞台から入場させる。現在の席や名前へ置き換えない。
vm.runInContext(`
const entrance=[],cur={querySelector:()=>({innerHTML:''}),classList:{add(){},remove(){}}};
const document={querySelector:()=>cur,getElementById:()=>({})},$=()=>({textContent:'開演前'}),drawStage=(t,cv,who)=>entrance.push([...who]);
S=freshState(2028);S.members=fullBand({pitch:68,rhythm:72,tone:64,expr:61});S.pieceId='swan';S.recs=[];
const stageRecord=addRec(S,'記録した本番',{venue:'hall'});CD.perf=stagePerformance(stageRecord);cdSetMembers(CD.perf);S.members=[];jobs.length=0;
`,ctx);
const fx=fs.readFileSync(path.join(root,'js/fx.js'),'utf8');
vm.runInContext(fx.slice(fx.indexOf('function stageIntro('),fx.indexOf('// 演奏が終わったら幕を下ろす')),ctx);
vm.runInContext(`
let started=0;stageIntro(CD.perf,{title:'本番'},stageRecord,()=>started++);
assert.equal(entrance[0].length,0);for(let i=0;i<jobs.length;i++)jobs[i].fn();
assert.ok(entrance.some(ids=>ids.length>0&&ids.length<39));assert.deepEqual(entrance.at(-1).slice().sort(),stageRecord.snap.members.map(m=>m.id).sort());assert.equal(started,1);
console.log('当日の記録から空の舞台→入場途中→全39人／今の名簿にいなくても本人を保つ／入場後に一度だけ演奏開始：確認済み');
`,ctx);
