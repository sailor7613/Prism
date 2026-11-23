#!/usr/bin/env python3
"""
Builds the public M3P — the version of the M3P that goes up at m3prism.com.

  python3 Prism/scripts/build-public.py          (run from the PARALLELOGRAM PRISM folder;
                                                  "Publish the M3P.command" runs it for you)

What it makes, next to the Prism folder:
  _site/         the website. Only the front half of the M3P: the desk, Prism (the map), the model,
                 the reader (Parallelogram opens it), Parallelogram, the Codex, 望, the Report and the DreamGetty — and the data they read.
  _site_media/   the big media files (anything over 20 MB — long video and audio) that go to the R2 bucket instead of
                 the website. _site/_redirects sends each one's old address to the bucket, so no page
                 has to change.

What stays home (never copied): Chat, the Drop, the workstation and classic
Prism, the workbench scripts, the gates, the handoffs, the charter and the safety note, every .md,
every file or folder whose name starts with "_" (run logs, probes, before-copies), dated archive
copies, .wav masters, "_quick" test renders.

Big media go up only if a page names them (like audio.mp3) or they're listed in
Prism/public-media.txt — one path per line, relative to Prism, e.g.  data/show/ep01/ep01_16x9_better.mp4
"""
import os, sys, re, json, shutil, subprocess, fnmatch

HERE = os.path.dirname(os.path.abspath(__file__))
PRISM = os.path.dirname(HERE)
WS = os.path.dirname(PRISM)
OUT = os.environ.get('M3P_SITE_OUT') or os.path.join(WS, '_site')
MEDIA = os.environ.get('M3P_MEDIA_OUT') or os.path.join(WS, '_site_media')
CACHE = os.path.join(WS, '_site_media_cache')     # web encodes of very large videos, kept between runs
CONFIG = os.path.join(PRISM, 'site.json')         # {"media_base": "https://…"} — written by the publish command
EXTRA = os.path.join(PRISM, 'public-media.txt')

# ── what goes up (paths relative to Prism) ──────────────────────────────────────────────
DIRS = ['src', 'pwa', 'g4', 'bloomburger', 'show', 'dreamgetty',
        'data/active', 'data/parallelograms', 'data/press', 'data/show', 'data/chinavision', 'data/slate', 'data/races']
FILES = ['press/prism.html', 'press/model.html', 'press/object.html', 'press/chinavision.html',
         'data/codex.json', 'data/newsroom/objects.json']

# ── what never goes up, wherever it sits ────────────────────────────────────────────────
NEVER_NAMES = ['*.md', '*.MD', '*.wav', '*.WAV', '*.log', '*.py', '*.sh', '*.command', '*.toml',
               'MD5', '.DS_Store', '._*', '*_quick*', '*charter*', '*CHARTER*', '*recusal*', 'CLAUDE*',
               '*.key', '*.pem', '.env', 'package.json', 'package-lock.json']
NEVER_DIRS = ['node_modules', 'archive', 'Archive', 'test', 'tests', 'Handoffs', '.git', '.claude']
DATED = re.compile(r'_(before|20\d\d-\d\d-\d\d)')   # prism_2026-11-15_before_glass.html and the like

# programs the public desk does not carry (the back half, and the retired Prisms)
CUT_PROGRAMS = ['workstation', 'classic', 'drop', 'chat', 'talk']

VIDEO = ('.mp4', '.mov', '.m4v', '.webm')
BIG = 20 * 1024 * 1024          # over this, a file goes to R2 (Pages takes 25 MiB at most)
R2_ONE_PUT = 280 * 1024 * 1024  # over this, a video is re-encoded for the web first
TEXT = ('.html', '.js', '.json', '.css', '.webmanifest', '.txt', '.svg')

def rel(p, base=PRISM): return os.path.relpath(p, base).replace(os.sep, '/')

def private(name, isdir=False):
    if name.startswith('_') or name.startswith('.') and name != '.well-known': return True
    if isdir: return name in NEVER_DIRS or bool(DATED.search(name))
    return any(fnmatch.fnmatch(name, g) for g in NEVER_NAMES) or bool(DATED.search(name))

def walk(top):
    for root, dirs, files in os.walk(top):
        dirs[:] = [d for d in dirs if not private(d, True)]
        for f in files:
            if not private(f): yield os.path.join(root, f)

def main():
    for d in (OUT, MEDIA):
        if os.path.isdir(d): shutil.rmtree(d)
        os.makedirs(d)
    cfg = json.load(open(CONFIG)) if os.path.exists(CONFIG) else {}
    media_base = (cfg.get('media_base') or '').rstrip('/')

    staged, big = [], []                 # (src, rel) for the site; (src, rel) for media candidates
    def take(src):
        r = rel(src)
        (big if os.path.getsize(src) > BIG else staged).append((src, r))
    for d in DIRS:
        p = os.path.join(PRISM, d)
        if os.path.isdir(p):
            for f in walk(p): take(f)
        else: print('  (not found, skipped)', d)
    for f in FILES:
        p = os.path.join(PRISM, f)
        if os.path.exists(p): take(p)
        else: print('  (not found, skipped)', f)

    for src, r in staged:
        dst = os.path.join(OUT, r); os.makedirs(os.path.dirname(dst), exist_ok=True); shutil.copy2(src, dst)

    # ── the desk: g4/index.html, with the back-half programs taken off, served at the root as well ──
    g4 = os.path.join(OUT, 'g4', 'index.html'); html = open(g4, encoding='utf-8').read()
    lines, kept = html.split('\n'), []
    for ln in lines:
        if re.match(r'\s*(' + '|'.join(CUT_PROGRAMS) + r')\s*:\s*\{', ln): continue   # PROGRAMS entries
        if 'class="g4-tile" href="#chat"' in ln: continue                              # the Chat tile
        if 'href="#classic"' in ln: continue                                           # "prism · classic ↗"
        kept.append(ln)
    html = '\n'.join(kept)
    open(g4, 'w', encoding='utf-8').write(html)
    # at the root: '../x' from '/' is '/x', so the same file works as m3prism.com/
    open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(html)
    shutil.copy2(os.path.join(OUT, 'g4', 'manifest.webmanifest'), os.path.join(OUT, 'manifest.webmanifest'))

    # ── every path the pages name that the site does not have ──
    texts = {}
    for root, _, files in os.walk(OUT):
        for f in files:
            if f.endswith(TEXT):
                try: texts[os.path.join(root, f)] = open(os.path.join(root, f), encoding='utf-8', errors='ignore').read()
                except Exception: pass
    alltext = '\n'.join(texts.values())
    missing, added = set(), []
    pat = re.compile(r"""['"`]((?:\.\./)+[A-Za-z0-9_./%-]+\.[A-Za-z0-9]{2,5})(?:\?[^'"`]*)?['"`]""")
    for path, t in texts.items():
        if not path.endswith(('.html', '.js')): continue     # data files name paths from Prism's root; only pages and scripts fetch
        # a script's paths resolve against the page that loads it; every page sits one folder down
        here = os.path.dirname(path) if not path.endswith('.js') else os.path.join(OUT, 'g4')
        for m in pat.finditer(t):
            target = os.path.normpath(os.path.join(here, m.group(1)))
            if not target.startswith(OUT): continue
            r = rel(target, OUT)
            if os.path.exists(target) or any(r == b[1] for b in big): continue
            src = os.path.join(PRISM, r)
            if os.path.exists(src) and not any(private(part, i < len(r.split('/')) - 1) for i, part in enumerate(r.split('/'))):
                if os.path.getsize(src) > BIG: big.append((src, r))
                else:
                    os.makedirs(os.path.dirname(target), exist_ok=True); shutil.copy2(src, target); added.append(r)
            else: missing.add(r)

    # ── big media: to R2 only if a page names it, or it's on the list ──
    wanted = set()
    if os.path.exists(EXTRA):
        wanted = {l.strip().lstrip('./') for l in open(EXTRA) if l.strip() and not l.startswith('#')}
    redirects, sent, dropped = [], [], []
    for src, r in big:
        name = os.path.basename(r)
        if r not in wanted and name not in alltext: dropped.append(r); continue
        f = src
        if src.lower().endswith(VIDEO) and os.path.getsize(src) > R2_ONE_PUT: f = web_encode(src, r)
        if not f: dropped.append(r + '  (too big, and no ffmpeg to make a web copy)'); continue
        dst = os.path.join(MEDIA, r); os.makedirs(os.path.dirname(dst), exist_ok=True)
        try: os.link(f, dst)
        except Exception: shutil.copy2(f, dst)
        sent.append(r)
        if media_base: redirects.append(f'/{r} {media_base}/{r} 302')
    if redirects:
        open(os.path.join(OUT, '_redirects'), 'w').write('\n'.join(redirects) + '\n')
    open(os.path.join(OUT, '_headers'), 'w').write('/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n')

    # ── the checks: nothing private, nothing too big, not too many files ──
    leaks = []
    for path, t in texts.items():
        if re.search(r'sk-ant-[A-Za-z0-9_-]{20,}', t): leaks.append(f'{rel(path, OUT)}  holds what looks like an Anthropic key')
        for needle in ('/local/talk', '/local/models', 'ANTHROPIC_API_KEY ='):
            if needle in t: leaks.append(f'{rel(path, OUT)}  mentions  {needle}')
    nfiles, toobig = 0, []
    for root, _, files in os.walk(OUT):
        for f in files:
            nfiles += 1; p = os.path.join(root, f)
            if os.path.getsize(p) > 25 * 1024 * 1024: toobig.append(rel(p, OUT))

    size = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(OUT) for f in fs)
    msize = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(MEDIA) for f in fs)
    print(f'  site:  {nfiles} files, {size/1048576:.1f} MB  →  _site/')
    print(f'  media: {len(sent)} files, {msize/1048576:.1f} MB  →  _site_media/  (to R2)')
    if added: print(f'  pulled in because a page names them: {len(added)}', *added[:12], sep='\n    ')
    if dropped: print(f'  big media left home (no page names them; add to Prism/public-media.txt to send): {len(dropped)}', *dropped[:20], sep='\n    ')
    if missing: print(f'  named by a page but kept private or not on disk: {len(missing)}', *sorted(missing)[:20], sep='\n    ')
    if sent and not media_base: print('  ! no media address yet — the publish command sets it; the big files are not linked until then')
    if toobig: print('  ✗ over 25 MB on the site (Pages will refuse):', *toobig, sep='\n    ')
    if nfiles > 19000: print('  ✗ more than 19,000 files — Pages takes 20,000 at most')
    if leaks: print('  ✗ private things found in the site:', *leaks, sep='\n    ')
    ok = not (toobig or leaks or nfiles > 19000)
    json.dump({'ok': ok, 'files': nfiles, 'media': sent}, open(os.path.join(MEDIA, '.manifest.json'), 'w'), indent=1)
    sys.exit(0 if ok else 2)

def web_encode(src, r):
    ff = shutil.which('ffmpeg') or next((p for p in ('/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg') if os.path.exists(p)), None)
    if not ff: return None
    st = os.stat(src); out = os.path.join(CACHE, r)
    stamp = out + '.from'; key = f'{st.st_size}:{int(st.st_mtime)}'
    if os.path.exists(out) and os.path.exists(stamp) and open(stamp).read() == key: return out
    os.makedirs(os.path.dirname(out), exist_ok=True)
    print(f'  making a web copy of {r} ({st.st_size/1048576:.0f} MB) — a few minutes …', flush=True)
    cmd = [ff, '-y', '-v', 'error', '-i', src, '-vf', "scale='min(1920,iw)':-2", '-c:v', 'libx264', '-preset', 'veryfast',
           '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out]
    if subprocess.run(cmd).returncode != 0: return None
    open(stamp, 'w').write(key)
    return out if os.path.getsize(out) <= R2_ONE_PUT else None

if __name__ == '__main__':
    main()
