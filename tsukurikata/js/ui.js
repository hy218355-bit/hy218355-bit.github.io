'use strict';
/* 画面：ステージ・譜面台・ホワイトボード・名簿 */

const $ = s => document.querySelector(s);
const E = new Engine();
let S = null;
const U = {
  venue: 'room', pos: 'center', range: 'all', view: 'mel', sel: null, piece: null, solo: 'all',
  shown: null, shownLabel: '', perfNow: null, diag: null, ptr: null, raf: 0, onEnd: null, playing: false, refreshT: 0,
  tab: 'week', tabScroll: {},
  lineup: false, draft: null, pred: null, predKey: '', predT: 0, outKey: '', outPick: new Set(),
};
const UI_KEY = 'suibu-ui-v2';  // 前の名前のころからの保存先（SAVE_KEY と同じ理由でこのまま）

/* ===== 小道具 ===== */
function tok(){
  const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
  return {
    ink: g('--ink'), soft: g('--ink-soft'), rule: g('--rule'), sheet: g('--sheet'), paper: g('--paper'), brass: g('--brass'),
    floor: g('--floor'), floorLine: g('--floor-line'), good: g('--good'), warn: g('--warn'), bad: g('--bad'),
    lcdInk: g('--lcd-ink'), lcdDim: g('--lcd-dim'), fBody: g('--f-body'), fLcd: g('--f-lcd'), fHand: g('--f-hand'),
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
const skillColor = (C, v) => v < 50 ? mix(C.bad, C.warn, clamp01(v / 50)) : mix(C.warn, C.good, clamp01((v - 50) / 40));
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
const nowLabel = () => `いまの音（${S.phase === 'choose' || S.phase === 'chooseSet' ? '選曲前' : wkLabel(S.week)}・${VENUE[U.venue].name}）`;
const busy = () => !!(S.pending && !S.pending.revealed);
// 画面の設定は会場だけ残す（聴く位置は客席の中央、音はいつも楽器の録音で鳴らす）
function saveUI(){ try{ localStorage.setItem(UI_KEY, JSON.stringify({venue: U.venue})); }catch(e){} }
function loadUI(){ try{ const x = JSON.parse(localStorage.getItem(UI_KEY) || 'null'); if(x && VENUE[x.venue]) U.venue = x.venue; }catch(e){} }
// 録音音源の読み込み状況
function renderSnd(){
  const st = $('#sndStatus');
  if(SAMPLES.error) st.textContent = '楽器の録音を読み込めなかったので、合成音で鳴らします';
  else if(!SAMPLES.ready) st.textContent = `楽器の音を読み込み中 ${Math.round(SAMPLES.progress * 100)}%`;
  else st.textContent = '';
}
function commit(next){ S = next; save(S); }

/* ===== いまの演奏を作り直す ===== */
function currentCtx(){
  const pid = playPiece(), span = rangeSpan(pid);
  return perfCtx(S, {pieceId: pid, venue: U.venue, from: span.from, to: span.to, fam: S.fam[pid] ?? 0});
}
function refreshNow(){
  clearTimeout(U.refreshT);
  U.refreshT = setTimeout(() => {
    U.perfNow = perform(currentCtx());
    U.diag = analyze(U.perfNow);
    if(!U.playing){ U.shown = U.perfNow; U.shownLabel = nowLabel(); setNowPlaying(); }
    renderDiag();
    drawIdle();
  }, 20);
}
function setNowPlaying(){
  $('#nowPlaying').innerHTML = U.playing ? `<b>再生中</b>：${esc(U.shownLabel)}` : `表示中：${esc(U.shownLabel)}`;
  updateMini();
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
  // 隠れていたあいだは描けないので、見えたところで描き直す
  if(t === 'play' && !U.playing) requestAnimationFrame(drawIdle);
}
// 合奏の画面以外で鳴っているときは、下に小さく「再生中」と止めるボタンを出す
function updateMini(){
  const mini = $('#mini'); if(!mini) return;
  mini.hidden = !(U.playing && tabHidden('play'));
  if(!mini.hidden) $('#miniLabel').textContent = `♪ ${U.shownLabel}`;
}

/* ===== 再生 ===== */
function playPerf(perf, label, onEnd, opts = {}){
  if(SAMPLES.use && !SAMPLES.ready && SAMPLES.loading && !SAMPLES.error){
    const token = U.waitPlay = {};
    $('#nowPlaying').textContent = '録音を読み込んでいます…（読み込めたら鳴ります）';
    const go = () => { if(U.waitPlay === token){ U.waitPlay = null; playPerf(perf, label, onEnd, opts); } };
    SAMPLES.loading.then(go, go);
    return;
  }
  U.waitPlay = null;
  const pb = E.play(perf, null, opts);
  if(!pb){ $('#nowPlaying').textContent = 'このブラウザでは音を鳴らせません。'; return; }
  U.shown = perf; U.shownLabel = label; U.playing = true; U.onEnd = onEnd || null;
  nativePost({type: 'playing', on: true});
  U.ptr = buildPtr(perf);
  $('#btnStop').hidden = false; $('#btnNow').hidden = true;
  setNowPlaying();
  cancelAnimationFrame(U.raf);
  const tick = () => {
    if(!E.pb) return;
    const t = E.now();
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
  U.playing = false;
  nativePost({type: 'playing', on: false});
  cancelAnimationFrame(U.raf);
  $('#btnStop').hidden = true; $('#btnNow').hidden = false;
  setNowPlaying();
  drawIdle();
  const cb = U.onEnd; U.onEnd = null;
  if(cb) cb(natural);
}
function stopPlay(){
  U.waitPlay = null;
  if(!U.playing) return;
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
function stageGeom(W){
  const H = Math.round(clamp(W * 0.5, 210, 360));
  const R = Math.min((W / 2 - 18) / 0.78, (H - 46) / 0.92);
  return {W, H, cx: W / 2, baseY: H - 28, R, r: clamp(R * 0.038, 6, 13)};
}
const seatXY = (s, G) => [G.cx + s.x * G.R, G.baseY - s.y * G.R * 0.95];
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
  // 床とひな壇
  g.fillStyle = C.floor;
  g.beginPath(); g.moveTo(G.cx - G.R * 0.95, G.baseY + 18); g.lineTo(G.cx - G.R * 1.0, G.baseY - G.R * 0.62);
  g.quadraticCurveTo(G.cx, G.baseY - G.R * 1.18, G.cx + G.R * 1.0, G.baseY - G.R * 0.62); g.lineTo(G.cx + G.R * 0.95, G.baseY + 18); g.closePath(); g.fill();
  g.strokeStyle = C.floorLine; g.lineWidth = 1;
  for(const rr of [0.45, 0.67, 0.88]){
    g.beginPath(); g.arc(G.cx, G.baseY, G.R * rr, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
  }
  // 指揮台
  g.fillStyle = C.ink; g.globalAlpha = .8;
  g.fillRect(G.cx - 18, G.baseY + 2, 36, 12);
  g.globalAlpha = 1; g.fillStyle = C.sheet; g.font = `700 9px ${C.fBody}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('指揮', G.cx, G.baseY + 8.5);
}
function drawStage(t = -1, cv = $('#stage'), who = null){
  const main = cv.id === 'stage';
  const G = stageGeom(Math.max(240, cv.parentElement.clientWidth));
  const {g, W, H} = fitCanvas(cv, G.H);
  const C = tok();
  stageFloor(g, G, C);

  const viewSec = main && U.view !== 'mel' ? U.view : null;
  const sel = main ? U.sel && memberById(U.sel) : CD.sel && memberById(CD.sel);
  for(const s of SEATS){
    const [x, y] = seatXY(s, G);
    const m = S.members.find(mm => mm.seat === s.id && (!who || who.has(mm.id)));
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
      if(m.grade === 1){ g.strokeStyle = C.sheet; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, G.r - 2.5, 0, Math.PI * 2); g.stroke(); }
    } else {
      g.setLineDash([3, 3]); g.strokeStyle = C.soft; g.lineWidth = 1.2;
      g.beginPath(); g.arc(x, y, G.r - 1, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    }
    if(sel && sel.seat === s.id){
      g.strokeStyle = C.ink; g.lineWidth = 3; g.globalAlpha = 1;
      g.beginPath(); g.arc(x, y, G.r + 3.5, 0, Math.PI * 2); g.stroke();
    }
    if(G.r >= 10){
      g.fillStyle = m ? '#fff' : C.soft;
      g.font = `700 ${G.r >= 13 ? 9 : 8}px ${C.fBody}`;
      g.fillText(s.sec === 'perc' ? 'Perc' : INST[s.inst].short.replace('Sax', 'S'), x, y + 0.5);
    }
    g.globalAlpha = 1;
  }
}
function seatAt(ev, cv = $('#stage')){
  const rect = cv.getBoundingClientRect();
  const G = stageGeom(Math.max(240, rect.width));
  const px = ev.clientX - rect.left, py = ev.clientY - rect.top;
  let best = null, bd = Infinity;
  for(const s of SEATS){
    const [x, y] = seatXY(s, G);
    const d = Math.hypot(x - px, y - py);
    if(d < bd){ bd = d; best = s; }
  }
  return bd < G.r * 1.6 ? best : null;
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
      if(x1 - x0 > 40) g.fillText(x1 - x0 > 110 ? `${spanShort(sp)} 譜読み${Math.round(v)}` : `譜読み${Math.round(v)}`, x0 + 4, MA.y + 8);
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
    else if(ev?.kind === 'concert') li.classList.add('show');
    else if(ev) li.classList.add('ev');
    if(S.phase !== 'choose' && w < S.week) li.classList.add('done');
    if(S.phase === 'week' && w === S.week) li.classList.add('now');
    if(S.phase === 'end' && w > S.week) li.classList.add('later');
    li.title = wkLabel(w) + (ev ? `：${ev.title}` : '');
    if(w % 4 === 0){ const mo = document.createElement('span'); mo.className = 'mo'; mo.textContent = `${wkMonth(w)}月`; li.appendChild(mo); }
    ol.appendChild(li);
  }
  if(S.phase === 'choose' || S.phase === 'chooseSet'){ $('#weekNow').textContent = `${S.year}年 4月・選曲会議`; $('#weeksLeft').textContent = '県大会まで16週'; return; }
  if(S.phase === 'end'){ $('#weekNow').textContent = `${S.year}年度の本番がすべて終わった`; $('#weeksLeft').textContent = ''; return; }
  if(S.phase === 'winter'){ const st = winterStep(S); $('#weekNow').textContent = `${S.year}年度 ${st.m}月`; $('#weeksLeft').textContent = `冬のあいだ（${S.winter.step + 1}／${WINTER_STEPS.length}）`; return; }
  $('#weekNow').textContent = wkLabel(S.week);
  let nx = null;
  for(let w = S.week; w <= last; w++){ const ev = eventAt(S, w); if(ev && (ev.kind === 'concert' || ev.kind === 'contest')){ nx = [w, ev]; break; } }
  $('#weeksLeft').textContent = nx ? (nx[0] === S.week ? `今週は本番：${nx[1].title}` : `次の本番「${nx[1].title}」まで${nx[0] - S.week}週`) : '';
}
function renderPiece(){
  const pid = playPiece(), pc = PIECES[pid];
  $('#pieceEyebrow').textContent = S.phase === 'choose' || S.phase === 'chooseSet' || pid !== S.pieceId ? '試しに聴く曲' : S.finalWeek ? '定期演奏会の曲' : '自由曲';
  $('#piece').textContent = pc.full;
  $('#pieceMeta').textContent = `${pc.composer}｜問われる力：${pc.asks}`;
  const rd = pid === S.pieceId && S.phase !== 'choose' ? spanReadAvg(S, pid) : null;
  $('#rangeSel').innerHTML = `<option value="all">全部</option>` + pc.spans.map((sp, i) => `<option value="${i}">${sp.name}${rd ? `（譜読み${Math.round(rd[i])}）` : ''}</option>`).join('');
  $('#rangeSel').value = U.range;
}
function renderVenues(){
  $('#venueSel').innerHTML = VENUES.map(v => `<option value="${v.id}">${v.name}</option>`).join('');
  $('#venueSel').value = U.venue;
}
function renderSelectors(){
  const recs = S.recs.slice().reverse();
  $('#recSel').innerHTML = recs.length ? recs.map(r => `<option value="${r.id}">${esc(r.label)}</option>`).join('') : '<option value="">録音はまだない</option>';
  $('#btnRec').disabled = !recs.length;
  $('#btnSave').disabled = !recs.length;
  const sel = U.sel && memberById(U.sel);
  $('#soloSel').innerHTML = `<option value="all">全員</option>` + SECTIONS.map(s => `<option value="sec:${s.id}">${s.name}だけ</option>`).join('')
    + (sel ? `<option value="member:${sel.id}">${esc(sel.name)}だけ</option>` : '');
  if(![...$('#soloSel').options].some(o => o.value === U.solo)){ U.solo = 'all'; applySolo(); }
  $('#soloSel').value = U.solo;
  $('#viewSel').innerHTML = `<option value="mel">旋律を吹いている部員</option>` + SECTIONS.map(s => `<option value="${s.id}">${s.name}パート</option>`).join('');
  $('#viewSel').value = U.view;
}
function applySolo(){
  const [type, id] = U.solo.split(':');
  E.setSolo(type === 'all' ? {type: 'all'} : {type: type === 'sec' ? 'sec' : 'member', id});
}

/* ===== ホワイトボード ===== */
function statRow(name, v, desc, delta, cls){
  const up = delta ? `<span class="delta">+${delta}</span>` : '';
  return `<div class="stat"><span class="nm">${name}${desc ? '' : up}</span><span class="track"><span class="fill${cls ? ' ' + cls : ''}" style="width:${clamp(v, 0, 100)}%"></span></span><span class="val">${Math.round(v)}</span>${desc ? `<span class="ds">${desc}${up}</span>` : ''}</div>`;
}
// 顧問の指導力：レベル・呼び名・練習の効果と、次のレベルまでの経験
function coachHtml(){
  const lv = coachLevel(S), xp = S.coach?.xp || 0, a = coachNeed(lv), b = coachNeed(lv + 1);
  const pct = lv >= 12 ? 100 : clamp((xp - a) / (b - a) * 100, 0, 100);
  return `<div class="vital coach"><span class="row"><span>顧問の指導力</span><b>Lv${lv}</b></span><span class="track"><span class="fill" style="width:${pct}%"></span></span>
    <small>${coachTitle(lv)}・練習の効果 +${Math.round((coachMult(S) - 1) * 100)}%${lv < 12 ? `・次のレベルまで ${Math.ceil(b - xp)}` : ''}</small></div>`;
}
// この1年の部の実力の伸び（週ごと）。去年の同じ週の線をうすく重ねる
function trendSvg(){
  const tr = S.trend || [], now = tr.filter(x => x.y === S.year), prev = tr.filter(x => x.y === S.year - 1);
  if(now.length < 2 && prev.length < 2) return '';
  const last = Math.max(PREF_WEEK + 2, ...tr.filter(x => x.y >= S.year - 1).map(x => x.w));
  const W = 300, H = 90, X = w => 6 + (W - 12) * w / last, Y = v => H - 14 - (H - 24) * clamp(v, 0, 100) / 100;
  const line = (pts, k) => pts.map((x, i) => `${i ? 'L' : 'M'}${X(x.w).toFixed(1)},${Y(x[k]).toFixed(1)}`).join('');
  const marks = [];
  for(let w = 0; w <= last; w++){ const ev = eventAt(S, w); if(ev?.kind === 'contest' || ev?.kind === 'concert') marks.push(`<line x1="${X(w).toFixed(1)}" x2="${X(w).toFixed(1)}" y1="${H - (ev.kind === 'contest' ? 11 : 8)}" y2="${H - 3}" class="mk ${ev.kind}"/>`); }
  return `<figure class="trend"><figcaption>この1年の伸び <span class="k-avg">部の平均</span> <span class="k-fam">仕上がり</span>${prev.length > 1 ? ' <span class="k-prev">去年の部の平均</span>' : ''}</figcaption>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="この1年の、部の平均と自由曲の仕上がりの伸び">
      ${[25, 50, 75].map(v => `<line x1="6" x2="${W - 6}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/>`).join('')}
      ${prev.length > 1 ? `<path d="${line(prev, 'a')}" class="prev"/>` : ''}
      ${now.length > 1 ? `<path d="${line(now, 'f')}" class="fam"/><path d="${line(now, 'a')}" class="avg"/>` : ''}
      ${marks.join('')}
    </svg></figure>`;
}
const helpBox = (rows, open) => `<details class="help"${open ? ' open' : ''}><summary>数字の見かた</summary><dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></details>`;
function renderStats(){
  const ms = seated(S);
  $('#memberCount').textContent = `${S.members.length}人${S.members.length > ms.length ? `（控え${S.members.length - ms.length}人）` : ''}／${SEATS.length}席`;
  const d = S.lastDelta || {};
  const pid = S.pieceId || playPiece();
  const up = v => v > 0 ? v.toFixed(1) : '';
  $('#stats').innerHTML = STAT_KEYS.map(k => statRow(STAT_LABEL[k], bandAvg(S, k), '', up(d[k]))).join('')
    + statRow('まとまり', S.cohesion, '', up(d.coh))
    + (S.pieceId ? statRow(setActive(S) ? '自由曲の仕上がり' : '仕上がり', S.fam[pid] ?? 0, '', up(d.fam)) + statRow('譜読み', readAvg(S, pid), '', up(d.read)) : '')
    + (setActive(S) ? statRow('課題曲の仕上がり', S.fam[S.setPiece] ?? 0, '', up(d.setFam)) + statRow('課題曲の譜読み', readAvg(S, S.setPiece), '') : '');
  const vital = (nm, v) => {
    const c = v >= 60 ? 'good' : v >= 30 ? 'warn' : 'bad';
    return `<div class="vital"><span class="row"><span>${nm}</span><b>${Math.round(v)}</b></span><span class="track"><span class="fill ${c}" style="width:${clamp(v, 0, 100)}%"></span></span></div>`;
  };
  const nx = nextRepStep(S), helpOpen = $('#vitals .help')?.open;
  $('#vitals').innerHTML = vital('体力', S.stamina) + vital('やる気', S.morale) + vital('会場慣れ', S.hallExp)
    + `<div class="vital rep"><span class="row"><span>評判</span><b>${Math.round(S.rep ?? 0)}</b></span><span class="track"><span class="fill" style="width:${clamp(S.rep ?? 0, 0, 100)}%"></span></span><small>${nx ? `${nx}をこえると、入部したい生徒が来る` : '県内に知られた部'}</small></div>`
    + coachHtml()
    + trendSvg()
    + helpBox([...STAT_KEYS.map(k => [STAT_LABEL[k], STAT_DESC[k]]), ['まとまり', '互いを聴き合う力。合奏に出る人が多いほど育つ'],
      ['仕上がり', '自由曲の合奏での曲づくり。低いとテンポの揺れがそろわない'], ['譜読み', '一人ひとりが自分の楽譜をどれだけ吹けるか（平均）。低いと音を間違え、出だしが揺れる'],
      ['会場慣れ', 'ホールで吹いた経験。高いほど、大きな会場で緊張しにくい'], ['評判', '演奏会やコンクールで上がる。上がるほど入部したい生徒が来る'],
      ['顧問の指導力', 'あなたの指導の経験。毎週の練習・本番・コンクール・部員のできごとでたまり、レベルが上がると部員の練習の効果が上がり、本番の緊張も少しやわらぐ']], helpOpen);
}
function renderDiag(){
  const a = U.diag;
  $('#diagVenue').textContent = `${VENUE[U.venue].name}・${PIECES[playPiece()].title}`;
  if(!a){ $('#diag').innerHTML = ''; return; }
  $('#diag').innerHTML = Object.keys(DIM_LABEL).map(k => {
    const v = a.score[k], c = v >= 70 ? 'good' : v >= 45 ? 'warn' : 'bad';
    return statRow(DIM_LABEL[k], v, k === 'tone' && a.cracks ? `音の裏返り ${a.cracks}回` : '', '', c);
  }).join('');
  const dims = Object.keys(DIM_LABEL);
  const weak = dims.reduce((x, y) => a.score[x] <= a.score[y] ? x : y);
  const strong = dims.reduce((x, y) => a.score[x] >= a.score[y] ? x : y);
  const notes = [];
  if(a.score[weak] < 72) notes.push(commentFor(weak, a, false));
  if(a.score[strong] >= 70) notes.push(commentFor(strong, a, true));
  if(a.wrong) notes.push(`まだ譜読みが終わっておらず、${a.wrong}か所で音を間違えている。`);
  $('#diagNote').textContent = notes.join(' ') || '大きな問題はない。ここからは細部の磨き込み。';
}
// 舞台袖：部全体の空気と、緊張している部員。声をかける・全員で深呼吸する（あわせて2回まで）
function wingsHtml(){
  if(!S.stageDay) return '';
  const tense = tenseMembers(S), calm = S.stageDay.calm, left = 2 - wingActions(S), zb = bandForm(S);
  const mood = S.stageDay.huddle ? '全員で深呼吸をして、空気が少しやわらいだ。' : zb > 0.8 ? '部全体が硬くなっている。話し声もほとんどない。' : zb < -0.8 ? 'みんないい顔をしている。小声で冗談を言い合う余裕もある。' : 'みんな静かに出番を待っている。';
  const rows = tense.map(m => `<li><span>${calm.includes(m.id) ? `${esc(m.name)}（${esc(instOf(m))}）は、深呼吸して少し落ち着いた。` : `${esc(m.name)}（${esc(instOf(m))}）の手が震えている。`}</span>${calm.includes(m.id) ? '' : `<button class="btn small" type="button" data-act="calm" data-mid="${m.id}"${left ? '' : ' disabled'}>声をかける</button>`}</li>`).join('');
  return `<div class="wings"><span class="tag">舞台袖</span><ul><li><span>${mood}</span>${S.stageDay.huddle ? '' : `<button class="btn small" type="button" data-act="huddle"${left ? '' : ' disabled'}>全員で深呼吸する</button>`}</li>${rows}</ul>
    <p class="small">できるのはあわせて2回まで。本番の強さ（メンタル）は、場数を踏むほど上がる。</p></div>`;
}
// 本番のあと：緊張に飲まれた部員と、いつも以上の音を出した部員
function mentalNote(p){
  const nm = kind => (p.mental || []).filter(x => x.kind === kind).map(x => memberById(x.mid)?.name).filter(Boolean).map(esc);
  const fr = nm('freeze'), zn = nm('zone');
  if(!fr.length && !zn.length) return '';
  return `<p class="small mental-note">${fr.length ? `緊張で頭が真っ白に：${fr.join('、')}` : ''}${fr.length && zn.length ? '　' : ''}${zn.length ? `いつも以上の音：${zn.join('、')}` : ''}</p>`;
}
function moodText(n){
  return n <= 3 ? 'みんな落ち着いている。いつもどおり吹けそうだ。' : n <= 6 ? '少し緊張している。本番では実力より少し下がりそうだ。' : '緊張と不安で、本番は実力を出しきれないかもしれない。';
}
function renderWeek(){
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
    head.textContent = `${S.year}年度のおわり`;
    const nm = {gold: '金賞', silver: '銀賞', bronze: '銅賞'};
    const res = S.season.map(r => `<li>${LEVELS[r.level].name}${r.div ? `（${r.div}部門）` : ''}　${nm[r.award]}${r.rep ? '・代表' : ''}（平均${r.avg}点${r.parts ? `：課題曲 ${r.parts.set}・自由曲 ${r.parts.free}` : ''}）</li>`).join('');
    const seniors = S.members.filter(m => m.grade === 3);
    const april = S.recs.find(r => r.year === S.year && r.keep && r.week === 0);
    const lastStage = S.recs.slice().reverse().find(r => r.year === S.year && r.final) || S.recs.slice().reverse().find(r => r.year === S.year && r.result);
    // この1年の伸び（部の実力のグラフと同じ記録から）
    const yr = (S.trend || []).filter(x => x.y === S.year), grow = yr.length > 1 ? Math.round(yr[yr.length - 1].a - yr[0].a) : null;
    const yearLine = `<p class="small year-sum">${grow != null ? `部の平均 ${Math.round(yr[0].a)} → ${Math.round(yr[yr.length - 1].a)}（${grow >= 0 ? '+' : ''}${grow}）・` : ''}部員 ${S.members.length}人・顧問の指導力 Lv${coachLevel(S)}（${coachTitle(coachLevel(S))}）</p>`;
    w.innerHTML = `<div class="stagecard"><h3>${seniors.length ? '3年生が引退します' : 'この1年をふり返る'}</h3><ol class="small" style="padding-left:1.2em">${res}</ol>${yearLine}${yearMembersHtml()}
      <p class="txt">${seniors.length ? `${seniors.map(m => esc(m.name)).join('、')}（${seniors.length}人）が引退する。` : `部員は${S.members.length}人になった。引退する3年生はまだいない。`}4月の録音と最後の本番を聴き比べてみよう。</p>
      <div class="transport">${april ? `<button class="btn small" type="button" data-act="playrec" data-id="${april.id}">▶ 4月の録音</button>` : ''}${lastStage ? `<button class="btn small" type="button" data-act="playrec" data-id="${lastStage.id}">▶ 最後の本番</button><button class="btn small" type="button" data-act="saverec" data-id="${lastStage.id}">⤓ 最後の本番を保存</button>` : ''}</div></div>
      ${firstClassEpilogue(seniors)}
      ${seniors.length ? `<div class="seniors"><h3>引退する3年生</h3><p class="small">名前をタップすると、入部したころと最後の本番を、その人の音だけで聴き比べられる。</p>${seniors.map(m => seniorCard(m, lastStage)).join('')}</div>` : ''}
      <div class="transport"><button class="btn primary" type="button" data-act="winter">${seniors.length ? '冬へ（3年生が引退する）' : '冬へ'}</button></div>`;
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
    w.innerHTML = `<div class="stagecard"><span class="tag">${ev.kind === 'contest' ? 'コンクール' : '本番'}</span><h3>${ev.title}${ev.kind === 'contest' && S.division ? `（${S.division}部門）` : ''}</h3>
      ${ev.kind === 'contest' ? `<p class="small">${two ? `課題曲 ${esc(PIECES[S.setPiece].title)} → 自由曲 ${esc(PIECES[S.pieceId].title)}（続けて吹く）` : `自由曲 ${esc(PIECES[S.pieceId].title)}`}${isB(S) ? '。B部門は県大会まで' : ''}</p>` : ''}
      <p class="small">会場：${v.name}（${v.rt < 0.2 ? '響きはほとんどない' : `残響 約${v.rt.toFixed(1)}秒`}）。${v.desc}</p>
      ${ev.text ? `<p class="txt">${ev.text}</p>` : ''}
      <p class="txt">${moodText(n)}（緊張 −${n}）${v.play.hall ? `会場慣れ ${Math.round(S.hallExp)}。` : ''}</p>
      ${wingsHtml()}
      <div class="transport"><button class="btn primary" type="button" data-act="stage">本番の演奏をはじめる</button><button class="btn brass" type="button" data-act="stageconduct">自分で指揮する</button></div>
      <p class="small">自分で指揮すると、その指揮で演奏した結果が審査される。テンポが大きく揺れると、リズムの苦手な部員ほどついてこられない。</p>
      ${ev.kind === 'contest' ? lineupLine() : ''}</div>`;
    return;
  }
  if(ev?.kind === 'forced'){
    w.innerHTML = `<div class="event"><span class="tag">${ev.title}</span><span>${ev.text}</span></div><div class="menu"><button class="mbtn wide" type="button" data-act="test"><b>テスト勉強に集中する</b><span>1週すすむ・体力が回復</span></button></div>`;
    return;
  }
  if(S.chooseFinal){
    const fam = id => Math.round(S.fam[id] || 0);
    w.innerHTML = `<div class="event"><span class="tag">定期演奏会の曲</span><span>3年生の最後の本番、${wkLabel(S.finalWeek)}の定期演奏会で演奏する曲を決めよう。コンクールの曲をもう一度でも、新しい曲に挑戦してもいい（仕上がりも、部員の譜読みも低いところから）。</span></div>`
      + PIECE_IDS.map(id => pieceCard(id, {tag: id === S.contestPiece ? 'コンクールで演奏した曲' : '', note: `仕上がり ${fam(id)}・譜読み ${Math.round(readAvg(S, id))}`, act: 'choosefinal', label: '決める'})).join('');
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
  if(cv) parts.push(`<div class="episode consult"><div class="head"><span class="tag">相談</span><span class="who">${cv.m.grade}年・${esc(instOf(cv.m))}・${esc(cv.m.name)}${skillChips(cv.m)}</span></div><p class="txt">${esc(cv.text)}</p>
    <div class="choices">${cv.choices.map(c => `<button class="mbtn" type="button" data-cs="${c.k}"><b>${esc(c.label)}</b></button>`).join('')}</div>
    <p class="small">答え方で、${esc(kun(cv.m))}の育ち方が変わる。答えずに練習を進めると、この相談は流れる。</p></div>`);
  if(S.lastConsult) parts.push(`<p class="epres"><b>${esc(S.lastConsult.choice)}</b>${esc(S.lastConsult.result)}${effHtml(S.lastConsult)}</p>`);
  // 行事の誘い：連れて行く部員を選ぶ（★は、行くと特に伸びる子）
  const ov = outingView(S);
  if(ov){
    const key = `${S.year}:${S.week}:${S.outing.id}`;
    if(U.outKey !== key){ U.outKey = key; U.outPick = new Set(); U.outMore = false; }
    // ★の子はパートごとに並べて見せ、ほかの部員はたたんでおく（部員が多いと長くなるので）
    const chip = m => `<button class="chip" type="button" data-op="${m.id}" aria-pressed="${U.outPick.has(m.id)}">${ov.fit.has(m.id) ? '<span class="fitmark">★</span>' : ''}${esc(m.name)}<small>${m.grade}年</small></button>`;
    const bySec = ms => SECTIONS.map(sc => [sc, ms.filter(m => secOf(m) === sc.id)]).filter(([, l]) => l.length)
      .map(([sc, l]) => `<div class="chips opsec"><span class="oplab">${sc.name}</span>${l.map(chip).join('')}</div>`).join('');
    const fitMs = seated(S).filter(m => ov.fit.has(m.id)), rest = seated(S).filter(m => !ov.fit.has(m.id));
    const k = U.outPick.size;
    parts.push(`<div class="episode outing"><div class="head"><span class="tag">行事</span><span class="who">${esc(ov.o.title)}</span></div><p class="txt">${esc(ov.o.text)}</p>
      <p class="small"><span class="fitmark">★</span>${esc(ov.o.fitText)}</p>
      ${bySec(fitMs)}${rest.length ? `<details class="opmore" data-outmore${U.outMore || !fitMs.length ? ' open' : ''}><summary>${fitMs.length ? 'ほかの部員から選ぶ' : '部員から選ぶ'}（${rest.length}人）</summary>${bySec(rest)}</details>` : ''}
      <button class="mbtn" type="button" data-act="outing"${k ? '' : ' disabled'}><b>${k ? `この${k}人で行く` : `連れて行く部員を${ov.n}人まで選ぶ`}</b></button>
      <p class="small">選ばずに練習を進めると、この話は流れる。</p></div>`);
  }
  if(S.lastOuting) parts.push(`<p class="epres"><b>${esc(S.lastOuting.title)}（${esc(S.lastOuting.who)}）</b>${esc(S.lastOuting.result)}${effHtml(S.lastOuting)}</p>`);
  parts.push(planHtml(ev));
  if(!tuneDone(S)) parts.push(`<div class="tgrow"><button class="btn small" type="button" data-act="tunegame">♪ 耳でチューニング</button><span class="small">週に1回。チューナーの音と部員の音を重ねて、うなりが消えるところまで高さを合わせる。合わせた部員の音程が上がる</span></div>`);
  w.innerHTML = parts.join('');
  w.querySelector('[data-outmore]')?.addEventListener('toggle', e => { U.outMore = e.target.open; });
  w.querySelectorAll('details.psecd').forEach(d => d.addEventListener('toggle', () => { (U.openSecs ||= new Set())[d.open ? 'add' : 'delete'](d.dataset.sec); }));
  weekResAnimate(w);
}
// 曲の中での受け持ち：パートごとに、旋律・ソロ・対旋律・低音・和音をどれだけ吹くか（曲の長さに対する割合）
const NEED_CACHE = {};
function pieceNeeds(pid){
  if(NEED_CACHE[pid]) return NEED_CACHE[pid];
  const pc = PIECES[pid], L = pc.spans[pc.spans.length - 1].to;
  const cover = segs => { let sum = 0, end = -1e9; for(const x of segs.slice().sort((a, b) => a.f - b.f)){ if(x.t <= end) continue; sum += x.t - Math.max(x.f, end); end = x.t; } return sum / L; };
  const KINDS = {mel: ['mel'], cm: ['cm', 'mel3'], bass: ['bass'], pad: ['pad']};
  const part = {}, segsBySec = {}, sec = {};
  for(const [p, segs] of Object.entries(pc.roles)){
    const sc = INST[PART_INST[p]]?.sec;
    if(!sc) continue;
    part[p] = {solo: segs.some(x => x.solo), ...Object.fromEntries(Object.entries(KINDS).map(([k, rs]) => [k, cover(segs.filter(x => rs.includes(x.r)))]))};
    (segsBySec[sc] ||= []).push(...segs);
    if(part[p].solo) (sec[sc] ||= {}).soloPart = p;
  }
  for(const [sc, segs] of Object.entries(segsBySec)) sec[sc] = {...sec[sc], solo: !!sec[sc]?.soloPart, ...Object.fromEntries(Object.entries(KINDS).map(([k, rs]) => [k, cover(segs.filter(x => rs.includes(x.r)))]))};
  if(pc.perc && Object.keys(pc.perc).length) sec.perc = {...(sec.perc || {}), perc: true};
  return NEED_CACHE[pid] = {part, sec};
}
// 受け持ちの印（和音は、ほかの受け持ちがないときだけ）
const needTags = r => {
  if(!r) return [];
  const t = [r.solo && 'ソロ', r.mel >= 0.3 && '旋律', r.cm >= 0.3 && '対旋律', r.bass >= 0.4 && 'ベース', r.perc && '打楽器'].filter(Boolean);
  return t.length ? t : r.pad >= 0.3 ? ['和音'] : [];
};
// この1年の部員：いちばん伸びた子・身につけたスキル・行事に行った子
function yearMembersHtml(){
  const y = S.year;
  const base = m => m.y0?.y === y ? m.y0.a : m.first?.y === y ? STAT_KEYS.reduce((a, k) => a + m.first.stats[k], 0) / 4 : null;
  const grow = S.members.map(m => ({m, d: base(m) == null ? 0 : avgStat(m) - base(m)})).filter(x => x.d >= 1).sort((a, b) => b.d - a.d).slice(0, 3);
  // 同じスキルは、まとめて「度胸○：A・B ほか2人」
  const sk = new Map();
  for(const m of S.members) for(const x of m.story || []){ const t = x.y === y && x.t.match(/スキル「(.+?)」を身につけた/)?.[1]; if(t) sk.set(t, [...(sk.get(t) || []), m.name]); }
  const skills = [...sk].map(([t, ns]) => `${t}：${ns.slice(0, 3).join('・')}${ns.length > 3 ? ` ほか${ns.length - 3}人` : ''}`);
  const outs = (S.outLog || []).filter(x => x.y === y).map(x => `${x.title}（${x.who}）`);
  const more = (l, n) => l.slice(0, n).join('・') + (l.length > n ? ` ほか${l.length - n}件` : '');
  const rows = [grow.length && ['いちばん伸びた', grow.map(x => `${x.m.name} +${Math.round(x.d)}`).join('・')],
    skills.length && ['身につけたスキル', skills.join('／')], outs.length && ['行事', more(outs, 4)]].filter(Boolean);
  return rows.length ? `<dl class="yr-mem">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : '';
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
    if(S.phase === 'end' && U.fxEnd !== S.year) fxYearEnd(S);
    if(wk && U.fxWinter !== wk) fxWinter(S);
  }
  // 新しくゲームを始めたときは、最初に一度だけ年度のはじまりを見せる
  else if(S.founding && S.year === S.startYear && S.week === 0 && !S.members.length && !S.flags.fxIntro){ S.flags.fxIntro = true; save(S); fxYearStart(S); }
  U.fxWinter = wk;
  if(S.phase === 'end') U.fxEnd = S.year;
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
  if(S.mileUp?.length){
    const ms = S.mileUp; delete S.mileUp; save(S);
    for(const x of ms) fxShow({kind: 'cut', sound: 'mile', html: fxCutHtml('部の節目', `部の${STAT_LABEL[x.k]}が${x.at}に`, '', x.text)});
  }
}
// 練習の結果：すすめる前の部の様子を写しておき、週のはじめに「先週の練習の成果」として、伸びたぶんを数え上げて見せる
function weekSnap(s){
  return {pitch: bandAvg(s, 'pitch'), rhythm: bandAvg(s, 'rhythm'), tone: bandAvg(s, 'tone'), expr: bandAvg(s, 'expr'), coh: s.cohesion,
    fam: s.pieceId ? s.fam[s.pieceId] || 0 : null, pid: s.pieceId, ms: Object.fromEntries(s.members.map(m => [m.id, avgStat(m)]))};
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
    ...(b.fam != null && b.pid === S.pieceId ? [['仕上がり', b.fam, S.fam[S.pieceId] || 0]] : [])];
  const top = S.members.filter(m => b.ms[m.id] != null).map(m => ({m, d: avgStat(m) - b.ms[m.id]})).filter(x => x.d >= 0.5).sort((x, y) => y.d - x.d).slice(0, 3);
  return `<div class="weekres"><b>${r.n > 1 ? `この${r.n}週の練習の成果` : '先週の練習の成果'}</b>
    ${rows.map(([nm, a, v]) => { const d = v - a;
      return `<div class="wr"><span class="nm">${nm}</span><span class="track"><span class="fill" style="width:${clamp(start ? a : v, 0, 100)}%" data-to="${clamp(v, 0, 100)}"></span></span><b class="countup" data-key="wr:${r.key}:${nm}" data-from="${a.toFixed(1)}" data-to="${v.toFixed(1)}">${Math.round(start ? a : v)}</b><span class="d${d < 0 ? ' minus' : ''}">${Math.abs(d) >= 0.05 ? `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}` : ''}</span></div>`; }).join('')}
    ${top.length ? `<p class="small">よく伸びた：${top.map(x => `${esc(x.m.name)} +${x.d.toFixed(1)}`).join('・')}</p>` : ''}</div>`;
}
// 同じ受け持ちに席がいくつかあるときは、2つ目からの席に「2人目」「3人目」をつける（トランペット 1st は2人、クラリネット 1st は3人で吹く）
const seatNth = id => { const p = SEAT[id].part, k = SEATS.filter(x => x.part === p).findIndex(x => x.id === id); return k > 0 ? `（${k + 1}人目）` : ''; };
const seatLabel = id => PART_LABEL[SEAT[id].part] + seatNth(id);
/* ===== 冬（11月 新体制 → 1月 アンサンブルコンテスト → 3月 卒業式） ===== */
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
      const key = `${S.year}:ens`;
      if(U.ensKey !== key){ U.ensKey = key; U.ensPick = new Set(autoEnsemble(S)); }
      const k = U.ensPick.size, ok = k >= ENS_MIN && k <= ENS_MAX;
      const chip = m => `<button class="chip" type="button" data-ens="${m.id}" aria-pressed="${U.ensPick.has(m.id)}">${esc(m.name)}<small>${m.grade}年・${Math.round(avgStat(m))}</small></button>`;
      const secs = SECTIONS.map(sc => [sc, seated(S).filter(m => secOf(m) === sc.id)]).filter(([, l]) => l.length)
        .map(([sc, l]) => `<div class="chips opsec"><span class="oplab">${sc.name}</span>${l.map(chip).join('')}</div>`).join('');
      w.innerHTML = `${intro}<p class="small">出る部員を${ENS_MIN}〜${ENS_MAX}人選ぶ（名前の横の数字は、力の平均）。はじめは、うまい部員のパートを中心に5人を選んである。</p>
        <div class="episode ensp">${secs}</div>
        <div class="transport"><button class="btn primary" type="button" data-act="ensgo"${ok ? '' : ' disabled'}>${ok ? `この${k}人で出る` : `${ENS_MIN}〜${ENS_MAX}人を選ぶ（いま${k}人）`}</button><button class="btn quiet" type="button" data-act="ensskip">今年は出ない</button></div>`;
      return;
    }
    if(e.skipped){
      w.innerHTML = `${intro}<p class="txt">今年のアンサンブルコンテストには出なかった。</p><div class="transport"><button class="btn primary" type="button" data-act="wnext">3月へ</button></div>`;
      return;
    }
    const nm = {gold: '金賞', silver: '銀賞', bronze: '銅賞'}[e.award];
    w.innerHTML = `${intro}<div class="result" style="--award:var(--${e.award})"><div class="award"><span class="stamp">${nm}</span><div><b>${e.rep ? '県の代表に選ばれた！' : {gold: 'アンサンブルで金賞！', silver: '銀賞。少人数でもよく合っていた。', bronze: '銅賞。少人数のむずかしさを知った。'}[e.award]}</b>
      <p class="small">${e.names.map(esc).join('・')}（${e.names.length}人）・${e.score}点</p></div></div>
      <div class="transport"><button class="btn small" type="button" data-act="playrec" data-id="${e.recId}">▶ 聴く</button><button class="btn primary" type="button" data-act="wnext">3月へ</button></div></div>`;
    return;
  }
  w.innerHTML = `<div class="event"><span class="tag">3月・卒業式</span><span>${names.length ? `卒業式の日。${names.map(esc).join('、')}を、1・2年生の演奏で送ろう。` : '3月。春休みの音楽室で、新しい1年に向けて準備をしよう。'}</span></div>
    <div class="transport"><button class="btn primary" type="button" data-act="wnext">${names.length ? '演奏で送って、4月へ' : '4月へ（新年度）'}</button></div>`;
}
/* ===== 新しく入った部員の担当を決める（部をつくった最初の5人・本入部の1年生・途中から入ってきた部員） =====
   上の札で部員を選び、舞台の空いている席をタップして座らせる。選んだ部員の希望の楽器の席は光る。
   この曲で旋律やソロを吹く空き席には ♪ をつける */
function asgState(){
  const key = `${S.year}:${S.week}:${S.recruits.map(r => r.id).join(',')}`;
  if(U.asg?.key !== key){ const map = autoAssign(S); U.asg = {key, picks: Object.fromEntries(S.recruits.map(r => [r.id, map[r.id] || null])), sel: S.recruits[0]?.id}; }
  return U.asg;
}
function renderAssign(w, ev){
  asgState();
  const first = foundingYear(S) && !S.members.length;
  const intro = first ? `休部していた吹奏楽部に、1年生が${S.recruits.length}人入部してきた。` : ev?.kind === 'assign' ? '1年生が正式に入部した。' : '新しい部員が入ってきた。';
  w.innerHTML = `<div class="event"><span class="tag">${first ? '入部' : ev?.kind === 'assign' ? ev.title : '入部'}</span><span>${intro}部員を選んでから、舞台の空いている席をタップして座らせよう。希望の楽器だとやる気が上がる。</span></div>
    <div class="rchips" id="asgList"></div>
    <div class="stage-wrap"><canvas id="asgStage" role="img" aria-label="舞台の席。部員を選んでから、空いている席をタップすると座る。"></canvas></div>
    <p class="legend" id="asgLegend"></p>
    <div class="transport"><button class="btn small" type="button" data-asg="bench">選んでいる部員を控え（席なし）に</button><button class="btn primary" type="button" data-act="assign">この配置で決める</button></div>`;
  $('#asgStage').addEventListener('click', asgTap);
  asgUpdate();
}
// 札・説明・舞台を描き直す
function asgUpdate(){
  const A = U.asg, list = $('#asgList');
  if(!A || !list) return;
  list.innerHTML = S.recruits.map(r => {
    const seat = A.picks[r.id], happy = seat && SEAT[seat].inst === r.hope;
    const sk = Object.entries(innateSkills(r.id, r.exp)).map(([id, v]) => `<span class="sk">${SKILLS[id].name}${skillMark(v >= 2.5 ? 2 : 1)}</span>`).join('');
    return `<button class="rchip" type="button" data-rid="${r.id}" aria-pressed="${A.sel === r.id}"><b>${esc(r.name)}</b><small>${r.grade || 1}年・希望：${INST[r.hope].name}・${r.exp ? '経験あり' : '初心者'}</small>${sk ? `<span class="sks">${sk}</span>` : ''}
      <span class="where${happy ? ' happy' : seat ? '' : ' none'}">${seat ? `→ ${seatLabel(seat)}${happy ? '・希望どおり' : ''}` : '→ まだ席がない（控え）'}</span></button>`;
  }).join('');
  const r = S.recruits.find(x => x.id === A.sel);
  $('#asgLegend').innerHTML = `${r ? `<span><i class="sw sw-hope"></i>光る席：${esc(r.name)}の希望（${INST[r.hope].name}）</span>` : ''}<span><i class="sw sw-new"></i>新しい部員</span><span><i class="sw sw-old"></i>いまの部員</span>${S.pieceId ? '<span>♪：この曲で旋律を吹く席</span>' : ''}`;
  drawAssignStage();
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
  const label = (s, x, y, col) => { if(G.r < 10) return; g.fillStyle = col; g.font = `700 ${G.r >= 13 ? 9 : 8}px ${C.fBody}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s.sec === 'perc' ? 'Perc' : INST[s.inst].short.replace('Sax', 'S'), x, y + 0.5); };
  for(const s of SEATS){
    const [x, y] = seatXY(s, G);
    const m = S.members.find(mm => mm.seat === s.id), rid = by[s.id];
    if(m){ dot(x, y, skillColor(C, avgStats(m)), 0.45); label(s, x, y, 'rgba(255,255,255,.8)'); continue; }
    if(rid){
      dot(x, y, C.brass); label(s, x, y, '#fff');
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
  const A = U.asg, s = seatAt(e, $('#asgStage'));
  if(!A || !s) return;
  const m = S.members.find(x => x.seat === s.id);
  if(m){ toast(`${m.name}（${m.grade}年・${seatLabel(s.id)}）の席`, 1800); return; }
  const rid = Object.keys(A.picks).find(k => A.picks[k] === s.id);
  if(rid){ A.sel = rid; asgUpdate(); return; }
  if(!A.sel) return;
  haptic('tap');
  A.picks[A.sel] = s.id;
  const who = S.recruits.find(x => x.id === A.sel);
  toast(`${who.name} → ${seatLabel(s.id)}${s.inst === who.hope ? '（希望どおり）' : ''}`, 1800);
  // 席のない部員がほかにいれば、次はその子を選んでおく
  const next = S.recruits.find(x => !A.picks[x.id]);
  if(next) A.sel = next.id;
  asgUpdate();
}
// コンクールに出るメンバーの人数と、決め直すボタン
function lineupLine(){
  const ms = seated(S), off = ms.filter(m => m.out).length;
  const set = lineupSet(S);
  return `<div class="lineup-line"><span class="small">コンクールの出場メンバー：${set ? `${ms.length - off}人${off ? `（控え${off}人）` : '（全員）'}` : `まだ決めていない（このままだと全員の${ms.length}人）`}</span>
    <button class="btn small" type="button" data-act="lineupopen">${set ? 'メンバーを変える' : 'メンバーを決める'}</button></div>`;
}
// オーディションの画面：一人ずつの点と、選んだメンバーで出たときの点の目安
const audScore = m => (S.audition.scores[m.id] || auditionScore(S, m));
function renderAudition(w, ev){
  if(!S.audition || S.audition.y !== S.year){ commit(startAudition(S)); }
  if(!U.draft) U.draft = new Set(seated(S).filter(m => m.out).map(m => m.id));
  const {ev: cev} = nextContest(S);
  const order = m => SEATS.findIndex(x => x.id === m.seat);
  const secs = SECTIONS.map(sec => [sec, seated(S).filter(m => SEAT[m.seat].sec === sec.id).sort((a, b) => audScore(b).score - audScore(a).score || order(a) - order(b))]).filter(([, ms]) => ms.length);
  const C = tok();
  const rows = secs.map(([sec, ms]) => `<li class="psec">${sec.name}</li>` + ms.map(m => {
    const a = audScore(m), inn = !U.draft.has(m.id);
    return `<li class="am${inn ? '' : ' off'}"><label><input type="checkbox" data-aout="${m.id}"${inn ? ' checked' : ''}><span class="who"><b>${esc(m.name)}</b><small>${m.grade}年・${esc(PART_LABEL[SEAT[m.seat].part])}${a.freeze ? '・緊張で崩れた' : a.zone ? '・いつも以上の出来' : ''}</small></span></label>
      <span class="sc"><span class="track"><span class="fill" style="width:${a.score}%;background:${skillColor(C, a.score)}"></span></span><b>${a.score}</b></span>
      <button class="btn small" type="button" data-audplay="${m.id}" aria-label="${esc(m.name)}のオーディションを聴く">▶</button></li>`;
  }).join('')).join('');
  const intro = ev?.kind === 'audition' && !S.audition.decided ? ev.text : `${cev.title}に出るメンバーを決める。オーディションの点を見て、出る人にチェックを入れよう。`;
  w.innerHTML = `<div class="event"><span class="tag">オーディション</span><span>${intro}</span></div>
    <p class="small">点は、自由曲で問われる力（${PIECES[S.pieceId].asks}）と、その日の緊張で決まる。チェックを外した部員は控え（練習はいつもどおり。秋からはまた全員で吹く）。</p>
    <div class="aud-pred" id="audPred" aria-live="polite"></div>
    <div class="chips"><button class="chip" type="button" data-aud="all">全員出る</button><button class="chip" type="button" data-aud="best">おすすめのメンバーにする</button><button class="chip" type="button" data-aud="listen">▶ このメンバーで聴く</button></div>
    <ul class="plist alist">${rows}</ul>
    <div class="transport"><button class="btn primary" type="button" data-act="lineup">このメンバーで決める</button>${S.audition.decided ? '<button class="btn quiet" type="button" data-aud="cancel">変えずにもどる</button>' : ''}</div>`;
  updatePred(true);
}
// 選んだメンバーで出たときの点の目安（メンバーを変えるたびに計算し直す）
function updatePred(soon){
  const el = $('#audPred'); if(!el) return;
  const out = U.draft || new Set();
  const n = seated(S).length - [...out].filter(id => memberById(id)?.seat).length;
  const {ev, w} = nextContest(S), L = LEVELS[ev.level], left = w - S.week;
  const key = S.year + ':' + S.week + ':' + [...out].sort().join(',');
  const show = p => {
    const nm = {gold: '金賞', silver: '銀賞', bronze: '銅賞'}[p.award];
    // 目安は、いまの方針のまま本番の週まで練習を続けたときの部で出す（自分で指揮すると、ここから上がる）
    el.innerHTML = `<b>${n}人で出ると、${L.name}で審査員平均 ${p.avg.toFixed(1)}点（${nm}）くらい</b><span class="small">${left > 0 ? `本番まであと${left}週、いまの方針で練習を続けたときの目安。` : ''}金賞の目安は${L.gold}点、${L.rep ? `代表は3人ともA（${L.A}点）。` : ''}${p.thin >= 6 ? '人数が少ないぶん、響きが薄いと見られる。' : ''}本番の日の調子や指揮でも上下する。</span>`;
  };
  if(U.predKey === key && U.pred){ show(U.pred); return; }
  el.innerHTML = `<b>${n}人で出ると……</b><span class="small">計算中</span>`;
  clearTimeout(U.predT);
  U.predT = setTimeout(() => { U.pred = predictContest(S, out); U.predKey = key; if($('#audPred')) show(U.pred); }, soon ? 30 : 120);
}
// 今週の練習：部の方針（全員で1つ）と、部員ひとりずつの今週の練習
const menuLabel = id => { const m = MENU_BY[id]; return m.up ? `${m.name}（${m.up}）` : m.name; };
const lastText = m => {
  if(!m.last) return '';
  if(m.last.menu === 'test') return '先週：テスト期間';
  const d = Object.entries(m.last.d || {}).filter(([, v]) => v >= 0.1).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${k === 'fam' ? '譜読み' : STAT_LABEL[k]}+${v.toFixed(1)}`).join(' ');
  const sp = m.last.span != null && S.pieceId && PIECES[S.pieceId].spans[m.last.span] ? `（${spanShort(PIECES[S.pieceId].spans[m.last.span])}）` : '';
  return `先週：${MENU_BY[m.last.menu]?.name || ''}${sp}${d ? ' ' + d : ''}`;
};
// 曲の個人練習で打ちこむ区間を選ぶ欄（選ばなければ、いちばん吹けていない区間）
const spanSelect = m => {
  const pid = S.pieceId, v = readOf(m, pid), want = S.planSpan?.[m.id], weak = practiceSpan({...S, planSpan: {}}, m);
  return `<label class="ps"><span>練習するところ</span><select data-span="${m.id}" aria-label="${esc(m.name)}が練習するところ">`
    + `<option value="">いちばん吹けていないところ（${spanShort(PIECES[pid].spans[weak])}）</option>`
    + readUnits(pid).map(u => `<option value="${u.i}"${want === u.i ? ' selected' : ''}>${spanShort(u)}（譜読み${Math.round(v[u.i])}）</option>`).join('') + '</select></label>';
};
function planHtml(ev){
  const menus = MENU.filter(m => menuOpen(S, m.id));
  const order = m => m.seat ? SEATS.findIndex(x => x.id === m.seat) : 999;
  const ms = S.members.slice().sort((a, b) => order(a) - order(b));
  const count = {};
  for(const m of ms){ const id = planFor(S, m); count[id] = (count[id] || 0) + 1; }
  const tired = ms.filter(m => m.sta < 30).length;
  const pol = POLICY_BY[S.policy] ? S.policy : 'auto';
  // 部員はパートごとにたたむ（部員が多いと「すすめる」ボタンがずっと下になるので）。見出しに、そのパートの今週の練習をまとめて出す
  const groups = [];
  for(const m of ms){ const k = m.seat ? SEAT[m.seat].sec : 'bench'; let g = groups.find(x => x.k === k); if(!g) groups.push(g = {k, ms: []}); g.ms.push(m); }
  const rowOf = m => {
    const auto = decideMenu(S, m), own = S.plan?.[m.id] && menuOpen(S, S.plan[m.id]) ? S.plan[m.id] : '';
    const c = m.sta >= 60 ? 'good' : m.sta >= 30 ? 'warn' : 'bad';
    return `<li class="pm${own ? ' own' : ''}"><span class="who"><b>${esc(m.name)}</b><small>${m.grade}年・${m.seat ? esc(PART_LABEL[SEAT[m.seat].part]) : '控え'}${m.out && m.seat ? '・コンクール控え' : ''}${S.pieceId ? `・譜読み${Math.round(readMean(m, S.pieceId))}` : ''}・苦手：${STAT_LABEL[weakest(m)]}</small></span>
      <span class="sta" title="体力 ${Math.round(m.sta)}"><span class="track"><span class="fill ${c}" style="width:${clamp(m.sta, 0, 100)}%"></span></span><b>${Math.round(m.sta)}</b></span>
      <label class="pw"><span>今週</span><select data-plan="${m.id}" aria-label="${esc(m.name)}の今週の練習"><option value="">おまかせ（${MENU_BY[auto].name}）</option>${menus.map(x => `<option value="${x.id}"${own === x.id ? ' selected' : ''}>${menuLabel(x.id)}</option>`).join('')}</select></label>${(own || auto) === 'piece' && S.pieceId ? spanSelect(m) : ''}
      ${m.last ? `<small class="last">${esc(lastText(m))}</small>` : ''}</li>`;
  };
  const rows = groups.map(({k, ms: gm}) => {
    const name = k === 'bench' ? '控え' : SEC[k].name;
    // 2人以上いるパートは、全員の今週の練習をまとめて選べる
    const same = gm.every(x => (S.plan?.[x.id] || '') === (S.plan?.[gm[0].id] || '')) ? (S.plan?.[gm[0].id] || '') : '-';
    const secSel = gm.length >= 2 ? `<select data-secplan="${k}" aria-label="${name}の全員の今週の練習"><option value="-"${same === '-' ? ' selected' : ''}>このパート全員：…</option><option value=""${same === '' ? ' selected' : ''}>全員おまかせ</option>${menus.map(x => `<option value="${x.id}"${same === x.id ? ' selected' : ''}>全員 ${menuLabel(x.id)}</option>`).join('')}</select>` : '';
    const cnt = {};
    for(const m of gm){ const id = planFor(S, m); cnt[id] = (cnt[id] || 0) + 1; }
    const what = MENU.filter(x => cnt[x.id]).map(x => `${x.name}${gm.length > 1 ? ` ${cnt[x.id]}` : ''}`).join('・');
    const own = gm.some(m => S.plan?.[m.id] && menuOpen(S, S.plan[m.id]));
    const low = gm.filter(m => m.sta < 30).length;
    const open = ms.length <= 8 || U.openSecs?.has(k);
    return `<details class="psecd" data-sec="${k}"${open ? ' open' : ''}><summary><b>${name}<small>${gm.length}人</small></b><span class="what">${what}${own ? '・指示あり' : ''}${low ? `<em>疲れ ${low}人</em>` : ''}</span></summary>
      ${secSel ? `<div class="secall">${secSel}</div>` : ''}<ul class="plist">${gm.map(rowOf).join('')}</ul></details>`;
  }).join('');
  const sum = MENU.filter(m => count[m.id]).map(m => `${m.name} ${count[m.id]}人`).join('・');
  const tutti = (count.tutti || 0) + (count.hall || 0);
  return `<div class="plan">
    ${foundingYear(S) && S.week < 4 ? '<p class="small">「おまかせ」のままの部員は、部の方針で自分の練習を決める。指示したい部員だけ、今週の練習を選ぼう。合奏は出た人が多いほど、部のまとまりと曲の仕上がりが伸びる。</p>' : ''}
    <div class="focus"><span>部の方針</span><div class="chips">${POLICIES.map(p => `<button class="chip" type="button" data-polall="${p.id}" aria-pressed="${pol === p.id}">${p.name}</button>`).join('')}</div>
    <span class="small">${POLICY_BY[pol].desc}</span></div>
    ${setActive(S) ? `<div class="focus"><span>曲の練習の配分（自由曲 ${esc(PIECES[S.pieceId].title)}・課題曲 ${esc(PIECES[S.setPiece].title)}）</span><div class="chips">${Object.keys(SPLIT).map(k => `<button class="chip" type="button" data-split="${k}" aria-pressed="${(S.split || 'both') === k}">${SPLIT_NAME[k]}</button>`).join('')}</div>
      <span class="small">仕上がり：自由曲 ${Math.round(S.fam[S.pieceId] || 0)}・課題曲 ${Math.round(S.fam[S.setPiece] || 0)}。曲の練習・合奏の伸びを、この配分で2曲に分ける</span></div>` : ''}
    <div class="psecs">${ms.length > 8 ? '<p class="small">部員ごとの練習（パートを押すと開く。数字は人数）</p>' : ''}${rows}</div>
    ${S.pieceId && !S.finalWeek && S.week >= 8 && nextContest(S).w > S.week ? lineupLine() : ''}
    <p class="small plan-sum">今週の予定：${sum}${tutti === 1 ? '（合奏は2人以上いないとできない）' : ''}</p>
    ${tired ? `<p class="small">体力が30を切っている部員が${tired}人。休ませないと、練習の効果が半分になる。</p>` : ''}
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
  return `<div class="epilogue"><span class="tag">3年間の物語</span><h3>最初の1年生たちが、卒業していく</h3>
    <p class="txt">${y0}年の春、あなたが顧問になって最初に入部してきた${firsts.length}人。楽器を持つのもはじめての子もいた。</p>
    <ol>${years.map(h => `<li>${h.year}年度　${esc(h.piece || '')}　${h.results.length ? resultText(h.results) : ''}</li>`).join('')}</ol>
    <p class="txt">${firsts.map(m => esc(m.name)).join('、')}。今日、この部を引退する。</p>
    <div class="transport">${april ? `<button class="btn small" type="button" data-act="playrec" data-id="${april.id}">▶ 入部したばかりのころの合奏</button>` : ''}${last ? `<button class="btn small" type="button" data-act="playrec" data-id="${last.id}">▶ 最後の定期演奏会</button>` : ''}</div></div>`;
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
  const bars = f ? STAT_KEYS.map(k => `<div class="gb"><span class="nm">${STAT_LABEL[k]}</span><span class="track"><span class="fill was" style="width:${clamp(f.stats[k], 0, 100)}%"></span><span class="fill" style="width:${clamp(m.stats[k], 0, 100)}%"></span></span><span class="val">${Math.round(f.stats[k])}→${Math.round(m.stats[k])}</span></div>`).join('') : '';
  const inst = m.seat ? INST[SEAT[m.seat].inst].name : '控え';
  const showFirst = first && (!last || first.id !== last.id);
  return `<details class="senior"><summary><span class="nm">${esc(m.name)}</span><span class="sub">${esc(inst)}${m.title ? '・' + m.title : ''}</span>${grow && grow[1] >= 1 ? `<span class="grow">${STAT_LABEL[grow[0]]} +${Math.round(grow[1])}</span>` : ''}</summary>
    <div class="body">
      ${f ? `<p class="small">${ymLabel(f.y, f.w)}${joinedHere ? 'に入部したころ' : '（この日誌をつけ始めたころ）'}と、いま</p><div class="gbars">${bars}</div>` : ''}
      ${(m.story || []).length ? `<ul class="mem">${m.story.map(x => `<li><time>${ymLabel(x.y, x.w)}</time>${esc(x.t)}</li>`).join('')}</ul>` : ''}
      <p class="bye">${farewellLine(m)}</p>
      <div class="transport">${showFirst ? `<button class="btn small" type="button" data-act="memplay" data-id="${first.id}" data-mid="${m.id}">▶ ${joinedHere ? '入部したころ' : 'いちばん古い録音'}の音</button>` : ''}${last && recHas(last, m) ? `<button class="btn small" type="button" data-act="memplay" data-id="${last.id}" data-mid="${m.id}">▶ 最後の本番の音</button><button class="btn small" type="button" data-act="memsave" data-id="${last.id}" data-mid="${m.id}">⤓ 保存</button>` : ''}</div>
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
      <div class="transport"><button class="btn small" type="button" data-act="playrec" data-id="${p.recId}">▶ もう一度聴く</button><button class="btn small" type="button" data-act="saverec" data-id="${p.recId}">⤓ 保存</button><button class="btn primary" type="button" data-act="next">${ev.final ? (hasSeniors(S) ? '3年生の引退へ' : '1年のふり返りへ') : '次の週へ'}</button></div></div>`;
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
function renderInterp(){
  const pc = PIECES[playPiece()];
  const rows = [
    ['tempo', 'テンポ', [0, 1, 2].map(i => `${INTERP_NAMES.tempo[i]} ${tempoLabel(pc, i)}`)],
    ['dyn', '抑揚の幅', INTERP_NAMES.dyn],
    ['rub', 'テンポの揺れ', INTERP_NAMES.rub],
  ];
  const lock = busy();
  $('#interp').innerHTML = rows.map(([k, nm, labels]) => `<div class="row"><span>${nm}</span><div class="seg" role="group" aria-label="${nm}">${labels.map((l, i) => `<button type="button" data-interp="${k}:${i}" aria-pressed="${S.interp[k] === i}"${lock ? ' disabled' : ''}>${l}</button>`).join('')}</div></div>`).join('');
}
// 部の歴史：年度ごとの曲・結果・引退した部員と、残してある録音
const AWARD_NM = {gold: '金賞', silver: '銀賞', bronze: '銅賞'};
const resultText = results => results.map(r => `${LEVELS[r.level].name}${AWARD_NM[r.award]}${r.rep ? '（代表）' : ''}`).join('→');
function renderHistory(){
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
        ${h.ens ? `<p>アンサンブルコンテスト：${AWARD_NM[h.ens.award]}（${h.ens.names.map(esc).join('・')}）</p>` : ''}
        ${h.retired?.length ? `<p>引退した3年生${h.firstClass ? '（顧問になって最初の代）' : ''}：${h.retired.map(esc).join('、')}</p>` : ''}
        <div class="transport">${recBtns(h.year)}</div>
      </div></details>`;
  }).join('') : '');
}
function renderLog(){
  $('#log').innerHTML = S.log.slice().reverse().slice(0, 80)
    .map(e => `<li><time>${e.y !== S.year ? e.y + ' ' : ''}${wkShort(e.w)}</time><span>${esc(e.text)}</span></li>`).join('');
}

/* ===== 部員カード・名簿 ===== */
// 入部したとき（またはこの日誌をつけ始めたとき）からの伸びと、思い出
const ymLabel = (y, w) => `${y}年${wkMonth(w)}月`;
function growthText(m){
  if(!m.first) return '';
  return STAT_KEYS.map(k => { const d = Math.round(m.stats[k] - m.first.stats[k]); return `${STAT_LABEL[k]}${d >= 0 ? '+' : '−'}${Math.abs(d)}`; }).join('　');
}
function memberStory(m){
  const g = growthText(m);
  const st = (m.story || []).slice(-5).reverse();
  if(!g && !st.length) return '';
  return `<div class="mc-story">${g ? `<p class="small">${ymLabel(m.first.y, m.first.w)}${m.first.y === m.joined ? 'の入部' : 'に日誌をつけ始めて'}から：${g}</p>` : ''}
    ${st.length ? `<ul>${st.map(x => `<li><time>${ymLabel(x.y, x.w)}</time>${esc(x.t)}</li>`).join('')}</ul>` : ''}</div>`;
}
// 部員カードは、押したところ（合奏のステージか、部員の名簿）の近くに出す
function placeCard(where){
  const card = $('#memberCard');
  if(where === 'roster') $('.roster').insertBefore(card, $('.roster .sec-grid'));
  else $('.col-stage').appendChild(card);
}
// スキル：小さな札（名前の横）と、部員カードの一覧（説明と、もうすぐ身につきそうなもの・育ち方）
const skillChips = m => skillsOf(m).map(x => ` <span class="sk">${x.name}${skillMark(x.lv)}</span>`).join('');
function skillList(m){
  const have = skillsOf(m);
  const near = SKILL_IDS.filter(id => { const v = m.sp?.[id] || 0; return (v >= 0.6 && v < 1) || (v >= 2 && v < 2.5); }).map(id => SKILLS[id].name + skillMark(skillLv(m, id) + 1));
  const bent = STAT_KEYS.filter(k => (m.bent?.[k] || 0) >= 0.04).sort((a, b) => m.bent[b] - m.bent[a]).map(k => STAT_LABEL[k]);
  return `<div class="mc-skills">${have.length ? `<ul>${have.map(x => `<li><b>${x.name}${skillMark(x.lv)}</b>${esc(x.desc)}</li>`).join('')}</ul>` : '<p class="small">スキルはまだない。練習を続けたり、相談に乗ったりすると身につくことがある。</p>'}
    ${near.length ? `<p class="small">もうすぐ：${near.join('・')}</p>` : ''}${bent.length ? `<p class="small">伸びやすい力：${bent.join('・')}（相談への答え方で育った）</p>` : ''}</div>`;
}
// 部員のひとこと：いまの様子（体力・最近の伸び・苦手・癖・学年・役）に合うものから、週ごとに1つ
// 本番を見ているときに部員をタップしたら、その子の様子（力・本番の強さ・今日の調子・スキル）を舞台の下に出す
function showCdMember(id){
  const el = $('#cdMember'), m = id && memberById(id);
  CD.sel = m ? m.id : null;
  if(!m){ el.hidden = true; drawStage(-1, $('#cdStage'), CD.who); return; }
  const C = tok(), mood = (CD.perf?.mental || []).find(x => x.mid === m.id)?.kind;
  const plays = CD.who?.has(m.id), solo = U.solo === `member:${m.id}`;
  el.innerHTML = `<div class="cm-head"><span><b>${esc(m.name)}</b><small>${m.grade}年・${esc(PART_LABEL[SEAT[m.seat].part])}${m.title ? '・' + esc(m.title) : ''}</small></span><button class="btn small quiet" type="button" data-cdm="close">閉じる</button></div>
    <p class="cm-say">${esc(memberSays(m))}</p>
    <div class="cm-stats">${STAT_KEYS.map(k => `<span class="cm-st">${STAT_LABEL[k]}<span class="track"><span class="fill" style="width:${clamp(m.stats[k], 0, 100)}%;background:${skillColor(C, m.stats[k])}"></span></span><b>${Math.round(m.stats[k])}</b></span>`).join('')}</div>
    <p class="cm-note">本番の強さ ${Math.round(m.mental ?? 40)}${mood === 'zone' ? '・今日は、いつも以上の音が出ている' : mood === 'freeze' ? '・今日は、緊張で頭が真っ白になっている' : ''}${plays ? '' : '・この本番には出ていない'}${skillChips(m)}</p>
    ${plays ? `<div class="row"><button class="btn small" type="button" data-cdm="solo">${solo ? '全員の音にもどす' : 'この子の音だけ聴く'}</button></div>` : ''}`;
  el.hidden = false;
  if(!U.playing) drawStage(-1, $('#cdStage'), CD.who);
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
function renderMemberCard(){
  const card = $('#memberCard');
  const m = U.sel && memberById(U.sel);
  if(!m){ card.hidden = true; return; }
  card.hidden = false;
  const seat = m.seat && SEAT[m.seat];
  const tr = m.trait && TRAITS[m.trait];
  const seats = SEATS.filter(s => s.id !== m.seat).map(s => {
    const o = S.members.find(x => x.seat === s.id);
    return `<option value="${s.id}">${seatLabel(s.id)}${o ? `・${esc(o.name)}と交代` : '・空席'}</option>`;
  }).join('');
  card.innerHTML = `<div class="mc-head"><h3>${esc(m.name)}</h3>${m.title ? `<span class="tag">${m.title}</span>` : ''}<span class="sub">${m.grade}年・${seat ? PART_LABEL[seat.part] : '控え（席なし）'}</span><button class="link mc-close" type="button" data-mact="close">閉じる</button></div>
    <p class="mc-say">${esc(memberSays(m))}</p>
    ${skillList(m)}
    ${tr ? `<p class="mc-trait">癖：${tr.name}。${tr.desc}</p>` : '<p class="mc-trait">目立った癖はない。</p>'}
    <div class="stats">${STAT_KEYS.map(k => statRow(STAT_LABEL[k], m.stats[k], '', '')).join('')}${m.mental != null ? statRow('本番の強さ', m.mental, '', '', 'warn') : ''}${S.pieceId ? `<p class="mc-sub">譜読み（${PIECES[S.pieceId].title}）</p>`
      + readUnits(S.pieceId).map(u => statRow(spanShort(u), readOf(m, S.pieceId)[u.i], '', '')).join('') : ''}</div>
    ${memberStory(m)}
    ${seat ? `<div class="mc-actions"><button class="btn small" type="button" data-mact="solo">▶ この人だけ聴く</button><button class="btn small" type="button" data-mact="secsolo">▶ パートだけ聴く</button>${U.solo !== 'all' ? '<button class="btn small quiet" type="button" data-mact="all">全員の音にもどす</button>' : ''}</div>` : ''}
    <details class="mc-move"><summary>席を移す</summary><div class="mc-actions"><select id="moveSel" aria-label="移す先"><option value="">控え（席なし）</option>${seats}</select><button class="btn small" type="button" data-mact="move"${busy() ? ' disabled' : ''}>移す</button></div>
    <p class="small">楽器が変わると、その楽器での音程と音色は基礎からやり直しになる。</p></details>`;
}
function renderRoster(){
  $('#secGrid').innerHTML = SECTIONS.map(s => {
    const ms = secMembers(S, s.id), seats = SEATS.filter(x => x.sec === s.id).length;
    const av = k => ms.length ? ms.reduce((a, m) => a + m.stats[k], 0) / ms.length : 0;
    return `<button class="sec-tile" type="button" data-sec="${s.id}" aria-pressed="${U.view === s.id}"><b>${s.name}</b>
      <span class="bars">${STAT_KEYS.map(k => `<i title="${STAT_LABEL[k]} ${Math.round(av(k))}"><span style="height:${av(k)}%"></span></i>`).join('')}</span>
      <small>${ms.length}/${seats}人</small></button>`;
  }).join('');
  const rows = [];
  for(const sec of SECTIONS){
    const ms = SEATS.filter(x => x.sec === sec.id).map(s => [s, S.members.find(x => x.seat === s.id)]).filter(([, m]) => m);
    if(!ms.length) continue;
    rows.push(`<tr class="sec-row"><td colspan="5">${sec.name}</td></tr>`);
    for(const [s, m] of ms) rows.push(memberRow(m, PART_LABEL[s.part]));
  }
  const bench = S.members.filter(m => !m.seat);
  if(bench.length){
    rows.push(`<tr class="sec-row"><td colspan="5">控え</td></tr>`);
    for(const m of bench) rows.push(memberRow(m, '席なし'));
  }
  $('#rosterTable').innerHTML = `<thead><tr><th>名前</th>${STAT_KEYS.map(k => `<th class="num">${STAT_LABEL[k]}</th>`).join('')}</tr></thead><tbody>${rows.join('') || '<tr class="empty"><td colspan="5">部員はまだいない</td></tr>'}</tbody>`;
}
function memberRow(m, part){
  const C = tok();
  const sub = [`${m.grade}年`, part + (m.out && m.seat ? '（コンクール控え）' : ''), m.trait ? TRAITS[m.trait].name : '', ...skillsOf(m).map(x => x.name + skillMark(x.lv))].filter(Boolean).join('・');
  return `<tr class="mem${U.sel === m.id ? ' sel' : ''}" data-mid="${m.id}"><td><b>${esc(m.name)}</b>${m.title ? ` <span class="tag">${m.title}</span>` : ''}<small>${sub}</small></td>`
    + STAT_KEYS.map(k => `<td class="num" style="color:${skillColor(C, m.stats[k])}">${Math.round(m.stats[k])}</td>`).join('') + '</tr>';
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
function pieceCard(id, {tag = '', note = '', act, label}){
  const pc = PIECES[id];
  return `<div class="pcard">${tag ? `<span class="tag fit">${tag}</span>` : ''}<h3>${pc.title}</h3><p>${pc.composer}${note ? `・${note}` : ''}</p>
    <p class="asks">問われる力：<b>${pc.asks}</b></p>
    <details class="pdesc"><summary>どんな曲？</summary><p>${pc.full}。${pc.desc}</p></details>
    <div class="row"><button class="btn small" type="button" data-act="model" data-pid="${id}">▶ お手本</button><button class="btn small" type="button" data-act="preview" data-pid="${id}">▶ いまの部で</button><button class="btn small primary" type="button" data-act="${act}" data-pid="${id}">${label}</button></div></div>`;
}
const listenBtns = id => `<button class="btn small" type="button" data-act="model" data-pid="${id}">▶ お手本を聴く</button><button class="btn small" type="button" data-act="preview" data-pid="${id}">▶ いまの部で聴く</button>`;

/* ===== まとめて描く ===== */
function renderAll(){
  fxMoments();
  renderHeader(); renderPiece(); renderVenues(); renderSelectors();
  renderStats(); renderWeek(); renderInterp(); renderLog();
  renderMemberCard(); renderRoster(); renderHistory();
  $('#btnNow').disabled = busy();
}

/* ===== 操作 ===== */
// 「この人だけ聴く」「パートだけ」を、全員の音にもどす
function soloAll(){ const was = U.solo !== 'all'; U.solo = 'all'; applySolo(); if(was){ renderSelectors(); renderMemberCard(); } }
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
  if(fxCalm()) go(); else stageIntro(perfs[0], ev, rec, go, setRec ? `課題曲 ${PIECES[setRec.pieceId].title}・自由曲 ${PIECES[rec.pieceId].title}` : null);
  setTimeout(() => { if(E.ac) applauseBuffer(E.ac); }, 2500);   // 拍手の音は、演奏中に作っておく
}
// 本番を自分で指揮する：結果はいったん部員まかせで決め、指揮しきったら指揮の演奏で採点し直す
function startStageConduct(){
  stopPlay();
  soloAll();
  commit(beginStage(S));
  const rec = S.recs.find(r => r.id === S.pending.recId);
  U.piece = null; U.range = 'all';
  setVenue(rec.venue);
  renderAll();
  openConduct({rec, ev: eventAt(S, S.week)});
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
function playRec(id){
  const rec = S.recs.find(r => r.id === id);
  if(!rec) return;
  setVenue(rec.venue);
  playRecording(rec, `${rec.label}（${VENUE[rec.venue].name}で録音）`);
}
function bind(){
  $('#btnNow').addEventListener('click', () => {
    if(!U.perfNow) U.perfNow = perform(currentCtx());
    playPerf(U.perfNow, nowLabel());
  });
  $('#btnRec').addEventListener('click', () => playRec($('#recSel').value));
  $('#btnStop').addEventListener('click', stopPlay);
  $('#venueSel').addEventListener('change', e => setVenue(e.target.value));
  $('#rangeSel').addEventListener('change', e => { U.range = e.target.value; refreshNow(); });
  $('#soloSel').addEventListener('change', e => { U.solo = e.target.value; applySolo(); renderMemberCard(); });
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
    else if(b.dataset.cdm === 'solo'){ U.solo = U.solo === `member:${CD.sel}` ? 'all' : `member:${CD.sel}`; applySolo(); showCdMember(CD.sel); }
  });
  $('#stage').addEventListener('click', e => {
    const s = seatAt(e);
    if(!s) return;
    const m = S.members.find(x => x.seat === s.id);
    U.sel = m ? m.id : null;
    U.view = s.sec;
    placeCard('stage');
    renderSelectors(); renderMemberCard(); renderRoster(); drawIdle();
    if(m) $('#memberCard').scrollIntoView({block: narrow.matches ? 'start' : 'nearest', behavior: 'smooth'});
  });
  $('#secGrid').addEventListener('click', e => {
    const b = e.target.closest('[data-sec]'); if(!b) return;
    U.view = U.view === b.dataset.sec ? 'mel' : b.dataset.sec;
    renderSelectors(); renderRoster(); drawIdle();
    if(tabHidden('play') && U.view !== 'mel'){ setTab('play'); $('.roll-wrap').scrollIntoView({block: 'center'}); }
  });
  $('#rosterTable').addEventListener('click', e => {
    const tr = e.target.closest('[data-mid]'); if(!tr) return;
    U.sel = tr.dataset.mid;
    const m = memberById(U.sel);
    if(m?.seat) U.view = SEAT[m.seat].sec;
    if(narrow.matches) placeCard('roster');
    renderSelectors(); renderMemberCard(); renderRoster(); drawIdle();
    $('#memberCard').scrollIntoView({block: narrow.matches ? 'start' : 'nearest', behavior: 'smooth'});
  });
  $('#memberCard').addEventListener('click', e => {
    const b = e.target.closest('[data-mact]'); if(!b) return;
    const m = memberById(U.sel); if(!m) return;
    const act = b.dataset.mact;
    if(act === 'close'){ U.sel = null; renderSelectors(); renderMemberCard(); renderRoster(); drawIdle(); return; }
    if(act === 'solo'){ U.solo = `member:${m.id}`; renderSelectors(); applySolo(); renderMemberCard(); if(!U.playing) $('#btnNow').click(); }
    else if(act === 'secsolo'){ U.solo = `sec:${SEAT[m.seat].sec}`; renderSelectors(); applySolo(); renderMemberCard(); if(!U.playing) $('#btnNow').click(); }
    else if(act === 'all'){ U.solo = 'all'; renderSelectors(); applySolo(); renderMemberCard(); }
    else if(act === 'move'){
      commit(moveMember(S, m.id, $('#moveSel').value || null));
      renderAll(); refreshNow();
    }
  });
  $('#week').addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b || b.disabled) return;
    if(b.dataset.polall){ commit(setPolicy(S, b.dataset.polall)); renderWeek(); return; }
    if(b.dataset.audplay){
      const m = memberById(b.dataset.audplay); if(!m) return;
      setVenue('room');
      playPerf(perform(auditionCtx(S, m)), `オーディション：${m.name}（${instOf(m)}）`);
      return;
    }
    if(b.dataset.aud){
      const a = b.dataset.aud;
      if(a === 'all'){ U.draft = new Set(); renderWeek(); }
      else if(a === 'best'){ $('#audPred').innerHTML = '<b>おすすめのメンバーを探しています……</b>'; setTimeout(() => { U.draft = recommendLineup(S); renderWeek(); }, 30); }
      else if(a === 'listen'){
        const {ev} = nextContest(S);
        setVenue(LEVELS[ev.level].venue);
        const members = seated(S).filter(m => !U.draft.has(m.id));
        playPerf(perform(perfCtx(S, {members, venue: LEVELS[ev.level].venue, fatigue: 0})), `オーディションで選んだ${members.length}人（${VENUE[LEVELS[ev.level].venue].name}）`);
      }
      else if(a === 'cancel'){ U.lineup = false; U.draft = null; renderWeek(); }
      return;
    }
    if(b.dataset.ep !== undefined){ haptic('tap'); commit(resolveEpisode(S, +b.dataset.ep)); renderAll(); refreshNow(); return; }
    if(b.dataset.cs !== undefined){ haptic('tap'); commit(resolveConsult(S, +b.dataset.cs)); renderAll(); return; }
    if(b.dataset.wplan){ haptic('tap'); commit(chooseWinterPlan(S, b.dataset.wplan)); renderAll(); scrollTo(0, 0); return; }
    if(b.dataset.ens){ const id = b.dataset.ens; if(U.ensPick.has(id)) U.ensPick.delete(id); else if(U.ensPick.size < ENS_MAX) U.ensPick.add(id); else return; haptic('tap'); renderWeek(); return; }
    if(b.dataset.split){ haptic('tap'); commit(setSplit(S, b.dataset.split)); renderWeek(); return; }
    if(b.dataset.rid){ U.asg.sel = b.dataset.rid; haptic('tap'); asgUpdate(); return; }
    if(b.dataset.asg === 'bench'){ if(U.asg?.sel){ U.asg.picks[U.asg.sel] = null; asgUpdate(); } return; }
    if(b.dataset.op !== undefined){
      const id = b.dataset.op, v = outingView(S);
      if(U.outPick.has(id)) U.outPick.delete(id); else if(v && U.outPick.size < v.n) U.outPick.add(id); else return;
      haptic('tap'); renderWeek(); return;
    }
    if(b.dataset.act === 'outing'){ haptic('tap'); commit(resolveOuting(S, [...U.outPick])); U.outPick = new Set(); renderAll(); return; }
    const act = b.dataset.act;
    if(act === 'preview' || act === 'model'){
      const pid = b.dataset.pid;
      U.piece = pid; U.range = 'all'; renderPiece(); renderInterp(); U.perfNow = perform(currentCtx()); U.diag = analyze(U.perfNow); renderDiag();
      if(act === 'model') playPerf(modelPerf(pid), `お手本：${PIECES[pid].title}（全員がうまい部・${VENUE.hall.name}）`);
      else playPerf(U.perfNow, `いまの部で：${PIECES[pid].title}${(S.fam[pid] || 0) < 5 ? '（譜読み前）' : ''}`);
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
      haptic('tap'); commit(setLineup(S, U.draft)); U.lineup = false; U.draft = null; renderAll(); refreshNow();
    }
    else if(act === 'assign'){
      haptic('tap'); commit(assignRecruits(S, {...U.asg.picks})); U.asg = null; renderAll(); refreshNow();
    }
    else if(act === 'stage') startStage();
    else if(act === 'stageconduct') startStageConduct();
    else if(act === 'reveal'){ stopPlay(); reveal(); }
    else if(act === 'next'){ stopPlay(); commit(finishStage(S)); renderAll(); refreshNow(); }
    else if(act === 'newyear'){ stopPlay(); commit(newYear(S)); U.sel = null; U.piece = null; renderAll(); refreshNow(); }
    else if(act === 'winter'){ stopPlay(); commit(startWinter(S)); U.sel = null; renderAll(); scrollTo(0, 0); }
    else if(act === 'ensgo'){ haptic('tap'); commit(runEnsemble(S, [...U.ensPick])); renderAll(); }
    else if(act === 'ensskip'){ commit(skipEnsemble(S)); renderAll(); }
    else if(act === 'wnext'){ stopPlay(); const ny = winterStep(S).id === 'grad'; commit(winterNext(S)); if(ny){ U.sel = null; U.piece = null; } renderAll(); refreshNow(); scrollTo(0, 0); }
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
      t.closest('.am')?.classList.toggle('off', !t.checked);
      updatePred();
      return;
    }
    if(t.dataset.plan){ commit(setPlan(S, t.dataset.plan, t.value || null)); renderWeek(); }
    else if(t.dataset.secplan && t.value !== '-'){
      let s2 = S;
      for(const m of S.members) if((m.seat ? SEAT[m.seat].sec : 'bench') === t.dataset.secplan) s2 = setPlan(s2, m.id, t.value || null);
      commit(s2); renderWeek();
    }
    else if(t.dataset.span){ commit(setPlanSpan(S, t.dataset.span, t.value === '' ? null : +t.value)); renderWeek(); }
  });
  $('#interp').addEventListener('click', e => {
    const b = e.target.closest('[data-interp]'); if(!b || b.disabled) return;
    const [k, i] = b.dataset.interp.split(':');
    S.interp[k] = +i; commit(S);
    renderInterp(); renderPiece(); refreshNow();
  });
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
  if('ResizeObserver' in window) new ResizeObserver(redraw).observe($('.stand'));
  else window.addEventListener('resize', redraw);
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => { redraw(); renderRoster(); });
  new MutationObserver(() => { redraw(); renderRoster(); }).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
  document.fonts?.ready.then(redraw);
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
  U.perfNow = perform(currentCtx());
  U.diag = analyze(U.perfNow);
  U.shown = U.perfNow; U.shownLabel = nowLabel();
  setNowPlaying(); renderDiag(); drawIdle();
}
window.claude?.hot?.snapshot?.(() => ({S}));
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
