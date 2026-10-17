#!/usr/bin/env python3
"""Merge the Breaking Points 2026-10-15 (Hormuz) cut's detection rows + layer-2 statements into the active layer. Idempotent; archives first.
Usage: python3 press-merge-bp2_2026-10-15.py <repo root>"""
import json, shutil, sys, os
ROOT = sys.argv[1]
A = os.path.join(ROOT, 'Prism/data/active/'); ARCH = os.path.join(ROOT, 'Prism/archive/')
for f in ['events', 'active', 'statements']:
    src = A + f + '.json'; dst = ARCH + f + '_2026-10-15_pre-bp2-merge.json'
    if os.path.exists(src) and not os.path.exists(dst): shutil.copy(src, dst)
SRC = 'Press · Breaking Points 2026-10-15 "Saudi Under Siege" (cut: Parameters/09_Parallelograms/Press/2026-10-15_BP_Hormuz/cut.md)'
def ev(id, theater, kind, asOf, what, line, who, st, touch, dia, z, pg):
    return {'id': id, 'theater': theater, 'kind': kind, 'asOf': asOf, 'detected': '2026-10-15', 'what': what,
            'source': f'{SRC} · {who} {line} ({touch})', 'pg01': pg, 'press': {'line': line, 'who': who, 'station': st, 'touch': touch, 'dia': dia, 'z': z}, 'verified': False}
new = [
 ev('evt-press-bp2-tanker-sunk', 'gulf', 'strike', '2026-10-15', 'Singapore-flagged tanker sunk in the Strait of Hormuz (confirmed by Singapore per the tape); a second vessel sunk by projectile; attacks on shipping now > 20. Struck vs mined unclear. Verify against Reuters / UKMTO.', '6:26', 'SE', 'RP', 'T', 12, -0.8, 'H6 falsifier — the record against the control claim'),
 ev('evt-press-bp2-centcom-19m', 'gulf', 'statement', '2026-10-12', 'CENTCOM: ≈19 million barrels transited the Strait on Monday 10-12 under convoy/blockade; pre-war baseline cited on the tape ≈20M+ bbl/day without convoy. Verify against the CENTCOM release and Kpler transit data.', '7:40', 'SE', 'RP', 'T', 16, -0.6, 'H6 — the Z-assertion (throughput as control) and its denominator'),
 ev('evt-press-bp2-freight', 'price', 'price', '2026-10-15', 'Tanker freight through the Strait ≈$1.4M/day vs ≈$100k pre-war (Hochstein); ≈$35/bbl in freight alone (Saagar). Verify against Baltic/Clarksons VLCC rates.', '18:23', 'AH', 'LI', 'O', 8, -0.6, 'PG01 layer 2 — the price of passage, in freight'),
 ev('evt-press-bp2-iran-toll', 'gulf', 'statement', '2026-10-15', '"Increasing indications" that countries are paying Iran for transit — some of the barrel count is tolled passage (Krystal, by report). A claim, not a record: verify against Reuters / Kpler / insurer reporting before it enters the tracker as fact.', '10:53', 'KB', 'LP', 'X', 12, -0.8, 'PG01 layer 2 — who sets the price of passage; H6 falsifier if confirmed'),
 ev('evt-press-bp2-riyadh-airport', 'gulf', 'strike', '2026-10-14', 'Houthi strike on Riyadh airport: ≥14 killed, ≈300 injured; aircraft on the ground 134 → 38 by noon 10-14; ≈$4B of aircraft evacuated; one written off, five damaged; ≈$400M insured damage; airport closed to Sunday midnight. Verify against Reuters / Saudi GACA.', '12:34', 'SE', 'RP', 'T', 8, -0.5, 'PG01 §5 Gulf — the realized layer in the kingdom'),
 ev('evt-press-bp2-pif-stadiums', 'gulf', 'ruling', '2026-10-15', 'Semafor: Saudi PIF to drop five of its proposed 2034 World Cup stadiums (three new; ten total) as it cuts signature domestic spending; Six Kings tennis postponed. Verify against Semafor / FIFA.', '22:32', 'SE', 'RP', 'T', 10, -0.4, 'PG01 §5 Gulf — spending cut on the strait\'s account'),
 ev('evt-press-bp2-zelenskyy-ft', 'russia', 'statement', '2026-10-15', 'Zelenskyy (FT interview, 10-15): Ukraine will keep striking Russian refineries regardless of US wishes; US reportedly reduced Starlink access to curb the drone campaign. Verify against the FT and Reuters.', '20:13', 'SE', 'RP', 'T', 20, -0.7, 'H2 record — the ceasefire not honored by its other party'),
 ev('evt-press-bp2-dark-tankers', 'us', 'ruling', '2026-10-15', 'US "looking to unsanction" non-Iranian "dark" tankers (Russian, Venezuelan) to free freight capacity (Saagar, by report). An executive action with a holder — a register candidate. Verify against OFAC / Treasury statements.', '20:52', 'SE', 'RP', 'T', 20, -0.7, 'H1 record — the sanctions regime loosened to move the diesel; the Graham-law line'),
 ev('evt-press-bp2-moab-plan', 'gulf', 'statement', '2026-10-15', 'Pentagon reportedly weighing use of the GBU-43/B MOAB against Iran, described internally as an "information operation" (by report on the tape). A strike decision — register candidate. Verify the originating report.', '2:03', 'SE', 'RP', 'T', 18, -0.3, 'PG01 §5 — escalation as messaging; reader hypothesis R4 attached'),
]
L2 = [
 {'id': 'stmt-l2-toll-krystal-1015', 'who': 'Krystal Ball (LP, reader)', 'date': '2026-10-15', 'asOf': '2026-10-15', 'detected': '2026-10-15', 'what': 'countries are paying Iran for passage; some of the barrel count is tolled transit', 'reads': 'who sets the price of passage — Iran, as a toll', 'z': -0.8, 'source': SRC + ' · KB 10:53', 'layer': 2, 'verified': False},
 {'id': 'stmt-l2-toll-hochstein-1014', 'who': 'Amos Hochstein (LI, quoted)', 'date': '2026-10-14', 'asOf': '2026-10-14', 'detected': '2026-10-15', 'what': '"do I control the strait now? … shipping costs are $1.4 million a day when there were 100,000 … a million dollars per ship would be a discount"', 'reads': 'control as a cost; the freight market as the price-setter', 'z': -0.6, 'source': SRC + ' · AH 18:23–18:37', 'layer': 2, 'verified': False},
 {'id': 'stmt-l2-toll-saagar-1015', 'who': 'Saagar Enjeti (RP, reader)', 'date': '2026-10-15', 'asOf': '2026-10-15', 'detected': '2026-10-15', 'what': '"the military doesn\'t run the world — the insurance companies do, the state-backed oil companies do"', 'reads': 'insurers and state oil companies as the holders of transit', 'z': -0.7, 'source': SRC + ' · SE 20:01', 'layer': 2, 'verified': False},
]
E = json.load(open(A + 'events.json')); have = {r['id'] for r in E['rows']}
E['rows'] += [r for r in new if r['id'] not in have]
json.dump(E, open(A + 'events.json', 'w'), ensure_ascii=False, indent=1)
if os.path.exists(A + 'statements.json'):
    S = json.load(open(A + 'statements.json'))
    if isinstance(S, dict) and isinstance(S.get('rows'), list):
        hs = {r.get('id') for r in S['rows']}; S['rows'] += [r for r in L2 if r['id'] not in hs]
        json.dump(S, open(A + 'statements.json', 'w'), ensure_ascii=False, indent=1)
X = json.load(open(A + 'active.json')); blk = X.get('events')
if isinstance(blk, dict) and isinstance(blk.get('rows'), list):
    have = {r['id'] for r in blk['rows']}; blk['rows'] += [r for r in new if r['id'] not in have]
else: X['events'] = E
sb = X.get('statements')
if isinstance(sb, dict) and isinstance(sb.get('rows'), list):
    hs = {r.get('id') for r in sb['rows']}; sb['rows'] += [r for r in L2 if r['id'] not in hs]
X['pressMergedAt'] = '2026-10-15'
json.dump(X, open(A + 'active.json', 'w'), ensure_ascii=False, indent=1)
print('events', len(E['rows']), 'active events', len(X['events']['rows']) if isinstance(X.get('events'), dict) else '?')
