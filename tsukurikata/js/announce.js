'use strict';
/* 結果発表：コンクールの審査結果を、ホールのアナウンスのように1校ずつ発表する。
   金賞は「ゴールド金賞」と読み上げる（金賞と銀賞を聞き間違えないように）。最後に、次の大会への代表校を発表する。
   ほかの学校の名前と結果は、年度と大会ごとに決まった架空のもの。 */

const SCHOOL_FULL = '県立みなと高等学校';
const AWARD_CALL = {gold: 'ゴールド金賞', silver: '銀賞', bronze: '銅賞'};
const RIVAL_A = ['桜', '青', '緑', '白', '若', '朝', '夕', '星', '月', '汐', '潮', '風', '松', '柳', '梅', '藤', '楓', '椿', '葵', '鈴', '霞', '萩'];
const RIVAL_B = ['ヶ丘', '台', '浜', '野', 'が原', '坂', '川', '崎', '見', '里', '森', '沢'];
const RIVAL_HEAD = ['県立', '県立', '県立', '市立', '市立', '私立'];
const AN = {timer: 0, token: null, onDone: null};

function rivalSchools(year, level, n){
  const used = new Set(), out = [];
  for(let k = 0; out.length < n && k < 400; k++){
    const nm = RIVAL_A[Math.floor(hash(year, level, 'a', k) * RIVAL_A.length)] + RIVAL_B[Math.floor(hash(year, level, 'b', k) * RIVAL_B.length)];
    if(used.has(nm)) continue;
    used.add(nm);
    out.push(RIVAL_HEAD[Math.floor(hash(year, level, 'h', k) * RIVAL_HEAD.length)] + nm + '高等学校');
  }
  return out;
}
// 出場校の並び（プログラム順）と、それぞれの賞・代表。自分の学校の結果に合うように、ほかの学校の金賞と代表を決める
function contestBoard(year, levelId, j){
  const L = LEVELS[levelId];
  const n = levelId === 'pref' ? 12 : 10;
  const rivals = rivalSchools(year, levelId, n - 1).map(name => {
    const h = hash(year, levelId, name, 'aw');
    return {name, award: h < 0.3 ? 'gold' : h < 0.72 ? 'silver' : 'bronze'};
  });
  const nRep = L.rep ? 3 : 0;
  const need = nRep - (j.rep ? 1 : 0);
  const golds = () => rivals.filter(r => r.award === 'gold');
  const byH = (a, b) => hash(year, levelId, a.name, 'up') - hash(year, levelId, b.name, 'up');
  for(const r of rivals.filter(r => r.award === 'silver').sort(byH)){ if(golds().length >= need) break; r.award = 'gold'; }
  golds().sort((a, b) => hash(year, levelId, a.name, 'rep') - hash(year, levelId, b.name, 'rep')).slice(0, need).forEach(r => { r.rep = true; });
  const pos = Math.floor(hash(year, levelId, 'pos') * n);
  const list = [...rivals.slice(0, pos), {name: SCHOOL_FULL, award: j.award, rep: j.rep, ours: true}, ...rivals.slice(pos)];
  list.forEach((r, i) => { r.no = i + 1; });
  return {L, list, nRep};
}

function showAnnounce(j, levelId, onDone){
  const {L, list, nRep} = contestBoard(S.year, levelId, j);
  const ours = list.find(r => r.ours);
  AN.onDone = onDone;
  const token = AN.token = {};
  $('#anTitle').textContent = `${L.name}　審査結果発表`;
  $('#anList').innerHTML = '';
  $('#anRep').innerHTML = '';
  $('#anSkip').hidden = false; $('#anDone').hidden = true;
  $('#announce').hidden = false;
  document.documentElement.classList.add('announcing');
  const steps = [];
  const row = r => {
    const li = document.createElement('li');
    li.className = r.ours ? 'ours' : '';
    li.innerHTML = `<span class="no">${r.no}</span><span class="nm">${esc(r.name)}</span><span class="aw ${r.award}"></span>`;
    return li;
  };
  const say = (el, text) => { el.textContent = text; el.classList.add('on'); };
  steps.push([600, () => {}]);
  for(const r of list){
    let li;
    steps.push([r.ours ? 900 : 650, () => { li = row(r); $('#anList').appendChild(li); li.scrollIntoView({block: 'nearest'}); }]);
    if(r.ours){
      // 自分の学校だけは、ひと呼吸おいてから
      steps.push([1600, () => { say(li.querySelector('.aw'), '……'); }]);
      steps.push([100, () => {
        const aw = li.querySelector('.aw');
        aw.classList.add('stamp-in');
        say(aw, AWARD_CALL[r.award]);
        if(r.award === 'gold'){ haptic('success'); E.applaud(0.75, 3); } else haptic(r.award === 'bronze' ? 'warning' : 'tap');
      }]);
      steps.push([1400, () => {}]);
    } else {
      steps.push([450, () => { say(li.querySelector('.aw'), AWARD_CALL[r.award]); }]);
    }
  }
  if(nRep){
    steps.push([900, () => { $('#anRep').innerHTML = `<p class="lead">続いて、${L.rep}への代表校を発表します。</p><ol></ol>`; $('#anRep').scrollIntoView({block: 'nearest'}); }]);
    for(const r of list.filter(x => x.rep)){
      steps.push([r.ours ? 1500 : 1100, () => {
        const li = document.createElement('li');
        li.className = r.ours ? 'ours' : '';
        li.innerHTML = `<span class="no">プログラム${r.no}番</span><span class="nm">${esc(r.name)}</span>${r.ours ? '<span class="aw rep stamp-in on">代表</span>' : ''}`;
        $('#anRep ol').appendChild(li); li.scrollIntoView({block: 'nearest'});
        if(r.ours){ haptic('success'); E.applaud(1, 4.5); }
      }]);
    }
    if(!ours.rep) steps.push([900, () => { const p = document.createElement('p'); p.className = 'lead'; p.textContent = j.award === 'gold' ? '金賞。でも、代表には届かなかった。' : '代表には届かなかった。'; $('#anRep').appendChild(p); }]);
  }
  steps.push([700, () => { $('#anSkip').hidden = true; $('#anDone').hidden = false; $('#anDone').focus({preventScroll: true}); }]);
  let i = 0;
  const next = () => {
    if(AN.token !== token || i >= steps.length) return;
    const [wait, fn] = steps[i++];
    AN.timer = setTimeout(() => { if(AN.token !== token) return; fn(); next(); }, wait);
  };
  AN.skip = () => {
    // 残りを一度に出す（拍手や振動は鳴らさない）
    clearTimeout(AN.timer);
    AN.token = null;
    $('#anList').innerHTML = '';
    for(const r of list){ const li = row(r); say(li.querySelector('.aw'), AWARD_CALL[r.award]); $('#anList').appendChild(li); }
    if(nRep) $('#anRep').innerHTML = `<p class="lead">${L.rep}への代表校</p><ol>${list.filter(x => x.rep).map(r => `<li class="${r.ours ? 'ours' : ''}"><span class="no">プログラム${r.no}番</span><span class="nm">${esc(r.name)}</span>${r.ours ? '<span class="aw rep on">代表</span>' : ''}</li>`).join('')}</ol>`;
    $('#anSkip').hidden = true; $('#anDone').hidden = false;
    $('#announce .an-body').querySelector('.ours')?.scrollIntoView({block: 'center'});
  };
  next();
}
function closeAnnounce(){
  clearTimeout(AN.timer);
  AN.token = null;
  $('#announce').hidden = true;
  document.documentElement.classList.remove('announcing');
  const cb = AN.onDone; AN.onDone = null;
  if(cb) cb();
}
function bindAnnounce(){
  $('#anSkip').addEventListener('click', () => AN.skip && AN.skip());
  $('#anDone').addEventListener('click', closeAnnounce);
}
