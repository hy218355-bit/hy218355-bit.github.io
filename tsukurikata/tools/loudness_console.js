// 曲ごとの聴こえる大きさ（ラウドネス）を測る。ブラウザでゲームを開き、開発者ツールのコンソールにこのファイルの中身を貼って実行する
// 全員の能力100の部（お手本）を、ホールの響きつきで実際の再生と同じしくみで書き出し、
// BS.1770 の K 特性で、ゲート付きの平均（LUFS）・大きいところ（3秒ごとの上から10%）・いちばん大きい点（dBFS）を出す。
// 曲の outGain（聴くときの音量の倍率）は、どの曲も −14.5 LUFS 前後（静かな曲は少し下まで）になるように決めてある。新しい曲を足したら測って合わせる
(async () => {
  const kw = buf => {
    const fs = buf.sampleRate;
    const biq = (f0, Q, shelfDb) => {
      const K = Math.tan(Math.PI * f0 / fs), a0 = 1 + K / Q + K * K, a = [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
      if(shelfDb == null) return {b: [1, -2, 1], a};
      const Vh = Math.pow(10, shelfDb / 20), Vb = Math.pow(Vh, 0.4996667741545416);
      return {b: [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0], a};
    };
    const shelf = biq(1681.974450955533, 0.7071752369554196, 3.999843853973347), hp = biq(38.13547087602444, 0.5003270373238773);
    const filt = (x, c) => { const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for(let i = 0; i < x.length; i++){ const v = c.b[0] * x[i] + c.b[1] * x1 + c.b[2] * x2 - c.a[1] * y1 - c.a[2] * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; };
    const ch = [0, 1].map(c => filt(filt(buf.getChannelData(c), shelf), hp));
    const N = Math.floor(0.4 * fs), step = Math.floor(0.1 * fs), blocks = [];
    for(let i = 0; i + N <= ch[0].length; i += step){ let s = 0; for(const c of ch) for(let j = i; j < i + N; j++) s += c[j] * c[j]; blocks.push(s / N); }
    const L = z => -0.691 + 10 * Math.log10(z);
    const abs = blocks.filter(z => L(z) > -70), m1 = abs.reduce((a, z) => a + z, 0) / abs.length, rel = abs.filter(z => L(z) > L(m1) - 10);
    const st = []; for(let i = 0; i + 30 <= blocks.length; i += 5){ let s = 0; for(let j = i; j < i + 30; j++) s += blocks[j]; st.push(L(s / 30)); }
    st.sort((a, b) => b - a);
    let pk = 0; for(let c = 0; c < 2; c++){ const d = buf.getChannelData(c); for(let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i])); }
    return {LUFS: +L(rel.reduce((a, z) => a + z, 0) / rel.length).toFixed(1), 大きいところ: +st[Math.floor(st.length * 0.1)].toFixed(1), ピーク: +(20 * Math.log10(pk)).toFixed(1)};
  };
  await SAMPLES.loading;
  const out = {};
  for(const pid of PIECE_IDS){
    out[pid] = {...kw(await renderPerf(modelPerf(pid), {venue: 'hall'})), outGain: PIECES[pid].outGain ?? 1};
    console.log(pid, out[pid]);
  }
  console.table(out);
})();
