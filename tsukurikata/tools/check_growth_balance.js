'use strict';
/* 最初の音・育てた人選・副顧問の案内・前の保存内容を、実際の計算で確かめる。 */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),stored=new Map(),report={pieces:[],guide:[]};
const ctx=vm.createContext({console,assert,report,localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)}});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const pieces=[...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]);
for(const f of ['util','instruments','venues','scores',...pieces,'band','game','advisor'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f+'.js'});
const manual=fs.readFileSync(path.join(__dirname,'sim.js'),'utf8').match(/const manualPlan = s => \{[\s\S]*?\n\};/);
assert.ok(manual,'手動練習の比較がない');vm.runInContext(manual[0],ctx);
vm.runInContext(`
assert.equal(contestPoints(0),0);assert.equal(contestPoints(100),100);
for(let x=0.25;x<=100;x+=0.25)assert.ok(contestPoints(x)>contestPoints(x-.25),'育てた音の点が採点の境目で下がる');
const context=(pieceId,members)=>({pieceId,members,cohesion:75,fam:100,venue:'hall',seed:'育てた音'});
const played=(pieceId,members)=>{const p=perform(context(pieceId,members)),a=analyze(p);return {q:quality(a),j:judge(p,a,'pref').avg,a};};
for(const id of PIECE_IDS){
 let s=freshState(2026);s.recruitSeed=20261029;s=assignRecruits(s,autoAssign(s));s=choosePiece(s,id);
 s=practiceWeek(s);assert.equal(s.week,1);s=beginStage(s);
 assert.ok(s.pending.q>0&&s.pending.q<40,id+': 最初の音が0点か、初めから上手すぎる');
 const first=s.pending.q;
 const all=fullBand({pitch:80,rhythm:80,tone:80,expr:80}).map(m=>({...m,trait:'steady'}));
 const stable=all.filter((m,i)=>i%2===0),others=all.filter((m,i)=>i%2!==0);
 const trained=[15,40,65,80].map(level=>played(id,[...stable,...others.slice(0,5).map(m=>({...m,stats:{pitch:level,rhythm:level,tone:level,expr:level}}))]));
 // 編成を固定して初心者を育てると、外さなくても大会で戦力になる。
 // 上級者同士の小差は音量の釣り合いと審査員の揺れもあるため、すべての小差で点の単調増加は要求しない。
 assert.ok(trained[1].j>trained[0].j+5&&trained[2].j>trained[1].j+5&&trained[3].j>trained[0].j+10,id+': 育てた奏者が戦力にならない');
 for(let i=1;i<trained.length;i++)assert.ok(trained[i].q>trained[i-1].q&&trained[i].a.fullness>=trained[i-1].a.fullness,id+': 育てた音や厚みが伸びない');
 const novice=played(id,all.map(m=>({...m,stats:{pitch:15,rhythm:15,tone:15,expr:15}})));
 assert.ok(novice.a.disruption<3,id+': 全員の育ち始めを、一人が全体を乱した場合と混同している');
 const empty=played(id,[]);assert.equal(empty.q,0);assert.equal(empty.j,0);
 report.pieces.push({id,first:+first.toFixed(1),trained:trained.map(x=>+x.j.toFixed(1)),noviceDisruption:+novice.a.disruption.toFixed(2)});
}
let s=freshState(2026);
const check=(key,lineup=false)=>{const before=JSON.stringify(s),h=advisorHint(s,lineup);assert.equal(h.key,key);assert.equal(JSON.stringify(s),before);assert.ok(h.line.length<40);assert.ok(h.text.length<180);report.guide.push(key);};
check('intake');s=assignRecruits(s,autoAssign(s));check('choose');s=choosePiece(s,'galop');check('first-practice');
s.week=4;s.episode=null;s.consult=null;s.outing=null;for(const m of s.members)m.sta=100;
check('reading');s.policy='basics';check('basics');s.members[0].sta=20;check('rest');s.members[0].sta=100;s.policy='auto';
for(const m of s.members)m.fam={galop:80};s.cohesion=40;check('together');s.cohesion=90;check('practice');
check('lineup',true);s.consult={id:'確認'};check('story');s.consult=null;
s.week=16;check('stage');s.pending={revealed:false};check('playing');s.pending={kind:'concert',revealed:true};check('concert');s.pending={kind:'contest',revealed:true};check('result');s.pending=null;
s.phase='end';check('year');s.phase='chooseSet';check('set');
// 案内や調整を入れても、保存した力と以前の結果を読み込みで書き換えない。
s=freshState(2026);s=choosePiece(assignRecruits(s,autoAssign(s)),'galop');
s.recs=[{id:'previous',pieceId:'galop',year:2026,week:1,snap:snapshot(s),result:{award:'gold',rep:true,avg:81.2}}];
s.pending={kind:'concert',q:12.3,recId:'previous',revealed:true};
const kept=x=>JSON.stringify({stats:x.members.map(m=>m.stats),recs:x.recs,pending:x.pending});
const before=kept(s);advisorHint(s);save(s);assert.equal(kept(load()),before);
// 自動と違う指示を実際に出し、基礎が弱いうちは先に基礎を育てられる。
s.pending=null;s.week=4;s.phase='week';s.policy='auto';s.cohesion=95;
for(const m of s.members){m.stats={pitch:35,rhythm:35,tone:35,expr:25};m.sta=100;m.fam={galop:100};}
const original=JSON.stringify(s),plan=manualPlan(s);assert.equal(JSON.stringify(s),original);
assert.ok(Object.values(plan).every(id=>id!=='phrase'));
const autoAfter=practiceWeek(s),manualAfter=practiceWeek(s,plan);
assert.ok(basicsOf(manualAfter.members[0])>basicsOf(autoAfter.members[0]));
report.manual={auto:decideMenu(s,s.members[0]),chosen:plan[s.members[0].id],autoBasics:basicsOf(autoAfter.members[0]),manualBasics:basicsOf(manualAfter.members[0])};
// 読み終えた上級者だけ個別練習へ。本番前と、まだ読めていない部員の合奏は残す。
s.week=8;assert.equal(decideMenu(s,s.members[0]),'tutti');assert.notEqual(manualPlan(s)[s.members[0].id],'tutti');
for(const m of s.members)m.fam={galop:50};assert.equal(manualPlan(s)[s.members[0].id],'tutti');
for(const m of s.members)m.fam={galop:100};s.week=10;assert.equal(manualPlan(s)[s.members[0].id],'tutti');
// 同じ部員・曲・当日の調子で、本番前の休養が育った力を出すことに役立つ。
s=freshState(2026);s.members=fullBand({pitch:70,rhythm:70,tone:70,expr:70});s.recruits=null;s.phase='week';s.week=19;s.division='A';s.policy='auto';s.setPiece='ode';s.cohesion=95;s.hallExp=75;s.stamina=35;s.morale=80;s.season=[{level:'pref',award:'gold',rep:true,avg:80}];
for(const m of s.members){m.sta=35;m.mental=70;m.trait='steady';m.fam=Object.fromEntries(PIECE_IDS.map(id=>[id,95]));}
s.pieceId='galop';check('before-rest');
const plannedRest=clone(s);plannedRest.plan=Object.fromEntries(s.members.map(m=>[m.id,'rest']));
assert.notEqual(advisorHint(plannedRest).key,'before-rest','すでに休ませる指示でも、練習を続ける前提で案内した');
const plannedBefore=s;s=plannedRest;check('rest-plan');s=plannedBefore;
report.beforeStage=[];const random=Math.random;Math.random=()=>0.5;
try{
 for(const sta of [30,35,59,60,85]){
  const x=clone(s);for(const m of x.members)m.sta=sta;syncSta(x);
  assert.equal(advisorHint(x).key==='before-rest',fatigueOf(practiceWeek(x))>0,'前週の体力の案内が実際の疲れと違う');
 }
 for(const id of PIECE_IDS){
  s.pieceId=id;const trained=practiceWeek(s),rested=practiceWeek(s,'rest');
  const a=beginStage(trained).pending.judge.avg,b=beginStage(rested).pending.judge.avg;
  assert.ok(b>a+5,id+': 本番前の休養が演奏に返らない');
  report.beforeStage.push({id,autoStamina:trained.stamina,restStamina:rested.stamina,auto:+a.toFixed(1),rest:+b.toFixed(1)});
 }
}finally{Math.random=random;}
`,ctx);
console.log(JSON.stringify(report,null,2));
