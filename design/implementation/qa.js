'use strict';
/* 実ゲームの確認用ページ。Gで合奏・Cで本番・Mで部員・Dでテーマを切り替える。製品には入れない。 */
(async()=>{
// 確認ページだけ保存先を使わず、操作や早送りで本物のセーブを書き換えない。
save=()=>{};load=()=>null;saveUI=()=>{};
if(document.readyState==='loading')await new Promise(r=>document.addEventListener('DOMContentLoaded',r,{once:true}));
const q=new URLSearchParams(location.search);let view=q.get('view')||'week';
document.documentElement.dataset.theme=q.get('theme')==='dark'?'dark':'light';
U.sfx=false;U.fxMode='off';FX.q=[];clearTimeout(FX.timer);FX.on=false;$('#fx').hidden=true;
let report,releaseSamples;
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
 report.theme=document.documentElement.dataset.theme;report.width=innerWidth;report.scrollWidth=document.documentElement.scrollWidth;
 report.faceCount=document.querySelectorAll('.member-face').length;
 report.stagePortraits=Number($('#stage').dataset.portraitCount||0);report.watchPortraits=Number($('#cdStage').dataset.portraitCount||0);
 report.stageCache=Faces.stageCacheSize();
 report.playing=U.playing;report.waiting=!!U.waitPlay;report.shownLabel=U.shownLabel;report.range=U.range;report.solo=U.solo;report.piece=playPiece();report.venue=U.venue;
 report.engineSolo=E.solo;report.viewPart=U.view;
 report.shownBounds=U.shown?{from:U.shown.from,to:U.shown.to}:null;report.preparedBounds=U.perfNow?{from:U.perfNow.from,to:U.perfNow.to}:null;
 report.shownPlayers=U.shown?Object.entries(buildPtr(U.shown)).map(([seat,p])=>({seat,id:p.mid})):[];
 report.recordsFingerprint=hash(JSON.stringify(S.recs));
 report.recordedCard=U.recordMember?{id:U.recordMember.id,name:U.recordMember.name,grade:U.recordMember.grade,seat:U.recordMember.seat,ranks:Object.fromEntries(STAT_KEYS.map(k=>[k,rankOf(U.recordMember.stats[k])]))}:null;
 report.recordedCast=U.stageMembers?Array.from(U.stageMembers,([seat,m])=>({seat,id:m.id,name:m.name,grade:m.grade,ranks:Object.fromEntries(STAT_KEYS.map(k=>[k,rankOf(m.stats[k])]))})):[];
 report.recordings=S.recs.map(r=>({id:r.id,label:r.label}));
 report.listening={shownPiece:U.shown?.pieceId,title:$('#piece').textContent,kind:$('#pieceEyebrow').textContent,range:$('#rangeSel').value,rangeLabel:$('#rangeSel').selectedOptions[0]?.textContent,rangeDisabled:$('#rangeSel').disabled,conductDisabled:$('#btnConduct').disabled,summary:$('#listeningSummary').textContent,engineVenue:E.venueId};
 report.readings=PIECE_IDS.map(id=>({id,level:pieceDifficulty(id),load:readingLoad(id),average:readAvg(S,id)}));
 const stageCanvas=$('#stage'),stageBox=stageCanvas.getBoundingClientRect(),stageMap=stageGeom(Math.max(240,stageBox.width),true);
 report.stageSeats=SEATS.map(s=>({id:s.id,point:seatXY(s,stageMap),member:S.members.find(m=>m.seat===s.id)?.id}));
 report.gradIndex=GR.i;report.gradAuto=Boolean(GR.timer);
 const source=S.log.slice().reverse().slice(0,80).map(e=>e.text).sort(),shown=Array.from(document.querySelectorAll('.log-preview,.log-notes>li>span:last-child')).map(e=>e.textContent).sort();
 report.logSourceCount=source.length;report.logRenderedCount=shown.length;report.logPreserved=JSON.stringify(source)===JSON.stringify(shown);
 report.planOwn={...(S.plan||{})};report.policy=S.policy;report.week=S.week;report.statsFingerprint=hash(JSON.stringify(S.members.map(m=>m.stats)));
 report.assignPicks={...(U.asg?.picks||{})};report.assignSel=U.asg?.sel;
 report.auditionOut=[...(U.draft||[])];report.auditionDecided=!!S.audition?.decided;
 report.auditionSearching=!!U.audSearching;report.auditionPrediction=U.pred?.avg;report.auditionSound=U.pred?.sound;report.auditionScores=hash(JSON.stringify(S.audition?.scores));
 report.auditionSignals=Array.from(document.querySelectorAll('[data-sound]')).map(e=>({key:e.dataset.sound,label:e.getAttribute('aria-label'),lights:e.querySelectorAll('.on').length}));
 report.auditionMembers=S.members.filter(m=>m.seat).map(m=>({id:m.id,name:m.name,out:!!m.out,rank:S.audition?rankOf(audScore(m).score):null}));
 report.auditionExpected=S.audition?seated(S).filter(m=>!(U.draft||new Set()).has(m.id)).map(m=>m.id):[];
 const selected=U.sel&&S.members.find(m=>m.id===U.sel);
 report.selectedMember=selected?{id:selected.id,name:selected.name,originalName:selected.originalName,face:Faces.fingerprint(selected)}:null;
 const move=selectedMemberMove();
 const movePeople=state=>state.members.map(m=>({id:m.id,seat:m.seat,ranks:Object.fromEntries(STAT_KEYS.map(k=>[k,rankOf(m.stats[k])])),face:Faces.fingerprint(m)}));
 const cardBox=$('#memberCard').getBoundingClientRect();
 const memberPosition=selector=>{const el=$('#memberCard '+selector);if(!el)return null;const r=el.getBoundingClientRect();return {top:r.top-cardBox.top,height:r.height,visible:r.height>0};};
 report.memberLayout={height:cardBox.height,audio:memberPosition('.mc-actions'),move:memberPosition('.mc-move>summary'),current:memberPosition('.mc-current'),history:memberPosition('.mc-growth-history'),ranks:Array.from(document.querySelectorAll('#memberCard .mc-current-grid>[aria-label]')).map(el=>el.getAttribute('aria-label')),historyOpen:!!$('#memberCard .mc-growth-history')?.open,audioButtons:Array.from(document.querySelectorAll('#memberCard .mc-actions>[aria-pressed]')).map(el=>({action:el.dataset.mact,pressed:el.getAttribute('aria-pressed')}))};
 report.moveUndo={available:canUndoMemberMove(),visible:!!$('#memberCard [data-mact="moveundo"]'),saved:!!U.moveUndo,before:U.moveUndo?hash(JSON.stringify(U.moveUndo.before)):null};
 report.move={value:$('#memberCard .mc-move')?.dataset.moveTo,enabled:!!$('#memberCard [data-mact="move"]')&&!$('#memberCard [data-mact="move"]').disabled,state:hash(JSON.stringify(S)),people:movePeople(S),expected:move?movePeople(move.next):null};
 report.assignOpen=Array.from(U.asg?.openParts||[]);
 report.recruits=(S.recruits||[]).map(r=>({id:r.id,name:r.name,hope:r.hope,exp:!!r.exp,talent:!!r.talent}));
 report.memberSeats=S.members.map(m=>({id:m.id,name:m.name,seat:m.seat,hope:m.hope}));
 if(U.asg){
  report.autoPicks=autoAssign(S);report.occupiedSeats=S.members.map(m=>m.seat).filter(Boolean);
  report.assignExpected=assignRecruits(S,U.asg.picks).members.map(m=>({id:m.id,name:m.name,seat:m.seat,hope:m.hope}));
 }
 let out=$('#qaResult');if(!out){out=document.createElement('output');out.id='qaResult';out.hidden=true;document.body.append(out);}out.textContent=JSON.stringify(report);
}
async function show(next){
 view=next;report={view,errors:[],steps:0};
 U.asg=null;
 stopPlay();if(releaseSamples){releaseSamples();releaseSamples=null;}U.range='all';U.solo='all';U.view='mel';U.piece=null;U.venue='room';E.setSolo({type:'all'});E.setVenue('room');
 for(const id of ['rollPanel','listenSettings','recordingPanel'])$('#'+id).open=false;
 clearTimeout(GR.timer);clearTimeout(AN.timer);cancelAnimationFrame(CD.raf);CD.phase='idle';
 for(const id of ['conduct','gradRoll','announce','fx'])$('#'+id).hidden=true;
 document.documentElement.classList.remove('conducting');
 let s;
 if(view==='balanced-result'){
  const random=Math.random;let seed=20261027;
  Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  try{s=freshState(2026);}finally{Math.random=random;}
 }else s=freshState(2026);
 if(!['intake','talent'].includes(view)){s=assignRecruits(s,autoAssign(s));if(!['song-choice','song-samples'].includes(view))s=choosePiece(s,view==='reading-year-hard'?'tell':'galop');}
 if(view==='talent'){s.recruitSeed=12345;s.seq=0;s.rep=90;s.recruits=null;const rs=makeRecruits(s,40);s.recruits=[...rs.filter(r=>r.talent).slice(0,1),...rs.filter(r=>!r.talent).slice(0,7)];}
 if(view==='intake-existing'||view==='intake-full'){
  s.members=fullBand({pitch:55,rhythm:60,tone:50,expr:48}).slice(0,view==='intake-full'?39:32);s.year=2028;s.week=10;
  s.recruitSeed=12345;s.seq=100;s.recruits=makeRecruits(s,8);s.recruitWhen=s.week;
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
 }else if(['stage','recorded-history','reading-stage','song-set','song-final','rehearsal','rehearsal-records','rehearsal-a','rehearsal-loading','practice','practice-late','practice-a','members','member','member-old','member-bench','grad','grad-old','grad-auto','senior','conduct','announce','announce-silver','announce-bronze','announce-cast','fx','audition','audition-a','audition-decided','audition-long','ensemble'].includes(view)){
  const ms=fullBand({pitch:68,rhythm:72,tone:64,expr:61}),names=new Set();
  ms.forEach((m,i)=>{m.id='m2028-n'+(i+1)+'-cafe';m.name=makeName(names,'recruit',2028,i+1);m.grade=i%3+1;m.joined=2026;m.joinGrade=1;m.sta=95;m.first={y:2026,w:0,stats:{pitch:15,rhythm:12,tone:18,expr:10}};m.story=[{y:2026,w:0,t:'アルトサックスで入部。'},{y:2027,w:16,t:'はじめての金賞。'},{y:2028,w:26,t:'最後の定期演奏会。'}];});
  s.members=ms;s.year=2028;s.week=10;
 }
 if(view==='ensemble'){s.members.forEach((m,i)=>m.grade=i%2+1);s.phase='winter';s.winter={step:1,plan:'kiso'};U.ensKey=null;U.ensPick=null;}
 if(view==='practice-late'){s.week=15;s.members[0].sta=20;}
 if(view==='practice-a'){s.division='A';s.setPiece=setOffer(s)[0];s.split='auto';}
 if(view==='reading-stage')s.pieceId='tell';
 if(view==='recorded-history'){
  s.recs=[];const old=clone(s);old.year=2026;old.week=26;old.cohesion=80;
  old.members.forEach((m,i)=>{if(i)m.id='m2026-n'+(i+1)+'-f00d';m.grade=3;m.stats={pitch:80,rhythm:80,tone:80,expr:80};m.fam={galop:100};});
  if(q.has('different')){old.pieceId='largo';old.members.forEach(m=>m.fam={galop:100,largo:100,ode:100});}
  addRec(old,'2026年 定期演奏会',{venue:'hall'});
  if(q.has('different')){old.recs.at(-1).span={from:PIECES.largo.spans[0].from,to:PIECES.largo.spans[0].to};old.pieceId='ode';}
  if(q.has('short'))old.recs.at(-1).span={from:0,to:.25};
  old.year=2027;old.members[0].name='田中 葵';old.members[0].stats={pitch:55,rhythm:55,tone:55,expr:55};addRec(old,'2027年 定期演奏会',{venue:'hall'});
  s.recs=clone(old.recs);s.year=2031;s.gradMembers=[];
  s=renameMember(s,s.members[0].id,'田中 花音');const other=s.members.find(m=>m.seat==='perc2');other.seat='picc1';s.members[0].seat='perc2';
  if(q.has('a')){s.division='A';s.setPiece='ode';}
 }
 if(view==='song-set'){s.division='A';s.phase='chooseSet';}
 if(view==='song-final'){s.chooseFinal=true;s.contestPiece='galop';for(const m of s.members)m.fam={galop:[65,65,65]};}
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
 if(view==='journal-ambiguous'){s.members=[...s.members,{...s.members[0],id:'different-person'}];s.log=[{y:s.year,w:0,text:s.members[0].name+'が、スキルを身につけた。'}];}
 if(view==='journal-empty')s.log=[];
 if(view==='grad-old')s.members.forEach(m=>{delete m.first;m.story=[];});
 if(q.has('concertrec')&&view.startsWith('grad')){const fin=addRec(s,'2028年 定期演奏会',{venue:'hall',pieceId:'largo'});fin.final=true;report.beforeConcertVenue=U.venue;}
 if(q.has('busy')&&view.startsWith('member')){s.week=PREF_WEEK;s=beginStage(s);}
 S=s;U.sel=null;hideTip();renderAll();refreshNow();$('#toast').hidden=true;
 const cardView=view==='member'||view.startsWith('member-');
 setTab(['log','journal','journal-ambiguous','journal-empty'].includes(view)?'log':view==='members'?'members':cardView||view.startsWith('rehearsal')||['stage','recorded-history','reading-stage','conduct'].includes(view)?'play':'week');
 if(view==='song-samples')for(const card of document.querySelectorAll('.pcard'))card.hidden=!['largo','galop','tell'].includes(card.querySelector('[data-pid]')?.dataset.pid);
 if(cardView){placeCard('stage');U.sel=s.members[0].id;renderMemberCard();}
 if(['grad','grad-old','grad-auto'].includes(view)){U.fxMode=view==='grad-auto'?'short':'off';S.gradMembers=s.members.filter(m=>m.grade===3);openGradRoll();GR.i=1;grShow();if(view!=='grad-auto')pauseGradRoll();}
 if(view==='senior'){$('#week').innerHTML='<div class="seniors">'+s.members.filter(m=>m.grade===3).map(m=>seniorCard(m,null)).join('')+'</div>';}
 if(view==='conduct'){const perf=perform(currentCtx());openWatch(perf,'定期演奏会');drawStage(-1,$('#cdStage'),CD.who);}
 if(view==='announce'||view.startsWith('announce-')){
  if(view==='announce-cast'){const rec=addRec(S,'確認用の本番',{only:S.members.slice(12,15).map(m=>m.id)});S.pending={recId:rec.id};report.castIds=rec.snap.members.map(m=>m.id);}
  const award=view==='announce-silver'?'silver':view==='announce-bronze'?'bronze':'gold';
  showAnnounce({award,rep:award==='gold',avg:85},'pref',()=>{},view==='announce-bronze'?'B':'A');AN.skip();
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
document.addEventListener('facesready',()=>setTimeout(record,0));
for(const event of ['pointerdown','toggle'])$('#grCard').addEventListener(event,()=>setTimeout(record,0),{capture:true});
$('#grNext').addEventListener('click',()=>setTimeout(record,0));$('#grPrev').addEventListener('click',()=>setTimeout(record,0));
for(const event of ['click','keydown','change'])$('#week').addEventListener(event,()=>setTimeout(record,0));
new MutationObserver(()=>setTimeout(record,0)).observe($('#week'),{childList:true,subtree:true});
new MutationObserver(()=>setTimeout(record,0)).observe($('#nowPlaying'),{childList:true,subtree:true});
for(const event of ['click','submit','change'])$('#memberCard').addEventListener(event,()=>setTimeout(record,0));
$('#rosterTable').addEventListener('click',()=>setTimeout(record,0));
for(const event of ['click','change','toggle'])$('.col-stage').addEventListener(event,()=>setTimeout(record,0),true);
// 一度読み込んだ実ゲームで切り替え、毎回録音素材を読み込み直さない。
if(q.has('keys'))document.addEventListener('keydown',async e=>{
 if(e.target.matches('input,select,textarea'))return;
 const key=e.key.toLowerCase();
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
