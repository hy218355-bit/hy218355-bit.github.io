'use strict';
/* 試聴の音を本番の録音と照合し、聴くだけでは部員も記録も変わらないことを確かめる。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),ctx=vm.createContext({assert,console});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const pieces=[...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]);
for(const file of ['util','instruments','venues','scores',...pieces,'band','game'])vm.runInContext(fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'),ctx,{filename:file+'.js'});
vm.runInContext(`const casts=new WeakMap();function rememberStageMembers(perf,members,recorded){casts.set(perf,{members,recorded});return perf;}`,ctx);
const ui=fs.readFileSync(path.join(root,'js/ui.js'),'utf8');
vm.runInContext(ui.slice(ui.indexOf('function ensemblePreviewPerf('),ui.indexOf('function ensembleListening(')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function cleanEnsembleSelection('),ui.indexOf('function ensemblePreviewPerf(')),ctx);
vm.runInContext(`
let checked=0;
for(const pieceId of PIECE_IDS)for(const n of [3,5,8]){
 const s=freshState(2028);s.phase='winter';s.week=26;s.winter={step:1,plan:'kiso'};
 s.pieceId=pieceId==='galop'?'ode':'galop';s.contestPiece=pieceId;
 s.members=fullBand({pitch:64,rhythm:68,tone:72,expr:60});
 s.members.forEach((m,i)=>{m.grade=i%2+1;m.fam={[pieceId]:PIECES[pieceId].spans.map((_,j)=>(i*7+j*11)%101)};m.sta=50+i;});
 const ids=s.members.slice(0,n).map(m=>m.id),before=JSON.stringify(s),preview=ensemblePreviewPerf(s,ids);
 assert.equal(JSON.stringify(s),before,'試聴で部員・評判・録音・日誌を変えない');
 const after=runEnsemble(s,ids),rec=after.recs.find(r=>r.id===after.winter.ens.recId),actual=perform(recCtx(rec));
 assert.equal(JSON.stringify(preview),JSON.stringify(actual),pieceId+'の'+n+'人の本番前の音と一致する');
 assert.equal(preview.pieceId,pieceId);assert.equal(preview.venue,'civic');
 assert.deepEqual(casts.get(preview).members.map(m=>m.id),ids);assert.equal(casts.get(preview).recorded,false);
 const sounding=new Set([...preview.notes,...preview.hits].map(note=>note.mid));assert.ok([...sounding].every(id=>ids.includes(id)),'選んでいない部員を鳴らさない');
 assert.equal(after.winter.ens.score,ensembleScore(s,analyze(preview)),'試聴の演奏を本番と同じ採点へ渡せる');
 assert.equal(JSON.stringify(s),before);checked++;
}
console.log('全15曲×3・5・8人の'+checked+'編成／本番の録音との音符・時刻・音程・音量の一致／本番前の能力・譜読み・会場／選んだ本人の顔／部員・評判・録音・日誌の不変：確認済み');
const S={members:fullBand({pitch:50,rhythm:50,tone:50,expr:50}).slice(0,2)},U={ensPick:new Set([S.members[0].id,'いない部員',S.members[1].id])};S.members[1].seat=null;
const before=JSON.stringify(S);cleanEnsembleSelection();assert.deepEqual([...U.ensPick],[S.members[0].id]);assert.equal(JSON.stringify(S),before);
console.log('席がなくなった人と存在しない人だけを選択から外し、部員のデータは保つ：確認済み');
`,ctx);
