'use strict';
/* 名前を変えても同じ部員・同じ顔で保存され、過去の録音は保たれることを確かめる。 */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),stored=new Map();
const ctx=vm.createContext({console,URL,assert,document:{currentScript:{src:'http://local/js/faces.js'}},localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)}});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const pieces=[...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]);
for(const f of ['util','instruments','venues','scores',...pieces,'band','face-cast','faces','game'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f+'.js'});
vm.runInContext(`
let s=freshState(2026);s=assignRecruits(s,autoAssign(s));s=choosePiece(s,'galop');
s.members[0].name='佐藤 陽菜';s.members[1].name='佐藤 悠真';
const m=s.members[0],id=m.id,portrait=Faces.fingerprint(m),before=JSON.stringify(s),oldRecord=snapshot(s);
s.recs.push({id:'name-check',pieceId:'galop',year:2026,week:0,snap:oldRecord});
const savedBefore=JSON.stringify(s),recordBefore=JSON.stringify(s.recs);
const renamed=renameMember(s,id,'  山田　花音  '),who=renamed.members[0];
assert.equal(who.name,'山田 花音');assert.equal(who.originalName,'佐藤 陽菜');assert.equal(who.id,id);
assert.equal(Faces.fingerprint(who),portrait);assert.equal(JSON.stringify(s),savedBefore);
const rest={...who};delete rest.originalName;rest.name=m.name;
assert.equal(JSON.stringify(rest),JSON.stringify(m));
assert.equal(JSON.stringify(renamed.recs),recordBefore);
const second=renameMember(renamed,id,'佐藤 悠斗');
assert.equal(second.members[0].originalName,'佐藤 陽菜');assert.equal(Faces.fingerprint(second.members[0]),portrait);
const newRecord=snapshot(second).members.find(x=>x.id===id);
assert.equal(newRecord.name,'佐藤 悠斗');assert.equal(Faces.fingerprint(newRecord),portrait);
assert.equal(JSON.stringify(second.recs),recordBefore);
for(const name of ['', '   ', 'あいうえおかきくけこさしす', '<img src=x>', '名前&文字', '---', '佐藤 悠真']){
 assert.ok(memberNameError(second,id,name));assert.equal(renameMember(second,id,name),second);
}
assert.equal(memberNameError(second,id,'あいうえおかきくけこさし'),'');
assert.equal(memberNameError(second,id,'エミリー・ローズ'),'');
assert.equal(memberNameError(second,id,'Sora-1'),'');
assert.equal(renameMember(second,'存在しない部員','名前'),second);
assert.equal(renameMember(second,id,second.members[0].name),second);
save(second);const loaded=load();
assert.ok(loaded);assert.equal(loaded.members[0].name,'佐藤 悠斗');assert.equal(loaded.members[0].id,id);
assert.equal(Faces.fingerprint(loaded.members[0]),portrait);assert.equal(JSON.stringify(loaded.members[0].stats),JSON.stringify(m.stats));
save(s);const oldLoaded=load();
assert.equal(oldLoaded.members[0].name,m.name);assert.equal(oldLoaded.members[0].originalName,m.name);assert.equal(Faces.fingerprint(oldLoaded.members[0]),portrait);
assert.equal(JSON.stringify(oldLoaded.recs),recordBefore);
`,ctx);
console.log('名前の保存と再読み込み／旧セーブ／何度変えても同じ顔／能力と本人のid／録音の保持／空欄・長さ・同名・記号の検証：確認済み');
