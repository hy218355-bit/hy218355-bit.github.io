'use strict';
/* 再生バーは実際の演奏と聴く対象を表示し、録音時の本人を保つ。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),pieces=[...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]),ctx=vm.createContext({assert,console});
for(const f of ['util','instruments','venues','scores',...pieces,'band','game'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f+'.js'});
const ui=fs.readFileSync(path.join(root,'js/ui.js'),'utf8');
vm.runInContext(`
let S,ensemble=false,writes=0;
const U={tab:'members',solo:'all',playing:true,waitPlay:null,shown:null,shownLabel:'確認用の演奏',stageMembers:new Map(),miniMarkup:''},E={solo:{type:'all'},setSolo(s){this.solo=s;}};
const mini={hidden:true},button={html:'',attrs:{},set innerHTML(v){writes++;this.html=v;},get innerHTML(){return this.html;},setAttribute(k,v){this.attrs[k]=v;}};
const $=s=>s==='#mini'?mini:button,tabHidden=()=>U.tab!=='play',ensembleListening=()=>ensemble;
const uiIcon=n=>'[図:'+n+']',memberFace=(m,n)=>'[顔:'+m.id+':'+esc(m.name)+':'+m.seat+':'+n+']',instrumentIcon=i=>'[楽器:'+i+']';
`,ctx);
vm.runInContext(ui.slice(ui.indexOf('const STAGE_PERFORMERS ='),ui.indexOf('function levelAt(')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function updateMini(){'),ui.indexOf('/* ===== 再生 ===== */')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function applySolo(){'),ui.indexOf('// 録音の参照は')),ctx);
vm.runInContext(`
let n=0;
for(const pid of PIECE_IDS){
 S=freshState(2028);S.members=fullBand({pitch:68,rhythm:72,tone:64,expr:61});S.recs=[];
 const perf=perform({members:S.members,pieceId:pid,venue:'hall',seed:'mini',cohesion:50,fam:100}),m=S.members.find(m=>perf.notes.some(n=>n.mid===m.id)),sec=SEAT[m.seat].sec;
 const snap=S.members.map(x=>({...x}));snap.find(x=>x.id===m.id).name='録音の本人';rememberStageMembers(perf,snap,true);U.shown=perf;U.playing=true;U.waitPlay=null;U.tab='members';ensemble=false;U.stageMembers=new Map([[m.seat,{...m,name:'今の本人',seat:'perc2'}]]);
 const before=JSON.stringify(S),sound=JSON.stringify(perf);
 U.solo='member:'+m.id;applySolo();assert.ok(!mini.hidden);assert.ok(button.html.includes('[顔:'+m.id+':録音の本人:'+m.seat+':28]'));assert.ok(button.html.includes('[楽器:'+SEAT[m.seat].inst+']'));assert.ok(button.html.includes('録音の本人だけ'));assert.ok(!button.html.includes('今の本人'));assert.ok(button.attrs['aria-label'].includes('合奏を開く'));
 const w=writes;updateMini();assert.equal(writes,w,'同じ表示の顔とアイコンを作り直さない');
 U.solo='sec:'+sec;applySolo();assert.ok(button.html.includes(SECTIONS.find(s=>s.id===sec).name+'だけ'));assert.ok(!button.html.includes('[顔:'));
 U.solo='all';applySolo();assert.ok(button.html.includes('確認用の演奏'));assert.ok(button.html.includes('[図:note]'));assert.ok(!button.html.includes('[顔:'));
 U.playing=false;U.waitPlay={perf};U.solo='member:'+m.id;applySolo();assert.ok(button.html.includes('読み込み中'));assert.ok(button.html.includes('録音の本人だけ'));
 U.waitPlay=null;updateMini();assert.ok(mini.hidden);
 U.playing=true;U.tab='play';updateMini();assert.ok(mini.hidden);
 U.tab='week';ensemble=true;updateMini();assert.ok(mini.hidden);
 assert.equal(JSON.stringify(S),before);assert.equal(JSON.stringify(perf),sound);n++;
}
// 名前に記号があっても、HTMLとして扱わない。録音情報がない場合は表示用の奏者を使う。
ensemble=false;U.tab='members';U.playing=true;U.waitPlay=null;
const who={id:'unsafe',name:'<b>&名前',seat:'fl1a'},perf={pieceId:'galop',notes:[{mid:who.id}],hits:[]};U.shown=perf;U.stageMembers=new Map([[who.seat,who]]);U.solo='member:'+who.id;applySolo();assert.ok(button.html.includes('&lt;b&gt;&amp;名前だけ'));assert.ok(!button.html.includes('<b>&名前'));
U.solo='member:不在';applySolo();assert.ok(!button.html.includes('[顔:'));
console.log('全15曲／本人の顔と当時の楽器・パート・全員／待機と停止・合奏タブ・人選中の表示／同じ表示を使い回す／名前の安全な表示／部と演奏を保持：確認済み');
`,ctx);
