"""Local dev server that tells browsers not to cache, so every reload
(Safari included) picks up the latest HTML, CSS, JS and frames.

Usage: python3 scripts/dev-server.py [port]   (default 5173)
"""

import functools
import http.server
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    handler = functools.partial(NoCacheHandler, directory=ROOT)
    with http.server.ThreadingHTTPServer(("", port), handler) as server:
        print(f"Serving {ROOT} at http://localhost:{port}")
        server.serve_forever()
