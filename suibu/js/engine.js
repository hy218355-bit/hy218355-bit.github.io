'use strict';
/* 再生エンジン：演奏データを少し先まで順に予約して鳴らす（ソロ・会場・聴く位置は再生中でも切り替えられる） */

class Engine {
  constructor(){
    this.ac = null; this.chain = null; this.pb = null;
    this.venueId = 'room'; this.posId = 'center';
    this.solo = {type: 'all'};
    // iPhoneで別のアプリから戻ったときや電話のあと、止められた音を再開する
    const wake = () => { if(this.ac && this.ac.state !== 'running' && this.pb && !this.pb.ended) this.ac.resume(); };
    document.addEventListener('visibilitychange', () => { if(!document.hidden) wake(); });
    document.addEventListener('touchend', wake, {passive: true});
  }
  ensure(){
    if(this.ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return false;
    // iPhoneのSafari：マナーモードでも音が出るように、音楽再生として扱ってもらう
    try{ if(navigator.audioSession) navigator.audioSession.type = 'playback'; }catch(e){}
    this.ac = new AC({latencyHint: 'playback'});
    this.chain = new VenueChain(this.ac);
    this.chain.set(this.venueId, this.posId, 0);
    return true;
  }
  setVenue(id){ this.venueId = id; if(this.chain) this.chain.set(id, this.posId); }
  setPosition(id){
    this.posId = id;
    if(this.chain) this.chain.setPosition(id);
    if(this.pb) this.pb.applyWidth(POSITION[id].width);
  }
  setSolo(solo){ this.solo = solo; if(this.pb) this.pb.applySolo(solo); }
  // opts.clock を渡すと、拍の進み方をその時計（指揮）に合わせる
  play(perf, onEnd, opts = {}){
    if(!this.ensure()) return null;
    this.stop();
    if(this.ac.state === 'suspended') this.ac.resume();
    this.pb = new Playback(this, perf, onEnd, opts);
    return this.pb;
  }
  stop(){ if(this.pb){ this.pb.stop(); this.pb = null; } }
  // 再生中の位置（楽譜どおりの速さで数えた秒）。再生していなければ -1
  now(){
    if(!this.pb || !this.ac) return -1;
    const pb = this.pb;
    return pb.clock ? pb.perf.b2t(pb.clock.beatAt(this.ac.currentTime)) : this.ac.currentTime - pb.T0;
  }
}

// 指揮に合わせて、楽譜どおりの時刻を置き直す。各自の出だしの癖はそのまま残し、
// 速さが急に変わったところでは、リズムの苦手な部員ほどついてこられずにばらつく
function warpNote(n, c, pf, T0){
  const span = Math.max(n.db || 0, 0.25);
  const ref = pf.b2t(n.b + span) - pf.b2t(n.b);
  const real = c.timeOf(n.b + span) - c.timeOf(n.b);
  const k = ref > 1e-4 ? real / ref : 1;
  const dev = (n.t - n.tg) * k + 0.22 * Math.min(0.6, c.joltAt(n.b)) * (1 - 0.7 * (n.R ?? 0.5)) * clampG(gauss(n.key, 'cond'));
  const w = {...n, t: Math.max(0, c.timeOf(n.b) - T0 + dev)};
  if(n.d != null){ w.d = n.d * k; if(n.env) w.env = n.env.map(([x, v]) => [x * k, v]); }
  if(n.dur != null) w.dur = n.dur * k;
  return w;
}
// 指揮した演奏そのもの（採点用）。時刻は演奏の始まりから
function warpPerf(perf, clock){
  const notes = perf.notes.map(n => warpNote(n, clock, perf, clock.t0)), hits = perf.hits.map(h => warpNote(h, clock, perf, clock.t0));
  const realDur = clock.timeOf(perf.to) - clock.t0;
  const ends = [...notes.map(n => n.t + n.d), ...hits.map(h => h.t + (h.dur || 0))];
  // 拍ごとの長さのがたつき（となりの拍との比）。なめらかに速くなる・遅くなるのは小さく、拍ごとにばらばらだと大きい
  let jit = 0, nj = 0;
  for(let b = Math.ceil(perf.from) + 1; b + 1 <= perf.to; b++){
    const d0 = clock.timeOf(b) - clock.timeOf(b - 1), d1 = clock.timeOf(b + 1) - clock.timeOf(b);
    if(d0 > 0 && d1 > 0){ jit += Math.abs(Math.log(d1 / d0)); nj++; }
  }
  return {...perf, notes, hits, realDur, total: Math.max(1, ...ends) + 0.4, conducted: true, jitter: nj ? jit / nj : 0};
}

/* ===== 指揮の拍 =====
   タップのたびに速さを決め直し、次の拍で指揮に追いつく。拍の進み方は途切れず、逆戻りもしない。
   ev は「拍 b の時刻 t から、1拍 P 秒で進む」という区切りの並び（jolt は速さの変わり方の大きさ） */
class BeatClock {
  constructor(ev){ this.ev = ev; this.P = ev[ev.length - 1].P; this.last = null; this.taps = []; }
  // 入りの合図の最後のタップが b0 の1拍前（t0 - P）。次のタップが b0 になる
  static start(t0, b0, P){ const c = new BeatClock([{b: b0, t: t0, P, jolt: 0}]); c.last = {k: b0 - 1, t: t0 - P}; return c; }
  // 保存した拍の進み方（t は演奏の始まりからの秒）から作り直す
  static fromSaved(ev, t0){ return new BeatClock(ev.map(e => ({...e, t: e.t + t0}))); }
  get t0(){ return this.ev[0].t; }
  seg(b){ let i = this.ev.length - 1; while(i > 0 && this.ev[i].b > b) i--; return this.ev[i]; }
  segT(t){ let i = this.ev.length - 1; while(i > 0 && this.ev[i].t > t) i--; return this.ev[i]; }
  timeOf(b){ const e = this.seg(b); return e.t + (b - e.b) * e.P; }
  beatAt(t){ const e = this.segT(t); return e.b + (t - e.t) / e.P; }
  joltAt(b){ return this.seg(b).jolt || 0; }
  // 演奏中のタップ（AudioContext の時計の秒）。タップは1回ごとに「次の拍」。
  // 間が大きく空いたときだけ、空いた分の拍を数える（部員の位置から拍を当て推量すると、ずれが自分で大きくなるため）
  tap(tau){
    const bp = this.beatAt(tau);
    let P = this.P, k;
    if(this.last){
      const gap = tau - this.last.t;
      const nb = gap >= 1.6 * P ? Math.max(1, Math.round(gap / P)) : 1;
      k = this.last.k + nb;
      if(nb <= 4) P = clamp(P + 0.6 * (clamp(gap / nb, 0.6 * P, 1.6 * P) - P), 0.25, 2.0);
    } else k = Math.round(bp);
    // 部員は「いま k 拍目」にいるはず。ずれていれば次の拍までに追いつく／待つ（行きすぎても戻らない）
    const ahead = clamp(bp - k, -0.75, 0.75);
    const jolt = Math.abs(P / this.P - 1) + 0.5 * Math.abs(bp - k);
    while(this.ev.length > 1 && this.ev[this.ev.length - 1].b > bp) this.ev.pop();
    // いまから P 秒後（指揮の次の拍）に、部員の数え方で 1 - ahead 拍ぶん進んだところへ着く
    this.ev.push({b: bp, t: tau, P: P / (1 - ahead), jolt}, {b: bp + 1 - ahead, t: tau + P, P, jolt});
    this.P = P; this.last = {k, t: tau};
    this.taps.push({t: tau, k, P, off: bp - k});
    return k;
  }
  // 保存用（時刻は演奏の始まりからの秒）
  saved(){ const t0 = this.t0; return this.ev.map(e => ({b: +e.b.toFixed(4), t: +(e.t - t0).toFixed(4), P: +e.P.toFixed(4), jolt: +(e.jolt || 0).toFixed(3)})); }
}

// ステージの奥行き：後ろの列ほど音が遅れて届き、高音が減り、響きの割合が増える。
// ホルンはベルが後ろを向いているので、こもった間接音が多い
const ROW_DEPTH = [
  {lp: 0,     delay: 0,      send: 0},
  {lp: 14000, delay: 0.0015, send: 0.12},
  {lp: 11000, delay: 0.003,  send: 0.25},
  {lp: 9500,  delay: 0.0045, send: 0.35},
];
const HORN_DEPTH = {lp: 5500, delay: 0.002, send: 0.5};

class Playback {
  constructor(engine, perf, onEnd, opts = {}){
    const ac = this.ac = engine.ac;
    this.engine = engine; this.perf = perf; this.onEnd = onEnd;
    this.clock = opts.clock || null;
    this.T0 = this.clock ? this.clock.t0 : ac.currentTime + 0.25;
    this.bus = ac.createGain();
    this.bus.connect(engine.chain.input);
    this.mem = {};
    this.srcs = [];
    this.voices = [];
    const width = POSITION[engine.posId].width;
    const byMem = {};
    for(const n of perf.notes) (byMem[n.mid] ||= []).push(n);
    this.queues = Object.entries(byMem).map(([mid, list]) => ({mid, list, i: 0, voice: null}));
    // 同じパートの何人目か（録音の使い分けに使う）
    const byPart = {};
    for(const q of this.queues) (byPart[q.list[0].part] ||= []).push(q.mid);
    this.rank = {};
    for(const ids of Object.values(byPart)) ids.sort().forEach((id, i) => { this.rank[id] = i; });
    this.hits = perf.hits;
    this.hi = 0;
    // 部員ごとの出口：ソロ用の音量 → 座席の左右
    const seatOf = {};
    for(const n of perf.notes) seatOf[n.mid] = n.seat;
    for(const h of perf.hits) seatOf[h.mid] ||= h.seat;
    this.wet = ac.createGain();
    if(engine.chain.wetIn) this.wet.connect(engine.chain.wetIn);
    for(const [mid, seat] of Object.entries(seatOf)){
      const st = SEAT[seat];
      const rd = st.inst === 'hn' ? HORN_DEPTH : ROW_DEPTH[st.row] || ROW_DEPTH[0];
      const g = ac.createGain();
      let node = g;
      if(rd.lp){ const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = rd.lp; f.Q.value = 0.5; node.connect(f); node = f; }
      if(rd.delay){ const d = ac.createDelay(0.05); d.delayTime.value = rd.delay; node.connect(d); node = d; }
      const p = makePan(ac, st.pan * width);
      node.connect(p); p.connect(this.bus);
      if(rd.send){ const s = ac.createGain(); s.gain.value = rd.send; p.connect(s); s.connect(this.wet); }
      this.mem[mid] = {g, p, seat};
    }
    this.applySolo(engine.solo, true);
    // 指揮した録音：振りの大きさ（全体の音量）の変化
    if(opts.lv) for(const [t, g] of opts.lv) this.setLevel(g, this.T0 + t);
    this.pump();
    this.timer = setInterval(() => this.pump(), 60);
    this.ended = false;
  }
  warp(n){ return n && this.clock ? warpNote(n, this.clock, this.perf, this.T0) : n; }
  // 指揮の振りの大きさ（全体の音量）
  setLevel(g, at = this.ac.currentTime){
    this.bus.gain.setTargetAtTime(g, at, 0.12);
    this.wet.gain.setTargetAtTime(g, at, 0.12);
  }
  pump(until = this.ac.currentTime + (this.clock ? 0.3 : 1.4)){
    const W = n => this.warp(n);
    for(const q of this.queues){
      while(q.i < q.list.length){
        const n = W(q.list[q.i]);
        if(this.T0 + n.t >= until) break;
        const next = W(q.list[q.i + 1]);
        if(!q.voice){
          // 音色の力が低いほど、息の雑音・音量の揺れ・鼻にかかった響きが増える
          const iT = 1 - n.T;
          const ms = q.list.map(x => x.midi).sort((a, b) => a - b);
          const Voice = sampleCfg(n.inst) ? SampleVoice : WindVoice;
          q.voice = new Voice(this.ac, this.mem[q.mid].g, n.inst, {
            trem: 0.3 * Math.pow(iT, 1.2), noise: 0.5 + 1.8 * Math.pow(iT, 1.3),
            vibRateMul: 0.94 + 0.12 * hash(q.mid, 'vr'), midi: ms[Math.floor(ms.length / 2)],
            // うまい奏者どうしでも、ほんの少しの音程差と出だしの差は残る（合奏らしい厚み）
            alt: this.rank[q.mid] || 0, det: 2.2 * clampG(gauss(q.mid, 'det')), dt: 0.006 * clampG(gauss(q.mid, 'dt')),
          });
          q.voice.start(Math.max(this.ac.currentTime, this.T0 + n.t - 0.05));
          this.voices.push(q.voice);
        }
        const end = q.voice.play(n, next, this.T0);
        if(!next) q.voice.stop(end + 0.3);
        q.i++;
      }
    }
    while(this.hi < this.hits.length){
      const h = W(this.hits[this.hi]);
      if(this.T0 + h.t >= until) break;
      this.hi++;
      strike(this.ac, this.mem[h.mid].g, h, this.T0, this.srcs);
    }
    if(this.srcs.length > 400) this.srcs = this.srcs.slice(-300);
  }
  audible(mid, solo){
    if(solo.type === 'all') return true;
    if(solo.type === 'member') return mid === solo.id;
    if(solo.type === 'sec') return SEAT[this.mem[mid].seat].sec === solo.id;
    return true;
  }
  applySolo(solo, instant){
    const now = this.ac.currentTime;
    for(const [mid, m] of Object.entries(this.mem)){
      const v = this.audible(mid, solo) ? 1 : 0;
      if(instant) m.g.gain.value = v;
      else m.g.gain.setTargetAtTime(v, now, 0.04);
    }
  }
  applyWidth(w){
    const now = this.ac.currentTime;
    for(const m of Object.values(this.mem)) if(m.p.pan) m.p.pan.setTargetAtTime(SEAT[m.seat].pan * w, now, 0.1);
  }
  stop(){
    if(this.ended) return;
    this.ended = true;
    clearInterval(this.timer);
    const now = this.ac.currentTime;
    this.bus.gain.setTargetAtTime(0, now, 0.04);
    this.wet.gain.setTargetAtTime(0, now, 0.04);
    for(const v of this.voices) v.stop(now + 0.3);
    for(const s of this.srcs){ try{ s.stop(now + 0.3); }catch(e){} }
    const bus = this.bus, wet = this.wet;
    setTimeout(() => { try{ bus.disconnect(); wet.disconnect(); }catch(e){} }, 800);
  }
  // 自然に終わったとき：残響が消えるまで待ってから片づける
  finish(){
    if(this.ended) return;
    this.ended = true;
    clearInterval(this.timer);
    const bus = this.bus, wet = this.wet;
    setTimeout(() => { try{ bus.disconnect(); wet.disconnect(); }catch(e){} }, 4000);
  }
}

/* ===== 録音を音声ファイルに書き出す =====
   会場の響きもつけて、実際の再生と同じしくみで（ただし速く）鳴らし、WAV にまとめる。
   指揮した演奏は、保存してある拍の進み方（conduct.ev）と振りの大きさ（conduct.lv）で鳴らす。 */
async function renderPerf(perf, {venue = 'hall', pos = 'center', conduct = null, onProgress = null} = {}){
  const sr = 44100;
  const clock = conduct ? BeatClock.fromSaved(conduct.ev, 0.5) : null;
  const dur = clock ? clock.timeOf(perf.to) - clock.t0 + 1.5 : perf.total;
  const len = Math.ceil((dur + 3.5) * sr);
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const off = new OAC(2, len, sr);
  // 会場の響きのデコードを待つ（読み込めていなければ、計算で作った響きのまま）
  if(VIR.man) await new Promise(res => { if(venueIR(off, venue, pos, res)) res(); setTimeout(res, 6000); });
  const chain = new VenueChain(off);
  chain.set(venue, pos, 0);
  const pb = new Playback({ac: off, chain, posId: pos, solo: {type: 'all'}}, perf, null, {clock, lv: conduct?.lv});
  clearInterval(pb.timer);
  const total = len / sr;
  for(let t = 0.5; t < total; t += 0.5){
    off.suspend(t).then(() => { pb.pump(t + 1.4); if(onProgress) onProgress(t / total); off.resume(); });
  }
  return off.startRendering();
}

// 16bit ステレオの WAV。最大音量を -1dB にそろえ、題名などを INFO に書く
function encodeWav(buf, info = {}){
  const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  let pk = 1e-6;
  for(let i = 0; i < L.length; i++){ const a = Math.abs(L[i]), b = Math.abs(R[i]); if(a > pk) pk = a; if(b > pk) pk = b; }
  const g = 0.89 / pk;
  // 最後の無音は切る
  let n = L.length;
  while(n > buf.sampleRate && Math.abs(L[n - 1]) * g < 3e-5 && Math.abs(R[n - 1]) * g < 3e-5) n--;
  n = Math.min(L.length, n + Math.floor(0.3 * buf.sampleRate));
  const enc = new TextEncoder();
  const tags = Object.entries({INAM: info.title, IART: info.artist, IPRD: info.album, ICMT: info.comment, ISFT: '吹部日誌'})
    .filter(([, v]) => v).map(([k, v]) => { const b = enc.encode(v + '\0'); return [k, b.length % 2 ? new Uint8Array([...b, 0]) : b, b.length]; });
  const listLen = 4 + tags.reduce((a, [, b]) => a + 8 + b.length, 0);
  const dataLen = n * 4;
  const out = new ArrayBuffer(44 + 8 + listLen + dataLen);
  const v = new DataView(out);
  let p = 0;
  const str = s => { for(const c of s) v.setUint8(p++, c.charCodeAt(0)); };
  const u32 = x => { v.setUint32(p, x, true); p += 4; };
  const u16 = x => { v.setUint16(p, x, true); p += 2; };
  str('RIFF'); u32(out.byteLength - 8); str('WAVE');
  str('fmt '); u32(16); u16(1); u16(2); u32(buf.sampleRate); u32(buf.sampleRate * 4); u16(4); u16(16);
  str('LIST'); u32(listLen); str('INFO');
  for(const [k, b, raw] of tags){ str(k); u32(raw); new Uint8Array(out, p, b.length).set(b); p += b.length; }
  str('data'); u32(dataLen);
  for(let i = 0; i < n; i++){
    v.setInt16(p, Math.max(-1, Math.min(1, L[i] * g)) * 32767, true); p += 2;
    v.setInt16(p, Math.max(-1, Math.min(1, R[i] * g)) * 32767, true); p += 2;
  }
  return out;
}
