#!/usr/bin/env python3
"""案内の一致・リンク・オフライン同梱・既存のゲーム部分を検査する。画面の目視検証ではない。"""
import importlib.util
import json
import plistlib
import re
import subprocess
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
GAME = ROOT / 'tsukurikata'
spec = importlib.util.spec_from_file_location('legal', GAME / 'tools/build_legal.py')
legal = importlib.util.module_from_spec(spec)
spec.loader.exec_module(legal)

class Document(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.ids, self.links, self.resources, self.scripts, self.details = [], [], [], [], []
        self.feed(source)
    def handle_starttag(self, tag, pairs):
        a = dict(pairs)
        if a.get('id'):
            self.ids.append(a['id'])
        if tag == 'a' and a.get('href'):
            self.links.append(a['href'])
        if tag == 'script':
            self.scripts.append(a.get('src'))
        if tag == 'details':
            self.details.append(a)
        if tag in ['script', 'img', 'iframe', 'audio', 'video', 'source'] and a.get('src'):
            self.resources.append(a['src'])
        if tag == 'link' and a.get('rel') in ['stylesheet', 'icon', 'apple-touch-icon', 'preload']:
            self.resources.append(a['href'])

expected = legal.generate()
files = []
for path, text in expected.items():
    assert path.read_text() == text, f'原稿と生成物の不一致：{path}'
    if path.suffix != '.html':
        continue
    doc = Document(text)
    assert len(doc.ids) == len(set(doc.ids)), f'IDの重複：{path}'
    for url in doc.resources + doc.links:
        parts = urlsplit(url)
        if parts.scheme:
            assert parts.scheme in ['https', 'mailto'], (path, url)
            continue
        if url in doc.resources:
            assert not url.startswith('//'), (path, url)
        if not parts.path:
            continue
        target = (ROOT / parts.path.lstrip('/')) if parts.path.startswith('/') else path.parent / unquote(parts.path)
        if target.is_dir():
            target /= 'index.html'
        assert target.exists(), f'リンク切れ：{path.relative_to(ROOT)} → {url}'
    assert not [u for u in doc.resources if urlsplit(u).scheme or u.startswith('//')], path
    if path != GAME / 'index.html':
        assert not doc.scripts, '公開用ページにスクリプトを加えない'
        assert 'hy218355@gmail.com' in text or 'credits' in path.name or path.parent.name == 'tsukurikata-credits'
    files.append(str(path.relative_to(ROOT)))

index = (GAME / 'index.html').read_text()
old = subprocess.check_output(['git', 'show', 'e9a6a40:tsukurikata/index.html'], cwd=ROOT, text=True)
old_game = re.sub(r'  <details class="foot" data-tab="log"><summary>この作品について.*?</details>', '', old, count=1, flags=re.S)
new_game = re.sub(re.escape(legal.START) + r'.*?' + re.escape(legal.END), '', index, flags=re.S)
new_game = re.sub(re.escape(legal.CSS_START) + r'.*?' + re.escape(legal.CSS_END) + r'\n', '', new_game, flags=re.S)
without_blank_lines = lambda text: '\n'.join(line for line in text.splitlines() if line.strip())
assert without_blank_lines(old_game) == without_blank_lines(new_game), '案内以外のゲーム画面が変わっている'
assert Document(old).scripts == Document(index).scripts, '読み込み順の変更'
block = index.split(legal.START)[1].split(legal.END)[0]
assert {a['id'] for a in Document(block).details if a.get('id', '').startswith('legal-')} == {'legal-privacy', 'legal-terms', 'legal-support', 'legal-credits'}
assert all('open' not in d for d in Document(block).details), '初めから本文を展開しない'
assert index.index('id="appInfo"') < index.index('id="h-log"'), '日誌の入口からすぐに開ける'
assert 'font-family:-apple-system' in legal.LEGAL_CSS
assert 'min-height:48px' in legal.LEGAL_CSS
from html import escape
for file in (GAME / 'fonts').glob('OFL-*.txt'):
    normalized = '\n'.join(line.rstrip() for line in file.read_text().splitlines())
    assert f'<pre lang="en">{escape(normalized)}</pre>' in block, file.name
manifest = plistlib.loads((ROOT / 'tsukurikata-ios/Tsukurikata/PrivacyInfo.xcprivacy').read_bytes())
assert manifest['NSPrivacyTracking'] is False
assert manifest['NSPrivacyTrackingDomains'] == manifest['NSPrivacyCollectedDataTypes'] == []
assert {d['NSPrivacyAccessedAPIType']:d['NSPrivacyAccessedAPITypeReasons'] for d in manifest['NSPrivacyAccessedAPITypes']} == {
    'NSPrivacyAccessedAPICategoryUserDefaults':['CA92.1'],
    'NSPrivacyAccessedAPICategoryFileTimestamp':['C617.1']
}
report = {'documents':files,'sameSource':True,'offlineResources':True,'localLinks':True,'uniqueIds':True,'gameOutsideLegalUnchanged':True,'scriptOrderUnchanged':True,'collapsedInitially':True,'systemFontForFullText':True,'touchTargetCSS':48,'privacyManifest':'CA92.1・C617.1／追跡・収集なし','visualCheck':'未実施：Work設定でブラウザ利用が無効'}
(ROOT / 'design/app-legal/checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
