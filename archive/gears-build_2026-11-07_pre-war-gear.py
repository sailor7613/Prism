#!/usr/bin/env python3
"""gears-build — the clockwork at the centre of the supply shock tracker (Sailor + Claude, 2026-11-07; DRAFT, rules owed).
One object (the Iran war, PG01), three gears turning at different speeds. Each gear has its own tracker and its own z
(−1 frustrated … +1 realized, for the audience). A line is read against the gear it talks about, as of its own date.
Writes data/active/gears.json. Run after the SST fetch. Usage: python3 scripts/gears-build.py"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = lambda f: os.path.join(ROOT, 'data', 'active', f)
WAR_START = '2026-02-28'
P = json.load(open(A('price.json')))['series']

def at(pts, day):
    best = None
    for d, v in pts:
        if d <= day: best = (d, v)
    return best

# FAST GEAR — the pump. Rule (plain): every +10% on US retail gasoline since the war began moves z by −0.2; capped at ±1.
# Sigma 0.10: an official weekly EIA series, one step from the object.
gas = P['EMM_EPMR_PTE_NUS_DPG']['points']
base = at(gas, WAR_START)
pump = []
for d, v in gas:
    if d < WAR_START: continue
    pct = (v / base[1] - 1) * 100
    pump.append([d, round(max(-1, min(1, -pct / 50)), 3), 0.10, round(pct, 1)])

# MIDDLE GEAR — the vote. Rule (plain): z = −(share calling the war the wrong decision − share calling it right) ÷ 100.
# Sigma 0.25: one exit poll, and cause is soft — 74% called the war crucial or major, but other reads put cost of living
# and corruption ahead of it. Replace with AP VoteCast cause rankings when they're read.
vote = [['2026-11-03', -0.26, 0.25, {'wrong': 63, 'right': 37, 'crucialOrMajor': 74,
         'source': 'NBC News exit poll, 2026-11-03, as reported by The Federalist (thefederalist.com/2026/11/03/exit-poll-iran-war-was-crucial-or-major-factor-for-3-in-4-voters/)'}]]

doc = {
 'what': 'The clockwork: one object, gears at different speeds, each with its own tracker. Lines are read against their own gear as of their own date. DRAFT — every rule here is a proposal for Sailor.',
 'object': 'PG01 — the Iran war (war start ' + WAR_START + ')',
 'built': max(r[0] for r in pump),
 'gears': [
  {'id': 'pump', 'label': 'the pump', 'speed': 'weeks', 'tracker': 'SST — EIA US regular gasoline, retail (price.json)',
   'rule': 'every +10% at the pump since the war began = −0.2 z; capped at ±1', 'base': base, 'readings': pump,
   'readingShape': '[date, z, sigma, pct change since war start]'},
  {'id': 'vote', 'label': 'the vote', 'speed': 'months', 'tracker': 'exit polls (vote-cause tracker, to be built)',
   'rule': 'z = −(wrong − right) ÷ 100 on "was the war the right decision"', 'readings': vote,
   'readingShape': '[date, z, sigma, figures]', 'note': 'only the election-day reading exists; a line dated before it is read against it as the nearest measurement and flagged'},
  {'id': 'dollar', 'label': 'the dollar', 'speed': 'years', 'tracker': 'SST settlement layer (settlement.json) + P3',
   'rule': 'unmeasured until P3 is scored (TF03)', 'readings': []},
 ],
 'notAGear': {'shadow': 'a line about who is to blame for a reading, not the reading — no instrument sees it; its light is "unmeasured"'},
}
json.dump(doc, open(A('gears.json'), 'w'), ensure_ascii=False, indent=1)
print('pump base', base, '→ latest', pump[-1]); print('vote', vote[0][:3])
