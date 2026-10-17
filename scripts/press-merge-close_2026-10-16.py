#!/usr/bin/env python3
"""Merge the Close 2026-10-16 baseline cut: index.json, detection rows, sightings, roster lastCut. Idempotent.
Usage: python3 press-merge-close_2026-10-16.py <repo root>"""
import json, sys, os
ROOT = sys.argv[1]; P = os.path.join(ROOT, 'Prism/data/press/'); A = os.path.join(ROOT, 'Prism/data/active/')
PID = 'close_2026-10-16'; SRC = 'Press · The Close 2026-10-16 (baseline; cut: Parameters/09_Parallelograms/Press/2026-10-16_TheClose_Baseline/cut.md)'
piece = json.load(open(P + PID + '.json')); sb = piece['scoreboard']
idx = json.load(open(P + 'index.json'))
if not any(p['id'] == PID for p in idx['pieces']):
    idx['pieces'].insert(0, {'id': PID, 'title': piece['title'], 'date': '2026-10-16', 'program': 'The Close', 'format': 'tape', 'arc': 'PG01', 'status': 'claude-draft', 'kind': 'baseline', 'station': 'RI', 'dia': sb['dia'], 'lumens': sb['lumens'], 'readZ': sb['readZ'],
        'dek': 'The floor’s second Close point. Yesterday the desk passed the crunch through; today it logged the bite three times on the record — CPI at the fastest rate since April, energy with “secondary effects in core,” gasoline that “continues to sap consumer spending” — and the sign flipped.',
        'lede': 'RI · Dia 11 · read z +0.12 · Lumens 83 · 13 lines. The trade lines (oil up 3.5%, the gainers, Exxon’s $7.8B refining quarter) pass it through; the record lines bite; they cancel just above zero. The deal entered the Close for the first time, attributed: “what President Trump saw as a remedy,” under “a potential block by Congress.” A sighting, not a reading. Rolling floor over two cuts: Dia 10 · Lumens 88.',
        'network': 'Bloomberg Television'})
    json.dump(idx, open(P + 'index.json', 'w'), ensure_ascii=False, indent=1)
new = [
 {'id': 'evt-press-close-1016-oil-spike-block', 'theater': 'us', 'kind': 'price', 'asOf': '2026-10-16', 'detected': '2026-10-16', 'what': 'A midday spike in oil futures on 10-16 (Brent and WTI closing up >3.5%; Brent ≈$110) attributed on The Close to re-escalation of Ukrainian strikes on Russian energy assets and “a potential block by Congress of what President Trump saw as a remedy — the release of Russian diesel.” By report; verify settlements against ICE/CME.', 'source': SRC + ' · 0:51, 38:41, 44:45 (T)', 'pg01': 'the price shadow moving on the deal’s politics (the senators’ letter as “a block”) — the first RI mention of the deal, attributed', 'press': {'line': '44:45', 'who': 'RB', 'station': 'RI', 'touch': 'T', 'dia': 10, 'z': 0.4}, 'verified': False},
 {'id': 'evt-press-close-1016-retail-sales-gas', 'theater': 'us', 'kind': 'data', 'asOf': '2026-10-15', 'detected': '2026-10-16', 'what': 'Retail sales (released the week of 10-12): gasoline prices “continue to sap consumer spending”; restaurants and bars the bright spot, the second-strongest growth rate in a year and a half. By report; verify against the Census release.', 'source': SRC + ' · 56:17 (T)', 'pg01': 'the bite in demand — the consumer leg of the gas↔approval predicate', 'press': {'line': '56:17', 'who': 'RB', 'station': 'RI', 'touch': 'T', 'dia': 10, 'z': 0.5}, 'verified': False},
 {'id': 'evt-press-close-1016-exxon-refining', 'theater': 'us', 'kind': 'earnings', 'asOf': '2026-10-16', 'detected': '2026-10-16', 'what': 'Exxon preliminary Q3 (10-16 morning): refining earnings expected ≈$7.8B, offset by lower oil prices and a hit from timing effects on derivative positions linked to cargoes; shares +50% YTD. By report; verify against the 8-K.', 'source': SRC + ' · 48:02 (T)', 'pg01': 'the processing layer with a number — the crunch passed to the refiner’s margin (the TC 09-23 candidate layer)', 'press': {'line': '48:02', 'who': 'CM', 'station': 'RI', 'touch': 'T', 'dia': 8, 'z': -0.5}, 'verified': False},
 {'id': 'evt-press-close-1016-cpi-fastest', 'theater': 'us', 'kind': 'data', 'asOf': '2026-10-14', 'detected': '2026-10-16', 'what': 'CPI (released this week) rising at the fastest rate since April; Hoenig: inflation above 3.5% and likely higher through the year, “the economy runs on energy and energy is still very expensive.” By report; verify against BLS.', 'source': SRC + ' · 12:18, 15:11–15:31 (T/M)', 'pg01': 'the pass-through in prices; the RI mechanism line', 'press': {'line': '15:25', 'who': 'TK', 'station': 'RI', 'touch': 'M', 'dia': 10, 'z': 0.6}, 'verified': False},
]
E = json.load(open(A + 'events.json')); have = {r['id'] for r in E['rows']}; E['rows'] += [r for r in new if r['id'] not in have]
json.dump(E, open(A + 'events.json', 'w'), ensure_ascii=False, indent=1)
X = json.load(open(A + 'active.json')); blk = X.get('events')
if isinstance(blk, dict) and isinstance(blk.get('rows'), list):
    have = {r['id'] for r in blk['rows']}; blk['rows'] += [r for r in new if r['id'] not in have]
X['pressMergedAt'] = '2026-10-16'; json.dump(X, open(A + 'active.json', 'w'), ensure_ascii=False, indent=1)
O = json.load(open(P + 'objects_seen.json')); have = {s['id'] for s in O['sightings']}
def see(sid, t, obj, kind, holder, atype, aref, ds, dref, scored):
    return {'id': sid, 'piece': PID, 'program': 'The Close', 'date': '2026-10-16', 't': t if isinstance(t, list) else [t], 'object': obj, 'kind': kind, 'holder': holder, 'analog': {'type': atype, 'ref': aref}, 'match': {'dataset': ds, 'ref': dref}, 'scored': scored}
sight = [
 see('see-close-1016-deal-first-touch', '44:45', 'the deal’s first RI mention — “what President Trump saw as a remedy,” under “a potential block by Congress”', 'PG', 'Donald Trump / the Senate', 'legislative', 'evt-press-senate-letter-1013 · GL 135', 'PG01', 'H1 sighting — attributed, not a reading; RI corner of idx-diesel-01 still empty', True),
 see('see-close-1016-exxon-refining', '48:02', 'Exxon refining ≈$7.8B Q3; cargo-linked derivative timing; +50% YTD', 'tracker', 'ExxonMobil', None, None, 'tracker', 'processing layer (refining margins) — evt-press-close-1016-exxon-refining', True),
 see('see-close-1016-gas-sap', '56:17', 'gasoline “continues to sap consumer spending” (retail sales)', 'PG', None, None, None, 'PG01', 'the bite in demand — evt-press-close-1016-retail-sales-gas · slate (gas↔approval, consumer leg)', True),
 see('see-close-1016-cpi', '12:18', 'CPI fastest since April; Hoenig: energy → core', 'tracker', None, None, None, 'tracker', 'prices — evt-press-close-1016-cpi-fastest', True),
 see('see-close-1016-brent-110', '38:41', 'Brent ≈$110', 'tracker', None, None, None, 'tracker', 'price shadow', True),
 see('see-close-1016-fomc-oct', ['15:39', '16:14'], 'the end-of-October FOMC as the next dated decision (Hoenig: “hard choices in the next 2–3 weeks”)', 'register-intake', 'the FOMC', 'executive', None, 'register', 'calendar candidate (the Fed path under Warsh — second sighting)', False),
 see('see-close-1016-datacenter-siting', ['23:09', '29:51'], 'data-center land, power and community pushback (Arizona; a rural Texas site with grid power)', 'register-intake', None, 'legislative', 'data-center siting (BP 10-15 candidate — second sighting)', 'register', 'candidate — second sighting', False),
 see('see-close-1016-rubenstein-money', ['1:19:43', '1:21:01'], 'Rubenstein: fundraising “almost everything that matters”; leftover campaign money kept for life; Citizens United as the block', 'slate', 'David Rubenstein', None, None, 'slate', 'cross-arc — money on the seat (tx-sen money block) · not a position', False),
 see('see-close-1016-rubenstein-immigration', '1:22:12', 'Rubenstein: population falls without immigration; GDP with it', 'register-intake', None, None, None, 'register', 'low — immigration as an economic object', False),
 see('see-close-1016-what-to-watch', '1:28:43', 'next week: Netflix, United, GM, Tesla, TI, Nvidia (Berlin), Amex', 'none', None, None, None, None, 'calendar — no Prism set', False),
]
O['sightings'] += [s for s in sight if s['id'] not in have]
O['log'].append({'date': '2026-10-16', 'what': 'The Close 10-16 objects pass: 10 sightings; the deal’s first RI mention (attributed) logged as a sighting', 'by': 'Claude'})
json.dump(O, open(P + 'objects_seen.json', 'w'), ensure_ascii=False, indent=1)
R = json.load(open(P + 'roster.json'))
for s in R['sources']:
    if s['id'] == 'the-close': s['lastCut'] = '2026-10-16'; s['lastScanned'] = '2026-10-16'
json.dump(R, open(P + 'roster.json', 'w'), ensure_ascii=False, indent=1)
print('index', len(idx['pieces']), 'events', len(E['rows']), 'sightings', len(O['sightings']))
