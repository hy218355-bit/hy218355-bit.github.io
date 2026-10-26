'use strict';
/* 顔の絵柄を確認する専用ページ。ゲームの名前・状態・セーブには接続しない。 */
(async()=>{
const params=new URLSearchParams(location.search),filter=params.get('sheet')||'all';
let theme=params.get('theme')==='dark'?'dark':'light',selected=0;
document.documentElement.dataset.theme=theme;
const themeButton=document.querySelector('#theme');
function themeLabel(){themeButton.textContent=theme==='dark'?'ライトで見る':'ダークで見る';}
themeLabel();
themeButton.addEventListener('click',()=>{theme=theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;themeLabel();});
const data=await(await fetch('cast.json')).json(),grid=document.querySelector('#cast');
const sheets=new Map(data.sheets.map(s=>[s.id,s]));
function style(m){const s=sheets.get(m.sheet),x=m.index%s.cols,y=Math.floor(m.index/s.cols);return `--sprite:url("${s.src}");--scale-x:${s.cols*100}%;--scale-y:${s.rows*100}%;--x:${x*100/(s.cols-1)}%;--y:${y*100/(s.rows-1)}%`;}
const visible=data.members.filter(m=>filter==='all'||String(m.sheet)===filter);
if(filter!=='all'){grid.classList.add('filtered');grid.style.setProperty('--cols',String(sheets.get(Number(filter))?.cols||4));}
document.querySelectorAll('[data-filter]').forEach(a=>a.setAttribute('aria-current',a.dataset.filter===filter?'page':'false'));
grid.innerHTML=visible.map(m=>`<button class="person" data-id="${m.id}" aria-label="顔の見本${m.id.slice(-2)}を拡大"><span class="portrait" style='${style(m)}' aria-hidden="true"></span><span class="number">${m.id.slice(-2)}</span></button>`).join('');
document.querySelector('#small').addEventListener('change',e=>grid.classList.toggle('small',e.target.checked));
const dialog=document.querySelector('#portrait-dialog'),portrait=dialog.querySelector('.portrait');
function show(index){selected=(index+visible.length)%visible.length;const m=visible[selected];document.querySelector('#portrait-title').textContent='顔の見本 '+m.id.slice(-2);portrait.style.cssText=style(m);portrait.setAttribute('aria-label','顔の見本'+m.id.slice(-2));}
grid.addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(!b)return;show(visible.findIndex(m=>m.id===b.dataset.id));dialog.showModal();});
document.querySelector('#close').addEventListener('click',()=>dialog.close());
document.querySelector('#prev').addEventListener('click',()=>show(selected-1));
document.querySelector('#next').addEventListener('click',()=>show(selected+1));
})();

