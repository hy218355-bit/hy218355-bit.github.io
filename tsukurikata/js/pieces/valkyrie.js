'use strict';
/* ===== 自由曲：ワーグナー 楽劇《ワルキューレ》より「ワルキューレの騎行」（第3幕の前奏曲）=====
   ロ短調、実音のまま。8分の9拍子を、1拍＝付点4分音符（1小節＝3拍）で数える。
   楽譜は Schott 社の総譜《ワルキューレ》第3幕（Plate 27002。パブリックドメイン、IMSLP #341993）の頭から27ページまでを1小節ずつ読み、
   Schott 社 1877年ごろの演奏会用「ワルキューレの騎行」の総譜（Plate 22139、IMSLP #1006817）と、
   クリントヴォルト編のピアノ・声楽譜（Schott 1908年、IMSLP #33732）で照らし合わせた。
   形：前奏（木管のトリルと弦の駆け上がり → ファゴット・チェロとホルンの呼びかけ）→ 主題1（ロ短調。バストランペットとホルン6・8番）
   → 主題2（ニ長調から嬰ヘ長調へ。ホルン5・7番とトランペット2・3番）→ 主題3（ロ短調。トロンボーン4本）
   → 終わり（ワーグナー自身が書いた演奏会用の終わりの、最後の2小節：弦の駆け上がりと、全員のロ長調の和音）。
   ゲームの小節0は弱起（弦の駆け上がり）だけ。原曲の1〜25小節目がゲームの1〜25小節目、37〜40小節目が26〜29小節目、終わりが30・31小節目。
   原曲の26〜36小節目（ホ短調から回ってくる3回目の主題）は、1分半に収めるために省いた。25小節目も36小節目も嬰ヘ（属和音）なので、
   25小節目の終わりからトロンボーンの弱起につなげた */
{
  // 長さ（1拍＝付点4分音符）：8分＝1/3、16分＝1/6、32分＝1/12、5連符（4分音符を5つに分けた16分）＝2/15
  const E8 = 1 / 3, S16 = 1 / 6, T32 = 1 / 12, Q5 = 2 / 15, GAP = 1 / 30;
  const rnd = x => Math.round(x * 180) / 180;
  const ev = (m, b, d, o) => ({m, b: rnd(b), d: rnd(d), ...o});
  // line() の長さを記号で書く：d＝付点8分、e＝8分、s＝16分、y＝8分を少し短く、Y＝付点4分を少し短く、z＝その分の休み
  const DUR = {Q: 1, d: .5, e: E8, s: S16, y: E8 - GAP, Y: 1 - GAP, z: GAP};
  const V = (src, from) => line(src.replace(/:([A-Za-z])/g, (_, c) => ':' + DUR[c]), from).map(e => ({...e, b: rnd(e.b), d: rnd(e.d)}));

  // 和音（ゲームの拍で）。15・39小節目（原曲の15・39小節目）は2拍目から属和音、22小節目は3拍目から嬰ハの属7
  const VK_CH = chords('Bm:45 D:1 A:2 D:18 A:2 C#7:1 F#:9 Bm:6 D:1 A:2 D:3 F#7:3 B:1');
  const chAt = b => VK_CH.find(c => b >= c.b - 1e-6 && b < c.b + c.d - 1e-6) || VK_CH[VK_CH.length - 1];
  // 音階（トリルの上の音と、32分音符の駆け上がりに使う）
  const SC_BM = [11, 1, 2, 4, 6, 7, 9], SC_A = [9, 11, 1, 2, 4, 6, 8], SC_FS = [6, 8, 10, 11, 1, 3, 5], SC_B = [11, 1, 3, 4, 6, 8, 10];
  const VK_SCALE = [[0, SC_BM], [66, SC_A], [68, SC_FS], [78, SC_BM], [90, SC_B]];
  const scAt = b => sectionAt(VK_SCALE, b, SC_BM);
  const pcOf = m => (m % 12 + 12) % 12;
  // 音名（0〜11）を、center にいちばん近い高さに
  const near = (pc, center) => center + ((pc - center) % 12 + 18) % 12 - 6;
  const fifth = c => (c.root + 7) % 12;
  // m から下へ（上へ）、和音の3つの音・音階の音を k 個
  const walk = (m, k, dir, ok) => { const out = []; for(let x = m + dir; out.length < k; x += dir) if(ok(pcOf(x))) out.push(x); return out; };
  const chordDown = (m, c, k) => walk(m, k, -1, p => c.pcs.slice(0, 3).includes(p));
  const scaleDown = (m, b, k) => walk(m, k, -1, p => scAt(b).includes(p));
  const scaleUp = (m, b, k) => walk(m, k, 1, p => scAt(b).includes(p));

  /* ===== 弦の音型（総譜どおり。3つのパートが1拍ずつずれて同じ形を回す）=====
     原曲9小節目から：①5連符で和音を駆け下りて8分音符 ②4分休符と32分音符4つで駆け上がって8分音符。
     第1ヴァイオリンは ①→②→頂上の8分音符、第2ヴァイオリンは 8分音符→①→32分音符で駆け下りる、ヴィオラは ②→8分音符→①。
     音は小節の和音から決める（ロ短調の小節は総譜と同じ音になる）。15・22・39小節目は総譜では一部が3連符になるが、同じ型にそろえた */
  const STR = {v1: [], v2: [], va: [], vc: []};
  const strBar = B => {
    const c1 = chAt(B), c2 = chAt(B + 1), c3 = chAt(B + 2), cn = chAt(B + 3);
    const arp = (top, c, at, out) => [top, ...chordDown(top, c, 5)].forEach((m, k) => out.push(ev(m, at + (k < 5 ? k * Q5 : 2 / 3), k < 5 ? Q5 : E8)));
    const runUp = (goal, at, out) => [...scaleDown(goal, at, 4).reverse(), goal].forEach((m, k) => out.push(ev(m, at - E8 + k * T32, k < 4 ? T32 : E8)));
    // 第1ヴァイオリン
    arp(near(fifth(c1), 90), c1, B, STR.v1);
    runUp(near(fifth(c3), 90), B + 2, STR.v1);
    // 第2ヴァイオリン（頭の8分音符は、前の小節の終わりの駆け下りの行き先）
    STR.v2.push(ev(near(c1.root, 59), B, E8));
    arp(near(c2.root, 83), c2, B + 1, STR.v2);
    if(B + 3 < 90) scaleUp(near(cn.root, 59), B + 2, 4).reverse().forEach((m, k) => STR.v2.push(ev(m, B + 2 + 2 / 3 + k * T32, T32)));
    // ヴィオラ
    runUp(near(fifth(c2), 78), B + 1, STR.va);
    arp(near(fifth(c3), 78), c3, B + 2, STR.va);
  };
  // 前奏の駆け上がり（32分音符4つ → 次の拍の8分音符）。第2ヴァイオリンとチェロの弱起から、小節の終わりごとに受け渡す
  const rush = (root, at, out) => [nn(root), ...scaleUp(nn(root), at, 4)].forEach((m, k) => out.push(ev(m, at + k * T32, k < 4 ? T32 : E8)));
  rush('B3', 2 + 2 / 3, STR.v2); rush('B2', 2 + 2 / 3, STR.vc);
  rush('B4', 5 + 2 / 3, STR.v1); rush('B3', 5 + 2 / 3, STR.va);
  rush('B5', 8 + 2 / 3, STR.v1); rush('B4', 8 + 2 / 3, STR.v2);
  rush('B4', 11 + 2 / 3, STR.v1); rush('B3', 11 + 2 / 3, STR.va);
  rush('B3', 14 + 2 / 3, STR.v2); rush('B2', 14 + 2 / 3, STR.vc);
  rush('B4', 17 + 2 / 3, STR.v1); rush('B3', 17 + 2 / 3, STR.va);
  rush('B5', 20 + 2 / 3, STR.v1); rush('B4', 20 + 2 / 3, STR.v2); rush('B3', 20 + 2 / 3, STR.va);
  rush('B5', 23 + 2 / 3, STR.v1); rush('B4', 23 + 2 / 3, STR.va);
  ['F#4', 'E4', 'D4', 'C#4'].forEach((n, k) => STR.v2.push(ev(nn(n), 26 + 2 / 3 + k * T32, T32)));   // 8小節目の終わり：第2ヴァイオリンだけ駆け下りる
  for(let B = 27; B < 90; B += 3) strBar(B);

  /* ===== 木管のトリル（総譜は16分音符で2つの音を行き来する書き方）=====
     前奏の1〜8小節目は、組ごとに小節単位で入ったり休んだりする。9小節目からは6つの組が1拍ずつずれて、
     32分音符4つの駆け上がり → 3拍のトリル → 8分音符 → 休み、を2小節ごとにくり返す（いつもどこかの組がトリルを始めている）。
     トリルの音は和音の5度（ロ短調は F#、ニ長調は A、嬰ヘ長調は C#）で、上の音は音階の1つ上 */
  const TR_CENTER = {picc: 90, fl2: 85, ob: 78, ebcl: 80, asax2: 66, tsax: 66, bcl: 54};
  // 組：ピッコロ1・フルート1 → ピッコロ、ピッコロ2・フルート2 → フルート2nd、オーボエ1・クラ1 → オーボエ、オーボエ2・クラ2 → E♭クラ、
  // オーボエ3・クラ3 → アルトサックス2nd、イングリッシュホルン → テナーサックス、バスクラ → バスクラ
  const TR_PLAN = {
    picc:  {intro: [[9, 12], [21, 29]], first: 32},
    fl2:   {intro: [[9, 12], [21, 27]], first: 29},
    ob:    {intro: [[6, 15], [18, 28]], first: 31},
    ebcl:  {intro: [[6, 15], [18, 27]], first: 28},
    asax2: {intro: [[3, 9], [12, 27]], first: 30},
    tsax:  {intro: [[3, 9], [12, 24]], first: 27},
    bcl:   {intro: [[3, 6], [15, 24]], first: 27},
  };
  const trLine = part => {
    const out = [], note = b => near(fifth(chAt(b)), TR_CENTER[part]);
    const trill = (a, z) => { for(let s = a; s < z;){ const m = note(s); let e = s + 1; while(e < z && note(e) === m) e++; out.push(ev(m, s, e - s, {tr: true})); s = e; } };
    const close = z => out.push(ev(note(z), z, E8));
    for(const [a, z] of TR_PLAN[part].intro){ trill(a, z); close(z); }
    for(let s = TR_PLAN[part].first; s < 90 - E8; s += 6){
      scaleDown(note(s), s, 4).reverse().forEach((m, k) => out.push(ev(m, s - E8 + k * T32, T32)));
      const z = Math.min(90, s + 3);
      trill(s, z);
      if(z < 90) close(z);
    }
    return out;
  };

  /* ===== ファゴット・チェロの呼びかけと、ホルンの合いの手（原曲5小節目から）=====
     2拍目：根音（付点8分）・その1オクターブ上（16分）・5度（8分）、3拍目：5度（付点8分）・その1オクターブ上・根音。
     ホルン2・4番は2拍目の形と3拍目の頭の8分音符、ホルン1・3番は3拍目の形と次の小節の頭の8分音符を吹いて、チェロを追いかける */
  const CALL_BARS = [];
  for(let B = 15; B < 78; B += 3) CALL_BARS.push(B);
  for(let B = 78; B < 90; B += 3) CALL_BARS.push(B);
  const callBar = (B, kind) => {
    const c2 = chAt(B + 1), c3 = chAt(B + 2);
    const R2 = near(c2.root, 47), F2 = R2 + 7, R3 = near(c3.root, 47), F3 = R3 + 7, st = {st: true};
    const b2 = [ev(R2, B + 1, .5), ev(R2 + 12, B + 1.5, S16, st), ev(F2, B + 1 + 2 / 3, E8 - GAP, st)];
    const b3 = [ev(F3, B + 2, .5), ev(F3 + 12, B + 2.5, S16, st), ev(R3 + 12, B + 2 + 2 / 3, E8 - GAP, st)];
    return kind === 'h24' ? [...b2, ev(F3, B + 2, E8, st)] : kind === 'h13' ? [...b3, ev(R3 + 12, B + 3, E8, st)] : [...b2, ...b3];
  };
  const CALL = CALL_BARS.flatMap(B => callBar(B, 'all'));

  /* ===== 主題（付点のリズム。頭の音にアクセント、16分音符と8分音符にスタッカート。付点4分音符は1つずつ吹き直す）===== */
  const themeBar = (a, b, c, d) => `${a}:d> ${b}:s' ${a}:y' r:z ${c}:Y r:z ${d}:Y r:z`;
  // 主題1：バストランペット（演奏会用ではトロンボーン1・2番）とホルン6・8番。F#4 をのばし、バストランペットは18小節目の頭まで
  const T1 = [...V('F#3:e', 38 + 2 / 3), ...V([themeBar('B3', 'F#3', 'D4', 'B3'), themeBar('D4', 'B3', 'F#4', 'D4'), themeBar('F#4', 'D4', 'A4', 'A3'),
    "D4:d> A3:s' D4:y' r:z F#4:5.33333"].join(' | '), 39)];
  // 主題2：ホルン5・7番とトランペット2・3番。A#4 をのばし、トランペットは25小節目の頭まで
  const T2 = [...V('A3:e', 59 + 2 / 3), ...V([themeBar('D4', 'A3', 'F#4', 'D4'), themeBar('F#4', 'D4', 'A4', 'F#4'), themeBar('A4', 'F#4', 'C#5', 'C#4'),
    "F#4:d> C#4:s' F#4:y' r:z A#4:5.33333"].join(' | '), 60)];
  // 主題3：トロンボーン4本（1・2番がこの高さ、バス・コントラバストロンボーンが1オクターブ下）
  const T3 = [...V('F#3:e', 77 + 2 / 3), ...V([themeBar('B3', 'F#3', 'D4', 'B3'), themeBar('D4', 'B3', 'F#4', 'D4'), themeBar('F#4', 'D4', 'A4', 'A3'),
    "D4:d> A3:s' D4:y' r:z F#4:2"].join(' | '), 78)];
  // 終わり（演奏会用の終わりの最後の2小節）：弦が16分音符で2オクターブ半を駆け上がり、全員でロ長調の和音を8分音符で1つ
  const RUN = [nn('F#3'), ...scaleUp(nn('F#3'), 90, 17)].map((m, k) => ev(m, 90 + k * S16, S16));
  const FIN = ev(nn('B5'), 93, E8, {acc: true});
  const FIN_NOTE = {picc: 'B6', fl2: 'F#6', ob: 'D#6', ebcl: 'B5', cl2: 'F#5', cl3: 'D#5', bcl: 'B2', asax1: 'F#5', asax2: 'D#5', tsax: 'B4', bsax: 'B2',
    fg: 'B2', tp1: 'B4', tp2: 'F#4', tp3: 'D#4', hn1: 'F#4', hn2: 'D#4', hn3: 'B3', hn4: 'F#3', tb1: 'B3', tb2: 'F#3', btb: 'B2', euph: 'B3', tuba: 'B1', cb: 'B1'};
  const finLines = Object.fromEntries(Object.entries(FIN_NOTE).map(([p, n]) => ['f_' + p, [ev(nn(n), 93, E8, {acc: true})]]));
  const fin = p => ({f: 93, t: 94, r: 'cm', line: 'f_' + p, sh: 0});

  /* 楽器の受け持ち：第1ヴァイオリン → フルート1st・クラ1st（1オクターブ下）・アルトサックス1st（1オクターブ下）、第2ヴァイオリン → クラ2nd、
     ヴィオラ → クラ3rd、チェロ → ユーフォニアム、ファゴット3本 → ファゴット・バリトンサックス、木管のトリルの6組 → ピッコロ・フルート2nd・オーボエ・
     E♭クラ・アルトサックス2nd・テナーサックス・バスクラ。ホルン8本は4本にまとめ、1st・2nd が主題（原曲の5〜8番）と合いの手（1〜4番）を持ち替える。
     原曲と違うところ：①26〜36小節目を省いた ②主題2はトランペット1st も吹く（原曲は2・3番。少人数の部でも主題が聞こえるように）
     ③和音が小節の途中で変わる小節（15・22・39小節目）の弦の細かい形と、木管のトリルの音は、総譜の刷りが込み入っているので和音から決めた
     ④小節0は弱起だけなので、頭に2秒ほど音のない時間がある */
  // 受け持ちを書くための道具
  const SF = .85, ST = .6;   // 弦の音型（immer f）、トリル
  const cm = (ln, f, t, sh = 0, sc = 1) => ({f, t, r: 'cm', line: ln, sh, sc});
  const melSeg = (f, t, sh = 0, sc = 1) => ({f, t, r: 'mel', sh, sc});
  const MEL_AS_CM = ROLE_SCALE.mel / ROLE_SCALE.cm;
  // 呼びかけの強さ：5小節目 p から cresc.、主題1で f、主題2の頭で mf にもどって più f
  const CALL_SC = [[15, .55], [21, .65], [27, .78], [33, .9], [39, 1], [60, .85], [63, 1], [78, .9], [90, 1]];
  const callSegs = (mk, from = 15, to = 90) => CALL_SC.slice(0, -1).map(([f, s], k) => [Math.max(f, from), Math.min(CALL_SC[k + 1][0], to), s])
    .filter(([f, t]) => f < t).map(([f, t, s]) => mk(f, t, s));
  const bassCall = sh => callSegs((f, t, s) => ({f, t, r: 'bass', sh, sc: s}));
  const hornCall = (ln, from, to, k = 1) => callSegs((f, t, s) => cm(ln, f, t, 0, .9 * s * k), from, to);

  addPiece({
    id: 'valkyrie',
    title: '「ワルキューレの騎行」',
    full: 'ワーグナー 楽劇《ワルキューレ》より「ワルキューレの騎行」',
    composer: 'R.ワーグナー（1856年）',
    key: 'ロ短調', trans: 0, meter: 3, beatUnit: 1.5, beats: 94,
    // 5連符・32分音符・3連符が同じ時刻にそろっているかを、細かい格子でくらべる
    grid: 180,
    tempi: [66, 72, 80],
    desc: '映画やテレビでもよく使われる、勇ましく空を駆けるような曲。木管がトリル（2つの音をすばやく行き来する音）を受け渡し、クラリネットやサックスが細かく駆け上がる音を休まず回し続ける。その上で、付点のリズムの主題が、ホルンとトロンボーン、ホルンとトランペット、トロンボーンの順に受け渡されていく。細かい音がそろわないと、ただのざわめきに聞こえてしまう。',
    asks: 'リズム・バランス・音色',
    focus: {pitch: .9, tone: 1.05, expr: .95, rhythm: 1.25, balance: 1.05},
    outGain: 1.28,   // 聴くときの音量。全15曲の大きさ（K特性のラウドネス）がそろうように測って決めた（2026年10月。静かな曲は少し小さいまま）
    balRef: 4.4, ceiling: .96,
    spans: [{name: '前奏（トリルと駆け上がり）', short: '前奏', from: 0, to: 39}, {name: '主題（ホルンからトランペットへ）', short: '主題', from: 39, to: 78},
      {name: 'トロンボーンの主題と終わり', short: '終わり', from: 78, to: 94}],
    slur: 'bar',
    scale: VK_SCALE,
    mel: [...T1, ...T2, ...T3, ...RUN, FIN],
    chords: VK_CH,
    bass: CALL,
    lines: {
      ...STR,
      ...Object.fromEntries(Object.keys(TR_PLAN).map(p => ['tr_' + p, trLine(p)])),
      h13: CALL_BARS.flatMap(B => callBar(B, 'h13')), h24: CALL_BARS.flatMap(B => callBar(B, 'h24')),
      // ホルンは主題のあともしばらくのばす（主題1は19小節目の頭まで、主題2は25小節目の終わりまで）
      hnX1: [ev(nn('F#4'), 54 + 1 / 3, 3)], hnX2: [ev(nn('A#4'), 75 + 1 / 3, 2 + 2 / 3)],
      t3lo: T3.map(e => ({...e, m: e.m - 12})),
      runLo: RUN.map(e => ({...e, m: e.m - 12})),
      ...finLines,
    },
    // 強弱：前奏は ff のトリルと f の駆け上がり、主題1は f、主題2は più f、のばす A# で dim.、トロンボーンで f、終わりは cresc. して ff
    dyn: [[0,.86],[38.9,.86],[39,.88],[59.9,.88],[60,.92],[70,.92],[75,.84],[77.6,.84],[78,.92],[89.9,.92],[90,.82],[92.9,1],[93,1],[94,1]],
    rubato: [[0,1],[88,1],[89.9,1.03],[90,1],[92.5,1.03],[93,1.12],[94,1.25]],
    groups: {},
    roles: {
      picc:  [cm('tr_picc', 0, 90, 0, ST), fin('picc')],
      fl1:   [cm('v1', 0, 90, 0, SF), melSeg(90, 94, 12)],
      fl2:   [cm('tr_fl2', 0, 90, 0, ST), fin('fl2')],
      ob:    [cm('tr_ob', 0, 90, 0, ST), fin('ob')],
      ebcl:  [cm('tr_ebcl', 0, 90, 0, ST * .9), fin('ebcl')],
      cl1:   [cm('v1', 0, 90, -12, SF), melSeg(90, 94, 0)],
      cl2:   [cm('v2', 0, 90, 0, SF), melSeg(90, 93, 0, .9), fin('cl2')],
      cl3:   [cm('va', 0, 90, 0, SF), melSeg(90, 93, 0, .9), fin('cl3')],
      bcl:   [cm('tr_bcl', 0, 90, 0, ST), fin('bcl')],
      // アルトサックス1st は第1ヴァイオリンを1オクターブ下で（少人数の部でも細かい音型が残る）
      asax1: [cm('v1', 0, 90, -12, SF * .9), fin('asax1')],
      asax2: [cm('tr_asax2', 0, 90, 0, ST), fin('asax2')],
      tsax:  [cm('tr_tsax', 0, 90, 0, ST), fin('tsax')],
      // ファゴット3本の呼びかけ → ファゴット・バリトンサックス
      bsax:  [...bassCall(0), fin('bsax')],
      fg:    [...bassCall(0), fin('fg')],
      // トランペット：主題2（原曲は2・3番。1st も一緒に吹く）
      tp1:   [melSeg(59.5, 76), fin('tp1')],
      tp2:   [melSeg(59.5, 76, 0, .95), fin('tp2')],
      tp3:   [melSeg(59.5, 76, 0, .9), fin('tp3')],
      // ホルン：1st・2nd は前奏と主題3で合いの手、主題1・2で主題（原曲のホルン5〜8番）。3rd・4th はずっと合いの手（原曲のホルン1〜4番）
      hn1:   [...hornCall('h13', 15, 36), melSeg(38.5, 55), cm('hnX1', 54, 58, 0, MEL_AS_CM * .9), melSeg(59.5, 76), cm('hnX2', 75, 78, 0, MEL_AS_CM * .8),
        ...hornCall('h13', 78, 90, .65), fin('hn1')],
      hn2:   [...hornCall('h24', 15, 39), melSeg(38.5, 55), cm('hnX1', 54, 58, 0, MEL_AS_CM * .9), melSeg(59.5, 76), cm('hnX2', 75, 78, 0, MEL_AS_CM * .8),
        ...hornCall('h24', 78, 90, .65), fin('hn2')],
      hn3:   [...hornCall('h13', 15, 90), fin('hn3')],
      hn4:   [...hornCall('h24', 15, 90), fin('hn4')],
      // トロンボーン：主題1（バストランペットの受け持ち。演奏会用の総譜ではトロンボーン1・2番）と主題3
      tb1:   [melSeg(38.5, 55), melSeg(77.5, 90, 0, 1.1), fin('tb1')],
      tb2:   [melSeg(38.5, 55, 0, .95), melSeg(77.5, 90, 0, 1.05), fin('tb2')],
      btb:   [melSeg(77.5, 90, -12, 1.1), fin('btb')],
      // ユーフォニアム：チェロ（前奏の駆け上がり、呼びかけ、終わりの駆け上がり）
      euph:  [cm('vc', 0, 15, 0, SF), ...bassCall(0), cm('runLo', 90, 93, 0, .75), fin('euph')],
      // チューバ：主題3のコントラバストロンボーン（主題3より前は、原曲のコントラバス・チューバと同じく休み）
      tuba:  [cm('t3lo', 77.5, 90, 0, MEL_AS_CM), fin('tuba')],
      // コントラバス：原曲どおり終わりの駆け上がりから
      cb:    [cm('runLo', 90, 93, -12, .75), fin('cb')],
    },
    perc: {
      // 打楽器は原曲の前奏にはない。演奏会用の終わりにある小太鼓のロール、ティンパニ・シンバルの一打ちだけ
      perc1: [{i: 'timp', b: 93, m: 47, v: .9}],
      perc2: [{i: 'sd', b: 90, d: 3, roll: true, v: .15, v1: .5}, {i: 'sd', b: 93, v: .8}],
      perc3: [{i: 'bd', b: 93, v: .55}],   // 大太鼓は演奏会用の終わりにもない（最後の一打ちだけ軽く足した）
      perc4: [{i: 'cym', b: 93, v: .8}],
    },
    // 解釈（テンポ・揺れ）が部の実力に合っているか。当てはまるものを [点の増減, 講評] で返す
    interpRules: (perf, ip) => [
      ip.tempo === 2 && perf.bandR < 0.75 && [-4, '速いテンポに指が追いつかず、細かい駆け上がりがつぶれて聞こえました。'],
      ip.tempo === 0 && [-2, 'この曲にしては足どりが重く、空を駆けるような勢いがほしいところです。'],
      ip.rub === 2 && [-3, 'テンポを揺らしすぎて、騎行の足どりが乱れました。'],
    ],
  });
}
