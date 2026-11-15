#!/usr/bin/env python3
"""compare.py — the scorer: sets one read of a parallelogram beside another and says where they differ (2026-11-13).

  python3 scripts/closedform/compare.py <base .json> <other .json> [--out <report .md>] [--name-a Sonnet --name-b Gemma]

The base is the standing read (a Sonnet baseline). The other is a second read of the same input: Sonnet again (which
gives the spread a model has against itself) or a local model. Lines are paired by post and by how alike their quotes
are, since two reads may cut a post into lines differently. For every pair it checks, field by field:
  grammar     station · about (object or shadow) · measure · z word · due (is it a forecast)
  relational  tier · Dia (how many points apart) · object · others · capital · facing
  forecast    the call (right / wrong / open)
and it prints the totals first, then every line that differs. Nothing is scored here; it only counts agreement."""
import json, sys, os, difflib, statistics

def load(p): return json.load(open(p))
def norm(s): return ' '.join(str(s or '').lower().split())

def pair(A, B):
    """Pair lines within the same post by quote likeness (best first). Returns pairs, lines only in A, lines only in B."""
    pairs = []; usedB = set()
    byB = {}
    for j, b in enumerate(B): byB.setdefault(b.get('post'), []).append(j)
    cands = []
    for i, a in enumerate(A):
        for j in byB.get(a.get('post'), []):
            r = difflib.SequenceMatcher(None, norm(a.get('quote')), norm(B[j].get('quote'))).ratio()
            cands.append((r, i, j))
    usedA = set()
    for r, i, j in sorted(cands, reverse=True):
        if i in usedA or j in usedB or r < 0.45: continue
        usedA.add(i); usedB.add(j); pairs.append((i, j, r))
    pairs.sort()
    return pairs, [i for i in range(len(A)) if i not in usedA], [j for j in range(len(B)) if j not in usedB]

ZSTEP = {'realized strongly': 3, 'realized': 2, 'leaning realized': 1, 'neither': 0, 'leaning frustrated': -1, 'frustrated': -2, 'frustrated strongly': -3}
def zside(l):
    """Which side a line takes on z, strength left out: realized, frustrated, or neither. None on a shadow line."""
    if l.get('about') == 'shadow': return None
    v = ZSTEP.get(l.get('zWord'), 0); return 'realized' if v > 0 else 'frustrated' if v < 0 else 'neither'
def fc(l): return (l.get('forecast') or {}).get('result')
FIELDS = [('station', lambda l: l.get('station')), ('about', lambda l: l.get('about')), ('measure', lambda l: l.get('measure')),
          ('z word', lambda l: None if l.get('about') == 'shadow' else l.get('zWord')), ('z side', zside), ('is a forecast', lambda l: bool(l.get('due'))),   # 11-14: a shadow line carries no z, so the word a model put on it is not compared; z side = the same side, whatever the strength
          ('tier', lambda l: l.get('tier')), ('object', lambda l: (l.get('relational') or {}).get('object')),
          ('others', lambda l: (l.get('relational') or {}).get('others')), ('capital', lambda l: (l.get('relational') or {}).get('capital')),
          ('facing', lambda l: (l.get('relational') or {}).get('facing')), ('lumens', lambda l: 'unmeasured' if l.get('lumens') == 'unmeasured' else 'measured'),
          ('forecast call', fc)]

def compare(a, b):
    A, B = a['lines'], b['lines']; pairs, onlyA, onlyB = pair(A, B)
    agree = {f: 0 for f, _ in FIELDS}; diffs = []; dd = []
    for i, j, r in pairs:
        la, lb = A[i], B[j]; d = []
        for f, get in FIELDS:
            if get(la) == get(lb): agree[f] += 1
            else: d.append((f, get(la), get(lb)))
        if la.get('dia') is not None and lb.get('dia') is not None:
            gap = abs(la['dia'] - lb['dia']); dd.append(gap)
            if gap > 5: d.append(('Dia', la['dia'], lb['dia']))
        if d: diffs.append((la, lb, d))
    n = len(pairs) or 1
    out = {'lines': [len(A), len(B)], 'paired': len(pairs), 'onlyA': len(onlyA), 'onlyB': len(onlyB),
           'agree': {f: round(100 * v / n) for f, v in agree.items()},
           'diaGapMean': round(statistics.mean(dd), 1) if dd else None, 'diaGapMax': max(dd) if dd else None,
           'diaWithin5': round(100 * sum(1 for x in dd if x <= 5) / len(dd)) if dd else None,
           'board': [a.get('scoreboard', {}), b.get('scoreboard', {})]}
    return out, diffs, [A[i] for i in onlyA], [B[j] for j in onlyB]

def report(a, b, na, nb):
    s, diffs, oa, ob = compare(a, b); sa, sb = s['board']
    R = [f"# {a.get('title') or a.get('id')} — {na} beside {nb}", '',
         f"*{na}: {a.get('at')} · {nb}: {b.get('at')}*", '',
         '## The totals', '',
         f"| | {na} | {nb} |", '|---|---|---|',
         f"| lines | {s['lines'][0]} | {s['lines'][1]} |"] + \
        [f"| {lab} | {sa.get(k)} | {sb.get(k)} |" for lab, k in (('Dia', 'dia'), ('z', 'readZ'), ('Lumens', 'lumensTracked'), ('measured', 'measured'))] + \
        ['', f"{s['paired']} lines pair up. {s['onlyA']} are only in {na}'s read, {s['onlyB']} only in {nb}'s.", '',
         '## How often the two agree, on the lines that pair up', '', '| field | agree |', '|---|---|'] + \
        [f"| {f} | {v}% |" for f, v in s['agree'].items()] + \
        [f"| Dia within 5 points | {s['diaWithin5']}% |", '',
         f"Dia is {s['diaGapMean']} points apart on average, {s['diaGapMax']} at the most.", '', f"## The lines that differ ({len(diffs)})", '']
    for la, lb, d in diffs:
        R.append(f"**{la.get('i')} · {la.get('who')} · {la.get('date')}** — “{(la.get('quote') or '')[:140]}”")
        R += [f"- {f}: {na} **{x}** · {nb} **{y}**" for f, x, y in d] + ['']
    for lab, L in ((f'Only in {na}', oa), (f'Only in {nb}', ob)):
        if L: R += [f'## {lab} ({len(L)})', ''] + [f"- post {l.get('post')} · “{(l.get('quote') or '')[:140]}”" for l in L] + ['']
    return s, '\n'.join(R)

if __name__ == '__main__':
    a = sys.argv[1:]
    def opt(k, d=None): return a[a.index(k) + 1] if k in a else d
    files = [x for i, x in enumerate(a) if not x.startswith('--') and (i == 0 or not a[i - 1].startswith('--'))]
    A, B = load(files[0]), load(files[1]); na, nb = opt('--name-a', 'base'), opt('--name-b', 'other')
    s, md = report(A, B, na, nb)
    out = opt('--out')
    if out: os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True); open(out, 'w').write(md); print('→', out)
    print(f"{A.get('id')}: {s['paired']}/{s['lines'][0]} lines pair · tier {s['agree']['tier']}% · Dia within 5: {s['diaWithin5']}% (mean gap {s['diaGapMean']}) · about {s['agree']['about']}% · measure {s['agree']['measure']}% · z word {s['agree']['z word']}% (side {s['agree']['z side']}%) · forecast call {s['agree']['forecast call']}%")
