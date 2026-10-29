'use strict';
/* 音が鳴る直前も、現在の名簿ではなく再生する時点の本人を描く。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ui=fs.readFileSync(path.join(__dirname,'../js/ui.js'),'utf8'),ctx=vm.createContext({assert,console});
vm.runInContext(`
const past={id:'本人',name:'4月の名前',seat:'席',grade:1,stats:{pitch:15}},present={...past,name:'今の名前',grade:2,stats:{pitch:60}};
const S={members:[present]},U={view:'mel',playing:false,waitPlay:null,stageMembers:new Map([['席',past]])},CD={stageMembers:new Map([['席',past]])};
const SEATS=[{id:'席',sec:'s',inst:'flute'}],painted=[];
const g=new Proxy({},{get:(_,key)=>()=>{}}),Faces={draw(_,m){painted.push(m);return true;}};
const $=()=>({classList:{contains:()=>true}}),stageGeom=()=>({H:280,r:10}),seatXY=()=>[40,40],fitCanvas=()=>({g,W:375,H:280}),tok=()=>({});
const stageFloor=()=>{},skillColor=()=>'',avgStats=()=>0,drawInstrument=()=>{},cdMemberById=()=>null;
const canvas={id:'stage',parentElement:{clientWidth:375},dataset:{}};
function check(time,expected){painted.length=0;drawStage(time,canvas);assert.equal(painted.length,1);assert.equal(painted[0],expected);assert.equal(canvas.dataset.portraitCount,'1');}
`,ctx);
vm.runInContext(ui.slice(ui.indexOf('function drawStage('),ui.indexOf('function seatAt(')),ctx);
vm.runInContext(`
U.playing=true;check(-.2,past);check(-.001,past);check(0,past);
U.playing=false;U.waitPlay={};check(-1,past);
U.waitPlay=null;check(-1,present);
const members=JSON.stringify(S);canvas.id='cdStage';check(-.2,past);assert.equal(JSON.stringify(S),members);
console.log('演奏前の余白・最初の音・読み込み待ち・停止・本番画面で当時の本人を描き、現在の名簿を保つ：確認済み');
`,ctx);
