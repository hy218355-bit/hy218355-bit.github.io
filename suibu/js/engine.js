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
  play(perf, onEnd){
    if(!this.ensure()) return null;
    this.stop();
    if(this.ac.state === 'suspended') this.ac.resume();
    this.pb = new Playback(this, perf, onEnd);
    return this.pb;
  }
  stop(){ if(this.pb){ this.pb.stop(); this.pb = null; } }
  // 再生中の位置（秒）。再生していなければ -1
  now(){ return this.pb && this.ac ? this.ac.currentTime - this.pb.T0 : -1; }
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
  constructor(engine, perf, onEnd){
    const ac = this.ac = engine.ac;
    this.engine = engine; this.perf = perf; this.onEnd = onEnd;
    this.T0 = ac.currentTime + 0.25;
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
    this.pump();
    this.timer = setInterval(() => this.pump(), 60);
    this.ended = false;
  }
  pump(until = this.ac.currentTime + 1.4){
    for(const q of this.queues){
      while(q.i < q.list.length && this.T0 + q.list[q.i].t < until){
        const n = q.list[q.i], next = q.list[q.i + 1];
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
    while(this.hi < this.hits.length && this.T0 + this.hits[this.hi].t < until){
      const h = this.hits[this.hi++];
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
