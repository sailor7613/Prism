#!/usr/bin/env python3
"""Merge The Daily 2026-10-14 cut (nyt_2026-10-14_the_daily_diesel_deal) into the paper and the data sets.
index.json (lead) · events/active rows · statements (Zelensky) · objects_seen sightings · indices (LI member read in full) ·
sweep_2026-10-16 queue status · scan_list row. Idempotent; archives first.
Usage: python3 press-merge-daily_2026-10-16.py <repo root>"""
import json, shutil, sys, os
ROOT = sys.argv[1]
P = os.path.join(ROOT, 'Prism/data/press/'); A = os.path.join(ROOT, 'Prism/data/active/'); ARCH = os.path.join(ROOT, 'Prism/archive/')
for src, dst in [(P + 'index.json', ARCH + 'press_index_2026-10-16_pre-daily-merge.json'), (A + 'events.json', ARCH + 'events_2026-10-16_pre-daily-merge.json'),
                 (A + 'active.json', ARCH + 'active_2026-10-16_pre-daily-merge.json'), (A + 'statements.json', ARCH + 'statements_2026-10-16_pre-daily-merge.json'),
                 (P + 'objects_seen.json', ARCH + 'objects_seen_2026-10-16_pre-daily-merge.json')]:
    if os.path.exists(src) and not os.path.exists(dst): shutil.copy(src, dst)
PID = 'nyt_2026-10-14_the_daily_diesel_deal'
SRC = 'Press · The Daily (NYT) 2026-10-14 (cut: Parameters/09_Parallelograms/Press/2026-10-14_TheDaily_Diesel_Deal/cut.md)'
piece = json.load(open(P + PID + '.json')); sb = piece['scoreboard']

# 1. the paper
idx = json.load(open(P + 'index.json'))
if not any(p['id'] == PID for p in idx['pieces']):
    idx['pieces'].insert(0, {
        'id': PID, 'title': piece['title'], 'date': '2026-10-14', 'program': 'The Daily', 'format': 'podcast', 'arc': 'PG01', 'status': 'claude-draft', 'kind': 'parallelogram',
        'station': 'LI', 'dia': sb['dia'], 'lumens': sb['lumens'], 'readZ': sb['readZ'],
        'dek': 'The first LI (US) full read of the deal — the whole episode, not a lede. The Times sizes the cargo against the buyer’s own day: less than one day of US consumption. Then it moves the object: not fuel to the pump but a down payment to Moscow, with no concession in return.',
        'lede': 'Dia 20 · read z −0.34 · Lumens 72 · 39 lines. No split on Z; the Dia gap is host (frames, 24–40) against correspondent (record, 6–24). The same morning’s print lede read Dia 17 / z −0.49 — the first beta lede whose full read matched it. Transform proposed: relocation. The Diesel Index now has its LI member read in full; three corners say the deal does not deliver, and RI has still not spoken.',
        'network': 'The New York Times', 'index': 'idx-diesel-01'})
    json.dump(idx, open(P + 'index.json', 'w'), ensure_ascii=False, indent=1)

# 2. detection rows
new = [
 {'id': 'evt-press-daily-ru-export-ban', 'theater': 'russia', 'kind': 'ruling', 'asOf': '2026-07-31', 'detected': '2026-10-16',
  'what': 'Russia imposed a diesel export ban in July 2026 after Ukrainian strikes took "something like half" of refining capacity offline at some point and gas lines appeared. By report (AT); verify the decree date and scope (full ban vs. producers-only) against the Russian government order / Reuters.',
  'source': SRC + ' · 5:32–5:47 (T)', 'pg01': 'H1 delivery doubt from the seller’s side; H2 record; a processing-layer series for the tracker (refining capacity — flagged by the TC cut 09-23)',
  'press': {'line': '5:17', 'who': 'AT', 'station': 'LI', 'touch': 'T', 'dia': 10, 'z': -0.6}, 'verified': False},
 {'id': 'evt-press-daily-aaa-diesel-1013', 'theater': 'us', 'kind': 'price', 'asOf': '2026-10-13', 'detected': '2026-10-16',
  'what': 'AAA national average diesel $6.28/gal on Tuesday 10-13 vs $6.32 a week earlier. By report; verify against AAA daily and EIA weekly retail diesel.',
  'source': SRC + ' · 15:11 (T)', 'pg01': 'H1c’s price series — the first post-deal pump reading on the record (as-of 10-13)',
  'press': {'line': '15:11', 'who': 'AT', 'station': 'LI', 'touch': 'T', 'dia': 6, 'z': -0.5}, 'verified': False},
 {'id': 'evt-press-daily-shell-bay-1009', 'theater': 'us', 'kind': 'statement', 'asOf': '2026-10-09', 'detected': '2026-10-16',
  'what': 'Friday 10-09, Shell Bay (Witkoff’s resort near Miami): with European and Ukrainian officials present for war talks, US envoys announced the coming deal to lift sanctions on Russian diesel; Trump–Putin call and the Truth Social post followed within hours; Treasury’s temporary suspension the same day. The register dates S2/H1 10-11 — verify which post is which (window rule: the frame dates itself).',
  'source': SRC + ' · 8:46–10:02 (T)', 'pg01': 'the object’s trigger day, by LI report — 10-09, not 10-11',
  'press': {'line': '8:46', 'who': 'AT', 'station': 'LI', 'touch': 'T', 'dia': 12, 'z': -0.2}, 'verified': False},
 {'id': 'evt-press-daily-no-concession', 'theater': 'russia', 'kind': 'statement', 'asOf': '2026-10-14', 'detected': '2026-10-16',
  'what': 'As far as the Times knows, Russia made no concession in return for the sanctions being lifted; the Kremlin says it is not ready to negotiate and continued strikes on Ukrainian infrastructure after the deal. By report.',
  'source': SRC + ' · 19:22, 16:41–17:23 (T)', 'pg01': 'the exchange is unilateral — delivery at the seller’s discretion; H2 record',
  'press': {'line': '19:22', 'who': 'AT', 'station': 'LI', 'touch': 'T', 'dia': 10, 'z': -0.6}, 'verified': False},
 {'id': 'evt-press-daily-lukoil-sale', 'theater': 'us', 'kind': 'agreement', 'asOf': '2026-10-14', 'detected': '2026-10-16',
  'what': 'A purchase of Lukoil’s international assets (refineries, oil fields, US gas stations) is "quite far along": an investor group led by Todd Boehly, a US government stake, and Gulf investors (two Syrian-Qatari brothers) who are business partners of Kushner and Ivanka Trump; the assets are under US sanctions and would re-rate on US approval. By report (the Times’ own reporting over the prior weeks); verify against OFAC / Lukoil disclosure.',
  'source': SRC + ' · 20:08–22:23 (T)', 'pg01': 'REGISTER CANDIDATE (an OFAC licensing act with a holder) · PG01 layer 2: who is paid, in what, for the barrel’s infrastructure',
  'press': {'line': '20:08', 'who': 'AT', 'station': 'LI', 'touch': 'T', 'dia': 16, 'z': -0.3}, 'verified': False},
 {'id': 'evt-press-daily-intel-continues-1013', 'theater': 'us', 'kind': 'statement', 'asOf': '2026-10-13', 'detected': '2026-10-16',
  'what': 'Trump (Tuesday 10-13): US intelligence support for Ukraine is continuing. By report.',
  'source': SRC + ' · 18:28 (T)', 'pg01': 'H2-adjacent: the next lever named', 'press': {'line': '18:28', 'who': 'AT', 'station': 'LI', 'touch': 'T', 'dia': 12, 'z': -0.2}, 'verified': False},
]
E = json.load(open(A + 'events.json')); have = {r['id'] for r in E['rows']}; E['rows'] += [r for r in new if r['id'] not in have]
json.dump(E, open(A + 'events.json', 'w'), ensure_ascii=False, indent=1)
X = json.load(open(A + 'active.json')); blk = X.get('events')
if isinstance(blk, dict) and isinstance(blk.get('rows'), list):
    have = {r['id'] for r in blk['rows']}; blk['rows'] += [r for r in new if r['id'] not in have]
else: X['events'] = E
# H1 terms note (the refinery condition) on the active copy and the hypotheses file
for f in [A + 'hypotheses.json', A + 'active.json']:
    D = json.load(open(f)); rows = D['rows'] if f.endswith('hypotheses.json') else (D.get('hypotheses') or {}).get('rows', [])
    for r in rows:
        if r.get('id') == 'H1':
            notes = r.setdefault('pressNotes', [])
            if not any(n.get('piece') == PID for n in notes):
                notes.append({'piece': PID, 'date': '2026-10-16', 'note': 'The Daily (10-14) reads the terms with a condition the register does not carry: "potentially millions more… depending on the state of Russian oil refineries" — the principal’s own falsifier, tying H1 to H2. Proposed terms amendment. The tape dates the announcement Friday 10-09 (Shell Bay → Truth Social); the register says 10-11.'})
    if f.endswith('hypotheses.json'): json.dump(D, open(f, 'w'), ensure_ascii=False, indent=1)
X['pressMergedAt'] = '2026-10-16'
json.dump(X, open(A + 'active.json', 'w'), ensure_ascii=False, indent=1)

# 3. statements — Zelensky; the EU-gas and Lukoil layer-2 rows
stmts = [
 {'id': 'stmt-zelensky-2026-10-10-weak-decision', 'who': 'Volodymyr Zelensky', 'date': '2026-10-10', 'asOf': '2026-10-10', 'detected': '2026-10-16',
  'what': 'called the diesel deal "a weak decision" and "an investment in a war that must [end]" (as read on The Daily, 10:42–10:49; date approximate — the weekend after 10-09; verify the primary)', 'reads': 'the ally reads the deal as delivering — to Russia', 'z': -0.7, 'source': SRC + ' · VZ clip', 'verified': False},
 {'id': 'stmt-l2-lukoil-daily-1014', 'who': 'Anton Troianovski (LI, reporting)', 'date': '2026-10-14', 'asOf': '2026-10-14', 'detected': '2026-10-16',
  'what': 'the Lukoil international-assets sale: Boehly-led group, USG stake, Gulf investors tied to Kushner/Ivanka Trump — assets under sanctions that re-rate on US approval', 'reads': 'PG01 layer 2 on infrastructure: who is paid, in what, for the refinery — the petrogas-dollar question moved from the barrel to the plant', 'z': None, 'source': SRC + ' · 20:08–22:23 (T)', 'crossArc': ['PG01'], 'verified': False},
 {'id': 'stmt-l2-gas-votes-kitroeff-1014', 'who': 'Natalie Kitroeff (LI, host)', 'date': '2026-10-14', 'asOf': '2026-10-14', 'detected': '2026-10-16',
  'what': 'consumers’ pain at the pump "could translate into votes" at the midterms', 'reads': 'second sighting of the gas↔approval predicate (first: Krystal Ball, BP 10-15), in the institutional modal', 'z': None, 'source': SRC + ' · 4:35 (M)', 'crossArc': ['PG01', 'slate'], 'verified': False},
]
for f in [A + 'statements.json', A + 'active.json']:
    if not os.path.exists(f): continue
    D = json.load(open(f)); blk = D if f.endswith('statements.json') else D.get('statements')
    if isinstance(blk, dict) and isinstance(blk.get('rows'), list):
        hs = {r.get('id') for r in blk['rows']}; blk['rows'] += [s for s in stmts if s['id'] not in hs]
        json.dump(D, open(f, 'w'), ensure_ascii=False, indent=1)

# 4. objects seen
O = json.load(open(P + 'objects_seen.json')); have = {s['id'] for s in O['sightings']}
def see(sid, t, obj, kind, holder, atype, aref, ds, dref, scored):
    return {'id': sid, 'piece': PID, 'program': 'The Daily (NYT)', 'date': '2026-10-14', 't': t if isinstance(t, list) else [t], 'object': obj, 'kind': kind, 'holder': holder,
            'analog': {'type': atype, 'ref': aref}, 'match': {'dataset': ds, 'ref': dref}, 'scored': scored}
sight = [
 see('see-daily-1014-terms-condition', '9:34', 'the deal’s terms with the refinery condition ("depending on the state of Russian oil refineries") — H1 conditioned on H2 in the principal’s words', 'PG', 'Donald Trump', 'executive', 'evt-ru-diesel-license · S2', 'PG01', 'H1 (terms amendment proposed)', True),
 see('see-daily-1014-ru-export-ban', ['5:32', '5:47'], 'Russia’s diesel export ban (July 2026); ~half of refining offline at some point', 'tracker', 'Russian government', 'executive (foreign)', None, 'tracker', 'processing layer candidate (refining capacity) · PG01 H2 record', True),
 see('see-daily-1014-sizing', '14:51', '300,000 t < one day of US diesel consumption', 'PG', None, None, None, 'PG01', 'scored — the line the cut exists for', True),
 see('see-daily-1014-aaa-1013', '15:11', 'AAA diesel $6.28 (10-13) vs $6.32', 'tracker', None, None, None, 'tracker', 'prices — evt-press-daily-aaa-diesel-1013', True),
 see('see-daily-1014-lukoil-sale', ['20:08', '22:23'], 'the Lukoil international-assets sale — Boehly group · USG stake · Gulf investors tied to Kushner', 'register-intake', 'the Treasury (OFAC) / the investor group', 'executive', 'an OFAC license — ref to be found', 'register', 'candidate (high) · PG01 layer 2 statement filed', True),
 see('see-daily-1014-trigger-day', '8:46', 'the announcement dated Friday 10-09 (Shell Bay → Truth Social → Treasury) vs the register’s 10-11', 'register-intake', None, None, 'S2 / H1 statedDate', 'PG01', 'window-rule check on H1’s trigger day', True),
 see('see-daily-1014-gas-votes', '4:35', 'gas prices ↔ votes (the host)', 'slate', None, None, None, 'slate', 'cross-arc — second sighting (stmt-l2-gas-votes-kitroeff-1014)', True),
 see('see-daily-1014-eu-gas', '26:37', 'Germany: "why aren’t we importing Russian gas again?" — the European gas question reopened', 'PG', None, None, None, 'PG01', 'flow layer sighting (stmt-l2 not filed; noted in hypotheses.json layer2)', True),
 see('see-daily-1014-g20-miami', '23:36', 'G20 Miami, December — Putin possibly attending; the Russian finance minister at the NC G20', 'register-intake', None, None, None, 'register', 'calendar candidate', False),
 see('see-daily-1014-intel-continues', '18:28', 'US intelligence support for Ukraine continues (Trump, 10-13)', 'PG', 'Donald Trump', 'executive', None, 'PG01', 'H2-adjacent — evt-press-daily-intel-continues-1013', True),
 see('see-daily-1014-gop-discomfort', '14:18', '"many Republicans" uncomfortable — the 12-senator letter (sweep queue)', 'register-intake', None, 'legislative', 'the senators’ letter (sweep_2026-10-16 queue)', 'register', 'already queued; primary is the letter', True),
 see('see-daily-1014-guilfoyle', '28:40', 'Guilfoyle resigns as ambassador to Greece (10-13) after WSJ conflict-of-interest reports', 'none', None, None, None, None, 'no Prism set', False),
 see('see-daily-1014-cornell', '29:42', 'Cornell bans fraternity parties for the year', 'none', None, None, None, None, 'no Prism set', False),
]
O['sightings'] += [s for s in sight if s['id'] not in have]
O.setdefault('log', []).append({'date': '2026-10-16', 'what': f'The Daily 10-14 objects pass: {len(sight)} sightings (the Lukoil sale is the high register candidate; the trigger-day discrepancy flagged)', 'by': 'Claude'})
json.dump(O, open(P + 'objects_seen.json', 'w'), ensure_ascii=False, indent=1)

# 5. the index — LI member read in full
I = json.load(open(P + 'indices.json'))
for ix in I['indices']:
    if ix['id'] == 'idx-diesel-01':
        for m in ix['members']:
            if m['corner'] == 'LI':
                m['status'] = 'read in full — The Daily 10-14 (nyt_2026-10-14_the_daily_diesel_deal); print still beta-lede'
                m['reads'] = [{'piece': PID, 'date': '2026-10-14', 'dia': sb['dia'], 'readZ': sb['readZ'], 'lumens': sb['lumens'], 'full': True}]
                m['note'] = 'the podcast is open (YouTube captions); the print body needs the subscription. The beta lede of 10-14 and the full read agree in sign and tier (−0.49 / 17 vs −0.34 / 20).'
        ix['readout_2026-10-16'] = 'LI read in full (Dia 20 · z −0.34 · Lumens 72) · RI none (Fox silent on the deal) · LP none (Grayzone route unverified) · RP beta only (FP lede) — no figure published'
json.dump(I, open(P + 'indices.json', 'w'), ensure_ascii=False, indent=1)

# 6. the sweep queue
S = json.load(open(P + 'sweeps/sweep_2026-10-16.json'))
for q in S['queue']:
    if 'The Daily' in (q.get('title') or ''):
        q['status'] = PID + ' (full read — the transcript came through YouTube’s panel; nytimes.com’s transcript field was null signed-out)'
        q['cut'] = PID
S.setdefault('log', []).append({'date': '2026-10-16', 'what': 'The Daily 10-14 cut in full (LI); queue item closed', 'by': 'Claude'})
json.dump(S, open(P + 'sweeps/sweep_2026-10-16.json', 'w'), ensure_ascii=False, indent=1)
print('index', len(idx['pieces']), 'events', len(E['rows']), 'sightings', len(O['sightings']))
