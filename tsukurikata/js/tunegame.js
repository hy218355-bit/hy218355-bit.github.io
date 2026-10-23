'use strict';
/* 耳でチューニング：部員の B♭（ホルンは F）と、チューナーの基準音を同時に鳴らす。
   部員の音は少しずれているので「うわんうわん」とうなる。うなりが消えるところまで高さを動かす。
   3人ぶんで1回。週に1回まで。合わせられた部員は音程が少し上がる。 */
const TG = {rounds: [], i: 0, snd: null, val: 0};

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
    return {m, inst, midi: tuneMidi(inst, SEAT[m.seat].sec), off: (hash(S.year, S.week, 'tgsg', k) < 0.5 ? -1 : 1) * Math.round(size), res: null};
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
  $('#tgMsg').textContent = 'チューナーの基準音と重ねて鳴らす。うなり（音量の波）がゆっくりになったら近い。消えたらぴったり。';
  $('#tgRes').textContent = '';
  $('#tgOk').hidden = false; $('#tgNext').hidden = true; $('#tgSlider').disabled = false;
  for(const b of document.querySelectorAll('#tuneGame [data-tg="down"], #tuneGame [data-tg="up"]')) b.disabled = false;
  tgSound(true);
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
  if(!on) return;
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
  // 30秒で自動で止める
  const snd = TG.snd;
  setTimeout(() => { if(TG.snd === snd) tgSound(false); }, 30000);
}
function tgSet(v){
  TG.val = clamp(v, -50, 50);
  $('#tgSlider').value = TG.val;
  if(TG.snd) TG.snd.pl.detune.setTargetAtTime(TG.rounds[TG.i].off + TG.val, E.ac.currentTime, 0.03);
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
}
function tgNext(){
  if(TG.i + 1 < TG.rounds.length){ TG.i++; tgSound(false); tgRound(); return; }
  closeTuneGame(true);
}
function closeTuneGame(finished){
  tgSound(false);
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
