'use strict';
/* 出会いの乱数・評判による経験者・旧セーブの続きと顔の固定を確認する。 */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'..');let random=123456789,saved=null;
const math=Object.create(Math);math.random=()=>((random=(Math.imul(random,1664525)+1013904223)>>>0)/4294967296);
const ctx=vm.createContext({console,Math:math,JSON,Set,Map,setTimeout,assert,URL,document:{currentScript:{src:'http://local/js/faces.js'}},localStorage:{getItem:()=>saved,setItem:(_,v)=>{saved=v;}}});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const file of ['util','instruments','venues','scores',...[...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js(?:\?[^ "]*)?"/g)].map(m=>m[1]),'band','game','face-cast','faces'])vm.runInContext(fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'),ctx,{filename:file+'.js'});
vm.runInContext(`
const a=freshState(),b=freshState();
assert.notEqual(a.recruitSeed,b.recruitSeed);assert.notEqual(a.recruits[0].id,b.recruits[0].id);
assert.notEqual(JSON.stringify(a.recruits),JSON.stringify(b.recruits),'最初からやり直しても出会いが同じ');
const repeat=clone(a);assert.equal(JSON.stringify(makeRecruits(a,12)),JSON.stringify(makeRecruits(repeat,12)),'再読み込みで引き直された');
const founders=freshState();founders.rep=100;assert.ok(makeRecruits(founders,5,{founders:true}).every(r=>!r.talent));
const counts=[];let rare;
for(const rep of [5,35,60,100]){
 let talented=0;
 for(let i=0;i<5000;i++){
  const s={year:2030,week:0,seq:i,members:[],recruitSeed:12345,rep};
  const r=makeRecruits(s,1)[0];if(r.talent){talented++;rare??=r;assert.ok(r.exp);}
 }
 counts.push({評判:rep,優秀:talented,試行:5000});
}
assert.equal(counts[0].優秀,0);assert.equal(counts[1].優秀,0);
assert.ok(counts[2].優秀>180&&counts[2].優秀<350);
assert.ok(counts[3].優秀>550&&counts[3].優秀<850);
assert.ok(counts[3].優秀>counts[2].優秀);
const start=freshState();start.recruits=[rare];
const seat=SEATS.find(x=>x.inst===rare.hope).id,map={[rare.id]:seat};
const gifted=assignRecruits(start,map).members[0],normalStart=clone(start);delete normalStart.recruits[0].talent;
const normal=assignRecruits(normalStart,map).members[0];
assert.ok(avgStat(gifted)>avgStat(normal)+15,'入部時点で力の違いがない');
assert.ok(Math.max(...Object.values(gifted.stats))<80,'入部時から完成しすぎている');
const changed=SEATS.find(x=>x.inst!==rare.hope).id;
const switched=assignRecruits(start,{[rare.id]:changed}).members[0];
assert.ok(avgStat(gifted)>avgStat(switched)+15,'楽器を変えても同じ力だった');
// 古い控えに出会いの種と元の名前を補っても、本人と入部待ちの情報は保つ。
const oldStart=freshState(),old=assignRecruits(oldStart,autoAssign(oldStart));old.members=[normal];old.recruits=[{id:'m2026-n99',name:'佐藤 陽菜',hope:'flute',exp:true,grade:1,trait:'steady'}];delete old.recruitSeed;
const expectedMembers=old.members.map(m=>({...m,originalName:m.originalName||m.name})),beforeRecruits=JSON.stringify(old.recruits);save(old);
const loaded=load();assert.ok(loaded);assert.equal(JSON.stringify(loaded.members),JSON.stringify(expectedMembers));assert.equal(JSON.stringify(loaded.recruits),beforeRecruits);
save(loaded);assert.equal(load().recruitSeed,loaded.recruitSeed);
const base=Faces.fingerprint(old.recruits[0]);assert.equal(Faces.fingerprint({...old.recruits[0],grade:3}),base);
const oldPools=Object.fromEntries(['female','male'].map(style=>[style,FACE_CAST.cast.filter(f=>f.base<39&&f.style===style).sort((a,b)=>hash('portrait-cast-v2',a.base)-hash('portrait-cast-v2',b.base))]));
for(const style of ['female','male'])for(let i=1;i<=150;i++)assert.equal(Faces.fingerprint({id:'m2026-n'+i,name:'佐藤 '+(style==='female'?'陽菜':'悠真')}),oldPools[style][(i-1)%oldPools[style].length].base,'既存の顔が変わった');
const sample={year:2026,week:0,seq:0,members:[],recruitSeed:12345,rep:60},ms=makeRecruits(sample,39),fingerprints=ms.map(m=>Faces.fingerprint(m));
assert.ok(new Set(fingerprints).size>=35,'同じ部で顔が重なりすぎる');
assert.ok(fingerprints.some(base=>base>=39),'新しい原画を引けない');
assert.ok(ms.every(m=>Faces.features(m).style===namePresentation(m)));
const round=JSON.parse(JSON.stringify(ms));assert.equal(JSON.stringify(round.map(m=>Faces.fingerprint(m))),JSON.stringify(fingerprints));
const pa=freshState(),pb=freshState();const qa=choosePiece(assignRecruits(pa,autoAssign(pa)),'galop'),qb=choosePiece(assignRecruits(pb,autoAssign(pb)),'galop');qa.week=14;qb.week=14;assert.notEqual(projectToContest(qa).members[0].id,projectToContest(qb).members[0].id,'別セーブの本番予測が混じった');
const noFaceSave=ms.every(m=>!('face' in m)&&!('portrait' in m));assert.ok(noFaceSave);
console.log(JSON.stringify({分布:counts,初期能力比較:{通常:avgStat(normal),優秀:avgStat(gifted),違う楽器:avgStat(switched)},顔:{候補:FACE_CAST.cast.length,三十九人の異なる顔:new Set(fingerprints).size},確認:'出会いの変化・再読み込みで固定・旧セーブ互換・以前の顔固定・名前対応・評判の効果・得意楽器の初期能力'},null,2));
`,ctx);
