'use strict';
/* 部員と演奏
   部員一人ひとりが自分の楽譜を吹く。音程・リズム・音色・表現の力と、本人の癖、部のまとまり、譜読み、
   会場、本番の緊張から、1音ずつの「ずれ」を決める。審査はそのずれを測って行う。 */

const STAT_KEYS = ['pitch', 'rhythm', 'tone', 'expr'];
const STAT_LABEL = {pitch: '音程', rhythm: 'リズム', tone: '音色', expr: '表現'};
const STAT_DESC = {
  pitch: 'ユニゾンのうなり・和音の響き',
  rhythm: '縦の線・テンポの安定・音の長さ',
  tone: '音の出だし・息の支え・音割れ',
  expr: '強弱・テンポの揺れ・ビブラート',
};

const TRAITS = {
  sharp:   {name: '上ずりがち',   desc: '音程が高めになりやすい。'},
  flat:    {name: 'ぶら下がりがち', desc: '音程が低めになりやすい。'},
  rush:    {name: '走りがち',     desc: 'テンポより先に出てしまう。'},
  drag:    {name: 'もたりがち',   desc: '出だしが遅れやすい。'},
  loud:    {name: '音が大きい',   desc: '伴奏でも目立ってしまう。表現が育つと抑えられる。'},
  shy:     {name: '音が小さい',   desc: '旋律でも埋もれがち。'},
  nervous: {name: '本番に弱い',   desc: '本番の緊張で力が落ちやすい。'},
  clutch:  {name: '本番に強い',   desc: '本番でも力が落ちにくい。'},
  steady:  {name: 'マイペース',   desc: 'どこでも同じように吹ける。'},
};
const TRAIT_IDS = Object.keys(TRAITS);

/* ===== スキル =====
   部員の得意わざ。○（Lv1）と◎（Lv2）がある。生まれつき持っている子もいれば、練習を続けたり、相談への答え方で身につく子もいる。
   m.sp[スキル] に育ち具合をためる（1で○、2.5で◎）。効き目は数点ずつ（出来を決めるのは練習で育てた力）
   grow：その力の練習の伸び（Lv1 あたり）、play：本番の音での力（Lv1 あたり、0〜100 の点）、
   aura：同じパートのほかの部員の本番の音（Lv1 あたり）、auraGrow：同じパートのほかの部員の練習の伸び（Lv1 あたり） */
const SKILLS = {
  sense:  {name: 'センス',         desc: '何を練習しても、少し伸びやすい',               grow: {pitch: .03, rhythm: .03, tone: .03, expr: .03}},
  ear:    {name: 'いい耳',         desc: '音程が伸びやすく、本番でも音程がぶれにくい',   grow: {pitch: .06}, play: {pitch: 1.5}},
  groove: {name: 'リズム感',       desc: 'リズムが伸びやすく、本番でも走らない',         grow: {rhythm: .06}, play: {rhythm: 1.5}},
  breath: {name: '息が長い',       desc: '音色が伸びやすく、長い音がやせない',           grow: {tone: .06}, play: {tone: 1.5}},
  song:   {name: '歌心',           desc: '表現が伸びやすく、フレーズをよく歌う',         grow: {expr: .06}, play: {expr: 1.5}},
  reader: {name: '譜読みが速い',   desc: '新しい曲の楽譜を早く覚える',                   read: .2},
  nerve:  {name: '度胸',           desc: '本番の緊張に強い',                             calm: .1},
  tough:  {name: '体力自慢',       desc: '練習で疲れにくい',                             cost: .15},
  pillar: {name: 'パートの柱',     desc: 'この子がいると、同じパートの音色がよくなる',   aura: {tone: 1.2}, auraGrow: .03},
  center: {name: '音程の要',       desc: 'この子がいると、同じパートの音程がそろう',     aura: {pitch: 1.2}},
  mentor: {name: '面倒見がいい',   desc: '同じパートの部員が、練習で伸びやすくなる',     auraGrow: .04},
  mood:   {name: 'ムードメーカー', desc: '部のやる気とまとまりを支える',                 mood: 1},
};
const SKILL_IDS = Object.keys(SKILLS);
const skillLv = (m, id) => { const v = m.sp?.[id] || 0; return v >= 2.5 ? 2 : v >= 1 ? 1 : 0; };
const skillMark = lv => lv >= 2 ? '◎' : '○';
const skillsOf = m => SKILL_IDS.filter(id => skillLv(m, id)).map(id => ({id, lv: skillLv(m, id), ...SKILLS[id]}));
// 生まれつきのスキル（入部したときに決まる。中学で吹いていた子は少し多い）
function innateSkills(id, exp){
  const sp = {}, h = hash(id, 'skill');
  const pool = ['sense', 'ear', 'groove', 'breath', 'song', 'reader', 'nerve', 'tough', 'mood'];
  const n = h < (exp ? 0.12 : 0.06) ? 2 : h < (exp ? 0.4 : 0.3) ? 1 : 0;
  for(let i = 0; i < n; i++){
    const k = pool[Math.floor(hash(id, 'skill', i) * pool.length)];
    sp[k] = hash(id, 'skillLv', i) < 0.12 ? 2.5 : 1;
  }
  return sp;
}
// 同じパートのほかの部員から受ける効き目（いちばん強い1人ぶん）
function sectionAura(members, m, key){
  const sec = SEAT[m.seat]?.sec;
  let best = 0;
  for(const x of members) if(x.id !== m.id && x.seat && SEAT[x.seat]?.sec === sec)
    for(const id of SKILL_IDS){ const lv = skillLv(x, id), v = key === 'grow' ? SKILLS[id].auraGrow : SKILLS[id].aura?.[key]; if(lv && v) best = Math.max(best, v * lv); }
  return best;
}

/* ===== 座席（ステージ配置） ===== */
const SEAT_ROWS = [
  [['picc1','picc','picc'], ['fl1a','fl','fl1'], ['fl1b','fl','fl1'], ['fl2a','fl','fl2'], ['ob1','ob','ob'], ['cl1a','cl','cl1'], ['cl1b','cl','cl1'], ['cl1c','cl','cl1'], ['asax1','asax','asax1'], ['asax2','asax','asax2']],
  [['fg1','fg','fg'], ['ebcl1','ebcl','ebcl'], ['cl2a','cl','cl2'], ['cl2b','cl','cl2'], ['cl3a','cl','cl3'], ['cl3b','cl','cl3'], ['bcl1','bcl','bcl'], ['tsax1','tsax','tsax'], ['bsax1','bsax','bsax'], ['hn1','hn','hn1'], ['hn2','hn','hn2'], ['hn3','hn','hn3'], ['hn4','hn','hn4']],
  [['tp1a','tp','tp1'], ['tp1b','tp','tp1'], ['tp2a','tp','tp2'], ['tp3a','tp','tp3'], ['tb1','tb','tb1'], ['tb2','tb','tb2'], ['btb1','btb','btb'], ['euph1','euph','euph'], ['euph2','euph','euph'], ['tuba1','tuba','tuba'], ['tuba2','tuba','tuba'], ['cb1','cb','cb']],
  [['perc1','timp','perc1'], ['perc2','sd','perc2'], ['perc3','bd','perc3'], ['perc4','cym','perc4']],
];
const SEATS = [];
SEAT_ROWS.forEach((row, r) => {
  row.forEach(([id, inst, part], k) => {
    let x, y;
    if(r < 3){
      const R = [0.34, 0.56, 0.78][r];
      const a = (-78 + 156 * (k + 0.5) / row.length) * Math.PI / 180;
      x = Math.sin(a) * R; y = Math.cos(a) * R;
    } else {
      x = -0.42 + 0.84 * k / (row.length - 1); y = 0.94;
    }
    SEATS.push({id, inst, part, row: r, x, y, pan: clamp(x * 1.15, -0.9, 0.9), sec: INST[inst].sec});
  });
});
const SEAT = Object.fromEntries(SEATS.map(s => [s.id, s]));
// 空席を埋める順番（和音が欠けやすいところから）
const FILL_ORDER = ['tp3a', 'hn3', 'cl3a', 'cl2b', 'hn4', 'euph2', 'tuba2', 'tb2', 'asax2', 'cl3b', 'fl2a', 'perc4', 'ebcl1',
  'picc1', 'fl1b', 'cl1b', 'cl1c', 'fg1', 'bcl1', 'tsax1', 'hn2', 'tp1b', 'tp2a', 'btb1', 'cb1', 'perc2', 'perc3',
  'cl1a', 'fl1a', 'ob1', 'tp1a', 'hn1', 'tb1', 'euph1', 'tuba1', 'asax1', 'perc1', 'cl2a', 'bsax1'];

const SURNAMES = '佐藤 鈴木 高橋 田中 伊藤 渡辺 山本 中村 小林 加藤 吉田 山田 佐々木 山口 松本 井上 木村 林 清水 山崎 森 池田 橋本 阿部 石川 山下 中島 石井 小川 前田 岡田 長谷川 藤田 後藤 近藤 村上 遠藤 青木 坂本 福田 太田 西村 藤井 金子 岡本 藤原 中野 三浦 原田 中川 松田 竹内 小野 田村 中山 和田 石田 森田 上田 原 内田 柴田 酒井 宮崎 横山 高木 安藤 宮本 大野 小島 工藤 野口 桜井 千葉 岩崎 松井 菅原 久保 杉山'.split(' ');
const GIVEN = '陽菜 結衣 葵 凛 美咲 楓 莉子 真央 杏 彩花 七海 心春 優奈 千尋 遥 紗希 明里 花音 菜月 美月 悠真 蓮 湊 陽翔 颯太 大翔 樹 悠斗 蒼 瑛太 拓海 健太 翔 航 律 奏 響 晴 光 歩 柚 透 真琴 優 渚 薫 千夏 紬 澪 詩 雫 智也 亮 隼 朔 環 絢 茜 栞 萌 和奏 恵 碧 理央 早紀 健 誠 陸 海斗 文香'.split(' ');

function makeName(used, ...seed){
  for(let k = 0; k < 50; k++){
    const n = SURNAMES[Math.floor(hash(...seed, 's', k) * SURNAMES.length)] + ' ' + GIVEN[Math.floor(hash(...seed, 'g', k) * GIVEN.length)];
    if(!used.has(n)){ used.add(n); return n; }
  }
  return '新入部員';
}
function makeStats(base, spread, ...seed){
  const st = {};
  for(const k of STAT_KEYS){
    const b = k === 'expr' ? base * 0.7 : base;
    st[k] = Math.round(clamp(b + spread * clampG(gauss(...seed, k)), 2, 95));
  }
  return st;
}
// 本番の強さ（メンタル）：もとの性格と、それまでの場数で決まる
function mentalInit(trait, grade, ...seed){
  const base = {nervous: 18, clutch: 72, steady: 60}[trait] ?? 42;
  return Math.round(clamp(base + (grade - 1) * 8 + 6 * clampG(gauss(...seed, 'mental')), 5, 95));
}
function pickTrait(...seed){
  const h = hash(...seed, 'trait');
  return h < 0.12 ? null : TRAIT_IDS[Math.floor(hash(...seed, 'tr2') * TRAIT_IDS.length)];
}

// 役職：部長・副部長・学生指揮はいちばん上の学年から（3年生がいない年は2年生、部ができた年は1年生から）
function assignTitles(members){
  for(const m of members) delete m.title;
  const top = Math.max(0, ...members.map(m => m.grade));
  const by = id => members.find(m => m.seat === id && m.grade === top);
  const third = members.filter(m => m.grade === top).sort((a, b) => avgStat(b) - avgStat(a));
  const boss = by('cl1a') || third[0];
  if(boss) boss.title = '部長';
  const vice = members.length >= 4 && third.find(m => !m.title);
  if(vice) vice.title = '副部長';
  const cond = members.length >= 15 && third.find(m => !m.title && SEAT[m.seat]?.sec !== 'cl');
  if(cond) cond.title = '学生指揮';
  for(const sec of SECTIONS){
    const ms = members.filter(m => SEAT[m.seat]?.sec === sec.id && !m.title).sort((a, b) => b.grade - a.grade || avgStat(b) - avgStat(a));
    if(ms[0]) ms[0].title = 'パートリーダー';
  }
}
const avgStat = m => STAT_KEYS.reduce((a, k) => a + m.stats[k], 0) / 4;

/* ===== 曲の区間ごとの譜読み =====
   部員は曲の区間（PIECES[].spans）ごとに譜読みを持つ（m.fam[曲] は区間ごとの配列）。くり返しの区間（same）は、もとの区間と同じ譜読みを使う */
const readUnit = (pid, i) => PIECES[pid].spans[i]?.same ?? i;
// 練習で選べる区間（くり返しの区間は除く）
const readUnits = pid => PIECES[pid].spans.map((sp, i) => ({...sp, i})).filter(sp => sp.same == null);
// 区間ごとの覚えやすさ：その人の楽譜で音が多い区間（速いパッセージなど）ほど、譜読みに時間がかかる。
// 区間の長さで重みをつけた平均が1になるようにする（曲全体の譜読みの速さは変えない）。part がなければどの区間も1
const READ_EASE = {};
function readEase(pid, part){
  const key = `${pid}:${part}`;
  if(READ_EASE[key]) return READ_EASE[key];
  const units = readUnits(pid), evs = (part && arrangement(pid).parts[part]) || [];
  const len = u => u.to - u.from, total = units.reduce((a, u) => a + len(u), 0);
  const dens = units.map(u => evs.filter(e => e.b >= u.from - 1e-6 && e.b < u.to - 1e-6).length / len(u) + 0.25);
  const mean = units.reduce((a, u, k) => a + dens[k] * len(u), 0) / total;
  let f = dens.map(d => evs.length ? clamp(Math.pow(d / mean, -0.7), 0.55, 1.6) : 1);
  const fm = units.reduce((a, u, k) => a + f[k] * len(u), 0) / total;
  f = f.map(x => x / fm);
  return READ_EASE[key] = Object.fromEntries(units.map((u, k) => [u.i, f[k]]));
}
// 部員の、区間ごとの譜読み（0〜100）。前の形（曲全体で1つの数）は、どの区間も同じ値とみなす
function readOf(m, pid){
  const v = m.fam?.[pid];
  return PIECES[pid].spans.map((_, i) => Array.isArray(v) ? v[readUnit(pid, i)] ?? 0 : typeof v === 'number' ? v : 0);
}
// 曲全体の譜読み（区間の長さで重みをつけた平均）
function readMean(m, pid){
  const sp = PIECES[pid].spans, v = readOf(m, pid);
  return sp.reduce((a, x, i) => a + v[i] * (x.to - x.from), 0) / sp.reduce((a, x) => a + x.to - x.from, 0);
}
// その拍がどの区間か
const spanAt = (pc, b) => { let k = 0; pc.spans.forEach((x, i) => { if(b >= x.from - 1e-6) k = i; }); return k; };

// ラボ用：全席がうまった仮想の部
function fullBand(stats){
  const used = new Set();
  return SEATS.map((s, i) => ({
    id: `lab-${i}`, name: makeName(used, 'lab', s.id), grade: 2, seat: s.id,
    stats: {...stats}, trait: pickTrait('lab', s.id), mental: 50,
  }));
}

/* ===== 演奏の生成 ===== */
const SEC_LAG = {fl: 0, dr: 0, cl: 0, sax: .005, tp: -.006, hn: .026, tb: .015, low: .034, perc: -.015};
const CRACK = {brass: {p: .1}, squeak: {p: .07}, over: {p: .05}};
const ROLE_WEIGHT = {mel: 2, mel3: 1.2, cm: 1.3, pad: 1, bass: 1.2, hit: .8};
const DYN_SPREADS = [0.65, 1, 1.3];
const RUBATOS = [0.3, 1, 1.6];

// 練習で育てた力を、演奏での力に直す。60から上は少し上乗せする（60から上は伸びにくくしたぶん。100はそのまま100）
const PLAY_LIFT = 5;
const playOf = x => x <= 60 || x >= 100 ? x : x + PLAY_LIFT * (x - 60) * (100 - x) / 400;

// 本番の日の調子：z はその日の揺れ（大きいほど緊張に飲まれている）。メンタルが弱いほど平均して下がり、振れ幅も大きい
function stageDrop(m, nerves, z, fatigue = 0){
  const steady = clamp01((m.mental ?? 40) / 100);
  const nv = nerves * (m.grade === 1 ? 1.2 : 1);
  const freeze = steady < 0.5 && z > 0.8 + 1.6 * steady;           // 頭が真っ白に（緊張しやすいほど起きやすい）
  const zone = steady > 0.55 && z < -(0.8 + 1.6 * (1 - steady));   // いつも以上の音が出る（落ち着いているほど起きやすい）
  return {drop: nv * (1.6 - 1.3 * steady) + nv * (1 - steady) * z + (freeze ? 10 : 0) - (zone ? 4 : 0) + fatigue, freeze, zone};
}
// トリルの上の音までの幅（半音いくつ）。その拍の音階（pc.scale、書いた音の高さで）の1つ上の音
function trillStep(pc, m, b){
  const sc = sectionAt(pc.scale, b, SCALE);
  return sc.includes((m + 1) % 12) ? 1 : 2;
}
/* ===== 指揮の効き =====
   自分で指揮すると、1タップごとの正確さが部員に伝わる。ぴったり（1）・いい感じ（0.8）なら、おまかせ（0.5）より出だしがそろい、
   歌い方も少し大きくなる。早い・遅い（0.35）と、おまかせより少し乱れる。2拍より長くタップがないと、部員は自分たちだけで吹く（おまかせと同じ）。
   指揮はあくまで演奏の補助：ぴったり振っても数点（ふつうの部で +2点ほど）。出来を決めるのは、練習で育てた部員の力 */
const LEAD_AUTO = 0.5;
// 指揮者がいないと、部員だけで歌える大きさには少しだけ上限がある。指揮が正確なほど上限が外れる
// LEAD_LIFT・LEAD_DROP：歌い方への効き、LEAD_TIGHT：出だしのそろい方への効き（engine.js）、JIT_K：指揮の拍のがたつきの減点
const AUTO_E_CAP = 0.85, LEAD_LIFT = 0.25, LEAD_DROP = 0.25, LEAD_TIGHT = 0.35, JIT_K = 1;
const tapLead = x => { const a = Math.abs(x.off); return a <= 0.07 ? 1 : a <= 0.15 ? 0.8 : 0.35; };
function leadAtTaps(taps, b){
  let i = taps.length - 1;
  while(i >= 0 && taps[i].k > b) i--;
  if(i < 0 || b - taps[i].k > 2) return LEAD_AUTO;
  // 直前の2打をならす（1打だけ外しても、すぐには崩れない）
  return i > 0 && taps[i].k - taps[i - 1].k <= 2 ? (2 * tapLead(taps[i]) + tapLead(taps[i - 1])) / 3 : tapLead(taps[i]);
}
function perform(ctx){
  const pc = PIECES[ctx.pieceId];
  const seed = ctx.seed || 'band';
  // take：この演奏ごとのさいころ（どの音を外すか・出だしやテンポの揺れ方）。部員の癖（音程の高さ・遅れ方）は seed と部員で決まり、演奏ごとには変わらない。
  // take のない演奏（前の録音・お手本）は、前と同じ音になる
  const take = ctx.take != null ? [ctx.take] : [];
  // 指揮の効き（拍ごと）。指揮しない演奏はおまかせのまま
  const leadAt = typeof ctx.lead === 'function' ? ctx.lead : () => LEAD_AUTO;
  const venue = VENUE[ctx.venue || 'room'];
  const C = clamp01((ctx.cohesion ?? 30) / 100);
  const ip = ctx.interp || {tempo: 1, dyn: 1, rub: 1};
  const bpm = pc.tempi[ip.tempo ?? 1];
  const SPREAD = DYN_SPREADS[ip.dyn ?? 1];
  const RUB = RUBATOS[ip.rub ?? 1];
  const from = ctx.from ?? 0, to = ctx.to ?? pc.beats;

  // 部員ひとりずつの、区間ごとの譜読み（この曲の自分の楽譜をどれだけ吹けるか、0〜1）。録音の控え（pfams、前の形は pfam）→ 部員の記録（m.fam）の順に見る。
  // どちらもない仮想の部員（ラボ）や昔の録音は、ctx.fam（昔の録音は部全体の仕上がり）で代える
  const pfsOf = m => (m.pfams || (m.pfam != null ? pc.spans.map(() => m.pfam) : m.fam ? readOf(m, ctx.pieceId) : pc.spans.map(() => ctx.fam ?? 0))).map(v => clamp01(v / 100));
  // 演奏する範囲での平均（区間と重なる長さで重みをつける）
  const overlap = pc.spans.map(x => Math.max(0, Math.min(x.to, to) - Math.max(x.from, from)));
  const meanIn = pfs => { const w = overlap.reduce((a, x) => a + x, 0) || 1; return pfs.reduce((a, v, i) => a + v * overlap[i], 0) / w; };
  const players = [];
  for(const m of ctx.members){
    const seat = SEAT[m.seat];
    if(!seat) continue;
    let drop, freeze = false, zone = false;
    const fatigue = ctx.fatigue || 0;
    if(ctx.form && m.mental != null){
      ({drop, freeze, zone} = stageDrop(m, (ctx.nerves || 0) * (1 - SKILLS.nerve.calm * skillLv(m, 'nerve')), clampG(ctx.form[m.id] ?? 0), fatigue));
    } else {
      const nerveMul = m.trait === 'nervous' ? 1.6 : m.trait === 'clutch' ? 0.3 : m.trait === 'steady' ? 0.7 : 1;
      drop = (ctx.nerves || 0) * nerveMul * (m.grade === 1 ? 1.3 : 1) + fatigue;
    }
    // 緊張は息（音色）にいちばん出る
    const W = {tone: 1.15, rhythm: 1, pitch: 0.85, expr: 1};
    const st = {};
    // スキル：自分の得意（play）と、同じパートの柱・要（aura）が、本番の音での力を数点上げる
    const plus = k => skillsOf(m).reduce((a, x) => a + (x.play?.[k] || 0) * x.lv, 0) + sectionAura(ctx.members, m, k);
    for(const k of STAT_KEYS) st[k] = clamp01(playOf(m.stats[k] + plus(k) - drop * W[k]) / 100);
    // 譜読みが浅いうちは、うまい人でもフレーズを歌いきれない（全体のテンポの揺れには範囲での平均、1音ずつにはその区間の譜読みが効く）
    const pfs = pfsOf(m), E0 = st.expr;
    st.expr *= lerp(0.4, 1, meanIn(pfs));
    players.push({m, seat, st, pfs, E0, part: seat.part, sec: seat.sec, freeze, zone});
  }
  const avg = (k, list = players) => list.length ? list.reduce((a, p) => a + p.st[k], 0) / list.length : 0;
  // 部員の譜読みの平均（低いうちは、指揮の揺れに全員でついていけず、テンポもそろわない）
  const FAM = players.length ? players.reduce((a, p) => a + meanIn(p.pfs), 0) / players.length : 0;
  const bandR = avg('rhythm'), bandE = avg('expr');
  const secP = {};
  for(const s of SECTIONS) secP[s.id] = avg('pitch', players.filter(p => p.sec === s.id));

  // テンポ：指揮の揺れ（ついてこられるかは表現とまとまり次第）、だんだん走る、拍ごとのむら
  const SPB = 60 / bpm;
  const rubUse = RUB * clamp01(Math.min(bandE * 1.2, C * 1.2 + 0.2)) * lerp(0.6, 1, FAM);
  const iRb = 1 - bandR;
  const STEP = 0.125, cum = [0], cumIdeal = [0], wob = {};
  for(let i = 1; i * STEP <= pc.beats + 8; i++){
    const b = (i - 0.5) * STEP;
    const r = interp(pc.rubato, b) - 1;
    const tm = tmAt(pc, b);   // 楽譜の上のテンポの変化（序奏だけゆっくり、だんだん速く、など）
    let m = 1 + rubUse * r;
    m *= 1 - 0.09 * iRb * (1 - 0.6 * C) * Math.min(b, pc.beats) / pc.beats;
    m *= 1 + (0.06 * Math.pow(iRb, 1.2) * (1 - 0.5 * C) + 0.025 * Math.pow(1 - FAM, 1.5)) * venue.play.timing * clampG(wob[Math.floor(b)] ??= gauss(seed, 'tempo', Math.floor(b), ...take));
    cum.push(cum[i-1] + SPB * tm * Math.max(0.6, m) * STEP);
    cumIdeal.push(cumIdeal[i-1] + SPB * tm * (1 + RUB * r) * STEP);
  }
  const mapper = c => b => { const x = Math.max(0, b) / STEP, i = Math.min(Math.floor(x), c.length - 2); return c[i] + (c[i+1] - c[i]) * (x - i); };
  const b2s = mapper(cum), b2sIdeal = mapper(cumIdeal);
  const off = b2s(from);
  const ideal = b => 0.58 + (interp(pc.dyn, b) - 0.58) * SPREAD;

  // 担当がいないパートの旋律・低音・和音は、いる人が持ち替えて吹く（全員そろっていれば楽譜どおり）
  const red = reduction(ctx.pieceId, new Set(players.map(p => p.part)));

  const notes = [], hits = [], sharedG = {};
  for(const p of players){
    const {m, st, seat, pfs, E0} = p;
    const P = st.pitch, R = st.rhythm, T = st.tone, E = st.expr;
    const iP = 1 - P, iR = 1 - R, iT = 1 - T;
    const pk = [seed, m.id];
    // 頭が真っ白になると、音が上ずり、前へ走る
    const tend = clampG(gauss(...pk, 'tend')) + (m.trait === 'sharp' ? 1.2 : m.trait === 'flat' ? -1.2 : 0) + (p.freeze ? 0.8 : 0);
    const lag = SEC_LAG[p.sec] * (1 - C) + 0.035 * Math.pow(iR, 1.2) * clampG(gauss(...pk, 'lag'))
      + (m.trait === 'drag' ? 0.03 * iR : m.trait === 'rush' ? -0.03 * iR : 0) - (p.freeze ? 0.025 : 0);
    const nat = 1.5 * clampG(gauss(...pk, 'nat'));
    const loudMul = m.trait === 'loud' ? 1.2 - 0.1 * E : m.trait === 'shy' ? 0.78 + 0.12 * E : 1;
    const jf0 = clamp01((P - 0.65) / 0.3) * (0.4 + 0.6 * C);
    const evs = red.parts[p.part] || [];
    const mine = [];
    let prevMidi = null, prevEnd = -Infinity;
    evs.forEach(e => {
      if(e.b < from - 1e-6 || e.b >= to - 1e-6) return;
      const k = [...pk, ctx.pieceId, p.part, e.b, e.role, ...take], H = hasher(...k);
      // この音のある区間の譜読み。浅いと歌いきれず、和音のどの音を吹いているか分からないので音程をはめきれない
      const pf = pfs[spanAt(pc, e.b)], jf = jf0 * lerp(0.3, 1, pf);
      // 歌い方：指揮が正確なほど、部員は指揮者の歌い方に乗れる
      // 上限は歌い方（表現）だけにかける。旋律と伴奏の音量の関係（バランス）は、上限なしの値で決める
      const Ld = leadAt(e.b) - LEAD_AUTO, cap = AUTO_E_CAP + (1 - AUTO_E_CAP) * clamp01(Ld / (1 - LEAD_AUTO));
      const lift = (x, top) => clamp01(Ld > 0 ? x + (top - x) * LEAD_LIFT * Ld : x * (1 + LEAD_DROP * Ld));
      const Ef = E0 * lerp(0.4, 1, pf), EnD = lift(Ef, 1), En = lift(Math.min(cap, Ef), cap);
      // 譜読みが浅いと、音が抜け、出だしが揺れる（うまい人ほど揺れは小さい）
      if(H('miss') < 0.07 * Math.pow(1 - pf, 2) * (1 - 0.5 * R)) return;
      const t = Math.max(0, b2s(e.b) - off + lag + 0.07 * Math.pow(iR, 1.2) * venue.play.timing * (1 - 0.35 * C) * clampG(H.gauss('t'))
        + 0.03 * Math.pow(1 - pf, 1.5) * (1 - 0.4 * R) * clampG(H.gauss('ft')));
      const tIdeal = b2sIdeal(e.b) - b2sIdeal(from);
      const vScale = v => clamp(lerp(0.58, v, EnD) * loudMul, 0.04, 1);
      let wrong = 0;
      if(e.m != null && H('wr') < 0.16 * Math.pow(1 - pf, 2) * (1 - 0.5 * P)) wrong = (H('wd') < .5 ? 1 : -1) * (H('ws') < .6 ? 1 : 2);
      const endB = e.b + e.d;
      const fermata = endB >= pc.beats - 1e-6 ? 1.1 * En * RUB : 0;

      if(e.kind === 'hit'){
        const inst = e.inst;
        const written = e.role === 'hit' ? 0.58 + (e.v - 0.58) * SPREAD : ideal(e.b) * e.sc;
        const v = clamp(vScale(written) + 0.2 * iT * clampG(H.gauss('v')) * 0.5, 0.04, 1);
        const h = {mid: m.id, seat: seat.id, sec: p.sec, inst, role: e.role, t, tIdeal, v, key: k.join(':'), b: e.b, db: e.d || 0, tg: b2s(e.b) - off, R, weight: ROLE_WEIGHT.hit};
        if(e.roll){
          h.roll = true;
          h.dur = b2s(endB) - b2s(e.b) + fermata;
          h.v1 = clamp(vScale(0.58 + (e.v1 - 0.58) * SPREAD), 0.04, 1);
          h.uneven = 0.12 + 0.55 * iT;
        }
        if(e.m != null){
          h.midi = e.m + pc.trans + (INST[inst].fam === 'mallet' ? wrong : 0);
          h.cents = inst === 'timp' ? 18 * Math.pow(iP, 1.2) * clampG(gauss(...pk, 'tune', e.m))
            : inst === 'cbpizz' ? nat + 22 * Math.pow(iP, 1.1) * tend + 28 * Math.pow(iP, 1.4) * clampG(H.gauss('p')) + e.ji * jf : 0;
          if(inst === 'cbpizz'){ h.midi = e.m + pc.trans + wrong; h.err = h.cents - e.ji; }
        } else h.cents = 0;
        h.wrong = !!wrong && INST[inst].fam !== 'perc';
        hits.push(h);
        return;
      }

      const inst = INST[seat.inst];
      const tb = TIMBRE[inst.timbre];
      let d = b2s(endB) - b2s(e.b);
      if(e.art === 'stac') d = Math.min(d * 0.55, 0.32);
      else if(!e.leg) d *= 0.86 + 0.1 * En;
      if(e.d >= 2) d *= 1 - 0.3 * iR * (0.5 + 0.5 * H('hold'));
      d += fermata;
      const midi = e.m + pc.trans + wrong;
      const reg = (midi - inst.center) / 12 * 7 * iP;
      const shared = clampG(sharedG[p.sec + ':' + e.b] ??= gauss(seed, p.sec, ctx.pieceId, e.b, 'shared', ...take)) * 26 * Math.pow(1 - secP[p.sec], 1.4);
      const indiv = 28 * Math.pow(iP, 1.4) * clampG(H.gauss('p')) + 6 * Math.pow(1 - pf, 1.5) * clampG(H.gauss('fp'));
      const c = 0.55 * C;
      const miss = nat + 22 * Math.pow(iP, 1.1) * tend * venue.play.pitch + reg + (1 - c) * indiv + c * shared;
      const cents = miss + e.ji * jf;
      const ck = tb.crack ? CRACK[tb.crack] : null;
      // 裏返りやすいのは、休みのあとの出だしや大きく跳んだ音。短く切る音（後打ちなど）や同じ音の連打、順次進行は裏返りにくい
      const jump = prevMidi == null || e.b - prevEnd > 1 ? null : Math.abs(midi - prevMidi);
      const leap = jump == null ? 1.3 : jump === 0 ? 0.3 : jump <= 4 ? 0.5 : jump <= 9 ? 1 : 1.4;
      const crackP = ck ? ck.p * iT * iT * (midi > inst.center + 5 ? 1.5 : 1) * (e.art === 'stac' ? 0.35 : 1) * leap * (d < 0.3 ? 0.6 : 1) * (p.freeze ? 2.5 : 1) : 0;
      prevMidi = midi; prevEnd = e.b + e.d;
      let crack = 0;
      if(H('cr') < crackP){
        crack = tb.crack === 'brass' ? (H('cd') < .6 ? 1 : -1) * (320 + 380 * H('ca'))
          : tb.crack === 'squeak' ? 1902 : 1200;
      }
      const vj = 0.1 * iT * clampG(H.gauss('vj'));
      const env = [];
      const pts = Math.max(2, Math.ceil(d / 0.25));
      for(let j = 0; j <= pts; j++){
        const fr = j / pts;
        // アクセントは出だしだけ強く、すぐ元の大きさへ戻す
        let v = vScale(ideal(e.b + e.d * Math.min(1, fr)) * e.sc * (e.solo ? 1.12 : 1) * (e.acc ? 1 + 0.3 * Math.max(0, 1 - 3 * fr) : 1));
        if(e.d >= 2 && (e.role === 'mel' || e.role === 'mel3' || e.role === 'cm')) v += 0.07 * En * Math.sin(Math.PI * fr);
        v *= 1 - 0.35 * Math.pow(iT, 1.3) * fr * fr;
        env.push([d * fr, clamp(v + vj, 0.04, 1)]);
      }
      const note = {
        mid: m.id, seat: seat.id, sec: p.sec, part: p.part, inst: seat.inst, role: e.role, solo: !!e.solo, b: e.b, db: e.d, tg: b2s(e.b) - off, key: k.join(':'),
        midi, t, tIdeal, d, cents, err: wrong ? 100 : cents - e.ji, wrong: !!wrong, T, E: En, R,
        scoop: -(0.5 + H('sc')) * 45 * iP * (tb.brass ? 1.2 : 0.6),
        settle: 0.03 + 0.16 * iP,
        sag: -(e.d >= 1.5 ? 22 : 7) * Math.pow(iT, 1.2),
        crack, crackDur: 0.06 + 0.05 * H('cl'),
        vib: (inst.vib || 0) * En * Math.sqrt(T),
        att: tb.att * (1 + 0.9 * iT),
        blat: 1 + (tb.brass ? 0.6 : 0.4) * Math.pow(iT, 1.2),
        bright: 1 + 0.4 * iT,
        art: e.art, slur: !!e.slur, leg: !!e.leg, env,
        weight: (ROLE_WEIGHT[e.role] || 1) * (e.solo ? 1.5 : 1),
      };
      // 前打音：拍の少し前に短く入れる（リズムの力があるほど短く、はっきり）
      if(e.gr?.length){
        const gd = 0.05 + 0.04 * iR, v0 = env[0][1] * 0.9;
        e.gr.forEach((g, i) => mine.push({...note, midi: g + pc.trans + wrong, t: Math.max(0, t - gd * (e.gr.length - i)), d: gd, env: [[0, v0], [gd, v0]],
          orn: true, art: 'slur', slur: true, leg: true, crack: 0, weight: note.weight * 0.3}));
      }
      // トリル（その調の1つ上の音と交互に）・トレモロ（同じ音をくり返す）：うまい人ほど速く、粒がそろう
      if(e.tr || e.trem){
        const step = 1 / (e.tr ? 9 + 5 * R : 7 + 4 * R);
        const up = e.tr ? trillStep(pc, e.m, e.b) : 0, n = Math.max(2, Math.floor(d / step));
        for(let j = 0; j < n; j++){
          const o = j * step, tj = t + o + 0.3 * step * Math.pow(iR, 1.2) * clampG(H.gauss('tr' + j));
          const dj = j === n - 1 ? d - o : step * (e.tr ? 1 : 0.55);
          mine.push({...note, midi: midi + (j % 2 ? up : 0), t: tj, d: dj, env: [[0, interp(env, o)], [dj, interp(env, Math.min(d, o + dj))]],
            orn: j > 0, art: j && e.tr ? 'slur' : e.tr ? note.art : 'stac', slur: j ? !!e.tr : note.slur, leg: !!e.tr && j < n - 1, ...(j ? {crack: 0} : {})});
        }
      } else mine.push(note);
    });
    mine.sort((a, b) => a.t - b.t);
    for(let i = 0; i < mine.length; i++){
      const n = mine[i], pr = mine[i-1];
      if(pr && n.t < pr.t + 0.02) n.t = pr.t + 0.02;
      n.join = !!(pr && pr.leg && n.t - (pr.t + pr.d) < 0.12);
      notes.push(n);
    }
  }
  hits.sort((a, b) => a.t - b.t);
  const bars = [];
  for(let b = from; b <= to + 1e-6; b += pc.meter) bars.push(b2s(b) - off);
  const idealLine = [];
  for(let b = from; b <= to + 1e-6; b += 0.25) idealLine.push([b2s(b) - off, ideal(b)]);
  const ends = [...notes.map(n => n.t + n.d), ...hits.map(h => h.t + (h.dur || 0))];
  const total = Math.max(1, ...ends) + 0.4;
  // 楽譜の拍 ⇔ この演奏での時刻（指揮で速さを変えるときや、図を描くときに使う）
  const b2t = b => b2s(b) - off;
  const t2b = t => { let lo = from, hi = to + 8; for(let i = 0; i < 40; i++){ const mid = (lo + hi) / 2; if(b2t(mid) < t) lo = mid; else hi = mid; } return (lo + hi) / 2; };
  const mental = players.filter(p => p.freeze || p.zone).map(p => ({mid: p.m.id, kind: p.freeze ? 'freeze' : 'zone'}));
  const inSpan = b => b >= from - 1e-6 && b < to - 1e-6;
  const miss = {mel: red.miss.mel.filter(inSpan).length, bass: red.miss.bass.filter(inSpan).length};
  return {pieceId: ctx.pieceId, venue: venue.id, from, to, bpm, notes, hits, bars, ideal: idealLine, total, b2t, t2b, meter: pc.meter, mental, miss,
    idealDur: b2sIdeal(to) - b2sIdeal(from), realDur: b2s(to) - off, cohesion: C, fam: FAM, interp: {...ip}, rubUse, spread: SPREAD,
    bandE, bandR, players: players.length, secs: [...new Set(players.map(p => p.sec))]};
}

/* ===== 演奏を測る ===== */
// 曲の中での受け持ち：パートごとに、旋律・ソロ・対旋律・低音・和音をどれだけ吹くか（曲の長さに対する割合）
const NEED_CACHE = {};
function pieceNeeds(pid){
  if(NEED_CACHE[pid]) return NEED_CACHE[pid];
  const pc = PIECES[pid], L = pc.spans[pc.spans.length - 1].to;
  const cover = segs => { let sum = 0, end = -1e9; for(const x of segs.slice().sort((a, b) => a.f - b.f)){ if(x.t <= end) continue; sum += x.t - Math.max(x.f, end); end = x.t; } return sum / L; };
  const KINDS = {mel: ['mel'], cm: ['cm', 'mel3'], bass: ['bass'], pad: ['pad']};
  const part = {}, segsBySec = {}, sec = {};
  for(const [p, segs] of Object.entries(pc.roles)){
    const sc = INST[PART_INST[p]]?.sec;
    if(!sc) continue;
    part[p] = {solo: segs.some(x => x.solo), ...Object.fromEntries(Object.entries(KINDS).map(([k, rs]) => [k, cover(segs.filter(x => rs.includes(x.r)))]))};
    (segsBySec[sc] ||= []).push(...segs);
    if(part[p].solo) (sec[sc] ||= {}).soloPart = p;
  }
  for(const [sc, segs] of Object.entries(segsBySec)) sec[sc] = {...sec[sc], solo: !!sec[sc]?.soloPart, ...Object.fromEntries(Object.entries(KINDS).map(([k, rs]) => [k, cover(segs.filter(x => rs.includes(x.r)))]))};
  if(pc.perc && Object.keys(pc.perc).length) sec.perc = {...(sec.perc || {}), perc: true};
  return NEED_CACHE[pid] = {part, sec};
}
// 受け持ちの印（和音は、ほかの受け持ちがないときだけ）
const needTags = r => {
  if(!r) return [];
  const t = [r.solo && 'ソロ', r.mel >= 0.3 && '旋律', r.cm >= 0.3 && '対旋律', r.bass >= 0.4 && 'ベース', r.perc && '打楽器'].filter(Boolean);
  return t.length ? t : r.pad >= 0.3 ? ['和音'] : [];
};
// 曲がその楽器（セクション）をどれだけ必要とするか：旋律・ソロ・低音を受け持つ楽器ほど重い（曲の長さに対する受け持ちの割合から）
const LACK_MAX = 12, NEED_W = {};
function needWeight(pid){
  return NEED_W[pid] ||= Object.fromEntries(Object.entries(pieceNeeds(pid).sec)
    .map(([id, r]) => [id, (r.solo ? 1.5 : 0) + 3 * (r.mel || 0) + 1.5 * (r.cm || 0) + 2 * (r.bass || 0) + 0.5 * (r.pad || 0) + (r.perc ? 1.5 : 0)])
    .filter(([, w]) => w > 0.2));
}
// この曲で、一人もいない楽器と、審査での減点（必要な楽器が欠けているほど、最大 LACK_MAX 点）。secs は演奏する部員のセクション
function lackOf(pid, secs){
  const w = needWeight(pid), have = new Set(secs), tot = Object.values(w).reduce((a, x) => a + x, 0) || 1;
  const miss = Object.keys(w).filter(id => !have.has(id)).sort((a, b) => w[b] - w[a]);
  return {miss, pts: Math.round(LACK_MAX * miss.reduce((a, id) => a + w[id], 0) / tot * 10) / 10};
}
const lackNames = miss => miss.map(id => SEC[id].name);

const THIN_MAX = 12;
function analyze(perf){
  const pc = PIECES[perf.pieceId];
  const lv = (inst, v) => INST[inst].gain * (0.03 + 0.97 * Math.pow(v, 1.8));
  const sec = {};
  for(const s of SECTIONS) sec[s.id] = {pw: 0, pe: 0, rw: 0, re: 0, tw: 0, te: 0, cracks: 0, n: 0, loud: 0, sp: 0, spw: 0};
  let pW = 0, pE = 0, tW = 0, tE = 0, eW = 0, eE = 0, cracks = 0, wrong = 0;
  for(const n of perf.notes){
    const vm = n.env.reduce((a, [, v]) => a + v, 0) / n.env.length;
    const w = n.weight * Math.sqrt(lv(n.inst, vm) / 0.03) * Math.min(1.5, 0.4 + n.d);
    const s = sec[n.sec];
    if(n.wrong){ wrong++; continue; }
    pW += w; pE += w * Math.abs(n.err);
    s.pw += w; s.pe += w * Math.abs(n.err); s.n++;
    tW += w; tE += w * n.T;
    s.tw += w; s.te += w * n.T;
    if(n.crack){ cracks++; s.cracks++; }
    if(n.role === 'mel' || n.solo){ eW += w; eE += w * n.E; }
    else { eW += w * 0.35; eE += w * 0.35 * n.E; }
    s.loud += lv(n.inst, vm) * n.d;
  }
  for(const h of perf.hits){ if(h.wrong) wrong++; }
  // ユニゾンのばらつき（同じパートの同じ音どうし）
  const groups = {};
  for(const n of perf.notes){ if(!n.wrong && !n.orn) (groups[n.part + ':' + n.b] ||= []).push(n); }
  let sW = 0, sE = 0;
  for(const g of Object.values(groups)){
    if(g.length < 2) continue;
    const mean = g.reduce((a, n) => a + n.err, 0) / g.length;
    for(const n of g){ const dv = Math.abs(n.err - mean); sW += n.weight; sE += n.weight * dv; sec[n.sec].sp += dv * n.weight; sec[n.sec].spw += n.weight; }
  }
  // 縦の線：同じ拍に出る音どうしの出だしのずれ（拍の4分の1ごとにまとめる。5連符や32分音符の多い曲は pc.grid で細かくする）
  const beats = {}, grid = pc.grid || 4;
  for(const x of [...perf.notes, ...perf.hits]) if(!x.orn) (beats[Math.round(x.b * grid)] ||= []).push(x);
  let rW = 0, rE = 0;
  for(const g of Object.values(beats)){
    if(g.length < 2) continue;
    const ts = g.map(x => x.t).sort((a, b) => a - b);
    const med = ts[Math.floor(ts.length / 2)];
    for(const x of g){
      const dv = Math.abs(x.t - med) * 1000;
      rW += x.weight; rE += x.weight * dv;
      sec[x.sec].rw += x.weight; sec[x.sec].re += x.weight * dv;
    }
  }
  // 旋律と伴奏のバランス（0.5秒ごと。短い刻みも拾えるよう、1/8秒ずつ見て足し合わせる）
  const bins = {};
  for(const n of perf.notes){
    const isMel = n.role === 'mel' || n.solo;
    for(let t = Math.ceil(n.t * 8) / 8; t < n.t + n.d; t += 0.125){
      const v = interp(n.env, t - n.t);
      const b = bins[Math.floor(t * 2) / 2] ||= {mel: 0, acc: 0};
      const pw = Math.pow(lv(n.inst, v), 2);
      if(isMel) b.mel += pw; else b.acc += pw;
    }
  }
  let bSum = 0, bN = 0;
  for(const b of Object.values(bins)){
    if(b.mel <= 0) continue;
    // 伴奏がほとんど鳴っていない所（全員のユニゾンや、旋律と低音だけの所）は、差が開きすぎないよう頭打ちにする
    bSum += Math.min(15, 10 * Math.log10(b.mel / Math.max(1e-9, b.acc)) + 3);
    bN++;
  }
  const balanceDb = bN ? bSum / bN : 0;
  const pitchDev = pW ? pE / pW : 0, spread = sW ? sE / sW : 0, rhythmMs = rW ? rE / rW : 0;
  const drift = perf.conducted ? Math.max(0, Math.abs(perf.realDur / perf.idealDur - 1) - 0.08) : Math.abs(perf.realDur / perf.idealDur - 1);
  const secOut = {};
  for(const s of SECTIONS){
    const x = sec[s.id];
    secOut[s.id] = {
      n: x.n, cracks: x.cracks, loud: x.loud,
      pitch: x.pw ? x.pe / x.pw : null, spread: x.spw ? x.sp / x.spw : null,
      rhythm: x.rw ? x.re / x.rw : null, tone: x.tw ? x.te / x.tw : null,
    };
  }
  const score = {
    pitch: 100 * Math.exp(-(0.7 * pitchDev + 0.45 * spread) / 18),
    // 指揮した演奏は、拍ごとにテンポががたつくほど落ち着かない演奏になる
    // 指揮した演奏の拍のがたつき：人が振る1拍ごとの±5%くらいの揺れは減点しない
    rhythm: 100 * Math.exp(-(rhythmMs / 55 + drift * 3 + (perf.conducted ? JIT_K * Math.max(0, (perf.jitter || 0) - 0.12) : 0))),
    tone: clamp(100 * (tW ? tE / tW : 0) - 250 * cracks / Math.max(50, perf.notes.length), 0, 100),
    expr: 100 * (eW ? eE / eW : 0) * (0.75 + 0.25 * clamp01(perf.rubUse / Math.max(0.3, RUBATOS[perf.interp.rub ?? 1]))),
    balance: clamp(75 + 8 * (balanceDb - pc.balRef), 0, 100),
  };
  // 誰も吹けない旋律・低音（管楽器が一人もいない、など）
  const missingMel = perf.miss?.mel ? ['mel'] : [], missingBass = perf.miss?.bass ? ['low'] : [];
  const wrongRate = wrong / Math.max(50, perf.notes.length + perf.hits.length);
  // 人数が少ないと響きが薄い（30人より少ないと、少しずつ下がる）
  const thin = THIN_MAX * clamp((30 - (perf.players || 0)) / 25, 0, 1.15);
  // この曲で受け持ちのある楽器が、一人もいない（旋律やソロの楽器ほど大きい）
  const lack = lackOf(perf.pieceId, perf.secs || SECTIONS.map(s => s.id));
  const penalty = Math.min(25, 200 * wrongRate) + missingMel.length * 8 + missingBass.length * 8 + thin + lack.pts;
  return {score, penalty, thin, lack, pitchDev, spread, rhythmMs, drift, cracks, wrong, balanceDb, sec: secOut, missingMel, missingBass, focus: pc.focus, ceiling: pc.ceiling};
}

/* ===== 審査 ===== */
const JUDGES = [
  {name: '審査員A（指揮者）',   w: {pitch: .38, tone: .27, rhythm: .15, expr: .1, balance: .1}},
  {name: '審査員B（作曲家）',   w: {expr: .4, balance: .2, tone: .15, pitch: .15, rhythm: .1}},
  {name: '審査員C（演奏家）',   w: {rhythm: .35, pitch: .25, balance: .15, tone: .15, expr: .1}},
];
const LEVELS = {
  pref:     {name: '県大会',   venue: 'hall',  gold: 72, A: 78, B: 60, rep: '支部大会'},
  block:    {name: '支部大会', venue: 'grand', gold: 77, A: 82, B: 66, rep: '全国大会'},
  national: {name: '全国大会', venue: 'grand', gold: 82, A: 86, B: 72, rep: null},
};
const DIM_LABEL = {pitch: '音程', rhythm: 'リズム', tone: '音色', expr: '表現', balance: 'バランス'};

function worstSec(a, key, dir = 1){
  let best = null, bv = dir > 0 ? -Infinity : Infinity;
  for(const [id, s] of Object.entries(a.sec)){
    if(!s.n || s[key] == null) continue;
    const v = s[key];
    if(dir > 0 ? v > bv : v < bv){ bv = v; best = id; }
  }
  return best ? SEC[best].name : null;
}
function commentFor(dim, a, good){
  if(good){
    switch(dim){
      case 'pitch': return `${worstSec(a, 'pitch', -1) || '各パート'}を中心に音程がよく合い、和音が豊かに響いていました。`;
      case 'rhythm': return '縦の線がよくそろい、テンポも安定していました。';
      case 'tone': return `${worstSec(a, 'tone', 1) || '全体'}の柔らかく芯のある音色が印象的です。`;
      case 'expr': return a.focus.expr > 1 ? '歌心があり、最後のリタルダンドまで音楽が自然に流れていました。' : '音楽の流れに勢いがあり、聴いていて楽しい演奏でした。';
      case 'balance': return '旋律がよく聞こえ、伴奏とのバランスが見事です。';
    }
  }
  switch(dim){
    case 'pitch': {
      const s = worstSec(a, 'spread', 1) || worstSec(a, 'pitch', 1);
      return `${s || '全体'}の音程にばらつきがあり、ユニゾンのうなりが気になりました。チューナーだけでなく、隣の音を聴き合いましょう。`;
    }
    case 'rhythm': {
      const s = worstSec(a, 'rhythm', 1);
      return a.drift > 0.04 ? 'テンポが前へ流れてしまい、長い音が保たれていません。' : `${s || '全体'}の出だしがそろわず、縦の線が乱れています。`;
    }
    case 'tone': {
      const s = worstSec(a, 'tone', -1);
      return a.cracks > 3 ? `音が裏返る場面が${a.cracks > 20 ? '何度も' : a.cracks + '回'}ありました。${s || ''}は息の支えを見直しましょう。` : `${s || '全体'}の音の出だしが不安定で、響きが薄く感じます。`;
    }
    case 'expr': return '正確ですが、音楽が平板に聞こえます。フレーズの山をどこに作るか、全員で共有しましょう。';
    case 'balance': {
      const loud = worstSec(a, 'loud', 1);
      return `${loud || '伴奏'}が大きく、旋律が埋もれてしまう場面がありました。`;
    }
  }
}
// 解釈（テンポ・抑揚・揺れ）が部の実力に合っているか
function interpNotes(perf){
  const out = [];
  const ip = perf.interp, pc = PIECES[perf.pieceId];
  let adj = 0;
  // 曲ごとのルール（js/pieces/<曲>.js の interpRules）
  for(const r of pc.interpRules?.(perf, ip) || []) if(r){ adj += r[0]; if(r[1]) out.push(r[1]); }
  if(ip.dyn === 2 && perf.bandE < 0.6){ adj -= 4; out.push('強弱をつけようとする意図はわかりますが、大げさに聞こえます。'); }
  if(ip.dyn === 2 && perf.bandE >= 0.75){ adj += 2; }
  if(ip.dyn === 0){ adj -= 2; out.push('強弱の幅が控えめで、もう一歩踏み込んでほしいところです。'); }
  if(ip.rub === 2 && perf.cohesion < 0.6){ adj -= 4; out.push('テンポの揺れに合奏がついていけていません。'); }
  if(ip.rub === 2 && perf.cohesion >= 0.75 && perf.bandE >= 0.7){ adj += 2; }
  return {adj, notes: out};
}
function judge(perf, a, levelId){
  const L = LEVELS[levelId] || LEVELS.pref;
  const it = interpNotes(perf);
  const used = new Set();
  const judges = JUDGES.map((j, i) => {
    const w = {};
    let tot = 0;
    for(const [k, x] of Object.entries(j.w)){ w[k] = x * (a.focus[k] || 1); tot += w[k]; }
    let sc = 0;
    for(const k of Object.keys(w)) sc += a.score[k] * w[k] / tot;
    sc = Math.round(clamp(sc * a.ceiling - a.penalty + it.adj + 2.5 * clampG(gauss('judge', levelId, i, Math.round(sc))), 0, 100));
    // 審査員が重く見る3項目から、ほかの審査員とかぶらない講評を選ぶ
    const dims = Object.entries(w).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k]) => k);
    const pick = (list, good) => {
      for(const k of list){
        if(good ? a.score[k] < 70 : a.score[k] >= 72) continue;
        const c = commentFor(k, a, good);
        if(!used.has(c)){ used.add(c); return c; }
      }
      return null;
    };
    const comments = [];
    const strong = pick(dims.slice().sort((x, y) => a.score[y] - a.score[x]), true);
    const weak = pick(dims.slice().sort((x, y) => a.score[x] - a.score[y]), false);
    if(strong) comments.push(strong);
    if(weak) comments.push(weak);
    if(i === 1 && it.notes.length) comments.push(it.notes[0]);
    if(i === 2 && a.wrong >= 4) comments.push('まだ譜面が手の内に入っていない箇所が見られます。');
    if(i === 0 && a.missingMel.length) comments.push('人数の少ないパートの旋律が聞こえにくくなっていました。');
    if(i === 0 && a.lack.pts >= 1) comments.push(`${lackNames(a.lack.miss.slice(0, 2)).join('と')}${a.lack.miss.length > 2 ? 'など' : ''}がいないため、その受け持ちをほかの楽器で補っていました。この曲本来の響きには、まだ届いていません。`);
    else if(i === 0 && a.thin >= 4) comments.push(a.thin >= 7 ? '少ない人数でよく工夫していますが、響きの厚みはまだこれからです。' : '人数がもう少しそろうと、響きに厚みが出てきそうです。');
    if(i === 0 && perf.conducted && perf.jitter > 0.2) comments.push('指揮の拍が安定せず、合奏が落ち着きませんでした。');
    if(!comments.length) comments.push('全体によくまとまっています。あと一歩の磨き込みを期待します。');
    return {name: j.name, score: sc, grade: sc >= L.A ? 'A' : sc >= L.B ? 'B' : 'C', comment: comments.join('')};
  });
  return {judges, ...awardOf(judges, levelId), level: levelId};
}
// 審査員の点から、平均・賞・代表を決める
function awardOf(judges, levelId){
  const L = LEVELS[levelId] || LEVELS.pref;
  const avg = judges.reduce((s, j) => s + j.score, 0) / judges.length;
  const award = avg >= L.gold && judges.every(j => j.grade !== 'C') ? 'gold' : avg >= L.B - 4 ? 'silver' : 'bronze';
  const rep = !!L.rep && award === 'gold' && judges.every(j => j.grade === 'A');
  return {avg, award, rep};
}
// A部門：課題曲（js）と自由曲（jf）の採点を、審査員ごとに w：1−w で合わせる。講評は自由曲から（2人目の審査員は課題曲にもふれる）
function mergeJudges(js, jf, levelId, w){
  const L = LEVELS[levelId] || LEVELS.pref;
  const judges = jf.judges.map((x, i) => {
    const sc = Math.round(w * js.judges[i].score + (1 - w) * x.score);
    return {name: x.name, score: sc, grade: sc >= L.A ? 'A' : sc >= L.B ? 'B' : 'C', comment: i === 1 ? `課題曲は、${js.judges[i].comment}自由曲は、${x.comment}` : x.comment};
  });
  return {judges, ...awardOf(judges, levelId), level: levelId};
}
// 演奏会（コンクール以外）の出来：0〜100
function quality(a){
  const w = {pitch: .25, rhythm: .25, tone: .2, expr: .15, balance: .15};
  let s = 0;
  for(const k of Object.keys(w)) s += a.score[k] * w[k];
  return clamp(s - a.penalty, 0, 100);
}
