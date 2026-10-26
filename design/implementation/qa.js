'use strict';
/* 実ゲームの画面を調べる専用ページ。製品には読み込まず、確認用ポートでだけ使う。 */
(async()=>{
if(document.readyState==='loading')await new Promise(r=>document.addEventListener('DOMContentLoaded',r,{once:true}));
const q=new URLSearchParams(location.search),view=q.get('view')||'week';
document.documentElement.dataset.theme=q.get('theme')==='dark'?'dark':'light';
U.sfx=false;U.fxMode='off';FX.q=[];clearTimeout(FX.timer);FX.on=false;$('#fx').hidden=true;
const report={view,errors:[],steps:0};
window.addEventListener('error',e=>report.errors.push(e.message));
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
let s=freshState(2026);
if(view!=='intake'){s=assignRecruits(s,autoAssign(s));s=choosePiece(s,'galop');}
if(view==='year'){
 const start=s.year;
 while(s.year===start&&report.steps++<160){s=advance(s);S=s;renderAll();await new Promise(r=>setTimeout(r,0));}
 if(s.year!==start+1)throw Error('新年度まで進まなかった');
 report.year=s.year;report.members=s.members.length;report.saveVersion=s.v;
}else if(view==='consult'){
 for(let i=0;i<100&&!s.consult;i++)s=advance(s);
 if(!s.consult)throw Error('相談の見本が作れなかった');
}else if(['stage','members','member','grad','conduct','announce','fx'].includes(view)){
 const ms=fullBand({pitch:68,rhythm:72,tone:64,expr:61});
 ms.forEach((m,i)=>{m.id='m2026-n'+i;m.grade=i%3+1;m.joined=2026;m.joinGrade=1;m.sta=95;m.first={y:2026,w:0,stats:{pitch:15,rhythm:12,tone:18,expr:10}};m.story=[{y:2026,w:0,t:'アルトサックスで入部。'},{y:2027,w:16,t:'はじめての金賞。'},{y:2028,w:26,t:'最後の定期演奏会。'}];});
 const castNames=new Set();ms.forEach((m,i)=>{m.id='m2028-n'+(i+1);m.name=makeName(castNames,'recruit',2028,i+1);});
 s.members=ms;s.year=2028;s.week=10;
}
// 静止画の状態では実績と一時的な知らせを既読にする。1年の進行試験では消さない。
if(view!=='year'){checkAch(s,true);for(const key of ['skillUp','coachUp','mileUp','loveUp','dreamUp','rivalUp'])delete s[key];}
S=s;U.sel=null;renderAll();refreshNow();$('#toast').hidden=true;
setTab(view==='log'?'log':['members'].includes(view)?'members':['stage','member','conduct'].includes(view)?'play':'week');
if(view==='consult')$('.episode.consult').scrollIntoView({block:'center'});
if(view==='member'){U.sel=s.members[0].id;renderMemberCard();$('#memberCard').scrollIntoView({block:'start'});}
if(view==='grad'){S.gradMembers=s.members.filter(m=>m.grade===3);openGradRoll();GR.i=1;grShow();clearTimeout(GR.timer);}
if(view==='conduct'){const perf=perform(currentCtx());openWatch(perf,'定期演奏会');CD.who=new Set(S.members.map(m=>m.id));drawStage(-1,$('#cdStage'),CD.who);showCdMember(S.members[0].id);}
if(view==='announce'){showAnnounce({award:'gold',rep:true,avg:85},'pref',()=>{},'A');AN.skip();}
if(view==='fx'){U.fxMode=q.get('fx')||'short';fxShow({kind:'cut',html:fxCutHtml('実績を達成','はじめての金賞','',''),ms:60000});clearTimeout(FX.timer);}
await document.fonts.ready;
await new Promise(r=>setTimeout(r,50));
if(view==='member')$('#memberCard').scrollIntoView({block:'start'});
if(view==='consult')$('.episode.consult').scrollIntoView({block:'center'});
report.width=innerWidth;report.scrollWidth=document.documentElement.scrollWidth;
report.faceCount=document.querySelectorAll('.member-face').length;
const out=document.createElement('output');out.id='qaResult';out.hidden=true;out.textContent=JSON.stringify(report);document.body.append(out);
console.log('画面確認',report);
})().catch(e=>{console.error('画面確認に失敗',e);const out=document.createElement('output');out.id='qaResult';out.textContent=e.stack;document.body.append(out);});

