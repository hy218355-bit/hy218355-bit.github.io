'use strict';
/* 録音サンプル音源
   VSCO 2 Community Edition と VCSL（どちらも CC0）、Weresax（CC BY 3.0）の録音を使う。
   音の高さのずれ・ずり上がり・ビブラート・音の裏返りは再生速度で、強弱は音量と録音の強弱段で表す。
   読み込みが終わるまでは合成音で鳴らす。 */

// 楽器 → 使う録音。shift は「何半音上の録音を下げて使うか」（音色を大きく・暗くする）、lp は明るさの上限（基音の何倍まで）
// g は録音ごとの音量の差をならす係数。管楽器と弦バスは、5曲を楽器ごとに響きなしで書き出し、
// 耳に近い重み（K特性）で測った大きさが INST の gain（採点のバランスでも使う大きさ）どおりになるよう合わせてある
const SAMPLE_BANK = {
  picc: {bank: 'picc', g: 1.2}, fl: {bank: 'flute', g: 1.04}, ob: {bank: 'oboe', g: 1.01},
  // E♭クラ・バスクラ・バストロンボーン（アイオワ大）とバリトンサックス（Bear Sax）は、2026年10月に自分の録音にした。
  // g は、前の代わりの録音（クラリネット・トロンボーン・テナーサックスを高さを変えて使ったもの）と同じ大きさになるよう測って合わせた
  fg: {bank: 'bassoon', g: 1.13}, ebcl: {bank: 'ebclar', g: 1.18}, cl: {bank: 'clar', g: 1.04},
  bcl: {bank: 'bclar', g: 1.61},
  asax: {bank: 'sax', g: 1.07}, tsax: {bank: 'tsax', g: 1.06}, bsax: {bank: 'bsax', g: 1.0},
  tp: {bank: 'tpt', g: 1.05}, hn: {bank: 'horn', g: 1.08}, tb: {bank: 'tbn', g: 1.11}, btb: {bank: 'btbn', g: 0.95},
  // ユーフォニアムは自由に使える録音がないので、トロンボーンの録音を暗くして使う。
  // 円錐管のユーフォはトロンボーンより出だしが丸いので、立ち上がりをゆっくりに（att 秒）、出だしの張り（blat）を半分にする
  // 中低音の響きの山（form：[周波数, dB, Q]。合成音の TIMBRE.euph と同じ）を足して、あたたかい音に。
  // そのぶん大きくなった 1.75dB を g で下げて、前と同じ大きさ（採点のバランス）にしてある
  euph: {bank: 'tbn', lp: 6, g: 0.875, att: 0.025, blat: 0.5, form: [480, 3, 1]}, tuba: {bank: 'tuba', g: 1.04}, cb: {bank: 'cbass', g: 1.11},
  // 大太鼓は1打がトランペット1音より10dBほど大きく、マーチで全体をおおっていたので下げた。スネアは短い音で埋もれていたので上げた
  cbpizz: {bank: 'pizz', g: 1.3}, timp: {bank: 'timp', g: 3.1}, sd: {bank: 'sd', g: 4.6}, bd: {bank: 'bd', g: 1.57},
  cym: {bank: 'cym', g: 3.6}, sus: {bank: 'sus', g: 4.3}, tri: {bank: 'tri', g: 8}, tamb: {bank: 'tamb', g: 1.2},
  tamtam: {bank: 'tamtam', g: 1},
  glock: {bank: 'glock', g: 5.3}, xylo: {bank: 'xylo', g: 2.4}, mrb: {bank: 'mrb', g: 2.75}, vib: {bank: 'vib', g: 3}, chime: {bank: 'chime', g: 5.3},
};
const SAMPLES = {ready: false, use: true, banks: {}, loading: null, progress: 0, error: null};
const SAMPLE_TUNE = A4 / 440;   // 録音はA=440Hz
const SUS_GAIN = 5, HIT_GAIN = 1.31;

function decodeBuf(ac, ab){
  return new Promise((res, rej) => {
    const p = ac.decodeAudioData(ab, res, rej);
    if(p && p.then) p.then(res, rej);
  });
}
// MP3の頭に入る無音の長さは環境で違うので、目録の位置の前後から実際の出だしを探す
function findStart(d, sr, o, pk){
  const thr = 0.03 * pk;
  const a = Math.max(0, Math.floor((o - 0.09) * sr)), b = Math.min(d.length, Math.floor((o + 0.12) * sr));
  for(let i = a; i < b; i++) if(Math.abs(d[i]) > thr) return Math.max(0, i / sr - 0.006);
  return o;
}
function loadSamples(base, onProgress){
  if(SAMPLES.loading) return SAMPLES.loading;
  SAMPLES.loading = (async () => {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const dec = new OAC(1, 1, 44100);
    const man = await (await fetch(base + 'manifest.json')).json();
    const names = Object.keys(man);
    let done = 0;
    await Promise.all(names.map(async n => {
      const ab = await (await fetch(base + n + '.mp3')).arrayBuffer();
      const buf = await decodeBuf(dec, ab);
      const d = buf.getChannelData(0);
      const samples = man[n].samples.map(s => ({...s, start: findStart(d, buf.sampleRate, s.o, s.pk)}));
      const layers = [...new Set(samples.filter(s => !s.roll && s.l != null && s.l >= 0).map(s => s.l))].sort((a, b) => a - b);
      SAMPLES.banks[n] = {buf, kind: man[n].kind, samples, layers};
      done++;
      SAMPLES.progress = done / names.length;
      if(onProgress) onProgress(SAMPLES.progress);
    }));
    SAMPLES.ready = true;
  })().catch(e => { SAMPLES.error = e; throw e; });
  return SAMPLES.loading;
}
const sampleCfg = instId => SAMPLES.ready && SAMPLES.use ? SAMPLE_BANK[instId] && SAMPLES.banks[SAMPLE_BANK[instId].bank] && SAMPLE_BANK[instId] : null;

// 音の高さ（と強弱段）が近い録音を選ぶ。rank を指定すると2番目・3番目に近い録音（5半音以内）を使う
// 同じパートの複数人が同じ録音を重ねると、シュワシュワした不自然な響きになるため
function pickSample(bank, midi, v, opts = {}){
  let list = bank.samples.filter(s => !!s.roll === !!opts.roll);
  if(!list.length) list = bank.samples;
  if(bank.layers.length > 1 && !opts.roll){
    const want = bank.layers[Math.min(bank.layers.length - 1, Math.floor(clamp01(v) * bank.layers.length))];
    // 強弱段が1つしかない高さの録音（l = -1）は、どの強さでも使う
    const lay = list.filter(s => s.l === want || s.l === -1);
    if(lay.length) list = lay;
  }
  if(midi == null){
    const same = list.filter(s => s.l === list[0].l);
    return same[Math.floor(hash(opts.key || '', 'rr') * same.length)] || list[0];
  }
  const near = list.filter(s => s.m != null).map(s => [Math.abs(s.m - midi) + (s.m < midi ? 0.01 : 0), s]).sort((a, b) => a[0] - b[0]);
  if(!near.length) return list[0];
  const d0 = near[0][0];
  // 同じ高さのテイク違い（スタッカート）は順番に、それ以外は近い順に
  const takes = near.filter(([d]) => Math.abs(d - d0) < 0.02);
  if(takes.length > 1) return takes[Math.floor(hash(opts.key || '', 'rr') * takes.length)][1];
  const r = opts.rank || 0;
  const ok = near.filter(([d], i) => i === 0 || d <= 5);
  return ok[Math.min(r, ok.length - 1)][1];
}

// 録音を時間 [t0, t1] だけ鳴らす。録音より長ければ、目録のループ（lp）をなめらかにつないでくり返す。
// ループの始まりと終わりは、波形がそろう所を書き出し時に選んである（build_samples.py の find_loop）。
// 重ねる長さ XF は録音の上の長さなので、再生速度 rate で割った時間だけ重ねると、波の山と谷がずれない。
// 波形がそろわない録音（lc が小さい）は、音量がへこまないように等パワーで重ねる
const LOOP_XF = 0.2;
const EQ_POW = (() => { const n = 33, a = new Float32Array(n), b = new Float32Array(n); for(let i = 0; i < n; i++){ const p = i / (n - 1); a[i] = Math.sin(p * Math.PI / 2); b[i] = Math.cos(p * Math.PI / 2); } return {up: a, down: b}; })();
function playSegments(ac, dest, bank, smp, t0, t1, rate, firstOffset, srcs, onSrc){
  const xf = LOOP_XF / rate, coherent = (smp.lc ?? 0) >= 0.7;
  const loopA = smp.start + (smp.lp ? smp.lp[0] : smp.d * 0.4), loopB = smp.start + (smp.lp ? smp.lp[1] : smp.d);
  let off = smp.start + (firstOffset || 0);
  // くり返しの上限は1音ぶんで数える（奏者の srcs は400〜600本に保たれるので、全体で数えると400本を超えた奏者の音が鳴らなくなる）
  let t = t0, first = true, made = 0;
  while(t < t1 && made++ < 400){
    const avail = (loopB - off) / rate;
    const segEnd = Math.min(t1, t + avail);
    const src = ac.createBufferSource(); src.buffer = bank.buf;
    const g = ac.createGain();
    src.connect(g); g.connect(dest);
    const more = segEnd < t1;
    if(first) g.gain.value = 1;
    else if(coherent){ g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + xf); }
    else g.gain.setValueCurveAtTime(EQ_POW.up, t, xf);
    if(more){
      if(coherent){ g.gain.setValueAtTime(1, segEnd - xf); g.gain.linearRampToValueAtTime(0, segEnd); }
      else g.gain.setValueCurveAtTime(EQ_POW.down, segEnd - xf, xf);
    }
    src.start(t, off);
    src.stop(more ? segEnd + 0.01 : t1 + 0.05);
    srcs.push(src);
    if(onSrc) onSrc(src, t, segEnd);
    if(!more) break;
    t = segEnd - xf; off = loopA; first = false;
  }
}

/* ===== 管楽器・弦バス：録音で吹く奏者1人ぶんの声 =====
   音色が育っていない奏者は、こもった細い音・ゆらぐ音量・裏返り・不安定な音程で表す（雑音は足さない）。
   同じパートの部員は、使う録音・ごく小さな音程と出だしの差を一人ずつ変えて、合奏らしい重なりにする。 */
class SampleVoice {
  constructor(ac, dest, instId, opts){
    this.ac = ac;
    this.inst = INST[instId];
    this.tb = TIMBRE[this.inst.timbre];
    this.cfg = SAMPLE_BANK[instId];
    this.bank = SAMPLES.banks[this.cfg.bank];
    this.stac = SAMPLES.banks[this.cfg.bank + '_st'] || null;
    this.gain = this.inst.gain * SUS_GAIN * (this.cfg.g || 1);
    this.rank = opts.alt || 0;
    this.det = opts.det || 0;
    this.dt = opts.dt || 0;
    this.srcs = [];
    this.in = ac.createGain();
    this.lp = ac.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.Q.value = 0.5; this.lp.frequency.value = 16000;
    this.in.connect(this.lp);
    let node = this.lp;
    if(this.cfg.form){
      const [f, db, q] = this.cfg.form, pk = ac.createBiquadFilter();
      pk.type = 'peaking'; pk.frequency.value = f; pk.gain.value = db; pk.Q.value = q;
      node.connect(pk); node = pk;
    }
    if(opts.trem > 0.05){
      this.wob = ac.createGain(); this.trem = opts.trem * 0.6;
      node.connect(this.wob); node = this.wob;
    }
    node.connect(dest);
    this.vibRate = (this.inst.vibRate || 5) * (opts.vibRateMul || 1);
    this.prev = null;
  }
  start(){}
  stop(t){ for(const s of this.srcs){ try{ s.stop(t); }catch(e){} } }

  play(n, next, T0){
    const ac = this.ac, tb = this.tb, cfg = this.cfg;
    T0 += this.dt;
    const s = T0 + n.t;
    const nextS = next ? T0 + next.t : Infinity;
    const joined = !!n.join && !!this.prev;
    const legNext = !!(next && next.join);
    const endT = Math.max(s + 0.03, Math.min(T0 + n.t + n.d, nextS - 0.004));
    const env = n.env, v0 = env[0][1], vEnd = env[env.length - 1][1];
    const vMax = env.reduce((a, [, v]) => Math.max(a, v), 0);
    const lv = v => this.gain * (0.03 + 0.97 * Math.pow(v, 1.8));
    const smooth = joined && (n.slur || n.art === 'tie');
    const f = mtof(n.midi);
    // 明るさ：弱い音・音色の育っていない奏者ほどこもる。低く下げて使う録音（バスクラなど）は lp で丸める
    const cut = clamp(f * (cfg.lp || 40) * lerp(0.55, 1, vMax) * (0.45 + 0.55 * (n.T ?? 1)), 300, 16000);
    this.lp.frequency.setValueAtTime(cut, s);

    // 短い音はスタッカートの録音をそのまま鳴らす
    const short = this.stac && !smooth && (n.art === 'stac' || n.d < 0.3);
    // 出だしの張り（金管のアタック）。録音を借りている楽器は、その楽器らしい強さに（cfg.blat）
    const blat = 1 + (n.blat - 1) * (cfg.blat ?? 1);
    if(short){
      const smp = pickSample(this.stac, n.midi - (cfg.shift || 0), vMax, {key: n.key});
      const rate = Math.pow(2, (n.midi - smp.m) / 12) / SAMPLE_TUNE * Math.pow(2, (n.cents + this.det + (n.crack ? n.crack : 0)) / 1200);
      const src = ac.createBufferSource(); src.buffer = this.stac.buf;
      src.playbackRate.setValueAtTime(rate, s);
      if(n.crack) src.playbackRate.setValueAtTime(rate * Math.pow(2, -n.crack / 1200), s + n.crackDur);
      const g = ac.createGain();
      src.connect(g); g.connect(this.in);
      const end = Math.min(s + smp.d / rate, nextS + 0.03);
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(lv(vMax) * blat, s + (cfg.att ? cfg.att * 0.5 : 0.004));
      if(nextS < s + smp.d / rate){ g.gain.setValueAtTime(lv(vMax), nextS - 0.002); g.gain.linearRampToValueAtTime(0, nextS + 0.03); }
      src.start(s, smp.start);
      src.stop(end + 0.01);
      this.srcs.push(src);
      this.prev = n; this.lastCents = n.cents;
      return end;
    }

    const smp = pickSample(this.bank, n.midi - (cfg.shift || 0), vMax, {rank: this.rank});
    const base = Math.pow(2, (n.midi - smp.m) / 12) / SAMPLE_TUNE;
    const R = c => base * Math.pow(2, (c + this.det) / 1200);
    const relEnd = legNext ? nextS + 0.06 : endT + tb.rel;

    // 1音ぶんの音量（強弱の流れ）
    const g = ac.createGain();
    g.connect(this.in);
    const G = g.gain;
    const att = smooth ? 0.05 : joined ? Math.max(0.02, cfg.att || 0) : cfg.att || 0.008;
    G.setValueAtTime(0, s);
    G.linearRampToValueAtTime(lv(v0) * (smooth ? 1 : blat), s + att);
    if(!smooth && blat > 1.02) G.linearRampToValueAtTime(lv(v0), s + att + n.att * 2);
    const after = s + att + n.att * 2 + 0.03;
    let k = 0;
    for(const [dt, v] of env){
      const tt = s + dt;
      if(tt <= after || tt >= endT - 0.002 || (k++ % 2)) continue;
      G.linearRampToValueAtTime(lv(v), tt);
    }
    G.linearRampToValueAtTime(lv(vEnd), Math.max(endT, after + 0.002));
    if(legNext){ G.setValueAtTime(lv(vEnd), nextS); G.linearRampToValueAtTime(0, nextS + (next.slur ? 0.06 : 0.03)); }
    else G.linearRampToValueAtTime(0, endT + tb.rel);

    // 再生速度で音程を動かす（ずり上がり → 落ち着く → 息が続かず下がる、音の裏返り）
    const firstOffset = smooth ? 0.08 : 0;
    const vib = n.vib > 0.5 && endT - s > 0.6 ? n.vib : 0;
    let vg = null;
    if(vib){
      const on = s + Math.min(0.35, (endT - s) * 0.3);
      const lfo = ac.createOscillator(); lfo.frequency.value = this.vibRate;
      vg = ac.createGain();
      vg.gain.setValueAtTime(0, on);
      vg.gain.linearRampToValueAtTime(base * (Math.pow(2, vib / 1200) - 1), Math.min(endT, on + 0.4));
      lfo.connect(vg);
      lfo.start(on); lfo.stop(relEnd + 0.05);
      this.srcs.push(lfo);
    }
    const sagAt1 = s + (endT - s) * 0.6, sagAt2 = s + (endT - s) * 0.85;
    const useSag = Math.abs(n.sag) > 3 && endT - s > 0.5;
    playSegments(ac, g, this.bank, smp, s, relEnd, base, firstOffset, this.srcs, (src, t0, t1) => {
      const P = src.playbackRate;
      if(t0 <= s + 0.001){
        let ts = s;
        if(n.art === 'tie' && joined){
          P.setValueAtTime(R(this.lastCents ?? n.cents), s);
          ts = Math.min(s + 0.1, endT);
          P.linearRampToValueAtTime(R(n.cents), ts);
        } else if(n.crack){
          P.setValueAtTime(R(n.cents + n.crack), s);
          P.setValueAtTime(R(n.cents + n.crack), s + n.crackDur);
          ts = s + n.crackDur + 0.02;
          P.linearRampToValueAtTime(R(n.cents + n.scoop * 0.4), ts);
        } else {
          P.setValueAtTime(R(n.cents + (smooth ? n.scoop * 0.3 : n.scoop)), s);
        }
        const tSet = Math.min(ts + n.settle, endT - 0.002);
        if(tSet > ts) P.linearRampToValueAtTime(R(n.cents), tSet);
      } else {
        P.setValueAtTime(R(n.cents + (useSag && t0 > sagAt2 ? n.sag : useSag && t0 > sagAt1 ? n.sag * 0.45 : 0)), t0);
      }
      if(useSag){
        if(sagAt1 > t0 && sagAt1 < t1) P.setValueAtTime(R(n.cents + n.sag * 0.45), sagAt1);
        if(sagAt2 > t0 && sagAt2 < t1) P.setValueAtTime(R(n.cents + n.sag), sagAt2);
      }
      if(vg) vg.connect(P);
    });
    // 息の支えが弱い奏者は、音量がゆっくり揺れる
    if(this.wob){
      const W = this.wob.gain;
      W.setValueAtTime(1, s);
      let j = 0;
      for(let tt = s + 0.22; tt < endT; tt += 0.22) W.linearRampToValueAtTime(1 + this.trem * (hash(n.key, 'w', j++) * 2 - 1), tt);
    }
    this.prev = n;
    this.lastCents = n.cents + (useSag ? n.sag : 0);
    if(this.srcs.length > 600) this.srcs = this.srcs.slice(-400);
    return relEnd;
  }
}

/* ===== 打楽器・鍵盤・ピチカート：録音で1打 ===== */
function sampleStrike(ac, out, h, T0, srcs){
  const cfg = SAMPLE_BANK[h.inst], bank = SAMPLES.banks[cfg.bank], inst = INST[h.inst];
  const s = T0 + h.t;
  const lvl = v => inst.gain * HIT_GAIN * (cfg.g || 1) * (0.05 + 0.95 * Math.pow(clamp01(v), 1.4));
  const pitched = bank.samples.some(x => x.m != null);
  const g = ac.createGain();
  g.connect(out);
  if(h.roll){
    const smp = pickSample(bank, pitched ? h.midi : null, Math.max(h.v, h.v1 ?? h.v), {roll: true, key: h.key});
    const rate = pitched ? Math.pow(2, (h.midi - smp.m) / 12) / SAMPLE_TUNE * Math.pow(2, (h.cents || 0) / 1200) : 1;
    const end = s + h.dur;
    g.gain.setValueAtTime(0, s);
    g.gain.linearRampToValueAtTime(lvl(h.v) * 1.6, s + 0.05);
    g.gain.linearRampToValueAtTime(lvl(h.v1 ?? h.v) * 1.6, end);
    g.gain.setTargetAtTime(0, end, h.inst === 'sd' ? 0.05 : 0.35);
    playSegments(ac, g, bank, smp, s, end + (h.inst === 'sd' ? 0.3 : 2.2), rate, 0.03, srcs, src => src.playbackRate.setValueAtTime(rate, s));
    return end + 2.5;
  }
  const smp = pickSample(bank, pitched ? h.midi : null, h.v, {key: h.key});
  const rate = pitched ? Math.pow(2, (h.midi - smp.m) / 12) / SAMPLE_TUNE * Math.pow(2, (h.cents || 0) / 1200) : 1 + 0.01 * (hash(h.key, 'p') - 0.5);
  const src = ac.createBufferSource(); src.buffer = bank.buf;
  src.playbackRate.value = rate;
  src.connect(g);
  g.gain.value = lvl(h.v);
  const dur = smp.d / rate;
  src.start(s, smp.start);
  src.stop(s + dur);
  srcs.push(src);
  return s + dur;
}
