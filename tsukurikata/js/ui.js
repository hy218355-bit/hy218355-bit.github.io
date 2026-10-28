'use strict';
/* 画面：ステージ・譜面台・ホワイトボード・名簿 */

const $ = s => document.querySelector(s);
const E = new Engine();
let S = null;
const U = {
  venue: 'room', pos: 'center', range: 'all', view: 'mel', sel: null, piece: null, solo: 'all',
  shown: null, shownLabel: '', perfNow: null, diag: null, ptr: null, raf: 0, onEnd: null, playing: false, refreshT: 0,
  tab: 'week', tabScroll: {},
  recordMember: null, recordPerf: null, moveUndo: null,
  lineup: false, draft: null, audListen: null, ensListen: null, pred: null, predKey: '', predT: 0, outKey: '', outPick: new Set(),
  sfx: true, fxMode: 'full',
};
const UI_KEY = 'suibu-ui-v2';  // 前の名前のころからの保存先（SAVE_KEY と同じ理由でこのまま）

/* ===== 小道具 ===== */
/* ===== 力のランク =====
   パワプロのように、力を G〜S の8段階の色と1文字で見せる（数字は出さない）。
   入部したては G〜F、1年で D ほど、3年生のふつうの子で B、いちばんうまい子で S */
const RANKS = [[90, 'S'], [80, 'A'], [70, 'B'], [60, 'C'], [50, 'D'], [40, 'E'], [20, 'F'], [0, 'G']];
// 入部で平均が下がった週は、表示用の前の値が負になることがある。Gの範囲へ収める。
const rankOf = v => RANKS.find(([t]) => clamp(Number(v) || 0,0,100) >= t - 1e-9)[1];
// up：この週にランクが上がった（光らせて ▲ をつける）
const rankBadge = (v, up) => `<i class="rk rk-${rankOf(v).toLowerCase()}${up ? ' up' : ''}">${rankOf(v)}${up ? uiIcon('up') : ''}</i>`;
const rankFill = v => `background:var(--rk-${rankOf(v).toLowerCase()})`;
// 力の行（名前・ランクの色の棒・ランク）。部員カードと部の実力で使う
const rankRow = (name, v, up, tip) => `<div class="stat rkrow"${tipAttr(name, tip)}><span class="nm">${name}</span><span class="track"><span class="fill" style="width:${clamp(v, 0, 100)}%;${rankFill(v)}"></span></span><span class="val">${rankBadge(v, up)}</span></div>`;
function tok(){
  const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
  return {
    ink: g('--ink'), soft: g('--ink-soft'), rule: g('--rule'), sheet: g('--sheet'), paper: g('--paper'), brass: g('--brass'),
    rkInk:g('--rk-ink'), floor: g('--floor'), floorLine: g('--floor-line'), good: g('--good'), warn: g('--warn'), bad: g('--bad'),
    lcdInk: g('--lcd-ink'), lcdDim: g('--lcd-dim'), fBody: g('--f-body'), fLcd: g('--f-lcd'), fHand: g('--f-hand'),
    rk: Object.fromEntries(RANKS.map(([, r]) => [r, g(`--rk-${r.toLowerCase()}`)])),
    conduct:{paper:g('--cd-paper'),sheet:g('--cd-stage'),floor:g('--cd-stage'),floorLine:g('--cd-floor'),ink:g('--cd-ink'),soft:g('--cd-soft'),brass:g('--cd-accent'),rule:g('--cd-line')},
  };
}
function rgb(hex){
  const h = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}
function mix(a, b, t){
  const x = rgb(a), y = rgb(b);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
}
// 部員の力の色：ランク（G〜S）ごとの色。舞台の点・部員の一覧・オーディションの点でも同じ色
const skillColor = (C, v) => C.rk[rankOf(v)];
const errColor = (C, e, wrong) => wrong ? C.bad : Math.abs(e) < 5 ? C.good : Math.abs(e) < 15 ? C.warn : C.bad;
function fitCanvas(cv, H){
  const W = Math.max(240, cv.parentElement.clientWidth);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.style.height = H + 'px';
  if(cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)){ cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  return {g, W, H};
}
const memberById = id => S.members.find(m => m.id === id);
const playPiece = () => U.piece || S.pieceId || 'largo';
// 区間の短い名前（short があればそれ、なければ「前半（オーボエのソロ）」→「前半」）
const spanShort = sp => sp.short || sp.name.replace(/（.*?）$/, '');
const avgStats = m => STAT_KEYS.reduce((a, k) => a + m.stats[k], 0) / 4;
function rangeSpan(pid){
  const pc = PIECES[pid];
  if(U.range === 'all') return {from: 0, to: pc.beats};
  return pc.spans[+U.range] || {from: 0, to: pc.beats};
}
const nowWhen = () => S.phase === 'choose' || S.phase === 'chooseSet' ? '選曲前' : S.phase === 'winter' ? `${winterStep(S).m}月` : wkLabel(S.week);
const nowLabel = () => `いまの音（${nowWhen()}・${VENUE[U.venue].name}）`;
const busy = () => !!(S.pending && !S.pending.revealed);
// 画面の設定は会場だけ残す（聴く位置は客席の中央、音はいつも楽器の録音で鳴らす）
// 端末ごとの設定：聴く会場、効果音（sfx）、演出（fxMode：full ふつう／short 短く／off なし）
function saveUI(){ try{ localStorage.setItem(UI_KEY, JSON.stringify({venue: U.venue, sfx: U.sfx, fxMode: U.fxMode})); }catch(e){} }
function loadUI(){ try{ const x = JSON.parse(localStorage.getItem(UI_KEY) || 'null'); if(x && VENUE[x.venue]) U.venue = x.venue; if(x && x.sfx === false) U.sfx = false; if(x && ['full', 'short', 'off'].includes(x.fxMode)) U.fxMode = x.fxMode; }catch(e){} }
// 録音音源の読み込み状況
function renderSnd(){
  const st = $('#sndStatus');
  if(SAMPLES.error) st.innerHTML = '<span>楽器の録音を読み込めなかったので、合成音で鳴らします</span><button class="btn small quiet" type="button" data-sndretry aria-label="楽器の音を読み直す">読み直す</button>';
  else if(!SAMPLES.ready) st.textContent = `楽器の音を読み込み中 ${Math.round(SAMPLES.progress * 100)}%`;
  else st.textContent = '';
}
function commit(next){
  if(ensembleListening())stopPlay();
  // ほかの操作を巻き戻さないよう、保存する操作で席の取り消しを終える。
  U.moveUndo = null;
  $('#memberCard .mc-undo')?.remove();
  S = next; save(S);
  // 次の再生では、保存後の部員と編成から音を作る。再生中の演奏は保つ。
  U.perfNow = null;
}

/* ===== いまの演奏を作り直す ===== */
function currentCtx(){
  const pid = playPiece(), span = rangeSpan(pid);
  return perfCtx(S, {pieceId: pid, venue: U.venue, from: span.from, to: span.to});
}
function currentPerformance(){
  const ctx=currentCtx();
  return rememberStageMembers(perform(ctx),ctx.members,false);
}
function refreshNow(){
  clearTimeout(U.refreshT);
  // 描き直しを待たずに押しても、前の音を再生しない。
  U.perfNow = null;
  U.refreshT = setTimeout(() => {
    U.perfNow = currentPerformance();
    U.diag = analyze(U.perfNow);
    if(!U.playing){ U.shown = U.perfNow; U.shownLabel = nowLabel(); setNowPlaying(); }
    renderDiag();
    drawIdle();
  }, 20);
}
function setNowPlaying(){
  $('#nowPlaying').innerHTML = U.playing ? `<b>再生中</b>：${esc(U.shownLabel)}` : `表示中：${esc(U.shownLabel)}`;
  renderPlayButtons();
  updateMini();
}
function renderPlayButtons(){
  const on = !!(U.playing || U.waitPlay);
  $('#btnStop').hidden = !on; $('#btnNow').hidden = on;
  const moveStop = $('#memberCard [data-mact="movestop"]');
  if(moveStop) moveStop.hidden = !on || tabHidden('play');
  renderAuditionListening();
  renderEnsembleListening();
  renderDiagPractice();
  renderRecordingLibrary();
}

/* ===== スマホ・タブレット縦：画面下のタブ ===== */
const TABS = ['week', 'play', 'members', 'log'];
const narrow = window.matchMedia('(max-width: 960px)');
const tabHidden = t => narrow.matches && U.tab !== t;
function setTab(t, keep){
  if(!TABS.includes(t)) t = 'week';
  if(U.tab !== t) U.tabScroll[U.tab] = window.scrollY;
  U.tab = t;
  document.documentElement.classList.add('tabbed');
  document.querySelectorAll('[data-tab]').forEach(el => el.classList.toggle('tab-on', el.dataset.tab.split(' ').includes(t)));
  document.querySelectorAll('[data-tabgo]').forEach(b => { if(b.dataset.tabgo === t) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  if(narrow.matches) window.scrollTo(0, keep ? (U.tabScroll[t] || 0) : 0);
  updateMini();
  renderPlayButtons();
  // 隠れていたあいだは描けないので、見えたところで描き直す
  if(t === 'play' && !U.playing) requestAnimationFrame(drawIdle);
}
// 合奏の画面以外で鳴っているときは、下に小さく「再生中」と止めるボタンを出す
function updateMini(){
  const mini = $('#mini'); if(!mini) return;
  mini.hidden = !((U.playing || U.waitPlay) && tabHidden('play') && !(U.tab==='week'&&ensembleListening()));
  if(!mini.hidden) $('#miniLabel').textContent = U.waitPlay && !U.playing ? '♪ 楽器の録音を読み込んでいます…（読み込めたら鳴ります）' : `♪ ${U.shownLabel}`;
}

/* ===== 再生 ===== */
function playPerf(perf, label, onEnd, opts = {}, onWaitCancel = null){
  if(U.recordMember && U.recordPerf !== perf) clearRecordedMember();
  if(SAMPLES.use && !SAMPLES.ready && SAMPLES.loading && !SAMPLES.error){
    const token = U.waitPlay = {perf, onCancel:onWaitCancel};
    $('#nowPlaying').textContent = '録音を読み込んでいます…（読み込めたら鳴ります）';
    E.unlock(); updateMini(); renderPlayButtons();
    const go = () => { if(U.waitPlay === token){ U.waitPlay = null; playPerf(perf, label, onEnd, opts, onWaitCancel); } };
    SAMPLES.loading.then(go, go);
    return;
  }
  U.waitPlay = null;
  const pb = E.play(perf, null, opts);
  if(!pb){ renderPlayButtons(); updateMini(); $('#nowPlaying').textContent = 'このブラウザでは音を鳴らせません。'; return; }
  U.shown = perf; U.shownLabel = label; U.playing = true; U.onEnd = onEnd || null;
  U.lastT = 0;
  if(window.TSUKURIKATA_NATIVE) nativePost({type: 'log', msg: `play start "${label}" ${perf.notes.length} notes, ${perf.total.toFixed(1)}s, audio ${E.ac.state}`});
  nativePost({type: 'playing', on: true});
  U.ptr = buildPtr(perf);
  U.stageMembers = stageMembers(perf);
  renderPiece();
  $('#btnStop').hidden = false; $('#btnNow').hidden = true;
  setNowPlaying();
  cancelAnimationFrame(U.raf);
  const tick = () => {
    if(!E.pb) return;
    const t = U.lastT = E.now();
    if(!tabHidden('play')){ drawStage(t); drawRoll(U.shown, t); }
    if(!$('#conduct').hidden){ drawStage(t, $('#cdStage'), CD.who); $('#cdProg').style.width = `${clamp01(t / U.shown.total) * 100}%`; }
    if(t > U.shown.total + 0.8){
      const p = E.pb; E.pb = null; p.finish();
      endPlay(true);
      return;
    }
    U.raf = requestAnimationFrame(tick);
  };
  U.raf = requestAnimationFrame(tick);
}
// natural：最後まで鳴り終わったとき（止めるボタンなら false）
function endPlay(natural = false){
  if(window.TSUKURIKATA_NATIVE) nativePost({type: 'log', msg: `play end ${natural ? 'natural' : 'stopped'} at ${(U.lastT ?? -1).toFixed(2)}s / ${U.shown?.total?.toFixed(1)}s, audio ${E.ac?.state}`});
  U.playing = false;
  nativePost({type: 'playing', on: false});
  cancelAnimationFrame(U.raf);
  $('#btnStop').hidden = true; $('#btnNow').hidden = false;
  setNowPlaying();
  clearRecordedMember();
  renderPiece();
  // 聴いている間に週が進んだときも、停止後は今の部と譜面へ戻す。
  U.perfNow=null;refreshNow();
  drawIdle();
  const cb = U.onEnd; U.onEnd = null;
  if(cb) cb(natural);
}
function stopPlay(){
  const waiting = U.waitPlay;
  U.waitPlay = null; updateMini(); renderPlayButtons();
  if(!U.playing){ if(waiting){ waiting.onCancel?.(); setNowPlaying(); } return; }
  E.stop();
  endPlay();
}
function setVenue(id){
  U.venue = id; saveUI();
  E.setVenue(id);
  renderVenues();
  refreshNow();
}

/* ===== ステージ（座席） ===== */
function stageGeom(W, portraits = false){
  const H = Math.round(portraits ? clamp(W * .84, 282, 400) : clamp(W * 0.5, 210, 360));
  const R = Math.min((W / 2 - 18) / 0.78, (H - 46) / 0.92);
  return {W, H, cx: W / 2, baseY: H - 28, R, portraits, r: portraits ? clamp((W - 36) / 7 * .33, 7.5, 13.5) : clamp(R * 0.038, 6, 13)};
}
// 奥行きで5段へ分け、段の中は元の左右の順を保つ。音の位置は元の座席データを使う。
const STAGE_FACE_ROWS=(()=>{const seats=SEATS.slice().sort((a,b)=>a.y-b.y||a.x-b.x),rows=[];for(let i=0;i<seats.length;i+=8)rows.push(seats.slice(i,i+8).sort((a,b)=>a.x-b.x));return rows;})();
const STAGE_FACE_LAYOUT=new Map(STAGE_FACE_ROWS.flatMap((row,r)=>row.map((s,i)=>[s.id,{row:r,fraction:i/Math.max(1,row.length-1)}])));
const stageRowY=(row,G)=>G.H-66-row*(G.H-100)/4;
const seatXY = (s, G) => {
  if(!G.portraits)return [G.cx + s.x * G.R, G.baseY - s.y * G.R * .95];
  const {row,fraction}=STAGE_FACE_LAYOUT.get(s.id);
  return [G.cx+(fraction-.5)*(G.W-36),stageRowY(row,G)+Math.abs(fraction-.5)*12];
};
// 再生する録音そのものの部員情報を、演奏の音やセーブとは別に覚える。
const STAGE_PERFORMERS = new WeakMap();
function rememberStageMembers(perf, members, recorded=true, record=null){ STAGE_PERFORMERS.set(perf,{members:members || [],recorded,record}); return perf; }
function recordingPlayback(){ return !!(U.playing && U.shown && STAGE_PERFORMERS.get(U.shown)?.recorded); }
function recordedRangeLabel(perf){
  const pc=PIECES[perf.pieceId];
  if(perf.from===0&&perf.to===pc.beats)return '全部';
  const span=pc.spans.find(s=>Math.abs(s.from-perf.from)<1e-6&&Math.abs(s.to-perf.to)<1e-6);
  return span?spanShort(span):'録音の範囲';
}
// 昔の録音でも、いま同じ席にいる別の部員の顔へ入れ替わらないようにする。
function stageMembers(perf){
  const known=new Map();
  for(const rec of S.recs||[])for(const m of rec.snap?.members || rec.members || [])known.set(m.id,m);
  for(const m of [...(S.gradMembers||[]),...S.members])known.set(m.id,m);
  for(const m of STAGE_PERFORMERS.get(perf)?.members || [])known.set(m.id,m);
  const cast=new Map(Object.entries(buildPtr(perf)).flatMap(([seat,p])=>known.has(p.mid)?[[seat,{...known.get(p.mid),seat}]]:[]));
  // 選んだ範囲に出番がなくても、演奏するときに座っていた部員は舞台に残す。
  for(const m of STAGE_PERFORMERS.get(perf)?.members || [])if(SEAT[m.seat]&&!cast.has(m.seat))cast.set(m.seat,{...m});
  return cast;
}
// 席ごとに音を並べておく（昔の録音やお手本でも、座っていた席が光るように）
function buildPtr(perf){
  const m = {};
  for(const n of perf.notes) (m[n.seat] ||= {mid: n.mid, notes: [], hits: [], i: 0, j: 0}).notes.push(n);
  for(const h of perf.hits) (m[h.seat] ||= {mid: h.mid, notes: [], hits: [], i: 0, j: 0}).hits.push(h);
  return m;
}
function levelAt(p, t){
  while(p.i < p.notes.length - 1 && p.notes[p.i].t + p.notes[p.i].d < t) p.i++;
  let lv = 0, err = 0, wrong = false;
  const n = p.notes[p.i];
  if(n && t >= n.t && t < n.t + n.d){ lv = interp(n.env, t - n.t); err = n.err; wrong = n.wrong; }
  while(p.j < p.hits.length && p.hits[p.j].t <= t) p.j++;
  const h = p.hits[p.j - 1];
  if(h){
    const d = h.dur || 0;
    lv = Math.max(lv, t < h.t + d ? lerp(h.v, h.v1 ?? h.v, (t - h.t) / Math.max(0.01, d)) : h.v * Math.exp(-(t - h.t - d) / 0.35));
  }
  return {lv, err, wrong};
}
// cv を渡すと、そのキャンバス（指揮の画面）に描く。who を渡すと、その部員だけが舞台にいる（本番の出場メンバー）
// 舞台の床とひな壇、指揮台
function stageFloor(g, G, C){
  // 指揮中は、床の細い線を減らし、部員と届く合図へ目線を集める。
  if(G.conducting){
    const bg=g.createLinearGradient(0,0,0,G.H);bg.addColorStop(0,C.sheet);bg.addColorStop(1,C.floorLine);g.fillStyle=bg;g.fillRect(0,0,G.W,G.H);
    g.strokeStyle=C.rule;g.lineWidth=1;g.globalAlpha=.4;
    for(let r=0;r<5;r++){const y=stageRowY(r,G)+G.r+20;g.beginPath();g.moveTo(12,y+6);g.quadraticCurveTo(G.cx,y-5,G.W-12,y+6);g.stroke();}
    g.globalAlpha=1;return;
  }
  /* 座席の座標はそのままに、奥の壁と木の床、控えめな照明を重ねる。 */
  g.fillStyle=C.paper;g.fillRect(0,0,G.W,G.H);
  const wall=g.createLinearGradient(0,0,0,G.H);wall.addColorStop(0,C.sheet);wall.addColorStop(1,C.paper);g.fillStyle=wall;g.fillRect(0,0,G.W,G.H);
  g.save();
  const floor=g.createLinearGradient(0,24,0,G.baseY+18);floor.addColorStop(0,C.floor);floor.addColorStop(1,C.floorLine);
  g.fillStyle=floor;g.beginPath();
  if(G.portraits){g.moveTo(0,G.H);g.lineTo(12,24);g.quadraticCurveTo(G.cx,0,G.W-12,24);g.lineTo(G.W,G.H);}
  else{g.moveTo(G.cx-G.R*.95,G.baseY+18);g.lineTo(G.cx-G.R,G.baseY-G.R*.62);g.quadraticCurveTo(G.cx,G.baseY-G.R*1.18,G.cx+G.R,G.baseY-G.R*.62);g.lineTo(G.cx+G.R*.95,G.baseY+18);}
  g.closePath();g.fill();g.clip();
  g.strokeStyle=C.floorLine;g.lineWidth=.7;g.globalAlpha=.55;
  for(let y=24;y<G.H;y+=18){g.beginPath();g.moveTo(0,y);g.lineTo(G.W,y);g.stroke();}
  for(const rr of G.portraits?[0,1,2,3,4]:[.45,.67,.88]){g.globalAlpha=.8;g.lineWidth=1.2;g.beginPath();if(G.portraits){const y=stageRowY(rr,G)+G.r+12;g.moveTo(12,y+5);g.quadraticCurveTo(G.cx,y-5,G.W-12,y+5);}else g.arc(G.cx,G.baseY,G.R*rr,Math.PI*1.08,Math.PI*1.92);g.stroke();}
  g.restore();
  g.fillStyle=C.brass;g.globalAlpha=.28;
  g.beginPath();g.moveTo(0,0);g.lineTo(34,0);g.quadraticCurveTo(32,34,0,58);g.closePath();g.fill();
  g.beginPath();g.moveTo(G.W,0);g.lineTo(G.W-34,0);g.quadraticCurveTo(G.W-32,34,G.W,58);g.closePath();g.fill();
  g.globalAlpha=1;g.fillStyle=C.ink;rrect(g,G.cx-19,G.baseY+2,38,13,4);g.fill();
  g.fillStyle=C.sheet;g.font=`700 9px ${C.fBody}`;g.textAlign='center';g.textBaseline='middle';g.fillText('指揮',G.cx,G.baseY+8.5);
}
function drawStage(t = -1, cv = $('#stage'), who = null){
  const main = cv.id === 'stage';
  const G = stageGeom(Math.max(240, cv.parentElement.clientWidth), true);
  G.conducting=cv.id==='cdStage'&&!$('#conduct').classList.contains('watch');
  if(G.conducting){G.H=Math.round(Math.min(G.H,Math.max(270,window.innerHeight*.39)));G.r=Math.min(G.r,(G.H-100)/4/3.7);}
  const {g, W, H} = fitCanvas(cv, G.H);
  const C = tok();
  if(G.conducting)Object.assign(C,C.conduct);
  stageFloor(g, G, C);

  const viewSec = main && U.view !== 'mel' ? U.view : null;
  const sel = main ? U.recordMember || (U.sel && memberById(U.sel)) : CD.sel && memberById(CD.sel);
  let portraits=0,focus=null;
  for(const s of SEATS){
    const [x, y] = seatXY(s, G);
    const cast=main ? (t>=0 ? U.stageMembers : null) : CD.stageMembers;
    const m = cast ? cast.get(s.id) : S.members.find(mm => mm.seat === s.id && (!who || who.has(mm.id)));
    const dim = viewSec && s.sec !== viewSec;
    g.globalAlpha = dim ? 0.3 : 1;
    const p = t >= 0 && U.ptr?.[s.id];
    if(p){
      const st = levelAt(p, t);
      if(st.lv > 0.02){
        const audible = E.pb ? E.pb.audible(p.mid, E.solo) : true;
        g.fillStyle = st.wrong || Math.abs(st.err) > 15 ? C.bad : C.brass;
        g.globalAlpha = (dim ? 0.15 : 0.22 + 0.45 * st.lv) * (audible ? 1 : 0.25);
        g.beginPath(); g.arc(x, y, G.r + 2 + st.lv * G.r * 0.7, 0, Math.PI * 2); g.fill();
        g.globalAlpha = dim ? 0.3 : 1;
      }
    }
    if(m){
      g.fillStyle = skillColor(C, avgStats(m));
      g.beginPath(); g.arc(x, y, G.r, 0, Math.PI * 2); g.fill();
      const painted=Faces.draw(g,m,x,y,G.r*2-2);if(painted)portraits++;
      g.strokeStyle=skillColor(C,avgStats(m));g.lineWidth=2;g.beginPath();g.arc(x,y,G.r,0,Math.PI*2);g.stroke();
      if(m.grade === 1){ g.strokeStyle = C.sheet; g.lineWidth = 1; g.beginPath(); g.arc(x, y, G.r - 1.7, 0, Math.PI * 2); g.stroke(); }
    } else {
      g.setLineDash([3, 3]); g.strokeStyle = C.soft; g.lineWidth = 1.2;
      g.beginPath(); g.arc(x, y, G.r - 1, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    }
    if(m && sel?.id === m.id)focus={s,m,x,y};
    drawInstrument(g,s.inst,x,y+G.r+11,18,m?C.ink:C.soft);
    g.globalAlpha = 1;
  }
  // 選んだ本人を最後に重ね、輪と楽器の囲みを周りの描画で隠さない。
  if(focus){
    const {s,m,x,y}=focus,r=Math.min(G.r+1.5,14);
    g.fillStyle=C.sheet;g.beginPath();g.arc(x,y,r+3,0,Math.PI*2);g.fill();
    g.fillStyle=skillColor(C,avgStats(m));g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();
    Faces.draw(g,m,x,y,r*2-2);
    g.strokeStyle=skillColor(C,avgStats(m));g.lineWidth=2;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.stroke();
    if(m.grade===1){g.strokeStyle=C.sheet;g.lineWidth=1;g.beginPath();g.arc(x,y,r-1.7,0,Math.PI*2);g.stroke();}
    g.strokeStyle=C.ink;g.lineWidth=1.5;g.beginPath();g.arc(x,y,r+2.5,0,Math.PI*2);g.stroke();
    g.fillStyle=C.ink;rrect(g,x-13,y+G.r+2.5,26,17,5);g.fill();
    drawInstrument(g,s.inst,x,y+G.r+11,15,C.sheet);
  }
  const selected=focus?.m.id||'';
  if(cv.dataset.selectedMember!==selected)cv.dataset.selectedMember=selected;
  if(cv.dataset.portraitCount!==String(portraits))cv.dataset.portraitCount=String(portraits);
}
function seatAt(ev, cv = $('#stage')){
  const rect = cv.getBoundingClientRect();
  const G = stageGeom(Math.max(240, rect.width),cv.id!=='asgStage');
  const px = ev.clientX - rect.left, py = ev.clientY - rect.top;
  let best = null, bd = Infinity;
  for(const s of SEATS){
    const [x, y] = seatXY(s, G);
    // 顔と楽器の中間から測り、楽器の囲みの下端でも下の列の人を選ばない。
    const d = Math.hypot(x - px, y + (G.portraits?(G.r+11)/2:0) - py);
    if(d < bd){ bd = d; best = s; }
  }
  return bd < (G.portraits?Math.max(24,G.r+13):G.r*1.6) ? best : null;
}

/* ===== 譜面台（音の見える化） ===== */
function viewNotes(perf){
  if(U.view === 'mel') return perf.notes.filter(n => n.role === 'mel');
  return perf.notes.filter(n => n.sec === U.view);
}
function viewHits(perf){
  if(U.view === 'mel') return perf.hits.filter(h => h.role === 'mel');
  return perf.hits.filter(h => h.sec === U.view);
}
function drawRoll(perf, t = -1){
  if(!$('#rollPanel').open) return;
  const {g, W, H} = fitCanvas($('#roll'), 260);
  const C = tok();
  if(!perf) return;
  const notes = viewNotes(perf), hits = viewHits(perf);
  const L = 38, Rm = 8;
  const X = s => L + (W - L - Rm) * s / perf.total;
  const MA = {y: 20, h: 168}, DY = {y: 200, h: 52};
  const ms = [...notes.map(n => n.midi), ...hits.filter(h => h.midi != null).map(h => h.midi)];
  let lo = ms.length ? Math.min(...ms) - 1.5 : 60, hi = ms.length ? Math.max(...ms) + 1.5 : 72;
  if(hi - lo < 10){ const c = (hi + lo) / 2; lo = c - 5; hi = c + 5; }
  const Y = m => MA.y + MA.h - (m - lo) / (hi - lo) * MA.h;
  const EX = Math.min(2.5, 40 / (hi - lo));
  g.textBaseline = 'middle'; g.font = `500 10px ${C.fBody}`; g.lineWidth = 1;
  for(let m = Math.ceil(lo); m <= hi; m++){
    if(m % 12 !== 0 && (hi - lo) > 18) continue;
    g.strokeStyle = C.rule; g.globalAlpha = m % 12 === 0 ? 1 : 0.5;
    g.beginPath(); g.moveTo(L, Math.round(Y(m)) + .5); g.lineTo(W - Rm, Math.round(Y(m)) + .5); g.stroke();
    g.globalAlpha = 1;
    if(m % 12 === 0 || (hi - lo) <= 18 && [0, 2, 4, 5, 7, 9, 11].includes(((m - PIECES[perf.pieceId].trans) % 12 + 12) % 12)){
      g.fillStyle = C.soft; g.textAlign = 'left'; g.fillText(NAME_DE[m % 12] + (m % 12 === 0 ? Math.floor(m / 12) - 1 : ''), 2, Y(m));
    }
  }
  const barW = (W - L - Rm) / Math.max(1, perf.bars.length), every = barW >= 18 ? 1 : barW >= 9 ? 2 : barW >= 4.5 ? 4 : 8;
  perf.bars.forEach((s, i) => {
    const x = Math.round(X(s)) + .5;
    g.strokeStyle = C.rule;
    g.beginPath(); g.moveTo(x, MA.y - 6); g.lineTo(x, DY.y + DY.h); g.stroke();
    const no = Math.round(perf.from / 4) + i + 1;
    if(i < perf.bars.length - 1 && (no === 1 || no % every === 0)){ g.fillStyle = C.soft; g.textAlign = 'left'; g.fillText(String(no), x + 3, MA.y - 11); }
  });
  g.fillStyle = C.soft; g.textAlign = 'left'; g.fillText('抑揚', 2, DY.y + 8);
  g.strokeStyle = C.rule; g.beginPath(); g.moveTo(L, DY.y + DY.h + .5); g.lineTo(W - Rm, DY.y + DY.h + .5); g.stroke();

  const selId = U.sel;
  // 譜読みの浅い区間に色をしく（部員を選んでいればその人、いなければ席についている部員の平均）
  if(perf.pieceId === S.pieceId && S.phase !== 'choose' && perf.b2t){
    const pc = PIECES[perf.pieceId], who = selId && memberById(selId);
    const rd = who ? readOf(who, perf.pieceId) : spanReadAvg(S, perf.pieceId);
    g.font = `500 10px ${C.fBody}`; g.textAlign = 'left';
    pc.spans.forEach((sp, i) => {
      const a = Math.max(sp.from, perf.from), b = Math.min(sp.to, perf.to);
      if(b <= a) return;
      const x0 = X(perf.b2t(a)), x1 = X(perf.b2t(b)), v = rd[i];
      if(v < 85){ g.fillStyle = v < 50 ? C.bad : C.warn; g.globalAlpha = 0.06 + 0.12 * (1 - v / 85); g.fillRect(x0, MA.y - 2, x1 - x0, MA.h + 4); }
      g.globalAlpha = 1; g.fillStyle = v < 50 ? C.bad : v < 85 ? C.warn : C.soft;
      if(x1 - x0 > 40) g.fillText(x1 - x0 > 110 ? `${spanShort(sp)} 譜読み${rankOf(v)}` : `譜読み${rankOf(v)}`, x0 + 4, MA.y + 8);
    });
    g.globalAlpha = 1;
  }
  const bh = clamp(MA.h / (hi - lo) * 0.7, 3, 8);
  for(const n of notes){
    const x0 = X(n.t), w = Math.max(2, X(n.t + n.d) - x0), y = Y(n.midi + (n.wrong ? 0 : n.err) * EX / 100);
    g.fillStyle = errColor(C, n.err, n.wrong);
    g.globalAlpha = selId && n.mid !== selId ? 0.35 : 0.8;
    rrect(g, x0, y - bh / 2, w, bh, Math.min(3, bh / 2)); g.fill();
    if(n.crack){
      g.globalAlpha = 1; g.fillStyle = C.bad;
      g.beginPath(); g.moveTo(x0, y - bh / 2 - 2); g.lineTo(x0 + 6, y - bh / 2 - 9); g.lineTo(x0 - 3, y - bh / 2 - 9); g.closePath(); g.fill();
    }
  }
  for(const h of hits){
    const x = X(h.t), y = h.midi != null ? Y(h.midi) : MA.y + MA.h * 0.5;
    g.globalAlpha = selId && h.mid !== selId ? 0.35 : 0.85;
    g.fillStyle = h.wrong ? C.bad : C.brass;
    if(h.roll){ rrect(g, x, y - 3, Math.max(3, X(h.t + h.dur) - x), 6, 3); g.fill(); }
    else { g.beginPath(); g.arc(x, y, 2.5 + h.v * 3, 0, Math.PI * 2); g.fill(); }
  }
  g.globalAlpha = 1;

  // 抑揚：実際の強さ（実線）と、指揮者の理想（点線）
  const yD = v => DY.y + DY.h - v * DY.h;
  g.font = `italic 600 11px ${C.fHand}`; g.fillStyle = C.soft; g.textAlign = 'right';
  for(const [v, nm] of [[.8, 'f'], [.5, 'mf'], [.2, 'p']]) g.fillText(nm, L - 4, yD(v));
  if(U.view === 'mel'){
    g.strokeStyle = C.brass; g.lineWidth = 1.5; g.setLineDash([4, 4]);
    g.beginPath(); perf.ideal.forEach(([s, v], i) => i ? g.lineTo(X(s), yD(v)) : g.moveTo(X(s), yD(v))); g.stroke();
    g.setLineDash([]);
  }
  g.strokeStyle = C.ink; g.lineWidth = 2;
  g.beginPath();
  let pen = false;
  for(let s = 0; s <= perf.total; s += 0.2){
    let sum = 0, k = 0;
    for(const n of notes){ if(s >= n.t && s < n.t + n.d){ sum += interp(n.env, s - n.t); k++; } }
    if(k){ const y = yD(sum / k); pen ? g.lineTo(X(s), y) : g.moveTo(X(s), y); pen = true; } else pen = false;
  }
  g.stroke();
  if(t >= 0){
    const x = X(Math.min(t, perf.total));
    g.strokeStyle = C.brass; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, MA.y - 14); g.lineTo(x, DY.y + DY.h); g.stroke();
  }
}
function rrect(g, x, y, w, h, r){
  r = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

function drawIdle(){
  if(U.playing) return;
  drawStage(-1);
  drawRoll(U.shown, -1);
}

/* ===== 上部：カレンダー・曲・会場 ===== */
function seasonEnd(){
  if(S.finalWeek) return S.finalWeek;
  const qualified = lvl => S.season.some(r => r.level === lvl && r.rep);
  if(qualified('block') || S.week > BLOCK_WEEK) return NATIONAL_WEEK;
  if(qualified('pref') || S.week > PREF_WEEK) return BLOCK_WEEK;
  return PREF_WEEK;
}
function renderHeader(){
  $('#school').textContent = `県立みなと高校 吹奏楽部　${S.year}年度`;
  $('.lede').hidden = !(foundingYear(S) && S.phase === 'choose');
  const ol = $('#cal');
  ol.innerHTML = '';
  const last = seasonEnd();
  for(let w = 0; w <= last; w++){
    const li = document.createElement('li');
    const ev = eventAt(S, w);
    if(ev?.kind === 'contest'){ li.className = 'contest'; li.textContent = {pref: '県', block: '支部', national: '全国'}[ev.level]; }
    else if(ev?.kind === 'concert'){ li.classList.add('show');li.innerHTML=uiIcon('note'); }
    else if(ev){li.classList.add('ev');li.innerHTML=uiIcon('event');}
    if(S.phase !== 'choose' && w < S.week) li.classList.add('done');
    if(S.phase === 'week' && w === S.week) li.classList.add('now');
    if(S.phase === 'end' && w > S.week) li.classList.add('later');
    li.title = wkLabel(w) + (ev ? `：${ev.title}` : '');
    if(w % 4 === 0){ const mo = document.createElement('span'); mo.className = 'mo'; mo.textContent = `${wkMonth(w)}月`; li.appendChild(mo); }
    ol.appendChild(li);
  }
  // 冬（11月 新体制・1月 アンサンブルコンテスト・3月 卒業式）。月ごとにまとめて進むので、1マスずつ
  WINTER_STEPS.forEach((st, k) => {
    const li = document.createElement('li'), step = S.phase === 'winter' ? S.winter.step : -1;
    li.className = 'wint' + (st.id !== 'plan' ? ' ev' : '') + (step > k ? ' done' : '') + (step === k ? ' now' : '');
    li.title = `${st.m}月：${st.title}`;
    if(st.id!=='plan')li.insertAdjacentHTML('afterbegin',uiIcon(st.id==='grad'?'star':'award'));
    if(!k){ const mo = document.createElement('span'); mo.className = 'mo'; mo.textContent = '冬'; li.appendChild(mo); }
    ol.appendChild(li);
  });
  if(S.phase === 'choose' || S.phase === 'chooseSet'){ $('#weekNow').textContent = `${S.year}年 4月・選曲会議`; $('#weeksLeft').textContent = '県大会まで16週'; return; }
  if(S.phase === 'end'){ $('#weekNow').textContent = `${S.year}年度の本番がすべて終わった`; $('#weeksLeft').textContent = ''; return; }
  if(S.phase === 'winter'){ const st = winterStep(S); $('#weekNow').textContent = `${S.year}年度 ${st.m}月`; $('#weeksLeft').textContent = `冬のあいだ（${S.winter.step + 1}／${WINTER_STEPS.length}）`; return; }
  $('#weekNow').textContent = wkLabel(S.week);
  let nx = null;
  for(let w = S.week; w <= last; w++){ const ev = eventAt(S, w); if(ev && (ev.kind === 'concert' || ev.kind === 'contest')){ nx = [w, ev]; break; } }
  $('#weeksLeft').textContent = nx ? (nx[0] === S.week ? `今週は本番：${nx[1].title}` : `次の本番「${nx[1].title}」まで${nx[0] - S.week}週`) : '';
}
function renderPiece(){
  const recorded=recordingPlayback(), ensemble=ensembleListening(), pid = recorded?U.shown.pieceId:playPiece(), pc = PIECES[pid];
  $('#btnConduct').disabled=!!ensemble||recorded||busy();
  // A部門でコンクールまでは、自由曲と課題曲を切りかえて聴ける
  const two = !recorded && setActive(S) && S.phase === 'week';
  $('#pieceSwitch').hidden = !two;
  if(two) $('#pieceSwitch').innerHTML = [[S.pieceId, '自由曲'], [S.setPiece, '課題曲']].map(([id, nm]) => `<button type="button" data-pswitch="${id}" aria-pressed="${pid === id}">${nm}：${esc(PIECES[id].title)}</button>`).join('');
  $('#pieceEyebrow').textContent = ensemble ? 'アンサンブルの試聴' : recorded ? '録音' : two && pid === S.setPiece ? '課題曲' : S.phase === 'choose' || S.phase === 'chooseSet' || pid !== S.pieceId ? '試しに聴く曲' : S.finalWeek ? '定期演奏会の曲' : '自由曲';
  $('#pieceDifficulty').innerHTML = difficultyBadge(pid);
  $('#piece').textContent = pc.title;
  $('#piece').setAttribute('data-tip',pc.full);$('#piece').setAttribute('data-tipname','曲名');$('#piece').setAttribute('role','button');$('#piece').tabIndex=0;
  $('#pieceMeta').textContent = `${pc.composer}｜問われる力：${pc.asks}`;
  $('#rangeSel').disabled=!!ensemble||recorded;
  if(recorded) $('#rangeSel').innerHTML=`<option value="recorded">${recordedRangeLabel(U.shown)}</option>`;
  else{
    const rd = (pid === S.pieceId || (two && pid === S.setPiece)) && S.phase !== 'choose' ? spanReadAvg(S, pid) : null;
    $('#rangeSel').innerHTML = `<option value="all">全部</option>` + pc.spans.map((sp, i) => `<option value="${i}">${sp.name}${rd ? `（譜読み${rankOf(rd[i])}）` : ''}</option>`).join('');
    $('#rangeSel').value = U.range;
  }
  renderListeningSummary();
}
function renderVenues(){
  $('#venueSel').innerHTML = VENUES.map(v => `<option value="${v.id}">${v.name}</option>`).join('');
  $('#venueSel').value = U.venue;
  renderListeningSummary();
}
function renderListeningSummary(){
  const pc = PIECES[playPiece()], range = recordingPlayback()?recordedRangeLabel(U.shown):U.range === 'all' ? '全部' : pc?.spans[Number(U.range)] ? spanShort(pc.spans[Number(U.range)]) : '全部';
  const solo = $('#soloSel').selectedOptions[0]?.textContent || '全員';
  $('#listeningSummary').textContent = [VENUE[U.venue].name, range, solo].join('・');
}
function renderSelectors(){
  const recs = S.recs.slice().reverse(), previous = $('#recSel').value;
  $('#recSel').innerHTML = recs.length ? recs.map(r => `<option value="${r.id}">${esc(r.label)}</option>`).join('') : '<option value="">録音はまだない</option>';
  if(recs.some(r => r.id === previous)) $('#recSel').value = previous;
  $('#recSel').disabled = !recs.length;
  $('#recordingCount').textContent = recs.length ? `${recs.length}件` : 'まだない';
  $('#btnRec').disabled = !recs.length;
  $('#btnSave').disabled = !recs.length;
  const active = U.waitPlay?.perf || (U.playing ? U.shown : null), cast = active && STAGE_PERFORMERS.get(active);
  const recSolo = cast?.recorded && U.solo.startsWith('member:') ? cast.members.find(m => m.id === U.solo.slice(7)) : null;
  const sel = recSolo || U.recordMember || (U.sel && memberById(U.sel));
  $('#soloSel').innerHTML = `<option value="all">全員</option>` + SECTIONS.map(s => `<option value="sec:${s.id}">${s.name}だけ</option>`).join('')
    + (sel ? `<option value="member:${sel.id}">${esc(sel.name)}だけ</option>` : '');
  if(![...$('#soloSel').options].some(o => o.value === U.solo)){ U.solo = 'all'; applySolo(); }
  $('#soloSel').value = U.solo;
  $('#viewSel').innerHTML = `<option value="mel">旋律を吹いている部員</option>` + SECTIONS.map(s => `<option value="${s.id}">${s.name}パート</option>`).join('');
  $('#viewSel').value = U.view;
  renderListeningSummary();
  renderRecordingLibrary();
}
function applySolo(){
  const [type, id] = U.solo.split(':');
  E.setSolo(type === 'all' ? {type: 'all'} : {type: type === 'sec' ? 'sec' : 'member', id});
}
// 録音の参照は演奏の外に持ち、同じ題名の別の録音でも取り違えない。
function activeLibraryRecording(){
  const perf=U.waitPlay?.perf || (U.playing?U.shown:null);
  return perf?STAGE_PERFORMERS.get(perf)?.record:null;
}
const libraryBlocked=()=>busy() || CD.phase!=='idle';
function recordingRangeNote(rec){
  if(!rec.span)return '';
  const pc=PIECES[rec.pieceId],from=rec.span.from??0,to=rec.span.to??pc.beats;
  if(from===0 && to===pc.beats)return '';
  const span=pc.spans.find(s=>Math.abs(s.from-from)<1e-6&&Math.abs(s.to-to)<1e-6);
  return span?spanShort(span):'録音の範囲';
}
function renderRecordingLibrary(){
  const list=$('#recordingList');if(!list || !S)return;
  const recs=S.recs.slice().reverse(),seed=String(S.recruitSeed||0),active=activeLibraryRecording(),perf=U.waitPlay?.perf || (U.playing?U.shown:null);
  $('#btnLiveNow').hidden=!active;$('#btnConduct').hidden=!!active;
  if(U.librarySeed!==seed){U.librarySeed=seed;U.libraryKey=null;U.libraryPerf=null;list.scrollTop=0;}
  if(active && perf!==U.libraryPerf && recs.some(r=>r.id===active.id))$('#recSel').value=active.id;
  U.libraryPerf=perf;
  const key=JSON.stringify(recs.map(r=>[r.id,r.label,r.year,r.pieceId,r.venue,r.span,r.snap?.members?.length,(r.snap?.members||[]).slice(0,3).map(m=>[m.id,m.name,m.originalName])]));
  if(U.libraryKey!==key){
    const top=list.scrollTop,years=new Map();
    for(const r of recs){const y=Number.isFinite(Number(r.year))?String(r.year):'';if(!years.has(y))years.set(y,[]);years.get(y).push(r);}
    list.innerHTML=[...years].sort(([a],[b])=>Number(b)-Number(a)).map(([y,rs])=>`<section class="recording-year"><h3>${y?`${esc(y)}年度`:'録音'}</h3>${rs.map(r=>{
      const title=String(r.label||'').replace(new RegExp(`^${Number(r.year)}年?(?:度)?\\s+`),'')||PIECES[r.pieceId].title,people=r.snap?.members||[],range=recordingRangeNote(r),song=PIECES[r.pieceId].title+(range?'・'+range:''),venue=VENUE[r.venue]?.name||'';
      const label=`${r.label}・${song}${venue?'・'+venue:''}`;
      return `<div class="recording-item" data-record-item="${esc(r.id)}"><button class="recording-play" type="button" data-record-play="${esc(r.id)}" data-record-label="${esc(label)}" aria-pressed="false"><span class="recording-copy"><b>${esc(title)}</b><small class="recording-song">${esc(song)}</small><span class="recording-meta"><small>${esc(venue)}${people.length?'・'+people.length+'人':''}</small><span class="recording-faces" aria-hidden="true">${people.slice(0,3).map(m=>memberFace(m,20)).join('')}</span></span></span><span class="recording-state" aria-hidden="true">${uiIcon('play')}</span></button><button class="recording-save" type="button" data-record-save="${esc(r.id)}" aria-label="${esc(label)}を保存" title="保存">${uiIcon('download')}</button></div>`;
    }).join('')}</section>`).join('') || '<p class="small recording-empty">録音はまだない</p>';
    U.libraryKey=key;list.scrollTop=top;
  }
  const blocked=libraryBlocked();
  for(const b of list.querySelectorAll('[data-record-play]')){
    const on=active?.id===b.dataset.recordPlay,state=String(on);
    if(b.getAttribute('aria-pressed')!==state){b.setAttribute('aria-pressed',state);b.querySelector('.recording-state').innerHTML=uiIcon(on?'stop':'play');}
    const row=b.closest('.recording-item');if(row.dataset.active!==state)row.dataset.active=state;
    if(b.disabled!==blocked)b.disabled=blocked;
    const label=`${b.dataset.recordLabel}を${on?(U.waitPlay?'読み込みをやめる':'止める'):'聴く'}`;
    if(b.getAttribute('aria-label')!==label)b.setAttribute('aria-label',label);
  }
  const saving=blocked || !!U.saving || !!U.librarySaving;
  for(const b of list.querySelectorAll('[data-record-save]'))if(b.disabled!==saving)b.disabled=saving;
}
// 一覧の再生は全員の音から。別の本人だけの指定や、前の読み込み待ちは残さない。
function listenLibraryRecording(id){
  if(libraryBlocked())return;
  const rec=S.recs.find(r=>r.id===id);if(!rec)return;
  $('#recSel').value=id;
  if(activeLibraryRecording()?.id===id){stopPlay();return;}
  stopPlay();U.solo='all';U.sel=null;U.recordMember=null;U.recordPerf=null;U.cardReturn=null;
  applySolo();renderSelectors();renderMemberCard();renderRoster();playRec(id);
}
async function saveLibraryRecording(id){
  if(libraryBlocked() || U.saving || U.librarySaving)return;
  const rec=S.recs.find(r=>r.id===id);if(!rec)return;
  const origin=document.activeElement;
  $('#recSel').value=id;U.librarySaving=id;renderRecordingLibrary();
  try{await saveRecording(rec);}finally{
    U.librarySaving=null;renderRecordingLibrary();
    if(document.activeElement===document.body && origin?.isConnected && !origin.disabled && $('#recordingPanel').open && !tabHidden('play'))origin.focus({preventScroll:true});
  }
}

/* ===== ホワイトボード ===== */
// 数字を押すと出る説明（ふわっと出る吹き出し）。キーは画面に出ている名前
const TIPS = {
  'ランク': '力は G・F・E・D・C・B・A・S の8段階。右ほどうまい。入部したては G か F、3年生でふつうは B、いちばんうまい子で S。ランクが上がった週は光る',
  '音程': '音の高さが合っているか。合わないと和音がにごり、うなりが出る。チューニングの練習で伸びる',
  'リズム': '拍どおりに吹けるか。出だしやテンポがそろう。メトロノームの練習で伸びる',
  '音色': '息の支えと、音のきれいさ。低いと音が裏返る。ロングトーンで伸びる',
  '表現': '強弱やフレーズの歌い方。フレーズ練習で伸びる（音程・リズム・音色の基礎が要る）',
  'まとまり': 'みんなで合わせる力。パートどうしの出だしがそろい、指揮についていける。合奏でしか伸びない',
  '譜読み': '一人ひとりが、この曲の自分の楽譜をどれだけ吹けるか（平均）。低いと音を間違え、テンポが揺れる。曲の練習で7割まで、そこから先は合奏でしか伸びない',
  '課題曲の譜読み': '課題曲の楽譜をどれだけ吹けるか（平均）。曲の練習の配分で、自由曲と分けて伸びる',
  '体力': '練習で減って、休むと戻る。30を切った部員は、練習の効果が半分になる',
  'やる気': '高いほど練習の効果が上がる。休む・合奏・本番の成功で上がる',
  '会場慣れ': 'ホールで吹いた経験。高いほど大きな会場で緊張しにくい。「会場で合奏」で上がり、週ごとに少し下がる',
  '評判': '演奏会やコンクールで上がる。上がるほど入部したい生徒が来る',
  '顧問の指導力': 'あなたの指導の経験。練習・本番・できごとでたまり、レベルが上がると練習の効果が上がって、本番の緊張も少しやわらぐ',
  '部員の力の平均': '席についている部員の、音程・リズム・音色・表現の平均。点線は去年の同じころ。春は1年生が入るので、いったん下がる',
};
TIPS['自由曲の譜読み'] = TIPS['譜読み'];
TIPS['見せる楽器'] = `演奏で目立たせる楽器（${SHOW_MAX}つまで）。入部する1年生は、見せた楽器を吹きたがりやすい。点線の楽器は、部にまだ一人もいない`;
// 合奏の診断（いまの演奏の点）
const DIAG_TIPS = {...Object.fromEntries(STAT_KEYS.map(k => [k, `いまの演奏の${STAT_LABEL[k]}の点。${STAT_DESC[k]}を聴いている`])),
  balance: 'いまの演奏のバランスの点。旋律が伴奏に埋もれずに聞こえるか、パートの音量がつり合っているか'};
const tipAttr = (name, text = TIPS[name]) => text ? ` data-tip="${esc(text)}" data-tipname="${esc(name)}" role="button" tabindex="0"` : '';
function statRow(name, v, desc, delta, cls, tip){
  const up = delta ? `<span class="delta">+${delta}</span>` : '';
  return `<div class="stat"${tipAttr(name, tip)}><span class="nm">${name}${desc ? '' : up}</span><span class="track"><span class="fill${cls ? ' ' + cls : ''}" style="width:${clamp(v, 0, 100)}%"></span></span><span class="val">${Math.round(v)}</span>${desc ? `<span class="ds">${desc}${up}</span>` : ''}</div>`;
}
// 顧問の指導力：レベル・呼び名・練習の効果と、次のレベルまでの経験
function coachHtml(){
  const lv = coachLevel(S), xp = S.coach?.xp || 0, a = coachNeed(lv), b = coachNeed(lv + 1);
  const pct = lv >= 12 ? 100 : clamp((xp - a) / (b - a) * 100, 0, 100);
  return `<div class="vital coach"${tipAttr('顧問の指導力')}><span class="row"><span>顧問の指導力</span><b>Lv${lv}</b></span><span class="track"><span class="fill" style="width:${pct}%"></span></span>
    <small>${coachTitle(lv)}・練習の効果 +${Math.round((coachMult(S) - 1) * 100)}%</small></div>`;
}
// 部員の力の平均（音程・リズム・音色・表現）の、今年と去年の週ごとの線。下に月、県大会の週に印
function trendSvg(){
  const tr = S.trend || [], now = tr.filter(x => x.y === S.year), prev = tr.filter(x => x.y === S.year - 1);
  if(now.length < 2 && prev.length < 2) return '';
  const last = Math.max(PREF_WEEK + 2, ...tr.filter(x => x.y >= S.year - 1).map(x => x.w));
  const W = 300, H = 80, X = w => 6 + (W - 12) * w / last, Y = v => H - 6 - (H - 12) * clamp(v, 0, 100) / 100;
  const pct = w => (X(w) / W * 100).toFixed(1);
  const line = pts => pts.map((x, i) => `${i ? 'L' : 'M'}${X(x.w).toFixed(1)},${Y(x.a).toFixed(1)}`).join('');
  const cur = now[now.length - 1], was = cur && prev.filter(x => x.w <= cur.w).pop();
  const months = [];
  for(let w = 0; w <= last; w += 4) months.push(`<span style="left:${pct(w)}%">${wkMonth(w)}月</span>`);
  return `<figure class="trend"${tipAttr('部員の力の平均')}><figcaption><span class="tr-t">部員の力の平均</span>${cur ? `${rankBadge(cur.a)}` : ''}${was ? `<small>去年のいまごろ ${rankBadge(was.a)}</small>` : ''}
    <span class="tr-k"><span class="k-avg">今年</span>${prev.length > 1 ? '<span class="k-prev">去年</span>' : ''}</span></figcaption>
    <div class="tr-plot"><span class="tr-ev" style="left:${pct(PREF_WEEK)}%">県大会</span>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="部員の力の平均の、今年と去年の伸び">
      ${[25, 50, 75].map(v => `<line x1="6" x2="${W - 6}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/>`).join('')}
      <line x1="${X(PREF_WEEK).toFixed(1)}" x2="${X(PREF_WEEK).toFixed(1)}" y1="0" y2="${H}" class="mk"/>
      ${prev.length > 1 ? `<path d="${line(prev)}" class="prev"/>` : ''}
      ${now.length > 1 ? `<path d="${line(now)}" class="avg"/>` : ''}
    </svg><div class="tr-x">${months.join('')}</div></div></figure>`;
}
function renderStats(){
  const ms = seated(S);
  $('#memberCount').textContent = `${S.members.length}人${S.members.length > ms.length ? `（控え${S.members.length - ms.length}人）` : ''}／${SEATS.length}席`;
  const d = S.lastDelta || {};
  const pid = S.pieceId || playPiece();
  const row = (nm, v, dv) => rankRow(nm, v, dv > 0 && v >= dv && rankOf(v - dv) !== rankOf(v));
  $('#stats').innerHTML = STAT_KEYS.map(k => row(STAT_LABEL[k], bandAvg(S, k), d[k])).join('')
    + row('まとまり', S.cohesion, d.coh)
    + (S.pieceId ? row(setActive(S) ? '自由曲の譜読み' : '譜読み', readAvg(S, pid), d.read) : '')
    + (setActive(S) ? row('課題曲の譜読み', readAvg(S, S.setPiece), d.setRead) : '');
  const vital = (nm, v) => {
    const c = v >= 60 ? 'good' : v >= 30 ? 'warn' : 'bad';
    return `<div class="vital"${tipAttr(nm)}><span class="row"><span>${nm}</span><b>${Math.round(v)}</b></span><span class="track"><span class="fill ${c}" style="width:${clamp(v, 0, 100)}%"></span></span></div>`;
  };
  const nx = nextRepStep(S);
  $('#vitals').innerHTML = vital('体力', S.stamina) + vital('やる気', S.morale) + vital('会場慣れ', S.hallExp)
    + `<div class="vital rep"${tipAttr('評判')}><span class="row"><span>評判</span><b>${Math.round(S.rep ?? 0)}</b></span><span class="track"><span class="fill" style="width:${clamp(S.rep ?? 0, 0, 100)}%"></span></span><small>${nx ? `${nx}をこえると、入部したい生徒が来る` : '県内に知られた部'}</small></div>`
    + coachHtml()
    + trendSvg();
}
function renderDiag(){
  const a = U.diag;
  U.diagPerf=U.perfNow;U.diagAt=`${S.recruitSeed||0}:${S.year}:${S.week}:${playPiece()}`;
  $('#diagVenue').textContent = `${VENUE[U.venue].name}・${PIECES[playPiece()].title}`;
  if(!a){ $('#diag').innerHTML = ''; renderDiagPractice(); return; }
  $('#diag').innerHTML = Object.keys(DIM_LABEL).map(k => {
    const v = a.score[k], c = v >= 70 ? 'good' : v >= 45 ? 'warn' : 'bad';
    return statRow(DIM_LABEL[k], v, k === 'tone' && a.cracks ? `音の裏返り ${a.cracks}回` : '', '', c, DIAG_TIPS[k]);
  }).join('');
  const dims = Object.keys(DIM_LABEL);
  const weak = dims.reduce((x, y) => a.score[x] <= a.score[y] ? x : y);
  const strong = dims.reduce((x, y) => a.score[x] >= a.score[y] ? x : y);
  const notes = [];
  if(a.score[weak] < 72) notes.push(commentFor(weak, a, false));
  if(a.score[strong] >= 70) notes.push(commentFor(strong, a, true));
  if(a.wrong) notes.push(`まだ譜読みが終わっておらず、${a.wrong}か所で音を間違えている。`);
  $('#diagNote').textContent = notes.join(' ') || '大きな問題はない。ここからは細部の磨き込み。';
  renderDiagPractice();
}
// 診断の点を個人の原因と決めつけず、今の部員の力から練習を見直す。
function diagPracticeView(){
  if(!S)return null;
  const active=U.waitPlay?.perf || (U.playing?U.shown:null),pid=playPiece();
  if(S.phase!=='week' || S.pending || U.lineup || !U.diag || !$('#week .plan') || ![S.pieceId,...(setActive(S)?[S.setPiece]:[])].includes(pid) || U.diagPerf?.pieceId!==pid || active&&active!==U.diagPerf)return null;
  const key=`${S.recruitSeed||0}:${S.year}:${S.week}:${pid}`;if(U.diagAt!==key)return null;
  const members=stagers(S);if(!members.length)return null;
  return {pid,members,key};
}
function renderDiagPractice(){
  const el=$('#diagPractice');if(!el)return;
  const view=diagPracticeView();el.hidden=!view;el.dataset.piece=view?.pid||'';if(!view)return;
  if(U.diagPractice?.key!==view.key){
    const topic=U.diag.wrong?'fam':STAT_KEYS.reduce((a,b)=>U.diag.score[a]<=U.diag.score[b]?a:b);
    U.diagPractice={key:view.key,topic};el.open=false;U.diagReturn=null;
  }
  const state=U.diagPractice,labels={fam:'譜読み',...STAT_LABEL},value=m=>state.topic==='fam'?readMean(m,view.pid):m.stats[state.topic];
  const members=view.members.slice().sort((a,b)=>value(a)-value(b)).slice(0,3);
  const html=`<summary><span>${uiIcon('week')}練習を見直す</span><span class="diag-peek" aria-hidden="true">${members.map(m=>memberFace(m,20)).join('')}</span></summary><div class="diag-topics" role="group" aria-label="練習を見直す力">${['fam',...STAT_KEYS].map(k=>`<button type="button" data-diag-topic="${k}" aria-pressed="${state.topic===k}">${labels[k]}</button>`).join('')}<button type="button" aria-label="練習の見直しについて"${tipAttr('練習の見直し','いまの部員の力を低い順に3人まで表示。演奏の点には体力や譜読みも効く。顔を押すと今週の練習へ進む。曲の練習は今週の配分のまま。選ぶまでは指示を変えない。')}>?</button></div><div class="diag-people">${members.map(m=>`<button class="diag-person" type="button" data-diag-member="${esc(m.id)}" aria-label="${esc(m.name)} ${labels[state.topic]} ${rankOf(value(m))}、今週の練習を見る">${memberFace(m,36)}<span><b>${esc(m.name)}</b><small>${m.grade}年・${esc(instOf(m))}</small></span>${rankBadge(value(m))}${uiIcon('chevron')}</button>`).join('')}</div>`;
  if(U.diagHtml!==html){el.innerHTML=html;U.diagHtml=html;}
}
function openDiagPracticeMember(mid){
  const view=diagPracticeView(),m=view?.members.find(m=>m.id===mid);if(!m || !document.querySelector(`[data-practice-row="${mid}"]`))return;
  const topic=U.diagPractice.topic;
  U.diagReturn={key:view.key,mid,scroll:scrollY,menu:topic==='fam'?(readMean(m,view.pid)>=70?'tutti':'piece'):{pitch:'tune',rhythm:'metro',tone:'long',expr:'phrase'}[topic]};
  hideTip();setTab('week');focusPracticeMember(mid,'diag');
}
function returnToDiagPractice(mid){
  const back=U.diagReturn;U.diagReturn=null;
  if(!back || back.mid!==mid || diagPracticeView()?.key!==back.key)return false;
  renderDiagPractice();
  const target=document.querySelector(`[data-diag-member="${mid}"]`);if(!target)return false;
  setTab('play');
  target.focus({preventScroll:true});window.scrollTo(0,back.scroll);return true;
}
// 舞台袖：部全体の空気と、緊張している部員。声をかける・全員で深呼吸する（あわせて2回まで）
function wingsHtml(){
  if(!S.stageDay) return '';
  const tense = tenseMembers(S), calm = S.stageDay.calm, left = 2 - wingActions(S), zb = bandForm(S);
  const mood = S.stageDay.huddle ? '全員で深呼吸をして、空気が少しやわらいだ。' : zb > 0.8 ? '部全体が硬くなっている。話し声もほとんどない。' : zb < -0.8 ? 'みんないい顔をしている。小声で冗談を言い合う余裕もある。' : 'みんな静かに出番を待っている。';
  const rows = tense.map(m => `<li class="wing-person">${memberFace(m,40)}<span>${calm.includes(m.id) ? `${esc(m.name)}（${esc(instOf(m))}）は、深呼吸して少し落ち着いた。` : `${esc(m.name)}（${esc(instOf(m))}）の手が震えている。`}</span>${calm.includes(m.id) ? '' : `<button class="btn small" type="button" data-act="calm" data-mid="${m.id}"${left ? '' : ' disabled'}>声をかける</button>`}</li>`).join('');
  return `<div class="wings"><span class="tag">舞台袖</span><ul><li><span>${mood}</span>${S.stageDay.huddle ? '' : `<button class="btn small" type="button" data-act="huddle"${left ? '' : ' disabled'}>全員で深呼吸する</button>`}</li>${rows}</ul>
    <p class="small">できるのはあわせて2回まで。本番の強さ（メンタル）は、場数を踏むほど上がる。</p></div>`;
}
// 新入生歓迎演奏で見せる楽器（押して選ぶ）。席の空いている楽器だけ。点線は、部にまだいない楽器
function showHtml(){
  const on = showSecs(S), n = sec => S.members.filter(m => m.seat && SEAT[m.seat].sec === sec).length;
  const secs = SECTIONS.filter(x => SEATS.filter(y => y.sec === x.id).length > n(x.id));
  return `<div class="showinst"><span class="small"${tipAttr('見せる楽器')}>見せる楽器</span><div class="chips">${secs.map(x => `<button class="chip${n(x.id) ? '' : ' none'}" type="button" data-act="show" data-sec="${x.id}" aria-pressed="${on.includes(x.id)}">${x.name}</button>`).join('')}</div></div>`;
}
// 本番のあと：緊張に飲まれた部員と、いつも以上の音を出した部員
function mentalNote(p){
  const nm = kind => (p.mental || []).filter(x => x.kind === kind).map(x => memberById(x.mid)?.name).filter(Boolean).map(esc);
  const fr = nm('freeze'), zn = nm('zone');
  if(!fr.length && !zn.length) return '';
  return `<p class="small mental-note">${fr.length ? `緊張で頭が真っ白に：${fr.join('、')}` : ''}${fr.length && zn.length ? '　' : ''}${zn.length ? `いつも以上の音：${zn.join('、')}` : ''}</p>`;
}
// 本番の大きさ（緊張のしやすさ）。その日の部員の様子は舞台袖（wingsHtml）に出す
function moodText(n){
  return n <= 3 ? '気楽な本番。いつもの力を出しやすい。' : n <= 6 ? '大事な本番。緊張で、実力より少し下がりそうだ。' : '大きな本番。緊張で、実力を出しきれないかもしれない。';
}
// はじめての人への案内：顧問になった最初の1か月だけ、次に押すボタンを光らせる（文字は足さない）
const GUIDE_WEEKS = 3, GUIDE_ACTS = ['assign', 'reveal', 'next', 'stage', 'practice'];
function renderWeek(){
  renderWeekBody();
  renderDiagPractice();
  // 長い説明は見出しの吹き出しへ。文章そのものは保持する。
  const intro=$('#week .plan > p.small:first-child');
  if(intro){ $('#h-week').insertAdjacentHTML('beforeend', '<button class="help-button" type="button"'+tipAttr('今週の練習',intro.textContent)+'>?</button>');intro.hidden=true; }
  for(const focus of document.querySelectorAll('#week .focus')){const desc=focus.querySelector(':scope>.small'),label=focus.querySelector(':scope>span:first-child');if(desc&&label){label.setAttribute('data-tip',desc.textContent);label.setAttribute('data-tipname',label.textContent);label.setAttribute('role','button');label.tabIndex=0;desc.hidden=true;}}
  if(!foundingYear(S) || S.week > GUIDE_WEEKS) return;
  const w = $('#week');
  const b = GUIDE_ACTS.map(a => w.querySelector(`[data-act="${a}"]:not([disabled])`)).find(Boolean)
    || w.querySelector('.tag.fit ~ .row [data-act="choose"]') || w.querySelector('[data-act="choose"]');
  b?.classList.add('guide');
}
function renderWeekBody(){
  const w = $('#week'), ev = eventAt(S, S.week);
  const head = $('#h-week');
  if(recruitsDue(S) && !S.pending){
    head.textContent = S.phase === 'choose' && foundingYear(S) && !S.members.length ? '最初の部員' : '新しい部員';
    return renderAssign(w, ev);
  }
  if(S.phase === 'winter'){ head.textContent = `${winterStep(S).m}月・${winterStep(S).title}`; return renderWinter(w); }
  if(S.phase === 'choose'){
    head.textContent = '選曲会議';
    const fit = pieceFit();
    const A = divisionFor(S) === 'A';
    w.innerHTML = `<div class="event"><span class="tag">${A ? 'A部門' : 'B部門'}</span><span>${A ? `部員が${A_MIN}人以上いるので、今年はA部門。自由曲のあと、課題曲も選ぶ。2曲で、支部大会・全国大会を目指せる。` : `部員が${A_MIN}人より少ないので、今年はB部門。自由曲だけで、県大会まで。年度のはじめに${A_MIN}人以上いれば、A部門で全国大会を目指せる。`}</span></div>
      <p class="small">コンクールの自由曲を決めよう。「お手本」はうまい部の演奏、「いまの部で」はいまの部員の音。「部の得意に合う」曲は、部員の得意な力が採点で重く見られる。</p>`
      + PIECE_IDS.map(id => pieceCard(id, {tag: fit[id] ? `部の得意に合う（${fit[id]}）` : '', act: 'choose', label: '決める'})).join('');
    return;
  }
  // A部門：その年に発表された3曲から、課題曲を選ぶ
  if(S.phase === 'chooseSet'){
    head.textContent = '課題曲';
    w.innerHTML = `<div class="event"><span class="tag">A部門</span><span>今年の課題曲が発表された。3曲から1曲を選ぼう。本番では課題曲・自由曲（${esc(PIECES[S.pieceId].title)}）の順に続けて吹き、審査員は課題曲を${Math.round(SET_W * 10)}割、自由曲を${10 - Math.round(SET_W * 10)}割の重みで見る。</span></div>`
      + setOffer(S).map(id => pieceCard(id, {act: 'chooseset', label: '課題曲にする'})).join('');
    return;
  }
  if(S.phase === 'end'){
    head.textContent = '定期演奏会のあと';
    const seniors = S.members.filter(m => m.grade === 3);
    const lastStage = S.recs.slice().reverse().find(r => r.year === S.year && r.final) || S.recs.slice().reverse().find(r => r.year === S.year && r.result);
    w.innerHTML = `<div class="stagecard"><h3>${seniors.length ? '3年生が引退します' : 'この1年の本番が終わった'}</h3>
      <p class="txt">${seniors.length ? `3年生${seniors.length}人が、この演奏会で引退する。` : `部員は${S.members.length}人。引退する3年生はまだいない。`}冬には新しい部でアンサンブルコンテストに出て、3月に1年をふり返る。</p></div>
      ${seniors.length ? `<div class="seniors"><h3>引退する3年生</h3><p class="small">顔を押すと、その人の成長と音をふり返れます。</p><div class="senior-list">${seniors.map(m => seniorCard(m, lastStage)).join('')}</div></div>` : ''}
      ${firstClassEpilogue(seniors)}
      <div class="transport farewell-actions"><button class="btn primary" type="button" data-act="winter">${seniors.length ? '冬へ（3年生が引退する）' : '冬へ'}</button></div>`;
    return;
  }
  const stage = ev?.kind === 'contest' ? 'コンクール' : '本番';
  head.textContent = S.pending ? stage : U.lineup || (ev?.kind === 'audition' && S.audition?.y === S.year && !S.audition.decided) ? 'オーディション'
    : ev?.kind === 'concert' || ev?.kind === 'contest' ? stage : ev?.kind === 'forced' ? ev.title : S.chooseFinal ? '定期演奏会の曲' : episodeView(S) ? 'できごと' : '今週の練習';
  if(S.pending) return renderStageResult(w, ev);
  // オーディション：その週に入ったら、メンバーを決めるまで先へ進めない（コンクールの前に見直すこともできる）
  if(U.lineup || (ev?.kind === 'audition' && S.audition?.y === S.year && !S.audition.decided)) return renderAudition(w, ev);
  if(ev && (ev.kind === 'concert' || ev.kind === 'contest')){
    const n = nervesFor(S, ev), v = VENUE[ev.venue];
    const two = ev.kind === 'contest' && setActive(S);
    w.innerHTML = `<div class="stagecard"><h3>${ev.title}${ev.kind === 'contest' && S.division ? `（${S.division}部門）` : ''}</h3>
      ${preparationHtml(stagePreparation())}
      <details class="stage-notes"><summary>会場と本番</summary><div>
      ${ev.kind === 'contest' && !isB(S) ? (() => { const rv = rivalResult(S, S.year, ev.level), ly = rivalSeason(S, S.year - 1);
        return rv ? `<p class="small rivalline">ライバル：${esc(rivalShort(S))}${ly && S.year > (S.startYear ?? S.year) ? `（去年は${LEVELS[ly.level].name}${AWARD_NM[ly.award]}）` : ''}も、この大会に出る。</p>` : ''; })() : ''}
      ${ev.kind === 'contest' ? `<p class="small">${two ? `課題曲 ${esc(PIECES[S.setPiece].title)} → 自由曲 ${esc(PIECES[S.pieceId].title)}（続けて吹く）` : `自由曲 ${esc(PIECES[S.pieceId].title)}`}${isB(S) ? '。B部門は県大会まで' : ''}</p>` : ''}
      <p class="small">会場：${v.name}（${v.rt < 0.2 ? '響きはほとんどない' : `残響 約${v.rt.toFixed(1)}秒`}）。${v.desc}</p>
      ${ev.text ? `<p class="txt">${ev.text}</p>` : ''}
      <p class="txt">${moodText(n)}${v.play.hall ? `会場慣れ ${Math.round(S.hallExp)}。` : ''}</p>
      <p class="small">自分で指揮すると、その指揮で演奏した結果が審査される。テンポが大きく揺れると、リズムの苦手な部員ほどついてこられない。</p></div></details>
      ${ev.id === 'shinkan' ? showHtml() : ''}
      ${wingsHtml()}
      <div class="transport stage-actions"><button class="btn primary" type="button" data-act="stage">本番の演奏をはじめる</button><button class="btn brass" type="button" data-act="stageconduct">自分で指揮する</button></div></div>`;
    return;
  }
  if(ev?.kind === 'forced'){
    w.innerHTML = `<div class="event"><span class="tag">${ev.title}</span><span>${ev.text}</span></div><div class="menu"><button class="mbtn wide" type="button" data-act="test"><b>テスト勉強に集中する</b><span>1週すすむ・体力が回復</span></button></div>`;
    return;
  }
  if(S.chooseFinal){
    w.innerHTML = `<div class="event"><span class="tag">定期演奏会の曲</span><span>${hasSeniors(S) ? '3年生の最後の本番、' : ''}${wkLabel(S.finalWeek)}の定期演奏会で演奏する曲を決めよう。コンクールの曲をもう一度でも、新しい曲に挑戦してもいい（新しい曲は、譜読みが低いところから）。</span></div>`
      + PIECE_IDS.map(id => pieceCard(id, {tag: id === S.contestPiece ? 'コンクールで演奏した曲' : '', note: `譜読み ${rankBadge(readAvg(S, id))}`, act: 'choosefinal', label: '決める'})).join('');
    return;
  }
  const parts = [weekResHtml()];
  if(ev) parts.push(`<div class="event"><span class="tag">${ev.title}</span><span>${ev.text}</span></div>`);
  // 部員のできごと：対応を選ぶまで、今週の練習は決められない
  const epv = episodeView(S);
  if(epv){
    const who = [epv.m, epv.o].filter(Boolean).map(x => `${x.grade}年・${esc(instOf(x))}・${esc(x.name)}`).join('　');
    parts.push(`<div class="episode"><div class="head"><span class="tag">できごと</span><span class="who">${who}</span></div><p class="txt">${esc(epv.text)}</p>
      <p class="small">顧問として、どうする？</p><div class="choices">${epv.choices.map(c => `<button class="mbtn" type="button" data-ep="${c.k}"><b>${esc(c.label)}</b></button>`).join('')}</div></div>`);
    w.innerHTML = parts.join('');
    weekResAnimate(w);
    return;
  }
  // 決めたあとの様子と、何が変わったか
  const effHtml = x => (x.effects || x.gains || []).map(g => `<span class="gain">${esc(g)}</span>`).join('');
  if(S.lastEpisode) parts.push(`<p class="epres"><b>${esc(S.lastEpisode.choice)}</b>${esc(S.lastEpisode.result)}${effHtml(S.lastEpisode)}</p>`);
  const cv = consultView(S);
  if(cv) parts.push(`<div class="episode consult"><div class="head">${memberFace(cv.m,56)}<div class="consult-person"><span class="tag">相談</span><b>${esc(cv.m.name)}</b><span class="who">${cv.m.seat?instrumentIcon(SEAT[cv.m.seat].inst):''}${cv.m.grade}年・${esc(instOf(cv.m))}${skillChips(cv.m)}</span></div><button class="help-button" type="button" aria-label="相談"${tipAttr('相談',`答え方で、${kun(cv.m)}の育ち方が変わる。答えずに練習を進めると、この相談は流れる。`)}>?</button></div><p class="txt">${esc(cv.text)}</p>
    <div class="choices">${cv.choices.map(c => `<button class="mbtn" type="button" data-cs="${c.k}"><b>${esc(c.label)}</b>${uiIcon('chevron')}</button>`).join('')}</div></div>`);
  if(S.lastConsult){
    const speakers=S.members.filter(m=>m.name===S.lastConsult.who||m.originalName===S.lastConsult.who),speaker=speakers.length===1?speakers[0]:null;
    parts.push(`<div class="consult-result">${speaker?memberFace(speaker,36):''}<p class="epres"><b>${esc(S.lastConsult.choice)}</b>${esc(S.lastConsult.result)}${effHtml(S.lastConsult)}</p></div>`);
  }
  // 行事の誘い：連れて行く部員を選ぶ（★は、行くと特に伸びる子）
  const ov = outingView(S);
  if(ov){
    const key = `${S.recruitSeed||0}:${S.year}:${S.week}:${S.outing.id}`;
    if(U.outKey !== key){ U.outKey = key; U.outPick = new Set(); U.outMore = !ov.fit.size; }
    const eligible=new Set(seated(S).map(m=>m.id));U.outPick=new Set([...U.outPick].filter(id=>eligible.has(id)));
    // ★の子はパートごとに並べて見せ、ほかの部員はたたんでおく（部員が多いと長くなるので）
    const chip = m => `<button class="out-person" type="button" data-op="${m.id}" aria-pressed="${U.outPick.has(m.id)}" aria-label="${esc(m.name)} ${m.grade}年・${esc(instOf(m))}${ov.fit.has(m.id)?'・特に伸びる':''}"><span class="out-portrait">${memberFace(m,40)}${ov.fit.has(m.id)?`<span class="out-star">${uiIcon('star')}</span>`:''}</span><span class="out-person-text"><b>${esc(m.name)}</b><span class="out-meta"><small>${m.grade}年</small><span class="out-check" aria-hidden="true">${uiIcon('check')}</span></span></span></button>`;
    const bySec = ms => SECTIONS.map(sc => [sc, ms.filter(m => secOf(m) === sc.id)]).filter(([, l]) => l.length)
      .map(([sc, l]) => `<div class="out-section"><b class="oplab">${instrumentIcon(SEATS.find(s=>s.sec===sc.id).inst)}${sc.name}</b><div class="out-grid">${l.map(chip).join('')}</div></div>`).join('');
    const fitMs = seated(S).filter(m => ov.fit.has(m.id)), rest = seated(S).filter(m => !ov.fit.has(m.id));
    const k = U.outPick.size;
    parts.push(`<div class="episode outing" data-selected="${k>0}"><div class="head"><span class="tag">行事</span><span class="who">${esc(ov.o.title)}</span><button class="help-button" type="button" aria-label="行事の見方"${tipAttr('行事',`★は、行くと特に伸びる部員。${ov.o.fitText.replace(/。+$/,'')}。選ばずに練習を進めると、この話は流れる。`)}>?</button></div><p class="txt">${esc(ov.o.text)}</p>
      ${fitMs.length?`<span class="out-legend">${uiIcon('star')}特に伸びる</span>`:''}
      ${bySec(fitMs)}${rest.length ? `<details class="opmore" data-outmore${U.outMore ? ' open' : ''}><summary>${fitMs.length ? 'ほかの部員から選ぶ' : '部員から選ぶ'}（${rest.length}人）</summary>${bySec(rest)}</details>` : ''}
      <div class="outing-actions"><div class="out-selection"><span class="out-selected-faces" aria-hidden="true"></span><b id="outingCount" role="status" aria-live="polite"></b></div><div class="out-action-buttons"><button class="btn primary" type="button" data-act="outing" disabled>部員を選ぶ</button><button class="btn quiet" type="button" data-out-cancel hidden>やめる</button></div></div></div>`);
  }
  if(S.lastOuting){const people=outingResultPeople(),last=S.lastOuting,gains=effHtml(last);parts.push(`<div class="outing-result">${people.length?`<div class="out-result-faces">${people.map(m=>`<span data-out-result="${esc(m.id)}" title="${esc(m.name)}">${memberFace(m,36)}</span>`).join('')}</div>`:''}<p class="epres"><b tabindex="-1" data-out-result-title>${esc(last.title)}${last.who&&!String(last.result||'').includes(last.who)?`（${esc(last.who)}）`:''}</b>${esc(last.result)}</p>${gains?`<details class="outing-gains"${U.outGains?.key===outingResultKey()&&U.outGains.open?' open':''}><summary>変わったこと</summary><div>${gains}</div></details>`:''}</div>`);}
  parts.push(planHtml(ev));
  if(!tuneDone(S)) parts.push(`<div class="tgrow"><button class="btn small" type="button" data-act="tunegame">♪ 耳でチューニング</button><span class="small">週に1回。チューナーの音と部員の音を重ねて、うなりが消えるところまで高さを合わせる。合わせた部員の音程が上がる</span></div>`);
  w.innerHTML = parts.join('');
  updateOutingSelection();
  w.querySelector('.outing-gains')?.addEventListener('toggle',e=>{if(e.target.isConnected)U.outGains={key:outingResultKey(),open:e.target.open};});
  w.querySelector('[data-outmore]')?.addEventListener('toggle', e => { if(e.target.isConnected)U.outMore = e.target.open; });
  w.querySelectorAll('details.psecd[data-sec]').forEach(d => d.addEventListener('toggle', () => {
    if(!d.isConnected)return;
    (U.openSecs ||= new Set())[d.open?'add':'delete'](d.dataset.sec);
    (U.closedSecs ||= new Set())[d.open?'delete':'add'](d.dataset.sec);
  }));
  weekResAnimate(w);
}
// 選ぶ間は画面だけを描き直し、確定するまで行事の効果を保存しない。
function updateOutingSelection(){
  const view=outingView(S),panel=$('#week .outing');if(!view||!panel)return;
  const selected=seated(S).filter(m=>U.outPick.has(m.id)),count=selected.length,full=count>=view.n;
  panel.dataset.selected=String(count>0);
  for(const b of panel.querySelectorAll('[data-op]')){const on=U.outPick.has(b.dataset.op);b.setAttribute('aria-pressed',String(on));b.disabled=full&&!on;}
  const text=`${count}／${view.n}人`,status=$('#outingCount');if(status.textContent!==text)status.textContent=text;
  status.setAttribute('aria-label',`${count}人を選んだ${selected.length?'：'+selected.map(m=>m.name).join('・'):''}`);
  const portraits=panel.querySelector('.out-selected-faces');portraits.innerHTML=selected.map(m=>memberFace(m,24)).join('');
  const go=panel.querySelector('[data-act="outing"]');go.disabled=!count;go.textContent=count?`この${count}人で行く`:view.n?`部員を${view.n}人まで選ぶ`:'連れて行ける部員がいない';
  panel.querySelector('[data-out-cancel]').hidden=!count;
}
function cancelOutingSelection(){
  U.outPick.clear();updateOutingSelection();
  const visible=b=>b&&!b.closest('details:not([open])')&&b.getClientRects().length;
  const last=$(`#week [data-op="${U.outFocus}"]`),first=[...document.querySelectorAll('#week [data-op]')].find(visible);
  const target=visible(last)?last:first||$('#week .outing .help-button');target?.focus({preventScroll:true});target?.scrollIntoView({block:'nearest'});
}
const outingResultKey=()=>S.lastOuting?`${S.recruitSeed||0}:${S.year}:${S.week}:${S.lastOuting.title}:${S.lastOuting.who}:${S.lastOuting.result}`:'';
function outingResultPeople(){
  if(U.outResult?.key===outingResultKey())return U.outResult.people;
  const who=S.lastOuting?.who;if(!who)return [];
  // 前の記録は名前だけなので、同じ名前や区切りを含む名前なら顔を推測しない。
  if(S.members.some(m=>[m.name,m.originalName].some(n=>n?.includes('・')&&who.includes(n))))return [];
  const matches=who.split('・').map(name=>S.members.filter(m=>m.name===name||m.originalName===name));
  if(matches.some(ms=>ms.length!==1)||new Set(matches.map(ms=>ms[0].id)).size!==matches.length)return [];
  return matches.map(ms=>ms[0]);
}
// この1年の部員：いちばん伸びた子・身につけたスキル・行事に行った子
// 1年のまとめ（3月の卒業式のあと）：大会の結果・アンサンブル・部の伸び・この1年の部員・4月と最後の本番の聴き比べ
function yearSummaryHtml(){
  const nm = {gold: '金賞', silver: '銀賞', bronze: '銅賞'};
  const res = (S.season || []).map(r => `<li>${LEVELS[r.level].name}${r.div ? `（${r.div}部門）` : ''}　${nm[r.award]}${r.rep ? '・代表' : ''}（平均${r.avg}点${r.parts ? `：課題曲 ${r.parts.set}・自由曲 ${r.parts.free}` : ''}）</li>`);
  const e = S.winter?.ens;
  if(e && !e.skipped) res.push(`<li>アンサンブルコンテスト　${nm[e.award]}${e.rep ? '・県代表' : ''}（${e.score}点・${e.names.length}人）</li>`);
  const april = S.recs.find(r => r.year === S.year && r.keep && r.week === 0);
  const lastStage = S.recs.slice().reverse().find(r => r.year === S.year && r.final) || S.recs.slice().reverse().find(r => r.year === S.year && r.result);
  // この1年の伸び（部の実力のグラフと同じ記録から）
  const yr = (S.trend || []).filter(x => x.y === S.year), grow = yr.length > 1 ? Math.round(yr[yr.length - 1].a - yr[0].a) : null;
  const yearLine = `<p class="small year-sum">${grow != null ? `部の平均 ${rankBadge(yr[0].a)} → ${rankBadge(yr[yr.length - 1].a)}・` : ''}顧問の指導力 Lv${coachLevel(S)}（${coachTitle(coachLevel(S))}）</p>`;
  return `<div class="stagecard"><h3>${S.year}年度のまとめ</h3>${res.length ? `<ol class="small" style="padding-left:1.2em">${res.join('')}</ol>` : ''}${yearLine}${yearMembersHtml()}
    <div class="transport">${april ? `<button class="btn small" type="button" data-act="playrec" data-id="${april.id}">▶ 4月の録音</button>` : ''}${lastStage ? `<button class="btn small" type="button" data-act="playrec" data-id="${lastStage.id}">▶ 最後の本番</button><button class="btn small" type="button" data-act="saverec" data-id="${lastStage.id}">⤓ 保存</button>` : ''}</div></div>`;
}
function yearMembersHtml(){
  const y = S.year, all = [...S.members, ...(S.gradMembers || [])];
  const base = m => m.y0?.y === y ? m.y0.a : m.first?.y === y ? STAT_KEYS.reduce((a, k) => a + m.first.stats[k], 0) / 4 : null;
  const grow = all.map(m => ({m, d: base(m) == null ? 0 : avgStat(m) - base(m)})).filter(x => x.d >= 1).sort((a, b) => b.d - a.d).slice(0, 3);
  // 同じスキルは、まとめて「度胸○：A・B ほか2人」
  const sk = new Map();
  for(const m of all) for(const x of m.story || []){ const t = x.y === y && x.t.match(/スキル「(.+?)」を身につけた/)?.[1]; if(t) sk.set(t, [...(sk.get(t) || []), m.name]); }
  const skills = [...sk].map(([t, ns]) => `${t}：${ns.slice(0, 3).join('・')}${ns.length > 3 ? ` ほか${ns.length - 3}人` : ''}`);
  const outs = (S.outLog || []).filter(x => x.y === y).map(x => `${x.title}（${x.who}）`);
  const more = (l, n) => l.slice(0, n).join('・') + (l.length > n ? ` ほか${l.length - n}件` : '');
  const grown = grow.map(({m}) => `<span class="yr-grow-person" data-year-growth="${m.id}">${memberFace(m,32)}<b>${esc(m.name)}</b><span class="yr-grow-ranks" aria-label="${rankOf(base(m))}から${rankOf(avgStat(m))}">${rankBadge(base(m))}${uiIcon('chevron')}${rankBadge(avgStat(m))}</span></span>`).join('');
  const growth = grow.length ? `<dl class="yr-mem"><dt class="yr-grow-label">いちばん伸びた</dt><dd class="yr-grow-list">${grown}</dd></dl>` : '';
  const rows = [skills.length && ['身につけたスキル', skills.join('／')], outs.length && ['行事', more(outs, 4)]].filter(Boolean);
  return growth + rows.map(([title, text])=>`<details class="yr-more"><summary>${title}${uiIcon('chevron')}</summary><p>${esc(text)}</p></details>`).join('');
}
/* ===== 演出のきっかけ =====
   月・年度が変わったら場面の扉、スキル・顧問の指導力・部の節目はカットインで（同じスキルはまとめて）。
   ページを開いたときは、いまの月と年度を覚えるだけで出さない */
function fxMoments(){
  const m = S.phase === 'winter' ? winterStep(S).m : wkMonth(S.week), first = U.fxYear == null;
  document.documentElement.dataset.season = SEASON_OF(m);
  const wk = S.phase === 'winter' ? `${S.year}:${S.winter.step}` : null;
  if(!first){
    if(U.fxYear !== S.year) fxYearStart(S);
    else if(U.fxMonth !== m && S.phase === 'week') fxMonth(S);
    if(S.phase === 'winter' && winterStep(S).id === 'grad' && S.winter.gradDone && U.fxEnd !== S.year) fxYearEnd(S);
    if(wk && U.fxWinter !== wk) fxWinter(S);
  }
  // 新しくゲームを始めたときは、最初に一度だけ年度のはじまりを見せる
  else if(S.founding && S.year === S.startYear && S.week === 0 && !S.members.length && !S.flags.fxIntro){ S.flags.fxIntro = true; save(S); fxYearStart(S); }
  U.fxWinter = wk;
  if(S.phase === 'winter' && winterStep(S).id === 'grad' && S.winter.gradDone) U.fxEnd = S.year;
  U.fxYear = S.year; U.fxMonth = m;
  if(S.skillUp?.length){
    const ups = S.skillUp, by = new Map();
    delete S.skillUp; save(S);
    for(const u of ups){ const x = S.members.find(y => y.id === u.mid); if(!x) continue;
      const k = `${u.id}:${u.lv}`; by.set(k, [...(by.get(k) || []), x.name]); }
    const groups = [...by];
    for(const [k, ns] of groups.slice(0, 3)){ const [id, lv] = k.split(':');
      fxShow({kind: 'cut', sound: 'skill', html: fxCutHtml('スキルを身につけた', `${SKILLS[id].name}${skillMark(+lv)}`, ns.slice(0, 3).join('・') + (ns.length > 3 ? ` ほか${ns.length - 3}人` : ''), SKILLS[id].desc)}); }
    if(groups.length > 3) toast(`ほかにも${groups.length - 3}つのスキルを身につけた部員がいる（日誌に）`, 4000);
  }
  if(S.coachUp){
    const lv = S.coachUp; delete S.coachUp; save(S);
    fxShow({kind: 'cut', sound: 'level', ms: 2800, html: fxCutHtml('顧問の指導力', `Lv${lv}　${coachTitle(lv)}`, '', `部員の練習の効果が +${Math.round((coachMult(S) - 1) * 100)}% になった`)});
  }
  // 実績：ページを開いたときは、記録するだけ（前のセーブの分をまとめて出さない）
  const got = checkAch(S, first);
  if(got.length){ save(S); if(!first) for(const a of got) fxShow({kind: 'cut', sound: 'level', ms: 2800, html: fxCutHtml('実績を達成', a.name, '', a.desc)}); }
  if(S.rivalUp){
    const r = S.rivalUp; delete S.rivalUp; save(S);
    fxShow({kind: 'cut', sound: r.win ? 'level' : 'mile', ms: 2800, html: fxCutHtml(`ライバル校との勝負（${LEVELS[r.level].name}）`, r.win ? '勝った！' : 'まだ届かない', `こちら ${r.ours}点 ／ ${rivalShort(S)} ${r.theirs}点`, r.win ? '練習してきたことが、結果になった。' : '来年こそ。差は確実に縮まっている。')});
  }
  if(S.dreamUp?.length){
    const ups = S.dreamUp; delete S.dreamUp; save(S);
    // 同じ夢は1枚にまとめる。1人だけなら、次の夢も見せる
    const by = new Map();
    for(const u of ups){ const m = memberById(u.mid ?? u); if(m && u.t) by.set(u.t, [...(by.get(u.t) || []), {name: m.name, next: u.next}]); }
    for(const [t, xs] of by) fxShow({kind: 'cut', sound: 'skill', ms: 3000, html: fxCutHtml('夢がかなった', `「${t}」`,
      xs.slice(0, 3).map(x => x.name).join('・') + (xs.length > 3 ? ` ほか${xs.length - 3}人` : ''), xs.length === 1 && xs[0].next ? `次の夢：${xs[0].next}` : '')});
  }
  if(S.loveUp?.length){
    const ups = S.loveUp; delete S.loveUp; save(S);
    const who = id => memberById(id) || (S.gradMembers || []).find(m => m.id === id);
    for(const u of ups){ const a = who(u.a), b = who(u.b); if(a && b) fxShow({kind: 'cut', sound: 'skill', ms: 2800, html: fxCutHtml('恋のゆくえ', 'ふたりは付き合うことになった', `${a.name} と ${b.name}`, '')}); }
  }
  if(S.mileUp?.length){
    const ms = S.mileUp; delete S.mileUp; save(S);
    for(const x of ms) fxShow({kind: 'cut', sound: 'mile', html: fxCutHtml('部の節目', `部の${STAT_LABEL[x.k]}が${x.at}に`, '', x.text)});
  }
}
// 練習の結果：すすめる前の部の様子を写しておき、週のはじめに「先週の練習の成果」として、伸びたぶんを数え上げて見せる
function weekSnap(s){
  return {pitch: bandAvg(s, 'pitch'), rhythm: bandAvg(s, 'rhythm'), tone: bandAvg(s, 'tone'), expr: bandAvg(s, 'expr'), coh: s.cohesion,
    read: s.pieceId ? readAvg(s, s.pieceId) : null, pid: s.pieceId, ms: Object.fromEntries(s.members.map(m => [m.id, avgStat(m)])),
    stats: Object.fromEntries(s.members.map(m => [m.id, {...m.stats}]))};
}
// 一度だけ、棒を前の長さから伸ばし、数字を数え上げる（描き直しが続いても、最後に描いたものを動かす）
function weekResAnimate(w){
  const r = U.weekRes;
  if(!r || r.done || !w.querySelector('.weekres')) return;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if(r.done) return;
    r.done = true;
    w.querySelectorAll('.weekres .fill').forEach(f => { f.style.width = f.dataset.to + '%'; });
    fxCountUps(w);
  }));
}
function weekResHtml(){
  const r = U.weekRes;
  if(!r || r.key !== `${S.year}:${S.week}` || S.phase !== 'week') return '';
  const b = r.b, start = !r.done;
  const rows = [...STAT_KEYS.map(k => [STAT_LABEL[k], b[k], bandAvg(S, k)]), ['まとまり', b.coh, S.cohesion],
    ...(b.read != null && b.pid === S.pieceId ? [['譜読み', b.read, readAvg(S, S.pieceId)]] : [])];
  const top = S.members.filter(m => b.ms[m.id] != null).map(m => ({m, d: avgStat(m) - b.ms[m.id]})).filter(x => x.d >= 0.5).sort((x, y) => y.d - x.d).slice(0, 3);
  const canPlan = !episodeView(S);
  return `<div class="weekres"><b>${r.n > 1 ? `この${r.n}週の練習の成果` : '先週の練習の成果'}</b>
    ${rows.map(([nm, a, v]) => `<div class="wr"><span class="nm">${nm}</span><span class="track"><span class="fill" style="width:${clamp(start ? a : v, 0, 100)}%;${rankFill(v)}" data-to="${clamp(v, 0, 100)}"></span></span>${rankBadge(v, v > a && rankOf(a) !== rankOf(v))}</div>`).join('')}
    ${top.length ? `<div class="wr-members"><small>よく伸びた</small><div class="wr-people">${top.map(({m}) => {
      // 上がったランクがあれば優先し、同じランクの中で伸びた週は今のランクだけを見せる。
      const gains = STAT_KEYS.map(k => ({k, before: b.stats?.[m.id]?.[k], now: m.stats[k]})).filter(x => x.before != null && x.now > x.before)
        .sort((a, b) => Number(rankOf(b.before) !== rankOf(b.now)) - Number(rankOf(a.before) !== rankOf(a.now)) || (b.now - b.before) - (a.now - a.before));
      const best = gains[0], up = best && rankOf(best.before) !== rankOf(best.now);
      const changeLabel = best ? `${STAT_LABEL[best.k]} ${up ? rankOf(best.before)+'から' : ''}${rankOf(best.now)}` : '';
      return `<${canPlan?'button type="button"':'div'} class="wr-person"${canPlan?` data-practice-member="${esc(m.id)}" data-practice-source="growth" aria-label="${esc(m.name)} ${changeLabel}、今週の練習を見る"`:''}>${memberFace(m,40)}<b>${esc(m.name)}</b>${best ? `<small>${STAT_LABEL[best.k]}</small><span class="wr-ranks" aria-label="${changeLabel}">${up ? rankBadge(best.before)+'<span aria-hidden="true">→</span>' : ''}${rankBadge(best.now,up)}</span>` : ''}</${canPlan?'button':'div'}>`;
    }).join('')}</div></div>` : ''}</div>`;
}
// 同じ受け持ちに席がいくつかあるときは、2つ目からの席に「2人目」「3人目」をつける（トランペット 1st は2人、クラリネット 1st は3人で吹く）
const seatNth = id => { const p = SEAT[id].part, k = SEATS.filter(x => x.part === p).findIndex(x => x.id === id); return k > 0 ? `（${k + 1}人目）` : ''; };
const seatLabel = id => PART_LABEL[SEAT[id].part] + seatNth(id);
/* ===== 卒業式：卒業していく3年生それぞれの3年間を、1人ずつ流す =====
   入部したとき・力の伸び・思い出・毎年のコンクール・スキル・最後のひとこと。後ろでは、その年の定期演奏会の録音を流す。
   9秒ごとに次の人へ。触れたり読み進めたりしている間は止め、下のボタンで前後へ進む。最後まで見ると新年度へ */
const GR = {i: 0, ids: [], slides: [], timer: 0, raf: 0, returnTo: null};
// 表紙と最後の集合写真から、見たい本人へ戻れるようにする。
function gradAlbum(ms){
  return `<div class="grad-album">${ms.map(m => `<button type="button" data-grad-member="${esc(m.id)}" aria-label="${esc(m.name)}のふり返りを見る">${memberFace(m,48)}<b>${esc(m.name)}</b></button>`).join('')}</div>`;
}
function grSelect(mid){
  const index = GR.ids.indexOf(mid); if(index < 0) return;
  GR.i = index + 1; grShow(); pauseGradRoll(); grFocus();
}
function grFocus(){ const name=$('#grCard .gr-name');name.tabIndex=-1;name.focus({preventScroll:true}); }
function gradYears(m){
  const out = [];
  for(let y = m.joined ?? S.year; y <= S.year; y++){
    const g = (m.joinGrade ?? 1) + (y - (m.joined ?? S.year));
    const h = y === S.year ? {results: S.season} : (S.history || []).find(x => x.year === y);
    const r = h?.results?.[h.results.length - 1];
    out.push(`${g}年 ${r ? `${LEVELS[r.level].name}${AWARD_NM[r.award]}${r.rep ? '（代表）' : ''}` : '出場なし'}`);
  }
  return out.join(' → ');
}
function gradSlide(m){
  const f = m.first, inst = m.seat ? INST[SEAT[m.seat].inst].name : '控え', joinedHere = f && f.y === m.joined;
  // 思い出は、学年ごとに1つずつ選んでから、新しいものを足して4つまで（年の順に）
  const all = (m.story || []).filter(x => !/^スキル/.test(x.t)), pick = [];
  for(const y of [...new Set(all.map(x => x.y))]) pick.push(all.find(x => x.y === y));
  for(const x of all.slice().reverse()) if(pick.length < 4 && !pick.includes(x)) pick.push(x);
  const mem = pick.slice(0, 4).sort((a, b) => a.y - b.y || a.w - b.w);
  // 部にいた年数と、思い出のころの学年（「3年生の7月」）
  const joined = m.joined ?? S.year, years = S.year - joined + 1, when = x => `${(m.joinGrade ?? 1) + (x.y - joined)}年生の${wkMonth(x.w)}月`;
  const sk = skillsOf(m).map(x => x.name + skillMark(x.lv)).join('・');
  return `<div class="gr-person">${memberFace(m,104)}<div><span class="gr-tag">${years}年間</span><b class="gr-name">${esc(m.name)}</b><small class="gr-sub">${m.seat?instrumentIcon(SEAT[m.seat].inst):''}${esc(inst)}${m.title ? '・' + m.title : ''}</small></div></div>
    ${f?memberGrowth(m):`<div class="stats">${STAT_KEYS.map(k=>rankRow(STAT_LABEL[k],m.stats[k])).join('')}</div>`}
    <p class="gr-bye">${farewellLine(m)}</p>
    ${mem.length ? `<ul class="gr-mem">${mem.map(x => `<li><time>${when(x)}</time>${esc(x.t)}</li>`).join('')}</ul>` : ''}
    <details class="gr-record"><summary>部活の記録</summary>
    ${joinedHere ? `<p class="gr-line">${f.y}年${wkMonth(f.w)}月、${(m.joinGrade ?? 1) > 1 ? `${m.joinGrade}年生の途中で` : '1年生で'}入部。${m.exp ? '中学から吹いていた。' : '楽器ははじめてだった。'}</p>` : ''}
    <p class="gr-res">コンクール：${gradYears(m)}</p>
    ${sk ? `<p class="gr-res">スキル：${sk}</p>` : ''}
    ${m.dreams?.length ? `<p class="gr-res">かなえた夢：${m.dreams.map(x => esc(x.t)).join('・')}<b class="gr-done">${m.dreams.length}つ</b></p>` : ''}
    ${m.dream ? `<p class="gr-res">夢：${esc(dreamText(m))}（夢のつづきは、この先へ）</p>` : ''}
    </details>`;
}
function openGradRoll(mid = null){
  const ms = (S.gradMembers || []).slice().sort((a, b) => SEATS.findIndex(x => x.id === a.seat) - SEATS.findIndex(x => x.id === b.seat));
  if(!ms.length) return;
  GR.returnTo = document.activeElement;
  stopPlay();
  GR.ids = ms.map(m => m.id);
  GR.slides = [`<span class="gr-tag">卒業式</span><b class="gr-name">${S.year}年度の卒業生</b><p class="gr-line">${ms.length}人の部員を、ふり返ろう。</p>${gradAlbum(ms)}`,
    ...ms.map(gradSlide),
    `<span class="gr-tag">卒業おめでとう</span><b class="gr-name">ありがとう、先輩たち</b>${gradAlbum(ms)}<p class="gr-res">1・2年生が演奏で送り出した。春から、新しい部がはじまる。</p>`];
  GR.i = 0;
  $('#gradRoll').hidden = false;
  $('#gradRoll').dataset.motion=fxCalm()||U.fxMode==='off'?'off':U.fxMode;
  document.documentElement.classList.add('conducting');
  if(!fxCalm() && U.fxMode === 'full') fxSky($('#gradRoll .fx-sky'), 'sakura', GR);
  // 後ろで、その年の定期演奏会の録音を流す
  const fin = S.recs.slice().reverse().find(r => r.year === S.year && r.final);
  if(fin) playRecording(fin, `${fin.label}（卒業式で）`);
  if(mid && GR.ids.includes(mid)) grSelect(mid); else { grShow(); grFocus(); }
}
function grShow(){
  pauseGradRoll();
  const card = $('#grCard'), last = GR.i >= GR.slides.length - 1;
  card.classList.remove('in'); card.innerHTML = GR.slides[GR.i]; card.scrollTop = 0; void card.offsetWidth; card.classList.add('in');
  $('#grNext').textContent = last ? '4月へ（新年度）' : '次へ';
  $('#grPrev').disabled=GR.i===0;
  $('#grStep').textContent = `${GR.i + 1}／${GR.slides.length}`;
  if(!last && !fxCalm() && U.fxMode !== 'off') GR.timer = setTimeout(grNext, GR.i === 0 && U.fxMode === 'short' ? 3500 : 9000);
}
function grNext(){ if(GR.i < GR.slides.length - 1){ GR.i++; grShow(); } else closeGradRoll(true); }
function pauseGradRoll(){clearTimeout(GR.timer);GR.timer=0;}
function grPrev(){if(GR.i>0){GR.i--;grShow();pauseGradRoll();}}
function closeGradRoll(done){
  pauseGradRoll(); cancelAnimationFrame(GR.raf);
  $('#gradRoll').hidden = true;
  document.documentElement.classList.remove('conducting');
  stopPlay();
  if(done){ commit({...S, winter: {...S.winter, gradDone: true}}); renderAll(); scrollTo(0, 0); }
  if(done) $('#week [data-act="wnext"]')?.focus({preventScroll:true});
  else if(GR.returnTo?.isConnected) GR.returnTo.focus({preventScroll:true});
  GR.returnTo = null;
}
/* ===== 冬（11月 新体制 → 1月 アンサンブルコンテスト → 3月 卒業式） ===== */
const ensembleSubmitLabel=k=>k>=ENS_MIN?`この${k}人で出る`:`あと${ENS_MIN-k}人を選ぶ`;
const ensembleSelecting=()=>S?.phase==='winter'&&winterStep(S).id==='ens'&&!S.winter.ens;
const ensembleSelectionKey=()=>[...(U.ensPick||[])].sort().join(',');
function cleanEnsembleSelection(){
  const eligible=new Set(seated(S).map(m=>m.id));
  for(const id of U.ensPick)if(!eligible.has(id))U.ensPick.delete(id);
}
// 本番の録音と同じ入力を作る。試聴では録音を追加せず、部員も育てない。
function ensemblePreviewPerf(s,ids){
  const pieceId=s.contestPiece||s.pieceId||'largo',venue='civic';
  const snap=snapshot(s,{pieceId,venue,nerves:3,only:ids});
  return rememberStageMembers(perform(recCtx({pieceId,venue,snap})),snap.members,false);
}
function ensembleListening(){
  const active=U.waitPlay?.perf||(U.playing?U.shown:null);
  return U.ensListen?.perf===active?U.ensListen:null;
}
function renderEnsembleListening(){
  const active=ensembleListening(),button=$('#week [data-act="enslisten"]');
  if(!button)return;
  const n=seated(S).filter(m=>U.ensPick?.has(m.id)).length;
  button.disabled=!ensembleSelecting()||n<ENS_MIN||n>ENS_MAX;
  button.setAttribute('aria-pressed',String(!!active));
  const waiting=!!active&&!!U.waitPlay;
  button.dataset.waiting=String(waiting);
  const label=waiting?`${n}人の音を読み込み中。押すと中止`:active?`${n}人の試聴を止める`:`選んだ${n}人で聴く`;
  button.setAttribute('aria-label',label);button.title=label;button.innerHTML=uiIcon(active?'stop':'play');
}
function listenEnsemble(){
  if(!ensembleSelecting()||busy()||CD.phase!=='idle')return;
  if(ensembleListening()){stopPlay();return;}
  const state=S,ids=seated(S).filter(m=>U.ensPick?.has(m.id)).map(m=>m.id);
  if(ids.length<ENS_MIN||ids.length>ENS_MAX)return;
  stopPlay();if(S!==state||!ensembleSelecting())return;
  const previous={piece:U.piece,range:U.range},perf=ensemblePreviewPerf(S,ids);
  U.solo='all';E.setSolo({type:'all'});U.piece=perf.pieceId;U.range='all';setVenue('civic');
  const token=U.ensListen={perf,state:S,key:ensembleSelectionKey(),...previous};
  const done=()=>{
    if(U.ensListen!==token)return;
    U.ensListen=null;
    if(U.piece===perf.pieceId&&U.range==='all'){U.piece=token.piece;U.range=token.range;}
    renderPiece();renderEnsembleListening();updateMini();
  };
  playPerf(perf,`アンサンブルの試聴（${ids.length}人・市民会館）`,done,{},done);
  if(!ensembleListening())done();
  renderSelectors();renderEnsembleListening();
}
// 選択で一覧を作り直さず、押した場所とキーボードのフォーカスを保つ。
function updateEnsembleSelection(){
  cleanEnsembleSelection();
  const active=ensembleListening();
  if(active&&(active.state!==S||active.key!==ensembleSelectionKey()))stopPlay();
  const k=U.ensPick.size;
  for(const b of document.querySelectorAll('#week [data-ens]')){
    const picked=U.ensPick.has(b.dataset.ens);b.setAttribute('aria-pressed',String(picked));
    b.setAttribute('aria-disabled',String(!picked&&k>=ENS_MAX));
  }
  const submit=$('#week [data-act="ensgo"]');
  if(submit){submit.disabled=k<ENS_MIN||k>ENS_MAX;submit.textContent=ensembleSubmitLabel(k);}
  renderEnsembleListening();
}
function renderWinter(w){
  const st = winterStep(S), names = S.retiredNow?.names || [];
  if(st.id === 'plan'){
    const boss = S.members.find(m => m.title === '部長');
    w.innerHTML = `<div class="event"><span class="tag">11月・新体制</span><span>${names.length ? `3年生${names.length}人が引退した。` : ''}1・2年生${S.members.length}人の新しい部。${boss ? `部長は${esc(boss.name)}。` : ''}冬のあいだ、どんな練習をしようか。</span></div>
      <div class="choices wplans">${Object.entries(WINTER_PLANS).map(([k, p]) => `<button class="mbtn" type="button" data-wplan="${k}"><b>${p.name}</b><span>${p.desc}</span></button>`).join('')}</div>`;
    return;
  }
  if(st.id === 'ens'){
    const e = S.winter.ens;
    const intro = `<div class="event"><span class="tag">1月・アンサンブルコンテスト</span><span>3〜8人の少人数で出る、冬の大会。今年の自由曲を、選んだ人数で吹く。少人数なので、一人ひとりの音程・リズム・音色・表現がそのまま聞こえる。出た部員は、聴き合う耳と度胸が育つ。</span></div>`;
    if(!e){
      const key = `${S.recruitSeed||0}:${S.year}:ens`;
      if(U.ensKey !== key){ U.ensKey = key; U.ensPick = new Set(autoEnsemble(S)); }
      cleanEnsembleSelection();
      const k = U.ensPick.size, ok = k >= ENS_MIN && k <= ENS_MAX;
      const chip = m => {
        const inst=SEAT[m.seat].inst,picked=U.ensPick.has(m.id);
        const label=`${m.name} ${m.grade}年・${INST[inst].name}・${rankOf(avgStat(m))}`;
        return `<button class="chip ens-member" type="button" data-ens="${m.id}" aria-label="${esc(label)}" aria-pressed="${picked}" aria-disabled="${!picked&&k>=ENS_MAX}">${memberFace(m,34)}<span class="ens-person"><b>${esc(m.name)}</b><small title="${esc(INST[inst].name)}">${instrumentIcon(inst)}<span>${m.grade}年</span>${rankBadge(avgStat(m))}</small></span><span class="ens-check" aria-hidden="true"></span></button>`;
      };
      const secs = SECTIONS.map(sc => [sc, seated(S).filter(m => secOf(m) === sc.id)]).filter(([, l]) => l.length)
        .map(([sc, l]) => `<div class="ens-section"><h3>${sc.name}</h3><div class="ens-grid">${l.map(chip).join('')}</div></div>`).join('');
      w.innerHTML = `<div class="ens-intro"><span class="small">${ENS_MIN}〜${ENS_MAX}人を選ぶ</span><button class="help-button" type="button" aria-label="アンサンブルコンテスト"${tipAttr('アンサンブルコンテスト','3〜8人の少人数で出る、冬の大会。今年の自由曲を、選んだ人数で吹く。少人数なので、一人ひとりの音程・リズム・音色・表現がそのまま聞こえる。出た部員は、聴き合う耳と度胸が育つ。G〜Sは、力のランク。はじめは、うまい部員のパートを中心に5人を選んである。再生ボタンで、出場を決める前に選んだ部員の音を聴ける。')}>?</button></div>
        <div class="episode ensp">${secs}</div>
        <div class="transport ens-actions"><button class="btn quiet" type="button" data-act="enslisten" aria-pressed="false" aria-label="選んだ${k}人で聴く"${ok ? '' : ' disabled'}>${uiIcon('play')}</button><button class="btn primary" type="button" data-act="ensgo"${ok ? '' : ' disabled'}>${ensembleSubmitLabel(k)}</button><button class="btn quiet" type="button" data-act="ensskip">今年は出ない</button></div>`;
      renderEnsembleListening();
      return;
    }
    if(e.skipped){
      w.innerHTML = `${intro}<p class="txt">今年のアンサンブルコンテストには出なかった。</p><div class="transport"><button class="btn primary" type="button" data-act="wnext">3月へ</button></div>`;
      return;
    }
    // 演奏を聴き終わるまでは、結果を伏せておく
    if(U.ensHide === S.year){
      w.innerHTML = `${intro}<p class="txt">${e.names.map(esc).join('・')}の${e.names.length}人が、舞台に立っている。</p><div class="transport"><button class="btn primary" type="button" data-act="enswatch">演奏を聴く</button><button class="btn quiet" type="button" data-act="ensreveal">結果を見る</button></div>`;
      return;
    }
    const nm = {gold: '金賞', silver: '銀賞', bronze: '銅賞'}[e.award];
    w.innerHTML = `${intro}<div class="result" style="--award:var(--${e.award})"><div class="award"><span class="stamp">${nm}</span><div><b>${e.rep ? '県の代表に選ばれた！' : {gold: 'アンサンブルで金賞！', silver: '銀賞。少人数でもよく合っていた。', bronze: '銅賞。少人数のむずかしさを知った。'}[e.award]}</b>
      <p class="small">${e.names.map(esc).join('・')}（${e.names.length}人）・${e.score}点</p></div></div>
      <div class="transport"><button class="btn small" type="button" data-act="playrec" data-id="${e.recId}">▶ 聴く</button><button class="btn primary" type="button" data-act="wnext">3月へ</button></div></div>`;
    return;
  }
  const grads = S.gradMembers || [];
  // 3月の終わり：卒業式で送ったあとに、1年のまとめ
  if(S.winter.gradDone){
    w.innerHTML = yearSummaryHtml() + `<div class="transport year-actions"><button class="btn primary" type="button" data-act="wnext">4月へ（新年度）</button></div>`;
    return;
  }
  w.innerHTML = `<div class="event"><span class="tag">3月・卒業式</span><span>${names.length ? `卒業式の日。${names.length}人を、1・2年生の演奏で送ろう。` : '3月。春休みの音楽室で、新しい1年に向けて準備をしよう。'}</span></div>
    ${grads.length ? gradAlbum(grads) : ''}
    <div class="transport farewell-actions">${grads.length ? `<button class="btn primary" type="button" data-act="gradroll">${grads.length}人をふり返って、送る</button><button class="btn quiet" type="button" data-act="graddone">ふり返らずに送る</button>` : `<button class="btn primary" type="button" data-act="graddone">${names.length ? '演奏で送る' : '1年をふり返る'}</button>`}</div>`;
}
/* ===== 新しく入った部員の担当を決める =====
   顔の札で部員を選び、楽器ごとの空き席から担当を決める。舞台からも同じように選べる。 */
function asgState(){
  const key = `${S.year}:${S.week}:${S.recruits.map(r => r.id).join(',')}`;
  if(U.asg?.key !== key){ const map = autoAssign(S); U.asg = {key, picks: Object.fromEntries(S.recruits.map(r => [r.id, map[r.id] || null])), sel: S.recruits[0]?.id}; }
  return U.asg;
}
function renderAssign(w, ev){
  asgState();
  const first = foundingYear(S) && !S.members.length;
  const intro = first ? `休部していた吹奏楽部に、1年生が${S.recruits.length}人入部してきた。` : ev?.kind === 'assign' ? '1年生が正式に入部した。' : '新しい部員が入ってきた。';
  w.innerHTML = `<div class="event"><span class="tag">${first ? '入部' : ev?.kind === 'assign' ? ev.title : '入部'}</span><span>${intro}</span></div>
    <div class="rchips" id="asgList"></div>
    <section class="asg-chooser" aria-label="担当を決める"><div id="asgFocus" class="asg-focus" tabindex="-1"></div><div id="asgSeats"></div></section>
    <details class="asg-overview"><summary>${uiIcon('stage')}舞台で見る</summary>
      <div class="stage-wrap"><canvas id="asgStage" role="img" aria-label="舞台の席。部員を選んでから、空いている席をタップすると座る。"></canvas></div>
      <p class="legend" id="asgLegend"></p>
    </details>
    <div class="transport asg-actions"><button class="btn quiet" type="button" data-asg="bench">控え（席なし）に</button><button class="btn primary" type="button" data-act="assign">この配置で決める</button></div>`;
  $('#asgStage').addEventListener('click', asgTap);
  $('.asg-overview').addEventListener('toggle', e => { if(e.target.open) drawAssignStage(); });
  $('#asgSeats').addEventListener('toggle', e => {
    if(e.target.isConnected && e.target.dataset.asgsec && U.asg?.openParts){
      if(e.target.open) U.asg.openParts.add(e.target.dataset.asgsec); else U.asg.openParts.delete(e.target.dataset.asgsec);
    }
  }, true);
  asgUpdate();
}
// 札・説明・舞台を描き直す
function asgUpdate(){
  const A = U.asg, list = $('#asgList');
  if(!A || !list) return;
  list.innerHTML = S.recruits.map(r => {
    const seat = A.picks[r.id], happy = seat && SEAT[seat].inst === r.hope;
    const sk = Object.entries(innateSkills(r.id, r.exp)).map(([id, v]) => `<span class="sk">${SKILLS[id].name}${skillMark(v >= 2.5 ? 2 : 1)}</span>`).join('');
    return `<button class="rchip" type="button" data-rid="${r.id}" aria-pressed="${A.sel === r.id}"><b>${memberFace(r,40)}<span>${esc(r.name)}<small>${r.grade || 1}年・${r.talent ? '中学で実績' : r.exp ? '経験あり' : '初心者'}</small></span></b>
      <span class="asg-hope">${instrumentIcon(r.hope)}<span><small>希望</small>${INST[r.hope].name}</span></span>${sk ? `<span class="sks">${sk}</span>` : ''}
      <span class="where${happy ? ' happy' : seat ? '' : ' none'}">${seat ? `${seatLabel(seat)}${happy ? '<small>希望どおり</small>' : ''}` : '控え（席なし）'}</span></button>`;
  }).join('');
  const r = S.recruits.find(x => x.id === A.sel);
  if(r){
    const seat = A.picks[r.id], index = S.recruits.indexOf(r), hopeSec = SEATS.find(s => s.inst === r.hope)?.sec;
    if(A.seatFor !== r.id){ A.seatFor = r.id; A.openParts = new Set([hopeSec, seat && SEAT[seat].sec].filter(Boolean)); }
    $('#asgFocus').innerHTML = `<div class="asg-person">${memberFace(r,48)}<div><b>${esc(r.name)}</b><small>${seat ? seatLabel(seat) : '控え（席なし）'}</small></div><div class="asg-nav"><button type="button" data-asgnav="-1" aria-label="前の部員"${index ? '' : ' disabled'}>${uiIcon('chevron')}</button><button type="button" data-asgnav="1" aria-label="次の部員"${index < S.recruits.length - 1 ? '' : ' disabled'}>${uiIcon('chevron')}</button></div></div>
      <div class="asg-seat-title"><b>担当を選ぶ</b><button class="help-button" type="button" ${tipAttr('楽器決め','部員を選んでから、空いている席を選ぼう。希望の楽器だとやる気が上がる。席のない部員は控えになる。')} aria-label="楽器決めの説明">?</button><span>${instrumentIcon(r.hope)}希望：${INST[r.hope].name}</span></div>`;
    const free = SEATS.filter(s => !S.members.some(m => m.seat === s.id) && !Object.entries(A.picks).some(([id, pick]) => id !== r.id && pick === s.id));
    $('#asgSeats').innerHTML = SECTIONS.map(sec => {
      const seats = free.filter(s => s.sec === sec.id);
      if(!seats.length) return '';
      return `<details class="asg-part" data-asgsec="${sec.id}"${A.openParts.has(sec.id) ? ' open' : ''}><summary>${instrumentIcon(seats[0].inst)}<b>${sec.name}</b><small>${seats.length}席</small></summary><div class="asg-seat-grid">${seats.map(s => `<button type="button" class="asg-seat" data-asgseat="${s.id}" aria-pressed="${seat === s.id}">${instrumentIcon(s.inst)}<span>${seatLabel(s.id)}${s.inst === r.hope ? '<small>希望の楽器</small>' : ''}</span>${seat === s.id ? '<svg class="asg-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>' : ''}</button>`).join('')}</div></details>`;
    }).join('') || '<p class="small">空いている席はない</p>';
    $('[data-asg="bench"]').disabled = !seat;
  }
  $('#asgLegend').innerHTML = `${r ? `<span><i class="sw sw-hope"></i>光る席：${esc(r.name)}の希望（${INST[r.hope].name}）</span>` : ''}<span><i class="sw sw-new"></i>新しい部員</span><span><i class="sw sw-old"></i>いまの部員</span>${S.pieceId ? '<span>♪：この曲で旋律を吹く席</span>' : ''}`;
  if($('.asg-overview').open) drawAssignStage();
}
function asgSelect(id, scroll = false){
  if(!U.asg || !S.recruits.some(r => r.id === id)) return;
  U.asg.sel = id; haptic('tap'); asgUpdate();
  $('#asgFocus').focus({preventScroll: true});
  if(scroll) $('#asgFocus').scrollIntoView({block: 'start', behavior: fxCalm() || U.fxMode !== 'full' ? 'instant' : 'smooth'});
}
function drawAssignStage(){
  const cv = $('#asgStage');
  if(!cv) return;
  const A = U.asg, G = stageGeom(Math.max(240, cv.parentElement.clientWidth));
  const {g} = fitCanvas(cv, G.H);
  const C = tok(), r = S.recruits.find(x => x.id === A.sel);
  const need = S.pieceId ? pieceNeeds(S.pieceId).part : {};
  const by = Object.fromEntries(Object.entries(A.picks).filter(([, v]) => v).map(([k, v]) => [v, k]));
  stageFloor(g, G, C);
  const dot = (x, y, fill, alpha = 1) => { g.globalAlpha = alpha; g.fillStyle = fill; g.beginPath(); g.arc(x, y, G.r, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; };
  const label = (s, x, y, col) => drawInstrument(g, s.inst, x, y, G.r * 1.5, col);
  for(const s of SEATS){
    const [x, y] = seatXY(s, G);
    const m = S.members.find(mm => mm.seat === s.id), rid = by[s.id];
    if(m){ dot(x, y, skillColor(C, avgStats(m)), 0.45); label(s, x, y, C.ink); continue; }
    if(rid){
      dot(x, y, C.brass); label(s, x, y, C.rkInk);
      if(rid === A.sel){ g.strokeStyle = C.ink; g.lineWidth = 3; g.beginPath(); g.arc(x, y, G.r + 3.5, 0, Math.PI * 2); g.stroke(); }
      continue;
    }
    const hope = r && s.inst === r.hope;
    if(hope){ g.fillStyle = C.good; g.globalAlpha = 0.3; g.beginPath(); g.arc(x, y, G.r + 4, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
    g.setLineDash([3, 3]); g.strokeStyle = hope ? C.good : C.soft; g.lineWidth = hope ? 2 : 1.2;
    g.beginPath(); g.arc(x, y, G.r - 1, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    label(s, x, y, hope ? C.good : C.soft);
    // 希望の楽器の空き席は、席が小さくても分かるように上に楽器名を出す
    if(hope){ g.fillStyle = C.good; g.font = `700 9px ${C.fBody}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText(INST[s.inst].short, x, y - G.r - 4); g.textBaseline = 'middle'; }
    if(needTags(need[s.part]).some(t => t === '旋律' || t === 'ソロ')){ g.fillStyle = C.brass; g.font = `700 ${G.r >= 10 ? 11 : 9}px ${C.fBody}`; g.fillText('♪', x + G.r * 0.9, y - G.r * 0.9); }
  }
}
// 舞台をタップ：いまの部員の席ならその子の名前、新しい部員の席ならその子を選ぶ、空いている席なら選んでいる部員を座らせる
function asgTap(e){
  const s = seatAt(e, $('#asgStage'));
  if(s) asgChooseSeat(s.id);
}
function asgChooseSeat(id){
  const A = U.asg, s = SEAT[id];
  if(!A || !s) return;
  const m = S.members.find(x => x.seat === s.id);
  if(m){ toast(`${m.name}（${m.grade}年・${seatLabel(s.id)}）の席`, 1800); return; }
  const rid = Object.keys(A.picks).find(k => A.picks[k] === s.id);
  if(rid){ asgSelect(rid); return; }
  if(!A.sel) return;
  haptic('tap');
  A.picks[A.sel] = s.id;
  const who = S.recruits.find(x => x.id === A.sel);
  toast(`${who.name} → ${seatLabel(s.id)}${s.inst === who.hope ? '（希望どおり）' : ''}`, 1800);
  // 席のない部員がほかにいれば、次はその子を選んでおく
  const next = S.recruits.find(x => !A.picks[x.id]);
  if(next) A.sel = next.id;
  asgUpdate();
  const target = A.sel === who.id ? $(`[data-asgseat="${s.id}"]`) : $('#asgFocus');
  target?.focus({preventScroll: true});
  if(A.sel !== who.id) $('#asgFocus').scrollIntoView({block: 'start'});
}
// コンクールに出るメンバーの人数と、決め直すボタン
function lineupLine(){
  const ms = seated(S), off = ms.filter(m => m.out).length;
  const set = lineupSet(S);
  return `<div class="lineup-line"><span class="small">コンクールの出場メンバー：${set ? `${ms.length - off}人${off ? `（控え${off}人）` : '（全員）'}` : `まだ決めていない（このままだと全員の${ms.length}人）`}</span>
    <button class="btn small" type="button" data-act="lineupopen">${set ? 'メンバーを変える' : 'メンバーを決める'}</button></div>`;
}
// 準備の表示は次の本番に出る人だけで見る。編成や譜読み、保存内容は変えない。
function stagePreparation(){
  if(S.phase!=='week'||S.pending||S.chooseFinal||!PIECES[S.pieceId])return null;
  const soon=stageIn(S,3);if(!soon)return null;
  const contest=soon.ev.kind==='contest',members=seated(S).filter(m=>!contest||!m.out);
  const songs=[...(contest&&setActive(S)&&PIECES[S.setPiece]?[{id:S.setPiece,label:'課題'}]:[]),{id:S.pieceId,label:'自由'}]
    .map(p=>({...p,value:members.length?members.reduce((sum,m)=>sum+readMean(m,p.id),0)/members.length:0}));
  return {...soon,contest,members,songs,tired:members.filter(m=>(m.sta??S.stamina??100)<30),fatigue:fatigueOf(S),onDay:soon.w===0};
}
function preparationHtml(p){
  if(!p)return '';
  const key=`${S.recruitSeed||0}:${S.year}:${S.week}`;
  if(U.prepKey!==key){U.prepKey=key;U.prepPanel='';}
  const selected=U.prepPanel,open=name=>selected===name;
  const tab=(name,label,icon,value,sub)=>`<button type="button" class="prep-tab" data-prep-toggle="${name}" aria-expanded="${open(name)}" aria-controls="prepBody">${uiIcon(icon)}<b>${label}</b><span class="prep-value">${value}</span><small>${sub}</small>${uiIcon('chevron')}</button>`;
  const readings=p.songs.map(song=>`<span aria-label="${song.label}曲の譜読み ${rankOf(song.value)}">${p.songs.length>1?`<small>${song.label[0]}</small>`:''}${rankBadge(song.value)}</span>`).join('');
  const rows=(ms,kind)=>`<div class="prep-members">${ms.map(m=>{
    const practice=!p.onDay&&kind!=='people',tag=practice?'button':'div';
    return `<${tag} class="prep-person"${practice?` type="button" data-practice-member="${esc(m.id)}" data-practice-source="prep-${kind}" aria-label="${esc(m.name)}の今週の練習を見る"`:''}>${memberFace(m,32)}<b>${esc(m.name)}</b><span class="prep-person-values">${kind==='reading'?p.songs.map(song=>`<span aria-label="${song.label}曲の譜読み ${rankOf(readMean(m,song.id))}">${rankBadge(readMean(m,song.id))}</span>`).join(''):kind==='rest'?staBar(m):m.seat?instrumentIcon(SEAT[m.seat].inst):''}</span>${practice?uiIcon('chevron'):''}</${tag}>`;
  }).join('')}</div>`;
  let body='';
  if(open('people'))body=`${p.contest?lineupLine():`<p class="small">席のある${p.members.length}人で演奏する。コンクールで控えの部員も出る。</p>`}${rows(p.members,'people')}`;
  if(open('reading')){
    const sorted=p.members.slice().sort((a,b)=>Math.min(...p.songs.map(s=>readMean(a,s.id)))-Math.min(...p.songs.map(s=>readMean(b,s.id))));
    body=`<div class="prep-songs">${p.songs.map(s=>`<span><b>${s.label}曲</b><span>${esc(PIECES[s.id].title)}</span>${rankBadge(s.value)}</span>`).join('')}</div><p class="small">${p.onDay?'本番に出る部員の譜読み。':'顔を押すと、今週の練習を選べる。'}</p><div class="prep-reading-head"><span>部員</span>${p.songs.map(s=>`<span>${s.label}</span>`).join('')}</div>${rows(sorted,'reading')}`;
  }
  if(open('rest'))body=`${p.fatigue?'<p class="small">部全体にも疲れが残っていて、演奏に響く。</p>':''}${p.tired.length?`<p class="small">${p.onDay?'出場メンバーのうち、体力が低い部員。':'顔を押すと、今週の練習を選べる。'}</p>${rows(p.tired,'rest')}`:'<p class="small">出場メンバーに、体力が低い部員はいない。</p>'}`;
  return `<section class="preparation" data-day="${p.onDay}" aria-label="本番の準備"><div class="prep-head"><b>本番の準備</b><small>${p.onDay?'きょう':`あと${p.w}週`}</small><button class="help-button" type="button" aria-label="本番の準備の見方"${tipAttr('本番の準備','本番に出る部員の人選・譜読み・体力。譜読みは出る人の平均を、GからSのランクで見る。体力が30より低い部員と、部全体に残る疲れも確かめられる。')}>?</button></div><div class="prep-tabs">${tab('people','人選','members',p.members.length+'人',p.contest?(lineupSet(S)?'選んだ部員':'まだ決めていない'):'全員')}${tab('reading','譜読み','journal',readings,p.songs.length>1?'課題・自由':'部員の平均')}${tab('rest','体力','rest',p.tired.length+'人',p.tired.length?'疲れ':p.fatigue?'部全体に疲れ':'疲れなし')}</div><div class="prep-body" id="prepBody"${selected?'':' hidden'}>${body}</div></section>`;
}
function togglePreparation(name){
  if(!['people','reading','rest'].includes(name))return;
  U.prepPanel=U.prepPanel===name?'':name;renderWeek();
  $(`[data-prep-toggle="${name}"]`)?.focus({preventScroll:true});
  if(U.prepPanel)$('#prepBody')?.scrollIntoView({block:'nearest'});
}
// オーディション：本人の顔・楽器・当日の出来から人選し、部全体の予想点を見比べる。
const audScore = m => (S.audition.scores[m.id] || auditionScore(S, m));
function renderAudition(w, ev){
  if(!S.audition || S.audition.y !== S.year){ commit(startAudition(S)); }
  if(!U.draft) U.draft = new Set(seated(S).filter(m => m.out).map(m => m.id));
  const key = `${S.recruitSeed}:${S.year}:${S.week}`;
  if(U.audKey !== key){ U.audKey = key; U.openAud = new Set(); U.audPredNotes = false; }
  U.audSearching = false;
  const {ev: cev} = nextContest(S);
  const order = m => SEATS.findIndex(x => x.id === m.seat);
  const secs = SECTIONS.map(sec => [sec, seated(S).filter(m => SEAT[m.seat].sec === sec.id).sort((a, b) => audScore(b).score - audScore(a).score || order(a) - order(b))]).filter(([, ms]) => ms.length);
  // 人数が多いときは、パートごとにたたむ（見出しに「出る人数／パートの人数」）
  const fold = seated(S).length > 12;
  const rowsOf = ms => ms.map(m => {
    const a = audScore(m), inn = !U.draft.has(m.id);
    return `<li class="am${inn ? '' : ' off'}" data-audmember="${m.id}"><label><input type="checkbox" data-aout="${m.id}" aria-label="${esc(m.name)}の出場"${inn ? ' checked' : ''}>${memberFace(m,36)}<span class="who"><b>${esc(m.name)}</b><small>${instrumentIcon(SEAT[m.seat].inst)}${m.grade}年・${esc(seatLabel(m.seat))}</small>${a.freeze || a.zone ? `<small class="aud-mood ${a.freeze ? 'freeze' : 'zone'}">${a.freeze ? '緊張で崩れた' : 'いつも以上の出来'}</small>` : ''}</span><span class="aud-rank" aria-label="当日の出来 ${rankOf(a.score)}">${rankBadge(a.score)}<small data-audstatus>${inn ? '出る' : '控え'}</small></span></label>
      <button class="btn small aud-listen" type="button" data-audplay="${m.id}" aria-pressed="false" aria-label="${esc(m.name)}のオーディションを聴く">${uiIcon('play')}</button></li>`;
  }).join('');
  const rows = secs.map(([sec, ms]) => fold
    ? `<details class="psecd aud-part" data-asec="${sec.id}"${U.openAud.has(sec.id) ? ' open' : ''}><summary><b>${sec.name}<small>${ms.length}人</small></b><span class="aud-part-faces" data-audfaces="${sec.id}" aria-hidden="true">${audPartFaces(ms)}</span><span class="what" data-acnt="${sec.id}">${audCount(ms)}</span></summary><ul class="plist alist">${rowsOf(ms)}</ul></details>`
    : `<ul class="plist alist"><li class="psec">${sec.name}</li>${rowsOf(ms)}</ul>`).join('');
  w.innerHTML = `<div class="aud-intro"><span class="small">${esc(cev.title)}に出るメンバー</span><button class="help-button" type="button" aria-label="人選の説明"${tipAttr('人選', `音程やリズムが不安定な部員を入れると、合奏全体の減点になる。安定して吹ける部員が増えると、響きの厚みが加点になる。楽器が欠けると、そのぶんも減点される。チェックを変えて予想点を見くらべよう。試聴は、自由曲をいまの力と譜読みで吹いた音。予想は、本番まで練習したときの目安。当日の出来は、自由曲で問われる力（${PIECES[S.pieceId].asks}）と、その日の緊張で決まる。チェックを外した部員は控え。練習はいつもどおりで、秋からはまた全員で吹く。`)}>?</button></div>
    <div class="aud-pred" id="audPred" aria-live="polite"></div>
    <div class="aud-tools"><button class="btn quiet" type="button" data-aud="all">${uiIcon('members')}全員出る</button><button class="btn quiet" type="button" data-aud="best">${uiIcon('star')}おすすめ</button><button class="btn quiet" type="button" data-aud="listen" aria-pressed="false">${uiIcon('play')}選んだ人で聴く</button><button class="btn quiet" type="button" data-aud="listenall" aria-pressed="false">${uiIcon('play')}全員で聴く</button></div>
    <div class="aud-list-head"><span>出る人にチェック</span><span>当日の出来 G〜S</span></div><div class="psecs audition-parts">${rows}</div>
    <div class="transport aud-actions"><button class="btn primary" type="button" data-act="lineup">このメンバーで決める</button>${S.audition.decided ? '<button class="btn quiet" type="button" data-aud="cancel">変えずにもどる</button>' : ''}</div>`;
  updateAuditionSelection(true);
  $('#audPred').addEventListener('toggle', e => { if(e.target.isConnected && e.target.matches('.aud-pred-notes')) U.audPredNotes = e.target.open; }, true);
  w.querySelectorAll('details[data-asec]').forEach(d => d.addEventListener('toggle', () => { if(d.isConnected) U.openAud[d.open ? 'add' : 'delete'](d.dataset.asec); }));
}
const audPartFaces = ms => { const on = ms.filter(m => !U.draft.has(m.id)); return (on.length ? on : ms).slice(0,3).map(m => memberFace(m,20)).join(''); };
// パートの見出しの「出る 7／9人」
const audCount = ms => { const n = ms.filter(m => !U.draft.has(m.id)).length; return n === ms.length ? '全員出る' : `出る ${n}人・控え ${ms.length - n}人`; };
// 選び直しても札とフォーカスはそのまま。見た目・チェック・出る人数を同じ選択から描く。
function updateAuditionSelection(soon = false){
  const root = $('#week'), ms = seated(S), n = ms.filter(m => !U.draft.has(m.id)).length;
  const listening = auditionListening();
  if(listening && (listening.state !== S || listening.kind === 'selected' && (U.audSearching || listening.out !== [...U.draft].sort().join(',')))) stopPlay();
  for(const input of root.querySelectorAll('[data-aout]')){
    const on = !U.draft.has(input.dataset.aout), row = input.closest('.am');
    input.checked = on; input.disabled = !!U.audSearching; row.classList.toggle('off', !on);
    row.querySelector('[data-audstatus]').textContent = on ? '出る' : '控え';
  }
  for(const sec of SECTIONS){
    const members = ms.filter(m => SEAT[m.seat].sec === sec.id), count = root.querySelector(`[data-acnt="${sec.id}"]`), faces = root.querySelector(`[data-audfaces="${sec.id}"]`);
    if(count) count.textContent = audCount(members);
    if(faces){ faces.innerHTML = audPartFaces(members); faces.classList.toggle('all-off', members.every(m => U.draft.has(m.id))); }
  }
  root.querySelector('[data-act="lineup"]').textContent = n ? `${n}人で決める` : '出る部員を選ぼう';
  for(const b of root.querySelectorAll('[data-act="lineup"],[data-aud="listen"]')) b.disabled = !!U.audSearching || !n;
  for(const b of root.querySelectorAll('[data-aud="all"],[data-aud="best"],[data-aud="listenall"]')) b.disabled = !!U.audSearching || b.dataset.aud === 'listenall' && !ms.length;
  renderAuditionListening();
  if(U.audSearching){ clearTimeout(U.predT); U.predRequest = (U.predRequest || 0) + 1; $('#audPred').setAttribute('aria-busy', 'true'); $('#audPred').innerHTML = '<b>おすすめのメンバーを探しています……</b>'; return; }
  updatePred(soon);
}
// 人選の試聴だけを覚える。全員との聴き比べでチェックやセーブを変えない。
function auditionListening(){
  const active = U.waitPlay?.perf || (U.playing ? U.shown : null);
  return U.audListen?.perf === active ? U.audListen : null;
}
function renderAuditionListening(){
  const active = auditionListening(), n = seated(S).filter(m => !U.draft?.has(m.id)).length;
  if(U.audListen && !active) U.audListen = null;
  for(const b of document.querySelectorAll('[data-aud="listen"],[data-aud="listenall"]')){
    const all = b.dataset.aud === 'listenall', on = active?.kind === (all ? 'all' : 'selected');
    const who = all ? '全員' : `${n}人`;
    b.setAttribute('aria-pressed',String(on));
    b.setAttribute('aria-label',on ? `${who}の試聴を止める` : `${who}で聴く`);
    b.innerHTML = `${uiIcon(on ? 'stop' : 'play')}${on ? `止める（${who}）` : `${who}で聴く`}`;
  }
  for(const b of document.querySelectorAll('[data-audplay]')){
    const on = active?.kind === 'member' && active.mid === b.dataset.audplay, m = memberById(b.dataset.audplay);
    b.setAttribute('aria-pressed',String(on));
    b.disabled = !!U.audSearching;
    b.setAttribute('aria-label',`${m?.name || ''}のオーディションを${on ? '止める' : '聴く'}`);
    b.innerHTML = uiIcon(on ? 'stop' : 'play');
  }
}
function listenAudition(kind, mid = null){
  if(!U.lineup || U.audSearching || busy()) return;
  const state = S, active = auditionListening();
  if(active?.kind === kind && active.mid === mid){ stopPlay(); return; }
  stopPlay();
  if(S !== state || !U.lineup || U.audSearching || busy()) return;
  const members = seated(S).filter(m => kind === 'member' ? m.id === mid : kind === 'all' || !U.draft.has(m.id));
  if(!members.length) return;
  U.solo = 'all'; E.setSolo({type:'all'});
  const {ev} = nextContest(S), venue = kind === 'member' ? 'room' : LEVELS[ev.level].venue;
  setVenue(venue);
  const ctx = kind === 'member' ? auditionCtx(S,members[0]) : perfCtx(S,{members,venue,fatigue:0});
  const perf = rememberStageMembers(perform(ctx),members,false);
  const token = U.audListen = {kind,mid,perf,state:S,out:[...U.draft].sort().join(',')};
  const done = () => { if(U.audListen === token){ U.audListen = null; renderAuditionListening(); } };
  const label = kind === 'member' ? `オーディション：${members[0].name}（${instOf(members[0])}）` : `オーディション${kind === 'all' ? '：全員' : 'で選んだ'}${members.length}人（${VENUE[venue].name}）`;
  playPerf(perf,label,done,{},done);
  renderSelectors(); renderAuditionListening();
}
// 響きの理由は小さな印で見せ、文章は押して開いたときだけ出す。
function auditionSoundRows(p){
  const s = p.sound;
  return [
    {key:'steady', name:'安定感', value:-s.disruption, level:s.disruption >= 10 ? 0 : s.disruption >= 3 ? 1 : 2,
      state:s.disruption >= 10 ? '乱れあり' : s.disruption >= 3 ? '少し不安定' : 'そろっている',
      note:'音程やリズムが不安定な奏者の音が重なると、合奏全体の減点になる。'},
    {key:'layers', name:'厚み', value:s.fullness-s.thin, level:s.thin >= 6 ? 0 : s.fullness >= 2 ? 2 : 1,
      state:s.thin >= 6 ? '薄い' : s.fullness >= 2 ? '重なっている' : 'これから',
      note:'少人数では響きが薄くなる。安定して吹ける奏者が増えると、音の重なりが加点になる。'},
    {key:'parts', name:'楽器', value:-s.lack, level:s.lack >= 6 ? 0 : s.lack > 0 ? 1 : 2,
      state:s.lack > 0 ? '欠けている' : 'そろっている',
      note:s.missing.length ? `${lackNames(s.missing).join('・')}の受け持ちが足りない。` : '曲で受け持ちのある楽器がそろっている。'},
  ];
}
function auditionSound(p, all){
  const base = all && auditionSoundRows(all);
  const rows = auditionSoundRows(p).map((r,i)=>{
    const delta = base ? r.value-base[i].value : 0;
    const change = !base ? '' : Math.abs(delta)<0.05 ? 'same' : delta>0 ? 'up' : 'down';
    const comparison = {up:'全員よりよい',down:'全員より低い',same:'全員と同じ'}[change] || '';
    return {...r,change,comparison};
  });
  const lights = rows.map(r => `<span class="aud-sound ${['bad','warn','good'][r.level]}" data-sound="${r.key}" aria-label="${r.name}：${r.state}${r.comparison ? '。'+r.comparison : ''}"><span class="aud-sound-name">${r.name}${r.change ? `<span class="aud-sound-change ${r.change}" data-sound-change="${r.change}" aria-hidden="true">${r.change==='same' ? '<span class="aud-sound-same"></span>' : uiIcon('up')}</span>` : ''}</span><svg viewBox="0 0 42 8" aria-hidden="true" focusable="false">${[0,1,2].map(i => `<rect x="${i*15}" y="0" width="12" height="8" rx="3" class="${i <= r.level ? 'on' : ''}"/>`).join('')}</svg></span>`).join('');
  return {label:rows.map(r => `${r.name}：${r.state}${r.comparison ? '。'+r.comparison : ''}`).join('。'), summary:`<span class="aud-sound-lights">${lights}</span>${uiIcon('chevron')}`, notes:`${all ? `<p class="aud-compare-note">全員で出ると${all.avg.toFixed(1)}点。印は、全員との違い。</p>` : ''}<dl class="aud-sound-notes">${rows.map(r => `<div><dt>${r.name}：${r.state}${r.comparison ? '（'+r.comparison+'）' : ''}</dt><dd>${r.note}</dd></div>`).join('')}</dl>`};
}
function auditionComparison(p, all){
  const delta=+(Number(p.avg.toFixed(1))-Number(all.avg.toFixed(1))).toFixed(1),kind=delta>0?'up':delta<0?'down':'same';
  return `<div class="aud-compare ${kind}" data-comparison="${delta}"><span>全員より</span><b>${delta>0?'+':delta<0?'−':''}${Math.abs(delta).toFixed(1)}<small>点</small></b></div>`;
}
// 選んだメンバーで出たときの点の目安（メンバーを変えるたびに計算し直す）
function updatePred(soon){
  const el = $('#audPred'); if(!el) return;
  const out = new Set(U.draft || []), state = S, request = U.predRequest = (U.predRequest || 0) + 1;
  clearTimeout(U.predT); el.setAttribute('aria-busy', 'false');
  const n = seated(S).length - [...out].filter(id => memberById(id)?.seat).length;
  const {ev, w} = nextContest(S), L = LEVELS[ev.level], left = w - S.week;
  if(!n){ el.innerHTML = '<b>出る部員を選ぼう</b>'; return; }
  const key = S.recruitSeed + ':' + S.year + ':' + S.week + ':' + [...out].sort().join(',');
  const show = p => {
    const nm = {gold: '金賞', silver: '銀賞', bronze: '銅賞'}[p.award];
    const compared = n < seated(state).length;
    const sound = auditionSound(p, compared ? U.predAll : null);
    // 目安は、いまの方針のまま本番の週まで練習を続けたときの部で出す（自分で指揮すると、ここから上がる）
    el.setAttribute('aria-busy', 'false');
    el.innerHTML = `<div class="aud-pred-top"><span>${L.name}の目安</span><span>${n}人で出る</span></div><div class="aud-pred-score"><b><span class="aud-score-number">${p.avg.toFixed(1)}</span><small>点</small></b><span class="aud-award ${p.award}">${uiIcon('award')}${nm}くらい</span></div>${compared ? auditionComparison(p,U.predAll) : ''}<details class="aud-pred-notes"${U.audPredNotes ? ' open' : ''}><summary aria-label="響きと予想の見方。${sound.label}">${sound.summary}</summary>${sound.notes}<p>${left > 0 ? `あと${left}週、いまの方針で本番まで練習を続けたときの、審査員の平均点の目安。` : '審査員の平均点の目安。'}${setActive(S) ? '課題曲4割・自由曲6割で見ている。' : ''}金賞の目安は${L.gold}点、${L.rep ? `代表は3人ともA（${L.A}点）。` : ''}本番の日の調子や指揮でも上下する。</p></details>`;
  };
  if(U.predState === state && U.predKey === key && U.pred && U.predAllState === state){ show(U.pred); return; }
  el.innerHTML = `<b>${n}人で出ると……</b><span class="small">計算中</span>`;
  el.setAttribute('aria-busy', 'true');
  U.predT = setTimeout(() => {
    if(U.predRequest !== request || S !== state || !el.isConnected) return;
    // 全員の予想は同じ部の間だけ使い回し、編成や曲を変えたら作り直す。
    if(U.predAllState !== state){ U.predAll=predictContest(state,new Set());U.predAllState=state; }
    U.pred = out.size ? predictContest(state,out) : U.predAll;
    U.predKey = key; U.predState = state; show(U.pred);
  }, soon ? 30 : 120);
}
// 今週の練習：部の方針（全員で1つ）と、部員ひとりずつの今週の練習
// 練習で伸びるもの（練習を選ぶボタンに小さく出す）
const menuUp = id => MENU_BY[id].up || {tutti: 'まとまり', hall: '会場慣れ', rest: '体力'}[id] || '';
const ownPlan = m => S.plan?.[m.id] && menuOpen(S, S.plan[m.id]) ? S.plan[m.id] : '';
// 部員の力：音程・リズム・音色・表現（と譜読み）を、ランクの色と1文字で並べる（数字は出さない）。
// 「先週の練習の成果」が出ている週は、ランクが上がった力を光らせる
const planCols = () => [...STAT_KEYS.map(k => [k, STAT_LABEL[k]]), ...(S.pieceId ? [['fam', '譜読み']] : [])];
function rankStrip(m){
  const fresh = U.weekRes?.key === `${S.year}:${S.week}` && m.last && m.last.menu !== 'test', d = fresh ? m.last.d || {} : {};
  return `<span class="rks">${planCols().map(([k]) => { const v = k === 'fam' ? readMean(m, S.pieceId) : m.stats[k];
    return rankBadge(v, d[k] > 0 && rankOf(v - d[k]) !== rankOf(v)); }).join('')}</span>`;
}
// 体力：色だけの小さな棒（緑・黄・赤）
const staBar = m => `<span class="sta" title="体力 ${Math.round(m.sta)}"><span class="track"><span class="fill ${m.sta >= 60 ? 'good' : m.sta >= 30 ? 'warn' : 'bad'}" style="width:${clamp(m.sta, 0, 100)}%"></span></span></span>`;
// 練習を選ぶ一覧（部員ひとり、またはパート全員。key は部員の id か「sec:パート」）。cur は選んである練習（'' はおまかせ、'-' はばらばら）
const practiceIcon=id=>uiIcon({long:'breath',tune:'tuning',metro:'metronome',phrase:'note',piece:'journal',tutti:'members',hall:'stage',rest:'rest'}[id]||'week');
const pickGrid = (key, cur, auto) => `<div class="pgrid" role="group" aria-label="今週の練習">`
  + `<button class="pchip" type="button" data-pset="${key}" data-menu="" aria-pressed="${cur === ''}">${practiceIcon('auto')}<span><b>おまかせ</b><small>${auto ? MENU_BY[auto].name : '部員ごと'}</small></span></button>`
  + MENU.filter(x => menuOpen(S, x.id)).sort((a,b)=>{const first=['care','prep-rest'].includes(U.pickReturn)?'rest':U.pickReturn==='diag'?U.diagReturn?.menu:null;return Number(b.id===first)-Number(a.id===first);}).map(x => `<button class="pchip" type="button" data-pset="${key}" data-menu="${x.id}" aria-pressed="${cur === x.id}">${practiceIcon(x.id)}<span><b>${x.name}</b><small>${menuUp(x.id)}</small></span></button>`).join('') + '</div>';
// 選ぶ前の行へ戻れるようにし、キーボードの位置も保つ。
function closePracticePicker(){
  const key=U.pick,top=U.pickScroll,from=U.pickReturn;U.pick=null;U.pickReturn=null;renderWeek();
  if(from==='diag'){
    if(returnToDiagPractice(key))return;
    const row=[...document.querySelectorAll('#week [data-practice-row]')].find(el=>el.dataset.practiceRow===key);
    if(row){row.closest('details[data-sec]').open=true;row.querySelector('[data-pick]')?.focus({preventScroll:true});row.scrollIntoView({block:'start'});return;}
  }
  const origin=from && [...document.querySelectorAll('#week [data-practice-member]')].find(b=>b.dataset.practiceMember===key&&b.dataset.practiceSource===from);
  (origin || document.querySelector(`[data-pick="${key}"]`))?.focus({preventScroll:true});
  if(top!=null)window.scrollTo(0,top);
}
function openPracticePicker(key, from = null){
  if(U.pick===key){closePracticePicker();return;}
  if(from!=='diag')U.diagReturn=null;
  U.pickScroll=scrollY;U.pickReturn=from;U.pick=key;renderWeek();
  const grid=$('#week .pgrid');if(!grid)return;
  (grid.querySelector('[aria-pressed="true"]')||grid.querySelector('button'))?.focus({preventScroll:true});
  const r=grid.getBoundingClientRect(),bar=($('#week .outing[data-selected="true"] .outing-actions')||$('#week .plan>.transport'))?.getBoundingClientRect();
  const bottom=narrow.matches&&bar?bar.top-12:innerHeight-24;
  if(r.bottom>bottom)window.scrollBy(0,r.bottom-bottom);
}
// 顔から本人の練習へ移るだけでは指示を変えない。閉じると元の顔へ戻す。
function focusPracticeMember(mid, source){
  if(S.phase !== 'week' || !memberById(mid)) return;
  const row=[...document.querySelectorAll('#week [data-practice-row]')].find(el=>el.dataset.practiceRow===mid),group=row?.closest('details[data-sec]');
  if(!group) return;
  (U.openSecs ||= new Set()).add(group.dataset.sec);(U.closedSecs ||= new Set()).delete(group.dataset.sec);
  if(U.pick===mid)U.pick=null;
  openPracticePicker(mid,source);
  const target=[...document.querySelectorAll('#week [data-practice-row]')].find(el=>el.dataset.practiceRow===mid);
  target?.scrollIntoView({block:'start',behavior:!fxCalm()&&U.fxMode==='full'?'smooth':'auto'});
}
// 曲の個人練習で打ちこむところ（選ばなければ、いちばん吹けていないところ）
const spanChips = m => {
  const pid = S.pieceId, v = readOf(m, pid), want = S.planSpan?.[m.id], weak = practiceSpan({...S, planSpan: {}}, m);
  return `<div class="pspan chips"><button class="chip" type="button" data-spanset="${m.id}" data-i="" aria-pressed="${want == null}">吹けていないところ<small>${esc(spanShort(PIECES[pid].spans[weak]))}</small></button>`
    + readUnits(pid).map(u => `<button class="chip" type="button" data-spanset="${m.id}" data-i="${u.i}" aria-pressed="${want === u.i}">${esc(spanShort(u))}${rankBadge(v[u.i])}</button>`).join('') + '</div>';
};
function planHtml(ev){
  const prep=stagePreparation();
  // 開いていた練習の一覧は、週が変わったら閉じる
  const stateKey=`${S.recruitSeed||0}:${S.year}`;
  if(U.planStateKey!==stateKey){U.planStateKey=stateKey;U.openSecs=new Set();U.closedSecs=new Set();}
  if(U.pickAt !== `${stateKey}:${S.week}`){ U.pick = null; U.pickAt = `${stateKey}:${S.week}`; }
  const order = m => m.seat ? SEATS.findIndex(x => x.id === m.seat) : 999;
  const ms = S.members.slice().sort((a, b) => order(a) - order(b));
  const count = {};
  for(const m of ms){ const id = planFor(S, m); count[id] = (count[id] || 0) + 1; }
  const tired = ms.filter(m => m.sta < 30);
  const pol = POLICY_BY[S.policy] ? S.policy : 'auto';
  // 部員はパートごとにたたむ（部員が多いと「すすめる」ボタンがずっと下になるので）。見出しに、そのパートの今週の練習をまとめて出す
  const groups = [];
  for(const m of ms){ const k = m.seat ? SEAT[m.seat].sec : 'bench'; let g = groups.find(x => x.k === k); if(!g) groups.push(g = {k, ms: []}); g.ms.push(m); }
  // 部員の行：名前と体力・力の帯・今週の練習のボタン（押すと練習の一覧が開く）
  const rowOf = m => {
    const auto = decideMenu(S, m), own = ownPlan(m), id = own || auto, open = U.pick === m.id;
    return `<li class="pm${own ? ' own' : ''}${m.out && m.seat ? ' out' : ''}" data-practice-row="${esc(m.id)}"><span class="who">${memberFace(m,30)}<b>${esc(m.name)}</b><small>${m.grade}年</small></span>
      ${staBar(m)}${rankStrip(m)}
      <button class="pick" type="button" data-pick="${m.id}" aria-expanded="${open}" aria-label="${esc(m.name)}の今週の練習">${practiceIcon(id)}${own ? '' : '<span class="pk">おまかせ</span>'}<b>${MENU_BY[id].name}</b></button>
      ${open ? pickGrid(m.id, own, auto) : ''}${id === 'piece' && S.pieceId ? spanChips(m) : ''}</li>`;
  };
  const rows = groups.map(({k, ms: gm}) => {
    const name = k === 'bench' ? '控え' : SEC[k].name;
    // 2人以上いるパートは、全員の今週の練習をまとめて選べる
    const same = gm.every(x => ownPlan(x) === ownPlan(gm[0])) ? ownPlan(gm[0]) : '-', key = `sec:${k}`;
    const secSel = gm.length >= 2 ? `<button class="chip" type="button" data-pick="${key}" aria-expanded="${U.pick === key}">${name}をまとめて選ぶ</button>${U.pick === key ? pickGrid(key, same, '') : ''}` : '';
    const cnt = {};
    for(const m of gm){ const id = planFor(S, m); cnt[id] = (cnt[id] || 0) + 1; }
    const what = MENU.filter(x => cnt[x.id]).map(x => `${x.name}${gm.length > 1 ? ` ${cnt[x.id]}` : ''}`).join('・');
    const own = gm.some(m => S.plan?.[m.id] && menuOpen(S, S.plan[m.id]));
    const low = gm.filter(m => m.sta < 30).length;
    const open = (ms.length<=8&&!U.closedSecs.has(k))||U.openSecs.has(k);
    return `<details class="psecd" data-sec="${k}"${open ? ' open' : ''}><summary><b>${name}<small>${gm.length}人</small></b><span class="part-faces" aria-hidden="true">${gm.slice(0,3).map(m=>memberFace(m,20)).join('')}</span><span class="what">${what}${own ? '・指示あり' : ''}${low ? `<em>疲れ ${low}人</em>` : ''}</span></summary>
      ${secSel ? `<div class="secall">${secSel}</div>` : ''}<ul class="plist">${gm.map(rowOf).join('')}</ul></details>`;
  }).join('');
  const sum = MENU.filter(m => count[m.id]).map(m => `${m.name} ${count[m.id]}人`).join('・');
  const tutti = (count.tutti || 0) + (count.hall || 0);
  return `<div class="plan">
    ${foundingYear(S) && S.week < 4 ? '<p class="small">「おまかせ」のままの部員は、部の方針で自分の練習を決める。指示したい部員だけ、今週の練習を選ぼう。合奏は出た人が多いほど、部のまとまりが伸びる。</p>' : ''}
    ${S.pieceId && !setActive(S) ? `<p class="plan-piece">練習している曲：<b>${esc(PIECES[S.pieceId].title)}</b><small>譜読み</small>${rankBadge(readAvg(S, S.pieceId))}</p>` : ''}
    ${preparationHtml(prep)}
    <div class="focus"><span>部の方針</span><div class="chips">${POLICIES.map(p => `<button class="chip" type="button" data-polall="${p.id}" aria-pressed="${pol === p.id}">${practiceIcon(p.id==='basics'?'tune':p.id)}${p.name}</button>`).join('')}</div>
    <span class="small">${POLICY_BY[pol].desc}</span></div>
    ${setActive(S) ? `<div class="focus"><span>曲の練習の配分（自由曲 ${esc(PIECES[S.pieceId].title)}・課題曲 ${esc(PIECES[S.setPiece].title)}）</span><div class="chips">${Object.keys(SPLIT).map(k => `<button class="chip" type="button" data-split="${k}" aria-pressed="${(S.split || 'auto') === k}">${SPLIT_NAME[k]}</button>`).join('')}</div>
      <span class="small">譜読み：自由曲 ${rankBadge(readAvg(S, S.pieceId))}・課題曲 ${rankBadge(readAvg(S, S.setPiece))}。曲の練習・合奏の伸びを、この配分で2曲に分ける${(S.split || 'auto') === 'auto' ? `（おまかせ：いまは自由曲 ${Math.round(pieceShares(S)[0][1] * 10)}割・課題曲 ${Math.round(pieceShares(S)[1][1] * 10)}割）` : ''}</span></div>` : ''}
    ${tired.length ? `<div class="plan-care"><div class="care-head"><b>${practiceIcon('rest')}疲れ ${tired.length}人</b><button class="help-button" type="button" aria-label="疲れている部員について"${tipAttr('体力','体力が30を切っている部員。休ませないと、練習の効果が半分になる。顔を押すと、その人の練習を選べる。')}>?</button></div><div class="care-people" role="group" aria-label="疲れている部員">${tired.map(m=>`<button type="button" data-practice-member="${esc(m.id)}" data-practice-source="care" aria-label="${esc(m.name)}の今週の練習を見る${planFor(S,m)==='rest'?'（休む予定）':''}">${memberFace(m,32)}<b>${esc(m.name)}</b>${planFor(S,m)==='rest'?practiceIcon('rest'):''}</button>`).join('')}</div></div>` : ''}
    <div class="psecs"><div class="rkhead"${tipAttr('ランク')}><span></span><span>体力</span><span class="rks">${planCols().map(([, nm]) => `<i>${nm}</i>`).join('')}</span></div>${rows}</div>
    ${S.pieceId && !S.finalWeek && S.week >= 8 && nextContest(S).w > S.week && !prep?.contest ? lineupLine() : ''}
    <p class="small plan-sum">今週の予定：${sum}${tutti === 1 ? '（合奏は2人以上いないとできない）' : ''}</p>
    <div class="transport"><button class="btn primary" type="button" data-act="practice">この内容で1週間すすめる</button><button class="btn" type="button" data-act="practicemany">次の予定まで進める</button></div>
  </div>`;
}
// 顧問になって最初に入部してきた代が卒業するとき：3年間をふり返る
function firstClassEpilogue(seniors){
  const firsts = seniors.filter(m => isFirstClass(S, m));
  if(!firsts.length) return '';
  const y0 = startYearOf(S);
  const years = [...S.history.filter(h => h.year >= y0), {year: S.year, piece: PIECES[S.contestPiece || S.pieceId]?.title, results: S.season, final: null}];
  const april = S.recs.find(r => r.year === y0 && r.keep && r.week <= 3 && firsts.some(m => recHas(r, m)));
  const last = S.recs.slice().reverse().find(r => r.year === S.year && r.final);
  return `<details class="epilogue"><summary><span class="tag">3年間の物語</span><h3>最初の1年生たちが、卒業していく</h3></summary><div class="epilogue-body">
    <p class="txt">${y0}年の春、あなたが顧問になって最初に入部してきた${firsts.length}人。楽器を持つのもはじめての子もいた。</p>
    <ol>${years.map(h => `<li>${h.year}年度　${esc(h.piece || '')}　${h.results.length ? resultText(h.results) : ''}</li>`).join('')}</ol>
    <div class="transport">${april ? `<button class="btn small" type="button" data-act="playrec" data-id="${april.id}">▶ 入部したころの合奏</button>` : ''}${last ? `<button class="btn small" type="button" data-act="playrec" data-id="${last.id}">▶ 最後の定期演奏会</button>` : ''}</div></div></details>`;
}
// 引退する3年生ひとりずつ：入部したとき（日誌をつけ始めたとき）と今、思い出、その人の音だけの録音
const recHas = (r, m) => r.snap.members.some(x => x.id === m.id);
const firstRecOf = m => S.recs.filter(r => r.keep && recHas(r, m)).sort((a, b) => a.year - b.year || a.week - b.week)[0] || null;
const FAREWELL = ['「この部で吹けて、よかったです」', '「後輩たち、あとはよろしくね」', '「最後の本番が、いちばん楽しかった」', '「3年間、ありがとうございました」', '「次は客席から聴きに来ます」', '「もっと吹いていたかったな」'];
function farewellLine(m){
  if(m.title === '部長') return '「みんな、ついてきてくれてありがとう」';
  if(m.title === '学生指揮') return '「指揮台から見たみんなの顔、忘れません」';
  if((m.story || []).some(x => x.t.includes('自信をなくした'))) return '「あのとき、やめなくてよかったです」';
  return FAREWELL[Math.floor(hash(m.id, 'bye') * FAREWELL.length)];
}
function seniorCard(m, last){
  const f = m.first, first = firstRecOf(m);
  const grow = f ? STAT_KEYS.map(k => [k, m.stats[k] - f.stats[k]]).sort((a, b) => b[1] - a[1])[0] : null;
  const joinedHere = f && f.y === m.joined;
  const inst = m.seat ? INST[SEAT[m.seat].inst].name : '控え';
  const showFirst = first && (!last || first.id !== last.id);
  return `<details class="senior" data-senior="${esc(m.id)}"><summary aria-label="${esc(m.name)} ${esc(inst)}${grow && rankOf(f.stats[grow[0]]) !== rankOf(m.stats[grow[0]]) ? ` ${STAT_LABEL[grow[0]]} ${rankOf(f.stats[grow[0]])}から${rankOf(m.stats[grow[0]])}` : ''}"><span class="senior-person">${memberFace(m,48)}<span><b class="nm">${esc(m.name)}</b><small class="sub">${m.seat?instrumentIcon(SEAT[m.seat].inst):uiIcon('members')}<span class="senior-inst">${esc(inst)}${m.title?'・'+m.title:''}</span></small></span></span>${grow && rankOf(f.stats[grow[0]]) !== rankOf(m.stats[grow[0]]) ? `<span class="grow"><small>${STAT_LABEL[grow[0]]}</small><span>${rankBadge(f.stats[grow[0]])}→${rankBadge(m.stats[grow[0]])}</span></span>` : ''}</summary>
    <div class="body">
      ${f?memberGrowth(m):`<div class="stats">${STAT_KEYS.map(k=>rankRow(STAT_LABEL[k],m.stats[k])).join('')}</div>`}
      <div class="transport">${showFirst ? `<button class="btn small" type="button" data-act="memplay" data-id="${first.id}" data-mid="${m.id}">▶ ${joinedHere ? '入部したころの音' : 'いちばん古い録音'}</button>` : ''}${last && recHas(last, m) ? `<button class="btn small" type="button" data-act="memplay" data-id="${last.id}" data-mid="${m.id}">▶ 最後の本番の音</button><button class="btn small" type="button" data-act="memsave" data-id="${last.id}" data-mid="${m.id}">⤓ 保存</button>` : ''}</div>
      ${(m.story || []).length ? `<ul class="mem">${m.story.map(x => `<li><time>${ymLabel(x.y, x.w)}</time>${esc(x.t)}</li>`).join('')}</ul>` : ''}
      <p class="bye">${farewellLine(m)}</p>
    </div></details>`;
}
const conductNote = p => {
  if(!p.conducted) return '';
  const pc = PIECES[S.recs.find(r => r.id === p.recId)?.pieceId];
  const g = p.conducted.gain;
  return `・あなたの指揮 ${pc ? beatName(pc) : '♩'}=${p.conducted.bpm}、安定度${p.conducted.stab}%${g != null ? `（おまかせより${g >= 0 ? '+' : '−'}${Math.abs(g).toFixed(1)}点）` : ''}`;
};
function renderStageResult(w, ev){
  const p = S.pending;
  if(!p.revealed){
    w.innerHTML = `<div class="stagecard"><span class="tag">${ev.kind === 'contest' ? 'コンクール' : '本番'}</span><h3>${ev.title}</h3><p class="txt">ステージで演奏中…</p><button class="btn" type="button" data-act="reveal">結果を見る</button></div>`;
    return;
  }
  if(p.kind === 'concert'){
    w.innerHTML = `<div class="stagecard"><span class="tag">本番</span><h3>${ev.title}</h3><p class="small">演奏の出来 <b class="countup" data-key="q:${p.recId}" data-to="${Math.round(p.q)}" data-ms="1200">${FX.done.has(`q:${p.recId}`) ? Math.round(p.q) : 0}</b>点（緊張 −${p.nerves}）${conductNote(p)}</p>${mentalNote(p)}<p class="txt">${esc(p.text)}</p>${foundingYear(S) && p.q < 10 ? '<p class="small">できたばかりの部の、最初の音。ここから練習を重ねていく。年度の終わりに、4月の録音と最後の本番を聴き比べられる。</p>' : ''}
      <div class="transport"><button class="btn small" type="button" data-act="playrec" data-id="${p.recId}">▶ もう一度聴く</button><button class="btn small" type="button" data-act="saverec" data-id="${p.recId}">⤓ 保存</button><button class="btn primary" type="button" data-act="next">${ev.final ? (hasSeniors(S) ? '3年生の引退へ' : '冬へ') : '次の週へ'}</button></div></div>`;
    // コンクールは結果発表の読み上げがあるので、数え上げは演奏会だけ
    requestAnimationFrame(() => fxCountUps(w));
    return;
  }
  const j = p.judge, L = LEVELS[j.level];
  const nm = {gold: '金賞', silver: '銀賞', bronze: '銅賞'}[j.award];
  const headTxt = j.rep ? `${L.rep}への代表に選ばれた！` : p.division === 'B' ? ({gold: 'B部門で金賞！', silver: 'B部門で銀賞。', bronze: 'B部門で銅賞。来年こそ。'}[j.award]) : j.award === 'gold' && L.rep ? '金賞。でも代表には届かなかった（ダメ金）。' : j.award === 'gold' ? '全国大会で金賞。' : j.award === 'silver' ? '銀賞。手応えはあった。' : '銅賞。来年こそ。';
  w.innerHTML = `<div class="result" style="--award:var(--${j.award})">
    <div class="award"><span class="stamp">${nm}</span><div><b>${headTxt}</b><p class="small">${L.name}${p.division ? `（${p.division}部門）` : ''}${p.parts ? `・課題曲 ${p.parts.set}点・自由曲 ${p.parts.free}点` : ''}・審査員平均 ${j.avg.toFixed(1)}点・緊張 −${p.nerves}${conductNote(p)}</p>${mentalNote(p)}</div></div>
    <ol class="judges">${j.judges.map(x => `<li><span class="grade">${x.grade}</span><p class="cmt"><small>${esc(x.name)}・${x.score}点</small>${esc(x.comment)}</p></li>`).join('')}</ol>
    <div class="transport">${p.setRecId ? `<button class="btn small" type="button" data-act="playrec" data-id="${p.setRecId}">▶ 課題曲</button>` : ''}<button class="btn small" type="button" data-act="playrec" data-id="${p.recId}">▶ ${p.setRecId ? '自由曲' : '本番の録音'}</button><button class="btn small" type="button" data-act="saverec" data-id="${p.recId}">⤓ 保存</button><button class="btn primary" type="button" data-act="next">${j.rep ? '次の大会に向けて練習を続ける' : 'シーズンを終える'}</button></div></div>`;
}
// 部の歴史：年度ごとの曲・結果・引退した部員と、残してある録音
const AWARD_NM = {gold: '金賞', silver: '銀賞', bronze: '銅賞'};
const resultText = results => results.map(r => `${LEVELS[r.level].name}${AWARD_NM[r.award]}${r.rep ? '（代表）' : ''}`).join('→');
/* ===== セーブの書き出し・読み込み =====
   アプリを消す前や、ほかの端末で続けたいときに。セーブを文字（コード）にして、ファイルに保存したりコピーしたりできる。
   SUIBU1: は gzip で縮めたもの、SUIBU0: は縮めていないもの（縮められない端末用） */
const b64enc = u8 => { let s = ''; for(let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); };
const b64dec = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));
const pipeBytes = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
async function saveCode(){
  const raw = new TextEncoder().encode(JSON.stringify(S));
  return typeof CompressionStream === 'function' ? 'SUIBU1:' + b64enc(await pipeBytes(raw, new CompressionStream('gzip'))) : 'SUIBU0:' + b64enc(raw);
}
async function readSaveCode(code){
  const m = code.replace(/\s+/g, '').match(/^SUIBU([01]):(.+)$/);
  if(!m) throw new Error('「SUIBU1:」か「SUIBU0:」で始まるコードではありません。');
  let bytes;
  try{ bytes = b64dec(m[2]); }catch(e){ throw new Error('コードが途中で切れているようです。'); }
  if(m[1] === '1' && typeof DecompressionStream !== 'function') throw new Error('この端末では、縮めたセーブを読めません。');
  let s;
  try{ s = JSON.parse(new TextDecoder().decode(m[1] === '1' ? await pipeBytes(bytes, new DecompressionStream('gzip')) : bytes)); }
  catch(e){ throw new Error('コードが途中で切れているか、こわれているようです。'); }
  if(!s || s.v !== 2 || !Array.isArray(s.members)) throw new Error('吹奏楽部のつくりかたのセーブではないようです。');
  return s;
}
async function saveAction(kind){
  const msg = t => { $('#svMsg').textContent = t; };
  if(kind === 'file' || kind === 'copy'){
    const code = await saveCode();
    if(kind === 'file'){ await deliverFile(new TextEncoder().encode(code + '\n'), `吹奏楽部のつくりかた_セーブ_${S.year}年度.txt`, {title: 'セーブ', type: 'text/plain'}); msg(`${S.year}年度（${S.phase === 'winter' ? `${winterStep(S).m}月` : wkLabel(S.week)}）のセーブを書き出した。`); return; }
    let ok = false;
    try{ await navigator.clipboard.writeText(code); ok = true; }catch(e){}
    if(!ok){ const t = $('#svCode'); t.value = code; t.select(); try{ ok = document.execCommand('copy'); }catch(e){} }
    msg(ok ? `コードをコピーした（${Math.round(code.length / 1024)}KB）。メモなどに貼りつけて取っておこう。` : 'コピーできなかった。下の欄のコードを選んでコピーしよう。');
    return;
  }
  if(kind === 'load'){
    const code = $('#svCode').value.trim();
    if(!code){ msg('ファイルを選ぶか、コードを貼りつけてから押そう。'); return; }
    let s;
    try{ s = await readSaveCode(code); }catch(e){ msg(e.message || '読み込めなかった。'); return; }
    // アプリでは確認の窓が出せないので、ボタンを2回押して上書きする
    const b = document.querySelector('[data-sv="load"]');
    if(b.dataset.armed !== '1'){ b.dataset.armed = '1'; b.textContent = 'もう一度押すと、いまのセーブを上書きする'; msg(`${s.year}年度・部員${s.members.length}人のセーブ。`); return; }
    save(s); location.reload();
  }
}
// 設定（効果音・演出）
function renderPrefs(){
  document.documentElement.dataset.fxMode = U.fxMode;
  const seg = (k, opts, cur) => opts.map(([v, nm]) => `<button type="button" data-pref="${k}:${v}" aria-pressed="${cur === v}">${nm}</button>`).join('');
  $('#prefSfx').innerHTML = seg('sfx', [['on', 'オン'], ['off', 'オフ']], U.sfx ? 'on' : 'off');
  $('#prefFx').innerHTML = seg('fx', [['full', 'ふつう'], ['short', '短く'], ['off', 'なし']], U.fxMode);
}
// 実績の一覧（達成したものは年度つき、まだのものは目標として薄く）
function renderAch(){
  const el = $('#achList'); if(!el) return;
  const ach = S.ach || {}, n = ACHIEVEMENTS.filter(a => ach[a.id]).length;
  $('#achCount').textContent = `${n}／${ACHIEVEMENTS.length}`;
  el.innerHTML = ACHIEVEMENTS.map(a => { const g = ach[a.id];
    return `<li class="${g ? 'got' : ''}"><b>${a.name}</b><small>${g ? (g.old ? 'それまでに達成' : `${g.y}年度 ${g.w >= 100 ? WINTER_STEPS[g.w - 100]?.m ?? 3 : wkMonth(g.w)}月`) : 'まだ'}・${a.desc}</small></li>`; }).join('');
}
function renderHistory(){
  renderAch(); renderPrefs();
  const years = (S.history || []).slice().reverse();
  $('#history').hidden = !years.length;
  const recBtns = y => S.recs.filter(r => r.year === y && r.keep).map(r => `<button class="btn small" type="button" data-act="playrec" data-id="${r.id}">▶ ${esc(r.label.replace(/^\d+年?\s*/, ''))}</button>`).join('');
  // これまでの最高：いちばん先まで進んだ大会と、そのときの賞・点（同じ大会なら点の高いほう）
  const all = [...(S.history || []).flatMap(h => (h.results || []).map(r => ({...r, year: h.year}))), ...(S.season || []).map(r => ({...r, year: S.year}))];
  const rank = r => ['pref', 'block', 'national'].indexOf(r.level) * 1000 + ({gold: 300, silver: 200, bronze: 100}[r.award] || 0) + (r.avg || 0);
  const best = all.slice().sort((a, b) => rank(b) - rank(a))[0];
  const bestLine = best ? `<p class="hist-best">これまでの最高：${best.year}年度 ${LEVELS[best.level].name}${AWARD_NM[best.award]}${best.rep ? '（代表）' : ''}・審査員平均 ${(+best.avg).toFixed(1)}点</p>` : '';
  $('#hist').innerHTML = bestLine + (years.length ? years.map(h => {
    const best = h.results[h.results.length - 1];
    return `<details class="hyear"><summary><b>${h.year}</b><span class="pc">${esc(h.piece || '—')}</span><span class="aw ${best?.award || ''}">${best ? resultText([best]) : ''}</span></summary>
      <div class="body">
        <p>コンクール${h.div ? `（${h.div}部門${h.set ? `・課題曲 ${esc(h.set)}` : ''}）` : ''}：${h.results.length ? resultText(h.results) : '出場なし'}</p>
        ${h.final ? `<p>定期演奏会：${esc(h.final.piece)}（演奏の出来 ${h.final.q}点）</p>` : ''}
        ${(S.rivalLog || []).filter(x => x.y === h.year).map(x => `<p>ライバル（${esc(rivalShort(S))}）：${LEVELS[x.level].name}で ${x.ours}点 対 ${x.theirs}点。${x.win ? '勝ち' : '負け'}</p>`).join('')}
        ${h.ens ? `<p>アンサンブルコンテスト：${AWARD_NM[h.ens.award]}（${h.ens.names.map(esc).join('・')}）</p>` : ''}
        ${h.retired?.length ? `<p>引退した3年生${h.firstClass ? '（顧問になって最初の代）' : ''}：${h.retired.map(esc).join('、')}</p>` : ''}
        <div class="transport">${recBtns(h.year)}</div>
      </div></details>`;
  }).join('') : '');
}
function renderLog(){
  const root=$('#log'),stateKey=`${S.recruitSeed||0}:${S.year}`;
  if(root.dataset.stateKey!==stateKey){root.dataset.stateKey=stateKey;U.journalOpen=new Map();}
  // 昔の録音の本人も含める。同じ名前の別人がいる場合は、顔を決めつけない。
  const people=new Map();
  for(const r of S.recs||[])for(const m of r.snap?.members||[])people.set(m.id,m);
  for(const m of [...(S.gradMembers||[]),...S.members])people.set(m.id,m);
  const names=new Map();
  for(const m of people.values())for(const name of new Set([m.name,m.originalName].filter(Boolean))){if(!names.has(name))names.set(name,[]);names.get(name).push(m);}
  const speaker=e=>{
    let found=null,pos=Infinity;
    for(const [name,ms] of names){
      const text=String(e.text),i=text.indexOf(name),after=text[i+name.length]||'';
      if(ms.length===1&&i>=0&&(!after||/[がはのにをとで（()）・、。「」『』\s]/u.test(after))&&(i<pos||i===pos&&name.length>(found?.name.length||0))){found=ms[0];pos=i;}
    }
    return found;
  };
  const mark=e=>{const m=speaker(e);return m?memberFace(m,32):uiIcon(/コンクール|大会|演奏会|金賞|銀賞|銅賞/.test(e.text)?'award':/今週の練習|合奏/.test(e.text)?'note':'journal');};
  const groups=new Map();
  for(const e of S.log.slice().reverse().slice(0,80)){const key=`${e.y}:${e.w}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);}
  root.innerHTML=[...groups].map(([key,entries],i)=>{
    const pick=entries.findIndex(e=>speaker(e)||/【相談】|の夢「|コンクール.*[金銀銅]賞/.test(e.text)),head=entries[pick<0?0:pick];
    const rest=entries.filter(e=>e!==head),open=U.journalOpen.has(key)?U.journalOpen.get(key):i===0;
    return `<li class="log-week"><details data-logweek="${key}"${open?' open':''}><summary><time>${head.y!==S.year?head.y+' ':''}${wkShort(head.w)}</time><span class="log-item"><span class="log-mark" aria-hidden="true">${mark(head)}</span><span class="log-preview">${esc(head.text)}</span></span></summary>${rest.length?`<ul class="log-notes">${rest.map(e=>`<li><span class="log-mark" aria-hidden="true">${mark(e)}</span><span>${esc(e.text)}</span></li>`).join('')}</ul>`:''}</details></li>`;
  }).join('');
}

/* ===== 部員カード・名簿 ===== */
// 入部したとき（またはこの日誌をつけ始めたとき）からの伸びと、思い出
const ymLabel = (y, w) => `${y}年${wkMonth(w)}月`;
// 入部したときと今の4つの力を同じ順で並べる。変わらない力も省かない。
function growthText(m){
  if(!m.first) return '';
  return STAT_KEYS.map(k => `<span class="grk"><span>${STAT_LABEL[k]}</span>${rankBadge(m.first.stats[k])}<span aria-hidden="true">→</span>${rankBadge(m.stats[k])}</span>`).join('');
}
function memberGrowth(m){
  if(!m.first)return '';
  return `<div class="mc-growth"><p class="small">${ymLabel(m.first.y,m.first.w)}${m.first.y===m.joined?'の入部':'に日誌をつけ始めて'}から</p><div class="mc-growth-grid">${growthText(m)}</div></div>`;
}
function memberStory(m){
  const st = (m.story || []).slice(-5).reverse();
  if(!st.length)return '';
  return `<details class="mc-story"><summary>思い出</summary><ul>${st.map(x => `<li><time>${ymLabel(x.y,x.w)}</time>${esc(x.t)}</li>`).join('')}</ul></details>`;
}
// 部員カードは、押したところ（合奏のステージか、部員の名簿）の近くに出す
function placeCard(where){
  const card = $('#memberCard');
  card.dataset.origin=where;
  if(where!=='roster')U.cardReturn=null;
  if(where === 'roster') $('.roster').insertBefore(card, $('#rosterFind'));
  else $('.stand').insertBefore(card, $('.rehearsal-actions'));
}
// スキル：小さな札（名前の横）と、部員カードの一覧（説明と育ち方）
const skillChips = m => skillsOf(m).map(x => ` <span class="sk">${x.name}${skillMark(x.lv)}</span>`).join('');
// 部員の夢（かなったら年月つき）
const dreamWhen = x => `${x.y}年${x.w >= 100 ? WINTER_STEPS[x.w - 100]?.m ?? 3 : wkMonth(x.w)}月`;
// 付き合っている相手（卒業した先輩なら、そう書く）
const loveLine = m => m.partner ? `<p class="mc-love">付き合っている：${esc(m.partner.name)}${S.members.some(x => x.id === m.partner.id) ? '' : '（卒業した先輩）'}</p>` : '';
const dreamLine = m => (m.dream || m.dreams?.length) ? `<p class="mc-dream">${m.dream ? `夢：${esc(dreamText(m))}` : '夢：ぜんぶかなえた！'}</p>
  ${m.dreams?.length ? `<ul class="mc-dreams">${m.dreams.map(x => `<li><b>かなった</b>${esc(x.t)}<small>${dreamWhen(x)}</small></li>`).join('')}</ul>` : ''}` : '';
function skillList(m){
  const have = skillsOf(m);
  const bent = STAT_KEYS.filter(k => (m.bent?.[k] || 0) >= 0.04).sort((a, b) => m.bent[b] - m.bent[a]).map(k => STAT_LABEL[k]);
  return `<div class="mc-skills">${have.length ? `<ul>${have.map(x => `<li><b>${x.name}${skillMark(x.lv)}</b>${esc(x.desc)}</li>`).join('')}</ul>` : '<p class="small">スキルはまだない。練習を続けたり、相談に乗ったりすると身につくことがある。</p>'}
    ${bent.length ? `<p class="small">伸びやすい力：${bent.join('・')}（相談への答え方で育った）</p>` : ''}</div>`;
}
// 部員のひとこと：いまの様子（体力・最近の伸び・苦手・癖・学年・役）に合うものから、週ごとに1つ
// 本番を見ているときに部員をタップしたら、その子の様子（力・本番の強さ・今日の調子・スキル）を舞台の下に出す
function showCdMember(id){
  const el = $('#cdMember'), m = id && memberById(id);
  // 別の子へ移る・閉じるときは、一人だけの音を見えないまま残さない。
  if((!m||m.id!==CD.sel)&&U.solo.startsWith('member:')){U.solo='all';applySolo();}
  CD.sel = m ? m.id : null;
  if(!m){
    el.hidden = true;drawStage(-1, $('#cdStage'), CD.who);
    if(CD.phase==='watch'&&!$('#conduct').hidden){$('#cdStage').focus({preventScroll:true});$('#cdStage').scrollIntoView({block:'nearest',behavior:!fxCalm()&&U.fxMode==='full'?'smooth':'auto'});}
    return;
  }
  const C = tok(), mood = (CD.perf?.mental || []).find(x => x.mid === m.id)?.kind;
  const plays = CD.who?.has(m.id), solo = U.solo === `member:${m.id}`;
  el.innerHTML = `<div class="cm-head">${memberFace(m,54,{mood})}<span><b id="cdMemberName">${esc(m.name)}</b><small>${m.grade}年・${esc(PART_LABEL[SEAT[m.seat].part])}${m.title ? '・' + esc(m.title) : ''}</small></span><button class="btn small quiet" type="button" data-cdm="close">閉じる</button></div>
    ${plays ? `<div class="row"><button class="btn small" type="button" data-cdm="solo" aria-pressed="${solo}">${solo ? '全員の音にもどす' : 'この子の音だけ聴く'}</button></div>` : ''}
    <p class="cm-say">${esc(memberSays(m))}</p>
    <div class="cm-stats">${STAT_KEYS.map(k => `<span class="cm-st">${STAT_LABEL[k]}<span class="track"><span class="fill" style="width:${clamp(m.stats[k], 0, 100)}%;background:${skillColor(C, m.stats[k])}"></span></span>${rankBadge(m.stats[k])}</span>`).join('')}</div>
    <p class="cm-note">本番の強さ ${rankBadge(m.mental ?? 40)}${mood === 'zone' ? '・今日は、いつも以上の音が出ている' : mood === 'freeze' ? '・今日は、緊張で頭が真っ白になっている' : ''}${plays ? '' : '・この本番には出ていない'}${skillChips(m)}</p>
    `;
  el.hidden = false;
  if(CD.phase==='watch')el.querySelector('[data-cdm="close"]').focus({preventScroll:true});
  if(CD.phase==='watch'&&narrow.matches)el.scrollIntoView({block:'nearest',behavior:!fxCalm()&&U.fxMode==='full'?'smooth':'auto'});
  if(!U.playing) drawStage(-1, $('#cdStage'), CD.who);
}
function toggleCdMemberSolo(){
  const button=$('#cdMember [data-cdm="solo"]');
  if(CD.phase!=='watch'||!button||!CD.who?.has(CD.sel))return;
  const solo=U.solo!==`member:${CD.sel}`;
  U.solo=solo?`member:${CD.sel}`:'all';applySolo();
  // ボタンを作り直さず、操作先と読んでいるカードの位置を保つ。
  button.setAttribute('aria-pressed',String(solo));button.textContent=solo?'全員の音にもどす':'この子の音だけ聴く';
}
function memberSays(m){
  const lines = [], wk = STAT_LABEL[weakest(m)], up = m.last?.d ? Math.max(0, ...STAT_KEYS.map(k => m.last.d[k] || 0)) : 0;
  if((m.sta ?? 100) < 30) lines.push('「ちょっと、疲れがたまってるかもしれません……」', '「体が重くて、思うように息が入らないです」');
  if(up >= 4) lines.push('「最近、音がよく出るようになってきました！」', '「先週の練習、手ごたえがありました」');
  if(m.stats[weakest(m)] < 50) lines.push(`「${wk}がどうしても苦手で……」`, `「${wk}、もう少しなんとかしたいです」`);
  if(m.trait === 'nervous') lines.push('「本番のことを考えると、今から緊張します」');
  if(m.trait === 'clutch') lines.push('「本番、早く来ないかなあ」');
  if(m.trait === 'loud') lines.push('「気づくと、自分の音だけ大きくなってるんです」');
  if(m.trait === 'shy') lines.push('「もっと自信を持って吹けたらいいんですけど」');
  if(m.grade === 3 && S.week >= 8) lines.push('「最後の年だから、悔いのないように吹きたいです」');
  if(m.grade === 1 && S.week < 10) lines.push('「早く先輩たちみたいに吹けるようになりたいです」');
  if(m.title === '部長') lines.push('「みんなが同じ方を向けるように、がんばります」');
  if(m.title === '学生指揮') lines.push('「合奏の前に、スコアをもう一回見ておきます」');
  if(m.title === 'パートリーダー') lines.push('「パートの音が、少しずつそろってきました」');
  if(S.pieceId && readMean(m, S.pieceId) < 40) lines.push('「自由曲、まだ楽譜を追うので精一杯です」');
  if(S.pieceId && readMean(m, S.pieceId) >= 90) lines.push('「自由曲、だいぶ歌えるようになってきました」');
  if(!lines.length) lines.push('「今日もよろしくお願いします」', '「合奏、楽しいです」');
  return lines[Math.floor(hash(m.id, S.year, S.week, 'say') * lines.length)];
}
function closeMemberNameForm(){
  const form = $('#memberNameForm'); if(!form) return;
  $('#memberName').value = memberById(form.dataset.mid)?.name || '';
  $('#memberName').removeAttribute('aria-invalid'); $('#memberNameError').hidden = true;
  form.hidden = true; form.dataset.composing = 'false';
  const edit = $('#memberCard [data-mact="rename"]'); edit.setAttribute('aria-expanded', 'false'); edit.focus({preventScroll: true});
  if(narrow.matches) $('#memberCard').scrollIntoView({block: 'start'});
}
// 直前の移動だけを戻す。新しい保存や再読み込みを越えて持ち越さない。
function canUndoMemberMove(){ return !!(U.moveUndo && U.moveUndo.after === S && !busy()); }
function commitMemberMove(plan){
  const undo = {before:S, mid:plan.m.id, ids:[plan.m.id,plan.other?.id].filter(Boolean), solo:U.solo, view:U.view};
  commit(plan.next);
  U.moveUndo = {...undo, after:S};
}
function undoMemberMove(){
  if(!canUndoMemberMove()) return false;
  const undo = U.moveUndo;
  stopPlay();
  if(U.moveUndo !== undo || !canUndoMemberMove()) return false;
  commit(undo.before);
  U.sel = undo.mid; U.solo = undo.solo; U.view = undo.view;
  applySolo(); U.perfNow = null;
  renderAll(); refreshNow();
  $('#memberCard [data-mact="close"]').focus({preventScroll:true});
  if(narrow.matches) $('#memberCard').scrollIntoView({block:'start'});
  toast('席を元に戻した。',1800);
  return true;
}
// 移動先を選ぶだけでは保存せず、実際の移動と同じ処理で二人の変化を確かめる。
function selectedMemberMove(){
  const m = U.sel && memberById(U.sel), value = $('#memberCard .mc-move')?.dataset.moveTo;
  if(!m || !value || (value !== 'bench' && !SEAT[value])) return null;
  const to = value === 'bench' ? null : value;
  if(m.seat === to || (!m.seat && !to)) return null;
  return {m, to, other:to && S.members.find(x => x.seat === to), next:moveMember(S, m.id, to)};
}
// 楽器のまとまりから顔を選ぶ。選び直しでも移動を確定しない。
function moveChoices(m, sec){
  const choice = (value, label, person, icon) => `<button class="move-choice" type="button" data-mact="movechoose" data-to="${value}" aria-pressed="false">${person ? memberFace(person,36) : `<span class="move-empty">${icon}</span>`}<span><b>${esc(person?.name || (value === 'bench' ? '控え' : '空席'))}</b><small>${esc(label)}</small></span><span class="move-check" aria-hidden="true">${uiIcon('check')}</span></button>`;
  return SEATS.filter(s => s.sec === sec && s.id !== m.seat).map(s => choice(s.id,seatLabel(s.id),S.members.find(x=>x.seat===s.id),instrumentIcon(s.inst))).join('') + (m.seat ? choice('bench','席なし',null,uiIcon('members')) : '');
}
function movePicker(m){
  const sec = m.seat ? SEAT[m.seat].sec : SECTIONS[0].id;
  return `<div class="move-groups" role="group" aria-label="楽器">${SECTIONS.map(s=>`<button type="button" data-mact="movegroup" data-sec="${s.id}" aria-pressed="${s.id===sec}">${instrumentIcon(SEATS.find(x=>x.sec===s.id).inst)}<span>${esc(s.name)}</span></button>`).join('')}</div><div class="move-choices" role="group" aria-label="移す先">${moveChoices(m,sec)}</div>`;
}
// 楽器の切り替えや選択の解除でも、移動先を画面の上から見渡せるようにする。
function scrollMemberMoveChoices(){
  const picker=$('#memberCard .mc-move');
  if(picker?.isConnected && picker.open && narrow.matches)picker.scrollIntoView({block:'start',behavior:!fxCalm()&&U.fxMode==='full'?'smooth':'auto'});
}
function renderMemberMove(){
  const preview = $('#movePreview'), button = $('#memberCard [data-mact="move"]');
  if(!preview || !button) return;
  const plan = selectedMemberMove();
  button.disabled = busy() || !plan;
  button.textContent = !plan ? '移す' : !plan.to ? '控えにする' : plan.other ? '交代する' : 'この席へ移す';
  preview.hidden = !plan;
  if(!plan){ preview.innerHTML = ''; return; }
  const people = [plan.m, plan.other].filter(Boolean);
  const label = id => id ? seatLabel(id) : '控え（席なし）';
  const seat = id => `<span class="move-seat">${id ? instrumentIcon(SEAT[id].inst) : uiIcon('members')}<span>${esc(label(id))}</span></span>`;
  preview.innerHTML = people.map(before => {
    const after = plan.next.members.find(x => x.id === before.id);
    const changed = ['pitch','tone'].filter(k => rankOf(before.stats[k]) !== rankOf(after.stats[k]));
    return `<div class="move-person" data-move-preview="${before.id}"><div class="move-person-head">${memberFace(before,36)}<b>${esc(before.name)}</b></div><div class="move-route" role="group" aria-label="${esc(before.name)}：${esc(label(before.seat))}から${esc(label(after.seat))}へ" data-move-from="${before.seat || 'bench'}" data-move-to="${after.seat || 'bench'}">${seat(before.seat)}${uiIcon('chevron')}${seat(after.seat)}</div>${changed.length ? `<div class="move-ranks">${changed.map(k => `<span data-move-rank="${k}" aria-label="${STAT_LABEL[k]} ${rankOf(before.stats[k])}から${rankOf(after.stats[k])}">${STAT_LABEL[k]}${rankBadge(before.stats[k])}${uiIcon('chevron')}${rankBadge(after.stats[k])}</span>`).join('')}</div>` : ''}</div>`;
  }).join('');
}
// いまの力は小さなランクを横に並べ、入部時からの変化は別に開く。
function memberCurrentRanks(m){
  return `<div class="mc-current"><div class="mc-current-grid">${STAT_KEYS.map(k=>`<span aria-label="${STAT_LABEL[k]} ${rankOf(m.stats[k])}"><small>${STAT_LABEL[k]}</small>${rankBadge(m.stats[k])}</span>`).join('')}</div>${m.mental!=null?`<div class="mc-mental"><span>本番の強さ</span>${rankBadge(m.mental)}</div>`:''}</div>`;
}
// 録音時の部員は見る・聴くだけにし、いまの部員の名前や席を変える操作を出さない。
function clearRecordedMember(){
  if(!U.recordMember) return;
  U.recordMember=null;U.recordPerf=null;U.sel=null;
  renderSelectors();renderMemberCard();renderRoster();
}
function renderRecordedMemberCard(card, m){
  card.innerHTML=`<button class="help-button mc-close" type="button" data-mact="close" aria-label="閉じる">${uiIcon('close')}</button><div class="mc-portrait">${memberFace(m,112)}<div class="mc-head"><h3>${esc(m.name)}</h3><span class="sub">${instrumentIcon(SEAT[m.seat].inst)}${m.grade ? `${m.grade}年・` : ''}${esc(seatLabel(m.seat))}</span><span class="small">録音時</span></div></div><div class="mc-actions"><button class="btn small" type="button" data-mact="recordsolo" aria-pressed="${U.solo===`member:${m.id}`}">${uiIcon('play')}この人だけ聴く</button>${U.solo!=='all'?'<button class="btn small quiet" type="button" data-mact="recordall">全員の音にもどす</button>':''}</div>${memberCurrentRanks(m)}`;
  card.dataset.recorded=m.id;
}
function renderMemberCard(){
  const card = $('#memberCard');
  delete card.dataset.recorded;
  if(U.recordMember){card.hidden=false;renderRecordedMemberCard(card,U.recordMember);return;}
  const m = U.sel && memberById(U.sel);
  if(!m){ card.hidden = true; return; }
  card.hidden = false;
  // 同じ子の音を聴き直しても、開いている成長や思い出を閉じない。
  const openDetails = card.dataset.member === m.id ? [...card.querySelectorAll(':scope > details[open]:not(.mc-move)')].map(d=>d.className) : [];
  card.dataset.member = m.id;
  const seat = m.seat && SEAT[m.seat];
  const tr = m.trait && TRAITS[m.trait];
  card.innerHTML = `<button class="help-button mc-close" type="button" data-mact="close" aria-label="閉じる">${uiIcon('close')}</button><div class="mc-portrait">${memberFace(m,112)}<div class="mc-head"><h3>${esc(m.name)}</h3>${m.title ? `<span class="tag">${m.title}</span>` : ''}<span class="sub">${seat?instrumentIcon(seat.inst):''}${m.grade}年・${seat ? PART_LABEL[seat.part] : '控え（席なし）'}</span><button class="mc-name-edit" type="button" data-mact="rename" aria-expanded="false" aria-controls="memberNameForm">名前を変える</button></div></div>
    <form class="mc-name-form" id="memberNameForm" data-mid="${m.id}" hidden novalidate><label for="memberName">名前<small>${MEMBER_NAME_MAX}文字まで</small></label><input id="memberName" name="memberName" type="text" value="${esc(m.name)}" maxlength="24" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" aria-describedby="memberNameError"><p id="memberNameError" class="mc-name-error" role="alert" hidden></p><div><button class="btn quiet" type="button" data-mact="renamecancel">やめる</button><button class="btn primary" type="submit">保存する</button></div></form>
    ${canUndoMemberMove() && U.moveUndo.ids.includes(m.id) ? '<div class="mc-undo"><span>席を移した</span><button class="btn small" type="button" data-mact="moveundo">元に戻す</button></div>' : ''}
    ${seat || U.solo !== 'all' ? `<div class="mc-actions">${seat ? `<button class="btn small" type="button" data-mact="solo" aria-pressed="${U.solo===`member:${m.id}`}">${uiIcon('play')}この人だけ聴く</button><button class="btn small" type="button" data-mact="secsolo" aria-pressed="${U.solo===`sec:${seat.sec}`}">${uiIcon('play')}パートだけ聴く</button>` : ''}${U.solo !== 'all' ? '<button class="btn small quiet" type="button" data-mact="all">全員の音にもどす</button>' : ''}</div>` : ''}
    <details class="mc-move" data-move-to=""><summary>席を移す</summary>${movePicker(m)}<div class="move-preview" id="movePreview" aria-live="polite" hidden></div><div class="mc-actions move-actions"><button class="btn quiet" type="button" data-mact="movecancel">やめる</button><button class="btn brass" type="button" data-mact="move" disabled>移す</button><button class="btn quiet move-stop" type="button" data-mact="movestop" aria-label="止める"${(U.playing || U.waitPlay) && !tabHidden('play') ? '' : ' hidden'}>${uiIcon('stop')}</button></div>
    <p class="small">楽器が変わると、その楽器での音程と音色は基礎からやり直しになる。</p></details>
    ${memberCurrentRanks(m)}
    <p class="mc-say">${esc(memberSays(m))}</p>
    ${dreamLine(m)}${loveLine(m)}
    ${m.first ? `<details class="mc-growth-history"><summary>入部からの成長</summary>${memberGrowth(m)}</details>` : ''}
    ${S.pieceId?`<details class="mc-reading"><summary>譜読み（${PIECES[S.pieceId].title}）</summary><div class="stats">${readUnits(S.pieceId).map(u=>rankRow(spanShort(u),readOf(m,S.pieceId)[u.i])).join('')}</div></details>`:''}
    <details class="mc-personality"><summary>スキル・癖</summary>${skillList(m)}${tr?`<p class="mc-trait">癖：${tr.name}。${tr.desc}</p>`:'<p class="mc-trait">目立った癖はない。</p>'}</details>
    ${memberStory(m)}`;
  for(const name of openDetails){ const detail=card.querySelector('details.'+name);if(detail)detail.open=true; }
  // 開いたら移動先をすぐ選べる位置へ。本人の顔は少し上へ戻れば見られる。
  card.querySelector('.mc-move').addEventListener('toggle',e=>{
    if(e.target.isConnected && e.target.open)scrollMemberMoveChoices();
  });
}
// 名簿の条件は画面だけに持つ。新しい部や新年度では、全員が見える状態へ戻す。
function rosterFilter(){
  const key = `${S.recruitSeed || 0}:${S.year}`;
  if(U.rosterAt !== key){ U.rosterAt = key; U.rosterFilter = {name:'',grade:'all',sec:'all'}; U.rosterPick = false; }
  return U.rosterFilter;
}
// 空白や文字の表記の違いを吸収する。名前の読み方は推測しない。
const rosterName = value => String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/gu,'').replace(/[ァ-ヶ]/gu,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
function rosterMatches(m, f){
  return (f.grade === 'all' || String(m.grade) === f.grade) && (f.sec === 'all' || (m.seat ? SEAT[m.seat].sec : 'bench') === f.sec) && rosterName(m.name).includes(rosterName(f.name));
}
function renderRosterFilters(f, count){
  const input=$('#rosterSearch');
  if(input.dataset.composing !== 'true' && input.value !== f.name) input.value=f.name;
  $('#rosterSearchClear').hidden=!input.value;
  if(!$('#rosterSearchClear').firstChild){$('#rosterSearchClear').innerHTML=uiIcon('close');$('.roster-search-icon').innerHTML=uiIcon('search');}
  const grades=$('#rosterGrades');
  if(!grades.firstChild) grades.innerHTML=[['all','全学年'],['1','1年'],['2','2年'],['3','3年']].map(([key,name])=>`<button type="button" data-roster-grade="${key}">${name}</button>`).join('');
  for(const b of grades.children)b.setAttribute('aria-pressed',String(b.dataset.rosterGrade===f.grade));
  const sec=f.sec==='bench'?{name:'控え'}:SEC[f.sec],button=$('#rosterInstrument');
  button.innerHTML=`${sec&&f.sec!=='bench'?instrumentIcon(SEATS.find(s=>s.sec===f.sec).inst):uiIcon('members')}<span>${sec?sec.name:'楽器：すべて'}</span>${uiIcon('chevron')}`;
  button.setAttribute('aria-label',`楽器で絞り込む：${sec?sec.name:'すべて'}`);button.setAttribute('aria-expanded',String(!!U.rosterPick));
  const grid=$('#rosterInstruments');grid.hidden=!U.rosterPick;
  if(!grid.firstChild)grid.innerHTML=[{id:'all',name:'すべて'},...SECTIONS,{id:'bench',name:'控え'}].map(s=>`<button type="button" data-roster-sec="${s.id}">${s.id==='all'||s.id==='bench'?uiIcon('members'):instrumentIcon(SEATS.find(x=>x.sec===s.id).inst)}<span>${s.name}</span></button>`).join('');
  for(const b of grid.children)b.setAttribute('aria-pressed',String(b.dataset.rosterSec===f.sec));
  const text=`${count}／${S.members.length}人`;if($('#rosterCount').textContent!==text)$('#rosterCount').textContent=text;
  $('#rosterReset').hidden=!(f.name || f.grade!=='all' || f.sec!=='all');
}
function rosterSearchInput(e){
  const input=$('#rosterSearch');if(e?.isComposing || input.dataset.composing==='true')return;
  const f=rosterFilter();if(f.name===input.value)return;
  f.name=input.value;renderRoster();
}
function renderRoster(){
  const f=rosterFilter(),visible=new Set(S.members.filter(m=>rosterMatches(m,f)).map(m=>m.id));
  renderRosterFilters(f,visible.size);
  // だれもいないパートが、いまの曲でどれだけ減点になるか
  const pid = S.pieceId, w = pid ? needWeight(pid) : {}, tot = Object.values(w).reduce((a, x) => a + x, 0) || 1;
  $('#secGrid').innerHTML = SECTIONS.map(s => {
    const ms = secMembers(S, s.id), seats = SEATS.filter(x => x.sec === s.id).length;
    const av = k => ms.length ? ms.reduce((a, m) => a + m.stats[k], 0) / ms.length : 0;
    const lose = !ms.length && w[s.id] ? LACK_MAX * w[s.id] / tot : 0;
    const inst=SEATS.find(x=>x.sec===s.id).inst;
    return `<button class="sec-tile" type="button" data-sec="${s.id}" aria-label="${s.name} ${ms.length}/${seats}人" aria-pressed="${U.view === s.id}"><b>${s.name}</b>
      <span class="sec-count">${instrumentIcon(inst)}<small>${ms.length}/${seats}人</small></span>
      <span class="sec-ranks">${STAT_KEYS.map(k=>`<span title="${STAT_LABEL[k]}">${rankBadge(av(k))}</span>`).join('')}</span>${lose?`<em class="lose">${lose>=1?`いない・この曲で −${Math.round(lose)}点`:'いない'}</em>`:''}</button>`;
  }).join('');
  const rows = [];
  for(const sec of SECTIONS){
    const ms = SEATS.filter(x => x.sec === sec.id).map(s => [s, S.members.find(x => x.seat === s.id)]).filter(([, m]) => m && visible.has(m.id));
    if(!ms.length) continue;
    rows.push(`<tr class="sec-row"><td colspan="5">${sec.name}</td></tr>`);
    for(const [s, m] of ms) rows.push(memberRow(m, PART_LABEL[s.part]));
  }
  const bench = S.members.filter(m => !m.seat && visible.has(m.id));
  if(bench.length){
    rows.push(`<tr class="sec-row"><td colspan="5">控え</td></tr>`);
    for(const m of bench) rows.push(memberRow(m, '席なし'));
  }
  $('#rosterTable').innerHTML = `<thead><tr><th>名前</th>${STAT_KEYS.map(k => `<th class="num">${STAT_LABEL[k]}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr class="empty"><td colspan="5">${S.members.length?'条件に合う部員はいない':'部員はまだいない'}</td></tr>`}</tbody>`;
}
function memberRow(m, part){
  const sub=`${m.grade}年・${part}${m.out&&m.seat?'（コンクール控え）':''}`;
  return `<tr class="mem${U.sel === m.id ? ' sel' : ''}" data-mid="${m.id}"><td><button class="roster-open" type="button" aria-expanded="${U.sel===m.id}" aria-controls="memberCard"><span class="roster-person">${memberFace(m,40)}<span><b>${esc(m.name)}</b>${m.title ? ` <span class="tag">${m.title}</span>` : ''}<small>${sub}</small></span></span></button></td>`
    + STAT_KEYS.map(k => `<td class="num">${rankBadge(m.stats[k])}</td>`).join('') + '</tr>';
}

// 選曲会議：いまの部の得意（4つの力のうち平均より高いもの）が、曲の採点で重く見られる曲を3つ選ぶ。{曲: '音色・表現'}
function pieceFit(){
  const ms = S.members.filter(m => m.seat);
  if(!ms.length) return {};
  const av = Object.fromEntries(STAT_KEYS.map(k => [k, ms.reduce((a, m) => a + m.stats[k], 0) / ms.length]));
  const mean = STAT_KEYS.reduce((a, k) => a + av[k], 0) / STAT_KEYS.length;
  const strong = STAT_KEYS.filter(k => av[k] > mean + 1).sort((a, b) => av[b] - av[a]);
  if(!strong.length) return {};
  const score = id => STAT_KEYS.reduce((a, k) => a + (PIECES[id].focus?.[k] ?? 1) * (av[k] - mean), 0);
  const top = PIECE_IDS.slice().sort((a, b) => score(b) - score(a)).slice(0, 3).filter(id => score(id) > 0);
  return Object.fromEntries(top.map(id => [id, strong.filter(k => (PIECES[id].focus?.[k] ?? 1) >= 1).map(k => STAT_LABEL[k]).slice(0, 2).join('・') || STAT_LABEL[strong[0]]]));
}
// 曲を選ぶときのお手本：全員の能力・譜読み・まとまりが100の部が、ホールでふつうの解釈で、ぴったりの指揮で吹いた演奏
function modelPerf(pid){
  return perform({members: fullBand({pitch: 100, rhythm: 100, tone: 100, expr: 100}), pieceId: pid, cohesion: 100, fam: 100, interp: {tempo: 1, dyn: 1, rub: 1}, venue: 'hall', seed: 'band', lead: () => 1});
}
// 曲のカード（選曲・課題曲・定期演奏会の曲）：短い曲名・作曲者・問われる力と、聴く・決めるボタン。曲の説明は「どんな曲？」で開く
function difficultyBadge(pid){
  const n = pieceDifficulty(pid);
  return `<button class="piece-difficulty" type="button" data-difficulty="${n}" aria-label="${esc(PIECES[pid].title)}の難しさ ${n}/5"${tipAttr('曲の難しさ','星が多い曲ほど、覚えるまでに練習時間がかかる。曲の練習も合奏も、譜読みがゆっくり進む。うまい部員や「譜読みが速い」スキルを持つ部員は、早く覚えられる。すでに覚えた分はそのまま残る。')}><span>難しさ</span><span class="difficulty-stars" aria-hidden="true">${Array.from({length:5},(_,i)=>`<span class="difficulty-star${i<n?' on':''}">${uiIcon('star')}</span>`).join('')}</span></button>`;
}
function pieceCard(id, {tag = '', note = '', act, label}){
  const pc = PIECES[id];
  // 作曲者と曲の説明は「どんな曲？」の中に置く。
  return `<div class="pcard">${tag ? `<span class="tag fit">${tag}</span>` : ''}<div class="piece-heading"><h3>${pc.title}</h3>${difficultyBadge(id)}</div>${note ? `<p>${note}</p>` : ''}
    <p class="asks">問われる力：<b>${pc.asks}</b></p>
    <details class="pdesc"><summary>どんな曲？</summary><p>${pc.composer}。${pc.full}。${pc.desc}</p></details>
    <div class="row"><button class="btn small" type="button" data-act="model" data-pid="${id}">${uiIcon('play')}お手本</button><button class="btn small" type="button" data-act="preview" data-pid="${id}">${uiIcon('play')}いまの部で</button><button class="btn small primary" type="button" data-act="${act}" data-pid="${id}">${label}</button></div></div>`;
}
const listenBtns = id => `<button class="btn small" type="button" data-act="model" data-pid="${id}">▶ お手本を聴く</button><button class="btn small" type="button" data-act="preview" data-pid="${id}">▶ いまの部で聴く</button>`;

/* ===== 数字の説明の吹き出し ===== */
let tipOwner=null;
function showTip(el){
  const tip = $('#tip');
  if(tip.dataset.for === el.dataset.tipname && !tip.hidden){ hideTip(); return; }
  hideTip();
  const stage=el.closest('.conduct');
  (stage||document.body).appendChild(tip);
  tipOwner=el;
  el.setAttribute('aria-describedby',[...(el.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean),'tip'].join(' '));
  tip.innerHTML = `<b>${esc(el.dataset.tipname)}</b>${esc(el.dataset.tip)}`;
  tip.dataset.for = el.dataset.tipname;
  tip.classList.toggle('over-stage',Boolean(stage));
  tip.hidden = false; tip.classList.remove('on');
  const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
  const left = clamp(r.left, 16, innerWidth - 16 - w);
  const below = r.bottom + 8 + h < innerHeight - 70;   // 下のタブにかからないように
  tip.style.left = `${left + (stage?0:scrollX)}px`;
  tip.style.top = `${(below ? r.bottom + 6 : r.top - 6 - h) + (stage?0:scrollY)}px`;
  tip.classList.toggle('up', !below);
  requestAnimationFrame(() => tip.classList.add('on'));
  haptic('tap');
}
function hideTip(){
  if(tipOwner){
    const ids=(tipOwner.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!=='tip');
    if(ids.length)tipOwner.setAttribute('aria-describedby',ids.join(' '));else tipOwner.removeAttribute('aria-describedby');
    tipOwner=null;
  }
  const tip=$('#tip');if(tip){tip.hidden=true;tip.classList.remove('on');delete tip.dataset.for;}
}

/* ===== まとめて描く ===== */
function renderAll(){
  hideTip();
  fxMoments();
  renderHeader(); renderPiece(); renderVenues(); renderSelectors();
  renderStats(); renderWeek(); renderLog();
  renderMemberCard(); renderRoster(); renderHistory();
  $('#btnNow').disabled = busy();
}

/* ===== 操作 ===== */
// 「この人だけ聴く」「パートだけ」を、全員の音にもどす
function soloAll(){ const was = U.solo !== 'all'; U.solo = 'all'; applySolo(); if(was){ renderSelectors(); renderMemberCard(); } }
// 今の部員の試聴は今の部から鳴らす。昔の録音やお手本の中から探さない。
function listenCurrentMember(id, section = false){
  if(!memberById(id)?.seat) return;
  if(U.playing && U.shown !== U.perfNow) stopPlay();
  // 停止時の処理で部が変わることもあるので、今いる本人を取り直す。
  const m = memberById(id); if(!m?.seat) return;
  U.sel = m.id;
  U.solo = section ? `sec:${SEAT[m.seat].sec}` : `member:${m.id}`;
  renderSelectors(); applySolo(); renderMemberCard();
  if(!U.playing) $('#btnNow').click();
}
function startStage(){
  stopPlay();
  soloAll();
  commit(beginStage(S));
  const rec = S.recs.find(r => r.id === S.pending.recId), setRec = S.pending.setRecId ? S.recs.find(r => r.id === S.pending.setRecId) : null;
  U.piece = null; U.range = 'all';
  setVenue(rec.venue);
  renderAll();
  // 指揮しないときも、舞台の部員が見えるように。A部門は課題曲・自由曲の順に続けて
  const ev = eventAt(S, S.week), seq = setRec ? [setRec, rec] : [rec], perfs = seq.map(r => perform(recCtx(r)));
  const title = r => `${ev.title}：${PIECES[r.pieceId].title}${setRec ? (r === setRec ? '（課題曲）' : '（自由曲）') : ''}`;
  openWatch(perfs[0], title(seq[0]));
  const playAt = i => playPerf(perfs[i], seq[i].label, natural => {
    if(!natural) return reveal();
    if(i + 1 >= seq.length) return applaudThenReveal();
    cdMsg('課題曲が終わった。続けて自由曲。');
    setTimeout(() => { if(CD.phase === 'watch'){ openWatch(perfs[i + 1], title(seq[i + 1])); playAt(i + 1); } }, 1600);
  });
  // 幕の前で会場と曲を紹介し、幕が開いて部員が席についてから演奏
  const go = () => playAt(0);
  if(fxCalm() || U.fxMode !== 'full') go(); else stageIntro(perfs[0], ev, rec, go, setRec ? `課題曲 ${PIECES[setRec.pieceId].title}・自由曲 ${PIECES[rec.pieceId].title}` : null);
  setTimeout(() => { if(E.ac) applauseBuffer(E.ac); }, 2500);   // 拍手の音は、演奏中に作っておく
}
// 本番を自分で指揮する：結果はいったん部員まかせで決め、指揮しきったら指揮の演奏で採点し直す
function startStageConduct(){
  stopPlay();
  soloAll();
  commit(beginStage(S));
  const rec = S.recs.find(r => r.id === S.pending.recId), setRec = S.pending.setRecId ? S.recs.find(r => r.id === S.pending.setRecId) : null;
  U.piece = null; U.range = 'all';
  setVenue(rec.venue);
  renderAll();
  const ev = eventAt(S, S.week);
  if(!setRec) return openConduct({rec, ev});
  // A部門：課題曲は部員まかせで吹くのを聴いてから、続けて自由曲を指揮する（とばすと、指揮せずに結果へ）
  const perf = perform(recCtx(setRec));
  openWatch(perf, `${ev.title}：${PIECES[setRec.pieceId].title}（課題曲）`);
  const go = () => playPerf(perf, setRec.label, natural => {
    if(!natural) return reveal();
    cdMsg('課題曲が終わった。続けて、自由曲を指揮する。');
    setTimeout(() => { if(CD.phase === 'watch'){ closeWatch(); openConduct({rec, ev}); } }, 1600);
  });
  if(fxCalm() || U.fxMode !== 'full') go(); else stageIntro(perf, ev, rec, go, `課題曲 ${PIECES[setRec.pieceId].title}・自由曲 ${PIECES[rec.pieceId].title}`);
}
function reveal(){
  closeWatch();
  if(!S.pending || S.pending.revealed) return;
  S.pending.revealed = true;
  commit(S);
  renderAll();
  const p = S.pending;
  if(p.kind === 'concert') haptic(p.q >= 60 ? 'success' : 'tap');
  // コンクールは、ホールでの結果発表から
  else if(p.judge) showAnnounce(p.judge, p.judge.level, () => setTab('week'), p.division);
}
// 本番が鳴り終わったら、客席から拍手（出来がよいほど大きく長い）。少し聴いてから結果へ
const stageHeat = p => p.kind === 'concert' ? clamp01((p.q - 20) / 70) : clamp01((p.judge.avg - 45) / 40);
function applaudThenReveal(){
  if(S.pending && !S.pending.revealed){ E.applaud(stageHeat(S.pending)); stageCurtainClose(); setTimeout(reveal, 2300); }
  else reveal();
}
// アンサンブルコンテストの本番：幕が上がって、選んだ部員だけが舞台で吹く。鳴り終わったら拍手、それから結果
function playEnsemble(){
  const e = S.winter?.ens, rec = e && S.recs.find(r => r.id === e.recId);
  if(!rec) return;
  stopPlay(); soloAll(); setVenue(rec.venue);
  const perf = perform(recCtx(rec));
  const done = () => { closeWatch(); if(U.ensHide === S.year){ U.ensHide = null; renderAll(); haptic(e.award === 'gold' ? 'success' : 'tap'); } };
  openWatch(perf, `アンサンブルコンテスト：${PIECES[rec.pieceId].title}（${e.names.length}人）`);
  const go = () => playPerf(perf, rec.label, natural => {
    if(!natural) return done();
    E.applaud(clamp01((e.score - 45) / 40)); stageCurtainClose(); setTimeout(done, 2300);
  });
  if(fxCalm() || U.fxMode !== 'full') go(); else stageIntro(perf, {title: 'アンサンブルコンテスト'}, rec, go, `${e.names.length}人で「${PIECES[rec.pieceId].title}」`);
}
function playRec(id){
  const rec = S.recs.find(r => r.id === id);
  if(!rec) return;
  playRecording(rec, `${rec.label}（${VENUE[rec.venue].name}で録音）`);
}
function bind(){
  $('#recordingList').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b || b.disabled)return;
    if(b.dataset.recordPlay)listenLibraryRecording(b.dataset.recordPlay);
    else if(b.dataset.recordSave)saveLibraryRecording(b.dataset.recordSave);
  });
  $('#recordingPanel').addEventListener('toggle',e=>{
    if(!e.target.open)return;
    const list=$('#recordingList'),id=activeLibraryRecording()?.id || $('#recSel').value,row=[...list.querySelectorAll('[data-record-item]')].find(el=>el.dataset.recordItem===id);
    if(row)list.scrollTop+=row.getBoundingClientRect().top-list.getBoundingClientRect().top-30;
    if(narrow.matches)e.target.scrollIntoView({block:'start',behavior:!fxCalm()&&U.fxMode==='full'?'smooth':'auto'});
  });
  $('#recordingPanel').addEventListener('keydown',e=>{
    const panel=$('#recordingPanel');if(e.key==='Escape' && panel.open && $('#tip').hidden){e.preventDefault();panel.open=false;panel.querySelector('summary').focus({preventScroll:true});}
  });
  $('#diagPractice').addEventListener('toggle',e=>{
    const state=U.diagPractice;if(!state || !diagPracticeView())return;
    if(e.target.open && narrow.matches)e.target.scrollIntoView({block:'start',behavior:!fxCalm()&&U.fxMode==='full'?'smooth':'auto'});
  });
  $('#diagPractice').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.diagTopic){U.diagPractice.topic=b.dataset.diagTopic;renderDiagPractice();document.querySelector(`[data-diag-topic="${b.dataset.diagTopic}"]`)?.focus({preventScroll:true});}
    else if(b.dataset.diagMember)openDiagPracticeMember(b.dataset.diagMember);
  });
  $('#diagPractice').addEventListener('keydown',e=>{
    const el=$('#diagPractice');if(e.key==='Escape' && el.open && $('#tip').hidden){e.preventDefault();el.open=false;el.querySelector('summary').focus({preventScroll:true});}
  });
  for(const [id, icon, label] of [['btnNow','play','いまの音で合奏'],['btnStop','stop','止める'],['btnLiveNow','play','いまの音'],['btnConduct','conduct','指揮する'],['btnRec','play','聴く'],['btnSave','download','保存']]) $('#'+id).innerHTML = uiIcon(icon) + label;
  $('#rollPanel').addEventListener('toggle', e => { if(e.target.open) drawRoll(U.shown, U.playing ? E.now() : -1); });
  $('#btnNow').addEventListener('click', () => {
    // すぐ再生したときは、予約した作り直しをここで行い、同じ音を二度作らない。
    clearTimeout(U.refreshT);
    if(!U.perfNow){ U.perfNow = currentPerformance(); U.diag = analyze(U.perfNow); renderDiag(); }
    playPerf(U.perfNow, nowLabel());
  });
  $('#btnLiveNow').addEventListener('click',()=>{
    if(libraryBlocked())return;
    stopPlay();soloAll();clearRecordedMember();$('#btnNow').click();
  });
  $('#btnRec').addEventListener('click', () => listenLibraryRecording($('#recSel').value));
  $('#btnStop').addEventListener('click', stopPlay);
  $('#grNext').addEventListener('click', e => { e.stopPropagation(); grNext(); });
  $('#grCard').addEventListener('click', e => { const b=e.target.closest('[data-grad-member]');if(b)grSelect(b.dataset.gradMember); });
  $('#grSkip').addEventListener('click', e => { e.stopPropagation(); closeGradRoll(false); });
  $('#grPrev').addEventListener('click',e=>{e.stopPropagation();grPrev();});
  for(const name of ['pointerdown','keydown','scroll','toggle'])$('#grCard').addEventListener(name,pauseGradRoll,{passive:true,capture:true});
  $('#prefBox').addEventListener('click', e => {
    const b = e.target.closest('[data-pref]'); if(!b) return;
    const [k, v] = b.dataset.pref.split(':');
    if(k === 'sfx') U.sfx = v === 'on'; else U.fxMode = v;
    saveUI(); renderPrefs(); haptic('tap');
    if(k === 'sfx' && U.sfx) sfx('skill');
  });
  $('#saveBox').addEventListener('click', e => { const b = e.target.closest('[data-sv]'); if(b){ haptic('tap'); saveAction(b.dataset.sv); } });
  $('#svFile').addEventListener('change', async e => { const f = e.target.files?.[0]; if(f){ $('#svCode').value = (await f.text()).trim(); $('#svMsg').textContent = 'ファイルを読んだ。「このセーブで続ける」を押そう。'; } });
  $('#svCode').addEventListener('input', () => { const b = document.querySelector('[data-sv="load"]'); b.dataset.armed = ''; b.textContent = 'このセーブで続ける'; });
  // 画面に触れたら、音を出せる状態にしておく（iPhone は、タップの中でしか鳴らし始められない）
  for(const ev of ['touchend', 'click', 'keydown']) document.addEventListener(ev, () => E.unlock(), {capture: true, passive: true});
  // 数字を押すと説明が出る。ほかの所を押すと消える
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-tip]');
    if(el) showTip(el); else if(!e.target.closest('#tip')) hideTip();
  });
  document.addEventListener('keydown', e => {
    const el = e.target.closest?.('[data-tip]');
    if(el && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); showTip(el); }
    else if(e.key === 'Escape') hideTip();
  });
  addEventListener('resize', hideTip);
  $('#pieceSwitch').addEventListener('click', e => {
    const b = e.target.closest('[data-pswitch]'); if(!b) return;
    stopPlay(); haptic('tap');
    U.piece = b.dataset.pswitch === S.pieceId ? null : b.dataset.pswitch; U.range = 'all';
    renderPiece(); refreshNow();
  });
  $('#sndStatus').addEventListener('click', e => {
    if(!e.target.closest('[data-sndretry]') || !SAMPLES.error || busy() || CD.phase !== 'idle') return;
    // 音源を途中で入れ替えず、一度止めてから読めなかった録音を読み直す。
    stopPlay();
    const loading = loadSamples('snd/', renderSnd, {retry:true});
    renderSnd(); $('#btnNow').focus({preventScroll:true});
    loading.then(renderSnd, renderSnd);
  });
  $('#venueSel').addEventListener('change', e => setVenue(e.target.value));
  $('#rangeSel').addEventListener('change', e => {
    const value=e.target.value;
    if(recordingPlayback()) return;
    stopPlay();U.range=value;U.perfNow=null;renderPiece();refreshNow();
  });
  $('#soloSel').addEventListener('change', e => { U.solo = e.target.value; applySolo(); renderMemberCard(); renderListeningSummary(); });
  $('#viewSel').addEventListener('change', e => { U.view = e.target.value; renderSelectors(); renderRoster(); drawIdle(); if(U.playing) drawRoll(U.shown, E.now()); });
  // 本番を見ているあいだ：舞台の部員をタップすると、その子の様子
  $('#cdStage').addEventListener('click', e => {
    if(CD.phase !== 'watch' || CD.intro) return;
    const s = seatAt(e, $('#cdStage')), m = s && S.members.find(x => x.seat === s.id && CD.who.has(x.id));
    haptic('tap'); showCdMember(m && m.id !== CD.sel ? m.id : null);
  });
  $('#cdMember').addEventListener('click', e => {
    const b = e.target.closest('[data-cdm]'); if(!b) return;
    if(b.dataset.cdm === 'close') showCdMember(null);
    else if(b.dataset.cdm === 'solo')toggleCdMemberSolo();
  });
  $('#stage').addEventListener('click', e => {
    const s = seatAt(e);
    if(!s) return;
    // 録音は当時の部員を開き、同じ席の現部員と取り違えない。
    const recorded = recordingPlayback();
    const m = recorded ? U.stageMembers.get(s.id) : U.playing && U.stageMembers ? S.members.find(x => x.id === U.stageMembers.get(s.id)?.id) : S.members.find(x => x.seat === s.id);
    U.recordMember=recorded&&m?m:null;U.recordPerf=U.recordMember?U.shown:null;
    U.sel = m ? m.id : null;
    // 部員を開いても、舞台と音の動きの表示範囲は保つ。
    placeCard('stage');
    renderSelectors(); renderMemberCard(); renderRoster(); drawIdle();
    if(m) $('#memberCard').scrollIntoView({block:narrow.matches?'start':'nearest',behavior:!fxCalm()&&U.fxMode==='full'?'smooth':'auto'});
  });
  $('#secGrid').addEventListener('click', e => {
    const b = e.target.closest('[data-sec]'); if(!b) return;
    U.view = U.view === b.dataset.sec ? 'mel' : b.dataset.sec;
    renderSelectors(); renderRoster(); drawIdle();
    if(tabHidden('play') && U.view !== 'mel'){ setTab('play'); $('#rollPanel').open = true; drawRoll(U.shown); $('.roll-wrap').scrollIntoView({block: 'center'}); }
  });
  $('#rosterSearch').addEventListener('input',rosterSearchInput);
  $('#rosterSearch').addEventListener('search',rosterSearchInput);
  $('#rosterSearch').addEventListener('compositionstart',()=>{$('#rosterSearch').dataset.composing='true';});
  $('#rosterSearch').addEventListener('compositionend',()=>{$('#rosterSearch').dataset.composing='false';rosterSearchInput();});
  $('#rosterSearchForm').addEventListener('submit',e=>{
    e.preventDefault();if($('#rosterSearch').dataset.composing==='true')return;
    const first=$('#rosterTable .roster-open');if(first){first.focus({preventScroll:true});first.scrollIntoView({block:'nearest'});}else $('#rosterSearch').blur();
  });
  $('#rosterFind').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    const f=rosterFilter();
    if(b.id==='rosterSearchClear'){f.name='';renderRoster();$('#rosterSearch').focus({preventScroll:true});}
    else if(b.id==='rosterReset'){f.name='';f.grade='all';f.sec='all';U.rosterPick=false;renderRoster();$('#rosterSearch').focus({preventScroll:true});}
    else if(b.dataset.rosterGrade){f.grade=b.dataset.rosterGrade;renderRoster();}
    else if(b.id==='rosterInstrument'){U.rosterPick=!U.rosterPick;renderRoster();if(U.rosterPick){const chosen=$('#rosterInstruments [aria-pressed="true"]');chosen.focus({preventScroll:true});chosen.scrollIntoView({block:'nearest'});}}
    else if(b.dataset.rosterSec){f.sec=b.dataset.rosterSec;U.rosterPick=false;renderRoster();$('#rosterInstrument').focus({preventScroll:true});}
  });
  $('#rosterFind').addEventListener('keydown',e=>{
    if(e.key!=='Escape'||e.isComposing||$('#rosterSearch').dataset.composing==='true')return;
    if(U.rosterPick){e.preventDefault();U.rosterPick=false;renderRoster();$('#rosterInstrument').focus({preventScroll:true});}
    else if(e.target.id==='rosterSearch' && e.target.value){e.preventDefault();rosterFilter().name='';renderRoster();}
  });
  $('#rosterTable').addEventListener('click', e => {
    const tr = e.target.closest('[data-mid]'); if(!tr) return;
    clearRecordedMember();
    U.cardReturn={id:tr.dataset.mid,top:scrollY};
    U.sel = tr.dataset.mid;
    if(narrow.matches) placeCard('roster');
    renderSelectors(); renderMemberCard(); renderRoster(); drawIdle();
    $('#memberCard').scrollIntoView({block:narrow.matches?'start':'nearest',behavior:!fxCalm()&&U.fxMode==='full'?'smooth':'auto'});
    $('#memberCard [data-mact="close"]').focus({preventScroll:true});
  });
  $('#log').addEventListener('click',e=>{
    const summary=e.target.closest('summary');if(!summary)return;
    const d=summary.closest('[data-logweek]');if(d)U.journalOpen.set(d.dataset.logweek,!d.open);
  });
  $('#memberCard').addEventListener('click', e => {
    const b = e.target.closest('[data-mact]'); if(!b) return;
    const act = b.dataset.mact;
    if(act === 'close'){
      const fromStage = $('#memberCard').dataset.origin === 'stage';
      const back=$('#memberCard').dataset.origin==='roster'&&U.cardReturn;
      U.recordMember=null;U.recordPerf=null;U.sel=null;renderSelectors();renderMemberCard();renderRoster();drawIdle();
      if(back){const row=document.querySelector(`[data-mid="${back.id}"] .roster-open`);if(row){row.focus({preventScroll:true});window.scrollTo(0,back.top);}else{$('#rosterSearch').focus({preventScroll:true});$('#rosterFind').scrollIntoView({block:'nearest'});}}
      else if(fromStage && narrow.matches) $('#stage').scrollIntoView({block:'start'});
      U.cardReturn=null;return;
    }
    if(U.recordMember){
      if(act==='recordsolo'||act==='recordall'){
        U.solo=act==='recordsolo'?`member:${U.recordMember.id}`:'all';applySolo();renderSelectors();renderMemberCard();
      }
      return;
    }
    const m = memberById(U.sel); if(!m) return;
    if(act === 'moveundo'){ undoMemberMove(); return; }
    if(act === 'movestop'){ stopPlay(); return; }
    if(act === 'movecancel'){
      const picker=$('#memberCard .mc-move');picker.dataset.moveTo='';
      picker.querySelectorAll('[data-mact="movechoose"]').forEach(x=>x.setAttribute('aria-pressed','false'));
      renderMemberMove();picker.open=false;picker.querySelector('summary').focus({preventScroll:true});
      if(narrow.matches) $('#memberCard').scrollIntoView({block:'start'});return;
    }
    if(act === 'movegroup'){
      const section=SECTIONS.find(s=>s.id===b.dataset.sec);if(!section)return;
      const picker=$('#memberCard .mc-move');picker.dataset.moveTo='';
      picker.querySelectorAll('[data-mact="movegroup"]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
      picker.querySelector('.move-choices').innerHTML=moveChoices(m,section.id);
      renderMemberMove();scrollMemberMoveChoices();return;
    }
    if(act === 'movechoose'){
      const picker=$('#memberCard .mc-move');
      picker.dataset.moveTo=picker.dataset.moveTo===b.dataset.to?'':b.dataset.to;
      picker.querySelectorAll('[data-mact="movechoose"]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.to===picker.dataset.moveTo)));
      renderMemberMove();
      // 選んだだけでは移さず、二人の移動先を確定ボタンの上で見せる。
      if(narrow.matches && !$('#movePreview').hidden) $('#movePreview').scrollIntoView({block:'nearest',behavior:!fxCalm()&&U.fxMode==='full'?'smooth':'auto'});
      else if(!picker.dataset.moveTo)scrollMemberMoveChoices();
      return;
    }
    if(act === 'rename'){
      $('#memberNameForm').hidden = false; b.setAttribute('aria-expanded', 'true');
      $('#memberName').focus({preventScroll: true}); $('#memberName').select();
      if(narrow.matches) $('#memberCard').scrollIntoView({block: 'start'}); return;
    }
    if(act === 'renamecancel'){ closeMemberNameForm(); return; }
    if(act === 'solo') listenCurrentMember(m.id);
    else if(act === 'secsolo') listenCurrentMember(m.id, true);
    else if(act === 'all'){ U.solo = 'all'; renderSelectors(); applySolo(); renderMemberCard(); }
    else if(act === 'move'){
      if(busy() || !selectedMemberMove()) return;
      // 移動前の音と読み込み待ちを止め、止めたあとに最新の部から移動を決める。
      stopPlay();
      const plan = selectedMemberMove(); if(busy() || !plan) return;
      commitMemberMove(plan);
      const [type, id] = U.solo.split(':');
      if((type === 'member' && !memberById(id)?.seat) || (type === 'sec' && !seated(S).some(x => SEAT[x.seat].sec === id))) U.solo = 'all';
      applySolo();
      if(plan.m.seat && U.view === SEAT[plan.m.seat].sec) U.view = plan.to ? SEAT[plan.to].sec : 'mel';
      U.perfNow = null;
      renderAll(); refreshNow();
      $('#memberCard [data-mact="close"]').focus({preventScroll:true});
      if(narrow.matches) $('#memberCard').scrollIntoView({block:'start'});
      toast('席を移した。',1800);
    }
  });
  $('#memberCard').addEventListener('submit', e => {
    const form = e.target.closest('#memberNameForm'); if(!form) return;
    e.preventDefault(); if(form.dataset.composing === 'true') return;
    const m = memberById(form.dataset.mid); if(!m) return;
    const input = $('#memberName'), error = memberNameError(S, m.id, input.value);
    if(error){ $('#memberNameError').textContent = error; $('#memberNameError').hidden = false; input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
    haptic('tap'); commit(renameMember(S, m.id, input.value)); renderAll(); refreshNow();
    $('#memberCard [data-mact="rename"]')?.focus({preventScroll: true}); toast('名前を変えた。', 1800);
    if(narrow.matches) $('#memberCard').scrollIntoView({block: 'start'});
  });
  for(const type of ['compositionstart', 'compositionend']) $('#memberCard').addEventListener(type, e => {
    const form = e.target.closest('#memberNameForm'); if(form) form.dataset.composing = String(type === 'compositionstart');
  });
  $('#memberCard').addEventListener('keydown', e => {
    if(e.key === 'Escape' && !e.isComposing && !$('#memberNameForm')?.hidden){ e.preventDefault(); closeMemberNameForm(); }
    else if(e.key === 'Escape' && !e.isComposing && $('#memberCard .mc-move')?.open){ e.preventDefault(); $('#memberCard [data-mact="movecancel"]').click(); }
  });
  $('#week').addEventListener('keydown',e=>{if(e.key==='Escape'&&U.pick){e.preventDefault();closePracticePicker();}else if(e.key==='Escape'&&U.outPick?.size&&e.target.closest('.outing')&&$('#tip').hidden){e.preventDefault();cancelOutingSelection();}else if(e.key==='Escape'&&U.prepPanel&&e.target.closest('.preparation')){e.preventDefault();togglePreparation(U.prepPanel);}});
  $('#week').addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b || b.disabled) return;
    if(b.dataset.gradMember){ openGradRoll(b.dataset.gradMember); return; }
    if(b.dataset.prepToggle){togglePreparation(b.dataset.prepToggle);return;}
    if(b.dataset.practiceMember){haptic('tap');focusPracticeMember(b.dataset.practiceMember,b.dataset.practiceSource);return;}
    if(b.dataset.polall){ commit(setPolicy(S, b.dataset.polall)); renderWeek();document.querySelector(`[data-polall="${b.dataset.polall}"]`)?.focus({preventScroll:true});return; }
    // 今週の練習：ボタンで一覧を開き、選ぶと閉じる（パートの「まとめて選ぶ」は、そのパートの全員に）
    if(b.dataset.pick){ haptic('tap');openPracticePicker(b.dataset.pick);return; }
    if(b.dataset.pset){
      haptic('tap');
      const key = b.dataset.pset, v = b.dataset.menu || null, sec = key.startsWith('sec:') ? key.slice(4) : null;
      let s2 = S;
      if(sec){ for(const m of S.members) if((m.seat ? SEAT[m.seat].sec : 'bench') === sec) s2 = setPlan(s2, m.id, v); }
      else s2 = setPlan(S, key, v);
      commit(s2);closePracticePicker();return;
    }
    if(b.dataset.spanset){ haptic('tap'); commit(setPlanSpan(S, b.dataset.spanset, b.dataset.i === '' ? null : +b.dataset.i)); renderWeek();document.querySelector(`[data-spanset="${b.dataset.spanset}"][data-i="${b.dataset.i}"]`)?.focus({preventScroll:true});return; }
    if(b.dataset.audplay){
      listenAudition('member',b.dataset.audplay);
      return;
    }
    if(b.dataset.aud){
      const a = b.dataset.aud;
      if(a === 'all'){ haptic('tap'); U.draft = new Set(); updateAuditionSelection(); }
      else if(a === 'best'){
        const state = S, el = $('#audPred'); haptic('tap'); U.audSearching = true; updateAuditionSelection();
        setTimeout(() => { if(S !== state || !el.isConnected) return; U.draft = recommendLineup(state); U.audSearching = false; updateAuditionSelection(true); }, 30);
      }
      else if(a === 'listen' || a === 'listenall') listenAudition(a === 'listenall' ? 'all' : 'selected');
      else if(a === 'cancel'){ if(auditionListening()) stopPlay(); U.lineup = false; U.draft = null; renderWeek(); }
      return;
    }
    if(b.dataset.ep !== undefined){ haptic('tap'); commit(resolveEpisode(S, +b.dataset.ep)); renderAll(); refreshNow(); return; }
    if(b.dataset.cs !== undefined){ haptic('tap'); commit(resolveConsult(S, +b.dataset.cs)); renderAll(); refreshNow(); return; }
    if(b.dataset.wplan){ haptic('tap'); commit(chooseWinterPlan(S, b.dataset.wplan)); renderAll(); refreshNow(); scrollTo(0, 0); return; }
    if(b.dataset.ens){ const id = b.dataset.ens; if(U.ensPick.has(id)) U.ensPick.delete(id); else if(U.ensPick.size < ENS_MAX) U.ensPick.add(id); else return; haptic('tap'); updateEnsembleSelection(); return; }
    if(b.dataset.split){ haptic('tap'); commit(setSplit(S, b.dataset.split)); renderWeek();document.querySelector(`[data-split="${b.dataset.split}"]`)?.focus({preventScroll:true});return; }
    if(b.dataset.rid){ asgSelect(b.dataset.rid, narrow.matches); return; }
    if(b.dataset.asgnav){ const i = S.recruits.findIndex(r => r.id === U.asg?.sel); asgSelect(S.recruits[i + Number(b.dataset.asgnav)]?.id, narrow.matches); return; }
    if(b.dataset.asgseat){ asgChooseSeat(b.dataset.asgseat); return; }
    if(b.dataset.asg === 'bench'){ if(U.asg?.sel){ haptic('tap'); U.asg.picks[U.asg.sel] = null; asgUpdate(); $('#asgFocus').focus({preventScroll: true}); if(narrow.matches) $('#asgFocus').scrollIntoView({block: 'start'}); } return; }
    if(b.dataset.op !== undefined){
      const id = b.dataset.op, v = outingView(S);
      if(U.outPick.has(id)) U.outPick.delete(id); else if(v && U.outPick.size < v.n) U.outPick.add(id); else return;
      U.outFocus=id;haptic('tap');updateOutingSelection();return;
    }
    if(b.hasAttribute('data-out-cancel')){cancelOutingSelection();return;}
    if(b.dataset.act === 'outing'){
      const view=outingView(S),ids=[...U.outPick].filter(id=>seated(S).some(m=>m.id===id));if(!view||!ids.length)return;
      const people=ids.slice(0,view.n).map(id=>{const m=memberById(id);return {id:m.id,name:m.name,originalName:m.originalName};});
      haptic('tap');commit(resolveOuting(S,ids));U.outResult={key:outingResultKey(),people};U.outPick=new Set();renderAll();refreshNow();
      $('[data-out-result-title]')?.focus({preventScroll:true});$('.outing-result')?.scrollIntoView({block:'start',behavior:!fxCalm()&&U.fxMode==='full'?'smooth':'auto'});return;
    }
    const act = b.dataset.act;
    if(act === 'preview' || act === 'model'){
      const pid = b.dataset.pid;
      U.piece = pid; U.range = 'all'; renderPiece(); U.perfNow = currentPerformance(); U.diag = analyze(U.perfNow); renderDiag();
      if(act === 'model') playPerf(modelPerf(pid), `お手本：${PIECES[pid].title}（全員がうまい部・${VENUE.hall.name}）`);
      else playPerf(U.perfNow, `いまの部で：${PIECES[pid].title}${readAvg(S, pid) < 5 ? '（譜読み前）' : ''}`);
    }
    else if(act === 'choose'){ stopPlay(); commit(choosePiece(S, b.dataset.pid)); U.piece = null; renderAll(); refreshNow(); scrollTo(0, 0); }
    else if(act === 'chooseset'){ stopPlay(); commit(chooseSetPiece(S, b.dataset.pid)); U.piece = null; renderAll(); refreshNow(); scrollTo(0, 0); }
    else if(act === 'tunegame') openTuneGame();
    else if(act === 'calm'){ haptic('tap'); commit(calmMember(S, b.dataset.mid)); renderWeek(); }
    else if(act === 'huddle'){ haptic('tap'); commit(huddle(S)); renderWeek(); }
    else if(act === 'choosefinal'){ stopPlay(); commit(chooseFinalPiece(S, b.dataset.pid)); U.piece = null; renderAll(); refreshNow(); }
    else if(act === 'test'){ commit(practiceWeek(S, 'test')); renderAll(); refreshNow(); }
    else if(act === 'practice'){ if(busy()) return; haptic('tap'); const b0 = weekSnap(S); commit(practiceWeek(S)); U.weekRes = {key: `${S.year}:${S.week}`, b: b0, n: 1}; renderAll(); refreshNow(); }
    else if(act === 'practicemany'){
      // 今週はいまの指示で、2週目からは部の方針どおりに、何か決めることがある週まで進める
      if(busy()) return; haptic('tap');
      let n = 0;
      const b0 = weekSnap(S);
      do { commit(practiceWeek(S)); n++; } while(n < 12 && quietWeek(S));
      U.weekRes = {key: `${S.year}:${S.week}`, b: b0, n};
      const ev = eventAt(S, S.week);
      const why = episodeView(S) ? '部員のできごとが起きた' : outingView(S) ? `行事のおさそいが来た（${outingView(S).o.title}）` : recruitsDue(S) ? '新しい部員が来た' : S.chooseFinal ? '定期演奏会の曲を決める' : ev && ev.kind !== 'mod' ? ev.title : '';
      renderAll(); refreshNow(); setTab('week'); scrollTo(0, 0);
      toast(`${n}週すすめた${why ? `。${why}` : ''}`, 3500);
    }
    else if(act === 'lineupopen'){ if(!S.audition || S.audition.y !== S.year) commit(startAudition(S)); U.lineup = true; U.draft = null; renderWeek(); $('#week').scrollIntoView({block: 'start'}); }
    else if(act === 'lineup'){
      if(seated(S).every(m => U.draft.has(m.id))){ $('#audPred').innerHTML = '<b>だれも出ないことになってしまう。1人以上は選ぼう。</b>'; return; }
      if(auditionListening()) stopPlay();
      haptic('tap'); commit(setLineup(S, U.draft)); U.lineup = false; U.draft = null; renderAll(); refreshNow();
    }
    else if(act === 'assign'){
      haptic('tap'); commit(assignRecruits(S, {...U.asg.picks})); U.asg = null; renderAll(); refreshNow();
    }
    else if(act === 'show'){ haptic('tap'); commit(toggleShow(S, b.dataset.sec)); renderWeek(); }
    else if(act === 'stage') startStage();
    else if(act === 'stageconduct') startStageConduct();
    else if(act === 'reveal'){ stopPlay(); reveal(); }
    else if(act === 'next'){ stopPlay(); commit(finishStage(S)); renderAll(); refreshNow(); }
    else if(act === 'newyear'){ stopPlay(); commit(newYear(S)); U.sel = null; U.piece = null; renderAll(); refreshNow(); }
    else if(act === 'gradroll') openGradRoll();
    else if(act === 'winter'){ stopPlay(); commit(startWinter(S)); U.sel = null; renderAll(); refreshNow(); scrollTo(0, 0); }
    else if(act === 'enslisten')listenEnsemble();
    else if(act === 'ensgo'){ stopPlay(); haptic('tap'); commit(runEnsemble(S, [...U.ensPick])); U.ensHide = S.year; renderAll(); playEnsemble(); }
    else if(act === 'ensskip'){ commit(skipEnsemble(S)); renderAll(); }
    else if(act === 'wnext'){ stopPlay(); const ny = winterStep(S).id === 'grad'; commit(winterNext(S)); if(ny){ U.sel = null; U.piece = null; } renderAll(); refreshNow(); scrollTo(0, 0); }
    else if(act === 'enswatch') playEnsemble();
    else if(act === 'graddone'){ haptic('tap'); commit({...S, winter: {...S.winter, gradDone: true}}); renderAll(); scrollTo(0, 0); }
    else if(act === 'ensreveal'){ stopPlay(); closeWatch(); U.ensHide = null; renderAll(); }
    else if(act === 'playrec') playRec(b.dataset.id);
    else if(act === 'saverec'){ const rec = S.recs.find(r => r.id === b.dataset.id); if(rec) saveRecording(rec); }
    else if(act === 'memplay' || act === 'memsave'){
      const rec = S.recs.find(r => r.id === b.dataset.id), m = memberById(b.dataset.mid);
      if(!rec || !m) return;
      if(act === 'memsave') saveRecording(rec, m);
      else playMemberRec(rec, m, `${m.name}の音だけ：${rec.label}`);
    }
  });
  $('#week').addEventListener('change', e => {
    const t = e.target;
    if(t.dataset.aout){
      if(t.checked) U.draft.delete(t.dataset.aout); else U.draft.add(t.dataset.aout);
      haptic('tap'); updateAuditionSelection();
      return;
    }
  });
  $('#week').addEventListener('toggle', e => {
    const card=e.target;if(!card.matches('.senior-list>.senior') || !card.open)return;
    for(const other of card.parentElement.querySelectorAll('.senior[open]'))if(other!==card)other.open=false;
    if(narrow.matches)card.scrollIntoView({block:'start',behavior:!fxCalm()&&U.fxMode==='full'?'smooth':'auto'});
  },true);
  const rs = $('#btnReset');
  rs.addEventListener('click', () => {
    if(!rs.classList.contains('armed')){
      rs.classList.add('armed'); rs.textContent = 'もう一度押すと、最初の年度の4月からやり直します';
      setTimeout(() => { rs.classList.remove('armed'); rs.textContent = '最初からやり直す'; }, 4000);
      return;
    }
    rs.classList.remove('armed'); rs.textContent = '最初からやり直す';
    stopPlay();
    commit(freshState(2026)); U.sel = null; U.piece = null; U.view = 'mel'; U.lineup = false; U.draft = null;
    renderAll(); refreshNow();
  });
  bindConduct();
  bindAnnounce();
  bindTuneGame();
  $('#tabbar').addEventListener('click', e => { const b = e.target.closest('[data-tabgo]'); if(b) setTab(b.dataset.tabgo, true); });
  $('#miniLabel').addEventListener('click', () => setTab('play'));
  $('#miniStop').addEventListener('click', () => stopPlay());
  narrow.addEventListener?.('change', () => setTab(U.tab, true));
  const redraw = () => { if(U.playing) return; drawIdle(); };
  // 大きさの通知中に舞台の高さを変えず、次の描画にまとめる。
  let resizeFrame = 0;
  const resizeRedraw = () => {
    if(resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; redraw(); });
  };
  if('ResizeObserver' in window) new ResizeObserver(resizeRedraw).observe($('.stand'));
  else window.addEventListener('resize', resizeRedraw);
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => { redraw(); renderRoster(); });
  new MutationObserver(() => { redraw(); renderRoster(); }).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
  document.fonts?.ready.then(redraw);
  document.addEventListener('facesready',()=>{
    if(U.playing)return;
    if(!tabHidden('play'))drawStage(-1);
    if(!$('#conduct').hidden)drawStage(-1,$('#cdStage'),CD.who);
  });
}

function start(data){
  if(window.TSUKURIKATA_NATIVE) document.documentElement.classList.add('native');
  S = (data && data.S && data.S.v === 2) ? data.S : (load() || freshState(2026));
  loadUI();
  E.venueId = U.venue; E.posId = U.pos;
  renderAll();
  bind();
  setTab(window.TSUKURIKATA_LAUNCH?.tab || 'week');
  renderSnd();
  loadSamples('snd/', renderSnd).then(renderSnd, renderSnd);
  // 響きの読み込みが再生より後になったら、読み込めた時点で計算した響きに切り替える
  loadVenueIRs('snd/ir/').then(() => { if(E.chain) E.chain.set(E.venueId, E.posId, 0.3, true); });
  U.perfNow = currentPerformance();
  U.diag = analyze(U.perfNow);
  U.shown = U.perfNow; U.shownLabel = nowLabel();
  setNowPlaying(); renderDiag(); drawIdle();
}
window.claude?.hot?.snapshot?.(() => ({S}));
// 画面と共通のスクリプトがそろってから起動する。
const bootGame=()=>window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootGame,{once:true});else bootGame();
