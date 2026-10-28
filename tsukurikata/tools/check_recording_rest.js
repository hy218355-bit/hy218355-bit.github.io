'use strict';
/* 全曲・全区間の実際の音から、録音で休む本人とパートを区別する。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const pieces=[...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]),ctx=vm.createContext({assert,console});
for(const f of ['util','instruments','venues','scores',...pieces,'band','game'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f+'.js'});
const ui=fs.readFileSync(path.join(root,'js/ui.js'),'utf8');
vm.runInContext(`
let S;const U={solo:'all',sel:null,recordMember:null,recordPerf:null,shown:null,playing:true,waitPlay:null};
const E={solo:{type:'all'},setSolo(s){this.solo=s;}};
const nodes={},card={innerHTML:'',dataset:{}},button={attrs:{},setAttribute(k,v){this.attrs[k]=v;},innerHTML:''};
function element(){return {value:'',options:[],set innerHTML(s){this.options=[...s.matchAll(/<option value="([^"]*)">([^<]*)<\\/option>/g)].map(m=>({value:m[1],textContent:m[2]}));},get innerHTML(){return '';}};}
const $=s=>s==='#memberCard [data-mact="recordsolo"]'?(card.innerHTML.includes('data-mact="recordsolo"')?button:null):(nodes[s]||=element());
const uiIcon=s=>'['+s+']',memberFace=m=>'[顔:'+m.id+']',memberCurrentRanks=()=>'';
const instrumentIcon=s=>'[楽器:'+s+']',seatLabel=id=>PART_LABEL[SEAT[id].part];
const renderListeningSummary=()=>{},renderRecordingLibrary=()=>{},memberById=id=>S.members.find(m=>m.id===id);
const pieceListening=()=>null;
`,ctx);
vm.runInContext(ui.slice(ui.indexOf('const STAGE_PERFORMERS ='),ui.indexOf('function levelAt(')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function renderSelectors(){'),ui.indexOf('// 録音の参照は')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function toggleRecordedMemberSolo('),ui.indexOf('function closeMemberCard(')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function renderRecordedMemberCard('),ui.indexOf('function renderMemberCard(')),ctx);
vm.runInContext(`
let ranges=0,rests=0,solos=0;
for(const pid of PIECE_IDS){
 S=freshState(2028);S.members=fullBand({pitch:68,rhythm:72,tone:64,expr:61});S.pieceId=pid;S.recs=[];
 const rec=addRec(S,'昔の本番',{venue:'hall'}),state=JSON.stringify(S);
 for(const span of [{from:0,to:PIECES[pid].beats},...PIECES[pid].spans]){
  const perf=rememberStageMembers(perform({...recCtx(rec),from:span.from,to:span.to}),rec.snap.members,true,rec),before=JSON.stringify(perf);
  const sounds=new Set([...perf.notes,...perf.hits].map(n=>n.mid)),sections=new Set([...perf.notes,...perf.hits].map(n=>n.sec));
  U.shown=perf;U.recordPerf=perf;U.playing=true;U.waitPlay=null;
  for(const m of rec.snap.members){
   U.recordMember=m;U.sel=m.id;U.solo='all';applySolo();renderRecordedMemberCard(card,m);renderSelectors();
   assert.equal(performanceMemberSounds(perf,m.id),sounds.has(m.id));
   const values=$('#soloSel').options.map(o=>o.value);
   assert.deepEqual(values.filter(x=>x.startsWith('sec:')),SECTIONS.filter(s=>sections.has(s.id)).map(s=>'sec:'+s.id));
   assert.equal(values.includes('member:'+m.id),sounds.has(m.id));
   const cached=PERFORMANCE_PLAYERS.get(perf);
   if(sounds.has(m.id)){
    assert.ok(card.innerHTML.includes('data-mact="recordsolo"'));assert.ok(!card.innerHTML.includes('mc-rest'));
    toggleRecordedMemberSolo();assert.equal(E.solo.id,m.id);assert.equal(button.attrs['aria-pressed'],'true');toggleRecordedMemberSolo();assert.equal(E.solo.type,'all');solos++;
   }else{
    assert.ok(!card.innerHTML.includes('data-mact="recordsolo"'));assert.ok(card.innerHTML.includes(span.from===0&&span.to===PIECES[pid].beats?'この曲は休み':'この範囲は休み'));
    toggleRecordedMemberSolo();assert.equal(E.solo.type,'all');
    U.solo='member:'+m.id;applySolo();renderSelectors();assert.equal(E.solo.type,'all','音のない本人の指定を残さない');rests++;
   }
   assert.equal(PERFORMANCE_PLAYERS.get(perf),cached,'同じ演奏の奏者の集合を使い回す');
  }
  for(const sec of SECTIONS){U.solo='sec:'+sec.id;applySolo();renderSelectors();assert.equal(U.solo,sections.has(sec.id)?'sec:'+sec.id:'all');}
  assert.equal(JSON.stringify(perf),before);assert.equal(JSON.stringify(S),state);ranges++;
 }
}
// 現在の部の設定欄と、打楽器だけの人は変えない。
const current=rememberStageMembers({notes:[],hits:[]},S.members,false);U.shown=current;U.recordPerf=null;U.recordMember=null;U.sel=S.members[0].id;U.solo='all';renderSelectors();
assert.equal($('#soloSel').options.filter(o=>o.value.startsWith('sec:')).length,SECTIONS.length);assert.ok($('#soloSel').options.some(o=>o.value==='member:'+U.sel));
assert.ok(performanceMemberSounds({notes:[],hits:[{mid:'打楽器'}]},'打楽器'));
assert.equal(performanceMemberSounds(null,'不明'),false);assert.equal(performanceMemberSounds({notes:[],hits:[]},'不明'),false);
console.log('全15曲・全'+ranges+'範囲／休みの延べ'+rests+'人と音のある延べ'+solos+'人／音符・打楽器による区別／本人とパートの一覧／無音の指定を解消／演奏ごとの使い回し／部・録音・演奏の不変／現在の部の設定を保持：確認済み');
`,ctx);
