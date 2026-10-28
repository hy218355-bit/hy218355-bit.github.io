# 実ブラウザで保存した音声と操作の記録を照合する。
from pathlib import Path
import json

folder = Path(__file__).resolve().parent
read = lambda name: json.loads((folder / name).read_text())
pcm = read('pcm-check.json')
assert not pcm['errors']
old = next(r for r in pcm['results'] if r['mode'] == 'old')
assert old['peak'] > .99 and old['value'] < .31
assert len(pcm['cases']) == 12
for r in [r for r in pcm['results'] if r['mode'] != 'old'] + pcm['cases'] + pcm['integration']['changes']:
    assert r['maxRise'] < 1e-7, r
    assert abs(r['end']) < 1e-6 and r['jump'] < .0002, r
assert pcm['integration']['finalGain'] == 1
assert pcm['integration']['finalVenue'] == 'civic'
assert pcm['integration']['finalPosition'] == 'back'
assert len(pcm['integration']['changes']) == 3
browser = read('browser-check.json')
assert len({r['venueAudio']['state'] for r in browser}) == 1
playing = [r for r in browser if r['playing']]
assert {r['venue'] for r in playing} == {'room','gym','outdoor','civic','camp','hall','grand'}
for r in browser:
    assert r['width'] == r['scrollWidth'] == 375
    assert r['venue'] == r['venueAudio']['engine'] == r['venueAudio']['chain']
    assert r['boot']['loaded'] == r['boot']['scripts'] == 33
    assert not r['boot']['errors'] and not r['boot']['failed']
for playback in {r['playbackId'] for r in playing}:
    group = [r for r in playing if r['playbackId'] == playback]
    assert len({r['venueAudio']['performance'] for r in group}) == 1
assert {r['theme'] for r in playing} == {'light','dark'}
assert browser[-1]['playing'] is False and browser[-1]['playbackId'] is None
assert all(r['width'] == r['scrollWidth'] == 375 for r in read('tabs-check.json'))
year = read('year-check.json')
assert year['year'] == 2027 and year['steps'] == 49
assert not year['boot']['errors'] and not year['boot']['failed']
assert read('console-check.json') == []
native = read('native-check.json')
assert native['buildSucceeded'] and native['installed'] and not native['mirroringUsed']
assert all(r['match'] for r in native['files'])
print('音量の再上昇を再現／修正後12条件と実会場チェーン3回の連続切替／段差・無音・終了点／7会場の再生継続・演奏と部の保持／375px両テーマ・4タブ／49操作で新年度／33スクリプト／ビルド・導入・同梱一致：確認済み')
