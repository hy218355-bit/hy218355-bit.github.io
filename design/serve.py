#!/usr/bin/env python3
"""デザイン確認用。作業フォルダをlocalhostだけへ配信する。"""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class PreviewHandler(SimpleHTTPRequestHandler):
    # 同じ接続で次のスクリプトも読み、接続を一斉に作り直さない。
    protocol_version = 'HTTP/1.1'

    def setup(self):
        super().setup()
        self.connection.settimeout(30)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


class PreviewServer(ThreadingHTTPServer):
    # 多数のスクリプト・顔・音源を同時に読んでも、接続の入り口を詰まらせない。
    request_queue_size = 128
    daemon_threads = True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8005)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    handler = partial(PreviewHandler, directory=str(root))
    with PreviewServer(('127.0.0.1', args.port), handler) as server:
        print(f'確認用: http://127.0.0.1:{args.port}/', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
