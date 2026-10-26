'use strict';
/* 同じ描画を使い、顔候補とセーブごとの出会いを見比べる。 */
const q=new URLSearchParams(location.search);
document.documentElement.dataset.theme=q.get('theme')==='dark'?'dark':'light';
const theme=document.querySelector('#theme');
function label(){theme.textContent=document.documentElement.dataset.theme==='dark'?'ライトで見る':'ダークで見る';}
label();theme.addEventListener('click',()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';label();});
document.querySelector('#all').innerHTML=Faces.catalog.map(f=>`<div class="person">${Faces.preview(f.base,94)}<small>${String(f.base+1).padStart(3,'0')}</small></div>`).join('');
function sample(seed){const s={year:2026,week:0,seq:0,members:[],rep:60,recruitSeed:seed};const ms=makeRecruits(s,39);document.querySelector('#sample').innerHTML=ms.map(m=>`<div class="person" title="${esc(m.name)}">${Faces.image(m,56)}<small>${esc(m.name.split(' ').pop())}</small></div>`).join('');document.querySelector('#sample').dataset.unique=new Set(ms.map(m=>Faces.fingerprint(m))).size;document.querySelectorAll('[data-seed]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.seed)===seed)));}
sample(12345);document.querySelectorAll('[data-seed]').forEach(b=>b.addEventListener('click',()=>sample(Number(b.dataset.seed))));document.querySelector('#small').addEventListener('click',()=>{document.querySelector('#all').classList.toggle('small');document.querySelector('#small').textContent=document.querySelector('#all').classList.contains('small')?'大きく見る':'32pxで見る';});
