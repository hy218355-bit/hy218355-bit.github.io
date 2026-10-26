'use strict';
/* 画面で使う小さな絵。色は文字色から受け継ぐ。音符の楽譜表記は置き換えない。 */
const UI_ICON_PATHS={
play:'<path d="m8 4 12 8-12 8Z"/>',
stop:'<rect x="5" y="5" width="14" height="14" rx="2"/>',
note:'<path d="M10 17V5l9-2v12M10 8l9-2"/><ellipse cx="7" cy="18" rx="3" ry="2"/><ellipse cx="16" cy="16" rx="3" ry="2"/>',
star:'<path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3-5.7-3-5.7 3 1.1-6.3-4.6-4.5 6.4-.9Z"/>',
download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
week:'<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v5m8-5v5M4 11h16M8 16h2"/>',
stage:'<path d="M4 20h16M6 15V8l6-4 6 4v7M9 15V9m6 6V9M3 5l3-2m15 2-3-2"/>',
members:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m2-15a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 4v2"/>',
journal:'<path d="M12 6C8 3 4 4 3 5v15c3-2 6-1 9 0 3-1 6-2 9 0V5c-1-1-5-2-9 1Zm0 0v14M6 9h3m6 0h3m-12 4h3m6 0h3"/>',
crest:'<path d="M4 3h16v16l-8 3-8-3ZM7 9h10M7 12h10M7 15h10M11 17V7l6-1v9"/><ellipse cx="9" cy="17" rx="2" ry="1.4"/><ellipse cx="15" cy="15" rx="2" ry="1.4"/>',
up:'<path d="m5 15 7-7 7 7"/>',
chevron:'<path d="m6 9 6 6 6-6"/>',
event:'<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v5m8-5v5M4 11h16m-10 5h4"/>',
award:'<circle cx="12" cy="9" r="6"/><path d="m8 14-2 8 6-3 6 3-2-8"/>',
};
function uiIcon(name,extra=''){
return `<svg class="ui-icon ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${UI_ICON_PATHS[name]||UI_ICON_PATHS.note}</svg>`;
}
/* 文字列に混ざっている操作記号だけをSVGにする。ラベルとゲームの処理は保持する。 */
function paintUiIcons(root=document.body){
if(!root||root.nodeType!==1||root.closest('svg,script,style,select,textarea,canvas'))return;
const symbols={'▶':'play','■':'stop','♪':'note','★':'star','⤓':'download'};
const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>/[▶■♪★⤓]/u.test(n.nodeValue)&&!n.parentElement.closest('svg,script,style,option,select,textarea,canvas')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT});
const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
for(const n of nodes){const frag=document.createDocumentFragment();for(const chunk of n.nodeValue.split(/([▶■♪★⤓])/u)){if(symbols[chunk]){const template=document.createElement('template');template.innerHTML=uiIcon(symbols[chunk]);frag.append(template.content);}else frag.append(document.createTextNode(chunk));}n.replaceWith(frag);}
}
for(const [tab,name] of Object.entries({week:'week',play:'stage',members:'members',log:'journal'})){const b=document.querySelector(`[data-tabgo="${tab}"]`);if(b)b.querySelector('svg').outerHTML=uiIcon(name);}
const banner=document.querySelector('.banner');if(banner)banner.insertAdjacentHTML('afterbegin',uiIcon('crest','brand-mark'));
paintUiIcons();
const iconObserver=new MutationObserver(records=>{const roots=new Set();for(const r of records){if(r.type==='characterData')roots.add(r.target.parentElement);else for(const n of r.addedNodes)roots.add(n.nodeType===1?n:n.parentElement);}for(const root of roots)if(root?.isConnected)paintUiIcons(root);});
iconObserver.observe(document.body,{childList:true,subtree:true,characterData:true});

