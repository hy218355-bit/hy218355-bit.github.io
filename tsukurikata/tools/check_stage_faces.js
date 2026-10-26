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
  if(seatAt({clientX:x+10,clientY:y+G.r+11+20},cv)?.id!==s.id)throw Error('楽器とタップの席が違う: '+s.id);
  if(y+G.r+20>G.H)throw Error('楽器が舞台の外: '+s.id);
 }
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)if(Math.hypot(points[i][1][0]-points[j][1][0],points[i][1][1]-points[j][1][1])<G.r*2+1.5)throw Error('顔が重なる: '+W);
 const old=stageGeom(W);for(const s of SEATS){const [x,y]=seatXY(s,old);if(x!==old.cx+s.x*old.R||y!==old.baseY-s.y*old.R*.95)throw Error('楽器決めの位置が変わった');}
}
const S={members:[{id:'new',name:'佐藤 結衣',seat:'picc1',stats:{pitch:50}}],recs:[{snap:{members:[{id:'old',name:'佐藤 悠真',seat:'picc1',stats:{pitch:40}}]}}]};
const oldCast=stageMembers({notes:[{seat:'picc1',mid:'old'}],hits:[]});if(oldCast.get('picc1').id!=='old')throw Error('昔の録音が今の部員の顔になった');
const first={notes:[{seat:'fl1a',mid:'new'}],hits:[]},later={notes:[{seat:'picc1',mid:'new'}],hits:[]};
const saved=JSON.stringify(S),sound=JSON.stringify(first);
rememberStageMembers(first,[{id:'new',name:'佐藤 七海',grade:1,seat:'fl1a',stats:{pitch:25}},{id:'quiet',name:'佐藤 紬',grade:2,seat:'tuba1',stats:{pitch:60}}]);
rememberStageMembers(later,[{id:'new',name:'佐藤 葵',grade:2,seat:'picc1',stats:{pitch:70}}]);
const beforeRename=stageMembers(first).get('fl1a');
if(beforeRename.name!=='佐藤 七海'||beforeRename.grade!==1||beforeRename.stats.pitch!==25||beforeRename.seat!=='fl1a')throw Error('選んだ録音の名前・学年・力・席が変わった');
if(stageMembers(first).get('tuba1')?.id!=='quiet')throw Error('録音の範囲に出番がない部員が舞台から消えた');
if(stageMembers(later).get('picc1').name!=='佐藤 葵')throw Error('別の録音の部員情報が混ざった');
if(stageMembers({notes:[{seat:'picc1',mid:'new'}],hits:[]}).get('picc1').name!=='佐藤 結衣')throw Error('現在の合奏に昔の名前が混ざった');
if(JSON.stringify(S)!==saved||JSON.stringify(first)!==sound)throw Error('顔の表示でセーブや演奏の音が変わった');
const U={playing:true,shown:first};if(!recordingPlayback())throw Error('録音を現在の合奏と混ぜた');
const live=rememberStageMembers({notes:[],hits:[]},[{id:'quiet',name:'佐藤 紬',seat:'tuba1',stats:{pitch:60}}],false);
U.shown=live;if(recordingPlayback())throw Error('現在の合奏を録音と混ぜた');
if(stageMembers(live).get('tuba1')?.id!=='quiet')throw Error('現在の合奏で休みの部員が消えた');
`,ctx);
// 全座席の楽器に絵があり、同じ輪郭を毎フレーム作り直さない。
let paths=0,strokes=0;
ctx.Path2D=class{constructor(d){assert.ok(d.startsWith('M'));paths++;}};
vm.runInContext(fs.readFileSync(path.join(root,'js/instrument-icons.js'),'utf8'),ctx);
ctx.iconCanvas={save(){},restore(){},translate(){},scale(){},stroke(){strokes++;}};
vm.runInContext("for(let frame=0;frame<100;frame++)for(const s of SEATS)if(!drawInstrument(iconCanvas,s.inst,20,20,18,'ink'))throw Error('楽器の絵がない: '+s.inst);",ctx);
assert.equal(paths,16);assert.equal(strokes,3900);
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
