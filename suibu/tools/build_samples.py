# 録音サンプルを選んで、頭出し・音量そろえ・モノラル化し、楽器ごとに1本のMP3と目録(JSON)にまとめる
import sys, os, re, json, subprocess, numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from sample_lib import *
V = '/home/user/sgossner/vsco-2-ce/'
T = '/home/user/nbrosowsky/tonejs-instruments/samples/'
F = '/home/user/gleitz/midi-js-soundfonts/FluidR3_GM/'
OUT = '/home/user/hy218355-bit.github.io/suibu/snd/'
os.makedirs(OUT, exist_ok=True)
GAP = 0.12
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
  'horn':    (V + 'Brass/F Horn/sus', 12, (44, 78)),
  'tpt':     (V + 'Brass/Trumpet/sus', 12, (55, 87)),
  'tbn':     (V + 'Brass/Tenor Trombone/sus', 12, (30, 70)),
  'tuba':    (V + 'Brass/Tuba/sus', 12, (27, 56)),
  'cbass':   (V + 'Strings/Solo Contrabass/SusNV', 12, (27, 56)),
}
KEEP_WIND = 3.0

def fine_midi(x, nominal):
    try:
        m = hz2midi(f0(x))
        if abs(m - nominal) < 0.5: return float(m)
    except Exception: pass
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
                        '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '96k', OUT + name + '.mp3'], input=y.tobytes())
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
    manifest[bank] = {'kind': 'sus', 'samples': pack(bank, items)}
    print(bank, len(items), 'samples', sorted(by))

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
}
for bank, (d, shift, (lo, hi)) in STACS.items():
    if not want(bank): continue
    fs = sorted(f for f in os.listdir(d) if f.endswith('.wav'))
    by = {}
    for f in fs:
        nn = name_note(f)
        if not nn: continue
        midi = 12 * (nn[1] + 1) + nn[0] + shift
        if midi < lo or midi > hi or rr(f) > 2: continue
        by.setdefault(midi, {}).setdefault(layer(f), {})[rr(f)] = f
    items = []
    for midi in sorted(by):
        lays = sorted(by[midi])
        pick = [lays[0]] if len(lays) == 1 else [lays[0], lays[-1]]
        for li, lv in enumerate(pick):
            for r, f in sorted(by[midi][lv].items()):
                x = load(d + '/' + f)
                x = rms_norm(prep(x, 0.9, fade=0.12), a=0.0, b=0.2)
                items.append({'x': x, 'm': float(midi), 'l': li if len(pick) > 1 else -1, 'rr': r})
    manifest[bank] = {'kind': 'stac', 'samples': pack(bank, items)}
    print(bank, len(items), 'samples', sorted(by))

# FluidR3_GM（CC BY 3.0）：VSCOにないテナー・バリトンサックスとヴィブラフォン。
# 半音ごとの録音から短3度おきに選ぶ（ファイル名は実音・♭表記）
FL_PC = {'C': 0, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4, 'F': 5, 'Gb': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11}
def fl_name(midi):
    pc = [k for k, v in FL_PC.items() if v == midi % 12][0]
    return pc + str(midi // 12 - 1)
FLUID = {'tsax': ('tenor_sax', (41, 80)), 'bsax': ('baritone_sax', (33, 72))}
for bank, (d, (lo, hi)) in FLUID.items():
    if not want(bank): continue
    items = []
    for midi in range(lo, hi + 1, 3):
        x = load(F + d + '-mp3/' + fl_name(midi) + '.mp3')
        fm = fine_midi(x[onset(x):], midi)
        x = rms_norm(prep(x, KEEP_WIND))
        items.append({'x': x, 'm': round(fm, 2), 'l': -1, 'lp': [1.0, round(len(x) / SR - 0.12, 3)]})
    manifest[bank] = {'kind': 'sus', 'samples': pack(bank, items)}
    print(bank, len(items), 'samples', [i['m'] for i in manifest[bank]['samples']])

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
hits('sd', [(P + f'Snare2-HitNS_v{v}_rr{r}_Sum.wav', {'l': i}) for i, v in enumerate((1, 3, 5, 6)) for r in (1, 2)]
          + [(P + f'Snare2-rollNS_v{v}_rr1_Sum.wav', {'roll': 1, 'l': i, 'keep': 5.0}) for i, v in enumerate((1, 3, 5))], 0.7)
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
hits('vib', [(F + 'vibraphone-mp3/' + fl_name(m) + '.mp3', {'m': m}) for m in range(53, 90, 3)], 3.0)
hits('chime', [(P + f, {'m': nm(f, 0)}) for f in sorted(os.listdir(P)) if f.startswith('TB_hit')], 4.5)

json.dump(manifest, open(OUT + 'manifest.json', 'w'), ensure_ascii=False, separators=(',', ':'))
tot = sum(os.path.getsize(OUT + f) for f in os.listdir(OUT))
print('total MB', round(tot / 1e6, 2))
