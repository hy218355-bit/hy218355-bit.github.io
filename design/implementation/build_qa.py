# 製品と同じ順で読み、起動前の取得記録も残す画面確認ページを作る。
import argparse
from pathlib import Path
import re

folder = Path(__file__).resolve().parent
root = folder.parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--version', default='qa-local')
args = parser.parse_args()
if not re.fullmatch(r'[a-zA-Z0-9-]+', args.version):
    parser.error('versionは英数字とハイフンで指定する')
html = (root / 'tsukurikata/index.html').read_text()
probe = (root / 'design/boot-audit/probe.js').read_text()
html = html.replace('<head>', '<head>\n<base href="/tsukurikata/">\n<script>\n' + probe + '\n</script>', 1)
html = re.sub(r'(<script src="js/[^"?]+)(?:\?[^" ]*)?"', lambda m: m[1] + '?v=' + args.version + '"', html)
html = html.replace('</body>', '<script src="/design/implementation/qa.js?v=' + args.version + '"></script>\n</body>')
(folder / 'qa.html').write_text(html)
