#!/usr/bin/env python3
"""Merge MS NOW 2026-10-15 (the first LI cable cut) into the paper, detection rows, statements and sightings. Idempotent.
Usage: python3 press-merge-msnow_2026-10-16.py <repo root>"""
import json, sys, os
ROOT = sys.argv[1]; P = os.path.join(ROOT, 'Prism/data/press/'); A = os.path.join(ROOT, 'Prism/data/active/')
PID = 'msnow_2026-10-15_putins_windfall'; SRC = 'Press · MS NOW 2026-10-15 "Putin\'s windfall" (cut: Parameters/09_Parallelograms/Press/2026-10-15_MSNOW_Putins_Windfall/cut.md)'
idx = json.load(open(P + 'index.json'))
if any(p['id'] == PID for p in idx['pieces']): print('already merged'); sys.exit(0)
if any(p.get('program') == 'MS NOW' and p.get('date') == '2026-10-15' for p in idx['pieces']): print('another MS NOW 10-15 cut exists — not merging'); sys.exit(1)
piece = json.load(open(P + PID + '.json')); sb = piece['scoreboard']
idx['pieces'].insert(0, {'id': PID, 'title': piece['title'], 'date': '2026-10-15', 'program': 'MS NOW', 'format': 'tape', 'arc': 'PG01', 'status': 'claude-draft', 'kind': 'parallelogram', 'station': 'LI', 'dia': sb['dia'], 'lumens': sb['lumens'], 'readZ': sb['readZ'],
    'dek': '“Trump’s treating it as our windfall because we get five million tons. It’s Putin’s windfall.” The deal delivers — to the seller. The Daily’s relocation, said in the cable register: the transform’s second specimen.',
    'lede': 'LI (cable) · Dia 33 · read z −0.47 · Lumens 60 · 25 lines. The same corner as the Daily, thirteen Dia points hotter — the first measured spread inside a corner on the deal. Velshi carries the record ($6.32 diesel, the letter with Cornyn named, Ukraine striking again); Freeland, an adviser to Zelensky, carries the relocation and the paper’s hottest LI line (86).',
    'network': 'MS NOW', 'index': 'idx-diesel-01'})
json.dump(idx, open(P + 'index.json', 'w'), ensure_ascii=False, indent=1)
stmts = [
 {'id': 'stmt-zelensky-not-fair-not-honest', 'who': 'Volodymyr Zelensky', 'date': '2026-10-10', 'asOf': '2026-10-10', 'detected': '2026-10-16', 'what': 'the diesel deal is “not fair and not honest” (as quoted on MS NOW 10-15; date approximate — the weekend after 10-09; verify the primary)', 'reads': 'the ally reads the deal as delivering — to Russia', 'z': -0.7, 'source': SRC + ' · 3:04', 'verified': False},
 {'id': 'stmt-trump-diesel-blames-ukraine', 'who': 'Donald Trump (as reported by Chrystia Freeland)', 'date': '2026-10-15', 'asOf': '2026-10-15', 'detected': '2026-10-16', 'what': 'the extra $2.57 a gallon on diesel is because of Ukraine hitting Russian energy facilities (second-hand; find the primary)', 'reads': 'the principal places the price’s cause on the ally’s strikes — the cause H2 was meant to remove (cf. S1)', 'z': None, 'source': SRC + ' · 4:14', 'verified': False},
 {'id': 'stmt-pence-diesel-wrong', 'who': 'Mike Pence (former Vice President)', 'date': '2026-10-14', 'asOf': '2026-10-14', 'detected': '2026-10-16', 'what': 'the diesel deal is wrong (as reported on MS NOW 10-15; date approximate; find the primary)', 'reads': 'dissent from the president’s side', 'z': -0.6, 'source': SRC + ' · 9:12', 'verified': False},
 {'id': 'stmt-l2-windfall-freeland-1015', 'who': 'Chrystia Freeland (LI guest)', 'date': '2026-10-15', 'asOf': '2026-10-15', 'detected': '2026-10-16', 'what': 'energy is Russia’s single best source of foreign currency; “it’s Putin’s windfall”', 'reads': 'PG01 layer 2 at the seller’s end — who is paid, in what', 'z': None, 'source': SRC + ' · 6:16–6:43', 'crossArc': ['PG01'], 'verified': False},
]
S = json.load(open(A + 'statements.json')); X = json.load(open(A + 'active.json'))
for blk in [S, X.get('statements')]:
    if isinstance(blk, dict) and isinstance(blk.get('rows'), list):
        hs = {r.get('id') for r in blk['rows']}; blk['rows'] += [s for s in stmts if s['id'] not in hs]
json.dump(S, open(A + 'statements.json', 'w'), ensure_ascii=False, indent=1)
for blk in [json.load(open(A + 'events.json'))]: pass
E = json.load(open(A + 'events.json'))
for r in E['rows'] + (X.get('events') or {}).get('rows', []):
    if r.get('id') == 'evt-press-senate-letter-1013' and 'Cornyn' not in r['what']:
        r['what'] += ' MS NOW (10-15) names John Cornyn among the Republican signatories — possibly the name the PDF text garbled; verify against the PDF image.'
json.dump(E, open(A + 'events.json', 'w'), ensure_ascii=False, indent=1)
X['pressMergedAt'] = '2026-10-16'; json.dump(X, open(A + 'active.json', 'w'), ensure_ascii=False, indent=1)
O = json.load(open(P + 'objects_seen.json')); have = {s['id'] for s in O['sightings']}
def see(sid, t, obj, kind, holder, atype, aref, ds, dref, scored):
    return {'id': sid, 'piece': PID, 'program': 'MS NOW', 'date': '2026-10-15', 't': t if isinstance(t, list) else [t], 'object': obj, 'kind': kind, 'holder': holder, 'analog': {'type': atype, 'ref': aref}, 'match': {'dataset': ds, 'ref': dref}, 'scored': scored}
sight = [
 see('see-msnow-1015-fox-poll', '0:11', 'Fox News poll: Trump approval 36% (lowest in their polling), 64% disapprove; ~¾ rate the economy negatively; 59% name cost of living', 'slate', 'Fox News (pollster)', None, None, 'slate', 'poll — weight, never z', False),
 see('see-msnow-1015-diesel-632', '0:46', 'diesel $6.32 (10-15), +$2.57 since the war began', 'tracker', None, None, None, 'tracker', 'prices — matches evt-press-nyt-aaa-diesel-1015', True),
 see('see-msnow-1015-h6-claim', '0:58', 'Trump “continues to claim” the Strait reopened', 'PG', 'Donald Trump', None, 'H6 (proposed)', 'PG01', 'H6 — LI sighting', True),
 see('see-msnow-1015-five-million', '1:19', '“nearly 5 million tons” — H1’s tranches summed', 'PG', 'Donald Trump', 'executive', 'S2 · H1', 'PG01', 'H1 — sizing consistent with stated terms', True),
 see('see-msnow-1015-cornyn', '2:39', 'the letter named as including Tillis, Murkowski and Cornyn', 'register-intake', 'the Senate signatories', 'legislative', 'evt-press-senate-letter-1013', 'register', 'verify Cornyn as the garbled signatory', True),
 see('see-msnow-1015-zelensky', '3:04', 'Zelensky: “not fair and not honest”; Ukraine resumed strikes 10-15', 'later-sightings', 'Volodymyr Zelensky', None, 'H2 (falsified 10-12)', 'PG01', 'statements · H2 later sighting', True),
 see('see-msnow-1015-trump-blames-ukraine', '4:14', 'Trump blames the $2.57 on Ukraine’s refinery strikes (second-hand)', 'PG', 'Donald Trump', None, 'S1', 'PG01', 'statements — stmt-trump-diesel-blames-ukraine', True),
 see('see-msnow-1015-pence', '9:12', 'Mike Pence: the deal is wrong', 'PG', 'Mike Pence', None, None, 'PG01', 'statements — stmt-pence-diesel-wrong', True),
 see('see-msnow-1015-starlink', '9:49', 'Starlink weakened in Ukraine; Musk and Trump blame each other', 'PG', None, None, None, 'PG01', 'H2-adjacent — second sighting', True),
 see('see-msnow-channel-clips', 'channel', 'five more MS NOW clips on the deal 10-11 → 10-14 (Angus King; a GOP senator: “legitimate case” of breaking the law; Bolton; Scarborough; a reaction panel)', 'register-intake', None, None, None, 'press', 'scan queue — the senators are principals (statements)', False),
]
O['sightings'] += [s for s in sight if s['id'] not in have]
O['log'].append({'date': '2026-10-16', 'what': 'MS NOW 10-15 objects pass: 10 sightings; Cornyn named on the letter', 'by': 'Claude'})
json.dump(O, open(P + 'objects_seen.json', 'w'), ensure_ascii=False, indent=1)
R = json.load(open(P + 'roster.json'))
for s in R['sources']:
    if s['id'] == 'ms-now': s['lastCut'] = '2026-10-15'; s['lastScanned'] = '2026-10-16'
json.dump(R, open(P + 'roster.json', 'w'), ensure_ascii=False, indent=1)
print('index', len(idx['pieces']), 'sightings', len(O['sightings']))
