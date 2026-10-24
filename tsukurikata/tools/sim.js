// 部の何年分かを、画面なしで早送りする（育成・評判・オーディションのバランスを見る）
//   node tsukurikata/tools/sim.js [年数] [方針] [曲] [メンバー]
//   例：node tsukurikata/tools/sim.js 5 auto galop best
// 方針は auto / basics / easy、メンバーは all（全員出る）か best（オーディションでおすすめを選ぶ）
const fs = require('fs'), vm = require('vm'), path = require('path');
const [YEARS = '3', POL = 'auto', PIECE = 'galop', LINEUP = 'all'] = process.argv.slice(2);
const ctx = vm.createContext({console, Math, JSON, Object, Array, Set, Map, WeakMap, Float32Array, Number, String, Error, Infinity, NaN, setTimeout,
  YEARS: +YEARS, POL, PIECE, LINEUP});
// 曲（js/pieces/*.js）は index.html に書いた順に読む
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const pieces = [...html.matchAll(/src="js\/(pieces\/[^"]+)\.js"/g)].map(m => m[1]);
for(const f of ['util', 'instruments', 'venues', 'scores', ...pieces, 'band', 'game'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), ctx, {filename: f + '.js'});

vm.runInContext(`
let s = freshState(2026), guard = 0, done = 0;
const stat = () => ({部員: s.members.length, 評判: Math.round(s.rep), 平均: Math.round(STAT_KEYS.reduce((a, k) => a + bandAvg(s, k), 0) / 4),
  まとまり: Math.round(s.cohesion), 仕上がり: Math.round(s.fam[s.pieceId] || 0),
  譜読み: Math.round(s.pieceId ? readAvg(s, s.pieceId) : 0), 体力: Math.round(s.stamina), やる気: Math.round(s.morale), 顧問Lv: coachLevel(s)});
const grades = () => [1, 2, 3].map(g => { const ms = s.members.filter(m => m.grade === g); return g + '年' + ms.length + '人' + (ms.length ? '（平均' + Math.round(ms.reduce((a, m) => a + avgStat(m), 0) / ms.length) + '）' : ''); }).join(' ');
while(guard++ < 2000 && done < YEARS){
  if(recruitsDue(s) && !s.pending){ s = assignRecruits(s, autoAssign(s)); continue; }
  if(s.phase === 'choose'){ s = choosePiece(s, PIECE); s = setPolicy(s, POL); continue; }
  if(s.phase === 'chooseSet'){ s = chooseSetPiece(s, setOffer(s)[0]); continue; }
  if(s.phase === 'end'){ console.log('== ' + s.year + '年度の終わり ' + grades() + ' ' + JSON.stringify(stat())); s = autoWinter(s); s = setPolicy(s, POL); done++; continue; }
  if(s.pending){ s = finishStage(s); continue; }
  const ev = eventAt(s, s.week);
  if(ev && ev.kind === 'audition' && s.audition && !s.audition.decided){
    const out = LINEUP === 'best' ? recommendLineup(s) : new Set();
    console.log('  オーディション：' + seated(s).length + '人中 ' + (seated(s).length - out.size) + '人が出る（予想 ' + predictContest(s, out).avg.toFixed(1) + '点）');
    s = setLineup(s, out); continue;
  }
  if(ev && (ev.kind === 'concert' || ev.kind === 'contest')){
    s = beginStage(s);
    const p = s.pending;
    console.log(s.year + ' ' + wkShort(s.week) + ' ' + ev.title + '：' + (p.kind === 'concert' ? '出来 ' + Math.round(p.q) + '点' + (p.recruits ? '・入部 ' + p.recruits + '人' : '')
      : {gold: '金賞', silver: '銀賞', bronze: '銅賞'}[p.judge.award] + (p.judge.rep ? '（代表）' : '') + ' 平均' + p.judge.avg.toFixed(1)) + ' ' + JSON.stringify(stat()));
    continue;
  }
  if(ev && ev.kind === 'forced'){ s = practiceWeek(s, 'test'); continue; }
  if(s.chooseFinal){ s = chooseFinalPiece(s, s.pieceId); continue; }
  if(s.episode){ s = resolveEpisode(s, episodeView(s)?.choices[0]?.k ?? 0); continue; }
  // 行事には、★のついた（行くと特に伸びる）部員から先に、選べるだけ連れて行く
  if(s.outing){ const v = outingView(s); const ms = v ? ss(s).slice().sort((a, b) => v.fit.has(b.id) - v.fit.has(a.id) || Math.random() - 0.5) : [];
    s = v ? resolveOuting(s, ms.slice(0, v.n).map(m => m.id)) : {...s, outing: null}; continue; }
  // 相談には、ふつうの顧問のように、どれかの答えを選ぶ
  if(s.consult){ const v = consultView(s); s = v ? resolveConsult(s, Math.floor(Math.random() * v.choices.length)) : {...s, consult: null}; continue; }
  s.policy = POL;
  s = practiceWeek(s);
}
`, ctx);
