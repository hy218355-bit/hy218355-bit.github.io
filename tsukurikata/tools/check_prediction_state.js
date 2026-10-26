'use strict';
/* 同じ週に席や曲を変えても、前の部の予想を使い回さないことを確かめる。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),ctx=vm.createContext({console,assert});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const pieces=[...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]);
for(const f of ['util','instruments','venues','scores',...pieces,'band','game'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f+'.js'});
vm.runInContext(`
const s=freshState(2026);s.recruits=null;s.phase='week';s.week=PREF_WEEK;s.pieceId='galop';s.division='B';s.cohesion=75;
s.members=fullBand({pitch:80,rhythm:80,tone:80,expr:80});
for(const m of s.members){m.sta=100;m.fam={galop:100,largo:100};m.trait='steady';}
const source=JSON.stringify(s),all=new Set();
const initial=predictContest(s,all);
const moved=moveMember(s,s.members[0].id,null),actual=predictContest(moved,all);
projMemo=null;const expected=predictContest(moved,all);
console.log(JSON.stringify({before:initial.avg,afterWithCache:actual.avg,afterFresh:expected.avg,nWithCache:actual.n,nFresh:expected.n}));
assert.equal(JSON.stringify(actual),JSON.stringify(expected),'席を変えたあとの予想は、新しく計算した結果と一致する');
assert.equal(actual.n,seated(moved).length);assert.equal(JSON.stringify(s),source);
for(const changed of [chooseFinalPiece(s,'largo'),{...s,morale:20},moveMember(s,s.members[0].id,'perc2')]){
 predictContest(s,all);const p=predictContest(changed,all);projMemo=null;const fresh=predictContest(changed,all);
 assert.equal(JSON.stringify(p),JSON.stringify(fresh));
}
`,ctx);
console.log('同じ週の席・楽器・曲・やる気の変更を予想に反映／前の部の保持：確認済み');
