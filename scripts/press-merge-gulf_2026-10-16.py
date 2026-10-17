#!/usr/bin/env python3
"""Merge the NYT 2026-10-15 'Gulf Oil Is Still Flowing' beta lede (H6, LI) into the paper, detection rows, sightings and the sweep queue. Idempotent.
Usage: python3 press-merge-gulf_2026-10-16.py <repo root>"""
import json, sys, os
ROOT = sys.argv[1]; P = os.path.join(ROOT, 'Prism/data/press/'); A = os.path.join(ROOT, 'Prism/data/active/')
PID = 'nyt_2026-10-15_gulf_oil_flowing_lede'
SRC = 'Press · NYT 2026-10-15 "Gulf Oil Is Still Flowing" (beta lede; cut: Parameters/09_Parallelograms/Press/2026-10-15_NYT_Gulf_Oil_Flowing/spec.json)'
piece = json.load(open(P + PID + '.json')); sb = piece['scoreboard']
idx = json.load(open(P + 'index.json'))
if not any(p['id'] == PID for p in idx['pieces']):
    idx['pieces'].insert(0, {'id': PID, 'title': piece['title'], 'date': '2026-10-15', 'program': 'The New York Times', 'format': 'print', 'partial': 'beta lede', 'arc': 'PG01', 'status': 'claude-draft', 'kind': 'parallelogram', 'station': 'LI', 'dia': sb['dia'], 'lumens': sb['lumens'], 'readZ': sb['readZ'],
        'dek': 'The first LI reading on H6 — the Strait as CENTCOM claims it. The headline credits the flow, the dek prices it, and the two trackers in the paragraphs disagree on the direction: TankerTrackers up on September, Kpler down.',
        'lede': 'A beta lede: six paragraphs before the wall. Dia 16 · read z +0.1 · Lumens 84. Both trackers put October throughput at 10–12 million barrels a day — under H6’s own 15-million falsifier line, if the units match CENTCOM’s 19 million. They may not. Not a Diesel Index piece: a different object.',
        'network': 'The New York Times', 'index': None})
    json.dump(idx, open(P + 'index.json', 'w'), ensure_ascii=False, indent=1)
new = [
 {'id': 'evt-press-gulf-throughput-oct', 'theater': 'gulf', 'kind': 'flow', 'asOf': '2026-10-15', 'detected': '2026-10-16',
  'what': 'October-to-date throughput through the Strait of Hormuz: TankerTrackers >12M bbl/d crude on average (slightly above September); Kpler ≈10M bbl/d (down from ≈11M in September). By report; verify units (crude vs all liquids) against the trackers’ releases.',
  'source': SRC + ' · ¶5–¶6 (T)', 'pg01': 'H6 record — both figures under the 15M falsifier line; unit caveat before scoring', 'press': {'line': '¶5', 'who': 'SM', 'station': 'LI', 'touch': 'T', 'dia': 10, 'z': 0.4}, 'verified': False},
 {'id': 'evt-press-gulf-26-struck', 'theater': 'gulf', 'kind': 'strike', 'asOf': '2026-10-15', 'detected': '2026-10-16',
  'what': '26 vessels struck in the Strait of Hormuz so far in October (maritime-incident trackers) — the most dangerous period of the war for shipping; a 730-ft container ship sank Wednesday 10-14 after a projectile hit. By report.',
  'source': SRC + ' · ¶2 (T)', 'pg01': 'H6 record — the sinking clause; the detection series (sinkings) for the tracker', 'press': {'line': '¶2', 'who': 'PE', 'station': 'LI', 'touch': 'T', 'dia': 8, 'z': -0.5}, 'verified': False},
]
E = json.load(open(A + 'events.json')); have = {r['id'] for r in E['rows']}; E['rows'] += [r for r in new if r['id'] not in have]
json.dump(E, open(A + 'events.json', 'w'), ensure_ascii=False, indent=1)
X = json.load(open(A + 'active.json')); blk = X.get('events')
if isinstance(blk, dict) and isinstance(blk.get('rows'), list):
    have = {r['id'] for r in blk['rows']}; blk['rows'] += [r for r in new if r['id'] not in have]
X['pressMergedAt'] = '2026-10-16'; json.dump(X, open(A + 'active.json', 'w'), ensure_ascii=False, indent=1)
O = json.load(open(P + 'objects_seen.json')); have = {s['id'] for s in O['sightings']}
sight = [
 {'id': 'see-gulf-1015-h6-throughput', 'piece': PID, 'program': 'The New York Times', 'date': '2026-10-15', 't': ['¶5', '¶6'], 'object': 'Strait throughput in October: 10–12M bbl/d by two trackers, pulling opposite ways', 'kind': 'PG', 'holder': None, 'analog': {'type': None, 'ref': 'H6 (proposed; CENTCOM 19M on 10-12)'}, 'match': {'dataset': 'PG01', 'ref': 'H6 record — under the 15M line; unit caveat'}, 'scored': True},
 {'id': 'see-gulf-1015-26-struck', 'piece': PID, 'program': 'The New York Times', 'date': '2026-10-15', 't': ['¶2'], 'object': '26 vessels struck in October; the 10-14 sinking', 'kind': 'tracker', 'holder': None, 'analog': {'type': None, 'ref': None}, 'match': {'dataset': 'tracker', 'ref': 'detection series (sinkings) · evt-press-gulf-26-struck'}, 'scored': True},
 {'id': 'see-gulf-1015-prewar-sept', 'piece': PID, 'program': 'The New York Times', 'date': '2026-10-15', 't': ['¶3'], 'object': 'Middle East exports near prewar levels in September under US escort', 'kind': 'tracker', 'holder': None, 'analog': {'type': None, 'ref': None}, 'match': {'dataset': 'tracker', 'ref': 'flows — PG01 §5'}, 'scored': True},
 {'id': 'see-gulf-1015-freight', 'piece': PID, 'program': 'The New York Times', 'date': '2026-10-15', 't': ['dek'], 'object': 'transport costs "skyrocketed" (unsized)', 'kind': 'PG', 'holder': None, 'analog': {'type': None, 'ref': None}, 'match': {'dataset': 'PG01', 'ref': 'layer 2 — the toll series (L2-toll-4)'}, 'scored': True},
]
O['sightings'] += [s for s in sight if s['id'] not in have]
O['log'].append({'date': '2026-10-16', 'what': 'NYT Gulf Oil 10-15 (beta lede) objects pass: 4 sightings; H6 record filed', 'by': 'Claude'})
json.dump(O, open(P + 'objects_seen.json', 'w'), ensure_ascii=False, indent=1)
S = json.load(open(P + 'sweeps/sweep_2026-10-16.json'))
for q in S['queue']:
    if 'Gulf Oil Is Still Flowing' in (q.get('title') or ''): q['status'] = PID + ' (beta lede — wall after ¶6; H6 record filed)'; q['cut'] = PID
S['log'].append({'date': '2026-10-16', 'what': 'Gulf Oil 10-15 cut as a beta lede (H6, LI)', 'by': 'Claude'})
json.dump(S, open(P + 'sweeps/sweep_2026-10-16.json', 'w'), ensure_ascii=False, indent=1)
print('index', len(idx['pieces']), 'events', len(E['rows']), 'sightings', len(O['sightings']))
