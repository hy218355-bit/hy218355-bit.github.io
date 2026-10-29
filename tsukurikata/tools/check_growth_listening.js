'use strict';
/* 同じ曲・範囲・条件で実際の音を比べ、保存した部員や録音を変更しないことを確かめる。 */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),report={pieces:[],compatibility:[]};
const math=Object.create(Math);let seed=20261029;math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const ctx=vm.createContext({console,assert,report,Math:math});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),pieces=[...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]);
for(const f of ['util','instruments','venues','scores',...pieces,'band','game','growth-listen'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f+'.js'});
const ui=fs.readFileSync(path.join(root,'js/ui.js'),'utf8');
vm.runInContext(ui.slice(ui.indexOf('const RANKS ='),ui.indexOf('// up：')),ctx);
vm.runInContext(`
for(const pid of PIECE_IDS){
 let s=freshState(2026);s=assignRecruits(s,autoAssign(s));s=choosePiece(s,pid);
 const rec=growthReference(s,pid);assert.ok(rec);const savedRec=JSON.stringify(rec);
 s=practiceWeek(s);const original=JSON.stringify(s);
 const pair=growthContexts(s,rec,pid,'room','all');
 assert.equal(pair.before.from,pair.now.from);assert.equal(pair.before.to,pair.now.to);
 assert.equal(pair.before.venue,pair.now.venue);assert.equal(pair.before.take,pair.now.take);
 assert.equal(JSON.stringify(pair.before.interp),JSON.stringify(pair.now.interp));
 assert.ok(pair.now.to>pair.now.from&&pair.now.to<=PIECES[pid].beats);
 const before=perform(pair.before),now=perform(pair.now),a=analyze(before),b=analyze(now);
 assert.equal(before.bpm,now.bpm);assert.ok(before.notes.length+before.hits.length>0);assert.ok(now.notes.length+now.hits.length>0);
 assert.notEqual(JSON.stringify(before),JSON.stringify(now));
 assert.ok(quality(b)>quality(a),pid+': 最初の1週間の音に育った力が返っていない');
 assert.equal(JSON.stringify(s),original);assert.equal(JSON.stringify(rec),savedRec);
 const ranks=growthChanges(s,rec);assert.ok(ranks.length&&ranks.length<=3);assert.ok(ranks.every(x=>x.gain>=.5));
 const range=growthContexts(s,rec,pid,'hall','1');assert.equal(range.now.from,PIECES[pid].spans[1].from);assert.equal(range.before.venue,'hall');
 report.pieces.push({pid,from:before.from,to:before.to,secondsBefore:+before.total.toFixed(2),secondsNow:+now.total.toFixed(2),qualityBefore:+quality(a).toFixed(2),qualityNow:+quality(b).toFixed(2),pitchBefore:+a.score.pitch.toFixed(2),pitchNow:+b.score.pitch.toFixed(2),rhythmBefore:+a.score.rhythm.toFixed(2),rhythmNow:+b.score.rhythm.toFixed(2),names:ranks.map(x=>x.m.name)});
}
let s=freshState(2026);s=choosePiece(assignRecruits(s,autoAssign(s)),'galop');const rec=growthReference(s,'galop');
// ない記録を作り足さない。違う曲や去年の部の記録を混ぜない。
assert.equal(growthReference({...s,recs:[]},'galop'),undefined);
assert.equal(growthReference({...s,year:2027},'galop'),undefined);
assert.equal(growthReference(s,'largo'),undefined);
const old=clone(rec);delete old.snap.take;
const pair=growthContexts(s,old,'galop','room','all');assert.equal(pair.before.take,pair.now.take);
// 改名・席替え・入部のあとも、4月の名前・担当・譜読みはそのまま使う。
const original=JSON.stringify(rec),id=s.members[0].id;
s=renameMember(s,id,'確認の名前');const target=SEATS.find(x=>!s.members.some(m=>m.seat===x.id));s=moveMember(s,id,target.id);
const changed=growthContexts(s,rec,'galop','room','all');
assert.notEqual(changed.before.members.find(m=>m.id===id).name,changed.now.members.find(m=>m.id===id).name);
assert.notEqual(changed.before.members.find(m=>m.id===id).seat,changed.now.members.find(m=>m.id===id).seat);
assert.equal(JSON.stringify(rec),original);
report.compatibility=['記録なし','去年の記録','違う曲','古い記録の揺れ条件','改名後も当時の名前','席替え後も当時の担当','保存内容を保持'];
`,ctx);
// 会場を変えると比較だけを止め、通常の録音再生の切り替え方は保つ。
vm.runInContext(`
const U={venue:'room',growthPair:{},growthListen:{}},E={setVenue(id){this.venue=id;}};
let stops=0,saves=0,refreshes=0;const stopPlay=()=>{stops++;U.growthListen=null;},saveUI=()=>{saves++;},renderVenues=()=>{},refreshNow=()=>{refreshes++;};
`,ctx);
vm.runInContext(ui.slice(ui.indexOf('function setVenue(id){'),ui.indexOf('/* ===== ステージ')),ctx);
vm.runInContext(`
setVenue('hall');assert.equal(stops,1);assert.equal(U.growthPair,null);assert.equal(U.venue,'hall');assert.equal(E.venue,'hall');
setVenue('hall');assert.equal(stops,1);
setVenue('room');assert.equal(stops,1);assert.equal(refreshes,3);assert.equal(saves,3);
report.venueChange={comparisonStops:true,normalPlaybackUnchanged:true};
`,ctx);
console.log(JSON.stringify(report,null,2));
