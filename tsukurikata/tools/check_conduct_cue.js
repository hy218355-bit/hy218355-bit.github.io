'use strict';
/* 予告の時刻と本当のタップ判定を合わせ、表示だけで演奏や保存内容を変えないことを確かめる。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),ctx=vm.createContext({assert,console,setTimeout:()=>1,clearTimeout(){},window:{}});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const pieces=[...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]);
for(const file of ['util','instruments','venues','scores',...pieces,'band','game'])vm.runInContext(fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'),ctx,{filename:file+'.js'});
const engine=fs.readFileSync(path.join(root,'js/engine.js'),'utf8');
vm.runInContext(engine.slice(engine.indexOf('const CD_FOLLOW'),engine.indexOf('// ステージの奥行き')),ctx);
vm.runInContext(`
const node=()=>({style:{},textContent:'',appendChild(){},remove(){},getBoundingClientRect:()=>({left:0,top:0,width:300,height:300})});
const performance={now:()=>1000},requestAnimationFrame=()=>1;
const nodes={},$=id=>nodes[id]||=(node()),document={createElement:node};
const E={ac:{currentTime:0},pb:{setLevel(){}}},U={venue:'room',fxMode:'full'};let played,calm=false;
const fxCalm=()=>calm;
const playPerf=perf=>{played=perf;};
`,ctx);
vm.runInContext(fs.readFileSync(path.join(root,'js/conduct.js'),'utf8'),ctx);
vm.runInContext(`
const clicks=[];cdClick=(at,strong)=>clicks.push(strong);cdPress=()=>{};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,a+' ≠ '+b);
for(const meter of [2,3,4,8]){
 CD.perf={meter,pieceId:'pomp',from:meter*2,to:meter*2+32,interp:{tempo:1}};clicks.length=0;
 CD.phase='count';CD.count=[];CD.cueStart=10;CD.cuePeriod=.6;CD.lastTap=0;CD.stage=null;
 CD.judge={p:0,g:0,e:0,l:0};CD.combo=CD.best=0;
 const n=cdCountN(),before=JSON.stringify(CD.perf);
 let q=cdCueState(10.3);assert.equal(q.next[0].beat,1);near(q.next[0].distance,.5);
 for(let i=0;i<n;i++){
  E.ac.currentTime=10.6+i*.6;cdTap({preventDefault(){}});
  if(i<n-1){assert.equal(CD.phase,'count');q=cdCueState(E.ac.currentTime+.3);near(q.next[0].distance,.5);assert.equal(q.count,i+1);}
 }
 assert.equal(CD.phase,'play');assert.equal(played,CD.perf);
 assert.deepEqual(clicks,({2:[true,false,true,false],3:[true,false,false],4:[true,false,false,false],8:[true,false,false,false,false,false,false,false]})[meter],'小節の1拍目で数え始める音を強める');
 const start=10.6+n*.6;near(CD.clock.t0,start);
 q=cdCueState(start-.15);assert.equal(q.next[0].beat,1);near(q.next[0].distance,.25);
 E.ac.currentTime=start;cdTap({preventDefault(){}});assert.equal(CD.judge.p,1,'予告の到着時刻がぴったりの判定と合う');
 const clock=JSON.stringify(CD.clock.ev),taps=JSON.stringify(CD.clock.taps);
 for(let i=0;i<500;i++)cdCueState(start+i*.01);
 assert.equal(JSON.stringify(CD.clock.ev),clock);assert.equal(JSON.stringify(CD.clock.taps),taps);assert.equal(JSON.stringify(CD.perf),before);
 q=cdCueState(CD.clock.timeOf(CD.perf.to)-.01);assert.ok(q.next.every(n=>!n.show),'曲の終わりの先に合図を出さない');
}
// 曲の区間と、速さを変えた指揮の拍から予告を取る。
for(const pid of PIECE_IDS){
 const pc=PIECES[pid],from=pc.spans.at(-1).from,to=pc.spans.at(-1).to;
 CD.perf={meter:pc.meter||4,pieceId:pid,from,to,interp:{tempo:1}};CD.phase='play';
 CD.clock=BeatClock.start(5,from,.5);CD.clock.tap(5);CD.clock.tap(5.8);
 const b=from+1.75,q=cdCueState(CD.clock.timeOf(b));near(q.b,1.75);near(q.next[0].distance,.25);
}
// 全曲の練習区間を、楽譜の途中の拍から数える。
for(const id of PIECE_IDS)for(const span of PIECES[id].spans){
 const meter=PIECES[id].meter||4;
 CD.perf={meter,pieceId:id,from:span.from,to:span.to};CD.phase='play';CD.clock=BeatClock.start(10,span.from,.5);
 const q=cdCueState(10);assert.equal(q.beat,span.from%meter+1,id+'の区間の先頭');
 assert.equal(q.next[0].beat,(span.from+1)%meter+1);assert.equal(q.next[1].beat,(span.from+2)%meter+1);
}
// 春の「鳥の歌」は3拍目、終わりの区間は4拍目から。途中の拍を1拍目へ戻さない。
for(const [from,first,accent]of [[54,3,[false,false,true,false]],[111,4,[false,true,false,false]]]){
 CD.perf={meter:4,pieceId:'spring',from,to:from+16,interp:{tempo:1}};
 CD.phase='count';CD.count=[];CD.cueStart=10;CD.cuePeriod=.5;CD.lastTap=0;CD.stage=null;
 CD.judge={p:0,g:0,e:0,l:0};CD.combo=CD.best=0;clicks.length=0;
 assert.equal(cdCueState(10).next[0].beat,first);
 for(let i=0;i<4;i++){E.ac.currentTime=10.5+i*.5;cdTap({preventDefault(){}});}
 assert.deepEqual(clicks,accent);assert.equal(cdCueState(CD.clock.t0).beat,first);
 assert.equal(cdCueState(CD.clock.timeOf(from+(5-first)%4)).beat,1);
}
// テンポ出しを中断したら数え直し、古い間隔を新しいテンポへ混ぜない。
for(const mode of ['full','short','off']){
 U.fxMode=mode;CD.cueNodes=null;CD.perf={meter:4,pieceId:'spring',from:111,to:140,interp:{tempo:1}};
 CD.phase='count';CD.count=[];CD.lastTap=0;CD.cuePeriod=.5;CD.cueStart=10;
 const perf=JSON.stringify(CD.perf);
 for(const t of [10,10.5]){E.ac.currentTime=t;cdTap({preventDefault(){}});}
 E.ac.currentTime=12.5;cdFrame();assert.equal(CD.count.length,2,'4拍までは続きを受け付ける');
 E.ac.currentTime=12.501;cdFrame();assert.equal(CD.count.length,0,'4拍を超えた中断で最初から数え直す');
 assert.equal(CD.phase,'count');assert.equal($('#cdMsg').textContent,'まず4回、'+cdCueHint());near(CD.cueStart,12.501);
 assert.equal(cdCueState(12.501).next[0].beat,4,'途中の区間の開始拍から予告を戻す');
 for(const t of [13,13.5,14,14.5]){E.ac.currentTime=t;cdTap({preventDefault(){}});}
 assert.equal(CD.phase,'play');assert.deepEqual(CD.count,[13,13.5,14,14.5]);near(CD.clock.P,.5);near(CD.clock.t0,15);
 const before=JSON.stringify(CD.count);E.ac.currentTime=20;cdFrame();assert.equal(JSON.stringify(CD.count),before,'演奏中は数え直さない');
 assert.equal(JSON.stringify(CD.perf),perf);
}
// 描画がしばらく止まっていた場合も、次の入力で古い数え始めを引き継がない。
CD.phase='count';CD.count=[10,10.5];CD.lastTap=10.5;CD.cuePeriod=.5;E.ac.currentTime=14;
cdTap({preventDefault(){}});assert.deepEqual(CD.count,[14]);assert.equal(CD.phase,'count');assert.equal($('#cdMsg').textContent,'あと3回');
// 2・3・8拍子も、最初の1入力だけで長く離れたときは待ち直す。
for(const meter of [2,3,8]){
 CD.perf={meter,pieceId:'pomp',from:0,to:80};CD.phase='count';CD.count=[10];CD.lastTap=10;CD.cuePeriod=.75;
 E.ac.currentTime=13;cdFrame();assert.equal(CD.count.length,1);
 E.ac.currentTime=13.01;cdFrame();assert.equal(CD.count.length,0);assert.equal($('#cdMsg').textContent,'まず'+cdCountN()+'回、'+cdCueHint());
}
for(const [off,kind]of [[-.2,'e'],[.05,'p'],[.1,'g'],[.2,'l']]){
 CD.judge={p:0,g:0,e:0,l:0};cdJudge({},$('#cdPad').getBoundingClientRect(),off);assert.equal(CD.judge[kind],1,'判定の幅は変えない');
}
CD.phase='wait';assert.equal(cdCueState(0),null);CD.phase='idle';assert.equal(cdCueState(0),null);CD.phase='done';assert.equal(cdCueState(0),null);
// 動かせない設定でも、光は固定し、到着線・操作面・拍の印を同時に点灯する。
const el=()=>({style:{},dataset:{},attrs:{},textContent:'',children:[],setAttribute(k,v){this.attrs[k]=v;},querySelector(){return this.text||=(el());},classList:{values:new Set(),toggle(k,on){on?this.values.add(k):this.values.delete(k);}}});
const n={svg:el(),now:el(),next:[el(),el()],steps:[el(),el(),el(),el()],beats:[el(),el(),el(),el()],pad:el()};
CD.cueNodes=n;CD.perf={meter:4,from:0,to:16};CD.phase='play';CD.clock=BeatClock.start(10,0,.5);
U.fxMode='full';cdDrawCue(10.1);assert.ok(!n.now.classList.values.has('hit'),'到着前に線を光らせない');const moving=n.next[0].attrs.transform;cdDrawCue(10.3);assert.notEqual(n.next[0].attrs.transform,moving);
cdDrawCue(10.499);assert.equal(n.next[0].attrs.transform,'translate(92.2 0)','到着線へ向かって2拍先の光が近づく');
cdDrawCue(9.75);assert.ok(n.next[0].classList.values.has('downbeat'),'2拍先の1拍目を予告する');cdDrawCue(10);assert.ok(n.now.classList.values.has('downbeat'));assert.ok(n.pad.classList.values.has('downbeat'));assert.ok(!n.next[1].classList.values.has('downbeat'));
CD.perf={meter:4,from:54,to:111};CD.phase='count';CD.count=[10];CD.cuePeriod=.5;CD.cueStart=9.5;
cdDrawCue(10);assert.ok(n.beats[2].classList.values.has('on'));assert.ok(n.beats[2].classList.values.has('counted'));assert.ok(!n.beats[0].classList.values.has('counted'));
CD.perf={meter:4,from:0,to:16};CD.phase='play';
for(const mode of ['short','off','reduce']){
 U.fxMode=mode==='reduce'?'full':mode;calm=mode==='reduce';cdDrawCue(10.1);const fixed=n.next[0].attrs.transform;
 cdDrawCue(10.3);assert.equal(n.next[0].attrs.transform,fixed);assert.equal(fixed,'translate(192 0)');
 cdDrawCue(10);assert.ok(n.now.classList.values.has('downbeat'));assert.ok(n.pad.classList.values.has('downbeat'));
 assert.equal(cdCueHint(),'ラインが光ったらタップ');cdDrawCue(10.5);assert.ok(n.now.classList.values.has('hit'));assert.ok(n.pad.classList.values.has('on-beat'));assert.ok(n.beats[1].classList.values.has('on'));
}
`,ctx);
console.log('2・3・4・8拍の予告と入り／実際のタップから演奏開始・ぴったり判定／全15曲の区間・テンポ変更／途中の拍と小節の先頭・数え始めの音／テンポ出しの中断と数え直し／演奏と時計の不変／終端・待機・終了／演出なし・短く・動きを減らす設定：確認済み');
