'use strict';
/* 実際の停止処理と音量予約を使い、停止後に音が戻らないか測る。 */
(async()=>{
const sr=48000;
async function run(compat=false,at=.12,queued=true,method='stop'){
 const ac=new OfflineAudioContext(2,sr,sr),src=ac.createConstantSource(),bus=ac.createGain(),wet=ac.createGain(),merger=ac.createChannelMerger(2);
 src.offset.value=1;src.connect(bus);src.connect(wet);bus.connect(merger,0,0);wet.connect(merger,0,1);merger.connect(ac.destination);src.start();
 const calls=[],pb={ac,bus,wet,srcs:[src],voices:[{stop:t=>calls.push(t)}],listenOutputs:[],ended:false,out:1,timer:setInterval(()=>{},60000)};
 if(queued){Playback.prototype.setLevel.call(pb,1.45,.2);Playback.prototype.setLevel.call(pb,.5,.32);}
 const waiting=ac.suspend(at),rendering=ac.startRendering();await waiting;
 const time=ac.currentTime,held=bus.gain.value;
 if(compat){
  const wrap=node=>({gain:{get value(){return node.gain.value;},cancelScheduledValues:t=>node.gain.cancelScheduledValues(t),linearRampToValueAtTime:(v,t)=>node.gain.linearRampToValueAtTime(v,t),setTargetAtTime:(v,t,c)=>node.gain.setTargetAtTime(v,t,c)},disconnect:()=>node.disconnect()});
  pb.bus=wrap(bus);pb.wet=wrap(wet);
 }
 Playback.prototype[method].call(pb);Playback.prototype[method].call(pb);
 await ac.resume();const buffer=await rendering,channels=[];
 for(let ch=0;ch<2;ch++){
  const d=buffer.getChannelData(ch),first=Math.round(time*sr),end=Math.round((time+.3)*sr),segment=Array.from(d.slice(first,end)),samples=[];
  for(let i=0;i<=60;i++){const t=i/100;samples.push({t,v:d[Math.round(t*sr)]});}
  channels.push({start:d[first],jump:first?Math.abs(d[first]-d[first-1]):0,atNextLevel:d[Math.round(.2*sr)],laterPeak:Math.max(...Array.from(d.slice(Math.round(.2*sr),end))),maxRise:segment.reduce((m,x,i)=>i?Math.max(m,x-segment[i-1]):m,0),atEnd:d[end],afterStop:Math.max(...Array.from(d.slice(end+1))),samples});
 }
 return {method,compat,at:time,queued,held,ended:pb.ended,voiceStops:calls,channels};
}
const results=[await run()],cases=[];
for(const compat of [false,true])for(const at of [0,.12,.28])for(const queued of [false,true])cases.push(await run(compat,at,queued));
const natural=await run(false,.12,true,'finish'),errors=[];
if(natural.voiceStops.length||natural.channels.some(c=>c.afterStop<.5))errors.push('自然終了の余韻が切れた');
for(const r of [...results,...cases])for(const c of r.channels)if(c.maxRise>1e-7||c.jump>.001*r.held||c.afterStop>1e-7)errors.push({compat:r.compat,at:r.at,queued:r.queued,maxRise:c.maxRise,jump:c.jump,afterStop:c.afterStop});
const path=sample=>sample.map((p,i)=>(i?'L':'M')+(35+p.t/.6*540).toFixed(1)+' '+(290-p.v*220).toFixed(1)).join(' ');
const baseline=await (await fetch('baseline.json')).json();
document.querySelector('#chart').innerHTML='<path d="M35 25V290H575" fill="none" stroke="#68736d"/><path d="M143 25V290" fill="none" stroke="#e7c38a" stroke-dasharray="4 5"/><text x="148" y="20" fill="#e7c38a" font-size="13">停止</text><text x="35" y="315" fill="#b7c5be" font-size="13">0秒</text><text x="535" y="315" fill="#b7c5be" font-size="13">0.6秒</text><path d="'+path(baseline.results[0].channels[0].samples)+'" fill="none" stroke="#e49c9d" stroke-width="3"/><path d="'+path(results[0].channels[0].samples)+'" fill="none" stroke="#a5ceba" stroke-width="3"/>';
document.querySelector('#audit').textContent=JSON.stringify({results,cases,natural,errors},null,2);document.querySelector('#status').textContent=errors.length?'停止後の音量に再上昇があります':'12条件・直接音と響き：確認済み';document.documentElement.dataset.ready='true';
})().catch(e=>{document.querySelector('#audit').textContent=JSON.stringify({errors:[e.message]});document.documentElement.dataset.ready='error';});
