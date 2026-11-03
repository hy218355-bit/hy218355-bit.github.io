// 数値・名前を含む表示と、言語を戻したときの原文を確かめる。
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const handlers={},storage=new Map([['suibu-language-v1','en']]);
const body={nodeType:1,closest:()=>false,hasAttribute:()=>false,isConnected:true};
class Canvas{};for(const key of ['fillText','strokeText','measureText'])Canvas.prototype[key]=function(text,...args){return {context:this,text,args};};
const ctx=vm.createContext({console,Map,Set,WeakMap,RegExp,String,Number,Object,Array,CustomEvent:class{constructor(type,detail){this.type=type;this.detail=detail;}},
 Node:{TEXT_NODE:3,ELEMENT_NODE:1},NodeFilter:{SHOW_ELEMENT:1,SHOW_TEXT:4},CanvasRenderingContext2D:Canvas,
 MutationObserver:class{observe(){}disconnect(){}},navigator:{language:'en'},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
 document:{readyState:'loading',body,documentElement:{lang:'ja'},createTreeWalker:()=>({nextNode:()=>null}),querySelectorAll:()=>[],addEventListener:(type,cb)=>handlers[type]=cb,dispatchEvent:()=>{}},
 requestAnimationFrame:()=>1,alert:x=>x,confirm:x=>x,prompt:x=>x});ctx.window=ctx;
for(const file of ['i18n-en.js','i18n-names.js','i18n.js'])vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../tsukurikata/js',file),'utf8'),ctx);
handlers.DOMContentLoaded();
const t=s=>ctx.SuibuLanguage.text(s);
ctx.SuibuLanguage.names(['佐藤 葵','佐藤 陽菜']);
const cases=[['今週','This week'],['2027年6月','June 2027'],['5月2週','May · Week 2'],['自由曲：「天国と地獄」','Free piece: Can-Can'],['音楽室・39人','Music room · 39 players'],['4/4人','4/4 players'],['夢：支部大会に出たい','Dream: Reach regionals'],['5人','5 players'],['葵の今週の練習を見る','View Ava\'s practice this week'],['次の本番「定期演奏会」まで3週','3 weeks until Annual concert'],['録音を書き出しています… 43%','Exporting audio… 43%'],['3年・フルート 1st','Year 3 · Flute 1st'],['佐藤 陽菜','Emma Smith'],['佐藤 陽菜の今週の練習を見る',"View Emma Smith's practice this week"]];
for(const [ja,en]of cases)assert.equal(t(ja),en,ja);
const cv=new Canvas(),measured=cv.measureText('指揮',7);assert.equal(measured.text,'Conduct');assert.equal(measured.context,cv);assert.deepEqual(measured.args,[7]);
ctx.SuibuLanguage.set('ja');for(const [ja]of cases)assert.equal(t(ja),ja);
assert.equal(storage.get('suibu-language-v1'),'ja');
console.log('数値・名前・書き出し・舞台の字・日本語への復帰: 成功');
ctx.SuibuLanguage.set('en');
const source=JSON.parse(fs.readFileSync(path.join(__dirname,'source-strings.json'),'utf8'));
const skipped=new Set([119,120,160,161,1025,1196,1298,1672,1673,1674,...Array.from({length:33},(_,i)=>1748+i)]);
const remaining=source.flatMap((text,id)=>{
 if(skipped.has(id))return [];
 const sample=text.replace(/\{\d+\}/g,'1'),translated=t(sample);
 return /[ぁ-んァ-ヶ一-龯]/.test(translated)?[{id,source:text,sample,translated}]:[];
});
fs.writeFileSync(path.join(__dirname,'remaining-source.json'),JSON.stringify(remaining,null,2)+'\n');
console.log('原稿の残り',remaining.length);

const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../app-store/fixture.json'),'utf8')).state;
const people=[...fixture.members,...fixture.recs.flatMap(r=>r.snap.members),...(fixture.gradMembers||[])];
const names=[...new Set(people.flatMap(m=>[m.name,...m.name.split(/[ 　]/)]))].sort((a,b)=>b.length-a.length);
ctx.SuibuLanguage.names(people);
const unchanged=JSON.stringify(people),band=fs.readFileSync(path.resolve(__dirname,'../../tsukurikata/js/band.js'),'utf8');
for(const [pool,key]of [['SURNAMES','family'],['GIVEN','given']]){
 const source=band.match(new RegExp("const "+pool+" = '([^']+)'")).at(1).split(' '),map=ctx.SUIBU_EN_NAMES[key];
 assert.deepEqual(Object.keys(map).sort(),source.sort(),pool+'の全候補に英語名がある');
 assert.equal(new Set(Object.values(map)).size,source.length,'英語名も重複させない');
}
for(const m of people)assert.match(t(m.name),/^[A-Za-z]+ [A-Za-z]+$/,m.name);
assert.equal(JSON.stringify(people),unchanged,'英語名を表示しても部員・録音のデータは同じ');
assert.equal(ctx.SuibuLanguage.name('佐藤 陽菜',true),'Emma');
ctx.SuibuLanguage.names([{name:'自分の名前',originalName:'佐藤 陽菜'},{name:'山田 葵',originalName:'佐藤 結衣'},{name:'My Player',originalName:'佐藤 凛'}]);
assert.equal(t('自分の名前'),'自分の名前');
assert.equal(t('山田 葵'),'山田 葵','自分で改名した名前は自動で変えない');
assert.equal(t('My Player'),'My Player');
assert.equal(t('佐藤 陽菜'),'Emma Smith','改名前の録音の名前は元の配役で表示');
ctx.SuibuLanguage.names(people);
const sampleLog=fixture.log.map(x=>x.text);
const remainingLog=sampleLog.flatMap(source=>{const translated=t(source);let check=translated;for(const name of names)check=check.split(name).join('');return /[ぁ-んァ-ヶ一-龯]/.test(check)?[{source,translated}]:[];});
fs.writeFileSync(path.join(__dirname,'remaining-log.json'),JSON.stringify(remainingLog,null,2)+'\n');
console.log('実際の日誌の残り',remainingLog.length,'/',sampleLog.length);
assert.equal(remainingLog.length,0,'既存の日誌も英語の配役名で読める');
for(const sample of ['今週の予定：合奏 39人','クラリネット 1st（2人目）','2027年度のアンサンブルコンテストに出て、銀賞をとった。'])assert.ok(!/[ぁ-んァ-ヶ一-龯]/.test(t(sample)),sample);
assert.equal(t('3年・パーカッション2（スネア・小物）'),'Year 3 · Percussion 2 · snare / small');
const nativeRemaining=[];
for(const file of fs.readdirSync(path.join(__dirname,'screenshots')).filter(f=>f.endsWith('.log'))){
 const log=fs.readFileSync(path.join(__dirname,'screenshots',file),'utf8'),line=log.split('\n').find(x=>x.includes('CAPTURE_READY '));if(!line)continue;
 const data=JSON.parse(line.split('CAPTURE_READY ')[1]);
 for(const item of data.untranslated){let source;try{source=JSON.parse(item).source;}catch{continue;}if(!source)continue;
  const translated=t(source);let check=translated;for(const name of names)check=check.split(name).join('');
  if(/[ぁ-んァ-ヶ一-龯]/.test(check))nativeRemaining.push({file,source,translated});
 }
}
fs.writeFileSync(path.join(__dirname,'remaining-native.json'),JSON.stringify(nativeRemaining,null,2)+'\n');
console.log('画面で見つかった原文の残り',nativeRemaining.length);

assert.ok(!/[ぁ-んァ-ヶ一-龯]/.test(t('前半（ト長調の主題）（譜読みE）')));
