"""
Static server cho tool gắn nhãn, gửi header no-cache để trình duyệt luôn nạp
bản mới nhất của app.js / styles.css / index.html (khỏi phải hard-refresh sau
mỗi lần cập nhật code).

Chạy: python serve.py [port]   (mặc định 8084). run_server.ps1 gọi file này.
"""

import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8084
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


with socketserver.TCPServer(("127.0.0.1", PORT), NoCacheHandler) as httpd:
    print(f"Serving http://127.0.0.1:{PORT} (no-cache)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
