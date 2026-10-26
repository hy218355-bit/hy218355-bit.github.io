'use strict';
/* 譜読みの時間差と、実力・スキル・配分・覚えた値を保つことを確かめる。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),stored=new Map(),report={};
const ctx=vm.createContext({console,assert,report,localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)}});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const pieces=[...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]);
for(const f of ['util','instruments','venues','scores',...pieces,'band','game'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f+'.js'});
vm.runInContext(`
assert.equal(PIECE_IDS.length,15);
assert.equal(new Set(PIECE_IDS.map(id=>pieceDifficulty(id))).size,5);
for(const id of PIECE_IDS){assert.ok(Number.isInteger(PIECES[id].readDifficulty));assert.equal(pieceDifficulty(id),PIECES[id].readDifficulty);}
assert.equal(pieceDifficulty('まだない曲'),3);assert.equal(readingLoad('まだない曲'),1);
const original=Object.fromEntries(PIECE_IDS.map(id=>[id,PIECES[id].readDifficulty]));
let base=freshState(2026);base.members=fullBand({pitch:40,rhythm:40,tone:40,expr:40});base.recruits=null;base.phase='week';base.week=4;base.pieceId='galop';base.division='B';base.morale=80;base.cohesion=40;
for(const m of base.members){m.sta=100;m.fam={};m.sp={};m.bent={};}
const unchanged=JSON.stringify(base);
const advance=(level,s=base,menu='piece')=>{PIECES.galop.readDifficulty=level;return practiceWeek(s,menu);};
const states=[1,2,3,4,5].map(level=>advance(level)),readings=states.map(s=>readAvg(s,'galop'));
for(let i=1;i<readings.length;i++)assert.ok(readings[i]<readings[i-1]);
assert.equal(JSON.stringify(base),unchanged);
assert.equal(readingLoad('galop'),1.4);
for(const s of states){assert.equal(JSON.stringify(s.members.map(m=>m.stats)),JSON.stringify(states[2].members.map(m=>m.stats)));assert.equal(JSON.stringify(s.members.map(m=>m.id)),JSON.stringify(base.members.map(m=>m.id)));}
report.firstWeek=readings;
const skilled=clone(base);for(const m of skilled.members)m.sp.reader=2.5;
const strong=clone(base);for(const m of strong.members)m.stats={pitch:75,rhythm:75,tone:75,expr:75};
assert.ok(readAvg(advance(5,skilled),'galop')>readAvg(advance(5),'galop'));
assert.ok(readAvg(advance(5,strong),'galop')>readAvg(advance(5),'galop'));
const learned=clone(base);for(const m of learned.members)m.fam.galop=[100,100,100];
assert.equal(readAvg(advance(5,learned),'galop'),100);
const individual=clone(base);for(const m of individual.members)m.fam.galop=[70,70,70];
assert.equal(readAvg(advance(1,individual),'galop'),70);
const together=advance(5,individual,'tutti');assert.ok(readAvg(together,'galop')>70);
const split=clone(base);split.setPiece='ode';split.division='A';split.split='both';
PIECES.ode.readDifficulty=3;const regular=advance(3,split);
PIECES.ode.readDifficulty=5;const mixed=advance(1,split);
assert.ok(readAvg(mixed,'galop')>readAvg(regular,'galop'));
assert.ok(readAvg(mixed,'ode')<readAvg(regular,'ode'));
// 同じ部・同じ体力とやる気で合奏を重ね、9割まで覚える回数を比べる。
report.weeksTo90=[1,3,5].map(level=>{
 let s=clone(base),weeks=0;
 while(readAvg(s,'galop')<90&&weeks<60){s.week=4;s.morale=80;for(const m of s.members)m.sta=100;s=advance(level,s,'tutti');weeks++;}
 assert.ok(weeks<60);return weeks;
});
assert.ok(report.weeksTo90[0]<report.weeksTo90[1]);assert.ok(report.weeksTo90[1]<report.weeksTo90[2]);
const judged=level=>{PIECES.galop.readDifficulty=level;const p=perform(perfCtx(learned));return JSON.stringify(judge(p,analyze(p),'pref'));};
assert.equal(judged(1),judged(5));
const old=clone(base);old.members[0].fam.galop=[12,34,56];save(old);const loaded=load();
assert.ok(loaded);assert.equal(JSON.stringify(loaded.members[0].fam),JSON.stringify(old.members[0].fam));assert.equal(loaded.v,old.v);
old.members[0].fam.galop=52;save(old);const numeric=load();assert.equal(numeric.members[0].fam.galop,52);assert.equal(JSON.stringify(readOf(numeric.members[0],'galop')),JSON.stringify([52,52,52]));
for(const [id,n]of Object.entries(original))PIECES[id].readDifficulty=n;
report.pieces=PIECE_IDS.map(id=>({id,title:PIECES[id].title,difficulty:pieceDifficulty(id),load:readingLoad(id)}));
`,ctx);
console.log('15曲の設定／週の進み方／実力と譜読みスキル／個人練習と合奏／課題曲の配分／旧セーブ／覚えた値／採点の保持：確認済み');
console.log(JSON.stringify(report));
