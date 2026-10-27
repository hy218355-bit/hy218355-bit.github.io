'use strict';
/* 年度をまたぐ会場の経験と、前のセーブ・録音を保つことを確かめる。 */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const assert=require('node:assert/strict'),root=path.join(__dirname,'..'),stored=new Map();
const ctx=vm.createContext({console,assert,localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)}});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const pieces=[...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]);
for(const file of ['util','instruments','venues','scores',...pieces,'band','game'])vm.runInContext(fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'),ctx,{filename:file+'.js'});
vm.runInContext(`
for(const hall of [0,1,45.75,70,100]){
 let s=freshState(2026);s=assignRecruits(s,autoAssign(s));s=choosePiece(s,'pomp');
 s.members=fullBand({pitch:68,rhythm:72,tone:64,expr:61});s.members.forEach((m,i)=>m.grade=i%3+1);
 s.phase='end';s.week=26;s.hallExp=hall;
 const original=JSON.stringify(s),records=JSON.stringify(s.recs),remaining=s.members.filter(m=>m.grade<3).map(m=>m.id);
 const after=newYear(s);
 assert.equal(JSON.stringify(s),original,'呼び出し前の部を変えない');
 assert.equal(after.hallExp,hall,'年度替わりで経験を消さない');
 assert.equal(after.year,2027);assert.equal(after.week,0);assert.equal(after.phase,'choose');
 assert.deepEqual(after.members.map(m=>m.id),remaining);assert.equal(JSON.stringify(after.recs),records);
 assert.equal(after.v,s.v);assert.equal(Object.keys(after).includes('hallCarry'),false);
 save(after);const resumed=load();assert.equal(resumed.hallExp,hall,'保存して読み直しても経験を保つ');
 const later=nextWeek(resumed);assert.equal(later.hallExp,Math.max(0,hall-4),'週ごとの減少は変えない');
 const ev={venue:'hall',nerves:10};assert.ok(nervesFor({...resumed,hallExp:100},ev)<nervesFor({...resumed,hallExp:0},ev));
}
let old=freshState(2026);old=assignRecruits(old,autoAssign(old));old=choosePiece(old,'pomp');delete old.hallExp;
assert.equal(newYear(old).hallExp,0,'経験の記録がない前の部も続けられる');
`,ctx);
console.log('年度替わりの会場慣れ／卒業と新年度／録音と入力の保持／保存・再開／週ごとの減少／前の記録：確認済み');
