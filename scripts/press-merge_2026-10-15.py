import json, shutil, sys, os
ROOT = sys.argv[1]
A = os.path.join(ROOT, 'Prism/data/active/')
ARCH = os.path.join(ROOT, 'Prism/archive/')
for f in ['hypotheses', 'events', 'statements', 'accruals', 'active']:
    shutil.copy(A + f + '.json', ARCH + f + '_2026-10-15_pre-press-merge.json')
SRC = 'Press · Breaking Points 2026-10-12 (cut: Parameters/09_Parallelograms/Press/2026-10-12_BP_Diesel_Deal/cut.md)'
P = json.load(open(os.path.join(ROOT, 'Parameters/09_Parallelograms/Press/2026-10-12_BP_Diesel_Deal/hypotheses.json')))

def fals(h):
    return '; '.join(f"{x['id']}: {x.get('metric', '')} — {x.get('target', '')} by {x.get('by', '')}" for x in h.get('terms', []))

OBS = {'H1': [{'id': 'ruDiesel', 'label': 'Russian-origin diesel into the US (EIA distillate imports by origin)', 'nodes': ['Russia'], 'style': 'dashed', 'cmd': 'products'}],
       'H4': [{'id': 'gulfShare', 'label': 'Gulf share of US crude imports', 'nodes': ['Gulf'], 'style': 'dashed'}]}
SHORT = {'H1': 'Russian diesel lands in the US, and prices fall.', 'H2': 'An energy ceasefire holds, both sides.',
         'H3': 'Sixty days of total ceasefire, then an election.', 'H4': 'Total control of the Strait: the Gulf edge stays at zero or returns on US terms.'}
rows = []
for h in P['hypotheses']:
    rows.append({'id': h['id'], 'arc': 'PG01', 'layer': 'arc' if h['id'] == 'H4' else 'detection', 'who': h['who'], 'statedDate': h['statedDate'], 'window': h.get('window'),
                 'outcome': h.get('outcome', 'pending'), 'zTarget': h['declaredZ'], 'short': SHORT[h['id']], 'stated': h['statement'], 'litWords': h.get('litWords', []),
                 'falsifiedIf': fals(h), 'scoredBy': 'TF03 — ruled, unauthored' if h['id'] == 'H4' else 'the record, term by term (the active layer fetches H1a/H1c; H2/H3 by the detection series)',
                 'observables': OBS.get(h['id'], []), 'source': SRC, 'status': 'claude-draft', 'transform': h.get('transform')})
H = json.load(open(A + 'hypotheses.json'))
have = {r['id'] for r in H['rows']}
H['rows'] += [r for r in rows if r['id'] not in have]
H['what'] = H['what'] + " Press rows (H1–H4, 2026-10-15): principals' contemporaneous statements as trackable hypotheses — Sailor's 10-10 direction, drafted from the Breaking Points cut of 10-12; Claude drafts until ruled."
json.dump(H, open(A + 'hypotheses.json', 'w'), ensure_ascii=False, indent=1)

E = json.load(open(A + 'events.json'))
new_ev = [
    {'id': 'evt-press-ru-storage-strike', 'theater': 'russia', 'kind': 'strike', 'asOf': '2026-10-11', 'detected': '2026-10-12', 'what': "Ukraine strikes Russia's largest oil storage and pumping facility overnight; Russia answers with cruise missiles — the energy ceasefire broken within hours, both sides.", 'source': SRC + ' · SE 8:01 (T)', 'pg01': 'PG01 §4 Russian-theater accrual (draft, 10-12)', 'press': {'line': '8:01', 'who': 'SE', 'station': 'RP', 'touch': 'T', 'dia': 12, 'z': -1.0}},
    {'id': 'evt-press-ru-rejects-ceasefire', 'theater': 'russia', 'kind': 'statement', 'asOf': '2026-10-12', 'detected': '2026-10-12', 'what': 'Russia rejects the ceasefire; Kyiv in blackout hours after; cruise-missile attacks.', 'source': SRC + ' · SE 12:26 (T)', 'pg01': '', 'press': {'line': '12:26', 'who': 'SE', 'station': 'RP', 'touch': 'T', 'dia': 16, 'z': -1.0}},
    {'id': 'evt-press-graham-act-bars-cargo', 'theater': 'russia', 'kind': 'sanction', 'asOf': '2026-10-11', 'detected': '2026-10-12', 'what': 'Hours before the diesel statement, the Russia sanctions act is signed; an OFAC license cannot override statute; 30-day notice to Congress; CBP barred from clearing the cargo before the election. UNVERIFIED against primaries (the cut has only BP’s account).', 'source': SRC + ' · SA 2:29 (X)', 'pg01': 'the frame candidate (signing-day collision) — verify first', 'press': {'line': '2:29', 'who': 'SA', 'station': 'RI', 'touch': 'X', 'dia': 14, 'z': -0.9}, 'verified': False},
    {'id': 'evt-press-feb-desanction-precedent', 'theater': 'iran', 'kind': 'license', 'asOf': '2026-02-15', 'detected': '2026-10-12', 'what': 'Early in the Iran war Iranian oil was desanctioned over gas prices, then reversed and blockaded — the dated precedent for the pattern.', 'source': SRC + ' · KB 5:27 (B)', 'pg01': 'PG01 members (Feb 2026)', 'press': {'line': '5:27', 'who': 'KB', 'station': 'LP', 'touch': 'B', 'dia': 32, 'z': -0.4}},
    {'id': 'evt-press-weapons-for-refineries', 'theater': 'russia', 'kind': 'admission', 'asOf': '2026-10-11', 'detected': '2026-10-12', 'what': "The conditioning term made public: weapons procurement conditioned on refinery strikes — 'do whatever you want to Russia, don't hit the refineries'.", 'source': SRC + ' · DT 9:08 / SE 13:46 (M)', 'pg01': '', 'press': {'line': '13:46', 'who': 'SE', 'station': 'RP', 'touch': 'M', 'z': -0.6}},
]
have = {r['id'] for r in E['rows']}
E['rows'] += [r for r in new_ev if r['id'] not in have]
json.dump(E, open(A + 'events.json', 'w'), ensure_ascii=False, indent=1)

S = json.load(open(A + 'statements.json'))
new_st = [
    {'id': 'S2', 'theater': 'russia', 'speaker': 'Trump', 'venue': 'post, weekend of 10-10/11 (per BP 10-12)', 'asOf': '2026-10-11', 'detected': '2026-10-12', 'verbatim': ['Russia will immediately supply 300,000 tons', '500,000 in November', '3 million tons', 'diesel prices coming down in record numbers'], 'context': 'The diesel deal as stated — H1. Declared z +1.0; the record inside the window: 300k t/mo ≈ 74 kb/d against ~3.66 mb/d US production; the statute bar (unverified); no CBP-cleared cargo.', 'hypothesis': 'H1', 'source': SRC + ' · DT 0:47 / 1:13'},
    {'id': 'S3', 'theater': 'russia', 'speaker': 'Trump', 'venue': 'post, 2026-10-11', 'asOf': '2026-10-11', 'detected': '2026-10-12', 'verbatim': ['Effective immediately, there is an energy ceasefire', 'Both parties have agreed, do not break it'], 'context': 'The energy ceasefire as stated — H2. Z-assertion in its purest form: delivery declared as already done; broken within hours by both sides (evt-press-ru-storage-strike, evt-press-ru-rejects-ceasefire).', 'hypothesis': 'H2', 'source': SRC + ' · DT 8:23'},
    {'id': 'S4', 'theater': 'russia', 'speaker': 'Zelensky', 'venue': 'interview, 2026-10-11 (per BP 10-12)', 'asOf': '2026-10-11', 'detected': '2026-10-12', 'verbatim': ['give us 60 days of total ceasefire and we organize elections'], 'context': 'The counter-term with its own test — H3.', 'hypothesis': 'H3', 'source': SRC + ' · VZ 12:06'},
]
have = {r['id'] for r in S['rows']}
S['rows'] += [r for r in new_st if r['id'] not in have]
json.dump(S, open(A + 'statements.json', 'w'), ensure_ascii=False, indent=1)

C = json.load(open(A + 'accruals.json'))
acc = {'id': 'acc-iran-trucks-russia', 'theater': 'iran', 'from': 'Iran', 'to': 'Russia', 'asOf': '2026-10-11', 'detected': '2026-10-12', 'measure': 'Iranian oil trucked into Russia (hundreds of tankers spotted)', 'value': None, 'units': 'trucks (count unverified)', 'estimated': True, 'source': SRC + ' · KB 4:54 (O, →PG01)', 'settlement': {'declared': 'unknown', 'basis': 'the cut: fungibility — once in the market there is no way to tell; a bilateral edge Comtrade cannot draw'}}
if not any(r['id'] == acc['id'] for r in C['rows']):
    C['rows'].append(acc)
json.dump(C, open(A + 'accruals.json', 'w'), ensure_ascii=False, indent=1)

X = json.load(open(A + 'active.json'))
for key, src in [('hypotheses', H), ('events', E), ('statements', S), ('accruals', C)]:
    blk = X.get(key)
    if isinstance(blk, dict) and isinstance(blk.get('rows'), list):
        have = {r['id'] for r in blk['rows']}
        blk['rows'] += [r for r in src['rows'] if r['id'] not in have]
    else:
        X[key] = src
X['pressMergedAt'] = '2026-10-15'
json.dump(X, open(A + 'active.json', 'w'), ensure_ascii=False, indent=1)
print('hyps', [r['id'] for r in H['rows']], 'events', len(E['rows']), 'statements', len(S['rows']), 'accruals', len(C['rows']))
print('active.json blocks:', {k: (len(X[k]['rows']) if isinstance(X.get(k), dict) and 'rows' in X[k] else type(X.get(k)).__name__) for k in ['hypotheses', 'events', 'statements', 'accruals']})
