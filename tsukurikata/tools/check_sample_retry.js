'use strict';
/* 音源の再読み込みで、読めた録音を捨てず、二重の処理や古いエラーを残さないことを確かめる。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
function harness(mode){
 const requests={},decodeCount={},progress=[],payloads=new WeakMap();let release;
 const gate=new Promise(r=>{release=r;});
 const manifest=Object.fromEntries(['good','bad','slow'].map(n=>[n,{kind:'sus',samples:[{o:0.1,d:0.3,pk:0.1,m:60,c:2,l:0,lp:[0.1,0.25],lc:0.8}]}]));
 class Decoder{
  decodeAudioData(ab,yes,no){
   const name=payloads.get(ab);decodeCount[name]=(decodeCount[name]||0)+1;
   const p=(mode==='decode'&&name==='bad'&&decodeCount[name]===1)?Promise.reject(new Error('録音を読めなかった')):Promise.resolve({sampleRate:44100,getChannelData:()=>new Float32Array(22050).fill(0.1)});
   p.then(yes,no);return p;
  }
 }
 const fetch=async url=>{
  const name=url.split('/').pop().replace('.mp3','');requests[name]=(requests[name]||0)+1;
  if(name==='manifest.json'){const fail=mode==='manifest'&&requests[name]===1;return {ok:mode==='local'?false:!fail,status:mode==='local'?0:fail?503:200,json:async()=>manifest};}
  if(mode==='http'&&name==='slow')await gate;
  const fail=name==='bad'&&(mode==='repeat'||mode==='http'&&requests[name]===1);
  return {ok:mode==='local'?false:!fail,status:mode==='local'?0:fail?503:200,arrayBuffer:async()=>{const ab=new ArrayBuffer(8);payloads.set(ab,name);return ab;}};
 };
 const ctx=vm.createContext({console,fetch,window:{OfflineAudioContext:Decoder},onProgress:v=>progress.push(v)});
 for(const file of ['util.js','instruments.js','samples.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',file),'utf8'),ctx,{filename:file});
 return {requests,decodeCount,progress,release,state:()=>vm.runInContext('SAMPLES',ctx),load:retry=>vm.runInContext('loadSamples("snd/",onProgress,'+(retry?'{retry:true}':'{}')+')',ctx)};
}
(async()=>{
 const h=harness('http'),first=h.load();let ended=false;first.catch(()=>{ended=true;});
 assert.equal(h.load(),first);assert.equal(h.load(true),first);
 await new Promise(setImmediate);assert.equal(ended,false,'ほかの録音が読み込み中なら、まだ前の処理を終えない');
 h.release();await assert.rejects(first,/bad: HTTP 503/);
 const failed=h.state(),good=failed.banks.good,slow=failed.banks.slow;
 assert.equal(failed.ready,false);assert.equal(Object.keys(failed.banks).length,2);assert.ok(failed.error);
 const retry=h.load(true);assert.equal(h.load(true),retry);assert.equal(h.state().error,null);await retry;
 assert.equal(h.state().ready,true);assert.equal(h.state().error,null);assert.equal(h.state().progress,1);
 assert.equal(h.state().banks.good,good);assert.equal(h.state().banks.slow,slow);
 assert.equal(h.requests.good,1);assert.equal(h.requests.slow,1);assert.equal(h.requests.bad,2);assert.equal(h.requests['manifest.json'],1);
 assert.equal(h.decodeCount.bad,1,'HTTPで読めなかった内容は音として開かない');
 assert.equal(h.state().banks.good.samples[0].c,2);assert.equal(h.state().banks.good.samples[0].m,60);assert.ok(h.state().banks.good.samples[0].lead>=0);
 assert.equal(h.load(true),retry);assert.ok(h.progress.every(v=>v>=0&&v<=1));
 const d=harness('decode');await assert.rejects(d.load(),/録音を読めなかった/);const kept=d.state().banks.good;await d.load(true);assert.equal(d.state().ready,true);assert.equal(d.state().banks.good,kept);assert.equal(d.decodeCount.bad,2);
 const m=harness('manifest');await assert.rejects(m.load(),/HTTP 503/);assert.equal(m.state().manifest,null);await m.load(true);assert.equal(m.requests['manifest.json'],2);assert.equal(m.state().ready,true);
 const local=harness('local');await local.load();assert.equal(local.state().ready,true,'HTTPの状態がないアプリ内のURLでも中身を読めれば使える');
 const r=harness('repeat');await assert.rejects(r.load(),/HTTP 503/);await assert.rejects(r.load(true),/HTTP 503/);assert.equal(r.state().ready,false);assert.ok(r.state().error);assert.equal(r.requests.good,1);assert.equal(r.requests.bad,2);
 const uiCtx=vm.createContext({console,assert});
 vm.runInContext(`
 let click,stops=0,loads=0,locked=false;
 const SAMPLES={error:new Error('確認用')},CD={phase:'idle'},busy=()=>locked;
 const $=()=>({addEventListener:(event,fn)=>{click=fn;},focus(){}}),stopPlay=()=>{stops++;},renderSnd=()=>{};
 const loadSamples=(base,progress,options)=>{assert.equal(base,'snd/');assert.equal(options.retry,true);loads++;return Promise.resolve();};
 `,uiCtx);
 const ui=fs.readFileSync(path.join(root,'js/ui.js'),'utf8');
 vm.runInContext(ui.slice(ui.indexOf("  $('#sndStatus').addEventListener('click'"),ui.indexOf("  $('#venueSel').addEventListener('change'")),uiCtx);
 vm.runInContext(`
 const event={target:{closest:()=>true}};
 locked=true;click(event);assert.equal(stops,0);
 locked=false;CD.phase='watch';click(event);assert.equal(stops,0);
 CD.phase='conduct';click(event);assert.equal(stops,0);
 CD.phase='idle';click(event);assert.equal(stops,1);assert.equal(loads,1);
 `,uiCtx);
 console.log('HTTP・音の展開・目録のエラーから再試行／読めた録音と調律情報の保持／残りの読み込みとの競合なし／二重実行なし／再び読めない場合も再試行可：確認済み');
})().catch(e=>{console.error(e);process.exitCode=1;});
