#!/usr/bin/env python3
"""Merge the Al Jazeera 2026-10-12 cut's detection rows into the active layer. Idempotent; archives first.
Usage: python3 press-merge-aj_2026-10-15.py <repo root>"""
import json, shutil, sys, os
ROOT = sys.argv[1]
A = os.path.join(ROOT, 'Prism/data/active/'); ARCH = os.path.join(ROOT, 'Prism/archive/')
for f in ['events', 'active']:
    dst = ARCH + f + '_2026-10-15_pre-aj-merge.json'
    if not os.path.exists(dst): shutil.copy(A + f + '.json', dst)
SRC = 'Press · Al Jazeera 2026-10-12 explainer (cut: Parameters/09_Parallelograms/Press/2026-10-12_AlJazeera_Energy_Ceasefire/cut.md)'
new = [
 {'id':'evt-press-aj-kharkiv-after-statement','theater':'russia','kind':'strike','asOf':'2026-10-12','detected':'2026-10-15',
  'what':'Russian drones continued targeting Ukrainian energy facilities, including a power plant in Kharkiv, after the 10-11 "energy ceasefire" statement (per Zelenskyy, reported 10-12). Verify date/time of the Kharkiv strike against Reuters / Ukrenergo.',
  'source':SRC+' · AJ ¶11 (T)','pg01':'H2 falsifier — the ceasefire not in force within a day of being declared (Sailor: H2 falsified 10-12)',
  'press':{'line':'¶11','who':'AJ','station':'LI','touch':'T','dia':6,'z':-0.9},'verified':False},
 {'id':'evt-press-aj-brent-1012','theater':'price','kind':'price','asOf':'2026-10-12','detected':'2026-10-15',
  'what':'Brent ≈$103.04/bbl, WTI ≈$90.96 on Monday 10-12 following the ceasefire statement and the diesel deal. By report; verify against ICE/CME settlements.',
  'source':SRC+' · AJ ¶20 (T)','pg01':'the price shadow: a few dollars of belief in delivery',
  'press':{'line':'¶20','who':'AJ','station':'LI','touch':'T','dia':6,'z':0.2},'verified':False},
 {'id':'evt-press-aj-diesel-record-sept','theater':'us','kind':'price','asOf':'2026-09-30','detected':'2026-10-15',
  'what':'US retail diesel reached a record $6.52/gal in September 2026. By report; verify against EIA weekly retail diesel (date of the peak week).',
  'source':SRC+' · AJ ¶37 (T)','pg01':'the crunch at the pump — the number the deal was announced against',
  'press':{'line':'¶37','who':'AJ','station':'LI','touch':'T','dia':8,'z':0.0},'verified':False},
 {'id':'evt-press-aj-g7-release','theater':'g7','kind':'agreement','asOf':'2026-10-08','detected':'2026-10-15',
  'what':'G7 agreed "last week" (week of 10-05) to release 100 million barrels of emergency oil and diesel reserves, after pressure from Trump. Verify date and composition (crude vs product) against the G7 statement / IEA.',
  'source':SRC+' · AJ ¶24 (T)','pg01':'the other instrument on the same object — a release, not a deal; also an objects-pass candidate for the register (an agreement with a holder)',
  'press':{'line':'¶24','who':'AJ','station':'LI','touch':'T','dia':8,'z':0.0},'verified':False},
 {'id':'evt-press-aj-waiver-series','theater':'us','kind':'ruling','asOf':'2026-03-12','detected':'2026-10-15',
  'what':'March 5 2026: 30-day waiver for India to buy Russian oil stranded at sea; widened a week later to all countries for sanctioned Russian oil and products already on tankers; expiring April 11. Verify against OFAC general licenses.',
  'source':SRC+' · AJ ¶30 (B)','pg01':'PG01 §4 — the series the 10-09 deal belongs to; the Graham-law critics\' precedent',
  'press':{'line':'¶27','who':'AJ','station':'LI','touch':'B','dia':10,'z':-0.1},'verified':False},
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
