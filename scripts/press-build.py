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
    doc = {k: v for k, v in spec.items() if k not in ('lines', 'principal', 'split', 'mode', 'baseline', 'baselineNote')}
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
    doc['lines'] = lines
    return doc, dict(n=n, dia=dia, readz=readz, lumens=lum, stations={k: (v['dia'], v['readZ'], v['spread']) for k, v in stations.items() if v})

if __name__ == '__main__':
    spec = json.load(open(sys.argv[1]))
    doc, summary = build(spec)
    json.dump(doc, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
    print(json.dumps(summary, ensure_ascii=False))
    for k, v in (doc['scoreboard']['stations'] or {}).items():
        if v: print(' ', k, v['voices'])
