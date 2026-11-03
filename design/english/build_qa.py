# 実際のセーブを使わず、製品と同じ画面をブラウザで確認する。
from pathlib import Path
import json
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
html=(ROOT/'tsukurikata/index.html').read_text()
probe=(HERE.parent/'boot-audit/probe.js').read_text()
isolate="const qaMemory=new Map([['suibu-language-v1','en']]);Object.defineProperty(window,'localStorage',{value:{getItem:k=>qaMemory.get(k)??null,setItem:(k,v)=>qaMemory.set(k,String(v)),removeItem:k=>qaMemory.delete(k),clear:()=>qaMemory.clear()}});"
html=html.replace('<head>','<head><base href="/tsukurikata/"><script>'+isolate+probe+'</script>',1)
fixture=json.loads((HERE.parent/'app-store/fixture.json').read_text())
qa="""load=()=>JSON.parse(JSON.stringify(FIXTURE.state));loadUI=()=>{U.sfx=false;U.fxMode='off';};
document.addEventListener('DOMContentLoaded',()=>{document.documentElement.dataset.theme=new URLSearchParams(location.search).get('theme')||'light';U.sfx=false;U.fxMode='off';U.onboarding={club:onboardingClub(S),active:false,heard:true};renderAll();setTab('play');});
""".replace('FIXTURE',json.dumps(fixture,ensure_ascii=False))
(HERE/'qa.html').write_text(html.replace('</body>','<script>'+qa+'</script></body>'))
