#!/usr/bin/env python3
"""Merge the Breaking Points 2026-10-15 Texas trail cut into the race register (races.json: trail row, weight polls, press link,
cross-arc issue) and PG01 statements (Trump's oil clip; the gas↔approval link). Idempotent; archives first.
Usage: python3 press-merge-bp3_2026-10-15.py <repo root>"""
import json, shutil, sys, os
ROOT = sys.argv[1]
R = os.path.join(ROOT, 'Prism/data/races/races.json'); A = os.path.join(ROOT, 'Prism/data/active/'); ARCH = os.path.join(ROOT, 'Prism/archive/')
for src, dst in [(R, ARCH + 'races_2026-10-15_pre-bp3-merge.json'), (A + 'statements.json', ARCH + 'statements_2026-10-15_pre-bp3-merge.json'), (A + 'active.json', ARCH + 'active_2026-10-15_pre-bp3-merge.json')]:
    if os.path.exists(src) and not os.path.exists(dst): shutil.copy(src, dst)
SRC = 'Press · Breaking Points 2026-10-15 "Texans Republicans Panic" (cut: Parameters/09_Parallelograms/Press/2026-10-15_BP_Texas_Trail/cut.md)'
reg = json.load(open(R)); tx = next(r for r in reg['races'] if r['id'] == 'tx-sen')
# trail row — the candidate's own words
tr = tx.setdefault('trail', {'note': 'Said on the trail — positions as hypotheses, paid after the vote.', 'rows': []})
if not any(r['id'] == 'tx-s4' for r in tr['rows']):
    tr['rows'].append({'id': 'tx-s4', 'who': 'paxton', 'date': '2026-10-14', 'said': "Abbott is struggling but he has a lot of money; she has none. My disadvantages: not having time to raise more money, the negative ads from a brutal primary, and a well-funded, well-known opponent.", 'verbatim': True, 'object': 'the seat — his own position in the race', 'pays': "Pays 11-03: if he holds, the disadvantages were survivable; if he loses, his own ledger named the cause first.", 'src': SRC + ' · leaked audio 3:45–4:24 (date approximate — the tape says new; verify)'})
# polls — weight only
pl = tx.setdefault('polls', {'rows': [], 'issue': []})
have = {(r.get('pollster'), r.get('dates')) for r in pl['rows']}
if ('University of Texas (per BP 10-15)', '≈2026-10-14') not in have:
    pl['rows'].insert(0, {'pollster': 'University of Texas (per BP 10-15)', 'dates': '≈2026-10-14', 'talarico': None, 'paxton': None, 'margin': 'Talarico +3', 'note': 'margin only, as read on the tape (cited as the most accurate Texas pollster of 2024); toplines and field dates to verify against the release', 'verified': False})
iss = pl.setdefault('issue', [])
for row in [
 {'what': 'Fort Bend County (Barbara Jordan Research Center) — Talarico margin; Trump–Harris tied there in 2024', 'value': '+18 (county); ≈+2 projected statewide', 'src': SRC + ' · SE 6:06', 'verified': False},
 {'what': 'Gas prices ↔ Trump approval, near 1:1 (cross-arc: PG01 → slate)', 'value': 'the segment\'s "single most important dynamic"', 'src': SRC + ' · KB 10:23 (M)', 'verified': False},
 {'what': 'AP: share saying Trump prioritizes "people like me"', 'value': '11% (56% of independents: not at all)', 'src': SRC + ' · SE 11:35', 'verified': False},
]:
    if not any(x.get('what') == row['what'] for x in iss): iss.append(row)
# press link
pr = tx.setdefault('press', [])
if not any(p.get('id') == 'bp_2026-10-15_texas_trail' for p in pr):
    pr.append({'id': 'bp_2026-10-15_texas_trail', 'date': '2026-10-15', 'program': 'Breaking Points', 'stations': 'LP+RP (+ forecaster, LI pending)', 'dia': 19, 'readZ': 0.32, 'reads': 'flips', 'file': '../data/press/bp_2026-10-15_texas_trail.json', 'note': 'the first trail cut on the seat; z is belief about the outcome, paid 11-03, never weight'})
json.dump(reg, open(R, 'w'), ensure_ascii=False, indent=1)
# PG01 statements
stmts = [
 {'id': 'stmt-trump-2026-10-14-oil-fortune', 'who': 'Donald Trump', 'date': '2026-10-14', 'asOf': '2026-10-14', 'detected': '2026-10-15', 'what': '"Our country is making more money than it\'s ever made because of the fact that oil is so high… because of the price of oil, Texas and Oklahoma and North Dakota and all these places, we\'re making a fortune. But I never talk about it because I\'m not happy until we get the actual price of the oil down to where it was prior." (campaign trail; clip on the tape 0:05–0:49; date approximate)', 'reads': 'the crunch as a national benefit — priced and absorbed into producer revenue; the last clause restates H5 (prices back to prior)', 'z': -0.4, 'source': SRC + ' · DT clip', 'verified': False},
 {'id': 'stmt-l2-gas-approval-krystal-1015', 'who': 'Krystal Ball (LP, reader)', 'date': '2026-10-15', 'asOf': '2026-10-15', 'detected': '2026-10-15', 'what': 'as gas prices rise, Trump\'s approval falls — "pretty darn near 1:1" (chart C7 on the tape)', 'reads': 'PG01\'s object as the Midterm Slate\'s driver — the first cross-arc predicate the Press has found', 'z': None, 'source': SRC + ' · KB 10:23 (M)', 'crossArc': ['PG01', 'slate'], 'verified': False},
]
for f in [A + 'statements.json', A + 'active.json']:
    if not os.path.exists(f): continue
    D = json.load(open(f)); blk = D if f.endswith('statements.json') else D.get('statements')
    if isinstance(blk, dict) and isinstance(blk.get('rows'), list):
        hs = {r.get('id') for r in blk['rows']}; blk['rows'] += [s for s in stmts if s['id'] not in hs]
        if not f.endswith('statements.json'): D['pressMergedAt'] = '2026-10-15'
        json.dump(D, open(f, 'w'), ensure_ascii=False, indent=1)
print('races tx-sen: trail', len(tr['rows']), 'polls', len(pl['rows']), 'issue', len(iss), 'press', len(pr))
