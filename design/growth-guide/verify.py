"""保存した検証結果を確かめる。ゲームを新しく進める検査とは別。"""
import hashlib
import json
from pathlib import Path
import re
from PIL import Image

folder = Path(__file__).resolve().parent
root = folder.parent.parent
read = lambda p: json.loads((folder / p).read_text())
checks = read('checks/results.json')
assert len(checks) == 40 and all(x['exit'] == 0 for x in checks)
averages = read('averages/results.json')
assert len(averages) == 6 and all(x['exit'] == 0 and x['runsPerPiece'] == 10 for x in averages)
balance = read('balance.json')
assert len(balance['pieces']) == 15
for piece in balance['pieces']:
    assert all(lo <= x <= hi for x, (lo, hi) in zip(piece['auto']['scores'], [(37, 47), (55, 67), (65, 75)]))
    assert piece['before']['welcome'][0] == 0 < piece['auto']['welcome'][0]
long = read('long-term.json')
assert long['years'] == 12 and len(long['pieces']) == 15
for piece in long['pieces']:
    assert len(piece['runs']) == 3
    paths = []
    for run in piece['runs']:
        text = (folder / 'long-runs' / f"{piece['piece']}-{run['seed']}.txt").read_text()
        assert run['exit'] == 0 and len(re.findall('年度の終わり', text)) == 12
        paths.append(bool(re.search('全日本吹奏楽コンクール：', text)))
    assert any(paths), piece['piece']
for name in ['intake-light', 'intake-open-light', 'intake-open-dark', 'welcome-light', 'welcome-dark', 'basics-open-light', 'basics-open-dark', 'audition-open-light', 'audition-open-dark', 'first-practice-light', 'first-practice-dark']:
    r = read(name + '.json')
    assert r['width'] == r['scrollWidth'] == 375
    assert r['advisor']['loaded']
    im = Image.open(folder / 'screenshots' / (name + '.png'))
    assert im.format == 'PNG' and im.size == (375, 812)
for tab in ['play', 'members', 'journal']:
    for theme in ['light', 'dark']:
        r = read(f'tab-{tab}-{theme}.json')
        assert r['width'] == r['scrollWidth'] == 375
assert read('intake-light.json')['advisor']['state'] == read('intake-open-light.json')['advisor']['state'] == read('intake-open-dark.json')['advisor']['state']
year = read('new-year-final-dark.json')
assert year['year'] == 2027 and year['steps'] > 40 and not year['errors']
assert not year['boot']['errors'] and not year['boot']['failed']
assert len(year['boot']['loaded']) == len(year['boot']['scripts']) == 34
for item in year['boot']['resources']:
    if item['file'].startswith('/tsukurikata/js/'):
        assert item['bytes'] == (root / item['file'][1:]).stat().st_size, item['file']
assert not read('console-final.json')
for row in read('average-guards.json'):
    assert row['rejected'] and not row['hasAverage']
avatar = root / 'tsukurikata/img/advisor-asano.webp'
assert avatar.stat().st_size <= 200000 and Image.open(avatar).format == 'WEBP'
native = read('native-check.json')
assert native['buildSucceeded'] and native['signatureExit'] == 0
bundle = Path(native['bundle'])
for f in native['files']:
    src = root / 'tsukurikata' / f['file']
    assert hashlib.sha256(src.read_bytes()).hexdigest() == f['sha256'] == f['bundledSha256']
    assert hashlib.sha256((bundle / f['file']).read_bytes()).hexdigest() == f['sha256']
print('40検査・全15曲の平均・全45試行の12年完走・全曲の全国出場例・375px両テーマ・案内の開閉・1年進行・前の保存内容・アプリ同梱を記録から確認')
