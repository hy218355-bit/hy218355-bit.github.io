# 実音声と実画面から保存した記録を照合する。
from pathlib import Path
import json, math

folder = Path(__file__).resolve().parent
read = lambda name: json.loads((folder / name).read_text())
baseline = read('baseline.json')
assert baseline['results'][0]['channels'][0]['maxRise'] > .0001
pcm = read('pcm-check.json')
assert not pcm['errors'] and len(pcm['cases']) == 12
for r in pcm['results'] + pcm['cases']:
    assert r['ended'] and len(r['voiceStops']) == 1
    assert abs(r['voiceStops'][0] - r['at'] - .3) < 1e-6
    for c in r['channels']:
        for key in ['start', 'jump', 'maxRise', 'atEnd', 'afterStop']:
            assert c[key] is not None and math.isfinite(c[key]), (key, c)
        assert c['maxRise'] < 1e-7 and c['jump'] <= .001 * r['held']
        assert c['afterStop'] == 0 and c['atEnd'] == 0
natural = pcm['natural']
assert natural['ended'] and not natural['voiceStops']
assert all(c['afterStop'] > .5 for c in natural['channels'])
files=['light-playing.json','light-stopped.json','dark-playing.json','dark-switched.json','dark-stopped.json','stop-settled.json']
rows=[read(f) for f in files]
assert len({r['stopUi']['state'] for r in rows}) == 1
assert len({r['recordsFingerprint'] for r in rows}) == 1
for r in rows:
    assert r['width'] == r['scrollWidth'] == 375
    assert len(r['boot']['scripts']) == len(r['boot']['loaded']) == 33
    assert not r['boot']['errors'] and not r['boot']['failed']
    if r['playing']: assert r['library']['actual'] == r['library']['expected']
assert rows[0]['playing'] and not rows[1]['playing']
assert rows[2]['library']['active'] != rows[3]['library']['active']
assert rows[2]['playbackId'] != rows[3]['playbackId']
assert not rows[4]['playing'] and rows[4]['stopUi']['focus'] == 'week'
assert rows[1]['stopUi']['focus'] == 'btnNow'
assert len(rows[-1]['playbackStops']) == 3
for stop in rows[-1]['playbackStops']:
    assert stop['clock'] and len(stop['samples']) == 5
    assert stop['samples'][-1]['elapsed'] >= .3
    for ch in range(2):
        levels=[s['gains'][ch] for s in stop['samples']]
        assert all(a >= b - 1e-6 for a,b in zip(levels, levels[1:]))
        assert levels[-1] < stop['before'][ch] * .002
assert len(read('tabs-check.json')) == 4
assert all(r['width'] == r['scrollWidth'] == 375 for r in read('tabs-check.json'))
year=read('year-check.json')
assert year['year'] == 2027 and year['steps'] == 49
assert not year['boot']['errors'] and not year['boot']['failed']
assert read('console-check.json')['current'] == []
native=read('native-check.json')
assert native['buildSucceeded'] and all(r['match'] for r in native['files'])
assert not native['installed'] and native['connectionInterrupted'] and not native['mirroringUsed']
print('変更前の停止後の再上昇を再現／修正後12条件×直接音と響き／予約取消・開始点・二度の停止・自然終了の保持／実録音3回の停止と切替／部と録音の不変／375px両テーマ・4タブ・49操作で新年度／ビルドと同梱一致：確認済み。iPhoneへの導入は接続切断で未完了。')
