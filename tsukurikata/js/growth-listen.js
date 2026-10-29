'use strict';
/* 保存してある4月の部と今の部を、同じ条件で短く聴く。保存した録音は書き換えない。 */
function growthReference(s, pid){
  return s.recs.find(r=>r.year===s.year && r.week===0 && r.pieceId===pid && !r.conduct && !r.result && r.snap?.members?.length);
}
function growthExcerpt(pc, range, interp){
  const span=range!=='all' && pc.spans[Number(range)],from=span?.from ?? 0,end=span?.to ?? pc.beats;
  const bpm=pc.tempi[interp.tempo ?? 1],meter=pc.meter;
  const beats=Math.max(2*meter,Math.round(10*bpm/60/meter)*meter);
  return {from,to:Math.min(end,from+beats)};
}
function growthContexts(s, rec, pid, venue, range){
  const excerpt=growthExcerpt(PIECES[pid],range,s.interp);
  // 速さ・抑揚・揺れの条件をそろえ、同じ音のさいころで育った力を比べる。
  const same={pieceId:pid,venue,interp:{...s.interp},take:rec.snap.take ?? `growth-${rec.id}`,...excerpt};
  return {before:{...recCtx(rec),...same,lead:undefined},now:perfCtx(s,same)};
}
function growthChanges(s, rec){
  const old=new Map(rec.snap.members.map(m=>[m.id,m]));
  return stagers(s).flatMap(m=>{
    const previous=old.get(m.id);if(!previous)return [];
    const gains=STAT_KEYS.map(k=>({k,before:previous.stats[k],now:m.stats[k],gain:m.stats[k]-previous.stats[k]}))
      .filter(x=>x.gain>=.5).sort((a,b)=>Number(rankOf(b.before)!==rankOf(b.now))-Number(rankOf(a.before)!==rankOf(a.now)) || b.gain-a.gain);
    return gains.length?[{m,...gains[0]}]:[];
  }).sort((a,b)=>b.gain-a.gain).slice(0,3);
}
function growthAvailable(){
  return !!(S.pieceId && S.phase!=='choose' && S.phase!=='chooseSet' && !(foundingYear(S)&&S.week===0) && seated(S).length && growthReference(S,playPiece()));
}
function growthListening(){
  const x=U.growthListen,active=U.waitPlay?.perf || (U.playing?U.shown:null);
  return x && active===x.perf ? x : null;
}
function renderGrowthListening(){
  const box=document.querySelector('#growthListen');if(!box)return;
  box.hidden=!growthAvailable();if(box.hidden)return;
  const pid=playPiece(),rec=growthReference(S,pid),listening=growthListening();
  const key=`${S.recruitSeed}:${S.year}:${S.week}:${pid}:${rec.id}`;
  if(box.dataset.content!==key || U.growthCardState!==S){
    U.growthCardState=S;box.dataset.content=key;
    const faces=growthChanges(S,rec);
    box.innerHTML=`<summary><b>${uiIcon('note')}音の成長を聴く</b><span>4月 → いま${uiIcon('chevron')}</span></summary><div class="growth-body">
      <div class="growth-heading"><span>${esc(PIECES[pid].title)}</span><button class="help-button" type="button" aria-label="聴き比べの見方"${tipAttr('音の成長','4月の記録を、今と同じテンポ・抑揚・会場・短い範囲で聴きます。部員と担当は、その時のまま。体力や人数の変化も音に出ます。録音と部員の記録は変わりません。')}>?</button></div>
      <div class="growth-buttons"><button class="btn" type="button" data-growth="before" aria-pressed="false">${uiIcon('play')}<span>4月の音</span></button><button class="btn" type="button" data-growth="now" aria-pressed="false">${uiIcon('play')}<span>いまの音</span></button></div>
      ${faces.length?`<div class="growth-people">${faces.map(x=>{const up=rankOf(x.before)!==rankOf(x.now);return `<span class="growth-person">${memberFace(x.m,36)}<b>${esc(x.m.name)}</b><small>${STAT_LABEL[x.k]}</small><span class="growth-ranks" aria-label="${STAT_LABEL[x.k]} ${up?rankOf(x.before)+'から':''}${rankOf(x.now)}">${up?rankBadge(x.before)+uiIcon('chevron'):''}${rankBadge(x.now)}</span></span>`;}).join('')}</div>`:''}</div>`;
  }
  for(const b of box.querySelectorAll('[data-growth]')){
    const on=!!listening && listening.side===b.dataset.growth,waiting=on&&!!U.waitPlay&&!U.playing;
    b.setAttribute('aria-pressed',String(on));b.disabled=busy() || CD.phase!=='idle';
    const label=waiting?'読み込み中':on?'止める':b.dataset.growth==='before'?'4月の音':'いまの音';
    const html=uiIcon(on?'stop':'play')+`<span>${label}</span>`;
    if(b.innerHTML!==html)b.innerHTML=html;
    b.setAttribute('aria-label',`${b.dataset.growth==='before'?'4月の音':'いまの音'}を${waiting?'読み込み中。中止する':on?'止める':'聴く'}`);
  }
}
function openGrowthListening(){
  renderGrowthListening();const box=document.querySelector('#growthListen');
  if(!box || box.hidden)return false;
  box.open=true;box.querySelector('[data-growth="before"]').focus({preventScroll:true});
  box.scrollIntoView({block:'center',behavior:'auto'});return true;
}
function listenGrowth(side){
  if(!['before','now'].includes(side) || !growthAvailable() || libraryBlocked())return;
  const listening=growthListening();
  if(listening?.side===side){stopPlay();return;}
  stopPlay();soloAll();clearRecordedMember();U.sel=null;renderMemberCard();
  const pid=playPiece(),rec=growthReference(S,pid),range=U.range,venue=U.venue;
  let pair=U.growthPair;
  if(!pair || pair.state!==S || pair.pid!==pid || pair.range!==range || pair.venue!==venue || pair.rec!==rec){
    const contexts=growthContexts(S,rec,pid,venue,range);
    pair=U.growthPair={state:S,pid,range,venue,rec,contexts,perfs:{}};
  }
  if(!pair.perfs[side]){
    const ctx=pair.contexts[side],members=clone(ctx.members);
    pair.perfs[side]=rememberStageMembers(perform({...ctx,members}),members,true);
  }
  const perf=pair.perfs[side],token=U.growthListen={pair,side,perf};
  const done=()=>{if(U.growthListen===token){U.growthListen=null;renderGrowthListening();}};
  const label=`${side==='before'?'4月の音':'いまの音'}：${PIECES[pid].title}（${VENUE[venue].name}・聴き比べ）`;
  playPerf(perf,label,done,{},done);
  if(!U.playing&&!U.waitPlay)done();
  renderSelectors();renderGrowthListening();
  document.querySelector(`[data-growth="${side}"]`)?.focus({preventScroll:true});
}
