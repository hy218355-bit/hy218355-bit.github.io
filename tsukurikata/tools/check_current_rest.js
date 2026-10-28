'use strict';
/* 全曲・全区間で、休みの本人やパートを無音で試聴しない。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),pieces=[...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]),ctx=vm.createContext({assert,console,clearTimeout});
for(const f of ['util','instruments','venues','scores',...pieces,'band','game'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f+'.js'});
const ui=fs.readFileSync(path.join(root,'js/ui.js'),'utf8');
vm.runInContext(`
let S,plays=0,stops=0;
const U={piece:null,range:'all',venue:'room',solo:'all',sel:null,recordMember:null,memberCardMember:null,playing:false,waitPlay:null,shown:null,perfNow:null},document={activeElement:null};
const E={solo:{type:'all'},setSolo(s){this.solo=s;}};
const button=()=>({hidden:false,attrs:{},setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k]??null;},closest(){return card;},focus(){document.activeElement=this;}}),buttons=Object.fromEntries(['solo','secsolo','all','close'].map(a=>[a,button()]));
const rest={hidden:true,classList:{toggle(){}},label:{textContent:''},querySelector(){return this.label;}};
const card={hidden:false,dataset:{},querySelector(s){if(s==='[data-current-rest]')return rest;const b=buttons[/data-mact="([^"]+)"/.exec(s)?.[1]];return b&&(!s.includes(':not')||!b.hidden)?b:null;}};
const nodes={},element=()=>({value:'',options:[],set innerHTML(s){this.options=[...s.matchAll(/<option value="([^"]*)">([^<]*)<\\/option>/g)].map(m=>({value:m[1],textContent:m[2]}));},get innerHTML(){return '';}});
const $=s=>s==='#memberCard'?card:s==='#btnNow'?{click(){plays++;U.playing=true;U.shown=U.perfNow;}}:s.startsWith('#memberCard ')?card.querySelector(s):(nodes[s]||=element());
const memberById=id=>S.members.find(m=>m.id===id),playPiece=()=>U.piece||S.pieceId;
const uiIcon=n=>'['+n+']',cdVisible=b=>!!b&&!b.hidden,renderListeningSummary=()=>{},renderRecordingLibrary=()=>{},pieceListening=()=>null,renderDiag=()=>{},renderMemberCard=()=>{},stopPlay=()=>{stops++;U.playing=false;U.waitPlay=null;U.perfNow=null;};
`,ctx);
for(const [a,b] of [['function rangeSpan(','const busy ='],['function currentCtx(){','function refreshNow(){'],['const STAGE_PERFORMERS =','function levelAt('],['function renderSelectors(){','// 録音の参照は'],['function currentMemberListening(','function memberCurrentRanks('],['function listenCurrentMember(','function startStage(){']])vm.runInContext(ui.slice(ui.indexOf(a),ui.indexOf(b)),ctx);
vm.runInContext(`
let ranges=0,rests=0,sounds=0,sectionRests=0;
for(const pid of PIECE_IDS){
 S=freshState(2028);S.members=fullBand({pitch:68,rhythm:72,tone:64,expr:61});S.pieceId=pid;S.recs=[];
 const state=JSON.stringify(S);
 for(const range of ['all',...PIECES[pid].spans.map((_,i)=>String(i))]){
  U.range=range;U.perfNow=currentPerformance();const perf=U.perfNow,sound=JSON.stringify(perf),members=new Set([...perf.notes,...perf.hits].map(n=>n.mid)),sections=new Set([...perf.notes,...perf.hits].map(n=>n.sec));
  for(const m of S.members){
   U.sel=m.id;U.memberCardMember=m;card.dataset.member=m.id;U.solo='all';U.playing=false;U.waitPlay=null;U.shown=perf;document.activeElement=null;renderSelectors();renderCurrentMemberListening();
   assert.equal(buttons.solo.hidden,!members.has(m.id));assert.equal(rest.hidden,members.has(m.id));assert.equal(buttons.secsolo.hidden,!sections.has(SEAT[m.seat].sec));
   if(!members.has(m.id)){assert.equal(rest.label.textContent,range==='all'?'この曲は休み':'この範囲は休み');rests++;}else sounds++;
   assert.equal($('#soloSel').options.some(o=>o.value==='member:'+m.id),members.has(m.id));
   assert.deepEqual($('#soloSel').options.filter(o=>o.value.startsWith('sec:')).map(o=>o.value),SECTIONS.filter(s=>sections.has(s.id)).map(s=>'sec:'+s.id));
   for(const section of [false,true]){
    U.solo='all';U.playing=false;U.waitPlay=null;const before=plays,beforeStops=stops,can=section?sections.has(SEAT[m.seat].sec):members.has(m.id);
    listenCurrentMember(m.id,section);assert.equal(plays-before,can?1:0);assert.equal(stops,beforeStops);
    if(can){assert.equal(U.shown,perf);assert.equal(E.solo.type,section?'sec':'member');}
    // 古い指定だけが残った場合も、音のない対象は全員へ戻す。
    U.solo=section?'sec:'+SEAT[m.seat].sec:'member:'+m.id;renderSelectors();
    assert.equal(U.solo,can?(section?'sec:'+SEAT[m.seat].sec:'member:'+m.id):'all');
    if(!can)assert.equal(currentMemberListening(m,section),false);
   }
   const cached=PERFORMANCE_PLAYERS.get(perf);performanceMemberSounds(perf,m.id);assert.equal(PERFORMANCE_PLAYERS.get(perf),cached);
  }
  sectionRests+=SECTIONS.filter(s=>!sections.has(s.id)).length;
  assert.equal(JSON.stringify(perf),sound);assert.equal(JSON.stringify(S),state);ranges++;
 }
}
// まだ演奏が用意されていない場合も、作った後で休みを確かめてから鳴らす。
S.pieceId='largo';U.range='0';U.perfNow=null;U.playing=false;U.waitPlay=null;U.sel=S.members[0].id;card.dataset.member=U.sel;const before=plays;listenCurrentMember(U.sel);assert.ok(U.perfNow);assert.equal(plays,before);assert.ok(buttons.solo.hidden&&buttons.secsolo.hidden);
// 区間が変わって操作を隠す場合だけ、残るパートか閉じるへ操作先を移す。
U.perfNow=currentPerformance();document.activeElement=buttons.solo;renderCurrentMemberListening();assert.equal(document.activeElement,buttons.close);
S.pieceId='galop';U.range='1';U.perfNow=currentPerformance();document.activeElement=buttons.solo;renderCurrentMemberListening();assert.equal(document.activeElement,buttons.secsolo);assert.ok(rest.label.textContent.includes('範囲'));
console.log('全15曲・全'+ranges+'範囲／休みの延べ'+rests+'人・音のある延べ'+sounds+'人・パートの休み'+sectionRests+'件／休みは試聴しない／本人は休みでもパートを聴ける／範囲変更で古い無音指定を解消／未準備時の判定と操作先／顔と席・部・録音・演奏を保持／演奏ごとの使い回し：確認済み');
`,ctx);
