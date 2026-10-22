'use strict';
/* 1年間の流れ：選曲 → 4月〜8月の練習と演奏会 → 県大会 →（代表なら）支部大会 → 全国大会 → 3年生の引退 → 次の年度 */

const SAVE_KEY = 'suibu-nisshi-v2';
const PREF_WEEK = 16, BLOCK_WEEK = 20, NATIONAL_WEEK = 26;

const MENU = [
  {id: 'long',   name: 'ロングトーン',           hint: '音色↑↑　音程↑',               cost: 14, gain: {tone: 20, pitch: 5}},
  {id: 'tune',   name: 'チューニング練習',       hint: '音程↑↑',                       cost: 12, gain: {pitch: 20, tone: 3}},
  {id: 'harm',   name: 'ハーモニー練習',         hint: '音程↑　音色↑　まとまり↑',      cost: 14, gain: {pitch: 12, tone: 8}, coh: 5},
  {id: 'metro',  name: 'メトロノーム基礎合奏',   hint: 'リズム↑↑　まとまり↑',          cost: 14, gain: {rhythm: 20, pitch: 3}, coh: 3},
  {id: 'phrase', name: '歌ってからフレーズ練習', hint: '表現↑↑　仕上がり↑（基礎が要る）', cost: 12, gain: {expr: 22}, basics: true, fam: 12},
  {id: 'tutti',  name: '合奏',                   hint: '全部↑　まとまり↑↑　仕上がり↑↑', cost: 18, gain: {pitch: 5, rhythm: 6, tone: 5, expr: 6}, coh: 9, fam: 16, morale: 5},
  {id: 'hall',   name: '本番の会場を借りて練習', hint: '会場慣れ↑↑　まとまり↑',        cost: 16, gain: {pitch: 3, rhythm: 3, tone: 3, expr: 3}, coh: 5, fam: 6, hallExp: 45, morale: 3, from: 12},
  {id: 'rest',   name: 'オフにする',             hint: '体力とやる気が回復',            cost: -38, gain: {}, morale: 12},
];
const MENU_BY = Object.fromEntries(MENU.map(m => [m.id, m]));

const EVENTS = {
  1:  {kind: 'concert', id: 'shinkan', title: '新入生歓迎演奏', venue: 'gym', nerves: 3,
       text: '体育館で部活動紹介の演奏をする。演奏の出来しだいで、入部する1年生の数が変わる。'},
  2:  {kind: 'mod', title: '仮入部', morale: 6, text: '1年生が音楽室をのぞきに来た。先輩としての自覚で、やる気が上がった。'},
  3:  {kind: 'assign', title: '本入部・楽器決め', text: '1年生が正式に入部した。担当する楽器を決めよう。希望どおりだとやる気が上がる。'},
  4:  {kind: 'mod', title: 'GW一日練習', mult: 1.5, costMult: 1.25, text: '朝から夕方まで練習できる。練習の効果が1.5倍、体力の消費も増える。'},
  6:  {kind: 'concert', id: 'matsuri', title: 'みなと祭りステージ', venue: 'outdoor', nerves: 2,
       text: '商店街のお祭りで、屋外ステージに出演する。響きがないので、ごまかしがきかない。'},
  7:  {kind: 'forced', title: '中間テスト', text: 'テスト期間で部活は停止。練習はできないが、体力は戻る。'},
  10: {kind: 'mod', title: 'パート内のもめごと', morale: -12, text: '誰が1stを吹くかで、トランペットパートがぎくしゃくしている。やる気が下がった。'},
  11: {kind: 'concert', id: 'joint', title: '合同演奏会', venue: 'civic', nerves: 4,
       text: '市民会館で近くの高校と合同演奏会。よその学校の先生が講評をくれる。'},
  13: {kind: 'mod', title: '夏合宿', mult: 1.6, costMult: 1.3, venue: 'camp', text: '合宿所のホールで朝から晩まで合奏。練習の効果が1.6倍、体力の消費も1.3倍。'},
  14: {kind: 'mod', title: '夏合宿・後半', mult: 1.6, costMult: 1.3, venue: 'camp', text: '合宿の後半。疲れはたまるが、音はまとまってくる。'},
  [PREF_WEEK]:     {kind: 'contest', level: 'pref', title: '吹奏楽コンクール 県大会', venue: 'hall', nerves: 5},
  [BLOCK_WEEK]:    {kind: 'contest', level: 'block', title: '吹奏楽コンクール 支部大会', venue: 'grand', nerves: 8},
  [NATIONAL_WEEK]: {kind: 'contest', level: 'national', title: '全日本吹奏楽コンクール', venue: 'grand', nerves: 10},
};
const MILESTONES = [
  {k: 'tone',   at: 40, text: '音の出だしが安定してきた。音が裏返ることが減った。'},
  {k: 'pitch',  at: 50, text: 'ユニゾンのうなりがゆっくりになってきた。'},
  {k: 'rhythm', at: 50, text: '長い音を最後まで伸ばせるようになってきた。'},
  {k: 'expr',   at: 40, text: 'フレーズの山をどこに作るか、みんなで話し合うようになった。'},
  {k: 'pitch',  at: 72, text: 'ハーモニー練習で、和音がふっと「鳴った」。第3音を少し低めに取ると響くらしい。'},
  {k: 'rhythm', at: 75, text: 'テンポが走らなくなった。縦の線がそろってきた。'},
  {k: 'tone',   at: 75, text: '柔らかくて芯のある音になってきた。'},
  {k: 'expr',   at: 75, text: '指揮を見なくても、全員で自然にテンポを揺らせるようになった。'},
];

const wkMonth = w => 4 + Math.floor(w / 4);
const wkLabel = w => `${wkMonth(w)}月 第${w % 4 + 1}週`;
const wkShort = w => `${wkMonth(w)}月${w % 4 + 1}週`;

const freshFam = () => Object.fromEntries(PIECE_IDS.map(id => [id, 0]));
function freshState(year = 2026){
  const s = {
    v: 2, year, week: 0, phase: 'choose', pieceId: null, interp: {tempo: 1, dyn: 1, rub: 1},
    members: initialRoster(year), recruits: null,
    cohesion: 25, stamina: 100, morale: 70, fam: freshFam(), hallExp: 0, focus: null,
    log: [], recs: [], history: [], season: [], flags: {}, pending: null, lastDelta: {},
  };
  addLog(s, `${year}年度がはじまった。部員は${s.members.length}人。まずはコンクールの自由曲を決めよう。`);
  return s;
}
function addLog(s, text){ s.log.push({y: s.year, w: s.week, text}); if(s.log.length > 160) s.log.splice(0, s.log.length - 160); }

const seated = s => s.members.filter(m => m.seat);
const bandAvg = (s, k) => { const ms = seated(s); return ms.length ? ms.reduce((a, m) => a + m.stats[k], 0) / ms.length : 0; };
const secMembers = (s, secId) => seated(s).filter(m => SEAT[m.seat].sec === secId);
const fatigueOf = s => s.stamina < 30 ? 8 : s.stamina < 50 ? 3 : 0;
function nervesFor(s, ev){
  let n = ev?.nerves ?? 0;
  n *= s.morale < 45 ? 1.6 : s.morale < 65 ? 1.2 : 0.8;
  if(VENUE[ev?.venue]?.play.hall) n *= 1.3 - 0.6 * clamp01(s.hallExp / 100);
  return Math.round(n * 10) / 10;
}
function perfCtx(s, o = {}){
  const pid = o.pieceId || s.pieceId || 'largo';
  return {
    members: o.members || seated(s), pieceId: pid, cohesion: o.cohesion ?? s.cohesion, fam: o.fam ?? s.fam[pid] ?? 0,
    interp: o.interp || s.interp, venue: o.venue || 'room', nerves: o.nerves || 0, fatigue: o.fatigue ?? fatigueOf(s),
    seed: 'band', from: o.from, to: o.to,
  };
}
function snapshot(s, extra = {}){
  return {
    members: seated(s).map(m => ({id: m.id, name: m.name, grade: m.grade, seat: m.seat, trait: m.trait, stats: {...m.stats}})),
    cohesion: s.cohesion, fam: s.fam[extra.pieceId || s.pieceId] ?? 0, interp: {...s.interp}, fatigue: fatigueOf(s), ...extra,
  };
}
function addRec(s, label, extra){
  const rec = {id: `r${s.year}-${s.week}-${s.recs.length}-${Math.floor(hash(label, s.log.length) * 1e6)}`, label, year: s.year, week: s.week,
    pieceId: extra.pieceId || s.pieceId, venue: extra.venue || 'room', snap: snapshot(s, extra), result: extra.result || null};
  s.recs.push(rec);
  const keep = s.recs.filter(r => r.keep);
  if(s.recs.length > 18) s.recs = [...keep, ...s.recs.filter(r => !r.keep).slice(-(18 - keep.length))];
  return rec;
}
const recCtx = rec => ({
  members: rec.snap.members, pieceId: rec.pieceId, cohesion: rec.snap.cohesion, fam: rec.snap.fam, interp: rec.snap.interp,
  venue: rec.venue, nerves: rec.snap.nerves || 0, fatigue: rec.snap.fatigue || 0, seed: 'band',
});

function choosePiece(s0, pid){
  const s = clone(s0);
  s.pieceId = pid; s.phase = 'week';
  addLog(s, `自由曲は${PIECES[pid].full}に決まった。最初の合奏を録音した。`);
  const rec = addRec(s, `${s.year}年4月の録音`, {pieceId: pid, venue: 'room'});
  rec.keep = true;
  return s;
}
function clone(s){ return JSON.parse(JSON.stringify(s)); }

/* ===== 練習 ===== */
function practiceWeek(s0, id){
  const s = clone(s0);
  const ev = EVENTS[s.week] || {};
  if(id === 'test'){
    s.stamina += 30; s.morale += 2; s.lastDelta = {};
    for(const m of seated(s)) m.stats.pitch = Math.max(0, m.stats.pitch - 1);
    addLog(s, 'テスト期間。楽器に触れない日が続いて、少し音程の感覚が鈍った。');
  } else {
    const m = MENU_BY[id];
    const tired = s.stamina < 30;
    const eff = (0.6 + 0.4 * s.morale / 100) * (tired ? 0.5 : 1) * (ev.mult || 1);
    const sum = {}, cnt = {};
    for(const mem of seated(s)){
      const sec = SEAT[mem.seat].sec;
      const focus = s.focus && s.focus === sec ? 1.6 : s.focus ? 0.92 : 1;
      const basics = (mem.stats.pitch + mem.stats.rhythm + mem.stats.tone) / 300;
      for(const [k, g] of Object.entries(m.gain)){
        let x = 1.25 * g * eff * focus * (1 - mem.stats[k] / 190) * (0.85 + 0.3 * hash(mem.id, s.year, s.week, id, k)) * (mem.grade === 1 ? 1.15 : 1);
        if(m.basics) x *= clamp((basics - 0.1) / 0.5, 0.1, 1);
        const before = mem.stats[k];
        mem.stats[k] = Math.round(clamp(before + x, 0, 100) * 10) / 10;
        sum[k] = (sum[k] || 0) + (mem.stats[k] - before); cnt[k] = (cnt[k] || 0) + 1;
      }
    }
    s.lastDelta = {};
    for(const k of Object.keys(sum)) s.lastDelta[k] = Math.round(sum[k] / cnt[k] * 10) / 10;
    if(m.coh){ const d = m.coh * eff * (1 - s.cohesion / 150); s.cohesion = clamp(s.cohesion + d, 0, 100); s.lastDelta.coh = Math.round(d * 10) / 10; }
    if(s.pieceId){
      const df = ((m.fam || 0) * eff + (id === 'rest' ? 0 : 4)) * (1 - s.fam[s.pieceId] / 130);
      s.fam[s.pieceId] = clamp(s.fam[s.pieceId] + df, 0, 100);
      s.lastDelta.fam = Math.round(df * 10) / 10;
    }
    if(m.hallExp) s.hallExp = clamp(s.hallExp + m.hallExp, 0, 100);
    s.stamina -= m.cost > 0 ? m.cost * (ev.costMult || 1) : m.cost;
    s.morale += (m.morale || 0) - (id === 'rest' ? 0 : tired ? 8 : 3);
    const focusTxt = s.focus && id !== 'rest' ? `（${SEC[s.focus].name}を重点的に）` : '';
    const gains = Object.entries(s.lastDelta).filter(([k, v]) => v > 0 && STAT_LABEL[k]).map(([k, v]) => `${STAT_LABEL[k]}+${v.toFixed(1)}`).join('　');
    addLog(s, id === 'rest' ? 'オフ。しっかり休んだ。' : `${m.name}${focusTxt}。部の平均 ${gains || '変化なし'}`);
    if(tired && id !== 'rest') addLog(s, '疲れがたまっていて、身が入らなかった。');
    if(m.basics){
      const low = seated(s).filter(x => (x.stats.pitch + x.stats.rhythm + x.stats.tone) / 300 < 0.35).length;
      if(low > seated(s).length / 2) addLog(s, '歌ってはみたけれど、楽器を持つと音程とリズムで手一杯な部員が多い。基礎がもう少し要りそうだ。');
    }
    for(const ms of MILESTONES){
      const f = `${s.year}:${ms.k}${ms.at}`;
      if(!s.flags[f] && bandAvg(s, ms.k) >= ms.at){ s.flags[f] = true; addLog(s, ms.text); }
    }
  }
  return nextWeek(s);
}
function nextWeek(s){
  s.stamina = clamp(s.stamina + 6, 0, 100);
  s.morale = clamp(s.morale, 0, 100);
  s.hallExp = Math.max(0, s.hallExp - 4);
  s.week++;
  s.pending = null;
  const ev = EVENTS[s.week];
  if(ev){
    if(ev.morale) s.morale = clamp(s.morale + ev.morale, 0, 100);
    if(ev.kind !== 'contest') addLog(s, `【${ev.title}】${ev.text}`);
    else addLog(s, `いよいよ${ev.title}の週。`);
    if(ev.kind === 'assign') s.recruits = s.recruits || makeRecruits(s, 9);
  }
  return s;
}

/* ===== 演奏会・コンクール ===== */
// 本番を始めるときの条件をそろえて記録する（音は画面側で鳴らす）
function beginStage(s0){
  const s = clone(s0);
  const ev = EVENTS[s.week];
  const nerves = nervesFor(s, ev);
  const rec = addRec(s, `${s.year} ${ev.title}`, {venue: ev.venue, nerves});
  rec.keep = ev.kind === 'contest';
  const perf = perform(recCtx(rec));
  stageResult(s, ev, rec, perf, nerves);
  return s;
}
function stageResult(s, ev, rec, perf, nerves){
  const a = analyze(perf);
  if(ev.kind === 'contest'){
    const j = judge(perf, a, ev.level);
    rec.result = {award: j.award, rep: j.rep, avg: j.avg};
    s.pending = {kind: 'contest', recId: rec.id, judge: j, nerves, revealed: false};
  } else {
    const q = quality(a);
    s.pending = {kind: 'concert', recId: rec.id, q, nerves, revealed: false, ...concertOutcome(s, ev, q, perf, a)};
  }
}
// 本番を自分で指揮したとき：その拍の進み方で演奏し直したものを採点する
function conductStage(s0, conduct){
  const s = clone(s0);
  const ev = EVENTS[s.week], p = s.pending;
  const rec = s.recs.find(r => r.id === p.recId);
  rec.conduct = conduct;
  const perf = warpPerf(perform(recCtx(rec)), BeatClock.fromSaved(conduct.ev, 0));
  stageResult(s, ev, rec, perf, p.nerves);
  s.pending.conducted = {bpm: conduct.bpm, stab: conduct.stab};
  return s;
}
function concertOutcome(s, ev, q, perf, a){
  if(ev.id === 'shinkan'){
    const empty = SEATS.filter(x => !s.members.some(m => m.seat === x.id)).length;
    const n = clamp(Math.round(empty * (0.5 + 0.5 * q / 100)) + (s.morale > 70 ? 1 : 0), 5, Math.max(5, empty + 1));
    return {recruits: n, text: q >= 60 ? `演奏が終わると大きな拍手が起きた。${n}人の1年生が入部を考えてくれているらしい。`
      : q >= 35 ? `拍手はまばらだったが、${n}人の1年生が興味を持ってくれたようだ。` : `体育館の響きにのまれて、何をやっているのか伝わらなかった。それでも${n}人の1年生が見学に来てくれそうだ。`};
  }
  if(ev.id === 'matsuri'){
    const dm = Math.round(q / 10) - 2;
    return {morale: dm, text: q >= 60 ? '商店街の人たちが手拍子をしてくれた。みんな笑顔で帰ってきた。' : q >= 35 ? 'お客さんは足を止めて聴いてくれた。屋外の難しさも知った。' : '響きのない屋外で、自分たちの粗がまる聞こえだった。'};
  }
  const j = judge(perf, a, 'pref');
  const dm = Math.round(q / 12) - 2;
  return {morale: dm, text: `よその学校の先生から講評をもらった。「${j.judges[0].comment}」`};
}
function finishStage(s0){
  const s = clone(s0);
  const p = s.pending;
  const ev = EVENTS[s.week];
  if(!p) return s;
  if(p.kind === 'concert'){
    if(p.recruits) s.recruits = makeRecruits(s, p.recruits);
    if(p.morale) s.morale = clamp(s.morale + p.morale, 0, 100);
    addLog(s, `${ev.title}：${p.text}`);
    s.stamina = clamp(s.stamina - 8, 0, 100);
    return nextWeek(s);
  }
  const j = p.judge;
  const L = LEVELS[ev.level];
  const nm = {gold: '金賞', silver: '銀賞', bronze: '銅賞'}[j.award];
  s.season.push({level: ev.level, award: j.award, rep: j.rep, avg: Math.round(j.avg * 10) / 10});
  addLog(s, `${L.name}の結果は${nm}${j.rep ? `。${L.rep}への代表に選ばれた！` : j.award === 'gold' && L.rep ? '。代表には届かなかった。' : '。'}`);
  if(j.rep){
    s.morale = clamp(s.morale + 10, 0, 100);
    return nextWeek(s);
  }
  return endSeason(s);
}
function endSeason(s){
  s.phase = 'end';
  s.pending = null;
  const seniors = s.members.filter(m => m.grade === 3);
  addLog(s, `コンクールが終わり、3年生${seniors.length}人が引退した。`);
  return s;
}
function newYear(s0){
  const s = clone(s0);
  const pieceTitle = s.pieceId ? PIECES[s.pieceId].title : '';
  s.history.push({year: s.year, piece: pieceTitle, results: s.season});
  s.members = s.members.filter(m => m.grade < 3).map(m => ({...m, grade: m.grade + 1}));
  assignTitles(s.members);
  s.year++; s.week = 0; s.phase = 'choose'; s.pieceId = null; s.season = []; s.pending = null; s.recruits = null;
  s.cohesion = Math.round(s.cohesion * 0.6); s.fam = freshFam(); s.stamina = 100; s.morale = 70; s.hallExp = 0; s.focus = null; s.lastDelta = {};
  for(const m of s.members) for(const k of STAT_KEYS) m.stats[k] = Math.round(Math.max(0, m.stats[k] - 2) * 10) / 10;
  addLog(s, `${s.year}年度がはじまった。部員は${s.members.length}人。自由曲を決めよう。`);
  return s;
}

/* ===== 1年生と楽器決め ===== */
function makeRecruits(s, n){
  const used = new Set(s.members.map(m => m.name));
  const empty = SEATS.filter(x => !s.members.some(m => m.seat === x.id));
  const insts = [...new Set(empty.map(x => x.inst))];
  const all = Object.keys(PART_INST).map(p => PART_INST[p]).filter((v, i, a) => a.indexOf(v) === i);
  const out = [];
  for(let i = 0; i < n; i++){
    const seed = ['recruit', s.year, i];
    const exp = hash(...seed, 'exp') < 0.35;
    const pool = hash(...seed, 'pool') < 0.75 && insts.length ? insts : all;
    const hope = pool[Math.floor(hash(...seed, 'hope') * pool.length)];
    out.push({id: `m${s.year}-n${i}`, name: makeName(used, ...seed), hope, exp, trait: pickTrait(...seed)});
  }
  return out;
}
function autoAssign(s){
  const free = FILL_ORDER.filter(id => !s.members.some(m => m.seat === id));
  const map = {};
  for(const r of s.recruits || []){
    const want = free.find(id => SEAT[id].inst === r.hope && !Object.values(map).includes(id));
    if(want) map[r.id] = want;
  }
  for(const r of s.recruits || []){
    if(map[r.id]) continue;
    const id = free.find(x => !Object.values(map).includes(x));
    map[r.id] = id || null;
  }
  return map;
}
function assignRecruits(s0, map){
  const s = clone(s0);
  let happy = 0;
  for(const r of s.recruits || []){
    const seat = map[r.id] || null;
    const match = seat && SEAT[seat].inst === r.hope;
    if(match) happy++;
    const base = r.exp && match ? 26 : r.exp ? 14 : 6;
    s.members.push({id: r.id, name: r.name, grade: 1, seat, trait: r.trait, joined: s.year,
      stats: makeStats(base, r.exp ? 5 : 3, 'stat', r.id), hope: r.hope});
  }
  const n = (s.recruits || []).length;
  s.morale = clamp(s.morale + happy * 1.5 - (n - happy), 0, 100);
  s.cohesion = clamp(s.cohesion - n * 0.8, 0, 100);
  addLog(s, `1年生${n}人の担当が決まった。希望どおりの楽器になったのは${happy}人。`);
  s.recruits = null;
  assignTitles(s.members);
  return s;
}
function moveMember(s0, memberId, seatId){
  const s = clone(s0);
  const m = s.members.find(x => x.id === memberId);
  if(!m || m.seat === seatId) return s;
  const other = seatId ? s.members.find(x => x.seat === seatId) : null;
  const old = m.seat;
  // 楽器が変わると、新しい楽器の音程と音色は基礎からやり直し
  const retrain = (x, from, to) => {
    if(from && to && SEAT[from].inst !== SEAT[to].inst) for(const k of ['tone', 'pitch']) x.stats[k] = Math.round(x.stats[k] * 0.6 * 10) / 10;
  };
  if(other){ other.seat = old; retrain(other, seatId, old); }
  m.seat = seatId; retrain(m, old, seatId);
  addLog(s, `${m.name}の席を${seatId ? PART_LABEL[SEAT[seatId].part] : '控え'}に移した。`);
  return s;
}

function save(s){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(s)); }catch(e){} }
function load(){
  try{
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if(s && s.v === 2 && Array.isArray(s.members)){
      s.fam = {...freshFam(), ...s.fam};   // あとから増えた曲
      return s;
    }
  }catch(e){}
  return null;
}
