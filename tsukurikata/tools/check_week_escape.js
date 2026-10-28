'use strict';
/* 今週のEscapeは説明を優先し、一度の入力で一つだけ閉じる。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ui=fs.readFileSync(path.join(__dirname,'../js/ui.js'),'utf8'),ctx=vm.createContext({assert,console});
vm.runInContext(`
let handler,calls=[],prevented=0;
const U={pick:null,outPick:new Set(),prepPanel:null},tip={hidden:true};
const $=s=>s==='#tip'?tip:{addEventListener(_,fn){handler=fn;}};
const closePracticePicker=()=>{calls.push('練習');U.pick=null;},cancelOutingSelection=()=>{calls.push('行事');U.outPick.clear();},togglePreparation=key=>{calls.push('準備:'+key);U.prepPanel=null;};
function fresh(kind){calls=[];prevented=0;tip.hidden=true;U.pick=kind==='練習'?'本人':null;U.outPick=new Set(kind==='行事'?['本人']:[]);U.prepPanel=kind==='準備'?'reading':null;}
function key(kind,opts={}){handler({key:'Escape',target:{closest:s=>(kind==='行事'&&s==='.outing')||(kind==='準備'&&s==='.preparation')},preventDefault(){prevented++;},...opts});}
`,ctx);
vm.runInContext(ui.slice(ui.indexOf("  $('#week').addEventListener('keydown'"),ui.indexOf("  $('#week').addEventListener('click'")),ctx);
vm.runInContext(`
let n=0;
for(const kind of ['練習','行事','準備']){
 fresh(kind);tip.hidden=false;key(kind);assert.deepEqual(calls,[]);assert.equal(prevented,0);n++;
 tip.hidden=true;key(kind);assert.deepEqual(calls,[kind==='準備'?'準備:reading':kind]);assert.equal(prevented,1);n++;
 for(const flags of [{repeat:true},{isComposing:true},{key:'Enter'}]){fresh(kind);key(kind,flags);assert.deepEqual(calls,[]);assert.equal(prevented,0);n++;}
}
// 行事や準備の外から押しても、離れた選択を消さない。
for(const kind of ['行事','準備']){fresh(kind);key('別の場所');assert.deepEqual(calls,[]);n++;}
// 長押しの続きが届いても、次に開いた準備欄を閉じない。
fresh('練習');U.prepPanel='reading';key('準備');key('準備',{repeat:true});assert.deepEqual(calls,['練習']);assert.equal(U.prepPanel,'reading');n++;
console.log('練習・行事・本番準備の'+n+'通り／説明を先に閉じる／長押し・文字の変換・他のキーは保持／対象外の場所を保持／一度の入力で一つだけ閉じる：確認済み');
`,ctx);
