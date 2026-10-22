# 録音サンプルを選んで、頭出し・音量そろえ・モノラル化し、楽器ごとに1本のMP3と目録(JSON)にまとめる
import sys, os, re, json, subprocess, numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from sample_lib import *
from fill_gaps import fill, measured_pitch
V = '/home/user/sgossner/vsco-2-ce/'
VC = '/home/user/sgossner/VCSL/'      # Versilian Community Sample Library（CC0）。音名は C3 が真ん中のド
T = '/home/user/nbrosowsky/tonejs-instruments/samples/'
OUT = '/home/user/hy218355-bit.github.io/suibu/snd/'
os.makedirs(OUT, exist_ok=True)
GAP = 0.12
BITRATE = '128k'
# ループのつなぎ目で重ねる長さ（秒）。再生側の samples.js の XF と同じにする
XF = 0.2
# 引数で楽器名を渡すと、その楽器だけ作り直して目録を更新する
ONLY = set(sys.argv[1:])
want = lambda bank: not ONLY or bank in ONLY

WINDS = {
  'flute':   (V + 'Woodwinds/Flute/susNV', 12, (56, 98)),
  'picc':    (V + 'Woodwinds/Piccolo/Sus', 12, (76, 106)),
  'oboe':    (V + 'Woodwinds/Oboe/Sus', 12, (58, 86)),
  'bassoon': (V + 'Woodwinds/Bassoon/sus', 12, (30, 70)),
  'clar':    (V + 'Woodwinds/Clarinet/susLong', 12, (48, 94)),
  'sax':     (T + 'saxophone', 0, (45, 84)),
  'tsax':    (VC + 'Aerophones/Reed Aerophones/Tenor Saxophone/Non-Vibrato', 12, (43, 80)),
  'horn':    (V + 'Brass/F Horn/sus', 12, (44, 78)),
  'tpt':     (V + 'Brass/Trumpet/sus', 12, (55, 87)),
  'tbn':     (V + 'Brass/Tenor Trombone/sus', 12, (30, 70)),
  'tuba':    (V + 'Brass/Tuba/sus', 12, (27, 56)),
  'cbass':   (V + 'Strings/Solo Contrabass/SusNV', 12, (27, 56)),
}
KEEP_WIND = 4.5
# 録音の高さで、どこまで使うか（その録音を使う楽器の音域。SAMPLE_BANK の shift を戻した高さ）
NEED = {'picc': (74, 108), 'flute': (60, 96), 'oboe': (58, 91), 'bassoon': (34, 75), 'clar': (46, 93),
        'sax': (49, 81), 'horn': (35, 77), 'tpt': (54, 84), 'tbn': (28, 72), 'tuba': (26, 58), 'cbass': (28, 60),
        'tsax': (43, 77)}   # テナーの録音は、5度下げてバリトンサックスにも使う（SAMPLE_BANK の shift）

def fine_midi(x, nominal):
    # 録音の本当の高さを Praat で測る。ファイル名の音名と1音ずれている録音（例：クラリネットの最高音）も直す
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
    r = np.sqrt(np.mean(seg ** 2)) + 1e-9
    return x * (target / r)

def find_loop(x):
    """長い音をくり返すときのつなぎ目を探す。ループの終わりの直前 XF 秒と、ループの始まりからの XF 秒の波形が
    いちばん似ている組を、相互相関で選ぶ（波の山と谷がそろうので、重ねても打ち消し合わず、音量もへこまない）。
    始まりも終わりも、音が安定している区間（いちばん大きい所から 3dB 以内が続く所）の中から選ぶ。
    録音の後ろが消えかけている短い録音でも、ループに無音の所が入らないようにするため。
    返り値：[始まり, 終わり]（秒、録音の頭から）と、そのときの相関（1に近いほどなめらか）"""
    from scipy.signal import fftconvolve
    n = int(XF * SR); L = len(x)
    hop = int(0.1 * SR)
    env = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, L - hop, hop)])
    first = int(0.3 / 0.1)                         # 出だし（アタック）は使わない
    ref_lv = np.percentile(env[first:], 80) if len(env) > first else env.max()
    steady = env > ref_lv * 0.6                    # ビブラートなどの自然な揺れは許す（4.5dB まで）
    # 出だしのあとで、安定した区間がいちばん長く続く所（0.1秒だけのへこみは続いているとみなす）
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
        # 安定した区間が短い：その区間の中だけで、できるだけ長くつなぐ
        a_lo = s0; a_hi = max(s0 + 1, min(s0 + int(0.3 * SR), s1 - 2 * n - int(0.2 * SR)))
    seg = x[a_lo:a_hi + n].astype(np.float64)
    e = np.concatenate([[0], np.cumsum(seg ** 2)])
    win = np.sqrt(e[n:] - e[:-n]) + 1e-9          # seg[a:a+n] の大きさ
    best = None
    for b in range(s1, a_hi + n + max(n, int(0.2 * SR)), -int(0.006 * SR)):
        ref = x[b - n:b].astype(np.float64)
        rn = np.linalg.norm(ref) + 1e-9
        c = fftconvolve(seg, ref[::-1], mode='valid') / (win[:len(seg) - n + 1] * rn)
        lv = np.abs(20 * np.log10(win[:len(c)] / rn))
        # 似ていること、音量が同じこと、ループが長いこと（短いとくり返しが聞こえる。2.5秒まで）を見る
        score = c - 0.12 * lv + 0.1 * np.minimum(2.5, (b - a_lo - np.arange(len(c))) / SR)
        k = int(np.argmax(score))
        if best is None or score[k] > best[0]: best = (float(score[k]), a_lo + k, b)
    if best is None: best = (0, a_lo, s1)
    _, a, b = best
    u, w = x[b - n:b], x[a:a + n]
    c = float(np.dot(u, w) / (np.linalg.norm(u) * np.linalg.norm(w) + 1e-9))
    return [round(a / SR, 4), round(b / SR, 4)], round(c, 3)

def peak_norm(x, target=0.7):
    return x * (target / (np.max(np.abs(x)) + 1e-9))

def pack(name, items):
    # items: list of dict with 'x' (audio) + metadata
    buf = [np.zeros(int(GAP * SR), np.float32)]
    t = GAP
    meta = []
    for it in items:
        x = it.pop('x').astype(np.float32)
        it['o'] = round(t, 4); it['d'] = round(len(x) / SR, 4)
        it['pk'] = round(float(np.max(np.abs(x))), 4)
        meta.append(it)
        buf += [x, np.zeros(int(GAP * SR), np.float32)]
        t += len(x) / SR + GAP
    y = np.concatenate(buf)
    y = np.clip(y, -0.98, 0.98)
    p = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                        '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', BITRATE, OUT + name + '.mp3'], input=y.tobytes())
    assert p.returncode == 0
    return meta

manifest = json.load(open(OUT + 'manifest.json')) if ONLY else {}
for bank, (d, shift, (lo, hi)) in WINDS.items():
    if not want(bank): continue
    fs = sorted(f for f in os.listdir(d) if f.endswith('.wav'))
    by = {}
    for f in fs:
        nn = name_note(f)
        if not nn: continue
        midi = 12 * (nn[1] + 1) + nn[0] + shift
        if midi < lo or midi > hi or rr(f) != 1: continue
        by.setdefault(midi, {})[layer(f)] = f
    items = []
    for midi in sorted(by):
        lays = sorted(by[midi])
        pick = [lays[0]] if len(lays) == 1 else [lays[0], lays[-1]]
        for li, lv in enumerate(pick):
            x = load(d + '/' + by[midi][lv])
            fm = fine_midi(x[onset(x):], midi)
            x = rms_norm(prep(x, KEEP_WIND))
            # 長い音は、ここをなめらかにつないでくり返す
            items.append({'x': x, 'm': round(fm, 2), 'l': li if len(pick) > 1 else -1, 'lp': [1.0, round(len(x) / SR - 0.12, 3)]})
    items = fill(items, *NEED[bank], log=print)
    for it in items: it['lp'], it['lc'] = find_loop(it['x'])
    manifest[bank] = {'kind': 'sus', 'samples': pack(bank, items)}
    print(bank, len(items), 'samples', sorted(by), 'loop corr median', np.median([it['lc'] for it in items]))

# 短い音（スタッカート）：テイク違い2つと強弱2段
STACS = {
  'flute_st':   (V + 'Woodwinds/Flute/stac', 12, (56, 98)),
  'oboe_st':    (V + 'Woodwinds/Oboe/Stacc', 12, (58, 86)),
  'bassoon_st': (V + 'Woodwinds/Bassoon/stac', 12, (30, 70)),
  'clar_st':    (V + 'Woodwinds/Clarinet/stac', 12, (48, 94)),
  'horn_st':    (V + 'Brass/F Horn/stac', 12, (44, 78)),
  'tpt_st':     (V + 'Brass/Trumpet/stac', 12, (55, 87)),
  'tbn_st':     (V + 'Brass/Tenor Trombone/stac', 12, (30, 70)),
  'tuba_st':    (V + 'Brass/Tuba/stac', 12, (27, 56)),
  'cbass_st':   (V + 'Strings/Solo Contrabass/Spic', 12, (27, 56)),
  'tsax_st':    (VC + 'Aerophones/Reed Aerophones/Tenor Saxophone/Staccato', 12, (43, 80)),
}
for bank, (d, shift, (lo, hi)) in STACS.items():
    if not want(bank): continue
    fs = sorted(f for f in os.listdir(d) if f.endswith('.wav'))
    by = {}
    for f in fs:
        nn = name_note(f)
        if not nn: continue
        midi = 12 * (nn[1] + 1) + nn[0] + shift
        if midi < lo or midi > hi: continue
        by.setdefault(midi, {}).setdefault(layer(f), []).append(f)
    items = []
    for midi in sorted(by):
        lays = sorted(by[midi])
        pick = [lays[0]] if len(lays) == 1 else [lays[0], lays[-1]]
        for li, lv in enumerate(pick):
            # テイク違いは2つまで（番号の小さい順）
            for r, f in enumerate(sorted(by[midi][lv], key=rr)[:2], 1):
                x = load(d + '/' + f)
                x = rms_norm(prep(x, 0.9, fade=0.12), a=0.0, b=0.2)
                fm = fine_midi(x[:int(0.6 * SR)], midi)
                items.append({'x': x, 'm': round(fm, 2), 'l': li if len(pick) > 1 else -1, 'rr': r})
    items = fill(items, *NEED[bank[:-3]], log=print)
    manifest[bank] = {'kind': 'stac', 'samples': pack(bank, items)}
    print(bank, len(items), 'samples', sorted(by))

def hits(bank, specs, keep, pitched=False, norm='peak'):
    if not want(bank): return
    items = []
    for path, extra in specs:
        x = load(path)
        x = prep(x, extra.get('keep', keep), fade=0.08)
        if pitched and 'm' not in extra:
            try: extra['m'] = round(float(hz2midi(f0(x, 40, 4500))), 2)
            except Exception: pass
        x = peak_norm(x) if norm == 'peak' else rms_norm(x)
        it = {'x': x}; it.update({k: v for k, v in extra.items() if k != 'keep'})
        if extra.get('roll'): it['lp'] = [round(min(1.0, len(x) / SR * 0.3), 3), round(len(x) / SR - 0.15, 3)]
        items.append(it)
    manifest[bank] = {'kind': 'hit', 'samples': pack(bank, items)}
    print(bank, len(items), [round(i.get('m', 0), 1) for i in manifest[bank]['samples'] if 'm' in i][:12])

P = V + 'Percussion/'
hits('pizz', [(V + 'Strings/Solo Contrabass/Pizz/' + f, {'l': (0 if '_v1_' in f else 1), 'm': 12 * (name_note(f)[1] + 1) + name_note(f)[0] + 12})
              for f in sorted(os.listdir(V + 'Strings/Solo Contrabass/Pizz')) if 'rr1' in f and ('_v1_' in f or '_v3_' in f)
              and 34 <= 12 * (name_note(f)[1] + 1) + name_note(f)[0] + 12 <= 56], 1.6, norm='rms')
# ティンパニ5台の主音（スペクトルの第1ピークで測った値）
TIMP_HIT = {1: 41.4, 2: 46.8, 3: 49.5, 4: 52.4, 5: 54.6}
TIMP_ROLL = {1: 42.0, 2: 47.6, 3: 49.3, 4: 52.3, 5: 54.2}
timp = []
for n in range(1, 6):
    for v, l in ((1, 0), (4 if n > 1 else 3, 1)):
        timp.append((P + f'Timpani/Timpani{n}_Hit_v{v}_rr1_Sum.wav', {'l': l, 'm': TIMP_HIT[n]}))
    rv = 5 if n < 5 else 4
    timp.append((P + f'Timpani/Rolls/Timpani{n}_Roll_v{rv}_rr1_Sum.wav', {'roll': 1, 'm': TIMP_ROLL[n], 'keep': 6.0}))
hits('timp', timp, 3.0)
# スネア：響き線（スナッピー）を張った音（SN）を使う
hits('sd', [(P + f'Snare2-HitSN_v{v}_rr{r}_Sum.wav', {'l': i}) for i, v in enumerate((3, 5, 7, 9)) for r in (1, 2)]
          + [(P + f'Snare2-rollSN_v{v}_rr1_Sum.wav', {'roll': 1, 'l': i, 'keep': 5.0}) for i, v in enumerate((1, 3, 5))], 0.8)
B1 = V + 'VSCO 1 Percussion/drums/bass/'
hits('bd', [(P + f'BDrumNewhit_v{v}_rr1_Sum.wav', {'l': i}) for i, v in enumerate((2, 4, 6))]
          + [(B1 + 'bdrum_roll_long1.wav', {'roll': 1, 'keep': 6.0})], 2.5)
C = V + 'VSCO 1 Percussion/varMetal/Cymbals/'
hits('cym', [(C + f'clash/crash_hit_{d}_loose.wav', {'l': i}) for i, d in enumerate(('pp', 'mp', 'ff'))]
           + [(C + 'clash/' + sorted(f for f in os.listdir(C + 'clash') if f.startswith('crash_hit_fff_loose'))[0], {'l': 3})], 4.5)
hits('sus', [(C + f'susp/susp_hit_softmall_{d}.wav', {'l': i}) for i, d in enumerate(('p', 'mp', 'f', 'ff'))]
           + [(C + 'susp/susp_hit_softmall_roll5_long_p.wav', {'roll': 1, 'l': 0, 'keep': 6.0}),
              (C + 'susp/susp_hit_softmall_roll2_cresc.wav', {'roll': 1, 'l': 1, 'keep': 6.0})], 4.5)
TP = P + 'temp/'
hits('tri', [(TP + 'Triangle3-Hit_v1_rr1_Sum.wav', {'l': 0}), (TP + 'Triangle3-Hit_v2_rr1_Sum.wav', {'l': 1}),
             (TP + 'Triangle3-Roll_v2_rr1_Sum.wav', {'roll': 1, 'keep': 4.0})], 3.0)
hits('tamb', [(P + 'Tamb1-Hit_v1_rr1_Sum.wav', {'l': 0}), (P + 'Tamb1-Hit_v2_rr1_Sum.wav', {'l': 1}), (P + 'Tamb1-Hit_v2_rr2_Sum.wav', {'l': 1}),
              (P + 'Tamb1-Roll_v2_rr1_Sum.wav', {'roll': 1, 'keep': 4.0})], 0.9)
G = V + 'VSCO 1 Percussion/varMetal/Gong/gong/'
hits('tamtam', [(G + 'hit_light1.mp3', {'l': 0}), (G + 'hit_full1.mp3', {'l': 1})], 7.0)
# 鍵盤：グロッケン・シロフォン・マリンバはファイル名より1オクターブ上が実音、チャイムは表記どおり（実測で確認）
nm = lambda f, sh: 12 * (name_note(f)[1] + 1) + name_note(f)[0] + sh
hits('glock', [(P + 'Glock/' + f, {'m': nm(f, 12)}) for f in sorted(os.listdir(P + 'Glock'))], 2.5)
hits('xylo', [(P + 'Xylo/' + f, {'m': nm(f, 12)}) for f in sorted(os.listdir(P + 'Xylo'))], 1.0)
hits('mrb', [(P + 'Marimba/' + f, {'m': nm(f, 12)}) for f in sorted(os.listdir(P + 'Marimba'))], 1.6)
VB = VC + 'Idiophones/Struck Idiophones/Vibraphone/Soft Mallets/'
hits('vib', [(VB + f, {'m': nm(f, 12), 'l': layer(f) - 1}) for f in sorted(os.listdir(VB)) if f.endswith('.wav')], 3.0)
hits('chime', [(P + f, {'m': nm(f, 0)}) for f in sorted(os.listdir(P)) if f.startswith('TB_hit')], 4.5)

json.dump(manifest, open(OUT + 'manifest.json', 'w'), ensure_ascii=False, separators=(',', ':'))
tot = sum(os.path.getsize(OUT + f) for f in os.listdir(OUT))
print('total MB', round(tot / 1e6, 2))
