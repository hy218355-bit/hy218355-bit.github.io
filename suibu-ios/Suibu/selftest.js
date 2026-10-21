// CIの動作確認用（起動引数 -selftest のときだけアプリが読み込む）。
// 録音と会場の響きが読み込めるのを待ってから、合奏を数小節ぶん書き出し、音が出ているか・壊れた値がないかを調べる
(async function(){
  const post = m => webkit.messageHandlers.native.postMessage(m);
  const log = s => post({type: 'log', msg: s});
  try{
    const t0 = Date.now();
    while(!(SAMPLES.ready && VIR.man)){
      if(SAMPLES.error) throw new Error('samples: ' + SAMPLES.error);
      if(VIR.error) throw new Error('ir: ' + VIR.error);
      if(Date.now() - t0 > 180000) throw new Error('load timeout');
      await new Promise(r => setTimeout(r, 200));
    }
    await document.fonts.ready;
    const fonts = [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight);
    log(`loaded in ${Date.now() - t0}ms: ${Object.keys(SAMPLES.banks).length} banks, ${Object.keys(VIR.raw).length} rooms, fonts [${fonts.join(', ')}], save ${localStorage.getItem(SAVE_KEY) ? 'yes' : 'no'}`);
    const members = fullBand({pitch: 90, rhythm: 90, tone: 90, expr: 90});
    const perf = perform({members, pieceId: 'ode', cohesion: 90, fam: 100, venue: 'hall', from: 56, to: 60});
    const sr = 44100, len = Math.ceil((perf.total + 1.5) * sr);
    const off = new OfflineAudioContext(2, len, sr);
    await new Promise(res => { if(venueIR(off, 'hall', 'center', res)) res(); });
    const chain = new VenueChain(off);
    chain.set('hall', 'center', 0);
    const pb = new Playback({ac: off, chain, posId: 'center', solo: {type: 'all'}}, perf, null);
    clearInterval(pb.timer);
    pb.pump(Infinity);
    const t1 = Date.now();
    const buf = await off.startRendering();
    let pk = 0, sum = 0, nan = 0;
    const d = buf.getChannelData(0);
    for(let i = 0; i < d.length; i++){ const v = d[i]; if(v !== v){ nan++; continue; } pk = Math.max(pk, Math.abs(v)); sum += v * v; }
    const rms = 10 * Math.log10(sum / d.length + 1e-12);
    const ir = chain.stage.conv.buffer ? chain.stage.conv.buffer.length : 0;
    const detail = `peak ${pk.toFixed(3)} rms ${rms.toFixed(1)}dB nan ${nan} rendered ${(len / sr).toFixed(1)}s in ${Date.now() - t1}ms, voices ${pb.voices.length}, ir ${ir}`;
    post({type: 'selftest', ok: nan === 0 && pk > 0.05 && pk <= 1.0 && rms > -40 && ir > 0, detail});
  }catch(e){
    post({type: 'selftest', ok: false, detail: String(e && e.stack || e)});
  }
})();
