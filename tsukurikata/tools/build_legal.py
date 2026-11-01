#!/usr/bin/env python3
"""案内の原稿から、アプリ内の表示と公開用ページを同じ内容で作る。通信や取得はしない。"""
import argparse
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GAME = ROOT / 'tsukurikata'
START = '<!-- アプリの案内：build_legal.py で生成 -->'
END = '<!-- アプリの案内ここまで -->'
CSS_START = '/* アプリの案内の表示ここから */'
CSS_END = '/* アプリの案内の表示ここまで */'

LEGAL_CSS = '''.legal-info{font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic",system-ui,sans-serif;color:var(--ink);font-size:14px;line-height:1.85;overflow-wrap:anywhere}
.legal-info summary{display:flex;align-items:center;min-height:48px;cursor:pointer;font-size:14px;font-weight:600;gap:10px;list-style:none}
.legal-info summary::-webkit-details-marker{display:none}
.legal-info summary::before{content:"+";color:var(--brass);font-size:20px;flex:none;width:16px;text-align:center}
.legal-info details[open]>summary::before,.legal-info[open]>summary::before{content:"−"}
.legal-info .legal-document{border-top:1px solid var(--rule)}
.legal-info .legal-body{padding:0 4px 20px}
.legal-info h3{font-size:15px;line-height:1.6;margin:22px 0 6px;color:var(--ink)}
.legal-info p{margin:8px 0}
.legal-info .legal-meta{color:var(--ink-soft);font-size:12px}
.legal-info a{color:var(--brass);text-decoration:underline;text-underline-offset:3px;overflow-wrap:anywhere}
.legal-info a:focus-visible,.legal-info summary:focus-visible{outline:2px solid var(--brass);outline-offset:3px;border-radius:4px}
.legal-info pre{font-family:ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.7}
.legal-info a[href^="mailto:"]{display:inline-flex;align-items:center;min-height:48px;max-width:100%}
.legal-info .legal-license{border-top:1px solid var(--rule);margin-top:12px}
'''

def body(doc, updated):
    parts = [f'<p class="legal-meta">更新日：{html.escape(updated)} · 運営者：Yu Studio</p>', f'<p>{html.escape(doc["lead"])}</p>']
    for title, text in doc['sections']:
        parts.append(f'<section><h3>{html.escape(title)}</h3><p>{text}</p></section>')
    if doc['id'] == 'credits':
        for file in sorted((GAME / 'fonts').glob('OFL-*.txt')):
            license_text = '\n'.join(line.rstrip() for line in file.read_text().splitlines())
            parts.append(f'<details class="legal-license"><summary>{html.escape(file.name)}</summary><pre lang="en">{html.escape(license_text)}</pre></details>')
    return '\n'.join(parts)

def generate():
    data = json.loads((GAME / 'legal/documents.json').read_text())
    docs = data['documents']
    app = GAME / 'index.html'
    index = app.read_text()
    project = (ROOT / 'tsukurikata-ios/Tsukurikata.xcodeproj/project.pbxproj').read_text()
    version = re.search(r'MARKETING_VERSION = ([^;]+);', project)[1].strip('"')
    contents = [START, '<details class="foot legal-info" id="appInfo" data-tab="log"><summary>このアプリについて</summary>', f'<p class="legal-meta">吹奏楽部のつくりかた · バージョン {html.escape(version)} · © Yu Studio</p>']
    for doc in docs:
        contents.append(f'<details class="legal-document" id="legal-{doc["id"]}"><summary>{doc["title"]}</summary><div class="legal-body">{body(doc, data["updated"])}</div></details>')
    contents += ['</details>', END]
    block = '\n'.join(contents)
    if START in index:
        index = re.sub(re.escape(START) + r'.*?' + re.escape(END) + r'\n?', '', index, flags=re.S)
    else:
        pattern = r'  <details class="foot" data-tab="log"><summary>この作品について.*?</details>'
        index, n = re.subn(pattern, '', index, count=1, flags=re.S)
        if n != 1:
            raise ValueError('アプリの案内を置く場所が見つかりません')
    # 長い日誌の末尾までスクロールせずに開ける場所へ置く。
    anchor = '      <section class="panel" data-tab="log" aria-labelledby="h-log">'
    if index.count(anchor) != 1:
        raise ValueError('日誌の入口が見つかりません')
    index = index.replace(anchor, block + '\n' + anchor, 1)
    style = CSS_START + '\n' + LEGAL_CSS + CSS_END
    if CSS_START in index:
        index = re.sub(re.escape(CSS_START) + r'.*?' + re.escape(CSS_END), lambda _: style, index, flags=re.S)
    else:
        index = index.replace('</style>', style + '\n</style>', 1)
    out = {app: index}
    light = re.search(r':root\{(.*?)\}', index, re.S)[1]
    dark = re.search(r':root\[data-theme="dark"\]\{(.*?)\}', index, re.S)[1]
    names = ['paper', 'sheet', 'ink', 'ink-soft', 'rule', 'brass']
    palette = lambda src: ''.join(f'--{n}:{re.search(r"--"+n+r":([^;]+);", src)[1]};' for n in names)
    page_css = f':root{{{palette(light)}color-scheme:light}}@media(prefers-color-scheme:dark){{:root{{{palette(dark)}color-scheme:dark}}}}' + '''
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);padding:24px 16px 64px}main{max-width:680px;margin:auto}header{padding:12px 0 24px}header img{width:60px;height:60px;border-radius:15px}h1{font-size:26px;line-height:1.45;margin:16px 0}article{background:var(--sheet);border:1px solid var(--rule);border-radius:16px;padding:4px 20px 24px}nav{display:flex;flex-wrap:wrap;gap:4px 16px;margin-top:24px}nav a{display:inline-flex;align-items:center;min-height:48px}footer{margin-top:20px}.legal-info h2{font-size:17px;margin-top:24px}
''' + LEGAL_CSS
    out[GAME / 'legal/style.css'] = page_css
    for doc in docs:
        canonical = f'https://hy218355-bit.github.io/tsukurikata-{doc["id"]}/'
        for target, prefix, css in [(GAME / f'legal/{doc["id"]}.html', '..', 'style.css'), (ROOT / f'tsukurikata-{doc["id"]}/index.html', '../tsukurikata', '../tsukurikata/legal/style.css')]:
            public = target.parent.name.startswith('tsukurikata-')
            nav = ''.join(f'<a href="{("../tsukurikata-" + d["id"] + "/") if public else (d["id"] + ".html")}"'+ (' aria-current="page"' if doc == d else '') + f'>{d["title"]}</a>' for d in docs)
            out[target] = f'''<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="light dark"><title>{doc['title']}｜吹奏楽部のつくりかた</title><meta name="description" content="{html.escape(doc['lead'], quote=True)}"><link rel="canonical" href="{canonical}"><link rel="icon" href="{prefix}/icon-64.png"><link rel="stylesheet" href="{css}"></head>
<body class="legal-info"><main><header><img src="{prefix}/icon-180.png" alt="" width="60" height="60"><p class="legal-meta">吹奏楽部のつくりかた · Yu Studio</p><h1>{doc['title']}</h1></header><article>{body(doc, data['updated'])}</article><footer><nav aria-label="アプリの案内">{nav}</nav><p class="legal-meta">© Yu Studio · メール・外部サイトの利用には通信が必要です。</p></footer></main></body></html>
'''
    return out

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='生成結果に差がないか確かめる')
    args = parser.parse_args()
    wrong = []
    for path, text in generate().items():
        if args.check:
            if not path.exists() or path.read_text() != text:
                wrong.append(str(path.relative_to(ROOT)))
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text)
    if wrong:
        raise SystemExit('案内を生成し直してください：' + '、'.join(wrong))
    print('アプリ内・公開用の案内は同じ原稿です。' if args.check else 'アプリ内・公開用の案内を更新しました。')
