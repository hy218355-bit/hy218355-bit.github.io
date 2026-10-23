'use strict';
/* 画面：ステージ・譜面台・チューナー・ホワイトボード・名簿・ラボ */

const $ = s => document.querySelector(s);
const E = new Engine();
let S = null;
const U = {
  venue: 'room', pos: 'center', range: 'all', view: 'mel', sel: null, piece: null, solo: 'all',
  shown: null, shownLabel: '', perfNow: null, diag: null, ptr: null, raf: 0, onEnd: null, playing: false,
  lab: {pitch: 100, rhythm: 100, tone: 100, expr: 0, cohesion: 100, fam: 100}, labPreset: 1, refreshT: 0,
  tab: 'week', tabScroll: {},
  lineup: false, draft: null, pred: null, predKey: '', predT: 0,
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
  const W = Math.max(240, cv.parentElement.clientWidth - (cv.id === 'tuner' ? 12 : 0));
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
const nowLabel = () => `いまの音（${S.phase === 'choose' ? '選曲前' : wkLabel(S.week)}・${VENUE[U.venue].name}）`;
const busy = () => !!(S.pending && !S.pending.revealed);
function saveUI(){ try{ localStorage.setItem(UI_KEY, JSON.stringify({venue: U.venue, pos: U.pos, snd: SAMPLES.use ? 'rec' : 'synth'})); }catch(e){} }
function loadUI(){ try{ const x = JSON.parse(localStorage.getItem(UI_KEY) || 'null'); if(x){ if(VENUE[x.venue]) U.venue = x.venue; if(POSITION[x.pos]) U.pos = x.pos; if(x.snd === 'synth') SAMPLES.use = false; } }catch(e){} }
// 録音音源の読み込み状況
function renderSnd(){
  document.querySelectorAll('#sndSel [data-snd]').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.snd === 'rec') === SAMPLES.use)));
  const st = $('#sndStatus');
  if(!SAMPLES.use) st.textContent = '';
  else if(SAMPLES.error) st.textContent = '録音を読み込めなかったので、合成音で鳴らします';
  else if(!SAMPLES.ready) st.textContent = `読み込み中 ${Math.round(SAMPLES.progress * 100)}%（それまでは合成音）`;
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
const TABS = ['week', 'play', 'members', 'log', 'lab'];
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
  $('#btnStop').disabled = false;
  setNowPlaying();
  cancelAnimationFrame(U.raf);
  const tick = () => {
    if(!E.pb) return;
    const t = E.now();
    if(!tabHidden('play')){ drawStage(t); drawRoll(U.shown, t); drawTuner(tunerPair(U.shown, t)); }
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
  $('#btnStop').disabled = true;
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
// 席ごとに音を並べておく（ラボや昔の録音でも、座っていた席が光るように）
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
function drawStage(t = -1){
  const cv = $('#stage');
  const G = stageGeom(Math.max(240, cv.parentElement.clientWidth));
  const {g, W, H} = fitCanvas(cv, G.H);
  const C = tok();
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

  const viewSec = U.view !== 'mel' ? U.view : null;
  const sel = U.sel && memberById(U.sel);
  for(const s of SEATS){
    const [x, y] = seatXY(s, G);
    const m = S.members.find(mm => mm.seat === s.id);
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
function seatAt(ev){
  const cv = $('#stage'), rect = cv.getBoundingClientRect();
  const G = stageGeom(rect.width);
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
  perf.bars.forEach((s, i) => {
    const x = Math.round(X(s)) + .5;
    g.strokeStyle = C.rule;
    g.beginPath(); g.moveTo(x, MA.y - 6); g.lineTo(x, DY.y + DY.h); g.stroke();
    if(i < perf.bars.length - 1){ g.fillStyle = C.soft; g.textAlign = 'left'; g.fillText(String(Math.round(perf.from / 4) + i + 1), x + 3, MA.y - 11); }
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
      g.fillText(`${sp.name} 譜読み${Math.round(v)}`, x0 + 4, MA.y + 8);
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

/* ===== チューナー ===== */
function centsAt(n, x){
  if(n.crack && x < n.crackDur + 0.02) return n.cents + n.crack;
  const x0 = n.crack ? n.crackDur + 0.02 : 0;
  const from = n.cents + (n.crack ? n.scoop * 0.4 : n.scoop);
  const xs = x0 + n.settle;
  let v = x < xs ? from + (n.cents - from) * (x - x0) / n.settle : n.cents;
  if(Math.abs(n.sag) > 3 && n.d > 0.5){ if(x > n.d * 0.85) v = n.cents + n.sag; else if(x > n.d * 0.6) v = n.cents + n.sag * 0.45; }
  if(n.vib > 0.5 && n.d > 0.6){ const on = Math.min(0.35, n.d * 0.3); if(x > on) v += n.vib * Math.min(1, (x - on) / 0.4) * Math.sin(2 * Math.PI * 5.2 * x); }
  return v;
}
function tunerPair(perf, t){
  if(!perf || t < 0) return null;
  const act = viewNotes(perf).filter(n => t >= n.t && t < n.t + n.d);
  if(!act.length) return null;
  const groups = {};
  for(const n of act) (groups[n.midi] ||= []).push(n);
  const best = Object.values(groups).sort((a, b) => b.length - a.length)[0];
  const n1 = best[0], n2 = best.find(n => n.mid !== n1.mid);
  return {n1, n2, c1: centsAt(n1, t - n1.t), c2: n2 ? centsAt(n2, t - n2.t) : null};
}
function drawTuner(a){
  const {g, W, H} = fitCanvas($('#tuner'), 124);
  const C = tok();
  const cx = W / 2, cy = H - 10, R = Math.min(W / 2 - 34, H - 30);
  const ang = c => (-90 + clamp(c, -50, 50) * 0.9) * Math.PI / 180;
  for(let c = -50; c <= 50; c += 5){
    const a = ang(c), r0 = R - (c % 10 === 0 ? 12 : 6);
    g.strokeStyle = c === 0 ? C.lcdInk : C.lcdDim; g.lineWidth = c === 0 ? 2 : 1.2;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke();
  }
  g.fillStyle = C.lcdDim; g.font = `11px ${C.fLcd}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for(const c of [-50, 50]){ const a = ang(c); g.fillText(c > 0 ? '+50' : '-50', cx + Math.cos(a) * (R + 14), cy + Math.sin(a) * (R + 14) + 4); }
  g.fillText('0', cx, cy - R - 10);
  const needle = (c, width, len, alpha) => {
    const a = ang(c ?? 0);
    g.globalAlpha = c == null ? 0.25 : alpha;
    g.strokeStyle = C.lcdInk; g.lineWidth = width; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len); g.stroke();
    g.globalAlpha = 1;
  };
  needle(a?.c2, 1.5, R * 0.86, 0.75);
  needle(a?.c1, 3, R - 2, 1);
  g.fillStyle = C.lcdInk; g.beginPath(); g.arc(cx, cy, 4, 0, Math.PI * 2); g.fill();
  const midi = a?.n1?.midi;
  g.textAlign = 'left';
  g.font = `30px ${C.fLcd}`; g.fillStyle = a ? C.lcdInk : C.lcdDim;
  g.fillText(midi != null ? NAME_DE[midi % 12] : 'B', 10, 26);
  g.font = `11px ${C.fLcd}`; g.fillText('A4=442Hz', 10, 50);
  const fmt = c => c == null ? '  --' : `${c >= 0 ? '+' : '-'}${String(Math.round(Math.abs(c))).padStart(3, ' ')}`;
  const who = n => n ? (memberById(n.mid)?.name.split(' ')[0] || INST[n.inst].short) : '';
  g.textAlign = 'right'; g.font = `14px ${C.fLcd}`; g.fillStyle = C.lcdInk;
  g.fillText(`${fmt(a?.c1)}c`, W - 10, 18);
  g.fillText(`${fmt(a?.c2)}c`, W - 10, 36);
  g.font = `500 11px ${C.fBody}`;
  g.fillText(a ? `${who(a.n1)}${a.n2 ? '・' + who(a.n2) : ''}` : '', W - 64, 27);
  let beat = '';
  if(a?.n1 && a?.n2){
    const f = mtof(a.n1.midi);
    const hz = Math.abs(f * Math.pow(2, a.c1 / 1200) - f * Math.pow(2, a.c2 / 1200));
    beat = hz < 0.8 ? 'うなり ほぼなし' : `うなり ${hz.toFixed(1)}回/秒`;
  }
  g.font = `500 12px ${C.fBody}`;
  g.fillText(beat, W - 10, 56);
}
function drawIdle(){
  if(U.playing) return;
  drawStage(-1);
  drawRoll(U.shown, -1);
  drawTuner(null);
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
  if(S.phase === 'choose'){ $('#weekNow').textContent = `${S.year}年 4月・選曲会議`; $('#weeksLeft').textContent = '県大会まで16週'; return; }
  if(S.phase === 'end'){ $('#weekNow').textContent = `${S.year}年度の本番がすべて終わった`; $('#weeksLeft').textContent = ''; return; }
  $('#weekNow').textContent = wkLabel(S.week);
  let nx = null;
  for(let w = S.week; w <= last; w++){ const ev = eventAt(S, w); if(ev && (ev.kind === 'concert' || ev.kind === 'contest')){ nx = [w, ev]; break; } }
  $('#weeksLeft').textContent = nx ? (nx[0] === S.week ? `今週は本番：${nx[1].title}` : `次の本番「${nx[1].title}」まで${nx[0] - S.week}週`) : '';
}
function renderPiece(){
  const pid = playPiece(), pc = PIECES[pid];
  $('#pieceEyebrow').textContent = S.phase === 'choose' ? '試しに聴く曲' : pid === S.pieceId ? (S.finalWeek ? '定期演奏会の曲' : '自由曲') : 'もう1曲（初見で吹いてみる）';
  $('#piece').textContent = pc.full;
  $('#pieceMeta').textContent = `${pc.composer}｜${pc.key}｜${tempoLabel(pc, S.interp.tempo)}｜問われる力：${pc.asks}`;
  $('#pieceSel').innerHTML = PIECE_IDS.map(id => `<button type="button" data-piece="${id}" aria-pressed="${id === pid}">${PIECES[id].title}</button>`).join('');
  const rd = pid === S.pieceId && S.phase !== 'choose' ? spanReadAvg(S, pid) : null;
  $('#rangeSel').innerHTML = `<option value="all">全部</option>` + pc.spans.map((sp, i) => `<option value="${i}">${sp.name}${rd ? `（譜読み${Math.round(rd[i])}）` : ''}</option>`).join('');
  $('#rangeSel').value = U.range;
}
function renderVenues(){
  $('#venueSel').innerHTML = VENUES.map(v => `<button type="button" data-venue="${v.id}" aria-pressed="${v.id === U.venue}">${v.name}</button>`).join('');
  const v = VENUE[U.venue];
  $('#venueDesc').innerHTML = `<b>${v.name}</b>（${v.size}・${v.rt < 0.2 ? '響きはほとんどない' : `残響 約${v.rt.toFixed(1)}秒`}）${v.desc}`;
  $('#posSel').innerHTML = POSITIONS.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  $('#posSel').value = U.pos;
}
function renderSelectors(){
  const recs = S.recs.slice().reverse();
  $('#recSel').innerHTML = recs.length ? recs.map(r => `<option value="${r.id}">${esc(r.label)}（${VENUE[r.venue].name}）</option>`).join('') : '<option value="">録音はまだない</option>';
  $('#btnRec').disabled = !recs.length;
  $('#btnSave').disabled = !recs.length;
  const sel = U.sel && memberById(U.sel);
  $('#soloSel').innerHTML = `<option value="all">全員</option>` + SECTIONS.map(s => `<option value="sec:${s.id}">${s.name}だけ</option>`).join('')
    + (sel ? `<option value="member:${sel.id}">${esc(sel.name)}だけ</option>` : '');
  if(![...$('#soloSel').options].some(o => o.value === U.solo)) U.solo = 'all';
  $('#soloSel').value = U.solo;
  $('#viewSel').innerHTML = `<option value="mel">旋律（メロディを吹いている全員）</option>` + SECTIONS.map(s => `<option value="${s.id}">${s.name}パート</option>`).join('');
  $('#viewSel').value = U.view;
  $('#viewTitle').textContent = U.view === 'mel' ? '旋律を吹いている部員の音' : `${SEC[U.view].name}パートの音`;
}
function applySolo(){
  const [type, id] = U.solo.split(':');
  E.setSolo(type === 'all' ? {type: 'all'} : {type: type === 'sec' ? 'sec' : 'member', id});
}

/* ===== ホワイトボード ===== */
function statRow(name, v, desc, delta, cls){
  return `<div class="stat"><span class="nm">${name}</span><span class="track"><span class="fill${cls ? ' ' + cls : ''}" style="width:${clamp(v, 0, 100)}%"></span></span><span class="val">${Math.round(v)}</span><span class="ds">${desc}${delta ? `<span class="delta">+${delta}</span>` : ''}</span></div>`;
}
function renderStats(){
  const ms = seated(S);
  $('#memberCount').textContent = `${S.members.length}人${S.members.length > ms.length ? `（控え${S.members.length - ms.length}人）` : ''}／${SEATS.length}席`;
  const d = S.lastDelta || {};
  const pid = S.pieceId || playPiece();
  $('#stats').innerHTML = STAT_KEYS.map(k => statRow(STAT_LABEL[k], bandAvg(S, k), STAT_DESC[k], d[k] > 0 ? d[k].toFixed(1) : '')).join('')
    + statRow('まとまり', S.cohesion, '互いを聴き合う力。合奏に出る人が多いほど育つ', d.coh > 0 ? d.coh.toFixed(1) : '')
    + statRow('仕上がり', S.fam[pid] ?? 0, `${PIECES[pid].title}の合奏での曲づくり。低いとテンポの揺れがそろわない`, d.fam > 0 ? d.fam.toFixed(1) : '')
    + statRow('譜読み', readAvg(S, pid), `一人ひとりが${PIECES[pid].title}の自分の楽譜をどれだけ吹けるか（平均）。低いと音を間違え、歌いきれず、出だしが揺れる`, d.read > 0 ? d.read.toFixed(1) : '');
  const vital = (nm, v) => {
    const c = v >= 60 ? 'good' : v >= 30 ? 'warn' : 'bad';
    return `<div class="vital"><span class="row"><span>${nm}</span><b>${Math.round(v)}</b></span><span class="track"><span class="fill ${c}" style="width:${clamp(v, 0, 100)}%"></span></span></div>`;
  };
  const nx = nextRepStep(S);
  $('#vitals').innerHTML = vital('体力', S.stamina) + vital('やる気', S.morale) + vital('会場慣れ', S.hallExp)
    + `<div class="vital rep"><span class="row"><span>評判</span><b>${Math.round(S.rep ?? 0)}</b></span><span class="track"><span class="fill" style="width:${clamp(S.rep ?? 0, 0, 100)}%"></span></span><small>${nx ? `${nx}をこえると、入部したい生徒が来る` : '県内に知られた部'}</small></div>`;
}
function renderDiag(){
  const a = U.diag;
  $('#diagVenue').textContent = `${VENUE[U.venue].name}・${PIECES[playPiece()].title}`;
  if(!a){ $('#diag').innerHTML = ''; return; }
  const desc = {
    pitch: `平均のずれ ${a.pitchDev.toFixed(1)}セント・ユニゾンのばらつき ${a.spread.toFixed(1)}`,
    rhythm: `出だしのずれ 平均${Math.round(a.rhythmMs)}ミリ秒・テンポの流れ ${(a.drift * 100).toFixed(1)}%`,
    tone: `音の裏返り ${a.cracks}回`,
    expr: '強弱とテンポの揺れが、指揮者の解釈どおりに出ているか',
    balance: `旋律と伴奏の音量差 ${a.balanceDb >= 0 ? '+' : ''}${a.balanceDb.toFixed(1)}dB`,
  };
  $('#diag').innerHTML = Object.keys(DIM_LABEL).map(k => {
    const v = a.score[k], c = v >= 70 ? 'good' : v >= 45 ? 'warn' : 'bad';
    return statRow(DIM_LABEL[k], v, desc[k], '', c);
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
    head.textContent = S.phase === 'choose' ? (foundingYear(S) && !S.members.length ? '最初の部員' : '新しい部員') : `${wkLabel(S.week)}`;
    return renderAssign(w, ev);
  }
  if(S.phase === 'choose'){
    head.textContent = '選曲会議';
    w.innerHTML = `<p class="small">コンクールの自由曲を決めよう。試しに聴くと、まだ譜読みをしていない状態の音が聞ける。</p>`
      + PIECE_IDS.map(id => { const pc = PIECES[id]; return `<div class="pcard"><h3>${pc.full}</h3><p>${pc.composer}｜${pc.key}｜問われる力：${pc.asks}</p><p>${pc.desc}</p><div class="row"><button class="btn small" type="button" data-act="preview" data-pid="${id}">▶ 試しに聴く</button><button class="btn small primary" type="button" data-act="choose" data-pid="${id}">この曲に決める</button></div></div>`; }).join('');
    return;
  }
  if(S.phase === 'end'){
    head.textContent = `${S.year}年度のおわり`;
    const nm = {gold: '金賞', silver: '銀賞', bronze: '銅賞'};
    const res = S.season.map(r => `<li>${LEVELS[r.level].name}　${nm[r.award]}${r.rep ? '・代表' : ''}（平均${r.avg}点）</li>`).join('');
    const seniors = S.members.filter(m => m.grade === 3);
    const april = S.recs.find(r => r.year === S.year && r.keep && r.week === 0);
    const lastStage = S.recs.slice().reverse().find(r => r.year === S.year && r.final) || S.recs.slice().reverse().find(r => r.year === S.year && r.result);
    w.innerHTML = `<div class="stagecard"><h3>${seniors.length ? '3年生が引退します' : 'この1年をふり返る'}</h3><ol class="small" style="padding-left:1.2em">${res}</ol>
      <p class="txt">${seniors.length ? `${seniors.map(m => esc(m.name)).join('、')}（${seniors.length}人）が引退する。` : `部員は${S.members.length}人になった。引退する3年生はまだいない。`}4月の録音と最後の本番を聴き比べてみよう。</p>
      <div class="transport">${april ? `<button class="btn small" type="button" data-act="playrec" data-id="${april.id}">▶ 4月の録音</button>` : ''}${lastStage ? `<button class="btn small" type="button" data-act="playrec" data-id="${lastStage.id}">▶ 最後の本番</button><button class="btn small" type="button" data-act="saverec" data-id="${lastStage.id}">⤓ 最後の本番を保存</button>` : ''}</div></div>
      ${firstClassEpilogue(seniors)}
      ${seniors.length ? `<div class="seniors"><h3>引退する3年生</h3><p class="small">名前をタップすると、入部したころと最後の本番を、その人の音だけで聴き比べられる。</p>${seniors.map(m => seniorCard(m, lastStage)).join('')}</div>` : ''}
      <div class="transport"><button class="btn primary" type="button" data-act="newyear">次の年度へ</button></div>`;
    return;
  }
  head.textContent = `${wkLabel(S.week)}`;
  if(S.pending) return renderStageResult(w, ev);
  // オーディション：その週に入ったら、メンバーを決めるまで先へ進めない（コンクールの前に見直すこともできる）
  if(U.lineup || (ev?.kind === 'audition' && S.audition?.y === S.year && !S.audition.decided)) return renderAudition(w, ev);
  if(ev && (ev.kind === 'concert' || ev.kind === 'contest')){
    const n = nervesFor(S, ev), v = VENUE[ev.venue];
    w.innerHTML = `<div class="stagecard"><span class="tag">${ev.kind === 'contest' ? 'コンクール' : '本番'}</span><h3>${ev.title}</h3>
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
      + PIECE_IDS.map(id => { const pc = PIECES[id]; return `<div class="pcard"><h3>${pc.full}</h3><p>${id === S.contestPiece ? 'コンクールで演奏した曲・' : ''}仕上がり ${fam(id)}・譜読み ${Math.round(readAvg(S, id))}｜問われる力：${pc.asks}</p><div class="row"><button class="btn small" type="button" data-act="preview" data-pid="${id}">▶ 試しに聴く</button><button class="btn small primary" type="button" data-act="choosefinal" data-pid="${id}">この曲にする</button></div></div>`; }).join('');
    return;
  }
  const parts = [];
  if(ev) parts.push(`<div class="event"><span class="tag">${ev.title}</span><span>${ev.text}</span></div>`);
  // 部員のできごと：対応を選ぶまで、今週の練習は決められない
  const epv = episodeView(S);
  if(epv){
    const who = [epv.m, epv.o].filter(Boolean).map(x => `${x.grade}年・${esc(instOf(x))}・${esc(x.name)}`).join('　');
    parts.push(`<div class="episode"><div class="head"><span class="tag">できごと</span><span class="who">${who}</span></div><p class="txt">${esc(epv.text)}</p>
      <p class="small">顧問として、どうする？</p><div class="choices">${epv.choices.map(c => `<button class="mbtn" type="button" data-ep="${c.k}"><b>${esc(c.label)}</b></button>`).join('')}</div></div>`);
    w.innerHTML = parts.join('');
    return;
  }
  if(S.lastEpisode) parts.push(`<p class="epres"><b>${esc(S.lastEpisode.choice)}</b>${esc(S.lastEpisode.result)}</p>`);
  parts.push(planHtml(ev));
  if(!tuneDone(S)) parts.push(`<div class="tgrow"><button class="btn small" type="button" data-act="tunegame">♪ 耳でチューニング</button><span class="small">部員の音とチューナーの音のうなりを聴いて合わせる（週に1回・合わせた部員の音程が上がる）</span></div>`);
  w.innerHTML = parts.join('');
}
// 新しく入った部員の担当を決める（部をつくった最初の5人・本入部の1年生・途中から入ってきた部員）
function renderAssign(w, ev){
  const map = autoAssign(S);
  const free = SEATS.map(x => x.id).filter(id => !S.members.some(m => m.seat === id));
  const first = foundingYear(S) && !S.members.length;
  const intro = first ? `部員がいなくなって休部していた吹奏楽部に、1年生が${S.recruits.length}人入部してきた。担当する楽器を決めよう。希望どおりだとやる気が上がる。人数が少ないうちは、いる人で旋律・低音・和音を分けて吹く。`
    : ev?.kind === 'assign' ? ev.text : '新しく入部してきた部員の担当を決めよう。希望どおりだとやる気が上がる。';
  w.innerHTML = `<div class="event"><span class="tag">${first ? '入部' : ev?.kind === 'assign' ? ev.title : '入部'}</span><span>${intro}</span></div>
    <div class="assign">${S.recruits.map(r => `<div class="row"><span class="who">${esc(r.name)}<small>${(r.grade || 1)}年・希望：${INST[r.hope].name}${r.exp ? '・中学で経験あり' : '・初心者'}${r.trait ? '・' + TRAITS[r.trait].name : ''}</small></span>
      <select id="as-${r.id}" aria-label="${esc(r.name)}の担当"><option value="">控え（席なし）</option>${free.map(id => `<option value="${id}"${map[r.id] === id ? ' selected' : ''}>${PART_LABEL[SEAT[id].part]}</option>`).join('')}</select></div>`).join('')}</div>
    <p class="small" id="assignErr"></p>
    <button class="btn primary" type="button" data-act="assign">この担当で決める</button>`;
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
    <p class="small">点は、自由曲で問われる力（${PIECES[S.pieceId].asks}）と、その日の緊張で決まる。メンタルの弱い部員は、緊張で崩れることもある。チェックを外した部員は控えになり、コンクールの舞台には上がらない（練習はいつもどおり。秋からはまた全員で吹く）。</p>
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
  const {ev} = nextContest(S), L = LEVELS[ev.level];
  const key = S.year + ':' + S.week + ':' + [...out].sort().join(',');
  const show = p => {
    const nm = {gold: '金賞', silver: '銀賞', bronze: '銅賞'}[p.award];
    el.innerHTML = `<b>${n}人で出ると、${L.name}で審査員平均 ${p.avg.toFixed(1)}点（${nm}）くらい</b><span class="small">金賞の目安は${L.gold}点、${L.rep ? `代表は3人ともA（${L.A}点）。` : ''}${p.thin >= 6 ? '人数が少ないぶん、響きが薄いと見られる。' : ''}本番の日の調子で、上下する。</span>`;
  };
  if(U.predKey === key && U.pred){ show(U.pred); return; }
  el.innerHTML = `<b>${n}人で出ると……</b><span class="small">計算中</span>`;
  clearTimeout(U.predT);
  U.predT = setTimeout(() => { U.pred = predictContest(S, out); U.predKey = key; if($('#audPred')) show(U.pred); }, soon ? 30 : 120);
}
// 今週の練習：部員ひとりずつに、方針と今週の指示
const menuLabel = (id, cm = 1) => { const m = MENU_BY[id]; return `${m.name}：${m.hint.replace(/　/g, ' ')}（体力${m.cost > 0 ? '−' + Math.round(m.cost * cm) : '+' + (-m.cost)}）`; };
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
  const cm = ev?.costMult || 1;
  const menus = MENU.filter(m => menuOpen(S, m.id));
  const order = m => m.seat ? SEATS.findIndex(x => x.id === m.seat) : 999;
  const ms = S.members.slice().sort((a, b) => order(a) - order(b));
  const count = {};
  for(const m of ms){ const id = planFor(S, m); count[id] = (count[id] || 0) + 1; }
  const tired = ms.filter(m => m.sta < 30).length;
  const allPol = ms.length && ms.every(m => (m.policy || 'auto') === (ms[0].policy || 'auto')) ? (ms[0].policy || 'auto') : null;
  let sec = null;
  const rows = ms.map(m => {
    const s = m.seat ? SEAT[m.seat].sec : 'bench';
    const head = s !== sec ? `<li class="psec">${s === 'bench' ? '控え' : SEC[s].name}</li>` : '';
    sec = s;
    const auto = decideMenu(S, m), own = S.plan?.[m.id] && menuOpen(S, S.plan[m.id]) ? S.plan[m.id] : '';
    const c = m.sta >= 60 ? 'good' : m.sta >= 30 ? 'warn' : 'bad';
    return `${head}<li class="pm${own ? ' own' : ''}"><span class="who"><b>${esc(m.name)}</b><small>${m.grade}年・${m.seat ? esc(PART_LABEL[SEAT[m.seat].part]) : '控え'}${m.out && m.seat ? '・コンクール控え' : ''}${S.pieceId ? `・譜読み${Math.round(readMean(m, S.pieceId))}` : ''}</small></span>
      <span class="sta" title="体力 ${Math.round(m.sta)}"><span class="track"><span class="fill ${c}" style="width:${clamp(m.sta, 0, 100)}%"></span></span><b>${Math.round(m.sta)}</b></span>
      <label class="pol"><span>方針</span><select data-pol="${m.id}" aria-label="${esc(m.name)}の方針">${POLICIES.map(p => `<option value="${p.id}"${(m.policy || 'auto') === p.id ? ' selected' : ''}>${p.name}</option>`).join('')}</select></label>
      <label class="pw"><span>今週</span><select data-plan="${m.id}" aria-label="${esc(m.name)}の今週の練習"><option value="">方針どおり（${MENU_BY[auto].name}）</option>${menus.map(x => `<option value="${x.id}"${own === x.id ? ' selected' : ''}>${menuLabel(x.id, cm)}</option>`).join('')}</select></label>${(own || auto) === 'piece' && S.pieceId ? spanSelect(m) : ''}
      ${m.last ? `<small class="last">${esc(lastText(m))}</small>` : ''}</li>`;
  }).join('');
  const sum = MENU.filter(m => count[m.id]).map(m => `${m.name} ${count[m.id]}人`).join('・');
  const tutti = (count.tutti || 0) + (count.hall || 0);
  return `<div class="plan">
    <p class="small">部員ひとりずつに今週の練習を指示する。「方針どおり」のままにすると、その人の方針で自分の練習を決める。合奏は出た人が多いほど、部のまとまりと曲の仕上がりが伸びる。</p>
    <div class="focus"><span>全員の方針をまとめて変える</span><div class="chips">${POLICIES.map(p => `<button class="chip" type="button" data-polall="${p.id}" aria-pressed="${allPol === p.id}" title="${esc(p.desc)}">${p.name}</button>`).join('')}</div>
    <span class="small">${allPol ? `${POLICY_BY[allPol].name}：${POLICY_BY[allPol].desc}` : '方針は部員ごとにちがう。'}</span></div>
    <ul class="plist">${rows}</ul>
    ${S.pieceId && !S.finalWeek && S.week >= 8 && nextContest(S).w > S.week ? lineupLine() : ''}
    <p class="small plan-sum">今週の予定：${sum}${tutti === 1 ? '（合奏は2人以上いないとできない）' : ''}</p>
    ${tired ? `<p class="small">体力が30を切っている部員が${tired}人。休ませないと、練習の効果が半分になる。</p>` : ''}
    <button class="btn primary" type="button" data-act="practice">この内容で1週間すすめる</button>
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
  return `・あなたの指揮 ${pc ? beatName(pc) : '♩'}=${p.conducted.bpm}、安定度${p.conducted.stab}%`;
};
function renderStageResult(w, ev){
  const p = S.pending;
  if(!p.revealed){
    w.innerHTML = `<div class="stagecard"><span class="tag">${ev.kind === 'contest' ? 'コンクール' : '本番'}</span><h3>${ev.title}</h3><p class="txt">ステージで演奏中…</p><button class="btn" type="button" data-act="reveal">結果を見る</button></div>`;
    return;
  }
  if(p.kind === 'concert'){
    w.innerHTML = `<div class="stagecard"><span class="tag">本番</span><h3>${ev.title}</h3><p class="small">演奏の出来 ${Math.round(p.q)}点（緊張 −${p.nerves}）${conductNote(p)}</p>${mentalNote(p)}<p class="txt">${esc(p.text)}</p>
      <div class="transport"><button class="btn small" type="button" data-act="playrec" data-id="${p.recId}">▶ もう一度聴く</button><button class="btn small" type="button" data-act="saverec" data-id="${p.recId}">⤓ 保存</button><button class="btn primary" type="button" data-act="next">${ev.final ? (hasSeniors(S) ? '3年生の引退へ' : '1年のふり返りへ') : '次の週へ'}</button></div></div>`;
    return;
  }
  const j = p.judge, L = LEVELS[j.level];
  const nm = {gold: '金賞', silver: '銀賞', bronze: '銅賞'}[j.award];
  const headTxt = j.rep ? `${L.rep}への代表に選ばれた！` : j.award === 'gold' && L.rep ? '金賞。でも代表には届かなかった（ダメ金）。' : j.award === 'gold' ? '全国大会で金賞。' : j.award === 'silver' ? '銀賞。手応えはあった。' : '銅賞。来年こそ。';
  w.innerHTML = `<div class="result" style="--award:var(--${j.award})">
    <div class="award"><span class="stamp">${nm}</span><div><b>${headTxt}</b><p class="small">${L.name}・審査員平均 ${j.avg.toFixed(1)}点・緊張 −${p.nerves}${conductNote(p)}</p>${mentalNote(p)}</div></div>
    <ol class="judges">${j.judges.map(x => `<li><span class="grade">${x.grade}</span><p class="cmt"><small>${esc(x.name)}・${x.score}点</small>${esc(x.comment)}</p></li>`).join('')}</ol>
    <div class="transport"><button class="btn small" type="button" data-act="playrec" data-id="${p.recId}">▶ 本番の録音</button><button class="btn small" type="button" data-act="saverec" data-id="${p.recId}">⤓ 保存</button><button class="btn primary" type="button" data-act="next">${j.rep ? '次の大会に向けて練習を続ける' : 'シーズンを終える'}</button></div></div>`;
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
  $('#hist').innerHTML = years.length ? years.map(h => {
    const best = h.results[h.results.length - 1];
    return `<details class="hyear"><summary><b>${h.year}</b><span class="pc">${esc(h.piece || '—')}</span><span class="aw ${best?.award || ''}">${best ? resultText([best]) : ''}</span></summary>
      <div class="body">
        <p>コンクール：${h.results.length ? resultText(h.results) : '出場なし'}</p>
        ${h.final ? `<p>定期演奏会：${esc(h.final.piece)}（演奏の出来 ${h.final.q}点）</p>` : ''}
        ${h.retired?.length ? `<p>引退した3年生${h.firstClass ? '（顧問になって最初の代）' : ''}：${h.retired.map(esc).join('、')}</p>` : ''}
        <div class="transport">${recBtns(h.year)}</div>
      </div></details>`;
  }).join('') : '';
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
function renderMemberCard(){
  const card = $('#memberCard');
  const m = U.sel && memberById(U.sel);
  if(!m){ card.hidden = true; return; }
  card.hidden = false;
  const seat = m.seat && SEAT[m.seat];
  const tr = m.trait && TRAITS[m.trait];
  const seats = SEATS.filter(s => s.id !== m.seat).map(s => {
    const o = S.members.find(x => x.seat === s.id);
    return `<option value="${s.id}">${PART_LABEL[s.part]}${o ? `（${esc(o.name)}と交代）` : '（空席）'}</option>`;
  }).join('');
  card.innerHTML = `<div class="mc-head"><h3>${esc(m.name)}</h3>${m.title ? `<span class="tag">${m.title}</span>` : ''}<span class="sub">${m.grade}年・${seat ? PART_LABEL[seat.part] : '控え（席なし）'}</span></div>
    ${tr ? `<p class="mc-trait">癖：${tr.name}。${tr.desc}</p>` : '<p class="mc-trait">目立った癖はない。</p>'}
    <div class="stats">${STAT_KEYS.map(k => statRow(STAT_LABEL[k], m.stats[k], STAT_DESC[k], '')).join('')}${S.pieceId ? `<p class="mc-sub">譜読み（${PIECES[S.pieceId].title}）：自分の楽譜を区間ごとにどれだけ吹けるか。曲の個人練習でいちばん伸びる</p>`
      + readUnits(S.pieceId).map(u => statRow(spanShort(u), readOf(m, S.pieceId)[u.i], u.name !== spanShort(u) ? u.name : '', '')).join('') : ''}${m.mental != null ? statRow('本番の強さ', m.mental, '本番で実力を出しきれるか。弱いと日によって大きくぶれる。場数を踏むと強くなる', '', 'warn') : ''}</div>
    ${memberStory(m)}
    <div class="mc-actions">
      ${seat ? `<button class="btn small" type="button" data-mact="solo">この人だけ聴く</button><button class="btn small" type="button" data-mact="secsolo">パートだけ聴く</button>` : ''}
      <button class="btn small quiet" type="button" data-mact="all">全員で聴く</button>
    </div>
    <div class="mc-actions"><label class="small" for="moveSel">席を移す</label><select id="moveSel"><option value="">控え（席なし）</option>${seats}</select><button class="btn small" type="button" data-mact="move"${busy() ? ' disabled' : ''}>移す</button></div>
    <p class="small">楽器が変わると、その楽器での音程と音色は基礎からやり直しになる。</p>`;
}
function renderRoster(){
  $('#secGrid').innerHTML = SECTIONS.map(s => {
    const ms = secMembers(S, s.id), seats = SEATS.filter(x => x.sec === s.id).length;
    const av = k => ms.length ? ms.reduce((a, m) => a + m.stats[k], 0) / ms.length : 0;
    return `<button class="sec-tile" type="button" data-sec="${s.id}" aria-pressed="${U.view === s.id}"><b>${s.name}</b>
      <span class="bars">${STAT_KEYS.map(k => `<i title="${STAT_LABEL[k]} ${Math.round(av(k))}"><span style="height:${av(k)}%"></span></i>`).join('')}</span>
      <small>${ms.length}/${seats}人・音程 リズム 音色 表現</small></button>`;
  }).join('');
  const rows = [];
  for(const sec of SECTIONS){
    rows.push(`<tr class="sec-row"><td colspan="8">${sec.name}</td></tr>`);
    for(const s of SEATS.filter(x => x.sec === sec.id)){
      const m = S.members.find(x => x.seat === s.id);
      if(!m){ rows.push(`<tr class="empty"><td>空席</td><td></td><td>${PART_LABEL[s.part]}</td><td colspan="5"></td></tr>`); continue; }
      rows.push(memberRow(m, PART_LABEL[s.part]));
    }
  }
  const bench = S.members.filter(m => !m.seat);
  if(bench.length){
    rows.push(`<tr class="sec-row"><td colspan="8">控え</td></tr>`);
    for(const m of bench) rows.push(memberRow(m, '席なし'));
  }
  $('#rosterTable').innerHTML = `<thead><tr><th>名前</th><th>学年</th><th>担当</th><th>音程</th><th>リズム</th><th>音色</th><th>表現</th><th>癖</th></tr></thead><tbody>${rows.join('')}</tbody>`;
}
function memberRow(m, part){
  const C = tok();
  return `<tr class="mem${U.sel === m.id ? ' sel' : ''}" data-mid="${m.id}"><td>${esc(m.name)}${m.title ? ` <span class="tag">${m.title}</span>` : ''}</td><td>${m.grade}年</td><td>${part}${m.out && m.seat ? '<small>（コンクール控え）</small>' : ''}</td>`
    + STAT_KEYS.map(k => `<td class="num" style="color:${skillColor(C, m.stats[k])}">${Math.round(m.stats[k])}</td>`).join('')
    + `<td>${m.trait ? TRAITS[m.trait].name : ''}</td></tr>`;
}

/* ===== ラボ ===== */
const LAB_PRESETS = [
  {name: '入部直後', st: {pitch: 12, rhythm: 18, tone: 10, expr: 4, cohesion: 15, fam: 10}},
  {name: '正確だけど棒読み', st: {pitch: 100, rhythm: 100, tone: 100, expr: 0, cohesion: 100, fam: 100}},
  {name: '気持ちだけ先走り', st: {pitch: 25, rhythm: 30, tone: 35, expr: 90, cohesion: 40, fam: 70}},
  {name: '金管だけうまい', st: {pitch: 25, rhythm: 30, tone: 25, expr: 30, cohesion: 60, fam: 80}, special: s => ['tp', 'hn', 'tb', 'low'].includes(s.sec) && s.inst !== 'cb' ? 90 : null},
  {name: '低音が弱い', st: {pitch: 85, rhythm: 85, tone: 85, expr: 80, cohesion: 70, fam: 90}, special: s => s.sec === 'low' ? 15 : null},
  {name: '全国大会レベル', st: {pitch: 100, rhythm: 100, tone: 100, expr: 100, cohesion: 100, fam: 100}},
];
const LAB_KEYS = [['pitch', '音程'], ['rhythm', 'リズム'], ['tone', '音色'], ['expr', '表現'], ['cohesion', 'まとまり'], ['fam', '仕上がり']];
function renderLab(){
  $('#presets').innerHTML = LAB_PRESETS.map((p, i) => `<button class="chip" type="button" data-p="${i}" aria-pressed="${U.labPreset === i}">${p.name}</button>`).join('');
  $('#sliders').innerHTML = LAB_KEYS.map(([k, nm]) => `<div class="sl"><label for="lab-${k}">${nm}<output id="out-${k}" for="lab-${k}">${U.lab[k]}</output></label><input type="range" id="lab-${k}" min="0" max="100" step="1" value="${U.lab[k]}"></div>`).join('');
}
function labPerf(){
  const pid = playPiece(), span = rangeSpan(pid);
  const pre = LAB_PRESETS[U.labPreset];
  const members = fullBand({pitch: U.lab.pitch, rhythm: U.lab.rhythm, tone: U.lab.tone, expr: U.lab.expr});
  if(pre?.special) for(const m of members){ const v = pre.special(SEAT[m.seat]); if(v != null) for(const k of STAT_KEYS) m.stats[k] = v; }
  return perform({members, pieceId: pid, cohesion: U.lab.cohesion, fam: U.lab.fam, interp: S.interp, venue: U.venue, from: span.from, to: span.to, seed: 'band'});
}

/* ===== まとめて描く ===== */
function renderAll(){
  renderHeader(); renderPiece(); renderVenues(); renderSelectors();
  renderStats(); renderWeek(); renderInterp(); renderLog();
  renderMemberCard(); renderRoster(); renderHistory();
  $('#btnNow').disabled = busy();
}

/* ===== 操作 ===== */
function startStage(){
  stopPlay();
  commit(beginStage(S));
  const rec = S.recs.find(r => r.id === S.pending.recId);
  U.piece = null; U.range = 'all';
  setVenue(rec.venue);
  renderAll();
  playPerf(perform(recCtx(rec)), rec.label, natural => natural ? applaudThenReveal() : reveal());
  setTimeout(() => { if(E.ac) applauseBuffer(E.ac); }, 2500);   // 拍手の音は、演奏中に作っておく
}
// 本番を自分で指揮する：結果はいったん部員まかせで決め、指揮しきったら指揮の演奏で採点し直す
function startStageConduct(){
  stopPlay();
  commit(beginStage(S));
  const rec = S.recs.find(r => r.id === S.pending.recId);
  U.piece = null; U.range = 'all';
  setVenue(rec.venue);
  renderAll();
  openConduct({rec, ev: eventAt(S, S.week)});
}
function reveal(){
  if(!S.pending || S.pending.revealed) return;
  S.pending.revealed = true;
  commit(S);
  renderAll();
  const p = S.pending;
  if(p.kind === 'concert') haptic(p.q >= 60 ? 'success' : 'tap');
  // コンクールは、ホールでの結果発表から
  else if(p.judge) showAnnounce(p.judge, p.judge.level, () => setTab('week'));
}
// 本番が鳴り終わったら、客席から拍手（出来がよいほど大きく長い）。少し聴いてから結果へ
const stageHeat = p => p.kind === 'concert' ? clamp01((p.q - 20) / 70) : clamp01((p.judge.avg - 45) / 40);
function applaudThenReveal(){
  if(S.pending && !S.pending.revealed){ E.applaud(stageHeat(S.pending)); setTimeout(reveal, 1800); }
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
  $('#sndSel').addEventListener('click', e => {
    const b = e.target.closest('[data-snd]'); if(!b) return;
    SAMPLES.use = b.dataset.snd === 'rec';
    saveUI(); renderSnd();
  });
  $('#btnLab').addEventListener('click', () => {
    const pre = LAB_PRESETS[U.labPreset];
    playPerf(labPerf(), `ラボ：${pre ? pre.name : `音程${U.lab.pitch}・リズム${U.lab.rhythm}・音色${U.lab.tone}・表現${U.lab.expr}`}（${VENUE[U.venue].name}）`);
  });
  $('#pieceSel').addEventListener('click', e => {
    const b = e.target.closest('[data-piece]'); if(!b) return;
    U.piece = b.dataset.piece === S.pieceId ? null : b.dataset.piece;
    U.range = 'all';
    renderPiece(); renderInterp(); renderStats(); refreshNow();
  });
  $('#venueSel').addEventListener('click', e => { const b = e.target.closest('[data-venue]'); if(b) setVenue(b.dataset.venue); });
  $('#posSel').addEventListener('change', e => { U.pos = e.target.value; saveUI(); E.setPosition(U.pos); });
  $('#rangeSel').addEventListener('change', e => { U.range = e.target.value; refreshNow(); });
  $('#soloSel').addEventListener('change', e => { U.solo = e.target.value; applySolo(); });
  $('#viewSel').addEventListener('change', e => { U.view = e.target.value; renderSelectors(); renderRoster(); drawIdle(); if(U.playing) drawRoll(U.shown, E.now()); });
  $('#stage').addEventListener('click', e => {
    const s = seatAt(e);
    if(!s) return;
    const m = S.members.find(x => x.seat === s.id);
    U.sel = m ? m.id : null;
    U.view = s.sec;
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
    if(tabHidden('play')) setTab('play');
    renderSelectors(); renderMemberCard(); renderRoster(); drawIdle();
    $('#memberCard').scrollIntoView({block: narrow.matches ? 'start' : 'nearest', behavior: 'smooth'});
  });
  $('#memberCard').addEventListener('click', e => {
    const b = e.target.closest('[data-mact]'); if(!b) return;
    const m = memberById(U.sel); if(!m) return;
    const act = b.dataset.mact;
    if(act === 'solo'){ U.solo = `member:${m.id}`; renderSelectors(); applySolo(); if(!U.playing) $('#btnNow').click(); }
    else if(act === 'secsolo'){ U.solo = `sec:${SEAT[m.seat].sec}`; renderSelectors(); applySolo(); if(!U.playing) $('#btnNow').click(); }
    else if(act === 'all'){ U.solo = 'all'; renderSelectors(); applySolo(); }
    else if(act === 'move'){
      commit(moveMember(S, m.id, $('#moveSel').value || null));
      renderAll(); refreshNow();
    }
  });
  $('#week').addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b || b.disabled) return;
    if(b.dataset.polall){ commit(setPolicy(S, '*', b.dataset.polall)); renderWeek(); return; }
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
    const act = b.dataset.act;
    if(act === 'preview'){ U.piece = b.dataset.pid; U.range = 'all'; renderPiece(); renderInterp(); U.perfNow = perform(currentCtx()); U.diag = analyze(U.perfNow); renderDiag(); playPerf(U.perfNow, `試聴：${PIECES[b.dataset.pid].title}${(S.fam[b.dataset.pid] || 0) < 5 ? '（譜読み前）' : ''}`); }
    else if(act === 'choose'){ stopPlay(); commit(choosePiece(S, b.dataset.pid)); U.piece = null; renderAll(); refreshNow(); }
    else if(act === 'tunegame') openTuneGame();
    else if(act === 'calm'){ haptic('tap'); commit(calmMember(S, b.dataset.mid)); renderWeek(); }
    else if(act === 'huddle'){ haptic('tap'); commit(huddle(S)); renderWeek(); }
    else if(act === 'choosefinal'){ stopPlay(); commit(chooseFinalPiece(S, b.dataset.pid)); U.piece = null; renderAll(); refreshNow(); }
    else if(act === 'test'){ commit(practiceWeek(S, 'test')); renderAll(); refreshNow(); }
    else if(act === 'practice'){ if(busy()) return; haptic('tap'); commit(practiceWeek(S)); renderAll(); refreshNow(); }
    else if(act === 'lineupopen'){ if(!S.audition || S.audition.y !== S.year) commit(startAudition(S)); U.lineup = true; U.draft = null; renderWeek(); $('#week').scrollIntoView({block: 'start'}); }
    else if(act === 'lineup'){
      if(seated(S).every(m => U.draft.has(m.id))){ $('#audPred').innerHTML = '<b>だれも出ないことになってしまう。1人以上は選ぼう。</b>'; return; }
      haptic('tap'); commit(setLineup(S, U.draft)); U.lineup = false; U.draft = null; renderAll(); refreshNow();
    }
    else if(act === 'assign'){
      const map = {}, used = new Set();
      for(const r of S.recruits){
        const v = $(`#as-${r.id}`).value || null;
        if(v && used.has(v)){ $('#assignErr').textContent = '同じ席に2人は座れない。担当を選び直そう。'; return; }
        if(v) used.add(v);
        map[r.id] = v;
      }
      commit(assignRecruits(S, map)); renderAll(); refreshNow();
    }
    else if(act === 'stage') startStage();
    else if(act === 'stageconduct') startStageConduct();
    else if(act === 'reveal'){ stopPlay(); reveal(); }
    else if(act === 'next'){ stopPlay(); commit(finishStage(S)); renderAll(); refreshNow(); }
    else if(act === 'newyear'){ stopPlay(); commit(newYear(S)); U.sel = null; U.piece = null; renderAll(); refreshNow(); }
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
    if(t.dataset.pol){ commit(setPolicy(S, t.dataset.pol, t.value)); renderWeek(); }
    else if(t.dataset.plan){ commit(setPlan(S, t.dataset.plan, t.value || null)); renderWeek(); }
    else if(t.dataset.span){ commit(setPlanSpan(S, t.dataset.span, t.value === '' ? null : +t.value)); renderWeek(); }
  });
  $('#interp').addEventListener('click', e => {
    const b = e.target.closest('[data-interp]'); if(!b || b.disabled) return;
    const [k, i] = b.dataset.interp.split(':');
    S.interp[k] = +i; commit(S);
    renderInterp(); renderPiece(); refreshNow();
  });
  $('#presets').addEventListener('click', e => {
    const b = e.target.closest('[data-p]'); if(!b) return;
    U.labPreset = +b.dataset.p;
    U.lab = {...LAB_PRESETS[U.labPreset].st};
    renderLab();
  });
  $('#sliders').addEventListener('input', e => {
    const k = e.target.id.replace('lab-', '');
    if(!(k in U.lab)) return;
    U.lab[k] = +e.target.value;
    $(`#out-${k}`).textContent = U.lab[k];
    U.labPreset = -1;
    document.querySelectorAll('#presets .chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
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
  renderAll(); renderLab();
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
