'use strict';
/* 案内の再開と中止、旧セーブの扱い、実際の練習と案内の対応を確かめる。 */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),stored=new Map(),report={};
const ctx=vm.createContext({console,assert,report,U:{},localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)}});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),pieces=[...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]);
for(const f of ['util','instruments','venues','scores',...pieces,'band','game','onboarding'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f+'.js'});
vm.runInContext(`
let s=freshState(2026),original=JSON.stringify(s);
initOnboarding(s,true);assert.equal(U.onboarding.active,true);assert.equal(onboardingStep(s,U.onboarding),0);assert.equal(JSON.stringify(s),original);
s=assignRecruits(s,autoAssign(s));assert.equal(onboardingStep(s,U.onboarding),1);
s=choosePiece(s,'galop');assert.equal(onboardingStep(s,U.onboarding),2);
const atPractice=JSON.stringify(s);onboardingCopy(2);saveOnboarding();assert.equal(JSON.stringify(s),atPractice);
s=practiceWeek(s);assert.equal(onboardingStep(s,U.onboarding),3);
let S=s,renders=0;renderOnboarding=()=>{renders++;};
const sound={notes:[{mid:s.members[0].id}],hits:[]};U.perfNow=sound;U.tab='play';
const beforeListen=JSON.stringify(s);
onboardingPlayed({notes:[],hits:[]});assert.equal(U.onboarding.heard,false);
// 録音の読み込みを待つ間にタブを移していても、現在の部の音が鳴れば達成にする。
U.tab='week';onboardingPlayed(sound);assert.equal(U.onboarding.heard,true);assert.equal(renders,1);
assert.equal(JSON.stringify(s),beforeListen);assert.equal(onboardingStep(s,U.onboarding),4);
// 聴き比べの4月だけでは終えず、今の部の短い演奏が鳴ってから達成する。
U.onboarding.heard=false;const previousClip={notes:[{}],hits:[]},currentClip={notes:[{}],hits:[]};
U.growthPair={state:s,perfs:{before:previousClip,now:currentClip}};
onboardingPlayed(previousClip);assert.equal(U.onboarding.heard,false);
onboardingPlayed(currentClip);assert.equal(U.onboarding.heard,true);
U.onboarding.heard=false;U.growthPair.state=clone(s);onboardingPlayed(currentClip);assert.equal(U.onboarding.heard,false);
U.growthPair=null;U.onboarding.heard=true;saveOnboarding();
initOnboarding(s,false);assert.equal(U.onboarding.heard,true);assert.equal(U.onboarding.active,true);
U.onboarding.active=false;saveOnboarding();initOnboarding(s,false);assert.equal(U.onboarding.active,false);
// まだゲームを保存する前に閉じて、別の種で開き直してもスキップを保つ。
let fresh=freshState(2026);initOnboarding(fresh,true);assert.equal(U.onboarding.active,false);
initOnboarding(fresh,false,true);assert.equal(U.onboarding.active,true);assert.equal(U.onboarding.heard,false);
// 別の部の保存や、すでに遊んでいるセーブは勝手に案内を始めない。
let existing=freshState(2026);existing=choosePiece(assignRecruits(existing,autoAssign(existing)),'galop');existing.week=4;
original=JSON.stringify(existing);initOnboarding(existing,false);assert.equal(U.onboarding.active,false);assert.equal(JSON.stringify(existing),original);
assert.equal(onboardingStep(existing,U.onboarding),'overview');
existing.year++;existing.week=0;assert.equal(onboardingStep(existing,U.onboarding),'overview');
// 端末の保存が使えなくても、部の保存内容には案内を追加しない。
localStorage.getItem=()=>{throw Error('保存できない端末');};localStorage.setItem=()=>{throw Error('保存できない端末');};
assert.doesNotThrow(()=>initOnboarding(s,true));assert.equal(U.onboarding.active,true);
assert.equal('onboarding' in s,false);assert.equal('heard' in s,false);
// 全員を控えにした場合は、無音を聴かせず、部員の席を決める操作へ戻す。
const firstRow={},document={querySelector:()=>firstRow};let destination=null,focused=null;
const setTab=tab=>{destination=tab;};onboardingFocus=el=>{focused=el;};
S=clone(s);for(const m of S.members)m.seat=null;
U.onboarding={club:onboardingClub(S),active:true,heard:false};onboardingAction('next');
assert.equal(destination,'members');assert.equal(focused,firstRow);
report.noSeatRecovery=true;report.playbackGate=true;report.steps=[0,1,2,3,4];report.resume=true;report.skip=true;report.oldSave=true;report.blockedStorage=true;
`,ctx);
console.log(JSON.stringify(report,null,2));
