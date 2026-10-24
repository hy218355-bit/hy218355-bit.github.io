'use strict';
/* 1年間の流れ：選曲 → 4月〜8月の練習と演奏会 → 県大会 →（代表なら）支部大会 → 全国大会 → 3年生の引退 → 次の年度 */

const SAVE_KEY = 'suibu-nisshi-v2';  // 前の名前（吹部日誌）のころからの保存先。変えるとセーブが読めなくなるので、このままにする
const PREF_WEEK = 16, BLOCK_WEEK = 20, NATIONAL_WEEK = 26;

// 部員ひとりずつに、週に1つ出す練習の指示。合奏と会場練習は、出た人の割合だけ部全体（まとまり・仕上がり・会場慣れ）に効く。
// read は、その人の譜読み（今の曲の自分の楽譜をどれだけ吹けるか）の伸び
const MENU = [
  {id: 'long',   name: 'ロングトーン',   up: '音色',   hint: '音色↑↑　音程↑',               cost: 14, gain: {tone: 20, pitch: 5}, read: 4},
  {id: 'tune',   name: 'チューニング',   up: '音程',   hint: '音程↑↑',                       cost: 12, gain: {pitch: 20, tone: 3}, read: 4},
  {id: 'metro',  name: 'メトロノーム',   up: 'リズム', hint: 'リズム↑↑',                     cost: 13, gain: {rhythm: 20, pitch: 3}, read: 4},
  {id: 'phrase', name: 'フレーズ練習',   up: '表現',   hint: '表現↑↑（基礎が要る）',         cost: 12, gain: {expr: 22}, basics: true, fam: 6, read: 10},
  {id: 'piece',  name: '曲の練習',       up: '譜読み', hint: '譜読み↑↑　曲の仕上がり↑',     cost: 12, gain: {rhythm: 4, expr: 4, pitch: 2}, fam: 20, read: 28},
  {id: 'tutti',  name: '合奏',                         hint: '全部↑　まとまり↑↑　仕上がり↑', cost: 18, gain: {pitch: 5, rhythm: 6, tone: 5, expr: 6}, coh: 12, fam: 16, read: 18, morale: 5, group: true},
  {id: 'hall',   name: '会場で合奏',                   hint: '会場慣れ↑↑　まとまり↑',        cost: 16, gain: {pitch: 3, rhythm: 3, tone: 3, expr: 3}, coh: 6, fam: 6, read: 10, hallExp: 45, morale: 3, from: 12, group: true},
  {id: 'rest',   name: '休む',                         hint: '体力とやる気が回復',            cost: -38, gain: {}, morale: 12},
];
const MENU_BY = Object.fromEntries(MENU.map(m => [m.id, m]));
const menuOpen = (s, id) => !MENU_BY[id].from || s.week >= MENU_BY[id].from;
// 部の方針：顧問が指示を出さなかった部員は、この方針で自分の練習を決める（部全体で1つ）。
// 曲はおまかせでも、譜読みの浅い部員は曲の練習をし、3週に1回と本番の前は合奏するので、「曲を仕上げる」は外した
const POLICIES = [
  {id: 'auto',   name: 'おまかせ',       desc: '苦手なところを中心に。3週に1回は合奏、本番の前は合奏'},
  {id: 'basics', name: '基礎を固める',   desc: 'ロングトーン・チューニング・メトロノームを、低いものから'},
  {id: 'easy',   name: '無理をさせない', desc: '体力が半分を切ったら休む。それ以外はおまかせと同じ'},
];
const POLICY_BY = Object.fromEntries(POLICIES.map(p => [p.id, p]));
const DRILL = {pitch: 'tune', rhythm: 'metro', tone: 'long', expr: 'phrase'};

const EVENTS = {
  1:  {kind: 'concert', id: 'shinkan', title: '新入生歓迎演奏', venue: 'gym', nerves: 3,
       text: '体育館で部活動紹介の演奏をする。演奏の出来しだいで、入部する1年生の数が変わる。',
       t0: '体育館で部活動紹介の演奏をする。できたばかりの小さな部。演奏しだいで、仲間が増えるかもしれない。'},
  2:  {kind: 'mod', title: '仮入部', morale: 6, text: '1年生が音楽室をのぞきに来た。先輩としての自覚で、やる気が上がった。',
       t0: '入部を迷っている1年生が、音楽室をのぞきに来た。仲間が増えるかもしれないと、やる気が上がった。'},
  3:  {kind: 'assign', title: '本入部・楽器決め', text: '1年生が正式に入部した。担当する楽器を決めよう。希望どおりだとやる気が上がる。',
       t0: '部活動紹介を見た1年生が、正式に入部してくれた。担当する楽器を決めよう。希望どおりだとやる気が上がる。'},
  4:  {kind: 'mod', title: 'GW一日練習', mult: 1.5, costMult: 1.25, text: '朝から夕方まで練習できる。練習の効果が1.5倍、体力の消費も増える。'},
  6:  {kind: 'concert', id: 'matsuri', title: 'みなと祭りステージ', venue: 'outdoor', nerves: 2,
       text: '商店街のお祭りで、屋外ステージに出演する。響きがないので、ごまかしがきかない。'},
  7:  {kind: 'forced', title: '中間テスト', text: 'テスト期間で部活は停止。練習はできないが、体力は戻る。'},
  10: {kind: 'mod', title: 'パート内のもめごと', morale: -12, text: '誰が1stを吹くかで、トランペットパートがぎくしゃくしている。やる気が下がった。',
       when: s => s.members.filter(m => secOf(m) === 'tp').length >= 2},
  11: {kind: 'concert', id: 'joint', title: '合同演奏会', venue: 'civic', nerves: 4,
       text: '市民会館で近くの高校と合同演奏会。よその学校の先生が講評をくれる。'},
  12: {kind: 'audition', title: 'コンクールメンバーのオーディション',
       text: 'コンクールに出るメンバーを決める。自由曲の一節を、一人ずつ吹いてもらった。人数が多いほど響きは厚くなるが、まだ吹けない部員が入ると音がそろわない。',
       when: s => seated(s).length >= 12},
  13: {kind: 'mod', title: '夏合宿', mult: 1.6, costMult: 1.3, venue: 'camp', text: '合宿所のホールで朝から晩まで合奏。練習の効果が1.6倍、体力の消費も1.3倍。'},
  14: {kind: 'mod', title: '夏合宿・後半', mult: 1.6, costMult: 1.3, venue: 'camp', text: '合宿の後半。疲れはたまるが、音はまとまってくる。'},
  22: {kind: 'concert', id: 'bunkasai', title: '文化祭ステージ', venue: 'gym', nerves: 2,
       text: '文化祭で、体育館のステージに立つ。クラスの友だちや家族が聴きに来る。'},
  [PREF_WEEK]:     {kind: 'contest', level: 'pref', title: '吹奏楽コンクール 県大会', venue: 'hall', nerves: 5},
  [BLOCK_WEEK]:    {kind: 'contest', level: 'block', title: '吹奏楽コンクール 支部大会', venue: 'grand', nerves: 8},
  [NATIONAL_WEEK]: {kind: 'contest', level: 'national', title: '全日本吹奏楽コンクール', venue: 'grand', nerves: 10},
};
// 年度の最後の本番（3年生がいれば引退公演）。コンクールが終わったあと、日にちはコンクールをどこまで勝ち進んだかで決まる（s.finalWeek）
const FINAL_EVENT = {kind: 'concert', id: 'teien', title: '定期演奏会（3年生の引退公演）', venue: 'civic', nerves: 4, final: true,
  text: '3年生にとって最後の本番。市民会館の大ホールに、家族や卒業生、近所の人たちが聴きに来る。'};
const FINAL_EVENT_JR = {...FINAL_EVENT, title: '定期演奏会',
  text: 'この1年の練習の成果を聴いてもらう、年度で最後の本番。市民会館の大ホールに、家族や近所の人たちが聴きに来る。'};
const hasSeniors = s => s.members.some(m => m.grade === 3);
// 部ができた最初の年（1年生だけで始めた年）
const foundingYear = s => !!s.founding && s.year === s.startYear;
function eventAt(s, w){
  if(w === s.finalWeek) return hasSeniors(s) ? FINAL_EVENT : FINAL_EVENT_JR;
  const ev = EVENTS[w];
  if(!ev) return null;
  // コンクールで負けたあとの週には、その先の大会はない
  if(s.finalWeek && w > s.autumnFrom && ev.kind === 'contest') return null;
  if(ev.when && !ev.when(s)) return null;
  return ev.t0 && foundingYear(s) ? {...ev, text: ev.t0} : ev;
}
const MILESTONES = [
  {k: 'tone',   at: 40, text: '音の出だしが安定してきた。音が裏返ることが減った。'},
  {k: 'pitch',  at: 50, text: 'ユニゾンのうなりがゆっくりになってきた。'},
  {k: 'rhythm', at: 50, text: '長い音を最後まで伸ばせるようになってきた。'},
  {k: 'expr',   at: 40, text: 'フレーズの山をどこに作るか、みんなで話し合うようになった。'},
  {k: 'pitch',  at: 72, text: '合奏で、和音がふっと「鳴った」。第3音を少し低めに取ると響くらしい。'},
  {k: 'rhythm', at: 75, text: 'テンポが走らなくなった。縦の線がそろってきた。'},
  {k: 'tone',   at: 75, text: '柔らかくて芯のある音になってきた。'},
  {k: 'expr',   at: 75, text: '指揮を見なくても、全員で自然にテンポを揺らせるようになった。'},
];

const wkMonth = w => 4 + Math.floor(w / 4);
const wkLabel = w => `${wkMonth(w)}月 第${w % 4 + 1}週`;
const wkShort = w => `${wkMonth(w)}月${w % 4 + 1}週`;

const freshFam = () => Object.fromEntries(PIECE_IDS.map(id => [id, 0]));
// 以前あった曲は、近い曲に置き換える（2026年10月に、だれもが知っている曲へ入れ替えた。ラデツキー行進曲は外して、同じ行進曲の「凱旋行進曲」へ）
const PIECE_MOVED = {march: 'aida', wa: 'galop', stars: 'aida', jupiter: 'holst', mountain: 'galop', radetzky: 'aida'};
function freshState(year = 2026){
  const s = {
    v: 2, year, startYear: year, founding: true, week: 0, phase: 'choose', pieceId: null, interp: {tempo: 1, dyn: 1, rub: 1}, policy: 'auto',
    members: [], recruits: null, plan: {}, rep: 5, seq: 0, trend: [], coach: {xp: 0},
    cohesion: 20, stamina: 100, morale: 75, fam: freshFam(), hallExp: 0,
    log: [], recs: [], history: [], season: [], flags: {}, pending: null, lastDelta: {},
  };
  s.recruits = makeRecruits(s, 5, {founders: true});
  addLog(s, `${year}年度、県立みなと高校吹奏楽部の顧問になった。部員がいなくなって休部していた部に、1年生が5人入部してきた。まずは担当する楽器を決めよう。`);
  return s;
}
function addLog(s, text){ s.log.push({y: s.year, w: s.week, text}); if(s.log.length > 160) s.log.splice(0, s.log.length - 160); }

const seated = s => s.members.filter(m => m.seat);
// 本番の舞台に上がる部員（コンクールの週は、オーディションで選んだメンバーだけ）
const stagers = s => eventAt(s, s.week)?.kind === 'contest' ? seated(s).filter(m => !m.out) : seated(s);
const bandAvg = (s, k) => { const ms = seated(s); return ms.length ? ms.reduce((a, m) => a + m.stats[k], 0) / ms.length : 0; };
// 席についている部員の、その曲の譜読みの平均（曲全体と、区間ごと）
const readAvg = (s, pid) => { const ms = seated(s); return ms.length ? ms.reduce((a, m) => a + readMean(m, pid), 0) / ms.length : 0; };
const spanReadAvg = (s, pid) => { const ms = seated(s); return PIECES[pid].spans.map((_, i) => ms.length ? ms.reduce((a, m) => a + readOf(m, pid)[i], 0) / ms.length : 0); };
const secMembers = (s, secId) => seated(s).filter(m => SEAT[m.seat].sec === secId);
const fatigueOf = s => s.stamina < 30 ? 8 : s.stamina < 50 ? 3 : 0;
// 体力は部員ひとりずつ。部の体力はその平均
function syncSta(s){
  for(const m of s.members) m.sta = clamp(m.sta ?? s.stamina ?? 100, 0, 100);
  s.stamina = s.members.length ? s.members.reduce((a, m) => a + m.sta, 0) / s.members.length : 100;
}
function nervesFor(s, ev){
  let n = ev?.nerves ?? 0;
  n *= s.morale < 45 ? 1.6 : s.morale < 65 ? 1.2 : 0.8;
  if(VENUE[ev?.venue]?.play.hall) n *= 1.3 - 0.6 * clamp01(s.hallExp / 100);
  // 本番を何度も経験した顧問だと、部員も落ち着いて舞台に上がれる（レベルごとに4%、Lv7 で24%まで）
  n *= 1 - Math.min(0.24, 0.04 * (coachLevel(s) - 1));
  return Math.round(n * 10) / 10;
}
// 練習の音のさいころは週ごとに変わる（同じ週なら、何度聴いても同じ音）
const weekTake = s => `${s.year}-${s.phase === 'choose' ? 'c' : s.week}`;
function perfCtx(s, o = {}){
  const pid = o.pieceId || s.pieceId || 'largo';
  return {
    members: o.members || stagers(s), pieceId: pid, cohesion: o.cohesion ?? s.cohesion, fam: o.fam ?? s.fam[pid] ?? 0,
    interp: o.interp || s.interp, venue: o.venue || 'room', nerves: o.nerves || 0, fatigue: o.fatigue ?? fatigueOf(s),
    seed: 'band', take: o.take ?? weekTake(s), from: o.from, to: o.to,
  };
}
function snapshot(s, extra = {}){
  return {
    members: stagers(s).map(m => ({id: m.id, name: m.name, grade: m.grade, seat: m.seat, trait: m.trait, mental: m.mental, stats: {...m.stats},
      pfams: readOf(m, extra.pieceId || s.pieceId), sp: {...(m.sp || {})}})),
    cohesion: s.cohesion, fam: s.fam[extra.pieceId || s.pieceId] ?? 0, interp: {...s.interp}, fatigue: fatigueOf(s), take: weekTake(s), ...extra,
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
  venue: rec.venue, nerves: rec.snap.nerves || 0, fatigue: rec.snap.fatigue || 0, seed: 'band', take: rec.snap.take, form: rec.snap.form,
  lead: rec.conduct?.taps ? (taps => b => leadAtTaps(taps, b))(rec.conduct.taps.map(([k, off]) => ({k, off}))) : undefined,
});

function choosePiece(s0, pid){
  const s = clone(s0);
  s.pieceId = pid; s.phase = 'week';
  addLog(s, `自由曲は${PIECES[pid].full}に決まった。最初の合奏を録音した。`);
  const rec = addRec(s, `${s.year}年4月の録音`, {pieceId: pid, venue: 'room'});
  rec.keep = true;
  // 年度の最初の週にも、だれかが相談に来る
  if(!s.episode && !s.consult) s.consult = pickConsult(s);
  return s;
}
function clone(s){ return JSON.parse(JSON.stringify(s)); }

/* ===== 練習 =====
   毎週、部員ひとりずつに練習を指示する。指示しなかった部員は、部の方針（s.policy）で自分の練習を決める。 */
const statOrder = (m, keys = STAT_KEYS) => keys.slice().sort((a, b) => m.stats[a] - m.stats[b]);
const basicsOf = m => (m.stats.pitch + m.stats.rhythm + m.stats.tone) / 3;
// 次の本番まで何週か（今週が本番なら0）
function stageIn(s, within){
  for(let w = s.week; w <= s.week + within; w++){ const ev = eventAt(s, w); if(ev && (ev.kind === 'concert' || ev.kind === 'contest')) return {w: w - s.week, ev}; }
  return null;
}
// 方針どおりなら、この部員は今週なにをするか
function decideMenu(s, m){
  const pol = POLICY_BY[s.policy] ? s.policy : 'auto';
  if((m.sta ?? 100) < (pol === 'easy' ? 50 : 30)) return 'rest';
  // 表現は、音程・リズム・音色の基礎がないと伸びない。基礎が足りないうちは基礎から
  const drill = k => k === 'expr' && basicsOf(m) < 30 ? DRILL[statOrder(m, ['pitch', 'rhythm', 'tone'])[0]] : DRILL[k];
  const soon = s.pieceId ? stageIn(s, 1) : null;
  if(pol === 'basics') return DRILL[statOrder(m, ['pitch', 'rhythm', 'tone'])[0]];
  // おまかせ：本番の前の週は合奏（大会の前でホールを借りられるなら会場で）。自分の譜読みがまだ浅ければ個人練習
  // （入ったばかりでほとんど吹けないなら合奏の週以外はずっと、まだ6割に届かないなら1週おき）。3週に1回は合奏
  if(soon) return soon.ev.kind === 'contest' && menuOpen(s, 'hall') ? 'hall' : 'tutti';
  const rd = s.pieceId ? readMean(m, s.pieceId) : 100;
  if(rd < 20 && s.week % 3 !== 2) return 'piece';
  if(rd < 60 && s.week % 2 === 1 && s.week % 3 !== 2) return 'piece';
  if(s.pieceId && s.week % 3 === 2) return 'tutti';
  return drill(statOrder(m)[0]);
}
/* ===== 顧問の指導力 =====
   顧問（あなた）も、部活を続けるほど指導がうまくなる。毎週の練習・本番・コンクール・部員のできごとで経験がたまり、
   レベルが上がるごとに、部員の練習の伸び（力・譜読み・仕上がり・まとまり）が大きくなる。
   本番の緊張も、レベルごとに少しずつやわらぐ。最初の数年はほとんど効かず、何年も続けた部ほど全国大会が見えてくる */
const COACH_TITLES = ['新米顧問', '部活に慣れてきた顧問', '部員に頼られる顧問', '指導に定評のある顧問', '県内で知られた指導者', '他校からも相談される指導者', '全国を知る指導者', '名指導者'];
const coachNeed = lv => 45 * (lv - 1) + 5 * (lv - 1) * (lv - 2);   // そのレベルになるまでの経験の合計
function coachLevel(s){
  const xp = s.coach?.xp || 0;
  let lv = 1;
  while(lv < 12 && xp >= coachNeed(lv + 1)) lv++;
  return lv;
}
// 効き目は、はじめはゆっくり、レベルが上がるほど大きく（Lv2 +4%・Lv3 +10%・Lv4 +18%・Lv5 +28%・Lv6 +40%・Lv7 +54%）
const coachMult = s => { const d = coachLevel(s) - 1; return 1 + 0.03 * d + 0.01 * d * d; };
const coachTitle = lv => COACH_TITLES[Math.min(lv, COACH_TITLES.length) - 1];
function gainCoach(s, xp){
  const before = coachLevel(s);
  (s.coach ||= {xp: 0}).xp += xp;
  const lv = coachLevel(s);
  if(lv > before){
    addLog(s, `顧問の指導力が Lv${lv}（${coachTitle(lv)}）に上がった。部員の練習の効果が +${Math.round((coachMult(s) - 1) * 100)}% になった。`);
    s.coachUp = lv;
  }
}
/* ===== スキルと育ち方 =====
   addSkill：スキルの育ち具合を足す（練習なら少しずつ、相談への答えなら一度に）。○・◎になったら日誌と思い出に残して知らせる
   bend：その子の育ち方（その力が練習で伸びやすくなる。1つの力につき +20% まで） */
// quiet：日誌には書かない（呼んだ側でまとめて書く）。レベルが上がったら true を返す
function addSkill(s, m, id, d, quiet){
  if(!m || !SKILLS[id]) return false;
  const before = skillLv(m, id);
  (m.sp ||= {})[id] = Math.round(Math.min(3, (m.sp[id] || 0) + d) * 100) / 100;
  const lv = skillLv(m, id);
  if(lv <= before) return false;
  const nm = `${SKILLS[id].name}${skillMark(lv)}`;
  if(!quiet) addLog(s, `${m.name}が、スキル「${nm}」を身につけた。${SKILLS[id].desc}。`);
  remember(s, m, `スキル「${nm}」を身につけた。`);
  (s.skillUp ||= []).push({mid: m.id, id, lv});
  return true;
}
function bend(m, k, d){ (m.bent ||= {})[k] = Math.round(clamp((m.bent[k] || 0) + d, 0, 0.2) * 100) / 100; }
// 練習の伸びの倍率：その子の育ち方・スキルと、同じパートの面倒見のいい部員・柱
const growMult = (s, m, k) => 1 + (m.bent?.[k] || 0) + skillsOf(m).reduce((a, x) => a + (x.grow?.[k] || 0) * x.lv, 0) + sectionAura(s.members, m, 'grow');
// 練習の種類ごとに、少しずつ育つスキル（17回ほどで○、40回ほどで◎）
const PRACTICE_SKILL = {long: 'breath', tune: 'ear', metro: 'groove', phrase: 'song', piece: 'reader'};
// 何も決めることのない練習の週か（「次の予定まで進める」が止まらずに進めてよい週）
// 本番・オーディション・テスト・入部・できごと・行事のおさそい・定期演奏会の曲決めがある週は止まる。GW や合宿などの週と、相談だけの週は進める
const quietWeek = s => s.phase === 'week' && !s.pending && !s.chooseFinal && !recruitsDue(s) && !episodeView(s) && !s.outing
  && (!eventAt(s, s.week) || eventAt(s, s.week).kind === 'mod');
// 今週の指示：顧問が個別に出した指示（s.plan）が優先、なければ方針どおり
const planFor = (s, m) => (s.plan && MENU_BY[s.plan[m.id]] && menuOpen(s, s.plan[m.id])) ? s.plan[m.id] : decideMenu(s, m);
function setPlan(s0, mid, menu){
  const s = clone(s0);
  s.plan ||= {};
  if(menu) s.plan[mid] = menu; else delete s.plan[mid];
  return s;
}
// 曲の個人練習で打ちこむ区間（指示がなければ、いちばん吹けていない区間）
function practiceSpan(s, m){
  const units = readUnits(s.pieceId), want = s.planSpan?.[m.id];
  if(units.some(u => u.i === want)) return want;
  const v = readOf(m, s.pieceId);
  return units.reduce((a, u) => v[u.i] < v[a.i] ? u : a).i;
}
function setPlanSpan(s0, mid, i){
  const s = clone(s0);
  s.planSpan ||= {};
  if(i == null) delete s.planSpan[mid]; else s.planSpan[mid] = i;
  return s;
}
// 部の方針を変えると、部員ごとに出していた今週の指示は取り消す
function setPolicy(s0, pol){
  const s = clone(s0);
  s.policy = pol; s.plan = {};
  return s;
}
// plan：{部員id: メニュー} の個別指示（ほかの部員は方針どおり）。'test' はテスト期間、メニューidの文字列なら全員その練習
function practiceWeek(s0, plan){
  const s = clone(s0);
  s.lastEpisode = null;
  // 答えなかった相談や、だれも行かなかった行事は、そのまま流れる
  s.consult = null; s.lastConsult = null; s.outing = null; s.lastOuting = null;
  const ev = eventAt(s, s.week) || {};
  syncSta(s);
  if(plan === 'test'){
    for(const m of s.members) m.sta = clamp(m.sta + 30, 0, 100);
    s.morale += 2; s.lastDelta = {};
    for(const m of s.members){ m.stats.pitch = Math.max(0, m.stats.pitch - 1); m.last = {menu: 'test', d: {pitch: -1}}; }
    addLog(s, 'テスト期間。楽器に触れない日が続いて、少し音程の感覚が鈍った。');
    s.plan = {}; s.planSpan = {};
    return nextWeek(s);
  }
  if(typeof plan === 'string') s.plan = Object.fromEntries(s.members.map(m => [m.id, plan]));
  else if(plan) s.plan = {...s.plan, ...plan};
  const ms = s.members, n = ms.length || 1, cmul = coachMult(s);
  const pick = Object.fromEntries(ms.map(m => [m.id, planFor(s, m)]));
  const count = id => ms.filter(m => pick[m.id] === id).length;
  // 合奏は2人以上いないとできない。出た人の割合だけ、部全体に効く
  const share = id => count(id) >= 2 ? count(id) / n : 0;
  const sum = {}, cnt = {};
  let famSum = 0, moraleSum = 0, tiredN = 0;
  for(const m of ms){
    const id = pick[m.id], mu = MENU_BY[id];
    const tired = m.sta < 30;
    if(tired && id !== 'rest') tiredN++;
    const eff = (0.6 + 0.4 * s.morale / 100) * (tired ? 0.5 : 1) * (ev.mult || 1) * (mu.group && !share(id) ? 0.5 : 1) * cmul;
    const basics = basicsOf(m) / 100;
    const d = {};
    for(const [k, g] of Object.entries(mu.gain)){
      // 伸びは、うまくなるほど小さくなる（初心者は1年で50ほど、3年間続けると85〜90ほど）
      let x = 0.72 * g * eff * Math.max(0.12, 1 - m.stats[k] / 125) * (0.85 + 0.3 * hash(m.id, s.year, s.week, id, k)) * (m.grade === 1 ? 1.3 : 1) * growMult(s, m, k);
      if(mu.basics) x *= clamp((basics - 0.1) / 0.5, 0.1, 1);
      const before = m.stats[k];
      m.stats[k] = Math.round(clamp(before + x, 0, 100) * 10) / 10;
      d[k] = Math.round((m.stats[k] - before) * 10) / 10;
      if(m.seat){ sum[k] = (sum[k] || 0) + (m.stats[k] - before); cnt[k] = (cnt[k] || 0) + 1; }
    }
    // 譜読み：その人が今の曲の自分の楽譜を、区間ごとにどれだけ吹けるか。うまい人ほど早く読める（全体の力が0なら半分の速さ、100なら1.5倍）。
    // 曲の個人練習は1つの区間に打ちこむ（ほかの区間も少しは進む）。合奏などは曲全体が少しずつ進む
    let span = null;
    if(s.pieceId && mu.read){
      const pid = s.pieceId, units = readUnits(pid), cur = readOf(m, pid), before = readMean(m, pid);
      span = id === 'piece' ? practiceSpan(s, m) : null;
      const rate = mu.read * eff * (0.5 + avgStat(m) / 100) * (1 + SKILLS.reader.read * skillLv(m, 'reader'));
      // 1週間に覚えられる量は同じなので、打ちこんだ区間が短いほど大きく進む（くり返しの区間は数えない）
      const len = u => u.to - u.from, total = units.reduce((a, u) => a + len(u), 0);
      const next = cur.slice();
      for(const u of units){
        const g = span == null ? rate : u.i === span ? rate * 0.85 * total / len(u) : rate * 0.15;
        next[u.i] = Math.round(clamp(cur[u.i] + g * (1 - cur[u.i] / 130), 0, 100) * 10) / 10;
      }
      (m.fam ||= {})[pid] = next;
      d.fam = Math.round((readMean(m, pid) - before) * 10) / 10;
    }
    m.last = {menu: id, d, ...(span != null ? {span} : {})};
    // 同じ練習を続けると、それに合ったスキルが育つ。合奏を重ねた2・3年生のうまい部員は、パートの柱になっていく
    if(PRACTICE_SKILL[id] && !tired) addSkill(s, m, PRACTICE_SKILL[id], 0.06);
    if((id === 'tutti' || id === 'hall') && share(id) && m.grade >= 2 && avgStat(m) >= 55) addSkill(s, m, 'pillar', 0.03);
    famSum += mu.group ? (mu.fam || 0) * eff * (share(id) ? 1 : 0) : (mu.fam || 0) * eff;
    if(id !== 'rest') famSum += 4;
    m.sta = clamp(m.sta - (mu.cost > 0 ? mu.cost * (ev.costMult || 1) * (1 - SKILLS.tough.cost * skillLv(m, 'tough')) : mu.cost), 0, 100);
    moraleSum += (mu.morale || 0) - (id === 'rest' ? 0 : tired ? 8 : 3);
    if(mu.hallExp && share(id)) m.mental = clamp((m.mental ?? 40) + 1.5, 0, 100);
  }
  s.lastDelta = {};
  for(const k of Object.keys(sum)) s.lastDelta[k] = Math.round(sum[k] / cnt[k] * 10) / 10;
  if(s.pieceId){ const ms = seated(s); if(ms.length) s.lastDelta.read = Math.round(ms.reduce((a, m) => a + (m.last?.d?.fam || 0), 0) / ms.length * 10) / 10; }
  const moodLv = Math.max(0, ...seated(s).map(m => skillLv(m, 'mood')));
  const eff0 = (0.6 + 0.4 * s.morale / 100) * (ev.mult || 1) * cmul * (1 + 0.08 * moodLv);
  const coh = MENU.reduce((a, mu) => a + (mu.coh || 0) * share(mu.id), 0);
  if(coh){ const d = coh * eff0 * (1 - s.cohesion / 150); s.cohesion = clamp(s.cohesion + d, 0, 100); s.lastDelta.coh = Math.round(d * 10) / 10; }
  if(s.pieceId){
    const df = famSum / n * (1 - s.fam[s.pieceId] / 130);
    s.fam[s.pieceId] = clamp(s.fam[s.pieceId] + df, 0, 100);
    s.lastDelta.fam = Math.round(df * 10) / 10;
  }
  const hall = share('hall');
  if(hall) s.hallExp = clamp(s.hallExp + MENU_BY.hall.hallExp * hall, 0, 100);
  s.morale += moraleSum / n + moodLv;
  syncSta(s);
  const used = MENU.filter(mu => count(mu.id)).map(mu => `${mu.name}${count(mu.id) < n ? ` ${count(mu.id)}人` : ''}`).join('・');
  const gains = Object.entries(s.lastDelta).filter(([k, v]) => v > 0 && STAT_LABEL[k]).map(([k, v]) => `${STAT_LABEL[k]}+${v.toFixed(1)}`).join('　');
  addLog(s, `今週の練習：${used || 'なし'}。部の平均 ${gains || '変化なし'}`);
  if(tiredN) addLog(s, tiredN >= n / 2 ? '疲れがたまっていて、みんな身が入らなかった。' : `疲れがたまっている部員が${tiredN}人いて、身が入らなかった。`);
  if(count('tutti') === 1 || count('hall') === 1) addLog(s, '合奏に出たのが1人だけで、合奏にならなかった。');
  const lowBasics = ms.filter(m => pick[m.id] === 'phrase' && basicsOf(m) < 35);
  if(lowBasics.length) addLog(s, `${lowBasics.map(m => m.name).join('、')}は歌ってはみたけれど、楽器を持つと音程とリズムで手一杯。基礎がもう少し要りそうだ。`);
  gainCoach(s, 1);
  for(const st of MILESTONES){
    const f = `${s.year}:${st.k}${st.at}`;
    if(!s.flags[f] && bandAvg(s, st.k) >= st.at){ s.flags[f] = true; addLog(s, st.text); }
  }
  s.plan = {}; s.planSpan = {};
  return nextWeek(s);
}
// 週ごとの部の力の記録（部の実力のグラフ用）：その週の練習のあとの、席についている部員の平均と、自由曲の仕上がり
function recordTrend(s){
  if(!seated(s).length) return;
  const avg = STAT_KEYS.reduce((a, k) => a + bandAvg(s, k), 0) / STAT_KEYS.length;
  (s.trend ||= []).push({y: s.year, w: s.week, a: Math.round(avg * 10) / 10, f: Math.round((s.pieceId ? s.fam[s.pieceId] || 0 : 0) * 10) / 10});
  if(s.trend.length > 120) s.trend.splice(0, s.trend.length - 120);
}
function nextWeek(s){
  recordTrend(s);
  for(const m of s.members) m.sta = clamp((m.sta ?? s.stamina) + 6, 0, 100);
  syncSta(s);
  s.morale = clamp(s.morale, 0, 100);
  s.hallExp = Math.max(0, s.hallExp - 4);
  s.week++;
  s.pending = null;
  const ev = eventAt(s, s.week);
  if(ev){
    if(ev.morale) s.morale = clamp(s.morale + ev.morale, 0, 100);
    if(ev.kind !== 'contest') addLog(s, `【${ev.title}】${ev.text}`);
    else addLog(s, `いよいよ${ev.title}の週。`);
    if(ev.kind === 'audition') runAudition(s);
  }
  s.episode = pickEpisode(s);
  s.outing = pickOuting(s);
  // 行事の誘いがある週は、相談は来ない
  s.consult = s.outing ? null : pickConsult(s);
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
// kind をつけた思い出は、同じ種類の古いものを消して、いちばん新しいものだけ残す（本番の「一番の音」がくり返し並ばないように）
function remember(s, m, t, kind){
  if(!m) return;
  if(kind) m.story = (m.story || []).filter(x => x.k !== kind);
  (m.story ||= []).push(kind ? {y: s.year, w: s.week, t, k: kind} : {y: s.year, w: s.week, t});
  if(m.story.length > 10) m.story.splice(0, m.story.length - 10);
}
// 部全体の値を動かす（体力は部員全員ぶん）
const adj = (s, k, d) => {
  if(k === 'stamina'){ for(const m of s.members) m.sta = clamp((m.sta ?? s.stamina) + d, 0, 100); syncSta(s); return; }
  s[k] = clamp(s[k] + d, 0, 100);
};
const senpai = (s, m) => s.members.filter(x => x.seat && x.id !== m.id && x.grade > m.grade && secOf(x) === secOf(m)).sort((a, b) => b.grade - a.grade)[0]
  || s.members.filter(x => x.seat && x.grade === 3 && x.grade > m.grade)[0];
const contestAhead = s => eventAt(s, s.week + 1)?.kind === 'contest' ? eventAt(s, s.week + 1) : null;

// who：その出来事の主役になれる部員（2人必要なものは pair で相手を選ぶ）
const EPISODES = [
  {id: 'doubt', who: s => seated(s).filter(m => m.grade === 1 && avgStat(m) < 30),
   text: (s, m) => `練習のあと、1年生の${m.name}（${instOf(m)}）が音楽室に残っていた。「みんなみたいに吹けなくて……。向いてないのかもしれません」`,
   choices: [
     {label: 'いっしょにロングトーンをする', go: (s, m) => { bump(m, 'tone', 4); bump(m, 'pitch', 2); adj(s, 'stamina', -3);
       remember(s, m, '自信をなくした日に、顧問とふたりでロングトーンをした。'); return `しばらく二人でロングトーンをした。帰りぎわ、${m.name}は「また明日も来ます」と言った。`; }},
     {label: '同じパートの先輩に話を聞いてもらう', if: (s, m) => !!senpai(s, m), go: (s, m) => { const o = senpai(s, m); bump(m, 'expr', 3); adj(s, 'cohesion', 3); m.mental = clamp((m.mental ?? 40) + 4, 0, 100);
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
     {label: '先輩に分けてもらう', if: (s, m) => !!senpai(s, m), go: (s, m) => { const o = senpai(s, m); bump(m, 'tone', 1); adj(s, 'cohesion', 2);
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
  // ---- 2026年10月に足した出来事（2年目・3年目も同じ出来事ばかりにならないように）。late：顧問になって最初の年には起きない ----
  {id: 'rush', late: true, who: s => seated(s).filter(m => m.trait === 'rush' || m.trait === 'drag'),
   text: (s, m) => `${m.name}（${instOf(m)}）が、合奏のたびにテンポが${m.trait === 'rush' ? '前に行ってしまう' : '遅れてしまう'}のを気にしている。「メトロノームと合わせると、自分がずれているのがわかって怖いんです」`,
   choices: [
     {label: 'メトロノーム練習に付き合う', go: (s, m) => { bump(m, 'rhythm', 4); adj(s, 'stamina', -2);
       remember(s, m, 'テンポのずれが怖かったころ、顧問がメトロノーム練習に付き合ってくれた。'); return 'ゆっくりのテンポから、少しずつ上げていった。最後は「合ってる音」が自分でもわかるようになった。'; }},
     {label: '歌ってリズムを体に入れさせる', go: (s, m) => { bump(m, 'rhythm', 2); bump(m, 'expr', 2);
       remember(s, m, 'リズムを、まず歌って体に入れるようにした。'); return `${m.name}は手をたたきながら旋律を歌い、それから楽器で吹いた。前より自然に拍に乗れている。`; }},
     {label: '隣の人の音を聴くように言う', go: (s, m) => { bump(m, 'rhythm', 1); adj(s, 'cohesion', 3);
       remember(s, m, '「メトロノームより、隣の音を聴いて」と言われた。'); return 'パートのみんなで、お互いの音を聴いて出だしをそろえる練習をした。'; }},
   ]},
  {id: 'teach', late: true, pair: true, who: s => seated(s).filter(m => m.grade >= 2 && seated(s).some(x => x.grade === 1 && secOf(x) === secOf(m))),
   other: (s, m) => seated(s).filter(x => x.grade === 1 && secOf(x) === secOf(m)),
   text: (s, m, o) => `${m.grade}年生の${m.name}が、1年生の${o.name}（${instOf(o)}）に、自分の練習時間を使って基礎を教えている。`,
   choices: [
     {label: 'そのまま任せる', go: (s, m, o) => { bump(o, weakest(o), 4); bump(m, 'expr', 2); adj(s, 'cohesion', 3);
       remember(s, m, `後輩の${o.name}に、基礎を教えた。`); remember(s, o, `先輩の${m.name}に、基礎を教えてもらった。`);
       return `教えるうちに、${m.name}自身も自分の吹き方を見直したらしい。二人の音が少し似てきた。`; }},
     {label: '先輩の練習時間も守るよう伝える', go: (s, m, o) => { bump(o, weakest(o), 2); bump(m, weakest(m), 2);
       remember(s, m, '後輩に教えながら、自分の練習もきちんと続けた。'); return '教えるのは練習の最初の15分だけにして、残りはそれぞれの練習をすることにした。'; }},
   ]},
  {id: 'tired', late: true, who: s => s.members.filter(m => m.seat && (m.sta ?? 100) < 35),
   text: (s, m) => `${m.name}（${instOf(m)}）の顔色が悪い。家でも夜遅くまで練習しているらしい。`,
   choices: [
     {label: '今週は休ませる', go: (s, m) => { m.sta = clamp((m.sta ?? 50) + 35, 0, 100); syncSta(s); adj(s, 'morale', 1);
       remember(s, m, '無理をしすぎて、顧問に「今週は休んで」と言われた。'); return `「休むのも練習のうち」と伝えた。翌週の${m.name}は、すっきりした顔で楽器を出していた。`; }},
     {label: '練習の量を一緒に決め直す', go: (s, m) => { m.sta = clamp((m.sta ?? 50) + 18, 0, 100); syncSta(s); bump(m, weakest(m), 1);
       remember(s, m, '練習の量を、顧問と一緒に決め直した。'); return '家での練習は30分までと約束した。そのぶん音楽室での練習に集中している。'; }},
   ]},
  {id: 'tuner', late: true, who: s => seated(s).filter(m => m.stats.pitch < 55 && !['perc'].includes(secOf(m))),
   text: (s, m) => `${m.name}（${instOf(m)}）が、吹いているあいだずっとチューナーの針ばかり見ている。`,
   choices: [
     {label: 'チューナーを伏せて、耳で合わせさせる', go: (s, m) => { bump(m, 'pitch', 3); adj(s, 'morale', -1);
       remember(s, m, 'チューナーを伏せて、耳だけで音を合わせる練習をした。'); return 'はじめは不安そうだったが、だんだん隣の音とのうなりが聴こえるようになってきた。'; }},
     {label: '和音で合わせる練習をパートでする', go: (s, m) => { for(const x of seated(s)) if(secOf(x) === secOf(m)) bump(x, 'pitch', 1.5); adj(s, 'cohesion', 2);
       remember(s, m, 'パートのみんなで、和音をのばして合わせる練習をした。'); return `${SEC[secOf(m)].name}パートで和音をのばした。響きが合った瞬間、みんなの顔がぱっと明るくなった。`; }},
   ]},
  {id: 'repair', late: true, who: s => seated(s).filter(m => REED.has(SEAT[m.seat].inst) || LIP.has(SEAT[m.seat].inst)),
   text: (s, m) => `${m.name}（${instOf(m)}）の楽器の調子が悪い。${LIP.has(SEAT[m.seat].inst) ? 'ピストンの動きが重く' : 'キーから息がもれて'}、低い音が出にくいという。`,
   choices: [
     {label: '修理に出す（その間は予備の楽器）', go: (s, m) => { bump(m, 'tone', 3); adj(s, 'stamina', -1);
       remember(s, m, '楽器を修理に出して、戻ってきた音に驚いた。'); return `一週間後、戻ってきた楽器を吹いた${m.name}は「こんなに楽に鳴るんだ」と驚いていた。`; }},
     {label: '自分たちで手入れのしかたを覚える', go: (s, m) => { bump(m, 'tone', 1); for(const x of seated(s)) if(secOf(x) === secOf(m)) bump(x, 'tone', 0.5);
       remember(s, m, 'パートのみんなで、楽器の手入れのしかたを覚えた。'); return 'パートのみんなで、楽器の手入れのしかたを覚えた。ほかの楽器の調子もよくなった。'; }},
   ]},
  {id: 'nerve', late: true, who: s => seated(s).filter(m => m.grade >= 2 && (m.mental ?? 40) < 40),
   text: (s, m) => `${m.name}（${instOf(m)}）が、「本番になると頭が真っ白になるんです」と相談に来た。`,
   choices: [
     {label: '部員の前で一人ずつ吹く練習をする', go: (s, m) => { m.mental = clamp((m.mental ?? 40) + 7, 0, 100); adj(s, 'cohesion', 2); adj(s, 'stamina', -2);
       remember(s, m, '本番が怖くて、部員の前で一人ずつ吹く練習をした。'); return `一人ずつ順番に吹いた。${m.name}の番のあと、自然に拍手が起きた。`; }},
     {label: '本番の前にすることを決めておく', go: (s, m) => { m.mental = clamp((m.mental ?? 40) + 4, 0, 100); adj(s, 'morale', 1);
       remember(s, m, '本番の前は、深呼吸をして最初の音だけを思い浮かべると決めた。'); return '「深呼吸をして、最初の音だけ思い浮かべる」と決めた。少し安心したようだ。'; }},
   ]},
  {id: 'original', late: true, who: s => s.pieceId ? seated(s).filter(m => m.stats.expr >= 30) : [],
   text: (s, m) => `${m.name}（${instOf(m)}）が、自由曲の${PIECES[s.pieceId].title}の原曲を、毎日聴きこんでいるらしい。`,
   choices: [
     {label: '原曲を部のみんなで聴く', go: (s, m) => { for(const x of seated(s)) bump(x, 'expr', 1); s.fam[s.pieceId] = clamp((s.fam[s.pieceId] || 0) + 2, 0, 100);
       remember(s, m, '自由曲の原曲を、部のみんなで聴いた。'); return '原曲を聴いたあとの合奏は、どこを歌えばいいかが前よりはっきりしていた。'; }},
     {label: '原曲で自分の受け持ちの楽器を調べさせる', go: (s, m) => { bump(m, 'expr', 3);
       remember(s, m, '自由曲で、自分の音を原曲ではどの楽器が弾いているのか調べた。'); return `${m.name}は、自分の音を原曲でどの楽器が弾いているかを、楽譜の上に書き込んでいた。`; }},
   ]},
  {id: 'baton', late: true, who: s => seated(s).filter(m => m.title === '学生指揮'),
   text: (s, m) => `学生指揮の${m.name}が、「パート練習で指揮を振ってみたいので、見てもらえませんか」と言ってきた。`,
   choices: [
     {label: '振り方を教える', go: (s, m) => { adj(s, 'cohesion', 3); bump(m, 'rhythm', 2);
       remember(s, m, '学生指揮として、顧問に振り方を教わった。'); return '拍の点をはっきり見せる振り方を練習した。パート練習の出だしがそろうようになった。'; }},
     {label: '合奏の基礎練習を任せる', go: (s, m) => { adj(s, 'cohesion', 2); for(const x of seated(s)) bump(x, 'rhythm', 0.8); adj(s, 'morale', 1);
       remember(s, m, '学生指揮として、合奏の基礎練習を任された。'); return `${m.name}の指揮で基礎合奏をした。部員たちはいつもより真剣な顔をしていた。`; }},
   ]},
  {id: 'concert', late: true, who: s => s.week >= 3 ? seated(s).filter(m => m.grade >= 2) : [],
   text: (s, m) => `近くのホールで、プロの吹奏楽団の演奏会がある。${m.name}たち${m.grade}年生が行きたがっている。`,
   choices: [
     {label: '部のみんなで聴きに行く', go: (s, m) => { for(const x of seated(s)) bump(x, 'expr', 1); adj(s, 'morale', 4); adj(s, 'stamina', -2);
       remember(s, m, 'みんなでプロの吹奏楽団の演奏会を聴きに行った。'); return '帰りの電車で、誰かが聴いたばかりの旋律を口ずさんでいた。次の日の練習は、みんな音が明るかった。'; }},
     {label: '行きたい人だけ行かせる', go: (s, m) => { for(const x of seated(s)) if(x.grade === m.grade) bump(x, 'expr', 1.5); adj(s, 'morale', 1);
       remember(s, m, 'プロの吹奏楽団の演奏会を聴きに行った。'); return `${m.name}たちは、次の日の練習で聴いてきた音の話ばかりしていた。`; }},
   ]},
];
const EPISODE_BY = Object.fromEntries(EPISODES.map(e => [e.id, e]));

/* ===== 部員の相談 =====
   練習の週には、毎週だれか1人が相談に来る（大きな出来事がない週）。答え方で、その子の育ち方（伸びやすい力）やスキルが変わる。
   答えずに練習を進めてもよい（その相談は流れる）。同じ相談は6週のあいだ出さず、最近相談に来ていない部員を選びやすくする */
const ss = s => seated(s);
const kun = m => m.name.split(' ')[1] || m.name;
const CONSULTS = [
  {id: 'crush', pair: true, who: s => ss(s).filter(m => m.grade >= 1 && ss(s).some(x => x.id !== m.id && Math.abs(x.grade - m.grade) <= 1)),
   other: (s, m) => ss(s).filter(x => x.id !== m.id && Math.abs(x.grade - m.grade) <= 1),
   text: (s, m, o) => `${m.name}（${instOf(m)}）が、小さな声で言った。「${o.name}${o.grade > m.grade ? '先輩' : 'さん'}のことが、なんだか気になっちゃって……。合奏のとき、つい目で追っちゃうんです」`,
   choices: [
     {label: 'その気持ち、音にしてみたら', go: (s, m) => { bend(m, 'expr', 0.06); addSkill(s, m, 'song', 0.5);
       remember(s, m, '気になる人ができた。その気持ちを、旋律にのせて吹いてみた。'); return `${kun(m)}は赤くなってうなずいた。その日の旋律は、いつもより少しやさしかった。`; }},
     {label: '今は練習に集中しよう', go: (s, m) => { bend(m, 'rhythm', 0.04); m.mental = clamp((m.mental ?? 40) + 3, 0, 100);
       return `「……ですよね」と、${kun(m)}は笑ってメトロノームを鳴らしはじめた。`; }},
     {label: '大事な仲間として、そばにいればいい', go: (s, m) => { adj(s, 'cohesion', 2); adj(s, 'morale', 2);
       return `${kun(m)}はほっとした顔をした。帰りは、パートのみんなと一緒に帰っていった。`; }},
   ]},
  {id: 'future', who: s => ss(s).filter(m => m.grade === 3),
   text: (s, m) => `3年生の${m.name}（${instOf(m)}）が、進路のことで相談に来た。「音楽の道に進みたいって言ったら、家族に反対されて……」`,
   choices: [
     {label: 'まずは自分の音で見せよう', go: (s, m) => { bend(m, 'tone', 0.05); bend(m, 'expr', 0.05); addSkill(s, m, 'sense', 0.4);
       remember(s, m, '進路に迷った日、「まずは自分の音で見せよう」と言われた。'); return `${kun(m)}は、その日から毎朝いちばんに音楽室に来るようになった。`; }},
     {label: '家族と一緒に話してみる', go: (s, m) => { m.mental = clamp((m.mental ?? 40) + 5, 0, 100); adj(s, 'morale', 1);
       remember(s, m, '進路のことで、顧問が家族と話してくれた。'); return '三人で話した。すぐには決まらないが、定期演奏会を聴きに来てくれることになった。'; }},
     {label: '部活と勉強、両方を大事に', go: (s, m) => { addSkill(s, m, 'tough', 0.6);
       return `${kun(m)}は、朝の電車で単語帳を開き、放課後は楽器を吹いている。`; }},
   ]},
  {id: 'otherinst', who: s => ss(s).filter(m => m.grade === 1 && m.hope && SEAT[m.seat].inst !== m.hope),
   text: (s, m) => `${m.name}（${instOf(m)}）が、ぽつりと言った。「本当は、${INST[m.hope].name}を吹いてみたかったんです」`,
   choices: [
     {label: 'いまの楽器のいいところを一緒に探す', go: (s, m) => { bend(m, 'expr', 0.05); adj(s, 'morale', 1);
       remember(s, m, `本当は${INST[m.hope].name}がよかった。でも、いまの楽器のいいところを見つけた。`); return `いまの楽器の聴きどころを、原曲の録音で探した。「この音、${instOf(m)}だったんだ」と目を丸くしていた。`; }},
     {label: '休み時間に触ってみてもいいよ', go: (s, m) => { adj(s, 'morale', 2); addSkill(s, m, 'sense', 0.3);
       return `${kun(m)}は昼休みに${INST[m.hope].name}を少し吹かせてもらい、満足そうに自分の楽器に戻っていった。`; }},
   ]},
  {id: 'scary', pair: true, who: s => ss(s).filter(m => m.grade === 1 && ss(s).some(x => x.grade >= 2 && secOf(x) === secOf(m))),
   other: (s, m) => ss(s).filter(x => x.grade >= 2 && secOf(x) === secOf(m)),
   text: (s, m, o) => `1年生の${m.name}（${instOf(m)}）が、こっそり相談に来た。「${o.name}先輩がちょっとこわくて、わからないところを聞けないんです」`,
   choices: [
     {label: '先輩に、教え方を相談してみる', go: (s, m, o) => { addSkill(s, o, 'mentor', 0.6); adj(s, 'cohesion', 2);
       remember(s, o, '後輩への接し方を、顧問と話した。'); return `${o.name}は「そんなふうに見えてたんだ……」と驚き、次の日から自分から声をかけるようになった。`; }},
     {label: '勇気を出して聞いてみよう', go: (s, m) => { m.mental = clamp((m.mental ?? 40) + 6, 0, 100); bend(m, weakest(m), 0.04);
       remember(s, m, 'こわいと思っていた先輩に、勇気を出して質問した。'); return `思いきって聞いてみたら、先輩はていねいに教えてくれたらしい。「こわくなかったです」と笑っていた。`; }},
   ]},
  {id: 'teachhow', who: s => ss(s).filter(m => m.grade >= 2 && ss(s).some(x => x.grade === 1 && secOf(x) === secOf(m))),
   text: (s, m) => `${m.name}（${instOf(m)}）が「後輩に、どう教えたらいいかわからなくて」と相談に来た。`,
   choices: [
     {label: '自分が教わってうれしかったことを思い出して', go: (s, m) => { addSkill(s, m, 'mentor', 0.8);
       remember(s, m, '後輩への教え方に悩んで、自分が教わったときのことを思い出した。'); return `${kun(m)}は少し考えて、「まず、いっしょに吹いてみます」と言った。`; }},
     {label: 'まずは自分がお手本の音を出そう', go: (s, m) => { bend(m, 'tone', 0.05); addSkill(s, m, 'pillar', 0.5);
       return `${kun(m)}は、後輩の横でロングトーンを始めた。パートの音が、${kun(m)}の音に寄っていった。`; }},
   ]},
  {id: 'sns', who: s => ss(s).filter(m => m.grade >= 1),
   text: (s, m) => `${m.name}（${instOf(m)}）が、スマホを見せてきた。「練習の動画を上げたら、知らない人に『いい音』ってほめられたんです！」`,
   choices: [
     {label: 'もっといろんな人に聴いてもらおう', go: (s, m) => { bend(m, 'expr', 0.05); m.mental = clamp((m.mental ?? 40) + 4, 0, 100);
       return `${kun(m)}はうれしそうに、次は何を吹こうかと考えている。人前で吹くのが楽しくなってきたようだ。`; }},
     {label: '自分の音を聴き返す記録にしよう', go: (s, m) => { addSkill(s, m, 'ear', 0.5); bend(m, 'pitch', 0.04);
       return `動画を聴き返して、「ここ、音程が下がってる」と自分で気づくようになった。`; }},
   ]},
  {id: 'jazz', who: s => ss(s).filter(m => ['sax', 'tp', 'tb', 'low'].includes(secOf(m))),
   text: (s, m) => `${m.name}（${instOf(m)}）が「最近ジャズにハマってて、自由曲もついスウィングしちゃうんです」と言ってきた。`,
   choices: [
     {label: 'その感覚、大事にしよう', go: (s, m) => { addSkill(s, m, 'groove', 0.6); bend(m, 'expr', 0.03);
       return `${kun(m)}は休み時間にジャズの録音を聴きこみ、合奏ではリズムがいきいきしてきた。`; }},
     {label: '楽譜どおりにも吹けるようにしよう', go: (s, m) => { bend(m, 'rhythm', 0.06);
       return `「どっちも吹けたらかっこいいですよね」と、${kun(m)}はメトロノームを鳴らした。`; }},
   ]},
  {id: 'breath', who: s => ss(s).filter(m => !['perc'].includes(secOf(m)) && m.stats.tone < 60),
   text: (s, m) => `${m.name}（${instOf(m)}）が「ロングトーンで、どうしても息が続かないんです」と相談に来た。`,
   choices: [
     {label: '毎朝、少し走ってみる', go: (s, m) => { addSkill(s, m, 'tough', 0.6); addSkill(s, m, 'breath', 0.3);
       remember(s, m, '息が続かなくて、毎朝走ることにした。'); return `${kun(m)}は朝、グラウンドを2周走ってから音楽室に来るようになった。`; }},
     {label: '腹式呼吸をいっしょに練習する', go: (s, m) => { addSkill(s, m, 'breath', 0.7); bend(m, 'tone', 0.03);
       return `寝ころんでおなかに教科書をのせ、息を吸う練習をした。「おなかが動いてる！」と笑っていた。`; }},
   ]},
  {id: 'quiet', who: s => ss(s).filter(m => m.trait === 'shy' || (m.mental ?? 40) < 35),
   text: (s, m) => `${m.name}（${instOf(m)}）が言った。「自分の音が大きいと、みんなの迷惑になる気がして……」`,
   choices: [
     {label: 'あなたの音を聴きたい、と伝える', go: (s, m) => { m.mental = clamp((m.mental ?? 40) + 7, 0, 100); bend(m, 'tone', 0.04);
       remember(s, m, '「あなたの音を聴きたい」と言われた。'); return `次の合奏で、${kun(m)}の音がはじめてはっきり聞こえた。`; }},
     {label: 'パートで、一人ずつ吹く練習をする', go: (s, m) => { addSkill(s, m, 'nerve', 0.5); adj(s, 'cohesion', 1);
       return 'パートで順番に一人ずつ吹いた。終わるたびに、みんなで拍手した。'; }},
   ]},
  {id: 'game', who: s => ss(s).filter(m => (m.sta ?? 100) < 60),
   text: (s, m) => `${m.name}（${instOf(m)}）が、眠そうな顔で言った。「夜、ついゲームをしちゃって……朝練がつらいです」`,
   choices: [
     {label: 'ゲームは週末だけにしよう', go: (s, m) => { m.sta = clamp((m.sta ?? 50) + 20, 0, 100); syncSta(s);
       return `${kun(m)}は「がんばります……」と言いながら、スマホのタイマーを設定していた。`; }},
     {label: 'リズムゲームなら、楽器にも生きるかも', go: (s, m) => { addSkill(s, m, 'groove', 0.4); m.sta = clamp((m.sta ?? 50) + 8, 0, 100); syncSta(s);
       return `「それ、本当ですか！」と目を輝かせた。次の日、裏拍がずいぶん安定していた。`; }},
   ]},
  {id: 'parttime', who: s => ss(s).filter(m => m.grade >= 2),
   text: (s, m) => `${m.name}（${instOf(m)}）が「アルバイトを始めたいので、部活を週に1回休んでもいいですか」と聞いてきた。`,
   choices: [
     {label: '週1回ならいいよ', go: (s, m) => { adj(s, 'morale', 1); addSkill(s, m, 'tough', 0.3);
       return `${kun(m)}はほっとした様子だった。休みの日のぶん、残りの日は集中して吹いている。`; }},
     {label: 'コンクールまでは部活に集中してほしい', go: (s, m) => { bend(m, weakest(m), 0.05); adj(s, 'morale', -1);
       return `${kun(m)}は少し残念そうだったが、「コンクールが終わったら始めます」と言った。`; }},
   ]},
  {id: 'grades', who: s => ss(s),
   text: (s, m) => `${m.name}（${instOf(m)}）が青い顔で来た。「テストの点が悪くて、親に部活をやめろって言われて……」`,
   choices: [
     {label: '部で勉強会をしよう', go: (s, m) => { adj(s, 'cohesion', 3); adj(s, 'stamina', -2);
       remember(s, m, 'テストの点が悪かったとき、部のみんなが勉強会を開いてくれた。'); return '練習のあと、得意な部員が先生になって勉強会を開いた。次のテストは、みんな少し点が上がった。'; }},
     {label: '顧問から家族に話してみる', go: (s, m) => { adj(s, 'morale', 2); m.mental = clamp((m.mental ?? 40) + 2, 0, 100);
       return `電話で、${kun(m)}が毎日どれだけがんばっているかを伝えた。部活は続けていいことになった。`; }},
   ]},
  {id: 'heartbreak', who: s => ss(s).filter(m => m.grade >= 2),
   text: (s, m) => `${m.name}（${instOf(m)}）の元気がない。聞いてみると、「ふられちゃいました……」と小さく笑った。`,
   choices: [
     {label: '切ない曲、今なら吹けるかもね', go: (s, m) => { addSkill(s, m, 'song', 0.6); bend(m, 'expr', 0.04);
       remember(s, m, '失恋した週、その気持ちのまま旋律を吹いた。'); return `${kun(m)}は少し泣いて、それから自由曲のゆっくりなところを何度も吹いた。音が前より深くなった。`; }},
     {label: 'みんなとカラオケに行っておいで', go: (s, m) => { adj(s, 'morale', 3); adj(s, 'cohesion', 2);
       return `パートのみんなと出かけて、大声で歌ってきたらしい。次の日はすっきりした顔をしていた。`; }},
   ]},
  {id: 'polish', who: s => ss(s).filter(m => !['perc'].includes(secOf(m))),
   text: (s, m) => `${m.name}（${instOf(m)}）は、楽器を磨くのが好きらしい。「ついつい時間を忘れちゃうんです」`,
   choices: [
     {label: 'その丁寧さは、音にも出るよ', go: (s, m) => { bend(m, 'tone', 0.06);
       return `${kun(m)}はうれしそうに、ぴかぴかの楽器でロングトーンを始めた。`; }},
     {label: 'パートの楽器の手入れ係をお願いする', go: (s, m) => { addSkill(s, m, 'pillar', 0.4); for(const x of ss(s)) if(secOf(x) === secOf(m)) bump(x, 'tone', 0.5);
       return `${kun(m)}がパートの楽器の手入れのしかたを教えて回った。みんなの楽器の鳴りがよくなった。`; }},
   ]},
  {id: 'rival', who: s => ss(s).filter(m => m.grade >= 1),
   text: (s, m) => `${m.name}（${instOf(m)}）が言った。「となりの高校の吹奏楽部に中学の友だちがいて、コンクールで絶対に負けたくないんです」`,
   choices: [
     {label: 'いい目標だね。いっしょに練習計画を立てよう', go: (s, m) => { bend(m, weakest(m), 0.06); m.mental = clamp((m.mental ?? 40) + 2, 0, 100);
       return `${kun(m)}は、苦手なところから毎日少しずつ練習する計画を立てた。`; }},
     {label: '友だちの音からも学べるといいね', go: (s, m) => { addSkill(s, m, 'ear', 0.4); bend(m, 'expr', 0.03);
       return `${kun(m)}は友だちの学校の演奏会に行き、「あの学校、低音がすごかったです」と報告してきた。`; }},
   ]},
  {id: 'tears', who: s => ss(s),
   text: (s, m) => `合奏のあと、${m.name}（${instOf(m)}）が恥ずかしそうに言った。「さっきの合奏、なんか感動して泣きそうになっちゃいました」`,
   choices: [
     {label: 'その気持ちが、音楽なんだよ', go: (s, m) => { addSkill(s, m, 'song', 0.5); adj(s, 'morale', 2);
       remember(s, m, '合奏で感動して、泣きそうになった。「その気持ちが音楽だよ」と言われた。'); return `${kun(m)}は照れくさそうに笑った。`; }},
     {label: 'どこで感動したか、楽譜に書いておこう', go: (s, m) => { bend(m, 'expr', 0.05); addSkill(s, m, 'reader', 0.3);
       return `${kun(m)}は楽譜の、旋律が高い音に上がるところに小さく丸をつけた。`; }},
   ]},
  {id: 'conduct', who: s => ss(s).filter(m => m.grade >= 2 && m.title !== '学生指揮'),
   text: (s, m) => `${m.name}（${instOf(m)}）が「いつか、指揮を振ってみたいんです」と打ち明けてきた。`,
   choices: [
     {label: 'まずはスコアを読んでみる？', go: (s, m) => { addSkill(s, m, 'reader', 0.6); addSkill(s, m, 'ear', 0.2);
       return `${kun(m)}は自由曲のスコアを借りていき、「ほかのパートって、こんなことしてたんだ」と驚いていた。`; }},
     {label: '基礎合奏の指揮をやってみよう', go: (s, m) => { adj(s, 'cohesion', 2); addSkill(s, m, 'mentor', 0.4);
       return `基礎合奏で${kun(m)}が指揮を振った。部員たちは真剣な顔でついてきた。`; }},
   ]},
  {id: 'compose', who: s => ss(s).filter(m => m.stats.expr >= 30),
   text: (s, m) => `${m.name}（${instOf(m)}）が、ノートを差し出してきた。「自分で曲を作ってみたんです。変じゃないですか？」`,
   choices: [
     {label: 'パートのみんなで吹いてみよう', go: (s, m) => { addSkill(s, m, 'song', 0.4); adj(s, 'cohesion', 2);
       remember(s, m, '自分で作った曲を、パートのみんなが吹いてくれた。'); return `短い曲を、パートのみんなで吹いた。${kun(m)}は少し泣きそうな顔で聴いていた。`; }},
     {label: '和音のしくみも勉強してみよう', go: (s, m) => { addSkill(s, m, 'ear', 0.6);
       return `和音の本を貸した。${kun(m)}は「だからここで響くんだ」とうなずいていた。`; }},
   ]},
  {id: 'late', who: s => ss(s),
   text: (s, m) => `${m.name}（${instOf(m)}）が「電車が遅れて、最近よく朝練に遅刻しちゃうんです」と謝りに来た。`,
   choices: [
     {label: '朝練は無理しなくていい', go: (s, m) => { m.sta = clamp((m.sta ?? 50) + 15, 0, 100); syncSta(s);
       return `${kun(m)}はほっとした顔をした。そのぶん、放課後は早く音楽室に来ている。`; }},
     {label: '一本早い電車にしてみる？', go: (s, m) => { addSkill(s, m, 'tough', 0.4); bend(m, weakest(m), 0.03);
       return `${kun(m)}は一本早い電車で来るようになった。朝の静かな音楽室で、ひとりでロングトーンをしている。`; }},
   ]},
  {id: 'both', who: s => ss(s),
   text: (s, m) => `${m.name}（${instOf(m)}）が「クラスの出し物と部活、どっちも手を抜きたくないんです」と言ってきた。`,
   choices: [
     {label: '両方やりきろう', go: (s, m) => { addSkill(s, m, 'tough', 0.5); adj(s, 'stamina', -1);
       return `${kun(m)}は休み時間はクラス、放課後は部活と走り回っている。`; }},
     {label: 'クラスでも音楽を生かしてみたら', go: (s, m) => { addSkill(s, m, 'mood', 0.5);
       return `クラスの出し物で、${kun(m)}が楽器を吹くことになった。部の宣伝にもなったらしい。`; }},
   ]},
  {id: 'atmos', who: s => ss(s).filter(m => m.grade >= 2),
   text: (s, m) => `${m.name}（${instOf(m)}）が「最近、部の雰囲気がちょっとピリピリしてる気がするんです」と相談してきた。`,
   choices: [
     {label: '雰囲気づくり、お願いできる？', go: (s, m) => { addSkill(s, m, 'mood', 0.7); adj(s, 'morale', 2);
       remember(s, m, '部の雰囲気をよくする役を、顧問にお願いされた。'); return `${kun(m)}は休憩のときにみんなに声をかけて回った。音楽室に笑い声が戻ってきた。`; }},
     {label: '全員で話す時間をつくる', go: (s, m) => { adj(s, 'cohesion', 4); adj(s, 'stamina', -2);
       return '練習の前に、全員で輪になって話した。言いにくかったことも少し出てきた。'; }},
   ]},
  {id: 'neighbor', who: s => ss(s).filter(m => !['perc'].includes(secOf(m))),
   text: (s, m) => `${m.name}（${instOf(m)}）が「となりのパートと音程が合わなくて、自分の音がわからなくなるんです」と言ってきた。`,
   choices: [
     {label: 'まず自分の音を、チューナーなしで聴く', go: (s, m) => { addSkill(s, m, 'ear', 0.6); bend(m, 'pitch', 0.03);
       return `${kun(m)}は、目を閉じて自分の音とチューナーの音のうなりを聴く練習を始めた。`; }},
     {label: 'パートどうしで和音を合わせてみる', go: (s, m) => { adj(s, 'cohesion', 2); addSkill(s, m, 'center', 0.5);
       return '二つのパートで和音をのばした。合った瞬間、二人とも顔を見合わせて笑った。'; }},
   ]},
  {id: 'idol', who: s => ss(s),
   text: (s, m) => `${m.name}（${instOf(m)}）が、もじもじしながら言った。「推しのライブがあって、週末の練習を休んでもいいですか……？」`,
   choices: [
     {label: '思いきり楽しんでおいで', go: (s, m) => { adj(s, 'morale', 2); m.sta = clamp((m.sta ?? 50) + 10, 0, 100); syncSta(s);
       return `週明けの${kun(m)}は、ライブのアンコールの話をずっとしていた。音まで明るい。`; }},
     {label: 'ライブで、プロのステージから学んできて', go: (s, m) => { addSkill(s, m, 'nerve', 0.4); bend(m, 'expr', 0.03);
       return `「ステージの上の人って、客席をちゃんと見てるんですね」と、${kun(m)}は気づいたことを話してくれた。`; }},
   ]},
  {id: 'buy', who: s => ss(s).filter(m => m.grade >= 1 && !['perc'].includes(secOf(m))),
   text: (s, m) => `${m.name}（${instOf(m)}）が「いつか、自分の楽器がほしいんです。でも、すごく高くて……」と言った。`,
   choices: [
     {label: '部の楽器を大事に使って、いつかね', go: (s, m) => { bend(m, 'tone', 0.04);
       return `${kun(m)}は、部の楽器をていねいにケースにしまった。「この子、いい音するんですよ」`; }},
     {label: '楽器店に試奏に行ってみる？', go: (s, m) => { addSkill(s, m, 'breath', 0.4); adj(s, 'morale', 1);
       return `休みの日に楽器店で試奏させてもらったらしい。「いい楽器って、息がすっと入るんです」と興奮していた。`; }},
   ]},
  {id: 'nervous', who: s => ss(s).filter(m => m.trait === 'nervous' || (m.mental ?? 40) < 40),
   text: (s, m) => `${m.name}（${instOf(m)}）が「次の本番、また手が震えそうで、今から心配なんです」と相談してきた。`,
   choices: [
     {label: '本番の前にすることを決めておこう', go: (s, m) => { addSkill(s, m, 'nerve', 0.6);
       remember(s, m, '本番の前は、深呼吸してから最初の音を思い浮かべると決めた。'); return `${kun(m)}は「深呼吸、最初の音」と楽譜のはしに書いた。`; }},
     {label: 'みんなの前で吹く練習を重ねよう', go: (s, m) => { m.mental = clamp((m.mental ?? 40) + 5, 0, 100); adj(s, 'cohesion', 1);
       return `パートのみんなの前で、毎日1回ずつ吹くことにした。三日目には、もう手は震えていなかった。`; }},
   ]},
];
const CONSULT_BY = Object.fromEntries(CONSULTS.map(c => [c.id, c]));
// 練習の週の相談を決める（大きな出来事がある週は出さない）
function pickConsult(s){
  if(s.phase !== 'week' || s.episode) return null;
  const ev = eventAt(s, s.week);
  if(ev && ev.kind !== 'mod') return null;
  const recent = s.consultLog || [];
  const able = CONSULTS.filter(c => !recent.some(r => r.id === c.id && s.week - r.w < 6 && r.y === s.year) && c.who(s).length);
  if(!able.length) return null;
  const c = able[Math.floor(hash(s.year, s.week, 'consult') * able.length)];
  // 最近相談に来ていない部員を選びやすく
  const cands = c.who(s).slice().sort((a, b) => (a.lastConsult ?? -99) - (b.lastConsult ?? -99) || hash(a.id, s.year, s.week) - hash(b.id, s.year, s.week));
  const m = cands[Math.floor(hash(s.year, s.week, 'cwho') * Math.min(3, cands.length))];
  let o = null;
  if(c.pair){ const os = c.other(s, m); o = os[Math.floor(hash(s.year, s.week, 'cother') * os.length)] || null; if(!o) return null; }
  s.consultLog = [...recent.filter(r => r.y === s.year && s.week - r.w < 6), {id: c.id, y: s.year, w: s.week}];
  return {id: c.id, mid: m.id, oid: o ? o.id : null};
}
const consultView = s => {
  const e = s.consult, c = e && CONSULT_BY[e.id];
  if(!c) return null;
  const m = s.members.find(x => x.id === e.mid), o = e.oid ? s.members.find(x => x.id === e.oid) : null;
  if(!m || (e.oid && !o)) return null;
  return {c, m, o, text: c.text(s, m, o), choices: c.choices.map((x, k) => ({k, label: x.label}))};
};
function resolveConsult(s0, k){
  const s = clone(s0);
  const v = consultView(s);
  s.consult = null;
  if(!v) return s;
  const ch = v.c.choices[k];
  const res = ch.go(s, v.m, v.o);
  v.m.lastConsult = s.year * 100 + s.week;
  addLog(s, `【相談】${v.text}`);
  addLog(s, `→ ${ch.label}。${res}`);
  s.lastConsult = {who: v.m.name, choice: ch.label, result: res};
  gainCoach(s, 1);
  return s;
}

/* ===== 行事のおさそい =====
   ときどき、部の外から誘いが来る（演奏会のチケット・講習会・体験会など）。連れて行く部員を n 人まで選ぶと、行った子が上達する。
   fit に当てはまる子は、得るものが大きい。選ばずに練習を進めると、その話は流れる。同じ行事は1年に1回まで
   go(s, m, fit)：行った部員1人ぶんの効き目、mem：その子の思い出、res(名前)：行ったあとのようす */
const OUTINGS = [
  {id: 'orch', n: 3, title: 'オーケストラの演奏会',
   text: '商店街の福引きで、プロのオーケストラの演奏会のチケットが3枚当たった。部員を3人まで連れて行ける。',
   fitText: 'フルート・オーボエ・ファゴット・クラリネット・ホルンの子は、自分と同じ楽器の音をじっくり聴ける',
   fit: m => ['fl', 'dr', 'cl', 'hn'].includes(secOf(m)),
   go: (s, m, f) => { bump(m, 'expr', f ? 4 : 2.5); bump(m, 'tone', f ? 1.5 : 1); addSkill(s, m, 'song', f ? 0.5 : 0.3); },
   mem: 'オーケストラの演奏会に連れて行ってもらった。弦の響きの中で、自分の楽器がどう歌うかを聴いた。',
   res: n => `${n}は、帰りの電車でずっと演奏会の話をしていた。次の日の合奏から、フレーズの歌い方が少し変わった。`},
  {id: 'brass5', n: 2, title: '金管五重奏のコンサート',
   text: 'プロの金管五重奏のコンサートの招待券が2枚届いた。部員を2人まで連れて行ける。',
   fitText: 'トランペット・ホルン・トロンボーン・低音の子は、音色のお手本をすぐ近くで聴ける',
   fit: m => ['tp', 'hn', 'tb', 'low'].includes(secOf(m)),
   go: (s, m, f) => { bump(m, 'tone', f ? 4 : 2); addSkill(s, m, 'breath', f ? 0.5 : 0.3); },
   mem: 'プロの金管五重奏を聴きに行った。あんな音を出してみたいと思った。',
   res: n => `${n}は、次の日からロングトーンの時間が長くなった。`},
  {id: 'lesson', n: 1, title: 'プロのワンポイントレッスン',
   text: '楽器店で、プロの奏者のワンポイントレッスンがある。申し込めるのは1人だけ。',
   fitText: 'まだ伸びしろの大きい子ほど、得るものが大きい',
   fit: m => avgStat(m) < 50,
   go: (s, m, f) => { bump(m, weakest(m), f ? 6 : 4); addSkill(s, m, 'sense', 0.3); },
   mem: 'プロの奏者にレッスンをしてもらった。苦手なところを、ていねいに見てもらった。',
   res: n => `${n}は、教わったことを楽譜にびっしり書きこんでいた。`},
  {id: 'repair', n: 3, title: '楽器の調整会',
   text: '楽器店の調整会がある。3人まで、楽器を見てもらえる。',
   fitText: '音がまだ出にくい子の楽器を見てもらうと、ぐっと楽に鳴るようになる',
   fit: m => m.stats.tone < 50,
   go: (s, m, f) => { bump(m, 'tone', f ? 4 : 2); bump(m, 'pitch', 1); },
   mem: '楽器を調整してもらった。息がすっと入るようになった。',
   res: n => `「こんなに楽に鳴るんだ」と、${n}は驚いていた。`},
  {id: 'kids', n: 2, title: '小学校の楽器体験会',
   text: '近くの小学校から、楽器体験会の手伝いを頼まれた。2人行ける。',
   fitText: '2・3年生は、教えることで自分の音も見直せる',
   fit: m => m.grade >= 2,
   go: (s, m, f) => { addSkill(s, m, 'mentor', f ? 0.6 : 0.3); bump(m, 'expr', 1.5); },
   after: s => adj(s, 'morale', 1),
   mem: '小学校の楽器体験会で、子どもたちに楽器を教えた。',
   res: n => `${n}が教えた子が、初めて音を出せて飛びはねて喜んだ。帰り道、「教えるのって難しいけど楽しい」と話していた。`},
  {id: 'jazz', n: 3, title: 'ジャズのライブ',
   text: '駅前のライブハウスで、高校生も入れるジャズのライブがある。3人まで連れて行ける。',
   fitText: 'サックス・トランペット・トロンボーン・低音・打楽器の子は、本物のノリを体で覚えられる',
   fit: m => ['sax', 'tp', 'tb', 'low', 'perc'].includes(secOf(m)),
   go: (s, m, f) => { bump(m, 'rhythm', f ? 4 : 2); addSkill(s, m, 'groove', f ? 0.5 : 0.3); },
   mem: 'ジャズのライブを聴きに行った。体じゅうでリズムを感じた。',
   res: n => `${n}は、帰り道ずっと手でリズムをとっていた。`},
  {id: 'choir', n: 4, title: '合唱部との合同練習',
   text: '合唱部が、いっしょに歌の練習をしないかと誘ってくれた。4人まで行ける。',
   fitText: '音程が苦手な子は、自分の声で音の高さをつかめる',
   fit: m => m.stats.pitch < 55,
   go: (s, m, f) => { bump(m, 'pitch', f ? 3.5 : 2); bump(m, 'expr', 1); addSkill(s, m, 'ear', f ? 0.4 : 0.2); },
   after: s => adj(s, 'cohesion', 1),
   mem: '合唱部といっしょに歌った。自分の声で、音の高さをつかんだ。',
   res: n => `${n}は、和音の中で自分の音を聴けるようになってきた。`},
  {id: 'radio', n: 2, title: 'ラジオの取材',
   text: '地元のラジオ局が、部の紹介番組で2人に話を聞きたいと言ってきた。',
   fitText: '人前が苦手な子には、いい経験になる',
   fit: m => (m.mental ?? 40) < 45,
   go: (s, m, f) => { m.mental = clamp((m.mental ?? 40) + (f ? 8 : 4), 0, 100); addSkill(s, m, 'nerve', f ? 0.6 : 0.3); },
   after: s => adj(s, 'morale', 2),
   mem: 'ラジオで部の紹介をした。緊張したけれど、ちゃんと話せた。',
   res: n => `放送の日、部のみんなで音楽室のラジオを囲んだ。${n}の声が流れると、拍手が起きた。`},
  {id: 'campus', n: 2, title: '音楽大学のオープンキャンパス', when: s => wkMonth(s.week) >= 7,
   text: '音楽大学のオープンキャンパスがある。見学に2人連れて行ける。',
   fitText: '進路を考える3年生には、特に大きな一日になる',
   fit: m => m.grade === 3,
   go: (s, m, f) => { for(const k of STAT_KEYS) bump(m, k, f ? 1.5 : 1); addSkill(s, m, 'sense', f ? 0.4 : 0.2); m.mental = clamp((m.mental ?? 40) + 3, 0, 100); },
   mem: '音楽大学を見学した。毎日何時間も練習する人たちを見た。',
   res: n => `${n}は、帰ってくるなり音楽室にこもった。「あの人たち、毎日何時間も吹いてるんです」`},
  {id: 'obog', n: 3, title: '卒業した先輩の演奏会', when: s => !s.founding || s.year >= s.startYear + 3,
   text: '卒業した先輩から、大学の吹奏楽部の演奏会に招待された。3人まで行ける。',
   fitText: '1年生には、先輩たちの音がいいお手本になる',
   fit: m => m.grade === 1,
   go: (s, m, f) => { bump(m, 'tone', f ? 2.5 : 1.5); bump(m, 'expr', f ? 2 : 1); },
   after: s => adj(s, 'morale', 1),
   mem: '卒業した先輩の、大学での演奏会を聴きに行った。',
   res: n => `${n}は、先輩に「がんばってるね」と声をかけられて、うれしそうだった。`},
  {id: 'perc', n: 2, title: '打楽器の講習会',
   text: '市民会館で、打楽器の講習会がある。2人まで参加できる。',
   fitText: '打楽器の子はもちろん、ほかの楽器の子もリズムの感じ方が変わる',
   fit: m => secOf(m) === 'perc',
   go: (s, m, f) => { bump(m, 'rhythm', f ? 4.5 : 2.5); addSkill(s, m, 'groove', f ? 0.4 : 0.3); },
   mem: '打楽器の講習会に行った。拍の「点」ではなく「流れ」を感じる練習をした。',
   res: n => `${n}は、メトロノームに合わせて手拍子をしながら、拍の流れを体で覚えようとしていた。`},
  {id: 'hall', n: 3, title: 'コンクール会場の見学', when: s => s.week < PREF_WEEK && !s.finalWeek,
   text: 'コンクールの会場になるホールの、見学ツアーがある。3人まで参加できる。',
   fitText: '本番で緊張しやすい子は、舞台を先に見ておくと落ち着ける',
   fit: m => (m.mental ?? 40) < 50,
   go: (s, m, f) => { m.mental = clamp((m.mental ?? 40) + (f ? 6 : 3), 0, 100); addSkill(s, m, 'nerve', f ? 0.5 : 0.3); bump(m, 'tone', 1); },
   mem: 'コンクールの会場になるホールを見学した。舞台に立って、客席を見わたした。',
   res: n => `${n}は「本番、あの舞台に立つんだ」と、少し顔つきが変わった。`},
];
const OUTING_BY = Object.fromEntries(OUTINGS.map(o => [o.id, o]));
// 練習の週に、行事の誘いを出すかどうか（月に1回ほど。続けては出さない）
function pickOuting(s){
  if(s.phase !== 'week' || s.episode) return null;
  const ev = eventAt(s, s.week);
  if(ev && ev.kind !== 'mod') return null;
  if(s.year * 100 + s.week - (s.outingAt ?? -99) < 3 || hash(s.year, s.week, 'outing') > 0.45) return null;
  // ★の子（行くと特に伸びる子）が1人もいない行事は出さない
  const able = OUTINGS.filter(o => !s.flags[`out:${s.year}:${o.id}`] && (!o.when || o.when(s)) && ss(s).some(o.fit));
  if(!able.length || ss(s).length < 2) return null;
  const o = able[Math.floor(hash(s.year, s.week, 'outwhich') * able.length)];
  s.flags[`out:${s.year}:${o.id}`] = true;
  s.outingAt = s.year * 100 + s.week;
  return {id: o.id};
}
const outingView = s => {
  const o = s.outing && OUTING_BY[s.outing.id];
  if(!o) return null;
  const n = Math.min(o.n, ss(s).length);
  return {o, n, fit: new Set(ss(s).filter(o.fit).map(m => m.id))};
};
// 連れて行く部員を決める（ids は部員の id。n 人をこえる分は使わない）
function resolveOuting(s0, ids){
  const s = clone(s0);
  const v = outingView(s);
  s.outing = null;
  if(!v) return s;
  const ms = ids.map(id => ss(s).find(m => m.id === id)).filter(Boolean).slice(0, v.n);
  if(!ms.length) return s;
  // 行った子ごとに、伸びたところを書きとめる
  const gains = ms.map(m => {
    const st0 = {...m.stats}, mn0 = m.mental ?? 40;
    v.o.go(s, m, v.fit.has(m.id)); remember(s, m, v.o.mem);
    const g = STAT_KEYS.filter(k => m.stats[k] > st0[k]).map(k => `${STAT_LABEL[k]}+${(m.stats[k] - st0[k]).toFixed(1)}`);
    if((m.mental ?? 40) > mn0) g.push((m.mental - mn0) >= 6 ? '本番にかなり強くなった' : '本番に少し強くなった');
    return `${m.name} ${g.join(' ')}`;
  });
  v.o.after?.(s);
  const names = ms.map(m => m.name).join('・');
  const res = v.o.res(names);
  addLog(s, `【${v.o.title}】${v.o.text}`);
  addLog(s, `→ ${res}（${gains.join('／')}）`);
  s.lastOuting = {title: v.o.title, who: names, result: res, gains};
  // 年度末のふり返り用（去年と今年の分だけ残す）
  s.outLog = [...(s.outLog || []).filter(x => x.y >= s.year - 1), {y: s.year, title: v.o.title, who: names}];
  gainCoach(s, 1);
  return s;
}

// 練習の週に、出来事を起こすかどうかと、どれを誰に起こすかを決める（同じ年に同じ出来事はくり返さない）
function pickEpisode(s){
  if(s.phase !== 'week') return null;
  const ev = eventAt(s, s.week);
  if(ev && ev.kind !== 'mod') return null;
  const flag = ep => `ep:${s.year}:${ep.id}${ep.always ? ':' + s.week : ''}`;
  const used = ep => s.flags[flag(ep)];
  const able = EPISODES.filter(ep => !used(ep) && !(ep.late && foundingYear(s)) && (!ep.always || ep.always(s)) && ep.who(s).length);
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
  // 選べる対応（先輩がいないと選べないもの、など）。k はもとの番号
  const choices = ep.choices.map((c, k) => ({k, label: c.label})).filter(c => !ep.choices[c.k].if || ep.choices[c.k].if(s, m, o));
  return {ep, m, o, text: ep.text(s, m, o), choices};
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
  gainCoach(s, 1);
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

/* ===== コンクールメンバーのオーディション =====
   コンクールに出るメンバーを選ぶ。一人ずつ自由曲の一節を吹いてもらい（その日の緊張で崩れることもある）、点をつける。
   選ばなかった部員は控え（m.out）になり、コンクールの舞台には上がらない。秋からはまた全員で吹く。 */
const AUD_NERVES = 3;
const audBeats = pc => Math.min(pc.beats, pc.meter >= 4 ? 16 : pc.meter >= 2 ? 16 : 12);
// 次のコンクール（なければ県大会）
function nextContest(s){
  for(let w = s.week; w <= NATIONAL_WEEK; w++){ const ev = eventAt(s, w); if(ev?.kind === 'contest') return {w, ev}; }
  return {w: PREF_WEEK, ev: EVENTS[PREF_WEEK]};
}
const lineupSet = s => !!(s.audition && s.audition.y === s.year && s.audition.decided && !s.finalWeek);
function auditionScore(s, m){
  const pc = PIECES[s.pieceId];
  const z = clampG(gauss(s.audition.seed, m.id, 'aud'));
  const r = stageDrop(m, AUD_NERVES, z);
  // 自由曲で問われる力ほど重く見る
  let sum = 0, wt = 0;
  for(const k of STAT_KEYS){ const w = pc.focus[k] || 1; sum += w * (m.stats[k] - r.drop * ({tone: 1.15, rhythm: 1, pitch: 0.85, expr: 1}[k])); wt += w; }
  return {score: Math.round(clamp(sum / wt, 0, 100)), freeze: r.freeze, zone: r.zone};
}
// オーディションでその部員が吹いた一節（聴き返す用）
function auditionCtx(s, m){
  const pc = PIECES[s.pieceId];
  return {members: [m], pieceId: s.pieceId, cohesion: s.cohesion, fam: s.fam[s.pieceId] ?? 0, interp: s.interp, venue: 'room',
    nerves: AUD_NERVES, fatigue: 0, form: {[m.id]: clampG(gauss(s.audition.seed, m.id, 'aud'))}, seed: 'aud', from: 0, to: audBeats(pc)};
}
function runAudition(s){
  if(!s.pieceId) return s;
  s.audition = {y: s.year, w: s.week, seed: Math.floor(hash(s.year, s.week, s.members.length, 'aud') * 1e9), scores: {}, decided: false};
  for(const m of seated(s)) s.audition.scores[m.id] = auditionScore(s, m);
  return s;
}
const startAudition = s0 => runAudition(clone(s0));
// このメンバーで次のコンクールに出たときの目安（その日の調子は入れない）
// 本番のころの部：いまの練習の仕方（部の方針）のまま、コンクールの週まで練習を進めたときの部。オーディションの目安とおすすめのメンバーに使う
// （オーディションの週の力のままだと、本番までに進む譜読みと仕上がりのぶん、ずっと低く出てしまうため）
let projMemo = null;
function projectToContest(s0){
  const {w} = nextContest(s0);
  const key = [s0.year, s0.week, s0.seq, s0.policy, w, s0.members.length].join(':');
  if(projMemo?.key === key) return projMemo.s;
  let s = clone(s0), guard = 0;
  s.plan = {};
  while(s.week < w && guard++ < 24){
    if(recruitsDue(s) && !s.pending){ s = assignRecruits(s, autoAssign(s)); continue; }
    if(episodeView(s)){ s = resolveEpisode(s, 0); continue; }
    const ev = eventAt(s, s.week);
    if(ev?.kind === 'forced'){ s = practiceWeek(s, 'test'); continue; }
    if(ev && (ev.kind === 'concert' || ev.kind === 'contest')) break;
    s = practiceWeek(s);
  }
  projMemo = {key, s};
  return s;
}
function predictContest(s0, outIds){
  const s = projectToContest(s0);
  const {ev} = nextContest(s);
  const L = LEVELS[ev.level];
  const members = seated(s).filter(m => !outIds.has(m.id));
  if(!members.length) return {avg: 0, award: 'bronze', level: ev.level, n: 0};
  const perf = perform(perfCtx(s, {members, venue: L.venue, nerves: nervesFor(s, ev), fatigue: 0}));
  const a = analyze(perf), j = judge(perf, a, ev.level);
  return {avg: j.avg, award: j.award, level: ev.level, n: members.length, thin: a.thin};
}
// おすすめ：オーディションの点が低い順に何人か控えに回して、いちばん点が上がる人数を探す
function recommendLineup(s){
  const ms = seated(s).slice().sort((a, b) => (s.audition.scores[a.id]?.score ?? 0) - (s.audition.scores[b.id]?.score ?? 0));
  let best = {out: new Set(), avg: -1};
  const tried = new Set();
  for(const f of [0, 0.1, 0.2, 0.3, 0.4, 0.5]){
    const k = Math.round(ms.length * f);
    if(tried.has(k) || ms.length - k < 1) continue;
    tried.add(k);
    const out = new Set(ms.slice(0, k).map(m => m.id));
    const p = predictContest(s, out);
    if(p.avg > best.avg + 0.3) best = {out, avg: p.avg};
  }
  return best.out;
}
function setLineup(s0, outIds){
  const s = clone(s0);
  const {ev} = nextContest(s);
  let dm = 0;
  for(const m of seated(s)){
    const out = outIds.has(m.id);
    if(out && !m.out){ remember(s, m, `${s.year}年のコンクールメンバーのオーディションで、選ばれなかった。`); dm -= m.grade === 3 ? 2 : 0.5; }
    if(!out && m.out) remember(s, m, `${s.year}年のコンクールメンバーに、あとから選ばれた。`);
    if(!out && !m.out && !s.audition.decided && m.grade === 1) remember(s, m, `1年生で、${s.year}年のコンクールメンバーに選ばれた。`);
    if(out) m.out = true; else delete m.out;
  }
  for(const m of s.members) if(!m.seat) delete m.out;
  s.morale = clamp(s.morale + Math.max(-8, dm), 0, 100);
  const n = seated(s).filter(m => !m.out).length, off = seated(s).length - n;
  addLog(s, `${ev.title}に出るメンバーが決まった。${n}人で出場する${off ? `（控え${off}人）` : '（全員で出る）'}。`);
  s.audition.decided = true;
  return s;
}

/* ===== 演奏会・コンクール ===== */
// 本番を始めるときの条件をそろえて記録する（音は画面側で鳴らす）
function beginStage(s0){
  const s = clone(s0);
  const ev = eventAt(s, s.week);
  const nerves = nervesFor(s, ev);
  const rec = addRec(s, `${s.year} ${ev.title}`, {venue: ev.venue, nerves, form: stageForm(s), take: `stage-${s.stageDay?.seed ?? weekTake(s)}`});
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
  // 同じ日の同じ調子で、指揮しなかった（おまかせの）ときの点。指揮でどれだけ変わったかを見せる
  const scoreOf = x => x.kind === 'concert' ? x.q : x.judge.avg, before = scoreOf(p);
  const perf = warpPerf(perform(recCtx(rec)), BeatClock.fromSaved(conduct.ev, 0, conduct.taps));
  stageResult(s, ev, rec, perf, p.nerves);
  s.pending.conducted = {bpm: conduct.bpm, stab: conduct.stab, gain: Math.round((scoreOf(s.pending) - before) * 10) / 10};
  return s;
}
function concertOutcome(s, ev, q, perf, a){
  if(ev.id === 'shinkan'){
    // 入部する1年生の数は、部の評判と今日の演奏しだい（席が足りなければ控えに入る）
    const empty = SEATS.filter(x => !s.members.some(m => m.seat === x.id)).length;
    const n = clamp(Math.round(1.5 + (s.rep ?? 30) / 8 + (q - 40) / 12 + (s.morale > 70 ? 1 : 0)), 1, Math.max(1, empty + 2));
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
  if(ev.id === 'teien' && !hasSeniors(s)){
    return {morale: 0, text: q >= 60 ? '満員の客席から、いつまでも拍手が鳴りやまなかった。来年が楽しみだ、という声が聞こえた。' : q >= 35 ? '客席から大きな拍手が送られた。みんな晴れやかな顔でステージを降りた。' : '思うようにはいかなかったが、最後まで吹ききった。客席からあたたかい拍手が送られた。'};
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
  for(const m of stagers(s)) f[m.id] = Math.round((0.55 * zb + 0.84 * gauss(s.stageDay.seed, m.id, 'form') - (s.stageDay.calm.includes(m.id) ? 0.7 : 0)) * 100) / 100;
  return f;
}
const wingActions = s => s.stageDay ? s.stageDay.calm.length + (s.stageDay.huddle ? 1 : 0) : 0;
// 舞台袖で、見るからに緊張している部員（メンタルが弱く、今日の揺れが大きい）
function tenseMembers(s){
  const f = stageForm(s);
  if(!f) return [];
  return stagers(s).filter(m => (m.mental ?? 40) < 50 && (f[m.id] > 0.6 || s.stageDay.calm.includes(m.id)))
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
  // 本番を重ねて「度胸」を身につけた部員は、日誌に1行でまとめる
  const brave = [];
  for(const m of stagers(s)){ m.mental = clamp((m.mental ?? 40) + (ev.kind === 'contest' ? 4 : 2), 0, 100); if(addSkill(s, m, 'nerve', ev.kind === 'contest' ? 0.12 : 0.08, true)) brave.push(m); }
  for(const lv of [1, 2]){ const ms = brave.filter(m => skillLv(m, 'nerve') === lv); if(ms.length) addLog(s, `${ms.map(m => m.name).join('、')}が、本番を重ねてスキル「${SKILLS.nerve.name}${skillMark(lv)}」を身につけた。${SKILLS.nerve.desc}。`); }
  for(const x of p.mental || []){
    const m = s.members.find(y => y.id === x.mid);
    if(!m) continue;
    if(x.kind === 'freeze'){ m.mental = clamp(m.mental + 3, 0, 100); remember(s, m, `${ev.title}の本番で、緊張して頭が真っ白になった。`, 'freeze'); }
    else remember(s, m, `${ev.title}の本番で、これまでで一番の音が出た。`, 'zone');
  }
  const names = kind => (p.mental || []).filter(x => x.kind === kind).map(x => s.members.find(y => y.id === x.mid)?.name).filter(Boolean);
  if(names('freeze').length) addLog(s, `${names('freeze').join('、')}は、本番で緊張に飲まれてしまった。`);
  if(names('zone').length) addLog(s, `${names('zone').join('、')}は、本番でいつも以上の音を出した。`);
}

/* ===== 評判 =====
   演奏会やコンクールの結果で、学校や町での評判（s.rep、0〜100）が上がり下がりする。
   評判が節目を越えると「私も入りたい」という生徒が入部してくる。新入生歓迎演奏で入部する1年生の数も、評判しだい。 */
const REP_STEPS = [8, 12, 16, 20, 25, 30, 36, 42, 50, 58, 66, 75, 85, 95];
const REP_CONCERT = {shinkan: .6, matsuri: 1, joint: 1, bunkasai: 1.2, teien: 1.5};
const REP_AWARD = {gold: 6, silver: 3, bronze: 1};
const REP_LEVEL = {pref: 1, block: 1.6, national: 2.4};
const nextRepStep = s => REP_STEPS.find(x => x > s.rep) ?? null;
function gainRep(s, d){
  const before = s.rep ?? 30;
  s.rep = Math.round(clamp(before + d, 0, 100) * 10) / 10;
  if(Math.abs(s.rep - before) >= 0.5) addLog(s, `部の評判が${s.rep > before ? '上がった' : '下がった'}（${Math.round(before)}→${Math.round(s.rep)}）。`);
  let n = 0;
  for(const x of REP_STEPS){
    const f = `rep:${s.year}:${x}`;
    if(before < x && s.rep >= x && !s.flags[f]){ s.flags[f] = true; n += 1 + (hash(s.year, x, 'join') < 0.45 ? 1 : 0) + (x >= 50 && hash(s.year, x, 'join2') < 0.35 ? 1 : 0); }
  }
  // 席が足りないときは、控えとして入る（多くても3人まで）
  n = Math.min(n, Math.max(0, SEATS.length + 3 - s.members.length - (s.recruits || []).length));
  if(n){
    const rs = makeRecruits(s, n, {joiners: true});
    s.recruits = [...(s.recruits || []), ...rs];
    s.recruitWhen = Math.max(s.recruitWhen ?? 0, s.week + 1);
    addLog(s, `演奏を聴いた${rs.map(r => `${r.grade}年生の${r.name}`).join('、')}が、「私も入りたいです」と音楽室に来た。`);
  }
}
function finishStage(s0){
  const s = clone(s0);
  const p = s.pending;
  const ev = eventAt(s, s.week);
  if(!p) return s;
  stageAftermath(s, ev, p);
  gainCoach(s, p.kind === 'concert' ? 3 : 5 + (p.judge?.award === 'gold' ? 3 : 0) + (p.judge?.rep ? 4 : 0));
  if(p.kind === 'concert'){
    if(p.recruits){ s.recruits = [...(s.recruits || []), ...makeRecruits(s, p.recruits)]; s.recruitWhen = Math.max(s.recruitWhen ?? 0, 3); }
    if(p.morale) s.morale = clamp(s.morale + p.morale, 0, 100);
    addLog(s, `${ev.title}：${p.text}`);
    gainRep(s, (REP_CONCERT[ev.id] ?? 1) * (1 + clamp((p.q - 25) / 8, -2, 6)));
    adj(s, 'stamina', -8);
    if(ev.final) s.finalResult = {piece: PIECES[s.pieceId].title, q: Math.round(p.q)};
    return ev.final ? endSeason(s) : nextWeek(s);
  }
  const j = p.judge;
  const L = LEVELS[ev.level];
  const nm = {gold: '金賞', silver: '銀賞', bronze: '銅賞'}[j.award];
  s.season.push({level: ev.level, award: j.award, rep: j.rep, avg: Math.round(j.avg * 10) / 10});
  addLog(s, `${L.name}の結果は${nm}${j.rep ? `。${L.rep}への代表に選ばれた！` : j.award === 'gold' && L.rep ? '。代表には届かなかった。' : '。'}`);
  gainRep(s, (REP_AWARD[j.award] + (j.rep ? 4 : 0)) * REP_LEVEL[ev.level]);
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
  if(s.members.some(m => m.out)) addLog(s, 'コンクールの控えだった部員も、秋からはまた全員で吹く。');
  for(const m of s.members) delete m.out;
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
  addLog(s, seniors.length ? `定期演奏会が終わり、3年生${seniors.length}人が引退した。` : '定期演奏会が終わり、この1年がしめくくられた。');
  return s;
}
// 顧問になった年に、1年生として入部してきた部員（いちばん最初に一から育てた代）
const startYearOf = s => s.startYear ?? (s.history[0]?.year ?? s.year);
const isFirstClass = (s, m) => m.joined === startYearOf(s) && m.first?.y === m.joined && (m.joinGrade ?? 1) === 1;
function newYear(s0){
  const s = clone(s0);
  const pid = s.contestPiece || s.pieceId, pieceTitle = pid ? PIECES[pid].title : '';
  const seniors = s.members.filter(m => m.grade === 3);
  s.history.push({year: s.year, piece: pieceTitle, results: s.season, final: s.finalResult || null,
    retired: seniors.map(m => m.name), firstClass: seniors.some(m => isFirstClass(s, m))});
  if(seniors.some(m => isFirstClass(s, m))) addLog(s, '顧問になって最初に入部してきた代が、卒業していった。部の物語は、これからも続く。');
  // 1年をやりきった経験（この年の最初の週の記録より前に入れる。最初の1年を終えると Lv2 になるくらい）
  gainCoach(s, 10);
  s.finalResult = null;
  s.members = s.members.filter(m => m.grade < 3).map(m => ({...m, grade: m.grade + 1}));
  assignTitles(s.members);
  // 年度の終わりに入部を決めた生徒は、新しい年度の最初に担当を決める（学年は1つ上がる）
  for(const r of s.recruits || []) r.grade = Math.min(3, (r.grade || 1) + 1);
  s.year++; s.week = 0; s.phase = 'choose'; s.pieceId = null; s.season = []; s.pending = null;
  s.finalWeek = null; s.autumnFrom = null; s.contestPiece = null; s.chooseFinal = false;
  for(const m of s.members) delete m.out;
  s.audition = null;
  // 去年までの曲の譜読みは、半分くらい覚えている
  for(const m of s.members) for(const k of Object.keys(m.fam || {})){
    if(!PIECES[k]){ delete m.fam[k]; continue; }
    m.fam[k] = readOf(m, k).map(v => Math.round(v * 0.5));
    if(m.fam[k].every(v => !v)) delete m.fam[k];
  }
  s.cohesion = Math.round(s.cohesion * 0.6); s.fam = freshFam(); s.morale = 70; s.hallExp = 0; s.lastDelta = {}; s.plan = {}; s.planSpan = {}; s.recruitWhen = null;
  // 評判は、年が変わると少しだけ忘れられる
  s.rep = Math.round((s.rep ?? 30) * 0.9 * 10) / 10;
  for(const m of s.members){ m.sta = 100; for(const k of STAT_KEYS) m.stats[k] = Math.round(Math.max(0, m.stats[k] - 2) * 10) / 10; }
  // 年度のはじめの力（年度末のふり返りで、この1年の伸びを出す）
  for(const m of s.members) m.y0 = {y: s.year, a: Math.round(avgStat(m) * 10) / 10};
  syncSta(s);
  addLog(s, `${s.year}年度がはじまった。部員は${s.members.length}人。自由曲を決めよう。`);
  return s;
}

/* ===== 1年生と楽器決め ===== */
// 部をつくった最初の5人は、旋律・金管・低音がそろうように希望の楽器をばらけさせる
const FOUNDER_HOPES = [['fl', 'cl', 'asax', 'ob'], ['tp', 'hn'], ['tb', 'euph', 'tuba'], ['fl', 'cl', 'asax', 'tp', 'tsax', 'hn', 'tb', 'euph', 'tuba', 'timp', 'bsax']];
// opts.founders：最初の5人、opts.joiners：評判を聞いて途中から入ってくる生徒（2年生のこともある）
function makeRecruits(s, n, opts = {}){
  const used = new Set([...s.members, ...(s.recruits || [])].map(m => m.name));
  const empty = SEATS.filter(x => !s.members.some(m => m.seat === x.id));
  const insts = [...new Set(empty.map(x => x.inst))];
  const all = Object.keys(PART_INST).map(p => PART_INST[p]).filter((v, i, a) => a.indexOf(v) === i);
  const out = [], hopes = [];
  for(let i = 0; i < n; i++){
    s.seq = (s.seq || 0) + 1;
    const id = `m${s.year}-${opts.joiners ? 'j' : 'n'}${s.seq}`, seed = ['recruit', s.year, s.seq];
    let hope;
    if(opts.founders){
      const pool = FOUNDER_HOPES[Math.min(i, FOUNDER_HOPES.length - 1)].filter(x => !hopes.includes(x));
      hope = pool[Math.floor(hash(...seed, 'hope') * pool.length)];
    } else {
      const pool = hash(...seed, 'pool') < 0.75 && insts.length ? insts : all;
      hope = pool[Math.floor(hash(...seed, 'hope') * pool.length)];
    }
    hopes.push(hope);
    // 経験者の割合：最初の5人は2人ほど。評判が上がると、経験者も入ってきやすくなる
    const exp = opts.founders ? i === 1 || i === 3 : hash(...seed, 'exp') < 0.3 + (s.rep ?? 30) / 250;
    const grade = opts.joiners && s.week > 0 && s.week < 20 && hash(...seed, 'grade') < 0.25 ? 2 : 1;
    out.push({id, name: makeName(used, ...seed), hope, exp, grade, trait: pickTrait(...seed)});
  }
  return out;
}
// その楽器の空いている席のうち、どこに座ってもらうのがよいか：誰もいないパート → 1stの席 → 和音が欠けやすい席の順
function seatRank(s, taken){
  const covered = new Set([...s.members.filter(m => m.seat).map(m => SEAT[m.seat].part), ...[...taken].map(id => SEAT[id].part)]);
  return id => (covered.has(SEAT[id].part) ? 100 : 0) + (PRINCIPAL.includes(id) ? 0 : 50) + FILL_ORDER.indexOf(id) / 100;
}
const PRINCIPAL = ['cl1a', 'fl1a', 'tp1a', 'asax1', 'tuba1', 'euph1', 'hn1', 'tb1', 'ob1', 'perc1', 'tsax1', 'bsax1', 'fg1', 'bcl1', 'picc1', 'ebcl1', 'btb1', 'cb1'];
function autoAssign(s){
  const free = FILL_ORDER.filter(id => !s.members.some(m => m.seat === id));
  const map = {}, taken = new Set();
  const best = ids => { const r = seatRank(s, taken); return ids.slice().sort((a, b) => r(a) - r(b))[0]; };
  for(const r of s.recruits || []){
    const want = best(free.filter(id => SEAT[id].inst === r.hope && !taken.has(id)));
    if(want){ map[r.id] = want; taken.add(want); }
  }
  for(const r of s.recruits || []){
    if(map[r.id] !== undefined) continue;
    const id = best(free.filter(x => !taken.has(x)));
    map[r.id] = id || null;
    if(id) taken.add(id);
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
    const g = r.grade || 1;
    // 中学で同じ楽器を吹いていた部員は、はじめから少し吹ける
    const base = (r.exp && match ? 30 : r.exp ? 16 : 6) + (g - 1) * (r.exp ? 8 : 4);
    const stats = makeStats(base, r.exp ? 5 : 3, 'stat', r.id);
    s.members.push({id: r.id, name: r.name, grade: g, joinGrade: g, seat, trait: r.trait, joined: s.year, exp: !!r.exp, mental: mentalInit(r.trait, g, 'stat', r.id) + (r.exp ? 6 : 0),
      stats, first: {y: s.year, w: s.week, stats: {...stats}}, hope: r.hope, sta: Math.round(s.members.length ? s.stamina : 100), fam: {},
      sp: innateSkills(r.id, r.exp), bent: {},
      // コンクールのメンバーが決まったあとに入った部員は、今年のコンクールには出ない
      ...(lineupSet(s) ? {out: true} : {})});
  }
  const n = (s.recruits || []).length;
  s.morale = clamp(s.morale + happy * 1.5 - (n - happy), 0, 100);
  if(s.members.length > n) s.cohesion = clamp(s.cohesion - n * 0.8, 0, 100);
  addLog(s, `${n === 1 ? s.recruits[0].name : `新しい部員${n}人`}の担当が決まった。希望どおりの楽器になったのは${happy}人。`);
  s.recruits = null; s.recruitWhen = null;
  assignTitles(s.members);
  syncSta(s);
  // 新しい部員が入って最初の合奏を残しておく（引退のとき、入部したころの音として聴ける）
  if(n && s.pieceId && s.week <= 3){
    const rec = addRec(s, `${s.year}年 新しい部員が入って最初の合奏`, {venue: 'room'});
    rec.keep = true;
    addLog(s, '新しい部員も入って、最初の合奏を録音した。');
  }
  return s;
}
// 新しく入った部員の担当を決める画面を出すか（新入生は本入部の週、途中入部はすぐ）
const recruitsDue = s => !!(s.recruits && s.recruits.length && (s.phase === 'choose' || s.week >= (s.recruitWhen ?? 0)));
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
      // 入れ替えた曲は近い曲に置き換える（指揮の記録と区間は、曲の長さが変わるので外す）
      const mv = id => PIECE_MOVED[id] || id;
      if(PIECE_MOVED[s.pieceId]) s.planSpan = {};   // 練習する区間の番号は、曲が変わると意味がなくなる
      s.pieceId &&= mv(s.pieceId);
      s.contestPiece &&= mv(s.contestPiece);
      for(const [old, nu] of Object.entries(PIECE_MOVED)) if(old in s.fam){ s.fam[nu] = Math.max(s.fam[nu] || 0, s.fam[old]); delete s.fam[old]; }
      // 部員ひとりずつの譜読みと録音の控えは区間の数が曲ごとにちがうので、曲全体の平均（どの区間も同じ値）にして移す
      const meanOf = v => Array.isArray(v) ? (v.length ? v.reduce((a, x) => a + (x || 0), 0) / v.length : 0) : v || 0;
      for(const m of s.members) for(const [old, nu] of Object.entries(PIECE_MOVED)) if(m.fam && old in m.fam){
        if(!(nu in m.fam)) m.fam[nu] = Math.round(meanOf(m.fam[old]) * 10) / 10;
        delete m.fam[old];
      }
      for(const r of s.recs || []) if(PIECE_MOVED[r.pieceId]){
        r.pieceId = PIECE_MOVED[r.pieceId]; delete r.conduct; delete r.span;
        for(const x of r.snap?.members || []) if(x.pfams){ x.pfam = meanOf(x.pfams); delete x.pfams; }
      }
      s.fam = {...freshFam(), ...s.fam};   // あとから増えた曲
      s.startYear ??= s.history[0]?.year ?? s.year;
      for(const m of s.members) m.mental ??= mentalInit(m.trait, m.grade, 'mig', m.id);
      // 部員ひとりずつの体力・方針と、部の評判（2026年10月に、練習を一人ずつ指示する形にした）
      for(const m of s.members) m.sta ??= s.stamina ?? 100;
      // 方針は部全体で1つに（2026年10月）：部員ごとの方針がそろっていればそれを、ばらばらならおまかせ。なくした方針もおまかせに
      if(s.policy == null){ const ps = [...new Set(s.members.map(m => m.policy || 'auto'))]; s.policy = ps.length === 1 ? ps[0] : 'auto'; }
      if(!POLICY_BY[s.policy]) s.policy = 'auto';
      for(const m of s.members) delete m.policy;
      // 部員ひとりずつの譜読み（2026年10月）：それまでの部全体の仕上がりを、全員の譜読みとして引きつぐ
      for(const m of s.members) m.fam ??= Object.fromEntries(Object.entries(s.fam).filter(([, v]) => v > 0));
      syncSta(s);
      if(s.rep == null){
        const golds = [...(s.history || []).flatMap(h => h.results || []), ...(s.season || [])].filter(r => r.award === 'gold').length;
        s.rep = Math.min(70, 30 + 4 * golds);
      }
      s.plan ||= {}; s.seq ??= 100;
      s.trend ||= [];   // 部の実力のグラフ（2026年10月）。前のセーブは、ここから記録を始める
      // 顧問の指導力（2026年10月）：前のセーブは、顧問になってからの年数と週から経験を見積もる
      s.coach ||= {xp: Math.round(50 * (s.year - (s.startYear ?? s.year)) + 1.5 * s.week)};
      // スキルと育ち方（2026年10月）：前のセーブの部員にも、生まれつきのスキルを決める
      for(const m of s.members){ m.sp ??= innateSkills(m.id, m.exp); m.bent ??= {}; }
      // 本番の「一番の音」「頭が真っ白」の思い出は、同じ種類のいちばん新しいものだけ残す（2026年10月から）
      for(const m of s.members) if(m.story){
        for(const x of m.story) if(!x.k){ const k = /これまでで一番の音/.test(x.t) ? 'zone' : /頭が真っ白/.test(x.t) ? 'freeze' : null; if(k) x.k = k; }
        const last = {}; m.story.forEach((x, i) => { if(x.k) last[x.k] = i; });
        m.story = m.story.filter((x, i) => !x.k || last[x.k] === i);
      }
      if(s.recruits && s.recruitWhen == null) s.recruitWhen = 3;
      delete s.focus;
      return s;
    }
  }catch(e){}
  return null;
}
