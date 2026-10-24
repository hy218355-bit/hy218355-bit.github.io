# 録音のない高さを埋める。
# いちばん近い本物の録音を PSOLA（Praat の重ね合わせ再合成）で高さだけ変え、
# 倍音の強さの傾向（音色）は両どなりの本物の録音のあいだを補間した形にそろえる。
# 再生速度で高さを変えると音色の山（フォルマント）まで一緒にずれて、高くすると細く、低くするとこもって聞こえるため。
import numpy as np, parselmouth
from parselmouth.praat import call
from scipy.signal import fftconvolve
from sample_lib import SR

MAX_SHIFT = 2   # 再生時にずらす幅がこれ（半音）を超えないように埋める

def psola(x, semis, midi):
    hz = 440 * 2 ** ((midi - 69) / 12)
    s = parselmouth.Sound(x.astype(np.float64), SR)
    man = call(s, 'To Manipulation', 0.01, hz * 0.7, hz * 1.4)
    pt = call(man, 'Extract pitch tier')
    call(pt, 'Multiply frequencies', s.xmin, s.xmax, 2 ** (semis / 12))
    call([pt, man], 'Replace pitch tier')
    y = call(man, 'Get resynthesis (overlap-add)').values[0]
    return y[:len(x)].astype(np.float32)

def resample_shift(x, semis):
    # 再生速度を変えるのと同じずらし方（長さも変わる）。PSOLA がうまくいかないときに使う
    from fractions import Fraction
    from scipy.signal import resample_poly
    r = Fraction(2 ** (-semis / 12)).limit_denominator(2000)
    return resample_poly(x, r.numerator, r.denominator).astype(np.float32)

def measured_pitch(x, midi, wide=False):
    # 安定した部分の高さ（MIDI）。測れなければ None
    hz = 440 * 2 ** ((midi - 69) / 12)
    s = parselmouth.Sound(x.astype(np.float64), SR)
    p = call(s, 'To Pitch', 0.01, hz * (0.6 if wide else 0.7), hz * (1.6 if wide else 1.4))
    q = call(p, 'Get quantile', 0, 0, 0.5, 'Hertz')
    return None if not q or q != q else 69 + 12 * np.log2(q / 440)

def spiky(y, ref):
    # 元の録音にない急な跳ね（つなぎ目の傷）や、極端な山ができていないか
    d = np.abs(np.diff(y)); local = np.convolve(d, np.ones(256) / 256, 'same') + 1e-4
    return (d > 12 * local).sum() > 3 or np.max(np.abs(y)) > 1.4 * np.max(np.abs(ref))

def harmonics(x, midi):
    # 安定した部分の、倍音ごとの強さ（dB）
    n = len(x)
    a, b = (int(0.5 * SR), int(1.5 * SR)) if n > 1.8 * SR else (int(0.06 * SR), min(n, int(0.5 * SR)))
    seg = x[a:b] * np.hanning(b - a)
    S = np.abs(np.fft.rfft(seg, 1 << 17)); f = np.fft.rfftfreq(1 << 17, 1 / SR)
    hz = 440 * 2 ** ((midi - 69) / 12); fs, ls = [], []
    for k in range(1, 40):
        if k * hz > 10000: break
        i = int(round(k * hz / f[1])); w = max(2, int(0.03 * hz / f[1]))
        fs.append(k * hz); ls.append(20 * np.log10(S[max(0, i - w):i + w].max() + 1e-9))
    return np.array(fs), np.array(ls)

def match_timbre(x, midi, target):
    # x の倍音の強さを target（周波数→dB）に近づける、なめらかな直線位相フィルタ
    f, l = harmonics(x, midi)
    if len(f) < 3: return x
    g = target(f) - l; g -= np.mean(g); g = np.clip(g, -12, 12)
    N = 2048; fr = np.fft.rfftfreq(N, 1 / SR)
    gi = np.interp(np.log(np.maximum(fr, 20)), np.log(f), g, left=g[0], right=g[-1])
    k = 9; gi = np.convolve(np.pad(gi, k, mode='edge'), np.ones(2 * k + 1) / (2 * k + 1), 'same')[k:-k]
    h = np.fft.irfft(10 ** (gi / 20), N); h = np.roll(h, N // 2) * np.hanning(N)
    return fftconvolve(x, h)[N // 2:N // 2 + len(x)].astype(np.float32)

EXTEND = 7      # 録音のある範囲の外へは、ここまで（半音）しか作らない
FAR = 9         # 元にする録音からこれ（半音）より離れた高さは作らない

def fill(items, lo, hi, log=None):
    """items: 本物の録音（'x', 'm', 'l', ['rr']）。lo〜hi（MIDI）のどこでも、MAX_SHIFT 半音以内に録音があるように足す。
    再生側（pickSample）と同じく、強弱段 L の候補は l == L と l == -1（強弱段が1つしかない高さ）の録音。"""
    layered = any(it.get('l', -1) >= 0 for it in items)
    takes = sorted({it.get('rr', 1) for it in items})
    made = {}   # (高さ, テイク, 元の録音) → 作った録音（強弱段をまたいで同じものは1つにまとめる）
    for L in ((0, 1) if layered else (-1,)):
        for rr in takes:
            real = sorted((it for it in items if it.get('rr', 1) == rr and it.get('l', -1) in (L, -1)), key=lambda it: it['m'])
            if not real: continue
            have = [it['m'] for it in real] + [k[0] for k, v in made.items() if k[1] == rr and v['l'] in (L, -1)]
            env = {id(it): harmonics(it['x'], it['m']) for it in real}
            a0, b0 = max(lo, int(np.ceil(real[0]['m'])) - EXTEND), min(hi, int(np.floor(real[-1]['m'])) + EXTEND)
            skip = set()
            while True:
                grid = [g for g in range(a0, b0 + 1) if g not in skip]
                if not grid: break
                dist = [min(abs(g - h) for h in have) for g in grid]
                if max(dist) <= MAX_SHIFT: break
                m = grid[int(np.argmax(dist))]
                src = min(real, key=lambda it: abs(it['m'] - m))
                if abs(src['m'] - m) > FAR: skip.add(m); continue
                key = (m, rr, id(src))
                if key in made:
                    # もう一方の強弱段のために同じ元から作ってある → 両方で使う
                    made[key]['l'] = -1; have.append(m); continue
                below = [it for it in real if it['m'] <= m]; above = [it for it in real if it['m'] >= m]
                if below and above:
                    a, b = below[-1], above[0]
                    w = 0 if b['m'] == a['m'] else (m - a['m']) / (b['m'] - a['m'])
                    (fa, la), (fb, lb) = env[id(a)], env[id(b)]
                    target = lambda f, fa=fa, la=la, fb=fb, lb=lb, w=w: (1 - w) * np.interp(np.log(f), np.log(fa), la) + w * np.interp(np.log(f), np.log(fb), lb)
                else:
                    fs, ls = env[id(src)]
                    target = lambda f, fs=fs, ls=ls: np.interp(np.log(f), np.log(fs), ls)
                semis = m - src['m']
                gain = lambda y: y * (np.sqrt(np.mean(src['x'] ** 2)) + 1e-9) / (np.sqrt(np.mean(y ** 2)) + 1e-9)   # 音量は元の録音にそろえる
                y = gain(match_timbre(psola(src['x'], semis, src['m']), m, target))
                how = 'psola'
                got = measured_pitch(y if len(y) > 1.5 * SR else y[:int(0.6 * SR)], m)
                if got is None or abs(got - m) > 0.3 or spiky(y, src['x']):
                    # 低すぎて PSOLA が高さを捉えられない・傷ができた → 速度で高さを変え、音色だけ補正する
                    y = gain(match_timbre(resample_shift(src['x'], semis), m, target)); how = 'resample'
                pk = np.max(np.abs(y))
                if pk > 0.95: y *= 0.95 / pk   # 割れないように
                it = {k: v for k, v in src.items() if k != 'x'}
                it.update(x=y, m=float(m), gen=1, l=src.get('l', -1) if src.get('l', -1) >= 0 else L)
                if 'lp' in it: it['lp'] = [min(1.0, round(len(y) / SR * 0.35, 3)), round(len(y) / SR - 0.12, 3)]
                made[key] = it; have.append(m)
                if log: log(f'  + {m} from {src["m"]:.0f} ({semis:+.0f}) layer {L} take {rr} {how}')
    out = list(items) + list(made.values())
    out.sort(key=lambda it: (it['m'], it.get('l', -1), it.get('rr', 1)))
    return out
