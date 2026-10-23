'use strict';
/* ===== 自由曲2：ベートーヴェン《第九》第4楽章より「歓喜の歌」 ===== */
{
  const ODE_MEL = 'E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4:1.5 D4:.5 D4:2 | E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:.5 C4:2 | D4 D4 E4 C4 | D4 E4:.5 F4:.5 E4 C4 | D4 E4:.5 F4:.5 E4 D4 | C4 D4 G3:2 | E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:.5 C4:2 | C4:4';
  const ODE_CH = 'C:2 C:2 | G7:2 C:2 | Am:2 C:2 | C:2 G:2 | C:2 C:2 | G7:2 C:2 | Am:2 C:2 | G7:2 C:2 | G:2 C:2 | G7:2 C:2 | G7:2 C:2 | Am:1 D7:1 G:2 | C:2 C:2 | G7:2 C:2 | F:2 C:2 | G7:2 C:2 | C:4';
  const ODE_BASS = 'C3:2 C3:2 | G2:2 C3:2 | A2:2 C3:2 | C3:2 G2:2 | C3:2 C3:2 | G2:2 C3:2 | A2:2 C3:2 | G2:2 C3:2 | G2:2 C3:2 | G2:2 C3:2 | G2:2 C3:2 | A2:1 D3:1 G2:2 | C3:2 C3:2 | G2:2 C3:2 | F2:2 C3:2 | G2:2 C3:2 | C2:4';

  addPiece({
    id: 'ode',
    title: '「歓喜の歌」',
    full: 'ベートーヴェン 交響曲第9番 第4楽章より「歓喜の歌」',
    composer: 'L.v.ベートーヴェン（1824年）',
    key: '変ロ長調', trans: -2, meter: 4, beats: 68,
    tempi: [92, 104, 116],
    desc: '低音のメロディから始まり、最後は全員で鳴らす。リズムのそろい方と、旋律が埋もれないバランスが問われる。',
    asks: 'リズム・バランス・音程',
    focus: {pitch: 1, tone: .95, expr: .9, rhythm: 1.2, balance: 1.1},
    balRef: 4.3, ceiling: .96,
    spans: [{name: '前半（低音〜木管）', from: 0, to: 32}, {name: '後半（全合奏）', from: 32, to: 68}],
    slur: 'pairs',
    mel: line(ODE_MEL),
    chords: chords(ODE_CH),
    bass: line(ODE_BASS),
    dyn: [[0,.32],[12,.36],[14,.33],[16,.4],[16.01,.42],[28,.48],[30,.45],[32,.48],[40,.56],[44,.6],[46,.68],[48,.8],[56,.84],[60,.86],[64,.88],[66,.92],[68,.84]],
    rubato: [[0,1],[44,1],[47,1.06],[48,1],[60,1],[62,1.08],[64,1.2],[66,1.6],[68,2.0]],
    groups: {
      clA:   {n: 2, lo: 60, hi: 74, rh: 'sus'},
      woodA: {n: 3, lo: 55, hi: 72, rh: 'sus'},
      tenA:  {n: 1, lo: 52, hi: 64, rh: 'sus'},
      hnA:   {n: 4, lo: 52, hi: 69, rh: 'sus'},
      hnT:   {n: 4, lo: 53, hi: 70, rh: 'ab'},
      hnF:   {n: 4, lo: 53, hi: 70, rh: 'sus'},
      midT:  {n: 2, lo: 55, hi: 70, rh: 'ab'},
      midF:  {n: 2, lo: 55, hi: 70, rh: 'sus'},
      tbT:   {n: 2, lo: 46, hi: 62, rh: 'sus'},
      tpT:   {n: 1, lo: 60, hi: 70, rh: 'sus'},
    },
    roles: {
      euph:  [{f: 0, t: 16, r: 'mel', sh: 0}, {f: 16, t: 48, r: 'pad', g: 'tenA', i: 0}, {f: 48, t: 68, r: 'mel', sh: -12}],
      tsax:  [{f: 0, t: 16, r: 'mel', sh: 0}, {f: 16, t: 48, r: 'pad', g: 'woodA', i: 2}, {f: 48, t: 64, r: 'pad', g: 'midT', i: 1}, {f: 64, t: 68, r: 'pad', g: 'midF', i: 1}],
      fg:    [{f: 0, t: 16, r: 'mel', sh: 0, sc: .9}, {f: 16, t: 48, r: 'bass', sh: 12, rh: 'sus', sc: .85}, {f: 48, t: 68, r: 'bass', sh: 0, rh: 'sus'}],
      cb:    [{f: 0, t: 48, r: 'bass', sh: 0, rh: 'pizz'}, {f: 48, t: 68, r: 'bass', sh: 0, rh: 'sus'}],
      tuba:  [{f: 16, t: 48, r: 'bass', sh: 0, rh: 'sus', sc: .7}, {f: 48, t: 64, r: 'bass', sh: 0, rh: 'march'}, {f: 64, t: 68, r: 'bass', sh: 0, rh: 'sus'}],
      bcl:   [{f: 16, t: 48, r: 'bass', sh: 0, rh: 'sus'}, {f: 48, t: 64, r: 'bass', sh: 0, rh: 'march'}, {f: 64, t: 68, r: 'bass', sh: 0, rh: 'sus'}],
      bsax:  [{f: 32, t: 48, r: 'bass', sh: 0, rh: 'sus'}, {f: 48, t: 64, r: 'bass', sh: 0, rh: 'march'}, {f: 64, t: 68, r: 'bass', sh: 0, rh: 'sus'}],
      btb:   [{f: 48, t: 64, r: 'bass', sh: 0, rh: 'march'}, {f: 64, t: 68, r: 'bass', sh: 0, rh: 'sus'}],
      cl1:   [{f: 16, t: 68, r: 'mel', sh: 12}],
      cl2:   [{f: 0, t: 16, r: 'pad', g: 'clA', i: 0}, {f: 16, t: 68, r: 'mel3', sh: 12}],
      cl3:   [{f: 0, t: 16, r: 'pad', g: 'clA', i: 1}, {f: 16, t: 48, r: 'pad', g: 'woodA', i: 0}, {f: 48, t: 64, r: 'pad', g: 'midT', i: 0}, {f: 64, t: 68, r: 'pad', g: 'midF', i: 0}],
      asax1: [{f: 16, t: 68, r: 'mel', sh: 0}],
      asax2: [{f: 16, t: 48, r: 'pad', g: 'woodA', i: 1}, {f: 48, t: 68, r: 'mel3', sh: 0}],
      ob:    [{f: 16, t: 68, r: 'mel', sh: 12}],
      fl1:   [{f: 32, t: 68, r: 'mel', sh: 12}],
      fl2:   [{f: 32, t: 68, r: 'mel3', sh: 12}],
      picc:  [{f: 48, t: 68, r: 'mel', sh: 24, sc: .8}],
      ebcl:  [{f: 32, t: 68, r: 'mel', sh: 12, sc: .9}],
      tp1:   [{f: 48, t: 68, r: 'mel', sh: 12}],
      tp2:   [{f: 48, t: 68, r: 'mel3', sh: 12}],
      tp3:   [{f: 48, t: 68, r: 'pad', g: 'tpT', i: 0}],
      hn1:   [{f: 16, t: 48, r: 'pad', g: 'hnA', i: 0}, {f: 48, t: 64, r: 'pad', g: 'hnT', i: 0}, {f: 64, t: 68, r: 'pad', g: 'hnF', i: 0}],
      hn2:   [{f: 16, t: 48, r: 'pad', g: 'hnA', i: 1}, {f: 48, t: 64, r: 'pad', g: 'hnT', i: 1}, {f: 64, t: 68, r: 'pad', g: 'hnF', i: 1}],
      hn3:   [{f: 16, t: 48, r: 'pad', g: 'hnA', i: 2}, {f: 48, t: 64, r: 'pad', g: 'hnT', i: 2}, {f: 64, t: 68, r: 'pad', g: 'hnF', i: 2}],
      hn4:   [{f: 16, t: 48, r: 'pad', g: 'hnA', i: 3}, {f: 48, t: 64, r: 'pad', g: 'hnT', i: 3}, {f: 64, t: 68, r: 'pad', g: 'hnF', i: 3}],
      tb1:   [{f: 48, t: 68, r: 'pad', g: 'tbT', i: 0}],
      tb2:   [{f: 48, t: 68, r: 'pad', g: 'tbT', i: 1}],
      perc3: [{f: 32, t: 48, r: 'mel', sh: 12, inst: 'xylo', sc: .5}],
      perc4: [{f: 16, t: 32, r: 'mel3', sh: 0, inst: 'mrb', sc: .55}, {f: 32, t: 48, r: 'mel', sh: 24, inst: 'glock', sc: .45}],
    },
    perc: {
      perc1: [
        {i: 'timp', b: 46, d: 2, m: 43, roll: true, v: .25, v1: .7},
        ...[48,50,52,54,56,58,60,62].map((b, k) => ({i: 'timp', b, m: [48,48,43,48,48,48,43,48][k], v: k % 2 ? .55 : .72})),
        {i: 'timp', b: 64, d: 4, m: 48, roll: true, v: .6, v1: .9},
      ],
      perc2: [
        {i: 'tamb', b: 32, v: .35}, {i: 'tamb', b: 34, v: .28}, {i: 'tri', b: 36, v: .3},
        {i: 'tamb', b: 40, v: .35}, {i: 'tamb', b: 42, v: .28}, {i: 'tri', b: 44, v: .3},
        {i: 'sd', b: 46, d: 2, roll: true, v: .15, v1: .6},
        ...[48, 52, 56].flatMap(b => [[0,.6],[1,.35],[2,.55],[2.5,.3],[3,.38]].map(([o, v]) => ({i: 'sd', b: b + o, v}))),
        {i: 'sd', b: 60, v: .6}, {i: 'sd', b: 61, v: .38}, {i: 'sd', b: 62, d: 2, roll: true, v: .35, v1: .7},
        {i: 'sd', b: 64, d: 4, roll: true, v: .55, v1: .85},
      ],
      perc3: [
        ...[48,50,52,54,56,58,60,62].map(b => ({i: 'bd', b, v: b % 4 ? .45 : .62})),
        {i: 'bd', b: 64, v: .9}, {i: 'bd', b: 64.5, d: 3.5, roll: true, v: .35, v1: .7},
      ],
      perc4: [
        {i: 'cym', b: 48, v: .85}, {i: 'cym', b: 56, v: .6}, {i: 'cym', b: 64, v: 1},
      ],
    },
    // 解釈（テンポ・揺れ）が部の実力に合っているか。当てはまるものを [点の増減, 講評] で返す
    interpRules: (perf, ip) => [
      ip.tempo === 2 && perf.bandR < 0.7 && [-4, '速いテンポに合奏がついていけず、崩れかけていました。'],
      ip.tempo === 0 && [-2, 'テンポがやや重く感じます。'],
    ],
  });
}
