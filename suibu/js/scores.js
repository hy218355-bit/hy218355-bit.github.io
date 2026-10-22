'use strict';
/* 曲と編曲
   ハ長調で書いて trans で原調へ移すか、実音のまま書く（trans 0）。
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
  '+':    {q: 'aug',  iv: [0, 4, 8]},
  'o7':   {q: 'dim7', iv: [0, 3, 6, 9]},
};
function chords(src, from = 0){
  const out = [];
  let b = from;
  for(const tok of src.split(/\s+/)){
    if(!tok || tok === '|') continue;
    const [nm, dd] = tok.split(':');
    const d = dd ? +dd : 4;
    const m = /^([A-G])(#|b)?(m7|m|7|5|sus4|sus2|\+|o7)?(?:\/[A-G][#b]?)?$/.exec(nm);
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
  aug:  {0: 0, 4: -13.7, 8: -27.4},
  dim7: {0: 0, 3: 15.6, 6: -9.8, 9: -15.6},
};
const HAS_THIRD = {maj: 4, min: 3, dom7: 4, min7: 3, aug: 4, dim7: 3};

/* ===== 自由曲1：ドヴォルザーク《新世界より》第2楽章 Largo ===== */
const LARGO_MEL = 'E5:1.5 G5:.5 G5:2 | E5:1.5 D5:.5 C5:2 | D5:1.5 E5:.5 G5:1.5 E5:.5 | D5:3 r:1 | E5:1.5 G5:.5 G5:2 | E5:1.5 D5:.5 C5:2 | D5:1 E5:1 D5:1.5 C5:.5 | C5:4';
const LARGO_CH = 'C:4 | C:4 | G7:8 | C:4 | C:4 | F:2 G7:2 | C:4';
const LARGO_BASS = 'C3:4 | C3:4 | G2:8 | C3:4 | C3:4 | F2:2 G2:2 | C2:4';

/* ===== 自由曲2：ベートーヴェン《第九》第4楽章より「歓喜の歌」 ===== */
const ODE_MEL = 'E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4:1.5 D4:.5 D4:2 | E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:.5 C4:2 | D4 D4 E4 C4 | D4 E4:.5 F4:.5 E4 C4 | D4 E4:.5 F4:.5 E4 D4 | C4 D4 G3:2 | E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:.5 C4:2 | C4:4';
const ODE_CH = 'C:2 C:2 | G7:2 C:2 | Am:2 C:2 | C:2 G:2 | C:2 C:2 | G7:2 C:2 | Am:2 C:2 | G7:2 C:2 | G:2 C:2 | G7:2 C:2 | G7:2 C:2 | Am:1 D7:1 G:2 | C:2 C:2 | G7:2 C:2 | F:2 C:2 | G7:2 C:2 | C:4';
const ODE_BASS = 'C3:2 C3:2 | G2:2 C3:2 | A2:2 C3:2 | C3:2 G2:2 | C3:2 C3:2 | G2:2 C3:2 | A2:2 C3:2 | G2:2 C3:2 | G2:2 C3:2 | G2:2 C3:2 | G2:2 C3:2 | A2:1 D3:1 G2:2 | C3:2 C3:2 | G2:2 C3:2 | F2:2 C3:2 | G2:2 C3:2 | C2:4';

// 打楽器の譜を書くための道具：each で同じ型をくり返し、hitsAt で [拍, 強さ] の並びを打つ音にする
const each = (from, to, step, fn) => { const out = []; for(let b = from, k = 0; b < to - 1e-6; b += step, k++) out.push(...fn(b, k)); return out; };
const hitsAt = (i, list, b0 = 0) => list.map(([o, v]) => ({i, b: b0 + o, v}));
// ティンパニは、その拍で鳴っている低音（休みならその前の音）を lo からの1オクターブに移して打つ
const timpOn = (bass, list, lo = 41) => list.map(([b, v]) => {
  let m = bass[0].m;
  for(const e of bass) if(e.b <= b + 1e-6) m = e.m;
  return {i: 'timp', b, m: lo + ((m - lo) % 12 + 12) % 12, v};
});
const rep = (s, n) => Array(n).fill(s).join(' | ');
const oct = (evs, n) => evs.map(e => ({...e, m: e.m + 12 * n}));

/* ===== 自由曲3：オッフェンバック 喜歌劇《天国と地獄》より「地獄のギャロップ」（カンカン）=====
   1拍＝2/4拍子の1小節（2分音符）で、実音のまま書く。前奏 → ト長調の主題（2回目は全員で）→ 中間部 → ニ長調の主題 → 終わり。
   音は PDMX（MuseScore のパブリックドメイン楽譜を集めたもの、CC0）のピアノ譜から写した */
// 低音の「ズン・チャッ」：'G2 D3' は、1小節に8分音符の低音を2つ（そのあいだに伴奏の和音が入る）
const oom = (...bars) => bars.map(b => b.includes(':') ? b : b.split(' ').map(n => n + ':.25 r:.25').join(' ')).join(' | ');
const GAL_INTRO = 'D5:.375> D5:.125 D5:.375 D5:.125 | D5:.375> D5:.125 D5:.375 D5:.125 | D4:.375> D4:.125 D4:.375 D4:.125 | r:1';
const GAL_G1 = "G4:1 | A4:.25 C5:.25 B4:.25 A4:.25 | D5:.5 D5:.5 | D5:.25 E5:.25 B4:.25 C5:.25 | A4:.5 A4:.5 | A4:.25 C5:.25 B4:.25 A4:.25 | G4:.25 G5:.25' F#5:.25' E5:.25' | D5:.25' C5:.25' B4:.25' A4:.25'";
const GAL_G2 = 'G4:1 | A4:.25 C5:.25 B4:.25 A4:.25 | D5:.5 D5:.5 | D5:.25 E5:.25 B4:.25 C5:.25 | A4:.5 A4:.5 | A4:.25 C5:.25 B4:.25 A4:.25 | G4:.25 D5:.25 A4:.25 B4:.25';
const GAL_G_CH = 'G:1 | D7:1 | G:1 | G:1 | D7:1 | D7:1 | G:1 | D7:1 | G:1 | D7:1 | G:1 | G:1 | D7:1 | D7:1 | G:.5 D7:.5 | G:1';
const GAL_G_BASS = oom('G2 D3', 'F#3 D3', 'G3 D3', 'G3 D3', 'F#3 D3', 'F#3 D3', 'G3 D3', 'D3:.25 C3:.25 B2:.25 A2:.25', 'G2 D3', 'F#3 D3', 'G3 D3', 'G3 D3', 'F#3 D3', 'F#3 D3', 'G3 D3', 'G2 D3');
const GAL_MID = ['A4:.25 E5:.25 E5:.25 F#5:.25 | E5:.25 D5:.25 D5:.25 F#5:.25 | G5:.25 B5:.25 D6:.25 B5:.25 | B5:.25 A5:.25 A5:.5',
  'B5:.25 C#5:.25 C#5:.25 B5:.25 | A5:.25 D5:.25 D5:.25 F#5:.25 | F#5:.25 E5:.25 F#5:.25 E5:.25 | F#5:.25 E5:.25 F#5:.25 E5:.25',
  'A4:.25 E5:.25 E5:.25 F#5:.25 | E5:.25 D5:.25 D5:.25 F#5:.25 | G5:.25 B5:.25 D6:.25 B5:.25',
  rep('B5:.25 A5:.25 A5:.5', 8), rep('B5:.25 A5:.25 B5:.25 A5:.25', 3)].join(' | ');
const GAL_MID_CH = 'A7:1 | D:1 | G:1 | D:1 | A7:1 | D:1 | E7:1 | A7:1 | A7:1 | D:1 | G:1 | D:1 | A:1 | Dm/A:1 | Ao7:1 | A7:1 | A:1 | Dm/A:1 | Ao7:1 | A7:1 | A7:1 | A7:1';
const GAL_MID_BASS = ['A2', 'D3', 'G2', 'D3', 'A2', 'D3', 'E2', 'A2', 'A2', 'D3', 'G2', 'D3'].map(n => n + ':.25 r:.75').join(' | ')
  + ' | ' + rep('A2:.25 A2:.25 A2:.25 A2:.25', 8) + ' | E3:.25 D3:.25 C#3:.25 B2:.25 | A2:.25 G2:.25 F#2:.25 E2:.25';
const GAL_D1 = "D5:1 | E5:.25 G5:.25 F#5:.25 E5:.25 | A5:.5 A5:.5 | A5:.25 B5:.25 F#5:.25 G5:.25 | E5:.5 E5:.5 | E5:.25 G5:.25 F#5:.25 E5:.25 | D5:.25 D6:.25' C#6:.25' B5:.25' | A5:.25' G5:.25' F#5:.25' E5:.25'";
const GAL_D2 = 'D5:1 | E5:.25 G5:.25 F#5:.25 E5:.25 | A5:.5 A5:.5 | A5:.25 B5:.25 F#5:.25 G5:.25 | E5:.5 E5:.5 | E5:.25 G5:.25 F#5:.25 E5:.25 | D5:.25 A5:.25 E5:.25 F#5:.25 | D5:.5 A4:.5';
const GAL_D_CH = 'D:1 | A7:1 | D:1 | D:1 | A7:1 | A7:1 | D:1 | A7:1 | D:1 | A7:1 | D:1 | D:1 | A7:1 | A7:1 | D:.5 A7:.5 | D:1';
const GAL_D_BASS = oom('D3 A2', 'A2 E3', 'D3 A2', 'D3 A2', 'A2 E3', 'A2 E3', 'D3 A2', 'A2 E3', 'D3 A2', 'A2 E3', 'D3 A2', 'D3 A2', 'A2 E3', 'A2 E3', 'D3 A2', 'D3 A2');
const GAL_CODA = 'F#5:.375> F#5:.125 F#5:.375 F#5:.125 | F#5:.375> F#5:.125 F#5:.375 F#5:.125 | F#5:.5> r:.5 | F#6:.5> r:.5 | D6:.5> r:.5 | D5:.5> r:.5 | F#5:1>';
const GAL_BASS = [...line('D3:.375> D3:.125 D3:.375 D3:.125 | D3:.375> D3:.125 D3:.375 D3:.125 | D2:.375> D2:.125 D2:.375 D2:.125 | D3:.25 C3:.25 B2:.25 A2:.25'),
  ...line(GAL_G_BASS, 4), ...line(GAL_G_BASS, 20), ...line(GAL_MID_BASS, 36), ...line(GAL_D_BASS, 58),
  ...line('D2:.375> D2:.125 D2:.375 D2:.125 | D2:.375> D2:.125 D2:.375 D2:.125 | D2:.5> r:.5 | D2:.5> r:.5 | D2:.5> r:.5 | D2:.5> r:.5 | D2:1>', 74)];
// 伴奏の刻み：8分音符の裏（チャッ）、中間部の3つ刻み、全部の8分音符、終わりの打ち込み
const GAL_OFF = {pat: [[.25, .25, 'stac'], [.75, .25, 'stac']], len: 1};
const GAL_TRI = {pat: [[.25, .25, 'stac'], [.5, .25, 'stac'], [.75, .25, 'stac']], len: 1};
const GAL_ALL8 = {pat: [[0, .25, 'stac', true], [.25, .25, 'stac'], [.5, .25, 'stac'], [.75, .25, 'stac']], len: 1};
const GAL_C1 = {pat: [[0, .375, 'norm', true], [.375, .125, 'stac'], [.5, .375, 'norm'], [.875, .125, 'stac']], len: 1};
const GAL_C2 = {pat: [[0, .5, 'stac', true]], len: 1};
const GAL_C3 = {pat: [[0, 1, 'norm', true]], len: 1};
// 伴奏の楽器ごとの区間（ト長調の主題1回目は from=4 から、それ以外は2回目から）
const galPads = (fam, i, from = 4) => [
  ...(from <= 4 ? [{f: 4, t: 20, r: 'pad', g: fam + 'G1', i, sc: .75}] : []),
  {f: 20, t: 36, r: 'pad', g: fam + 'G2', i}, {f: 36, t: 48, r: 'pad', g: fam + 'M1', i}, {f: 48, t: 56, r: 'pad', g: fam + 'M2', i},
  {f: 58, t: 74, r: 'pad', g: fam + 'D', i}, {f: 74, t: 76, r: 'pad', g: fam + 'C1', i}, {f: 76, t: 80, r: 'pad', g: fam + 'C2', i}, {f: 80, t: 81, r: 'pad', g: fam + 'C3', i},
];
const galGroups = () => {
  const out = {};
  for(const [fam, n, lo, hi] of [['hn', 4, 55, 70], ['w', 2, 58, 74], ['tb', 2, 48, 64], ['tp', 1, 62, 74]]){
    for(const [sec, rh] of [['G1', GAL_OFF], ['G2', GAL_OFF], ['M1', GAL_TRI], ['M2', GAL_ALL8], ['D', GAL_OFF], ['C1', GAL_C1], ['C2', GAL_C2], ['C3', GAL_C3]]) out[fam + sec] = {n, lo, hi, rh};
  }
  return out;
};

/* ===== 自由曲4：エルガー 行進曲「威風堂々」第1番より 中間部 =====
   ト長調、実音のまま。1拍＝4分音符、2/4拍子。前半はやわらかく、後半は1オクターブ上で全員で歌い上げる。
   音は PDMX（CC0）のオルガン譜から写した */
const POMP_A = 'G4:2 | F#4:.5 G4:.5 A4:1 | E4:2 | D4:2 | C4:2 | B3:.5 C4:.5 D4:1 | A3:4 | B3:2 | C#4:.5 D4:1 E4:.5 | A4:2 | D4:2';
const POMP_MEL = [...line(POMP_A + ' | G4:2.5 F#4:1 E4:.5 | D4:4'), ...shift(oct(line(POMP_A), 1), 32),
  ...line('C6:2 | C6:.5 B5:1 A5:.5 | B5:4 | E5:2 | F#5:.5 G5:1 A5:.5 | D5:2 | G5:2 | G4:2 | C5:.5 B4:1 A4:.5 | G4:4', 56)];
const POMP_CH = 'G:2 | D7/A:2 | Em/B:2 | G/B:2 | C:2 | G/D:2 | A7/E:2 | D:2 | G:2 | A7/G:2 | D/F#:2 | G:2 | Em7:2 | A7:2 | D:2 | D7:2 | '
  + 'G:2 | D7/A:2 | Em/B:2 | G/B:2 | C/E:2 | G/D:2 | A7/C#:2 | D:2 | G:2 | A7/G:2 | D/F#:2 | D/F#:2 | C/E:2 | D:1 D7:1 | G:2 | G:1 G7:1 | C:2 | D7/A:2 | G:2 | Em:2 | Am7:2 | D7:2 | G:4';
const POMP_BASS = line('G2:2 | A2:2 | B2:2 | B2:2 | C3:2 | D3:2 | E3:2 | D3:2 | G2:2 | G2:2 | F#2:2 | G2:2 | E2:2 | A2:2 | D3:2 | D3:2 | '
  + 'G2:2 | A2:2 | B2:2 | B2:2 | E2:2 | D2:2 | C#3:2 | D3:2 | G2:2 | G2:2 | F#2:2 | F#2:2 | E2:2 | D2:2 | G2:2 | G2:2 | C3:2 | A2:2 | G2:2 | E2:2 | A2:2 | D2:2 | G2:4');

/* ===== 自由曲5：ヨハン・シュトラウス1世「ラデツキー行進曲」=====
   ニ長調、実音のまま。1拍＝2分音符（4拍子の1小節を2拍に数える）。前奏 → 第1部 → 第2部 → 第1部（全員で）。
   音は PDMX（CC0）のオルガン譜から写した */
const RAD_A1 = 'F#5:.25 r:.25 F#5:.25 E#5:.25 F#5:.25 r:.25 F#5:.25 E#5:.25';
const RAD_A = [RAD_A1, 'F#5:.25 r:.25 E5:.25 r:.25 D5:.25 r:.25 F#5:.25 E#5:.25', RAD_A1, 'F#5:.25 r:.25 B5:.25 r:.25 A5:.25 r:.25 A5:.25 F#5:.25',
  'G5:.25 r:.25 B5:.25 r:.25 A5:.25 r:.25 A5:.25 E5:.25', 'F#5:.25 r:.25 B5:.25 r:.25 A5:.25 r:.25 A5:.25 F#5:.25',
  'E5:.25 r:.25 C#6:.5 D5:.25 r:.25 B5:.5', 'C#5:.25 r:.25 A5:.25 G#5:.25 A5:.25 B5:.25 A5:.25 G5:.25',
  RAD_A1, 'F#5:.25 r:.25 E5:.25 r:.25 D5:.25 r:.25 F#5:.25 E#5:.25', RAD_A1, 'F#5:.25 r:.25 B5:.25 r:.25 A5:.25 r:.25 A5:.25 F#5:.25',
  'G#5:.25 r:.25 F#6:.25 r:.25 E6:1', 'r:.5 E6:.25 r:.25 D6:1', 'C#6:.75 B5:.25 A5:.25 G5:.25 F#5:.25 E5:.25'].join(' | ');
const RAD_B1 = 'D6:.25 r:.25 D6:.25 C#6:.25 D6:.25 r:.25 D6:.25 C#6:.25';
const RAD_B = [RAD_B1, 'D6:.25 r:.25 G6:.25 r:.25 B5:.25 r:.25 D6:.25 C#6:.25', RAD_B1, 'D6:.25 r:.25 F#6:.25 r:.25 A5:.25 r:.25 A4:.125 A5:.125 r:.25',
  'A5:1 G5:.25 r:.25 A4:.125 B5:.125 r:.25', 'B5:1 A5:.25 r:.25 F#5:.125 D6:.125 r:.25',
  'C#6:.25 r:.25 C#6:.25 B5:.25 A5:.25 r:.25 G5:.25 r:.25', 'B5:.25 r:.25 B5:.25 A5:.25 G5:.25 r:.25 F#5:.25 r:.25',
  'A5:1 G5:.25 r:.25 A4:.125 B5:.125 r:.25', 'B5:1 A5:.25 r:.75',
  rep('C#6:.25 r:.25 C#6:.25 A#5:.25 B5:.25 r:.25 D6:.25 r:.25', 2), rep('F#6:.5 F#6:.25 F#6:.25 F#6:.5 F#6:.25 F#6:.25', 2),
  'F#6:.25 r:.25 F#5:.25 E#5:.25 F#5:.25 r:.25 F#5:.25 E#5:.25', RAD_A1].join(' | ');
const RAD_MEL = [...line('D6:.25 D6:.25 D6:.25 r:.25 D6:.25 D6:.25 D6:.25 r:.25 | F#6:.5 E6:.5 D6:.75 C#6:.25 | B5:.25 A#5:.25 B5:.25 C#6:.25 D6:.5 E6:.5 | A5:.5 r:1 F#5:.25 E#5:.25'),
  ...line(RAD_A + ' | D5:.5 D5:.5 D5:.5 D6:.25 C#6:.25', 8), ...line(RAD_B, 40), ...line(RAD_A + ' | D5:.5> D5:.5> D5:.5> r:.5', 72)];
const RAD_A_CH = 'D:2 | D:2 | D:2 | D:2 | A7:2 | D:2 | A:1 E7:1 | A:1 A7:1 | D:2 | D:2 | D:2 | D:2 | E7:1.5 A7:.5 | D:2 | Em:1 A7:1 | D:2';
const RAD_A_BASS = [rep('D3:.5 r:.5 D3:.5 r:.5', 4), 'C#3:.5 r:.5 C#3:.5 r:.5', 'D3:.5 r:.5 D3:.5 r:.5', 'E3:.5 r:.5 E3:.5 r:.5', 'A2:.5 r:.5 A2:.5 r:.5',
  rep('D3:.5 A2:.5 D3:.5 A2:.5', 4), 'E2:.5 r:1 A2:.5', 'D3:.5 r:1 D3:.5', 'G2:.5 r:.5 A2:.5 r:.5', 'D2:.5 D2:.5 D2:.5 r:.5'].join(' | ');
const RAD_B_BASS = ['D2:.5 r:.5 G2:.5 r:.5', 'B2:.5 r:.5 D3:.5 r:.5', 'D2:.5 r:.5 F#2:.5 r:.5', 'A2:.5 r:.5 D3:.5 r:.5', rep('A2:.5 r:.5 A2:.5 r:.5', 6),
  rep('F#2:.5 r:.5 B2:.5 r:.5', 2), rep('F#2:.5 B2:.5 F#2:.5 B2:.5', 2), 'F#2:.5 F#2:.25 E#2:.25 F#2:.5 r:.5', 'F#2:.5 r:1.5'].join(' | ');
const RAD_BASS = [...line('D3:.25 D3:.25 D3:.25 r:.25 D3:.25 D3:.25 D3:.25 r:.25 | D3:.5 C#3:.5 B2:.75 A2:.25 | G#2:1.5 E2:.5 | A2:.5 r:1.5'),
  ...line(RAD_A_BASS, 8), ...line(RAD_B_BASS, 40), ...line(RAD_A_BASS, 72)];
// 第1部の終わり：4分音符の和音を3つ
const RAD_END = {pat: [[0, .5, 'norm', true], [.5, .5, 'norm', true], [1, .5, 'norm', true]], len: 2};
const radPads = (fam, i, sc = 1) => [
  {f: 8, t: 38, r: 'pad', g: fam + 'A', i, sc: .7 * sc}, {f: 38, t: 40, r: 'pad', g: fam + 'E', i, sc: .8 * sc}, {f: 40, t: 72, r: 'pad', g: fam + 'B', i, sc},
  {f: 72, t: 102, r: 'pad', g: fam + 'A2', i, sc}, {f: 102, t: 104, r: 'pad', g: fam + 'E2', i, sc},
];
const radGroups = () => {
  const out = {};
  for(const [fam, n, lo, hi] of [['hn', 4, 55, 70], ['w', 2, 58, 74], ['ts', 1, 50, 62], ['tb', 2, 48, 62], ['tp', 1, 62, 74]]){
    for(const [sec, rh] of [['A', 'ab8'], ['E', RAD_END], ['B', 'ab8'], ['A2', 'ab8'], ['E2', RAD_END]]) out[fam + sec] = {n, lo, hi, rh};
  }
  return out;
};

const PIECES = {
  largo: {
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
  galop: {
    id: 'galop',
    title: '「天国と地獄」',
    full: 'オッフェンバック 喜歌劇《天国と地獄》より「地獄のギャロップ」（カンカン）',
    composer: 'J.オッフェンバック（1858年）',
    key: 'ト長調（後半はニ長調）', trans: 0, meter: 2, beatUnit: 2, beats: 81,
    tempi: [76, 82, 88],
    desc: '運動会のかけっこでおなじみの、あの速い曲。軽く、速く、全員の音をそろえるのが勝負。少しでも縦の線がずれると、すぐにもたついて聞こえる。',
    asks: 'リズム・バランス・音色',
    focus: {pitch: .9, tone: .95, expr: .9, rhythm: 1.3, balance: 1.05},
    balRef: 5.3, ceiling: .96,
    spans: [{name: '前半（ト長調の主題）', from: 0, to: 36}, {name: '中間部', from: 36, to: 58}, {name: '最後（ニ長調の主題）', from: 58, to: 81}],
    slur: 'tongue',
    scale: [[0, [0, 2, 4, 6, 7, 9, 11]], [36, [1, 2, 4, 6, 7, 9, 11]]],
    mel: [...line(GAL_INTRO), ...line(GAL_G1 + ' | ' + GAL_G2 + ' | G4:.5 D4:.5', 4), ...line(GAL_G1 + ' | ' + GAL_G2 + " | G4:.5 G5:.5>", 20),
          ...line(GAL_MID, 36), ...line(GAL_D1 + ' | ' + GAL_D2, 58), ...line(GAL_CODA, 74)],
    chords: [...chords('D5:3 | D7:1'), ...chords(GAL_G_CH, 4), ...chords(GAL_G_CH, 20), ...chords(GAL_MID_CH, 36), ...chords(GAL_D_CH, 58), ...chords('D:7', 74)],
    bass: GAL_BASS,
    dyn: [[0,.85],[3.9,.85],[4,.55],[19.9,.6],[20,.82],[35.9,.85],[36,.7],[47.9,.72],[48,.6],[55.9,.92],[56,.9],[57.9,.95],[58,1],[73.9,.98],[74,1],[81,1]],
    rubato: [[0,1],[3,1],[3.9,1.06],[4,1],[56,1],[57.9,1.04],[58,1],[78,1],[79.9,1.1],[81,1.2]],
    groups: galGroups(),
    roles: {
      picc:  [{f: 0, t: 4, r: 'mel', sh: 12, sc: .7}, {f: 20, t: 36, r: 'mel', sh: 12, sc: .7}, {f: 58, t: 81, r: 'mel', sh: 12, sc: .8}],
      fl1:   [{f: 0, t: 4, r: 'mel', sh: 12}, {f: 4, t: 20, r: 'mel', sh: 12, sc: .8}, {f: 20, t: 36, r: 'mel', sh: 12}, {f: 36, t: 81, r: 'mel', sh: 0}],
      fl2:   [{f: 0, t: 4, r: 'mel', sh: 0}, {f: 4, t: 36, r: 'mel3', sh: 12, sc: .7}, {f: 36, t: 74, r: 'mel3', sh: 0}, {f: 74, t: 81, r: 'mel', sh: 0}],
      ob:    [{f: 0, t: 81, r: 'mel', sh: 0}],
      ebcl:  [{f: 20, t: 36, r: 'mel', sh: 12, sc: .6}, {f: 58, t: 74, r: 'mel', sh: 0, sc: .7}],
      cl1:   [{f: 0, t: 81, r: 'mel', sh: 0}],
      cl2:   [{f: 0, t: 4, r: 'mel', sh: -12}, {f: 4, t: 74, r: 'mel3', sh: 0}, {f: 74, t: 81, r: 'mel', sh: -12}],
      cl3:   [{f: 0, t: 4, r: 'mel', sh: -12}, ...galPads('w', 0), {f: 56, t: 58, r: 'mel', sh: -12}],
      asax1: [{f: 0, t: 4, r: 'mel', sh: -12}, {f: 4, t: 36, r: 'mel', sh: 0}, {f: 36, t: 81, r: 'mel', sh: -12}],
      asax2: [{f: 0, t: 4, r: 'mel', sh: -12}, ...galPads('w', 1), {f: 56, t: 58, r: 'mel', sh: -12}],
      tsax:  [{f: 0, t: 4, r: 'mel', sh: -12}, {f: 4, t: 36, r: 'mel', sh: -12, sc: .7}, {f: 36, t: 74, r: 'mel', sh: -12}, {f: 74, t: 81, r: 'mel', sh: -24}],
      bsax:  [{f: 0, t: 81, r: 'bass', sh: 0, rh: 'march'}],
      bcl:   [{f: 0, t: 81, r: 'bass', sh: 0, rh: 'march'}],
      fg:    [{f: 0, t: 4, r: 'bass', sh: 0}, {f: 4, t: 20, r: 'bass', sh: 0, rh: 'march', sc: .8}, {f: 20, t: 81, r: 'bass', sh: 0, rh: 'march'}],
      tp1:   [{f: 0, t: 4, r: 'mel', sh: 0}, {f: 20, t: 36, r: 'mel', sh: 0}, {f: 36, t: 81, r: 'mel', sh: -12}],
      tp2:   [{f: 0, t: 4, r: 'mel', sh: 0}, {f: 20, t: 36, r: 'mel3', sh: 0}, {f: 36, t: 74, r: 'mel3', sh: -12}, {f: 74, t: 81, r: 'mel', sh: -12}],
      tp3:   [{f: 0, t: 4, r: 'mel', sh: -12}, ...galPads('tp', 0, 20)],
      hn1: [{f: 0, t: 4, r: 'mel', sh: -12}, ...galPads('hn', 0)], hn2: [{f: 0, t: 4, r: 'mel', sh: -12}, ...galPads('hn', 1)],
      hn3: [{f: 0, t: 4, r: 'mel', sh: -12}, ...galPads('hn', 2)], hn4: [{f: 0, t: 4, r: 'mel', sh: -12}, ...galPads('hn', 3)],
      tb1:   [{f: 0, t: 4, r: 'mel', sh: -12}, ...galPads('tb', 0, 20)],
      tb2:   [{f: 0, t: 4, r: 'mel', sh: -24}, ...galPads('tb', 1, 20)],
      btb:   [{f: 0, t: 4, r: 'bass', sh: 0}, {f: 20, t: 74, r: 'bass', sh: 0, rh: 'march'}, {f: 74, t: 81, r: 'bass', sh: 0}],
      euph:  [{f: 0, t: 4, r: 'mel', sh: -12}, {f: 20, t: 36, r: 'mel', sh: -12}, {f: 36, t: 81, r: 'mel', sh: -24}],
      tuba:  [{f: 0, t: 4, r: 'bass', sh: 0}, {f: 4, t: 74, r: 'bass', sh: -12, rh: 'march'}, {f: 74, t: 81, r: 'bass', sh: 0}],
      cb:    [{f: 0, t: 4, r: 'bass', sh: 0}, {f: 4, t: 20, r: 'bass', sh: -12, rh: 'pizz'}, {f: 20, t: 74, r: 'bass', sh: -12, rh: 'march'}, {f: 74, t: 81, r: 'bass', sh: 0}],
      perc4: [{f: 4, t: 20, r: 'mel', sh: 12, inst: 'xylo', sc: .4}, {f: 36, t: 48, r: 'mel', sh: 0, inst: 'xylo', sc: .35}],
    },
    perc: {
      perc1: [
        ...timpOn(GAL_BASS, [[0,.85],[.375,.6],[.5,.8],[.875,.6],[1,.85],[1.375,.6],[1.5,.8],[1.875,.6],[2,.9],[2.375,.6],[2.5,.8],[2.875,.6]]),
        ...timpOn(GAL_BASS, each(4, 20, 1, b => [[b, .4]])), ...timpOn(GAL_BASS, each(20, 36, 1, b => [[b, .6], [b + .5, .45]])),
        ...timpOn(GAL_BASS, each(36, 48, 1, b => [[b, .5]])), {i: 'timp', b: 48, d: 8, m: 45, roll: true, v: .3, v1: .9},
        ...timpOn(GAL_BASS, [[56, .7], [57, .8]]), ...timpOn(GAL_BASS, each(58, 74, 1, b => [[b, .75], [b + .5, .55]])),
        ...timpOn(GAL_BASS, [[74,.9],[74.375,.6],[74.5,.8],[74.875,.6],[75,.9],[75.375,.6],[75.5,.8],[75.875,.6],[76,.9],[77,.9],[78,.9],[79,.9]]),
        {i: 'timp', b: 80, d: 1, m: 50, roll: true, v: .8, v1: 1},
      ],
      perc2: [
        ...hitsAt('sd', [[0,.8],[.375,.4],[.5,.6],[.875,.4],[1,.8],[1.375,.4],[1.5,.6],[1.875,.4],[2,.85],[2.375,.4],[2.5,.65],[2.875,.4]]),
        ...each(4, 20, 1, b => hitsAt('sd', [[.25, .2], [.75, .2]], b)),
        ...each(20, 48, 1, b => hitsAt('sd', [[0, .38], [.25, .3], [.5, .35], [.75, .3]], b)),
        {i: 'sd', b: 48, d: 8, roll: true, v: .2, v1: .85}, ...each(56, 58, 1, b => hitsAt('sd', [[0, .55], [.25, .45], [.5, .5], [.75, .45]], b)),
        ...each(58, 74, 1, b => hitsAt('sd', [[0, .5], [.25, .4], [.5, .45], [.75, .4]], b)),
        ...hitsAt('sd', [[74,.85],[74.375,.5],[74.5,.7],[74.875,.5],[75,.85],[75.375,.5],[75.5,.7],[75.875,.5],[76,.9],[77,.9],[78,.9],[79,.9],[80,1]]),
      ],
      perc3: [
        ...hitsAt('bd', [[0, .9], [1, .8], [2, .9]]),
        ...each(4, 20, 1, b => hitsAt('bd', [[0, .35], [.5, .28]], b)), ...each(20, 36, 1, b => hitsAt('bd', [[0, .55], [.5, .45]], b)),
        ...each(36, 48, 1, b => hitsAt('bd', [[0, .45], [.5, .35]], b)), ...each(48, 56, 1, b => [{i: 'bd', b, v: .5}]), ...hitsAt('bd', [[56, .6], [57, .7]]),
        ...each(58, 74, 1, b => hitsAt('bd', [[0, .65], [.5, .55]], b)), ...hitsAt('bd', [[74, 1], [75, 1], [76, 1], [77, 1], [78, 1], [79, 1], [80, 1]]),
      ],
      perc4: [
        ...hitsAt('cym', [[0, .8], [2, .7]]), {i: 'cym', b: 20, v: .9}, ...each(22, 36, 2, b => [{i: 'cym', b, v: .4}]),
        {i: 'cym', b: 56, v: .6}, {i: 'cym', b: 58, v: 1}, ...each(60, 74, 2, b => [{i: 'cym', b, v: .5}]), ...hitsAt('cym', [[74, .8], [76, .9], [78, .9], [80, 1]]),
      ],
    },
  },

  pomp: {
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
  },

  radetzky: {
    id: 'radetzky',
    title: '「ラデツキー行進曲」',
    full: 'ヨハン・シュトラウス1世「ラデツキー行進曲」',
    composer: 'J.シュトラウス1世（1848年）',
    key: 'ニ長調', trans: 0, meter: 2, beatUnit: 2, beats: 104,
    tempi: [76, 80, 84],
    desc: '客席の手拍子でおなじみの行進曲。はずむような短い音を全員でそろえ、くり返しでは一段と元気よく。音の短さと縦の線がそろわないと、すぐに重たく聞こえる。',
    asks: 'リズム・バランス・表現',
    focus: {pitch: .95, tone: 1, expr: .95, rhythm: 1.2, balance: 1.05},
    balRef: 4.8, ceiling: .96,
    spans: [{name: '前奏〜第1部', from: 0, to: 40}, {name: '第2部', from: 40, to: 72}, {name: '第1部（くり返し）', from: 72, to: 104}],
    slur: 'tongue',
    scale: [[0, [1, 2, 4, 6, 7, 9, 11]]],
    mel: RAD_MEL,
    chords: [...chords('D:2 | D:.5 A:.5 Bm:1 | E7:2 | A7:2'), ...chords(RAD_A_CH, 8), ...chords('G:2 | G:2 | D:2 | D:2 | A7:2 | D:2 | A7:2 | D:2 | A7:2 | D:2 | F#:1 Bm:1 | F#:1 Bm:1 | F#:.5 Bm:.5 F#:.5 Bm:.5 | F#:.5 Bm:.5 F#:.5 Bm:.5 | F#:2 | F#:2', 40), ...chords(RAD_A_CH, 72)],
    bass: RAD_BASS,
    dyn: [[0,.9],[7.9,.9],[8,.5],[37.9,.58],[38,.62],[39.9,.66],[40,.72],[71.9,.8],[72,.92],[101.9,.96],[102,1],[104,1]],
    rubato: [[0,1],[6,1],[7.9,1.06],[8,1],[38,1],[39.9,1.05],[40,1],[70,1],[71.9,1.05],[72,1],[101,1],[102,1.05],[104,1.15]],
    groups: radGroups(),
    roles: {
      picc:  [{f: 0, t: 8, r: 'mel', sh: 0, sc: .7}, {f: 72, t: 104, r: 'mel', sh: 12, sc: .7}],
      fl1:   [{f: 0, t: 104, r: 'mel', sh: 0}],
      fl2:   [{f: 0, t: 8, r: 'mel', sh: -12}, {f: 8, t: 104, r: 'mel3', sh: 0}],
      ob:    [{f: 0, t: 8, r: 'mel', sh: 0}, {f: 8, t: 40, r: 'mel', sh: 0, sc: .8}, {f: 40, t: 104, r: 'mel', sh: 0}],
      ebcl:  [{f: 0, t: 8, r: 'mel', sh: 0, sc: .7}, {f: 72, t: 104, r: 'mel', sh: 0, sc: .7}],
      cl1:   [{f: 0, t: 8, r: 'mel', sh: -12}, {f: 8, t: 40, r: 'mel', sh: 0}, {f: 40, t: 72, r: 'mel', sh: -12}, {f: 72, t: 104, r: 'mel', sh: 0}],
      cl2:   [{f: 0, t: 8, r: 'mel', sh: -12}, {f: 8, t: 40, r: 'mel3', sh: 0}, {f: 40, t: 72, r: 'mel3', sh: -12}, {f: 72, t: 104, r: 'mel3', sh: 0}],
      cl3:   [{f: 0, t: 8, r: 'mel', sh: -24}, ...radPads('w', 0)],
      asax1: [{f: 0, t: 104, r: 'mel', sh: -12}],
      asax2: [{f: 0, t: 8, r: 'mel', sh: -12}, ...radPads('w', 1)],
      tsax:  [{f: 0, t: 8, r: 'mel', sh: -24}, {f: 8, t: 40, r: 'pad', g: 'tsA', i: 0, sc: .7}, {f: 40, t: 104, r: 'mel', sh: -24}],
      bsax:  [{f: 0, t: 104, r: 'bass', sh: 0, rh: 'march'}],
      bcl:   [{f: 0, t: 104, r: 'bass', sh: 0, rh: 'march'}],
      fg:    [{f: 0, t: 104, r: 'bass', sh: 0, rh: 'march', sc: .85}],
      tp1:   [{f: 0, t: 8, r: 'mel', sh: -12}, {f: 8, t: 40, r: 'mel', sh: -12, sc: .8}, {f: 40, t: 104, r: 'mel', sh: -12}],
      tp2:   [{f: 0, t: 8, r: 'mel', sh: -12}, {f: 40, t: 104, r: 'mel3', sh: -12}],
      tp3:   [{f: 0, t: 8, r: 'mel', sh: -24}, {f: 40, t: 72, r: 'pad', g: 'tpB', i: 0}, {f: 72, t: 102, r: 'pad', g: 'tpA2', i: 0}, {f: 102, t: 104, r: 'pad', g: 'tpE2', i: 0}],
      hn1: [{f: 0, t: 8, r: 'mel', sh: -24}, ...radPads('hn', 0)], hn2: [{f: 0, t: 8, r: 'mel', sh: -24}, ...radPads('hn', 1)],
      hn3: [{f: 0, t: 8, r: 'mel', sh: -24}, ...radPads('hn', 2)], hn4: [{f: 0, t: 8, r: 'mel', sh: -24}, ...radPads('hn', 3)],
      tb1:   [{f: 0, t: 8, r: 'mel', sh: -24}, ...radPads('tb', 0, .7).filter(s => s.f < 72), {f: 72, t: 102, r: 'mel', sh: -24}, {f: 102, t: 104, r: 'pad', g: 'tbE2', i: 0}],
      tb2:   [{f: 0, t: 8, r: 'mel', sh: -36}, ...radPads('tb', 1, .7)],
      btb:   [{f: 0, t: 8, r: 'bass', sh: 0}, {f: 40, t: 104, r: 'bass', sh: 0, rh: 'march'}],
      euph:  [{f: 0, t: 8, r: 'mel', sh: -24}, {f: 8, t: 40, r: 'mel', sh: -24, sc: .7}, {f: 40, t: 104, r: 'mel', sh: -24}],
      tuba:  [{f: 0, t: 8, r: 'bass', sh: 0}, {f: 8, t: 104, r: 'bass', sh: -12, rh: 'march'}],
      cb:    [{f: 0, t: 8, r: 'bass', sh: 0}, {f: 8, t: 40, r: 'bass', sh: -12, rh: 'pizz'}, {f: 40, t: 104, r: 'bass', sh: -12, rh: 'march'}],
      perc4: [{f: 40, t: 72, r: 'mel', sh: 12, inst: 'glock', sc: .3}],
    },
    perc: {
      perc1: [
        ...timpOn(RAD_BASS, [[0,.85],[.25,.6],[.5,.8],[1,.85],[1.25,.6],[1.5,.8],[4,.7],[5.5,.75],[6,.9]]),
        ...timpOn(RAD_BASS, each(8, 38, 1, b => [[b, .45]])), ...timpOn(RAD_BASS, [[38, .7], [38.5, .7], [39, .8]]),
        ...timpOn(RAD_BASS, each(40, 72, 1, b => [[b, .55]])), ...timpOn(RAD_BASS, each(72, 102, 1, b => [[b, .7]])),
        ...timpOn(RAD_BASS, [[102, .9], [102.5, .9], [103, 1]]),
      ],
      perc2: [
        ...hitsAt('sd', [[0,.8],[.25,.5],[.5,.7],[1,.8],[1.25,.5],[1.5,.7],[4,.6],[5.5,.6],[6,.85],[7.5,.5],[7.75,.5]]),
        ...each(8, 38, 1, b => hitsAt('sd', [[0, .28], [.25, .18], [.5, .25], [.75, .18]], b)), ...hitsAt('sd', [[38, .6], [38.5, .6], [39, .7]]),
        ...each(40, 72, 1, b => hitsAt('sd', [[0, .4], [.25, .28], [.5, .35], [.75, .28]], b)),
        ...each(72, 102, 1, b => hitsAt('sd', [[0, .5], [.25, .36], [.5, .45], [.75, .36]], b)), ...hitsAt('sd', [[102, .9], [102.5, .9], [103, 1]]),
      ],
      perc3: [
        ...hitsAt('bd', [[0, .9], [1, .8], [4, .7], [6, .9]]),
        ...each(8, 38, 1, b => [{i: 'bd', b, v: .4}]), ...hitsAt('bd', [[38, .7], [38.5, .7], [39, .8]]),
        ...each(40, 72, 1, b => [{i: 'bd', b, v: .5}]), ...each(72, 102, 1, b => [{i: 'bd', b, v: .65}]), ...hitsAt('bd', [[102, 1], [102.5, 1], [103, 1]]),
      ],
      perc4: [
        ...hitsAt('cym', [[0, .8], [6, .8]]), ...hitsAt('cym', [[38, .6], [39, .7]]),
        {i: 'cym', b: 72, v: 1}, ...each(74, 102, 2, b => [{i: 'cym', b, v: .5}]), ...hitsAt('cym', [[102, .9], [103, 1]]),
      ],
    },
  },
};
const PIECE_IDS = ['largo', 'ode', 'galop', 'pomp', 'radetzky'];
// その拍でのテンポ（序奏だけゆっくり、のような曲は楽譜上の切り替えを反映する）と、表示用の書き方
// 楽譜の上のテンポの変わり方：tmap は段階的な切り替え、tcurve はだんだん速く（遅く）。値は1拍の長さの倍率
const tmAt = (pc, b) => pc.tcurve ? interp(pc.tcurve, b) : sectionAt(pc.tmap, b, 1);
const bpmAt = (pc, i, b = 0) => Math.round(pc.tempi[i] / tmAt(pc, b));
// 拍の単位（2分音符で数える行進曲、8分音符で数えるゆっくりした曲など）と、表示用の書き方
const beatName = pc => pc.beatUnit === 2 ? '2分音符' : pc.beatUnit === .5 ? '♪' : '♩';
const tempoLabel = (pc, i) => {
  const a = bpmAt(pc, i, 0), z = bpmAt(pc, i, pc.beats - 0.01);
  return `${beatName(pc)}=${a}${a !== z ? '→' + z : ''}`;
};

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
