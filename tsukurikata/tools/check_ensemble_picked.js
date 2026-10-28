'use strict';
/* 選択の顔は出場候補と同じ本人を並べ、部と選択を変えない。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),pieces=[...html.matchAll(/src="js\/(pieces\/[^"?]+)\.js/g)].map(m=>m[1]),ctx=vm.createContext({assert,console});
for(const f of ['util','instruments','venues','scores',...pieces,'band','game'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f+'.js'});
const ui=fs.readFileSync(path.join(root,'js/ui.js'),'utf8');
vm.runInContext(`
let S,exists=true;
const U={ensPick:new Set()},row={attrs:{},innerHTML:'',setAttribute(k,v){this.attrs[k]=v;}};
const $=()=>exists?row:null,memberFace=(m,n)=>'<i data-face="'+m.id+'" data-size="'+n+'"></i>';
`,ctx);
vm.runInContext(ui.slice(ui.indexOf('function renderEnsemblePicked(){'),ui.indexOf('// 選択で一覧を作り直さず')),ctx);
vm.runInContext(`
S=freshState(2028);S.members=fullBand({pitch:68,rhythm:72,tone:64,expr:61});S.winter={step:1,plan:'kiso'};
const before=JSON.stringify(S);
for(let n=0;n<=ENS_MAX;n++){
 U.ensPick=new Set(S.members.slice(0,n).map(m=>m.id));const pick=[...U.ensPick];renderEnsemblePicked();
 const faces=[...row.innerHTML.matchAll(/data-face="([^"]+)"/g)].map(m=>m[1]),slots=[...row.innerHTML.matchAll(/class="ens-picked-slot/g)].length;
 assert.deepEqual(faces,pick);assert.equal(slots,ENS_MAX);assert.equal([...row.innerHTML.matchAll(/ens-picked-slot empty/g)].length,ENS_MAX-n);
 assert.ok(row.attrs['aria-label'].startsWith('選んだ'+n+'人'));for(const m of S.members.slice(0,n))assert.ok(row.attrs['aria-label'].includes(m.name));
 assert.deepEqual([...U.ensPick],pick);assert.equal(JSON.stringify(S),before);
}
// 外すと顔も消える。入力された順ではなく、いつもの候補と同じ順で並べる。
U.ensPick=new Set([S.members[3].id,S.members[0].id]);renderEnsemblePicked();assert.deepEqual([...row.innerHTML.matchAll(/data-face="([^"]+)"/g)].map(m=>m[1]),[S.members[0].id,S.members[3].id]);U.ensPick.delete(S.members[0].id);renderEnsemblePicked();assert.ok(!row.innerHTML.includes('data-face="'+S.members[0].id+'"'));
// 席のない人や存在しない人を、顔の一覧へ混ぜない。
S.members[3].seat=null;U.ensPick.add('不在');const selection=[...U.ensPick];renderEnsemblePicked();assert.ok(!row.innerHTML.includes('data-face'));assert.deepEqual([...U.ensPick],selection);
exists=false;renderEnsemblePicked();
console.log('0〜8人／選択した本人と候補の順序／外した顔を消す／8枠を保持／読み上げの人数と名前／控えと不在を除外／部と選択を変えない／一覧がない画面：確認済み');
`,ctx);
