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
    const m = /^([A-G])(#|b)?(m7|m|7|5|sus4|sus2|\+|o7)?(?:\/[A-G])?$/.exec(nm);
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

/* ===== 自由曲3：スーザ 行進曲「星条旗よ永遠なれ」=====
   1拍＝2分音符（2/2拍子）で、実音のまま書く。序奏 → 第1マーチ → トリオ（変イ長調、やわらかく）→ トリオの後半を全員で（グランディオーソ）。
   音は Mutopia Project のピアノ版（1897年、パブリックドメイン）から写した */
const STARS_INTRO = 'Eb5:1> D5:.75 Eb5:.25 | C5:.5 Eb5:1> F5:.5 | Gb5:.5> G5:.5> Ab5:.5> A5:.5> | Bb5:.5> r:.5 Bb4:1>';
const STARS_A = [
  'G5:.5 r:.25 G5:.25 G5:.5 G5:.5 | G5:.5 r:.25 G5:.25 Ab5:.5 Ab5:.5 | F5:.25 E5:.25 F5:.25\' G5:.25\' F5:.5\' Eb5:.5\' | D5:.5\' C5:.5\' D5:.5\' Bb4:.5\'',
  'Bb5:.5> r:.25 Bb5:.25 Bb5:.5 Bb5:.5 | Bb5:.5 r:.25 Bb5:.25 B5:.5 B5:.5 | C6:.25> B5:.25 C6:.25\' Eb6:.25\' D6:.5> C6:.5 | B5:1.5 B5:.5',
  'Bb5:.5 r:.25 Bb5:.25\' Eb6:.5\' r:.25 C6:.25\' | Bb5:.5\' A5:.5\' Bb5:.5\' G5:.5\' | F5:.5> Bb4:.25 A4:.25 Bb4:.25 A4:.25 Bb4:.5 | F5:.5> Bb4:.25 A4:.25 Bb4:.25 A4:.25 Bb4:.5',
  'Bb5:.5 r:.25 Bb5:.25\' Eb6:.5\' r:.25 C6:.25\' | Bb5:.5\' A5:.5\' Bb5:.5\' Gb5:.5\' | F5:.5> A4:.25 G4:.25 A4:.25 G4:.25 A4:.5 | Bb4:.5 r:.5 Eb5:1',
].join(' | ');
const STARS_A_CH = 'Eb:1 G7:1 | Cm:1 Fm:1 | Bb:1 F7:1 | Bb:1 Bb7:1 | Eb:1 Bb7:1 | Eb:1 G:1 | Cm:2 | G:2 | Eb:2 | Eb:2 | Bb7:2 | Bb7:2 | Eb:2 | Eb:2 | F7:2 | Bb:1 Eb7:1';
const STARS_A_BASS = 'Eb3:.5 r:.5 D3:.5 r:.5 | C3:.5 r:.5 F3:.5 r:.5 | D3:.5 r:.5 C3:.5 r:.5 | Bb2:.5 r:.5 Ab3:.5 r:.5 | G3:.5 r:.5 F3:.5 r:.5 | Eb3:.5 r:.5 D3:.5 r:.5 | C3:.5 r:.5 Eb3:.5 r:.5 | G2:.5 r:1.5 | '
  + rep('Eb3:.5 r:.5 Bb2:.5 r:.5', 2) + ' | ' + rep('D3:.5 r:.5 Bb2:.5 r:.5', 2) + ' | ' + rep('Eb3:.5 r:.5 Bb2:.5 r:.5', 2) + ' | F3:.5 r:.5 F3:.5 r:.5 | Bb2:.5 r:.5 Eb3:.5 r:.5';
const STARS_TRIO = 'Eb5:1 Db5:.5 C5:.5 | C5:1 B4:.5 C5:.5 | C5:3 B4:.5 C5:.5 | C5:1 B4:.5 C5:.5 | Eb5:1 C5:.75 Eb5:.25 | Db5:2 | Bb4:1 Bb4:1 | Bb4:1 A4:.5 Bb4:.5 | Bb4:1 A4:.5 Bb4:.5 | Db5:3 C5:.5 Bb4:.5 | C5:.5 Eb5:1.5 | F5:1.5 F5:.5 | Bb4:3 Eb5:1';
const STARS_TRIO_CH = rep('Ab:2', 6) + ' | ' + rep('Eb7:2', 6) + ' | Ab:2 | Db:2 | Eb:2 | Eb:1 Eb7:1';
const STARS_TRIO_BASS = rep('Ab2:.5 r:.5 Eb3:.5 r:.5', 6) + ' | ' + rep('Bb2:.5 r:.5 Eb3:.5 r:.5', 6) + ' | Ab2:.5 r:.5 Eb3:.5 r:.5 | Db3:.5 r:.5 Ab2:.5 r:.5 | Eb3:.5 r:.5 Bb2:.5 r:.5 | G2:.5 r:.5 Eb3:.5 r:.5';
const STARS_FIN = 'Eb5:1 Db5:.5 C5:.5 | C5:1 B4:.5 C5:.5 | C5:3 B4:.5 C5:.5 | C5:1 B4:.5 C5:.5 | Db5:.5 C5:.5 Bb4:.75 G5:.25 | Bb4:2 | Ab4:1 Ab4:1 | Ab4:1 G4:.5 Ab4:.5 | Cb5:1 Bb4:.5 Ab4:.5 | Ab5:2.5 Ab4:.5 Bb4:.5 C5:.5 | Eb5:.25 r:.25 Ab4:.5 Bb4:.5 C5:.5 | Eb5:.25 r:.25 Eb4:.5 F4:.5 C5:.5 | Bb4:2 | Ab4:.5> r:.5 Ab5:.5\'> r:.5';
const STARS_FIN_CH = rep('Ab:2', 4) + ' | C7:2 | C7:2 | Fsus4:2 | Fm:2 | Dbm:2 | Fb:2 | ' + rep('Ab:2', 4) + ' | Eb7:2 | Ab:2';
const STARS_FIN_BASS = rep('Ab2:.5 r:.5 Eb3:.5 r:.5', 4) + ' | ' + rep('G2:.5 r:.5 C3:.5 r:.5', 2) + ' | ' + rep('F2:.5 r:.5 C3:.5 r:.5', 2)
  + ' | Fb2:.5 r:.5 Ab2:.5 r:.5 | Fb2:.5 r:.5 Cb3:.5 r:.5 | Eb3:.5 r:.5 Ab2:.5 r:.5 | ' + rep('C3:.5 r:.5 Eb3:.5 r:.5', 2) + ' | Ab2:.5 r:.5 C3:.5 r:.5 | G2:.5 r:.5 Eb3:.5 r:.5 | Ab2:.5> r:.5 Ab2:.5\'> r:.5';
const STARS_BASS = [...line('Eb2:1> D2:.75 Eb2:.25 | C2:.5> r:.5 C3:1> | Cb3:1> Cb3:1> | Bb2:.5> r:1.5'), ...line(STARS_A_BASS, 8), ...line(STARS_TRIO_BASS, 40), ...line(STARS_FIN_BASS, 72)];
// 小太鼓の基本の型（1小節＝2拍）
const STARS_SD = [[0, .5], [.5, .32], [1, .45], [1.5, .32], [1.75, .25]];
// 最後の小節：1拍目に主音、2拍目に和音
const STARS_END = {pat: [[0, .5, 'norm', true], [1, .5, 'stac', true]]};
const starsHn = i => [
  {f: 0, t: 8, r: 'mel', sh: -12}, {f: 8, t: 40, r: 'pad', g: 'hnA', i}, {f: 40, t: 72, r: 'pad', g: 'hnT', i, sc: .6},
  {f: 72, t: 102, r: 'pad', g: 'hnG', i}, {f: 102, t: 104, r: 'pad', g: 'cdHn', i},
];

/* ===== 自由曲4：ホルスト 組曲《惑星》より「木星」の中間部 =====
   ハ長調で書いて変ホ長調へ。3拍子。同じ旋律でホルスト自身が作った賛美歌「サクステッド」（1921年、パブリックドメイン）の
   旋律・和音・低音を Mutopia Project の楽譜から写した。6つのフレーズを、ホルンの歌から全員の歌へ広げていく */
const JUP_A1 = 'E4:.5 G4:.5 | A4:1.5 C5:.5 B4:.75 G4:.25 | C5:.5 D5:.5 C5:1 B4:1 | A4:.5 B4:.5 A4:1 G4:1 | E4:2';
const JUP_A2 = 'E4:.5 G4:.5 | A4:1.5 C5:.5 B4:.75 G4:.25 | C5:.5 D5:.5 E5:1 E5:1 | E5:.5 D5:.5 C5:1 D5:1';
const JUP_B1 = 'G4:.5 E4:.5 | D4:1.5 D4:.5 C4:.5 E4:.5 | D4:1 G4:1 G4:.5 E4:.5 | D4:1.5 D4:.5 E4:.5 G4:.5 | A4:2';
const JUP_B2 = 'A4:.5 B4:.5 | C5:.75 C5:.25 B4:1 A4:1 | G4:1 C5:1 E4:1 | D4:.5 C4:.5 D4:1 E4:1 | G4:2';
const JUP_MEL = ['r:5', JUP_A1, JUP_A2 + ' | C5:2', JUP_B1, JUP_B2, JUP_A1, JUP_A2 + ' | C5:6'].join(' | ');
const JUP_CH = ['C:5', 'C:1 | F:2 Dm:1 | C:3 | F:2 G:1 | Am:2', 'G:1 | F:2 Dm:1 | C:3 | F:3 | C:2',
  'C/E:1 | G:2 Am:1 | G/B:2 C/E:1 | G:2 C:1 | F:1 F/E:1', 'Dm:1 | Am:1 C/G:1 F:1 | C/E:1 Dm7:1 C:1 | F:1 Dm:1 Am/C:1 | G/B:1 Am7:1',
  'G:1 | F:2 G7/B:1 | C/E:2 Em:1 | F:2 G:1 | Am:2', 'G:1 | F:2 G7/D:1 | C/E:2 C:1 | F:2 Dm/F:1 | C:6'].join(' | ');
const JUP_BASS = ['C3:5', 'C3:1 | F3:2 D3:1 | E3:2 E3:1 | F3:2 G3:1 | A3:2', 'G3:1 | F3:2 D3:1 | E3:2 C3:.5 E3:.5 | F3:3 | C3:2',
  'E2:1 | G2:2 A2:1 | B2:2 E2:1 | G2:2 C3:1 | F3:1 E3:1', 'D3:1 | A3:1 G3:1 F3:1 | E3:1 D3:1 C3:1 | F3:1 D3:1 C3:1 | B2:1 A2:1',
  'G2:1 | F2:2 D2:1 | E2:2 E2:1 | F2:2 G2:1 | A2:2', 'G2:1 | F2:2 D3:1 | E3:2 C3:.5 E3:.5 | F3:3 | C3:6'].join(' | ');
const JUP_BASS_EV = line(JUP_BASS);

/* ===== 自由曲5：グリーグ 劇音楽《ペール・ギュント》より「山の魔王の宮殿にて」=====
   ロ短調、実音のまま。同じ4小節の旋律（A）と、嬰ヘ長調の旋律（B）を、低い楽器から高い楽器へ受け渡しながら、
   だんだん速く、大きくしていく。音は Mutopia Project のピアノ版（1918年、パブリックドメイン）から写した */
const HALL_A = line("B2:.5' C#3:.5' D3:.5' E3:.5' F#3:.5'> D3:.5' F#3:1' | E#3:.5'> C#3:.5' E#3:1' E3:.5'> C3:.5' E3:1' | B2:.5' C#3:.5' D3:.5' E3:.5' F#3:.5' D3:.5' F#3:.5' B3:.5' | A3:.5' F#3:.5' D3:.5' F#3:.5' A3:2>");
const HALL_B = line("F#2:.5' G#2:.5' A#2:.5' B2:.5' C#3:.5'> A#2:.5' C#3:1' | D3:.5'> A#2:.5' D3:1' C#3:.5'> A#2:.5' C#3:1' | F#2:.5' G#2:.5' A#2:.5' B2:.5' C#3:.5'> A#2:.5' C#3:1' | D3:.5'> A#2:.5' D3:1' C#3:2>");
const HALL_A_CH = 'Bm:4 | B5:4 | Bm:4 | D:4', HALL_B_CH = 'F#:4 | D+:2 F#:2 | F#:4 | D+:2 F#:2';
// 前半の低音は、ロとファ#（Bの旋律ではファ#とド#）をくり返す。速くなってからは8分音符で下りてくる
const HALL_A_BASS = rep("B1:1' F#2:1' B1:1' F#2:1'", 3) + " | D2:1' A2:1' D2:1' A2:1'";
const HALL_B_BASS = rep("F#2:1' C#3:1' F#2:1' C#3:1' | D2:1' A#2:1' F#2:1' C#3:1'", 2);
const HALL_VIVO_BASS = rep("B1:.5'> A1:.5' G1:.5' F#1:.5' B1:.5'> A1:.5' G1:.5' F#1:.5'", 3) + " | D2:.5'> C#2:.5' B1:.5' A1:.5' D2:.5'> C#2:.5' B1:.5' A1:.5'";
const HALL_STRETTO_BASS = rep("F#2:.5'> E2:.5' D2:.5' C#2:.5' F#2:.5'> E2:.5' D2:.5' C#2:.5' | D2:.5'> C#2:.5' D2:.5' E2:.5' F#2:.5'> E2:.5' D2:.5' C#2:.5'", 2);
const HALL_BASS = [...line(HALL_A_BASS, 4), ...line(HALL_A_BASS, 20), ...line(HALL_B_BASS, 36), ...line(HALL_A_BASS, 52), ...line(HALL_A_BASS, 68),
  ...line(HALL_B_BASS, 84), ...line(HALL_B_BASS, 100), ...line(HALL_VIVO_BASS, 116), ...line(HALL_STRETTO_BASS, 132), ...line("B1:.5'> r:3.5 | r:2 B1:2 | B1:.5'> r:3.5", 148)];
// 最後の打ち込み：小節の2拍目に和音（あいだの休みの小節は鳴らさない）
const HALL_HIT = {pat: [[1, .5, 'stac', true]]};
const hallEnd = (g, i) => [{f: 148, t: 152, r: 'pad', g, i}, {f: 156, t: 160, r: 'pad', g, i}];
// 旋律を吹く区間を [から, まで, ずらす半音, 音量] で並べる（同じ旋律を区間ごとに別のオクターブで受け渡すため）
const melIn = (...secs) => secs.map(([f, t, sh, sc]) => ({f, t, r: 'mel', sh, ...(sc ? {sc} : {})}));

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
  stars: {
    id: 'stars',
    title: '「星条旗よ永遠なれ」',
    full: 'スーザ 行進曲「星条旗よ永遠なれ」',
    composer: 'J.P.スーザ（1896年）',
    key: '変ホ長調（トリオは変イ長調）', trans: 0, meter: 2, beatUnit: 2, beats: 104,
    tempi: [112, 120, 128],
    desc: 'マーチ王スーザの代表作。きびきびした第1マーチ、やわらかく歌うトリオ、そして全員で鳴らすトリオの後半。縦の線のずれがすぐ聞こえる。',
    asks: 'リズム・バランス・音色',
    focus: {pitch: .95, tone: 1, expr: .85, rhythm: 1.25, balance: 1.05},
    balRef: 6.7, ceiling: .96,
    spans: [{name: '序奏〜第1マーチ', from: 0, to: 40}, {name: 'トリオ', from: 40, to: 72}, {name: '最後（全員で）', from: 72, to: 104}],
    slur: [[0, 'tongue'], [40, 'bar']],
    scale: [[0, [0, 2, 3, 5, 7, 8, 10]], [40, [0, 1, 3, 5, 7, 8, 10]]],
    mel: [...line(STARS_INTRO), ...line(STARS_A, 8), ...line(STARS_TRIO, 40), ...line(STARS_FIN, 72)],
    chords: [...chords('Eb:2 | Cm:2 | Cb:2 | Bb:2'), ...chords(STARS_A_CH, 8), ...chords(STARS_TRIO_CH, 40), ...chords(STARS_FIN_CH, 72)],
    bass: STARS_BASS,
    dyn: [[0,.86],[7.9,.86],[8,.62],[23.9,.64],[24,.68],[38,.72],[39.9,.6],[40,.34],[56,.38],[69.9,.42],[71.9,.86],[72,.92],[90,.94],[92,.98],[101.9,.96],[102,.95],[104,1]],
    rubato: [[0,1],[7.5,1],[7.9,1.04],[8,1],[38,1],[39.9,1.05],[40,1],[69,1],[71.9,1.08],[72,1],[100,1],[101.9,1.06],[102,1.08],[104,1.15]],
    groups: {
      hnA:  {n: 4, lo: 55, hi: 70, rh: 'ab8'},
      saxA: {n: 2, lo: 58, hi: 72, rh: 'ab8'},
      clA:  {n: 1, lo: 60, hi: 72, rh: 'ab8'},
      tenA: {n: 1, lo: 50, hi: 62, rh: 'ab8'},
      tp3A: {n: 1, lo: 62, hi: 72, rh: 'ab8'},
      tbA:  {n: 2, lo: 50, hi: 64, rh: 'ab8'},
      hnT:  {n: 4, lo: 55, hi: 70, rh: 'ab8'},
      clT:  {n: 2, lo: 58, hi: 70, rh: 'ab8'},
      hnG:  {n: 4, lo: 56, hi: 72, rh: 'ab8'},
      clG:  {n: 1, lo: 60, hi: 74, rh: 'ab8'},
      tp3G: {n: 1, lo: 62, hi: 74, rh: 'ab8'},
      cdHn: {n: 4, lo: 56, hi: 70, rh: STARS_END}, cdW: {n: 1, lo: 60, hi: 75, rh: STARS_END}, cdTp: {n: 1, lo: 62, hi: 74, rh: STARS_END},
    },
    roles: {
      picc:  [{f: 0, t: 8, r: 'mel', sh: 12, sc: .7}, {f: 24, t: 40, r: 'mel', sh: 12, sc: .5}, {f: 72, t: 104, r: 'mel', sh: 12, sc: .8}],
      fl1:   [{f: 0, t: 8, r: 'mel', sh: 12}, {f: 8, t: 40, r: 'mel', sh: 0}, {f: 56, t: 72, r: 'mel', sh: 12, sc: .5}, {f: 72, t: 104, r: 'mel', sh: 12}],
      fl2:   [{f: 0, t: 8, r: 'mel', sh: 0}, {f: 8, t: 40, r: 'mel3', sh: 0}, {f: 72, t: 104, r: 'mel3', sh: 12}],
      ob:    [{f: 0, t: 8, r: 'mel', sh: 0}, {f: 8, t: 40, r: 'mel', sh: 0, sc: .8}, {f: 40, t: 72, r: 'mel', sh: 0, sc: .5}, {f: 72, t: 104, r: 'mel', sh: 0}],
      ebcl:  [{f: 0, t: 8, r: 'mel', sh: 0, sc: .7}, {f: 24, t: 40, r: 'mel', sh: 0, sc: .6}, {f: 72, t: 104, r: 'mel', sh: 12, sc: .7}],
      cl1:   [{f: 0, t: 104, r: 'mel', sh: 0}],
      cl2:   [{f: 0, t: 8, r: 'mel', sh: -12}, {f: 8, t: 40, r: 'mel3', sh: 0}, {f: 40, t: 72, r: 'mel', sh: -12}, {f: 72, t: 104, r: 'mel3', sh: 0}],
      cl3:   [{f: 0, t: 8, r: 'mel', sh: -12}, {f: 8, t: 40, r: 'pad', g: 'clA', i: 0}, {f: 40, t: 72, r: 'pad', g: 'clT', i: 0}, {f: 72, t: 102, r: 'pad', g: 'clG', i: 0}, {f: 102, t: 104, r: 'pad', g: 'cdW', i: 0}],
      bcl:   [{f: 0, t: 8, r: 'bass', sh: 0}, {f: 8, t: 40, r: 'bass', sh: 0, rh: 'march'}, {f: 40, t: 72, r: 'bass', sh: 0, rh: 'march', sc: .7}, {f: 72, t: 104, r: 'bass', sh: 0, rh: 'march'}],
      fg:    [{f: 0, t: 8, r: 'bass', sh: 0}, {f: 8, t: 40, r: 'bass', sh: 0, rh: 'march', sc: .85}, {f: 40, t: 72, r: 'mel', sh: -12, sc: .55}, {f: 72, t: 104, r: 'bass', sh: 0, rh: 'march'}],
      asax1: [{f: 0, t: 8, r: 'mel', sh: -12}, {f: 8, t: 40, r: 'pad', g: 'saxA', i: 0}, {f: 40, t: 72, r: 'mel', sh: -12, sc: .7}, {f: 72, t: 104, r: 'mel', sh: 0}],
      asax2: [{f: 0, t: 8, r: 'mel', sh: -12}, {f: 8, t: 40, r: 'pad', g: 'saxA', i: 1}, {f: 40, t: 72, r: 'pad', g: 'clT', i: 1}, {f: 72, t: 104, r: 'mel3', sh: 0}],
      tsax:  [{f: 0, t: 8, r: 'mel', sh: -12}, {f: 8, t: 40, r: 'pad', g: 'tenA', i: 0}, {f: 40, t: 72, r: 'mel', sh: -12, sc: .6}, {f: 72, t: 104, r: 'mel', sh: -12}],
      bsax:  [{f: 0, t: 8, r: 'bass', sh: 0}, {f: 8, t: 40, r: 'bass', sh: 0, rh: 'march'}, {f: 40, t: 72, r: 'bass', sh: 0, rh: 'march', sc: .7}, {f: 72, t: 104, r: 'bass', sh: 0, rh: 'march'}],
      tp1:   [{f: 0, t: 8, r: 'mel', sh: 0}, {f: 8, t: 40, r: 'mel', sh: -12}, {f: 72, t: 104, r: 'mel', sh: 0}],
      tp2:   [{f: 0, t: 8, r: 'mel', sh: 0}, {f: 8, t: 40, r: 'mel', sh: -12, sc: .75}, {f: 72, t: 104, r: 'mel3', sh: 0}],
      tp3:   [{f: 0, t: 8, r: 'mel', sh: -12}, {f: 8, t: 40, r: 'pad', g: 'tp3A', i: 0, sc: .7}, {f: 72, t: 102, r: 'pad', g: 'tp3G', i: 0}, {f: 102, t: 104, r: 'pad', g: 'cdTp', i: 0}],
      hn1: starsHn(0), hn2: starsHn(1), hn3: starsHn(2), hn4: starsHn(3),
      tb1:   [{f: 0, t: 8, r: 'mel', sh: -12}, {f: 8, t: 40, r: 'pad', g: 'tbA', i: 0, sc: .6}, {f: 72, t: 104, r: 'mel', sh: -12}],
      tb2:   [{f: 0, t: 8, r: 'mel', sh: -24}, {f: 8, t: 40, r: 'pad', g: 'tbA', i: 1, sc: .6}, {f: 72, t: 104, r: 'mel3', sh: -12}],
      btb:   [{f: 0, t: 8, r: 'bass', sh: 0}, {f: 8, t: 40, r: 'bass', sh: 0, rh: 'march'}, {f: 72, t: 104, r: 'bass', sh: 0, rh: 'march'}],
      euph:  [{f: 0, t: 8, r: 'mel', sh: -12}, {f: 8, t: 40, r: 'mel', sh: -24, sc: .7}, {f: 40, t: 72, r: 'mel', sh: -12, sc: .8}, {f: 72, t: 104, r: 'mel', sh: -12}],
      tuba:  [{f: 0, t: 8, r: 'bass', sh: 0}, {f: 8, t: 40, r: 'bass', sh: -12, rh: 'march'}, {f: 40, t: 72, r: 'bass', sh: -12, rh: 'march', sc: .65}, {f: 72, t: 104, r: 'bass', sh: -12, rh: 'march'}],
      cb:    [{f: 0, t: 8, r: 'bass', sh: 0}, {f: 8, t: 40, r: 'bass', sh: -12, rh: 'march'}, {f: 40, t: 72, r: 'bass', sh: -12, rh: 'pizz'}, {f: 72, t: 104, r: 'bass', sh: -12, rh: 'march'}],
      perc4: [{f: 56, t: 72, r: 'mel', sh: 12, inst: 'glock', sc: .35}],
    },
    perc: {
      perc1: [
        ...timpOn(STARS_BASS, [[0,.85],[1,.5],[1.75,.5],[2,.6],[2.5,.85],[4,.8],[5,.8],[6,.95]]),
        ...timpOn(STARS_BASS, each(8, 40, 2, b => [[b, b % 8 ? .42 : .55]])),
        ...timpOn(STARS_BASS, each(40, 70, 4, b => [[b, .28]])),
        {i: 'timp', b: 70, d: 2, m: 51, roll: true, v: .3, v1: .85},
        ...timpOn(STARS_BASS, each(72, 102, 2, b => [[b, .78], [b + 1, .55]])),
        ...timpOn(STARS_BASS, [[102, .9], [103, 1]]),
      ],
      perc2: [
        ...hitsAt('sd', [[0,.85],[1,.55],[1.75,.5],[2,.6],[2.5,.85],[4,.75],[4.5,.75],[5,.8],[5.5,.85],[6,.95],[7,.5]]),
        ...each(8, 38, 2, b => hitsAt('sd', STARS_SD, b)),
        {i: 'sd', b: 38, d: 1, roll: true, v: .35, v1: .6}, {i: 'sd', b: 39, v: .55},
        ...each(40, 70, 2, b => hitsAt('sd', [[0, .18], [1, .15]], b)),
        {i: 'sd', b: 70, d: 2, roll: true, v: .22, v1: .85},
        ...each(72, 102, 2, b => hitsAt('sd', STARS_SD.map(([o, v]) => [o, v + .15]), b)),
        ...hitsAt('sd', [[102, .85], [103, 1]]),
      ],
      perc3: [
        ...hitsAt('bd', [[0,.9],[2.5,.7],[4,.75],[5,.75],[6,.95]]),
        ...each(8, 40, 2, b => hitsAt('bd', [[0, .48], [1, .4]], b)),
        ...each(40, 70, 2, b => hitsAt('bd', [[0, .22], [1, .18]], b)),
        {i: 'bd', b: 70, d: 2, roll: true, v: .2, v1: .6},
        ...each(72, 102, 2, b => hitsAt('bd', [[0, .62], [1, .52]], b)),
        ...hitsAt('bd', [[102, .9], [103, 1]]),
      ],
      perc4: [
        ...hitsAt('cym', [[0,.85],[2.5,.6],[6,.85]]),
        ...each(8, 40, 2, b => hitsAt('cym', [[0, .32], [1, .24]], b)),
        ...each(40, 72, 4, b => [{i: 'tri', b, v: .22}]),
        {i: 'cym', b: 72, v: 1},
        ...each(74, 102, 2, b => hitsAt('cym', b === 92 ? [[0, .9], [1, .4]] : [[0, .45], [1, .35]], b)),
        ...hitsAt('cym', [[102, .8], [103, 1]]),
      ],
    },
  },

  jupiter: {
    id: 'jupiter',
    title: '「木星」',
    full: 'ホルスト 組曲《惑星》より「木星」',
    composer: 'G.ホルスト（1918年初演）',
    key: '変ホ長調', trans: 3, meter: 3, beats: 81,
    tempi: [66, 74, 82],
    desc: '「ジュピター」として知られる、あのゆったりした3拍子の旋律。ホルンと低音の歌から始まり、最後は全員で大きく歌い上げる。長い旋律を息でつなぐ音色と、和音の響きがものをいう。',
    asks: '音色・音程・表現',
    focus: {pitch: 1.05, tone: 1.15, expr: 1.1, rhythm: .85, balance: 1.05},
    balRef: 3.1, ceiling: .98,
    spans: [{name: '前半（ホルンの歌）', from: 0, to: 29}, {name: '中間（木管へ）', from: 29, to: 53}, {name: '最後（全員で）', from: 53, to: 81}],
    slur: 'bar',
    mel: line(JUP_MEL),
    chords: chords(JUP_CH),
    bass: JUP_BASS_EV,
    dyn: [[0,.22],[4.9,.3],[5,.34],[11,.42],[16.9,.36],[17,.4],[23,.5],[28.9,.44],[29,.48],[35,.56],[40.9,.52],[41,.58],[47,.68],[52.9,.8],[53,.88],[59,.92],[64.9,.86],[65,.9],[71,.96],[75,1],[81,.94]],
    rubato: [[0,1.05],[5,1],[15,1],[16.9,1.1],[17,1],[27,1],[28.9,1.12],[29,1],[39,1],[40.9,1.1],[41,1],[51,1.02],[52.9,1.16],[53,1],[63,1],[64.9,1.1],[65,1],[71,1.03],[73,1.12],[75,1.3],[78,1.5],[81,1.6]],
    groups: {
      hnI: {n: 4, lo: 48, hi: 62, rh: 'sus'},
      clI: {n: 3, lo: 52, hi: 67, rh: 'sus'},
      hnP: {n: 2, lo: 50, hi: 64, rh: 'sus'},
      clP: {n: 3, lo: 52, hi: 67, rh: 'sus'},
      tbP: {n: 2, lo: 45, hi: 58, rh: 'sus'},
      hnB: {n: 4, lo: 50, hi: 66, rh: 'sus'},
      tbB: {n: 2, lo: 45, hi: 60, rh: 'sus'},
      midB:{n: 2, lo: 50, hi: 64, rh: 'sus'},
      hnF: {n: 2, lo: 52, hi: 68, rh: 'sus'},
      tbF: {n: 1, lo: 45, hi: 60, rh: 'sus'},
      tpF: {n: 1, lo: 57, hi: 69, rh: 'sus'},
    },
    roles: {
      hn1:   [{f: 0, t: 5, r: 'pad', g: 'hnI', i: 0, sc: .7}, {f: 5, t: 29, r: 'mel', sh: -12}, {f: 29, t: 53, r: 'pad', g: 'hnB', i: 0}, {f: 53, t: 81, r: 'mel', sh: -12}],
      hn2:   [{f: 0, t: 5, r: 'pad', g: 'hnI', i: 1, sc: .7}, {f: 5, t: 29, r: 'mel', sh: -12}, {f: 29, t: 53, r: 'pad', g: 'hnB', i: 1}, {f: 53, t: 81, r: 'mel', sh: -12}],
      hn3:   [{f: 0, t: 5, r: 'pad', g: 'hnI', i: 2, sc: .7}, {f: 5, t: 29, r: 'pad', g: 'hnP', i: 0}, {f: 29, t: 53, r: 'pad', g: 'hnB', i: 2}, {f: 53, t: 81, r: 'pad', g: 'hnF', i: 0}],
      hn4:   [{f: 0, t: 5, r: 'pad', g: 'hnI', i: 3, sc: .7}, {f: 5, t: 29, r: 'pad', g: 'hnP', i: 1}, {f: 29, t: 53, r: 'pad', g: 'hnB', i: 3}, {f: 53, t: 81, r: 'pad', g: 'hnF', i: 1}],
      euph:  [{f: 5, t: 29, r: 'mel', sh: -12}, {f: 29, t: 53, r: 'mel', sh: -12, sc: .6}, {f: 53, t: 81, r: 'mel', sh: -12}],
      tsax:  [{f: 5, t: 29, r: 'mel', sh: -12, sc: .8}, {f: 29, t: 53, r: 'pad', g: 'midB', i: 0}, {f: 53, t: 81, r: 'mel', sh: -12}],
      asax1: [{f: 5, t: 17, r: 'mel', sh: 0, sc: .55}, {f: 17, t: 53, r: 'mel', sh: 0, sc: .8}, {f: 53, t: 81, r: 'mel', sh: 0}],
      asax2: [{f: 5, t: 29, r: 'pad', g: 'clP', i: 2}, {f: 29, t: 81, r: 'mel3', sh: 0}],
      ob:    [{f: 17, t: 29, r: 'mel', sh: 0, sc: .6}, {f: 29, t: 81, r: 'mel', sh: 0}],
      fl1:   [{f: 29, t: 41, r: 'mel', sh: 12, sc: .7}, {f: 41, t: 81, r: 'mel', sh: 12}],
      fl2:   [{f: 41, t: 81, r: 'mel3', sh: 12}],
      picc:  [{f: 53, t: 81, r: 'mel', sh: 12, sc: .7}],
      ebcl:  [{f: 53, t: 81, r: 'mel', sh: 12, sc: .7}],
      cl1:   [{f: 0, t: 5, r: 'pad', g: 'clI', i: 0, sc: .6}, {f: 17, t: 29, r: 'mel', sh: 0, sc: .7}, {f: 29, t: 53, r: 'mel', sh: 0}, {f: 53, t: 81, r: 'mel', sh: 12}],
      cl2:   [{f: 0, t: 5, r: 'pad', g: 'clI', i: 1, sc: .6}, {f: 5, t: 29, r: 'pad', g: 'clP', i: 0}, {f: 29, t: 53, r: 'mel3', sh: 0}, {f: 53, t: 81, r: 'mel', sh: 0}],
      cl3:   [{f: 0, t: 5, r: 'pad', g: 'clI', i: 2, sc: .6}, {f: 5, t: 29, r: 'pad', g: 'clP', i: 1}, {f: 29, t: 53, r: 'pad', g: 'midB', i: 1}, {f: 53, t: 81, r: 'mel3', sh: 0}],
      tp1:   [{f: 41, t: 53, r: 'mel', sh: 0, sc: .75}, {f: 53, t: 81, r: 'mel', sh: 0}],
      tp2:   [{f: 41, t: 53, r: 'mel3', sh: 0, sc: .65}, {f: 53, t: 81, r: 'mel3', sh: 0}],
      tp3:   [{f: 53, t: 81, r: 'pad', g: 'tpF', i: 0}],
      tb1:   [{f: 17, t: 29, r: 'pad', g: 'tbP', i: 0, sc: .5}, {f: 29, t: 53, r: 'pad', g: 'tbB', i: 0, sc: .7}, {f: 53, t: 81, r: 'mel', sh: -12}],
      tb2:   [{f: 17, t: 29, r: 'pad', g: 'tbP', i: 1, sc: .5}, {f: 29, t: 53, r: 'pad', g: 'tbB', i: 1, sc: .7}, {f: 53, t: 81, r: 'pad', g: 'tbF', i: 0}],
      btb:   [{f: 29, t: 53, r: 'bass', sh: -12, sc: .7}, {f: 53, t: 81, r: 'bass', sh: -12}],
      bcl:   [{f: 0, t: 5, r: 'bass', sh: 0, sc: .6}, {f: 5, t: 81, r: 'bass', sh: 0}],
      fg:    [{f: 0, t: 81, r: 'bass', sh: 0, sc: .8}],
      bsax:  [{f: 5, t: 81, r: 'bass', sh: 0}],
      tuba:  [{f: 0, t: 5, r: 'bass', sh: -12, sc: .5}, {f: 5, t: 29, r: 'bass', sh: -12, sc: .65}, {f: 29, t: 81, r: 'bass', sh: -12}],
      cb:    [{f: 0, t: 81, r: 'bass', sh: -12}],
      perc4: [{f: 41, t: 53, r: 'mel', sh: 24, inst: 'glock', sc: .3}],
    },
    perc: {
      perc1: [
        {i: 'timp', b: 0, d: 5, m: 48, roll: true, v: .12, v1: .3},
        ...timpOn(JUP_BASS_EV, [[30, .3], [36, .32], [42, .38], [48, .45]], 40),
        {i: 'timp', b: 50, d: 3, m: 43, roll: true, v: .3, v1: .85},
        ...timpOn(JUP_BASS_EV, [[54, .8], [57, .6], [60, .65], [63, .6], [66, .75], [69, .6], [72, .7]], 40),
        {i: 'timp', b: 75, d: 5.5, m: 48, roll: true, v: .5, v1: .95},
      ],
      perc2: [
        {i: 'tri', b: 17, v: .16}, {i: 'tri', b: 29, v: .2},
        {i: 'sus', b: 50, d: 3, roll: true, v: .08, v1: .6},
        {i: 'sus', b: 75, d: 5.5, roll: true, v: .3, v1: .85},
      ],
      perc3: [
        {i: 'bd', b: 51, d: 2, roll: true, v: .1, v1: .5},
        ...hitsAt('bd', [[54, .7], [66, .6], [75, .85]]),
        {i: 'tamtam', b: 75, v: .35},
      ],
      perc4: hitsAt('cym', [[54, .85], [66, .65], [75, .95]]),
    },
  },

  mountain: {
    id: 'mountain',
    title: '「山の魔王の宮殿にて」',
    full: 'グリーグ 劇音楽《ペール・ギュント》より「山の魔王の宮殿にて」',
    composer: 'E.グリーグ（1876年初演）',
    key: 'ロ短調', trans: 0, meter: 4, beats: 160,
    tempi: [116, 126, 136],
    tcurve: [[0, 1], [20, 1], [52, .96], [84, .9], [116, .84], [116.01, .8], [132, .77], [148, .74], [160, .74]],
    desc: 'ファゴットと低音がひそやかに始める同じ旋律を、楽器を増やしながらくり返し、だんだん速く、大きくしていく。テンポが上がっても縦の線を崩さずにいられるかが勝負。',
    asks: 'リズム・表現・バランス',
    focus: {pitch: .9, tone: 1, expr: 1.05, rhythm: 1.25, balance: 1.05},
    balRef: 10.8, ceiling: .96,
    spans: [{name: '前半（低音のささやき）', from: 0, to: 52}, {name: '中盤（だんだん大きく）', from: 52, to: 116}, {name: '最後（速く、全員で）', from: 116, to: 160}],
    slur: 'tongue',
    scale: [[0, [11, 1, 2, 4, 6, 7, 9]], [36, [6, 8, 10, 11, 1, 2, 4]], [52, [11, 1, 2, 4, 6, 7, 9]], [84, [6, 8, 10, 11, 1, 2, 4]], [116, [11, 1, 2, 4, 6, 7, 9]], [132, [6, 8, 10, 11, 1, 2, 4]], [148, [11, 1, 2, 4, 6, 7, 9]]],
    mel: [...line('F#3:4'), ...shift(oct(HALL_A, -1), 4), ...shift(HALL_A, 20), ...shift(oct(HALL_B, 1), 36), ...shift(oct(HALL_A, 1), 52), ...shift(oct(HALL_A, 2), 68),
          ...shift(oct(HALL_B, 2), 84), ...shift(oct(HALL_B, 3), 100), ...shift(oct(HALL_A, 3), 116), ...shift(oct(HALL_B, 3), 132), ...line("r:1 B5:.5'> r:2.5 | r:4 | r:1 B5:.5'> r:2.5", 148)],
    chords: [...chords('F#5:4'), ...chords(HALL_A_CH, 4), ...chords(HALL_A_CH, 20), ...chords(HALL_B_CH, 36), ...chords(HALL_A_CH, 52), ...chords(HALL_A_CH, 68),
             ...chords(HALL_B_CH, 84), ...chords(HALL_B_CH, 100), ...chords(HALL_A_CH, 116), ...chords(HALL_B_CH, 132), ...chords('B5:1 Bo7:3 | B5:4 | B5:1 Bm:3', 148)],
    bass: HALL_BASS,
    dyn: [[0,.26],[3.9,.22],[4,.2],[19.9,.22],[20,.24],[35.9,.26],[36,.3],[51.9,.34],[52,.4],[67.9,.46],[68,.52],[83.9,.6],[84,.66],[99.9,.74],[100,.8],[115.9,.86],[116,.95],[131.9,.97],[132,.98],[148,1],[152,.42],[154,.45],[155.9,.95],[156,1],[160,1]],
    rubato: [[0,1.2],[3.9,1.3],[4,1],[147,1],[148,1.05],[152,1.12],[156,1.1],[160,1.2]],
    groups: {
      hnS:  {n: 4, lo: 54, hi: 69, rh: 'ab'},
      tbS:  {n: 2, lo: 47, hi: 62, rh: 'ab'},
      tpS:  {n: 1, lo: 60, hi: 72, rh: 'ab'},
      cdHn: {n: 4, lo: 54, hi: 70, rh: HALL_HIT},
      cdTb: {n: 2, lo: 47, hi: 62, rh: HALL_HIT},
      cdW:  {n: 3, lo: 60, hi: 76, rh: HALL_HIT},
      cdTp: {n: 2, lo: 62, hi: 76, rh: HALL_HIT},
    },
    roles: {
      // 0〜4：ホルンのファ#　4〜20：ロから（いちばん低く）　20〜36：1オクターブ上　36〜52：Bの旋律
      // 52〜68：Aをさらに上で　68〜84：もう1オクターブ上　84〜116：Bの旋律を2回（2回目は高く）　116〜：速く、全員で
      fg:    [...melIn([4, 20, 0], [20, 36, 0], [36, 52, 0], [52, 68, -12], [68, 84, -24]), {f: 84, t: 116, r: 'bass', sh: 0}, {f: 116, t: 160, r: 'bass', sh: 12}],
      bcl:   [...melIn([4, 20, 0], [20, 36, 0], [36, 52, -12], [52, 68, -24]), {f: 68, t: 116, r: 'bass', sh: 0}, {f: 116, t: 160, r: 'bass', sh: 12}],
      cb:    [{f: 4, t: 84, r: 'bass', sh: 0, rh: 'pizz'}, {f: 84, t: 160, r: 'bass', sh: 0, rh: 'march'}],
      tuba:  [{f: 36, t: 52, r: 'bass', sh: 0, sc: .5}, {f: 52, t: 84, r: 'bass', sh: 0, sc: .65}, {f: 84, t: 160, r: 'bass', sh: 0}],
      bsax:  [{f: 52, t: 68, r: 'bass', sh: 12, sc: .6}, {f: 68, t: 116, r: 'bass', sh: 12}, {f: 116, t: 160, r: 'bass', sh: 12}],
      btb:   [{f: 84, t: 160, r: 'bass', sh: 0}],
      tsax:  [...melIn([20, 36, 0, .5], [36, 52, 0], [52, 68, -12], [68, 84, -24], [84, 100, -12], [100, 116, -24], [116, 132, -36], [132, 148, -24]), ...hallEnd('cdW', 2)],
      euph:  [...melIn([36, 52, 0, .6], [52, 68, -12, .7], [68, 84, -24, .8], [84, 100, -12], [100, 116, -24], [116, 132, -36], [132, 148, -24]), ...hallEnd('cdTb', 1)],
      cl1:   [...melIn([52, 68, 0], [68, 84, 0], [84, 100, 0], [100, 116, 0], [116, 132, -12], [132, 148, 0], [148, 160, 0])],
      cl2:   [...melIn([52, 68, 0], [68, 84, -12], [84, 100, -12], [100, 116, -12], [116, 132, -12], [132, 148, -12]), ...hallEnd('cdW', 0)],
      cl3:   [...melIn([36, 52, 0, .6], [52, 68, 0, .8], [68, 84, -12], [84, 100, -12], [100, 116, -24], [116, 132, -24], [132, 148, -24]), ...hallEnd('cdW', 1)],
      asax1: [...melIn([52, 68, 0], [68, 84, -12], [84, 100, 0], [100, 116, -12], [116, 132, -24], [132, 148, -12], [148, 160, -12])],
      asax2: [...melIn([52, 68, 0, .8], [68, 84, -12], [84, 100, -12], [100, 116, -12], [116, 132, -24], [132, 148, -12]), ...hallEnd('cdW', 2)],
      ob:    [...melIn([68, 84, 0, .8], [84, 100, 0], [100, 116, 0], [116, 132, -12], [132, 148, 0], [148, 160, 0])],
      fl1:   [...melIn([68, 84, 0], [84, 100, 12], [100, 116, 0], [116, 132, 0], [132, 148, 0], [148, 160, 0])],
      fl2:   [...melIn([68, 84, 0, .7], [84, 100, 0], [100, 116, -12], [116, 132, -12], [132, 148, -12], [148, 160, -12])],
      picc:  [...melIn([100, 116, 12, .7], [116, 132, 0], [132, 148, 12], [148, 160, 12])],
      ebcl:  [...melIn([84, 100, 12, .6], [100, 116, 0], [116, 132, -12], [132, 148, 0], [148, 160, 0])],
      tp1:   [...melIn([84, 100, -12, .75], [100, 116, -12], [116, 132, -12], [132, 148, -12], [148, 160, -12])],
      tp2:   [{f: 84, t: 100, r: 'pad', g: 'tpS', i: 0, sc: .7}, ...melIn([100, 116, -12, .85], [116, 132, -24], [132, 148, -24]), ...hallEnd('cdTp', 0)],
      tp3:   [{f: 100, t: 116, r: 'pad', g: 'tpS', i: 0}, ...melIn([116, 132, -24], [132, 148, -24]), ...hallEnd('cdTp', 1)],
      hn1:   [...melIn([0, 4, 12, .8]), {f: 52, t: 116, r: 'pad', g: 'hnS', i: 0}, ...melIn([116, 132, -36], [132, 148, -24]), ...hallEnd('cdHn', 0)],
      hn2:   [...melIn([0, 4, 0, .8]), {f: 52, t: 116, r: 'pad', g: 'hnS', i: 1}, ...melIn([116, 132, -36], [132, 148, -24]), ...hallEnd('cdHn', 1)],
      hn3:   [...melIn([0, 4, 12, .8]), {f: 52, t: 148, r: 'pad', g: 'hnS', i: 2}, ...hallEnd('cdHn', 2)],
      hn4:   [...melIn([0, 4, 0, .8]), {f: 52, t: 148, r: 'pad', g: 'hnS', i: 3}, ...hallEnd('cdHn', 3)],
      tb1:   [{f: 68, t: 100, r: 'pad', g: 'tbS', i: 0, sc: .55}, ...melIn([100, 116, -24], [116, 132, -36], [132, 148, -24]), ...hallEnd('cdTb', 0)],
      tb2:   [{f: 68, t: 116, r: 'pad', g: 'tbS', i: 1, sc: .55}, ...melIn([116, 132, -36], [132, 148, -36]), ...hallEnd('cdTb', 1)],
      perc4: [{f: 84, t: 112, r: 'mel', sh: 12, inst: 'xylo', sc: .35}],
    },
    perc: {
      perc1: [
        ...timpOn(HALL_BASS, each(52, 84, 1, b => [[b, b < 68 ? .22 : .3]])),
        ...timpOn(HALL_BASS, each(84, 116, 1, b => [[b, b % 4 ? (b < 100 ? .38 : .48) : (b < 100 ? .5 : .62)]])),
        ...timpOn(HALL_BASS, each(116, 148, 1, b => [[b, b % 4 ? .62 : .85]])),
        ...timpOn(HALL_BASS, [[148, .95]]),
        {i: 'timp', b: 154, d: 2, m: 47, roll: true, v: .4, v1: 1}, {i: 'timp', b: 156, m: 47, v: 1},
      ],
      perc2: [
        ...each(100, 116, 1, b => [{i: 'sd', b, v: b % 4 ? .28 : .38}]),
        ...each(116, 148, .5, b => [{i: 'sd', b, v: b % 1 ? .32 : b % 4 ? .45 : .6}]),
        ...hitsAt('sd', [[148, .85], [149, .95]]), {i: 'sd', b: 154, d: 2, roll: true, v: .3, v1: .95}, ...hitsAt('sd', [[156, 1], [157, 1]]),
      ],
      perc3: [
        ...each(84, 100, 4, b => [{i: 'bd', b, v: .35}]),
        ...each(100, 116, 2, b => [{i: 'bd', b, v: b % 4 ? .38 : .48}]),
        ...each(116, 148, 1, b => [{i: 'bd', b, v: b % 4 ? .5 : .68}]),
        ...hitsAt('bd', [[148, 1]]), {i: 'bd', b: 154, d: 2, roll: true, v: .3, v1: .9}, ...hitsAt('bd', [[156, 1], [157, .7]]),
      ],
      perc4: [
        {i: 'sus', b: 112, d: 4, roll: true, v: .1, v1: .75},
        {i: 'cym', b: 116, v: 1}, ...each(120, 132, 4, b => [{i: 'cym', b, v: .55}]),
        ...each(132, 148, 2, b => [{i: 'cym', b, v: b % 4 ? .5 : .75}]),
        ...hitsAt('cym', [[149, 1], [157, 1]]),
      ],
    },
  },
};
const PIECE_IDS = ['largo', 'ode', 'stars', 'jupiter', 'mountain'];
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
