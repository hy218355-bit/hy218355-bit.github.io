'use strict';
/* 入力の処理待ちを混ぜず、実際に触れた間隔と判定を使うことを確かめる。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),ctx=vm.createContext({assert,console,setTimeout:()=>1,clearTimeout(){},window:{}});
const pieces=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]);
for(const f of ['util','instruments','venues','scores',...pieces,'band','game'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f+'.js'});
const engine=fs.readFileSync(path.join(root,'js/engine.js'),'utf8');
vm.runInContext(engine.slice(engine.indexOf('const CD_FOLLOW'),engine.indexOf('// ステージの奥行き')),ctx);
vm.runInContext(`
let wallNow=1000;const performance={now:()=>wallNow,timeOrigin:1700000000000};
const node=()=>({style:{},textContent:'',appendChild(){},remove(){},getBoundingClientRect:()=>({left:0,top:0,width:300,height:300})});
const nodes={},$=id=>nodes[id]||=(node()),document={createElement:node},E={ac:{currentTime:0},pb:{setLevel(){}}},U={venue:'room',fxMode:'full'};
const fxCalm=()=>false,playPerf=()=>{};
`,ctx);
vm.runInContext(fs.readFileSync(path.join(root,'js/conduct.js'),'utf8'),ctx);
vm.runInContext(`
cdClick=()=>{};cdRipple=()=>{};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,a+' ≠ '+b);
function fresh(phase='play'){
 CD.phase=phase;CD.perf={pieceId:'pomp',meter:4,from:0,to:80,interp:{tempo:1}};CD.stage=null;
 CD.clock=BeatClock.start(20,0,.5);CD.count=[];CD.lastTap=0;CD.level=1;CD.lv=[];CD.cuePeriod=.5;CD.cueStart=10;
 CD.judge={p:0,g:0,e:0,l:0};CD.combo=CD.best=0;
}
function touch(at,delay=0,extra={}){
 E.ac.currentTime=at+delay;wallNow=1000+(at+delay)*1000;
 cdTap({preventDefault(){},timeStamp:1000+at*1000,...extra});
}
fresh();const delays=[.1,.08,.16,.05,.12];
delays.forEach((d,i)=>touch(20+i*.5,d));
console.log(JSON.stringify({scenario:'半秒ごとの5タップ・処理待ち50〜160ms',judge:CD.judge,period:CD.clock.P,taps:CD.clock.taps.map(t=>({time:+t.t.toFixed(4),offset:+t.off.toFixed(4)}))}));
assert.equal(CD.judge.p,5,'処理待ちで遅い判定にしない');near(CD.clock.P,.5);
CD.clock.taps.forEach((t,i)=>{near(t.t,20+i*.5);near(t.off,0);});
fresh('count');[.04,.14,.06,.18].forEach((d,i)=>touch(10+i*.5,d));
assert.equal(CD.phase,'play');near(CD.clock.P,.5);near(CD.clock.t0,12);
assert.deepEqual(CD.count,[10,10.5,11,11.5]);
// 本当に遅く触れた場合の判定は甘くしない。
fresh();touch(20.1,.1);assert.equal(CD.judge.l,1);
fresh();touch(20,0);touch(20.08,.12);assert.equal(CD.clock.taps.length,1,'二度押しの除外も触れた間隔で決める');
fresh();touch(20,.1,{timeStamp:performance.timeOrigin+21000});assert.equal(CD.judge.p,1,'古いブラウザの時刻の起点もそろえる');
for(const stamp of [undefined,0,-1,NaN,Infinity,999999999]){
 fresh();touch(20,.1,{timeStamp:stamp});near(CD.clock.taps[0].t,20.1);
}
fresh();const before=JSON.stringify([CD.clock.ev,CD.clock.taps,CD.judge,CD.count]);touch(20,.4);
assert.equal(JSON.stringify([CD.clock.ev,CD.clock.taps,CD.judge,CD.count]),before,'長く滞留した入力は演奏を巻き戻さない');
fresh();touch(20,0,{isPrimary:false});touch(20.5,0,{pointerType:'mouse',button:2});assert.equal(CD.clock.taps.length,0);
fresh();touch(20,0,{pointerType:'mouse',button:0});assert.equal(CD.judge.p,1);
// 保存する指揮を読み直しても、同じ時刻・拍・正確さを引き継ぐ。
fresh();delays.forEach((d,i)=>touch(20+i*.5,d));
const saved=JSON.parse(JSON.stringify({ev:CD.clock.saved(),taps:CD.clock.savedTaps()})),restored=BeatClock.fromSaved(saved.ev,100,saved.taps);
near(restored.beatAt(101),2);assert.deepEqual(restored.savedTaps(),CD.clock.savedTaps());
assert.deepEqual(Object.keys(saved).sort(),['ev','taps']);
console.log('処理待ちの補正／テンポ出しと開始時刻／本当の遅れと二度押し／時刻の起点と無効な値／滞留・複数指・右クリック／保存した指揮の再生：確認済み');
`,ctx);
