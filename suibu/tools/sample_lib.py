import os, re, subprocess, numpy as np
SR = 44100
PCS = {'C':0,'C#':1,'D':2,'D#':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'A#':10,'B':11}
def load(path, sr=SR):
    raw = subprocess.run(['ffmpeg','-v','error','-i',path,'-ac','1','-ar',str(sr),'-f','f32le','-'],capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()
def name_note(fname):
    f = fname.replace('Cs','C#').replace('Ds','D#').replace('Fs','F#').replace('Gs','G#').replace('As','A#')
    m = re.search(r'(?:^|[_ ])([A-G]#?)(-?\d)(?=[_. ])', f)
    if not m: return None
    return PCS[m.group(1)], int(m.group(2))
def layer(fname):
    m = re.search(r'_v(\d)', fname); return int(m.group(1)) if m else 1
def rr(fname):
    m = re.search(r'rr(\d)', fname)
    if m: return int(m.group(1))
    m = re.search(r'_(\d)\.wav$', fname); return int(m.group(1)) if m else 1
def onset(x, rel=0.03):
    pk = np.max(np.abs(x)) + 1e-9
    idx = np.argmax(np.abs(x) > pk * rel)
    return max(0, idx - int(0.008 * SR))
def f0(x, lo=25, hi=2200):
    # 自己相関（YIN風）で基本周波数を測る
    seg = x[int(0.35*SR):int(0.35*SR)+8192]
    if len(seg) < 4096: seg = x[:8192]
    seg = seg - seg.mean()
    n = len(seg); W = n // 2
    taus = np.arange(int(SR/hi), min(int(SR/lo), W))
    d = np.array([np.sum((seg[:W] - seg[t:t+W])**2) for t in taus])
    cm = d * np.arange(1, len(d)+1) / (np.cumsum(d) + 1e-12)
    cand = np.where(cm < 0.15)[0]
    i = cand[0] if len(cand) else np.argmin(cm)
    while i + 1 < len(cm) and cm[i+1] < cm[i]: i += 1
    t = taus[i]
    if 0 < i < len(d) - 1:
        a, b, c = d[i-1], d[i], d[i+1]; den = a - 2*b + c
        t = t + (0.5*(a - c)/den if den != 0 else 0)
    return SR / t
def hz2midi(f): return 69 + 12*np.log2(f/440.0)
