'use strict';
/* 実ゲームの確認用ページ。Gで合奏・Cで本番・Mで部員・Dでテーマを切り替える。製品には入れない。 */
(async()=>{
// 確認ページだけ保存先を使わず、操作や早送りで本物のセーブを書き換えない。
save=()=>{};load=()=>null;saveUI=()=>{};
// 確認用だけ、一つの録音を読めない状態にする。実際のゲームとセーブには入れない。
const audioFailure=new URLSearchParams(location.search).get('sampleFailure'),audioRequests={},audioFetch=window.fetch.bind(window);
const audioFlow={active:0,peak:0,finished:0,failed:0,started:performance.now(),settledMs:null};
let audioBeforeRetry=null;
window.fetch=(input,init)=>{
 const url=new URL(typeof input==='string'?input:input.url,document.baseURI),match=url.pathname.match(/\/snd\/([^/]+\.(?:mp3|json))$/);
 let request;
 if(match){
  const name=match[1],count=audioRequests[name]=(audioRequests[name]||0)+1;
  if((audioFailure==='manifest'&&name==='manifest.json'&&count===1)||(name==='flute.mp3'&&(audioFailure==='repeat'||audioFailure==='once'&&count===1)))request=Promise.resolve(new Response('',{status:503}));
 }
 request=request||audioFetch(input,init);
 if(!match||!match[1].endsWith('.mp3'))return request;
 audioFlow.active++;audioFlow.peak=Math.max(audioFlow.peak,audioFlow.active);
 return request.then(r=>{if(!r.ok&&r.status!==0)audioFlow.failed++;return r;},e=>{audioFlow.failed++;throw e;}).finally(()=>{audioFlow.active--;audioFlow.finished++;});
};
if(document.readyState==='loading')await new Promise(r=>document.addEventListener('DOMContentLoaded',r,{once:true}));
const q=new URLSearchParams(location.search);let view=q.get('view')||'week';
const countinHistory=[];
const playbackStops=[];
if(q.has('playbackStopAudit')){
 // 止めた再生の出口を後から読み、次の再生へ切り替えても音量が戻らないか残す。
 const stop=Playback.prototype.stop;
 Playback.prototype.stop=function(){
  if(this.ended)return stop.call(this);
  const item={at:this.ac.currentTime,clock:!!this.clock,before:[this.bus.gain.value,this.wet.gain.value],samples:[]};playbackStops.push(item);
  stop.call(this);
  for(const delay of [0,80,160,240,360])setTimeout(()=>{item.samples.push({elapsed:this.ac.currentTime-item.at,gains:[this.bus.gain.value,this.wet.gain.value],ended:this.ended});record();},delay);
 };
}
if(q.has('countinAudit')){
 const ready=cdCountReady;
 cdCountReady=now=>{
  const previous=CD.count.slice();ready(now);
  countinHistory.push({at:now,from:CD.perf.from,previous});setTimeout(record,0);
 };
}
const cadenceClicks=[],cadenceArrivals=[];
if(q.has('downbeatAudit')){
 const click=cdClick;
 cdClick=(at,strong)=>{cadenceClicks.push({at,strong});click(at,strong);};
 // 短い点灯中の色と拍を記録し、確認の操作待ちで見逃さないようにする。
 new MutationObserver(()=>{
  const now=$('#cdCueNow');
  if(!now?.matches('.downbeat.hit')||cadenceArrivals.some(a=>a.phase===CD.phase&&a.from===CD.perf.from))return;
  cadenceArrivals.push({phase:CD.phase,from:CD.perf.from,fill:getComputedStyle(now.querySelector('rect')).fill,pad:$('#cdPad').className,beat:$('#cdBeatRow .on')?.textContent});
 }).observe($('#cdPattern'),{subtree:true,attributes:true,attributeFilter:['class']});
}
const castEntrance=[];
if(q.has('watchCardAudit'))new MutationObserver(()=>{
 castEntrance.push({count:Number($('#cdStage').dataset.portraitCount),phase:CD.phase,playing:U.playing});
}).observe($('#cdStage'),{attributes:true,attributeFilter:['data-portrait-count']});
const focusKeys=[];
if(q.has('focusAudit'))window.addEventListener('keydown',e=>{
 if(['Escape','Tab',' ','Enter'].includes(e.key))focusKeys.push({key:e.key,repeat:e.repeat,tipOpen:!$('#tip').hidden,target:e.target.id||e.target.tagName});
 setTimeout(record,0);
},{capture:true});
const timingAudit={frames:0,textChanges:0,inputs:[]};
if(q.has('timingAudit')){
 // 確認専用。実際の入力を処理する直前に負荷を掛け、判定時刻との違いを記録する。
 $('#cdPad').addEventListener('pointerdown',e=>{
  if(!['count','play'].includes(CD.phase))return;
  const delay=q.get('inputDelay')==='variable'?[80,140,60,160,100][timingAudit.inputs.length%5]:0;
  const begin=performance.now();while(performance.now()-begin<delay){}
  const raw=E.ac.currentTime,expected=raw-Math.max(0,performance.now()-e.timeStamp)/1000;
  const entry={delay,raw,expected};timingAudit.inputs.push(entry);
  setTimeout(()=>{entry.actual=CD.lastTap;entry.errorMs=+(1000*(entry.actual-entry.expected)).toFixed(3);record();},0);
 },true);
 new MutationObserver(records=>{
  for(const r of records){
   if(r.type==='attributes'&&r.target.id==='cdCueNext0')timingAudit.frames++;
   if(r.type==='childList'&&r.target.nodeName==='text')timingAudit.textChanges++;
  }
 }).observe($('#cdPattern'),{subtree:true,childList:true,attributes:true,attributeFilter:['transform']});
}
// 確認専用。判定の文字が操作面の外へ切れていないか、入力ごとの位置を残す。
const feedbackAudit=[];
if(q.has('judgeAudit'))new MutationObserver(records=>{
 if(!records.some(r=>r.type==='childList'))return;
 const el=$('#cdFeedback')||$('#cdPad .cd-judge');
 if(!el?.textContent)return;
 const sample=()=>{
  if(!el.isConnected||!el.textContent)return;
  const rect=el.getBoundingClientRect(),pad=$('#cdPad').getBoundingClientRect();
  const inPad=!!el.closest('#cdPad'),visibleHeight=inPad?Math.max(0,Math.min(rect.bottom,pad.bottom)-Math.max(rect.top,pad.top)):rect.height;
  feedbackAudit.push({text:el.textContent,kind:el.className,rect:rect.toJSON(),pad:pad.toJSON(),inPad,aboveCue:rect.bottom<=$('#cdPattern').getBoundingClientRect().top,visibleRatio:rect.height?visibleHeight/rect.height:0});
  record();
 };
 sample();setTimeout(sample,200);
}).observe($('#conduct'),{subtree:true,childList:true});
document.documentElement.dataset.theme=q.get('theme')==='dark'?'dark':'light';
U.sfx=false;U.fxMode='off';FX.q=[];clearTimeout(FX.timer);FX.on=false;$('#fx').hidden=true;
let report,releaseSamples,performanceMemo,releaseLibraryExport;
const libraryExpected=new WeakMap();
const pieceExpected=new WeakMap();
const memberButtonIds=new WeakMap();let memberButtonId=0;
if(q.has('exportAudit'))saveRecording=rec=>{report.libraryExport={id:rec.id,label:rec.label,snapshot:hash(JSON.stringify(rec.snap))};return q.has('holdExport')?new Promise(resolve=>{releaseLibraryExport=resolve;}):Promise.resolve();};
const playbackIds=new WeakMap();let playbackCount=0;
window.addEventListener('error',e=>{if(report)report.errors.push(e.message);});
function advance(s){
 if(recruitsDue(s)&&!s.pending)return assignRecruits(s,autoAssign(s));
 if(s.phase==='choose')return choosePiece(s,'galop');
 if(s.phase==='chooseSet')return chooseSetPiece(s,setOffer(s)[0]);
 if(s.phase==='end')return autoWinter(s);
 if(s.pending)return finishStage(s);
 const ev=eventAt(s,s.week);
 if(ev?.kind==='audition'&&s.audition&&!s.audition.decided)return setLineup(s,recommendLineup(s));
 if(ev&&(ev.kind==='concert'||ev.kind==='contest'))return beginStage(s);
 if(ev?.kind==='forced')return practiceWeek(s,'test');
 if(s.chooseFinal)return chooseFinalPiece(s,s.pieceId);
 if(s.episode)return resolveEpisode(s,episodeView(s)?.choices[0]?.k??0);
 if(s.outing){const v=outingView(s);return v?resolveOuting(s,ss(s).slice(0,v.n).map(m=>m.id)):{...s,outing:null};}
 if(s.consult){const v=consultView(s);return v?resolveConsult(s,v.choices[0].k):{...s,consult:null};}
 return practiceWeek(s);
}
function record(){
 if(q.has('playbackStopAudit'))report.playbackStops=playbackStops;
 const bootResult=$('#bootResult');if(bootResult)report.boot=JSON.parse(bootResult.textContent);
 if(q.has('performanceAudit')){
  const key=[playPiece(),U.range,U.venue].join(':');
  if(!performanceMemo||performanceMemo.state!==S||performanceMemo.key!==key){performanceMemo={state:S,key,perf:perform(currentCtx())};}
  const fingerprint=p=>p?hash(JSON.stringify(p)):null;
  report.performanceAudit={expected:fingerprint(performanceMemo.perf),prepared:fingerprint(U.perfNow),shown:fingerprint(U.shown),expectedCohesion:performanceMemo.perf.cohesion,preparedCohesion:U.perfNow?.cohesion,shownCohesion:U.shown?.cohesion};
 }
 if(audioFlow.settledMs===null&&(SAMPLES.ready||SAMPLES.error))audioFlow.settledMs=Math.round(performance.now()-audioFlow.started);
 report.audio={ready:SAMPLES.ready,progress:SAMPLES.progress,error:SAMPLES.error?{name:SAMPLES.error.name,message:SAMPLES.error.message}:null,banks:Object.keys(SAMPLES.banks),requests:{...audioRequests},flow:{...audioFlow},preservedCount:audioBeforeRetry?.length,preservedBuffers:audioBeforeRetry?audioBeforeRetry.every(([name,bank])=>SAMPLES.banks[name]===bank):null,voices:[...new Set((E.pb?.voices||[]).map(v=>v.constructor.name))]};
 report.listeningMix=E.pb?{nodes:E.pb.listenOutputs.length,live:E.pb.listenLive,gain:E.pb.listenOutputs.map(n=>n.gain.value)}:null;
 report.hallExp=S.hallExp;
 if(q.has('memberListenAudit')){
  const card=$('#memberCard'),active=U.waitPlay?.perf||(U.playing?U.shown:null),m=U.sel&&memberById(U.sel),[type,id]=U.solo.split(':');
  const buttonId=b=>{if(!memberButtonIds.has(b))memberButtonIds.set(b,++memberButtonId);return memberButtonIds.get(b);};
  report.memberListening={state:hash(JSON.stringify(S)),selected:U.sel,section:m?.seat&&SEAT[m.seat].sec,sourceCurrent:!!active&&active===U.perfNow,cacheCurrent:!!m&&U.memberCardMember===m,hidden:card.hidden,focus:document.activeElement.id||document.activeElement.dataset.mact||document.activeElement.tagName,buttons:[...card.querySelectorAll(':scope>.mc-actions [data-mact]')].map(b=>({id:buttonId(b),act:b.dataset.mact,pressed:b.getAttribute('aria-pressed'),label:b.getAttribute('aria-label'),hidden:b.hidden,checked:!!b.querySelector('path[d="m5 12 4 4L19 6"]'),rect:b.getBoundingClientRect().toJSON()})),details:[...card.querySelectorAll(':scope>details[open]')].map(d=>d.className),draft:$('#memberNameForm')&&!$('#memberNameForm').hidden?$('#memberName').value:null,expected:active?[...new Set([...active.notes,...active.hits].filter(n=>type==='all'||type==='member'&&n.mid===id||type==='sec'&&n.sec===id).map(n=>n.mid))]:[]};
 }
 if(q.has('currentRestAudit')){
  const perf=performanceMemo?.perf,rest=$('#memberCard [data-current-rest]');
  report.currentRest={rest:rest&&!rest.hidden?rest.textContent:null,options:[...$('#soloSel').options].map(o=>o.value),expected:perf?{members:[...new Set([...perf.notes,...perf.hits].map(n=>n.mid))],sections:[...new Set([...perf.notes,...perf.hits].map(n=>n.sec))]}:null,cast:STAGE_PERFORMERS.get(U.perfNow)?.members.map(m=>({id:m.id,seat:m.seat,name:m.name}))};
 }
 if(q.has('stopAudit')){
  const current=document.activeElement,rect=el=>el.getBoundingClientRect().toJSON();
  report.stopUi={state:hash(JSON.stringify(S)),focus:current.id||current.dataset.tabgo||current.tagName,tab:U.tab,scroll:scrollY,mainHidden:$('#btnStop').hidden,nowHidden:$('#btnNow').hidden,miniHidden:$('#mini').hidden,now:rect($('#btnNow')),miniStop:rect($('#miniStop')),tabButton:rect($('#tabbar [aria-current="page"]')),seconds:U.playing?E.now():null};
 }
 if(q.has('stageRevealAudit'))report.stageReveal={state:hash(JSON.stringify(S)),focus:document.activeElement.id||document.activeElement.dataset.mact||document.activeElement.tagName,scroll:scrollY,stage:$('#stage').getBoundingClientRect().toJSON(),panel:$('.col-stage').getBoundingClientRect().toJSON(),actions:$('.rehearsal-actions').getBoundingClientRect().toJSON(),margin:getComputedStyle($('.col-stage')).scrollMarginTop,tab:U.tab};
 if(q.has('pieceAudit')){
  const active=pieceListening();if(active&&!pieceExpected.has(active))pieceExpected.set(active,hash(JSON.stringify(active.kind==='model'?modelPerf(active.pid):perform(currentCtx()))));
  report.sourceUi={kind:$('#pieceEyebrow').textContent,liveHidden:$('#btnLiveNow').hidden,conductHidden:$('#btnConduct').hidden,conductDisabled:$('#btnConduct').disabled,rangeDisabled:$('#rangeSel').disabled,rangeOptions:[...$('#rangeSel').options].map(o=>({value:o.value,text:o.textContent})),options:[...$('#soloSel').options].map(o=>({value:o.value,text:o.textContent})),memberHidden:$('#memberCard').hidden,selected:U.sel,stagePortraits:Number($('#stage').dataset.portraitCount||0),focus:document.activeElement.id||document.activeElement.dataset.mact||document.activeElement.tagName,view:U.view,sections:[...new Set([...(U.shown?.notes||[]),...(U.shown?.hits||[])].map(n=>n.sec))]};
  report.pieceListening={active:!!active,duration:active?.perf.total,kind:active?.kind,pid:active?.pid,state:hash(JSON.stringify(S)),performance:active?hash(JSON.stringify(active.perf)):null,expected:active?pieceExpected.get(active):null,performers:active?[...new Set([...active.perf.notes,...active.perf.hits].map(n=>n.mid))]:[],buttons:[...document.querySelectorAll('[data-act="model"][data-pid],[data-act="preview"][data-pid]')].map(b=>({pid:b.dataset.pid,kind:b.dataset.act,pressed:b.getAttribute('aria-pressed'),waiting:b.dataset.waiting,text:b.textContent,rect:b.getAttribute('aria-pressed')==='true'?b.getBoundingClientRect().toJSON():null})),cards:[...document.querySelectorAll('[data-piece-card][data-listening="true"]')].map(c=>c.dataset.pieceCard),focus:{id:document.activeElement.id,pid:document.activeElement.dataset.pid,kind:document.activeElement.dataset.act},expectedChoice:report.expectedChoice};
 }
 if(q.has('conductResultAudit')){
  const rec=CD.rec,b=$('#cdResult [data-cd="again"]'),active=U.waitPlay?.perf||(U.playing?U.shown:null);
  if(rec&&!libraryExpected.has(rec))libraryExpected.set(rec,hash(JSON.stringify(recPerf(rec))));
  report.resultRecording={state:hash(JSON.stringify(S)),record:rec?{id:rec.id,snapshot:hash(JSON.stringify(rec.snap)),span:rec.span,conduct:rec.conduct}:null,active:activeLibraryRecording()?.id||null,expected:rec?libraryExpected.get(rec):null,performance:active?hash(JSON.stringify(active)):null,clock:E.pb?.clock?.saved(),hidden:$('#conduct').hidden,button:b?{text:b.textContent,pressed:b.getAttribute('aria-pressed'),waiting:b.dataset.waiting||'false',rect:b.getBoundingClientRect().toJSON()}:null,export:report.libraryExport};
 }
 report.conduct={period:CD.clock?.P,level:CD.level,beat:$('#cdPattern').dataset.nextBeat,phase:CD.phase,count:CD.count.length,taps:CD.clock?.taps.length||0,judge:CD.judge?{...CD.judge}:null,combo:CD.combo,events:CD.clock?.ev.length||0,meter:CD.perf?.meter,from:CD.perf?.from,to:CD.perf?.to};
 if(q.has('countinAudit'))report.countin={history:countinHistory.slice(),times:CD.count.slice(),cueStart:CD.cueStart,lastTap:CD.lastTap,message:$('#cdMsg').textContent,shown:$('#cdPattern').dataset.nextBeat};
 if(q.has('focusAudit')){
  const active=document.activeElement;
  report.conductKeys=focusKeys.slice(-32);
  report.conductFocus={active:active?.id||active?.getAttribute('data-cd')||active?.getAttribute('data-act')||active?.tagName,text:active?.textContent?.trim().slice(0,60),inside:$('#conduct').contains(active),role:$('#conduct').getAttribute('role'),modal:$('#conduct').getAttribute('aria-modal'),background:[...document.querySelectorAll('.app,#tabbar,#mini,#toast')].map(el=>({id:el.id||'app',inert:el.inert})),tipOpen:!$('#tip').hidden,tipOwner:document.querySelector('[aria-describedby~="tip"]')?.id||null};
 }
 if(q.has('downbeatAudit')){
  const cue=E.ac&&CD.perf?cdCueState(E.ac.currentTime):null;
  const look=el=>{const rect=el.querySelector('rect');return {downbeat:el.classList.contains('downbeat'),fill:rect?getComputedStyle(rect).fill:null,stroke:rect?getComputedStyle(rect).strokeWidth:null};};
  report.cadence={cue,from:CD.perf?.from,meter:CD.perf?.meter,clicks:cadenceClicks.slice(),arrivals:cadenceArrivals.slice(),next:[...document.querySelectorAll('#cdPattern .cue-next')].map(look),now:$('#cdCueNow')?look($('#cdCueNow')):null,beats:[...document.querySelectorAll('#cdBeatRow i')].map(el=>({text:el.textContent,on:el.classList.contains('on'),counted:el.classList.contains('counted'),color:getComputedStyle(el).backgroundColor})),calm:$('#cdPattern').dataset.calm};
 }
 if(q.has('judgeAudit'))report.conductFeedback=feedbackAudit.slice(-24);
 if(q.has('timingAudit'))report.conductTiming={...timingAudit,inputs:timingAudit.inputs.map(x=>({...x}))};
 const yearNext=$('#week .year-actions .btn')?.getBoundingClientRect();report.yearNext=yearNext?{top:yearNext.top,bottom:yearNext.bottom,height:yearNext.height}:null;
 report.yearGrowth=Array.from(document.querySelectorAll('[data-year-growth]')).map(el=>({id:el.dataset.yearGrowth,name:el.querySelector('b').textContent,ranks:el.querySelector('.yr-grow-ranks').getAttribute('aria-label')}));
 report.year=S.year;report.phase=S.phase;report.pending=S.pending?{kind:S.pending.kind,revealed:!!S.pending.revealed}:null;report.expectedNowLabel=nowLabel();
 report.theme=document.documentElement.dataset.theme;report.width=innerWidth;report.scrollWidth=document.documentElement.scrollWidth;
 report.faceCount=document.querySelectorAll('.member-face').length;
 report.stagePortraits=Number($('#stage').dataset.portraitCount||0);report.watchPortraits=Number($('#cdStage').dataset.portraitCount||0);
 report.stageSelected=$('#stage').dataset.selectedMember||null;report.watchSelected=$('#cdStage').dataset.selectedMember||null;
 report.stageCache=Faces.stageCacheSize();
 report.shownMatchesPrepared=!!U.shown&&U.shown===U.perfNow;
 report.playing=U.playing;report.waiting=!!U.waitPlay;report.shownLabel=U.shownLabel;report.range=U.range;report.solo=U.solo;report.piece=playPiece();report.venue=U.venue;
 report.engineSolo=E.solo;report.viewPart=U.view;
 if(q.has('venueAudit'))report.venueAudio={state:hash(JSON.stringify(S)),performance:U.shown?hash(JSON.stringify(U.shown)):null,audioState:E.ac?.state,engine:E.venueId,position:E.posId,chain:E.chain?.venueId,chainPosition:E.chain?.posId,gain:E.chain?.stage.out.gain.value,realIR:!!(E.ac&&VIR_CACHE.get(E.ac)?.[E.venueId+'_'+E.posId]?.buf)};
 if(q.has('ensembleAudit')){
  const active=ensembleListening(),button=$('#week [data-act="enslisten"]'),rec=S.winter?.ens?.recId&&S.recs.find(r=>r.id===S.winter.ens.recId);
  report.ensemble={selected:[...(U.ensPick||[])],active:!!active,waiting:!!U.waitPlay,fullState:hash(JSON.stringify(S)),performance:active?hash(JSON.stringify(active.perf)):null,cast:active?STAGE_PERFORMERS.get(active.perf)?.members.map(m=>m.id):[],button:button?{label:button.getAttribute('aria-label'),pressed:button.getAttribute('aria-pressed'),disabled:button.disabled,waiting:button.dataset.waiting,motion:document.documentElement.dataset.fxMode,animation:getComputedStyle(button,'::after').animationName,rect:button.getBoundingClientRect().toJSON()}:null,focus:document.activeElement.dataset.ens||document.activeElement.dataset.act||document.activeElement.id,miniHidden:$('#mini').hidden,result:S.winter?.ens,resultPerformance:rec?hash(JSON.stringify(perform(recCtx(rec)))):null,pieceChoice:U.piece,rangeChoice:U.range};
  const picked=$('#ensemblePicked');report.ensemble.picked=picked?{faces:[...picked.querySelectorAll('[data-face]')].map(f=>f.dataset.face),slots:picked.children.length,label:picked.getAttribute('aria-label'),rect:picked.getBoundingClientRect().toJSON(),cards:[...document.querySelectorAll('#week [data-ens]')].filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.dataset.ens),names:seated(S).filter(m=>U.ensPick?.has(m.id)).map(m=>m.name)}:null;
 }
 if(q.has('watchCardAudit')){
  const card=$('#cdMember'),button=card.querySelector('[data-cdm="solo"]'),rect=el=>el?.getBoundingClientRect().toJSON();
  report.watchCard={selected:CD.sel,hidden:card.hidden,name:card.querySelector('#cdMemberName')?.textContent,pressed:button?.getAttribute('aria-pressed'),button:rect(button),close:rect(card.querySelector('[data-cdm="close"]')),card:rect(card),scroll:$('#conduct').scrollTop,active:document.activeElement.id||document.activeElement.dataset.cdm||document.activeElement.tagName,stats:getComputedStyle($('.cd-stats')).display};
  const source=STAGE_PERFORMERS.get(CD.perf),rec=S.recs.find(r=>r.snap.members===source?.members),person=m=>({id:m.id,name:m.name,grade:m.grade,seat:m.seat,ranks:Object.fromEntries(STAT_KEYS.map(k=>[k,rankOf(m.stats[k])])),mental:rankOf(m.mental??40)});
  report.watchCast={entrance:castEntrance.slice(),members:[...(CD.stageMembers?.values()||[])].map(person),who:[...(CD.who||[])],sounding:[...(CD.sounding||[])],selected:cdMemberById(CD.sel)?person(cdMemberById(CD.sel)):null,current:CD.sel&&memberById(CD.sel)?person(memberById(CD.sel)):null,source:source?.members.map(person),record:rec?.id,performance:CD.perf?hash(JSON.stringify(CD.perf)):null,expected:rec?hash(JSON.stringify(perform(recCtx(rec)))):null,note:card.querySelector('.cm-note')?.textContent,say:card.querySelector('.cm-say')?.textContent,soloButton:!!button};
 }
 if(q.has('announceAudit')){
  const dialog=$('#announce'),body=dialog.querySelector('.an-body');
  report.announcement={hidden:dialog.hidden,active:document.activeElement.id||document.activeElement.className||document.activeElement.tagName,inside:dialog.contains(document.activeElement),role:dialog.getAttribute('role'),modal:dialog.getAttribute('aria-modal'),motion:dialog.dataset.motion,skipHidden:$('#anSkip').hidden,doneHidden:$('#anDone').hidden,body:{top:body.scrollTop,height:body.clientHeight,scroll:body.scrollHeight,rect:body.getBoundingClientRect().toJSON()},done:$('#anDone').getBoundingClientRect().toJSON(),background:[...document.querySelectorAll('.app,#tabbar,#mini,#toast')].map(el=>({id:el.id||'app',inert:el.inert})),rows:[...$('#anList').children].map(el=>({name:el.querySelector('.nm').textContent,award:el.querySelector('.aw').textContent,ours:el.classList.contains('ours')})),representatives:[...document.querySelectorAll('#anRep li .nm')].map(el=>el.textContent),faces:[...document.querySelectorAll('#anList .an-crew [data-face]')].map(el=>el.dataset.face),closed:report.announceClosed||0,pending:hash(JSON.stringify(S.pending))};
 }
 if(E.pb&&!playbackIds.has(E.pb))playbackIds.set(E.pb,++playbackCount);
 report.playbackId=E.pb?playbackIds.get(E.pb):null;
 report.audibleMemberIds=E.pb?Object.keys(E.pb.mem).filter(mid=>E.pb.audible(mid,E.solo)):[];
 if(q.has('miniAudit')){
  const perf=U.waitPlay?.perf||(U.playing?U.shown:null),cast=STAGE_PERFORMERS.get(perf),person=cast?.members.find(m=>m.id===E.solo.id),button=$('#miniLabel'),face=button.querySelector('[data-face]');
  report.mini={state:hash(JSON.stringify(S)),hidden:$('#mini').hidden,text:button.textContent,label:button.getAttribute('aria-label'),face:face?.dataset.face,faceStyle:face?.getAttribute('style'),source:person?{id:person.id,name:person.name,seat:person.seat,face:Faces.fingerprint(person),html:memberFace(person,28)}:null,recorded:!!cast?.recorded,focus:document.activeElement.id,button:button.getBoundingClientRect().toJSON(),stop:$('#miniStop').getBoundingClientRect().toJSON(),bar:$('#mini').getBoundingClientRect().toJSON(),tabs:$('#tabbar').getBoundingClientRect().toJSON(),footer:$('#week .plan>.transport')?.getBoundingClientRect().toJSON()};
 }
 report.shownBounds=U.shown?{from:U.shown.from,to:U.shown.to}:null;report.preparedBounds=U.perfNow?{from:U.perfNow.from,to:U.perfNow.to}:null;
 report.shownPlayers=U.shown?Object.entries(buildPtr(U.shown)).map(([seat,p])=>({seat,id:p.mid})):[];
 report.recordsFingerprint=hash(JSON.stringify(S.recs));
 report.recordedCard=U.recordMember?{id:U.recordMember.id,name:U.recordMember.name,grade:U.recordMember.grade,seat:U.recordMember.seat,ranks:Object.fromEntries(STAT_KEYS.map(k=>[k,rankOf(U.recordMember.stats[k])]))}:null;
 if(q.has('recordCardAudit')){
  const card=$('#memberCard'),b=card.querySelector('[data-mact="recordsolo"]');
  report.recordCardUi={state:hash(JSON.stringify(S)),hidden:card.hidden,origin:card.dataset.origin,focus:document.activeElement.id||document.activeElement.dataset.mact||document.activeElement.tagName,rest:card.querySelector('.mc-rest')?.textContent,options:[...$('#soloSel').options].map(o=>({value:o.value,text:o.textContent})),sounds:U.recordPerf?{members:[...new Set([...U.recordPerf.notes,...U.recordPerf.hits].map(n=>n.mid))],sections:[...new Set([...U.recordPerf.notes,...U.recordPerf.hits].map(n=>n.sec))]}:null,button:b?{pressed:b.getAttribute('aria-pressed'),text:b.textContent,rect:b.getBoundingClientRect().toJSON()}:null,card:card.getBoundingClientRect().toJSON(),solo:U.solo,seconds:U.playing?E.now():null,current:U.sel&&memberById(U.sel)?{name:memberById(U.sel).name,seat:memberById(U.sel).seat}:null,canRename:!!card.querySelector('[data-mact="rename"]'),canMove:!!card.querySelector('.mc-move'),nameFormOpen:!!$('#memberNameForm')&&!$('#memberNameForm').hidden,moveOpen:!!card.querySelector('.mc-move')?.open};
 }
 report.recordedCast=U.stageMembers?Array.from(U.stageMembers,([seat,m])=>({seat,id:m.id,name:m.name,grade:m.grade,ranks:Object.fromEntries(STAT_KEYS.map(k=>[k,rankOf(m.stats[k])]))})):[];
 report.recordings=S.recs.map(r=>({id:r.id,label:r.label}));
 const libraryActive=activeLibraryRecording(),libraryPerf=U.waitPlay?.perf || (U.playing?U.shown:null);
 report.library={open:$('#recordingPanel').open,selected:$('#recSel').value,active:libraryActive?.id||null,waiting:!!U.waitPlay,blocked:libraryBlocked(),saving:U.librarySaving||null,years:[...document.querySelectorAll('.recording-year>h3')].map(el=>el.textContent),rows:[...document.querySelectorAll('[data-record-item]')].map(el=>({id:el.dataset.recordItem,active:el.dataset.active,label:el.querySelector('[data-record-play]').getAttribute('aria-label'),pressed:el.querySelector('[data-record-play]').getAttribute('aria-pressed'),disabled:el.querySelector('[data-record-play]').disabled,saveDisabled:el.querySelector('[data-record-save]').disabled,faces:[...el.querySelectorAll('[data-face]')].map(f=>f.dataset.face)})),source:S.recs.map(r=>({id:r.id,label:r.label,year:r.year,piece:r.pieceId,venue:r.venue,span:r.span,count:r.snap.members.length,faces:r.snap.members.slice(0,3).map(m=>({id:m.id,name:m.name,originalName:m.originalName,face:Faces.fingerprint(m)}))}))};
 if(q.has('libraryAudit')&&libraryActive){if(!libraryExpected.has(libraryActive))libraryExpected.set(libraryActive,hash(JSON.stringify(perform({...recCtx(libraryActive),...(libraryActive.span||{})}))));report.library.expected=libraryExpected.get(libraryActive);report.library.actual=hash(JSON.stringify(libraryPerf));}
 report.listening={shownPiece:U.shown?.pieceId,title:$('#piece').textContent,kind:$('#pieceEyebrow').textContent,range:$('#rangeSel').value,rangeLabel:$('#rangeSel').selectedOptions[0]?.textContent,rangeDisabled:$('#rangeSel').disabled,conductDisabled:$('#btnConduct').disabled,summary:$('#listeningSummary').textContent,engineVenue:E.venueId};
 report.readings=PIECE_IDS.map(id=>({id,level:pieceDifficulty(id),load:readingLoad(id),average:readAvg(S,id)}));
 const stageCanvas=$('#stage'),stageBox=stageCanvas.getBoundingClientRect(),stageMap=stageGeom(Math.max(240,stageBox.width),true);
 report.stageSeats=SEATS.map(s=>({id:s.id,point:seatXY(s,stageMap),member:S.members.find(m=>m.seat===s.id)?.id}));
 const watchBox=$('#cdStage').getBoundingClientRect(),watchMap=stageGeom(Math.max(240,watchBox.width),true);
 report.watchSeats=SEATS.map(s=>({id:s.id,point:seatXY(s,watchMap),member:CD.stageMembers?.get(s.id)?.id||null}));
 report.gradIndex=GR.i;report.gradAuto=Boolean(GR.timer);
 report.gradMotion=$('#gradRoll').dataset.motion;report.reducedMotion=fxCalm();
 report.graduateIds=GR.ids;report.gradOpen=!$('#gradRoll').hidden;
 const graduates=S.phase==='end'?S.members.filter(m=>m.grade===3):(S.gradMembers||[]);
 report.graduates=graduates.map(m=>({id:m.id,name:m.name,face:Faces.fingerprint(m),ranks:Object.fromEntries(STAT_KEYS.map(k=>[k,rankOf(m.stats[k])])),first:m.first?Object.fromEntries(STAT_KEYS.map(k=>[k,rankOf(m.first.stats[k])])):null}));
 report.gradShown=$('#grCard .gr-person [data-face]')?.dataset.face;
 report.seniorOpen=Array.from(document.querySelectorAll('.senior-list>.senior[open]')).map(el=>el.dataset.senior);
 const source=S.log.slice().reverse().slice(0,80).map(e=>e.text).sort(),shown=Array.from(document.querySelectorAll('.log-preview,.log-notes>li>span:last-child')).map(e=>e.textContent).sort();
 report.logSourceCount=source.length;report.logRenderedCount=shown.length;report.logPreserved=JSON.stringify(source)===JSON.stringify(shown);
 report.planOwn={...(S.plan||{})};report.policy=S.policy;report.week=S.week;report.statsFingerprint=hash(JSON.stringify(S.members.map(m=>m.stats)));
 report.memberFingerprint=hash(JSON.stringify(S.members));
 const outing=outingView(S);report.outing=outing?{id:S.outing.id,n:outing.n,fit:[...outing.fit],selected:[...U.outPick],more:!!U.outMore,eligible:seated(S).map(m=>m.id),buttons:[...document.querySelectorAll('#week [data-op]')].map(el=>({id:el.dataset.op,pressed:el.getAttribute('aria-pressed'),disabled:el.disabled,face:el.querySelector('[data-face]')?.dataset.face})),confirm:$('#week [data-act="outing"]')?.textContent}:null;
 report.outingResult={last:S.lastOuting,faces:[...document.querySelectorAll('[data-out-result]')].map(el=>({id:el.dataset.outResult,name:el.title})),gains:[...document.querySelectorAll('.outing-gains .gain')].map(el=>el.textContent),gainsOpen:!!$('.outing-gains')?.open,log:hash(JSON.stringify(S.outLog||[])),coach:S.coach};
 if(outing&&U.outPick.size&&q.has('outingAudit')){const expected=resolveOuting(S,[...U.outPick]);report.expectedOuting={members:hash(JSON.stringify(expected.members)),last:expected.lastOuting,log:hash(JSON.stringify(expected.outLog||[])),coach:expected.coach};}
 const diagBox=$('#diagPractice');report.diagPractice={visible:!diagBox.hidden,open:diagBox.open,topic:U.diagPractice?.topic,key:U.diagPractice?.key,back:U.diagReturn,diagnosis:hash(JSON.stringify(U.diag)),pid:diagBox.dataset.piece,selectedPiece:playPiece(),tab:U.tab,rows:[...diagBox.querySelectorAll('[data-diag-member]')].map(el=>({id:el.dataset.diagMember,label:el.getAttribute('aria-label'),rank:el.querySelector('.rk')?.textContent,face:el.querySelector('[data-face]')?.dataset.face})),source:S.members.map(m=>({id:m.id,name:m.name,seat:m.seat,out:!!m.out,stats:m.stats,reading:readMean(m,playPiece())})),menus:[...document.querySelectorAll('#week .pgrid [data-menu]')].map(el=>({id:el.dataset.menu,pressed:el.getAttribute('aria-pressed')}))};
 report.practice={pick:U.pick,from:U.pickReturn,open:[...document.querySelectorAll('#week details[data-sec][open]')].map(el=>el.dataset.sec),tired:S.members.filter(m=>m.sta<30).map(m=>({id:m.id,name:m.name,menu:planFor(S,m),face:Faces.fingerprint(m)})),growth:[...document.querySelectorAll('.wr-person')].map(el=>({id:el.dataset.practiceMember,face:el.querySelector('[data-face]')?.dataset.face,name:el.querySelector('b')?.textContent,ranks:el.querySelector('.wr-ranks')?.getAttribute('aria-label'),interactive:el.tagName==='BUTTON'})),before:U.weekRes?.b.stats,members:S.members.map(m=>({id:m.id,name:m.name,stats:m.stats})),resultKey:U.weekRes?.key};
 if(q.has('practiceEscapeAudit'))report.practiceEscape={state:hash(JSON.stringify(S)),pick:U.pick,from:U.pickReturn,prep:U.prepPanel,outing:[...(U.outPick||[])],tip:!$('#tip').hidden,focus:document.activeElement.id||document.activeElement.dataset.pick||document.activeElement.dataset.practiceMember||document.activeElement.className,menu:[...document.querySelectorAll('#week .pgrid button')].map(b=>({value:b.dataset.menu,pressed:b.getAttribute('aria-pressed'),rect:b.getBoundingClientRect().toJSON()}))};
 report.assignPicks={...(U.asg?.picks||{})};report.assignSel=U.asg?.sel;
 report.auditionOut=[...(U.draft||[])];report.auditionDecided=!!S.audition?.decided;
 report.auditionSearching=!!U.audSearching;report.auditionPrediction=U.pred?.avg;report.auditionSound=U.pred?.sound;report.auditionScores=hash(JSON.stringify(S.audition?.scores));
 report.auditionComparison=$('[data-comparison]')?Number($('[data-comparison]').dataset.comparison):null;report.auditionAllPrediction=U.predAll?.avg;
 report.auditionSignals=Array.from(document.querySelectorAll('[data-sound]')).map(e=>({key:e.dataset.sound,label:e.getAttribute('aria-label'),lights:e.querySelectorAll('.on').length,change:e.querySelector('[data-sound-change]')?.dataset.soundChange}));
 report.auditionMembers=S.members.filter(m=>m.seat).map(m=>({id:m.id,name:m.name,out:!!m.out,rank:S.audition?rankOf(audScore(m).score):null}));
 report.auditionExpected=S.audition?seated(S).filter(m=>!(U.draft||new Set()).has(m.id)).map(m=>m.id):[];
 const audListening=auditionListening();
 report.auditionListening=audListening?{kind:audListening.kind,mid:audListening.mid,members:STAGE_PERFORMERS.get(audListening.perf)?.members.map(m=>m.id),sameState:audListening.state===S}:null;
 report.auditionPlayButtons=Array.from(document.querySelectorAll('[data-aud="listen"],[data-aud="listenall"],[data-audplay]')).map(el=>({kind:el.dataset.aud||'member',id:el.dataset.audplay,pressed:el.getAttribute('aria-pressed'),disabled:el.disabled,label:el.getAttribute('aria-label')}));
 const selected=U.sel&&S.members.find(m=>m.id===U.sel);
 report.selectedMember=selected?{id:selected.id,name:selected.name,originalName:selected.originalName,face:Faces.fingerprint(selected)}:null;
 const move=selectedMemberMove();
 const movePeople=state=>state.members.map(m=>({id:m.id,seat:m.seat,ranks:Object.fromEntries(STAT_KEYS.map(k=>[k,rankOf(m.stats[k])])),face:Faces.fingerprint(m)}));
 const cardBox=$('#memberCard').getBoundingClientRect();
 const memberPosition=selector=>{const el=$('#memberCard '+selector);if(!el)return null;const r=el.getBoundingClientRect();return {top:r.top-cardBox.top,height:r.height,visible:r.height>0};};
 report.memberLayout={height:cardBox.height,audio:memberPosition('.mc-actions'),move:memberPosition('.mc-move>summary'),current:memberPosition('.mc-current'),history:memberPosition('.mc-growth-history'),ranks:Array.from(document.querySelectorAll('#memberCard .mc-current-grid>[aria-label]')).map(el=>el.getAttribute('aria-label')),historyOpen:!!$('#memberCard .mc-growth-history')?.open,audioButtons:Array.from(document.querySelectorAll('#memberCard .mc-actions>[aria-pressed]')).map(el=>({action:el.dataset.mact,pressed:el.getAttribute('aria-pressed')}))};
 report.moveUndo={available:canUndoMemberMove(),visible:!!$('#memberCard [data-mact="moveundo"]'),saved:!!U.moveUndo,before:U.moveUndo?hash(JSON.stringify(U.moveUndo.before)):null};
 report.move={value:$('#memberCard .mc-move')?.dataset.moveTo,enabled:!!$('#memberCard [data-mact="move"]')&&!$('#memberCard [data-mact="move"]').disabled,label:$('#memberCard [data-mact="move"]')?.textContent,state:hash(JSON.stringify(S)),people:movePeople(S),expected:move?movePeople(move.next):null};
 report.assignOpen=Array.from(U.asg?.openParts||[]);
 report.recruits=(S.recruits||[]).map(r=>({id:r.id,name:r.name,hope:r.hope,exp:!!r.exp,talent:!!r.talent}));
 report.memberSeats=S.members.map(m=>({id:m.id,name:m.name,seat:m.seat,hope:m.hope}));
 report.roster={filter:{...rosterFilter()},picker:!!U.rosterPick,count:$('#rosterCount').textContent,rows:[...document.querySelectorAll('#rosterTable tr[data-mid]')].map(el=>({id:el.dataset.mid,name:el.querySelector('b')?.textContent})),members:S.members.map(m=>({id:m.id,name:m.name,grade:m.grade,sec:m.seat?SEAT[m.seat].sec:'bench',face:Faces.fingerprint(m)})),partsOpen:$('#rosterParts').open};
 const prep=stagePreparation();report.preparation=prep?{weeks:prep.w,event:prep.ev.title,contest:prep.contest,day:prep.onDay,members:prep.members.map(m=>m.id),songs:prep.songs,tired:prep.tired.map(m=>m.id),fatigue:prep.fatigue,panel:U.prepPanel,visible:!!$('#week .preparation'),rows:[...document.querySelectorAll('#prepBody [data-face]')].map(el=>el.dataset.face)}:null;
 report.prepSource=S.members.map(m=>({id:m.id,name:m.name,seat:m.seat,out:!!m.out,sta:m.sta,read:S.pieceId?readMean(m,S.pieceId):null,setRead:S.setPiece?readMean(m,S.setPiece):null}));
 report.wings={actions:wingActions(S),calm:S.stageDay?.calm,huddle:!!S.stageDay?.huddle,tense:tenseMembers(S).map(m=>m.id)};
 report.stageCasts=S.recs.filter(r=>r.year===S.year&&(r.result||S.pending?.recId===r.id||S.pending?.setRecId===r.id)).map(r=>({id:r.id,piece:r.pieceId,fatigue:r.snap.fatigue,members:r.snap.members.map(m=>m.id)}));
 if(U.asg){
  report.autoPicks=autoAssign(S);report.occupiedSeats=S.members.map(m=>m.seat).filter(Boolean);
  report.assignExpected=assignRecruits(S,U.asg.picks).members.map(m=>({id:m.id,name:m.name,seat:m.seat,hope:m.hope}));
 }
 let out=$('#qaResult');if(!out){out=document.createElement('output');out.id='qaResult';out.hidden=true;document.body.append(out);}out.dataset.audioSettled=String(!!(SAMPLES.ready||SAMPLES.error));out.dataset.audioReady=String(SAMPLES.ready);out.textContent=JSON.stringify(report);
}
async function show(next){
 view=next;report={view,errors:[],steps:0};
 U.asg=null;U.weekRes=null;U.pick=null;U.pickReturn=null;U.rosterAt=null;U.prepKey=null;U.outKey='';U.outResult=null;$('#rosterParts').open=false;
 stopPlay();if(releaseSamples){releaseSamples();releaseSamples=null;}U.range='all';U.solo='all';U.view='mel';U.piece=null;U.venue='room';E.setSolo({type:'all'});E.setVenue('room');
 for(const id of ['rollPanel','listenSettings','recordingPanel'])$('#'+id).open=false;
 clearTimeout(GR.timer);clearTimeout(AN.timer);cancelAnimationFrame(CD.raf);CD.phase='idle';
 for(const id of ['conduct','gradRoll','announce','fx'])$('#'+id).hidden=true;
 document.documentElement.classList.remove('conducting');
 cdDialogRelease();CD.focusToken={};anDialogRelease();AN.focusToken={};
 let s;
 if(view==='balanced-result'||view==='first-year'||view==='first-summary'){
  const random=Math.random;let seed=20261027;
  Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  try{s=freshState(2026);}finally{Math.random=random;}
 }else s=freshState(2026);
 if(!['intake','talent','first-year','flute-cast'].includes(view)){s=assignRecruits(s,autoAssign(s));if(!['song-choice','song-samples'].includes(view))s=choosePiece(s,view==='reading-year-hard'?'tell':'galop');}
 if(view==='flute-cast'){
  s.recruits=null;s.seq=0;s.recruitSeed=20261027;s.log=[];
  s.recruits=makeRecruits(s,39);s=assignRecruits(s,autoAssign(s));s=choosePiece(s,'pomp');
 }
 if(view==='talent'){s.recruitSeed=12345;s.seq=0;s.rep=90;s.recruits=null;const rs=makeRecruits(s,40);s.recruits=[...rs.filter(r=>r.talent).slice(0,1),...rs.filter(r=>!r.talent).slice(0,7)];}
 if(view==='intake-existing'||view==='intake-full'){
  s.members=fullBand({pitch:55,rhythm:60,tone:50,expr:48}).slice(0,view==='intake-full'?39:32);s.year=2028;s.week=10;
  s.recruitSeed=12345;s.seq=100;s.recruits=makeRecruits(s,8);s.recruitWhen=s.week;
 }
 if(view==='first-summary'){
  while(s.phase!=='end'&&report.steps++<400)s=advance(s);
  if(s.phase!=='end')throw Error('年度の終わりまで進まなかった');
  s=startWinter(s);s=chooseWinterPlan(s,Object.keys(WINTER_PLANS)[0]);s=runEnsemble(s,autoEnsemble(s));s=winterNext(s);s.winter.gradDone=true;
 }
 if(view==='balanced-result'){
  while(!(s.year===2028&&s.week===PREF_WEEK&&s.pending?.kind==='contest')&&report.steps++<400){s=advance(s);await new Promise(r=>setTimeout(r,0));}
  if(s.year!==2028||s.week!==PREF_WEEK||!s.pending?.judge)throw Error('3年目の県大会まで進まなかった');
  report.year=s.year;report.actualJudge=s.pending.judge;report.division=s.division;
 }else if(['year','journal','renamed-year','reading-year-hard'].includes(view)){
  if(view==='renamed-year'){s=renameMember(s,s.members[0].id,'山田 花音');report.renamedBefore={id:s.members[0].id,name:s.members[0].name,face:Faces.fingerprint(s.members[0])};}
  const start=s.year;
  while(s.year===start&&report.steps++<160){s=advance(s);S=s;renderAll();await new Promise(r=>setTimeout(r,0));}
  if(s.year!==start+1)throw Error('新年度まで進まなかった');
  report.year=s.year;report.members=s.members.length;report.saveVersion=s.v;
  if(report.renamedBefore){const m=s.members.find(m=>m.id===report.renamedBefore.id);report.renamedAfter=m?{id:m.id,name:m.name,face:Faces.fingerprint(m)}:null;}
 }else if(['consult','consult-result'].includes(view)){
  for(let i=0;i<100&&!s.consult;i++)s=advance(s);
  if(!s.consult)throw Error('相談の見本が作れなかった');
  if(view==='consult-result')s=resolveConsult(s,consultView(s).choices[0].k);
 }else if(['retirement-listen','consult-music','winter-music','outing-music','diag-practice','stage','recorded-history','record-library','reading-stage','song-set','song-final','rehearsal','rehearsal-records','rehearsal-a','rehearsal-loading','practice','practice-late','practice-a','practice-care','practice-growth','members','member','member-old','member-bench','grad','grad-old','grad-auto','senior','conduct','announce','announce-silver','announce-bronze','announce-cast','fx','audition','audition-a','audition-decided','audition-long','ensemble'].includes(view)||view.startsWith('prep-')){
  const ms=fullBand({pitch:68,rhythm:72,tone:64,expr:61}),names=new Set();
  ms.forEach((m,i)=>{m.id='m2028-n'+(i+1)+'-cafe';m.name=makeName(names,'recruit',2028,i+1);m.grade=i%3+1;m.joined=2026;m.joinGrade=1;m.sta=95;m.first={y:2026,w:0,stats:{pitch:15,rhythm:12,tone:18,expr:10}};m.story=[{y:2026,w:0,t:'アルトサックスで入部。'},{y:2027,w:16,t:'はじめての金賞。'},{y:2028,w:26,t:'最後の定期演奏会。'}];});
  s.members=ms;s.year=2028;s.week=10;
 }
 if(view==='consult-music'){s.cohesion=39;s.consult={id:'atmos',mid:s.members.find(m=>m.grade===2).id};}
 if(view==='winter-music'){s.week=26;s=startWinter(s);}
 if(view==='retirement-listen'){
  if(q.has('manyGrads'))s.members.forEach(m=>m.grade=3);
  if(q.has('oldGrads'))s.members.filter(m=>m.grade===3).forEach(m=>{delete m.first;});
  if(q.has('longGrads'))s=renameMember(s,s.members.find(m=>m.grade===3).id,'あいうえおかきくけこさし');
  if(q.has('benchGrad'))s.members.find(m=>m.grade===3).seat=null;
  const early=clone(s);early.year=2026;early.week=0;early.recs=[];
  early.members.forEach(m=>{m.grade=1;m.stats={pitch:15,rhythm:12,tone:18,expr:10};m.fam={galop:0};});
  addRec(early,'2026年4月の録音',{venue:'room'}).keep=true;
  s.recs=clone(early.recs);s.week=26;
  addRec(s,'2028年 定期演奏会',{venue:'hall'}).final=true;s=endSeason(s);
 }
 if(view==='diag-practice'){
  s.week=8;s.consult=null;s.episode=null;s.outing=null;
  s.members.forEach((m,i)=>{m.stats={pitch:15+i*7%70,rhythm:20+(i+3)*11%65,tone:25+(i+5)*9%60,expr:20+(i+7)*13%65};m.sta=95;m.fam={galop:[i*2.5,i*2.5,i*2.5],ode:[100-i*2.5,100-i*2.5,100-i*2.5]};});
  s.members.at(-1).seat=null;s.members.at(-1).stats={pitch:0,rhythm:0,tone:0,expr:0};s.members[1].out=true;
  if(q.has('two')){s.division='A';s.setPiece='ode';}
  if(q.has('diagHigh'))s.members.forEach(m=>m.fam.galop=[90,90,90]);
  if(q.has('diagLong'))s=renameMember(s,s.members[0].id,'あいうえおかきくけこさし');
  if(q.has('diagOne'))s.members=s.members.slice(0,1);
  if(q.has('diagEmpty'))s.members.forEach(m=>m.seat=null);
 }
 if(view==='outing-music'){
  s.week=8;s.episode=null;s.consult=null;s.outing={id:OUTING_BY[q.get('kind')]?q.get('kind'):'orch'};U.outPick=new Set();
  if(q.has('outBench'))s.members.at(-1).seat=null;
  if(q.has('outOne'))s.members=s.members.slice(0,1);
  if(q.has('outEmpty'))s.members.forEach(m=>m.seat=null);
  if(q.has('outLong'))s=renameMember(s,s.members[0].id,'あいうえおかきくけこさし');
  if(q.has('outDot'))s=renameMember(s,s.members[0].id,'田中・七海');
  if(q.has('outDuplicate'))s.members[1].name=s.members[0].name;
  if(q.has('outOldResult')){s=resolveOuting(s,seated(s).slice(0,3).map(m=>m.id));U.outResult=null;}
 }
 if(view==='ensemble'){s.members.forEach((m,i)=>m.grade=i%2+1);s.phase='winter';s.winter={step:1,plan:'kiso'};U.ensKey=null;U.ensPick=null;}
 if(view==='ensemble'&&q.has('watchSnapshot'))s.members.forEach(m=>{m.stats.pitch=39.7;m.stats.tone=49.7;m.mental=39;});
 if(view==='ensemble'&&q.has('ensembleDifferent'))s.contestPiece='ode';
 if(view==='ensemble'&&q.has('ensLong'))s=renameMember(s,s.members[0].id,'あいうえおかきくけこさし');
 if(view==='practice-late'){s.week=15;s.members[0].sta=20;}
 if(view.startsWith('prep-')){
  s.week=view==='prep-week'?PREF_WEEK-2:view==='prep-concert'?11:PREF_WEEK;s.phase='week';s.consult=null;s.outing=null;s.episode=null;
  s.members.forEach((m,i)=>{m.fam={galop:[i<4?0:i%4===0?35:85,80,80],ode:[i<4?0:i%5===0?20:65,65,65]};m.sta=i<4||[5,9,38].includes(i)?20:95;m.mental=30;});
  s.members.at(-1).seat=null;s=runAudition(s);s=setLineup(s,new Set(s.members.slice(0,4).map(m=>m.id)));syncSta(s);
  if(view==='prep-a'||q.has('two')){s.division='A';s.setPiece='ode';}
  if(view==='prep-empty')s.members.forEach(m=>m.out=true);
  if(q.has('outsideTired')){s.members.forEach((m,i)=>{m.sta=i===4?95:0;m.out=i!==4;});syncSta(s);}
  if(view!=='prep-week'){s.stageDay={seed:1,calm:[]};for(let seed=1;seed<100&&tenseMembers(s).length<3;seed++)s.stageDay.seed=seed;}
  if(view==='prep-old')delete s.stageDay;
 }
 if(view==='practice-care'){
  s.week=8;s.members[0].sta=20;s.members.at(-1).sta=25;
  s.plan={[s.members[0].id]:'tune'};
  if(q.has('manyTired'))s.members.forEach(m=>m.sta=20);
  if(q.has('longTired'))s=renameMember(s,s.members.at(-1).id,'あいうえおかきくけこさし');
  if(q.has('benchTired'))s.members.at(-1).seat=null;
 }
 if(view==='practice-growth'){
  s.week=8;s.plan=Object.fromEntries(s.members.map(m=>[m.id,'rest']));
  s.members.slice(0,3).forEach((m,i)=>{m.stats=q.has('sameRank')?{pitch:72,rhythm:72,tone:72,expr:72}:{pitch:39.7,rhythm:49.7,tone:59.7,expr:40};s.plan[m.id]=['tune','metro','long'][i];});
 }
 if(view==='practice-a'){s.division='A';s.setPiece=setOffer(s)[0];s.split='auto';}
 if(view==='reading-stage')s.pieceId='tell';
 if(view==='recorded-history'||view==='record-library'){
  s.recs=[];const old=clone(s);old.year=2026;old.week=26;old.cohesion=80;
  old.members.forEach((m,i)=>{if(i)m.id='m2026-n'+(i+1)+'-f00d';m.grade=3;m.stats={pitch:80,rhythm:80,tone:80,expr:80};m.fam={galop:100};});
  if(q.has('different')){old.pieceId='largo';old.members.forEach(m=>m.fam={galop:100,largo:100,ode:100});}
  addRec(old,'2026年 定期演奏会',{venue:'hall'});
  if(q.has('different')){if(!q.has('fullRecord'))old.recs.at(-1).span={from:PIECES.largo.spans[0].from,to:PIECES.largo.spans[0].to};old.pieceId='ode';}
  if(q.has('short'))old.recs.at(-1).span={from:0,to:.25};
  if(q.has('shortStop'))old.recs.at(-1).span={from:0,to:8};
  old.year=2027;old.members[0].name='田中 葵';old.members[0].stats={pitch:55,rhythm:55,tone:55,expr:55};addRec(old,'2027年 定期演奏会',{venue:'hall'});
  s.recs=clone(old.recs);s.year=2031;s.gradMembers=[];
  s=renameMember(s,s.members[0].id,'田中 花音');const other=s.members.find(m=>m.seat==='perc2');other.seat='picc1';s.members[0].seat='perc2';
  if(q.has('a')){s.division='A';s.setPiece='ode';}
  if(view==='record-library'){
   if(q.has('many')){const originals=clone(s.recs);s.recs=Array.from({length:68},(_,i)=>{const r=clone(originals[i%2]),year=2023+Math.floor(i/8);return {...r,id:'library-'+i,year,label:year+'年 '+(i%2?'定期演奏会':'合奏の録音')};});}
   if(q.has('sameLabel'))s.recs.forEach(r=>{r.label='2027年 合奏の録音';r.year=2027;r.pieceId='galop';});
   if(q.has('longRecord'))s.recs.at(-1).label='2027年 定期演奏会・先輩たちの最後の本番をもう一度聴く';
   if(q.has('shortRecord'))s.recs.forEach(r=>r.span={from:0,to:.25});
   if(q.has('oneRecord'))s.recs=s.recs.slice(0,1);
   if(q.has('noRecord'))s.recs=[];
   if(q.has('recordedDynamics'))s.recs.forEach(r=>{r.conduct={ev:[{b:0,t:0,P:60/bpmAt(PIECES[r.pieceId],1,0),jolt:0}],lv:Array.from({length:120},(_,i)=>[i*.5,i%2?.5:1.45]),taps:[]};});
  }
 }
 if(view==='song-set'){s.division='A';s.phase='chooseSet';}
 if(view==='song-final'){if(q.has('young'))s.members.forEach(m=>m.grade=1);s=startAutumn(s);s.chooseFinal=true;s.contestPiece='galop';for(const m of s.members)m.fam={galop:[65,65,65]};}
 if(view.startsWith('rehearsal')){
  s.recs=[];
  if(view==='rehearsal-records'){s.week=0;addRec(s,'2028年 4月の合奏',{venue:'room'});s.week=10;addRec(s,'2028年 6月の合奏',{venue:'hall'});}
  if(view==='rehearsal-a'){s.division='A';s.setPiece=setOffer(s)[0];s.split='auto';}
 }
 if(view.startsWith('audition')){
  if(view==='audition-a'){s.division='A';s.setPiece='tell';}
  if(view==='audition-small')s.members=s.members.slice(0,5);
  s.members.forEach((m,i)=>{m.stats={pitch:i<8?20:78,rhythm:i<8?20:78,tone:i<8?20:78,expr:70};m.fam={galop:100};});
  s=runAudition(s);
  if(view==='audition-decided')s=setLineup(s,new Set(s.members.slice(0,8).map(m=>m.id)));
  if(view==='audition-long')s=renameMember(s,s.members[0].id,'あいうえおかきくけこさし');
  if(q.has('audit')){report.expectedRecommendedOut=[...recommendLineup(s)];report.expectedAllPrediction=predictContest(s,new Set()).avg;}
  U.lineup=true;U.draft=null;
 }else U.lineup=false;
 if(!['year','renamed-year','reading-year-hard'].includes(view)){checkAch(s,true);for(const key of ['skillUp','coachUp','mileUp','loveUp','dreamUp','rivalUp'])delete s[key];}
 if(view==='member-old')delete s.members[0].first;
 if(view==='member-bench')s.members[0].seat=null;
 if(q.has('longMove')&&view.startsWith('member'))s=renameMember(s,s.members[1].id,'あいうえおかきくけこさし');
 if(view==='members'){
  if(q.has('rosterBench'))s.members.at(-1).seat=null;
  if(q.has('rosterNames')){s=renameMember(s,s.members[0].id,'さとう はる');s=renameMember(s,s.members[1].id,'Ａｋｉ　あおい');}
  if(q.has('rosterEmpty'))s.members=[];
 }
 if(view==='journal-ambiguous'){s.members=[...s.members,{...s.members[0],id:'different-person'}];s.log=[{y:s.year,w:0,text:s.members[0].name+'が、スキルを身につけた。'}];}
 if(view==='journal-empty')s.log=[];
 if(view==='grad-old')s.members.forEach(m=>{delete m.first;m.story=[];});
 if(q.has('concertrec')&&view.startsWith('grad')){const fin=addRec(s,'2028年 定期演奏会',{venue:'hall',pieceId:'largo'});fin.final=true;report.beforeConcertVenue=U.venue;}
 if(q.has('busy')&&view.startsWith('member')){s.week=PREF_WEEK;s=beginStage(s);}
 if(q.has('hallCarry'))s.hallExp=72;
 if(view==='conduct'&&q.has('longWatch'))s=renameMember(s,s.members[0].id,'あいうえおかきくけこさし');
 if(PIECES[q.get('audioPiece')])s.pieceId=q.get('audioPiece');
 if(q.has('audioRange')&&(q.get('audioRange')==='all'||PIECES[s.pieceId]?.spans[Number(q.get('audioRange'))]))U.range=q.get('audioRange');
 if(['full','short','off'].includes(q.get('cueFx')))U.fxMode=q.get('cueFx');
 S=s;U.sel=null;hideTip();renderAll();refreshNow();$('#toast').hidden=true;
 const cardView=view==='member'||view.startsWith('member-');
 setTab(['log','journal','journal-ambiguous','journal-empty'].includes(view)?'log':['members','flute-cast'].includes(view)?'members':cardView||view==='diag-practice'||view.startsWith('rehearsal')||['stage','recorded-history','record-library','reading-stage','conduct'].includes(view)?'play':'week');
 if(view==='song-samples')for(const card of document.querySelectorAll('.pcard'))card.hidden=!['largo','galop','tell'].includes(card.querySelector('[data-pid]')?.dataset.pid);
 if(cardView){placeCard('stage');U.sel=s.members[0].id;renderMemberCard();}
 if(['grad','grad-old','grad-auto'].includes(view)){U.fxMode=view==='grad-auto'?'short':'off';S.gradMembers=s.members.filter(m=>m.grade===3);openGradRoll();GR.i=1;grShow();if(view!=='grad-auto')pauseGradRoll();}
 if(view==='senior'){$('#week').innerHTML='<div class="seniors"><div class="senior-list">'+s.members.filter(m=>m.grade===3).map(m=>seniorCard(m,null)).join('')+'</div></div>';}
 if(view==='conduct'){const perf=perform(currentCtx());openWatch(perf,'定期演奏会');drawStage(-1,$('#cdStage'),CD.who);}
 if(view==='announce'||view.startsWith('announce-')){
  if(view==='announce-cast'){const rec=addRec(S,'確認用の本番',{only:S.members.slice(12,15).map(m=>m.id)});S.pending={recId:rec.id};report.castIds=rec.snap.members.map(m=>m.id);}
  const award=view==='announce-silver'?'silver':view==='announce-bronze'?'bronze':'gold';
  showAnnounce({award,rep:award==='gold',avg:85},'pref',()=>{report.announceClosed=(report.announceClosed||0)+1;record();},view==='announce-bronze'?'B':'A');if(!q.has('animateAnnounce'))AN.skip();
 }
 if(view==='balanced-result'){reveal();AN.skip();}
 if(view==='fx'){U.fxMode=q.get('fx')||'short';fxShow({kind:'cut',html:fxCutHtml('実績を達成','はじめての金賞','',''),ms:60000});clearTimeout(FX.timer);}
 if(view==='rehearsal-loading'||q.has('loading')){
  await SAMPLES.loading?.catch(()=>{});const original=SAMPLES.loading,originalError=SAMPLES.error,originalReady=SAMPLES.ready;
  report.fixtureAudioFallback=!!originalError;SAMPLES.ready=false;SAMPLES.error=null;
  SAMPLES.loading=new Promise(resolve=>{releaseSamples=()=>{SAMPLES.ready=originalReady;SAMPLES.error=originalError;SAMPLES.loading=original;resolve();};});
 }
 await document.fonts.ready;await new Promise(r=>setTimeout(r,80));
 if(cardView)$('#memberCard').scrollIntoView({block:'start'});
 else if(view==='consult')$('.episode.consult').scrollIntoView({block:'center'});
 else if(view.startsWith('song-'))$('.pcard')?.scrollIntoView({block:'start'});
 else window.scrollTo(0,0);
 record();console.log('画面確認',report);
}
await show(view);
document.addEventListener('bootchecked',record);
if(q.has('focusAudit')||q.has('watchCardAudit'))document.addEventListener('focusin',()=>setTimeout(record,0));
if(q.has('pieceAudit'))$('#week').addEventListener('click',e=>{
 const b=e.target.closest('[data-act][data-pid]'),fn=b&&({choose:choosePiece,chooseset:chooseSetPiece,choosefinal:chooseFinalPiece})[b.dataset.act];
 if(fn)report.expectedChoice={pid:b.dataset.pid,act:b.dataset.act,state:hash(JSON.stringify(fn(S,b.dataset.pid)))};
},true);
window.addEventListener('resize',()=>setTimeout(record,0));
document.addEventListener('facesready',()=>setTimeout(record,0));
for(const event of ['pointerdown','toggle','click','keydown','scroll'])$('#grCard').addEventListener(event,()=>setTimeout(record,0),{capture:true});
$('#grNext').addEventListener('click',()=>setTimeout(record,0));$('#grPrev').addEventListener('click',()=>setTimeout(record,0));
for(const event of ['click','keydown','change'])$('#week').addEventListener(event,()=>setTimeout(record,0));
$('#week').addEventListener('toggle',()=>setTimeout(record,0),true);
new MutationObserver(()=>setTimeout(record,0)).observe($('#week'),{childList:true,subtree:true});
new MutationObserver(()=>setTimeout(record,0)).observe($('#grCard'),{childList:true,subtree:true});
new MutationObserver(()=>setTimeout(record,0)).observe($('#nowPlaying'),{childList:true,subtree:true});
for(const event of ['click','submit','change','keydown','input'])$('#memberCard').addEventListener(event,()=>setTimeout(record,0));
$('#rosterTable').addEventListener('click',()=>setTimeout(record,0));
for(const event of ['click','keydown','toggle'])$('#diagPractice').addEventListener(event,()=>setTimeout(record,0));
for(const event of ['click','keydown'])$('#recordingList').addEventListener(event,()=>setTimeout(record,0));
new MutationObserver(()=>setTimeout(record,0)).observe($('#recordingList'),{childList:true,subtree:true,attributes:true,attributeFilter:['aria-pressed','disabled','data-active']});
for(const event of ['click','input','change','keydown','compositionend','submit'])$('#rosterFind').addEventListener(event,()=>setTimeout(record,0));
$('#rosterParts').addEventListener('toggle',()=>setTimeout(record,0));
$('#tabbar').addEventListener('click',()=>setTimeout(record,0));
$('#mini').addEventListener('click',()=>setTimeout(record,0));
for(const event of ['click','change','toggle'])$('.col-stage').addEventListener(event,()=>setTimeout(record,0),true);
for(const event of ['pointerdown','keydown','click'])$('#conduct').addEventListener(event,()=>setTimeout(record,0),true);
$('#sndStatus').addEventListener('click',e=>{if(e.target.closest('[data-sndretry]'))audioBeforeRetry=Object.entries(SAMPLES.banks);setTimeout(record,0);},true);
let audioReportT;new MutationObserver(()=>{clearTimeout(audioReportT);audioReportT=setTimeout(record,0);}).observe($('#sndStatus'),{childList:true,subtree:true,characterData:true});
// 一度読み込んだ実ゲームで切り替え、毎回録音素材を読み込み直さない。
if(q.has('keys'))document.addEventListener('keydown',async e=>{
 if(e.target.matches('input,select,textarea'))return;
 const key=e.key.toLowerCase();
 if(q.has('conductResultAudit')&&key==='h'){
  e.preventDefault();
  if(CD.phase==='done'&&!U.playing&&!U.waitPlay&&!releaseSamples){
   const original={ready:SAMPLES.ready,error:SAMPLES.error,loading:SAMPLES.loading};SAMPLES.ready=false;SAMPLES.error=null;
   SAMPLES.loading=new Promise(resolve=>{releaseSamples=()=>{Object.assign(SAMPLES,original);resolve();};});
  }
  record();return;
 }
 if(releaseLibraryExport&&key==='j'){e.preventDefault();const done=releaseLibraryExport;releaseLibraryExport=null;done();setTimeout(record,0);return;}
 if(releaseSamples&&key==='j'){e.preventDefault();releaseSamples();releaseSamples=null;report.loadingReleased=true;setTimeout(record,30);return;}
 if(key==='3'){e.preventDefault();await show('audition-decided');return;}
 if(key==='4'){e.preventDefault();await show('renamed-year');return;}
 if(key==='9'){e.preventDefault();await show('practice-a');return;}
 if(key==='1'||key==='2'){e.preventDefault();await show(key==='1'?'intake-existing':'intake-full');return;}
 if(key==='7'||key==='8'){e.preventDefault();await show(key==='7'?'practice':'practice-late');return;}
 if(key==='0'){e.preventDefault();renderLog();record();return;}
 if(key==='5'||key==='6'){e.preventDefault();await show(key==='5'?'journal-ambiguous':'journal-empty');return;}
 if(key==='d'){
  e.preventDefault();document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';drawIdle();if(!$('#conduct').hidden)drawStage(-1,$('#cdStage'),CD.who);record();
 }else if({g:'stage',c:'conduct',m:'member',r:'members',w:'week',n:'intake',s:'consult',a:'grad',y:'year',o:'audition',e:'talent',b:'ensemble',j:'member-new',h:'member-old',v:'member-bench',t:'grad-auto',u:'grad-old',l:'senior',k:'consult-result',z:'announce',x:'announce-silver',f:'announce-bronze',q:'journal',i:'announce-cast'}[key]){e.preventDefault();await show({g:'stage',c:'conduct',m:'member',r:'members',w:'week',n:'intake',s:'consult',a:'grad',y:'year',o:'audition',e:'talent',b:'ensemble',j:'member-new',h:'member-old',v:'member-bench',t:'grad-auto',u:'grad-old',l:'senior',k:'consult-result',z:'announce',x:'announce-silver',f:'announce-bronze',q:'journal',i:'announce-cast'}[key]);}
 else if(key==='p'){
  e.preventDefault();const perf=U.perfNow;U.ptr=buildPtr(perf);U.stageMembers=stageMembers(perf);const t=Math.min(4,perf.total/4);drawStage(t);if(!$('#conduct').hidden)drawStage(t,$('#cdStage'),CD.who);record();
 }
});
})().catch(e=>{console.error('画面確認に失敗',e);const out=document.createElement('output');out.id='qaResult';out.textContent=e.stack;document.body.append(out);});
