'use strict';
/* 演出：身についた瞬間（スキル・顧問の指導力・部の節目）のカットイン、月が変わるときの扉、年度のはじまりとおわり、
   練習の結果の数字の数え上げ、本番の入場と幕。どれも画面をたたけばとばせる。
   動きを減らす設定の端末では、動かさずに出すだけにする。効果音は録音を使わず、その場で合成する */
const FX = {q: [], on: false, timer: 0, raf: 0, done: new Set()};
const fxCalm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ----- 効果音 ----- */
// kind：skill（きらっと上がる）・mile（2音）・month（扉の音）・level（ファンファーレ）・year（年度の音）
function sfx(kind){
  if(!E.ensure()) return;
  const ac = E.ac;
  if(ac.state === 'suspended') ac.resume();
  const t0 = ac.currentTime + 0.03, out = ac.createGain();
  out.gain.value = 0.14; out.connect(ac.destination);
  const SEQ = {
    skill: [[84, 0], [88, 0.07], [91, 0.14], [96, 0.22]],
    mile:  [[79, 0], [86, 0.12]],
    month: [[81, 0], [88, 0.18]],
    level: [[67, 0], [72, 0.11], [76, 0.22], [79, 0.33], [84, 0.5]],
    year:  [[72, 0], [76, 0.2], [79, 0.4], [84, 0.6]],
  }[kind] || [];
  const brass = kind === 'level';
  for(const [m, dt] of SEQ){
    const t = t0 + dt, dur = brass ? (dt >= 0.5 ? 1.1 : 0.16) : 1.3;
    // 金管らしい音（のこぎり波を少しこもらせる）か、ベルのような音（倍音を少し）
    for(const [mul, vol, type] of brass ? [[1, 0.5, 'sawtooth'], [2, 0.12, 'sine']] : [[1, 0.55, 'sine'], [2, 0.18, 'sine'], [3, 0.06, 'sine']]){
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = mtof(m) * mul;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + (brass ? 0.03 : 0.006));
      g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
      if(brass){ const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400; o.connect(f); f.connect(g); } else o.connect(g);
      g.connect(out); o.start(t); o.stop(t + dur + 0.05);
    }
  }
  setTimeout(() => { try{ out.disconnect(); }catch(e){} }, 3000);
}

/* ----- 順番に出す（カットインと場面） ----- */
// it：{kind: 'cut'|'scene', html, sound, season, ms}
function fxShow(it){ FX.q.push(it); if(!FX.on) fxNext(); }
function fxNext(){
  clearTimeout(FX.timer); cancelAnimationFrame(FX.raf);
  const el = document.getElementById('fx'), it = FX.q.shift();
  const cv = el.querySelector('.fx-sky');
  cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
  if(!it){ FX.on = false; el.hidden = true; el.className = 'fx'; return; }
  FX.on = true;
  el.className = `fx ${it.kind}`;
  el.dataset.season = it.season || '';
  el.querySelector('.fx-card').innerHTML = it.html;
  el.hidden = false;
  void el.offsetWidth;   // 出てくる動きを毎回はじめからにする
  el.classList.add('in');
  if(it.sound) sfx(it.sound);
  if(it.season && !fxCalm()) fxSky(cv, it.season);
  FX.timer = setTimeout(fxNext, it.ms || 2400);
}
document.getElementById('fx')?.addEventListener('click', fxNext);
const fxCutHtml = (tag, title, who, desc) => `<div class="fx-rays" aria-hidden="true"></div><span class="fx-tag">${esc(tag)}</span>
  <b class="fx-title">${esc(title)}</b>${who ? `<span class="fx-who">${esc(who)}</span>` : ''}${desc ? `<p class="fx-desc">${esc(desc)}</p>` : ''}`;

/* ----- 季節 ----- */
const SEASON_OF = m => m === 12 || m <= 2 ? 'snow' : m <= 4 ? 'sakura' : m === 5 ? 'green' : m === 6 ? 'rain' : m <= 8 ? 'summer' : 'autumn';
const MONTH_WORD = {4: 'はじまりの春', 5: '新緑の5月', 6: '梅雨の音楽室', 7: '夏、コンクールへ', 8: 'コンクールの夏', 9: '2学期がはじまる', 10: '実りの秋', 11: '冬のはじまり', 1: '冬の音楽室', 3: '旅立ちの春'};
// 月が変わったときの扉：その月の行事も出す
function fxMonth(s){
  const m = wkMonth(s.week), w0 = (m - 4) * 4, evs = [];
  // 「夏合宿」と「夏合宿・後半」のように続きものは1つに
  for(let w = w0; w < w0 + 4; w++){ const ev = eventAt(s, w); if(ev?.title && !evs.some(t => ev.title.startsWith(t))) evs.push(ev.title); }
  fxShow({kind: 'scene', season: SEASON_OF(m), sound: 'month', ms: 2200,
    html: `<span class="fx-month">${m}<small>月</small></span><b class="fx-title">${MONTH_WORD[m] || ''}</b>${evs.length ? `<p class="fx-desc">今月：${evs.map(esc).join('・')}</p>` : ''}`});
}
function fxYearStart(s){
  fxShow({kind: 'scene', season: 'sakura', sound: 'year', ms: 2800,
    html: `<span class="fx-tag">新しい年度</span><span class="fx-month">${s.year}<small>年度</small></span>
      <b class="fx-title">${s.members.length ? '春。新しい1年がはじまる' : '春。吹奏楽部が、また動きだす'}</b>
      <p class="fx-desc">${s.members.length ? `部員${s.members.length}人で、新しい1年生を待つ` : '休部していた音楽室に、1年生がやってくる'}</p>`});
}
// 冬の場面（11月 新体制・1月 アンサンブルコンテスト・3月 卒業式）
function fxWinter(s){
  const st = WINTER_STEPS[s.winter.step];
  fxShow({kind: 'scene', season: SEASON_OF(st.m), sound: 'month', ms: 2200,
    html: `<span class="fx-month">${st.m}<small>月</small></span><b class="fx-title">${MONTH_WORD[st.m] || ''}</b><p class="fx-desc">${esc(st.title)}</p>`});
}
function fxYearEnd(s){
  fxShow({kind: 'scene', season: 'autumn', sound: 'year', ms: 2800,
    html: `<span class="fx-tag">${s.year}年度</span><b class="fx-title">この1年の本番が、すべて終わった</b><p class="fx-desc">${hasSeniors(s) ? '3年生が引退する。' : ''}1年をふり返ろう。</p>`});
}
// 舞う花びら・葉・雨・夏のきらめき
function fxSky(cv, season){
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth * dpr, H = cv.clientHeight * dpr;
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const COL = {sakura: ['#F6C1D1', '#F9D7E2', '#EFA3BC'], green: ['#8FC98A', '#B5DB8E', '#6DB36B'], rain: ['#9DB8D6', '#B9CDE4'], snow: ['#FFFFFF', '#EAF2FA', '#DDE8F3'],
    summer: ['#FFD86B', '#FFF1B0', '#FFB84D'], autumn: ['#E8893A', '#D9542C', '#F0B04A']}[season];
  const n = season === 'rain' ? 70 : 36;
  const ps = Array.from({length: n}, () => ({x: Math.random() * W, y: (Math.random() * 2 - 1) * H, v: 0.6 + Math.random(),
    r: (3 + Math.random() * 4) * dpr, a: Math.random() * 6.28, w: (Math.random() - 0.5) * 0.08, c: COL[Math.floor(Math.random() * COL.length)]}));
  let last = 0;
  const step = now => {
    const dt = last ? Math.min(50, now - last) : 16; last = now;
    g.clearRect(0, 0, W, H);
    for(const p of ps){
      g.fillStyle = g.strokeStyle = p.c;
      if(season === 'rain'){
        p.y += p.v * dt * 1.2 * dpr; p.x -= p.v * dt * 0.2 * dpr;
        g.globalAlpha = 0.6; g.lineWidth = 1.2 * dpr; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + 3 * dpr, p.y - 14 * dpr); g.stroke();
      } else if(season === 'snow'){
        p.y += p.v * dt * 0.04 * dpr; p.x += Math.sin(now / 900 + p.a) * 0.35 * dpr;
        g.globalAlpha = 0.85; g.beginPath(); g.arc(p.x, p.y, p.r * 0.5, 0, 6.29); g.fill();
      } else if(season === 'summer'){
        p.y -= p.v * dt * 0.03 * dpr;
        g.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(now / 260 + p.a));
        g.beginPath(); g.arc(p.x, p.y, p.r * 0.45, 0, 6.29); g.fill();
      } else {
        p.y += p.v * dt * 0.07 * dpr; p.x += Math.sin(now / 650 + p.a) * 0.5 * dpr; p.a += p.w;
        g.globalAlpha = 0.9; g.save(); g.translate(p.x, p.y); g.rotate(p.a);
        g.beginPath(); g.ellipse(0, 0, p.r, p.r * (season === 'sakura' ? 0.62 : 0.45), 0, 0, 6.29); g.fill(); g.restore();
      }
      if(p.y > H + 20){ p.y = -20; p.x = Math.random() * W; }
      if(p.y < -20){ p.y = H + 20; p.x = Math.random() * W; }
    }
    g.globalAlpha = 1;
    FX.raf = requestAnimationFrame(step);
  };
  FX.raf = requestAnimationFrame(step);
}

/* ----- 数え上げ ----- */
// .countup の数字を data-from（なければ0）から data-to まで数える。data-key ごとに一度だけ（描き直しでくり返さない）
function fxCountUps(root = document){
  for(const el of root.querySelectorAll('.countup[data-key]')){
    const key = el.dataset.key, to = +el.dataset.to, dec = +(el.dataset.dec || 0);
    if(FX.done.has(key)){ el.textContent = to.toFixed(dec); continue; }
    FX.done.add(key);
    if(fxCalm()){ el.textContent = to.toFixed(dec); continue; }
    const from = +(el.dataset.from || 0), t0 = performance.now(), dur = +(el.dataset.ms || 900);
    const tick = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = (from + (to - from) * e).toFixed(dec);
      if(k < 1) requestAnimationFrame(tick); else el.classList.add('pop');
    };
    el.textContent = from.toFixed(dec);
    requestAnimationFrame(tick);
  }
}

/* ----- 本番の入場と幕 ----- */
// 幕の前に会場と曲を出し、客席の拍手のあと幕が開いて、部員が席につく。そのあと演奏をはじめる（go）
function stageIntro(perf, ev, rec, go, pieceText = null){
  const cur = document.querySelector('.cd-curtain'), cv = document.getElementById('cdStage');
  const ids = SEATS.map(x => S.members.find(m => m.seat === x.id)?.id).filter(id => id && CD.who.has(id));
  cur.querySelector('.cd-intro').innerHTML = `<small>${esc(VENUE[rec.venue].name)}</small><b>${esc(ev.title)}</b><span>県立みなと高校 吹奏楽部</span><span>${esc(pieceText || PIECES[rec.pieceId].full)}</span>`;
  const msg0 = $('#cdMsg').textContent;
  cur.classList.add('shut');
  cdMsg('客席が静かになっていく。もうすぐ幕が上がる。');
  drawStage(-1, cv, new Set());
  E.applaud(0.12, 2.8);
  CD.intro = setTimeout(() => {
    cur.classList.remove('shut');
    cdMsg('幕が上がった。部員が舞台に入ってくる。');
    let k = 0;
    const per = Math.max(1, Math.ceil(ids.length / 18));
    const step = () => {
      k = Math.min(ids.length, k + per);
      drawStage(-1, cv, new Set(ids.slice(0, k)));
      if(k < ids.length) CD.intro = setTimeout(step, 50);
      else { cdMsg('指揮者が礼をして、タクトを上げる。'); CD.intro = setTimeout(() => { CD.intro = 0; cdMsg(msg0); drawStage(-1, cv, CD.who); go(); }, 1000); }
    };
    CD.intro = setTimeout(step, 600);
  }, 1800);
}
// 演奏が終わったら幕を下ろす（客席の拍手の間に）
function stageCurtainClose(){
  const cur = document.querySelector('.cd-curtain');
  if(!cur || fxCalm()) return;
  cur.querySelector('.cd-intro').innerHTML = '';
  cur.classList.add('shut');
  cdMsg('演奏が終わった。客席から拍手が起きる。');
}
