'use strict';
/* はじめの部活。進み具合は端末だけに残し、部員・練習・ゲームのセーブは変えない。 */
const ONBOARD_KEY = 'suibu-onboarding-v1';
const ONBOARD_STEPS = [
  ['members', '楽器'], ['note', '選曲'], ['week', '練習'], ['play', '合奏'],
];
const onboardingClub = s => `${s.recruitSeed}:${startYearOf(s)}`;
const onboardingEarly = s => foundingYear(s) && s.week <= 1 && !['end', 'winter'].includes(s.phase);
function readOnboarding(){
  try{
    const x = JSON.parse(localStorage.getItem(ONBOARD_KEY) || 'null');
    return x && typeof x.club === 'string' && typeof x.active === 'boolean'
      ? {club:x.club, active:x.active, heard:x.heard === true} : null;
  }catch(e){ return null; }
}
function saveOnboarding(){
  try{ localStorage.setItem(ONBOARD_KEY, JSON.stringify(U.onboarding)); }catch(e){}
}
function initOnboarding(s, fresh = false, reset = false){
  const previous = reset ? null : readOnboarding(), club = onboardingClub(s);
  U.onboarding = previous?.club === club ? previous : {
    club, active:reset || (fresh && (!previous || previous.active)), heard:false,
  };
  if(fresh || reset) saveOnboarding();
}
function onboardingActive(){ return U.onboarding?.active && U.onboarding.club === onboardingClub(S); }
// 終えた段階は部の状態から判断する。案内だけを押しても練習済みにはしない。
function onboardingStep(s, guide){
  if(!onboardingEarly(s)) return 'overview';
  if(recruitsDue(s) && !s.members.length) return 0;
  if(s.phase === 'choose' || s.phase === 'chooseSet') return 1;
  if(s.week === 0) return 2;
  return guide?.heard ? 4 : 3;
}
function onboardingCopy(step){
  return [
    {title:'この5人と、\n最初の音を。', text:'副顧問の朝野です。まずは顔を選んで、希望の楽器を見てみましょう。配置はあとでも変えられます。', action:'5人に会う'},
    {title:'一緒に育てたい、\n1曲を。', text:'「お手本」で聴いて、「決める」で選びます。星が少ない曲ほど、譜読みは早く進みます。', action:'曲を聴いて選ぶ'},
    {title:'最初の1週間、\n合わせてみよう。', text:'今週は「おまかせ」で進められます。顔の横のボタンから、一人ずつ練習を変えられます。', action:'今週の練習へ'},
    {title:'練習した音を、\n聴いてみよう。', text:'4月の音と、いまの音。聴き比べると、育ったところが見つかります。', action:'音を聴き比べる'},
    {title:'この音が、\n部のはじまりです。', text:'練習を重ねると、一人ひとりの音が変わります。顔を押すと、その子だけの音も聴けますよ。', action:'最初の本番へ'},
  ][step];
}
function renderOnboarding(){
  let box = document.querySelector('#onboarding');
  const active = onboardingActive(), visible = active && ['week','play'].includes(U.tab) && !S.pending;
  if(!visible){ if(box) box.hidden = true; return; }
  if(!box){
    box = document.createElement('section');box.id = 'onboarding';box.className = 'onboarding';
    box.setAttribute('aria-labelledby','onboardingTitle');
  }
  // 同じカードを今週と合奏へ移す。タブを戻るだけで説明を二重に出さない。
  const parent = U.tab === 'play' ? document.querySelector('.col-stage') : document.querySelector('#week');
  if(box.parentElement !== parent) parent.prepend(box);
  box.hidden = false;
  const step = onboardingStep(S, U.onboarding), play = U.tab === 'play';
  const previous = U.onboardingShown;
  U.onboardingShown = {club:U.onboarding.club,step};
  if(previous?.club === U.onboarding.club && previous.step !== step && !U.playing){
    requestAnimationFrame(()=>{
      if(box.isConnected && !box.hidden && box.dataset.step === String(step)) onboardingFocus(box.querySelector('h3'));
    });
  }
  const key = `${step}:${play}:${!!U.playing}:${!!U.waitPlay}:${!!S.pending}`;
  if(box.dataset.content === key) return;
  box.dataset.content = key;box.dataset.step = step;
  const overview = step === 'overview', copy = overview ? {
    title:'部を育てる、\n4つのこと。', text:'練習で育てて、合奏で聴く。このくり返しで、部の音が変わっていきます。',
  } : onboardingCopy(step);
  const noSeat=step===3 && !seated(S).length;
  const text = noSeat ? 'いまは全員が控えです。「部員」の顔から席を決めると、音が出ます。' : copy.text;
  const action = noSeat ? '部員に席を決める' : step === 4 && (S.pending || eventAt(S,S.week)?.kind !== 'concert') ? '今週へ戻る' : copy.action;
  box.innerHTML = `<div class="onboarding-top"><span>はじめの部活</span><button type="button" data-onboard="skip">${overview || step === 4 ? '閉じる' : 'スキップ'}</button></div>
    <div class="onboarding-person"><img src="img/advisor-asano.webp" width="96" height="96" alt="副顧問の朝野先生"><div><small>副顧問・朝野先生</small><h3 id="onboardingTitle" tabindex="-1">${copy.title}</h3></div></div>
    <ol class="onboarding-steps" aria-label="はじめの部活の流れ">${ONBOARD_STEPS.map(([icon,label],i) => `<li${!overview && step === i ? ' aria-current="step"' : ''} class="${!overview && step > i ? 'done' : ''}"><span>${uiIcon(!overview && step > i ? 'check' : icon)}</span><b>${label}</b>${!overview && step > i ? '<span class="sr-only">できた</span>' : ''}</li>`).join('')}</ol>
    <p class="onboarding-copy">${text}</p>
    ${overview ? `<div class="onboarding-links"><button class="btn quiet" type="button" data-onboard="members">${uiIcon('members')}部員を見る</button><button class="btn quiet" type="button" data-onboard="week">${uiIcon('week')}今週を見る</button><button class="btn primary" type="button" data-onboard="play">${uiIcon('play')}合奏を開く</button></div>` : `<button class="btn primary onboarding-next" type="button" data-onboard="next"${step === 3 && play && (U.playing || U.waitPlay) ? ' disabled' : ''}>${uiIcon(step === 3 ? 'play' : 'check')}${action}</button>`}`;
}
function onboardingFocus(target){
  if(!target || target.disabled) return;
  if(!target.matches('button,a,input,select,textarea,[tabindex]')) target.tabIndex=-1;
  target.focus({preventScroll:true});
  target.scrollIntoView({block:'center',behavior:'auto'});
  document.querySelectorAll('.onboarding-target').forEach(el=>el.classList.remove('onboarding-target'));
  if(target.matches('button')) target.classList.add('onboarding-target');
}
function closeOnboarding(){
  U.onboarding.active = false; saveOnboarding();
  document.querySelector('#onboarding')?.remove();
  document.querySelectorAll('.onboarding-target').forEach(el=>el.classList.remove('onboarding-target'));
  renderWeek();
}
function onboardingAction(action){
  if(action === 'open'){
    U.onboarding = {club:onboardingClub(S),active:true,heard:false};saveOnboarding();
    setTab('week');renderWeek();onboardingFocus(document.querySelector('#onboardingTitle'));return;
  }
  if(!onboardingActive()) return;
  if(action === 'skip'){
    const tab = U.tab;closeOnboarding();
    onboardingFocus(document.querySelector(narrow.matches ? `[data-tabgo="${tab}"]` : tab === 'play' ? '#btnNow' : '#h-week'));return;
  }
  if(['members','week','play'].includes(action)){
    closeOnboarding();setTab(action);
    onboardingFocus(document.querySelector(action === 'members' ? '#h-roster' : action === 'play' ? '#btnNow' : '#h-week'));return;
  }
  if(action !== 'next') return;
  const step = onboardingStep(S,U.onboarding);
  if(step === 0){setTab('week');onboardingFocus(document.querySelector('#asgList [data-rid]'));}
  else if(step === 1){setTab('week');onboardingFocus(document.querySelector('#week [data-act="model"]'));}
  else if(step === 2){setTab('week');onboardingFocus(document.querySelector('#week [data-act="practice"]'));}
  else if(step === 3){
    if(!seated(S).length){setTab('members');onboardingFocus(document.querySelector('#rosterTable .roster-open'));return;}
    if(U.tab !== 'play')setTab('play');
    if(growthAvailable()){openGrowthListening();return;}
    if(!busy() && !U.playing && !U.waitPlay){
      stopPlay();soloAll();clearRecordedMember();U.piece=null;U.range='all';U.perfNow=null;
      document.querySelector('#btnNow').click();
      renderSelectors();
      onboardingFocus(document.querySelector('#btnStop:not([hidden])'));
    }
  }else if(step === 4){
    stopPlay();closeOnboarding();setTab('week');
    onboardingFocus(document.querySelector('#week [data-act="stage"]') || document.querySelector('#h-week'));
  }
}
function onboardingPlayed(perf){
  // 読み込み待ちやお手本の試聴は、部の音を聴いたことにしない。
  const current=perf===U.perfNow || U.growthPair?.state===S && perf===U.growthPair.perfs.now;
  if(onboardingActive() && onboardingStep(S,U.onboarding) === 3 && current && (perf.notes.length || perf.hits.length)){
    U.onboarding.heard = true;saveOnboarding();renderOnboarding();
  }
}
