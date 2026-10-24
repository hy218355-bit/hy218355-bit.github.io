'use strict';
/* 指揮モードと、録音の保存
   指揮：拍に合わせて画面をタップすると、部員がそのテンポについてくる。上のほうを叩くほど大きく、下ほど小さく。
   はじめに1小節ぶん叩いてテンポを示すと、次の拍から演奏が始まる。
   保存：録音を会場の響きつきで書き出し、ファイルとして保存・共有する（iOSアプリでは共有シートから）。 */

const CD = {phase: 'idle', perf: null, clock: null, count: [], lv: [], level: 1, raf: 0, lastTap: 0, rec: null};

// 拍の図の点（4拍子なら 1:下 2:左 3:右 4:上）
const CD_PATTERN = {
  2: [[100, 168], [100, 46]],
  3: [[100, 168], [160, 112], [100, 42]],
  4: [[100, 170], [42, 118], [158, 118], [100, 40]],
};
const cdPts = () => CD_PATTERN[CD.perf?.meter] || CD_PATTERN[4];
// 最初にテンポを示すタップの数（2拍子は2小節ぶん）
const cdCountN = () => CD.perf.meter <= 2 ? CD.perf.meter * 2 : CD.perf.meter;

// stage を渡すと本番の指揮（{rec, ev}）。終わると、その指揮で演奏した結果が採点される
function openConduct(stage = null){
  if(!stage && busy()) return;
  stopPlay();
  if(!E.ensure()) return;
  if(E.ac.state === 'suspended') E.ac.resume();
  CD.stage = stage;
  $('#conduct').classList.remove('watch'); $('#cdClose').textContent = 'やめる'; $('#cdEyebrow').textContent = '指揮';
  soloAll();   // 指揮するときは、全員の音で
  CD.perf = stage ? perform(recCtx(stage.rec)) : perform(currentCtx());
  // 舞台にいる部員（本番ならオーディションで選んだメンバー）を、指揮台から見えるように描く
  CD.who = new Set([...CD.perf.notes, ...CD.perf.hits].map(n => n.mid));
  CD.phase = 'count'; CD.count = []; CD.lv = []; CD.level = 1; CD.clock = null; CD.rec = null; CD.lastTap = 0; CD.idleHint = false; CD.beatShown = -1; CD.tmHint = null;
  CD.judge = {p: 0, g: 0, e: 0, l: 0}; CD.combo = 0; CD.best = 0;
  $('#cdCombo').textContent = '';
  const pc = PIECES[CD.perf.pieceId];
  $('#cdTitle').textContent = stage ? `${stage.ev.title}：${pc.title}` : `${pc.title}（${VENUE[U.venue].name}）`;
  $('#cdRef').textContent = bpmAt(pc, CD.perf.interp.tempo ?? 1, CD.perf.from);
  for(const el of document.querySelectorAll('#conduct .cd-beat')) el.textContent = beatName(pc);
  $('#cdTempo').textContent = '--';
  $('#cdResult').hidden = true; $('#cdPad').hidden = false;
  const n = cdCountN();
  const ready = () => cdMsg(`まず${n}回（${n / CD.perf.meter}小節ぶん）、テンポを示すようにタップ。次の拍から部員が入ってくる。`);
  if(SAMPLES.use && !SAMPLES.ready && SAMPLES.loading && !SAMPLES.error){
    // 録音を読み込み終わるまでは待ってもらう（合成音で始まらないように）
    CD.phase = 'wait';
    cdMsg('録音を読み込んでいます…');
    SAMPLES.loading.then(() => { if(CD.phase === 'wait'){ CD.phase = 'count'; ready(); } }, () => { if(CD.phase === 'wait'){ CD.phase = 'count'; ready(); } });
  } else ready();
  cdDrawPattern(-1);
  $('#conduct').hidden = false;
  document.documentElement.classList.add('conducting');
  drawStage(-1, $('#cdStage'), CD.who);
  $('#cdPad').focus({preventScroll: true});
  cancelAnimationFrame(CD.raf);
  CD.raf = requestAnimationFrame(cdFrame);
}
// 指揮しないで本番を聴くとき：タップする所は出さず、舞台の部員だけを大きく見せる
function openWatch(perf, title){
  cancelAnimationFrame(CD.raf);
  CD.phase = 'watch'; CD.stage = null; CD.perf = perf;
  CD.who = new Set([...perf.notes, ...perf.hits].map(n => n.mid));
  $('#cdTitle').textContent = title;
  $('#cdEyebrow').textContent = '本番';
  $('#cdClose').textContent = 'とばす';
  cdMsg(`${VENUE[perf.venue].name}で演奏中。鳴っている部員が光る。`);
  $('#cdResult').hidden = true; $('#cdPad').hidden = true;
  $('#conduct').classList.add('watch');
  $('#conduct').hidden = false;
  document.documentElement.classList.add('conducting');
  drawStage(-1, $('#cdStage'), CD.who);
}
function closeWatch(){
  if(CD.phase !== 'watch') return;
  CD.phase = 'idle';
  $('#conduct').hidden = true; $('#conduct').classList.remove('watch'); $('#cdClose').textContent = 'やめる'; $('#cdEyebrow').textContent = '指揮';
  document.documentElement.classList.remove('conducting');
}
function closeConduct(){
  // 見ているだけの本番は、止めて結果へ
  if(CD.phase === 'watch'){ stopPlay(); closeWatch(); return; }
  cancelAnimationFrame(CD.raf);
  const playing = CD.phase === 'play';
  CD.phase = 'idle';
  if(playing) stopPlay();
  if(CD.stage && S.pending && !S.pending.revealed){ CD.stage = null; renderAll(); }
  $('#conduct').hidden = true;
  document.documentElement.classList.remove('conducting');
}
const cdMsg = s => { $('#cdMsg').textContent = s; };

// 入りの合図のカチッという音（会場の響きは通さない）
function cdClick(at, strong){
  const ac = E.ac, o = ac.createOscillator(), g = ac.createGain();
  o.frequency.value = strong ? 1650 : 1250;
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(strong ? 0.22 : 0.15, at + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
  o.connect(g); g.connect(ac.destination); o.start(at); o.stop(at + 0.06);
}

function cdTap(e){
  if(CD.phase !== 'count' && CD.phase !== 'play') return;
  e.preventDefault();
  const now = E.ac.currentTime;
  if(now - CD.lastTap < 0.12) return;   // 二度押し
  CD.lastTap = now;
  haptic('tap');
  const pad = $('#cdPad').getBoundingClientRect();
  const y = e.clientY != null ? e.clientY : pad.top + pad.height / 2;
  const level = clamp(0.5 + 0.95 * (1 - (y - pad.top) / pad.height), 0.5, 1.45);
  cdRipple(e, pad);
  if(CD.phase === 'count'){
    CD.count.push(now);
    cdClick(now, CD.count.length === 1);
    cdDrawPattern(CD.count.length - 1);
    if(CD.count.length < cdCountN()){ cdMsg(`${CD.count.length}…`); return; }
    // 叩いた間隔の中央値をテンポにして、次の拍から始める
    const iv = CD.count.slice(1).map((t, i) => t - CD.count[i]).sort((a, b) => a - b);
    const P = clamp(iv[Math.floor(iv.length / 2)], 0.3, 1.6);
    CD.clock = BeatClock.start(now + P, CD.perf.from, P);
    CD.level = level; CD.lv = [[0, +level.toFixed(2)]];
    CD.phase = 'play';
    $('#cdTempo').textContent = Math.round(60 / P);
    cdMsg('拍に合わせてタップし続けよう。上のほうを叩くと大きく、下のほうは小さく。');
    playPerf(CD.perf, CD.stage ? `${CD.stage.rec.label}（あなたの指揮）` : `あなたの指揮：${PIECES[CD.perf.pieceId].title}（${VENUE[U.venue].name}）`, cdFinish, {clock: CD.clock});
    E.pb?.setLevel(level, CD.clock.t0);
    return;
  }
  CD.clock.tap(now);
  cdJudge(e, pad, CD.clock.taps[CD.clock.taps.length - 1].off);
  CD.idleHint = false;
  $('#cdTempo').textContent = Math.round(60 / CD.clock.P);
  if(Math.abs(level - CD.level) > 0.04){
    CD.level = level;
    E.pb?.setLevel(level);
    CD.lv.push([+(now - CD.clock.t0).toFixed(3), +level.toFixed(2)]);
  }
}
function cdRipple(e, pad){
  const r = document.createElement('span');
  r.className = 'cd-ripple';
  r.style.left = `${(e.clientX ?? pad.left + pad.width / 2) - pad.left}px`;
  r.style.top = `${(e.clientY ?? pad.top + pad.height / 2) - pad.top}px`;
  $('#cdPad').appendChild(r);
  setTimeout(() => r.remove(), 600);
}

// 1打ごとの判定：部員がちょうどその拍にいたか（叩くのが早いとテンポが前へ、遅いと後ろへ引っぱられる）
const CD_JUDGE = {p: 'ぴったり', g: 'いい感じ', e: '早い', l: '遅い'};
function cdJudge(e, pad, off){
  const a = Math.abs(off), kind = a <= 0.07 ? 'p' : a <= 0.15 ? 'g' : off < 0 ? 'e' : 'l';
  CD.judge[kind]++;
  CD.combo = kind === 'p' || kind === 'g' ? CD.combo + 1 : 0;
  CD.best = Math.max(CD.best, CD.combo);
  const el = document.createElement('span');
  el.className = 'cd-judge ' + kind;
  el.textContent = CD_JUDGE[kind];
  el.style.left = `${(e.clientX ?? pad.left + pad.width / 2) - pad.left}px`;
  el.style.top = `${(e.clientY ?? pad.top + pad.height / 2) - pad.top}px`;
  $('#cdPad').appendChild(el);
  setTimeout(() => el.remove(), 700);
  $('#cdCombo').textContent = CD.combo >= 4 ? `${CD.combo}連続` : '';
}

// 拍の図：点と、指揮棒の先（いまの拍の位置へなめらかに動く）
function cdDrawPattern(beat){
  const pts = cdPts(), n = pts.length;
  const cur = beat < 0 ? -1 : ((Math.floor(beat) % n) + n) % n;
  $('#cdPattern').innerHTML = pts.map(([x, y], i) =>
    `<circle cx="${x}" cy="${y}" r="${i === cur ? 15 : 11}" class="${i === cur ? 'on' : ''}"/><text x="${x}" y="${y + 5}">${i + 1}</text>`).join('')
    + '<circle id="cdTip" r="6" cx="100" cy="100" class="tip"/>';
}
function cdFrame(){
  CD.raf = requestAnimationFrame(cdFrame);
  if(CD.phase !== 'play' || !CD.clock || !E.ac) return;
  const b = CD.clock.beatAt(E.ac.currentTime) - CD.perf.from;
  if(b < 0) return;
  const pts = cdPts(), n = pts.length, i = Math.floor(b), f = b - i;
  const [x0, y0] = pts[i % n], [x1, y1] = pts[(i + 1) % n];
  // 拍の点で一瞬止まり、拍の間で弧を描いて次の点へ
  const s = f < 0.5 ? 2 * f * f : 1 - 2 * (1 - f) * (1 - f);
  const tip = $('#cdTip');
  if(!tip || CD.beatShown !== i){ cdDrawPattern(i); CD.beatShown = i; }
  const t2 = $('#cdTip');
  t2.setAttribute('cx', (x0 + (x1 - x0) * s).toFixed(1));
  t2.setAttribute('cy', (y0 + (y1 - y0) * s - 26 * Math.sin(Math.PI * s)).toFixed(1));
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
    cdMsg('タップが止まっても、部員は最後のテンポで吹き続ける。');
  }
}

// 演奏が終わったら、指揮の様子をまとめて録音に残す（途中で止めたときは残さない）
function cdFinish(natural){
  if(CD.phase !== 'play') return;
  CD.phase = 'done';
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
    CD.rec = S.recs.find(r => r.id === S.pending.recId);
    renderAll();
    $('#cdPad').hidden = true; cdMsg('');
    $('#cdResult').hidden = false;
    $('#cdResult').innerHTML = `<h3>演奏おわり</h3>
      <p class="cd-num"><span>平均テンポ<b>${beatName(pc)}=${bpm}</b></span><span>安定度<b>${followed ? stab + '%' : '—'}</b></span></p>
      ${judgeRow}
      <p>${speed}。${comment}</p>
      <div class="transport"><button class="btn primary" type="button" data-cd="reveal">結果を見る</button></div>`;
    haptic(stab >= 85 ? 'success' : 'tap');
    return;
  }
  const rec = addRec(S, `あなたの指揮：${pc.title}（${S.phase === 'choose' ? '選曲前' : wkLabel(S.week)}）`, {pieceId: CD.perf.pieceId, venue: U.venue});
  rec.span = {from: CD.perf.from, to: CD.perf.to};
  rec.conduct = conduct;
  commit(S);
  renderSelectors();
  CD.rec = rec;
  $('#cdPad').hidden = true;
  cdMsg('');
  $('#cdResult').hidden = false;
  $('#cdResult').innerHTML = `<h3>演奏おわり</h3>
    <p class="cd-num"><span>平均テンポ<b>${beatName(pc)}=${bpm}</b></span><span>安定度<b>${followed ? stab + '%' : '—'}</b></span></p>
    ${judgeRow}
    <p>${speed}。${comment}</p>
    <p class="small">この演奏は「録音」に残った。会場の響きつきで保存して、何度でも聴き返せる。</p>
    <div class="transport"><button class="btn primary" type="button" data-cd="again">▶ もう一度聴く</button><button class="btn" type="button" data-cd="save">⤓ 保存する</button><button class="btn" type="button" data-cd="retry">もう一度指揮する</button><button class="btn quiet" type="button" data-cd="close">閉じる</button></div>`;
  haptic(stab >= 85 ? 'success' : 'tap');
}

/* ===== 録音の再生（指揮した録音は、そのときの拍の進み方で）と保存 ===== */
const recPerf = rec => perform({...recCtx(rec), ...(rec.span || {})});
function playRecording(rec, label, onEnd = null){
  if(!E.ensure()) return;
  const perf = recPerf(rec);
  const opts = rec.conduct ? {clock: BeatClock.fromSaved(rec.conduct.ev, E.ac.currentTime + 0.3, rec.conduct.taps), lv: rec.conduct.lv} : {};
  playPerf(perf, label, onEnd, opts);
}
// 録音の中の、ひとりの部員の音だけを聴く（鳴り終わったら全員に戻す）
function playMemberRec(rec, m, label){
  stopPlay();
  U.solo = `member:${m.id}`;
  E.setSolo({type: 'member', id: m.id});
  playRecording(rec, label, () => { U.solo = 'all'; E.setSolo({type: 'all'}); renderSelectors(); });
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
  const file = new File([buf], name, {type: 'audio/wav'});
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
  pad.addEventListener('keydown', e => { if(e.key === ' ' || e.key === 'Enter'){ if(!e.repeat) cdTap(e); } });
  $('#cdResult').addEventListener('click', e => {
    const b = e.target.closest('[data-cd]'); if(!b) return;
    const act = b.dataset.cd;
    if(act === 'again' && CD.rec) playRecording(CD.rec, CD.rec.label);
    else if(act === 'save' && CD.rec) saveRecording(CD.rec);
    else if(act === 'retry'){ stopPlay(); openConduct(); }
    else if(act === 'close'){ stopPlay(); closeConduct(); }
    else if(act === 'reveal'){ closeConduct(); setTab('week'); reveal(); }
  });
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && !$('#conduct').hidden) closeConduct(); });
}
