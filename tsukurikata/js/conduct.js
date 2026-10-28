'use strict';
/* 指揮モードと、録音の保存
   指揮：拍に合わせて画面をタップすると、部員がそのテンポについてくる。上のほうを叩くほど大きく、下ほど小さく。
   はじめに1小節ぶん叩いてテンポを示すと、次の拍から演奏が始まる。
   保存：録音を会場の響きつきで書き出し、ファイルとして保存・共有する（iOSアプリでは共有シートから）。 */

const CD = {phase: 'idle', perf: null, clock: null, count: [], lv: [], level: 1, raf: 0, lastTap: 0, rec: null};

// 最初にテンポを示すタップの数（2拍子は2小節ぶん）
const cdCountN = () => CD.perf.meter <= 2 ? CD.perf.meter * 2 : CD.perf.meter;
const cdCueCalm = () => fxCalm() || U.fxMode !== 'full';
const cdCueHint = () => cdCueCalm() ? 'ラインが光ったらタップ' : '光がラインに届いたらタップ';
const cdCountPeriod = () => {
  const iv=CD.count.slice(1).map((t,i)=>t-CD.count[i]).sort((a,b)=>a-b);
  return iv.length?clamp(iv[Math.floor(iv.length/2)],0.3,1.6):CD.cuePeriod;
};
function cdCountReady(now){
  CD.count=[];CD.cueStart=now;CD.lastTap=0;CD.tapUntil=0;
  cdMsg(`まず${cdCountN()}回、${cdCueHint()}`);
}
function cdResetCount(now){
  // 演奏前だけ、長い中断を新しいテンポの間隔へ混ぜずに数え直す。
  if(CD.phase==='count'&&CD.count.length&&now-CD.count.at(-1)>4*cdCountPeriod())cdCountReady(now);
}
const cdBeatLabel = pc => pc.beatUnit===2?'2分音符':pc.beatUnit===1.5?'付点4分音符':pc.beatUnit===.5?'8分音符':'4分音符';
const cdBeatMark = pc => `<span class="cd-beat" role="img" aria-label="${cdBeatLabel(pc)}">${uiBeatIcon(pc.beatUnit)}</span>`;
const cdAverageTempo = (pc,bpm) => `<b class="cd-average">${cdBeatMark(pc)}<span aria-hidden="true">=</span>${bpm}</b>`;

// 指揮を開いている間は、裏の画面を押したり、Tabで移ったりしない。
const cdVisible = el => !!(el?.isConnected && !el.closest('[hidden],[inert]') && !el.matches(':disabled') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
function cdDialogFocus(target){
  CD.focusToken={};
  if(!CD.focusBlocks){
    CD.returnTo=document.activeElement;
    CD.returnId=CD.returnTo?.id;
    CD.focusBlocks=new Map(Array.from(document.querySelectorAll('.app,#tabbar,#mini'),el=>[el,el.inert]));
  }
  for(const el of CD.focusBlocks.keys())el.inert=true;
  $('#conduct').appendChild($('#toast'));
  (target||$('#cdClose')).focus({preventScroll:true});
}
function cdDialogRelease(){
  if(!CD.focusBlocks)return;
  for(const [el,was] of CD.focusBlocks)el.inert=was;
  CD.focusBlocks=null;
  hideTip();
  document.body.appendChild($('#toast'));
  const old=CD.returnTo,id=CD.returnId,token=CD.focusToken={};
  CD.returnTo=null;CD.returnId=null;
  // 課題曲から自由曲や結果へ進むときは、その画面への移動をじゃましない。
  requestAnimationFrame(()=>{
    if(CD.focusToken!==token||!$('#conduct').hidden||['announce','gradRoll','tuneGame'].some(id=>!$('#'+id).hidden))return;
    const choices=[old,id&&document.getElementById(id),...document.querySelectorAll('#week [data-act="reveal"],#week [data-act="next"],#btnConduct,#tabbar [aria-current="page"]')];
    choices.find(el=>el!==document.body&&el!==document.documentElement&&cdVisible(el))?.focus({preventScroll:true});
  });
}
function cdResultFocus(){
  requestAnimationFrame(()=>{
    if(CD.phase!=='done'||$('#conduct').hidden)return;
    const active=document.activeElement;
    if($('#conduct').contains(active)&&cdVisible(active))return;
    const title=$('#cdResult h3');
    if(title){title.tabIndex=-1;title.focus({preventScroll:true});}
  });
}
function cdDialogKey(e){
  const dialog=$('#conduct');
  if(dialog.hidden)return;
  if(e.key==='Escape'){
    e.preventDefault();e.stopImmediatePropagation();
    if(e.isComposing||e.repeat)return;
    if(!$('#tip').hidden){hideTip();return;}
    if(CD.phase==='watch'&&!$('#cdMember').hidden){showCdMember(null);return;}
    closeConduct();
  }else if(e.key==='Tab'){
    const items=Array.from(dialog.querySelectorAll('button,[href],input,select,textarea,summary,[tabindex]:not([tabindex="-1"])')).filter(cdVisible),first=items[0],last=items.at(-1),active=document.activeElement;
    if(!items.length){e.preventDefault();dialog.focus({preventScroll:true});}
    else if(!dialog.contains(active)||(e.shiftKey?active===first:active===last)){
      e.preventDefault();(e.shiftKey?last:first).focus({preventScroll:true});
    }
  }
}

// stage を渡すと本番の指揮（{rec, ev}）。終わると、その指揮で演奏した結果が採点される
function openConduct(stage = null){
  if(!stage && busy()) return;
  stopPlay();
  if(!E.ensure()) return;
  if(E.ac.state === 'suspended') E.ac.resume();
  CD.stage = stage;
  CD.sel=null;$('#cdMember').hidden=true;
  $('#conduct').classList.remove('watch'); $('#cdClose').textContent = 'やめる'; $('#cdEyebrow').textContent = '指揮';
  soloAll();   // 指揮するときは、全員の音で
  CD.perf = stage ? rememberStageMembers(perform(recCtx(stage.rec)),stage.rec.snap.members,false) : currentPerformance();
  CD.stageMembers = stageMembers(CD.perf);
  // 舞台にいる部員（本番ならオーディションで選んだメンバー）を、指揮台から見えるように描く
  CD.who = new Set([...CD.perf.notes, ...CD.perf.hits].map(n => n.mid));
  CD.phase = 'count'; CD.count = []; CD.lv = []; CD.level = 1; CD.clock = null; CD.rec = null; CD.lastTap = 0; CD.idleHint = false; CD.beatShown = -1; CD.tmHint = null; CD.tapUntil = 0;
  CD.judge = {p: 0, g: 0, e: 0, l: 0}; CD.combo = 0; CD.best = 0;
  cdClearJudge();
  $('#cdCombo').textContent = '';
  const pc = PIECES[CD.perf.pieceId];
  $('#cdTitle').textContent = pc.title;
  $('#cdEyebrow').textContent = stage ? stage.ev.title : '指揮';
  $('#cdVenue').textContent = VENUE[CD.perf.venue || U.venue].name;
  $('#cdPlayers').textContent = `${CD.stageMembers.size}人`;
  $('#cdRef').textContent = bpmAt(pc, CD.perf.interp.tempo ?? 1, CD.perf.from);
  for(const el of document.querySelectorAll('#conduct .cd-stats .cd-beat')){
    el.innerHTML=uiBeatIcon(pc.beatUnit);el.setAttribute('aria-label',cdBeatLabel(pc));
  }
  $('#cdTempo').textContent = '--';
  $('#cdResult').hidden = true; $('#cdPad').hidden = false;
  const ready = () => cdCountReady(E.ac.currentTime);
  CD.cuePeriod=clamp(60/bpmAt(pc,CD.perf.interp.tempo??1,CD.perf.from),0.3,1.6);
  CD.cueNodes=null;
  if(SAMPLES.use && !SAMPLES.ready && SAMPLES.loading && !SAMPLES.error){
    // 録音を読み込み終わるまでは待ってもらう（合成音で始まらないように）
    CD.phase = 'wait';
    cdMsg('録音を読み込んでいます…');
    SAMPLES.loading.then(() => { if(CD.phase === 'wait'){ CD.phase = 'count'; ready(); } }, () => { if(CD.phase === 'wait'){ CD.phase = 'count'; ready(); } });
  } else ready();
  cdBuildCue();
  $('#conduct').hidden = false;
  document.documentElement.classList.add('conducting');
  renderRecordingLibrary();
  drawStage(-1, $('#cdStage'), CD.who); $('#cdProg').style.width = '0';
  cdDialogFocus($('#cdPad'));
  cancelAnimationFrame(CD.raf);
  CD.raf = requestAnimationFrame(cdFrame);
}
// 指揮しないで本番を聴くとき：タップする所は出さず、舞台の部員だけを大きく見せる
function openWatch(perf, title){
  cancelAnimationFrame(CD.raf);
  CD.sel=null;$('#cdMember').hidden=true;soloAll();
  CD.phase = 'watch'; CD.stage = null; CD.perf = perf;
  CD.stageMembers = stageMembers(perf);
  CD.who = new Set([...perf.notes, ...perf.hits].map(n => n.mid));
  $('#cdTitle').textContent = title;
  $('#cdEyebrow').textContent = '本番';
  $('#cdClose').textContent = 'とばす';
  cdMsg(`${VENUE[perf.venue].name}で演奏中。鳴っている部員が光る。`);
  $('#cdResult').hidden = true; $('#cdPad').hidden = true;
  $('#conduct').classList.add('watch');
  $('#conduct').hidden = false;
  document.documentElement.classList.add('conducting');
  drawStage(-1, $('#cdStage'), CD.who); $('#cdProg').style.width = '0';
  renderRecordingLibrary();
  cdDialogFocus();
}
function closeWatch(){
  if(CD.phase !== 'watch') return;
  CD.phase = 'idle';
  clearTimeout(CD.intro); CD.intro = 0;
  document.querySelector('.cd-curtain')?.classList.remove('shut');
  // 見ているあいだに選んだ部員と「この子の音だけ」は、本番が終わったらもどす
  CD.sel = null; $('#cdMember').hidden = true; soloAll();
  $('#conduct').hidden = true; $('#conduct').classList.remove('watch'); $('#cdClose').textContent = 'やめる'; $('#cdEyebrow').textContent = '指揮';
  document.documentElement.classList.remove('conducting');
  renderRecordingLibrary();
  cdDialogRelease();
}
function closeConduct(){
  // 見ているだけの本番は、止めて結果へ（入場の途中や、課題曲と自由曲のあいだなら、鳴っていないので、そのまま結果へ）
  if(CD.phase === 'watch'){ const idle = !!CD.intro || !U.playing; stopPlay(); closeWatch(); if(idle) reveal(); return; }
  cancelAnimationFrame(CD.raf);
  cdClearJudge();
  const playing = CD.phase === 'play';
  CD.phase = 'idle';
  if(playing) stopPlay();
  if(CD.stage && S.pending && !S.pending.revealed){ CD.stage = null; renderAll(); }
  $('#conduct').hidden = true;
  document.documentElement.classList.remove('conducting');
  renderRecordingLibrary();
  cdDialogRelease();
}
const cdMsg = s => { $('#cdMsg').textContent = s; };

// 入りの合図のカチッという音（会場の響きは通さない）
function cdClick(at, strong){
  const ac = E.ac, o = ac.createOscillator(), g = ac.createGain();
  o.frequency.value = strong ? 1650 : 1250;
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(strong ? 0.22 : 0.15, at + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
  o.connect(g); g.connect(ac.destination); o.start(at); o.stop(at + 0.06);
}

// 入力が届くまで待たされた時間を除く。時刻を取れない端末はこれまでの音の時計を使う。
function cdInputTime(e, now, received = performance.now()){
  let stamp=e.timeStamp;
  if(!Number.isFinite(stamp)||stamp<=0)return now;
  // 昔のブラウザが使う時刻の起点にも合わせる。
  if(stamp>1e12){
    if(!Number.isFinite(performance.timeOrigin))return now;
    stamp-=performance.timeOrigin;
  }
  const age=received-stamp;
  if(!Number.isFinite(age)||age < -5)return now;
  if(age>250)return null;
  return Math.max(0,now-Math.max(0,age)/1000);
}
function cdTap(e){
  if(CD.phase !== 'count' && CD.phase !== 'play') return;
  if(e.isPrimary===false||(e.pointerType==='mouse'&&e.button!==0))return;
  e.preventDefault();
  const now = E.ac.currentTime, tapped = cdInputTime(e,now);
  if(tapped===null)return;
  cdResetCount(tapped);
  if(tapped-CD.lastTap<0.12)return; // 二度押し
  CD.lastTap = tapped;
  haptic('tap');
  const pad = $('#cdPad').getBoundingClientRect();
  const y = e.clientY != null ? e.clientY : pad.top + pad.height / 2;
  const level = clamp(0.5 + 0.95 * (1 - (y - pad.top) / pad.height), 0.5, 1.45);
  cdPress();
  $('#cdLevel').style.top = `${(1.45-level)/.95*100}%`;
  if(CD.phase === 'count'){
    CD.count.push(tapped);
    cdClick(now, (CD.perf.from + CD.count.length - 1) % CD.perf.meter === 0);
    if(CD.count.length < cdCountN()){ cdMsg(`あと${cdCountN()-CD.count.length}回`); return; }
    // 叩いた間隔の中央値をテンポにして、次の拍から始める
    const P = cdCountPeriod();
    CD.clock = BeatClock.start(tapped + P, CD.perf.from, P);
    CD.level = level; CD.lv = [[0, +level.toFixed(2)]];
    CD.phase = 'play';
    $('#cdTempo').textContent = Math.round(60 / P);
    cdMsg(cdCueHint());
    playPerf(CD.perf, CD.stage ? `${CD.stage.rec.label}（あなたの指揮）` : `あなたの指揮：${PIECES[CD.perf.pieceId].title}（${VENUE[U.venue].name}）`, cdFinish, {clock: CD.clock});
    E.pb?.setLevel(level, CD.clock.t0);
    return;
  }
  CD.clock.tap(tapped);
  cdJudge(e, pad, CD.clock.taps[CD.clock.taps.length - 1].off);
  if(CD.idleHint)cdMsg(cdCueHint());
  CD.idleHint = false;
  $('#cdTempo').textContent = Math.round(60 / CD.clock.P);
  if(Math.abs(level - CD.level) > 0.04){
    CD.level = level;
    E.pb?.setLevel(level);
    CD.lv.push([+(now - CD.clock.t0).toFixed(3), +level.toFixed(2)]);
  }
}
function cdPress(){
  // 押した反応は面の色だけ。合図や文字を隠す円を毎回作らない。
  CD.tapUntil=E.ac.currentTime+.12;
}

// 1打ごとの判定：部員がちょうどその拍にいたか（叩くのが早いとテンポが前へ、遅いと後ろへ引っぱられる）
const CD_JUDGE = {p: 'ぴったり', g: 'いい感じ', e: '早い', l: '遅い'};
function cdClearJudge(){
  const el=$('#cdFeedback');
  el.textContent='';el.className='cd-feedback';
}
function cdJudge(e, pad, off){
  const a = Math.abs(off), kind = a <= 0.07 ? 'p' : a <= 0.15 ? 'g' : off < 0 ? 'e' : 'l';
  CD.judge[kind]++;
  CD.combo = kind === 'p' || kind === 'g' ? CD.combo + 1 : 0;
  CD.best = Math.max(CD.best, CD.combo);
  // 同じ場所に文字を置き、操作面や指で隠れず、速い拍でも重ならないようにする。
  const el = $('#cdFeedback');
  el.className = 'cd-feedback ' + kind;
  el.textContent = CD_JUDGE[kind];
  $('#cdCombo').textContent = CD.combo >= 4 ? `${CD.combo}連続` : '';
}

// 2拍先まで見せる。表示は音の時計を読むだけで、指揮や判定の時計を動かさない。
function cdCueState(now){
  if(CD.phase!=='count'&&CD.phase!=='play')return null;
  let b;
  if(CD.phase==='play')b=CD.clock.beatAt(now)-CD.perf.from;
  else {
    const count=CD.count,P=cdCountPeriod();
    b=count.length?count.length-1+(now-count[count.length-1])/P:(now-CD.cueStart)/P-1;
  }
  const i=Math.floor(b),f=b-i,meter=CD.perf.meter;
  // 曲の途中から練習するときも、楽譜の拍の位置を保つ。
  const beat=k=>(((k+CD.perf.from)%meter)+meter)%meter+1;
  return {b,i,f,beat:beat(i),next:[1,2].map(d=>({k:i+d,beat:beat(i+d),distance:d-f,show:CD.phase==='count'||i+d<CD.perf.to-CD.perf.from})),count:CD.count.length};
}
function cdBuildCue(){
  const svg=$('#cdPattern');
  svg.innerHTML=`<path class="cue-track" d="M24 44H319"/>
    <path class="cue-target" d="M92 13V75"/>
    <g id="cdCueNow" class="cue-now"><rect x="84" y="20" width="16" height="48" rx="8"/></g>
    ${[0,1].map(i=>`<g id="cdCueNext${i}" class="cue-next"><rect x="-4" y="23" width="8" height="42" rx="4"/></g>`).join('')}
    <g class="cue-steps">${[0,1,2,3].map(i=>`<path id="cdCueStep${i}" d="M${77+i*9} 85h4"/>`).join('')}</g>`;
  $('#cdBeatRow').innerHTML=Array.from({length:CD.perf.meter},(_,i)=>`<i>${i+1}</i>`).join('');
  $('#cdLevel').style.top='47.4%';
  CD.cueNodes={svg,now:$('#cdCueNow'),next:[$('#cdCueNext0'),$('#cdCueNext1')],steps:[0,1,2,3].map(i=>$('#cdCueStep'+i)),beats:Array.from($('#cdBeatRow').children),pad:$('#cdPad')};
}
function cdDrawCue(now){
  const q=cdCueState(now),n=CD.cueNodes;
  if(!n)return;
  n.svg.style.visibility=q?'visible':'hidden';
  if(!q)return;
  const calm=cdCueCalm(),hit=q.f<0.14&&q.i>=0;
  n.svg.dataset.calm=String(calm);n.svg.dataset.mode=CD.phase;n.svg.dataset.nextBeat=q.next[0].beat;
  n.now.classList.toggle('hit',hit);
  n.now.classList.toggle('downbeat',q.beat===1);
  n.pad.classList.toggle('on-beat',hit);
  n.pad.classList.toggle('downbeat',hit&&q.beat===1);
  n.pad.classList.toggle('is-pressed',now<CD.tapUntil);
  for(let i=0;i<2;i++){
    const el=n.next[i],next=q.next[i];
    el.style.visibility=next.show?'visible':'hidden';
    el.setAttribute('transform',`translate(${calm?192+i*100:(92+100*next.distance).toFixed(1)} 0)`);
    el.classList.toggle('downbeat',next.beat===1);
  }
  // 演出なし・短く・動きを減らす設定では、固定した4つの目印で拍までの残りを示す。
  for(let i=0;i<4;i++)n.steps[i].classList.toggle('on',i<=Math.floor(q.f*4));
  const meter=CD.perf.meter,start=((CD.perf.from%meter)+meter)%meter;
  n.beats.forEach((el,i)=>{
    el.classList.toggle('on',q.i>=0&&i===q.beat-1);
    el.classList.toggle('counted',CD.phase==='count'&&(i-start+meter)%meter<q.count%meter);
  });
}
function cdFrame(){
  CD.raf = requestAnimationFrame(cdFrame);
  if(E.ac){cdResetCount(E.ac.currentTime);cdDrawCue(E.ac.currentTime);}
  if(CD.phase !== 'play' || !CD.clock || !E.ac) return;
  const b = CD.clock.beatAt(E.ac.currentTime) - CD.perf.from;
  if(b < 0) return;
  // 楽譜の上でテンポが変わる曲（だんだん速くなる、など）は、指定のテンポを表示しなおし、変わり始める少し前に知らせる
  const pc = PIECES[CD.perf.pieceId];
  if(pc.tmap || pc.tcurve){
    const now = b + CD.perf.from, ti = CD.perf.interp.tempo ?? 1;
    const ref = bpmAt(pc, ti, now), ahead = bpmAt(pc, ti, now + 4);
    if(String(ref) !== $('#cdRef').textContent) $('#cdRef').textContent = ref;
    if(!CD.tmHint && Math.abs(ahead - ref) >= 2){
      CD.tmHint = true;
      cdMsg(`ここからテンポがだんだん${ahead > ref ? '速く' : '遅く'}なる。部員の音を聴きながら、振る速さを${ahead > ref ? '上げて' : '落として'}いこう。`);
    }
  }
  if(E.ac.currentTime - (CD.clock.last?.t ?? CD.clock.t0) > 4 * CD.clock.P && !CD.idleHint){
    CD.idleHint = true;
    cdClearJudge();
    cdMsg('タップが止まっても、部員は最後のテンポで吹き続ける。');
  }
}

// 演奏が終わったら、指揮の様子をまとめて録音に残す（途中で止めたときは残さない）
function cdFinish(natural){
  if(CD.phase !== 'play') return;
  CD.phase = 'done';
  cdClearJudge();
  cdResultFocus();
  if(!natural){
    $('#cdPad').hidden = true; cdMsg('');
    $('#cdResult').hidden = false;
    if(CD.stage){
      $('#cdResult').innerHTML = `<h3>指揮を降りた</h3><p>残りは部員だけで演奏した。結果は部員まかせのときと同じになる。</p>
        <div class="transport"><button class="btn primary" type="button" data-cd="reveal">結果を見る</button></div>`;
      return;
    }
    $('#cdResult').innerHTML = `<h3>途中で止めた</h3><p>最後まで振ると、その演奏が録音に残る。</p>
      <div class="transport"><button class="btn primary" type="button" data-cd="retry">もう一度指揮する</button><button class="btn quiet" type="button" data-cd="close">閉じる</button></div>`;
    return;
  }
  const c = CD.clock, taps = c.taps, pc = PIECES[CD.perf.pieceId];
  // 拍の間隔（楽譜の上でテンポが変わる曲は、その分をならして比べる）
  const iv = [];
  for(let i = 1; i < taps.length; i++) if(taps[i].k - taps[i - 1].k === 1) iv.push((taps[i].t - taps[i - 1].t) / tmAt(pc, taps[i - 1].k));
  const mean = iv.length ? iv.reduce((a, b) => a + b, 0) / iv.length : c.P;
  const sd = iv.length > 2 ? Math.sqrt(iv.reduce((a, b) => a + (b - mean) ** 2, 0) / iv.length) : 0;
  const bpm = Math.round(60 / mean), ref = CD.perf.bpm;
  const stab = Math.round(100 * clamp(1 - 2.2 * sd / mean, 0, 1));
  const followed = taps.length >= 4;
  const speed = bpm > ref * 1.12 ? '指定よりかなり速め' : bpm > ref * 1.04 ? '指定より少し速め' : bpm < ref * 0.88 ? '指定よりかなりゆっくり' : bpm < ref * 0.96 ? '指定より少しゆっくり' : 'ほぼ指定どおりの速さ';
  const comment = !followed ? '途中から指揮が止まり、部員は最初のテンポのまま吹き切った。'
    : stab >= 85 ? 'ぶれない指揮で、部員も安心して吹けた。'
    : stab >= 65 ? 'ところどころテンポが揺れたが、部員はよくついてきた。'
    : 'テンポが大きく揺れ、リズムの苦手な部員ほどついてくるのに苦労した。';
  const J = CD.judge;
  const judgeRow = `<p class="cd-num judge"><span>ぴったり<b>${J.p}</b></span><span>いい感じ<b>${J.g}</b></span><span>早い・遅い<b>${J.e + J.l}</b></span><span>最大連続<b>${CD.best}</b></span></p>`;
  const conduct = {ev: c.saved(), lv: CD.lv, bpm, stab, judge: {...J, best: CD.best}, taps: c.savedTaps()};
  if(CD.stage){
    // 本番：この指揮で演奏した結果で採点し直す
    commit(conductStage(S, conduct));
    E.applaud(stageHeat(S.pending));
    const g = S.pending.conducted?.gain;
    CD.rec = S.recs.find(r => r.id === S.pending.recId);
    renderAll();
    $('#cdPad').hidden = true; cdMsg('');
    $('#cdResult').hidden = false;
    $('#cdResult').innerHTML = `<h3>演奏おわり</h3>
      <p class="cd-num"><span>平均テンポ${cdAverageTempo(pc,bpm)}</span><span>安定度<b>${followed ? stab + '%' : '—'}</b></span></p>
      ${judgeRow}
      <p>${speed}。${comment}</p>
      ${g != null ? `<p class="cd-gain">${g >= 0.05 ? `あなたの指揮で、おまかせより <b>+${g.toFixed(1)}点</b>` : g <= -0.05 ? `おまかせより <b>−${Math.abs(g).toFixed(1)}点</b>。タップを拍にぴったり合わせると、部員の出だしがそろう` : 'おまかせとほぼ同じ出来'}</p>` : ''}
      <div class="transport"><button class="btn primary" type="button" data-cd="reveal">結果を見る</button></div>`;
    haptic(stab >= 85 ? 'success' : 'tap');
    return;
  }
  const rec = addRec(S, `あなたの指揮：${pc.title}（${nowWhen()}）`, {pieceId: CD.perf.pieceId, venue: U.venue});
  rec.span = {from: CD.perf.from, to: CD.perf.to};
  rec.conduct = conduct;
  commit(S);
  renderSelectors();
  CD.rec = rec;
  $('#cdPad').hidden = true;
  cdMsg('');
  $('#cdResult').hidden = false;
  $('#cdResult').innerHTML = `<h3>演奏おわり</h3>
    <p class="cd-num"><span>平均テンポ${cdAverageTempo(pc,bpm)}</span><span>安定度<b>${followed ? stab + '%' : '—'}</b></span></p>
    ${judgeRow}
    <p>${speed}。${comment}</p>
    <p class="small">この演奏は「録音」に残った。会場の響きつきで保存して、何度でも聴き返せる。</p>
    <div class="transport"><button class="btn primary" type="button" data-cd="again">▶ もう一度聴く</button><button class="btn" type="button" data-cd="save">⤓ 保存する</button><button class="btn" type="button" data-cd="retry">もう一度指揮する</button><button class="btn quiet" type="button" data-cd="close">閉じる</button></div>`;
  haptic(stab >= 85 ? 'success' : 'tap');
}

/* ===== 録音の再生（指揮した録音は、そのときの拍の進み方で）と保存 ===== */
const recPerf = rec => rememberStageMembers(perform({...recCtx(rec), ...(rec.span || {})}),rec.snap.members,true,rec);
function playRecording(rec, label, onEnd = null, onWaitCancel = null){
  if(!E.ensure()) return;
  // 前の個人録音を終えてから切り替え、本人だけの指定を次へ残さない。
  stopPlay();
  setVenue(rec.venue);
  const perf = recPerf(rec);
  const opts = rec.conduct ? {clock: BeatClock.fromSaved(rec.conduct.ev, E.ac.currentTime + 0.3, rec.conduct.taps), lv: rec.conduct.lv} : {};
  playPerf(perf, label, onEnd, opts, onWaitCancel);
}
// 録音の中の、ひとりの部員の音だけを聴く（鳴り終わったら全員に戻す）
function playMemberRec(rec, m, label){
  stopPlay();
  U.solo = `member:${m.id}`;
  E.setSolo({type: 'member', id: m.id});
  const reset = () => { U.solo = 'all'; E.setSolo({type: 'all'}); renderSelectors(); };
  playRecording(rec, label, reset, reset);
  if(!U.playing && !U.waitPlay) reset(); else renderSelectors();
}

const recFileName = rec => `吹奏楽部のつくりかた_${rec.year}年度_${rec.label.replace(/[\\/:*?"<>|（）()・]/g, '_').replace(/_+/g, '_').replace(/_$/, '')}`;
// who を渡すと、その部員の音だけを書き出す
async function saveRecording(rec, who = null){
  if(U.saving) return;
  U.saving = true;
  toast('録音を書き出しています… 0%');
  try{
    if(SAMPLES.loading) await SAMPLES.loading.catch(() => {});
    if(VIR.loading) await VIR.loading;
    const buf = await renderPerf(recPerf(rec), {venue: rec.venue, pos: U.pos, conduct: rec.conduct, solo: who ? {type: 'member', id: who.id} : null,
      onProgress: p => toast(`録音を書き出しています… ${Math.round(p * 100)}%`)});
    const school = $('#school').textContent.replace(/\s*\d+年度.*$/, '').replace(/\s+/g, '');
    const meta = {title: rec.label + (who ? `（${who.name}）` : ''), artist: school, album: `吹奏楽部のつくりかた ${rec.year}年度`, comment: `${VENUE[rec.venue].name}で録音`};
    const wav = encodeWav(buf, meta);
    await deliverFile(wav, recFileName(rec) + (who ? '_' + who.name.replace(/\s+/g, '') : '') + '.wav', meta);
  }catch(e){
    toast('書き出せませんでした。もう一度試してください。', 4000);
  }
  U.saving = false;
}
async function deliverFile(buf, name, meta){
  if(window.TSUKURIKATA_NATIVE){
    // アプリ：少しずつ渡し、アプリ側で m4a にして共有シートを出す
    toast('保存の準備をしています…');
    const u8 = new Uint8Array(buf), CH = 393216, n = Math.ceil(u8.length / CH), id = 'f' + Date.now();
    for(let i = 0; i < n; i++){
      const part = u8.subarray(i * CH, (i + 1) * CH);
      let s = '';
      for(let j = 0; j < part.length; j += 8192) s += String.fromCharCode.apply(null, part.subarray(j, j + 8192));
      nativePost({type: 'file', id, i, n, name, data: btoa(s), title: meta.title, artist: meta.artist, album: meta.album});
      if(i % 6 === 5) await new Promise(r => setTimeout(r, 0));
    }
    return;
  }
  // ブラウザ：書き出しに時間がかかると共有の許可が切れるので、ボタンを押してもらってから共有・ダウンロードする
  const file = new File([buf], name, {type: meta.type || 'audio/wav'});
  toast('書き出しました', 0, '保存する', async () => {
    if(navigator.canShare && navigator.canShare({files: [file]})){
      try{ await navigator.share({files: [file], title: meta.title}); toast(''); return; }catch(e){ if(e.name === 'AbortError'){ toast(''); return; } }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    toast('');
  });
}
// アプリ側の保存が終わったとき
window.onNativeFileDone = ok => toast(ok ? '' : '保存できませんでした。', ok ? 0 : 4000);

// 画面下の小さな知らせ（ボタンつきもある）。空文字で消す
function toast(text, ms = 0, action = null, onAction = null){
  const el = $('#toast');
  // 指揮の結果から書き出すときも、保存のボタンをその画面の中で押せるようにする。
  ($('#conduct').hidden?document.body:$('#conduct')).appendChild(el);
  clearTimeout(U.toastT);
  if(!text){ el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<span>${esc(text)}</span>${action ? `<button type="button" class="btn small primary">${esc(action)}</button>` : ''}`;
  if(action) el.querySelector('button').onclick = onAction;
  if(ms) U.toastT = setTimeout(() => { el.hidden = true; }, ms);
}

function bindConduct(){
  $('#btnConduct').addEventListener('click', () => openConduct());
  $('#btnSave').addEventListener('click', () => { const rec = S.recs.find(r => r.id === $('#recSel').value); if(rec) saveRecording(rec); });
  $('#cdClose').addEventListener('click', closeConduct);
  const pad = $('#cdPad');
  pad.addEventListener('pointerdown', cdTap);
  pad.addEventListener('keydown', e => { if((e.key === ' ' || e.key === 'Enter')&&!e.isComposing&&!e.altKey&&!e.ctrlKey&&!e.metaKey){ e.preventDefault();if(!e.repeat) cdTap(e); } });
  $('#cdResult').addEventListener('click', e => {
    const b = e.target.closest('[data-cd]'); if(!b) return;
    const act = b.dataset.cd;
    if(act === 'again' && CD.rec) playRecording(CD.rec, CD.rec.label);
    else if(act === 'save' && CD.rec) saveRecording(CD.rec);
    else if(act === 'retry'){ stopPlay(); openConduct(); }
    else if(act === 'close'){ stopPlay(); closeConduct(); }
    else if(act === 'reveal'){ closeConduct(); setTab('week'); reveal(); }
  });
  document.addEventListener('keydown', cdDialogKey, {capture:true});
}
