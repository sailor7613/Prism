#!/usr/bin/env python3
"""object-build — the object as Prism holds it (Sailor + Claude, 2026-11-09; replaces trackers-build.py, which replaced gears-build.py).

ONE OBJECT: the political economy. z is read against the Object itself, not against an audience (ruled 11-11; this
replaces the audience wording of 10-22): +1 realized · -1 frustrated. What the Object is realizing is left open.
The object has a BODY and a LIGHT.
  THE BODY — what is measured. Each measure is a dated series of readings, [date, z, sigma, note]:
    war     the topic's own state by date — a step line of facts, sigma 0
    barrel  Brent spot (price.json)
    pump    EIA US regular gasoline, retail, weekly (price.json)
    dollar  the Supply Shock Tracker's needle — the dollar's share of the five-station panel's barrel, monthly
            (src/js/tracker-core.js — the same number the villa and BloomBurger show)
    vote    exit polls (one reading so far)
  THE LIGHT — what is said. The room: each day's sweep on the topic through the closed form (slop-day.py → discourse.json).
THE TOPIC is the face the object shows now (PG01, the Iran war). It carries the LEDGER (what has
happened, as named states) and the ZERO DATE every body reading is measured from — the zero belongs to the topic, not
to the measure: another topic needs its own.
Only the light goes through the prism (a parallelogram is a piece of it, surfaced by the sweep or written into the drop).
The body has no station and no heat; it reaches the graphmap as height. The body judges the light, never the reverse.
The rules were ruled by Sailor on 2026-11-11 (Handoffs/2026-11-11_The_Object_in_the_Villa_Handoff.md); a rule still marked
DRAFT is a scale he has not ruled. Writes data/active/object.json. Run after the SST fetch.
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
          ['2026-02-28', 'war', 'the war begins — the US and Israel strike Iran; Khamenei is killed', 'https://www.goodmorningamerica.com/news/story/us-iran-ceasefire-mou-broke-timeline-134622392'],
          # 11-10: read from the press after the casualty reports pointed at two dates the ledger did not have
          ['2026-04-07', 'ceasefire', 'a two-week ceasefire (reported 04-08); extended indefinitely in late April', 'https://www.goodmorningamerica.com/news/story/us-iran-ceasefire-mou-broke-timeline-134622392'],
          ['2026-06-17', 'accord', 'the US and Iran sign a 14-point memorandum: the ceasefire made formal, the blockade ended, the strait reopened', 'https://www.goodmorningamerica.com/news/story/us-iran-ceasefire-mou-broke-timeline-134622392'],
          ['2026-06-25', 'accord-broken', 'first violation: Iran strikes a ship in the strait, the US answers; contained by 06-26', 'https://www.goodmorningamerica.com/news/story/us-iran-ceasefire-mou-broke-timeline-134622392'],
          ['2026-07-07', 'us-strikes', 'Iran strikes three vessels (07-06 by Al Jazeera\'s account); the US pulls Iran\'s oil licence; the US strikes follow on 07-08 and 07-09', 'https://www.goodmorningamerica.com/news/story/us-iran-ceasefire-mou-broke-timeline-134622392'],
          ['2026-07-08', 'war-resumes', 'Trump declares the deal over; US strikes widen; Iran shuts the strait', 'https://aljazeera.com/news/2026/7/13/march-to-july-whats-different-as-us-iran-fighting-escalates-again'],
          ['2026-07-08', 'strait-closed', 'the Strait of Hormuz shut by Iran', 'https://aljazeera.com/news/2026/7/13/march-to-july-whats-different-as-us-iran-fighting-escalates-again'],
          ['2026-07-13', 'blockade', 'the US naval blockade of Iranian ports reinstated', 'https://www.omanobserver.om/article/1194239/world/region/the-latest-on-where-the-iran-war-stands'],
          ['2026-07-17', 'us-dead', 'three US service members killed in an Iranian attack in Jordan, on an eighth night of strikes', 'https://www.omanobserver.om/article/1194239/world/region/the-latest-on-where-the-iran-war-stands'],
          ['2026-08-02', 'assault-called-off', 'Trump cancels a planned assault at the request of Middle Eastern states; talks through Oman and Qatar', 'https://www.omanobserver.om/article/1194239/world/region/the-latest-on-where-the-iran-war-stands'],
          ['2026-09-01', 'lull', 'the last major US strikes (per IranWire); after this, major combat paused with no truce. The strait\'s state is disputed — Iran says closed, CentCom says open', 'https://gulfnews.com/uae/us-israel-iran-war-lull-nears-breaking-point-us-israel-weighing-new-strikes-what-to-know-oct-20-2026-1.500716736'],
          ['2026-11-03', 'us-strikes', 'the US strikes Qeshm island overnight into election day (Trump: a minor attack); Iran calls the US reply to its Hormuz plan unconvincing', 'https://aljazeera.com/news/2026/11/4/iran-says-us-reply-to-hormuz-plan-unconvincing-trump-confirms-strikes'],
          ['2026-11-06', 'us-strikes', 'Qeshm struck again; 11 ships attacked in and around the strait in the week, three sunk; no truce', 'https://aljazeera.com/news/2026/11/7/qeshm-island-and-hormuz-hit-as-mediators-try-to-prevent-us-iran-escalation']]
LEDGER_NOTE = 'on file to 2026-11-07, read from the press on 11-10 and checked against each row\'s source on 11-11; a hand-kept ledger, every row from 2026 with its source'
STATES = {'congress-ends-war': 'Congress orders the forces out (a war-powers resolution passes both chambers)', 'war': 'a US war with Iran', 'us-strikes': 'US strikes on Iran', 'israel-strikes': 'Israeli strikes on Iran', 'ceasefire': 'a ceasefire', 'accord': 'a signed deal ending the fighting', 'accord-broken': 'a signed deal violated', 'war-resumes': 'the fighting resumes after a ceasefire', 'strait-closed': 'the Strait of Hormuz closed', 'blockade': 'a US naval blockade of Iran', 'lull': 'major combat paused without a truce', 'assault-called-off': 'a planned assault cancelled',
          'boots': 'US ground troops in Iran', 'nuclear-strike': 'a US nuclear strike', 'world-war': 'a world war / war with Russia or China',
          'regime-change': 'the Iranian regime falls', 'war-ends': 'the war ends',
          'casualties': 'American dead — a forecast of how many (give the number in count)', 'other': 'a state no tracker holds (unmeasured)'}
UNMEASURED_STATES = ['casualties', 'other']
war = [['2024-11-05', 0.5, 0.0, 'no war — the promise, holding'],
       ['2025-06-13', 0.0, 0.0, 'Israel strikes Iran; no US boots'],
       ['2025-06-22', -0.5, 0.0, 'US strikes Fordow, Natanz, Isfahan'],
       [WAR_START, -1.0, 0.0, 'the war begins'],
       # Ruled 11-11. Above no war (+0.5) the scale is left for peace that is built: no war with a signed agreement in force +0.75 ·
       # no war with a multilateral settlement, inspected, that has held +1. A signed deal after a war starts at -0.25 and climbs
       # those same steps as it holds (the 06-17 memorandum broke on 07-08 before it climbed).
       # 11-10: the line moves with the ledger — a ceasefire is the fighting paused, not the promise restored
       ['2026-04-07', -0.5, 0.0, 'ceasefire'],
       ['2026-06-17', -0.25, 0.0, 'the memorandum signed'],
       ['2026-07-08', -1.0, 0.0, 'the deal over; the war resumes'],
       ['2026-09-01', -0.75, 0.0, 'major combat paused, no truce']]

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
# commentators quote ("$30 gas", "surging oil prices"); the pump is what people pay. Sigma 0.15: a world price,
# two steps from the pump. Same file as the pump (price.json).
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
# Sigma 0.25: one exit poll, and cause is soft. The voters' own verdict on the war, measured directly, once. (11-11: z is
# read against the Object, not an audience; the vote stays on the body as one of its measures.)
vote = [['2026-11-03', -0.26, 0.25, {'wrong': 63, 'right': 37, 'crucialOrMajor': 74,
         'source': "NBC News Exit Poll, 2026-11-03 — NBC's own page gives 63% wrong decision (nbcnews.com/politics/2026-election/exit-poll-trump-midterms-voters-economy-disapproval-rcna607045). The 37% right and the 74% crucial-or-major are the same poll as reported by The Federalist (thefederalist.com/2026/11/03/exit-poll-iran-war-was-crucial-or-major-factor-for-3-in-4-voters/); NBC's page could not be opened on 11-11 to confirm those two"}]]

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
    # the step line (ruled 11-11): the law measures whether Congress uses its power over the war — not whether the war goes
    # on, which the war's own measure carries. Ordered the forces out +0.5 (the resolution passed by both chambers) · a
    # recorded vote held on the question +0.2, whatever the count · nothing voted on 0 · the vote kept from being held -0.5.
    # A vote kept from the floor leaves no roll call, so those rows are hand-kept in LAW_BLOCKED, each with its source
    # (none on file). Not ruled: a resolution passed by one chamber only — it reads as a vote held (+0.2) until Sailor rules it.
    LAW_BLOCKED = []   # [date, note, source]
    lz_ = [[WAR_START, 0.0, 0.0, 'nothing voted on yet']]; passed_ = set()
    for e_ in law_events:
        if not e_['warPowers']: continue
        up_ = bool(re.search(r'agreed|passed', e_['result'].lower()))
        final_ = bool(re.search(r'on passage|joint resolution', e_['what'].lower()))
        if up_ and final_: passed_.add(e_['chamber'])
        z_ = 0.5 if {'senate', 'house'} <= passed_ else 0.2
        lz_.append([e_['date'], z_, 0.0, f"{e_['chamber'].capitalize()}: {e_['what'].lower().replace('on the ', '')} — {e_['yea']}–{e_['nay']}, {'agreed' if up_ else 'rejected'}; a recorded vote held"])
    for b_ in LAW_BLOCKED: lz_.append([b_[0], -0.5, 0.0, b_[1]])
    lz_.sort(key=lambda r_: r_[0])
    law_view = {'id': 'law', 'label': 'the law', 'kind': 'state', 'pace': 'months', 'source': "what Congress did about the topic — recorded votes on the war-powers resolution (prism_votes.json), as of " + asof,
                'rule': 'whether Congress had used its power over the war on that day: ordered the forces out +0.5 · held a recorded vote on the question +0.2, whatever the count · nothing voted on 0 · the vote kept from being held -0.5; sigma 0',
                'readings': lz_, 'events': law_events, 'note': 'ruled 11-11. A resolution passed by one chamber only is not ruled and reads +0.2; no vote kept from the floor is on file (that row is hand-kept). ' + str(len(law_events)) + ' recorded votes and enactments on bills that name the topic are listed under the topic'}
    measures.append(law_measure)
except Exception as e_:
    print('law: not read —', repr(e_))

# THE BODY BEYOND ENERGY (11-10) — the cost of living, groceries, wages, jobs, the mortgage, the market, the ten-year and
# the mood, from data/active/fred.json (scripts/active-fred.js — FRED's keyless CSV route). Standing: each in its own
# units. A month's figure is dated to its last day; a daily series is thinned to the last reading of each week.
# Under the topic (ruled 11-11): prices, groceries, the mortgage, jobs and the mood are read as z; wages are read against
# prices, never alone. The market and the ten-year stand WITHOUT a z by ruling — neither says on its own whether the
# Object is realizing or frustrating. They stay on the standing body as measures to call up.
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
    L_groc = f_std('groceries', 'CUSR0000SAF11', 'groceries', '% a year', 'months', 'yoy', True)
    L_wages = f_std('wages', 'CES0500000003', 'wages', '% a year', 'months', 'yoy', True)
    L_jobs = f_std('jobs', 'UNRATE', 'jobs', '%', 'months', 'month', False)
    L_mort = f_std('mortgage', 'MORTGAGE30US', 'the mortgage', '%', 'weeks', 'week', False)
    f_std('market', 'SP500', 'the market', 'index', 'days', 'week', True)
    f_std('tenyear', 'DGS10', 'the ten-year', '%', 'days', 'week', False)
    L_mood = f_std('mood', 'UMCSENT', 'the mood', 'index', 'months', 'month', False)
    def f_view(id_, label, level, fn, sigma, pace, source, rule, note):
        b_ = at(level, WAR_START) if level else None
        if not b_: return
        rs_ = [[d_, round(max(-1, min(1, fn(v_, b_[1]))), 3) + 0.0, sigma, round(v_, 2)] for d_, v_ in level if d_ >= b_[0]]
        fred_view.append({'id': id_, 'label': label, 'kind': 'reading', 'pace': pace, 'source': source, 'rule': rule, 'base': list(b_), 'readings': rs_, 'note': note})
    f_view('prices', 'the cost of living', L_prices, lambda v_, b_: -((v_ / b_ - 1) * 100) / 10, 0.10, 'months', 'CPI, all items, monthly — BLS, by FRED (fred.json)',
           "every +1% on the price level since the topic's zero = -0.1 z; capped at ±1", 'ruled 11-11, halved from -0.2 — all prices, not only the pump')
    f_view('jobs', 'jobs', L_jobs, lambda v_, b_: -(v_ - b_) * 0.4, 0.10, 'months', 'the unemployment rate, monthly — BLS, by FRED (fred.json)',
           "every +0.5 points of unemployment since the topic's zero = -0.2 z; capped at ±1", 'ruled 11-11')
    f_view('mood', 'the mood', L_mood, lambda v_, b_: (v_ - b_) / 25, 0.15, 'months', 'consumer sentiment, monthly — University of Michigan, by FRED (fred.json)',
           "every -5 points of sentiment since the topic's zero = -0.2 z; capped at ±1", 'ruled 11-11 — a reading of the mood; the mood is part of the body')
    f_view('groceries', 'groceries', L_groc, lambda v_, b_: -((v_ / b_ - 1) * 100) / 10, 0.10, 'months', 'CPI, food at home, monthly — BLS, by FRED (fred.json)',
           "every +1% on grocery prices since the topic's zero = -0.1 z; capped at ±1", 'sign ruled 11-11 (up is frustrated); the scale is a DRAFT, set to match the cost of living')
    f_view('mortgage', 'the mortgage', L_mort, lambda v_, b_: -(v_ - b_) * 0.2, 0.10, 'weeks', 'the 30-year fixed mortgage rate, weekly — Freddie Mac, by FRED (fred.json)',
           "every +1 point on the mortgage rate since the topic's zero = -0.2 z; capped at ±1", "sign ruled 11-11 (up is frustrated); the scale is a DRAFT — a point on the rate adds about a tenth to a new loan's payment, so it matches the pump")
    L_real = None
    if L_wages and L_prices:
        pm_ = {d_[:7]: v_ for d_, v_ in L_prices}
        L_real = [[d_, v_ / pm_[d_[:7]] * 1000] for d_, v_ in L_wages if d_[:7] in pm_]
    f_view('wages', 'wages', L_real, lambda v_, b_: ((v_ / b_ - 1) * 100) / 10, 0.10, 'months', 'average hourly earnings set against the CPI, monthly — BLS, by FRED (fred.json)',
           "wages scored against prices: every 1% that pay gains on prices since the topic's zero = +0.1 z, every 1% it loses = -0.1; capped at ±1", 'ruled 11-11 (wages are read against prices, never alone); the scale is a DRAFT, set to match the cost of living. The fourth figure is pay over prices, an index')
    if FJ_ is None: print('fred: no data/active/fred.json yet — run "Fetch the Body.command"')
except Exception as e_:
    print('fred: not read —', repr(e_))

# LIVES (11-10) — US service members killed in the war, from the hand-kept ledger data/active/lives.json (every row carries
# the page it was read from; the Pentagon's own count as reported in the press). Standing: the running count by date.
# Under the topic it is named so a line can point at it, but it carries NO z, permanently (ruled 11-11): the dead and
# wounded are counted and shown, never scored. Iranian and civilian dead are not on file.
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
                      'rule': 'no z, permanently (ruled 11-11): the dead and wounded are counted and shown, never scored. A line about the dead is named here and stays unmeasured',
                      'readings': [], 'note': str(ser_[-1][1]) + ' killed' + (', ' + str(wl_[-1]['wounded']) + ' wounded' if wl_ else '') + ' on file to ' + ser_[-1][0] + '. Iranian and civilian dead are not on file'}
        if LJ_.get('ledgerHints'): print('lives: the casualty reports point at ledger dates not on the war\'s ledger —', [h_['date'] for h_ in LJ_['ledgerHints']])
except Exception as e_:
    print('lives: not read —', repr(e_))

# THE MOOD BETWEEN ELECTIONS (11-10; 11-11: 'audience' is retired as z's vantage — the file keeps its name, audience.json) — approval and direction, from the hand-kept, sourced file data/active/audience.json.
#   approval   presidential job approval, all adults: Gallup monthly through 2025; from 2026 the mean of the polls the
#              American Presidency Project lists for the month (each row named in the file), dated to the month's last poll
#   direction  Gallup, % satisfied with the way things are going, monthly
# Under the topic both are read as z (ruled 11-11): direction, and approval on direction's scale — approval up reads
# realized. Both are readings of the mood, and the mood is part of the body.
aud_view = None; app_view = None
try:
    AJ_ = json.load(open(A('audience.json'))) if os.path.exists(A('audience.json')) else None
    if AJ_:
        ar_ = sorted(AJ_['approval']['rows'], key=lambda r_: r_['end']); bym_ = {}
        for r_ in ar_: bym_.setdefault(r_['end'][:7], []).append(r_)
        aser_ = [[max(x_['end'] for x_ in rs_), round(sum(x_['approve'] for x_ in rs_) / len(rs_), 1)] for k_, rs_ in sorted(bym_.items())]
        dser_ = [[r_['date'], r_['satisfied']] for r_ in sorted(AJ_['direction']['rows'], key=lambda r_: r_['date'])]
        def a_since(pts): b_ = at(pts, WAR_START); return round(pts[-1][1] - b_[1], 1) if b_ and pts else None
        measures.append({'id': 'approval', 'label': 'approval', 'unit': 'pct', 'pace': 'months', 'asOf': aser_[-1][0],
                         'source': 'presidential job approval, all adults — Gallup monthly through 2025; from 2026 the mean of the ' + str(len([r_ for r_ in ar_ if r_['end'] >= '2026'])) + ' polls the American Presidency Project lists, by month (audience.json), on file to ' + aser_[-1][0],
                         'series': aser_, 'sinceZero': {'value': a_since(aser_), 'unit': 'points'}, 'status': AJ_.get('status'), 'notOnFile': ['any poll after ' + aser_[-1][0]]})
        measures.append({'id': 'direction', 'label': 'direction', 'unit': 'pct', 'pace': 'months', 'asOf': dser_[-1][0],
                         'source': "Gallup — satisfied with the way things are going in the United States, % (audience.json), on file to " + dser_[-1][0],
                         'series': dser_, 'sinceZero': {'value': a_since(dser_), 'unit': 'points'}})
        b_ = at(dser_, WAR_START)
        if b_:
            aud_view = {'id': 'direction', 'label': 'direction', 'kind': 'reading', 'pace': 'months', 'source': 'Gallup — % satisfied with the way things are going, monthly (audience.json)',
                        'rule': "every -5 points of satisfaction since the topic's zero = -0.2 z; capped at ±1", 'base': list(b_),
                        'readings': [[d_, round(max(-1, min(1, (v_ - b_[1]) / 25)), 3) + 0.0, 0.15, v_] for d_, v_ in dser_ if d_ >= b_[0]],
                        'note': 'ruled 11-11 — a reading of the mood; the mood is part of the body'}
        ba_ = at(aser_, WAR_START)
        if ba_:
            app_view = {'id': 'approval', 'label': 'approval', 'kind': 'reading', 'pace': 'months', 'source': 'presidential job approval, all adults, by month (audience.json)',
                        'rule': "every -5 points of approval since the topic's zero = -0.2 z; capped at ±1", 'base': list(ba_),
                        'readings': [[d_, round(max(-1, min(1, (v_ - ba_[1]) / 25)), 3) + 0.0, 0.15, v_] for d_, v_ in aser_ if d_ >= ba_[0]],
                        'note': "ruled 11-11: approval up reads realized, on direction's scale — a reading of the mood, which is part of the body"}
except Exception as e_:
    print('audience: not read —', repr(e_))

MISSING = (['the cost of living beyond energy', 'markets', 'jobs and wages'] if not fred_ids else []) + ([] if aud_view else ['approval and right-direction polls']) + ([] if lives_view else ['lives']) + ['Iranian and civilian dead']

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
 'what': 'The object as Prism holds it. Its BODY is what is measured (dated readings); its LIGHT is what is said (the room). The TOPIC is the face the object shows now: it carries the ledger and the zero date the body is measured from. Only the light goes through the prism; the body reaches the graphmap as height. The body judges the light, never the reverse. Ruled by Sailor 2026-11-11; a rule marked DRAFT is a scale not yet ruled.',
 'object': 'the political economy',
 'measures': measures, 'measuresNote': 'the standing body: each measure in its own units, no topic in it', 'notYetMeasured': MISSING,
 'topics': {'PG01': {'label': 'the Iran war', 'zero': WAR_START, 'room': 'iran', 'ledger': LEDGER, 'state': war, 'question': {'label': 'the vote on it', 'readings': vote},
                     'law': law_events, 'reads': ['barrel', 'pump', 'dollar', 'law'] + [v_['id'] for v_ in fred_view] + (['direction'] if aud_view else []) + (['approval'] if app_view else []) + (['lives'] if lives_view else []), 'note': 'a topic is a zero date, a ledger of what happened, and a slice of the light, laid over the standing body'}},
 'prevalent': 'PG01', 'prevalence': prevalence,
 'viewNote': 'topic / body / room below are the object as seen under the prevalent topic — the standing measures read as change since its zero, plus the topic\'s own state line and its question to the voters. The closed form reads this view.',
 'vantage': 'the Object itself — z is read against the Object of political economy, not against an audience: +1 realized · -1 frustrated (ruled 11-11; replaces the audience wording of 10-22). What the Object is realizing is left open',
 'topic': {'id': 'PG01', 'label': 'the Iran war', 'zero': WAR_START, 'zeroNote': 'the war begins — every body reading is change since this date',
           'ledger': LEDGER, 'ledgerTo': LEDGER_NOTE, 'states': STATES, 'unmeasuredStates': UNMEASURED_STATES, 'room': 'iran',
           'ledgerNote': 'what has happened, as named states. A forecast naming a state is scored against the ledger (right/wrong by due), not z. DRAFT for Sailor: a state not on it has not happened as far as Prism knows'},
 'built': max([pump[-1][0], barrel[-1][0]] + ([dollar[-1][0]] if dollar else []) + ([dreads[-1][0]] if dreads else [])),
 'readingShape': '[date, z, sigma, note]',
 'body': [
  {'id': 'war', 'label': 'the war itself', 'kind': 'state', 'pace': 'days', 'source': "the topic's own state by date — a step line of facts, not a measurement",
   'rule': 'what the object had done to the no-war promise on that day: no war with a multilateral settlement, inspected, that has held +1 · no war with a signed agreement in force +0.75 · no war +0.5 · Israel strikes Iran without the US 0 · US strikes Iran -0.5 · the war -1 · a ceasefire -0.5 · a signed deal -0.25, climbing the upper steps as it holds · the war resumed -1 · combat paused without a truce -0.75; sigma 0 (ruled 11-11)',
   'readings': war, 'note': 'what every forecast in the set was about'},
  {'id': 'barrel', 'label': 'the barrel', 'kind': 'reading', 'pace': 'days', 'source': 'SST — Brent spot, $/bbl (price.json)',
   'rule': 'every +20% on Brent since the topic\'s zero = -0.2 z; capped at ±1', 'base': bbase, 'readings': barrel, 'note': 'what the commentators quote; the pump is what people pay'},
  {'id': 'pump', 'label': 'the pump', 'kind': 'reading', 'pace': 'weeks', 'source': 'SST — EIA US regular gasoline, retail, weekly (price.json)',
   'rule': 'every +10% at the pump since the topic\'s zero = -0.2 z; capped at ±1', 'base': base, 'readings': pump, 'note': 'reads the pump since the war, not the war\'s effect on the pump'},
  {'id': 'dollar', 'label': 'the dollar', 'kind': 'reading', 'pace': 'years', 'source': 'SST — the needle: the dollar\'s share of the five-station panel\'s named barrel, monthly (tracker-core.js on active.json + settlement.json)',
   'rule': 'every -3 points of dollar share since the topic\'s zero = -0.2 z; capped at ±1; a month is dated to its last day', 'base': dbase and [WAR_START[:7], round(dbase[1], 3)], 'readings': dollar,
   'note': 'the sign is ruled 11-11: a falling share is frustrated, and what it frustrates is the Object. P3 is an ordinary forecast line read against this measure'},
  {'id': 'vote', 'label': 'the vote', 'kind': 'reading', 'pace': 'months', 'source': 'exit polls on "was the war the right decision"',
   'rule': 'z = -(wrong - right) ÷ 100', 'readings': vote, 'note': 'one reading; a line dated before it is read against it as the nearest measurement and flagged. The voters\' own verdict, and the one measure the light reaches: the voters heard the room, then voted'},
 ] + ([law_view] if law_view else []) + fred_view + ([aud_view] if aud_view else []) + ([app_view] if app_view else []) + ([lives_view] if lives_view else []),
 'room': {'id': 'room', 'label': 'the room', 'kind': 'discourse', 'pace': 'days', 'source': 'the slop sweep — each day\'s headlines and deks on the topic, every station, through the closed form (slop-day.py → discourse.json)',
           'rule': 'the day\'s read z across the swept lines; sigma = the spread (std) of their z, floor 0.15. Never lights a line: a line gets room = its z - the room\'s z on its date', 'readings': dreads,
           'note': 'the daily average of the light on this topic — what the whole room said. Not a score of anyone; a line is placed against it. Lumens stays body-only'},
 'notOnTheBody': {'shadow': 'a line about who is to blame for a reading, not the reading — nothing measured sees it; its light is "unmeasured"'},
}
json.dump(doc, open(A('object.json'), 'w'), ensure_ascii=False, indent=1)

# THE INDEX OF PARALLELOGRAMS (11-10) — every set that has been passed through, for Prism's landing. Read off the outputs;
# a day of the room is marked as such. Counting only.
try:
    PD_ = os.path.join(ROOT, 'data', 'parallelograms'); sets_ = []
    for f_ in sorted(glob.glob(os.path.join(PD_, '*.json'))):
        n_ = os.path.basename(f_)[:-5]
        if n_.startswith('_') or n_ == 'index' or '.' in n_ or n_.endswith('_first-read') or n_.endswith('_claude-in-chat'): continue
        try: d_ = json.load(open(f_))
        except Exception: continue
        sb_ = d_.get('scoreboard')
        if not sb_ or 'lines' not in d_: continue
        room_ = n_.startswith('slop_')
        sets_.append({'id': n_, 'title': d_.get('title') or n_, 'room': room_, 'date': n_[-10:] if room_ else None, 'at': d_.get('at'),
                      'lines': sb_.get('lines'), 'dia': sb_.get('dia'), 'readZ': sb_.get('readZ'), 'lumens': sb_.get('lumensTracked'),
                      'forecasts': len((sb_.get('forecasts') or {}).get('lines', [])), 'moments': len(sb_.get('gnostic') or [])})
    sets_.sort(key=lambda s_: (s_['room'], s_['date'] or '', s_['at'] or ''))
    json.dump({'what': 'every parallelogram on file — built by object-build.py from the outputs', 'built': doc['built'], 'sets': sets_}, open(os.path.join(PD_, 'index.json'), 'w'), ensure_ascii=False, indent=1)
    print('index ', len([s_ for s_ in sets_ if not s_['room']]), 'sets ·', len([s_ for s_ in sets_ if s_['room']]), 'days of the room')
except Exception as e_:
    print('index: not written —', repr(e_))
print('war   ', war[-1][:2]); print('pump  ', base, '→', pump[-1][:2], f'({pump[-1][3]:+.1f}%)'); print('barrel', bbase, '→', barrel[-1][:2], f'({barrel[-1][3]:+.1f}%)'); print('vote  ', vote[0][:2]); print('room  ', len(dreads), 'readings'); print('beyond energy:', fred_ids or 'none', '| read under the topic:', [(v_['id'], v_['readings'][-1][:2]) for v_ in fred_view]); print('law   ', law_measure and law_measure['sinceZero'], '| on the topic:', len(law_events), 'events', [r_[:2] for r_ in (law_view or {}).get('readings', [])])
print('dollar', dbase and round(dbase[1], 3), '→', dollar[-1][:2] if dollar else None, dollar[-1][3] if dollar else '')
