'use strict';
/* 実際の音の予約を使い、途中のフェードが再び大きくならないか確かめる。 */
(async()=>{
const sr=48000;
function measure(data,at,duration){
 const first=Math.round(at*sr),last=Math.round((at+duration)*sr),values=Array.from(data.slice(first,last+1));
 return {peak:Math.max(...values),end:data[last],start:data[first],jump:Math.abs(data[first]-data[first-1]),edge:Array.from(data.slice(first-3,first+4)),maxRise:values.reduce((m,x,i)=>i?Math.max(m,x-values[i-1]):m,0)};
}
async function run(mode,fade=.4,switchAt=.12){
 const ac=new OfflineAudioContext(1,sr,sr),source=ac.createConstantSource(),gain=ac.createGain();source.offset.value=1;source.connect(gain);gain.connect(ac.destination);source.start();
 gain.gain.setValueAtTime(0,0);gain.gain.linearRampToValueAtTime(1,.4);
 const paused=ac.suspend(switchAt),rendering=ac.startRendering();await paused;const at=ac.currentTime,value=gain.gain.value;
 if(mode==='old'){gain.gain.setValueAtTime(value,at);gain.gain.linearRampToValueAtTime(0,at+fade);}
 else if(mode==='fallback')fadeVenueOut({value,cancelScheduledValues:t=>gain.gain.cancelScheduledValues(t),setValueAtTime:(v,t)=>gain.gain.setValueAtTime(v,t),linearRampToValueAtTime:(v,t)=>gain.gain.linearRampToValueAtTime(v,t)},at,fade);
 else fadeVenueOut(gain.gain,at,fade);
 await ac.resume();const buffer=await rendering,data=buffer.getChannelData(0),samples=[];
 for(let i=0;i<=80;i++){const t=i/100;samples.push({t,v:data[Math.round(t*sr)]});}
 return {mode,fade,at,value,...measure(data,at,fade),samples};
}
async function chainCheck(){
 // 製品の会場・位置の切り替えを使い、各出口の音量を別チャンネルへ書き出す。
 const ac=new OfflineAudioContext(5,sr,sr),merger=ac.createChannelMerger(5),source=ac.createConstantSource();
 merger.channelInterpretation='discrete';merger.connect(ac.destination);source.offset.value=1;source.start();
 const chain=new VenueChain(ac,ac.createGain()),stages=[],changes=[];
 function capture(){const st=chain.stage;source.connect(st.out);st.out.connect(merger,0,stages.length);stages.push(st);}
 chain.set('room','center',0);capture();chain.set('gym');capture();
 const times=[.12,.2,.24],pauses=times.map(t=>ac.suspend(t)),rendering=ac.startRendering();
 for(let i=0;i<times.length;i++){
  await pauses[i];const at=ac.currentTime,old=chain.stage,fade=i===1?.3:.4;
  changes.push({at,fade,index:stages.indexOf(old),held:old.out.gain.value});
  if(i===0)chain.set('civic');else if(i===1)chain.set('civic','center',.3,true);else chain.setPosition('back');
  capture();await ac.resume();
 }
 const buffer=await rendering;
 return {changes:changes.map(c=>({...c,...measure(buffer.getChannelData(c.index),c.at,c.fade)})),finalVenue:chain.venueId,finalPosition:chain.posId,finalGain:buffer.getChannelData(4)[Math.round(.9*sr)]};
}
const results=[await run('old'),await run('fixed'),await run('fallback')],cases=[];
for(const fade of [.3,.4])for(const at of [.12,.28,.45])for(const mode of ['fixed','fallback']){const {samples,...r}=await run(mode,fade,at);cases.push(r);}
const integration=await chainCheck(),errors=[];
for(const r of [...results.filter(r=>r.mode!=='old'),...cases,...integration.changes]){
 if(r.maxRise>1e-7||Math.abs(r.end)>1e-6||r.jump>.0002)errors.push('フェードの連続性：'+JSON.stringify(r));
}
if(integration.finalGain!==1||integration.finalVenue!=='civic'||integration.finalPosition!=='back')errors.push('切り替え後の会場');
const line=r=>r.samples.map((p,i)=>(i?'L':'M')+(35+p.t/.8*540).toFixed(1)+' '+(290-p.v*250).toFixed(1)).join(' ');
document.querySelector('#chart').innerHTML='<path d="M35 25V290H575" fill="none" stroke="#68736d"/>'+results.filter(r=>r.mode!=='fallback').map(r=>'<path d="'+line(r)+'" fill="none" stroke="'+(r.mode==='old'?'#e49c9d':'#a5ceba')+'" stroke-width="3"/>').join('')+'<text x="35" y="317" fill="#b7c5be" font-size="13">0秒</text><text x="525" y="317" fill="#b7c5be" font-size="13">0.8秒</text><text x="45" y="20" fill="#b7c5be" font-size="13">音量</text>';
document.querySelector('#status').textContent=errors.length?'確認が必要です':'12条件と3回の連続切り替え：すべて確認済み';
document.querySelector('#audit').textContent=JSON.stringify({results,cases,integration,errors},null,2);document.documentElement.dataset.ready=errors.length?'error':'true';
})().catch(e=>{document.querySelector('#audit').textContent=JSON.stringify({errors:[e.message]});document.documentElement.dataset.ready='error';});
