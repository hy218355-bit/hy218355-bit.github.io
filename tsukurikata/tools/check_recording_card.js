'use strict';
/* 録音の部員カードを切り替え・閉じても、見えない本人だけの指定を残さない。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const pieces=[...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]),ctx=vm.createContext({assert,console});
for(const f of ['util','instruments','venues','scores',...pieces,'band','game'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f+'.js'});
const ui=fs.readFileSync(path.join(root,'js/ui.js'),'utf8');
vm.runInContext(`
let S,focus='',scrolls=0,renders=0,keyHandler,renameClosed=0,moveClosed=0,activeInside=false;
const U={recordMember:null,recordPerf:null,sel:null,solo:'all',playing:true,waitPlay:null,shown:null,cardReturn:null};
const E={solo:{type:'all'},pb:{},setSolo(value){this.solo=value;}};
const button={attrs:{},innerHTML:'',setAttribute(k,v){this.attrs[k]=v;}};
const card={dataset:{origin:'stage'},hidden:false,contains(){return activeInside;},addEventListener(_,fn){keyHandler=fn;}};
const stage={focus(){focus='stage';},scrollIntoView(){scrolls++;}},search={focus(){focus='search';}};
const tip={hidden:true},form={hidden:true},move={open:false};
const $=s=>({'#memberCard':card,'#memberCard [data-mact="recordsolo"]':U.recordMember?button:null,'#stage':stage,'#rosterSearch':search,'#rosterFind':stage,'#tip':tip,'#memberNameForm':U.recordMember?null:form,'#memberCard .mc-move':U.recordMember?null:move,'#memberCard [data-mact="movecancel"]':{click(){move.open=false;moveClosed++;}}})[s];
const document={querySelector:s=>s.includes('missing')?null:{focus(){focus='row';}}},window={scrollTo(x,y){scrolls=y;}};
const narrow={matches:true},applySolo=()=>{const [type,id]=U.solo.split(':');E.setSolo(type==='all'?{type:'all'}:{type:type==='sec'?'sec':'member',id});};
const renderSelectors=()=>{renders++;},renderMemberCard=()=>{card.hidden=!U.recordMember&&!U.sel;},renderRoster=()=>{},drawIdle=()=>{};
const uiIcon=name=>'['+name+']',closeMemberNameForm=()=>{form.hidden=true;renameClosed++;};
function fresh(pid='galop'){
 S=freshState(2028);S.members=fullBand({pitch:68,rhythm:72,tone:64,expr:61});S.pieceId=pid;S.recs=[];
 const rec=addRec(S,'昔の本番',{venue:'hall'});U.shown=perform(recCtx(rec));U.recordPerf=U.shown;U.recordMember=rec.snap.members[0];U.sel=U.recordMember.id;U.playing=true;U.waitPlay=null;U.solo='all';applySolo();
 card.dataset.origin='stage';card.hidden=false;U.cardReturn=null;focus='solo';scrolls=0;button.attrs={};tip.hidden=true;form.hidden=true;move.open=false;activeInside=false;
}
`,ctx);
vm.runInContext(ui.slice(ui.indexOf('function releaseRecordedMemberSolo('),ui.indexOf('function renderRecordedMemberCard(')),ctx);
const keyStart=ui.indexOf("  $('#memberCard').addEventListener('keydown'");
vm.runInContext(ui.slice(keyStart,ui.indexOf("  $('#week').addEventListener('keydown'",keyStart)),ctx);
vm.runInContext(`
let n=0;
for(const pid of PIECE_IDS){
 fresh(pid);const before=JSON.stringify(S),perf=U.shown,pb=E.pb,person=U.recordMember;
 toggleRecordedMemberSolo();assert.equal(E.solo.id,person.id);assert.equal(button.attrs['aria-pressed'],'true');assert.ok(button.innerHTML.includes('全員の音にもどす'));
 toggleRecordedMemberSolo();assert.equal(E.solo.type,'all');assert.equal(button.attrs['aria-pressed'],'false');assert.ok(button.innerHTML.includes('この人だけ聴く'));
 assert.equal(U.shown,perf);assert.equal(E.pb,pb);assert.equal(U.playing,true);assert.equal(JSON.stringify(S),before);n++;
}
fresh();toggleRecordedMemberSolo();const same=U.recordMember.id;releaseRecordedMemberSolo(same);assert.equal(E.solo.id,same);releaseRecordedMemberSolo(S.recs[0].snap.members[1].id);assert.equal(E.solo.type,'all');
fresh();toggleRecordedMemberSolo();const before=JSON.stringify(S),perf=U.shown;closeMemberCard();assert.equal(E.solo.type,'all');assert.equal(U.recordMember,null);assert.equal(U.recordPerf,null);assert.equal(U.sel,null);assert.equal(focus,'stage');assert.ok(card.hidden);assert.equal(U.shown,perf);assert.ok(U.playing);assert.equal(JSON.stringify(S),before);
fresh();toggleRecordedMemberSolo();clearRecordedMember();assert.equal(E.solo.type,'all');assert.equal(U.recordMember,null);
fresh();toggleRecordedMemberSolo();activeInside=true;clearRecordedMember();assert.equal(focus,'stage','終了して消えるカードに操作先を残さない');
fresh();focus='another-button';clearRecordedMember();assert.equal(focus,'another-button','別の操作へ移った人の操作先を奪わない');
// パートを選んだ人の指定は、カードを閉じるだけでは変えない。
fresh();U.solo='sec:fl';applySolo();closeMemberCard();assert.equal(E.solo.type,'sec');assert.equal(E.solo.id,'fl');
// 読み込み待ちでも、後で鳴る対象を全員へ戻す。
fresh();U.playing=false;U.waitPlay={perf:U.shown};const wait=U.waitPlay;toggleRecordedMemberSolo();assert.equal(E.solo.type,'member');closeMemberCard();assert.equal(E.solo.type,'all');assert.equal(U.waitPlay,wait);
fresh();U.playing=false;toggleRecordedMemberSolo();assert.equal(E.solo.type,'all','終わった録音を再開しない');
fresh();U.recordPerf={};toggleRecordedMemberSolo();assert.equal(E.solo.type,'all','別の演奏へ指定を移さない');
// Escapeは説明・編集・席選びを優先し、長押しや変換中では二段階閉じない。
const escape=extra=>{let prevented=false;keyHandler({key:'Escape',isComposing:false,repeat:false,preventDefault(){prevented=true;},...extra});return prevented;};
fresh();toggleRecordedMemberSolo();tip.hidden=false;assert.equal(escape(),false);assert.ok(U.recordMember);tip.hidden=true;assert.ok(escape());assert.equal(E.solo.type,'all');assert.equal(focus,'stage');
fresh();assert.equal(escape({repeat:true}),false);assert.ok(U.recordMember);assert.equal(escape({isComposing:true}),false);assert.ok(U.recordMember);
fresh();U.recordMember=null;form.hidden=false;assert.ok(escape());assert.equal(renameClosed,1);assert.ok(U.sel);move.open=true;assert.ok(escape());assert.equal(moveClosed,1);assert.ok(U.sel);assert.ok(escape());assert.equal(U.sel,null);
// 名簿から開いたカードは、元の行か検索欄へ戻す。
fresh();card.dataset.origin='roster';U.cardReturn={id:'found',top:123};closeMemberCard();assert.equal(focus,'row');assert.equal(scrolls,123);assert.equal(U.cardReturn,null);
fresh();card.dataset.origin='roster';U.cardReturn={id:'missing',top:123};closeMemberCard();assert.equal(focus,'search');
console.log('全'+n+'曲の本人・全員の切替／再生と音・部・録音を保持／別の本人・閉じる・待機で指定を解除／パート指定の保持／Escapeの説明・編集・席選び・長押し・変換／舞台・名簿の操作先：確認済み');
`,ctx);
