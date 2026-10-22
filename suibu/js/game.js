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
  22: {kind: 'concert', id: 'bunkasai', title: '文化祭ステージ', venue: 'gym', nerves: 2,
       text: '文化祭で、体育館のステージに立つ。クラスの友だちや家族が聴きに来る。'},
  [PREF_WEEK]:     {kind: 'contest', level: 'pref', title: '吹奏楽コンクール 県大会', venue: 'hall', nerves: 5},
  [BLOCK_WEEK]:    {kind: 'contest', level: 'block', title: '吹奏楽コンクール 支部大会', venue: 'grand', nerves: 8},
  [NATIONAL_WEEK]: {kind: 'contest', level: 'national', title: '全日本吹奏楽コンクール', venue: 'grand', nerves: 10},
};
// 3年生の最後の本番。コンクールが終わったあと、日にちはコンクールをどこまで勝ち進んだかで決まる（s.finalWeek）
const FINAL_EVENT = {kind: 'concert', id: 'teien', title: '定期演奏会（3年生の引退公演）', venue: 'civic', nerves: 4, final: true,
  text: '3年生にとって最後の本番。市民会館の大ホールに、家族や卒業生、近所の人たちが聴きに来る。'};
// コンクールで負けたあとの週には、その先の大会はない
const eventAt = (s, w) => w === s.finalWeek ? FINAL_EVENT : s.finalWeek && w > s.autumnFrom && EVENTS[w]?.kind === 'contest' ? null : EVENTS[w];
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
    v: 2, year, startYear: year, week: 0, phase: 'choose', pieceId: null, interp: {tempo: 1, dyn: 1, rub: 1},
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
    members: seated(s).map(m => ({id: m.id, name: m.name, grade: m.grade, seat: m.seat, trait: m.trait, mental: m.mental, stats: {...m.stats}})),
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
  venue: rec.venue, nerves: rec.snap.nerves || 0, fatigue: rec.snap.fatigue || 0, seed: 'band', form: rec.snap.form,
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
  s.lastEpisode = null;
  const ev = eventAt(s, s.week) || {};
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
    if(m.hallExp){ s.hallExp = clamp(s.hallExp + m.hallExp, 0, 100); for(const x of seated(s)) x.mental = clamp((x.mental ?? 40) + 1.5, 0, 100); }
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
  const ev = eventAt(s, s.week);
  if(ev){
    if(ev.morale) s.morale = clamp(s.morale + ev.morale, 0, 100);
    if(ev.kind !== 'contest') addLog(s, `【${ev.title}】${ev.text}`);
    else addLog(s, `いよいよ${ev.title}の週。`);
    if(ev.kind === 'assign') s.recruits = s.recruits || makeRecruits(s, 9);
  }
  s.episode = pickEpisode(s);
  // 本番の週になったら、その日の部員の調子を決めておく（読み込み直しても変わらない）
  const sev = eventAt(s, s.week);
  s.stageDay = sev && (sev.kind === 'concert' || sev.kind === 'contest') ? {seed: Math.floor(Math.random() * 1e9), calm: []} : null;
  return s;
}

/* ===== 部員のできごと =====
   練習の週に、ときどき部員の出来事が起きる。顧問としての対応を選ぶと、その部員や部の雰囲気が変わる。
   出来事は部員の「思い出」として残り、引退のときに振り返る。 */
const instOf = m => INST[SEAT[m.seat].inst].name;
const secOf = m => SEAT[m.seat]?.sec;
const REED = new Set(['ob', 'fg', 'ebcl', 'cl', 'bcl', 'asax', 'tsax', 'bsax']);
const LIP = new Set(['tp', 'hn', 'tb', 'btb', 'euph', 'tuba']);
const weakest = m => STAT_KEYS.slice().sort((a, b) => m.stats[a] - m.stats[b])[0];
function bump(m, k, d){ m.stats[k] = Math.round(clamp(m.stats[k] + d, 0, 100) * 10) / 10; }
function remember(s, m, t){
  if(!m) return;
  (m.story ||= []).push({y: s.year, w: s.week, t});
  if(m.story.length > 10) m.story.splice(0, m.story.length - 10);
}
const adj = (s, k, d) => { s[k] = clamp(s[k] + d, 0, 100); };
const senpai = (s, m) => s.members.filter(x => x.seat && x.id !== m.id && x.grade > m.grade && secOf(x) === secOf(m)).sort((a, b) => b.grade - a.grade)[0]
  || s.members.filter(x => x.seat && x.grade === 3)[0];
const contestAhead = s => eventAt(s, s.week + 1)?.kind === 'contest' ? eventAt(s, s.week + 1) : null;

// who：その出来事の主役になれる部員（2人必要なものは pair で相手を選ぶ）
const EPISODES = [
  {id: 'doubt', who: s => seated(s).filter(m => m.grade === 1 && avgStat(m) < 30),
   text: (s, m) => `練習のあと、1年生の${m.name}（${instOf(m)}）が音楽室に残っていた。「みんなみたいに吹けなくて……。向いてないのかもしれません」`,
   choices: [
     {label: 'いっしょにロングトーンをする', go: (s, m) => { bump(m, 'tone', 4); bump(m, 'pitch', 2); adj(s, 'stamina', -3);
       remember(s, m, '自信をなくした日に、顧問とふたりでロングトーンをした。'); return `しばらく二人でロングトーンをした。帰りぎわ、${m.name}は「また明日も来ます」と言った。`; }},
     {label: '同じパートの先輩に話を聞いてもらう', go: (s, m) => { const o = senpai(s, m); bump(m, 'expr', 3); adj(s, 'cohesion', 3); m.mental = clamp((m.mental ?? 40) + 4, 0, 100);
       remember(s, m, `自信をなくした日に、先輩の${o ? o.name : ''}が話を聞いてくれた。`); remember(s, o, `後輩の${m.name}の相談に乗った。`);
       return `${o ? o.name : '先輩'}が、自分も1年生のころは同じだったと話してくれたらしい。次の日、二人で個人練習をしていた。`; }},
     {label: '「あせらなくていい」と伝える', go: (s, m) => { adj(s, 'morale', 2);
       remember(s, m, '「あせらなくていい」と言われて、少し楽になった。'); return `${m.name}は少しほっとした顔で帰っていった。`; }},
   ]},
  {id: 'early', who: s => seated(s).filter(m => m.trait !== 'shy'),
   text: (s, m) => `${m.name}（${instOf(m)}）が毎朝7時から自主練をしていると、守衛さんが教えてくれた。`,
   choices: [
     {label: 'みんなの前でほめる', go: (s, m) => { bump(m, weakest(m), 3); adj(s, 'morale', 2);
       for(const x of seated(s)) if(x.id !== m.id && secOf(x) === secOf(m)) bump(x, weakest(x), 1);
       remember(s, m, 'ひとりで続けていた朝練を、みんなの前でほめられた。'); return '照れくさそうにしていたが、次の日から同じパートの朝練に来る部員が増えた。'; }},
     {label: 'こっそり声をかける', go: (s, m) => { bump(m, weakest(m), 4);
       remember(s, m, '朝練をしていたら、顧問にこっそり声をかけられた。'); return `「見てたんですか」と、${m.name}は笑っていた。`; }},
     {label: '無理をしないよう伝える', go: (s, m) => { bump(m, weakest(m), 1); adj(s, 'stamina', 4);
       remember(s, m, '朝練のしすぎを心配された。'); return '朝練は週3回にすると約束した。'; }},
   ]},
  {id: 'reed', who: s => seated(s).filter(m => REED.has(SEAT[m.seat].inst)),
   text: (s, m) => `${m.name}（${instOf(m)}）のリードが割れてしまった。いちばんよく鳴る1枚だったらしく、落ち込んでいる。`,
   choices: [
     {label: '部費で新しい箱を買う', go: (s, m) => { bump(m, 'tone', 3); adj(s, 'morale', 1);
       remember(s, m, '大事なリードが割れた日、新しい箱から一緒に選んでもらった。'); return `新しい箱から、よく鳴るリードを${m.name}と一緒に選んだ。`; }},
     {label: '残りのリードを調整して育てる', go: (s, m) => { bump(m, 'tone', 2); bump(m, 'pitch', 2);
       remember(s, m, 'リードを削って調整するやり方を覚えた。'); return 'リードを少しずつ削って調整するやり方を覚えた。手間はかかるが、音が安定してきた。'; }},
     {label: '先輩に分けてもらう', go: (s, m) => { const o = senpai(s, m); bump(m, 'tone', 1); adj(s, 'cohesion', 2);
       remember(s, m, `${o ? o.name : '先輩'}にリードを分けてもらった。`); return `${o ? o.name : '先輩'}が「これ、よく鳴るよ」と1枚くれた。`; }},
   ]},
  {id: 'lip', who: s => seated(s).filter(m => LIP.has(SEAT[m.seat].inst)),
   text: (s, m) => `${m.name}（${instOf(m)}）が唇を痛めたらしい。高い音を吹くと痛むという。`,
   choices: [
     {label: '今週は軽めにさせる', go: (s, m) => { bump(m, 'tone', -1); adj(s, 'morale', 1); s.fam[s.pieceId] = clamp((s.fam[s.pieceId] || 0) + 1, 0, 100);
       remember(s, m, '唇を痛めて、楽譜とにらめっこした週があった。'); return `${m.name}は今週、楽譜を読み込んで過ごした。歌いながら指を動かしている。`; }},
     {label: '吹き方を基礎から見直す', go: (s, m) => { bump(m, 'tone', 3); bump(m, 'pitch', 2); adj(s, 'stamina', -2);
       remember(s, m, '唇を痛めたのをきっかけに、吹き方を基礎から見直した。'); return '力まずに吹く練習をした。前より楽に高い音が出るようになった。'; }},
   ]},
  {id: 'clash', pair: true, who: s => seated(s).filter(m => m.grade >= 2 && seated(s).some(x => x.id !== m.id && x.grade >= 2 && secOf(x) === secOf(m))),
   other: (s, m) => seated(s).filter(x => x.id !== m.id && x.grade >= 2 && secOf(x) === secOf(m)),
   text: (s, m, o) => `${m.name}と${o.name}（${SEC[secOf(m)].name}）が、フレーズの吹き方で言い合いになった。パート練習の空気が重い。`,
   choices: [
     {label: '二人で話し合わせる', go: (s, m, o) => { bump(m, 'expr', 2); bump(o, 'expr', 2); adj(s, 'cohesion', 4); adj(s, 'morale', -2);
       remember(s, m, `${o.name}とフレーズの吹き方でぶつかって、最後は二人でそろえた。`); remember(s, o, `${m.name}とフレーズの吹き方でぶつかって、最後は二人でそろえた。`);
       return 'しばらく口をきかなかったが、次の合奏では二人の吹き方がぴったりそろっていた。'; }},
     {label: '合奏で両方を聴き比べる', go: (s, m, o) => { bump(m, 'expr', 1); bump(o, 'expr', 1); adj(s, 'stamina', -4); s.fam[s.pieceId] = clamp((s.fam[s.pieceId] || 0) + 3, 0, 100);
       const win = avgStat(m) >= avgStat(o) ? m : o, lose = win === m ? o : m;
       remember(s, win, '合奏で聴き比べて、自分の吹き方が採用された。'); remember(s, lose, `合奏で聴き比べて、${win.name}の吹き方に合わせることにした。`);
       return `みんなで聴き比べて、${win.name}の吹き方に決まった。${lose.name}も「聴いたら納得した」と言っていた。`; }},
     {label: '顧問が決める', go: (s, m, o) => { adj(s, 'morale', -1); adj(s, 'cohesion', 1);
       return 'とりあえず収まったが、二人ともどこか不満そうだ。'; }},
   ]},
  {id: 'birthday', who: s => seated(s),
   text: (s, m) => `今日は${m.name}（${instOf(m)}）の誕生日。パートのみんながこっそりケーキを用意している。`,
   choices: [
     {label: '練習の前に少しだけお祝いする', go: (s, m) => { adj(s, 'morale', 5); adj(s, 'cohesion', 2); adj(s, 'stamina', 2);
       remember(s, m, '誕生日に、パートのみんながハッピーバースデーを吹いてくれた。'); return 'パートのみんながハッピーバースデーを吹いて、音楽室が笑い声でいっぱいになった。'; }},
     {label: '練習が終わってからにしてもらう', go: (s, m) => { adj(s, 'morale', 2);
       remember(s, m, '誕生日に、練習のあとでみんなとケーキを分けた。'); return '練習のあと、みんなでケーキを分けた。'; }},
   ]},
  {id: 'leader', who: s => seated(s).filter(m => m.title === 'パートリーダー'),
   text: (s, m) => `パートリーダーの${m.name}（${instOf(m)}）が、パート練習の進め方をノートにまとめてきた。`,
   choices: [
     {label: '任せてみる', go: (s, m) => { for(const x of seated(s)) if(secOf(x) === secOf(m)) bump(x, weakest(x), 1.5); bump(m, 'expr', 2); adj(s, 'morale', 2);
       remember(s, m, 'パートリーダーとして、パート練習を任された。'); return `${m.name}の仕切りで、${SEC[secOf(m)].name}パートの練習が見違えるように引き締まった。`; }},
     {label: '顧問もいっしょに見る', go: (s, m) => { for(const x of seated(s)) if(secOf(x) === secOf(m)){ bump(x, 'pitch', 1); bump(x, 'rhythm', 1); }
       remember(s, m, 'パート練習の計画を、顧問と一緒に練った。'); return 'ノートをもとに、二人で練習の順番を組み直した。'; }},
   ]},
  {id: 'obog', who: s => s.week >= 4 ? seated(s).filter(m => m.grade === 3) : [],
   text: (s, m) => '卒業したOB・OGが、差し入れを持って遊びに来てくれた。',
   choices: [
     {label: '合奏を聴いてもらう', go: (s, m) => { s.hallExp = clamp(s.hallExp + 15, 0, 100); adj(s, 'morale', 3); adj(s, 'cohesion', 2);
       remember(s, m, 'OB・OGの前で合奏して、「去年よりまとまってる」と言われた。'); return '「去年より音がまとまってる」と言われて、3年生がうれしそうだった。人前で吹く練習にもなった。'; }},
     {label: 'パートごとに教えてもらう', go: (s, m) => { for(const x of seated(s)) bump(x, weakest(x), 1);
       return 'パートごとに、先輩たちが自分のころの練習を教えてくれた。'; }},
   ]},
  {id: 'firstrun', who: s => seated(s).filter(m => m.grade === 1 && m.exp === false && avgStat(m) >= 24),
   text: (s, m) => `初心者で入ってきた${m.name}（${instOf(m)}）が、はじめて合奏で最後まで落ちずに吹ききった。`,
   choices: [
     {label: 'みんなの前でほめる', go: (s, m) => { bump(m, 'expr', 3); adj(s, 'morale', 3); m.mental = clamp((m.mental ?? 40) + 6, 0, 100);
       remember(s, m, 'はじめて合奏で最後まで吹ききって、みんなに拍手された。'); return `部員から自然に拍手が起きた。${m.name}は真っ赤になっていた。`; }},
     {label: 'あとでこっそり声をかける', go: (s, m) => { bump(m, weakest(m), 3);
       remember(s, m, 'はじめて合奏で最後まで吹ききった日、顧問に声をかけられた。'); return `「ほんとですか！」と、${m.name}はうれしそうに楽器を抱えた。`; }},
   ]},
  {id: 'exam', who: s => s.week >= 8 ? seated(s).filter(m => m.grade === 3) : [],
   text: (s, m) => `3年生の${m.name}（${instOf(m)}）が、受験勉強と部活の両立に悩んでいるようだ。`,
   choices: [
     {label: 'コンクールまでいっしょにやりきろうと話す', go: (s, m) => { bump(m, 'expr', 3); adj(s, 'morale', 1);
       remember(s, m, '受験と部活の両立に悩んで、最後までやりきると決めた。'); return `「最後までやりきります」と、${m.name}ははっきり言った。`; }},
     {label: '練習を早めに切り上げてもいいと伝える', go: (s, m) => { bump(m, 'tone', -1); bump(m, 'rhythm', -1); adj(s, 'morale', 2);
       remember(s, m, '受験勉強のため、練習を早めに切り上げながら最後まで続けた。'); return `${m.name}は放課後の前半だけ練習に来ることになった。その分、集中して吹いている。`; }},
   ]},
  {id: 'timp', who: s => seated(s).filter(m => secOf(m) === 'perc'),
   text: (s, m) => `${m.name}（パーカッション）が、ティンパニの皮がへたってきていると言ってきた。`,
   choices: [
     {label: '思い切って張り替える', go: (s, m) => { bump(m, 'tone', 4); bump(m, 'pitch', 2);
       remember(s, m, 'ティンパニの皮を張り替えて、音が変わったのに感動した。'); return '張り替えたティンパニは、驚くほど音程がはっきりした。'; }},
     {label: '耳でチューニングする練習をする', go: (s, m) => { bump(m, 'pitch', 3);
       remember(s, m, 'ティンパニを耳でチューニングする練習を始めた。'); return `${m.name}は、合奏の前に耳だけでチューニングする練習を始めた。`; }},
   ]},
  {id: 'score', who: s => s.pieceId ? seated(s) : [],
   text: (s, m) => `${m.name}（${instOf(m)}）が、自由曲の楽譜をなくしたと青い顔をしている。`,
   choices: [
     {label: 'いっしょに探す', go: (s, m) => { adj(s, 'stamina', -3); adj(s, 'morale', 1);
       remember(s, m, '自由曲の楽譜をなくして大騒ぎした。楽器ケースのポケットから出てきた。'); return '楽器ケースのポケットから出てきた。二人で大笑いした。'; }},
     {label: 'コピーを渡して、書き込みを写させる', go: (s, m) => { bump(m, 'expr', 2);
       remember(s, m, 'なくした楽譜の書き込みを、先輩の楽譜から写した。'); return '先輩の楽譜から書き込みを写しているうちに、フレーズの意味がわかってきたらしい。'; }},
   ]},
  {id: 'eve', always: s => !!contestAhead(s), who: s => seated(s).filter(m => m.title === '部長'),
   text: (s, m) => `${contestAhead(s).title}の前の週。部長の${m.name}が「最後にもう一回、通させてください」と言ってきた。`,
   choices: [
     {label: '通してから帰す', go: (s, m) => { s.fam[s.pieceId] = clamp((s.fam[s.pieceId] || 0) + 3, 0, 100); adj(s, 'cohesion', 2); adj(s, 'stamina', -6);
       remember(s, m, `${contestAhead(s).title}の前の週、部長として「もう一回通させてください」と頼んだ。`); return '通し終わると、誰も何も言わずに楽器を片づけた。いい顔をしていた。'; }},
     {label: '今日は早く帰して休ませる', go: (s, m) => { adj(s, 'stamina', 8); adj(s, 'morale', 2);
       remember(s, m, `${contestAhead(s).title}の前の週、「休むのも練習」と言われて早く帰った。`); return '「明日のために休むのも練習」と伝えた。みんな素直に帰っていった。'; }},
   ]},
  {id: 'lastweek', always: s => s.finalWeek === s.week + 1, who: s => seated(s).filter(m => m.grade === 3),
   text: (s, m) => `定期演奏会の前の週。3年生の${m.name}たちが、後輩に楽譜の書き込みや練習ノートを渡していた。`,
   choices: [
     {label: '3年生と最後の合奏をする', go: (s, m) => { s.fam[s.pieceId] = clamp((s.fam[s.pieceId] || 0) + 3, 0, 100); adj(s, 'morale', 3);
       for(const x of seated(s)) if(x.grade === 3) remember(s, x, '定期演奏会の前の週、後輩たちと最後の合奏をした。');
       return '最後の音がホールの残響のように音楽室に残った。誰もすぐには楽器を下ろさなかった。'; }},
     {label: '3年生にひとことずつ話してもらう', go: (s, m) => { adj(s, 'cohesion', 5); adj(s, 'morale', 5);
       for(const x of seated(s)) if(x.grade === 3) remember(s, x, '定期演奏会の前の週、後輩たちの前でひとこと話した。');
       return `${m.name}が最初に話し、途中で声をつまらせた。後輩たちは真剣に聞いていた。`; }},
   ]},
];
const EPISODE_BY = Object.fromEntries(EPISODES.map(e => [e.id, e]));

// 練習の週に、出来事を起こすかどうかと、どれを誰に起こすかを決める（同じ年に同じ出来事はくり返さない）
function pickEpisode(s){
  if(s.phase !== 'week') return null;
  const ev = eventAt(s, s.week);
  if(ev && ev.kind !== 'mod') return null;
  const flag = ep => `ep:${s.year}:${ep.id}${ep.always ? ':' + s.week : ''}`;
  const used = ep => s.flags[flag(ep)];
  const able = EPISODES.filter(ep => !used(ep) && (!ep.always || ep.always(s)) && ep.who(s).length);
  const forced = able.filter(ep => ep.always);
  let pool = forced.length ? forced : able.filter(ep => !ep.always);
  if(!pool.length) return null;
  if(!forced.length && (s.episodeWeek === s.week - 1 || hash(s.year, s.week, 'ep') > 0.4)) return null;
  const ep = pool[Math.floor(hash(s.year, s.week, 'which') * pool.length)];
  const cands = ep.who(s);
  const m = cands[Math.floor(hash(s.year, s.week, 'who') * cands.length)];
  let o = null;
  if(ep.pair){ const os = ep.other(s, m); o = os[Math.floor(hash(s.year, s.week, 'other') * os.length)]; }
  s.flags[flag(ep)] = true;
  s.episodeWeek = s.week;
  return {id: ep.id, mid: m.id, oid: o ? o.id : null};
}
const episodeView = s => {
  const e = s.episode, ep = e && EPISODE_BY[e.id];
  if(!ep) return null;
  const m = s.members.find(x => x.id === e.mid), o = e.oid ? s.members.find(x => x.id === e.oid) : null;
  if(!m || (e.oid && !o)) return null;
  return {ep, m, o, text: ep.text(s, m, o), choices: ep.choices.map(c => c.label)};
};
function resolveEpisode(s0, k){
  const s = clone(s0);
  const v = episodeView(s);
  s.episode = null;
  if(!v) return s;
  const c = v.ep.choices[k];
  const res = c.go(s, v.m, v.o);
  addLog(s, `【できごと】${v.text}`);
  addLog(s, `→ ${c.label}。${res}`);
  s.lastEpisode = {text: v.text, choice: c.label, result: res};
  return s;
}

// 耳でチューニングの結果：合わせられた部員ほど音程が上がる（週に1回）
function tuneReward(s0, results){
  const s = clone(s0);
  s.flags[`tg:${s.year}:${s.week}`] = true;
  const good = [];
  for(const r of results){
    const m = s.members.find(x => x.id === r.mid);
    if(!m) continue;
    const a = Math.abs(r.res);
    bump(m, 'pitch', a <= 3 ? 2 : a <= 8 ? 1 : 0.3);
    if(a <= 3) good.push(m.name);
  }
  addLog(s, `耳でチューニングをした。${good.length ? good.join('、') + 'の音が、うなりなくぴったり合った。' : 'うなりを聴き分けるのは、まだむずかしい。'}`);
  return s;
}

/* ===== 演奏会・コンクール ===== */
// 本番を始めるときの条件をそろえて記録する（音は画面側で鳴らす）
function beginStage(s0){
  const s = clone(s0);
  const ev = eventAt(s, s.week);
  const nerves = nervesFor(s, ev);
  const rec = addRec(s, `${s.year} ${ev.title}`, {venue: ev.venue, nerves, form: stageForm(s)});
  rec.keep = ev.kind === 'contest' || !!ev.final;
  if(ev.final) rec.final = true;
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
  s.pending.mental = perf.mental || [];
}
// 本番を自分で指揮したとき：その拍の進み方で演奏し直したものを採点する
function conductStage(s0, conduct){
  const s = clone(s0);
  const ev = eventAt(s, s.week), p = s.pending;
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
  if(ev.id === 'bunkasai'){
    const dm = Math.round(q / 10) - 1;
    return {morale: dm, text: q >= 60 ? '体育館がいっぱいになり、アンコールの声がかかった。クラスの友だちが「すごかった」と言いに来た。' : q >= 35 ? '家族やクラスの友だちが、あたたかい拍手をくれた。' : '体育館の響きにのまれてしまったが、来てくれた人たちは最後まで聴いてくれた。'};
  }
  if(ev.id === 'teien'){
    return {morale: 0, text: q >= 60 ? '満員の客席から、いつまでも拍手が鳴りやまなかった。3年生の目が赤かった。' : q >= 35 ? '客席から大きな拍手が送られた。3年生は晴れやかな顔でステージを降りた。' : '思うようにはいかなかったが、3年生は最後まで吹ききった。客席からあたたかい拍手が送られた。'};
  }
  const j = judge(perf, a, 'pref');
  const dm = Math.round(q / 12) - 2;
  return {morale: dm, text: `よその学校の先生から講評をもらった。「${j.judges[0].comment}」`};
}
/* ===== 本番の調子（メンタル） =====
   本番の日、部員ごとに調子の揺れが決まる。メンタルが弱い部員ほど揺れが大きく、ときどき頭が真っ白になる。
   強い部員は落ち着いていて、ときどきいつも以上の音が出る。部全体にもその日の空気がある。
   舞台袖でできることは2回まで（一人に声をかける、全員で深呼吸する）。 */
// 部全体の空気（やる気が高いと落ち着いている。全員で深呼吸すると少し和らぐ）
function bandForm(s){
  if(!s.stageDay) return 0;
  return clampG(gauss(s.stageDay.seed, 'band')) - (s.morale - 60) / 60 - (s.stageDay.huddle ? 0.7 : 0);
}
function stageForm(s){
  if(!s.stageDay) return null;
  const f = {}, zb = bandForm(s);
  for(const m of seated(s)) f[m.id] = Math.round((0.55 * zb + 0.84 * gauss(s.stageDay.seed, m.id, 'form') - (s.stageDay.calm.includes(m.id) ? 0.7 : 0)) * 100) / 100;
  return f;
}
const wingActions = s => s.stageDay ? s.stageDay.calm.length + (s.stageDay.huddle ? 1 : 0) : 0;
// 舞台袖で、見るからに緊張している部員（メンタルが弱く、今日の揺れが大きい）
function tenseMembers(s){
  const f = stageForm(s);
  if(!f) return [];
  return seated(s).filter(m => (m.mental ?? 40) < 50 && (f[m.id] > 0.6 || s.stageDay.calm.includes(m.id)))
    .sort((a, b) => (f[b.id] + (s.stageDay.calm.includes(b.id) ? 0.7 : 0)) - (f[a.id] + (s.stageDay.calm.includes(a.id) ? 0.7 : 0))).slice(0, 3);
}
function calmMember(s0, mid){
  const s = clone(s0);
  if(s.stageDay && wingActions(s) < 2 && !s.stageDay.calm.includes(mid)) s.stageDay.calm.push(mid);
  return s;
}
function huddle(s0){
  const s = clone(s0);
  if(s.stageDay && wingActions(s) < 2) s.stageDay.huddle = true;
  return s;
}
// 本番のあと：場数を踏んだぶんメンタルが強くなる。頭が真っ白になった部員・いつも以上だった部員は思い出に残る
function stageAftermath(s, ev, p){
  for(const m of seated(s)) m.mental = clamp((m.mental ?? 40) + (ev.kind === 'contest' ? 4 : 2), 0, 100);
  for(const x of p.mental || []){
    const m = s.members.find(y => y.id === x.mid);
    if(!m) continue;
    if(x.kind === 'freeze'){ m.mental = clamp(m.mental + 3, 0, 100); remember(s, m, `${ev.title}の本番で、緊張して頭が真っ白になった。`); }
    else remember(s, m, `${ev.title}の本番で、これまでで一番の音が出た。`);
  }
  const names = kind => (p.mental || []).filter(x => x.kind === kind).map(x => s.members.find(y => y.id === x.mid)?.name).filter(Boolean);
  if(names('freeze').length) addLog(s, `${names('freeze').join('、')}は、本番で緊張に飲まれてしまった。`);
  if(names('zone').length) addLog(s, `${names('zone').join('、')}は、本番でいつも以上の音を出した。`);
}

function finishStage(s0){
  const s = clone(s0);
  const p = s.pending;
  const ev = eventAt(s, s.week);
  if(!p) return s;
  stageAftermath(s, ev, p);
  if(p.kind === 'concert'){
    if(p.recruits) s.recruits = makeRecruits(s, p.recruits);
    if(p.morale) s.morale = clamp(s.morale + p.morale, 0, 100);
    addLog(s, `${ev.title}：${p.text}`);
    s.stamina = clamp(s.stamina - 8, 0, 100);
    if(ev.final) s.finalResult = {piece: PIECES[s.pieceId].title, q: Math.round(p.q)};
    return ev.final ? endSeason(s) : nextWeek(s);
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
  return startAutumn(s);
}
// コンクールが終わったら、3年生の最後の本番（定期演奏会）に向けて秋の練習。夏休みのうちに終わったときは2学期から
function startAutumn(s){
  s.finalWeek = Math.max(26, s.week + 4);
  s.autumnFrom = s.week;
  s.contestPiece = s.pieceId;
  s.chooseFinal = true;
  addLog(s, `コンクールが終わった。3年生の最後の本番は、${wkLabel(s.finalWeek)}の定期演奏会。`);
  if(s.week < 19){ s.week = 19; addLog(s, '夏休みが明けて、2学期が始まった。'); }
  return nextWeek(s);
}
// 定期演奏会で演奏する曲を決める（コンクールの曲をもう一度でも、新しい曲でもよい）
function chooseFinalPiece(s0, pid){
  const s = clone(s0);
  s.pieceId = pid; s.chooseFinal = false;
  addLog(s, pid === s.contestPiece ? `定期演奏会でも、コンクールで演奏した${PIECES[pid].title}をもう一度演奏することにした。` : `定期演奏会では、新しく${PIECES[pid].full}に挑戦することにした。`);
  return s;
}
function endSeason(s){
  s.phase = 'end';
  s.pending = null;
  const seniors = s.members.filter(m => m.grade === 3);
  addLog(s, `定期演奏会が終わり、3年生${seniors.length}人が引退した。`);
  return s;
}
// 顧問になった年に、1年生として入部してきた部員（いちばん最初に一から育てた代）
const startYearOf = s => s.startYear ?? (s.history[0]?.year ?? s.year);
const isFirstClass = (s, m) => m.joined === startYearOf(s) && m.first?.y === m.joined;
function newYear(s0){
  const s = clone(s0);
  const pid = s.contestPiece || s.pieceId, pieceTitle = pid ? PIECES[pid].title : '';
  const seniors = s.members.filter(m => m.grade === 3);
  s.history.push({year: s.year, piece: pieceTitle, results: s.season, final: s.finalResult || null,
    retired: seniors.map(m => m.name), firstClass: seniors.some(m => isFirstClass(s, m))});
  if(seniors.some(m => isFirstClass(s, m))) addLog(s, '顧問になって最初に入部してきた代が、卒業していった。部の物語は、これからも続く。');
  s.finalResult = null;
  s.members = s.members.filter(m => m.grade < 3).map(m => ({...m, grade: m.grade + 1}));
  assignTitles(s.members);
  s.year++; s.week = 0; s.phase = 'choose'; s.pieceId = null; s.season = []; s.pending = null; s.recruits = null;
  s.finalWeek = null; s.autumnFrom = null; s.contestPiece = null; s.chooseFinal = false;
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
    const stats = makeStats(base, r.exp ? 5 : 3, 'stat', r.id);
    s.members.push({id: r.id, name: r.name, grade: 1, seat, trait: r.trait, joined: s.year, exp: !!r.exp, mental: mentalInit(r.trait, 1, 'stat', r.id) + (r.exp ? 6 : 0),
      stats, first: {y: s.year, w: s.week, stats: {...stats}}, hope: r.hope});
  }
  const n = (s.recruits || []).length;
  s.morale = clamp(s.morale + happy * 1.5 - (n - happy), 0, 100);
  s.cohesion = clamp(s.cohesion - n * 0.8, 0, 100);
  addLog(s, `1年生${n}人の担当が決まった。希望どおりの楽器になったのは${happy}人。`);
  s.recruits = null;
  assignTitles(s.members);
  // 1年生が入って最初の合奏を残しておく（引退のとき、入部したころの音として聴ける）
  if(n && s.pieceId){
    const rec = addRec(s, `${s.year}年 1年生が入って最初の合奏`, {venue: 'room'});
    rec.keep = true;
    addLog(s, '新しい1年生も入って、最初の合奏を録音した。');
  }
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
      s.startYear ??= s.history[0]?.year ?? s.year;
      for(const m of s.members) m.mental ??= mentalInit(m.trait, m.grade, 'mig', m.id);
      return s;
    }
  }catch(e){}
  return null;
}
