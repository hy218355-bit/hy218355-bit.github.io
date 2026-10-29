'use strict';
/* 初見を想定した操作と、実際の楽器音の確認。製品やオーナーの保存先には入れない。 */
const growthAuditEvents=[],growthAuditErrors=[];
const oldGrowthLoad=load;
load=()=>{
 const stored=oldGrowthLoad();if(stored || omode!=='month')return stored;
 const random=Math.random;let seed=20261029;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 let s;try{s=freshState(2026);}finally{Math.random=random;}
 s=choosePiece(assignRecruits(s,autoAssign(s)),oq.get('piece')||'galop');
 for(let n=0;s.week<4&&n<80;n++){
  if(recruitsDue(s)&&!s.pending){s=assignRecruits(s,autoAssign(s));continue;}
  if(s.pending){s=finishStage(s);continue;}
  const ev=eventAt(s,s.week);
  if(ev?.kind==='concert'||ev?.kind==='contest'){s=beginStage(s);continue;}
  if(s.episode){s=resolveEpisode(s,episodeView(s).choices[0].k);continue;}
  if(s.consult){s=resolveConsult(s,consultView(s).choices[0].k);continue;}
  if(s.outing){const v=outingView(s);s=resolveOuting(s,seated(s).slice(0,v.n).map(m=>m.id));continue;}
  s=practiceWeek(s);
 }
 if(s.week!==4)throw Error('4週間の確認用の部へ進まなかった');return s;
};
let releaseGrowthSamples;
if(oq.has('holdSamples')){
 const original=window.fetch.bind(window),gate=new Promise(resolve=>releaseGrowthSamples=resolve);
 window.fetch=(input,init)=>String(typeof input==='string'?input:input.url).includes('.mp3')?gate.then(()=>original(input,init)):original(input,init);
}
function growthAuditRecord(){
 const pair=U.growthPair,playing=growthListening(),hashPerf=p=>p?hash(JSON.stringify(p)):null;
 const report={state:hash(JSON.stringify(S)),records:hash(JSON.stringify(S.recs)),members:hash(JSON.stringify(S.members)),year:S.year,week:S.week,tab:U.tab,guide:U.onboarding,playing:U.playing,waiting:!!U.waitPlay,focus:document.activeElement.id||document.activeElement.dataset.growth||document.activeElement.dataset.act||document.activeElement.dataset.onboard||document.activeElement.tagName,stagePortraits:Number(document.querySelector('#stage').dataset.portraitCount||0),available:growthAvailable(),growth:playing?{side:playing.side,perf:hashPerf(playing.perf)}:null,pair:pair?{pid:pair.pid,range:pair.range,venue:pair.venue,reference:pair.rec.id,before:hashPerf(pair.perfs.before),now:hashPerf(pair.perfs.now),current:pair.state===S,baseline:pair.contexts.before.members.map(m=>({id:m.id,name:m.name,seat:m.seat})),latest:pair.contexts.now.members.map(m=>({id:m.id,name:m.name,seat:m.seat}))}:null,buttons:[...document.querySelectorAll('#growthListen [data-growth]')].map(b=>({side:b.dataset.growth,label:b.getAttribute('aria-label'),pressed:b.getAttribute('aria-pressed'),height:b.getBoundingClientRect().height})),shown:hashPerf(U.shown),rangeDisabled:document.querySelector('#rangeSel').disabled,errors:growthAuditErrors,events:growthAuditEvents,width:innerWidth,scrollWidth:document.documentElement.scrollWidth};
 document.querySelector('#growthAudit').textContent=JSON.stringify(report);
}
window.addEventListener('error',e=>growthAuditErrors.push(e.message));
document.addEventListener('DOMContentLoaded',()=>{
 const panel=document.createElement('details');panel.id='growthAuditPanel';panel.style.cssText='margin:20px 20px 160px;padding:12px;border:1px solid var(--rule);color:var(--ink);background:var(--sheet)';
 panel.innerHTML='<summary>確認用の操作</summary><button type="button" id="releaseGrowthSamples" style="min-height:44px">音の読み込みを進める</button><button type="button" id="exportGrowthSound" style="min-height:44px">比較の音声を作る</button><button type="button" id="growthYearRun" style="min-height:44px">1年を進めて確かめる</button><output id="growthYearStatus" style="display:block;overflow-wrap:anywhere;max-width:100%"></output><output id="growthAudioStatus" style="display:block;overflow-wrap:anywhere;max-width:100%"></output><output id="growthAudioBefore" hidden></output><output id="growthAudioNow" hidden></output><output id="growthAudit" hidden></output>';
 document.body.append(panel);
 document.querySelector('#releaseGrowthSamples').onclick=()=>{releaseGrowthSamples?.();document.querySelector('#releaseGrowthSamples').textContent='読み込みを進めました';};
 document.querySelector('#exportGrowthSound').onclick=async()=>{
  const status=document.querySelector('#growthAudioStatus');status.textContent='書き出し中';
  try{
   const pair=U.growthPair;if(!pair)throw Error('聴き比べを先に開いてください');
   if(SAMPLES.loading)await SAMPLES.loading;if(!SAMPLES.ready)throw Error('実際の楽器音を読み込めなかった');if(VIR.loading)await VIR.loading;
   const metrics={};
   for(const side of ['before','now']){
    const perf=pair.perfs[side]||perform(pair.contexts[side]);
    const buffer=await renderPerf(perf,{venue:pair.venue,pos:U.pos});
    const wav=new Uint8Array(encodeWav(buffer,{title:side==='before'?'4月の音':'いまの音'}));
    let str='';for(let i=0;i<wav.length;i+=32768)str+=String.fromCharCode(...wav.subarray(i,i+32768));
    document.querySelector(side==='before'?'#growthAudioBefore':'#growthAudioNow').textContent=btoa(str);
    let sum=0,peak=0;for(let c=0;c<buffer.numberOfChannels;c++)for(const v of buffer.getChannelData(c)){sum+=v*v;peak=Math.max(peak,Math.abs(v));}
    metrics[side]={sampleRate:buffer.sampleRate,frames:buffer.length,channels:buffer.numberOfChannels,seconds:buffer.duration,rms:Math.sqrt(sum/buffer.length/buffer.numberOfChannels),peak,perf:hash(JSON.stringify(perf)),samplesReady:SAMPLES.ready};
   }
   status.textContent=JSON.stringify({done:true,metrics});
  }catch(e){status.textContent=JSON.stringify({done:false,error:e.message});}
 };
 document.querySelector('#growthYearRun').onclick=async()=>{
  const out=document.querySelector('#growthYearStatus'),start=S.year,steps=[];stopPlay();
  try{
   for(let i=0;S.year===start&&i<180;i++){
    let next;const ev=eventAt(S,S.week);
    if(recruitsDue(S)&&!S.pending)next=assignRecruits(S,autoAssign(S));
    else if(S.phase==='choose')next=choosePiece(S,'galop');
    else if(S.phase==='chooseSet')next=chooseSetPiece(S,setOffer(S)[0]);
    else if(S.phase==='end')next=startWinter(S);
    else if(S.phase==='winter'){
     const st=winterStep(S).id;
     next=st==='plan'?chooseWinterPlan(S,'kiso'):st==='ens'&&!S.winter.ens?(autoEnsemble(S).length?runEnsemble(S,autoEnsemble(S)):skipEnsemble(S)):winterNext(S);
    }else if(S.pending)next=finishStage(S);
    else if(ev?.kind==='audition'&&S.audition&&!S.audition.decided)next=setLineup(S,recommendLineup(S));
    else if(ev?.kind==='concert'||ev?.kind==='contest')next=beginStage(S);
    else if(ev?.kind==='forced')next=practiceWeek(S,'test');
    else if(S.chooseFinal)next=chooseFinalPiece(S,S.pieceId);
    else if(S.episode)next=resolveEpisode(S,episodeView(S).choices[0].k);
    else if(S.consult)next=resolveConsult(S,consultView(S).choices[0].k);
    else if(S.outing){const v=outingView(S);next=resolveOuting(S,seated(S).slice(0,v.n).map(m=>m.id));}
    else next=practiceWeek(S);
    commit(next);renderAll();refreshNow();
    steps.push({year:S.year,week:S.week,phase:S.phase,event:ev?.id,members:S.members.length});
    out.textContent=JSON.stringify({done:false,steps:steps.length});await new Promise(resolve=>setTimeout(resolve,0));
   }
   if(S.year!==start+1)throw Error('新年度まで進まなかった');
   out.textContent=JSON.stringify({done:true,start,end:S.year,steps,errors:growthAuditErrors});
  }catch(e){out.textContent=JSON.stringify({done:false,error:e.stack,steps});}
 };
 growthAuditRecord();setTimeout(growthAuditRecord,1000);setInterval(growthAuditRecord,400);
});
document.addEventListener('click',e=>{if(e.target.closest('[data-growth],[data-onboard],[data-act],[data-tabgo],#btnStop'))growthAuditEvents.push({button:e.target.closest('button')?.getAttribute('aria-label')||e.target.textContent.trim(),at:Math.round(performance.now())});setTimeout(growthAuditRecord,40);setTimeout(growthAuditRecord,500);},true);
