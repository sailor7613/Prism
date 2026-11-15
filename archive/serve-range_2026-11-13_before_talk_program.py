#!/usr/bin/env python3
"""serve-range — the workspace's local server, with byte-range support so browsers can seek
inside large videos (python's plain http.server can't, so scrubbing snaps back to the start).
Usage: python3 Prism/scripts/serve-range.py [port]   (run from the workspace root)"""
import os, re, sys, json, subprocess, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

WS = os.getcwd()   # the workspace root (the .command cd's there)
PG_IN = os.path.join(WS, 'Prism', 'data', 'parallelograms', 'in')
RUNS = {}   # id → {'log': path, 'done': bool, 'ok': bool}

# ── 11-13: the local models. The Drop can ask who reads a set: Sonnet (as before) or a model on this Mac
# (scripts/closedform/local_models.json). A local read is kept apart in data/parallelograms/reads/<model>/ and never
# writes over the standing read. The talk box speaks to a local model through one worker this server holds.
CF = os.path.join(WS, 'Prism', 'scripts', 'closedform'); sys.path.insert(0, CF)
LOCAL_VENV = os.path.expanduser('~/.prism-local/venv/bin/python'); HUB = os.path.expanduser('~/.cache/huggingface/hub')
TALK = threading.Lock()
def local_registry():
    try: reg = json.load(open(os.path.join(CF, 'local_models.json')))['models']
    except Exception: reg = {}
    out = []
    for name, e in reg.items():
        have = next((r for r in e.get('repos', []) if os.path.isdir(os.path.join(HUB, 'models--' + r.replace('/', '--'), 'snapshots'))), None)
        out.append({'name': name, 'label': e.get('label', name), 'by': e.get('by'), 'gb': e.get('gb'), 'note': e.get('note'), 'downloaded': bool(have), 'repo': have})
    return {'installed': os.path.exists(LOCAL_VENV), 'models': out}
def local_name(m):
    m = re.sub(r'[^a-z0-9_-]', '', str(m or '').lower())
    return m if m and m in {x['name'] for x in local_registry()['models']} else None
def out_dir(m): return os.path.join(WS, 'Prism', 'data', 'parallelograms', *(['reads', m] if m else []))
def stop_talk():
    try:
        import derive as D
        p = D._WORKER.get('p')
        if p and p.poll() is None: p.terminate()
    except Exception: pass

def run_parallelogram(pid, path, m=None):
    # 11-08: the drop box — runs the closed form on the Mac (same key file as the .command scripts), log beside the output
    key = pid + ('@' + m if m else ''); os.makedirs(out_dir(m), exist_ok=True)
    log = os.path.join(out_dir(m), f'_run_{pid}.log'); RUNS[key] = {'log': log, 'done': False, 'ok': False}
    env = dict(os.environ, PATH='/opt/homebrew/bin:/usr/local/bin:' + os.environ.get('PATH', ''), PYTHONUNBUFFERED='1')
    if m: env.update(CF_MODEL='local:' + m, CF_MODEL_READ='local:' + m, CF_OUT=m); stop_talk()   # the talk box lets go of its model so the run has the memory
    try:
        cert = subprocess.run(['python3', '-m', 'certifi'], capture_output=True, text=True, env=env).stdout.strip()
        if cert and os.path.exists(cert): env['SSL_CERT_FILE'] = cert
    except Exception: pass
    with open(log, 'w') as f:
        r = subprocess.run(['python3', 'scripts/closedform/parallelogram.py', path] + (['--fresh'] if m else []), cwd=os.path.join(WS, 'Prism'), stdout=f, stderr=subprocess.STDOUT, env=env)
    RUNS[key].update(done=True, ok=(r.returncode == 0))

class RangeHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0)); body = json.loads(self.rfile.read(n) or b'{}')
        if self.path == '/local/talk': return self.talk(body)
        if self.path != '/parallelogram': self.send_error(404); return
        who = local_name(body.get('model'))   # the model asked for, if a local one (m below is the id line's match)
        text = body.get('text', '').strip()
        m = re.search(r'^#\s*id:\s*(.+)$', text, re.M); t = re.search(r'^#\s*title:\s*(.+)$', text, re.M)
        pid = re.sub(r'[^a-z0-9]+', '_', (m.group(1) if m else (t.group(1) if t else 'drop')).lower()).strip('_') or 'drop'
        if not m: text = f'# id: {pid}\n' + text
        os.makedirs(PG_IN, exist_ok=True); path = os.path.join(PG_IN, pid + '.txt'); open(path, 'w').write(text + '\n')
        os.makedirs(out_dir(who), exist_ok=True); pp = os.path.join(out_dir(who), f'_run_{pid}.progress.json')
        if os.path.exists(pp): os.remove(pp)   # a stale progress file would show the last run's end before this one starts
        threading.Thread(target=run_parallelogram, args=(pid, path, who), daemon=True).start()
        out = json.dumps({'id': pid, 'model': who}).encode(); self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(out))); self.end_headers(); self.wfile.write(out)
    def do_GET(self):
        if self.path.startswith('/local/models'): return self.send_json(local_registry())
        if self.path.startswith('/local/compare'):
            from urllib.parse import urlparse, parse_qs
            q = parse_qs(urlparse(self.path).query); pid = re.sub(r'[^a-z0-9_]', '', q.get('id', [''])[0]); m = local_name(q.get('m', [''])[0])
            base = os.path.join(out_dir(None), pid + '.json'); other = os.path.join(out_dir(m), pid + '.json') if m else ''
            if not (m and os.path.exists(base) and os.path.exists(other)): return self.send_json({'ok': False})
            try:
                import importlib, compare as C; importlib.reload(C)
                label = next(x['label'] for x in local_registry()['models'] if x['name'] == m)
                summ, md = C.report(json.load(open(base)), json.load(open(other)), 'the standing read', label)
                open(os.path.join(out_dir(m), pid + '_beside_the_standing_read.md'), 'w').write(md)
                return self.send_json({'ok': True, 'summary': summ, 'report': f'../data/parallelograms/reads/{m}/{pid}_beside_the_standing_read.md'})
            except Exception as e: return self.send_json({'ok': False, 'error': str(e)})
        if self.path.startswith('/parallelogram/status'):
            from urllib.parse import urlparse, parse_qs
            q = parse_qs(urlparse(self.path).query); pid = re.sub(r'[^a-z0-9_]', '', q.get('id', [''])[0]); m = local_name(q.get('m', [''])[0])
            r = RUNS.get(pid + ('@' + m if m else ''))
            log = open(r['log']).read()[-4000:] if r and os.path.exists(r['log']) else ''
            pp = os.path.join(out_dir(m), f'_run_{pid}.progress.json'); prog = None   # 11-08: the run's own progress (grammar lines, scores so far) for the drop's stage
            try:
                if os.path.exists(pp): prog = json.load(open(pp))
            except Exception: prog = None
            out = json.dumps({'id': pid, 'done': bool(r and r['done']), 'ok': bool(r and r['ok']), 'log': log, 'progress': prog}).encode()
            self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(out))); self.send_header('Cache-Control', 'no-cache'); self.end_headers(); self.wfile.write(out); return
        return super().do_GET()
    def send_json(self, o):
        out = json.dumps(o).encode(); self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(out))); self.send_header('Cache-Control', 'no-cache'); self.end_headers(); self.wfile.write(out)
    def talk(self, body):
        # the talk box: one message in, the model's words written back as they come; the last line (after \x1e) is the count
        m = local_name(body.get('model')); msgs = [x for x in body.get('messages', []) if x.get('role') in ('user', 'assistant', 'system') and x.get('content')][-24:]
        self.send_response(200); self.send_header('Content-Type', 'text/plain; charset=utf-8'); self.close_connection = True; self.end_headers()
        def w(t):
            try: self.wfile.write(t.encode()); self.wfile.flush()
            except Exception: pass
        if not m: w('That model is not on the list.'); return
        if not os.path.exists(LOCAL_VENV): w('The local models are not installed yet. Double-click “Install the Local Models.command” first.'); return
        with TALK:
            try:
                import derive as D
                d = D.local_ask({'model': m, 'messages': msgs, 'stream': True, 'max_tokens': 2000}, w)
                w('\x1e' + json.dumps({k: d.get(k) for k in ('error', 'output_tokens', 'secs', 'tps', 'repo', 'think')}))
            except SystemExit as e: w('\x1e' + json.dumps({'error': str(e)}))
            except Exception as e: w('\x1e' + json.dumps({'error': f'{type(e).__name__}: {e}'}))
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
