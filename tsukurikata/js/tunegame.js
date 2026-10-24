'use strict';
/* 耳でチューニング：部員の B♭（ホルンは F）と、チューナーの基準音を同時に鳴らす。
   部員の音は少しずれているので「うわんうわん」とうなる。うなりが消えるところまで高さを動かす（画面では2本の波が重なって1本になる）。
   3人ぶんで1回。週に1回まで。合わせられた部員は音程が少し上がる。 */
const TG = {rounds: [], i: 0, snd: null, val: 0, raf: 0};

// 音の名前：英語（ドイツ語／ドレミ）。吹奏楽部では、実音をドイツ語で呼ぶことが多い（B♭ はベー）
const NOTE_EN = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const NOTE_DE = ['ツェー', 'ツィス', 'デー', 'エス', 'エー', 'エフ', 'フィス', 'ゲー', 'アス', 'アー', 'ベー', 'ハー'];
const NOTE_DO = ['ド', 'ド♯', 'レ', 'ミ♭', 'ミ', 'ファ', 'ファ♯', 'ソ', 'ラ♭', 'ラ', 'シ♭', 'シ'];
const noteName = midi => { const k = ((midi % 12) + 12) % 12; return `${NOTE_EN[k]}（${NOTE_DE[k]}／${NOTE_DO[k]}）`; };
// 移調楽器：楽譜に書く音は、実音より何半音上か（クラリネット・トランペットは B♭ 管、アルト・バリトンサックスと E♭ クラは E♭ 管、ホルンは F 管）
const TRANSPOSE = {cl: 2, bcl: 14, tp: 2, tsax: 14, asax: 9, bsax: 21, ebcl: -3, hn: 7, picc: -12};

// 楽器の音域のまん中に近い、チューニングの音（実音）
function tuneMidi(inst, sec){
  const pc = sec === 'hn' ? 5 : 10;
  let best = null;
  for(let m = inst.range[0] + 3; m <= inst.range[1] - 3; m++) if(m % 12 === pc && (best == null || Math.abs(m - inst.center) < Math.abs(best - inst.center))) best = m;
  return best ?? Math.round(inst.center);
}
const tuneDone = s => !!s.flags[`tg:${s.year}:${s.week}`];
function openTuneGame(){
  if(busy() || tuneDone(S)) return;
  stopPlay();
  if(!E.ensure()) return;
  if(E.ac.state === 'suspended') E.ac.resume();
  // ちがうパートから3人（毎週ちがう顔ぶれ）
  const pool = seated(S).filter(m => SEAT[m.seat].sec !== 'perc' && TIMBRE[INST[SEAT[m.seat].inst].timbre]);
  const picked = [], secs = new Set();
  for(let k = 0; picked.length < 3 && k < 200; k++){
    const m = pool[Math.floor(hash(S.year, S.week, 'tg', k) * pool.length)];
    if(!m || picked.includes(m) || (secs.has(SEAT[m.seat].sec) && k < 60)) continue;
    picked.push(m); secs.add(SEAT[m.seat].sec);
  }
  TG.rounds = picked.map((m, k) => {
    const inst = INST[SEAT[m.seat].inst], h = hash(S.year, S.week, 'tgoff', k);
    // 音程が苦手な部員ほど大きくずれている
    const size = 8 + 24 * (1 - m.stats.pitch / 100) * (0.6 + 0.4 * h);
    return {m, inst, iid: SEAT[m.seat].inst, midi: tuneMidi(inst, SEAT[m.seat].sec), off: (hash(S.year, S.week, 'tgsg', k) < 0.5 ? -1 : 1) * Math.round(size), res: null};
  });
  TG.i = 0;
  $('#tuneGame').hidden = false;
  document.documentElement.classList.add('conducting');
  tgRound();
}
function tgRound(){
  const r = TG.rounds[TG.i];
  TG.val = 0;
  $('#tgSlider').value = 0;
  $('#tgStep').textContent = `${TG.i + 1} / ${TG.rounds.length}`;
  $('#tgWho').textContent = `${r.m.name}（${r.inst.name}）`;
  // 合わせる音の名前。移調楽器は、その楽器の楽譜での名前も
  const t = TRANSPOSE[r.iid] || 0;
  $('#tgNote').innerHTML = `合わせる音：実音 <b>${noteName(r.midi)}</b>${t % 12 ? `。${r.inst.name}の楽譜では <b>${noteName(r.midi + t)}</b>` : ''}`;
  $('#tgMsg').textContent = 'チューナーの基準音と重ねて鳴らす。うなりがゆっくりになるほど近い。下の2本の波が重なって1本になったらぴったり。';
  $('#tgRes').textContent = '';
  $('#tgOk').hidden = false; $('#tgNext').hidden = true; $('#tgSlider').disabled = false;
  for(const b of document.querySelectorAll('#tuneGame [data-tg="down"], #tuneGame [data-tg="up"]')) b.disabled = false;
  tgSound(true);
  tgDraw();
}
// 波の絵：チューナーの音（灰色）と部員の音（金色）を重ねる。高さがずれているほど部員の波が詰まったり伸びたりして2本に分かれ、
// ぴったり合うと重なって1本になる（ずれは見やすいように大きくして描く）。鳴っている間は、波がゆっくり流れる
function tgDraw(){
  cancelAnimationFrame(TG.raf);
  const cv = $('#tgWave'), r = TG.rounds[TG.i];
  if(!cv || !r || $('#tuneGame').hidden) return;
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth * dpr, H = cv.clientHeight * dpr;
  if(cv.width !== W || cv.height !== H){ cv.width = W; cv.height = H; }
  const c = r.res != null ? 0 : r.off + TG.val, f = mtof(r.midi), bps = Math.abs(f * (Math.pow(2, c / 1200) - 1));
  const ctx = cv.getContext('2d'), C = tok(), mid = H / 2, amp = mid - 8 * dpr, N = 4;
  const ph = TG.snd ? performance.now() / 1000 * 0.5 : 0;
  ctx.clearRect(0, 0, W, H);
  const wave = (cyc, color, lw, alpha) => {
    ctx.beginPath();
    for(let x = 0; x <= W; x += dpr){ const y = mid - amp * Math.sin(2 * Math.PI * (cyc * x / W - ph)); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.globalAlpha = alpha; ctx.stroke(); ctx.globalAlpha = 1;
  };
  wave(N, C.soft, 4 * dpr, 0.5);
  wave(N * (1 + 0.005 * c), Math.abs(c) <= 3 ? C.good : C.brass, 2 * dpr, 1);
  $('#tgBeat').textContent = r.res != null ? '合わせたあとの音：2本が重なって1本に' : Math.abs(c) <= 3 ? '2本が重なって1本に。うなりは、ほとんど聞こえない'
    : `灰色＝チューナー　金色＝${r.m.name}。うなり：1秒に約${bps < 2 ? bps.toFixed(1) : Math.round(bps)}回`;
  if(TG.snd) TG.raf = requestAnimationFrame(tgDraw);
}
function tgSound(on){
  const ac = E.ac;
  if(TG.snd){
    const {ref, pl, g} = TG.snd, t = ac.currentTime;
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 0.15);
    ref.stop(t + 0.2); pl.stop(t + 0.2);
    TG.snd = null;
  }
  $('#tgPlay').textContent = on ? '■ 止める' : '▶ 鳴らす';
  if(!on){ tgDraw(); return; }
  const r = TG.rounds[TG.i], t = ac.currentTime + 0.03, f = mtof(r.midi);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 0.25);
  g.connect(ac.destination);
  // 基準音：チューナーのような澄んだ音
  const ref = ac.createOscillator(); ref.frequency.value = f;
  const rg = ac.createGain(); rg.gain.value = 0.11;
  ref.connect(rg); rg.connect(g);
  // 部員の音：その楽器の音色で、少しずれた高さ
  const pl = ac.createOscillator(); pl.setPeriodicWave(periodicWave(ac, r.inst.timbre, r.midi)); pl.frequency.value = f;
  pl.detune.value = r.off + TG.val;
  const pg = ac.createGain(); pg.gain.value = 0.09;
  pl.connect(pg); pg.connect(g);
  ref.start(t); pl.start(t);
  TG.snd = {ref, pl, g};
  tgDraw();
  // 30秒で自動で止める
  const snd = TG.snd;
  setTimeout(() => { if(TG.snd === snd) tgSound(false); }, 30000);
}
function tgSet(v){
  TG.val = clamp(v, -50, 50);
  $('#tgSlider').value = TG.val;
  if(TG.snd) TG.snd.pl.detune.setTargetAtTime(TG.rounds[TG.i].off + TG.val, E.ac.currentTime, 0.03);
  tgDraw();
}
function tgAnswer(){
  const r = TG.rounds[TG.i];
  r.res = r.off + TG.val;
  const a = Math.abs(r.res);
  const verdict = a <= 3 ? 'ぴったり！' : a <= 8 ? 'いい感じ。' : 'まだずれている。';
  $('#tgRes').textContent = `${verdict}最初は${Math.abs(r.off)}セント${r.off > 0 ? '高かった' : '低かった'}。合わせたあとは${a === 0 ? 'ずれなし' : `${a}セント${r.res > 0 ? '高い' : '低い'}`}。`;
  $('#tgOk').hidden = true; $('#tgNext').hidden = false; $('#tgSlider').disabled = true;
  for(const b of document.querySelectorAll('#tuneGame [data-tg="down"], #tuneGame [data-tg="up"]')) b.disabled = true;
  $('#tgNext').textContent = TG.i + 1 < TG.rounds.length ? '次の部員へ' : '終わる';
  haptic(a <= 3 ? 'success' : a <= 8 ? 'tap' : 'warning');
  // 答えを聴けるように、ずれを直した音を少し鳴らす
  if(!TG.snd) tgSound(true);
  TG.snd.pl.detune.setTargetAtTime(0, E.ac.currentTime + 0.6, 0.15);
  tgDraw();
}
function tgNext(){
  if(TG.i + 1 < TG.rounds.length){ TG.i++; tgSound(false); tgRound(); return; }
  closeTuneGame(true);
}
function closeTuneGame(finished){
  tgSound(false);
  cancelAnimationFrame(TG.raf);
  $('#tuneGame').hidden = true;
  document.documentElement.classList.remove('conducting');
  const done = TG.rounds.filter(r => r.res != null);
  if(finished && done.length){
    commit(tuneReward(S, done.map(r => ({mid: r.m.id, res: r.res}))));
    renderAll(); refreshNow();
  }
}
function bindTuneGame(){
  $('#tgSlider').addEventListener('input', e => tgSet(+e.target.value));
  $('#tuneGame').addEventListener('click', e => {
    const b = e.target.closest('[data-tg]'); if(!b || b.disabled) return;
    const act = b.dataset.tg;
    if(act === 'play') tgSound(!TG.snd);
    else if(act === 'down') tgSet(TG.val - 1);
    else if(act === 'up') tgSet(TG.val + 1);
    else if(act === 'ok') tgAnswer();
    else if(act === 'next') tgNext();
    else if(act === 'close') closeTuneGame(TG.rounds.some(r => r.res != null));
  });
}
