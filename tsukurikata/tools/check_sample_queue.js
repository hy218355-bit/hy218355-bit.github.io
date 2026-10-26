'use strict';
/* 遅い取得や音の展開を混ぜ、録音を一度に抱えず、失敗後も残りを読めることを確かめる。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),tick=()=>new Promise(setImmediate);
function harness(failure){
 const names=Array.from({length:41},(_,i)=>'bank'+i),requests={},decoded={},progress=[],payloads=new WeakMap();
 const bodies=new Map(),decodes=new Map();let active=0,peak=0,decodeActive=0,decodePeak=0;
 const gate=(map,name)=>new Promise(resolve=>{assert.ok(!map.has(name));map.set(name,resolve);});
 const release=(map,name)=>{const run=map.get(name);assert.ok(run,name+'の待ち合わせがある');map.delete(name);run();};
 const manifest=Object.fromEntries(names.map((name,i)=>[name,{kind:i%2?'stac':'sus',samples:[{o:.1,d:.3,pk:.1,m:60+i%12,c:i-20,l:0,lp:[.1,.25],lc:.8}]}]));
 class Decoder{
  decodeAudioData(ab,yes,no){
   const name=payloads.get(ab);decoded[name]=(decoded[name]||0)+1;
   decodeActive++;decodePeak=Math.max(decodePeak,decodeActive);
   const p=gate(decodes,name).then(()=>{
    if(failure==='decode'&&name==='bank0'&&decoded[name]===1)throw new Error('音の展開の確認用エラー');
    return {sampleRate:44100,getChannelData:()=>new Float32Array(22050).fill(.1)};
   }).finally(()=>{active--;decodeActive--;});
   p.then(yes,no);return p;
  }
 }
 const fetch=async url=>{
  const name=url.split('/').pop().replace('.mp3','');requests[name]=(requests[name]||0)+1;
  if(name==='manifest.json')return {ok:true,status:200,json:async()=>manifest};
  active++;peak=Math.max(peak,active);
  if(active>4){active--;throw new Error('同時に開きすぎた');}
  if(failure==='http'&&name==='bank0'&&requests[name]===1){active--;return {ok:false,status:503};}
  return {ok:true,status:200,arrayBuffer:async()=>{
   await gate(bodies,name);const ab=new ArrayBuffer(8);payloads.set(ab,name);return ab;
  }};
 };
 const ctx=vm.createContext({console,fetch,window:{OfflineAudioContext:Decoder},onProgress:v=>progress.push(v)});
 for(const file of ['util.js','instruments.js','samples.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',file),'utf8'),ctx,{filename:file});
 return {names,requests,decoded,progress,bodies,decodes,release,state:()=>vm.runInContext('SAMPLES',ctx),limits:()=>({active,peak,decodeActive,decodePeak}),load:retry=>vm.runInContext('loadSamples("snd/",onProgress,'+(retry?'{retry:true}':'{}')+')',ctx)};
}
async function drain(h,promise){
 let settled=false;const result=promise.then(()=>({ok:true}),error=>({ok:false,error})).then(r=>{settled=true;return r;});
 for(let i=0;i<100&&!settled;i++){
  for(const name of [...h.bodies.keys()])h.release(h.bodies,name);
  for(const name of [...h.decodes.keys()])h.release(h.decodes,name);
  await tick();
 }
 assert.ok(settled,'待っている処理を流せば、全員の読み込みが終わる');return result;
}
(async()=>{
 const h=harness(),first=h.load();first.catch(()=>{});
 assert.equal(h.load(),first);assert.equal(h.load(true),first);await tick();
 assert.equal(Object.keys(h.requests).filter(n=>n!=='manifest.json').length,4);
 h.release(h.bodies,'bank0');await tick();
 assert.ok(h.decodes.has('bank0'));assert.equal(Object.keys(h.requests).length,5,'音の展開が終わるまでは次の録音を始めない');
 h.release(h.decodes,'bank0');await tick();
 assert.equal(Object.keys(h.requests).length,6);assert.equal(h.state().progress,1/41);
 assert.ok((await drain(h,first)).ok);assert.equal(h.state().ready,true);assert.equal(h.state().progress,1);
 assert.ok(h.limits().peak<=4);assert.ok(h.limits().decodePeak<=4);assert.equal(h.limits().active,0);
 for(const name of h.names){assert.equal(h.requests[name],1);assert.equal(h.decoded[name],1);}
 assert.ok(h.progress.every((v,i)=>v>=0&&v<=1&&(!i||v>=h.progress[i-1])));
 for(const mode of ['http','decode']){
  const r=harness(mode),pending=r.load();pending.catch(()=>{});await tick();
  assert.equal(r.state().error,null,'途中の失敗ではまだ再試行を受け付けない');assert.equal(r.load(true),pending);
  const failed=await drain(r,pending);assert.equal(failed.ok,false);assert.ok(r.state().error);assert.equal(r.state().ready,false);
  assert.equal(Object.keys(r.state().banks).length,40);assert.equal(r.state().progress,40/41);
  assert.ok(r.names.every(n=>r.requests[n]===1),'最初に失敗しても後ろの録音まで読む');
  const kept={...r.state().banks},metadata=JSON.stringify(Object.fromEntries(Object.entries(kept).map(([n,b])=>[n,{kind:b.kind,samples:b.samples,layers:b.layers}])));
  const retry=r.load(true);assert.equal(r.load(true),retry);assert.ok((await drain(r,retry)).ok);
  assert.equal(r.state().ready,true);assert.equal(r.state().progress,1);assert.equal(r.state().error,null);
  assert.equal(r.requests['manifest.json'],1);assert.equal(r.requests.bank0,2);
  for(const [n,b] of Object.entries(kept)){assert.equal(r.state().banks[n],b);assert.equal(r.requests[n],1);}
  assert.equal(JSON.stringify(Object.fromEntries(Object.keys(kept).map(n=>{const b=r.state().banks[n];return [n,{kind:b.kind,samples:b.samples,layers:b.layers}];}))),metadata);
  assert.ok(r.limits().peak<=4);assert.ok(r.limits().decodePeak<=4);assert.equal(r.limits().active,0);
 }
 console.log('41個を4個までの負荷で読む／展開後に次を開始／失敗しても最後まで読む／再試行は残りだけ／録音と調律情報を保持／進み具合と二重実行：確認済み');
})().catch(e=>{console.error(e);process.exitCode=1;});
