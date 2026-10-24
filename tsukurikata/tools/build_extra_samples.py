# 自分の録音がなかった楽器（E♭クラリネット・バスクラリネット・バストロンボーン・バリトンサックス）を、
# 別の録音から作って snd/ に足す（ほかの楽器の録音と目録はそのまま）
#   python3 -I tsukurikata/tools/build_extra_samples.py <アイオワ大の AIFF のフォルダ> <Bear Sax の WAV のフォルダ>
# - アイオワ大学 Electronic Music Studios「Musical Instrument Samples」（用途の制限なし）
#   E♭クラリネット・バスクラリネット・バストロンボーン。半音ずつ続けて吹いた録音（実音の名前）を1音ずつに切り分ける。mf と ff の2段
# - Karoryfer Samples「Bear Sax」（CC0）：1926年のバリトンサックス。のばす音（p・f）と短い音（2段）
# 作り方（頭出し・音量そろえ・ループのつなぎ目・MP3 と目録）は build_samples.py と同じ。MP3 は ffmpeg の代わりに lameenc で作る
import sys, os, re, json, site, aifc
sys.path.insert(0, site.getusersitepackages())
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np, lameenc
from scipy.io import wavfile
from scipy.signal import fftconvolve, resample_poly
from sample_lib import SR, onset
from fill_gaps import fill, measured_pitch

IOWA, BEAR = sys.argv[1], sys.argv[2]
OUT = os.path.join(HERE, '..', 'snd') + '/'
GAP, XF, KEEP_WIND = 0.12, 0.2, 4.5
PC = {'C': 0, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4, 'F': 5, 'Gb': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11}
note = lambda s: (lambda m: 12 * (int(m.group(2)) + 1) + PC[m.group(1)])(re.fullmatch(r'([A-G]b?)(\d)', s))

# ---- build_samples.py と同じ下ごしらえ ----
def fine_midi(x, nominal):
    got = measured_pitch(x, nominal, wide=True)
    if got is None: return float(nominal)
    if abs(got - nominal) < 0.6: return float(got)
    if abs(got - round(got)) < 0.12 and abs(got - nominal) < 1.6:
        print(f'  ! {nominal} は実際には {got:.2f}')
        return float(got)
    return float(nominal)

def prep(x, keep, fade=0.05):
    o = onset(x)
    x = x[o:o + int(keep * SR)].copy()
    n = int(fade * SR)
    if len(x) > n: x[-n:] *= np.linspace(1, 0, n)
    return x

def rms_norm(x, a=0.25, b=1.2, target=0.1):
    seg = x[int(a * SR):int(b * SR)]
    if len(seg) < SR * 0.1: seg = x
    return x * (target / (np.sqrt(np.mean(seg ** 2)) + 1e-9))

def find_loop(x):
    n = int(XF * SR); L = len(x); hop = int(0.1 * SR)
    env = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, L - hop, hop)])
    first = int(0.3 / 0.1)
    ref_lv = np.percentile(env[first:], 80) if len(env) > first else env.max()
    steady = env > ref_lv * 0.6
    runs, i = [], first
    while i < len(steady):
        if steady[i]:
            j = i
            while j < len(steady) and (steady[j] or (j + 1 < len(steady) and steady[j + 1])): j += 1
            runs.append((i, j)); i = j
        else: i += 1
    s0, s1 = max(runs, key=lambda r: r[1] - r[0]) if runs else (first, len(env))
    s0, s1 = s0 * hop, min(L - int(0.05 * SR), s1 * hop)
    a_lo = max(s0, min(int(0.8 * SR), s0 + int(0.3 * SR)))
    a_hi = min(a_lo + int(0.8 * SR), s1 - 2 * n - int(0.5 * SR))
    if a_hi <= a_lo:
        a_lo = s0; a_hi = max(s0 + 1, min(s0 + int(0.3 * SR), s1 - 2 * n - int(0.2 * SR)))
    seg = x[a_lo:a_hi + n].astype(np.float64)
    e = np.concatenate([[0], np.cumsum(seg ** 2)])
    win = np.sqrt(e[n:] - e[:-n]) + 1e-9
    best = None
    for b in range(s1, a_hi + n + max(n, int(0.2 * SR)), -int(0.006 * SR)):
        ref = x[b - n:b].astype(np.float64)
        rn = np.linalg.norm(ref) + 1e-9
        c = fftconvolve(seg, ref[::-1], mode='valid') / (win[:len(seg) - n + 1] * rn)
        lv = np.abs(20 * np.log10(win[:len(c)] / rn))
        score = c - 0.12 * lv + 0.1 * np.minimum(2.5, (b - a_lo - np.arange(len(c))) / SR)
        k = int(np.argmax(score))
        if best is None or score[k] > best[0]: best = (float(score[k]), a_lo + k, b)
    if best is None: best = (0, a_lo, s1)
    _, a, b = best
    u, w = x[b - n:b], x[a:a + n]
    c = float(np.dot(u, w) / (np.linalg.norm(u) * np.linalg.norm(w) + 1e-9))
    return [round(a / SR, 4), round(b / SR, 4)], round(c, 3)

def pack(name, items):
    buf = [np.zeros(int(GAP * SR), np.float32)]; t = GAP; meta = []
    for it in items:
        x = it.pop('x').astype(np.float32)
        it['o'] = round(t, 4); it['d'] = round(len(x) / SR, 4); it['pk'] = round(float(np.max(np.abs(x))), 4)
        meta.append(it)
        buf += [x, np.zeros(int(GAP * SR), np.float32)]
        t += len(x) / SR + GAP
    y = np.clip(np.concatenate(buf), -0.98, 0.98)
    enc = lameenc.Encoder()
    enc.set_bit_rate(128); enc.set_in_sample_rate(SR); enc.set_channels(1); enc.set_quality(2)
    data = enc.encode((y * 32767).astype('<i2').tobytes()) + enc.flush()
    open(OUT + name + '.mp3', 'wb').write(data)
    return meta

# ---- 読み込み ----
def load_aiff(path):
    a = aifc.open(path)
    assert a.getnchannels() == 1 and a.getsampwidth() == 2 and a.getframerate() == SR
    return np.frombuffer(a.readframes(a.getnframes()), dtype='>i2').astype(np.float32) / 32768

def load_wav(path):
    sr, x = wavfile.read(path)
    x = x.astype(np.float32) / (32768 if x.dtype == np.int16 else 1)
    if x.ndim > 1: x = x.mean(axis=1)
    if sr != SR: x = resample_poly(x, SR, sr).astype(np.float32)
    return x

# 半音ずつ続けて吹いた録音を、音のあるところごとに切り分ける
def split_run(x, n_expected):
    hop = int(0.01 * SR)
    env = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x) - hop, hop)])
    db = 20 * np.log10(env + 1e-9)
    # 音のあいだの雑音より12dB上、かついちばん大きい所から32dB以内を「音がある」とみなす（録音ごとに大きさがちがうため）
    floor = np.percentile(db[db > -150], 5)
    thr = max(floor + 12, db.max() - 32)
    on = db > thr
    segs, i = [], 0
    while i < len(on):
        if on[i]:
            j = i
            while j < len(on) and (on[j] or on[j:j + 25].any()): j += 1   # 0.25秒までのとぎれはつなぐ
            # 0.5秒より短いもの、ほかの音よりずっと小さいもの（キーの音・息）は除く
            if (j - i) * hop > 0.5 * SR and db[i:j].max() > db.max() - 22: segs.append((i * hop, j * hop))
            i = j
        else: i += 1
    if len(segs) != n_expected: print(f'  ? 音の数 {len(segs)}（ファイル名からは {n_expected}）')
    return [x[max(0, a - int(0.02 * SR)):b] for a, b in segs]

IOWA_BANKS = {
    # 録音の名前の頭 → 目録の名前、使う高さ（その楽器の音域）
    'EbClar':       ('ebclar', (55, 93)),
    'BassClarinet': ('bclar', (34, 74)),
    'BassTrombone': ('btbn', (28, 67)),
}
manifest = json.load(open(OUT + 'manifest.json'))
for head, (bank, (lo, hi)) in IOWA_BANKS.items():
    by = {}
    for f in sorted(os.listdir(IOWA)):
        m = re.fullmatch(re.escape(head) + r'\.(pp|mf|ff)\.([A-G]b?\d)([A-G]b?\d)?\.aiff', f)
        if not m or m.group(1) == 'pp': continue
        a = note(m.group(2)); b = note(m.group(3)) if m.group(3) else a
        notes = split_run(load_aiff(os.path.join(IOWA, f)), b - a + 1)
        print(f, len(notes), 'notes')
        for k, x in enumerate(notes):
            nominal = a + k
            fm = fine_midi(x[onset(x):], nominal)
            midi = round(fm)
            if midi < lo or midi > hi: continue
            by.setdefault(midi, {})[m.group(1)] = (x, fm)
    items = []
    for midi in sorted(by):
        lays = [d for d in ('mf', 'ff') if d in by[midi]]
        for li, d in enumerate(lays):
            x, fm = by[midi][d]
            items.append({'x': rms_norm(prep(x, KEEP_WIND)), 'm': round(fm, 2), 'l': li if len(lays) > 1 else -1})
    items = fill(items, lo, hi, log=print)
    for it in items: it['lp'], it['lc'] = find_loop(it['x'])
    manifest[bank] = {'kind': 'sus', 'samples': pack(bank, items)}
    print(bank, len(items), 'samples', sorted(by)[0], '-', sorted(by)[-1], 'loop corr median', np.median([it['lc'] for it in items]))

# Bear Sax：ファイル名の音名は1オクターブ下で書かれている（db1 が実音の D♭2。いちばん低い音）
bear = lambda s: (lambda m: 12 * (int(m.group(2)) + 2) + PC[m.group(1).capitalize()])(re.fullmatch(r'([a-g]b?)(\d)', s))
lo, hi = 36, 69
items = []
for f in sorted(os.listdir(BEAR)):
    m = re.fullmatch(r'([a-g]b?\d)_looped_([pf])\.wav', f)
    if not m: continue
    nominal = bear(m.group(1))
    x = load_wav(os.path.join(BEAR, f))
    fm = fine_midi(x[onset(x):], nominal)
    if not lo - 1 <= fm <= hi + 1: continue
    items.append({'x': rms_norm(prep(x, KEEP_WIND)), 'm': round(fm, 2), 'l': 0 if m.group(2) == 'p' else 1})
items.sort(key=lambda it: (it['m'], it['l']))
items = fill(items, lo, hi, log=print)
for it in items: it['lp'], it['lc'] = find_loop(it['x'])
manifest['bsax'] = {'kind': 'sus', 'samples': pack('bsax', items)}
print('bsax', len(items), 'samples', 'loop corr median', np.median([it['lc'] for it in manifest['bsax']['samples']]))
items = []
for f in sorted(os.listdir(BEAR)):
    m = re.fullmatch(r'([a-g]b?\d)_vl([24])_rr1\.wav', f)
    if not m: continue
    x = load_wav(os.path.join(BEAR, f))
    x = rms_norm(prep(x, 0.9, fade=0.12), a=0.0, b=0.2)
    fm = fine_midi(x[:int(0.6 * SR)], bear(m.group(1)))
    items.append({'x': x, 'm': round(fm, 2), 'l': 0 if m.group(2) == '2' else 1, 'rr': 1})
items.sort(key=lambda it: (it['m'], it['l']))
items = fill(items, lo, hi, log=print)
manifest['bsax_st'] = {'kind': 'stac', 'samples': pack('bsax_st', items)}
print('bsax_st', len(items), 'samples')

json.dump(manifest, open(OUT + 'manifest.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('total MB', round(sum(os.path.getsize(OUT + f) for f in os.listdir(OUT) if f.endswith('.mp3')) / 1e6, 2))
