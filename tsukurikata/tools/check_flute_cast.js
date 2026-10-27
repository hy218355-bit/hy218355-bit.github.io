'use strict';
/* 新しく入る子の配役と、自動の席・希望・能力・前の部員の保持を確かめる。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),ctx=vm.createContext({console,assert,URL,document:{currentScript:{src:'http://local/js/faces.js'}}});
const pieces=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]);
for(const f of ['util','instruments','venues','scores',...pieces,'band','game','face-cast','faces'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f+'.js'});
vm.runInContext(`
let fl=0,men=0;const base=freshState(2028);
for(let seed=1;seed<=100;seed++){
 const s={...clone(base),year:2028,week:0,seq:0,members:[],recruits:null,recruitSeed:seed,rep:70};
 const same=clone(s),rs=makeRecruits(s,39),again=makeRecruits(same,39);
 assert.equal(JSON.stringify(rs),JSON.stringify(again),'保存した種で名前を引き直さない');
 assert.equal(new Set(rs.map(r=>r.name)).size,rs.length);
 s.recruits=rs;const map=autoAssign(s),original=JSON.stringify(s);
 for(const r of rs){
  if(r.hope==='fl'||r.hope==='picc'||SEAT[map[r.id]]?.sec==='fl'){
   assert.equal(namePresentation(r),'female');assert.equal(Faces.features(r).style,'female');fl++;
  }
  if(namePresentation(r)==='male')men++;
 }
 const otherNames={...s,recruits:rs.map(r=>({...r,name:'佐藤 悠真'}))};
 assert.equal(JSON.stringify(autoAssign(otherNames)),JSON.stringify(map),'名前で席の選び方や希望の優先を変えない');
 // 決まった席に入部したあとの力も、名前を変える前と同じ式になる。
 const after=assignRecruits(s,map),comparison=assignRecruits(otherNames,map);
 const traits=ms=>ms.map(({name,...m})=>m);
 assert.equal(JSON.stringify(traits(after.members)),JSON.stringify(traits(comparison.members)));
 assert.equal(after.morale,comparison.morale);assert.equal(after.cohesion,comparison.cohesion);
 assert.equal(JSON.stringify(s),original,'入部の前の状態を書き換えない');
}
assert.ok(fl>=400);assert.ok(men>100,'他の楽器まで女子だけにしない');
const old={id:'m2027-n1',name:'佐藤 悠真',originalName:'佐藤 悠真',seat:'fl1a',grade:2,stats:{pitch:50,rhythm:50,tone:50,expr:50}};
const waiting={id:'m2028-n1',name:'鈴木 蓮',hope:'picc',exp:false,grade:1,trait:'steady'};
const oldState={year:2028,week:0,seq:100,members:[old],recruits:[waiting],recruitSeed:12345,rep:70};
const before=JSON.stringify([oldState.members,oldState.recruits]),oldFace=Faces.fingerprint(old);
makeRecruits(oldState,10);assert.equal(JSON.stringify([oldState.members,oldState.recruits]),before,'今いる子と入部待ちの子の名前・顔・席は保つ');
assert.equal(Faces.fingerprint(old),oldFace);
`,ctx);
console.log('100種類の39人編成／フルート・ピッコロの女子配役／名前と顔の一致／重複なし／再現性／席・能力・やる気の維持／今いる部員と入部待ちの保持：確認済み');
