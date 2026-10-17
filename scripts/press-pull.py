#!/usr/bin/env python3
"""press-pull — transcripts for the Press, from Sailor's own Terminal.

The Claude sessions can't reach YouTube or podcast hosts (the proxy allows package registries only),
so the daily pull runs natively on the Mac. Two routes, one output shape:

  youtube   yt-dlp fetches YouTube's own captions (no audio, no model) → transcript.md
  rss       podcast RSS → latest enclosure (mp3) → whisper → transcript.md

Output is the house transcript: a header block, then one `[m:ss] TEXT` line per caption cue,
filed into Parameters/03_Libraries/sources/. The cut is still authored by hand (or by Claude in the
next session) — this script only makes the tape available.

SETUP (once, in Terminal):
  pip3 install yt-dlp                       # the YouTube route
  pip3 install openai-whisper && brew install ffmpeg     # the RSS route (optional)

USE:
  # today's Close, found on the Bloomberg Television channel (the newest 1h20m+ upload)
  python3 Prism/scripts/press-pull.py youtube --find-close

  # a specific video
  python3 Prism/scripts/press-pull.py youtube https://www.youtube.com/watch?v=GEMw6ExKA_Y --program "The Close"

  # a podcast feed's latest episode (whisper, base model by default; --model small for better names)
  python3 Prism/scripts/press-pull.py rss https://feeds.megaphone.fm/<odd-lots-feed-id> --program "Odd Lots"

  # list the newest uploads on a channel without pulling anything
  python3 Prism/scripts/press-pull.py scan @markets
"""
import argparse, datetime as dt, json, os, re, subprocess, sys, tempfile, urllib.request, xml.etree.ElementTree as ET

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SOURCES = os.path.join(ROOT, 'Parameters', '03_Libraries', 'sources')

def need(cmd, hint):
    from shutil import which
    if which(cmd) is None:
        sys.exit(f"'{cmd}' not found. {hint}")

def mmss(sec):
    sec = int(round(sec)); h, r = divmod(sec, 3600); m, s = divmod(r, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"

def slug(s):
    return re.sub(r'[^A-Za-z0-9]+', '_', s).strip('_')

def write_transcript(program, date, title, url, length, lines, route, extra=''):
    os.makedirs(SOURCES, exist_ok=True)
    fn = f"{slug(program)}_{date}_{slug(title)[:60]}_transcript.md"
    path = os.path.join(SOURCES, fn)
    head = [f"# {program} — {date}",
            f"**Source:** {url} · {mmss(length) if length else '—'}",
            f"**Title:** {title}",
            f"**Route:** {route} · pulled {dt.date.today().isoformat()} by press-pull.py (native, Sailor's Mac)",
            "**Filed for:** the Press — cut by hand; only register-touching segments get scored (rule 1).",
            extra, "", "---", ""]
    body = [f"[{mmss(t)}] {txt}" for t, txt in lines]
    open(path, 'w').write("\n".join(head + body) + "\n")
    print(f"filed {os.path.relpath(path, ROOT)}  ({len(lines)} cues)")
    return path

# ── VTT → cues (merges YouTube's rolling duplicates) ──
def parse_vtt(text):
    cues, last = [], None
    for block in re.split(r'\n\s*\n', text):
        m = re.search(r'(\d+):(\d\d):(\d\d)\.(\d+)\s+-->', block) or re.search(r'(\d\d):(\d\d)\.(\d+)\s+-->', block)
        if not m: continue
        g = m.groups()
        t = int(g[0])*3600 + int(g[1])*60 + int(g[2]) if len(g) == 4 else int(g[0])*60 + int(g[1])
        txt = ' '.join(l for l in block.splitlines() if '-->' not in l and not l.strip().isdigit() and l.strip() and not l.startswith(('WEBVTT','Kind:','Language:')))
        txt = re.sub(r'<[^>]+>', '', txt); txt = re.sub(r'\s+', ' ', txt).strip()
        if not txt or txt == last: continue
        # YouTube auto-subs repeat the previous line as a lead-in; keep only the new tail
        if last and txt.startswith(last): txt = txt[len(last):].strip()
        if txt: cues.append((t, txt)); last = txt
    return cues

def ytdlp_json(url, flat=False, n=None):
    need('yt-dlp', 'pip3 install yt-dlp')
    cmd = ['yt-dlp', '-J', '--no-warnings']
    if flat: cmd += ['--flat-playlist']
    if n: cmd += ['--playlist-end', str(n)]
    return json.loads(subprocess.check_output(cmd + [url]))

def route_youtube(url, program):
    need('yt-dlp', 'pip3 install yt-dlp')
    with tempfile.TemporaryDirectory() as td:
        subprocess.check_call(['yt-dlp', '--skip-download', '--write-sub', '--write-auto-sub', '--sub-lang', 'en.*,en',
                               '--sub-format', 'vtt', '--convert-subs', 'vtt', '-o', os.path.join(td, 'v'), '--no-warnings', url])
        vtts = sorted(f for f in os.listdir(td) if f.endswith('.vtt'))
        if not vtts: sys.exit('no captions on this video')
        pref = [v for v in vtts if not re.search(r'\.en[-_.]?orig', v)] or vtts
        cues = parse_vtt(open(os.path.join(td, pref[0]), encoding='utf-8').read())
    info = ytdlp_json(url)
    date = info.get('upload_date', ''); date = f"{date[:4]}-{date[4:6]}-{date[6:]}" if date else dt.date.today().isoformat()
    title = info.get('title', url)
    prog = program or ('The Close' if 'The Close' in title else info.get('channel', 'YouTube'))
    return write_transcript(prog, date, title, url, info.get('duration'), cues, f"yt-dlp captions ({pref[0]})",
                            f"**Channel:** {info.get('channel','')} · uploaded {date}")

def find_close(channel='@markets'):
    j = ytdlp_json(f'https://www.youtube.com/{channel}/videos', flat=True, n=40)
    cands = [e for e in j.get('entries', []) if (e.get('duration') or 0) >= 80*60]
    cands = [e for e in cands if 'Open Interest' not in (e.get('title') or '')]
    if not cands: sys.exit('no 80m+ upload in the newest 40 — The Close may not be posted yet')
    e = cands[0]; print(f"found: {e.get('title')}  {mmss(e.get('duration') or 0)}  {e.get('url') or e.get('id')}")
    return e.get('url') or f"https://www.youtube.com/watch?v={e['id']}"

def route_rss(feed, program, model):
    need('whisper', 'pip3 install openai-whisper  (and: brew install ffmpeg)')
    xml = urllib.request.urlopen(feed, timeout=30).read()
    root = ET.fromstring(xml); item = root.find('./channel/item')
    if item is None: sys.exit('feed has no items')
    title = item.findtext('title') or 'episode'; enc = item.find('enclosure'); mp3 = enc.get('url') if enc is not None else None
    if not mp3: sys.exit('latest item has no enclosure')
    pub = item.findtext('pubDate') or ''
    try: date = dt.datetime.strptime(pub[:16].strip(), '%a, %d %b %Y').date().isoformat()
    except Exception: date = dt.date.today().isoformat()
    prog = program or (root.findtext('./channel/title') or 'podcast')
    with tempfile.TemporaryDirectory() as td:
        audio = os.path.join(td, 'ep.mp3'); print('downloading', mp3); urllib.request.urlretrieve(mp3, audio)
        print(f'whisper ({model}) — this takes a while on a laptop')
        subprocess.check_call(['whisper', audio, '--model', model, '--language', 'en', '--output_format', 'json', '--output_dir', td, '--verbose', 'False'])
        seg = json.load(open(os.path.join(td, 'ep.json')))['segments']
        cues = [(s['start'], s['text'].strip()) for s in seg if s['text'].strip()]
        length = seg[-1]['end'] if seg else None
    return write_transcript(prog, date, title, item.findtext('link') or mp3, length, cues, f'podcast RSS → whisper {model}', f"**Feed:** {feed}")

# ── the sweep: a publication's whole daily output, reduced to headline · dek · opening, matched against the register ──
# Sweep everything, cut only what touches an object. The sweep is mechanical; the cuts cost attention.
SWEEP_FEEDS = {
    # publication → (station, [RSS feeds]). Add/adjust freely; these are the public feeds as of 2026-10.
    'nyt':      ('LI', ['https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml',
                        'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
                        'https://feeds.simplecast.com/54nAGcIl']),  # last = The Daily. (Energy-Environment.xml is 404 as of 2026-10-16 — dropped.)
    'fox':      ('RI?', ['https://moxie.foxnews.com/google-publisher/latest.xml', 'https://moxie.foxnews.com/google-publisher/politics.xml',
                        'https://moxie.foxnews.com/google-publisher/world.xml', 'https://moxie.foxbusiness.com/google-publisher/latest.xml']),
    'grayzone': ('LP', ['https://thegrayzone.com/feed/']),  # verified 10-16: feed is live (WordPress; ~2 posts/week). The Chrome '0 items' was a parse error — Chrome shows raw XML as text, so parse document.body.textContent with DOMParser in-page; native urllib + ElementTree reads it as-is
    'freepress':('RP', ['https://www.thefp.com/feed']),
    'atlantic': ('LI', ['https://www.theatlantic.com/feed/all/']),
    'aljazeera':('LI*', ['https://www.aljazeera.com/xml/rss/all.xml']),
}
DEFAULT_TERMS = {  # object → match terms (lowercase substrings). Extend from the register; keep short and literal.
    'diesel': ['diesel', 'refiner', 'hormuz', 'strait', 'tanker', 'oil price', 'crude', 'opec', 'brent', 'gasoline', 'fuel price', 'energy ceasefire', 'sanction', 'graham'],
    'tx-sen': ['talarico', 'paxton', 'texas senate', 'abbott', 'hinojosa'],
    'me-sen': ['collins', 'troy jackson', 'maine senate'],
}

def strip_html(s):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', s or '')).strip()

def sweep(pubs, objects, out_dir, days=1):
    import email.utils, datetime as _dt
    os.makedirs(out_dir, exist_ok=True)
    today = _dt.date.today();
    # manifest for the SWEEP face (static server: no directory listing)
    mf = os.path.join(out_dir, 'index.json')
    try: M = json.load(open(mf))
    except Exception: M = {'schema': 'press/sweeps-manifest/v0', 'dates': []}
    if today.isoformat() not in M['dates']: M['dates'].append(today.isoformat()); M['dates'].sort()
    json.dump(M, open(mf, 'w'), ensure_ascii=False, indent=1) since = _dt.datetime.now(_dt.timezone.utc) - _dt.timedelta(days=days)
    terms = {o: DEFAULT_TERMS.get(o, [o]) for o in objects}
    report = {'schema': 'press/sweep/v0', 'date': today.isoformat(), 'publications': {}, 'queue': []}
    for pub in pubs:
        if pub not in SWEEP_FEEDS: print('unknown publication', pub, '— add it to SWEEP_FEEDS'); continue
        station, feeds = SWEEP_FEEDS[pub]; items = {}
        for f in feeds:
            try: xml = urllib.request.urlopen(urllib.request.Request(f, headers={'User-Agent': 'press-pull/0.1'}), timeout=30).read()
            except Exception as e: print(f'  {pub}: feed failed {f} ({e})'); continue
            try: root = ET.fromstring(xml)
            except ET.ParseError: continue
            ns = {'atom': 'http://www.w3.org/2005/Atom', 'content': 'http://purl.org/rss/1.0/modules/content/', 'itunes': 'http://www.itunes.com/dtds/podcast-1.0.dtd'}
            for it in root.iter('item'):
                link = (it.findtext('link') or it.findtext('guid') or '').strip()
                if not link or link in items: continue
                pub_dt = it.findtext('pubDate');
                try: dt = email.utils.parsedate_to_datetime(pub_dt) if pub_dt else None
                except Exception: dt = None
                if dt and dt.tzinfo and dt < since: continue
                title = strip_html(it.findtext('title')); dek = strip_html(it.findtext('description'))
                body = strip_html(it.findtext('content:encoded', namespaces=ns) or it.findtext('itunes:summary', namespaces=ns) or '')
                items[link] = {'title': title, 'dek': dek[:600], 'opening': body[:1500], 'published': dt.isoformat() if dt else None, 'link': link, 'feed': f}
        hits = []
        for it in items.values():
            hay = (it['title'] + ' ' + it['dek'] + ' ' + it['opening']).lower()
            matched = {o: [t for t in ts if t in hay] for o, ts in terms.items()}
            matched = {o: t for o, t in matched.items() if t}
            if matched:
                it2 = dict(it, publication=pub, station=station, matched=matched); hits.append(it2)
        report['publications'][pub] = {'station': station, 'items': len(items), 'hits': len(hits)}
        report['queue'] += hits
        print(f'{pub:10s} {station:4s} swept {len(items):4d}  touching {", ".join(objects)}: {len(hits)}')
    path = os.path.join(out_dir, f'sweep_{today.isoformat()}.json')
    json.dump(report, open(path, 'w'), ensure_ascii=False, indent=1)
    print(f'queue → {os.path.relpath(path, ROOT)}  ({len(report["queue"])} pieces to cut; the rest is swept and dropped)')
    return path

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='route', required=True)
    w = sub.add_parser('sweep', help="sweep publications' RSS output for pieces touching an object; writes Prism/data/press/sweeps/sweep_<date>.json")
    w.add_argument('--pubs', default='nyt,fox,grayzone,freepress', help='comma list from SWEEP_FEEDS')
    w.add_argument('--objects', default='diesel', help='comma list of objects (keys in DEFAULT_TERMS, or literal terms)')
    w.add_argument('--days', type=int, default=1)
    y = sub.add_parser('youtube'); y.add_argument('url', nargs='?'); y.add_argument('--program'); y.add_argument('--find-close', action='store_true'); y.add_argument('--channel', default='@markets')
    r = sub.add_parser('rss'); r.add_argument('feed'); r.add_argument('--program'); r.add_argument('--model', default='base')
    s = sub.add_parser('scan'); s.add_argument('channel', nargs='?', default='@markets'); s.add_argument('-n', type=int, default=20)
    a = ap.parse_args()
    if a.route == 'sweep':
        sweep([p.strip() for p in a.pubs.split(',') if p.strip()], [o.strip() for o in a.objects.split(',') if o.strip()],
              os.path.join(ROOT, 'Prism', 'data', 'press', 'sweeps'), a.days); return
    if a.route == 'youtube':
        url = find_close(a.channel) if a.find_close else a.url
        if not url: sys.exit('give a URL or --find-close')
        route_youtube(url, a.program)
    elif a.route == 'rss':
        route_rss(a.feed, a.program, a.model)
    else:
        j = ytdlp_json(f'https://www.youtube.com/{a.channel}/videos', flat=True, n=a.n)
        for e in j.get('entries', []): print(f"{mmss(e.get('duration') or 0):>8}  {e.get('title')}  ·  {e.get('url') or e.get('id')}")

if __name__ == '__main__':
    main()
