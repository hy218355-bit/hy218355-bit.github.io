'use strict';
/* ===== 自由曲1：ドヴォルザーク《新世界より》第2楽章 Largo ===== */
{
  const LARGO_MEL = 'E5:1.5 G5:.5 G5:2 | E5:1.5 D5:.5 C5:2 | D5:1.5 E5:.5 G5:1.5 E5:.5 | D5:3 r:1 | E5:1.5 G5:.5 G5:2 | E5:1.5 D5:.5 C5:2 | D5:1 E5:1 D5:1.5 C5:.5 | C5:4';
  const LARGO_CH = 'C:4 | C:4 | G7:8 | C:4 | C:4 | F:2 G7:2 | C:4';
  const LARGO_BASS = 'C3:4 | C3:4 | G2:8 | C3:4 | C3:4 | F2:2 G2:2 | C2:4';

  addPiece({
    id: 'largo',
    title: '《新世界より》第2楽章',
    full: 'ドヴォルザーク 交響曲第9番「新世界より」第2楽章 Largo',
    composer: 'A.ドヴォルザーク（1893年）',
    key: '変ニ長調', trans: 1, meter: 4, beatUnit: .5, beats: 64,
    tempi: [84, 92, 100],
    desc: 'ゆっくり歌う曲。音程と音色、そして抑揚の差がそのまま聞こえる。前半はオーボエのソロ。',
    asks: '音程・音色・表現',
    focus: {pitch: 1.1, tone: 1.15, expr: 1.2, rhythm: 0.8, balance: 1},
    balRef: 0.5, ceiling: 1,
    spans: [{name: '前半（オーボエのソロ）', from: 0, to: 32}, {name: '後半（全合奏）', from: 32, to: 64}],
    slur: 'bar',
    mel: [...line(LARGO_MEL), ...line(LARGO_MEL, 32)],
    chords: [...chords(LARGO_CH), ...chords(LARGO_CH, 32)],
    bass: [...line(LARGO_BASS), ...line(LARGO_BASS, 32)],
    dyn: [[0,.3],[2,.4],[4,.36],[8,.38],[10,.55],[12,.42],[15,.28],[16,.34],[18,.5],[20,.58],[22,.5],[24,.46],[26,.4],[28,.32],[31.9,.26],
          [32,.4],[34,.5],[36,.46],[40,.52],[42,.66],[44,.6],[47,.64],[48,.84],[50,.9],[52,.86],[54,.78],[56,.7],[58,.6],[60,.42],[64,.16]],
    rubato: [[0,1.04],[2,1],[10,1],[13,1.08],[15.5,1.22],[16,1],[18,.98],[22,1],[24,1.04],[28,1.15],[31,1.3],[32,1.05],
             [33,1],[42,1],[46,1.06],[47.8,1.15],[48,1.02],[50,1],[54,1],[56,1.03],[60,1.2],[63,1.55],[64,1.7]],
    groups: {
      clA:  {n: 3, lo: 57, hi: 71, rh: 'sus'},
      hn:   {n: 4, lo: 50, hi: 67, rh: 'sus'},
      hnB:  {n: 4, lo: 50, hi: 67, rh: 'sus'},
      midA: {n: 1, lo: 50, hi: 62, rh: 'sus'},
      midB: {n: 2, lo: 53, hi: 69, rh: 'sus'},
      tpB:  {n: 1, lo: 62, hi: 72, rh: 'sus'},
      tb:   {n: 3, lo: 41, hi: 62, rh: 'sus'},
    },
    roles: {
      ob:    [{f: 0, t: 32, r: 'mel', sh: 0, solo: true, fb: ['asax1', 'cl1']}, {f: 48, t: 64, r: 'mel', sh: 0}],
      picc:  [{f: 48, t: 56, r: 'mel', sh: 12, sc: .7}],
      fl1:   [{f: 32, t: 48, r: 'mel', sh: 0}, {f: 48, t: 64, r: 'mel', sh: 12}],
      fl2:   [{f: 32, t: 48, r: 'mel3', sh: 0}, {f: 48, t: 64, r: 'mel3', sh: 12}],
      ebcl:  [{f: 48, t: 64, r: 'mel', sh: 12, sc: .8}],
      cl1:   [{f: 0, t: 32, r: 'pad', g: 'clA', i: 0, sc: .7}, {f: 32, t: 64, r: 'mel', sh: 0}],
      cl2:   [{f: 0, t: 32, r: 'pad', g: 'clA', i: 1, sc: .7}, {f: 32, t: 64, r: 'mel3', sh: 0}],
      cl3:   [{f: 0, t: 32, r: 'pad', g: 'clA', i: 2, sc: .7}, {f: 32, t: 64, r: 'pad', g: 'midB', i: 0}],
      bcl:   [{f: 0, t: 32, r: 'bass', sh: 0, rh: 'sus', sc: .75}, {f: 32, t: 64, r: 'bass', sh: 0, rh: 'sus'}],
      fg:    [{f: 0, t: 32, r: 'bass', sh: 12, rh: 'sus', sc: .7}, {f: 32, t: 64, r: 'bass', sh: 0, rh: 'sus'}],
      asax1: [{f: 32, t: 64, r: 'mel', sh: -12}],
      asax2: [{f: 32, t: 64, r: 'mel3', sh: -12}],
      tsax:  [{f: 32, t: 64, r: 'pad', g: 'midB', i: 1}],
      bsax:  [{f: 32, t: 64, r: 'bass', sh: 0, rh: 'sus'}],
      tp1:   [{f: 48, t: 64, r: 'mel', sh: 0}],
      tp2:   [{f: 48, t: 64, r: 'mel3', sh: 0}],
      tp3:   [{f: 48, t: 64, r: 'pad', g: 'tpB', i: 0}],
      hn1:   [{f: 0, t: 32, r: 'pad', g: 'hn', i: 0, sc: .7}, {f: 32, t: 64, r: 'pad', g: 'hnB', i: 0}],
      hn2:   [{f: 0, t: 32, r: 'pad', g: 'hn', i: 1, sc: .7}, {f: 32, t: 64, r: 'pad', g: 'hnB', i: 1}],
      hn3:   [{f: 0, t: 32, r: 'pad', g: 'hn', i: 2, sc: .7}, {f: 32, t: 64, r: 'pad', g: 'hnB', i: 2}],
      hn4:   [{f: 0, t: 32, r: 'pad', g: 'hn', i: 3, sc: .7}, {f: 32, t: 64, r: 'pad', g: 'hnB', i: 3}],
      tb1:   [{f: 40, t: 64, r: 'pad', g: 'tb', i: 0}],
      tb2:   [{f: 40, t: 64, r: 'pad', g: 'tb', i: 1}],
      btb:   [{f: 40, t: 64, r: 'pad', g: 'tb', i: 2}],
      euph:  [{f: 0, t: 32, r: 'pad', g: 'midA', i: 0, sc: .7}, {f: 32, t: 64, r: 'mel', sh: -12}],
      tuba:  [{f: 24, t: 32, r: 'bass', sh: 0, rh: 'sus', sc: .7}, {f: 32, t: 64, r: 'bass', sh: 0, rh: 'sus'}],
      cb:    [{f: 0, t: 32, r: 'bass', sh: 0, rh: 'sus', sc: .75}, {f: 32, t: 64, r: 'bass', sh: 0, rh: 'sus'}],
      perc4: [{f: 32, t: 48, r: 'mel', sh: 12, inst: 'vib', sc: .45}],
    },
    perc: {
      perc1: [
        {i: 'timp', b: 28, d: 4, m: 48, roll: true, v: .2, v1: .08},
        {i: 'timp', b: 44, d: 4, m: 43, roll: true, v: .22, v1: .75},
        {i: 'timp', b: 48, m: 48, v: .85}, {i: 'timp', b: 50, m: 48, v: .5}, {i: 'timp', b: 52, m: 43, v: .6}, {i: 'timp', b: 56, m: 48, v: .45},
        {i: 'timp', b: 60, d: 4, m: 48, roll: true, v: .32, v1: .08},
      ],
      perc2: [
        {i: 'sus', b: 44, d: 4, roll: true, v: .06, v1: .62},
        {i: 'sus', b: 48, v: .55},
        {i: 'tri', b: 60, v: .25},
      ],
      perc3: [
        {i: 'bd', b: 46, d: 2, roll: true, v: .1, v1: .45},
        {i: 'bd', b: 48, v: .6},
        {i: 'tamtam', b: 60, v: .24},
      ],
      perc4: [
        {i: 'chime', b: 48, m: 72, v: .5},
        {i: 'chime', b: 60, m: 72, v: .34},
      ],
    },
    // 解釈（テンポ・揺れ）が部の実力に合っているか。当てはまるものを [点の増減, 講評] で返す
    interpRules: (perf, ip) => [
      ip.tempo === 2 && [-3, 'Largoとしてはテンポが速く、落ち着きに欠けます。'],
      ip.tempo === 0 && perf.bandE < 0.6 && [-3, '遅いテンポを支えきれず、音楽が停滞しました。'],
    ],
  });
}
