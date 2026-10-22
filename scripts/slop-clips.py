#!/usr/bin/env python3
"""slop-clips — what commentary is actually being passed around today, read off Reddit (keyless).

Part of the daily slop (the Action .github/workflows/press-sweep.yml). Reddit's public JSON is the one free,
stable signal of which clips are circulating: every subreddit exposes /top.json?t=day with scores and the links
people posted. A balanced basket of subreddits (one per corner plus the show subs) is read; posts that link a
video (YouTube · X · TikTok · Rumble · Instagram) are kept and ranked by score. YouTube links are resolved to their
channel through YouTube's oEmbed endpoint (keyless), so a clip becomes a *show*; shows already on the roster are
marked, the rest are roster candidates for the WIRE intake tray.

Writes data/press/clips/clips_<date>.json {basket, clips[], channels[], candidates[]} + clips/index.json.
Rulings (which candidates join the roster, and at which station) are Sailor's; this file only counts.

  python3 scripts/slop-clips.py              # today
  python3 scripts/slop-clips.py --limit 40   # more posts per subreddit
"""
import argparse, datetime as dt, json, os, re, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
PRISM = os.path.abspath(os.path.join(HERE, '..'))
PRESS = os.path.join(PRISM, 'data', 'press')
OUT = os.path.join(PRESS, 'clips')
UA = {'User-Agent': 'prism-daily-slop/1.0 (research; contact via github.com/sailor7613/Prism)'}

# The basket. `corner` is only a reading aid for the tray — a subreddit is a crowd, not a station.
BASKET = [
    ('politics', 'LI'), ('neoliberal', 'LI'), ('Defeat_Project_2025', 'LI'),
    ('Conservative', 'RI'), ('tuesday', 'RI'), ('moderatepolitics', 'RI'),
    ('stupidpol', 'LP'), ('BreakingPoints', 'LP'), ('WayOfTheBern', 'LP'), ('chapotraphouse', 'LP'),
    ('Libertarian', 'RP'), ('JoeRogan', 'RP'), ('TuckerCarlson', 'RP'), ('walkaway', 'RP'),
    ('PoliticalVideo', '—'), ('PublicFreakout', '—'), ('videos', '—'), ('Economics', '—'),
]
VIDEO_HOSTS = ('youtube.com', 'youtu.be', 'x.com', 'twitter.com', 'tiktok.com', 'rumble.com', 'instagram.com', 'v.redd.it', 'streamable.com')


def log(*a): print(*a, flush=True)


def get_json(url, tries=2):
    for i in range(tries):
        try:
            return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20).read())
        except Exception as e:
            err = e
            if url.startswith('https://www.reddit.com') and i == 0: url = url.replace('https://www.reddit.com', 'https://old.reddit.com')
            time.sleep(3)
    raise err


def reddit_token():
    """Reddit's official API (free). Reddit blocks anonymous reads from GitHub's runners; with a registered
    'script' app (REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET in the Action's secrets) reads go through oauth.reddit.com."""
    cid, sec = os.environ.get('REDDIT_CLIENT_ID'), os.environ.get('REDDIT_CLIENT_SECRET')
    if not (cid and sec): return None
    import base64
    req = urllib.request.Request('https://www.reddit.com/api/v1/access_token', data=b'grant_type=client_credentials',
                                 headers=dict(UA, Authorization='Basic ' + base64.b64encode(f'{cid}:{sec}'.encode()).decode()))
    try: return json.loads(urllib.request.urlopen(req, timeout=20).read()).get('access_token')
    except Exception as e: log(f'reddit auth failed: {str(e)[:80]} — falling back to anonymous reads'); return None


def host_of(url):
    try: return urllib.parse.urlparse(url).netloc.lower().removeprefix('www.').removeprefix('m.').removeprefix('old.')
    except Exception: return ''


def youtube_channel(url, cache):
    """YouTube link → (channel name, channel url) via oEmbed. Keyless; cached per video."""
    if url in cache: return cache[url]
    try:
        d = get_json('https://www.youtube.com/oembed?format=json&url=' + urllib.parse.quote(url, safe=''), tries=1)
        cache[url] = (d.get('author_name'), d.get('author_url'), d.get('title'))
    except Exception:
        cache[url] = (None, None, None)
    return cache[url]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--limit', type=int, default=25, help='posts per subreddit (top of the day)')
    ap.add_argument('--date', default=dt.date.today().isoformat())
    a = ap.parse_args()

    roster = json.load(open(os.path.join(PRESS, 'roster.json'), encoding='utf-8'))
    roster_handles = {(s.get('channel') or '').lower().lstrip('@'): s['id'] for s in roster['sources'] if s.get('channel')}
    roster_names = {s['name'].lower(): s['id'] for s in roster['sources']}

    clips, failed = [], []
    token = reddit_token()
    if token: UA['Authorization'] = 'Bearer ' + token
    base = 'https://oauth.reddit.com' if token else 'https://www.reddit.com'
    log('reddit: ' + ('official API (app keys found)' if token else 'anonymous reads (no app keys; GitHub runners are usually blocked)'))
    if not token and os.environ.get('GITHUB_ACTIONS'):
        log('no Reddit app keys on the Action — leaving the clips to the Mac (Pull the Transcripts.command runs this scan from a home connection)'); return 0
    for sub, corner in BASKET:
        url = f'{base}/r/{sub}/top.json?t=day&limit={a.limit}&raw_json=1'
        try: d = get_json(url)
        except Exception as e:
            failed.append({'subreddit': sub, 'why': str(e)[:100]}); log(f'r/{sub:20s} failed: {str(e)[:80]}'); continue
        n = 0
        for ch in d.get('data', {}).get('children', []):
            p = ch.get('data', {}); link = p.get('url_overridden_by_dest') or p.get('url') or ''
            h = host_of(link)
            is_video = any(h == v or h.endswith('.' + v) for v in VIDEO_HOSTS) or p.get('is_video')
            if not is_video: continue
            clips.append({'subreddit': sub, 'corner': corner, 'title': p.get('title'), 'link': link, 'host': h,
                          'score': p.get('score', 0), 'comments': p.get('num_comments', 0), 'ratio': p.get('upvote_ratio'),
                          'posted': dt.datetime.fromtimestamp(p.get('created_utc', 0), dt.timezone.utc).isoformat(),
                          'permalink': 'https://www.reddit.com' + p.get('permalink', '')})
            n += 1
        log(f'r/{sub:20s} {corner:3s} video posts {n}')
        time.sleep(1.2)  # be polite; Reddit rate-limits anonymous clients around 10/min

    # resolve YouTube clips to shows
    cache, by_channel = {}, {}
    for c in clips:
        if c['host'] in ('youtube.com', 'youtu.be'):
            name, curl, title = youtube_channel(c['link'], cache)
            c['channel'], c['channelUrl'], c['videoTitle'] = name, curl, title
            if name:
                handle = (curl or '').rsplit('/', 1)[-1].lower().lstrip('@')
                k = handle or name.lower()
                e = by_channel.setdefault(k, {'channel': name, 'channelUrl': curl, 'handle': handle or None, 'clips': 0, 'score': 0,
                                              'corners': {}, 'onRoster': roster_handles.get(handle) or roster_names.get(name.lower())})
                e['clips'] += 1; e['score'] += c['score']; e['corners'][c['corner']] = e['corners'].get(c['corner'], 0) + 1
    channels = sorted(by_channel.values(), key=lambda e: -e['score'])
    candidates = [e for e in channels if not e['onRoster'] and (e['clips'] >= 2 or e['score'] >= 1500)]
    clips.sort(key=lambda c: -c['score'])

    os.makedirs(OUT, exist_ok=True)
    report = {'schema': 'press/clips/v0', 'date': a.date, 'what': 'the clips crowd on Reddit passed around today — a reading of what commentary is circulating, not a station',
              'basket': [{'subreddit': s, 'corner': c} for s, c in BASKET], 'failed': failed,
              'clips': clips[:200], 'channels': channels, 'candidates': candidates}
    json.dump(report, open(os.path.join(OUT, f'clips_{a.date}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    mf = os.path.join(OUT, 'index.json')
    try: M = json.load(open(mf, encoding='utf-8'))
    except Exception: M = {'schema': 'press/clips-manifest/v0', 'dates': []}
    if a.date not in M['dates']: M['dates'].append(a.date); M['dates'].sort()
    json.dump(M, open(mf, 'w', encoding='utf-8'), indent=1)
    log(f'\nclips_{a.date}.json — {len(clips)} video posts, {len(channels)} shows resolved, {len(candidates)} roster candidates, {len(failed)} subreddits failed')


if __name__ == '__main__':
    sys.exit(main() or 0)
