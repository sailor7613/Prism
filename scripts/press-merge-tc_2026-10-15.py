#!/usr/bin/env python3
"""Merge the Tucker Carlson 2026-09-23 cut's detection rows + statement into the active layer. Idempotent; archives first.
Usage: python3 press-merge-tc_2026-10-15.py <repo root>"""
import json, shutil, sys, os
ROOT = sys.argv[1]
A = os.path.join(ROOT, 'Prism/data/active/'); ARCH = os.path.join(ROOT, 'Prism/archive/')
for f in ['events', 'active', 'statements']:
    src = A + f + '.json'; dst = ARCH + f + '_2026-10-15_pre-tc-merge.json'
    if os.path.exists(src) and not os.path.exists(dst): shutil.copy(src, dst)
SRC = 'Press · Tucker Carlson 2026-09-23 (cut: Parameters/09_Parallelograms/Press/2026-09-23_TuckerCarlson_Refineries/cut.md)'
new = [
 {'id':'evt-press-tc-diesel-650','theater':'us','kind':'price','asOf':'2026-09-23','detected':'2026-10-15',
  'what':'US retail diesel ≈$6.50/gal "nationally" as stated on the tape (consistent with AJ: record $6.52 in September). Verify against EIA weekly retail diesel for the week of 09-21.',
  'source':SRC+' · TC 4:47 / 13:15 (T/O)','pg01':'the crunch at the pump, read from RP as a bite',
  'press':{'line':'4:47','who':'TC','station':'RP','touch':'T','dia':10,'z':0.6},'verified':False},
 {'id':'evt-press-tc-russia-capacity','theater':'russia','kind':'supply','asOf':'2026-09-23','detected':'2026-10-15',
  'what':'Russian refining capacity hit by Ukrainian strikes: "60% hit" (Carlson 6:26) vs "45% taken offline as of this month" (Weichert 59:56) — two figures on one tape. Verify against Reuters/IEA monthly estimates of Russian refinery outages, September 2026.',
  'source':SRC+' · TC 6:26, BW 59:56 (T)','pg01':'PG01 §4 Russian theater — the supply side of the crunch; the substrate of the 09-20 request and the 10-09 deal',
  'press':{'line':'59:56','who':'BW','station':'RP','touch':'T','dia':8,'z':0.6},'verified':False},
 {'id':'evt-press-tc-moscow-refinery-strike','theater':'russia','kind':'strike','asOf':'2026-09-22','detected':'2026-10-15',
  'what':'Ukrainian drone/missile strike on the Moscow-area refinery "ten miles from the Kremlin" (BBC, via the tape), about a week after Trump\'s 09-20 request to stop striking diesel refining. Verify date and facility (Moscow Oil Refinery, Kapotnya?) against Reuters/BBC.',
  'source':SRC+' · TC 32:11–32:58 (T, BBC clip)','pg01':'the record against the 09-20 request: not honored',
  'press':{'line':'32:43','who':'TC','station':'RP','touch':'T','dia':20,'z':0.5},'verified':False},
 {'id':'evt-press-tc-gulf-refineries','theater':'gulf','kind':'strike','asOf':'2026-09-23','detected':'2026-10-15',
  'what':'"Seven refineries in the Persian Gulf hit, destroyed, damaged or shut down so far in this war, by our count" (Carlson). Verify against the tracker\'s OSINT series / Reuters.',
  'source':SRC+' · TC 4:47 (T)','pg01':'PG01 Gulf theater — refining capacity removed, the other half of the crunch',
  'press':{'line':'4:47','who':'TC','station':'RP','touch':'T','dia':10,'z':0.6},'verified':False},
]
stmt = {'id':'stmt-trump-2026-09-20-diesel-request','who':'Donald Trump','date':'2026-09-20','asOf':'2026-09-20','detected':'2026-10-15',
  'what':'"Mr. Zelensky has to stop knocking out diesel fuel in Russia… he\'s causing a shortage of diesel fuel. This isn\'t done by the Middle East… don\'t hit diesel fuel because that\'s hurting the world." (clip on the tape, 26:04–26:28; "last Sunday" relative to 09-23)',
  'reads':'the crunch as a shortage (bites), cause located in the Ukrainian strikes — the predecessor statement to the 10-09 deal','z':0.8,
  'source':SRC+' · DT@O 26:04','verified':False}
E = json.load(open(A + 'events.json')); have = {r['id'] for r in E['rows']}
E['rows'] += [r for r in new if r['id'] not in have]
json.dump(E, open(A + 'events.json', 'w'), ensure_ascii=False, indent=1)
if os.path.exists(A + 'statements.json'):
    S = json.load(open(A + 'statements.json'))
    if isinstance(S, dict) and isinstance(S.get('rows'), list):
        if stmt['id'] not in {r.get('id') for r in S['rows']}: S['rows'].append(stmt)
        json.dump(S, open(A + 'statements.json', 'w'), ensure_ascii=False, indent=1)
X = json.load(open(A + 'active.json')); blk = X.get('events')
if isinstance(blk, dict) and isinstance(blk.get('rows'), list):
    have = {r['id'] for r in blk['rows']}; blk['rows'] += [r for r in new if r['id'] not in have]
else: X['events'] = E
sb = X.get('statements')
if isinstance(sb, dict) and isinstance(sb.get('rows'), list) and stmt['id'] not in {r.get('id') for r in sb['rows']}: sb['rows'].append(stmt)
X['pressMergedAt'] = '2026-10-15'
json.dump(X, open(A + 'active.json', 'w'), ensure_ascii=False, indent=1)
print('events', len(E['rows']), 'active events', len(X['events']['rows']) if isinstance(X.get('events'), dict) else '?')
