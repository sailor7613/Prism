#!/usr/bin/env python3
"""slop-day — the room, a day at a time: the slop sweep on a topic through the closed form (Sailor + Claude, 2026-11-09).

One day's sweep (data/press/sweeps/sweep_<date>.json), filtered to one object, becomes a parallelogram: one post per
item (headline — dek), the publication as the speaker, its roster station, the item's date. It runs through the closed
form like any other parallelogram, and the day's scoreboard becomes the day's reading of THE ROOM in
data/active/discourse.json: [date, read z, sigma (the spread of the lines' z, floor 0.15), {dia, lines, perStation, ...}].
Then object-build.py folds it into object.json as the topic's room (the daily average of the light on it). The room never lights a line; a line gets
room = its z − the room's z on its date.

  python3 scripts/closedform/slop-day.py [date|today|all] [--object iran] [--runs 3] [--dry]

all = every sweep on disk not yet read. The model answers questions; the rules make every number. Haiku throughout
(CF_MODEL_READ) — headlines are short; set CF_MODEL_READ=claude-sonnet-5-5 to read them with Sonnet."""
import json, os, sys, glob, re, subprocess, datetime, statistics, html
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
SW = os.path.join(ROOT, 'data', 'press', 'sweeps'); IN = os.path.join(ROOT, 'data', 'parallelograms', 'in')
OUTD = os.path.join(ROOT, 'data', 'parallelograms'); DISC = os.path.join(ROOT, 'data', 'active', 'discourse.json')
OBJECTS = {'iran': 'PG01 — the Iran war (war start 2026-02-28)'}
STATION = {'LI': 'LI', 'RI': 'RI', 'LP': 'LP', 'RP': 'RP', 'RI?': 'RI', 'LP+RP': None, 'RP?': 'RP', 'LI?': 'LI', 'LP?': 'LP'}   # None: the model proposes

def clean(t):
    t = html.unescape(t or ''); t = re.sub(r'https?://\S+', '', t); t = re.sub(r'\s+', ' ', t).strip()
    # the publication's boilerplate after the sentence that matters
    t = re.split(r'\s(?:MS NOW:|» |Subscribe|Follow us|#\w+\s*$|Watch the full|Download the)', t)[0].strip()
    return t

def build_input(date, obj):
    f = os.path.join(SW, f'sweep_{date}.json')
    if not os.path.exists(f): return None, f'no sweep for {date}'
    s = json.load(open(f)); rows = [r for r in s.get('queue', []) if obj in (r.get('matched') or {})]
    if not rows: return None, f'{date}: no items on {obj}'
    pid = f'slop_{obj}_{date}'; p = os.path.join(IN, pid + '.txt')
    head = [f'# title: The Room — {obj} · {date}', f'# id: {pid}', f'# object: {OBJECTS.get(obj, obj)}',
            f'# context: Claude: the slop sweep of {date} ({len(rows)} items on {obj} across {len({r["source"] for r in rows})} publications): each item is its headline and dek, the publication as the speaker. A reading of the room, not the object. Labeled, never scored.']
    body = []
    for r in rows:
        st = STATION.get(r.get('station') or '', None); day = (r.get('published') or date)[:10]
        text = clean(r.get('title', '')); dek = clean(r.get('dek') or r.get('opening') or '')
        if dek and dek.lower() != text.lower(): text += ' — ' + dek
        if not text: continue
        tag = ' · '.join(x for x in [r.get('source', 'unknown'), st, day, r.get('link')] if x)
        body.append('@' + tag + '\n' + text)
    open(p, 'w').write('\n'.join(head) + '\n---\n' + '\n---\n'.join(body) + '\n')
    return p, f'{pid}: {len(body)} items'

def reading(pid, date):
    D = json.load(open(os.path.join(OUTD, pid + '.json'))); S = D['scoreboard']
    L = [l for l in D['lines'] if l.get('dia') is not None]; zz = [l['z'] for l in L if l.get('z') is not None]
    if not zz: return None
    sigma = max(0.15, round(statistics.pstdev(zz), 3)) if len(zz) > 1 else 0.15
    per = {}
    for st in ('LI', 'RI', 'LP', 'RP'):
        q = [l['z'] for l in L if l['station'] == st and l.get('z') is not None]
        if q: per[st] = round(sum(q) / len(q), 2)
    return [date, S['readZ'], sigma, {'dia': S['dia'], 'lines': len(L), 'measured': len(zz), 'shadow': len(L) - len(zz), 'perStation': per, 'lumens': S.get('lumensTracked'), 'id': pid}]

def main():
    a = sys.argv[1:]; obj = a[a.index('--object') + 1] if '--object' in a else 'iran'
    runs = a[a.index('--runs') + 1] if '--runs' in a else '3'; dry = '--dry' in a
    skip = {obj, runs}; which = [x for x in a if not x.startswith('--') and x not in skip]
    which = which[0] if which else 'today'
    disc = json.load(open(DISC)) if os.path.exists(DISC) else {'what': 'the room — the slop sweep read through the closed form, one reading a day per object (slop-day.py)', 'objects': {}}
    have = {r[0] for r in disc['objects'].get(obj, {}).get('readings', [])}
    if which == 'today': dates = [datetime.date.today().isoformat()]
    elif which == 'all': dates = sorted(os.path.basename(f)[6:16] for f in glob.glob(os.path.join(SW, 'sweep_*.json')))
    else: dates = [which]
    dates = [d for d in dates if d not in have or which not in ('all',)]
    env = dict(os.environ); env.setdefault('CF_MODEL_READ', 'claude-haiku-5-5')
    for date in dates:
        p, note = build_input(date, obj); print(note)
        if not p: continue
        if dry: continue
        r = subprocess.run([sys.executable, os.path.join(HERE, 'parallelogram.py'), p, '--runs', runs], env=env)
        if r.returncode != 0: print(f'{date}: the run failed ({r.returncode})'); continue
        rd = reading(f'slop_{obj}_{date}', date)
        if not rd: print(f'{date}: nothing measured'); continue
        o = disc['objects'].setdefault(obj, {'label': OBJECTS.get(obj, obj), 'readings': []})
        o['readings'] = sorted([x for x in o['readings'] if x[0] != date] + [rd])
        disc['updated'] = datetime.datetime.now().isoformat(timespec='seconds')
        json.dump(disc, open(DISC, 'w'), indent=1, ensure_ascii=False)
        print(f'the room · {obj} · {date}: z {rd[1]:+.2f} ± {rd[2]} · Dia {rd[3]["dia"]} · {rd[3]["measured"]}/{rd[3]["lines"]} measured · {rd[3]["perStation"]}')
    if not dry: subprocess.run([sys.executable, os.path.join(ROOT, 'scripts', 'object-build.py')])

if __name__ == '__main__':
    main()
