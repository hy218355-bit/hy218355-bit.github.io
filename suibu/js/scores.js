'use strict';
/* 曲と編曲
   どちらもハ長調で書き、trans で原調へ移す。
   旋律・和音・低音だけを手で書き、内声（ホルンやクラリネットの和音）は和音進行から自動で配置する。 */

const PC = {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11};
const SCALE = [0, 2, 4, 5, 7, 9, 11];

function nn(name){
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if(!m) throw new Error('音名が読めません: ' + name);
  return 12 * (+m[3] + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
// "E4:1.5 G4:.5 | r:1" → [{m, b, d}]（拍単位、":"がなければ1拍）
function line(src, from = 0){
  const out = [];
  let b = from;
  for(const tok of src.split(/\s+/)){
    if(!tok || tok === '|') continue;
    const [p, dd] = tok.split(':');
    const d = dd ? +dd : 1;
    if(p !== 'r') out.push({m: nn(p), b, d});
    b += d;
  }
  return out;
}
const CHORD_Q = {
  '':   {q: 'maj',  iv: [0, 4, 7]},
  'm':  {q: 'min',  iv: [0, 3, 7]},
  '7':  {q: 'dom7', iv: [0, 4, 7, 10]},
  'm7': {q: 'min7', iv: [0, 3, 7, 10]},
};
function chords(src, from = 0){
  const out = [];
  let b = from;
  for(const tok of src.split(/\s+/)){
    if(!tok || tok === '|') continue;
    const [nm, dd] = tok.split(':');
    const d = dd ? +dd : 4;
    const m = /^([A-G])(#|b)?(m7|m|7)?(?:\/[A-G])?$/.exec(nm);
    if(!m) throw new Error('和音が読めません: ' + nm);
    const root = (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
    const cq = CHORD_Q[m[3] || ''];
    out.push({b, d, root, q: cq.q, pcs: cq.iv.map(i => (root + i) % 12)});
    b += d;
  }
  return out;
}
const shift = (evs, by) => evs.map(e => ({...e, b: e.b + by}));

// 純正調で取るときの平均律からのずれ（セント）。長3度は約14セント低く、短3度は約16セント高く
const JI = {
  maj:  {0: 0, 4: -13.7, 7: 2},
  min:  {0: 0, 3: 15.6, 7: 2},
  dom7: {0: 0, 4: -13.7, 7: 2, 10: -31.2},
  min7: {0: 0, 3: 15.6, 7: 2, 10: 17.6},
};

/* ===== 自由曲1：ドヴォルザーク《新世界より》第2楽章 Largo ===== */
const LARGO_MEL = 'E5:1.5 G5:.5 G5:2 | E5:1.5 D5:.5 C5:2 | D5:1.5 E5:.5 G5:1.5 E5:.5 | D5:3 r:1 | E5:1.5 G5:.5 G5:2 | E5:1.5 D5:.5 C5:2 | D5:1.5 E5:.5 D5:1.5 C5:.5 | C5:4';
const LARGO_CH = 'C:4 | Am:4 | Dm/F:2 G:4 G7:2 | C:4 | Am:2 F:2 | Dm7:2 G7:2 | C:4';
const LARGO_BASS = 'C3:4 | A2:4 | F2:2 G2:6 | C3:4 | A2:2 F2:2 | D2:2 G2:2 | C2:4';

/* ===== 自由曲2：ベートーヴェン《第九》第4楽章より「歓喜の歌」 ===== */
const ODE_MEL = 'E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4:1.5 D4:.5 D4:2 | E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:.5 C4:2 | D4 D4 E4 C4 | D4 E4:.5 F4:.5 E4 C4 | D4 E4:.5 F4:.5 E4 D4 | C4 D4 G3:2 | E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:.5 C4:2 | C4:4';
const ODE_CH = 'C:2 C:2 | G7:2 C:2 | Am:2 C:2 | C:2 G:2 | C:2 C:2 | G7:2 C:2 | Am:2 C:2 | G7:2 C:2 | G:2 C:2 | G7:2 C:2 | G7:2 C:2 | Am:1 D7:1 G:2 | C:2 C:2 | G7:2 C:2 | F:2 C:2 | G7:2 C:2 | C:4';
const ODE_BASS = 'C3:2 C3:2 | G2:2 C3:2 | A2:2 C3:2 | C3:2 G2:2 | C3:2 C3:2 | G2:2 C3:2 | A2:2 C3:2 | G2:2 C3:2 | G2:2 C3:2 | G2:2 C3:2 | G2:2 C3:2 | A2:1 D3:1 G2:2 | C3:2 C3:2 | G2:2 C3:2 | F2:2 C3:2 | G2:2 C3:2 | C2:4';

const range4 = (g, f, t, extra = {}) => [0, 1, 2, 3].map(i => ({f, t, r: 'pad', g, i, ...extra}));

const PIECES = {
  largo: {
    id: 'largo',
    title: '《新世界より》第2楽章',
    full: 'ドヴォルザーク 交響曲第9番「新世界より」第2楽章 Largo',
    composer: 'A.ドヴォルザーク（1893年）',
    key: '変ニ長調', trans: 1, meter: 4, beats: 64,
    tempi: [52, 60, 68],
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
  },

  ode: {
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
  },
};
const PIECE_IDS = ['largo', 'ode'];

/* ===== 編曲の組み立て ===== */
function chordAt(pc, b){
  return pc.chords.find(c => b >= c.b - 1e-6 && b < c.b + c.d - 1e-6) || pc.chords[pc.chords.length - 1];
}
function jiOf(m, c){
  const iv = ((m - c.root) % 12 + 12) % 12;
  return JI[c.q][iv] ?? 0;
}
// 旋律の下3度（和音の音なら和音の中で、経過音なら音階の3度下）
function thirdBelow(m, c){
  const pc = ((m % 12) + 12) % 12;
  if(c && c.pcs.includes(pc)){
    for(const iv of [3, 4, 5, 8, 9]) if(c.pcs.includes(((m - iv) % 12 + 12) % 12)) return m - iv;
  }
  const idx = SCALE.indexOf(pc);
  if(idx < 0) return m - 3;
  return m - ((pc - SCALE[(idx + 5) % 7] + 12) % 12);
}
// 和音を n 声に配置する。前の和音から動きが少なく、3度と7度を落とさない形を選ぶ
function voiceGroup(chs, n, lo, hi){
  const out = [];
  let prev = null;
  for(const c of chs){
    const cand = [];
    for(let m = lo; m <= hi; m++) if(c.pcs.includes(m % 12)) cand.push(m);
    const third = (c.root + (c.q === 'min' || c.q === 'min7' ? 3 : 4)) % 12;
    const cost = v => {
      let k = 0;
      if(prev) for(let i = 0; i < n; i++) k += Math.abs(v[i] - prev[i]);
      else for(let i = 0; i < n; i++) k += 0.3 * Math.abs(v[i] - (hi - (hi - lo) * (i + 0.5) / n));
      const pcs = v.map(m => m % 12);
      if(n >= 2 && !pcs.includes(third)) k += 9;
      if(c.pcs.length === 4 && n >= 3 && !pcs.includes((c.root + 10) % 12)) k += 5;
      if(n >= 3 && !pcs.includes(c.root)) k += 3;
      if(pcs.filter(p => p === third).length > 1) k += 6;
      for(let i = 0; i < n - 1; i++){
        const g = v[i] - v[i+1];
        if(g <= 2) k += 5;
        if(g > 9) k += (g - 9) * 0.8;
      }
      return k;
    };
    let best = null, bc = Infinity;
    const acc = [];
    const walk = start => {
      if(acc.length === n){
        const v = acc.slice().sort((a, b) => b - a);
        const k = cost(v);
        if(k < bc){ bc = k; best = v; }
        return;
      }
      for(let i = start; i < cand.length; i++){ acc.push(cand[i]); walk(i + 1); acc.pop(); }
    };
    walk(0);
    if(!best) best = Array.from({length: n}, (_, i) => cand[Math.max(0, cand.length - 1 - i)] ?? lo);
    out.push(best);
    prev = best;
  }
  return out;
}
function clipChords(pc, f, t){
  return pc.chords.filter(c => c.b < t - 1e-6 && c.b + c.d > f + 1e-6)
    .map(c => ({...c, b: Math.max(c.b, f), d: Math.min(c.b + c.d, t) - Math.max(c.b, f)}));
}

const ROLE_SCALE = {mel: 1, mel3: .9, pad: .62, bass: .8, hit: 1};
const ARR = {};

function arrangement(pid){
  if(ARR[pid]) return ARR[pid];
  const pc = PIECES[pid];
  const parts = {};
  const vcache = {};
  const push = (part, ev) => (parts[part] ||= []).push(ev);
  const inRange = (e, sg) => e.b >= sg.f - 1e-6 && e.b < sg.t - 1e-6;

  for(const [part, segs] of Object.entries(pc.roles)){
    for(const sg of segs){
      const sc = (sg.sc ?? 1) * ROLE_SCALE[sg.r];
      const base = {role: sg.r, sc, solo: !!sg.solo, fb: sg.fb, inst: sg.inst};
      if(sg.r === 'mel' || sg.r === 'mel3'){
        for(const e of pc.mel.filter(e => inRange(e, sg))){
          const c = chordAt(pc, e.b);
          const m0 = sg.r === 'mel' ? e.m : thirdBelow(e.m, c);
          push(part, {...base, m: m0 + sg.sh, b: e.b, d: e.d, ji: jiOf(m0, c)});
        }
      } else if(sg.r === 'pad'){
        const g = pc.groups[sg.g];
        const chs = clipChords(pc, sg.f, sg.t);
        const key = `${sg.g}:${sg.f}:${sg.t}`;
        const vs = vcache[key] ||= voiceGroup(chs, g.n, g.lo, g.hi);
        chs.forEach((c, k) => {
          const m = vs[k][sg.i];
          if(g.rh === 'ab'){
            for(let b = Math.ceil(c.b - 1e-6); b < c.b + c.d - 1e-6; b++){
              if(b % 2 === 1) push(part, {...base, m, b, d: .5, ji: jiOf(m, c), art: 'stac'});
            }
          } else {
            push(part, {...base, m, b: c.b, d: c.d, ji: jiOf(m, c)});
          }
        });
      } else if(sg.r === 'bass'){
        const evs = pc.bass.filter(e => inRange(e, sg));
        for(const e of evs){
          const c = chordAt(pc, e.b);
          const m = e.m + sg.sh;
          if(sg.rh === 'march') push(part, {...base, m, b: e.b, d: Math.min(e.d, .8), ji: jiOf(e.m, c), art: 'norm'});
          else if(sg.rh === 'pizz') push(part, {...base, m, b: e.b, d: 1, ji: jiOf(e.m, c), inst: 'cbpizz', kind: 'hit'});
          else push(part, {...base, m, b: e.b, d: e.d, ji: jiOf(e.m, c)});
        }
      }
    }
  }
  for(const [part, evs] of Object.entries(pc.perc)){
    for(const e of evs) push(part, {role: 'hit', sc: 1, kind: 'hit', inst: e.i, m: e.m, b: e.b, d: e.d || 0, v: e.v, v1: e.v1, roll: !!e.roll, ji: 0});
  }
  // 打楽器パートの鍵盤（ロール指定の旋律）も打つ音として扱う
  for(const evs of Object.values(parts)) for(const e of evs) if(e.inst && e.inst !== 'cbpizz' && e.role !== 'hit') e.kind = 'hit';

  for(const [part, evs] of Object.entries(parts)){
    evs.sort((a, b) => a.b - b.b);
    // 楽器の音域に収める（はみ出したらオクターブで移す）
    for(const e of evs){
      if(e.m == null) continue;
      const inst = INST[e.inst || PART_INST[part]];
      if(!inst || !inst.range) continue;
      const s = e.m + pc.trans;
      if(s < inst.range[0]) e.m += 12 * Math.ceil((inst.range[0] - s) / 12);
      else if(s > inst.range[1]) e.m -= 12 * Math.ceil((s - inst.range[1]) / 12);
    }
    // つなぎ方：スラー／やわらかいタンギング／普通のタンギング
    for(let i = 0; i < evs.length; i++){
      const e = evs[i], p = evs[i-1];
      if(e.kind === 'hit') continue;
      const joined = p && p.kind !== 'hit' && Math.abs(p.b + p.d - e.b) < 1e-6;
      if(e.art === 'stac' || e.art === 'norm'){ e.slur = false; continue; }
      if(!joined){ e.art = 'norm'; e.slur = false; continue; }
      if(p.m === e.m && e.role !== 'mel' && e.role !== 'mel3'){ e.art = 'tie'; e.slur = true; continue; }
      if(e.role === 'mel' || e.role === 'mel3'){
        const barStart = Math.abs(e.b / pc.meter - Math.round(e.b / pc.meter)) < 1e-6;
        const slurred = pc.slur === 'bar' ? !barStart && p.m !== e.m : (p.d <= .5 && e.d <= .5 && p.m !== e.m);
        e.art = slurred ? 'slur' : pc.slur === 'bar' ? 'ten' : 'norm';
        e.slur = slurred;
      } else {
        e.art = 'ten'; e.slur = false;
      }
      p.leg = true;
    }
  }
  return (ARR[pid] = {parts, pc});
}
