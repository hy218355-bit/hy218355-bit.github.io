'use strict';
/* 顔から本人へ移っても卒業の決定や録音を変えず、最後の確定だけを保存する。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const pieces=[...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]);
const ctx=vm.createContext({console,assert});
for(const f of ['util','instruments','venues','scores',...pieces,'band','game'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f+'.js'});
vm.runInContext(`
let S,calm=false,saves=0,stops=0,records=[],skies=0,clock=0;
const U={fxMode:'full'},timers=new Map();
const setTimeout=(cb,ms)=>{const id=++clock;timers.set(id,{cb,ms});return id;},clearTimeout=id=>timers.delete(id),cancelAnimationFrame=()=>{};
const caller={isConnected:true,focus(){document.activeElement=this;}},nextYear={focus(){document.activeElement=this;}};
const title={tabIndex:0,focus(){document.activeElement=this;}};
const card={innerHTML:'',scrollTop:50,offsetWidth:340,classList:{remove(){},add(){}}},roll={hidden:true,dataset:{}};
const document={activeElement:caller,documentElement:{classList:{add(){},remove(){}}}};
const nodes={'#grCard':card,'#gradRoll':roll,'#grCard .gr-name':title,'#week [data-act="wnext"]':nextYear};
const $=s=>nodes[s]||=({});
const memberFace=(m,size)=>'<span data-face="'+esc(m.id)+'" data-size="'+size+'"></span>';
const fxCalm=()=>calm,fxSky=()=>{skies++;},stopPlay=()=>{stops++;},playRecording=(rec,label)=>records.push({rec,label});
const commit=s=>{S=s;saves++;},renderAll=()=>{},scrollTo=()=>{};
function fresh(mode='full',reduced=false){
 S=freshState(2026);S=assignRecruits(S,autoAssign(S));S=choosePiece(S,'galop');
 S.members=fullBand({pitch:68,rhythm:72,tone:64,expr:61});S.members.forEach((m,i)=>{m.grade=i%3+1;});S.year=2028;S.week=26;S.recs=[];
 addRec(S,'最後の演奏会',{venue:'hall'}).final=true;S=endSeason(S);S=startWinter(S);S=chooseWinterPlan(S,'kiso');S=skipEnsemble(S);S=winterNext(S);
 U.fxMode=mode;calm=reduced;saves=0;stops=0;records=[];skies=0;timers.clear();roll.hidden=true;document.activeElement=caller;
 GR.i=0;GR.ids=[];GR.slides=[];GR.timer=0;GR.raf=0;GR.returnTo=null;
}
`,ctx);
const ui=fs.readFileSync(path.join(root,'js/ui.js'),'utf8');
// 見た目の本文はブラウザで確かめ、ここでは実際の移動・タイマー・保存の処理を使う。
vm.runInContext(ui.slice(ui.indexOf('const GR ='),ui.indexOf('function gradYears(')),ctx);
vm.runInContext(`const gradSlide=m=>'<b class="gr-name">'+esc(m.name)+'</b><span data-person="'+esc(m.id)+'"></span>';`,ctx);
vm.runInContext(ui.slice(ui.indexOf('function openGradRoll('),ui.indexOf('/* ===== 冬')),ctx);
vm.runInContext(`
fresh();const before=JSON.stringify(S);openGradRoll();
assert.equal(GR.ids.length,13);assert.equal(GR.slides.length,15);assert.equal(GR.i,0);assert.equal(timers.get(GR.timer).ms,9000);
assert.equal(skies,1);assert.equal(records.length,1);assert.equal(records[0].rec.snap.members.length,39);assert.equal(S.members.length,26);
const selected=GR.ids[4],recordCount=records.length;grSelect(selected);
assert.equal(GR.i,5);assert.equal(GR.timer,0);assert.equal(document.activeElement,title);assert.ok(card.innerHTML.includes(selected));
assert.equal(records.length,recordCount,'本人を選ぶだけでは録音を再開しない');assert.equal(JSON.stringify(S),before);assert.equal(saves,0);
grSelect('いない部員');assert.equal(GR.i,5);assert.equal(saves,0);
grNext();assert.equal(GR.i,6);assert.equal(timers.get(GR.timer).ms,9000);grPrev();assert.equal(GR.i,5);assert.equal(GR.timer,0);
closeGradRoll(false);assert.equal(saves,0);assert.equal(JSON.stringify(S),before);assert.equal(document.activeElement,caller);assert.equal(roll.hidden,true);
document.activeElement=caller;openGradRoll(selected);assert.equal(GR.i,5);assert.equal(GR.timer,0);assert.equal(JSON.stringify(S),before);
grSelect(GR.ids.at(-1));grNext();assert.equal(GR.i,14);assert.equal(saves,0);assert.ok(card.innerHTML.includes('data-grad-member'));
grSelect(GR.ids[0]);assert.equal(GR.i,1);assert.equal(saves,0,'最後の集合写真から戻っても卒業を決定しない');
grSelect(GR.ids.at(-1));grNext();grNext();assert.equal(saves,1);assert.equal(S.winter.gradDone,true);assert.equal(document.activeElement,nextYear);
const original=JSON.parse(before);assert.equal(JSON.stringify(S.recs),JSON.stringify(original.recs));assert.equal(JSON.stringify(S.members),JSON.stringify(original.members));assert.equal(JSON.stringify(S.gradMembers),JSON.stringify(original.gradMembers));
for(const [mode,reduced,delay]of [['short',false,3500],['off',false,null],['full',true,null]]){
 fresh(mode,reduced);const saved=JSON.stringify(S);openGradRoll();assert.equal(GR.timer?timers.get(GR.timer).ms:null,delay);
 assert.equal(skies,0);grSelect(GR.ids[0]);assert.equal(GR.timer,0);assert.equal(JSON.stringify(S),saved);assert.equal(saves,0);
}
fresh();S.gradMembers=[];const empty=JSON.stringify(S);openGradRoll();assert.equal(stops,0);assert.equal(records.length,0);assert.equal(JSON.stringify(S),empty);
fresh();const names=[{id:'部員"一',name:'花<音>&"'}],markup=gradAlbum(names);assert.ok(markup.includes('花&lt;音&gt;&amp;&quot;'));assert.ok(markup.includes('data-grad-member="部員&quot;一"'));
`,ctx);
console.log('本人への移動と前後・集合写真から戻る／決定前の保存なし／録音の再開なし／引退後の39人の録音／最後の確定だけ保存／演出3設定と動きの少ない設定／空の名簿と名前の安全な表示：確認済み');
