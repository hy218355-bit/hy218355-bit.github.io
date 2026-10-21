# 響きの「明瞭さ（C80）」を実際のホールの測定値の範囲にそろえる。
# 点音源・靴箱形の計算では、楽器の指向性や反射板の初期反射が入らないぶん後半の響きが多すぎるので、
# 80ms以降の響きだけを一律に下げる（減衰の速さ＝残響時間は変わらない）。
import os, sys, json, subprocess, numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
# 使い方: python3 ir_c80.py ir_build.pyの出力先/ 響きなしの合奏1.wav 響きなしの合奏2.wav
# 合奏のwavは、合奏の音に対する響きの量を測るためのもの（ゲームの再生エンジンで響きを付けずに書き出す）
SRC = sys.argv[1] if len(sys.argv) > 1 else '/tmp/ir_raw/'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../snd/ir/')
DRY = sys.argv[2:] or ['/tmp/dry-ode.wav', '/tmp/dry-largo.wav']
m = json.load(open(os.path.join(SRC, 'ir.json'))); sr = 32000
TARGET = {  # 中音域のC80（dB）
  'room': (4, 3, 2), 'gym': (2, -2, -3), 'civic': (5, 1.5, 0.5), 'camp': (3, 1.5, 1),
  'hall': (4, 0.5, -0.5), 'grand': (3.5, -0.5, -1.5), 'outdoor': (None, None, None)}
def load(p, ch=2, rate=sr):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ar', str(rate), '-ac', str(ch), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).T.copy()
# 2曲目（《新世界より》の冒頭）は静かなので、音量を上げて混ぜる
mus = np.concatenate([load(DRY[0], 1)[0]] + [load(p, 1)[0] * 8 for p in DRY[1:]])
bp = butter(2, [400, 2500], 'band', fs=sr, output='sos')
t = np.arange(int(5 * sr)) / sr
def env(a):
    w = np.ones_like(t)
    k = (t > 0.03) & (t < 0.08); w[k] = 1 + (a - 1) * (0.5 - 0.5 * np.cos(np.pi * (t[k] - 0.03) / 0.05))
    w[t >= 0.08] = a
    return w
def c80(h):
    hh = np.zeros(len(h) + 1); hh[0] = 1; hh[1:] = h
    e = sosfilt(bp, hh) ** 2; n = int(0.08 * sr)
    return 10 * np.log10(e[:n].sum() / e[n:].sum())
def ratio(H):
    x = mus - mus.mean()
    return float(np.mean([np.mean(fftconvolve(x, h)[:len(x)] ** 2) / np.mean(x ** 2) for h in H]))
man = {'mark': m['mark'], 'lead': m['lead'], 'venues': {}}
for v, ps in m['venues'].items():
    for i, (p, info) in enumerate(ps.items()):
        ir = load(os.path.join(SRC, f'{v}_{p}.mp3'))
        mk = int(np.argmax(np.abs(ir[0, :int((m['mark'] + 0.06) * sr)])))
        st = mk + int(round((m['lead'] - m['mark']) * sr))
        H = ir[:, st:st + int(round(info['len'] * sr))] * info['wetGain']
        tgt = TARGET[v][i]
        c0 = np.mean([c80(h) for h in H])
        a = 1.0
        if tgt is not None:
            lo, hi = 0.15, 1.5
            for _ in range(40):
                a = (lo + hi) / 2
                c = np.mean([c80(h * env(a)[:len(h)]) for h in H])
                if c < tgt: hi = a
                else: lo = a
            H = H * env(a)[:H.shape[1]]
        c1 = np.mean([c80(h) for h in H])
        energy = float(np.mean(np.sum(H ** 2, axis=1)))
        emus = ratio(H)
        peak = float(np.max(np.abs(H)))
        Wn = H / peak * 0.9
        lead = np.zeros((2, int(m['lead'] * sr))); lead[:, int(m['mark'] * sr)] = 0.95
        data = np.concatenate([lead, Wn], axis=1).T.astype(np.float32)
        r = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(sr), '-ac', '2', '-i', '-', '-codec:a', 'libmp3lame', '-b:a', '160k', OUT + f'{v}_{p}.mp3'], input=data.tobytes())
        assert r.returncode == 0
        man['venues'].setdefault(v, {})[p] = {'len': info['len'], 'wetGain': round(peak / 0.9, 6), 'energy': round(energy, 4), 'mus': round(emus, 4), 'c80': round(c1, 1), 'rt': info['rt']}
        print(f'{v:8}{p:7} C80 {c0:+5.1f} -> {c1:+5.1f}  late x{a:.2f} ({20*np.log10(a):+.1f}dB)  energy {info["energy"]:.2f}->{energy:.2f}  music D/R {10*np.log10(emus):+.1f}dB', flush=True)
json.dump(man, open(OUT + 'ir.json', 'w'), separators=(',', ':'))
