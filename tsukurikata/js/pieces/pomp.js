'use strict';
/* ===== 自由曲4：エルガー 行進曲「威風堂々」第1番より 中間部 =====
   ト長調、実音のまま。1拍＝4分音符、2/4拍子。前半はやわらかく、後半は1オクターブ上で全員で歌い上げる。
   音は PDMX（CC0）のオルガン譜から写した */
{
  const POMP_A = 'G4:2 | F#4:.5 G4:.5 A4:1 | E4:2 | D4:2 | C4:2 | B3:.5 C4:.5 D4:1 | A3:4 | B3:2 | C#4:.5 D4:1 E4:.5 | A4:2 | D4:2';
  const POMP_MEL = [...line(POMP_A + ' | G4:2.5 F#4:1 E4:.5 | D4:4'), ...shift(oct(line(POMP_A), 1), 32),
    ...line('C6:2 | C6:.5 B5:1 A5:.5 | B5:4 | E5:2 | F#5:.5 G5:1 A5:.5 | D5:2 | G5:2 | G4:2 | C5:.5 B4:1 A4:.5 | G4:4', 56)];
  const POMP_CH = 'G:2 | D7/A:2 | Em/B:2 | G/B:2 | C:2 | G/D:2 | A7/E:2 | D:2 | G:2 | A7/G:2 | D/F#:2 | G:2 | Em7:2 | A7:2 | D:2 | D7:2 | '
    + 'G:2 | D7/A:2 | Em/B:2 | G/B:2 | C/E:2 | G/D:2 | A7/C#:2 | D:2 | G:2 | A7/G:2 | D/F#:2 | D/F#:2 | C/E:2 | D:1 D7:1 | G:2 | G:1 G7:1 | C:2 | D7/A:2 | G:2 | Em:2 | Am7:2 | D7:2 | G:4';
  const POMP_BASS = line('G2:2 | A2:2 | B2:2 | B2:2 | C3:2 | D3:2 | E3:2 | D3:2 | G2:2 | G2:2 | F#2:2 | G2:2 | E2:2 | A2:2 | D3:2 | D3:2 | '
    + 'G2:2 | A2:2 | B2:2 | B2:2 | E2:2 | D2:2 | C#3:2 | D3:2 | G2:2 | G2:2 | F#2:2 | F#2:2 | E2:2 | D2:2 | G2:2 | G2:2 | C3:2 | A2:2 | G2:2 | E2:2 | A2:2 | D2:2 | G2:4');

  addPiece({
    id: 'pomp',
    title: '「威風堂々」',
    full: 'エルガー 行進曲「威風堂々」第1番より（中間部）',
    composer: 'E.エルガー（1901年）',
    key: 'ト長調', trans: 0, meter: 2, beats: 80,
    tempi: [72, 80, 88],
    desc: '卒業式でおなじみの、あの堂々とした旋律。1回目はやわらかく、2回目は1オクターブ上で全員で大きく歌い上げる。長い音を息で支える音色と、和音の響きが問われる。',
    asks: '音色・音程・バランス',
    focus: {pitch: 1.1, tone: 1.15, expr: 1.05, rhythm: .85, balance: 1.05},
    balRef: 4.7, ceiling: .98,
    spans: [{name: '1回目（やわらかく）', from: 0, to: 32}, {name: '2回目（全員で）', from: 32, to: 80}],
    slur: 'bar',
    scale: [[0, [0, 2, 4, 6, 7, 9, 11]]],
    mel: POMP_MEL,
    chords: chords(POMP_CH),
    bass: POMP_BASS,
    dyn: [[0,.36],[8,.4],[14,.44],[16,.4],[24,.48],[28,.55],[31.9,.7],[32,.9],[44,.92],[48,.88],[56,1],[62,.95],[70,.98],[76,1],[80,.95]],
    rubato: [[0,1],[13.5,1],[14,1.06],[16,1],[28,1],[30,1.08],[31.9,1.15],[32,1],[54,1],[55.9,1.08],[56,1.04],[60,1],[70,1],[74,1.08],[76,1.25],[80,1.5]],
    groups: {
      hnA: {n: 2, lo: 52, hi: 66, rh: 'sus'}, wA: {n: 3, lo: 55, hi: 70, rh: 'sus'}, tbA: {n: 2, lo: 45, hi: 60, rh: 'sus'},
      hnG: {n: 2, lo: 55, hi: 70, rh: 'sus'}, wG: {n: 1, lo: 60, hi: 74, rh: 'sus'}, tpG: {n: 1, lo: 62, hi: 74, rh: 'sus'}, tbG: {n: 1, lo: 48, hi: 62, rh: 'sus'},
    },
    roles: {
      hn1:   [{f: 0, t: 32, r: 'mel', sh: 0}, {f: 32, t: 80, r: 'mel', sh: -12}],
      hn2:   [{f: 0, t: 32, r: 'mel', sh: 0, sc: .85}, {f: 32, t: 80, r: 'mel', sh: -12}],
      hn3:   [{f: 0, t: 32, r: 'pad', g: 'hnA', i: 0}, {f: 32, t: 80, r: 'pad', g: 'hnG', i: 0}],
      hn4:   [{f: 0, t: 32, r: 'pad', g: 'hnA', i: 1}, {f: 32, t: 80, r: 'pad', g: 'hnG', i: 1}],
      asax1: [{f: 0, t: 32, r: 'mel', sh: 0, sc: .8}, {f: 32, t: 80, r: 'mel', sh: -12}],
      asax2: [{f: 0, t: 32, r: 'pad', g: 'wA', i: 2}, {f: 32, t: 80, r: 'mel3', sh: -12}],
      tsax:  [{f: 0, t: 32, r: 'mel', sh: -12, sc: .7}, {f: 32, t: 80, r: 'mel', sh: -12, sc: .8}],
      euph:  [{f: 0, t: 32, r: 'mel', sh: -12, sc: .75}, {f: 32, t: 80, r: 'mel', sh: -24}],
      cl1:   [{f: 0, t: 32, r: 'mel', sh: 12, sc: .6}, {f: 32, t: 80, r: 'mel', sh: 0}],
      cl2:   [{f: 0, t: 32, r: 'pad', g: 'wA', i: 0}, {f: 32, t: 80, r: 'mel3', sh: 0}],
      cl3:   [{f: 0, t: 32, r: 'pad', g: 'wA', i: 1}, {f: 32, t: 80, r: 'pad', g: 'wG', i: 0}],
      ob:    [{f: 16, t: 32, r: 'mel', sh: 12, sc: .55}, {f: 32, t: 80, r: 'mel', sh: 0}],
      fl1:   [{f: 32, t: 80, r: 'mel', sh: 12}],
      fl2:   [{f: 32, t: 80, r: 'mel', sh: 0}],
      picc:  [{f: 32, t: 80, r: 'mel', sh: 12, sc: .6}],
      ebcl:  [{f: 32, t: 80, r: 'mel', sh: 0, sc: .7}],
      tp1:   [{f: 32, t: 80, r: 'mel', sh: -12}],
      tp2:   [{f: 32, t: 80, r: 'mel3', sh: -12, sc: .9}],
      tp3:   [{f: 32, t: 80, r: 'pad', g: 'tpG', i: 0}],
      tb1:   [{f: 0, t: 32, r: 'pad', g: 'tbA', i: 0, sc: .6}, {f: 32, t: 80, r: 'mel', sh: -24}],
      tb2:   [{f: 0, t: 32, r: 'pad', g: 'tbA', i: 1, sc: .6}, {f: 32, t: 80, r: 'pad', g: 'tbG', i: 0}],
      btb:   [{f: 32, t: 80, r: 'bass', sh: 0}],
      bcl:   [{f: 0, t: 80, r: 'bass', sh: 0}],
      fg:    [{f: 0, t: 32, r: 'bass', sh: 0, sc: .8}, {f: 32, t: 80, r: 'bass', sh: 0}],
      bsax:  [{f: 0, t: 32, r: 'bass', sh: 0, sc: .7}, {f: 32, t: 80, r: 'bass', sh: 0}],
      tuba:  [{f: 0, t: 32, r: 'bass', sh: 0, sc: .6}, {f: 32, t: 80, r: 'bass', sh: -12}],
      cb:    [{f: 0, t: 32, r: 'bass', sh: -12, sc: .7}, {f: 32, t: 80, r: 'bass', sh: -12}],
    },
    perc: {
      perc1: [
        {i: 'timp', b: 28, d: 4, m: 50, roll: true, v: .2, v1: .8},
        ...timpOn(POMP_BASS, each(32, 76, 2, b => [[b, b % 8 ? .5 : .7]])),
        {i: 'timp', b: 76, d: 4, m: 43, roll: true, v: .6, v1: 1},
      ],
      perc2: [{i: 'sus', b: 28, d: 4, roll: true, v: .08, v1: .7}, {i: 'sus', b: 76, d: 4, roll: true, v: .3, v1: .9}],
      perc3: [{i: 'bd', b: 30, d: 2, roll: true, v: .1, v1: .5}, ...each(32, 76, 4, b => [{i: 'bd', b, v: b === 56 ? .7 : .45}]), {i: 'bd', b: 76, v: .9}],
      perc4: hitsAt('cym', [[32, .9], [56, .8], [76, 1]]),
    },
    // 解釈（テンポ・揺れ）が部の実力に合っているか。当てはまるものを [点の増減, 講評] で返す
    interpRules: (perf, ip) => [
      ip.tempo === 2 && [-3, '急ぎ足に聞こえ、この旋律の堂々とした感じが出ていません。'],
      ip.rub === 0 && [-2, 'フレーズの終わりで、もう少し息をたっぷり使ってほしいところです。'],
    ],
  });
}
