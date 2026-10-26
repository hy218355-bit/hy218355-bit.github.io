# 現在の製品と同じ読み込み順で、保存や音源取得をしない起動確認ページを作る。
from pathlib import Path
import re

folder = Path(__file__).resolve().parent
root = folder.parent.parent
html = (root / 'tsukurikata/index.html').read_text()
probe = (folder / 'probe.js').read_text()
fixture = (folder / 'fixture.js').read_text()
html = html.replace('<head>', '<head>\n<base href="/tsukurikata/">\n<script>\n' + probe + '\n</script>', 1)
html = re.sub(r'(<script src="js/[^"?]+)(?:\?[^" ]*)?"', r'\1?v=boot-audit-1"', html)
html = html.replace('</body>', '<script>\n' + fixture + '\n</script>\n</body>')
(folder / 'probe.html').write_text(html)
