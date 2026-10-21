'use strict';
/* 楽器：データと音づくり
   管楽器と弦バスは「奏者ごとに1本ずっと鳴っている声」を作り、音の高さ・音量・明るさを動かして吹かせる（スラーやタンギングが表現できる）。
   打楽器と鍵盤、弦バスのピチカートは1打ごとに音を作る。 */

const SECTIONS = [
  {id: 'fl',   name: 'フルート',       short: 'Fl'},
  {id: 'dr',   name: 'ダブルリード',   short: 'Ob/Fg'},
  {id: 'cl',   name: 'クラリネット',   short: 'Cl'},
  {id: 'sax',  name: 'サックス',       short: 'Sax'},
  {id: 'tp',   name: 'トランペット',   short: 'Tp'},
  {id: 'hn',   name: 'ホルン',         short: 'Hn'},
  {id: 'tb',   name: 'トロンボーン',   short: 'Tb'},
  {id: 'low',  name: '低音',           short: 'Euph/Tuba/Cb'},
  {id: 'perc', name: 'パーカッション', short: 'Perc'},
];
const SEC = Object.fromEntries(SECTIONS.map(s => [s.id, s]));

// gain は1人分の最大音量、vib はビブラートの深さ（セント、0ならかけない慣習の楽器）
const INST = {
  picc:  {name: 'ピッコロ',           short: 'Picc',  sec: 'fl',  fam: 'fl',    timbre: 'piccolo', range: [74, 108], gain: .026, vib: 10, vibRate: 5.6},
  fl:    {name: 'フルート',           short: 'Fl',    sec: 'fl',  fam: 'fl',    timbre: 'flute',   range: [60, 96],  gain: .034, vib: 14, vibRate: 5.3},
  ob:    {name: 'オーボエ',           short: 'Ob',    sec: 'dr',  fam: 'reed',  timbre: 'oboe',    range: [58, 91],  gain: .036, vib: 10, vibRate: 5.4},
  fg:    {name: 'ファゴット',         short: 'Fg',    sec: 'dr',  fam: 'reed',  timbre: 'bassoon', range: [34, 75],  gain: .038, vib: 8,  vibRate: 5.0},
  ebcl:  {name: 'E♭クラリネット',     short: 'E♭Cl',  sec: 'cl',  fam: 'clar',  timbre: 'ebclar',  range: [55, 93],  gain: .024, vib: 0},
  cl:    {name: 'クラリネット',       short: 'Cl',    sec: 'cl',  fam: 'clar',  timbre: 'clar',    range: [50, 91],  gain: .03,  vib: 0},
  bcl:   {name: 'バスクラリネット',   short: 'B.Cl',  sec: 'cl',  fam: 'clar',  timbre: 'bclar',   range: [34, 74],  gain: .038, vib: 0},
  asax:  {name: 'アルトサックス',     short: 'A.Sax', sec: 'sax', fam: 'sax',   timbre: 'asax',    range: [49, 81],  gain: .034, vib: 12, vibRate: 5.2},
  tsax:  {name: 'テナーサックス',     short: 'T.Sax', sec: 'sax', fam: 'sax',   timbre: 'tsax',    range: [44, 76],  gain: .036, vib: 12, vibRate: 5.0},
  bsax:  {name: 'バリトンサックス',   short: 'B.Sax', sec: 'sax', fam: 'sax',   timbre: 'bsax',    range: [36, 69],  gain: .04,  vib: 6,  vibRate: 4.8},
  tp:    {name: 'トランペット',       short: 'Tp',    sec: 'tp',  fam: 'brass', timbre: 'trumpet', range: [54, 84],  gain: .046, vib: 4,  vibRate: 5.4},
  hn:    {name: 'ホルン',             short: 'Hn',    sec: 'hn',  fam: 'brass', timbre: 'horn',    range: [35, 77],  gain: .04,  vib: 0},
  tb:    {name: 'トロンボーン',       short: 'Tb',    sec: 'tb',  fam: 'brass', timbre: 'trombone',range: [40, 72],  gain: .046, vib: 4,  vibRate: 5.0},
  btb:   {name: 'バストロンボーン',   short: 'B.Tb',  sec: 'tb',  fam: 'brass', timbre: 'btrombone', range: [28, 67], gain: .05, vib: 0},
  euph:  {name: 'ユーフォニアム',     short: 'Euph',  sec: 'low', fam: 'brass', timbre: 'euph',    range: [40, 72],  gain: .042, vib: 12, vibRate: 5.2},
  tuba:  {name: 'チューバ',           short: 'Tuba',  sec: 'low', fam: 'brass', timbre: 'tuba',    range: [26, 58],  gain: .056, vib: 0},
  cb:    {name: 'コントラバス（弦バス）', short: 'Cb', sec: 'low', fam: 'string', timbre: 'cbass',  range: [28, 60],  gain: .05,  vib: 10, vibRate: 5.0},
  cbpizz:{name: 'コントラバス（ピチカート）', short: 'Cb pizz.', sec: 'low', fam: 'pizz', range: [28, 60], gain: .09, strike: 'cbpizz'},
  timp:  {name: 'ティンパニ',         short: 'Timp',  sec: 'perc', fam: 'perc', range: [38, 57],  gain: .16, strike: 'timp'},
  sd:    {name: 'スネアドラム',       short: 'S.D.',  sec: 'perc', fam: 'perc', gain: .12, strike: 'sd'},
  bd:    {name: 'バスドラム',         short: 'B.D.',  sec: 'perc', fam: 'perc', gain: .3,  strike: 'bd'},
  cym:   {name: '合わせシンバル',     short: 'Cym',   sec: 'perc', fam: 'perc', gain: .2,  strike: 'cym'},
  sus:   {name: 'サスペンデッドシンバル', short: 'Sus.Cym', sec: 'perc', fam: 'perc', gain: .08, strike: 'sus'},
  tri:   {name: 'トライアングル',     short: 'Tri',   sec: 'perc', fam: 'perc', gain: .045, strike: 'tri'},
  tamb:  {name: 'タンブリン',         short: 'Tamb',  sec: 'perc', fam: 'perc', gain: .26, strike: 'tamb'},
  tamtam:{name: 'タムタム',           short: 'T-t',   sec: 'perc', fam: 'perc', gain: .14, strike: 'tamtam'},
  glock: {name: 'グロッケン',         short: 'Glock', sec: 'perc', fam: 'mallet', range: [79, 108], gain: .05, strike: 'glock'},
  xylo:  {name: 'シロフォン',         short: 'Xylo',  sec: 'perc', fam: 'mallet', range: [65, 108], gain: .1, strike: 'xylo'},
  mrb:   {name: 'マリンバ',           short: 'Mrb',   sec: 'perc', fam: 'mallet', range: [45, 96],  gain: .08, strike: 'mrb'},
  vib:   {name: 'ヴィブラフォン',     short: 'Vib',   sec: 'perc', fam: 'mallet', range: [53, 89],  gain: .06, strike: 'vib'},
  chime: {name: 'チャイム',           short: 'Chime', sec: 'perc', fam: 'mallet', range: [60, 77],  gain: .07, strike: 'chime'},
};
for(const v of Object.values(INST)) if(v.range) v.center = (v.range[0] + v.range[1]) / 2;

// 楽譜のパート → 楽器（打楽器パートは担当によって持ち替える）
const PART_INST = {
  picc: 'picc', fl1: 'fl', fl2: 'fl', ob: 'ob', fg: 'fg', ebcl: 'ebcl', cl1: 'cl', cl2: 'cl', cl3: 'cl', bcl: 'bcl',
  asax1: 'asax', asax2: 'asax', tsax: 'tsax', bsax: 'bsax', tp1: 'tp', tp2: 'tp', tp3: 'tp',
  hn1: 'hn', hn2: 'hn', hn3: 'hn', hn4: 'hn', tb1: 'tb', tb2: 'tb', btb: 'btb', euph: 'euph', tuba: 'tuba', cb: 'cb',
  perc1: 'timp', perc2: 'sd', perc3: 'bd', perc4: 'cym',
};
const PART_LABEL = {
  picc: 'ピッコロ', fl1: 'フルート 1st', fl2: 'フルート 2nd', ob: 'オーボエ', fg: 'ファゴット', ebcl: 'E♭クラリネット',
  cl1: 'クラリネット 1st', cl2: 'クラリネット 2nd', cl3: 'クラリネット 3rd', bcl: 'バスクラリネット',
  asax1: 'アルトサックス 1st', asax2: 'アルトサックス 2nd', tsax: 'テナーサックス', bsax: 'バリトンサックス',
  tp1: 'トランペット 1st', tp2: 'トランペット 2nd', tp3: 'トランペット 3rd',
  hn1: 'ホルン 1st', hn2: 'ホルン 2nd', hn3: 'ホルン 3rd', hn4: 'ホルン 4th',
  tb1: 'トロンボーン 1st', tb2: 'トロンボーン 2nd', btb: 'バストロンボーン', euph: 'ユーフォニアム', tuba: 'チューバ', cb: 'コントラバス',
  perc1: 'パーカッション1（ティンパニ）', perc2: 'パーカッション2（スネア・小物）', perc3: 'パーカッション3（大太鼓・鍵盤）', perc4: 'パーカッション4（シンバル・鍵盤）',
};

/* 音色：倍音の並び（h）、強弱で動く明るさ（cut は基音の何倍まで通すか）、楽器の胴の響き（form）、息やリードの雑音 */
const TIMBRE = {
  flute:     {h: [1,.42,.16,.08,.04,.02,.012,.006], cut: [3, 8],   q: .5, att: .06,  rel: .12, noise: .16, nMul: 3.5, nMin: 2200, form: [], glide: .025, crack: 'over'},
  piccolo:   {h: [1,.36,.12,.05,.02,.01],          cut: [3, 7],   q: .5, att: .05,  rel: .1,  noise: .12, nMul: 3,   nMin: 3500, form: [], glide: .02, crack: 'over'},
  oboe:      {h: [.55,1,.92,.72,.6,.5,.42,.35,.28,.22,.18,.14,.11,.08], cut: [6, 16], q: .6, att: .03, rel: .08, noise: .04, nMul: 4, nMin: 2500, form: [[1150, 7, 1.8], [2900, 4, 2.5]], glide: .02, crack: 'over'},
  bassoon:   {h: [.6,1,.85,.62,.5,.42,.33,.25,.2,.16,.12,.1], cut: [5, 12], q: .6, att: .035, rel: .1, noise: .04, nMul: 5, nMin: 1500, form: [[480, 7, 1.5], [1150, 4, 2]], glide: .025, crack: 'over'},
  clar:      {h: [1,.07,.72,.06,.46,.08,.28,.09,.18,.08,.12,.07,.08,.05], cut: [4, 13], q: .6, att: .04, rel: .1, noise: .05, nMul: 4, nMin: 2000, form: [[1500, 2.5, 1.2]], glide: .02, crack: 'squeak'},
  ebclar:    {h: [1,.1,.66,.08,.44,.1,.28,.1,.18,.08], cut: [4, 12], q: .6, att: .035, rel: .09, noise: .05, nMul: 4, nMin: 2500, form: [[2000, 3, 1.4]], glide: .02, crack: 'squeak'},
  bclar:     {h: [1,.05,.8,.05,.52,.06,.32,.06,.2,.05], cut: [3.5, 9], q: .6, att: .045, rel: .12, noise: .04, nMul: 5, nMin: 1200, form: [[700, 3, 1]], glide: .025, crack: 'squeak'},
  asax:      {h: [1,.8,.7,.56,.46,.4,.33,.28,.23,.19,.16,.13,.11,.09], cut: [4, 14], q: .6, att: .03, rel: .1, noise: .07, nMul: 4, nMin: 2000, form: [[850, 5, 1.2], [2600, 4, 2]], glide: .02, crack: 'over'},
  tsax:      {h: [1,.8,.7,.56,.46,.4,.33,.28,.23,.19,.16,.13,.11,.09], cut: [4, 13], q: .6, att: .032, rel: .1, noise: .07, nMul: 4, nMin: 1600, form: [[620, 5, 1.2], [2200, 3, 2]], glide: .02, crack: 'over'},
  bsax:      {h: [1,.82,.72,.58,.47,.4,.33,.27,.22,.18,.14,.11], cut: [4, 11], q: .6, att: .035, rel: .12, noise: .06, nMul: 5, nMin: 1200, form: [[420, 5, 1.2], [1600, 3, 2]], glide: .025, crack: 'over'},
  trumpet:   {h: [1,.95,.86,.78,.68,.58,.48,.4,.33,.27,.22,.18,.15,.12,.1,.08], cut: [2.4, 12], q: .8, att: .028, rel: .09, noise: .025, nMul: 4, nMin: 2500, form: [[1300, 4, 1]], glide: .03, crack: 'brass', brass: true},
  horn:      {h: [1,.72,.48,.3,.19,.12,.08,.05,.03], cut: [2, 5.5], q: .7, att: .055, rel: .14, noise: .015, nMul: 4, nMin: 1500, form: [[420, 4, 1]], glide: .04, crack: 'brass', brass: true},
  trombone:  {h: [1,.9,.76,.63,.52,.42,.32,.25,.19,.14,.1,.07], cut: [2.2, 9], q: .8, att: .035, rel: .11, noise: .02, nMul: 4, nMin: 1500, form: [[560, 4, 1.2]], glide: .07, crack: 'brass', brass: true},
  btrombone: {h: [1,.9,.74,.6,.48,.38,.28,.2,.15,.1], cut: [2, 7], q: .8, att: .04, rel: .12, noise: .02, nMul: 4, nMin: 1200, form: [[400, 4, 1]], glide: .07, crack: 'brass', brass: true},
  euph:      {h: [1,.62,.36,.21,.12,.07,.04,.025], cut: [2.5, 6], q: .6, att: .045, rel: .14, noise: .015, nMul: 4, nMin: 1500, form: [[480, 3, 1]], glide: .035, crack: 'brass', brass: true},
  tuba:      {h: [1,.68,.42,.27,.17,.1,.06,.04], cut: [3, 8], q: .6, att: .05, rel: .16, noise: .015, nMul: 5, nMin: 800, form: [[240, 3, 1]], glide: .04, crack: 'brass', brass: true},
  cbass:     {h: Array.from({length: 16}, (_, i) => 1 / (i + 1)), cut: [5, 14], q: .6, att: .09, rel: .18, noise: .05, nMul: 6, nMin: 1500, form: [[260, 5, 1.2], [700, 3, 1.5]], glide: .04, crack: null},
};

// 倍音の並びに、楽器の胴の響き（固定の周波数で持ち上がる帯域）を焼き込んだ波形。音域ごとに作り分ける
const PW_CACHE = new WeakMap();
function formantGain(t, f){
  let g = 1;
  for(const [ff, db, q] of t.form){
    const x = Math.log2(f / ff) * q * 1.2;
    g *= 1 + (Math.pow(10, db / 20) - 1) * Math.exp(-x * x);
  }
  return g;
}
function periodicWave(ac, name, midi){
  let c = PW_CACHE.get(ac);
  if(!c){ c = {}; PW_CACHE.set(ac, c); }
  const band = Math.round(midi / 6) * 6;
  const key = name + ':' + band;
  if(!c[key]){
    const t = TIMBRE[name], f0 = mtof(band);
    const real = new Float32Array(t.h.length + 1), imag = new Float32Array(t.h.length + 1);
    for(let i = 0; i < t.h.length; i++) imag[i + 1] = t.h[i] * formantGain(t, f0 * (i + 1));
    c[key] = ac.createPeriodicWave(real, imag);
  }
  return c[key];
}
const NOISE_CACHE = new WeakMap();
function noiseBuf(ac){
  let b = NOISE_CACHE.get(ac);
  if(!b){
    b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = b.getChannelData(0);
    let s = 12345;
    for(let i = 0; i < d.length; i++){ s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = s / 0x3fffffff - 1; }
    NOISE_CACHE.set(ac, b);
  }
  return b;
}
function makePan(ac, pan){
  if(!ac.createStereoPanner) return ac.createGain();
  const p = ac.createStereoPanner(); p.pan.value = pan;
  return p;
}

/* ===== 管楽器・弦バス：奏者1人ぶんの声 =====
   音の高さ・明るさは音の出だしだけなめらかに動かし、あとは段階的に変える（重い計算を減らすため）。
   ビブラートはかける音にだけ付ける。 */
class WindVoice {
  constructor(ac, dest, instId, opts){
    this.ac = ac;
    this.inst = INST[instId];
    this.tb = TIMBRE[this.inst.timbre];
    this.gain = this.inst.gain;
    this.srcs = [];
    const osc = this.osc = ac.createOscillator();
    osc.setPeriodicWave(periodicWave(ac, this.inst.timbre, opts.midi || this.inst.center));
    const lp = this.lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = this.tb.q;
    const amp = this.amp = ac.createGain(); amp.gain.value = 0;
    osc.connect(lp); lp.connect(amp);
    let node = amp;
    if(opts.trem > 0.05){
      this.wob = ac.createGain(); this.trem = opts.trem;
      node.connect(this.wob); node = this.wob;
    }
    node.connect(dest);
    this.srcs.push(osc);
    const noise = this.tb.noise * (opts.noise ?? 1);
    if(noise > 0.01){
      const src = ac.createBufferSource(); src.buffer = noiseBuf(ac); src.loop = true;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.8;
      bp.frequency.value = Math.max(this.tb.nMin, mtof(opts.midi || this.inst.center) * this.tb.nMul);
      const ng = ac.createGain(); ng.gain.value = noise;
      src.connect(bp); bp.connect(ng); ng.connect(amp);
      this.noiseSrc = src; this.srcs.push(src);
    }
    this.vibRate = (this.inst.vibRate || 5) * (opts.vibRateMul || 1);
    this.lastLv = 0; this.lastF = 0; this.lastCents = 0;
  }
  start(t){
    this.osc.start(t);
    if(this.noiseSrc) this.noiseSrc.start(t, (t * 13.7) % 1.5);
  }
  stop(t){ for(const s of this.srcs){ try{ s.stop(t); }catch(e){} } }

  // n: 1音（時刻は演奏の頭からの秒）、next: 次の音、T0: 演奏開始の絶対時刻
  play(n, next, T0){
    const ac = this.ac, tb = this.tb;
    const s = T0 + n.t;
    const nextS = next ? T0 + next.t : Infinity;
    const joined = !!n.join && this.lastF > 0;
    const legNext = !!(next && next.join);
    const endT = Math.max(s + 0.02, Math.min(T0 + n.t + n.d, nextS - 0.004));
    const f = mtof(n.midi);
    const lv = v => this.gain * (0.03 + 0.97 * Math.pow(v, 1.8));
    const cut = v => clamp(f * lerp(tb.cut[0], tb.cut[1], v) * n.bright, 120, 12000);
    const env = n.env, v0 = env[0][1], vEnd = env[env.length - 1][1];
    const smooth = joined && (n.slur || n.art === 'tie');

    const F = this.osc.frequency;
    if(smooth && n.art !== 'tie'){ F.setValueAtTime(this.lastF, s); F.exponentialRampToValueAtTime(f, s + tb.glide); }
    else F.setValueAtTime(f, s);

    // 音程：ひっくり返り → ずり上がって落ち着く → 息が続かず下がる（段階的に）
    const D = this.osc.detune;
    let ts = s;
    if(n.art === 'tie' && joined){
      D.setValueAtTime(this.lastCents, s);
      ts = Math.min(s + 0.1, endT);
      D.linearRampToValueAtTime(n.cents, ts);
    } else {
      if(n.crack){
        D.setValueAtTime(n.cents + n.crack, s);
        D.setValueAtTime(n.cents + n.crack, s + n.crackDur);
        ts = s + n.crackDur + 0.02;
        D.linearRampToValueAtTime(n.cents + n.scoop * 0.4, ts);
      } else {
        D.setValueAtTime(n.cents + (smooth ? n.scoop * 0.3 : n.scoop), s);
      }
      const tSet = Math.min(ts + n.settle, endT - 0.002);
      if(tSet > ts){ D.linearRampToValueAtTime(n.cents, tSet); ts = tSet; }
    }
    let lastC = n.cents;
    if(Math.abs(n.sag) > 3 && endT - s > 0.5){
      D.setValueAtTime(n.cents + n.sag * 0.45, Math.max(ts + 0.01, s + (endT - s) * 0.6));
      D.setValueAtTime(n.cents + n.sag, Math.max(ts + 0.02, s + (endT - s) * 0.85));
      lastC = n.cents + n.sag;
    }

    const A = this.amp.gain, L = this.lp.frequency;
    if(smooth){
      A.linearRampToValueAtTime(lv(v0), s + 0.05);
      L.setValueAtTime(cut(v0), s);
    } else if(joined){
      const dip = n.art === 'ten' ? 0.45 : 0.15;
      A.linearRampToValueAtTime(this.lastLv * dip, s + 0.012);
      A.linearRampToValueAtTime(lv(v0) * n.blat, s + 0.012 + n.att);
      L.setValueAtTime(cut(v0) * 0.75, s + 0.012);
      L.linearRampToValueAtTime(cut(v0) * Math.sqrt(n.blat), s + 0.012 + n.att * 1.5);
    } else {
      A.setValueAtTime(0, s);
      A.linearRampToValueAtTime(lv(v0) * n.blat, s + n.att);
      L.setValueAtTime(tb.brass ? f * 1.15 : cut(v0) * 0.7, s);
      L.linearRampToValueAtTime(cut(v0) * Math.sqrt(n.blat), s + n.att * 1.5);
    }
    const after = s + n.att * 1.5 + 0.03;
    let k = 0;
    for(const [dt, v] of env){
      const tt = s + dt;
      if(tt <= after || tt >= endT - 0.002 || (k++ % 2)) continue;
      A.linearRampToValueAtTime(lv(v), tt);
      L.setValueAtTime(cut(v), tt);
    }
    const endA = Math.min(Math.max(endT, after + 0.002), nextS - 0.003);
    A.linearRampToValueAtTime(lv(vEnd), endA);
    if(!legNext){
      const rEnd = Math.min(endA + tb.rel, nextS - 0.003);
      A.linearRampToValueAtTime(0, Math.max(rEnd, endA + 0.002));
    }

    if(n.vib > 0.5 && endT - s > 0.6){
      const on = s + Math.min(0.35, (endT - s) * 0.3);
      const lfo = ac.createOscillator(); lfo.frequency.value = this.vibRate;
      const vg = ac.createGain();
      vg.gain.setValueAtTime(0, on);
      vg.gain.linearRampToValueAtTime(n.vib, Math.min(endT, on + 0.4));
      vg.gain.setValueAtTime(n.vib, endT - 0.01);
      vg.gain.linearRampToValueAtTime(0, endT);
      lfo.connect(vg); vg.connect(D);
      lfo.start(on); lfo.stop(endT + 0.01);
      lfo.onended = () => { try{ vg.disconnect(); }catch(e){} };
      this.srcs.push(lfo);
    }
    if(this.wob){
      const W = this.wob.gain;
      W.setValueAtTime(1, s);
      let j = 0;
      for(let tt = s + 0.09; tt < endT; tt += 0.09) W.linearRampToValueAtTime(1 + this.trem * (hash(n.key, 'w', j++) * 2 - 1), tt);
    }
    this.lastLv = lv(vEnd); this.lastF = f; this.lastCents = lastC;
    return endA + tb.rel;
  }
}

/* ===== 打楽器・鍵盤・ピチカート：1打ぶんの音 ===== */
function decayEnv(ac, g, s, peak, atk, tau){
  g.gain.setValueAtTime(0, s);
  g.gain.linearRampToValueAtTime(peak, s + atk);
  g.gain.setTargetAtTime(0, s + atk, tau);
  return s + atk + tau * 7;
}
function partials(ac, out, s, f, list, peak, srcs, cents = 0, glide = 0){
  let end = s;
  for(const [r, a, tau] of list){
    const o = ac.createOscillator(); o.frequency.value = f * r;
    if(glide){ o.detune.setValueAtTime(cents + glide, s); o.detune.linearRampToValueAtTime(cents, s + 0.12); }
    else o.detune.value = cents;
    const g = ac.createGain();
    const e = decayEnv(ac, g, s, peak * a, 0.003, tau);
    o.connect(g); g.connect(out);
    o.start(s); o.stop(e); srcs.push(o);
    end = Math.max(end, e);
  }
  return end;
}
function noiseHit(ac, out, s, peak, tau, filters, srcs, atk = 0.002){
  const src = ac.createBufferSource(); src.buffer = noiseBuf(ac); src.loop = true;
  let node = src;
  for(const [type, f, q] of filters){
    const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; if(q) b.Q.value = q;
    node.connect(b); node = b;
  }
  const g = ac.createGain();
  const e = decayEnv(ac, g, s, peak, atk, tau);
  node.connect(g); g.connect(out);
  src.start(s, (s * 7.3) % 1.5); src.stop(e); srcs.push(src);
  return e;
}
// ロール：雑音を共鳴させ、1打ずつの粒（rate）と強弱の流れ（v→v1）をつける
function noiseRoll(ac, out, s, d, v0, v1, lvl, filters, rate, depth, tail, srcs, key){
  const src = ac.createBufferSource(); src.buffer = noiseBuf(ac); src.loop = true;
  const sum = ac.createGain();
  for(const [type, f, q, g] of filters){
    const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; if(q) b.Q.value = q;
    const bg = ac.createGain(); bg.gain.value = g ?? 1;
    src.connect(b); b.connect(bg); bg.connect(sum);
  }
  const am = ac.createGain();
  const env = ac.createGain();
  sum.connect(am); am.connect(env); env.connect(out);
  let k = 0;
  for(let t = s; t < s + d; t += 1 / rate, k++){
    const a = 1 + depth * (k % 2 ? 0.6 : 1) * (0.7 + 0.6 * hash(key, k));
    am.gain.setValueAtTime(a, t);
    am.gain.setTargetAtTime(1 - depth * 0.5, t + 0.004, 0.25 / rate);
  }
  env.gain.setValueAtTime(0, s);
  env.gain.linearRampToValueAtTime(lvl(v0), s + 0.04);
  env.gain.linearRampToValueAtTime(lvl(v1), s + d);
  env.gain.setTargetAtTime(0, s + d, tail);
  const e = s + d + tail * 6;
  src.start(s, (s * 3.1) % 1.5); src.stop(e); srcs.push(src);
  return e;
}

const STRIKE = {
  timp(ac, out, h, s, srcs, lvl){
    const f = mtof(h.midi);
    if(h.roll){
      return noiseRoll(ac, out, s, h.dur, h.v, h.v1, v => lvl(v) * 9, [['bandpass', f * Math.pow(2, h.cents / 1200), 40, 1], ['bandpass', f * 1.504, 30, .5], ['bandpass', f * 2, 30, .35], ['lowpass', 180, .7, .25]], 13, h.uneven, 0.6, srcs, h.key);
    }
    noiseHit(ac, out, s, lvl(h.v) * 0.5, 0.03, [['lowpass', 300]], srcs);
    return partials(ac, out, s, f, [[1, 1, 1.6], [1.504, .45, 1.0], [1.742, .3, .8], [2.0, .32, .9], [2.245, .16, .6], [2.494, .12, .5]], lvl(h.v), srcs, h.cents, 15);
  },
  sd(ac, out, h, s, srcs, lvl){
    if(h.roll) return noiseRoll(ac, out, s, h.dur, h.v, h.v1, v => lvl(v) * 1.2, [['highpass', 1500, .7], ['bandpass', 4200, .6]], 19, .35 + h.uneven, 0.06, srcs, h.key);
    noiseHit(ac, out, s, lvl(h.v), 0.07, [['highpass', 1500], ['bandpass', 4200, .6]], srcs);
    const o = ac.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(210, s); o.frequency.exponentialRampToValueAtTime(175, s + 0.05);
    const g = ac.createGain(); const e = decayEnv(ac, g, s, lvl(h.v) * 0.8, 0.002, 0.045);
    o.connect(g); g.connect(out); o.start(s); o.stop(e); srcs.push(o);
    return Math.max(e, s + 0.6);
  },
  bd(ac, out, h, s, srcs, lvl){
    if(h.roll) return noiseRoll(ac, out, s, h.dur, h.v, h.v1, v => lvl(v) * 6, [['bandpass', 55, 8, 1], ['lowpass', 140, .7, .4]], 10, h.uneven, 0.5, srcs, h.key);
    const o = ac.createOscillator();
    o.frequency.setValueAtTime(92, s); o.frequency.exponentialRampToValueAtTime(56, s + 0.06);
    const g = ac.createGain(); const e = decayEnv(ac, g, s, lvl(h.v), 0.004, 0.38);
    o.connect(g); g.connect(out); o.start(s); o.stop(e); srcs.push(o);
    noiseHit(ac, out, s, lvl(h.v) * 0.35, 0.03, [['lowpass', 500]], srcs);
    return e;
  },
  cym(ac, out, h, s, srcs, lvl, soft){
    const e1 = noiseHit(ac, out, s, lvl(h.v), soft ? 1.2 : 0.9, [['highpass', 3000], ['bandpass', 8500, .4]], srcs, soft ? 0.02 : 0.002);
    const bus = ac.createGain();
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000;
    const g = ac.createGain(); const e2 = decayEnv(ac, g, s, lvl(h.v) * 0.25, soft ? 0.02 : 0.002, 0.6);
    bus.connect(hp); hp.connect(g); g.connect(out);
    for(const r of [205.3, 304.4, 369.6, 522.7, 540, 800]){
      const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = r * 1.7;
      o.connect(bus); o.start(s); o.stop(e2); srcs.push(o);
    }
    return Math.max(e1, e2);
  },
  sus(ac, out, h, s, srcs, lvl){
    if(h.roll) return noiseRoll(ac, out, s, h.dur, h.v, h.v1, v => lvl(v) * 1.4, [['highpass', 2500, .7], ['bandpass', 6000, .5]], 16, .12 + h.uneven * 0.5, 1.0, srcs, h.key);
    return STRIKE.cym(ac, out, h, s, srcs, lvl, true);
  },
  tri(ac, out, h, s, srcs, lvl){
    noiseHit(ac, out, s, lvl(h.v) * 0.3, 0.005, [['highpass', 6000]], srcs);
    return partials(ac, out, s, 1180, [[1, .6, 1.4], [2.41, .4, 1.1], [3.81, .35, .9], [5.25, .25, .7], [6.86, .15, .5]], lvl(h.v), srcs);
  },
  tamb(ac, out, h, s, srcs, lvl){
    noiseHit(ac, out, s, lvl(h.v), 0.12, [['bandpass', 7000, 2]], srcs);
    noiseHit(ac, out, s + 0.01, lvl(h.v) * 0.6, 0.08, [['bandpass', 10500, 3]], srcs);
    return noiseHit(ac, out, s, lvl(h.v) * 0.4, 0.03, [['bandpass', 300, 1]], srcs);
  },
  tamtam(ac, out, h, s, srcs, lvl){
    const peak = lvl(h.v);
    const src = ac.createBufferSource(); src.buffer = noiseBuf(ac); src.loop = true;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 180; bp.Q.value = .7;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(peak * .35, s + .01); g.gain.linearRampToValueAtTime(peak, s + .5); g.gain.setTargetAtTime(0, s + .5, 1.8);
    src.connect(lp); lp.connect(bp); bp.connect(g); g.connect(out);
    const e = s + 0.5 + 1.8 * 6;
    src.start(s); src.stop(e); srcs.push(src);
    for(const f of [96, 141, 183, 229, 302, 378, 455]){
      const o = ac.createOscillator(); o.frequency.value = f;
      const og = ac.createGain();
      og.gain.setValueAtTime(0, s); og.gain.linearRampToValueAtTime(peak * .12, s + .6); og.gain.setTargetAtTime(0, s + .6, 2.2);
      o.connect(og); og.connect(out); o.start(s); o.stop(e); srcs.push(o);
    }
    return e;
  },
  glock(ac, out, h, s, srcs, lvl){
    noiseHit(ac, out, s, lvl(h.v) * 0.2, 0.004, [['highpass', 7000]], srcs);
    return partials(ac, out, s, mtof(h.midi), [[1, 1, 1.2], [2.756, .22, .35], [5.404, .08, .12]], lvl(h.v), srcs);
  },
  xylo(ac, out, h, s, srcs, lvl){
    noiseHit(ac, out, s, lvl(h.v) * 0.3, 0.004, [['highpass', 4000]], srcs);
    return partials(ac, out, s, mtof(h.midi), [[1, 1, .22], [3.0, .32, .08], [6.2, .1, .03]], lvl(h.v), srcs);
  },
  mrb(ac, out, h, s, srcs, lvl){
    noiseHit(ac, out, s, lvl(h.v) * 0.15, 0.01, [['lowpass', 800]], srcs);
    return partials(ac, out, s, mtof(h.midi), [[1, 1, .55], [3.98, .22, .15], [9.85, .05, .05]], lvl(h.v), srcs);
  },
  vib(ac, out, h, s, srcs, lvl){
    const trem = ac.createGain(); trem.gain.value = 0.78;
    const lfo = ac.createOscillator(); lfo.frequency.value = 5.5;
    const lg = ac.createGain(); lg.gain.value = 0.22;
    lfo.connect(lg); lg.connect(trem.gain); trem.connect(out);
    const e = partials(ac, trem, s, mtof(h.midi), [[1, 1, 2.4], [4.0, .18, .6], [10, .04, .15]], lvl(h.v), srcs);
    lfo.start(s); lfo.stop(e); srcs.push(lfo);
    return e;
  },
  chime(ac, out, h, s, srcs, lvl){
    noiseHit(ac, out, s, lvl(h.v) * 0.25, 0.006, [['highpass', 3000]], srcs);
    return partials(ac, out, s, mtof(h.midi), [[1, .28, 4.0], [2, .55, 3.5], [3, .48, 2.8], [4.2, .33, 2.0], [5.4, .2, 1.4], [6.8, .12, 1.0]], lvl(h.v), srcs);
  },
  cbpizz(ac, out, h, s, srcs, lvl){
    noiseHit(ac, out, s, lvl(h.v) * 0.25, 0.015, [['lowpass', 400]], srcs);
    return partials(ac, out, s, mtof(h.midi), [[1, 1, .45], [2, .5, .3], [3, .3, .2], [4, .18, .15], [5, .1, .1]], lvl(h.v), srcs, h.cents);
  },
};
function strike(ac, out, h, T0, srcs){
  if(typeof sampleCfg === 'function' && sampleCfg(h.inst)) return sampleStrike(ac, out, h, T0, srcs);
  const inst = INST[h.inst];
  const lvl = v => inst.gain * (0.04 + 0.96 * Math.pow(clamp01(v), 1.6));
  return STRIKE[inst.strike](ac, out, h, T0 + h.t, srcs, lvl);
}
