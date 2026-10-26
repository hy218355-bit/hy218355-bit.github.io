'use strict';
/* 39人の顔の内訳・名前との対応・旧セーブを変えないことを確かめる。 */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'..'),ctx=vm.createContext({URL,document:{currentScript:{src:'http://local/js/faces.js'}},console});
for(const file of ['util.js','instruments.js','band.js','face-cast.js','faces.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',file),'utf8'),ctx);
vm.runInContext(`
if(Faces.catalog.length!==100)throw Error('100人でない');
if(Faces.catalog.filter(f=>f.base<39&&f.style==='female'&&f.standout).length!==8)throw Error('かわいい女子が8人でない');
if(Faces.catalog.filter(f=>f.base<39&&f.style==='male'&&f.standout).length!==1)throw Error('かっこいい男子が1人でない');
if(Faces.catalog.filter(f=>f.base<39&&!f.standout).length!==30)throw Error('自然な顔立ちの30人でない');
if(new Set(Faces.catalog.map(f=>f.sheet+':'+f.cell)).size!==100)throw Error('原画が重複');
// 名前を作る処理は、比率を入れる前と同じ。既存名も変更しない。
function originalName(used,...seed){for(let k=0;k<50;k++){const n=SURNAMES[Math.floor(hash(...seed,'s',k)*SURNAMES.length)]+' '+GIVEN[Math.floor(hash(...seed,'g',k)*GIVEN.length)];if(!used.has(n)){used.add(n);return n;}}return '新入部員';}
const a=new Set(),b=new Set();for(let i=1;i<=200;i++)if(makeName(a,'recruit',2026,i)!==originalName(b,'recruit',2026,i))throw Error('名前生成が元に戻っていない');
for(const name of GIVEN_FEMALE)if(Faces.features({id:'m2026-n5',name:'佐藤 '+name}).style!=='female')throw Error(name+'に男性の顔');
for(const name of GIVEN_MALE)if(Faces.features({id:'m2026-n1',name:'佐藤 '+name}).style!=='male')throw Error(name+'に女性の顔');
const old={id:'m2026-n5',name:'佐藤 陽菜',grade:1,sta:90},before=JSON.stringify(old),first=Faces.features(old);
if(first!==Faces.features({...old,grade:3}))throw Error('進級で顔が変わった');
for(const size of [26,32,36,54,88,112]){const html=Faces.image(old,size);if(!html.includes('data-presentation="female"')||/<svg|blob:|data:image/.test(html))throw Error('原画の表示でない');}
if(JSON.stringify(old)!==before)throw Error('前の部員を変更した');
for(let i=0;i<1000;i++)Faces.features({id:'old-save-'+i,name:'佐藤 陽菜'});if(Faces.cacheSize()>256)throw Error('キャッシュが増え続ける');
`,ctx);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'img/faces/manifest.json'),'utf8'));
for(const s of manifest.sheets){assert.ok(fs.statSync(path.join(root,'img/faces',s.file)).size<=200000);assert.ok(s.width/s.cols>=320);assert.ok(s.height/s.rows>=320);}
console.log('100人の原画／元の39人の内訳維持／名前生成／名前と顔の対応／旧セーブ不変／キャッシュ／解像度と容量：確認済み');
const ui=fs.readFileSync(path.join(root,'js/ui.js'),'utf8');vm.runInContext(ui.slice(ui.indexOf('const RANKS ='),ui.indexOf('// up：')),ctx);
for(const [v,r] of [[-10,'G'],[0,'G'],[19,'G'],[20,'F'],[89,'A'],[90,'S'],[101,'S']])assert.equal(vm.runInContext('rankOf('+v+')',ctx),r);
console.log('ランクの境界：確認済み');
