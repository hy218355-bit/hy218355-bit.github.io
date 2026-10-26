'use strict';
/* 顔の決まり方・再利用・旧セーブ互換を、画面を開かずに確かめる。 */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'..'),ctx=vm.createContext({URL,Blob,document:{currentScript:{src:'http://local/js/faces.js'},querySelectorAll:()=>[],addEventListener:()=>{}},console});
for(const file of ['util.js','faces.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',file),'utf8'),ctx);
const files=fs.readdirSync(path.join(root,'img/faces')).filter(f=>/^face-\d+.js$/.test(f));
assert.equal(files.length,39);
for(const f of files)vm.runInContext(fs.readFileSync(path.join(root,'img/faces',f),'utf8'),ctx);
vm.runInContext(`
for(const pool of [Array.from({length:40},(_,i)=>'m2026-n'+i),Array.from({length:40},(_,i)=>'old-member-'+i)]){
  if(new Set(pool.map(id=>Faces.fingerprint(id))).size!==40)throw Error('顔の組み合わせが重複');
}
const ids=Array.from({length:39},(_,i)=>'m2026-n'+i);
if(new Set(ids.map(id=>Faces.features(id).base)).size!==39)throw Error('39人の原画が重複');
const m={id:'m2026-n1',name:'前の名前',grade:1,sta:90},before=JSON.stringify(m);
const first=Faces.image(m,36),second=Faces.image({...m,name:'別の名前',grade:3},36);
if(first!==second)throw Error('名前か学年で顔が変わった');
if(JSON.stringify(m)!==before)throw Error('部員データを変更した');
if(Faces.cacheSize()!==1)throw Error('同じ顔を再利用していない');
for(const mood of ['normal','tired','zone','freeze']){
 const svg=Faces.svg(m.id,mood);if(!svg||/<image|data:image/i.test(svg))throw Error('SVGパーツでない');
}
`,ctx);
const sizes=files.map(f=>fs.statSync(path.join(root,'img/faces',f)).size);
assert.ok(Math.max(...sizes)<200000);
console.log('39人の原画／40人の組み合わせ／名前と学年からの独立／セーブ不変／キャッシュ／SVG形式：確認済み。最大 '+Math.max(...sizes)+' bytes');


// 入部後に平均との差分が負になる週でも、表示を止めない。
const ui=fs.readFileSync(path.join(root,'js/ui.js'),'utf8');
vm.runInContext(ui.slice(ui.indexOf('const RANKS ='),ui.indexOf('// up：')),ctx);
for(const [v,r] of [[-10,'G'],[0,'G'],[19,'G'],[20,'F'],[89,'A'],[90,'S'],[101,'S']])assert.equal(vm.runInContext('rankOf('+v+')',ctx),r);
console.log('ランクの下限・上限と境界：確認済み');

// 長く遊んだときに、画面にない顔のキャッシュを増やし続けない。
vm.runInContext("for(let i=0;i<220;i++)Faces.image({id:'old-save-'+i,sta:100},36);if(Faces.cacheSize()>160)throw Error('顔のキャッシュが上限を超えた');",ctx);
console.log('長く遊んだときのキャッシュ上限：確認済み');

vm.runInContext("for(const start of [1,10,35,80]){const ids=Array.from({length:39},(_,i)=>'m2028-n'+(start+i));if(new Set(ids.map(id=>Faces.features(id).base)).size!==39)throw Error('39人の代の境目で顔が重複');}",ctx);
console.log('39人の代の境目：確認済み');
