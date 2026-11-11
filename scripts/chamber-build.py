#!/usr/bin/env python3
"""chamber-build — Congress as the Object's chamber mode reads it (Sailor + Claude, 2026-11-11).

Writes data/active/chamber.json: who sits in each chamber, and how they voted — small enough for the villa to load
(prism_votes.json is 6 MB; this is tens of KB).

WHO SITS is taken from the roll calls themselves, not from the members file: a roll call lists every sitting
member, so the latest roll call in each chamber IS the chamber on that day. (The members file is as old as its last
refresh and still carries people who have left; it is used only to look up a member's party, state and name.)
A member the sweep could not match to an id is kept, with the party and state the roll call itself printed.

WHAT IS IN IT
  seats    per chamber: the count by party on the latest roll call, and that roll call's date
  members  per chamber: id, name, party, state, and d1 (DW-NOMINATE first dimension, where the members file has it;
           used only to order a party's points from its far end toward the aisle)
  votes    the topic's own votes (object.json → topics.<prevalent>.law), then the latest roll calls in each chamber;
           each with its totals and each sitting member's position: y yea · n nay · p present · x not voting

Independents are counted as independents. They are on neither party's end of the beam.
Run after the vote sweep (and after object-build.py, for the topic's votes). On GitHub it runs in the three-hourly scan and in
the ten-minute chamber watch (.github/workflows/chamber-watch.yml); the file is theirs — pull before building it on the Mac.
Usage: python3 scripts/chamber-build.py [--latest 8]"""
import json, os, re, sys, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda *p: os.path.join(ROOT, 'data', *p)
LATEST = int(sys.argv[sys.argv.index('--latest') + 1]) if '--latest' in sys.argv else 8
MON = {m: i + 1 for i, m in enumerate('jan feb mar apr may jun jul aug sep oct nov dec'.split())}


def iso(s):
    """'9-Jan-2023' (the House) or 'June 24, 2026,  10:30 PM' (the Senate) → '2026-06-24'."""
    s = (s or '').strip()
    m = re.match(r'(\d{1,2})-([A-Za-z]{3})-(\d{4})', s)
    if m: return '%04d-%02d-%02d' % (int(m.group(3)), MON[m.group(2).lower()], int(m.group(1)))
    m = re.match(r'([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})', s)
    if m: return '%04d-%02d-%02d' % (int(m.group(3)), MON[m.group(1)[:3].lower()], int(m.group(2)))
    m = re.match(r'(\d{4})-(\d{2})-(\d{2})', s)
    return m.group(0) if m else None


V = json.load(open(D('prism_votes.json')))
MEM = {m['bioguideId']: m for m in json.load(open(D('prism_members.json')))}
try: OBJ = json.load(open(D('active', 'object.json')))
except Exception: OBJ = None

votes = [v for v in V['votes'] if iso(v.get('date'))]
for v in votes: v['_d'] = iso(v['date'])
CONGRESS = max(v['congress'] for v in votes)
cur = sorted([v for v in votes if v['congress'] == CONGRESS], key=lambda v: (v['_d'], v.get('roll') or 0, v['voteId']))
CODE = {'yea': 'y', 'nay': 'n', 'present': 'p', 'notVoting': 'x'}


def unmatched(u):
    """'Armstrong (R-OK) → nay' → (id, name, party, state, position)"""
    m = re.match(r'\s*(.+?)\s*\(([A-Z])-([A-Z]{2})\)\s*(?:→|->)\s*(\w+)', u)
    if not m: return None
    name, party, st, pos = m.groups()
    return 'x:' + name + ':' + st, name, party, st, {'yea': 'y', 'nay': 'n', 'present': 'p'}.get(pos.lower(), 'x' if 'not' in pos.lower() else pos[:1].lower())


def positions(v):
    out = {}
    for k, c in CODE.items():
        for i in v['positions'].get(k, []): out[i] = c
    for u in v.get('unmatched', []):
        r = unmatched(u)
        if r: out[r[0]] = r[4]
    return out


def roster(v):
    rows = []
    for i in positions(v):
        if i.startswith('x:'):
            _, name, st = i.split(':'); party = next((unmatched(u)[2] for u in v['unmatched'] if unmatched(u) and unmatched(u)[0] == i), '?')
            rows.append({'id': i, 'name': name, 'party': party, 'state': st, 'd1': None})
        else:
            m = MEM.get(i)
            rows.append({'id': i, 'name': (m or {}).get('lastName') or i, 'party': (m or {}).get('party') or '?', 'state': (m or {}).get('state'), 'd1': (m or {}).get('nominateD1')})
    return rows


out = {'what': 'Congress as the Object\'s chamber mode reads it — who sits (from the latest roll call in each chamber) and how they voted. Built by scripts/chamber-build.py.',
       'built': datetime.datetime.now().isoformat(timespec='seconds'), 'votesSwept': V.get('generated'), 'congress': CONGRESS,
       'positionCodes': 'y yea · n nay · p present · x not voting', 'chambers': {}, 'votes': []}
sitting = {}
for ch in ('senate', 'house'):
    cv = [v for v in cur if v['chamber'] == ch]
    if not cv: continue
    last = cv[-1]; R = roster(last); sitting[ch] = {r['id'] for r in R}
    seats = {}
    for r in R: seats[r['party']] = seats.get(r['party'], 0) + 1
    out['chambers'][ch] = {'asOf': last['_d'], 'asOfVote': last['voteId'], 'seats': seats, 'total': len(R), 'members': R}


def pack(v, why):
    pos = {i: c for i, c in positions(v).items() if i in sitting.get(v['chamber'], ())}
    t = v['totals']
    return {'id': v['voteId'], 'chamber': v['chamber'], 'date': v['_d'], 'bill': v.get('billId'), 'title': (v.get('desc') or '')[:140], 'question': v.get('question'), 'result': v.get('result'),
            'yea': t.get('yea'), 'nay': t.get('nay'), 'present': t.get('present'), 'notVoting': t.get('notVoting'), 'party': v.get('party'), 'why': why, 'pos': pos}


seen = set()
if OBJ:   # the topic's own votes first
    tid = OBJ.get('prevalent'); law = ((OBJ.get('topics') or {}).get(tid) or {}).get('law') or []
    out['topic'] = {'id': tid, 'label': ((OBJ.get('topics') or {}).get(tid) or {}).get('label')}
    for e in law:
        m = [v for v in cur if v['chamber'] == e['chamber'] and v.get('billId') == e['bill'] and v['_d'] == e['date'] and (v.get('question') or '') == e.get('what')]
        if not m: m = [v for v in cur if v['chamber'] == e['chamber'] and v.get('billId') == e['bill'] and v['_d'] == e['date']]
        for v in m[:1]:
            if v['voteId'] not in seen: seen.add(v['voteId']); out['votes'].append(pack(v, 'topic'))
for ch in ('senate', 'house'):
    for v in [v for v in cur if v['chamber'] == ch][-LATEST:]:
        if v['voteId'] not in seen: seen.add(v['voteId']); out['votes'].append(pack(v, 'latest'))
out['votes'].sort(key=lambda v: (v['date'], v['id']))

p = D('active', 'chamber.json')
# Written only when something in it changed, so a check that finds no new roll call leaves the file — and the repo — alone.
same = False
try:
    old = json.load(open(p)); strip = lambda o: {k: v for k, v in o.items() if k not in ('built', 'votesSwept')}
    same = strip(old) == strip(json.loads(json.dumps(out)))
except Exception: pass
if same: print('nothing new — data/active/chamber.json left as it was')
else: json.dump(out, open(p + '.tmp', 'w'), ensure_ascii=False, separators=(',', ':')); os.replace(p + '.tmp', p)
for ch, c in out['chambers'].items(): print(f"{ch}: {c['total']} sitting on {c['asOf']} ({c['asOfVote']}) — " + ' · '.join(f"{k} {n}" for k, n in sorted(c['seats'].items())))
print(f"{len(out['votes'])} votes ({sum(1 for v in out['votes'] if v['why'] == 'topic')} on the topic) → data/active/chamber.json, {os.path.getsize(p) // 1024} KB")
