'use strict';
/* 人選の理由が同じ本番の採点に基づくことと、選び直しで保存内容を変えないことを確かめる。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),report=[];
const ctx=vm.createContext({console,assert,report});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const pieces=[...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]);
for(const f of ['util','instruments','venues','scores',...pieces,'band','game'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f+'.js'});
vm.runInContext(`
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,a+' != '+b);
for(const id of PIECE_IDS){
 const s=freshState(2026);s.recruits=null;s.phase='week';s.week=PREF_WEEK;s.pieceId=id;s.division='B';s.cohesion=75;
 s.members=fullBand({pitch:80,rhythm:80,tone:80,expr:80});
 for(const [i,m] of s.members.entries()){m.sta=100;m.fam={[id]:100,largo:100};m.trait='steady';if(i<5)m.stats={pitch:15,rhythm:15,tone:15,expr:15};}
 const old=JSON.stringify(s),off=new Set(s.members.slice(0,5).map(m=>m.id));
 const all=predictContest(s,new Set()),best=predictContest(s,off);
 assert.ok(best.sound.disruption<all.sound.disruption,id+': 苦手な奏者を外した理由が逆');
 for(const out of [new Set(),off]){
  const p=predictContest(s,out),members=seated(s).filter(m=>!out.has(m.id));
  const perf=perform(perfCtx(s,{members,venue:LEVELS.pref.venue,nerves:nervesFor(s,EVENTS[PREF_WEEK]),fatigue:0})),a=analyze(perf);
  assert.equal(p.avg,judge(perf,a,'pref').avg);assert.equal(p.sound.disruption,a.disruption);assert.equal(p.sound.fullness,a.fullness);assert.equal(p.sound.thin,a.thin);assert.equal(p.sound.lack,a.lack.pts);
  assert.equal(JSON.stringify(p.sound.missing),JSON.stringify(a.lack.miss));
 }
 s.division='A';s.setPiece='largo';s.seq++;
 const p=predictContest(s,off),ms=seated(s).filter(m=>!off.has(m.id));
 const run=pieceId=>{const perf=perform(perfCtx(s,{pieceId,members:ms,venue:LEVELS.pref.venue,nerves:nervesFor(s,EVENTS[PREF_WEEK]),fatigue:0}));return {a:analyze(perf),perf};};
 const free=run(id),set=run('largo');
 for(const key of ['disruption','fullness','thin'])close(p.sound[key],SET_W*set.a[key]+(1-SET_W)*free.a[key]);
 close(p.sound.lack,SET_W*set.a.lack.pts+(1-SET_W)*free.a.lack.pts);
 assert.equal(p.avg,mergeJudges(judge(set.perf,set.a,'pref'),judge(free.perf,free.a,'pref'),'pref',SET_W).avg);
 s.division='B';delete s.setPiece;s.seq--;assert.equal(JSON.stringify(s),old);
 report.push({id,all:all.avg,selected:best.avg,disruptionAll:all.sound.disruption,disruptionSelected:best.sound.disruption});
}
`,ctx);
console.log('全15曲：人選と理由の一致・同じ本番の採点・課題曲4割と自由曲6割・保存内容の保持を確認。');
console.log(JSON.stringify(report));
