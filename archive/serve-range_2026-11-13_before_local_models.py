#!/usr/bin/env python3
"""serve-range — the workspace's local server, with byte-range support so browsers can seek
inside large videos (python's plain http.server can't, so scrubbing snaps back to the start).
Usage: python3 Prism/scripts/serve-range.py [port]   (run from the workspace root)"""
import os, re, sys, json, subprocess, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

WS = os.getcwd()   # the workspace root (the .command cd's there)
PG_IN = os.path.join(WS, 'Prism', 'data', 'parallelograms', 'in')
RUNS = {}   # id → {'log': path, 'done': bool, 'ok': bool}

def run_parallelogram(pid, path):
    # 11-08: the drop box — runs the closed form on the Mac (same key file as the .command scripts), log beside the output
    log = os.path.join(WS, 'Prism', 'data', 'parallelograms', f'_run_{pid}.log'); RUNS[pid] = {'log': log, 'done': False, 'ok': False}
    env = dict(os.environ, PATH='/opt/homebrew/bin:/usr/local/bin:' + os.environ.get('PATH', ''))
    try:
        cert = subprocess.run(['python3', '-m', 'certifi'], capture_output=True, text=True, env=env).stdout.strip()
        if cert and os.path.exists(cert): env['SSL_CERT_FILE'] = cert
    except Exception: pass
    with open(log, 'w') as f:
        r = subprocess.run(['python3', 'scripts/closedform/parallelogram.py', path], cwd=os.path.join(WS, 'Prism'), stdout=f, stderr=subprocess.STDOUT, env=env)
    RUNS[pid].update(done=True, ok=(r.returncode == 0))

class RangeHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != '/parallelogram': self.send_error(404); return
        n = int(self.headers.get('Content-Length', 0)); body = json.loads(self.rfile.read(n) or b'{}')
        text = body.get('text', '').strip()
        m = re.search(r'^#\s*id:\s*(.+)$', text, re.M); t = re.search(r'^#\s*title:\s*(.+)$', text, re.M)
        pid = re.sub(r'[^a-z0-9]+', '_', (m.group(1) if m else (t.group(1) if t else 'drop')).lower()).strip('_') or 'drop'
        if not m: text = f'# id: {pid}\n' + text
        os.makedirs(PG_IN, exist_ok=True); path = os.path.join(PG_IN, pid + '.txt'); open(path, 'w').write(text + '\n')
        pp = os.path.join(WS, 'Prism', 'data', 'parallelograms', f'_run_{pid}.progress.json')
        if os.path.exists(pp): os.remove(pp)   # a stale progress file would show the last run's end before this one starts
        threading.Thread(target=run_parallelogram, args=(pid, path), daemon=True).start()
        out = json.dumps({'id': pid}).encode(); self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(out))); self.end_headers(); self.wfile.write(out)
    def do_GET(self):
        if self.path.startswith('/parallelogram/status'):
            pid = re.sub(r'[^a-z0-9_]', '', self.path.split('id=')[-1]); r = RUNS.get(pid)
            log = open(r['log']).read()[-4000:] if r and os.path.exists(r['log']) else ''
            pp = os.path.join(WS, 'Prism', 'data', 'parallelograms', f'_run_{pid}.progress.json'); prog = None   # 11-08: the run's own progress (grammar lines, scores so far) for the drop's stage
            try:
                if os.path.exists(pp): prog = json.load(open(pp))
            except Exception: prog = None
            out = json.dumps({'id': pid, 'done': bool(r and r['done']), 'ok': bool(r and r['ok']), 'log': log, 'progress': prog}).encode()
            self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(out))); self.send_header('Cache-Control', 'no-cache'); self.end_headers(); self.wfile.write(out); return
        return super().do_GET()
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
