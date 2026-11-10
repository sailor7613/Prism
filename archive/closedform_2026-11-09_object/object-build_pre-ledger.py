#!/usr/bin/env python3
"""object-build — the object as Prism holds it (Sailor + Claude, 2026-11-09; replaces trackers-build.py, which replaced gears-build.py).

ONE OBJECT: the political economy. z is for the audience (American citizens and voters): +1 it delivered for them,
-1 it frustrated them. The object has a BODY and a LIGHT.
  THE BODY — what is measured. Each measure is a dated series of readings, [date, z, sigma, note]:
    war     the topic's own state by date — a step line of facts, sigma 0
    barrel  Brent spot (price.json)
    pump    EIA US regular gasoline, retail, weekly (price.json)
    dollar  the Supply Shock Tracker's needle — the dollar's share of the five-station panel's barrel, monthly
            (src/js/tracker-core.js — the same number the villa and BloomBurger show)
    vote    exit polls (one reading so far)
  THE LIGHT — what is said. The room: each day's sweep on the topic through the closed form (slop-day.py → discourse.json).
THE TOPIC is the face of the object turned toward the audience now (PG01, the Iran war). It carries the LEDGER (what has
happened, as named states) and the ZERO DATE every body reading is measured from — the zero belongs to the topic, not
to the measure: another topic needs its own.
Only the light goes through the prism (a parallelogram is a piece of it, surfaced by the sweep or written into the drop).
The body has no station and no heat; it reaches the graphmap as height. The body judges the light, never the reverse.
Every rule is a DRAFT for Sailor. Writes data/active/object.json. Run after the SST fetch.
Usage: python3 scripts/object-build.py"""
import json, os, subprocess, calendar
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = lambda f: os.path.join(ROOT, 'data', 'active', f)
WAR_START = '2026-02-28'
P = json.load(open(A('price.json')))['series']

def at(pts, day):
    best = None
    for d, v in pts:
        if d <= day: best = (d, v)
    return best

# THE WAR — the object's own state. Step values are Sailor's ruling about the promise, not derived from any poll.
# 11-09: the LEDGER — what has happened, by date, as named states. A forecast that names a state ("a world war", "a nuclear
# strike", "no war") is scored against the ledger, not against z: right if the state is on it by the due date (or, for a
# forecast that it WON'T happen, off it), wrong if not. STATES is the vocabulary the forecast pass picks from; a state
# in STATES but not on the ledger has not happened as far as Prism knows — the ledger is Sailor's to rule.
LEDGER = [['2025-06-13', 'israel-strikes', 'Israel strikes Iran'],
          ['2025-06-22', 'us-strikes', 'US strikes Fordow, Natanz, Isfahan'],
          ['2025-06-24', 'ceasefire', 'ceasefire brokered by Trump'],
          ['2026-02-28', 'war', 'the war begins']]
STATES = {'congress-ends-war': 'Congress orders the forces out (a war-powers resolution passes both chambers)', 'war': 'a US war with Iran', 'us-strikes': 'US strikes on Iran', 'israel-strikes': 'Israeli strikes on Iran', 'ceasefire': 'a ceasefire',
          'boots': 'US ground troops in Iran', 'nuclear-strike': 'a US nuclear strike', 'world-war': 'a world war / war with Russia or China',
          'regime-change': 'the Iranian regime falls', 'war-ends': 'the war ends',
          'casualties': 'American dead (no instrument yet — unmeasured)', 'other': 'a state no tracker holds (unmeasured)'}
UNMEASURED_STATES = ['casualties', 'other']
war = [['2024-11-05', 0.5, 0.0, 'no war — the promise, holding'],
       ['2025-06-13', 0.0, 0.0, 'Israel strikes Iran; no US boots'],
       ['2025-06-22', -0.5, 0.0, 'US strikes Fordow, Natanz, Isfahan'],
       [WAR_START, -1.0, 0.0, 'the war begins']]

# THE PUMP. Rule (plain): every +10% on US retail gasoline since the war began moves z by -0.2; capped at ±1.
# This reads the pump since the war, not the war's effect on the pump — prices move for other reasons too.
# Sigma 0.10: an official weekly EIA series, one step from the object.
gas = P['EMM_EPMR_PTE_NUS_DPG']['points']
base = at(gas, WAR_START)
pump = []
for d, v in gas:
    if d < WAR_START: continue
    pct = (v / base[1] - 1) * 100
    pump.append([d, round(max(-1, min(1, -pct / 50)), 3), 0.10, round(pct, 1)])

# THE BARREL. Rule (plain): every +20% on Brent since the war began moves z by -0.2; capped at ±1. Brent is what the
# commentators quote ("$30 gas", "surging oil prices"); the pump is what the audience pays. Sigma 0.15: a world price,
# two steps from the audience. Same file as the pump (price.json).
brent = P['RBRTE']['points']
bbase = at(brent, WAR_START)
barrel = []
for d, v in brent:
    if d < WAR_START: continue
    pct = (v / bbase[1] - 1) * 100
    barrel.append([d, round(max(-1, min(1, -pct / 100)), 3), 0.15, round(pct, 1)])

# THE LIGHT (11-09): the room — each day's headlines on the object run through the closed form
# (scripts/closedform/slop-day.py), the day's read z as the reading. It reads the ROOM, not the object: a line is never lit
# against it; it gets `room` = its z - the discourse z on its date. kind: discourse. Readings live in discourse.json.
disc = json.load(open(A('discourse.json'))) if os.path.exists(A('discourse.json')) else {'objects': {}}
dreads = (disc.get('objects', {}).get('iran') or {}).get('readings', [])

# THE VOTE. Rule (plain): z = -(share calling the war the wrong decision - share calling it right) ÷ 100.
# Sigma 0.25: one exit poll, and cause is soft. Given the vantage ruling (the audience is the voter), this is the
# audience's own z, measured directly, once — the other trackers are proxies for it between elections.
vote = [['2026-11-03', -0.26, 0.25, {'wrong': 63, 'right': 37, 'crucialOrMajor': 74,
         'source': 'NBC News exit poll, 2026-11-03, as reported by The Federalist (thefederalist.com/2026/11/03/exit-poll-iran-war-was-crucial-or-major-factor-for-3-in-4-voters/)'}]]

# THE DOLLAR. The needle itself: the dollar's share of the panel's named barrel, by month, from tracker-core.js.
# Rule (plain): every -3 points of share since the war began = -0.2 z (3 points is the needle's own threshold for
# "moving"); capped at ±1 (15 points). A month's reading is dated to its last day — a line said mid-month reads
# against the month before, never a total not yet known. Sigma 0.15: about half the named volume rests on the
# industry default (dollar, undocumented). Months the whole panel did not report are left out.
node = subprocess.run(['node', '-e', '''
require(process.argv[1] + "/src/js/tracker-core.js");
const a = require(process.argv[1] + "/data/active/active.json"), s = require(process.argv[1] + "/data/active/settlement.json");
const T = globalThis.PrismTracker.compute(a, s);
console.log(JSON.stringify(T.months.filter(m => m.panelPresent.length === globalThis.PrismTracker.PANEL.length && m.dollarShare != null)
  .map(m => [m.period, m.dollarShare, m.namedShare, m.defaultShare])));
''', ROOT], capture_output=True, text=True)
months = json.loads(node.stdout) if node.returncode == 0 and node.stdout.strip() else []
if not months: print('dollar: tracker-core gave nothing —', node.stderr.strip()[:300])
def month_end(p):
    y, m = map(int, p.split('-')); return f'{y:04d}-{m:02d}-{calendar.monthrange(y, m)[1]:02d}'
dbase = next((m for m in months if m[0] == WAR_START[:7]), None) or (months[0] if months else None)
dollar = []
for p, share, named, dflt in months:
    pts = (share - dbase[1]) * 100
    dollar.append([month_end(p), round(max(-1, min(1, pts / 15)), 3), 0.15,
                   {'share': round(share, 3), 'pointsSinceWar': round(pts, 1), 'named': round(named, 2), 'byDefault': round(dflt, 2)}])

# THE STANDING BODY (11-09, late) — the object is more than the war. Each measure in its own units, over its whole history,
# with no topic in it. A topic lays a zero date over these and reads the change since; another topic reads the same
# series from its own zero.
def since(pts, zero, pct=True):
    b = at(pts, zero); n = pts[-1]
    if not b: return None
    return round((n[1] / b[1] - 1) * 100, 1) if pct else round((n[1] - b[1]) * 100, 1)
dseries = [[month_end(p_), round(sh, 4)] for p_, sh, _n, _d in months]
measures = [
 {'id': 'pump', 'label': 'the pump', 'unit': '$/gal', 'pace': 'weeks', 'source': 'EIA US regular gasoline, retail, weekly (price.json)', 'series': gas,
  'sinceZero': {'value': since(gas, WAR_START), 'unit': '%'}},
 {'id': 'barrel', 'label': 'the barrel', 'unit': '$/bbl', 'pace': 'days', 'source': 'Brent spot, weekly average (price.json)', 'series': brent,
  'sinceZero': {'value': since(brent, WAR_START), 'unit': '%'}},
 {'id': 'dollar', 'label': 'the dollar', 'unit': 'share', 'pace': 'months', 'source': "the Supply Shock Tracker's needle — the dollar's share of the five-station panel's named barrel (tracker-core.js)", 'series': dseries,
  'sinceZero': {'value': since(dseries, month_end(WAR_START[:7]), pct=False) if dseries else None, 'unit': 'points'}},
]
# THE LAW (11-10) — what Congress did, from the roll-call sweep and the bill catalog already on disk (prism_votes.json,
# prism_legislation.json — refreshed by the GitHub Actions; the local copy is as old as the last pull). Counting only.
#   standing: recorded votes a month and laws enacted a month, both chambers, since Jan 2023; and where the law fell
#   (recorded votes and laws by policy area, the last twelve months on file).
#   under the topic: the law's own events on it — every recorded vote on, and enactment of, a bill that names the topic —
#   and a step line, DRAFT for Sailor: what the law had done about the war on that day.
import re, datetime
def vdate(s_):
    s_ = s_.strip()
    try: return datetime.datetime.strptime(s_, '%d-%b-%Y').date().isoformat()
    except ValueError:
        m_ = re.match(r'([A-Za-z]+ \d+, \d{4})', s_)
        return datetime.datetime.strptime(m_.group(1), '%B %d, %Y').date().isoformat() if m_ else None
law_measure, law_view, law_events = None, None, []
try:
    VJ = json.load(open(os.path.join(ROOT, 'data', 'prism_votes.json'))); BL = json.load(open(os.path.join(ROOT, 'data', 'prism_legislation.json')))
    votes_ = sorted([(vdate(x_['date']), x_) for x_ in VJ['votes'] if vdate(x_['date'])], key=lambda t_: (t_[0], t_[1]['voteId']))
    asof = (VJ.get('generated') or '')[:10] or votes_[-1][0]
    bills_ = {b_['billId']: b_ for b_ in BL}
    enacted_ = sorted(((b_['milestones']['enacted'], b_) for b_ in BL if (b_.get('milestones') or {}).get('enacted')), key=lambda t_: (t_[0], t_[1]['billId']))
    def monthly(dates):
        c_ = {}
        for d_ in dates: c_[d_[:7]] = c_.get(d_[:7], 0) + 1
        out, y_, m_ = [], 2023, 1
        while f'{y_:04d}-{m_:02d}' <= asof[:7]:
            k_ = f'{y_:04d}-{m_:02d}'; out.append([asof if k_ == asof[:7] else month_end(k_), c_.get(k_, 0)]); m_ += 1
            if m_ == 13: y_, m_ = y_ + 1, 1
        return out
    vs_ = monthly([d_ for d_, _ in votes_]); es_ = monthly([d_ for d_, _ in enacted_ if d_ >= '2023-01-01'])
    start_ = (datetime.date.fromisoformat(asof) - datetime.timedelta(days=365)).isoformat()
    area_ = {}
    for d_, x_ in votes_:
        if d_ >= start_: area_.setdefault((bills_.get(x_.get('billId')) or {}).get('policyArea') or 'bills not in the catalog', [0, 0])[0] += 1
    for d_, b_ in enacted_:
        if d_ >= start_: area_.setdefault(b_.get('policyArea') or 'unlabeled', [0, 0])[1] += 1
    fell_ = sorted([[k_, v_[0], v_[1]] for k_, v_ in area_.items()], key=lambda r_: -(r_[1] + r_[2]))
    law_measure = {'id': 'law', 'label': 'the law', 'unit': 'a month', 'pace': 'months', 'asOf': asof,
                   'source': 'what Congress did: recorded votes in both chambers (the roll-call sweep) and laws enacted (the bill catalog) — on file as of ' + asof,
                   'seriesLabel': 'recorded votes', 'series': vs_, 'also': {'label': 'laws enacted', 'series': es_},
                   'sinceZero': {'value': len([1 for d_, _ in votes_ if d_ >= WAR_START]), 'unit': 'recorded votes', 'also': len([1 for d_, _ in enacted_ if d_ >= WAR_START]), 'alsoUnit': 'laws'},
                   'fell': {'from': start_, 'to': asof, 'votes': sum(r_[1] for r_ in fell_), 'laws': sum(r_[2] for r_ in fell_), 'rows': fell_[:12],
                            'what': 'where the law fell — recorded votes and laws enacted, by the policy area of the bill, the last twelve months on file'}}
    # the topic's law: bills that name it (Iran in the title; or a war-powers / hostilities measure that names Iran)
    def touches(b_):
        t_ = (b_.get('title') or '').lower(); sub_ = ' '.join(b_.get('subjects') or []).lower()
        return bool(re.search(r'\biran|tehran', t_)) or (bool(re.search(r'hostilities|war powers', t_ + ' ' + sub_)) and 'iran' in t_ + ' ' + sub_)
    tb_ = {b_['billId']: b_ for b_ in BL if touches(b_)}; first_ = LEDGER[0][0]
    wp_ = lambda b_: bool(re.search(r'hostilities|war powers', ((b_.get('title') or '') + ' ' + ' '.join(b_.get('subjects') or [])).lower()))
    for d_, x_ in votes_:
        b_ = tb_.get(x_.get('billId'))
        if b_ and d_ >= first_:
            law_events.append({'date': d_, 'chamber': x_['chamber'], 'bill': x_['billId'], 'title': b_['title'][:110], 'what': x_['question'], 'result': x_['result'],
                               'yea': x_['totals'].get('yea'), 'nay': x_['totals'].get('nay'), 'party': x_.get('party'), 'warPowers': wp_(b_)})
    for d_, b_ in enacted_:
        if b_['billId'] in tb_ and d_ >= first_:
            law_events.append({'date': d_, 'chamber': 'law', 'bill': b_['billId'], 'title': b_['title'][:110], 'what': 'enacted', 'result': 'Became law', 'warPowers': False})
    law_events.sort(key=lambda e_: e_['date'])
    # the step line (DRAFT): only the war-powers question moves it. Took the question up 0 · declined to check the war -0.5 ·
    # ordered the forces out +0.5 (not on file). No reading before the first vote: a line dated earlier is unmeasured.
    lz_ = []
    for e_ in law_events:
        if not e_['warPowers']: continue
        up_ = bool(re.search(r'agreed|passed', e_['result'].lower()))
        final_ = bool(re.search(r'on passage|joint resolution', e_['what'].lower()))
        z_ = 0.5 if (up_ and final_) else 0.0 if up_ else -0.5
        lz_.append([e_['date'], z_, 0.0, f"{e_['chamber'].capitalize()}: {e_['what'].lower().replace('on the ', '')} — {e_['yea']}–{e_['nay']}, {'agreed' if up_ else 'rejected'}"])
    law_view = {'id': 'law', 'label': 'the law', 'kind': 'state', 'pace': 'months', 'source': "what Congress did about the topic — recorded votes on the war-powers resolution (prism_votes.json), as of " + asof,
                'rule': 'what the law had done about the war on that day: took the question up 0 · declined to check the war -0.5 · ordered the forces out +0.5; sigma 0. No reading before the first vote',
                'readings': lz_, 'events': law_events, 'note': 'DRAFT for Sailor — the step values are a proposal. ' + str(len(law_events)) + ' recorded votes and enactments on bills that name the topic are listed under the topic'}
    measures.append(law_measure)
except Exception as e_:
    print('law: not read —', repr(e_))

# THE BODY BEYOND ENERGY (11-10) — the cost of living, groceries, wages, jobs, the mortgage, the market, the ten-year and
# the mood, from data/active/fred.json (scripts/active-fred.js — FRED's keyless CSV route). Standing: each in its own
# units. A month's figure is dated to its last day; a daily series is thinned to the last reading of each week.
# Under the topic, only the three whose direction is not in dispute are read as z (DRAFT rules): prices, jobs, the mood.
# The market, the ten-year, the mortgage, wages and groceries stand without a z until Sailor rules their sign.
fred_view, fred_ids = [], []
try:
    FP_ = os.environ.get('OBJ_FRED') or A('fred.json')
    FJ_ = json.load(open(FP_)) if os.path.exists(FP_) else None
    FR_ = (FJ_ or {}).get('series', {})
    def f_mdated(pts, start='2023-01-01'): return [[month_end(d_[:7]), v_] for d_, v_ in pts if d_ >= start]
    def f_yoy(pts):
        byk = {d_[:7]: v_ for d_, v_ in pts}; out = []
        for d_, v_ in pts:
            k_ = f'{int(d_[:4]) - 1}{d_[4:7]}'
            if k_ in byk and d_ >= '2023-01-01': out.append([month_end(d_[:7]), round((v_ / byk[k_] - 1) * 100, 2)])
        return out
    def f_weekly(pts, start='2023-01-01'):
        out = {}
        for d_, v_ in pts:
            if d_ >= start: out[tuple(datetime.date.fromisoformat(d_).isocalendar())[:2]] = [d_, v_]
        return [out[k_] for k_ in sorted(out)]
    def f_since(pts, pct):
        b_ = at(pts, WAR_START)
        if not b_ or not pts: return None
        return round((pts[-1][1] / b_[1] - 1) * 100, 1) if pct else round(pts[-1][1] - b_[1], 2)
    def f_std(id_, fid, label, unit, pace, kind, pct):
        s_ = FR_.get(fid)
        if not s_ or not s_.get('points'): return None
        raw = s_['points']; level = f_mdated(raw) if kind in ('month', 'yoy') else f_weekly(raw)
        series = f_yoy(raw) if kind == 'yoy' else level
        if not series: return None
        measures.append({'id': id_, 'label': label, 'unit': unit, 'pace': pace, 'source': s_.get('what', fid) + ' (FRED ' + fid + ')' + (' — last copy, the fetch failed' if s_.get('stale') else ''),
                         'series': series, 'sinceZero': {'value': f_since(level, pct), 'unit': '%' if pct else 'points'}})
        fred_ids.append(id_); return level
    L_prices = f_std('prices', 'CPIAUCSL', 'the cost of living', '% a year', 'months', 'yoy', True)
    f_std('groceries', 'CUSR0000SAF11', 'groceries', '% a year', 'months', 'yoy', True)
    f_std('wages', 'CES0500000003', 'wages', '% a year', 'months', 'yoy', True)
    L_jobs = f_std('jobs', 'UNRATE', 'jobs', '%', 'months', 'month', False)
    f_std('mortgage', 'MORTGAGE30US', 'the mortgage', '%', 'weeks', 'week', False)
    f_std('market', 'SP500', 'the market', 'index', 'days', 'week', True)
    f_std('tenyear', 'DGS10', 'the ten-year', '%', 'days', 'week', False)
    L_mood = f_std('mood', 'UMCSENT', 'the mood', 'index', 'months', 'month', False)
    def f_view(id_, label, level, fn, sigma, pace, source, rule, note):
        b_ = at(level, WAR_START) if level else None
        if not b_: return
        rs_ = [[d_, round(max(-1, min(1, fn(v_, b_[1]))), 3) + 0.0, sigma, round(v_, 2)] for d_, v_ in level if d_ >= b_[0]]
        fred_view.append({'id': id_, 'label': label, 'kind': 'reading', 'pace': pace, 'source': source, 'rule': rule, 'base': list(b_), 'readings': rs_, 'note': note})
    f_view('prices', 'the cost of living', L_prices, lambda v_, b_: -((v_ / b_ - 1) * 100) / 5, 0.10, 'months', 'CPI, all items, monthly — BLS, by FRED (fred.json)',
           "every +1% on the price level since the topic's zero = -0.2 z; capped at ±1", 'DRAFT — all prices, not only the pump')
    f_view('jobs', 'jobs', L_jobs, lambda v_, b_: -(v_ - b_) * 0.4, 0.10, 'months', 'the unemployment rate, monthly — BLS, by FRED (fred.json)',
           "every +0.5 points of unemployment since the topic's zero = -0.2 z; capped at ±1", 'DRAFT')
    f_view('mood', 'the mood', L_mood, lambda v_, b_: (v_ - b_) / 25, 0.15, 'months', 'consumer sentiment, monthly — University of Michigan, by FRED (fred.json)',
           "every -5 points of sentiment since the topic's zero = -0.2 z; capped at ±1", "DRAFT — the audience's own report of how it is going, between elections")
    if FJ_ is None: print('fred: no data/active/fred.json yet — run "Fetch the Body.command"')
except Exception as e_:
    print('fred: not read —', repr(e_))

# LIVES (11-10) — US service members killed in the war, from the hand-kept ledger data/active/lives.json (every row carries
# the page it was read from; the Pentagon's own count as reported in the press). Standing: the running count by date.
# Under the topic it is named so a line can point at it, but it carries NO z — how many dead is how frustrated is
# Sailor's ruling. Iranian and civilian dead are not on file.
lives_view = None
try:
    LJ_ = json.load(open(A('lives.json'))) if os.path.exists(A('lives.json')) else None
    if LJ_ and LJ_.get('killed'):
        run_, ser_ = 0, [[WAR_START, 0]]
        for r_ in sorted(LJ_['killed'], key=lambda r_: r_['date']): run_ += r_['n']; ser_.append([r_['date'], run_])
        cs_ = sorted(LJ_.get('counts', []), key=lambda r_: r_['date']); lastc_ = cs_[-1] if cs_ else None
        if lastc_ and lastc_['date'] > ser_[-1][0]: ser_.append([lastc_['date'], lastc_.get('killed') or run_])   # the count held to the last report on file
        wl_ = [c_ for c_ in cs_ if c_.get('wounded') is not None]
        measures.append({'id': 'lives', 'label': 'lives', 'unit': 'killed', 'pace': 'days', 'steps': True, 'asOf': ser_[-1][0],
                         'source': "US service members killed in the war — the Pentagon's count (DCAS) as reported in the press; a hand-kept, sourced ledger (lives.json), on file to " + ser_[-1][0],
                         'series': ser_, 'sinceZero': {'value': ser_[-1][1], 'unit': 'US service members killed', 'also': wl_[-1]['wounded'] if wl_ else None, 'alsoUnit': 'wounded (' + wl_[-1]['date'][5:] + ')' if wl_ else ''},
                         'events': LJ_['killed'], 'counts': cs_, 'notOnFile': LJ_.get('notOnFile', []), 'status': LJ_.get('status')})
        lives_view = {'id': 'lives', 'label': 'lives', 'kind': 'reading', 'pace': 'days', 'source': "US service members killed and wounded — the Pentagon's count as reported in the press (lives.json)",
                      'rule': 'no z yet — how many dead is how frustrated is a ruling Sailor has not made. A line about the dead is named here and stays unmeasured',
                      'readings': [], 'note': str(ser_[-1][1]) + ' killed' + (', ' + str(wl_[-1]['wounded']) + ' wounded' if wl_ else '') + ' on file to ' + ser_[-1][0] + '. Iranian and civilian dead are not on file'}
        if LJ_.get('ledgerHints'): print('lives: the casualty reports point at ledger dates not on the war\'s ledger —', [h_['date'] for h_ in LJ_['ledgerHints']])
except Exception as e_:
    print('lives: not read —', repr(e_))

MISSING = (['the cost of living beyond energy', 'markets', 'jobs and wages'] if not fred_ids else []) + ['approval and right-direction polls'] + ([] if lives_view else ['lives']) + ['Iranian and civilian dead']

# WHERE THE LIGHT FALLS (11-09, late) — each day's sweep, counted by the topic its items matched. Counting only: no model.
# The sweep sees only the topics it is told to look for (the register's terms), so this is a share of the tagged light.
import glob
TOPIC_LABEL = {'midterms': 'the midterms', 'iran': 'the war (Iran)', 'diesel': 'diesel', 'tx-sen': 'Texas Senate', 'dollar': 'the dollar', 'tariffs': 'tariffs',
               'me-sen': 'Maine Senate', 'russia-sanctions': 'Russia sanctions', 'venezuela': 'Venezuela', 'chips': 'chips', 'housing': 'housing', 'shutdown': 'the shutdown'}
pdays, pcounts, pitems = [], {}, []
for f in sorted(glob.glob(os.path.join(ROOT, 'data', 'press', 'sweeps', 'sweep_*.json'))):
    try: sw = json.load(open(f))
    except Exception: continue
    q = sw.get('queue', []); d = os.path.basename(f)[6:16]; c = {}
    for r_ in q:
        for k in {k for k in (r_.get('matched') or {}) if not k.startswith('obj_')}: c[k] = c.get(k, 0) + 1
    if not c: continue
    pdays.append(d); pitems.append(len(q))
    for k in set(list(pcounts) + list(c)): pcounts.setdefault(k, [0] * (len(pdays) - 1)).append(c.get(k, 0))
ptotal = {k: sum(v) for k, v in pcounts.items()}
prevalence = {'what': "each day's sweep, counted by the topic its items matched — where the object's light fell. A share of the tagged light: the sweep sees only the topics it is told to look for",
              'days': pdays, 'items': pitems, 'order': sorted(ptotal, key=lambda k: -ptotal[k]), 'labels': TOPIC_LABEL, 'counts': pcounts, 'total': ptotal}

doc = {
 'what': 'The object as Prism holds it. Its BODY is what is measured (dated readings); its LIGHT is what is said (the room). The TOPIC is the face turned toward the audience now: it carries the ledger and the zero date the body is measured from. Only the light goes through the prism; the body reaches the graphmap as height. The body judges the light, never the reverse. DRAFT — every rule here is a proposal for Sailor.',
 'object': 'the political economy',
 'measures': measures, 'measuresNote': 'the standing body: each measure in its own units, no topic in it', 'notYetMeasured': MISSING,
 'topics': {'PG01': {'label': 'the Iran war', 'zero': WAR_START, 'room': 'iran', 'ledger': LEDGER, 'state': war, 'question': {'label': 'the vote on it', 'readings': vote},
                     'law': law_events, 'reads': ['barrel', 'pump', 'dollar', 'law'] + [v_['id'] for v_ in fred_view] + (['lives'] if lives_view else []), 'note': 'a topic is a zero date, a ledger of what happened, and a slice of the light, laid over the standing body'}},
 'prevalent': 'PG01', 'prevalence': prevalence,
 'viewNote': 'topic / body / room below are the object as seen under the prevalent topic — the standing measures read as change since its zero, plus the topic\'s own state line and its question to the voters. The closed form reads this view.',
 'vantage': 'the audience — American citizens and voters: +1 it delivered for them · -1 it frustrated them',
 'topic': {'id': 'PG01', 'label': 'the Iran war', 'zero': WAR_START, 'zeroNote': 'the war begins — every body reading is change since this date',
           'ledger': LEDGER, 'states': STATES, 'unmeasuredStates': UNMEASURED_STATES, 'room': 'iran',
           'ledgerNote': 'what has happened, as named states. A forecast naming a state is scored against the ledger (right/wrong by due), not z. DRAFT for Sailor: a state not on it has not happened as far as Prism knows'},
 'built': max([pump[-1][0], barrel[-1][0]] + ([dollar[-1][0]] if dollar else []) + ([dreads[-1][0]] if dreads else [])),
 'readingShape': '[date, z, sigma, note]',
 'body': [
  {'id': 'war', 'label': 'the war itself', 'kind': 'state', 'pace': 'days', 'source': "the topic's own state by date — a step line of facts, not a measurement",
   'rule': 'what the object had done to the no-war promise on that day: no war +0.5 · Israel strikes Iran without the US 0 · US strikes Iran -0.5 · the war -1; sigma 0',
   'readings': war, 'note': 'what every forecast in the set was about'},
  {'id': 'barrel', 'label': 'the barrel', 'kind': 'reading', 'pace': 'days', 'source': 'SST — Brent spot, $/bbl (price.json)',
   'rule': 'every +20% on Brent since the topic\'s zero = -0.2 z; capped at ±1', 'base': bbase, 'readings': barrel, 'note': 'what the commentators quote; the pump is what the audience pays'},
  {'id': 'pump', 'label': 'the pump', 'kind': 'reading', 'pace': 'weeks', 'source': 'SST — EIA US regular gasoline, retail, weekly (price.json)',
   'rule': 'every +10% at the pump since the topic\'s zero = -0.2 z; capped at ±1', 'base': base, 'readings': pump, 'note': 'reads the pump since the war, not the war\'s effect on the pump'},
  {'id': 'dollar', 'label': 'the dollar', 'kind': 'reading', 'pace': 'years', 'source': 'SST — the needle: the dollar\'s share of the five-station panel\'s named barrel, monthly (tracker-core.js on active.json + settlement.json)',
   'rule': 'every -3 points of dollar share since the topic\'s zero = -0.2 z; capped at ±1; a month is dated to its last day', 'base': dbase and [WAR_START[:7], round(dbase[1], 3)], 'readings': dollar,
   'note': 'P3 is a forecast line read against this measure, not a condition for it'},
  {'id': 'vote', 'label': 'the vote', 'kind': 'reading', 'pace': 'months', 'source': 'exit polls on "was the war the right decision"',
   'rule': 'z = -(wrong - right) ÷ 100', 'readings': vote, 'note': 'one reading; a line dated before it is read against it as the nearest measurement and flagged. The audience\'s own z — and the one measure the light reaches: the audience heard the room, then voted'},
 ] + ([law_view] if law_view else []) + fred_view + ([lives_view] if lives_view else []),
 'room': {'id': 'room', 'label': 'the room', 'kind': 'discourse', 'pace': 'days', 'source': 'the slop sweep — each day\'s headlines and deks on the topic, every station, through the closed form (slop-day.py → discourse.json)',
           'rule': 'the day\'s read z across the swept lines; sigma = the spread (std) of their z, floor 0.15. Never lights a line: a line gets room = its z - the room\'s z on its date', 'readings': dreads,
           'note': 'the daily average of the light on this topic — what the whole room said. Not a score of anyone; a line is placed against it. Lumens stays body-only'},
 'notOnTheBody': {'shadow': 'a line about who is to blame for a reading, not the reading — nothing measured sees it; its light is "unmeasured"'},
}
json.dump(doc, open(A('object.json'), 'w'), ensure_ascii=False, indent=1)
print('war   ', war[-1][:2]); print('pump  ', base, '→', pump[-1][:2], f'({pump[-1][3]:+.1f}%)'); print('barrel', bbase, '→', barrel[-1][:2], f'({barrel[-1][3]:+.1f}%)'); print('vote  ', vote[0][:2]); print('room  ', len(dreads), 'readings'); print('beyond energy:', fred_ids or 'none', '| read under the topic:', [(v_['id'], v_['readings'][-1][:2]) for v_ in fred_view]); print('law   ', law_measure and law_measure['sinceZero'], '| on the topic:', len(law_events), 'events', [r_[:2] for r_ in (law_view or {}).get('readings', [])])
print('dollar', dbase and round(dbase[1], 3), '→', dollar[-1][:2] if dollar else None, dollar[-1][3] if dollar else '')
