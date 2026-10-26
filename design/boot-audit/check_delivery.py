# localhostの配信を、同時取得と同じ接続での続け読みで確かめる。
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
from http.client import HTTPConnection
import json
from pathlib import Path
import re
import threading
import time


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, required=True)
    parser.add_argument('--rounds', type=int, default=3)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    html = (root / 'tsukurikata/index.html').read_text()
    files = re.findall(r'<script src="(js/[^"?]+)', html)
    report = {'port': args.port, 'rounds': [], 'persistent': []}

    for round_no in range(args.rounds):
        gate = threading.Barrier(len(files))

        def fetch(file):
            conn = HTTPConnection('127.0.0.1', args.port, timeout=1)
            gate.wait()
            started = time.monotonic()
            try:
                conn.request('GET', '/tsukurikata/' + file + '?delivery=' + str(round_no))
                response = conn.getresponse()
                body = response.read()
                expected = (root / 'tsukurikata' / file).read_bytes()
                return {'file': file, 'status': response.status, 'bytes': len(body),
                        'same': hashlib.sha256(body).digest() == hashlib.sha256(expected).digest(),
                        'ms': round((time.monotonic() - started) * 1000)}
            except Exception as error:
                return {'file': file, 'error': type(error).__name__, 'message': str(error)}
            finally:
                conn.close()

        with ThreadPoolExecutor(max_workers=len(files)) as pool:
            report['rounds'].append(list(pool.map(fetch, files)))

    conn = HTTPConnection('127.0.0.1', args.port, timeout=2)
    try:
        for file in files[:3]:
            conn.request('GET', '/tsukurikata/' + file)
            response = conn.getresponse()
            body = response.read()
            report['persistent'].append({'file': file, 'status': response.status, 'version': response.version,
                                         'connectionCloses': response.will_close, 'cache': response.getheader('Cache-Control'),
                                         'same': body == (root / 'tsukurikata' / file).read_bytes()})
    finally:
        conn.close()

    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    failures = sum('error' in r or not r.get('same') or r.get('status') != 200 for rs in report['rounds'] for r in rs)
    print(json.dumps({'port': args.port, 'requests': len(files) * args.rounds, 'failures': failures,
                      'persistent': report['persistent']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
