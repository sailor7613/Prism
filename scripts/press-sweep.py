#!/usr/bin/env python3
"""press-sweep — the daily mechanical sweep of every source on the roster.

Runs keyless on the GitHub Action (.github/workflows/press-sweep.yml) every morning, or by hand:
  python3 scripts/press-sweep.py            # today, all roster sources
  python3 scripts/press-sweep.py --days 2   # a wider window
  python3 scripts/press-sweep.py --only nyt,the-close

What it does, per source on data/press/roster.json:
  fetch / sweep routes  → its RSS feeds (roster `feeds`, or the built-in table below) → headline · dek · opening
  youtube routes        → the channel's own RSS (channel id resolved once from the @handle and cached in the roster)
                          → every upload in the window; for HITS and BASELINE sources, yt-dlp pulls YouTube's captions
                          (no audio, no model) into data/press/transcripts/<date>/ — non-fatal: a runner IP YouTube
                          refuses leaves `transcript: null` and the cut task pulls it from the Mac
  every item is matched against data/press/terms.json (object → literal terms). Sweep everything, cut only what touches.

Writes: data/press/sweeps/sweep_<date>.json (schema press/sweep/v1 — same shape BloomBurger's SWEEP face and the
media tiles already read: publications[<sweepKey>] {station, items, hits, note}, queue[...]), sweeps/index.json
(the manifest), and stamps lastScanned + sweepKey on the roster. The cut (scoring) is not done here —
that is the 07:00 PT Claude task (scripts/newsroom/PRESS_PROTOCOL.md).
"""
import argparse, datetime as dt, email.utils, json, os, re, subprocess, sys, urllib.request, xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
PRISM = os.path.abspath(os.path.join(HERE, '..'))
PRESS = os.path.join(PRISM, 'data', 'press')
ROSTER = os.path.join(PRESS, 'roster.json')
TERMS = os.path.join(PRESS, 'terms.json')
SWEEPS = os.path.join(PRESS, 'sweeps')
TRANSCRIPTS = os.path.join(PRESS, 'transcripts')
UA = {'User-Agent': 'Mozilla/5.0 (compatible; prism-press-sweep/1.0)'}
NS = {'atom': 'http://www.w3.org/2005/Atom', 'content': 'http://purl.org/rss/1.0/modules/content/',
      'itunes': 'http://www.itunes.com/dtds/podcast-1.0.dtd', 'media': 'http://search.yahoo.com/mrss/',
      'yt': 'http://www.youtube.com/xml/schemas/2015'}

# Public feeds for the fetch/sweep sources, keyed by roster id. A roster entry's own `feeds` list overrides this.
FEEDS = {
    'nyt': ['https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml',
            'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
            'https://feeds.simplecast.com/54nAGcIl'],  # last = The Daily
    'fox': ['https://moxie.foxnews.com/google-publisher/latest.xml', 'https://moxie.foxnews.com/google-publisher/politics.xml',
            'https://moxie.foxnews.com/google-publisher/world.xml', 'https://moxie.foxbusiness.com/google-publisher/latest.xml'],
    'grayzone': ['https://thegrayzone.com/feed/'],
    'free-press': ['https://www.thefp.com/feed'],
    'atlantic': ['https://www.theatlantic.com/feed/all/'],
    'al-jazeera': ['https://www.aljazeera.com/xml/rss/all.xml'],
    'npr-pbs': ['https://feeds.npr.org/1001/rss.xml', 'https://feeds.npr.org/1014/rss.xml', 'https://www.pbs.org/newshour/feeds/rss/headlines'],
}
# Podcast feeds for rss-route sources without a channel (fill in when known; the sweep reports "no feed" until then).
PODCASTS = {}


def log(*a): print(*a, flush=True)
def strip_html(s): return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', s or '')).strip()
def slug(s): return re.sub(r'[^A-Za-z0-9]+', '_', s or '').strip('_')


def get(url, timeout=30):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout).read()


def parse_date(s):
    if not s: return None
    try:
        d = email.utils.parsedate_to_datetime(s)
    except Exception:
        try: d = dt.datetime.fromisoformat(s.replace('Z', '+00:00'))
        except Exception: return None
    if d.tzinfo is None: d = d.replace(tzinfo=dt.timezone.utc)
    return d


def rss_items(xml_bytes, feed):
    """RSS 2.0 or Atom (YouTube channel feeds are Atom) → list of item dicts."""
    try: root = ET.fromstring(xml_bytes)
    except ET.ParseError: return []
    out = []
    for it in root.iter('item'):  # RSS
        link = (it.findtext('link') or it.findtext('guid') or '').strip()
        if not link: continue
        body = strip_html(it.findtext('content:encoded', NS) or it.findtext('itunes:summary', NS) or '')
        out.append({'title': strip_html(it.findtext('title')), 'dek': strip_html(it.findtext('description'))[:600],
                    'opening': body[:1500], 'published': parse_date(it.findtext('pubDate')), 'link': link, 'feed': feed})
    for e in root.iter('{http://www.w3.org/2005/Atom}entry'):  # Atom
        linkel = e.find('atom:link', NS); link = (linkel.get('href') if linkel is not None else '') or ''
        vid = e.findtext('yt:videoId', default='', namespaces=NS)
        desc = e.findtext('media:group/media:description', default='', namespaces=NS)
        out.append({'title': strip_html(e.findtext('atom:title', default='', namespaces=NS)), 'dek': strip_html(desc)[:600],
                    'opening': '', 'published': parse_date(e.findtext('atom:published', default='', namespaces=NS)),
                    'link': link, 'feed': feed, 'videoId': vid or None})
    return out


def channel_id(handle):
    """@handle → UC… channel id (one page fetch; cached on the roster after)."""
    h = handle if handle.startswith('@') else '@' + handle
    html = get(f'https://www.youtube.com/{h}', timeout=40).decode('utf-8', 'ignore')
    m = re.search(r'"channelId":"(UC[\w-]+)"', html) or re.search(r'channel_id=(UC[\w-]+)', html)
    if not m: raise RuntimeError(f'no channelId on youtube.com/{h}')
    return m.group(1)


def pull_captions(video_url, out_md, program, title, date):
    """yt-dlp → YouTube's own captions → the house transcript ([m:ss] TEXT). Non-fatal. Returns the path or None."""
    import tempfile, glob
    with tempfile.TemporaryDirectory() as td:
        try:
            subprocess.run(['yt-dlp', '--skip-download', '--write-sub', '--write-auto-sub', '--sub-lang', 'en.*,en',
                            '--sub-format', 'vtt', '--no-warnings', '-o', os.path.join(td, 'v'), video_url],
                           check=True, capture_output=True, timeout=240)
        except Exception as e:
            log(f'    captions failed: {str(e)[:160]}'); return None
        vtts = sorted(glob.glob(os.path.join(td, 'v*.vtt')))
        if not vtts: log('    no captions published for this upload'); return None
        text = open(vtts[0], encoding='utf-8', errors='ignore').read()
    cues, last = [], None
    for blk in re.split(r'\n\s*\n', text):
        m = re.search(r'(\d+):(\d\d):(\d\d)\.\d+\s*-->', blk) or re.search(r'(\d\d):(\d\d)\.\d+\s*-->', blk)
        if not m: continue
        g = [int(x) for x in m.groups()]; sec = g[0] * 3600 + g[1] * 60 + g[2] if len(g) == 3 else g[0] * 60 + g[1]
        words = ' '.join(l for l in blk.splitlines() if '-->' not in l and not l.strip().isdigit())
        words = re.sub(r'<[^>]+>', '', words).strip()
        if words and words != last: cues.append((sec, words)); last = words
    os.makedirs(os.path.dirname(out_md), exist_ok=True)
    def mmss(s): h, r = divmod(int(s), 3600); m, s2 = divmod(r, 60); return f'{h}:{m:02d}:{s2:02d}' if h else f'{m}:{s2:02d}'
    head = [f'# {program} — {date}', f'**Source:** {video_url}', f'**Title:** {title}',
            f'**Route:** yt-dlp captions · pulled {dt.date.today().isoformat()} by press-sweep.py (GitHub Action)',
            '**Filed for:** the Press — cut by the 07:00 task; only register-touching segments get scored (rule 1).', '', '---', '']
    open(out_md, 'w', encoding='utf-8').write('\n'.join(head + [f'[{mmss(t)}] {w}' for t, w in cues]) + '\n')
    log(f'    transcript {os.path.relpath(out_md, PRISM)} ({len(cues)} cues)')
    return os.path.relpath(out_md, PRISM)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--days', type=float, default=1.25, help='window back from now (default 1.25 days so a late upload is never missed between runs)')
    ap.add_argument('--only', default='', help='comma list of roster ids')
    ap.add_argument('--no-captions', action='store_true')
    ap.add_argument('--date', default=dt.date.today().isoformat())
    a = ap.parse_args()

    roster = json.load(open(ROSTER, encoding='utf-8'))
    terms = json.load(open(TERMS, encoding='utf-8')) if os.path.exists(TERMS) else {}
    objects = {k: [t.lower() for t in v] for k, v in terms.get('objects', {}).items()}
    since = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=a.days)
    only = {s.strip() for s in a.only.split(',') if s.strip()}
    report = {'schema': 'press/sweep/v1', 'date': a.date, 'index': terms.get('index', 'roster'), 'objects': sorted(objects),
              'route': 'press-sweep.py on the GitHub Action (keyless; captions via yt-dlp, non-fatal)',
              'publications': {}, 'queue': [], 'log': []}
    tdir = os.path.join(TRANSCRIPTS, a.date)

    for src in roster['sources']:
        sid = src['id']
        if only and sid not in only: continue
        if sid == 'wire': continue
        key = src.get('sweepKey') or sid; src['sweepKey'] = key
        route = (src.get('route') or '').lower()
        feeds, note = [], []
        if src.get('feeds'): feeds = list(src['feeds'])
        elif sid in FEEDS: feeds = list(FEEDS[sid])
        if src.get('channel') and ('youtube' in route):
            try:
                cid = src.get('channelId') or channel_id(src['channel']); src['channelId'] = cid
                feeds.append(f'https://www.youtube.com/feeds/videos.xml?channel_id={cid}')
            except Exception as e:
                note.append(f'channel id failed ({str(e)[:80]})')
        if 'rss' in route and sid in PODCASTS: feeds.append(PODCASTS[sid])
        if not feeds:
            report['publications'][key] = {'station': src.get('station'), 'items': 0, 'hits': 0, 'note': 'no feed on file — add `feeds` to the roster entry'}
            log(f'{sid:16s} {src.get("station",""):5s} no feed'); continue

        items = {}
        for f in feeds:
            try: xml = get(f)
            except Exception as e: note.append(f'feed failed {f.split("//")[-1][:50]} ({str(e)[:60]})'); continue
            for it in rss_items(xml, f):
                if it['published'] and it['published'] < since: continue
                if it['link'] not in items: items[it['link']] = it
        hits = []
        baseline = bool(src.get('baseline'))
        for it in items.values():
            hay = (it['title'] + ' ' + it['dek'] + ' ' + it['opening']).lower()
            matched = {o: [t for t in ts if t in hay] for o, ts in objects.items()}
            matched = {o: t for o, t in matched.items() if t}
            if matched or baseline:
                hits.append(dict(it, publication=key, source=sid, station=src.get('station'), matched=matched, baseline=baseline))
        # captions for the YouTube hits (the baseline always; others only when matched)
        for h in hits:
            h['published'] = h['published'].isoformat() if h['published'] else None
            if h.get('videoId') and not a.no_captions:
                out = os.path.join(tdir, f'{sid}_{h["videoId"]}.md')
                h['transcript'] = os.path.relpath(out, PRISM) if os.path.exists(out) else pull_captions(h['link'], out, src.get('name', sid), h['title'], a.date)
            h.pop('feed', None)
        report['publications'][key] = {'station': src.get('station'), 'items': len(items), 'hits': len(hits),
                                       'feeds': [f.split('//')[-1][:70] for f in feeds], 'note': '; '.join(note) or None}
        report['queue'] += hits
        src['lastScanned'] = a.date
        log(f'{sid:16s} {src.get("station",""):5s} swept {len(items):4d}  hits {len(hits)}' + (f'  [{"; ".join(note)}]' if note else ''))

    report['queue'].sort(key=lambda q: q.get('published') or '', reverse=True)
    os.makedirs(SWEEPS, exist_ok=True)
    path = os.path.join(SWEEPS, f'sweep_{a.date}.json')
    if os.path.exists(path):  # same-day rerun: keep any `cut` marks the task already wrote on queue rows
        try:
            old = {q['link']: q.get('cut') for q in json.load(open(path, encoding='utf-8')).get('queue', []) if q.get('cut')}
            for q in report['queue']:
                if q['link'] in old: q['cut'] = old[q['link']]
        except Exception: pass
    json.dump(report, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    mf = os.path.join(SWEEPS, 'index.json')
    try: M = json.load(open(mf, encoding='utf-8'))
    except Exception: M = {'schema': 'press/sweeps-manifest/v0', 'dates': []}
    if a.date not in M['dates']: M['dates'].append(a.date); M['dates'].sort()
    M['note'] = 'written by press-sweep.py (daily Action) — the SWEEP face reads this to find the day files'
    json.dump(M, open(mf, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(roster, open(ROSTER, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    tot = sum(p['items'] for p in report['publications'].values())
    log(f'\nsweep_{a.date}.json — {tot} items across {len(report["publications"])} sources, {len(report["queue"])} queued for the cut')


if __name__ == '__main__':
    main()
