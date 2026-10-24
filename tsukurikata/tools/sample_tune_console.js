// 楽器の録音ごとの音程のくせ（セント）を測る。ブラウザでゲームを開き、開発者ツールのコンソールにこのファイルの中身を貼って実行する
// のばす音の録音はループの部分、短い音の録音は頭の30ミリ秒より後を、正規化した自己相関で測り、名目の高さ（目録の m、A=440Hz）とのずれを出す。
// 結果は snd/manifest.json の各録音の c（その録音が何セント高いか）に書く。再生のときに打ち消す（samples.js の smpTune）。
// 2セント未満・25セントより大きい（測りまちがいの見込み）・50Hz より低い音（測り方で答えがちがう）は c を書かない。録音を作り直したら測り直す
(async () => {
  await SAMPLES.loading;
  const est = (d, fs, a, N, f) => {
    const lo = Math.max(2, Math.floor(fs / (f * 1.1))), hi = Math.ceil(fs / (f / 1.1));
    if(a + N + hi >= d.length) return null;
    let best = -Infinity, bl = lo; const v = [];
    for(let l = lo; l <= hi; l++){
      let s = 0, e1 = 0, e2 = 0;
      for(let i = a; i < a + N; i++){ s += d[i] * d[i + l]; e1 += d[i] * d[i]; e2 += d[i + l] * d[i + l]; }
      const c = s / Math.sqrt(e1 * e2 + 1e-12); v.push(c); if(c > best){ best = c; bl = l; }
    }
    const k = bl - lo;
    if(k <= 0 || k >= v.length - 1) return {f: fs / bl, q: best};
    const off = (v[k - 1] - v[k + 1]) / (2 * (v[k - 1] - 2 * v[k] + v[k + 1]));
    return {f: fs / (bl + off), q: best};
  };
  const out = {};
  for(const [bn, b] of Object.entries(SAMPLES.banks)){
    if(b.kind !== 'sus' && !bn.endsWith('_st')) continue;
    const d = b.buf.getChannelData(0), fs = b.buf.sampleRate, st = bn.endsWith('_st');
    out[bn] = b.samples.map(s => {
      if(s.m == null || s.m < 31.5) return 0;
      const f = 440 * Math.pow(2, (s.m - 69) / 12);
      const a0 = st ? s.start + 0.03 : s.start + (s.lp ? s.lp[0] : s.d * 0.3);
      const len = st ? Math.max(0.05, Math.min(0.35, s.d * 0.7)) : Math.min(0.5, s.lp ? s.lp[1] - s.lp[0] : s.d * 0.5);
      const r = est(d, fs, Math.floor(a0 * fs), Math.floor(len * fs), f);
      if(!r || r.q < (st ? 0.9 : 0.8)) return 0;
      const c = 1200 * Math.log2(r.f / f);
      return Math.abs(c) < 2 || Math.abs(c) > 25 ? 0 : Math.round(c);
    });
  }
  console.log(JSON.stringify(out));
})();
