'use strict';
/* 同じ部員・曲・本番条件で、人選の損得と古い録音の互換性を確かめる。 */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'..'),ctx=vm.createContext({console,Math,JSON,Set,Map,setTimeout,assert});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const file of ['util','instruments','venues','scores',...[...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js"/g)].map(m=>m[1]),'band','game'])vm.runInContext(fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'),ctx,{filename:file+'.js'});
vm.runInContext(`
const rows=[];
for(const pid of Object.keys(PIECES)){
 const all=fullBand({pitch:80,rhythm:80,tone:80,expr:80}).map(m=>({...m,trait:'steady'}));
 const base=all.filter((m,i)=>i%2===0),more=all.filter((m,i)=>i%2!==0);
 const weak=m=>({...m,stats:{pitch:15,rhythm:15,tone:15,expr:15}});
 const run=members=>{const perf=perform({pieceId:pid,members,cohesion:75,fam:100,venue:'hall',seed:'band'}),a=analyze(perf);return {q:quality(a),j:judge(perf,a,'pref').avg,a,perf};};
 const saved=JSON.stringify(all),a=run(base),b=run([...base,weak(more[0])]),c=run([...base,...more.slice(0,5).map(weak)]),d=run(all),one=run([...base,more[0]]);
 assert.ok(b.q<a.q-3,pid+': 苦手な一人が音の平均に埋もれた');
 assert.ok(c.q<b.q-3,pid+': 苦手な人を増やすと有利になった');
 assert.ok(d.a.fullness>one.a.fullness&&one.a.fullness>a.a.fullness,pid+': 安定した音の重なりが加点されない');
 assert.ok(d.q>a.q+2,pid+': 安定した大編成が小編成より薄い');
 assert.ok(b.a.disruption>=3,pid+': 不安定な演奏の減点が小さい');
 assert.ok(b.a.fullness<=a.a.fullness+0.05,pid+': 人数だけで厚みが加点された');
 assert.equal(JSON.stringify(all),saved,'採点で部員の保存内容が変わった');
 // 以前の録音の控えも、保存した部員から演奏を作り直すので同じ採点になる。
 const rec={pieceId:pid,venue:'hall',snap:{members:JSON.parse(saved),cohesion:75,fam:100}};
 const savedRec=JSON.stringify(rec),oldPerf=perform(recCtx(rec)),oldA=analyze(oldPerf);
 assert.equal(quality(oldA),d.q);assert.equal(judge(oldPerf,oldA,'pref').avg,d.j);assert.equal(JSON.stringify(rec),savedRec);
 const empty=run([]);assert.ok(Number.isFinite(empty.q)&&Number.isFinite(empty.j));assert.equal(empty.a.fullness,0);
 const noPerc=run(all.filter(m=>SEAT[m.seat].sec!=='perc'));assert.ok(noPerc.a.lack.pts>=d.a.lack.pts,'欠員の減点が消えた');
 rows.push({曲:pid,安定20人:+a.j.toFixed(1),苦手1人追加:+b.j.toFixed(1),苦手5人追加:+c.j.toFixed(1),安定39人:+d.j.toFixed(1),厚み加点:+d.a.fullness.toFixed(2)});
}
let s=choosePiece(assignRecruits(freshState(2026),autoAssign(freshState(2026))),'galop');
s.members=fullBand({pitch:80,rhythm:80,tone:80,expr:80}).map((m,i)=>({...m,trait:'steady',sta:100,stats:i<5?{pitch:15,rhythm:15,tone:15,expr:15}:m.stats,fam:{galop:100,largo:100}}));
s.week=14;s.cohesion=75;s.setPiece='largo';s=runAudition(s);
const original=JSON.stringify(s),all=predictContest(s,new Set()),out=recommendLineup(s),best=predictContest(s,out);
assert.ok(best.avg>=all.avg);assert.ok(out.size>0,'苦手な部員を含むときにおすすめが全員のまま');
assert.equal(JSON.stringify(s),original,'予測でセーブが変わった');
const projected=projectToContest(s),ev=nextContest(projected).ev;
const members=seated(projected).filter(m=>!out.has(m.id));
const ctxFor=pieceId=>perfCtx(projected,{members,pieceId,venue:LEVELS[ev.level].venue,nerves:nervesFor(projected,ev),fatigue:0});
const jf=perform(ctxFor(projected.pieceId)),js=perform(ctxFor(projected.setPiece));
const expected=mergeJudges(judge(js,analyze(js),ev.level),judge(jf,analyze(jf),ev.level),ev.level,SET_W);
assert.equal(best.avg,expected.avg,'課題曲と自由曲の予測が本番と違う式');
console.log(JSON.stringify({曲別:rows,人選:{全員:all.avg,おすすめ:best.avg,控え:out.size},確認:'全15曲・弱い奏者の追加・安定した厚み・楽器の欠員・空編成・以前の録音・セーブ不変・A部門の採点一致'},null,2));
`,ctx);
