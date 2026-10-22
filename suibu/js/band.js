'use strict';
/* 部員と演奏
   部員一人ひとりが自分の楽譜を吹く。音程・リズム・音色・表現の力と、本人の癖、部のまとまり、曲の仕上がり、
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
const INTERP_NAMES = {tempo: ['遅め', '標準', '速め'], dyn: ['控えめ', '標準', '大きく'], rub: ['ほぼ一定', '標準', 'たっぷり']};

function perform(ctx){
  const pc = PIECES[ctx.pieceId];
  const seed = ctx.seed || 'band';
  const venue = VENUE[ctx.venue || 'room'];
  const C = clamp01((ctx.cohesion ?? 30) / 100);
  const FAM = clamp01((ctx.fam ?? 0) / 100);
  const ip = ctx.interp || {tempo: 1, dyn: 1, rub: 1};
  const bpm = pc.tempi[ip.tempo ?? 1];
  const SPREAD = DYN_SPREADS[ip.dyn ?? 1];
  const RUB = RUBATOS[ip.rub ?? 1];
  const from = ctx.from ?? 0, to = ctx.to ?? pc.beats;

  const players = [];
  for(const m of ctx.members){
    const seat = SEAT[m.seat];
    if(!seat) continue;
    let drop, freeze = false, zone = false;
    const fatigue = ctx.fatigue || 0;
    if(ctx.form && m.mental != null){
      // 本番の日の調子：ctx.form[id] は その日の揺れ（大きいほど緊張に飲まれている）。メンタルが弱いほど平均して下がり、振れ幅も大きい
      const steady = clamp01(m.mental / 100), z = clampG(ctx.form[m.id] ?? 0);
      const nv = (ctx.nerves || 0) * (m.grade === 1 ? 1.2 : 1);
      freeze = steady < 0.5 && z > 0.8 + 1.6 * steady;           // 頭が真っ白に（緊張しやすいほど起きやすい）
      zone = steady > 0.55 && z < -(0.8 + 1.6 * (1 - steady));   // いつも以上の音が出る（落ち着いているほど起きやすい）
      drop = nv * (1.6 - 1.3 * steady) + nv * (1 - steady) * z + (freeze ? 10 : 0) - (zone ? 4 : 0) + fatigue;
    } else {
      const nerveMul = m.trait === 'nervous' ? 1.6 : m.trait === 'clutch' ? 0.3 : m.trait === 'steady' ? 0.7 : 1;
      drop = (ctx.nerves || 0) * nerveMul * (m.grade === 1 ? 1.3 : 1) + fatigue;
    }
    // 緊張は息（音色）にいちばん出る
    const W = {tone: 1.15, rhythm: 1, pitch: 0.85, expr: 1};
    const st = {};
    for(const k of STAT_KEYS) st[k] = clamp01((m.stats[k] - drop * W[k]) / 100);
    players.push({m, seat, st, part: seat.part, sec: seat.sec, freeze, zone});
  }
  const avg = (k, list = players) => list.length ? list.reduce((a, p) => a + p.st[k], 0) / list.length : 0;
  const bandR = avg('rhythm'), bandE = avg('expr');
  const secP = {};
  for(const s of SECTIONS) secP[s.id] = avg('pitch', players.filter(p => p.sec === s.id));

  // テンポ：指揮の揺れ（ついてこられるかは表現とまとまり次第）、だんだん走る、拍ごとのむら
  const SPB = 60 / bpm;
  const rubUse = RUB * clamp01(Math.min(bandE * 1.2, C * 1.2 + 0.2));
  const iRb = 1 - bandR;
  const STEP = 0.125, cum = [0], cumIdeal = [0], wob = {};
  for(let i = 1; i * STEP <= pc.beats + 8; i++){
    const b = (i - 0.5) * STEP;
    const r = interp(pc.rubato, b) - 1;
    const tm = tmAt(pc, b);   // 楽譜の上のテンポの変化（序奏だけゆっくり、だんだん速く、など）
    let m = 1 + rubUse * r;
    m *= 1 - 0.09 * iRb * (1 - 0.6 * C) * Math.min(b, pc.beats) / pc.beats;
    m *= 1 + 0.06 * Math.pow(iRb, 1.2) * (1 - 0.5 * C) * venue.play.timing * clampG(wob[Math.floor(b)] ??= gauss(seed, 'tempo', Math.floor(b)));
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
    const {m, st, seat} = p;
    const P = st.pitch, R = st.rhythm, T = st.tone, E = st.expr;
    const iP = 1 - P, iR = 1 - R, iT = 1 - T;
    const pk = [seed, m.id];
    // 頭が真っ白になると、音が上ずり、前へ走る
    const tend = clampG(gauss(...pk, 'tend')) + (m.trait === 'sharp' ? 1.2 : m.trait === 'flat' ? -1.2 : 0) + (p.freeze ? 0.8 : 0);
    const lag = SEC_LAG[p.sec] * (1 - C) + 0.035 * Math.pow(iR, 1.2) * clampG(gauss(...pk, 'lag'))
      + (m.trait === 'drag' ? 0.03 * iR : m.trait === 'rush' ? -0.03 * iR : 0) - (p.freeze ? 0.025 : 0);
    const nat = 1.5 * clampG(gauss(...pk, 'nat'));
    const loudMul = m.trait === 'loud' ? 1.2 - 0.1 * E : m.trait === 'shy' ? 0.78 + 0.12 * E : 1;
    const jf = clamp01((P - 0.65) / 0.3) * (0.4 + 0.6 * C);
    const evs = red.parts[p.part] || [];
    const mine = [];
    let prevMidi = null, prevEnd = -Infinity;
    evs.forEach(e => {
      if(e.b < from - 1e-6 || e.b >= to - 1e-6) return;
      const k = [...pk, ctx.pieceId, p.part, e.b, e.role], H = hasher(...k);
      if(H('miss') < 0.07 * Math.pow(1 - FAM, 2) * (1 - 0.5 * R)) return;
      const t = Math.max(0, b2s(e.b) - off + lag + 0.07 * Math.pow(iR, 1.2) * venue.play.timing * (1 - 0.35 * C) * clampG(H.gauss('t')));
      const tIdeal = b2sIdeal(e.b) - b2sIdeal(from);
      const vScale = v => clamp(lerp(0.58, v, E) * loudMul, 0.04, 1);
      let wrong = 0;
      if(e.m != null && H('wr') < 0.16 * Math.pow(1 - FAM, 2) * (1 - 0.5 * P)) wrong = (H('wd') < .5 ? 1 : -1) * (H('ws') < .6 ? 1 : 2);
      const endB = e.b + e.d;
      const fermata = endB >= pc.beats - 1e-6 ? 1.1 * E * RUB : 0;

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
      else if(!e.leg) d *= 0.86 + 0.1 * E;
      if(e.d >= 2) d *= 1 - 0.3 * iR * (0.5 + 0.5 * H('hold'));
      d += fermata;
      const midi = e.m + pc.trans + wrong;
      const reg = (midi - inst.center) / 12 * 7 * iP;
      const shared = clampG(sharedG[p.sec + ':' + e.b] ??= gauss(seed, p.sec, ctx.pieceId, e.b, 'shared')) * 26 * Math.pow(1 - secP[p.sec], 1.4);
      const indiv = 28 * Math.pow(iP, 1.4) * clampG(H.gauss('p'));
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
        if(e.d >= 2 && (e.role === 'mel' || e.role === 'mel3' || e.role === 'cm')) v += 0.07 * E * Math.sin(Math.PI * fr);
        v *= 1 - 0.35 * Math.pow(iT, 1.3) * fr * fr;
        env.push([d * fr, clamp(v + vj, 0.04, 1)]);
      }
      mine.push({
        mid: m.id, seat: seat.id, sec: p.sec, part: p.part, inst: seat.inst, role: e.role, solo: !!e.solo, b: e.b, db: e.d, tg: b2s(e.b) - off, key: k.join(':'),
        midi, t, tIdeal, d, cents, err: wrong ? 100 : cents - e.ji, wrong: !!wrong, T, E, R,
        scoop: -(0.5 + H('sc')) * 45 * iP * (tb.brass ? 1.2 : 0.6),
        settle: 0.03 + 0.16 * iP,
        sag: -(e.d >= 1.5 ? 22 : 7) * Math.pow(iT, 1.2),
        crack, crackDur: 0.06 + 0.05 * H('cl'),
        vib: (inst.vib || 0) * E * Math.sqrt(T),
        att: tb.att * (1 + 0.9 * iT),
        blat: 1 + (tb.brass ? 0.6 : 0.4) * Math.pow(iT, 1.2),
        bright: 1 + 0.4 * iT,
        art: e.art, slur: !!e.slur, leg: !!e.leg, env,
        weight: (ROLE_WEIGHT[e.role] || 1) * (e.solo ? 1.5 : 1),
      });
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
    bandE, bandR, players: players.length};
}

/* ===== 演奏を測る ===== */
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
  for(const n of perf.notes){ if(!n.wrong) (groups[n.part + ':' + n.b] ||= []).push(n); }
  let sW = 0, sE = 0;
  for(const g of Object.values(groups)){
    if(g.length < 2) continue;
    const mean = g.reduce((a, n) => a + n.err, 0) / g.length;
    for(const n of g){ const dv = Math.abs(n.err - mean); sW += n.weight; sE += n.weight * dv; sec[n.sec].sp += dv * n.weight; sec[n.sec].spw += n.weight; }
  }
  // 縦の線：同じ拍に出る音どうしの出だしのずれ
  const beats = {};
  for(const x of [...perf.notes, ...perf.hits]) (beats[Math.round(x.b * 4)] ||= []).push(x);
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
    rhythm: 100 * Math.exp(-(rhythmMs / 55 + drift * 3 + (perf.conducted ? 5 * Math.max(0, (perf.jitter || 0) - 0.04) : 0))),
    tone: clamp(100 * (tW ? tE / tW : 0) - 250 * cracks / Math.max(50, perf.notes.length), 0, 100),
    expr: 100 * (eW ? eE / eW : 0) * (0.75 + 0.25 * clamp01(perf.rubUse / Math.max(0.3, RUBATOS[perf.interp.rub ?? 1]))),
    balance: clamp(75 + 8 * (balanceDb - pc.balRef), 0, 100),
  };
  // 誰も吹けない旋律・低音（管楽器が一人もいない、など）
  const missingMel = perf.miss?.mel ? ['mel'] : [], missingBass = perf.miss?.bass ? ['low'] : [];
  const wrongRate = wrong / Math.max(50, perf.notes.length + perf.hits.length);
  // 人数が少ないと響きが薄い（24人より少ないと、少しずつ下がる）
  const thin = 16 * clamp((24 - (perf.players || 0)) / 20, 0, 1.15);
  const penalty = Math.min(25, 200 * wrongRate) + missingMel.length * 8 + missingBass.length * 8 + thin;
  return {score, penalty, thin, pitchDev, spread, rhythmMs, drift, cracks, wrong, balanceDb, sec: secOut, missingMel, missingBass, focus: pc.focus, ceiling: pc.ceiling};
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
  if(pc.id === 'largo' && ip.tempo === 2){ adj -= 3; out.push('Largoとしてはテンポが速く、落ち着きに欠けます。'); }
  if(pc.id === 'largo' && ip.tempo === 0 && perf.bandE < 0.6){ adj -= 3; out.push('遅いテンポを支えきれず、音楽が停滞しました。'); }
  if(pc.id === 'ode' && ip.tempo === 2 && perf.bandR < 0.7){ adj -= 4; out.push('速いテンポに合奏がついていけず、崩れかけていました。'); }
  if(pc.id === 'ode' && ip.tempo === 0){ adj -= 2; out.push('テンポがやや重く感じます。'); }
  if(pc.id === 'galop' && ip.tempo === 2 && perf.bandR < 0.74){ adj -= 4; out.push('速さに指がついていかず、細かい音がつぶれて聞こえました。'); }
  if(pc.id === 'galop' && ip.tempo === 0){ adj -= 2; out.push('この曲にしては足どりが重く、はじけるような勢いがほしいところです。'); }
  if(pc.id === 'pomp' && ip.tempo === 2){ adj -= 3; out.push('急ぎ足に聞こえ、この旋律の堂々とした感じが出ていません。'); }
  if(pc.id === 'pomp' && ip.rub === 0){ adj -= 2; out.push('フレーズの終わりで、もう少し息をたっぷり使ってほしいところです。'); }
  if(pc.id === 'radetzky' && ip.tempo === 0){ adj -= 2; out.push('行進曲としては足取りが重く感じます。'); }
  if(pc.id === 'radetzky' && ip.tempo === 2 && perf.bandR < 0.72){ adj -= 4; out.push('速いテンポで短い音がそろわず、行進のリズムが落ち着きません。'); }
  if(pc.id === 'radetzky' && ip.rub === 2){ adj -= 3; out.push('行進曲でテンポを揺らしすぎて、足取りが乱れました。'); }
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
    if(i === 0 && a.thin >= 6) comments.push(a.thin >= 12 ? '少ない人数でよく工夫していますが、響きの厚みはまだこれからです。' : '人数がもう少しそろうと、響きに厚みが出てきそうです。');
    if(i === 0 && perf.conducted && perf.jitter > 0.12) comments.push('指揮の拍が安定せず、合奏が落ち着きませんでした。');
    if(!comments.length) comments.push('全体によくまとまっています。あと一歩の磨き込みを期待します。');
    return {name: j.name, score: sc, grade: sc >= L.A ? 'A' : sc >= L.B ? 'B' : 'C', comment: comments.join('')};
  });
  const avg = judges.reduce((s, j) => s + j.score, 0) / judges.length;
  const award = avg >= L.gold && judges.every(j => j.grade !== 'C') ? 'gold' : avg >= L.B - 4 ? 'silver' : 'bronze';
  const rep = !!L.rep && award === 'gold' && judges.every(j => j.grade === 'A');
  return {judges, avg, award, rep, level: levelId};
}
// 演奏会（コンクール以外）の出来：0〜100
function quality(a){
  const w = {pitch: .25, rhythm: .25, tone: .2, expr: .15, balance: .15};
  let s = 0;
  for(const k of Object.keys(w)) s += a.score[k] * w[k];
  return clamp(s - a.penalty, 0, 100);
}
