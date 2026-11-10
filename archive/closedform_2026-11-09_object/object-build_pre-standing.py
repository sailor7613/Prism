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
STATES = {'war': 'a US war with Iran', 'us-strikes': 'US strikes on Iran', 'israel-strikes': 'Israeli strikes on Iran', 'ceasefire': 'a ceasefire',
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

doc = {
 'what': 'The object as Prism holds it. Its BODY is what is measured (dated readings); its LIGHT is what is said (the room). The TOPIC is the face turned toward the audience now: it carries the ledger and the zero date the body is measured from. Only the light goes through the prism; the body reaches the graphmap as height. The body judges the light, never the reverse. DRAFT — every rule here is a proposal for Sailor.',
 'object': 'the political economy',
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
 ],
 'light': {'id': 'room', 'label': 'the room', 'kind': 'discourse', 'pace': 'days', 'source': 'the slop sweep — each day\'s headlines and deks on the topic, every station, through the closed form (slop-day.py → discourse.json)',
           'rule': 'the day\'s read z across the swept lines; sigma = the spread (std) of their z, floor 0.15. Never lights a line: a line gets room = its z - the room\'s z on its date', 'readings': dreads,
           'note': 'all of the object\'s light on a given day. Lumens stays body-only'},
 'notOnTheBody': {'shadow': 'a line about who is to blame for a reading, not the reading — nothing measured sees it; its light is "unmeasured"'},
}
json.dump(doc, open(A('object.json'), 'w'), ensure_ascii=False, indent=1)
print('war   ', war[-1][:2]); print('pump  ', base, '→', pump[-1][:2], f'({pump[-1][3]:+.1f}%)'); print('barrel', bbase, '→', barrel[-1][:2], f'({barrel[-1][3]:+.1f}%)'); print('vote  ', vote[0][:2]); print('room  ', len(dreads), 'readings')
print('dollar', dbase and round(dbase[1], 3), '→', dollar[-1][:2] if dollar else None, dollar[-1][3] if dollar else '')
