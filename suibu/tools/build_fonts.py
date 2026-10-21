# 画面で使うフォントを、このゲームに出てくる文字だけに絞って同梱する（オフラインのiOSアプリでも同じ見た目にするため）
# 使い方: python3 tools/build_fonts.py <google/fonts の ofl フォルダ>
# 文章を増やしたら作り直す（入っていない文字は端末の標準フォントで表示される）
import sys, os, glob, subprocess
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OFL = sys.argv[1] if len(sys.argv) > 1 else '/tmp/google-fonts/ofl'
src = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
src += ''.join(open(f, encoding='utf-8').read() for f in sorted(glob.glob(os.path.join(ROOT, 'js/*.js'))))
chars = set(src)
chars |= {chr(c) for c in range(0x20, 0x7f)}                                                # ASCII
chars |= {chr(c) for c in range(0x3000, 0x3040)}                                            # 和文の記号
chars |= {chr(c) for c in range(0x3041, 0x3097)} | {chr(c) for c in range(0x30a0, 0x3100)}  # ひらがな・カタカナ
chars |= {chr(c) for c in range(0xff01, 0xff5f)}                                            # 全角英数
chars |= set('・ー〜…‥「」『』（）【】〈〉《》♪♩♭♯×÷±→←↑↓★☆○●◎△▲▽▼□■◇◆－—–')
chars = ''.join(sorted(c for c in chars if c >= ' '))
OUT = os.path.join(ROOT, 'fonts')
os.makedirs(OUT, exist_ok=True)
for path, name in [('zenkakugothicnew/ZenKakuGothicNew-Regular.ttf', 'zen-kaku-gothic-new-400'),
                   ('zenkakugothicnew/ZenKakuGothicNew-Medium.ttf', 'zen-kaku-gothic-new-500'),
                   ('zenkakugothicnew/ZenKakuGothicNew-Bold.ttf', 'zen-kaku-gothic-new-700'),
                   ('kleeone/KleeOne-SemiBold.ttf', 'klee-one-600'),
                   ('delagothicone/DelaGothicOne-Regular.ttf', 'dela-gothic-one-400')]:
    subprocess.run(['pyftsubset', os.path.join(OFL, path), '--text=' + chars, "--layout-features=*",
                    '--flavor=woff2', '--output-file=' + os.path.join(OUT, name + '.woff2')], check=True)
# Share Tech Mono は名前の予約（Reserved Font Name）があるので、手を加えずそのまま入れる
subprocess.run(['cp', os.path.join(OFL, 'sharetechmono/ShareTechMono-Regular.ttf'), os.path.join(OUT, 'share-tech-mono-400.ttf')], check=True)
for d in ('zenkakugothicnew', 'kleeone', 'delagothicone', 'sharetechmono'):
    subprocess.run(['cp', os.path.join(OFL, d, 'OFL.txt'), os.path.join(OUT, f'OFL-{d}.txt')], check=True)
print(len(chars), 'chars')
