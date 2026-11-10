#!/usr/bin/env python3
"""press-build — a Press cut spec (JSON) → the piece JSON the paper reads.
Composites (Dia, read z, spread, lumens, per-station, per-voice) are computed, never hand-rounded.
Lines are placed in their station's quadrant (A=LI upper-left · B=RI upper-right · C=LP lower-left · D=RP lower-right)
at a radius set by Dia, with a deterministic jitter from the line's position so two lines never stack.
Constitutive lines (station 'O') sit at the object (quadrant 'T') and are never Dia-scored.

Usage: python3 press-build.py <spec.json> <out.json>
Spec: every top-level field is copied through except `lines`, which is a list of
  [pos, who, station, touch, z, dia, mode, inferred(bool), quote, note, chapter, zWhy]
`pos` is seconds for tape, or a paragraph number for print (set "positions": "paragraphs" in the spec)."""
import json, math, sys

Q = {'LI': ('A', -1, -1), 'RI': ('B', 1, -1), 'LP': ('C', -1, 1), 'RP': ('D', 1, 1)}
REC = {'O', 'T', 'B', 'M', 'X'}

def place(pos, station, dia, z):
    if station == 'O':
        return 0.5, 0.5, round(z * 0.75, 4), 'T'
    q, ux, uy = Q[station]
    r = 0.055 + (dia / 100.0) * 0.38
    j = ((int(pos) * 7919) % 1000) / 1000.0
    ang = math.radians(45 + (j - 0.5) * 24)
    return round(0.5 + ux * r * math.cos(ang), 4), round(0.5 + uy * r * math.sin(ang), 4), round(z * 0.75, 4), q


# ── Lumens, tracked (Sailor 2026-11-07: "build the tracker-based lumens now"; 11-08: not gears; 11-09: the object's body) ─────────────
# The object is read off the object's body (data/active/object.json), not declared by the cut. A spec may carry
# `lineMeta`: one {measure, date} per line, in line order ({measure, date} and {gear, date} still read). measure = a body measure's id
# ('war' · 'pump' · 'vote' · 'dollar') or 'shadow'. A line's light = calm × proximity: calm = 1 − Dia/100; proximity = 1
# inside the measure's cloud (|z − measure z| ≤ sigma), falling to 0 a full point (1.0) beyond the cloud's edge. A shadow
# line, or a measure with no reading, is "unmeasured" — left out of the mean, never scored zero. The old Lumens stays
# beside it until Sailor retires it.
def body_reading(G, tid, day):
    t = next((x for x in G['body'] if x['id'] == tid), None)
    if not t or not t['readings']: return None
    best = None
    for r in t['readings']:
        if r[0] <= day: best = r
    if best: return dict(date=best[0], z=best[1], sigma=best[2], nearest=False)
    r = t['readings'][0]; return dict(date=r[0], z=r[1], sigma=r[2], nearest=True)

def lumens_tracked(spec, lines):
    meta = spec.get('lineMeta')
    if not meta: return None
    import os
    G = json.load(open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'active', 'object.json')))
    lit, per, unmeasured = [], {}, 0
    for l, m in zip(lines, meta):
        if l['station'] == 'O': continue
        tid = m.get('measure') or m.get('tracker') or m.get('gear'); l['measure'] = tid; l['date'] = m.get('date')
        rd = None if tid == 'shadow' else body_reading(G, tid, m.get('date') or spec['source']['date'])
        if rd is None:
            l['lightTracked'] = 'unmeasured'; unmeasured += 1; continue
        dist = abs(l['z'] - rd['z']); prox = 1.0 if dist <= rd['sigma'] else max(0.0, 1 - (dist - rd['sigma']))
        light = (1 - l['dia'] / 100) * prox
        l['bodyReading'] = rd; l['proximity'] = round(prox, 3); l['lightTracked'] = round(light, 3)
        lit.append(light); per.setdefault(tid, []).append(light)
    n = len(lit) + unmeasured
    return {'value': round(100 * sum(lit) / len(lit)) if lit else None, 'measured': len(lit), 'unmeasured': unmeasured, 'of': n,
            'perMeasure': {k: round(100 * sum(v) / len(v)) for k, v in per.items()},
            'rule': 'calm (1 − Dia/100) × proximity to the measure the line talks about, read as of the line\'s date; shadow lines unmeasured',
            'body': 'data/active/object.json (built ' + G.get('built', '?') + ')'}

def tier(d): return 'fluid' if d <= 33 else ('oscillation zone' if d <= 66 else 'denominated')

def build(spec):
    lines = []
    for (pos, who, st, touch, z, dia, mode, inf, quote, note, chapter, why) in spec['lines']:
        nx, ny, nz, q = place(pos, st, dia or 0, z)
        d = dict(t=int(pos), who=who, station=st, quote=quote, touch=touch, z=z, dia=dia, mode=mode, note=note,
                 chapter=chapter, normX=nx, normY=ny, normZ=nz, quadrant=q)
        if inf: d['zInferred'] = True; d['zWhy'] = why
        lines.append(d)
    S = [l for l in lines if l['station'] != 'O']
    n = len(S)
    def mean(xs): return sum(xs) / len(xs) if xs else None
    dia = round(mean([l['dia'] for l in S]))
    readz = round(mean([l['z'] for l in S]), 2)
    lum = round(100 * mean([(1 - l['dia'] / 100) if l['touch'] in REC else 0 for l in S]))
    stations = {}
    for k in ['LI', 'RI', 'LP', 'RP']:
        ls = [l for l in S if l['station'] == k]
        if not ls: stations[k] = None; continue
        voices = {}
        for w in sorted(set(l['who'] for l in ls)):
            v = [l for l in ls if l['who'] == w]
            voices[w] = dict(dia=round(mean([l['dia'] for l in v])), readZ=round(mean([l['z'] for l in v]), 2), n=len(v))
        stations[k] = dict(dia=round(mean([l['dia'] for l in ls])), spread=[min(l['dia'] for l in ls), max(l['dia'] for l in ls)],
                           readZ=round(mean([l['z'] for l in ls]), 2), voices=voices)
    const = [l for l in lines if l['station'] == 'O']
    declared = round(mean([l['z'] for l in const if l['who'] == spec.get('principal', '')]), 2) if any(l['who'] == spec.get('principal', '') for l in const) else None
    doc = {k: v for k, v in spec.items() if k not in ('lines', 'lineMeta', 'principal', 'split', 'mode', 'baseline', 'baselineNote')}
    doc['scoreboard'] = {
        'dia': dia, 'tier': tier(dia), 'declaredZ': declared, 'readZ': readz,
        'readZRange': [max(l['z'] for l in S), min(l['z'] for l in S)],
        'stations': stations,
        'split': spec.get('split', {'topology': 'none', 'station': None, 'strength': 0.0}),
        'lumens': lum,
        'zRule': 'every line carries a z, inferred where implied (Sailor 2026-10-13); inferred lines are marked zInferred with a zWhy',
    }
    if spec.get('mode'): doc['scoreboard']['mode'] = spec['mode']
    if spec.get('baseline'): doc['scoreboard']['baseline'] = True; doc['scoreboard']['baselineNote'] = spec.get('baselineNote', '')
    lt = lumens_tracked(spec, lines)
    if lt: doc['scoreboard']['lumensTracked'] = lt
    doc['lines'] = lines
    return doc, dict(n=n, dia=dia, readz=readz, lumens=lum, lumensTracked=(lt or {}).get('value'), stations={k: (v['dia'], v['readZ'], v['spread']) for k, v in stations.items() if v})

if __name__ == '__main__':
    spec = json.load(open(sys.argv[1]))
    doc, summary = build(spec)
    # 11-05: the closed form's derived drafts live on the built piece, beside the hand scores — a rebuild keeps them
    import os
    if os.path.exists(sys.argv[2]):
        try:
            old = json.load(open(sys.argv[2]))
            if old.get('closedform'): doc['closedform'] = old['closedform']
        except Exception: pass
    json.dump(doc, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
    print(json.dumps(summary, ensure_ascii=False))
    for k, v in (doc['scoreboard']['stations'] or {}).items():
        if v: print(' ', k, v['voices'])
