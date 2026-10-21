# 21通り（7会場×3位置）の響きを計算し、直接音を取り除いて、MP3と目録(ir.json)に書き出す（使い方: python3 ir_build.py 出力先/）
import sys, os, json, subprocess, warnings; warnings.filterwarnings('ignore')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ir_sim import *
from concurrent.futures import ProcessPoolExecutor
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/ir_raw/'   # 計算したままの響き（このあと ir_c80.py で仕上げる）
os.makedirs(OUT, exist_ok=True)
MARK, LEAD = 0.05, 0.15   # 頭出し用の目印の位置と、響きの始まる位置（秒）
K = pra.constants.get('frac_delay_length') // 2
def one(args):
    vid, pos = args
    room, rirs = simulate(vid, pos)
    v = VEN[vid]; L = v['lis'][pos]
    wet, direct = [], []
    for m, r in enumerate(rirs):
        mic = np.array([L[0], L[1] + (m - 0.5), L[2]])
        dist = np.linalg.norm(mic - np.array(v['src']))
        t_d = int(round(dist / room.c * FS))
        win = r[max(0, t_d - 5): t_d + 2 * K + 10]
        pk = max(0, t_d - 5) + int(np.argmax(np.abs(win)))
        a = abs(r[pk]); direct.append(a)
        x = r.copy(); x[max(0, pk - K): pk + K + 1] = 0      # 直接音（とその補間フィルタ）を消す
        wet.append(x[pk:] / a)                              # 直接音を1としたときの響き
    n = min(len(w) for w in wet)
    W = np.stack([w[:n] for w in wet])
    env = np.max(np.abs(W), axis=0)
    thr = env.max() * 10 ** (-66 / 20)
    last = int(np.max(np.nonzero(env > thr))) + int(0.05 * FS)
    W = W[:, :min(n, last)]
    fade = int(0.05 * FS); W[:, -fade:] *= np.linspace(1, 0, fade)
    energy = float(np.mean(np.sum(W ** 2, axis=1)))         # 直接音のエネルギーを1としたときの響きの量
    peak = float(np.max(np.abs(W)))
    Wn = W / peak * 0.9
    lead = np.zeros((2, int(LEAD * FS))); lead[:, int(MARK * FS)] = 0.95
    data = np.concatenate([lead, Wn], axis=1).T.astype(np.float32)
    path = OUT + f'{vid}_{pos}.mp3'
    p = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(FS), '-ac', '2', '-i', '-', '-codec:a', 'libmp3lame', '-b:a', '160k', path], input=data.tobytes())
    assert p.returncode == 0
    rt = pra.experimental.measure_rt60(rirs[0], fs=FS, decay_db=30)
    return vid, pos, {'len': round(W.shape[1] / FS, 3), 'wetGain': round(peak / 0.9, 6), 'energy': round(energy, 4), 'rt': round(float(rt), 2)}
if __name__ == '__main__':
    jobs = [(v, p) for v in VEN for p in ('podium', 'center', 'back')]
    man = {}
    with ProcessPoolExecutor(4) as ex:
        for vid, pos, info in ex.map(one, jobs):
            man.setdefault(vid, {})[pos] = info
            print(vid, pos, info, flush=True)
    json.dump({'mark': MARK, 'lead': LEAD, 'venues': man}, open(OUT + 'ir.json', 'w'), separators=(',', ':'))
    print('MB', round(sum(os.path.getsize(OUT + f) for f in os.listdir(OUT)) / 1e6, 2))
