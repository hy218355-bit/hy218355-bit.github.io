'use strict';
/* 発表の操作先と裏画面の状態を保ち、長押しや遅い描画で結果を閉じすぎないことを確かめる。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({assert,console,clearTimeout(){}});
vm.runInContext(`
const frames=[],requestAnimationFrame=fn=>frames.push(fn);
const nodes={};let document;
const node=(id,parent=null)=>nodes[id]={id,parent,hidden:false,inert:false,disabled:false,isConnected:true,style:{},
 closest(selector){if(selector==='button')return this===skip||this===done?this:null;for(let n=this;n;n=n.parent)if(n.hidden||n.inert)return n;return null;},
 matches(){return this.disabled;},getClientRects(){return this.closest()?[]:[{}];},
 focus(){document.activeElement=this;},querySelectorAll(){return [body,skip,done];}};
const app=node('app'),tabbar=node('tabbar'),mini=node('mini'),toast=node('toast'),conduct=node('conduct'),grad=node('gradRoll'),tune=node('tuneGame'),fx=node('fx');
const roots=[app,tabbar,mini,toast,conduct,grad,tune,fx];
const dialog=node('announce'),body=node('an-body',dialog),skip=node('anSkip',dialog),done=node('anDone',dialog),old=node('old',app),next=node('next',app);
dialog.contains=el=>!!el&&(el===dialog||el.parent===dialog);
document={body:node('BODY'),documentElement:{classList:{remove(){}}},activeElement:old,getElementById:id=>nodes[id],querySelectorAll:selector=>selector.startsWith('.app')?roots:[next]};
const $=id=>nodes[id.replace('#','')],getComputedStyle=()=>({visibility:'visible'});let tips=0;
const hideTip=()=>tips++;
const event=(key,extra={})=>({key,target:document.activeElement,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra});
`,ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/announce.js'),'utf8'),ctx);
vm.runInContext(`
function fresh(){
 frames.length=0;AN.focusBlocks=null;AN.returnTo=null;AN.onDone=null;AN.token={};
 for(const el of roots){el.inert=false;el.hidden=['conduct','gradRoll','tuneGame','fx'].includes(el.id);}
 fx.inert=true;dialog.hidden=false;skip.hidden=false;done.hidden=true;document.activeElement=old;
}
fresh();anDialogFocus();assert.equal(document.activeElement,skip);assert.ok(roots.every(el=>el.inert));assert.equal(tips,1);
let skips=0,closed=0;AN.skip=()=>{skips++;anReady();};AN.onDone=()=>closed++;
for(const e of [event('Escape',{repeat:true}),event('Escape',{isComposing:true})]){anDialogKey(e);assert.ok(e.prevented&&e.stopped);}
assert.equal(skips,0,'繰り返しと変換中のEscapeでは発表を変えない');
anDialogKey(event('Escape'));assert.equal(skips,1);assert.equal(document.activeElement,done);assert.ok(!dialog.hidden);
for(const key of ['Escape','Enter',' ']){const e=event(key,{repeat:true});anDialogKey(e);assert.ok(e.prevented&&e.stopped);assert.ok(!dialog.hidden);}
assert.equal(closed,0,'同じキーの長押しで結果まで閉じない');
body.focus();const scrollKey=event(' ',{repeat:true});anDialogKey(scrollKey);assert.ok(!scrollKey.prevented,'一覧を読むSpaceの繰り返しは妨げない');done.focus();
anDialogKey(event('Tab'));assert.equal(document.activeElement,body);
anDialogKey(event('Tab',{shiftKey:true}));assert.equal(document.activeElement,done);
anDialogKey(event('Escape'));assert.ok(dialog.hidden);assert.equal(closed,1);assert.equal(fx.inert,true);assert.ok(roots.filter(el=>el!==fx).every(el=>!el.inert));
frames.splice(0).forEach(fn=>fn());assert.equal(document.activeElement,old);
closeAnnounce();assert.equal(closed,1,'閉じた後は同じ処理を二度呼ばない');
// 閉じる処理が別の操作先を決めた場合、その決定を優先する。
fresh();anDialogFocus();AN.onDone=()=>next.focus();closeAnnounce();frames.splice(0).forEach(fn=>fn());assert.equal(document.activeElement,next);
// 古い画面へ戻る予約より先に発表を開き直しても、新しい操作先を奪わない。
fresh();anDialogFocus();closeAnnounce();dialog.hidden=false;skip.hidden=false;anDialogFocus();frames.splice(0).forEach(fn=>fn());assert.equal(document.activeElement,skip);assert.ok(app.inert);
// 元の操作が消えている本番のあとでは、結果の次へ進む操作へ戻す。
old.isConnected=false;closeAnnounce();frames.splice(0).forEach(fn=>fn());assert.equal(document.activeElement,next);
console.log('発表内のTab循環／長押しと変換中の入力／閉じる処理の一回実行／元の操作とinertの復元／開き直しと次の画面の操作先：確認済み');
`,ctx);
