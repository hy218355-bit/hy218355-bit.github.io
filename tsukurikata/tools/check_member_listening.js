'use strict';
/* 今の本人・パートの選択と解除で、音・再生位置・カードを保つ。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),pieces=[...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]);
const ctx=vm.createContext({assert,console,clearTimeout});
for(const f of ['util','instruments','venues','scores',...pieces,'band','game'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f+'.js'});
const ui=fs.readFileSync(path.join(root,'js/ui.js'),'utf8');
vm.runInContext(`
let S,plays=0,stops=0,redraws=0,ready=true,afterStop=null;
const U={piece:null,range:'all',venue:'room',solo:'all',sel:null,recordMember:null,memberCardMember:null,playing:false,waitPlay:null,shown:null,perfNow:null};
const document={activeElement:null},E={solo:{type:'all'},setSolo(s){this.solo=s;}};
const btn=act=>({dataset:{mact:act},attrs:{},hidden:false,innerHTML:'',setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k]??null;},closest(){return card;},focus(){document.activeElement=this;}}),buttons=Object.fromEntries(['solo','secsolo','all','close'].map(a=>[a,btn(a)]));
const card={hidden:false,dataset:{},querySelector(s){return buttons[/data-mact="([^"]+)"/.exec(s)?.[1]]||null;},draft:'入力中',details:['成長','思い出']};
const $=s=>s==='#memberCard'?card:s==='#btnNow'?{click(){if(!U.perfNow)U.perfNow=currentPerformance();playPerf(U.perfNow);}}:card.querySelector(s);
const memberById=id=>S.members.find(m=>m.id===id),playPiece=()=>U.piece||S.pieceId||'largo',renderSelectors=()=>{},renderDiag=()=>{},uiIcon=n=>'['+n+']',cdVisible=b=>!!b&&!b.hidden;
const rememberStageMembers=p=>p;
const renderMemberCard=()=>{redraws++;const m=memberById(U.sel);U.memberCardMember=m;card.dataset.member=m?.id;card.hidden=!m;card.draft='';renderCurrentMemberListening();};
const playPerf=perf=>{plays++;U.shown=perf;U.playing=ready;U.waitPlay=ready?null:{perf};renderCurrentMemberListening();};
const stopPlay=()=>{stops++;U.playing=false;U.waitPlay=null;U.perfNow=null;const cb=afterStop;afterStop=null;cb?.();renderCurrentMemberListening();};
function fresh(pid='galop'){
 S=freshState(2028);S.members=fullBand({pitch:68,rhythm:72,tone:64,expr:61}).map((m,i)=>({...m,id:'now-'+i}));S.pieceId=pid;S.recs=[];U.piece=null;U.range='all';U.venue='room';U.solo='all';U.sel=S.members[1].id;U.recordMember=null;U.playing=false;U.waitPlay=null;U.shown=null;U.perfNow=currentPerformance();
 U.memberCardMember=S.members[1];card.hidden=false;card.dataset.member=U.sel;card.draft='入力中';card.details=['成長','思い出'];plays=0;stops=0;redraws=0;ready=true;afterStop=null;document.activeElement=null;for(const b of Object.values(buttons)){b.attrs={};b.hidden=false;}renderCurrentMemberListening();
}
`,ctx);
vm.runInContext(ui.slice(ui.indexOf('function rangeSpan('),ui.indexOf('const busy =')),ctx);
vm.runInContext(ui.slice(ui.indexOf('const PERFORMANCE_PLAYERS ='),ui.indexOf('function rememberStageMembers(')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function currentCtx(){'),ui.indexOf('function refreshNow(){')),ctx);
vm.runInContext('const updateMini=()=>{};',ctx);
vm.runInContext(ui.slice(ui.indexOf('function applySolo(){'),ui.indexOf('// 録音の参照は')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function currentMemberListening('),ui.indexOf('function memberCurrentRanks(')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function listenCurrentMember('),ui.indexOf('function startStage(){')),ctx);
vm.runInContext(`
let n=0;
for(const pid of PIECE_IDS)for(const section of [false,true]){
 fresh(pid);const before=JSON.stringify(S),m=memberById(U.sel),action=section?'secsolo':'solo',button=buttons[action],draft=card.draft,details=card.details;
 document.activeElement=button;toggleCurrentMemberListening(m.id,section);const perf=U.shown,sound=JSON.stringify(perf);
 assert.equal(button.attrs['aria-pressed'],'true');assert.ok(button.innerHTML.includes('[check]'));assert.equal(plays,1);assert.equal(document.activeElement,button);
 toggleCurrentMemberListening(m.id,section);assert.equal(U.solo,'all');assert.equal(E.solo.type,'all');assert.equal(button.attrs['aria-pressed'],'false');assert.equal(U.shown,perf);assert.ok(U.playing);assert.equal(plays,1);assert.equal(stops,0);
 assert.equal(card.draft,draft);assert.equal(card.details,details);assert.equal(redraws,0);assert.equal(JSON.stringify(S),before);assert.equal(JSON.stringify(perf),sound);n++;
}
fresh();toggleCurrentMemberListening(U.sel);toggleCurrentMemberListening(U.sel,true);assert.equal(E.solo.type,'sec');assert.equal(buttons.solo.attrs['aria-pressed'],'false');assert.equal(buttons.secsolo.attrs['aria-pressed'],'true');assert.equal(plays,1);
document.activeElement=buttons.all;clearCurrentMemberListening();assert.equal(E.solo.type,'all');assert.ok(buttons.all.hidden);assert.equal(document.activeElement,buttons.solo);assert.equal(redraws,0);
// 止めた後は印を外す。設定は保ち、次のタップで本人を再開する。
fresh();toggleCurrentMemberListening(U.sel);const person=U.solo;stopPlay();assert.equal(buttons.solo.attrs['aria-pressed'],'false');assert.equal(U.solo,person);toggleCurrentMemberListening(U.sel);assert.equal(plays,2);assert.equal(buttons.solo.attrs['aria-pressed'],'true');
// 待機中も同じボタンで全員へ戻せて、同じ待機を保つ。
fresh();ready=false;toggleCurrentMemberListening(U.sel);const wait=U.waitPlay;assert.ok(buttons.solo.attrs['aria-label'].includes('読み込み中'));toggleCurrentMemberListening(U.sel);assert.equal(U.waitPlay,wait);assert.equal(E.solo.type,'all');assert.equal(plays,1);
// 違う演奏や育つ前の音では解除せず、現在の本人を作る。
fresh();U.playing=true;U.shown=perform({members:fullBand({pitch:100,rhythm:100,tone:100,expr:100}),pieceId:'galop',cohesion:100,fam:100,venue:'hall',seed:'model'});U.solo='sec:fl';toggleCurrentMemberListening(U.sel,true);assert.equal(stops,1);assert.equal(plays,1);assert.equal(U.shown,U.perfNow);
fresh();toggleCurrentMemberListening(U.sel);const old=U.shown;S=clone(S);memberById(U.sel).stats.pitch=95;U.perfNow=null;toggleCurrentMemberListening(U.sel);assert.equal(stops,1);assert.equal(plays,2);assert.notEqual(U.shown,old);assert.equal(redraws,1);assert.equal(U.memberCardMember,memberById(U.sel));
// 録音のカードと、控えの本人には現在の試聴の印を付けない。
fresh();U.recordMember={id:U.sel};U.playing=true;U.shown=U.perfNow;U.solo='member:'+U.sel;assert.equal(currentMemberListening(memberById(U.sel)),false);
fresh();memberById(U.sel).seat=null;toggleCurrentMemberListening(U.sel);assert.equal(plays,0);assert.equal(currentMemberListening(memberById(U.sel)),false);
console.log('全15曲×本人・パートの'+n+'通り／同じボタンで全員へ／切替で再生・音・部を保持／ボタンと入力・開いた内容を使い回す／停止後に印を解除し再開／待機を保って全員へ／違う音・成長後は最新へ／録音と控えを区別：確認済み');
`,ctx);
