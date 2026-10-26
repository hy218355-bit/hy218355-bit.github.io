'use strict';
/* 顔の間隔・席のタップ・録音の部員・舞台の絵の再利用を確かめる。 */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'..'),images=[];let stamps=0,sourceDraws=0,targetDraws=0;
class PortraitImage{constructor(){this.complete=false;this.naturalWidth=0;images.push(this);}set src(value){this.url=value;}loaded(){this.complete=true;const item=JSON.parse(fs.readFileSync(path.join(root,'img/faces/manifest.json'),'utf8')).sheets.find(s=>this.url.includes(s.file));this.naturalWidth=item.width;this.naturalHeight=item.height;this.onload?.();}}
const document={currentScript:{src:'http://local/js/faces.js'},dispatchEvent:()=>{},createElement:()=>{stamps++;return {getContext:()=>({beginPath(){},arc(){},clip(){},drawImage(){sourceDraws++;}})};}};
const ctx=vm.createContext({URL,Image:PortraitImage,Event:class{},document,console});
for(const file of ['util.js','instruments.js','band.js','face-cast.js','faces.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',file),'utf8'),ctx);
const ui=fs.readFileSync(path.join(root,'js/ui.js'),'utf8');
vm.runInContext(ui.slice(ui.indexOf('function stageGeom('),ui.indexOf('function levelAt(')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function seatAt('),ui.indexOf('/* ===== 譜面台')),ctx);
vm.runInContext(`
for(const W of [240,309,343,720]){
 const G=stageGeom(W,true),points=SEATS.map(s=>[s,seatXY(s,G)]);
 for(const [s,[x,y]] of points){
  if(x-G.r<0||x+G.r>W||y-G.r<0||y+G.r>G.H)throw Error('顔が舞台の外: '+s.id);
  const cv={id:'stage',getBoundingClientRect:()=>({left:10,top:20,width:W})};
  if(seatAt({clientX:x+10,clientY:y+20},cv)?.id!==s.id)throw Error('顔とタップの席が違う');
 }
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)if(Math.hypot(points[i][1][0]-points[j][1][0],points[i][1][1]-points[j][1][1])<G.r*2+1.5)throw Error('顔が重なる: '+W);
 const old=stageGeom(W);for(const s of SEATS){const [x,y]=seatXY(s,old);if(x!==old.cx+s.x*old.R||y!==old.baseY-s.y*old.R*.95)throw Error('楽器決めの位置が変わった');}
}
const S={members:[{id:'new',name:'佐藤 結衣',seat:'picc1',stats:{pitch:50}}],recs:[{members:[{id:'old',name:'佐藤 悠真',seat:'picc1',stats:{pitch:40}}]}]};
const oldCast=stageMembers({notes:[{seat:'picc1',mid:'old'}],hits:[]});if(oldCast.get('picc1').id!=='old')throw Error('昔の録音が今の部員の顔になった');
`,ctx);
ctx.target={drawImage(){targetDraws++;}};
vm.runInContext("for(let i=0;i<100;i++)if(Faces.draw(target,{id:'m2026-n1',name:'佐藤 陽菜'},20,20,24))throw Error('原画の読み込み前に描いた');",ctx);
assert.equal(images.length,1);assert.equal(stamps,0);images[0].loaded();
vm.runInContext("for(let i=0;i<100;i++)if(!Faces.draw(target,{id:'m2026-n1',name:'佐藤 陽菜'},20,20,24))throw Error('原画が出ない');",ctx);
assert.equal(stamps,1);assert.equal(sourceDraws,1);assert.equal(targetDraws,100);
vm.runInContext("for(const [name,n] of [['陽菜',31],['悠真',8]])for(let i=1;i<=n;i++)Faces.draw(target,{id:'m2026-n'+i,name:'佐藤 '+name},20,20,24);",ctx);
for(const img of images)if(!img.complete)img.loaded();
vm.runInContext("for(const [name,n] of [['陽菜',31],['悠真',8]])for(let i=1;i<=n;i++)Faces.draw(target,{id:'m2026-n'+i,name:'佐藤 '+name},20,20,24);",ctx);
assert.equal(images.length,4);assert.equal(stamps,39);assert.equal(sourceDraws,39);
console.log('240〜720pxの顔の間隔・はみ出し・タップ／楽器決めの位置維持／録音の本人の顔／4枚の読み込みと39個の絵の再利用：確認済み');

// 新しいidで全候補を引いても、原画10枚と丸い画像100個だけを使い回す。
vm.runInContext("for(const [name,n] of [['陽菜',71],['悠真',29]])for(let i=1;i<=n;i++)Faces.draw(target,{id:'m2026-n'+i+'-abc',name:'佐藤 '+name},20,20,24);",ctx);
for(const img of images)if(!img.complete)img.loaded();
vm.runInContext("for(const [name,n] of [['陽菜',71],['悠真',29]])for(let i=1;i<=n;i++)Faces.draw(target,{id:'m2026-n'+i+'-abc',name:'佐藤 '+name},20,20,24);",ctx);
assert.equal(images.length,10);assert.equal(stamps,100);assert.equal(sourceDraws,100);
console.log('100人へ拡張しても原画10枚・丸い画像100個を再利用：確認済み');
