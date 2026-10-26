'use strict';
/* 確認ページだけ、ゲームの前から読み込みと起動のエラーを記録する。 */
(() => {
  const state={started:new Date().toISOString(),loaded:[],failed:[],errors:[],ready:false};
  const source=el=>el?.tagName==='SCRIPT'&&el.src?new URL(el.src).pathname:null;
  document.addEventListener('load',e=>{const name=source(e.target);if(name)state.loaded.push(name);},true);
  window.addEventListener('error',e=>{
    const name=source(e.target);
    if(name)state.failed.push(name);
    else state.errors.push({message:e.message,file:e.filename,line:e.lineno});
  },true);
  window.addEventListener('unhandledrejection',e=>state.errors.push({message:String(e.reason?.stack||e.reason)}));
  const type=read=>{try{return read();}catch(e){return e.message;}};
  function write(){
    state.globals={fx:type(()=>typeof FX),season:type(()=>typeof SEASON_OF),engine:type(()=>typeof Engine),pieces:type(()=>typeof PIECES),game:type(()=>typeof freshState)};
    state.scripts=[...document.scripts].filter(s=>s.src).map(s=>new URL(s.src).pathname);
    state.resources=performance.getEntriesByType('resource').filter(r=>r.initiatorType==='script').map(r=>({file:new URL(r.name).pathname,status:r.responseStatus,bytes:r.decodedBodySize,ms:Math.round(r.duration)}));
    state.ready=true;
    let out=document.getElementById('bootResult');
    if(!out){out=document.createElement('output');out.id='bootResult';out.hidden=true;document.body.append(out);}
    out.textContent=JSON.stringify(state);out.dataset.ready='true';
    document.dispatchEvent(new Event('bootchecked'));
  }
  document.addEventListener('DOMContentLoaded',()=>{Promise.resolve(document.fonts?.ready).then(()=>setTimeout(write,100));},{once:true});
})();
