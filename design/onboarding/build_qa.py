from pathlib import Path
import re
# 製品の画面と読み込み順をそろえ、確認専用の保存先で動かす。
root=Path(__file__).resolve().parents[2]
html=(root/'tsukurikata/index.html').read_text()
probe=(root/'design/boot-audit/probe.js').read_text()
html=html.replace('<head>','<head>\n<base href="/tsukurikata/">\n<script>'+probe+'</script>',1)
html=re.sub(r'(<script src="js/[^"?]+)(?:\?[^" ]*)?"',lambda m:m[1]+'?v=onboard-check-1"',html)
html=html.replace('</body>','<script src="/design/onboarding/qa.js?v=1"></script></body>')
(root/'design/onboarding/qa.html').write_text(html)
