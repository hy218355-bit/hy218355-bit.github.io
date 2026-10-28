'use strict';
/* ネイティブの完了通知まで待ち、録音とセーブを重ねて渡さない。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const conduct=fs.readFileSync(path.join(__dirname,'../js/conduct.js'),'utf8');
const ctx=vm.createContext({assert,console,setTimeout,Uint8Array,ArrayBuffer,btoa:s=>Buffer.from(s,'binary').toString('base64'),tick:()=>new Promise(setImmediate),decodeParts:parts=>new Uint8Array(Buffer.concat(parts.map(s=>Buffer.from(s,'base64'))))});
vm.runInContext(`
const U={pos:'center'},SAMPLES={loading:null},VIR={loading:null},VENUE={hall:{name:'県民文化会館'}};
const sent=[],toasts=[],renders=[],window={TSUKURIKATA_NATIVE:true,webkit:{messageHandlers:{native:{postMessage:m=>sent.push(m)}}}};
const $=()=>({textContent:'県立みなと高校 吹奏楽部 2028年度'}),toast=(...a)=>toasts.push(a),renderRecordingLibrary=()=>{},renderConductResultPlayback=()=>{};
const recPerf=r=>r,renderPerf=async(r,options)=>{renders.push({r,options});return r;},encodeWav=()=>new Uint8Array([1,2,3]).buffer;
const rec={id:'r1',year:2028,label:'2028年 定期演奏会',venue:'hall'},meta={title:'確認',artist:'みなと',album:'2028年度'};
`,ctx);
vm.runInContext(conduct.slice(conduct.indexOf('const recFileName ='),conduct.indexOf('// 画面下の小さな知らせ')),ctx);
(async()=>{
await vm.runInContext(`(async()=>{
 let settled=false;
 const bytes=new Uint8Array(393216*7+13);for(let i=0;i<bytes.length;i++)bytes[i]=i%251;
 const first=deliverFile(bytes.buffer,'録音.wav',meta).then(ok=>{settled=true;return ok;});
 while(sent.length<8)await new Promise(r=>setTimeout(r,0));
 const id=sent[0].id;assert.equal(U.nativeFile.id,id);assert.equal(settled,false);assert.equal(sent.length,8);
 assert.ok(sent.every((m,i)=>m.id===id&&m.i===i&&m.n===8&&m.name==='録音.wav'&&m.title===meta.title));
 assert.deepEqual(decodeParts(sent.map(m=>m.data)),bytes);
 assert.equal(await deliverFile(bytes,'セーブ.txt',meta),false);assert.equal(sent.length,8);
 window.onNativeFileDone(true,'古いファイル');await tick();assert.equal(settled,false);assert.equal(U.nativeFile.id,id);
 window.onNativeFileDone(true,id);assert.equal(await first,true);assert.equal(U.nativeFile,null);
 // 完了したファイルの遅い通知では、次の待機を解除しない。
 const next=deliverFile(new Uint8Array([3]),'次.txt',meta);const nextId=U.nativeFile.id;assert.notEqual(nextId,id);
 window.onNativeFileDone(true,id);assert.equal(U.nativeFile.id,nextId);
 window.onNativeFileDone(false,nextId);assert.equal(await next,false);assert.equal(U.nativeFile,null);
 // 橋への送信が失敗しても待機を残さない。
 window.webkit.messageHandlers.native.postMessage=()=>{throw Error('送信失敗');};
 assert.equal(await deliverFile(new Uint8Array([3]),'失敗.wav',meta),false);assert.equal(U.nativeFile,null);
 window.webkit.messageHandlers.native.postMessage=m=>sent.push(m);
 // 録音を作り直さず、共有シートの完了まで保存中を保つ。
 const before=JSON.stringify(rec),saving=saveRecording(rec);await tick();assert.equal(U.saving,true);assert.equal(U.savingRecording,rec.id);assert.equal(renders.length,1);
 const savingId=U.nativeFile.id;await saveRecording(rec);assert.equal(renders.length,1);
 window.onNativeFileDone(true,savingId);await saving;assert.equal(U.saving,false);assert.equal(U.savingRecording,null);assert.equal(JSON.stringify(rec),before);
 const retry=saveRecording(rec,{id:'m1',name:'田中 葵'});await tick();assert.equal(renders.length,2);assert.equal(renders[1].options.solo.id,'m1');
 window.onNativeFileDone(false,U.nativeFile.id);await retry;assert.equal(U.saving,false);assert.equal(U.nativeFile,null);assert.ok(toasts.at(-1)[0].includes('書き出せませんでした'));
 // 途中で失敗が返ったら、残りのかたまりを送らない。
 let chunks=0;window.webkit.messageHandlers.native.postMessage=m=>{chunks++;window.onNativeFileDone(false,m.id);};
 assert.equal(await deliverFile(bytes,'途中.wav',meta),false);assert.equal(chunks,1);assert.equal(U.nativeFile,null);
})()`,ctx);
console.log('完了まで待機／8分割の順序・同じID／二重保存を拒否／古い通知を無視／成功・失敗・橋の例外から復帰／録音の作成1回と保存中表示／本人の書き出し／途中の失敗で送信終了／録音の不変：確認済み');
})().catch(e=>{console.error(e);process.exitCode=1;});
