'use strict';
/* 聴くための音量補正を指揮・採点・区間と混ぜず、音色のつなぎを滑らかにすることを確かめる。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),timers=[];
const ctx=vm.createContext({console,assert,Float32Array,setInterval:()=>1,clearInterval(){},setTimeout:(fn,ms)=>timers.push({fn,ms})});
const pieces=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]);
for(const file of ['util','instruments','venues','scores',...pieces,'band','samples'])vm.runInContext(fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'),ctx,{filename:file+'.js'});
const engine=fs.readFileSync(path.join(root,'js/engine.js'),'utf8');
vm.runInContext(engine.slice(engine.indexOf('function warpNote('),engine.indexOf('/* ===== 録音を音声ファイル')),ctx);
vm.runInContext(`
class Param{
 constructor(){this.value=0;this.events=[];}
 setValueAtTime(v,t){this.events.push({type:'set',v,t});return this;}
 linearRampToValueAtTime(v,t){this.events.push({type:'ramp',v,t});return this;}
 setTargetAtTime(v,t,tau){this.events.push({type:'target',v,t,tau});return this;}
 setValueCurveAtTime(v,t,d){this.events.push({type:'curve',t,d});return this;}
 cancelScheduledValues(){return this;}
}
class Node{
 constructor(){this.gain=new Param();this.frequency=new Param();this.Q=new Param();this.playbackRate=new Param();this.links=[];}
 connect(n){this.links.push(n);return n;}disconnect(){this.disconnected=true;}start(){}stop(){}
}
const ac={currentTime:0,createGain:()=>new Node(),createBiquadFilter:()=>new Node(),createBufferSource:()=>new Node()};
const engineOf=()=>({ac,chain:{input:new Node(),wetIn:new Node()},posId:'center',solo:{type:'all'}});
const perf=(pieceId='pomp',from=0,to=80)=>({pieceId,from,to,notes:[],hits:[],b2t:b=>(b-from)*.75,t2b:t=>from+t/.75});
let pf=perf(),original=JSON.stringify(pf),p=new Playback(engineOf(),pf,null);
assert.equal(p.listenOutputs.length,2,'直接音と残響を別々に同じだけ補う');
const dry=p.listenOutputs[0].gain,wet=p.listenOutputs[1].gain;
assert.equal(dry.value,1.6);assert.deepEqual(dry.events,wet.events);
assert.ok(dry.events.some(e=>e.type==='ramp'&&e.v===1&&Math.abs(e.t-(p.T0+24))<1e-6));
const unchanged=JSON.stringify(dry.events);p.setLevel(.7,1);assert.equal(JSON.stringify(dry.events),unchanged,'指揮の強弱で区間の補正を上書きしない');
assert.equal(JSON.stringify(pf),original,'演奏の記録を変更しない');
assert.equal(new Playback(engineOf(),perf('pomp',32,80),null).listenOutputs.length,0,'全合奏だけなら音量を上乗せしない');
assert.equal(new Playback(engineOf(),perf('galop'),null).listenOutputs.length,0,'ほかの曲はそのまま');
const clock=BeatClock.fromSaved([{b:0,t:0,P:1},{b:30,t:30,P:1.5}],.5);
const recorded=new Playback(engineOf(),perf(),null,{clock});
assert.ok(recorded.listenOutputs[0].gain.events.some(e=>e.type==='ramp'&&e.v===1&&e.t===clock.timeOf(32)),'保存した指揮の速さで音量を戻す');
const live=BeatClock.start(.5,0,1);live.ev.push({b:30,t:40,P:2});
const conducting=new Playback(engineOf(),perf(),null,{clock:live});
ac.currentTime=42;conducting.pump();
assert.equal(conducting.listenValue,1.3,'演奏中の指揮の31拍目で補正も途中の値になる');
assert.equal(conducting.listenOutputs[0].gain.events.at(-1).type,'target');
p.stop();recorded.finish();
SAMPLES.ready=true;SAMPLES.banks.flute={buf:{},kind:'sus',layers:[],samples:[{m:60,start:0,d:1,lp:[.2,.9],lc:1,c:0}]};
const voice=new SampleVoice(ac,new Node(),'fl',{alt:0});
const note={t:0,d:.8,midi:60,T:.7,env:[[0,.5],[.4,.6],[.8,.5]],cents:0,scoop:0,sag:0,vib:0,blat:1,att:.02,settle:.06,key:'one'};
const notesBefore=JSON.stringify(note);voice.play(note,null,1);
assert.equal(voice.lp.frequency.events.at(-1).type,'set','最初の音の立ち上がりはそのまま');
voice.play({...note,t:1,midi:67,join:true,slur:true,key:'two'},null,1);
assert.equal(voice.lp.frequency.events.at(-1).type,'target');assert.equal(voice.lp.frequency.events.at(-1).tau,.025);
voice.play({...note,t:2,join:false,key:'three'},null,1);
assert.equal(voice.lp.frequency.events.at(-1).type,'set','離れた音の歯切れを保つ');
assert.equal(JSON.stringify(note),notesBefore);
`,ctx);
for(const timer of timers)timer.fn();
vm.runInContext("assert.ok(p.listenOutputs.every(n=>n.disconnected));assert.ok(recorded.listenOutputs.every(n=>n.disconnected));",ctx);
console.log('静かな区間だけの補正／残響との一致／通常と保存済みと演奏中の指揮／区間と他曲の維持／停止と自然終了の片づけ／音色のなめらかなつなぎ／演奏記録の不変：確認済み');
