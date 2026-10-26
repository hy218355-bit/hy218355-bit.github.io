'use strict';
/* 製品と同じ顔の描画を、名前といっしょに確かめる。 */
const q=new URLSearchParams(location.search);
document.documentElement.dataset.theme=q.get('theme')==='dark'?'dark':'light';
const button=document.querySelector('#theme');
function label(){button.textContent=document.documentElement.dataset.theme==='dark'?'ライトで見る':'ダークで見る';}
label();button.addEventListener('click',()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';label();});
const members=[{id:'m2026-n5',name:'佐藤 悠真'},{id:'m2026-n1',name:'山田 陽菜'},{id:'m2026-n2',name:'高橋 結衣'},{id:'m2026-n3',name:'田中 美咲'},{id:'m2026-n4',name:'小林 莉子'}];
document.querySelector('#hero').innerHTML=members.map(m=>`<div class="person">${memberFace(m,112)}<b>${esc(m.name)}</b></div>`).join('');
document.querySelector('#catalog').innerHTML=Array.from({length:39},(_,i)=>`<div class="person">${Faces.preview(i,96)}<small>${String(i+1).padStart(2,'0')}</small></div>`).join('');
document.querySelector('#small').addEventListener('change',e=>document.querySelector('#catalog').classList.toggle('small',e.target.checked));
