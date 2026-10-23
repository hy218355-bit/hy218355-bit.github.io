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
// "E4:1.5 G4:.5 | r:1" → [{m, b, d}]（拍単位、":"がなければ1拍）。末尾の ' はスタッカート、> はアクセント、
// ~ はトリル（その調の1つ上の音と交互に）、* はトレモロ（同じ音をすばやくくり返す）。頭の (A5) は前打音（(A5,B5) で2つ）
function line(src, from = 0){
  const out = [];
  let b = from;
  for(const tok of src.split(/\s+/)){
    if(!tok || tok === '|') continue;
    const mk = /^(?:\(([^)]+)\))?([^:'>~*()]+)(?::([\d.]+))?(['>~*]*)$/.exec(tok);
    if(!mk) throw new Error('音符が読めません: ' + tok);
    const d = mk[3] ? +mk[3] : 1;
    if(mk[2] !== 'r'){
      const e = {m: nn(mk[2]), b, d};
      if(mk[4].includes("'")) e.st = true;
      if(mk[4].includes('>')) e.acc = true;
      if(mk[4].includes('~')) e.tr = true;
      if(mk[4].includes('*')) e.trem = true;
      if(mk[1]) e.gr = mk[1].split(',').map(nn);
      out.push(e);
    }
    b += d;
  }
  return out;
}
// 装飾音（前打音・トリル・トレモロ）を、音の高さを sh だけ移して写す
const ornOf = (e, sh = 0) => ({...(e.gr ? {gr: e.gr.map(g => g + sh)} : {}), ...(e.tr ? {tr: true} : {}), ...(e.trem ? {trem: true} : {})});
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

// 低音の「ズン・チャッ」：'G2 D3' は、1小節に8分音符の低音を2つ（そのあいだに伴奏の和音が入る）
const oom = (...bars) => bars.map(b => b.includes(':') ? b : b.split(' ').map(n => n + ':.25 r:.25').join(' ')).join(' | ');

// チェロのピチカート：根音と、その4度下（5度）を4分音符で交互に
const altBass = (chs, from, to) => {
  const out = [];
  for(const c of chs){
    const r = 45 + ((c.root - 45) % 12 + 12) % 12;
    for(let b = Math.max(c.b, from), k = 0; b < Math.min(c.b + c.d, to) - 1e-6; b += .5, k++) out.push({m: k % 2 ? r - 5 : r, b, d: .5, st: true});
  }
  return out;
};

/* ===== 曲 =====
   1曲ずつ js/pieces/<曲>.js に書き、addPiece で登録する（index.html で読み込んだ順が、曲を選ぶ画面の順になる）。
   曲のファイルの中身は { } で囲み、曲ごとの名前がほかの曲とぶつからないようにする */
const PIECES = {};
const PIECE_IDS = [];
function addPiece(pc){ PIECES[pc.id] = pc; PIECE_IDS.push(pc.id); }
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
          push(part, {...base, m: m0 + sg.sh, b: e.b, d: e.d, ji: jiOf(m0 + sg.sh, c), ...marks(e), ...ornOf(e, m0 + sg.sh - e.m)});
        }
      } else if(sg.r === 'cm'){
        // 対旋律：line があれば pc.lines の中のその線（パートごとに別の線を吹ける）
        for(const e of (sg.line ? pc.lines[sg.line] : pc.cm).filter(e => inRange(e, sg))){
          const c = chordAt(pc, e.b);
          push(part, {...base, m: e.m + sg.sh, b: e.b, d: e.d, ji: jiOf(e.m, c), ...marks(e), ...ornOf(e, sg.sh)});
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
        // 低音：line があれば pc.lines の中のその線（根音と5度を交互に刻む線など）。rh は march（短く）、pizz、half（2分音符にのばす）
        const evs = (sg.line ? pc.lines[sg.line] : pc.bass).filter(e => inRange(e, sg));
        for(const e of evs){
          const c = chordAt(pc, e.b);
          const m = e.m + sg.sh;
          if(sg.rh === 'march') push(part, {...base, m, b: e.b, d: Math.min(e.d, .8), ji: jiOf(e.m, c), art: e.st ? 'stac' : 'norm', ...(e.acc ? {acc: true} : {})});
          else if(sg.rh === 'half') push(part, {...base, m, b: e.b, d: 1, ji: jiOf(e.m, c), art: 'norm', ...(e.acc ? {acc: true} : {})});
          else if(sg.rh === 'pizz') push(part, {...base, m, b: e.b, d: 1, ji: jiOf(e.m, c), inst: 'cbpizz', kind: 'hit'});
          else push(part, {...base, m, b: e.b, d: e.d, ji: jiOf(e.m, c), ...marks(e), ...ornOf(e, sg.sh)});
        }
      }
    }
  }
  for(const [part, evs] of Object.entries(pc.perc)){
    for(const e of evs) push(part, {role: 'hit', sc: 1, kind: 'hit', inst: e.i, m: e.m, b: e.b, d: e.d || 0, v: e.v, v1: e.v1, roll: !!e.roll, ji: 0});
  }
  // 打楽器パートの鍵盤（ロール指定の旋律）も打つ音として扱う
  for(const evs of Object.values(parts)) for(const e of evs) if(e.inst && e.inst !== 'cbpizz' && e.role !== 'hit') e.kind = 'hit';

  for(const [part, evs] of Object.entries(parts)) finishPart(pc, part, evs);
  return (ARR[pid] = {parts, pc});
}
// 1パートぶんの仕上げ：楽器の音域に収め（はみ出したらオクターブで移す）、つなぎ方を決める
function finishPart(pc, part, evs){
  evs.sort((a, b) => a.b - b.b);
  for(const e of evs){
    if(e.m == null) continue;
    const inst = INST[e.inst || PART_INST[part]];
    if(!inst || !inst.range) continue;
    const s = e.m + pc.trans;
    const mv = s < inst.range[0] ? 12 * Math.ceil((inst.range[0] - s) / 12) : s > inst.range[1] ? -12 * Math.ceil((s - inst.range[1]) / 12) : 0;
    if(mv){ e.m += mv; if(e.gr) e.gr = e.gr.map(g => g + mv); }
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
  return evs;
}

/* ===== 人数が少ない部の編曲 =====
   小節ごとに、旋律・低音・和音（内声）を吹く人がいるかを見る。誰もいなければ、いる人の中から向いている人が持ち替えて吹く
   （持ち替えた小節では、その人の本来の楽譜は吹かない）。オクターブは曲全体で人ごとに1つに決め、はみ出す音だけ移す。
   全員そろっていれば、何も変わらない。 */
const MEL_PREF = ['tp', 'cl', 'asax', 'fl', 'ob', 'ebcl', 'euph', 'picc', 'tsax', 'hn', 'tb', 'bcl', 'fg', 'bsax', 'btb', 'tuba', 'cb'];
const HARM_ROLES = new Set(['pad', 'mel3', 'cm']);
const RED = {};
function reduction(pid, present){
  const key = pid + ':' + [...present].sort().join(',');
  if(RED[key]) return RED[key];
  const {parts, pc} = arrangement(pid);
  const M = pc.meter, nBars = Math.ceil(pc.beats / M - 1e-6);
  const barOf = b => Math.floor(b / M + 1e-6);
  const bars = () => Array.from({length: nBars}, () => []);
  // 小節ごとに、その小節で始まる音が旋律・低音・和音のどれを受け持っているか
  const roleOf = e => e.m == null ? null : e.role === 'mel' || e.solo ? 'mel' : e.role === 'bass' ? 'bass' : HARM_ROLES.has(e.role) ? 'harm' : null;
  const rolesIn = list => {
    const r = Array.from({length: nBars}, () => ({mel: false, bass: false, harm: false}));
    for(const e of list){ const k = roleOf(e), x = r[barOf(e.b)]; if(k && x) x[k] = true; }
    return r;
  };
  const need = rolesIn(Object.values(parts).flat());
  const own = Object.fromEntries([...present].map(p => [p, rolesIn(parts[p] || [])]));
  // ソロの代わり（fb）：担当のいないパートのソロは、決められた代わりのパートが吹く
  const fbBy = bars();
  for(const [part, evs] of Object.entries(parts)){
    if(present.has(part)) continue;
    for(const e of evs){
      const alt = e.fb && e.fb.find(q => present.has(q));
      if(alt) fbBy[barOf(e.b)]?.push([alt, e]);
    }
  }
  const instOfPart = p => INST[PART_INST[p]];
  const wind = [...present].filter(p => instOfPart(p) && instOfPart(p).sec !== 'perc').sort();
  const median = xs => { const v = xs.slice().sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : 60; };
  const melMed = median(pc.mel.map(e => e.m)) + pc.trans, bassMed = median(pc.bass.map(e => e.m)) + pc.trans;
  // 代わりに吹く音の高さ：もとの高さのまま楽器の吹きやすい音域に入るなら移さず、入らないときだけオクターブで近い方へ移す
  const shiftTo = (p, med, lo, hi) => {
    const r = instOfPart(p).range;
    for(const sh of [0, 12, -12, 24, -24]) if(med + sh >= r[0] + lo && med + sh <= r[1] - hi) return sh;
    return 12 * Math.round((instOfPart(p).center - med) / 12);
  };
  const melBy = bars(), bassBy = bars();
  for(const e of pc.mel) melBy[barOf(e.b)]?.push(e);
  for(const e of pc.bass) bassBy[barOf(e.b)]?.push(e);
  const marks = e => ({...(e.st ? {art: 'stac'} : {}), ...(e.acc ? {acc: true} : {})});
  const take = {};   // part → {小節: 代わりに吹く音}
  const miss = {mel: [], bass: []};
  for(let bar = 0; bar < nBars; bar++){
    const busy = new Set(), got = {mel: false, bass: false, harm: false};
    const give = (p, evs) => {
      ((take[p] ||= {})[bar] ||= []).push(...evs);
      busy.add(p);
      for(const e of evs){ const k = roleOf(e); if(k) got[k] = true; }
    };
    for(const [alt, e] of fbBy[bar]) give(alt, [e]);
    const has = k => got[k] || [...present].some(p => !busy.has(p) && own[p][bar][k]);
    // 旋律を何人もで重ねているときは、いちばん旋律に向いた人だけ残して、ほかの人は低音や和音に回れる
    const byPref = (a, b) => MEL_PREF.indexOf(PART_INST[a]) - MEL_PREF.indexOf(PART_INST[b]);
    const lead = () => got.mel ? null : wind.filter(p => !busy.has(p) && own[p][bar].mel).sort(byPref)[0];
    const free = p => !busy.has(p) && !own[p][bar].bass && (!own[p][bar].mel || (has('mel') && p !== lead()));
    if(need[bar].mel && !has('mel')){
      const p = wind.filter(q => !busy.has(q)).sort(byPref)[0];
      if(p){
        const sh = shiftTo(p, melMed, 6, 4);
        give(p, melBy[bar].map(e => ({role: 'mel', sc: ROLE_SCALE.mel, m: e.m + sh, b: e.b, d: e.d, ji: jiOf(e.m + sh, chordAt(pc, e.b)), ...marks(e), ...ornOf(e, sh)})));
      } else miss.mel.push(bar * M);
    }
    if(need[bar].bass && !has('bass')){
      const p = wind.filter(free).sort((a, b) => instOfPart(a).center - instOfPart(b).center)[0];
      if(p){
        const sh = shiftTo(p, bassMed, 2, 8);
        give(p, bassBy[bar].map(e => ({role: 'bass', sc: ROLE_SCALE.bass, m: e.m + sh, b: e.b, d: e.d, ji: jiOf(e.m, chordAt(pc, e.b)), ...marks(e), ...ornOf(e, sh)})));
      } else if(!wind.length) miss.bass.push(bar * M);
    }
    if(need[bar].harm && !has('harm') && wind.length >= 3){
      const p = wind.filter(free).sort((a, b) => Math.abs(instOfPart(a).center - 62) - Math.abs(instOfPart(b).center - 62))[0];
      if(p){
        const center = instOfPart(p).center - pc.trans, sh = shiftTo(p, melMed - 4, 6, 4);
        give(p, melBy[bar].length
          ? melBy[bar].map(e => { const c = chordAt(pc, e.b), m = thirdBelow(e.m, c, sectionAt(pc.scale, e.b, SCALE)) + sh;
            return {role: 'mel3', sc: ROLE_SCALE.mel3 * .8, m, b: e.b, d: e.d, ji: jiOf(m, c), ...marks(e)}; })
          : clipChords(pc, bar * M, (bar + 1) * M).map(c => {
            const tone = (c.root + (HAS_THIRD[c.q] ?? 7)) % 12, m = Math.round((center - tone) / 12) * 12 + tone;
            return {role: 'pad', sc: ROLE_SCALE.pad, m, b: c.b, d: c.d, ji: jiOf(m, c)};
          }));
      }
    }
  }
  const out = {};
  for(const p of present){
    const tk = take[p];
    if(!tk){ out[p] = parts[p] || []; continue; }
    const keep = [];
    for(const e of parts[p] || []){
      const bar = barOf(e.b);
      if(tk[bar]) continue;
      // 持ち替える小節にかかる長い音は、その手前で切る
      let cut = null;
      for(let k = bar + 1; k <= barOf(e.b + e.d - 1e-6); k++) if(tk[k]){ cut = k * M; break; }
      keep.push({...e, leg: false, ...(cut != null ? {d: cut - e.b} : {})});
    }
    const evs = [...keep, ...Object.values(tk).flat().map(e => ({...e, leg: false, sub: true}))].sort((a, b) => a.b - b.b);
    // 一人で吹くので、次の音にかかる音はその手前で切る
    for(let i = 0; i < evs.length - 1; i++) if(evs[i + 1].b < evs[i].b + evs[i].d - 1e-6) evs[i].d = Math.max(.125, evs[i + 1].b - evs[i].b);
    out[p] = finishPart(pc, p, evs);
  }
  return (RED[key] = {parts: out, miss});
}
