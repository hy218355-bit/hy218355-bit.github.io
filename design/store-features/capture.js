// 撮影専用のコピーでだけ読み込む。画面や能力を加工せず、製品の関数で表示する。
(async()=>{
 const send=msg=>webkit.messageHandlers.native.postMessage({type:'log',msg});
 try{
  while(!S)await new Promise(r=>setTimeout(r,50));
  const scene=window.TSUKURIKATA_LAUNCH?.tab||'week';
  const fixture=__FIXTURE__;
  stopPlay();U.fxMode='off';U.sfx=false;
  let state=fixture.state;
  const advanced=['consult','result','announce','graduation'].includes(scene);
  if(advanced){
   for(let step=0;step<180;step++){
    if(scene==='consult'&&state.consult)break;
    if(['result','announce'].includes(scene)&&state.pending?.kind==='contest')break;
    if(scene==='graduation'&&state.phase==='winter'&&winterStep(state).id==='grad')break;
    if(state.phase==='winter'){
     if(winterStep(state).id==='plan')state=chooseWinterPlan(state,'kiso');
     else if(winterStep(state).id==='ens'&&!state.winter.ens)state=runEnsemble(state,autoEnsemble(state));
     else state=winterNext(state);continue;
    }
    if(state.phase==='end'){state=startWinter(state);continue;}
    if(recruitsDue(state)&&!state.pending){state=assignRecruits(state,autoAssign(state));continue;}
    if(state.phase==='choose'){state=choosePiece(state,'galop');continue;}
    if(state.phase==='chooseSet'){state=chooseSetPiece(state,setOffer(state)[0]);continue;}
    if(state.pending){state=finishStage(state);continue;}
    const ev=eventAt(state,state.week);
    if(ev?.kind==='audition'&&state.audition&&!state.audition.decided){state=setLineup(state,recommendLineup(state));continue;}
    if(ev?.kind==='concert'||ev?.kind==='contest'){state=beginStage(state);continue;}
    if(ev?.kind==='forced'){state=practiceWeek(state,'test');continue;}
    if(state.chooseFinal){state=chooseFinalPiece(state,state.pieceId);continue;}
    if(state.episode){state=resolveEpisode(state,episodeView(state).choices[0].k);continue;}
    if(state.consult){state=resolveConsult(state,consultView(state).choices[0].k);continue;}
    if(state.outing){state=resolveOuting(state,seated(state).slice(0,outingView(state).n).map(m=>m.id));continue;}
    state=practiceWeek(state);
   }
  }
  if(scene==='onboarding')state=freshState(2026);
  commit(state);
  SuibuLanguage.set(__LANGUAGE__);
  U.onboarding={club:onboardingClub(S),active:false,heard:true};
  renderAll();refreshNow();
  setTab(scene==='member'?'members':['week','play','members','log'].includes(scene)?scene:'week');
  if(scene==='graduation')openGradRoll(S.gradMembers[0].id);
  if(scene==='member'){
   const m=S.members.find(m=>m.grade===3&&m.seat)||S.members.find(m=>m.seat);
   U.sel=m.id;placeCard('roster');renderSelectors();renderMemberCard();renderRoster();
  }
  const end=Date.now()+60000;
  while(!SAMPLES.ready||!VIR.man){
   if(SAMPLES.error||VIR.error)throw Error('音源の読み込みに失敗');
   if(Date.now()>end)throw Error('音源の読み込みが時間切れ');
   await new Promise(r=>setTimeout(r,150));
  }
  await document.fonts.ready;
  await Promise.all([...document.images].map(x=>x.decode?.().catch(()=>{})));
  await new Promise(r=>setTimeout(r,4500));
  drawIdle();
  if(scene==='member')window.scrollTo(0,$('#memberCard').getBoundingClientRect().top+scrollY-88);
  else if(scene==='week'){
   const first=$('.psecd');if(!first.open)first.querySelector('summary').click();
   window.scrollTo(0,$('.psecs').getBoundingClientRect().top+scrollY-88);
  }
  else if(scene==='members'&&innerWidth>=768)window.scrollTo(0,$('#rosterFind').getBoundingClientRect().top+scrollY-88);
  else window.scrollTo(0,0);
  await new Promise(r=>setTimeout(r,500));
  send('CAPTURE_READY '+JSON.stringify({scene,year:S.year,week:S.week,members:S.members.length,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:innerHeight,statusBarBandHeight:parseFloat(getComputedStyle(document.body,'::before').height),theme:matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light',portraits:Number($('#stage').dataset.portraitCount||0),fonts:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family),brokenImages:[...document.images].filter(x=>!x.complete||!x.naturalWidth).map(x=>x.getAttribute('src'))}));
 }catch(e){send('CAPTURE_FAILED '+String(e.message)+' '+String(e.stack||e));}
})();
