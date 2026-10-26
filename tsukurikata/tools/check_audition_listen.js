'use strict';
/* 人選を保存せずに音を比べ、選び直したら前の試聴を止めることを確かめる。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const pieces=[...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]);
const ctx=vm.createContext({console,assert,tick:()=>new Promise(setImmediate),clearTimeout});
for(const f of ['util','instruments','venues','scores',...pieces,'band','game'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f+'.js'});
vm.runInContext(`
let S,release,plays=[],afterStop=null;
const U={venue:'room',solo:'all',playing:false,waitPlay:null,shown:null,shownLabel:'',onEnd:null,lineup:true,draft:null,audListen:null,audSearching:false};
const SAMPLES={use:true,ready:true,error:null,loading:null};
const window={},cancelAnimationFrame=()=>{},requestAnimationFrame=()=>0;
function node(dataset={}){return {dataset,attrs:{},disabled:false,innerHTML:'',setAttribute(k,v){this.attrs[k]=v;}};}
const groupButtons=[node({aud:'all'}),node({aud:'best'}),node({aud:'listen'}),node({aud:'listenall'})],lineupButton=node();
let memberButtons=[];
const rootNode={querySelectorAll(sel){
 if(sel==='[data-aout]')return [];
 if(sel.includes('data-act="lineup"'))return [lineupButton,groupButtons[2]];
 if(sel.includes('data-aud="all"'))return [groupButtons[0],groupButtons[1],groupButtons[3]];
 return [];
},querySelector(sel){return sel==='[data-act="lineup"]'?lineupButton:null;}};
const nodes={'#week':rootNode},$=s=>nodes[s]||=(node());
const document={querySelectorAll(sel){return sel==='[data-audplay]'?memberButtons:groupButtons.slice(2);}};
const E={solo:{type:'all'},pb:null,ensure:()=>true,unlock(){},setSolo(s){this.solo=s;},stop(){this.pb=null;},play(perf){
 this.pb={perf};plays.push({perf,solo:{...this.solo}});return this.pb;
}};
const tabHidden=()=>true,clearRecordedMember=()=>{},updateMini=()=>{},renderPiece=()=>{},drawIdle=()=>{},renderSelectors=()=>{},updatePred=()=>{};
const setNowPlaying=()=>renderPlayButtons(),refreshNow=()=>{U.perfNow=null;},setVenue=id=>{U.venue=id;};
const uiIcon=name=>'<svg>'+name+'</svg>',memberById=id=>S.members.find(m=>m.id===id),busy=()=>!!(S.pending&&!S.pending.revealed);
function fresh(ready=true){
 S=freshState(2026);S=assignRecruits(S,autoAssign(S));S=choosePiece(S,'galop');
 S.members=fullBand({pitch:68,rhythm:72,tone:64,expr:61});S.year=2028;S.week=10;S=startAudition(S);
 U.lineup=true;U.draft=new Set(S.members.slice(0,4).map(m=>m.id));U.audListen=null;U.audSearching=false;U.playing=false;U.waitPlay=null;U.shown=null;U.onEnd=null;U.solo='member:前に聴いた人';
 E.pb=null;E.solo={type:'member',id:'前に聴いた人'};plays=[];afterStop=null;
 memberButtons=S.members.map(m=>node({audplay:m.id}));
 SAMPLES.ready=ready;SAMPLES.error=null;SAMPLES.loading=new Promise(r=>{release=()=>{SAMPLES.ready=true;r();};});
}
const sound=p=>JSON.stringify(p),ids=p=>[...new Set([...p.notes,...p.hits].map(n=>n.mid))].sort();
`,ctx);
const ui=fs.readFileSync(path.join(root,'js/ui.js'),'utf8');
vm.runInContext(ui.slice(ui.indexOf('function renderPlayButtons(){'),ui.indexOf('/* ===== スマホ')),ctx);
vm.runInContext(ui.slice(ui.indexOf('const STAGE_PERFORMERS ='),ui.indexOf('function levelAt(')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function playPerf('),ui.indexOf('function setVenue(')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function updateAuditionSelection('),ui.indexOf('// 響きの理由は')),ctx);
(async()=>{
 await vm.runInContext(`(async()=>{
 fresh();let before=sound(S),draft=[...U.draft].sort(),members=seated(S).filter(m=>!U.draft.has(m.id));
 listenAudition('selected');
 assert.equal(U.solo,'all');assert.equal(E.solo.type,'all');assert.deepEqual(ids(U.shown),members.map(m=>m.id).sort());
 assert.equal(sound(U.shown),sound(perform(perfCtx(S,{members,venue:LEVELS[nextContest(S).ev.level].venue,fatigue:0}))));
 assert.equal(groupButtons[2].attrs['aria-pressed'],'true');assert.equal(STAGE_PERFORMERS.get(U.shown).recorded,false);
 assert.equal(STAGE_PERFORMERS.get(U.shown).members.length,35);
 listenAudition('all');assert.equal(ids(U.shown).length,39);assert.equal(groupButtons[2].attrs['aria-pressed'],'false');assert.equal(groupButtons[3].attrs['aria-pressed'],'true');
 assert.deepEqual([...U.draft].sort(),draft);assert.equal(sound(S),before,'全員の試聴で人選もセーブも変えない');
 listenAudition('selected');assert.equal(ids(U.shown).length,35);listenAudition('selected');assert.equal(U.playing,false);assert.equal(U.audListen,null);
 // 別の本人の指定が残っていても、その候補が実際に吹いた一節を鳴らす。
 fresh();const m=S.members[6];listenAudition('member',m.id);
 assert.equal(E.solo.type,'all');assert.deepEqual(ids(U.shown),[m.id]);assert.equal(sound(U.shown),sound(perform(auditionCtx(S,m))));
 assert.equal(memberButtons[6].attrs['aria-pressed'],'true');E.pb=null;endPlay(true);assert.equal(U.audListen,null);assert.equal(memberButtons[6].attrs['aria-pressed'],'false');
 // チェックを変えたら古い組み合わせの音を止め、次回は新しい人選を使う。
 fresh();before=sound(S);listenAudition('selected');U.draft.add(S.members[5].id);updateAuditionSelection();
 assert.equal(U.playing,false);assert.equal(U.audListen,null);assert.equal(sound(S),before);listenAudition('selected');assert.equal(ids(U.shown).length,34);
 // 全員を聴いている間は、チェックだけ変えても全員の試聴を続けられる。
 fresh();listenAudition('all');const all=U.shown;U.draft.add(S.members[5].id);updateAuditionSelection();assert.equal(U.playing,true);assert.equal(U.shown,all);
 S=renameMember(S,S.members[0].id,'山田 花音');updateAuditionSelection();assert.equal(U.playing,false,'部が変わったら古い全員の音も止める');
 // 待機中の選び直し・同じボタンでの停止でも、古い予約を後から鳴らさない。
 fresh(false);listenAudition('selected');U.draft.add(S.members[5].id);updateAuditionSelection();assert.equal(U.waitPlay,null);assert.equal(U.audListen,null);release();await tick();assert.equal(plays.length,0);
 fresh(false);listenAudition('selected');listenAudition('selected');release();await tick();assert.equal(plays.length,0);assert.equal(U.audListen,null);
 fresh(false);listenAudition('all');listenAudition('selected');release();await tick();assert.equal(plays.length,1);assert.equal(ids(U.shown).length,35);assert.equal(U.audListen.kind,'selected');
 // おすすめの計算中と本番中は試聴を始めず、選択0人では決定と選択の試聴だけを止める。
 fresh();U.audSearching=true;listenAudition('all');assert.equal(plays.length,0);
 fresh();S.pending={revealed:false};listenAudition('selected');assert.equal(plays.length,0);
 fresh();U.draft=new Set(S.members.map(m=>m.id));updateAuditionSelection();assert.equal(lineupButton.disabled,true);assert.equal(groupButtons[2].disabled,true);assert.equal(groupButtons[3].disabled,false);
 listenAudition('selected');assert.equal(plays.length,0);before=sound(S);listenAudition('all');assert.equal(ids(U.shown).length,39);assert.equal(sound(S),before);assert.equal(U.draft.size,39);
 // 停止処理が部を変えた場合は、停止前の部から試聴を作らない。
 fresh();U.playing=true;U.onEnd=()=>{S=renameMember(S,S.members[0].id,'山田 花音');};listenAudition('selected');assert.equal(plays.length,0);assert.equal(S.members[0].name,'山田 花音');
 // 別の演奏へ切り替わったら、試聴中の印を残さない。
 fresh();listenAudition('selected');playPerf(perform(perfCtx(S)),'普通の合奏');assert.equal(U.audListen,null);assert.equal(groupButtons[2].attrs['aria-pressed'],'false');
 })()`,ctx);
 console.log('前の本人指定を解消／選択と全員と本人の実際の音／チェックと保存を保つ／選び直しと待機中止／古い予約の無効化／自然終了と別の音への切替／0人と本番中の制限：確認済み');
})().catch(e=>{console.error(e);process.exitCode=1;});
