'use strict';
/* 実ゲームの確認用ページ。Gで合奏・Cで本番・Mで部員・Dでテーマを切り替える。製品には入れない。 */
(async()=>{
// 確認ページだけ保存先を使わず、操作や早送りで本物のセーブを書き換えない。
save=()=>{};load=()=>null;
if(document.readyState==='loading')await new Promise(r=>document.addEventListener('DOMContentLoaded',r,{once:true}));
const q=new URLSearchParams(location.search);let view=q.get('view')||'week';
document.documentElement.dataset.theme=q.get('theme')==='dark'?'dark':'light';
U.sfx=false;U.fxMode='off';FX.q=[];clearTimeout(FX.timer);FX.on=false;$('#fx').hidden=true;
let report;
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
 report.gradIndex=GR.i;report.gradAuto=Boolean(GR.timer);
 const source=S.log.slice().reverse().slice(0,80).map(e=>e.text).sort(),shown=Array.from(document.querySelectorAll('.log-preview,.log-notes>li>span:last-child')).map(e=>e.textContent).sort();
 report.logSourceCount=source.length;report.logRenderedCount=shown.length;report.logPreserved=JSON.stringify(source)===JSON.stringify(shown);
 report.planOwn={...(S.plan||{})};report.policy=S.policy;report.week=S.week;report.statsFingerprint=hash(JSON.stringify(S.members.map(m=>m.stats)));
 let out=$('#qaResult');if(!out){out=document.createElement('output');out.id='qaResult';out.hidden=true;document.body.append(out);}out.textContent=JSON.stringify(report);
}
async function show(next){
 view=next;report={view,errors:[],steps:0};
 stopPlay();clearTimeout(GR.timer);clearTimeout(AN.timer);cancelAnimationFrame(CD.raf);CD.phase='idle';
 for(const id of ['conduct','gradRoll','announce','fx'])$('#'+id).hidden=true;
 document.documentElement.classList.remove('conducting');
 let s=freshState(2026);
 if(!['intake','talent'].includes(view)){s=assignRecruits(s,autoAssign(s));s=choosePiece(s,'galop');}
 if(view==='talent'){s.recruitSeed=12345;s.seq=0;s.rep=90;s.recruits=null;const rs=makeRecruits(s,40);s.recruits=[...rs.filter(r=>r.talent).slice(0,1),...rs.filter(r=>!r.talent).slice(0,7)];}
 if(['year','journal'].includes(view)){
  const start=s.year;
  while(s.year===start&&report.steps++<160){s=advance(s);S=s;renderAll();await new Promise(r=>setTimeout(r,0));}
  if(s.year!==start+1)throw Error('新年度まで進まなかった');
  report.year=s.year;report.members=s.members.length;report.saveVersion=s.v;
 }else if(['consult','consult-result'].includes(view)){
  for(let i=0;i<100&&!s.consult;i++)s=advance(s);
  if(!s.consult)throw Error('相談の見本が作れなかった');
  if(view==='consult-result')s=resolveConsult(s,consultView(s).choices[0].k);
 }else if(['stage','practice','practice-late','practice-a','members','member','member-old','member-bench','grad','grad-old','grad-auto','senior','conduct','announce','announce-silver','announce-bronze','announce-cast','fx','audition','ensemble'].includes(view)){
  const ms=fullBand({pitch:68,rhythm:72,tone:64,expr:61}),names=new Set();
  ms.forEach((m,i)=>{m.id='m2028-n'+(i+1)+'-cafe';m.name=makeName(names,'recruit',2028,i+1);m.grade=i%3+1;m.joined=2026;m.joinGrade=1;m.sta=95;m.first={y:2026,w:0,stats:{pitch:15,rhythm:12,tone:18,expr:10}};m.story=[{y:2026,w:0,t:'アルトサックスで入部。'},{y:2027,w:16,t:'はじめての金賞。'},{y:2028,w:26,t:'最後の定期演奏会。'}];});
  s.members=ms;s.year=2028;s.week=10;
 }
 if(view==='ensemble'){s.members.forEach((m,i)=>m.grade=i%2+1);s.phase='winter';s.winter={step:1,plan:'kiso'};U.ensKey=null;U.ensPick=null;}
 if(view==='practice-late'){s.week=15;s.members[0].sta=20;}
 if(view==='practice-a'){s.division='A';s.setPiece=setOffer(s)[0];s.split='auto';}
 if(view==='audition'){s.members.forEach((m,i)=>{m.stats={pitch:i<8?20:78,rhythm:i<8?20:78,tone:i<8?20:78,expr:70};m.fam={galop:100};});s=runAudition(s);U.lineup=true;U.draft=null;}else U.lineup=false;
 if(view!=='year'){checkAch(s,true);for(const key of ['skillUp','coachUp','mileUp','loveUp','dreamUp','rivalUp'])delete s[key];}
 if(view==='member-old')delete s.members[0].first;
 if(view==='member-bench')s.members[0].seat=null;
 if(view==='journal-ambiguous'){s.members=[...s.members,{...s.members[0],id:'different-person'}];s.log=[{y:s.year,w:0,text:s.members[0].name+'が、スキルを身につけた。'}];}
 if(view==='journal-empty')s.log=[];
 if(view==='grad-old')s.members.forEach(m=>{delete m.first;m.story=[];});
 S=s;U.sel=null;hideTip();renderAll();refreshNow();$('#toast').hidden=true;
 const cardView=view==='member'||view.startsWith('member-');
 setTab(['log','journal','journal-ambiguous','journal-empty'].includes(view)?'log':view==='members'?'members':cardView||['stage','conduct'].includes(view)?'play':'week');
 if(cardView){placeCard('stage');U.sel=s.members[0].id;renderMemberCard();}
 if(['grad','grad-old','grad-auto'].includes(view)){U.fxMode=view==='grad-auto'?'short':'off';S.gradMembers=s.members.filter(m=>m.grade===3);openGradRoll();GR.i=1;grShow();if(view!=='grad-auto')pauseGradRoll();}
 if(view==='senior'){$('#week').innerHTML='<div class="seniors">'+s.members.filter(m=>m.grade===3).map(m=>seniorCard(m,null)).join('')+'</div>';}
 if(view==='conduct'){const perf=perform(currentCtx());openWatch(perf,'定期演奏会');drawStage(-1,$('#cdStage'),CD.who);}
 if(view==='announce'||view.startsWith('announce-')){
  if(view==='announce-cast'){const rec=addRec(S,'確認用の本番',{only:S.members.slice(12,15).map(m=>m.id)});S.pending={recId:rec.id};report.castIds=rec.snap.members.map(m=>m.id);}
  const award=view==='announce-silver'?'silver':view==='announce-bronze'?'bronze':'gold';
  showAnnounce({award,rep:award==='gold',avg:85},'pref',()=>{},view==='announce-bronze'?'B':'A');AN.skip();
 }
 if(view==='fx'){U.fxMode=q.get('fx')||'short';fxShow({kind:'cut',html:fxCutHtml('実績を達成','はじめての金賞','',''),ms:60000});clearTimeout(FX.timer);}
 await document.fonts.ready;await new Promise(r=>setTimeout(r,80));
 if(cardView)$('#memberCard').scrollIntoView({block:'start'});
 else if(view==='consult')$('.episode.consult').scrollIntoView({block:'center'});
 else window.scrollTo(0,0);
 record();console.log('画面確認',report);
}
await show(view);
document.addEventListener('facesready',()=>setTimeout(record,0));
for(const event of ['pointerdown','toggle'])$('#grCard').addEventListener(event,()=>setTimeout(record,0),{capture:true});
$('#grNext').addEventListener('click',()=>setTimeout(record,0));$('#grPrev').addEventListener('click',()=>setTimeout(record,0));
for(const event of ['click','keydown'])$('#week').addEventListener(event,()=>setTimeout(record,0));
// 一度読み込んだ実ゲームで切り替え、毎回録音素材を読み込み直さない。
if(q.has('keys'))document.addEventListener('keydown',async e=>{
 if(e.target.matches('input,select,textarea'))return;
 const key=e.key.toLowerCase();
 if(key==='9'){e.preventDefault();await show('practice-a');return;}
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
