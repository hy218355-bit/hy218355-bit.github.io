'use strict';
/* 起動の確認だけ行い、本物のセーブは使わず、大きな音源も読み込まない。 */
if(typeof save==='function')save=()=>{};
if(typeof load==='function')load=()=>null;
if(typeof saveUI==='function')saveUI=()=>{};
if(typeof loadUI==='function')loadUI=()=>{};
if(typeof U!=='undefined'){U.sfx=false;U.fxMode='off';}
if(typeof SAMPLES!=='undefined'){
  SAMPLES.ready=true;SAMPLES.loading=Promise.resolve();
  loadSamples=()=>SAMPLES.loading;
}
if(typeof loadVenueIRs==='function')loadVenueIRs=()=>Promise.resolve();
