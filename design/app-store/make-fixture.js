// 撮影専用の部を、製品の進行関数だけで育てる。実際のセーブは読まない。
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.resolve(__dirname, '../../tsukurikata');
let seed = 20261103;
const math = Object.create(Math);
math.random = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
const ctx = vm.createContext({console,Math:math,JSON,Object,Array,Set,Map,WeakMap,Float32Array,Number,String,Error,Infinity,NaN,setTimeout});
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
const pieces = [...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js(?:\?[^ "]*)?"/g)].map(m=>m[1]);
for(const f of ['util','instruments','venues','scores',...pieces,'band','game']) vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f+'.js'});
const output = vm.runInContext(`(()=>{
 let s=freshState(2026), first=null;
 for(let n=0;n<250;n++){
  if(s.year===2028 && s.phase==='week' && s.week>=5 && !s.pending && !s.episode && !s.consult && !s.outing) return {state:s,first};
  if(recruitsDue(s)&&!s.pending){s=assignRecruits(s,autoAssign(s));continue;}
  if(s.phase==='choose'){s=choosePiece(s,'galop');continue;}
  if(s.phase==='chooseSet'){s=chooseSetPiece(s,setOffer(s)[0]);continue;}
  if(s.phase==='end'){s=autoWinter(s);continue;}
  if(s.pending){s=finishStage(s);continue;}
  const ev=eventAt(s,s.week);
  if(ev?.kind==='audition'&&s.audition&&!s.audition.decided){s=setLineup(s,recommendLineup(s));continue;}
  if(ev?.kind==='concert'||ev?.kind==='contest'){s=beginStage(s);continue;}
  if(ev?.kind==='forced'){s=practiceWeek(s,'test');continue;}
  if(s.chooseFinal){s=chooseFinalPiece(s,s.pieceId);continue;}
  if(s.episode){s=resolveEpisode(s,episodeView(s).choices[0].k);continue;}
  if(s.consult){s=resolveConsult(s,consultView(s).choices[0].k);continue;}
  if(s.outing){const v=outingView(s);s=resolveOuting(s,seated(s).slice(0,v.n).map(m=>m.id));continue;}
  if(s.year===2026&&s.week===2&&!first)first=JSON.parse(JSON.stringify(s));
  s=practiceWeek(s);
 }
 throw Error('撮影する週へ進めなかった');
})()`,ctx);
fs.writeFileSync(path.join(__dirname,'fixture.json'),JSON.stringify(output));
console.log(JSON.stringify({year:output.state.year,week:output.state.week,members:output.state.members.length,phase:output.state.phase}));
