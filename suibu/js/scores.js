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
// "E4:1.5 G4:.5 | r:1" → [{m, b, d}]（拍単位、":"がなければ1拍）。末尾の ' はスタッカート、> はアクセント
function line(src, from = 0){
  const out = [];
  let b = from;
  for(const tok of src.split(/\s+/)){
    if(!tok || tok === '|') continue;
    const mk = /^([^:'>]+)(?::([\d.]+))?(['>]*)$/.exec(tok);
    if(!mk) throw new Error('音符が読めません: ' + tok);
    const d = mk[2] ? +mk[2] : 1;
    if(mk[1] !== 'r'){
      const e = {m: nn(mk[1]), b, d};
      if(mk[3].includes("'")) e.st = true;
      if(mk[3].includes('>')) e.acc = true;
      out.push(e);
    }
    b += d;
  }
  return out;
}
const CHORD_Q = {
  '':   {q: 'maj',  iv: [0, 4, 7]},
  'm':  {q: 'min',  iv: [0, 3, 7]},
  '7':  {q: 'dom7', iv: [0, 4, 7, 10]},
  'm7': {q: 'min7', iv: [0, 3, 7, 10]},
  '5':    {q: 'pow',  iv: [0, 7]},
  'sus4': {q: 'sus4', iv: [0, 5, 7]},
  'sus2': {q: 'sus2', iv: [0, 2, 7]},
};
function chords(src, from = 0){
  const out = [];
  let b = from;
  for(const tok of src.split(/\s+/)){
    if(!tok || tok === '|') continue;
    const [nm, dd] = tok.split(':');
    const d = dd ? +dd : 4;
    const m = /^([A-G])(#|b)?(m7|m|7|5|sus4|sus2)?(?:\/[A-G])?$/.exec(nm);
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
  pow:  {0: 0, 7: 2},
  sus4: {0: 0, 5: -2, 7: 2},
  sus2: {0: 0, 2: 3.9, 7: 2},
};
const HAS_THIRD = {maj: 4, min: 3, dom7: 4, min7: 3};

/* ===== 自由曲1：ドヴォルザーク《新世界より》第2楽章 Largo ===== */
const LARGO_MEL = 'E5:1.5 G5:.5 G5:2 | E5:1.5 D5:.5 C5:2 | D5:1.5 E5:.5 G5:1.5 E5:.5 | D5:3 r:1 | E5:1.5 G5:.5 G5:2 | E5:1.5 D5:.5 C5:2 | D5:1.5 E5:.5 D5:1.5 C5:.5 | C5:4';
const LARGO_CH = 'C:4 | Am:4 | Dm/F:2 G:4 G7:2 | C:4 | Am:2 F:2 | Dm7:2 G7:2 | C:4';
const LARGO_BASS = 'C3:4 | A2:4 | F2:2 G2:6 | C3:4 | A2:2 F2:2 | D2:2 G2:2 | C2:4';

/* ===== 自由曲2：ベートーヴェン《第九》第4楽章より「歓喜の歌」 ===== */
const ODE_MEL = 'E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4:1.5 D4:.5 D4:2 | E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:.5 C4:2 | D4 D4 E4 C4 | D4 E4:.5 F4:.5 E4 C4 | D4 E4:.5 F4:.5 E4 D4 | C4 D4 G3:2 | E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:.5 C4:2 | C4:4';
const ODE_CH = 'C:2 C:2 | G7:2 C:2 | Am:2 C:2 | C:2 G:2 | C:2 C:2 | G7:2 C:2 | Am:2 C:2 | G7:2 C:2 | G:2 C:2 | G7:2 C:2 | G7:2 C:2 | Am:1 D7:1 G:2 | C:2 C:2 | G7:2 C:2 | F:2 C:2 | G7:2 C:2 | C:4';
const ODE_BASS = 'C3:2 C3:2 | G2:2 C3:2 | A2:2 C3:2 | C3:2 G2:2 | C3:2 C3:2 | G2:2 C3:2 | A2:2 C3:2 | G2:2 C3:2 | G2:2 C3:2 | G2:2 C3:2 | G2:2 C3:2 | A2:1 D3:1 G2:2 | C3:2 C3:2 | G2:2 C3:2 | F2:2 C3:2 | G2:2 C3:2 | C2:4';

// 打楽器の譜を書くための道具：each で同じ型をくり返し、hitsAt で [拍, 強さ] の並びを打つ音にする
const each = (from, to, step, fn) => { const out = []; for(let b = from, k = 0; b < to - 1e-6; b += step, k++) out.push(...fn(b, k)); return out; };
const hitsAt = (i, list, b0 = 0) => list.map(([o, v]) => ({i, b: b0 + o, v}));

/* ===== 自由曲3：コンサートマーチ「ひかりの通学路」（このゲームのための書き下ろし）=====
   2/4拍子。序奏 → 第1マーチ → トリオ（下属調）→ ブレイク（低音の掛け合い）→ トリオの再現（対旋律つき）→ 最後の一撃 */
const MARCH_MEL = [
  "C5:1> G4:.75 G4:.25 | C5:.5 E5:.5 G5:1> | A5:.75 G5:.25 F5:.5 E5:.5 | D5:1> G4:.5' r:.5",
  "E5:.75 D5:.25 C5:.5 E5:.5 | G5:1 E5:.5 C5:.5 | D5:.75 C5:.25 B4:.5 C5:.5 | D5:1.5 r:.5",
  "F5:.75 E5:.25 D5:.5 F5:.5 | A5:1 G5:.5 F5:.5 | E5:.5' G5:.5' C5:.5' E5:.5' | D5:1.5 r:.5",
  "E5:.75 D5:.25 C5:.5 E5:.5 | G5:1 C6:1> | B5:.75 A5:.25 G5:.5 F5:.5 | E5:1 A5:1",
  "G5:.75 F5:.25 E5:.5 D5:.5 | C5:.5' E5:.5' A5:.5' G5:.5' | F5:.5' D5:.5' B4:.5' D5:.5' | C5:1> r:1",
].join(' | ');
const MARCH_TRIO = 'A4:1.5 C5:.5 | F5:1 E5:.5 D5:.5 | C5:1.5 A4:.5 | Bb4:1 G4:1 | G4:1.5 Bb4:.5 | E5:1 D5:.5 C5:.5 | Bb4:1 A4:.5 G4:.5 | A4:2 | A4:1.5 C5:.5 | F5:1 G5:.5 A5:.5 | Bb5:1 A5:.5 G5:.5 | F5:1 D5:1';
const MARCH_BREAK = 'C4:.5> C4:.25 C4:.25 Db4:.5> C4:.5 | Eb4:.5> Eb4:.25 Eb4:.25 D4:.5> C4:.5 | F4:.5 G4:.5 Ab4:.5 Bb4:.5 | C5:1> r:1';
const MARCH_TRIO_CH = 'F:2 | Dm:2 | F:2 | C7:2 | Gm:2 | C7:2 | C7:2 | F:2 | F:2 | F:2 | Gm7:2 | Bb:2 | F:2 | Dm:1 Gm:1 | C7:2 | F:2';
const MARCH_TRIO_BASS = 'F2 C3 | D3 A2 | F2 C3 | C3 G2 | G2 D3 | C3 G2 | C3 G2 | F2 C3 | F2 C3 | F2 A2 | G2 D3 | Bb2 F2 | C3 F2 | D3 G2 | C3 C2';
const MARCH_CM = 'C4:.5 D4:.5 E4:.5 F4:.5 | A4:2 | F4:.5 E4:.5 F4:.5 C4:.5 | E4:2 | Bb3:.5 C4:.5 D4:.5 Bb3:.5 | G4:1 E4:1 | C4:.5 D4:.5 E4:.5 C4:.5 | F4:.5 E4:.5 D4:.5 C4:.5 | C4:.5 D4:.5 E4:.5 F4:.5 | A4:2 | D4:.5 E4:.5 F4:.5 G4:.5 | Bb4:1 F4:1 | A4:1 G4:.5 F4:.5 | F4:1 D4:1 | E4:1 C4:1 | A4:1> r:1';
const MARCH_SD = [[0, .5], [.5, .28], [.75, .28], [1, .42], [1.5, .3]];
// 区切りの小節：前半2拍たたいて、後半はロールで次の小節へ
const sdTurn = (b, up = 0) => [{i: 'sd', b, v: .5 + up}, {i: 'sd', b: b + .5, v: .32 + up}, {i: 'sd', b: b + 1, d: 1, roll: true, v: .3 + up, v1: .55 + up}];
const hnRole = i => [
  {f: 0, t: 8, r: 'pad', g: 'hnI', i}, {f: 8, t: 40, r: 'pad', g: 'hnAB', i}, {f: 40, t: 72, r: 'pad', g: 'hnTr', i, sc: .6}, {f: 72, t: 80, r: 'pad', g: 'hnBr', i},
  i < 2 ? {f: 80, t: 112, r: 'cm', sh: 0} : {f: 80, t: 112, r: 'pad', g: 'hnG', i: i - 2},
  {f: 112, t: 114, r: 'pad', g: 'cdHnA', i}, {f: 114, t: 116, r: 'pad', g: 'cdHnB', i},
];
const CODA_A = {pat: [[0, .5, 'stac'], [.5, .5, 'stac'], [1, 1, 'norm', true]]};
const CODA_B = {pat: [[0, .5, 'stac', true]]};

/* ===== 自由曲4：吹奏楽のための「月と祭」（このゲームのための書き下ろし）=====
   序奏は都節音階（ミ・ファ・ラ・シ・ド）で、尺八のようなフルートのソロ。拍子木の合図で、民謡音階（ラ・ド・レ・ミ・ソ）の祭りへ */
const WA_INTRO = 'r:1 B5:2.5 A5:.5 | B5:1 C6:2 B5:.5 A5:.5 | F5:3 E5:1 | E5:4 | r:.5 E6:.5 F6:1.5 E6:.5 C6:1 | B5:2 A5:1 B5:1';
const WA_MAT = 'A4:.5 C5:.5 D5:1> E5:.5 D5:.5 C5:1 | D5:.5 E5:.5 G5:1 E5:1.5 r:.5 | A5:.5 G5:.5 E5:1> D5:.5 E5:.5 C5:1 | D5:1.5 C5:.5 A4:2 | C5:.5 D5:.5 E5:.5 G5:.5 A5:1> G5:.5 E5:.5 | G5:1 E5:.5 D5:.5 E5:2 | A5:.5> A5:.5 G5:.5 E5:.5 D5:.5 E5:.5 C5:.5 D5:.5';
const WA_MAT_CH = 'A5:4 | G5:2 Em:2 | Am:2 C:2 | D5:2 A5:2 | Am7:4 | Em:2 C:2 | Am:2 G5:1 Am:1 | A5:4';
const WA_MAT_BASS = 'A2:1 A2:.5 A2:.5 E2:1 A2:1 | G2:1 G2:.5 G2:.5 E2:1 E2:1 | A2:1 A2:.5 A2:.5 C3:1 C3:1 | D3:1 D3:.5 D3:.5 A2:1 A2:1 | A2:1 A2:.5 A2:.5 G2:1 E2:1 | E2:1 E2:.5 E2:.5 C3:1 C3:1 | A2:1 A2:1 G2:1 A2:1';
const WA_CM = 'E4:2 D4:1 C4:1 | D4:2 E4:2 | C4:2 E4:1 G4:1 | A3:1 D4:1 E4:2 | E4:.5 D4:.5 C4:1 A3:2 | E4:2 G4:2 | A4:1 G4:1 D4:1 E4:1 | A3:1 C4:1 E4:1 G4:1';
// 祭りの刻み：2拍目の裏表と4拍目（ホルン・テナー・3番トランペット）
const WA_STAB = {pat: [[1, .5, 'stac'], [1.5, .5, 'stac'], [3, 1, 'norm', true]]};
const SHIME_BAR = [[0, .5], [.5, .28], [1, .42], [1.5, .3], [1.75, .25], [2, .48], [2.5, .28], [3, .42], [3.5, .3]];
const waHn = i => [
  ...(i < 3 ? [{f: 0, t: 24, r: 'pad', g: 'hnI', i, sc: .7}] : []),
  {f: 24, t: 56, r: 'pad', g: 'hnP', i}, {f: 56, t: 88, r: 'cm', sh: 0},
  {f: 88, t: 92, r: 'pad', g: 'cdHnA', i}, {f: 92, t: 96, r: 'pad', g: 'cdHnB', i},
];

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
  march: {
    id: 'march',
    title: 'マーチ「ひかりの通学路」',
    full: 'コンサートマーチ「ひかりの通学路」',
    composer: 'このゲームのための書き下ろし（2026年）',
    key: '変ロ長調', trans: -2, meter: 2, beats: 116,
    tempi: [112, 120, 128],
    desc: '課題曲のようなコンサートマーチ。きびきびした行進のリズム、やわらかく歌うトリオ、対旋律が重なる最後の盛り上がり。縦の線のずれがすぐ聞こえる。',
    asks: 'リズム・バランス・音色',
    focus: {pitch: .95, tone: 1, expr: .85, rhythm: 1.25, balance: 1.05},
    balRef: 3.7, ceiling: .96,
    spans: [{name: '前半（序奏〜第1マーチ）', from: 0, to: 40}, {name: 'トリオ', from: 40, to: 72}, {name: '後半（ブレイク〜最後）', from: 72, to: 116}],
    slur: [[0, 'tongue'], [40, 'bar'], [72, 'tongue'], [80, 'bar'], [112, 'tongue']],
    scale: [[0, SCALE], [40, [0, 2, 4, 5, 7, 9, 10]], [72, [0, 1, 3, 5, 7, 8, 10]], [80, [0, 2, 4, 5, 7, 9, 10]]],
    mel: [...line(MARCH_MEL), ...line(MARCH_TRIO + ' | C5:1.5 F5:.5 | A4:1 G4:1 | G4:1 Bb4:.5 E4:.5 | F4:2', 40), ...line(MARCH_BREAK, 72),
          ...line(MARCH_TRIO + " | C5:1.5 F5:.5 | A5:1 Bb5:1 | C6:1> Bb5:.5 G5:.5 | F5:1> r:.5 C5:.5'", 80), ...line("F5:.5' A5:.5' C6:1> | F5:.5'> r:1.5", 112)],
    cm: line(MARCH_CM, 80),
    chords: [...chords('C:2 | C:2 | F:1 C:1 | G:2 | C:2 | C:2 | G7:2 | G:2 | Dm:2 | F:2 | C:2 | G:2 | C:2 | C:1 Am:1 | G7:2 | C:1 F:1 | C:2 | Am:1 F:1 | G7:2 | C:2'),
             ...chords(MARCH_TRIO_CH, 40), ...chords('C:2 | Ab:2 | Fm:1 Bb7:1 | C7:2', 72), ...chords(MARCH_TRIO_CH, 80), ...chords('F:2 | F:2', 112)],
    bass: [...line("C3:1> G2:1 | C3:1 E3:1 | F2:1 C3:1 | G2:1> G2:.5' r:.5 | C3 G2 | C3 G2 | G2 D2 | G2 D2 | D3 A2 | F2 C3 | C3 G2 | G2 D2 | C3 G2 | C3 A2 | G2 D2 | C3 F2 | C3 G2 | A2 F2 | G2 B2 | C3:1> r:1"),
           ...line(MARCH_TRIO_BASS + ' | F2 C3', 40), ...line('C2:2 | Ab1:2 | F2:1 Bb1:1 | C2:1> r:1', 72),
           ...line(MARCH_TRIO_BASS + " | F2:1> r:.5 C3:.5'", 80), ...line("F2:.5' A2:.5' C3:1> | F2:.5'> r:1.5", 112)],
    dyn: [[0,.82],[7.9,.82],[8,.55],[23.9,.58],[24,.62],[30,.72],[32,.66],[39.9,.6],
          [40,.3],[55.9,.34],[56,.36],[62,.46],[64,.4],[71.9,.34],
          [72,.66],[79.9,.86],[80,.88],[104,.9],[108,.96],[111.9,.94],[112,.9],[116,.95]],
    rubato: [[0,1],[7,1],[7.9,1.05],[8,1],[38,1],[39.9,1.08],[40,1],[70,1],[71.9,1.06],[72,1],[78,1.02],[79.9,1.12],[80,1],[108,1],[110,1.06],[112,1],[113,1.08],[114,1.12],[116,1.2]],
    groups: {
      hnI:   {n: 4, lo: 55, hi: 70, rh: 'sus'},
      tbI:   {n: 3, lo: 43, hi: 62, rh: 'sus'},
      tpI:   {n: 1, lo: 62, hi: 72, rh: 'sus'},
      clI:   {n: 1, lo: 55, hi: 67, rh: 'sus'},
      hnAB:  {n: 4, lo: 55, hi: 70, rh: 'ab8'},
      saxAB: {n: 2, lo: 58, hi: 72, rh: 'ab8'},
      clAB:  {n: 1, lo: 60, hi: 72, rh: 'ab8'},
      midAB: {n: 1, lo: 50, hi: 62, rh: 'ab8'},
      tp3A:  {n: 1, lo: 60, hi: 70, rh: 'ab8'},
      tbA:   {n: 3, lo: 46, hi: 62, rh: 'sus'},
      hnTr:  {n: 4, lo: 53, hi: 69, rh: 'ab8'},
      clTr:  {n: 1, lo: 55, hi: 67, rh: 'sus'},
      tenTr: {n: 1, lo: 50, hi: 62, rh: 'sus'},
      tbTr:  {n: 2, lo: 46, hi: 60, rh: 'sus'},
      woodBr:{n: 4, lo: 67, hi: 84, rh: 'sus'},
      clBr:  {n: 2, lo: 57, hi: 69, rh: 'sus'},
      saxBr: {n: 2, lo: 58, hi: 72, rh: 'sus'},
      tpBr:  {n: 3, lo: 60, hi: 74, rh: {pat: [[0, .5, 'norm', true]]}},
      hnBr:  {n: 4, lo: 53, hi: 69, rh: 'sus'},
      gAB:   {n: 2, lo: 57, hi: 72, rh: 'ab8'},
      hnG:   {n: 2, lo: 55, hi: 69, rh: 'ab8'},
      tpG:   {n: 1, lo: 62, hi: 72, rh: 'sus'},
      cdHnA: {n: 4, lo: 55, hi: 70, rh: CODA_A}, cdHnB: {n: 4, lo: 55, hi: 70, rh: CODA_B},
      cdTbA: {n: 3, lo: 41, hi: 62, rh: CODA_A}, cdTbB: {n: 3, lo: 41, hi: 62, rh: CODA_B},
      cdTpA: {n: 1, lo: 62, hi: 74, rh: CODA_A}, cdTpB: {n: 1, lo: 62, hi: 74, rh: CODA_B},
    },
    roles: {
      picc:  [{f: 0, t: 8, r: 'mel', sh: 12, sc: .7}, {f: 24, t: 40, r: 'mel', sh: 12, sc: .6}, {f: 80, t: 116, r: 'mel', sh: 12, sc: .8}],
      fl1:   [{f: 0, t: 8, r: 'mel', sh: 12}, {f: 8, t: 40, r: 'mel', sh: 12, sc: .75}, {f: 56, t: 72, r: 'mel', sh: 12, sc: .6}, {f: 72, t: 80, r: 'pad', g: 'woodBr', i: 0}, {f: 80, t: 116, r: 'mel', sh: 12}],
      fl2:   [{f: 0, t: 8, r: 'mel3', sh: 12}, {f: 8, t: 40, r: 'mel3', sh: 12, sc: .7}, {f: 56, t: 72, r: 'mel3', sh: 12, sc: .55}, {f: 72, t: 80, r: 'pad', g: 'woodBr', i: 1}, {f: 80, t: 116, r: 'mel3', sh: 12}],
      ob:    [{f: 0, t: 8, r: 'mel', sh: 0}, {f: 8, t: 40, r: 'mel', sh: 0, sc: .8}, {f: 56, t: 72, r: 'mel', sh: 0, sc: .7}, {f: 72, t: 80, r: 'pad', g: 'woodBr', i: 2}, {f: 80, t: 116, r: 'mel', sh: 0}],
      ebcl:  [{f: 0, t: 8, r: 'mel', sh: 0, sc: .7}, {f: 24, t: 40, r: 'mel', sh: 0, sc: .7}, {f: 80, t: 116, r: 'mel', sh: 0, sc: .7}],
      cl1:   [{f: 0, t: 72, r: 'mel', sh: 0}, {f: 72, t: 80, r: 'pad', g: 'woodBr', i: 3}, {f: 80, t: 116, r: 'mel', sh: 0}],
      cl2:   [{f: 0, t: 72, r: 'mel3', sh: 0}, {f: 72, t: 80, r: 'pad', g: 'clBr', i: 0}, {f: 80, t: 116, r: 'mel3', sh: 0}],
      cl3:   [{f: 0, t: 8, r: 'pad', g: 'clI', i: 0}, {f: 8, t: 40, r: 'pad', g: 'clAB', i: 0}, {f: 40, t: 72, r: 'pad', g: 'clTr', i: 0, sc: .7}, {f: 72, t: 80, r: 'pad', g: 'clBr', i: 1}, {f: 80, t: 112, r: 'pad', g: 'gAB', i: 0}, {f: 112, t: 116, r: 'mel3', sh: -12}],
      bcl:   [{f: 0, t: 40, r: 'bass', sh: 0, rh: 'march'}, {f: 40, t: 72, r: 'bass', sh: 0, rh: 'march', sc: .7}, {f: 72, t: 80, r: 'mel', sh: -12}, {f: 80, t: 116, r: 'bass', sh: 0, rh: 'march'}],
      fg:    [{f: 0, t: 40, r: 'bass', sh: 0, rh: 'march', sc: .85}, {f: 40, t: 80, r: 'mel', sh: -12, sc: .8}, {f: 80, t: 116, r: 'bass', sh: 0, rh: 'march'}],
      asax1: [{f: 0, t: 8, r: 'mel', sh: 0}, {f: 8, t: 40, r: 'pad', g: 'saxAB', i: 0}, {f: 40, t: 72, r: 'mel', sh: -12, sc: .7}, {f: 72, t: 80, r: 'pad', g: 'saxBr', i: 0}, {f: 80, t: 112, r: 'cm', sh: 12}, {f: 112, t: 116, r: 'mel3', sh: 0}],
      asax2: [{f: 0, t: 8, r: 'mel3', sh: 0}, {f: 8, t: 40, r: 'pad', g: 'saxAB', i: 1}, {f: 40, t: 72, r: 'mel3', sh: -12, sc: .65}, {f: 72, t: 80, r: 'pad', g: 'saxBr', i: 1}, {f: 80, t: 112, r: 'pad', g: 'gAB', i: 1}, {f: 112, t: 116, r: 'mel3', sh: -12}],
      tsax:  [{f: 0, t: 8, r: 'mel', sh: -12}, {f: 8, t: 40, r: 'pad', g: 'midAB', i: 0}, {f: 40, t: 72, r: 'pad', g: 'tenTr', i: 0, sc: .7}, {f: 72, t: 80, r: 'mel', sh: 0}, {f: 80, t: 112, r: 'cm', sh: 0}, {f: 112, t: 116, r: 'mel', sh: -12}],
      bsax:  [{f: 0, t: 40, r: 'bass', sh: 0, rh: 'march'}, {f: 40, t: 72, r: 'bass', sh: 0, rh: 'march', sc: .7}, {f: 72, t: 80, r: 'mel', sh: -12}, {f: 80, t: 116, r: 'bass', sh: 0, rh: 'march'}],
      tp1:   [{f: 0, t: 8, r: 'mel', sh: 0}, {f: 8, t: 40, r: 'mel', sh: 0, sc: .85}, {f: 72, t: 80, r: 'pad', g: 'tpBr', i: 0}, {f: 80, t: 116, r: 'mel', sh: 0}],
      tp2:   [{f: 0, t: 8, r: 'mel3', sh: 0}, {f: 8, t: 40, r: 'mel3', sh: 0, sc: .8}, {f: 72, t: 80, r: 'pad', g: 'tpBr', i: 1}, {f: 80, t: 116, r: 'mel3', sh: 0}],
      tp3:   [{f: 0, t: 8, r: 'pad', g: 'tpI', i: 0}, {f: 8, t: 40, r: 'pad', g: 'tp3A', i: 0, sc: .7}, {f: 72, t: 80, r: 'pad', g: 'tpBr', i: 2}, {f: 80, t: 112, r: 'pad', g: 'tpG', i: 0}, {f: 112, t: 114, r: 'pad', g: 'cdTpA', i: 0}, {f: 114, t: 116, r: 'pad', g: 'cdTpB', i: 0}],
      hn1: hnRole(0), hn2: hnRole(1), hn3: hnRole(2), hn4: hnRole(3),
      tb1:   [{f: 0, t: 8, r: 'pad', g: 'tbI', i: 0}, {f: 24, t: 40, r: 'pad', g: 'tbA', i: 0, sc: .6}, {f: 56, t: 72, r: 'pad', g: 'tbTr', i: 0, sc: .5}, {f: 72, t: 80, r: 'mel', sh: 0}, {f: 80, t: 112, r: 'cm', sh: 0}, {f: 112, t: 114, r: 'pad', g: 'cdTbA', i: 0}, {f: 114, t: 116, r: 'pad', g: 'cdTbB', i: 0}],
      tb2:   [{f: 0, t: 8, r: 'pad', g: 'tbI', i: 1}, {f: 24, t: 40, r: 'pad', g: 'tbA', i: 1, sc: .6}, {f: 56, t: 72, r: 'pad', g: 'tbTr', i: 1, sc: .5}, {f: 72, t: 80, r: 'mel', sh: -12}, {f: 80, t: 112, r: 'cm', sh: -12}, {f: 112, t: 114, r: 'pad', g: 'cdTbA', i: 1}, {f: 114, t: 116, r: 'pad', g: 'cdTbB', i: 1}],
      btb:   [{f: 0, t: 8, r: 'pad', g: 'tbI', i: 2}, {f: 8, t: 40, r: 'bass', sh: 0, rh: 'march'}, {f: 40, t: 72, r: 'bass', sh: 0, rh: 'march', sc: .6}, {f: 72, t: 80, r: 'mel', sh: -24}, {f: 80, t: 112, r: 'bass', sh: 0, rh: 'march'}, {f: 112, t: 114, r: 'pad', g: 'cdTbA', i: 2}, {f: 114, t: 116, r: 'pad', g: 'cdTbB', i: 2}],
      euph:  [{f: 0, t: 8, r: 'mel', sh: -12}, {f: 8, t: 40, r: 'mel', sh: -12, sc: .7}, {f: 40, t: 72, r: 'mel', sh: -12}, {f: 72, t: 80, r: 'mel', sh: 0}, {f: 80, t: 112, r: 'cm', sh: 0}, {f: 112, t: 116, r: 'mel', sh: -12}],
      tuba:  [{f: 0, t: 40, r: 'bass', sh: 0, rh: 'march'}, {f: 40, t: 72, r: 'bass', sh: 0, rh: 'march', sc: .65}, {f: 72, t: 80, r: 'mel', sh: -24}, {f: 80, t: 116, r: 'bass', sh: 0, rh: 'march'}],
      cb:    [{f: 0, t: 8, r: 'bass', sh: 0, rh: 'march'}, {f: 8, t: 72, r: 'bass', sh: 0, rh: 'pizz'}, {f: 72, t: 80, r: 'mel', sh: -24}, {f: 80, t: 116, r: 'bass', sh: 0, rh: 'march'}],
      perc4: [{f: 56, t: 72, r: 'mel', sh: 24, inst: 'glock', sc: .35}],
    },
    perc: {
      perc1: [
        {i: 'timp', b: 0, m: 48, v: .85}, {i: 'timp', b: 2, m: 48, v: .55}, {i: 'timp', b: 3, m: 48, v: .75}, {i: 'timp', b: 4, m: 41, v: .6}, {i: 'timp', b: 5, m: 48, v: .55}, {i: 'timp', b: 6, m: 43, v: .85}, {i: 'timp', b: 7, m: 43, v: .55},
        {i: 'timp', b: 8, m: 48, v: .45}, {i: 'timp', b: 16, m: 50, v: .4}, {i: 'timp', b: 24, m: 48, v: .5}, {i: 'timp', b: 27, m: 45, v: .6}, {i: 'timp', b: 32, m: 48, v: .5}, {i: 'timp', b: 36, m: 43, v: .5}, {i: 'timp', b: 38, m: 48, v: .7},
        {i: 'timp', b: 70, d: 2, m: 48, roll: true, v: .2, v1: .55},
        {i: 'timp', b: 72, m: 48, v: .85}, {i: 'timp', b: 73, m: 48, v: .6}, {i: 'timp', b: 74, m: 44, v: .85}, {i: 'timp', b: 75, m: 44, v: .6},
        {i: 'timp', b: 76, d: 2, m: 48, roll: true, v: .4, v1: .9}, {i: 'timp', b: 78, m: 48, v: 1},
        {i: 'timp', b: 80, m: 41, v: .85}, {i: 'timp', b: 84, m: 41, v: .55}, {i: 'timp', b: 88, m: 43, v: .55}, {i: 'timp', b: 92, m: 48, v: .6}, {i: 'timp', b: 96, m: 41, v: .7},
        {i: 'timp', b: 100, m: 43, v: .6}, {i: 'timp', b: 104, m: 41, v: .65}, {i: 'timp', b: 106, m: 50, v: .7}, {i: 'timp', b: 107, m: 43, v: .75},
        {i: 'timp', b: 108, d: 2, m: 48, roll: true, v: .7, v1: 1}, {i: 'timp', b: 110, m: 41, v: .95},
        {i: 'timp', b: 112, m: 41, v: .7}, {i: 'timp', b: 112.5, m: 45, v: .7}, {i: 'timp', b: 113, m: 48, v: .9}, {i: 'timp', b: 114, m: 41, v: 1},
      ],
      perc2: [
        ...hitsAt('sd', [[0,.85],[1,.5],[1.5,.5],[2,.6],[3,.75],[4,.55],[4.5,.4],[5,.6],[5.5,.4],[6,.8],[7,.6]]),
        ...each(8, 38, 2, b => [14, 22, 30].includes(b) ? sdTurn(b) : hitsAt('sd', MARCH_SD, b)),
        {i: 'sd', b: 38, v: .7},
        ...each(40, 72, 4, b => [{i: 'tri', b, v: b === 56 ? .32 : .22}]),
        ...hitsAt('sd', [[72,.85],[72.5,.5],[72.75,.5],[73,.8],[73.5,.5],[74,.85],[74.5,.5],[74.75,.5],[75,.8],[75.5,.5]]),
        {i: 'sd', b: 76, d: 2, roll: true, v: .45, v1: .95}, {i: 'sd', b: 78, v: 1},
        ...each(80, 108, 2, b => [86, 94, 102].includes(b) ? sdTurn(b, .12) : hitsAt('sd', MARCH_SD.map(([o, v]) => [o, v + .12]), b)),
        {i: 'sd', b: 108, d: 2, roll: true, v: .6, v1: .92}, {i: 'sd', b: 110, v: .9}, {i: 'sd', b: 111.5, v: .6},
        ...hitsAt('sd', [[112,.8],[112.5,.7],[113,.9],[114,1]]),
      ],
      perc3: [
        ...hitsAt('bd', [[0,.9],[2,.6],[3,.7],[4,.6],[6,.85]]),
        ...each(8, 38, 2, b => hitsAt('bd', [[0, .45], [1, .35]], b)), {i: 'bd', b: 38, v: .6},
        ...each(40, 72, 2, b => hitsAt('bd', [[0, .2]], b)),
        ...hitsAt('bd', [[72,.9],[73,.7],[74,.9],[75,.7]]), {i: 'bd', b: 76, d: 2, roll: true, v: .3, v1: .8}, {i: 'bd', b: 78, v: 1},
        ...each(80, 110, 2, b => hitsAt('bd', [[0, .58], [1, .45]], b)), {i: 'bd', b: 110, v: .9},
        ...hitsAt('bd', [[112,.8],[113,.85],[114,1]]),
      ],
      perc4: hitsAt('cym', [[0,.85],[6,.7],[8,.55],[16,.45],[24,.55],[27,.5],[32,.5],[38,.6],[72,.8],[74,.8],[78,1],[80,1],[88,.55],[96,.8],[104,.6],[110,.95],[112,.7],[114,1]]),
    },
  },

  wa: {
    id: 'wa',
    title: '「月と祭」',
    full: '吹奏楽のための「月と祭」',
    composer: 'このゲームのための書き下ろし（2026年）',
    key: '日本の音階（都節・民謡音階）', trans: -2, meter: 4, beats: 96,
    tempi: [120, 132, 144],
    tmap: [[0, 2], [24, 1]],
    desc: '月夜の序奏は、尺八のように吹くフルートのソロ。拍子木の合図で、太鼓と鈴が鳴る祭りへ駆け出す。日本の音階の歌い回しと、打楽器と管楽器のリズムのキレが問われる。',
    asks: '表現・リズム・音色',
    focus: {pitch: .95, tone: 1.05, expr: 1.15, rhythm: 1.1, balance: 1},
    balRef: 1.5, ceiling: .97,
    spans: [{name: '序奏（フルートのソロ）', from: 0, to: 24}, {name: '祭り（前半）', from: 24, to: 56}, {name: '祭り（後半〜最後）', from: 56, to: 96}],
    slur: [[0, 'bar'], [24, 'pairs']],
    scale: [[0, [0, 4, 5, 9, 11]], [24, [0, 2, 4, 7, 9]]],
    mel: [...line(WA_INTRO), ...line(WA_MAT + ' | A4:2> r:2', 24), ...line(WA_MAT + ' | A5:3> G5:.5 E5:.5', 56), ...line("E5:.5 G5:.5 A5:3> | A5:.5'> r:3.5", 88)],
    cm: line(WA_CM, 56),
    chords: [...chords('E5:4 | E5:2 Am:2 | F:4 | Esus4:2 E5:2 | Am:4 | E5:2 Esus4:1 E5:1'), ...chords(WA_MAT_CH, 24), ...chords(WA_MAT_CH, 56), ...chords('Asus4:2 A5:2 | A5:4', 88)],
    bass: [...line('E2:4 | E2:2 A2:2 | F2:4 | E2:4 | A2:4 | E2:4'), ...line(WA_MAT_BASS + ' | A2:1> r:3', 24),
           ...line(WA_MAT_BASS + ' | A2:1 A2:.5 A2:.5 E2:1 A2:1', 56), ...line("A2:4 | A2:.5'> r:3.5", 88)],
    dyn: [[0,.3],[3,.4],[8,.36],[12,.3],[15.9,.24],[16,.38],[18,.48],[20,.42],[22,.5],[23.9,.55],
          [24,.62],[38,.66],[40,.6],[48,.7],[52,.74],[55.9,.7],[56,.86],[70,.88],[72,.84],[80,.9],[86,.94],[88,.84],[91,.98],[92,1],[96,.9]],
    rubato: [[0,1.05],[3,.95],[4,1],[7,1.1],[8,1],[11,1.15],[12,1.08],[15.5,1.3],[16,1],[19,1.1],[20,1],[23.9,1],[24,1],[54,1],[56,1],[84,1],[86,1.06],[88,1],[90,1.08],[92,1.15],[96,1.2]],
    groups: {
      hnI:   {n: 3, lo: 52, hi: 66, rh: 'sus'},
      clI:   {n: 2, lo: 57, hi: 71, rh: 'sus'},
      hnP:   {n: 4, lo: 55, hi: 69, rh: WA_STAB},
      tsP:   {n: 1, lo: 50, hi: 62, rh: WA_STAB},
      tpB:   {n: 1, lo: 60, hi: 70, rh: WA_STAB},
      tbA:   {n: 2, lo: 45, hi: 57, rh: 'sus'},
      tbB:   {n: 1, lo: 45, hi: 57, rh: 'sus'},
      cdHnA: {n: 4, lo: 55, hi: 70, rh: 'sus'}, cdHnB: {n: 4, lo: 55, hi: 70, rh: CODA_B},
      cdTbA: {n: 3, lo: 41, hi: 60, rh: 'sus'}, cdTbB: {n: 3, lo: 41, hi: 60, rh: CODA_B},
      cdTpA: {n: 1, lo: 62, hi: 74, rh: 'sus'}, cdTpB: {n: 1, lo: 62, hi: 74, rh: CODA_B},
    },
    roles: {
      fl1:   [{f: 0, t: 24, r: 'mel', sh: 0, solo: true, fb: ['ob', 'cl1']}, {f: 24, t: 56, r: 'mel', sh: 12, sc: .7}, {f: 56, t: 96, r: 'mel', sh: 12}],
      fl2:   [{f: 24, t: 56, r: 'mel3', sh: 12, sc: .6}, {f: 56, t: 96, r: 'mel3', sh: 12}],
      picc:  [{f: 56, t: 96, r: 'mel', sh: 12, sc: .75}],
      ob:    [{f: 24, t: 96, r: 'mel', sh: 0}],
      ebcl:  [{f: 56, t: 96, r: 'mel', sh: 12, sc: .7}],
      cl1:   [{f: 16, t: 24, r: 'mel', sh: -12, sc: .6}, {f: 24, t: 56, r: 'mel', sh: 0}, {f: 56, t: 96, r: 'mel', sh: 12}],
      cl2:   [{f: 0, t: 24, r: 'pad', g: 'clI', i: 0, sc: .7}, {f: 24, t: 56, r: 'mel3', sh: 0}, {f: 56, t: 96, r: 'mel', sh: 0}],
      cl3:   [{f: 0, t: 24, r: 'pad', g: 'clI', i: 1, sc: .7}, {f: 24, t: 96, r: 'mel3', sh: 0}],
      bcl:   [{f: 0, t: 24, r: 'bass', sh: 0, sc: .6}, {f: 24, t: 88, r: 'bass', sh: 0, rh: 'march'}, {f: 88, t: 96, r: 'bass', sh: 0}],
      fg:    [{f: 0, t: 24, r: 'bass', sh: 12, sc: .6}, {f: 24, t: 88, r: 'bass', sh: 0, rh: 'march'}, {f: 88, t: 96, r: 'bass', sh: 0}],
      asax1: [{f: 24, t: 96, r: 'mel', sh: 0}],
      asax2: [{f: 24, t: 96, r: 'mel3', sh: 0}],
      tsax:  [{f: 24, t: 56, r: 'pad', g: 'tsP', i: 0}, {f: 56, t: 88, r: 'cm', sh: 0}, {f: 88, t: 96, r: 'mel', sh: -12}],
      bsax:  [{f: 0, t: 24, r: 'bass', sh: 0, sc: .6}, {f: 24, t: 88, r: 'bass', sh: 0, rh: 'march'}, {f: 88, t: 96, r: 'bass', sh: 0}],
      tp1:   [{f: 40, t: 56, r: 'mel', sh: 0, sc: .75}, {f: 56, t: 96, r: 'mel', sh: 0}],
      tp2:   [{f: 40, t: 56, r: 'mel3', sh: 0, sc: .65}, {f: 56, t: 96, r: 'mel3', sh: 0}],
      tp3:   [{f: 56, t: 88, r: 'pad', g: 'tpB', i: 0}, {f: 88, t: 92, r: 'pad', g: 'cdTpA', i: 0}, {f: 92, t: 96, r: 'pad', g: 'cdTpB', i: 0}],
      hn1: waHn(0), hn2: waHn(1), hn3: waHn(2), hn4: waHn(3),
      tb1:   [{f: 24, t: 56, r: 'pad', g: 'tbA', i: 0, sc: .6}, {f: 56, t: 88, r: 'cm', sh: 0}, {f: 88, t: 92, r: 'pad', g: 'cdTbA', i: 0}, {f: 92, t: 96, r: 'pad', g: 'cdTbB', i: 0}],
      tb2:   [{f: 24, t: 56, r: 'pad', g: 'tbA', i: 1, sc: .6}, {f: 56, t: 88, r: 'pad', g: 'tbB', i: 0}, {f: 88, t: 92, r: 'pad', g: 'cdTbA', i: 1}, {f: 92, t: 96, r: 'pad', g: 'cdTbB', i: 1}],
      btb:   [{f: 24, t: 88, r: 'bass', sh: 0, rh: 'march'}, {f: 88, t: 92, r: 'pad', g: 'cdTbA', i: 2}, {f: 92, t: 96, r: 'pad', g: 'cdTbB', i: 2}],
      euph:  [{f: 16, t: 24, r: 'mel', sh: -12, sc: .5}, {f: 24, t: 56, r: 'mel', sh: -12, sc: .7}, {f: 56, t: 88, r: 'cm', sh: 0}, {f: 88, t: 96, r: 'mel', sh: -12}],
      tuba:  [{f: 0, t: 24, r: 'bass', sh: 0, sc: .55}, {f: 24, t: 88, r: 'bass', sh: 0, rh: 'march'}, {f: 88, t: 96, r: 'bass', sh: 0}],
      cb:    [{f: 0, t: 24, r: 'bass', sh: 0, sc: .7}, {f: 24, t: 88, r: 'bass', sh: 0, rh: 'pizz'}, {f: 88, t: 96, r: 'bass', sh: 0}],
    },
    perc: {
      perc1: [
        {i: 'timp', b: 0, d: 4, m: 40, roll: true, v: .08, v1: .22}, {i: 'timp', b: 12, m: 40, v: .3},
        {i: 'timp', b: 16, d: 8, m: 40, roll: true, v: .12, v1: .55},
        ...each(24, 52, 4, b => [{i: 'timp', b, m: 45, v: .7}, {i: 'timp', b: b + 1.5, m: 52, v: .45}, {i: 'timp', b: b + 2, m: 45, v: .6}, {i: 'timp', b: b + 3, m: 52, v: .5}]),
        {i: 'timp', b: 52, m: 45, v: .85},
        ...each(56, 84, 4, b => [{i: 'timp', b, m: 45, v: .85}, {i: 'timp', b: b + 1.5, m: 52, v: .6}, {i: 'timp', b: b + 2, m: 45, v: .75}, {i: 'timp', b: b + 3, m: 52, v: .65}, {i: 'timp', b: b + 3.5, m: 52, v: .6}]),
        {i: 'timp', b: 84, m: 45, v: .9}, {i: 'timp', b: 86, d: 2, m: 52, roll: true, v: .55, v1: .9},
        {i: 'timp', b: 88, d: 4, m: 45, roll: true, v: .55, v1: 1}, {i: 'timp', b: 92, m: 45, v: 1},
      ],
      perc2: [
        // 拍子木の打ち込み（だんだん間をつめて、祭りの始まりの合図にする）
        ...[20, 21.25, 22.25, 22.9, 23.35, 23.65, 23.85].map((b, k) => ({i: 'hyoshigi', b, v: .5 + .06 * k})),
        ...each(24, 52, 4, b => hitsAt('shime', SHIME_BAR, b)),
        ...hitsAt('shime', [[52,.6],[54,.5],[54.5,.5],[55,.6],[55.5,.7]]),
        ...each(56, 84, 4, b => hitsAt('shime', [...SHIME_BAR.map(([o, v]) => [o, v + .14]), [3.75, .38]], b)),
        {i: 'shime', b: 84, v: .7}, {i: 'shime', b: 85, d: 3, roll: true, v: .4, v1: .85},
        {i: 'shime', b: 88, d: 3.5, roll: true, v: .5, v1: .95}, {i: 'shime', b: 92, v: 1},
        {i: 'hyoshigi', b: 94, v: .9},
      ],
      perc3: [
        {i: 'taiko', b: 0, v: .4}, {i: 'taiko', b: 8, v: .3}, {i: 'taiko', b: 16, v: .35}, {i: 'taiko', b: 22, d: 2, roll: true, v: .2, v1: .6},
        ...each(24, 52, 4, b => hitsAt('taiko', [[0, .75], [1.5, .45], [2, .65]], b)),
        ...hitsAt('taiko', [[52, .9], [53, .5], [53.5, .6], [54, .75], [55, .8], [55.5, .85]]),
        ...each(56, 84, 4, b => hitsAt('taiko', [[0, .9], [1.5, .55], [2, .8], [3, .6], [3.5, .65]], b)),
        ...hitsAt('taiko', [[84, .9], [86, .8], [87, .85]]),
        {i: 'taiko', b: 88, d: 4, roll: true, v: .45, v1: 1}, {i: 'taiko', b: 92, v: 1},
      ],
      perc4: [
        {i: 'tamtam', b: 0, v: .35}, {i: 'chime', b: 12, m: 76, v: .3}, {i: 'suzu', b: 16, v: .25}, {i: 'suzu', b: 20, v: .3},
        ...each(24, 52, 4, b => hitsAt('suzu', [[0, .35], [2, .3]], b)), {i: 'suzu', b: 52, v: .45},
        ...hitsAt('cym', [[56, 1], [64, .6], [72, .8], [80, .6], [84, .75]]),
        {i: 'sus', b: 88, d: 4, roll: true, v: .3, v1: .9}, {i: 'tamtam', b: 92, v: 1},
      ],
    },
  },
};
const PIECE_IDS = ['largo', 'ode', 'march', 'wa'];
// その拍でのテンポ（序奏だけゆっくり、のような曲は楽譜上の切り替えを反映する）と、表示用の書き方
const bpmAt = (pc, i, b = 0) => Math.round(pc.tempi[i] / sectionAt(pc.tmap, b, 1));
const tempoLabel = (pc, i) => pc.tmap ? `♩=${bpmAt(pc, i, 0)}→${pc.tempi[i]}` : `♩=${pc.tempi[i]}`;

/* ===== 編曲の組み立て ===== */
function chordAt(pc, b){
  return pc.chords.find(c => b >= c.b - 1e-6 && b < c.b + c.d - 1e-6) || pc.chords[pc.chords.length - 1];
}
// 区間ごとの指定（[[拍, 値], ...]）から、その拍で効いている値を取る。指定が1つだけなら値そのもの
function sectionAt(v, b, dflt){
  if(!Array.isArray(v)) return v ?? dflt;
  let out = dflt;
  for(const [from, x] of v) if(b >= from - 1e-6) out = x;
  return out;
}
function jiOf(m, c){
  const iv = ((m - c.root) % 12 + 12) % 12;
  return JI[c.q][iv] ?? 0;
}
// 旋律の下の声部（和音の音なら和音の中で3度下、経過音ならその場の音階で2つ下の音）
function thirdBelow(m, c, scale = SCALE){
  const pc = ((m % 12) + 12) % 12;
  if(c && c.pcs.includes(pc)){
    for(const iv of [3, 4, 5, 8, 9]) if(c.pcs.includes(((m - iv) % 12 + 12) % 12)) return m - iv;
  }
  const idx = scale.indexOf(pc);
  if(idx < 0) return m - 3;
  return m - ((pc - scale[(idx + scale.length - 2) % scale.length] + 12) % 12);
}
// 和音を n 声に配置する。前の和音から動きが少なく、3度と7度を落とさない形を選ぶ
function voiceGroup(chs, n, lo, hi){
  const out = [];
  let prev = null;
  for(const c of chs){
    const cand = [];
    for(let m = lo; m <= hi; m++) if(c.pcs.includes(m % 12)) cand.push(m);
    const third = HAS_THIRD[c.q] != null ? (c.root + HAS_THIRD[c.q]) % 12 : null;
    const cost = v => {
      let k = 0;
      if(prev) for(let i = 0; i < n; i++) k += Math.abs(v[i] - prev[i]);
      else for(let i = 0; i < n; i++) k += 0.3 * Math.abs(v[i] - (hi - (hi - lo) * (i + 0.5) / n));
      const pcs = v.map(m => m % 12);
      if(third != null && n >= 2 && !pcs.includes(third)) k += 9;
      if(c.pcs.length === 4 && n >= 3 && !pcs.includes((c.root + 10) % 12)) k += 5;
      if(n >= 3 && !pcs.includes(c.root)) k += 3;
      if(third != null && pcs.filter(p => p === third).length > 1) k += 6;
      // 3度のない和音（空5度・sus）は、構成音をひととおり鳴らす
      if(third == null) for(const q of c.pcs) if(n >= c.pcs.length && !pcs.includes(q)) k += 4;
      for(let i = 0; i < n - 1; i++){
        const g = v[i] - v[i+1];
        if(g <= 2) k += third == null && g === 2 ? 1 : dup && g === 0 ? 0 : 5;
        if(g > 9) k += (g - 9) * 0.8;
      }
      return k;
    };
    let best = null, bc = Infinity;
    const acc = [];
    // 音域の中の候補が声部より少ない（空5度を4声で、など）ときは、同じ音を重ねてよいことにする
    const dup = cand.length < n;
    const walk = start => {
      if(acc.length === n){
        const v = acc.slice().sort((a, b) => b - a);
        const k = cost(v) + (dup ? 2 * (n - new Set(v).size) : 0);
        if(k < bc){ bc = k; best = v; }
        return;
      }
      for(let i = start; i < cand.length; i++){ acc.push(cand[i]); walk(dup ? i : i + 1); acc.pop(); }
    };
    walk(0);
    if(!best) best = Array(n).fill(cand[0] ?? lo);
    out.push(best);
    prev = best;
  }
  return out;
}
function clipChords(pc, f, t){
  return pc.chords.filter(c => c.b < t - 1e-6 && c.b + c.d > f + 1e-6)
    .map(c => ({...c, b: Math.max(c.b, f), d: Math.min(c.b + c.d, t) - Math.max(c.b, f)}));
}
// 伴奏の刻み方：sus（のばす）、ab（4拍子の2・4拍）、ab8（各拍の裏の8分）、{pat: [[小節内の拍, 長さ, 奏法, アクセント], ...]}（決まった型）
function padRhythm(rh, c, meter){
  if(rh === 'ab'){
    const out = [];
    for(let b = Math.ceil(c.b - 1e-6); b < c.b + c.d - 1e-6; b++) if(b % 2 === 1) out.push({b, d: .5, art: 'stac'});
    return out;
  }
  if(rh === 'ab8'){
    const out = [];
    for(let b = Math.ceil(c.b - 1e-6); b < c.b + c.d - 1e-6; b++) out.push({b: b + .5, d: .5, art: 'stac'});
    return out;
  }
  if(rh && rh.pat){
    const out = [], len = rh.len || meter;
    for(let bar = Math.floor(c.b / len) * len; bar < c.b + c.d - 1e-6; bar += len){
      for(const [o, d, art, acc] of rh.pat){
        const b = bar + o;
        if(b >= c.b - 1e-6 && b < c.b + c.d - 1e-6) out.push({b, d: Math.min(d, c.b + c.d - b), art: art || rh.art || 'norm', acc: !!(acc ?? rh.acc)});
      }
    }
    return out;
  }
  return [{b: c.b, d: c.d}];
}

const ROLE_SCALE = {mel: 1, mel3: .9, cm: .85, pad: .62, bass: .8, hit: 1};
const LINE_ROLES = new Set(['mel', 'mel3', 'cm']);
const ARR = {};

function arrangement(pid){
  if(ARR[pid]) return ARR[pid];
  const pc = PIECES[pid];
  const parts = {};
  const vcache = {};
  const push = (part, ev) => (parts[part] ||= []).push(ev);
  const inRange = (e, sg) => e.b >= sg.f - 1e-6 && e.b < sg.t - 1e-6;
  const marks = e => ({...(e.st ? {art: 'stac'} : {}), ...(e.acc ? {acc: true} : {})});

  for(const [part, segs] of Object.entries(pc.roles)){
    for(const sg of segs){
      const sc = (sg.sc ?? 1) * ROLE_SCALE[sg.r];
      const base = {role: sg.r, sc, solo: !!sg.solo, fb: sg.fb, inst: sg.inst};
      if(sg.r === 'mel' || sg.r === 'mel3'){
        for(const e of pc.mel.filter(e => inRange(e, sg))){
          const c = chordAt(pc, e.b);
          const m0 = sg.r === 'mel' ? e.m : thirdBelow(e.m, c, sectionAt(pc.scale, e.b, SCALE));
          push(part, {...base, m: m0 + sg.sh, b: e.b, d: e.d, ji: jiOf(m0 + sg.sh, c), ...marks(e)});
        }
      } else if(sg.r === 'cm'){
        for(const e of pc.cm.filter(e => inRange(e, sg))){
          const c = chordAt(pc, e.b);
          push(part, {...base, m: e.m + sg.sh, b: e.b, d: e.d, ji: jiOf(e.m, c), ...marks(e)});
        }
      } else if(sg.r === 'pad'){
        const g = pc.groups[sg.g];
        const chs = clipChords(pc, sg.f, sg.t);
        const key = `${sg.g}:${sg.f}:${sg.t}`;
        const vs = vcache[key] ||= voiceGroup(chs, g.n, g.lo, g.hi);
        chs.forEach((c, k) => {
          const m = vs[k][sg.i];
          for(const r of padRhythm(g.rh, c, pc.meter)) push(part, {...base, m, b: r.b, d: r.d, ji: jiOf(m, c), ...(r.art ? {art: r.art} : {}), ...(r.acc ? {acc: true} : {})});
        });
      } else if(sg.r === 'bass'){
        const evs = pc.bass.filter(e => inRange(e, sg));
        for(const e of evs){
          const c = chordAt(pc, e.b);
          const m = e.m + sg.sh;
          if(sg.rh === 'march') push(part, {...base, m, b: e.b, d: Math.min(e.d, .8), ji: jiOf(e.m, c), art: e.st ? 'stac' : 'norm', ...(e.acc ? {acc: true} : {})});
          else if(sg.rh === 'pizz') push(part, {...base, m, b: e.b, d: 1, ji: jiOf(e.m, c), inst: 'cbpizz', kind: 'hit'});
          else push(part, {...base, m, b: e.b, d: e.d, ji: jiOf(e.m, c), ...marks(e)});
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
    // つなぎ方：スラー／やわらかいタンギング／普通のタンギング（曲や区間ごとの slur で決める）
    for(let i = 0; i < evs.length; i++){
      const e = evs[i], p = evs[i-1];
      if(e.kind === 'hit') continue;
      const joined = p && p.kind !== 'hit' && Math.abs(p.b + p.d - e.b) < 1e-6;
      if(e.art === 'stac' || e.art === 'norm'){ e.slur = false; continue; }
      if(!joined){ e.art = 'norm'; e.slur = false; continue; }
      const style = sectionAt(pc.slur, e.b, 'bar');
      if(p.m === e.m && !LINE_ROLES.has(e.role)){ e.art = 'tie'; e.slur = true; p.leg = true; continue; }
      if(style === 'tongue'){ e.art = 'norm'; e.slur = false; continue; }
      if(LINE_ROLES.has(e.role)){
        const barStart = Math.abs(e.b / pc.meter - Math.round(e.b / pc.meter)) < 1e-6;
        const slurred = style === 'bar' ? !barStart && p.m !== e.m : style === 'pairs' ? (p.d <= .5 && e.d <= .5 && p.m !== e.m) : false;
        e.art = slurred ? 'slur' : style === 'bar' ? 'ten' : 'norm';
        e.slur = slurred;
      } else {
        e.art = 'ten'; e.slur = false;
      }
      if(p.art !== 'stac') p.leg = true;
    }
  }
  return (ARR[pid] = {parts, pc});
}
