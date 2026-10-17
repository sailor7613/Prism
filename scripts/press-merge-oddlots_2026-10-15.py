import json, shutil, sys, os
ROOT = sys.argv[1]
A = os.path.join(ROOT, 'Prism/data/active/'); ARCH = os.path.join(ROOT, 'Prism/archive/')
for f in ['events', 'active']:
    shutil.copy(A + f + '.json', ARCH + f + '_2026-10-15_pre-oddlots-merge.json')
SRC = 'Press · Odd Lots 2026-10-05, recorded 09-29 (cut: Parameters/09_Parallelograms/Press/2026-10-05_OddLots_Fuel_Hedging/cut.md)'
new = [
 {'id':'evt-press-ol-crack-record','theater':'products','kind':'price','asOf':'2026-09-29','detected':'2026-10-15','what':'Heating oil–WTI crack through $100 (≈$107): product ≈$230/bbl with WTI ≈$110, Brent ≈$120; Europe gas-oil crack ≈$74–75/t. By report of the tape; verify against CME HO/CL settlements.','source':SRC+' · DK 18:36 (T)','pg01':'the crunch, sized in the price\'s units','press':{'line':'18:36','who':'DK','station':'RI','touch':'T','dia':6,'z':0.6},'verified':False},
 {'id':'evt-press-ol-sing-jet-basis','theater':'products','kind':'price','asOf':'2026-09-29','detected':'2026-10-15','what':'Normalized to early Feb 2026: Brent +50%, Singapore jet > +100% — the Brent hedge misses the product. By report (Bloomberg terminal on tape); verify against Platts/Argus Singapore jet and Brent front-month.','source':SRC+' · JW 19:55 (T)','pg01':'basis: the hedge and the molecule','press':{'line':'19:55','who':'JW','station':'RI','touch':'T','dia':8,'z':0.5},'verified':False},
 {'id':'evt-press-ol-russia-diesel-out','theater':'russia','kind':'supply','asOf':'2026-09-29','detected':'2026-10-15','what':'Russia (second-largest diesel exporter) has banned diesel exports; a large volume is out of the complex; Europe short; London gas oil at a record. By report; verify the ban\'s date and scope against Russian government decree / Reuters.','source':SRC+' · DK 45:52 (T, →PG01)','pg01':'PG01 §4 Russian theater — supply side of the crunch; the substrate of the 10-11 diesel statement (H1)','press':{'line':'45:52','who':'DK','station':'RI','touch':'T','dia':10,'z':0.7},'verified':False},
 {'id':'evt-press-ol-activity-undented','theater':'us','kind':'activity','asOf':'2026-09-29','detected':'2026-10-15','what':'TSA checkpoint throughput at records; fares very high; bookings very high — the crunch has not dented air-travel activity (the pass-through side of Z). Verify against TSA weekly throughput.','source':SRC+' · JW 3:55 / 51:29 (T)','pg01':'R1 (reader hypothesis) — the baseline\'s test','press':{'line':'51:29','who':'JW','station':'RI','touch':'T','dia':14,'z':-0.9},'verified':False},
 {'id':'evt-press-ol-export-ban-rhetoric','theater':'us','kind':'statement','asOf':'2026-09-29','detected':'2026-10-15','what':'Talk of a US diesel export ban; per the tape mostly rhetoric, and US heating oil fell rather than rose on it (PADD 3 → NY Harbor is seaborne; the East Coast buys European diesel). Verify the ban\'s status against DOE/White House statements.','source':SRC+' · JW 45:09 / DK 46:15 (O)','pg01':'the jawbone read from RI: the instrument moved the number the other way','press':{'line':'46:15','who':'DK','station':'RI','touch':'O','dia':12,'z':-0.6},'verified':False},
]
E = json.load(open(A + 'events.json')); have = {r['id'] for r in E['rows']}
E['rows'] += [r for r in new if r['id'] not in have]
json.dump(E, open(A + 'events.json', 'w'), ensure_ascii=False, indent=1)
X = json.load(open(A + 'active.json')); blk = X.get('events')
if isinstance(blk, dict) and isinstance(blk.get('rows'), list):
    have = {r['id'] for r in blk['rows']}; blk['rows'] += [r for r in new if r['id'] not in have]
else: X['events'] = E
X['pressMergedAt'] = '2026-10-15'
json.dump(X, open(A + 'active.json', 'w'), ensure_ascii=False, indent=1)
print('events', len(E['rows']), 'active events', len(X['events']['rows']) if isinstance(X.get('events'), dict) else '?')
