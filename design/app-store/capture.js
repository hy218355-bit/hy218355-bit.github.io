// 撮影専用のコピーでだけ読み込む。画面や能力を加工せず、製品の関数で表示する。
(async()=>{
 const send=msg=>webkit.messageHandlers.native.postMessage({type:'log',msg});
 try{
  while(!S)await new Promise(r=>setTimeout(r,50));
  const scene=window.TSUKURIKATA_LAUNCH?.tab||'week';
  const fixture=__FIXTURE__;
  stopPlay();U.fxMode='off';U.sfx=false;
  commit(fixture.state);
  // 英語版の撮影後でも、日本語の掲載画像は日本語で撮る。
  window.SuibuLanguage?.set('ja');
  U.onboarding={club:onboardingClub(S),active:false,heard:true};
  renderAll();refreshNow();
  setTab(scene==='member'?'members':scene);
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
  else window.scrollTo(0,0);
  await new Promise(r=>setTimeout(r,500));
  send('CAPTURE_READY '+JSON.stringify({scene,year:S.year,week:S.week,members:S.members.length,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:innerHeight,statusBarBandHeight:parseFloat(getComputedStyle(document.body,'::before').height),theme:matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light',portraits:Number($('#stage').dataset.portraitCount||0),fonts:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family),brokenImages:[...document.images].filter(x=>!x.complete||!x.naturalWidth).map(x=>x.getAttribute('src'))}));
 }catch(e){send('CAPTURE_FAILED '+String(e.stack||e));}
})();
