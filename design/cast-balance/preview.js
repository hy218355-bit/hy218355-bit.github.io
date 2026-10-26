'use strict';
/* 39人の原画のうち、整った顔を9人だけにする見本。ゲームには評価を付けない。 */
const params=new URLSearchParams(location.search),theme=document.querySelector('#theme');
document.documentElement.dataset.theme=params.get('theme')==='dark'?'dark':'light';
function label(){theme.textContent=document.documentElement.dataset.theme==='dark'?'ライトで見る':'ダークで見る';}
label();theme.addEventListener('click',()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';label();});
const render=faces=>faces.map(f=>`<div class="person" data-standout="${f.standout}">${Faces.preview(f.base,96)}<small>${String(f.base+1).padStart(2,'0')}</small></div>`).join('');
document.querySelector('#standouts').innerHTML=render(Faces.catalog.filter(f=>f.standout).sort((a,b)=>Number(a.style==='male')-Number(b.style==='male')));
document.querySelector('#classmates').innerHTML=render(Faces.catalog.filter(f=>!f.standout));
document.querySelector('#all').innerHTML=render(Faces.catalog);
document.querySelector('#small').addEventListener('change',e=>document.querySelector('#all').classList.toggle('small',e.target.checked));

if(params.get('capture')==='1')document.querySelector('#small-check').hidden=true;
