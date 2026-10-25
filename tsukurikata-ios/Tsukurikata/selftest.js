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
    // 「天国と地獄」の後半の入り：ティンパニ・小太鼓・大太鼓・シンバルの録音と、全員の速い刻みが鳴る所
    const perf = perform({members, pieceId: 'galop', cohesion: 90, fam: 100, venue: 'hall', from: 58, to: 66});
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
    let detail = `peak ${pk.toFixed(3)} rms ${rms.toFixed(1)}dB nan ${nan} rendered ${(len / sr).toFixed(1)}s in ${Date.now() - t1}ms, voices ${pb.voices.length}, ir ${ir}`;
    // 全15曲のすべての音を、上手な部と下手な部で予約してみる（WebKit は、音量の予約の重なりに Chrome よりきびしく、
    // Chrome で通っても iPhone ではエラーになって、そこから先の音が鳴らなくなることがある）
    for(const pid of PIECE_IDS) for(const v of [30, 100]){
      const p = perform({members: fullBand({pitch: v, rhythm: v, tone: v, expr: v}), pieceId: pid, cohesion: v, fam: 100, venue: 'hall', lead: () => 1});
      const oac = new OfflineAudioContext(2, Math.ceil((p.total + 3) * sr), sr), ch = new VenueChain(oac);
      ch.set('hall', 'center', 0);
      const b = new Playback({ac: oac, chain: ch, posId: 'center', solo: {type: 'all'}}, p, null);
      clearInterval(b.timer);
      try{ b.pump(Infinity); }catch(e){ throw new Error(`schedule ${pid}/${v}: ${e.message}`); }
    }
    detail += ', schedule all ok';
    // 指揮した演奏の書き出し → アプリへ渡して m4a に
    const clock = BeatClock.start(0.5, perf.from, 0.5);
    for(let k = 1; k <= 8; k++) clock.tap(0.5 + k * 0.47);
    const wavBuf = await renderPerf(perf, {venue: 'hall', conduct: {ev: clock.saved(), lv: [[0, 1], [2, 1.3]]}});
    const wav = encodeWav(wavBuf, {title: 'セルフテスト', artist: '県立みなと高校吹奏楽部'});
    const fileOk = await new Promise(res => { window.onNativeFileDone = ok => res(ok); deliverFile(wav, 'selftest.wav', {title: 'セルフテスト', artist: '県立みなと高校吹奏楽部'}); setTimeout(() => res(false), 60000); });
    detail += `, wav ${(wav.byteLength / 1e6).toFixed(2)}MB -> file ${fileOk ? 'ok' : 'FAILED'}`;
    post({type: 'selftest', ok: nan === 0 && pk > 0.05 && pk <= 1.0 && rms > -40 && ir > 0 && fileOk, detail});
  }catch(e){
    post({type: 'selftest', ok: false, detail: `${e && e.message || e} ${e && e.stack || ''}`});
  }
})();
