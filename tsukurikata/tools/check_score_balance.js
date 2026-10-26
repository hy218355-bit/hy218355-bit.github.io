'use strict';
/* 採点係数だけの調整で、音・練習・保存済みの結果が変わらないことを確かめる。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),stored=new Map(),report=[];
const ctx=vm.createContext({console,assert,report,localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)}});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const pieces=[...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]);
for(const f of ['util','instruments','venues','scores',...pieces,'band','game'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f+'.js'});
vm.runInContext(`
const before={largo:1,ode:.96,galop:.99,pomp:.98,aida:.96,hero:1,holst:.97,hungarian:.96,flowers:.96,tell:.96,carmen:.96,valkyrie:.96,swan:.97,spring:.97,canon:.98};
assert.equal(PIECE_IDS.length,15);
for(const id of PIECE_IDS){
 const pc=PIECES[id],after=pc.ceiling,level=pc.readDifficulty,load=readingLoad(id);
 assert.ok(after>0&&after<=before[id]);
 for(const ability of [25,65,100]){
  const members=fullBand({pitch:ability,rhythm:ability,tone:ability,expr:ability});
  const context={pieceId:id,members,cohesion:75,fam:100,venue:'hall',seed:'採点の確認'};
  const perf=perform(context),a=analyze(perf),q=quality(a);
  const s=freshState(2026);s.pieceId=id;s.members=members;s.recruits=null;s.phase='week';s.week=4;
  const practiced=practiceWeek(s,'tutti');
  pc.ceiling=before[id];
  const oldPerf=perform(context),oldA=analyze(oldPerf);
  assert.equal(JSON.stringify(perf),JSON.stringify(oldPerf),id+': 演奏の音が変わった');
  assert.equal(JSON.stringify({...a,ceiling:0}),JSON.stringify({...oldA,ceiling:0}),id+': 音の分析が変わった');
  assert.equal(quality(oldA),q,id+': 演奏会の出来が変わった');
  assert.equal(JSON.stringify(practiceWeek(s,'tutti')),JSON.stringify(practiced),id+': 練習が変わった');
  for(const venue of ['pref','block','national']){
   const now=judge(perf,a,venue),old=judge(oldPerf,oldA,venue);
   assert.ok(now.avg<=old.avg,id+': 係数を下げたのに採点が上がった');
   assert.ok(now.avg>=0&&now.avg<=100);
  }
  pc.ceiling=after;
 }
 assert.equal(pc.readDifficulty,level);assert.equal(readingLoad(id),load);
 report.push({id,before:before[id],after});
}
// 調整前に記録された点・賞・発表待ちの審査結果を、読み込みで再採点しない。
let s=freshState(2026);s=choosePiece(assignRecruits(s,autoAssign(s)),'galop');
const rec=addRec(s,'以前の県大会',{});rec.result={award:'gold',rep:true,avg:81.2};
s.history=[{y:2025,award:'gold',avg:81.2}];s.season=[{level:'pref',award:'gold',avg:81.2}];
s.pending={kind:'contest',recId:rec.id,judge:{award:'gold',rep:true,avg:81.2,judges:[{score:81}]},revealed:false};
const results=x=>JSON.stringify({recs:x.recs,history:x.history,season:x.season,pending:x.pending});
const saved=results(s);save(s);const loaded=load();assert.ok(loaded);assert.equal(results(loaded),saved);
`,ctx);
console.log('全15曲：演奏の音・分析・演奏会・練習・譜読みを保持。大会の採点係数・旧セーブの結果保持を確認。');
console.log(JSON.stringify(report));
