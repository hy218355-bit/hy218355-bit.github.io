'use strict';
/* 席の取り消しで二人の力と記録を戻し、そのあとの操作を消さないことを確かめる。 */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),stored=new Map();
const ctx=vm.createContext({console,assert,localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)}});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const pieces=[...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]);
for(const f of ['util','instruments','venues','scores',...pieces,'band','game'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f+'.js'});
vm.runInContext(`
let S=null,stopAction=null,saves=0;
const U={moveUndo:null,solo:'all',view:'mel'},narrow={matches:false};
const $=()=>({remove(){},focus(){},scrollIntoView(){}});
const busy=()=>!!(S.pending&&!S.pending.revealed);
const renderAll=()=>{},refreshNow=()=>{},applySolo=()=>{},toast=()=>{};
const stopPlay=()=>{const run=stopAction;stopAction=null;run?.();};
const realSave=save;save=s=>{saves++;realSave(s);};
`,ctx);
const ui=fs.readFileSync(path.join(root,'js/ui.js'),'utf8');
vm.runInContext(ui.slice(ui.indexOf('function commit(next)'),ui.indexOf('/* ===== いまの演奏')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function canUndoMemberMove()'),ui.indexOf('// 移動先を選ぶだけでは保存せず')),ctx);
vm.runInContext(`
function fresh(){
 S=freshState(2026);S=assignRecruits(S,autoAssign(S));S=choosePiece(S,'galop');
 S.members=fullBand({pitch:68,rhythm:72,tone:64,expr:61});
 S.log=Array.from({length:160},(_,i)=>({y:2026,w:0,text:'記録'+i}));
 S.recs=[{id:'昔の録音',snap:snapshot(S)}];save(S);S=load();U.moveUndo=null;U.solo='all';U.view='mel';
}
function move(id,to){const m=S.members.find(m=>m.id===id);commitMemberMove({m,to,other:to&&S.members.find(m=>m.seat===to),next:moveMember(S,id,to)});}
fresh();
const id=S.members[0].id,other=S.members.find(m=>m.seat==='perc2').id,before=JSON.stringify(S),keys=Object.keys(S).sort().join(',');
U.solo='member:'+id;U.view='fl';move(id,'perc2');
assert.ok(canUndoMemberMove());assert.notEqual(JSON.stringify(S),before);
assert.ok(S.members.find(m=>m.id===id).stats.pitch<68);assert.ok(S.members.find(m=>m.id===other).stats.pitch<68);
assert.equal(S.log.length,160);assert.equal(Object.keys(S).sort().join(','),keys);
assert.ok(undoMemberMove());assert.equal(JSON.stringify(S),before);assert.ok(JSON.stringify(load())===before,'再読み込みでも移動前の状態を保つ');
assert.equal(U.solo,'member:'+id);assert.equal(U.view,'fl');assert.equal(U.sel,id);assert.equal(U.moveUndo,null);assert.equal(undoMemberMove(),false);
for(const dest of [null,'perc2','fl1a']){
 fresh();if(dest==='fl1a')S.members=S.members.filter(m=>m.seat!=='fl1a');
 const original=JSON.stringify(S);move(S.members[0].id,dest);assert.ok(undoMemberMove());assert.equal(JSON.stringify(S),original);
}
fresh();move(S.members[0].id,'perc2');const first=JSON.stringify(S);move(S.members[0].id,SEATS.find(x=>x.sec==='tp').id);assert.ok(undoMemberMove());assert.equal(JSON.stringify(S),first);assert.equal(undoMemberMove(),false);
fresh();move(S.members[0].id,'perc2');commit(renameMember(S,S.members[0].id,'山田 花音'));const renamed=JSON.stringify(S);assert.equal(undoMemberMove(),false);assert.equal(JSON.stringify(S),renamed);
fresh();move(S.members[0].id,'perc2');commit(practiceWeek(S));const practiced=JSON.stringify(S);assert.equal(undoMemberMove(),false);assert.equal(JSON.stringify(S),practiced);
fresh();move(S.members[0].id,'perc2');S.pending={revealed:false};assert.equal(undoMemberMove(),false);
fresh();move(S.members[0].id,'perc2');stopAction=()=>commit(renameMember(S,S.members[0].id,'山田 花音'));assert.equal(undoMemberMove(),false);assert.equal(S.members[0].name,'山田 花音');
assert.ok(saves>0);
`,ctx);
console.log('交代する二人の能力・席・160件の日誌・録音・セーブの復元／控えと空席／直前の1回だけ／改名・練習・本番・停止時の保存を消さない：確認済み');
