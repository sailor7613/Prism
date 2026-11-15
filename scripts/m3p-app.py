#!/usr/bin/env python3
"""m3p-app.py — the M3P as its own window on this Mac, no browser (2026-11-13).

Started by M3P.app (made by "Make the M3P App.command"). It runs under the private Python at ~/.prism-local/venv.
  1. if the workspace server is not already answering on port 5500, it starts one (scripts/serve-range.py) and
     stops it again when the window closes; a server already running in a Terminal window is used as it is
  2. it opens one native window (macOS's own web view, through pywebview) on the M3P: Prism/g4/index.html
Log: ~/.prism-local/m3p-app.log"""
import os, sys, time, subprocess, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__)); WS = os.path.dirname(os.path.dirname(HERE))
PORT = 5500; BASE = f'http://127.0.0.1:{PORT}'; LOG = os.path.expanduser('~/.prism-local/m3p-app.log')

def up():
    try:
        with urllib.request.urlopen(BASE + '/Prism/g4/index.html', timeout=1.5) as r: return r.status == 200
    except Exception: return False

def main():
    import webview
    srv = None
    if not up():
        env = dict(os.environ, PATH='/opt/homebrew/bin:/usr/local/bin:' + os.environ.get('PATH', '/usr/bin:/bin'), PYTHONUNBUFFERED='1')
        log = open(LOG, 'a'); log.write(f'\n── {time.strftime("%Y-%m-%d %H:%M:%S")} · starting the server\n'); log.flush()
        srv = subprocess.Popen([sys.executable, os.path.join('Prism', 'scripts', 'serve-range.py'), str(PORT)], cwd=WS, stdout=log, stderr=log, env=env)
        for _ in range(60):
            if up(): break
            time.sleep(0.25)
    page = BASE + '/Prism/g4/index.html' if up() else 'data:text/html,<body style="background:%23060b1a;color:%23f6f1e6;font:18px Georgia;padding:60px">The M3P could not start its server. The log is at ~/.prism-local/m3p-app.log. Tell Claude.</body>'
    webview.create_window('M3P', page, width=1440, height=900, min_size=(380, 600), background_color='#060b1a')
    store = os.path.expanduser('~/.prism-local/webview'); os.makedirs(store, exist_ok=True)
    try:
        try: webview.start(private_mode=False, storage_path=store)   # the window keeps what a browser would keep, between launches
        except TypeError: webview.start()
    finally:
        if srv and srv.poll() is None:
            srv.terminate()
            try: srv.wait(timeout=5)
            except Exception: srv.kill()

if __name__ == '__main__':
    main()
