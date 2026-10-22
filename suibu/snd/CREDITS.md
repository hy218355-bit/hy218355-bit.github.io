# 録音音源のクレジット

このフォルダの MP3 は、次の録音から必要な音だけを選び、モノラル化・頭出し・音量そろえをして楽器ごとにまとめたものです（作り方は `../tools/build_samples.py`）。

- **Versilian Studios「VSCO 2 Community Edition」**（CC0 1.0）
  https://github.com/sgossner/VSCO-2-CE
  フルート、ピッコロ、オーボエ、ファゴット、クラリネット、ホルン、トランペット、トロンボーン、チューバ、コントラバス（弓・ピチカート）、ティンパニ、スネアドラム、バスドラム、シンバル、サスペンデッドシンバル、トライアングル、タンブリン、タムタム、グロッケン、シロフォン、マリンバ、チャイム、クラベス、スレイベル
- **Karoryfer Samples「Weresax」**（アルトサックス）。tonejs-instruments（https://github.com/nbrosowsky/tonejs-instruments）に収録されたものを、同リポジトリの表記に従い CC BY 3.0 で利用しています。
- **Frank Wen「FluidR3_GM」**（テナーサックス、バリトンサックス、ヴィブラフォン）。midi-js-soundfonts（https://github.com/gleitz/midi-js-soundfonts）で書き出されたものを、同リポジトリの表記に従い CC BY 3.0（https://creativecommons.org/licenses/by/3.0/us/）で利用しています。

E♭クラリネット・バスクラリネットはクラリネット、ユーフォニアム・バストロンボーンはトロンボーンの録音を、高さと明るさを変えて使っています。
和の打楽器は代用です。締太鼓は響き線（スナッピー）を外したスネアドラム、和太鼓はバスドラムを高めに鳴らした音、拍子木はクラベス、鈴はスレイベルの録音です。

録音のない高さ（ホルンの中音域など）は、いちばん近い録音から作っています。Praat（parselmouth）の PSOLA で音色の山を保ったまま高さだけを変え、倍音の強さを両どなりの本物の録音のあいだに合わせています（`../tools/fill_gaps.py`、目録では `gen: 1`）。どの楽器・どの高さでも、再生時に高さをずらす幅は2半音以内です（ホルンの最低音域だけ4半音）。

## 会場の響き（`ir/`）

7つの会場 × 3つの聴く位置の響き（インパルス応答）は録音ではなく、このページのために計算したものです。
部屋の寸法と、壁・床・天井・客席の材質ごとの吸音率から、pyroomacoustics（https://github.com/LCAV/pyroomacoustics 、MIT License）の鏡像法＋音線法で計算し、直接音を取り除いてあります。
点音源の計算では楽器の指向性や反射板の初期反射が入らないため、後半の響きの量だけを実際のホールで測られる明瞭さ（C80）の範囲に合わせています（作り方は `../tools/ir_sim.py` → `../tools/ir_build.py` → `../tools/ir_c80.py`）。
