'use strict';
/* 指揮後の録音は同じボタンで止められ、画面を閉じた後へ音や待機を残さない。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),ctx=vm.createContext({assert,console,tick:()=>new Promise(setImmediate)});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),pieces=[...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]);
for(const f of ['util','instruments','venues','scores',...pieces,'band','game'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f+'.js'});
vm.runInContext(`
// 案内の画面更新は別の検証で確かめ、ここでは従来の再生操作を比べる。
const onboardingPlayed=()=>{},renderOnboarding=()=>{},renderGrowthListening=()=>{};
let S,release,plays=[],released=0;
const U={playing:false,waitPlay:null,shown:null,shownLabel:'',onEnd:null,solo:'all',perfNow:null},CD={phase:'done',rec:null,stage:null};
const SAMPLES={use:true,ready:true,error:null,loading:null},window={};
const button={attrs:{},dataset:{},innerHTML:'',setAttribute(k,v){this.attrs[k]=v;}};
const nodes={'#cdResult [data-cd="again"]':button,'#cdResult [data-cd="save"]':{setAttribute(k,v){this[k]=v;}},'#conduct':{hidden:false}},$=s=>nodes[s]||=({});
const E={pb:null,ac:{currentTime:0},ensure:()=>true,unlock(){},setSolo(){},stop(){this.pb=null;},play(perf){this.pb={perf};plays.push(perf);return this.pb;}};
const document={documentElement:{classList:{remove(){}}}},cancelAnimationFrame=()=>{},requestAnimationFrame=()=>0;
const updateMini=()=>{},clearRecordedMember=()=>{},renderPiece=()=>{},drawIdle=()=>{},renderAll=()=>{},renderRecordingLibrary=()=>{},cdClearJudge=()=>{};
const refreshNow=()=>{U.perfNow=null;},setVenue=()=>{},cdDialogRelease=()=>{released++;};
const renderPlayButtons=()=>renderConductResultPlayback(),setNowPlaying=()=>renderConductResultPlayback();
function fresh(ready=true){
 S=freshState(2028);S.members=fullBand({pitch:68,rhythm:72,tone:64,expr:61});S.pieceId='galop';S.recs=[];
 CD.phase='done';CD.stage=null;CD.rec=addRec(S,'あなたの指揮',{venue:'room'});U.playing=false;U.waitPlay=null;U.shown=null;U.onEnd=null;U.recordMember=null;E.pb=null;plays=[];released=0;
 nodes['#conduct'].hidden=false;button.attrs={};button.dataset={};SAMPLES.ready=ready;SAMPLES.error=null;
 SAMPLES.loading=new Promise(r=>{release=()=>{SAMPLES.ready=true;r();};});renderConductResultPlayback();
}
`,ctx);
const icons=fs.readFileSync(path.join(root,'js/icons.js'),'utf8');vm.runInContext(icons.slice(0,icons.indexOf('// テンポの1拍')),ctx);
const ui=fs.readFileSync(path.join(root,'js/ui.js'),'utf8'),conduct=fs.readFileSync(path.join(root,'js/conduct.js'),'utf8');
vm.runInContext(ui.slice(ui.indexOf('const STAGE_PERFORMERS ='),ui.indexOf('function levelAt(')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function activeLibraryRecording('),ui.indexOf('const libraryBlocked=')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function playPerf('),ui.indexOf('function setVenue(')),ctx);
vm.runInContext(conduct.slice(conduct.indexOf('function renderConductResultPlayback('),conduct.indexOf('const recFileName =')),ctx);
vm.runInContext(conduct.slice(conduct.indexOf('function closeConduct(){'),conduct.indexOf('const cdMsg =')),ctx);
(async()=>{
 await vm.runInContext(`(async()=>{
 fresh();let before=JSON.stringify(S);const originalButton=button;
 listenConductResult();assert.equal(U.playing,true);assert.equal(button.attrs['aria-pressed'],'true');assert.ok(button.innerHTML.includes('止める'));assert.ok(button.innerHTML.includes('<svg'));assert.equal(activeLibraryRecording().id,CD.rec.id);
 listenConductResult();assert.equal(U.playing,false);assert.equal(E.pb,null);assert.equal(button.attrs['aria-pressed'],'false');assert.ok(button.innerHTML.includes('もう一度聴く'));assert.equal(button,originalButton);assert.equal(JSON.stringify(S),before);
 // 自然に聴き終わっても結果に残り、同じ録音を増やさない。
 fresh();before=JSON.stringify(S);listenConductResult();E.pb=null;endPlay(true);assert.equal(CD.phase,'done');assert.equal(button.attrs['aria-pressed'],'false');assert.equal(JSON.stringify(S),before);
 // 読み込み待ちも同じボタンで中止でき、後から鳴らない。
 fresh(false);before=JSON.stringify(S);listenConductResult();assert.ok(U.waitPlay);assert.equal(button.dataset.waiting,'true');assert.ok(button.innerHTML.includes('読み込みをやめる'));
 listenConductResult();assert.equal(U.waitPlay,null);release();await tick();assert.equal(plays.length,0);assert.equal(button.attrs['aria-pressed'],'false');assert.equal(JSON.stringify(S),before);
 // 上の閉じる・Escapeから使う終了処理でも、再生と待機を止める。
 for(const ready of [true,false]){
  fresh(ready);before=JSON.stringify(S);listenConductResult();closeConduct();assert.equal(CD.phase,'idle');assert.equal(U.playing,false);assert.equal(U.waitPlay,null);assert.equal(E.pb,null);assert.ok(nodes['#conduct'].hidden);assert.equal(button.attrs['aria-pressed'],'false');assert.equal(released,1);
  const count=plays.length;release();await tick();assert.equal(plays.length,count);assert.equal(JSON.stringify(S),before);
 }
 // ほかの録音の音を、自分の録音を聴いている印にしない。
 fresh();const other=addRec(S,'別の録音',{venue:'hall'});before=JSON.stringify(S);playRecording(other,'別');assert.equal(button.attrs['aria-pressed'],'false');listenConductResult();assert.equal(activeLibraryRecording().id,CD.rec.id);assert.equal(button.attrs['aria-pressed'],'true');assert.equal(JSON.stringify(S),before);
 fresh();CD.phase='count';listenConductResult();assert.equal(plays.length,0);CD.phase='done';CD.rec=null;listenConductResult();assert.equal(plays.length,0);
 })()`,ctx);
 console.log('同じボタンで再生・停止／自然終了で印を戻す／読み込み中止後の遅延再生なし／結果を閉じて再生と待機を停止／別の録音の印を区別／部と録音を増減しない：確認済み');
})().catch(e=>{console.error(e);process.exitCode=1;});
