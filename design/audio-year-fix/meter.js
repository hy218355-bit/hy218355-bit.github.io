'use strict';
/* 確認専用。実際の音源で音量を測り、本物のセーブと設定は使わない。 */
save=()=>{};load=()=>null;saveUI=()=>{};
document.addEventListener('DOMContentLoaded',()=>{
  U.sfx=false;U.fxMode='off';FX.q=[];clearTimeout(FX.timer);FX.on=false;$('#fx').hidden=true;
  const panel=document.createElement('section');panel.id='audioMeter';
  panel.style.cssText='position:fixed;inset:0;z-index:10000;background:#f6f2e9;color:#253640;padding:20px;overflow:auto;font:14px/1.6 system-ui';
  panel.innerHTML='<h1>曲の音量を確認</h1><button type="button" id="measureAudio">比べる</button><pre id="audioResult" style="white-space:pre-wrap"></pre>';
  document.body.appendChild(panel);
  const result={status:'ready',rows:[],errors:[]},out=$('#audioResult'),params=new URLSearchParams(location.search);
  const report=()=>out.textContent=JSON.stringify(result);
  report();
  $('#measureAudio').addEventListener('click',async e=>{
    e.currentTarget.disabled=true;result.status='loading';report();
    try{
      E.ensure();await SAMPLES.loading;await VIR.loading;
      if(!SAMPLES.ready||SAMPLES.error)throw Error('実際の楽器音源を読み込めていない');
      result.samples={ready:SAMPLES.ready,banks:Object.keys(SAMPLES.banks).length,ir:!!VIR.man};
      const ids=(params.get('pieces')||'pomp,galop,ode').split(','),profiles=(params.get('profiles')||'model,mid,five').split(',');
      for(const profile of profiles)for(const pid of ids){
        result.status='rendering';result.current={profile,pid};report();
        let members=fullBand({pitch:65,rhythm:65,tone:65,expr:65});
        if(profile==='five')members=members.filter(m=>['asax1','hn1','tuba1','euph1','tp1a'].includes(m.seat));
        const perf=profile==='model'?modelPerf(pid):perform({members,pieceId:pid,cohesion:80,fam:100,interp:{tempo:1,dyn:1,rub:1},venue:'hall',seed:'band',lead:()=>1});
        const buf=await renderPerf(perf,{venue:'hall'}),metrics=measureLoudness(buf);
        const row={profile,pid,outGain:PIECES[pid].outGain??1,listenGain:PIECES[pid].listenGain||null,players:new Set([...perf.notes,...perf.hits].map(n=>n.mid)).size,...metrics};
        if(pid==='pomp'){
          const boundary=perf.notes.find(n=>n.b>=32)?.t||buf.duration/2;
          const clip=(from,to)=>{const n=Math.max(1,Math.floor((to-from)*buf.sampleRate)),b=new AudioBuffer({length:n,numberOfChannels:2,sampleRate:buf.sampleRate});for(let c=0;c<2;c++)b.copyToChannel(buf.getChannelData(c).subarray(Math.floor(from*buf.sampleRate),Math.floor(from*buf.sampleRate)+n),c);return b;};
          row.first=measureLoudness(clip(0,boundary));row.tutti=measureLoudness(clip(boundary,buf.duration));
        }
        result.rows.push(row);report();
      }
      result.status='done';
    }catch(err){result.status='failed';result.errors.push(String(err.stack||err));}
    report();
  });
});
