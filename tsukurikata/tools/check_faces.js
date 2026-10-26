'use strict';
/* 名前と顔の配役、比率、画像の再利用、旧セーブを変えないことを確かめる。 */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'..'),ctx=vm.createContext({URL,document:{currentScript:{src:'http://local/js/faces.js'}},console});
for(const file of ['util.js','instruments.js','band.js','faces.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',file),'utf8'),ctx);
vm.runInContext(`
const used=new Set(),members=Array.from({length:200},(_,i)=>({id:'m2026-n'+(i+1),name:makeName(used,'recruit',2026,i+1),grade:1,sta:90}));
if(members.filter(m=>namePresentation(m)==='male').length!==40)throw Error('新入部員が女性4対男性1でない');
if(new Set(members.map(m=>m.name)).size!==200)throw Error('名前の重複');
for(const m of members)if(Faces.features(m).style!==namePresentation(m))throw Error('名前と顔が合わない');
for(const name of GIVEN_FEMALE)if(Faces.features({id:'m2026-n5',name:'佐藤 '+name}).style!=='female')throw Error(name+'に男性の顔');
for(const name of GIVEN_MALE)if(Faces.features({id:'m2026-n1',name:'佐藤 '+name}).style!=='male')throw Error(name+'に女性の顔');
if(new Set(members.slice(0,39).map(m=>Faces.fingerprint(m))).size<38)throw Error('39人の顔が重なりすぎている');
const old={id:'m2026-n5',name:'佐藤 陽菜',grade:1,sta:90,stats:{pitch:50}},before=JSON.stringify(old);
const first=Faces.features(old),next=Faces.features({...old,grade:3});
if(first!==next)throw Error('進級で顔が変わった');
for(const size of [26,32,36,54,88,112]){
 const html=Faces.image(old,size);
 if(!html.includes('portraits-')||!html.includes('data-presentation="female"')||/<svg|blob:|data:image/.test(html))throw Error('原画の表示でない');
}
if(JSON.stringify(old)!==before)throw Error('前のセーブを変更した');
for(let i=0;i<1000;i++)Faces.features({id:'old-save-'+i,name:'佐藤 陽菜'});
if(Faces.cacheSize()>256)throw Error('キャッシュが増え続けている');
`,ctx);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'img/faces/manifest.json'),'utf8'));
assert.equal(manifest.reduce((n,s)=>n+s.female+s.male,0),39);
assert.equal(manifest.reduce((n,s)=>n+s.female,0),31);
assert.equal(manifest.reduce((n,s)=>n+s.male,0),8);
for(const sheet of manifest){assert.ok(fs.statSync(path.join(root,'img/faces',sheet.file)).size<=200000);assert.ok(sheet.width/sheet.cols>=320);assert.ok(sheet.height/sheet.rows>=320);}
console.log('女性31人・男性8人／新入部員4対1／すべての既存名と顔の対応／39人で重複1人以下／旧セーブ不変／キャッシュ上限／原画の解像度と容量：確認済み');
// ランク表示の境界も保つ。
const ui=fs.readFileSync(path.join(root,'js/ui.js'),'utf8');vm.runInContext(ui.slice(ui.indexOf('const RANKS ='),ui.indexOf('// up：')),ctx);
for(const [v,r] of [[-10,'G'],[0,'G'],[19,'G'],[20,'F'],[89,'A'],[90,'S'],[101,'S']])assert.equal(vm.runInContext('rankOf('+v+')',ctx),r);
console.log('ランクの境界：確認済み');
