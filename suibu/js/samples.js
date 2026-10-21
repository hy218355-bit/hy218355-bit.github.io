'use strict';
/* 録音サンプル音源
   VSCO 2 Community Edition（CC0）と Weresax（CC BY 3.0）の録音を使う。
   音の高さのずれ・ずり上がり・ビブラート・音の裏返りは再生速度で、強弱は音量と録音の強弱段で表す。
   読み込み前や録音のない楽器（ヴィブラフォン）は合成音で鳴らす。 */

// 楽器 → 使う録音。shift は「何半音上の録音を下げて使うか」（音色を大きく・暗くする）、lp は明るさの上限（基音の何倍まで）
const SAMPLE_BANK = {
  picc: {bank: 'picc', g: 0.85}, fl: {bank: 'flute', g: 1.0}, ob: {bank: 'oboe', g: 1},
  fg: {bank: 'bassoon', g: 1.05}, ebcl: {bank: 'clar', g: 1.2}, cl: {bank: 'clar', g: 1.35},
  bcl: {bank: 'clar', shift: -12, lp: 10, g: 1.75},
  asax: {bank: 'sax', g: 0.85}, tsax: {bank: 'sax', shift: -5, lp: 14, g: 0.9}, bsax: {bank: 'sax', shift: -12, lp: 12, g: 1.0},
  tp: {bank: 'tpt', g: 1}, hn: {bank: 'horn', g: 1.33}, tb: {bank: 'tbn', g: 1.1}, btb: {bank: 'tbn', g: 1.1},
  euph: {bank: 'tbn', lp: 6, g: 1.32}, tuba: {bank: 'tuba', g: 1.35}, cb: {bank: 'cbass', g: 1.3},
  cbpizz: {bank: 'pizz', g: 1.3}, timp: {bank: 'timp', g: 3.1}, sd: {bank: 'sd', g: 2.6}, bd: {bank: 'bd', g: 2.8},
  cym: {bank: 'cym', g: 3.6}, sus: {bank: 'sus', g: 4.3}, tri: {bank: 'tri', g: 8}, tamb: {bank: 'tamb', g: 1.2},
  tamtam: {bank: 'tamtam', g: 1}, glock: {bank: 'glock', g: 5.3}, xylo: {bank: 'xylo', g: 2.4}, mrb: {bank: 'mrb', g: 2.75}, chime: {bank: 'chime', g: 5.3},
};
const SAMPLES = {ready: false, use: true, banks: {}, loading: null, progress: 0, error: null};
const SAMPLE_TUNE = A4 / 440;   // 録音はA=440Hz
const SUS_GAIN = 4.2, HIT_GAIN = 1.1;

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

// 音の高さ（と強弱段）が一番近い録音を選ぶ
function pickSample(bank, midi, v, opts = {}){
  let list = bank.samples.filter(s => !!s.roll === !!opts.roll);
  if(!list.length) list = bank.samples;
  if(bank.layers.length > 1 && !opts.roll){
    const want = bank.layers[Math.min(bank.layers.length - 1, Math.floor(clamp01(v) * bank.layers.length))];
    const lay = list.filter(s => s.l === want);
    if(lay.length) list = lay;
  }
  if(midi == null){
    const same = list.filter(s => s.l === list[0].l);
    return same[Math.floor(hash(opts.key || '', 'rr') * same.length)] || list[0];
  }
  let best = list[0], bd = Infinity;
  for(const s of list){
    if(s.m == null) continue;
    const d = Math.abs(s.m - midi) + (s.m < midi ? 0.01 : 0);
    if(d < bd){ bd = d; best = s; }
  }
  return best;
}

// 録音を時間 [t0, t1] だけ鳴らす。録音より長ければ、後半をなめらかにつないでくり返す
function playSegments(ac, dest, bank, smp, t0, t1, rate, firstOffset, srcs, onSrc){
  const XF = 0.15;
  const usableEnd = smp.start + (smp.lp ? smp.lp[1] : smp.d);
  const loopA = smp.start + (smp.lp ? smp.lp[0] : smp.d * 0.4), loopB = usableEnd;
  let off = smp.start + (firstOffset || 0);
  let t = t0, first = true;
  while(t < t1 && srcs.length < 400){
    const avail = (loopB - off) / rate;
    const segEnd = Math.min(t1, t + avail);
    const src = ac.createBufferSource(); src.buffer = bank.buf;
    const g = ac.createGain();
    src.connect(g); g.connect(dest);
    if(first){ g.gain.value = 1; }
    else { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + XF); }
    const more = segEnd < t1;
    if(more){ g.gain.setValueAtTime(1, segEnd - XF); g.gain.linearRampToValueAtTime(0, segEnd); }
    src.start(t, off);
    src.stop(more ? segEnd + 0.01 : t1 + 0.05);
    srcs.push(src);
    if(onSrc) onSrc(src, t, segEnd);
    if(!more) break;
    t = segEnd - XF; off = loopA; first = false;
  }
}

/* ===== 管楽器・弦バス：録音で吹く奏者1人ぶんの声 ===== */
class SampleVoice {
  constructor(ac, dest, instId, opts){
    this.ac = ac;
    this.inst = INST[instId];
    this.tb = TIMBRE[this.inst.timbre];
    this.cfg = SAMPLE_BANK[instId];
    this.bank = SAMPLES.banks[this.cfg.bank];
    this.gain = this.inst.gain * SUS_GAIN * (this.cfg.g || 1);
    this.srcs = [];
    this.in = ac.createGain();
    this.lp = ac.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.Q.value = 0.5; this.lp.frequency.value = 16000;
    this.in.connect(this.lp);
    let node = this.lp;
    if(opts.trem > 0.05){
      this.wob = ac.createGain(); this.trem = opts.trem;
      node.connect(this.wob); node = this.wob;
    }
    node.connect(dest);
    // 音色が育っていない奏者は、息の雑音が混じる
    const noise = this.tb.noise * (opts.noise ?? 1) * 0.6;
    if(noise > 0.03){
      const src = ac.createBufferSource(); src.buffer = noiseBuf(ac); src.loop = true;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.8;
      bp.frequency.value = Math.max(this.tb.nMin, mtof(opts.midi || this.inst.center) * this.tb.nMul);
      this.ng = ac.createGain(); this.ng.gain.value = 0; this.noise = noise;
      src.connect(bp); bp.connect(this.ng); this.ng.connect(this.in);
      this.noiseSrc = src; this.srcs.push(src);
    }
    this.vibRate = (this.inst.vibRate || 5) * (opts.vibRateMul || 1);
    this.prev = null;
  }
  start(t){ if(this.noiseSrc) this.noiseSrc.start(t, (t * 13.7) % 1.5); }
  stop(t){ for(const s of this.srcs){ try{ s.stop(t); }catch(e){} } }

  play(n, next, T0){
    const ac = this.ac, tb = this.tb, cfg = this.cfg;
    const s = T0 + n.t;
    const nextS = next ? T0 + next.t : Infinity;
    const joined = !!n.join && !!this.prev;
    const legNext = !!(next && next.join);
    const endT = Math.max(s + 0.03, Math.min(T0 + n.t + n.d, nextS - 0.004));
    const env = n.env, v0 = env[0][1], vEnd = env[env.length - 1][1];
    const vMax = env.reduce((a, [, v]) => Math.max(a, v), 0);
    const lv = v => this.gain * (0.03 + 0.97 * Math.pow(v, 1.8));
    const smooth = joined && (n.slur || n.art === 'tie');

    const smp = pickSample(this.bank, n.midi - (cfg.shift || 0), vMax);
    const base = Math.pow(2, (n.midi - smp.m) / 12) / SAMPLE_TUNE;
    const R = c => base * Math.pow(2, c / 1200);
    const relEnd = legNext ? nextS + 0.06 : endT + tb.rel;

    // 1音ぶんの音量（強弱の流れ）
    const g = ac.createGain();
    g.connect(this.in);
    const G = g.gain;
    const att = smooth ? 0.05 : joined ? 0.02 : 0.008;
    G.setValueAtTime(0, s);
    G.linearRampToValueAtTime(lv(v0) * (smooth ? 1 : n.blat), s + att);
    if(!smooth && n.blat > 1.02) G.linearRampToValueAtTime(lv(v0), s + att + n.att * 2);
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

    // 明るさ：弱い音ほど暗く。低く下げて使う録音（バスクラなど）は lp で丸める
    const f = mtof(n.midi);
    this.lp.frequency.setValueAtTime(clamp(f * (cfg.lp || 40) * lerp(0.55, 1, vMax), 300, 16000), s);

    // 再生速度で音程を動かす（ずり上がり → 落ち着く → 息が続かず下がる、音の裏返り）
    const firstOffset = smooth ? 0.08 : 0;
    const vib = n.vib > 0.5 && endT - s > 0.6 ? n.vib : 0;
    let vg = null, lfo = null;
    if(vib){
      const on = s + Math.min(0.35, (endT - s) * 0.3);
      lfo = ac.createOscillator(); lfo.frequency.value = this.vibRate;
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
    if(this.ng){
      const N = this.ng.gain;
      N.setValueAtTime(0, s);
      N.linearRampToValueAtTime(this.noise * lv(vMax) / this.gain, s + 0.03);
      N.setValueAtTime(this.noise * lv(vEnd) / this.gain, Math.max(s + 0.04, endT - 0.01));
      N.linearRampToValueAtTime(0, endT + 0.05);
    }
    if(this.wob){
      const W = this.wob.gain;
      W.setValueAtTime(1, s);
      let j = 0;
      for(let tt = s + 0.09; tt < endT; tt += 0.09) W.linearRampToValueAtTime(1 + this.trem * (hash(n.key, 'w', j++) * 2 - 1), tt);
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
