#!/usr/bin/env python3
"""Merge the Close 2026-10-15 cut's detection rows into the active layer. Idempotent; archives first.
Usage: python3 press-merge-close_2026-10-15.py <repo root>"""
import json, shutil, sys, os
ROOT = sys.argv[1]
A = os.path.join(ROOT, 'Prism/data/active/'); ARCH = os.path.join(ROOT, 'Prism/archive/')
for f in ['events', 'active']:
    dst = ARCH + f + '_2026-10-15_pre-close-merge.json'
    if not os.path.exists(dst): shutil.copy(A + f + '.json', dst)
SRC = 'Press · The Close 2026-10-15, baseline (cut: Parameters/09_Parallelograms/Press/2026-10-15_TheClose_Baseline/cut.md)'
new = [
 {'id':'evt-press-close-jbht-surcharge','theater':'us','kind':'activity','asOf':'2026-10-15','detected':'2026-10-15',
  'what':'J.B. Hunt Q3 2026: revenue ≈$3.69B (in line), EPS $1.82; top line +20% y/y including fuel surcharges; intermodal revenue +20%, loads +8.5%; dedicated +10%. The diesel crunch arriving as top-line growth — the pass-through in a filing. By report of the tape; verify against the JBHT Q3 release / 10-Q.',
  'source':SRC+' · TB 1:05:08, RB 1:07:20 (O/T)','pg01':'the crunch reaches the balance sheet: surcharged and booked; activity (loads) undented — pass-through side of Z',
  'press':{'line':'1:05:08','who':'TB','station':'RI','touch':'O','dia':4,'z':-0.8},'verified':False},
 {'id':'evt-press-close-ppi-4yr','theater':'us','kind':'price','asOf':'2026-10-15','detected':'2026-10-15',
  'what':'PPI rose at its fastest pace in more than four years (September print, released this week); retail sales ex motor vehicles and gas barely changed. Price into the index, activity flat. By report; verify against BLS PPI and Census retail sales releases (dates and figures).',
  'source':SRC+' · RB 2:04 (T)','pg01':'the crunch in the price level; the Fed\'s bind (EN 42:46: "a lot of this is oil")',
  'press':{'line':'2:04','who':'RB','station':'RI','touch':'T','dia':8,'z':-0.3},'verified':False},
 {'id':'evt-press-close-hormuz-walsh','theater':'gulf','kind':'statement','asOf':'2026-10-15','detected':'2026-10-15',
  'what':'KPMG US CEO Tim Walsh, on air: oil "not flowing freely in the Strait of Hormuz, and hasn\'t for quite some time"; showing up in inflation and interest rates; "with diesel prices rising, you\'ve got the inflation pressure." A statement about flows by a reader, not a flow measure — the tracker\'s flow series is the record for this.',
  'source':SRC+' · TW 29:11 / 29:44 (O, →PG01)','pg01':'PG01 layer 2 by statement: the constraint named from the C-suite; reads as a price, not a shortage',
  'press':{'line':'29:11','who':'TW','station':'RI','touch':'O','dia':10,'z':-0.3},'verified':False},
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
