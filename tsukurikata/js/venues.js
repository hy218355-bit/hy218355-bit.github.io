'use strict';
/* 会場の響き
   会場ごとに残響（インパルス応答）をその場で作る。低音・中音・高音で残響の長さを変え、
   初期反射、体育館の「鳴き」（平行な壁の間を行き来するはね返り）、屋外の校舎からのはね返りを加える。 */

const VENUES = [
  {id: 'room', name: '音楽室', rt: 0.95, bass: 1.15, treble: .55, pre: .005, diffuse: .02,
   er: {n: 16, spread: .03, g: .32}, eq: [['peaking', 220, 3, 1], ['highshelf', 5000, 1.5]], wet: .36, dry: 1.0,
   play: {timing: 1.0, pitch: 1.0}, size: '約80m²',
   desc: '響きが短く、音が近い。金管がうるさく聞こえやすく、ごまかしがききにくい。'},
  {id: 'gym', name: '体育館', rt: 2.9, bass: 1.3, treble: .42, pre: .04, diffuse: .09,
   er: {n: 8, spread: .14, g: .3}, flutter: {t0: .07, period: .072, n: 26, g: .2}, eq: [['peaking', 150, 3.5, .9], ['highshelf', 4000, -3]], wet: .62, dry: .72,
   play: {timing: 1.45, pitch: 1.05}, size: '天井高10m',
   desc: '天井が高く、響きは長いがぼやける。壁ではね返る「鳴き」があり、奏者どうしの音が聞こえにくい。'},
  {id: 'outdoor', name: '屋外ステージ', rt: 0.1, bass: .7, treble: .5, pre: 0, diffuse: .01,
   er: {n: 3, spread: .02, g: .25}, slap: {t: .21, g: .16}, eq: [['lowshelf', 180, -5], ['highshelf', 6000, -2]], wet: .14, dry: 1.0,
   play: {timing: 1.15, pitch: 1.15}, size: '校庭', irLvl: {podium: .9, center: .67, back: .5},
   desc: '響きがほとんどなく、音が散っていく。少し遅れて校舎からのはね返りが返ってくる。'},
  {id: 'civic', name: '市民会館', rt: 1.5, bass: 1.05, treble: .62, pre: .02, diffuse: .05,
   er: {n: 12, spread: .06, g: .26}, eq: [], wet: .42, dry: .85,
   play: {timing: 1.05, pitch: 1.0}, size: '800席',
   desc: '多目的ホール。響きはやや短めで、細かいところまで聞こえる。'},
  {id: 'camp', name: '合宿所ホール', rt: 1.1, bass: 1.15, treble: .68, pre: .012, diffuse: .035,
   er: {n: 14, spread: .045, g: .3}, eq: [['peaking', 300, 1.5, .8]], wet: .4, dry: .9,
   play: {timing: 1.0, pitch: 1.0}, size: '木の小ホール',
   desc: '木の内装の小ホール。響きは柔らかく、合奏の練習に向いている。'},
  {id: 'hall', name: '県民文化会館', rt: 2.1, bass: 1.2, treble: .6, pre: .026, diffuse: .07,
   er: {n: 18, spread: .09, g: .24}, eq: [['lowshelf', 250, 1.5]], wet: .5, dry: .78,
   play: {timing: 1.08, pitch: 1.0, hall: true}, size: '1500席',
   desc: '県大会の会場。豊かで温かい響きが約2秒続く。'},
  {id: 'grand', name: '大ホール（支部・全国）', rt: 2.8, bass: 1.25, treble: .64, pre: .034, diffuse: .08,
   er: {n: 20, spread: .11, g: .22}, eq: [['lowshelf', 250, 2]], wet: .55, dry: .7,
   play: {timing: 1.1, pitch: 1.0, hall: true}, size: '2000席',
   desc: '支部大会・全国大会の会場。響きは長く、ステージが遠く感じる。'},
];
const VENUE = Object.fromEntries(VENUES.map(v => [v.id, v]));

const POSITIONS = [
  {id: 'podium', name: '指揮台',     dry: 1.15, wet: .6,  hf: 16000, hfIR: 18000, width: 1.0},
  {id: 'center', name: '客席の中央', dry: .8,   wet: 1.0, hf: 9000,  hfIR: 12000, width: .75},
  {id: 'back',   name: '客席の後ろ', dry: .5,   wet: 1.3, hf: 5500,  hfIR: 9000, width: .5},
];
const POSITION = Object.fromEntries(POSITIONS.map(p => [p.id, p]));

const IR_CACHE = new WeakMap();
function makeIR(ac, v){
  let cache = IR_CACHE.get(ac);
  if(!cache){ cache = {}; IR_CACHE.set(ac, cache); }
  if(cache[v.id]) return cache[v.id];
  const sr = ac.sampleRate;
  const len = Math.ceil(sr * Math.min(4.5, v.rt * 1.25 + v.pre + 0.1));
  const buf = ac.createBuffer(2, len, sr);
  const tL = v.rt * v.bass, tM = v.rt, tH = v.rt * v.treble;
  const kL = 1 - Math.exp(-2 * Math.PI * 250 / sr), kH = 1 - Math.exp(-2 * Math.PI * 2500 / sr);
  let energy = 0;
  for(let ch = 0; ch < 2; ch++){
    const d = buf.getChannelData(ch);
    let seed = 7 + ch * 99991 + v.id.length * 31;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x3fffffff - 1; };
    const preN = Math.floor(v.pre * sr), build = Math.max(1, Math.floor(v.diffuse * sr));
    let lpL = 0, lpH = 0;
    for(let i = preN; i < len; i++){
      const t = (i - preN) / sr;
      const n = rnd();
      lpL += kL * (n - lpL); lpH += kH * (n - lpH);
      const low = lpL, mid = lpH - lpL, high = n - lpH;
      const g = (i - preN) < build ? (i - preN) / build : 1;
      d[i] = g * (1.6 * low * Math.exp(-6.91 * t / tL) + mid * Math.exp(-6.91 * t / tM) + 0.9 * high * Math.exp(-6.91 * t / tH));
    }
    // はね返りの強さは残響全体のエネルギーに対する割合で決める
    let tail = 0;
    for(let i = 0; i < len; i++) tail += d[i] * d[i];
    // 反射1つは、壁で高音が少し吸われた短いかたまりとして置く（1点だけだと金属的に聞こえる）
    const SHAPE = [1, 0.72, 0.5, 0.34, 0.22, 0.14, 0.08, 0.04];
    const s2 = SHAPE.reduce((a, x) => a + x * x, 0);
    const taps = (list, frac) => {
      const w2 = list.reduce((a, [, w]) => a + w * w, 0) * s2;
      const k = Math.sqrt(tail * frac / w2);
      for(const [i, w] of list) for(let j = 0; j < SHAPE.length; j++) if(i + j < len) d[i + j] += k * w * SHAPE[j];
    };
    // 初期反射：壁・床・天井からの最初のはね返り
    taps(Array.from({length: v.er.n}, (_, k) => [
      Math.floor((v.pre * 0.5 + 0.002 + hash(v.id, ch, k, 't') * v.er.spread) * sr),
      Math.pow(1 - k / v.er.n, 1.5) * (hash(v.id, ch, k, 's') < .5 ? -1 : 1),
    ]), v.er.g);
    if(v.flutter){
      taps(Array.from({length: v.flutter.n}, (_, k) => [
        Math.floor((v.flutter.t0 + k * v.flutter.period + (ch ? 0.0007 : 0)) * sr),
        Math.pow(0.86, k) * (k % 2 ? -1 : 1),
      ]), v.flutter.g);
    }
    if(v.slap){
      const i0 = Math.floor((v.slap.t + (ch ? 0.004 : 0)) * sr);
      taps(Array.from({length: 40}, (_, j) => [i0 + j, Math.exp(-j / 8) * (j % 2 ? -0.6 : 1)]), v.slap.g);
    }
    for(let i = 0; i < len; i++) energy += d[i] * d[i];
  }
  const norm = 1 / Math.sqrt(energy / 2);
  for(let ch = 0; ch < 2; ch++){
    const d = buf.getChannelData(ch);
    for(let i = 0; i < len; i++) d[i] *= norm;
  }
  return (cache[v.id] = buf);
}

/* ===== 物理シミュレーションで作った響き（7会場×3つの聴く位置） =====
   部屋の寸法と壁・床・天井・客席の材質から計算したインパルス応答（直接音は取り除いてある）。
   後半の響きの量は、実際のホールで測られる明瞭さ（C80）の範囲に合わせてある。
   ir.json の mus は「直接音を1としたときの、合奏の音に対する響きの量」、wetGain は書き出し時に正規化した倍率。 */
const VIR = {man: null, raw: {}, loading: null, error: null};
function loadVenueIRs(base){
  if(VIR.loading) return VIR.loading;
  VIR.loading = (async () => {
    const man = await (await fetch(base + 'ir.json')).json();
    await Promise.all(Object.entries(man.venues).flatMap(([vid, ps]) => Object.keys(ps).map(async pos => {
      VIR.raw[vid + '_' + pos] = await (await fetch(`${base}${vid}_${pos}.mp3`)).arrayBuffer();
    })));
    VIR.man = man;
  })().catch(e => { VIR.error = e; });
  return VIR.loading;
}
const VIR_CACHE = new WeakMap();
// その会場・位置の響きを、再生環境のサンプリング周波数でデコードして返す。まだなら null を返し、できたら onReady を呼ぶ
function venueIR(ac, vid, pos, onReady){
  const key = vid + '_' + pos;
  let c = VIR_CACHE.get(ac);
  if(!c){ c = {}; VIR_CACHE.set(ac, c); }
  if(c[key] && c[key].buf) return c[key].buf;
  if(!c[key] && VIR.man && VIR.raw[key]){
    c[key] = {};
    decodeBuf(ac, VIR.raw[key].slice(0)).then(buf => {
      const sr = buf.sampleRate, info = VIR.man.venues[vid][pos];
      // MP3の頭の無音は環境で違うので、書き出し時に入れた目印のクリックから位置を合わせる
      const d0 = buf.getChannelData(0);
      let mark = 0, mv = 0;
      for(let i = 0; i < Math.min(d0.length, Math.floor((VIR.man.mark + 0.06) * sr)); i++){ const a = Math.abs(d0[i]); if(a > mv){ mv = a; mark = i; } }
      const start = mark + Math.round((VIR.man.lead - VIR.man.mark) * sr);
      const n = Math.max(1, Math.min(Math.round(info.len * sr), buf.length - start));
      const out = ac.createBuffer(2, n, sr);
      for(let ch = 0; ch < 2; ch++) out.copyToChannel(buf.getChannelData(Math.min(ch, buf.numberOfChannels - 1)).subarray(start, start + n), ch);
      c[key].buf = out;
      if(onReady) onReady();
    }, () => { c[key].error = true; });
  }
  return null;
}

// 会場の出口。会場や聴く位置を切り替えると、古い響きから新しい響きへなめらかに入れ替える。
// input は直接音＋響き、wetIn は響きだけに送る入口（ステージの奥の列ほど多く送る）
class VenueChain {
  constructor(ac, dest){
    this.ac = ac;
    this.input = ac.createGain();
    this.wetIn = ac.createGain();
    this.sum = ac.createGain();
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 12; comp.ratio.value = 2.5; comp.attack.value = 0.02; comp.release.value = 0.35;
    this.master = ac.createGain(); this.master.gain.value = 1.8;
    // 最後に音割れを防ぐリミッター（全員でffを吹いても0dBを越えない）
    const lim = ac.createDynamicsCompressor();
    lim.threshold.value = -4; lim.knee.value = 2; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.2;
    this.sum.connect(comp); comp.connect(this.master); this.master.connect(lim); lim.connect(dest || ac.destination);
    this.stage = null;
    this.venueId = null; this.posId = 'center';
  }
  set(venueId, posId = this.posId, fade = 0.4, force = false){
    const ac = this.ac, v = VENUE[venueId], p = POSITION[posId];
    if(this.stage && this.venueId === venueId && this.posId === posId && !force) return;
    this.venueId = venueId; this.posId = posId;
    const ir = venueIR(ac, venueId, posId, () => { if(this.venueId === venueId && this.posId === posId) this.set(venueId, posId, 0.3, true); });
    const st = {};
    let node = ac.createGain();
    st.head = node;
    st.lp = ac.createBiquadFilter(); st.lp.type = 'lowpass'; st.lp.Q.value = .5;
    st.conv = ac.createConvolver(); st.conv.normalize = false;
    st.dry = ac.createGain(); st.wet = ac.createGain();
    if(ir){
      // 直接音と響きの量の比は計算のまま。全体の大きさは会場・位置によらずそろえる（屋外だけは離れると小さくなる）
      const info = VIR.man.venues[venueId][posId];
      // 1.4 はステージ奥の列から響きへ多めに送るぶん
      const g = 1.1 * (v.irLvl ? v.irLvl[posId] : 1) / Math.sqrt(1 + 1.4 * info.mus);
      st.lp.frequency.value = p.hfIR;
      st.dry.gain.value = g;
      st.wet.gain.value = g * info.wetGain;
      st.conv.buffer = ir;
    } else {
      for(const [type, f, g, q] of v.eq){
        const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.gain.value = g; if(q) b.Q.value = q;
        node.connect(b); node = b;
      }
      st.lp.frequency.value = p.hf;
      st.dry.gain.value = v.dry * p.dry;
      st.wet.gain.value = v.wet * p.wet;
      st.conv.buffer = makeIR(ac, v);
    }
    node.connect(st.lp); st.lp.connect(st.dry);
    st.conv.connect(st.wet);
    st.out = ac.createGain();
    st.dry.connect(st.out); st.wet.connect(st.out);
    st.out.connect(this.sum);
    this.input.connect(st.head); this.input.connect(st.conv); this.wetIn.connect(st.conv);
    const now = ac.currentTime;
    const old = this.stage;
    const drop = o => { try{ this.input.disconnect(o.head); this.input.disconnect(o.conv); this.wetIn.disconnect(o.conv); o.out.disconnect(); }catch(e){} };
    if(old && fade > 0){
      st.out.gain.setValueAtTime(0, now); st.out.gain.linearRampToValueAtTime(1, now + fade);
      old.out.gain.setValueAtTime(old.out.gain.value, now); old.out.gain.linearRampToValueAtTime(0, now + fade);
      setTimeout(() => drop(old), (fade + 0.2) * 1000);
    } else if(old) drop(old);
    this.stage = st;
  }
  setPosition(posId){ if(this.venueId) this.set(this.venueId, posId); else this.posId = posId; }
}
