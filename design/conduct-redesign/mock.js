'use strict';
/* デザイン確認用。ゲームの保存や演奏の処理には触れず、同梱の部員の原画を使う。 */
const params=new URLSearchParams(location.search),body=document.body;
body.dataset.concept=params.get('concept')==='stage'?'stage':'halo';
body.dataset.theme=params.get('theme')==='dark'?'dark':'light';
const calm=matchMedia('(prefers-reduced-motion:reduce)').matches,still=params.has('still');
const used=new Set(),members=SEATS.map((seat,i)=>({id:'m2028-n'+(i+1)+'-cafe',name:makeNameFromPool(used,seat.sec==='fl'?GIVEN_FEMALE:GIVEN,'conduct-design',seat.id),seat:seat.id}));
const instrument={fl:'M2 5h12v4H2Zm3 0v4m3-4v4m3-4v4',dr:'M7 1h2v3l1 8H6L7 4Zm-1 6h4',cl:'M7 1h2v2l2 10H5L7 3Zm-1 6h4',sax:'M4 1h3l2 8q2 3 3-1V6h3v5q-6 6-9-1L4 3H2',tp:'M1 5h9l5-3v10l-5-3H4Q1 9 1 7Zm4 0V2m3 3V2',hn:'M7 3C0 3 0 14 7 14s7-9 0-9c-4 0-4 6 0 6m0-8h5l3-2v8l-3-3',tb:'M1 4h9l5-2v8l-5-2H4Q1 8 1 11v2h11',low:'M3 1h8L9 5v6q0 4-5 3Q0 14 1 10V6h3v5h3V5',perc:'M1 5h14Q14 13 8 13T1 5Zm3 7-1 3m9-3 1 3'};
document.querySelector('#band').innerHTML=members.map((m,i)=>{
 const row=Math.floor(i/8),col=i%8,n=row===4?7:8,x=10+(col+.5)*(80/n),y=12+row*34+Math.abs(col-(n-1)/2)*2;
 const featured=[8,13,25].indexOf(i);
 return `<div class="player ${featured>=0?'featured featured-'+featured:''}" style="left:${x}%;top:${y}px;--y:${y}">${memberFace(m,26)}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${instrument[SEAT[m.seat].sec]}"/></svg>${featured>=0?`<span class="player-name">${m.name.split(' ').pop()}</span>`:''}</div>`;
}).join('');
const players=[...document.querySelectorAll('.player')],area=document.querySelector('#playArea'),tap=document.querySelector('#tap'),feedback=document.querySelector('#feedback'),beatMarks=[...document.querySelector('#beatRow').children];
let epoch=performance.now()+750,count=0,combo=0,pulseUntil=0,pressUntil=0,feedbackUntil=0,lastBeat=-1,audio=null,sound=false,raf=0;
function reset(){epoch=performance.now()+750;count=combo=0;lastBeat=-1;feedback.textContent='';document.querySelector('#combo').textContent='';document.querySelector('#prompt').textContent='まず4回、拍に合わせて';document.querySelector('#tapSub').textContent='';}
function soundAtTap(level=.5){
 if(!sound)return;
 audio||=new (window.AudioContext||window.webkitAudioContext)();audio.resume();
 const t=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();o.frequency.value=740;g.gain.setValueAtTime(.02+.035*level,t);g.gain.exponentialRampToValueAtTime(.0001,t+.06);o.connect(g);g.connect(audio.destination);o.onended=()=>{o.disconnect();g.disconnect();};o.start(t);o.stop(t+.07);
}
function touch(e){
 e.preventDefault();const now=performance.now(),f=((now-epoch)%750+750)%750/750;
 count++;pressUntil=now+110;
 const box=area.getBoundingClientRect(),y=e.clientY??box.top+box.height/2,level=clamp(1-(y-box.top)/box.height,0,1),volume=document.querySelector('#volumeValue');volume.style.top=(1-level)*(volume.parentElement.clientHeight-6)+'px';soundAtTap(level);
 if(count<=4){document.querySelector('#tapSub').textContent=count+' / 4';document.querySelector('#prompt').textContent=count===4?'そのまま、音に合わせて':'あと'+(4-count)+'回';if(count===4){epoch=now+750;combo=0;}}
 else {const off=f>.5?f-1:f,d=Math.abs(off);feedback.textContent=d<=.07?'ぴったり':d<=.15?'いい感じ':off<0?'早い':'遅い';combo=d<=.15?combo+1:0;document.querySelector('#combo').textContent=combo>=2?combo+'連続':'';feedbackUntil=now+600;document.querySelector('#tapSub').textContent='';}
}
area.addEventListener('pointerdown',touch);tap.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat)touch(e);});
function frame(now){
 const b=still?3.34:(now-epoch)/750,i=Math.floor(b),f=b-i;
 const hit=i>=0&&f<.13;area.classList.toggle('on-beat',hit);tap.classList.toggle('pressed',now<pressUntil);
 document.querySelector('#orbit1').setAttribute('r',(78+42*(1-f)).toFixed(2));document.querySelector('#orbit2').setAttribute('r',(78+42*(2-f)).toFixed(2));
 document.querySelector('#runner1').setAttribute('x',String(calm?192:92+100*(1-f)));document.querySelector('#runner2').setAttribute('x',String(calm?292:92+100*(2-f)));
 if(i!==lastBeat){lastBeat=i;beatMarks.forEach((m,k)=>m.classList.toggle('on',k===((i%4)+4)%4));players.forEach((p,k)=>p.classList.toggle('active',i>=0&&(k+i)%7===0));}
 if(feedback.textContent&&now>feedbackUntil)feedback.textContent='';
 document.querySelector('#progress').style.width=count>4?Math.min(95,(b%80)/80*100)+'%':'0%';
 if(!calm&&!still)raf=requestAnimationFrame(frame);
}
function choose(concept){reset();body.dataset.concept=concept;document.querySelectorAll('[data-concept-pick]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.conceptPick===concept)));document.querySelector('#instruction').textContent=concept==='halo'?'光が重なる瞬間に、タップ。':'光がラインに届いたら、タップ。';}
document.querySelectorAll('[data-concept-pick]').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.conceptPick)));
document.querySelector('#theme').addEventListener('click',()=>body.dataset.theme=body.dataset.theme==='dark'?'light':'dark');
document.querySelector('#sound').addEventListener('click',e=>{sound=!sound;e.currentTarget.setAttribute('aria-pressed',String(sound));if(sound)soundAtTap();});
document.querySelector('#leave').addEventListener('click',()=>{location.href='gallery.html';});
document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(raf);if(!document.hidden)frame(performance.now());});
choose(body.dataset.concept);frame(performance.now());
if(calm&&!still)setInterval(()=>frame(performance.now()),100);
