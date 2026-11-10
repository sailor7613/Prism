#!/usr/bin/env python3
"""serve-range — the workspace's local server, with byte-range support so browsers can seek
inside large videos (python's plain http.server can't, so scrubbing snaps back to the start).
Usage: python3 Prism/scripts/serve-range.py [port]   (run from the workspace root)"""
import os, re, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class RangeHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        rng = self.headers.get('Range')
        path = self.translate_path(self.path)
        if not rng or os.path.isdir(path) or not os.path.isfile(path):
            return super().send_head()
        m = re.match(r'bytes=(\d*)-(\d*)', rng)
        size = os.path.getsize(path)
        if not m:
            return super().send_head()
        a, b = m.group(1), m.group(2)
        start = int(a) if a else max(0, size - int(b))
        end = int(b) if (a and b) else size - 1
        end = min(end, size - 1)
        if start > end:
            self.send_error(416); return None
        f = open(path, 'rb'); f.seek(start)
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(end - start + 1))
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        self._remaining = end - start + 1
        return f
    def copyfile(self, source, outputfile):
        n = getattr(self, '_remaining', None)
        if n is None: return super().copyfile(source, outputfile)
        try:
            while n > 0:
                chunk = source.read(min(1 << 20, n))
                if not chunk: break
                outputfile.write(chunk); n -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass   # the browser cancels range requests all the time while seeking
        finally:
            self._remaining = None
    def end_headers(self):
        if not self.headers.get('Range'):
            self.send_header('Accept-Ranges', 'bytes'); self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
    def log_message(self, *a): pass

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5500
    ThreadingHTTPServer(('', port), RangeHandler).serve_forever()
