# 会場の響き（インパルス応答）を、部屋の寸法と材質から物理シミュレーションで作る
import sys, json, time, numpy as np, pyroomacoustics as pra
FS = 32000
F = [125, 250, 500, 1000, 2000, 4000, 8000]
def mat(coeffs, scat):
    return pra.Material({'coeffs': coeffs, 'center_freqs': F[:len(coeffs)]}, scat)
T = pra.materials_absorption_table
def M(name, scat): return pra.Material(name, scat)
# x: 奥行き（ステージ→客席）、y: 幅、z: 高さ
VEN = {
  'room': dict(dims=[12, 9, 3.6], src=[3.5, 4.5, 1.2], lis={'podium': [6.0, 4.5, 1.6], 'center': [8.8, 4.5, 1.2], 'back': [11.0, 4.5, 1.2]},
      m=dict(east=mat([0.2, 0.28, 0.33, 0.3, 0.27, 0.24, 0.22], 0.3), west=M('plasterboard', 0.2), north=M('glass_window', 0.1),
             south=mat([0.2, 0.28, 0.33, 0.3, 0.27, 0.24, 0.22], 0.3), floor=M('linoleum_on_concrete', 0.3), ceiling=mat([0.18, 0.2, 0.22, 0.22, 0.2, 0.18, 0.18], 0.2))),
  'gym': dict(dims=[40, 30, 11], src=[6, 15, 1.2], lis={'podium': [9, 15, 1.6], 'center': [20, 15, 1.2], 'back': [35, 15, 1.2]},
      m=dict(east=mat([0.12, 0.1, 0.08, 0.08, 0.08, 0.08, 0.08], 0.08), west=mat([0.12, 0.1, 0.08, 0.08, 0.08, 0.08, 0.08], 0.08),
             north=M('glass_window', 0.05), south=mat([0.12, 0.1, 0.08, 0.08, 0.08, 0.08, 0.08], 0.08),
             floor=mat([0.26, 0.24, 0.24, 0.22, 0.19, 0.17, 0.17], 0.2), ceiling=mat([0.5, 0.42, 0.3, 0.22, 0.18, 0.16, 0.16], 0.1))),
  'outdoor': dict(dims=[90, 90, 50], src=[8, 45, 1.5], lis={'podium': [11, 45, 1.6], 'center': [24, 45, 1.2], 'back': [36, 45, 1.2]},
      m=dict(east=M('brickwork', 0.2), west=mat([1.0] * 7, 0.0), north=mat([1.0] * 7, 0.0), south=mat([1.0] * 7, 0.0),
             floor=M('rough_concrete', 0.3), ceiling=mat([1.0] * 7, 0.1))),
  'civic': dict(dims=[32, 24, 14], src=[5, 12, 1.4], lis={'podium': [8, 12, 1.6], 'center': [18, 12, 1.2], 'back': [28, 12, 1.2]},
      m=dict(east=mat([0.3, 0.3, 0.25, 0.2, 0.15, 0.12, 0.1], 0.3), west=M('wooden_lining', 0.4), north=M('wooden_lining', 0.4), south=M('wooden_lining', 0.4),
             floor=M('chairs_medium_upholstered', 0.6), ceiling=M('plasterboard', 0.3))),
  'camp': dict(dims=[20, 13, 7], src=[4, 6.5, 1.3], lis={'podium': [7, 6.5, 1.6], 'center': [12, 6.5, 1.2], 'back': [18, 6.5, 1.2]},
      m=dict(east=M('wooden_lining', 0.4), west=M('wooden_lining', 0.4), north=M('curtains_cotton_0.5', 0.3), south=M('wood_16mm', 0.3),
             floor=M('stage_floor', 0.3), ceiling=mat([0.2, 0.25, 0.3, 0.3, 0.3, 0.3, 0.3], 0.3))),
  'hall': dict(dims=[42, 28, 17], src=[6, 14, 1.4], lis={'podium': [9, 14, 1.6], 'center': [22, 14, 1.2], 'back': [37, 14, 1.2]},
      m=dict(east=mat([0.12, 0.1, 0.09, 0.08, 0.08, 0.08, 0.08], 0.5), west=mat([0.12, 0.09, 0.07, 0.06, 0.06, 0.06, 0.06], 0.5),
             north=mat([0.12, 0.09, 0.07, 0.06, 0.06, 0.06, 0.06], 0.6), south=mat([0.12, 0.09, 0.07, 0.06, 0.06, 0.06, 0.06], 0.6),
             floor=mat([0.5, 0.6, 0.7, 0.75, 0.75, 0.72, 0.68], 0.7), ceiling=mat([0.1, 0.08, 0.06, 0.05, 0.05, 0.05, 0.05], 0.5))),
  'grand': dict(dims=[50, 32, 20], src=[7, 16, 1.4], lis={'podium': [10, 16, 1.6], 'center': [27, 16, 1.2], 'back': [44, 16, 1.2]},
      m=dict(east=mat([0.14, 0.11, 0.09, 0.08, 0.08, 0.08, 0.08], 0.5), west=mat([0.13, 0.1, 0.08, 0.07, 0.07, 0.07, 0.07], 0.5),
             north=mat([0.13, 0.1, 0.08, 0.07, 0.07, 0.07, 0.07], 0.6), south=mat([0.13, 0.1, 0.08, 0.07, 0.07, 0.07, 0.07], 0.6),
             floor=mat([0.46, 0.56, 0.64, 0.68, 0.68, 0.66, 0.62], 0.7), ceiling=mat([0.1, 0.08, 0.06, 0.05, 0.05, 0.05, 0.05], 0.5))),
}
def simulate(vid, pos, n_rays=12000):
    v = VEN[vid]
    room = pra.ShoeBox(v['dims'], fs=FS, materials=v['m'], max_order=3, ray_tracing=True, air_absorption=True)
    room.set_ray_tracing(receiver_radius=0.6, n_rays=n_rays, energy_thres=1e-6, time_thres=4.5)
    room.add_source(v['src'])
    L = v['lis'][pos]
    # 1m間隔の2本のマイク（左右の響きが自然にずれて広がる）
    room.add_microphone_array(np.array([[L[0], L[0]], [L[1] - 0.5, L[1] + 0.5], [L[2], L[2]]]))
    room.compute_rir()
    return room, [np.asarray(room.rir[m][0], dtype=np.float64) for m in range(2)]
if __name__ == '__main__':
    vid, pos = sys.argv[1], sys.argv[2]
    t = time.time()
    room, rirs = simulate(vid, pos)
    rt = [pra.experimental.measure_rt60(r, fs=FS, decay_db=30) for r in rirs]
    print(vid, pos, 'len', len(rirs[0]) / FS, 's  RT60(T30)', [round(x, 2) for x in rt], 'time', round(time.time() - t, 1), 's')
