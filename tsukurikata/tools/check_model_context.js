'use strict';
/* お手本に自分の部員を混ぜず、曲・範囲・聴く対象を再生とそろえる。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),pieces=[...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]);
const ctx=vm.createContext({assert,console});
for(const f of ['util','instruments','venues','scores',...pieces,'band','game'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f+'.js'});
const ui=fs.readFileSync(path.join(root,'js/ui.js'),'utf8');
vm.runInContext(`
let S;const U={piece:null,range:'all',venue:'hall',solo:'all',sel:null,recordMember:null,pieceListen:null,shown:null,playing:true,waitPlay:null,view:'mel'};
const E={solo:{type:'all'},setSolo(s){this.solo=s;}};
const nodes={},$=s=>nodes[s]||=({value:'',options:[],set innerHTML(s){this.html=s;this.options=[...s.matchAll(/<option value="([^"]*)">([^<]*)<\\/option>/g)].map(m=>({value:m[1],textContent:m[2]}));if(!this.options.some(o=>o.value===this.value))this.value=this.options[0]?.value||'';},get innerHTML(){return this.html||'';},get selectedOptions(){return this.options.filter(o=>o.value===this.value);},setAttribute(){}});
const playPiece=()=>U.piece||S.pieceId||'largo',busy=()=>false,ensembleListening=()=>null,renderRecordingLibrary=()=>{},difficultyBadge=()=>'',memberById=id=>S.members.find(m=>m.id===id);
`,ctx);
vm.runInContext(ui.slice(ui.indexOf('const RANKS ='),ui.indexOf('const rankBadge =')),ctx);
vm.runInContext(ui.slice(ui.indexOf('const spanShort ='),ui.indexOf('const avgStats =')),ctx);
vm.runInContext(ui.slice(ui.indexOf('const STAGE_PERFORMERS ='),ui.indexOf('function levelAt(')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function pieceListening('),ui.indexOf('function renderPieceListening(')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function renderPiece(){'),ui.indexOf('function renderVenues(){')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function renderListeningSummary(){'),ui.indexOf('// 録音の参照は')),ctx);
vm.runInContext(`
let n=0;
for(const pid of PIECE_IDS){
 S=freshState(2028);S.members=fullBand({pitch:47,rhythm:59,tone:63,expr:38}).slice(0,5).map((m,i)=>({...m,id:'now-'+i}));S.pieceId='galop';S.recs=[];S.phase='week';S.division='A';S.setPiece='ode';
 U.piece=pid;U.sel=S.members[0].id;U.solo='member:'+U.sel;U.range='all';
 const perf=perform({members:fullBand({pitch:100,rhythm:100,tone:100,expr:100}),pieceId:pid,cohesion:100,fam:100,interp:{tempo:1,dyn:1,rub:1},venue:'hall',seed:'band',lead:()=>1}),before=JSON.stringify(S),sound=JSON.stringify(perf);
 for(const waiting of [false,true]){
  U.shown=perf;U.playing=!waiting;U.waitPlay=waiting?{perf}:null;U.pieceListen={kind:'model',pid,perf};renderPiece();renderSelectors();
  assert.equal($('#pieceEyebrow').textContent,'お手本');assert.equal($('#piece').textContent,PIECES[pid].title);assert.ok($('#rangeSel').disabled);assert.deepEqual($('#rangeSel').options.map(o=>o.value),['all']);assert.ok($('#btnConduct').disabled);assert.ok($('#pieceSwitch').hidden);
  assert.equal(U.solo,'all');assert.equal(E.solo.type,'all');assert.ok(!$('#soloSel').options.some(o=>o.value.startsWith('member:')));
  const sections=new Set([...perf.notes,...perf.hits].map(n=>n.sec));assert.deepEqual($('#soloSel').options.filter(o=>o.value.startsWith('sec:')).map(o=>o.value),SECTIONS.filter(s=>sections.has(s.id)).map(s=>'sec:'+s.id));
  const cached=PERFORMANCE_SECTIONS.get(perf);renderSelectors();assert.equal(PERFORMANCE_SECTIONS.get(perf),cached);
  assert.equal(JSON.stringify(S),before);assert.equal(JSON.stringify(perf),sound);n++;
 }
 // 止めた後・今の部を聴くときは元の設定欄と本人を戻す。
 U.playing=false;U.waitPlay=null;renderPiece();renderSelectors();assert.ok(!$('#rangeSel').disabled);assert.ok(!$('#btnConduct').disabled);assert.ok($('#soloSel').options.some(o=>o.value==='member:'+U.sel));assert.equal($('#soloSel').options.length,SECTIONS.length+2);
 U.playing=true;U.shown=rememberStageMembers(perform(perfCtx(S,{pieceId:pid})),S.members,false);U.pieceListen={kind:'preview',perf:U.shown,pid};renderPiece();renderSelectors();assert.equal($('#pieceEyebrow').textContent,'いまの部');assert.ok(!$('#rangeSel').disabled);assert.ok(!$('#btnConduct').disabled);
}
assert.equal(performanceSectionSounds(null,'fl'),false);assert.equal(performanceSectionSounds({notes:[],hits:[{sec:'perc'}]},'perc'),true);
console.log('全15曲×再生・待機の'+n+'通り／お手本の見出しと曲／全曲の範囲／自分の部員と指揮を混ぜない／音のあるパートのみ／使い回し／停止・今の部で元へ／部・演奏の不変：確認済み');
`,ctx);
