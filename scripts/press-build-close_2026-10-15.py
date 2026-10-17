#!/usr/bin/env python3
"""Build Prism/data/press/close_2026-10-15.json from the cut's lines.
Composites (Dia, read z, lumens, per-voice) are computed here, never hand-rounded.
normX/normY place each line in the RI quadrant (B: upper-right) at a radius set by Dia,
with a deterministic jitter from the timestamp so two lines never stack. normZ = z * 0.75,
matching the Odd Lots cut."""
import json, math, sys

OUT = sys.argv[1] if len(sys.argv) > 1 else 'close_2026-10-15.json'

def ts(s):
    p = [int(x) for x in s.split(':')]
    return p[0]*3600 + p[1]*60 + p[2] if len(p) == 3 else p[0]*60 + p[1]

# t, who, touch, z, dia, mode, inferred, quote, note, chapter, zWhy
L = [
 ('2:04','RB','T',-0.3,8,'open',True,
  "the PPI rose at its fastest pace in more than four years; retail sales ex motor vehicles and gas barely budged",
  "dates the week's record: price into the index, activity flat. 'Jarring' is the one adjective",'The print',
  "price into the index, activity flat: passes"),
 ('29:11','TW','O',-0.3,10,'open',True,
  "oil is not flowing freely in the Strait of Hormuz, and hasn't for quite some time; we're starting to see that show up in pressures — in inflation, in interest rates",
  "→PG01: the supply constraint named, and where it lands — the price level and the rate, not the shelf",'The strait',
  "'shows up in inflation and interest rates' is the price channel, not the shelf"),
 ('29:32','TW','O',-0.5,12,'aligned',True,
  "the US economy has been incredibly resilient until this point; I expected the signals to show up earlier than they have",
  "activity undented, by his own surprise. Sees the gap between the constraint and the economy; does not ask what is absorbing it",'The strait',
  "'resilient' is activity undented"),
 ('29:44','TW','O',-0.4,6,'open',True,
  "with diesel prices rising, you've got the inflation pressure",
  "the crunch named as diesel, landing as a price. Seven words",'The strait',
  "diesel named as a price pressure, nothing else"),
 ('39:21','KA','O',-0.6,14,'aligned',True,
  "the concentration in the AI trade has given the market its resilience — it has survived higher rates, $100 oil",
  "the crunch as weather already survived: priced and passed. Oil is a clause in a sentence about something else",'The Fed’s bind',
  "'survived $100 oil': absorbed"),
 ('39:41','EN','T',-0.3,16,'open',True,
  "the AI trade has looked through all the geopolitical conflict; the Fed is facing weakness in employment and at the same time inflation is a problem — CPI and PPI not where we want them",
  "dates the Fed's bind: price up, labor soft. The crunch is one input, unnamed here",'The Fed’s bind',
  "the crunch as one input to a price problem; labor soft for other reasons"),
 ('42:46','EN','O',-0.4,10,'open',True,
  "inflation reports — a lot of this is oil; it is reverberating through, and he's going to have to be responsive to that",
  "THE ATTRIBUTION: the print read back to oil. The crunch reaches the Fed as a price, not a shortage — 'reverberating' is the pass-through, heard",'The Fed’s bind',
  "'reverberating through' is pass-through heard at the Fed"),
 ('51:12','TS','O',-0.5,8,'open',True,
  "the movement of goods is being affected by the pressure consumers face and companies paying higher prices — and fuel costs, how much more companies are paying to move those goods",
  "fuel as a cost line on freight: the pass-through named before the earnings call",'The bell',
  "fuel as a cost line companies pay: passes"),
 ('51:21','KA','O',-0.2,8,'open',True,
  "trucking is very much an indicator of consumer demand; pressure coming for consumers as we saw in the CPI and PPI data this week",
  "sets up the test without running it: if the crunch bites, trucking shows it. The nearest the tape comes to a falsifier — and it is left as a remark",'The bell',
  "a test set up, not run; leans pass because the week's data is price data"),
 ('1:04:21','RB','T',0.0,4,'open',True,
  "J.B. Hunt under pressure; earnings largely in line, $1.82; revenue about $3.69 billion",
  "dates the record (Q3, reported 10-15)",'The invoice',
  "a number; no claim on the crunch"),
 ('1:04:46','TB','O',-0.2,6,'open',True,
  "the demand is not there; it is still a supply shortage — a truck-driver shortage story; that is what is pushing up rates",
  "names a second object under the freight number: rates rise from labor, and the crunch rides along. The diesel is not the driver",'The invoice',
  "rates rise from labor; the crunch rides along, not biting"),
 ('1:05:08','TB','O',-0.8,4,'open',False,
  "all of the top line at J.B. Hunt was up 20%, including fuel surcharges — that is built on much higher rates",
  "THE PASS-THROUGH IN THE ACCOUNTS: the surcharge inside the revenue line; the crunch arrives as top-line growth. The line the cut exists for",'The invoice',None),
 ('1:05:15','TB','O',-0.3,8,'open',True,
  "they have a cost problem as well because of the driver shortage — signing bonuses, safety bonuses",
  "the cost side is labor, not fuel: the drivers bite, the diesel passes",'The invoice',
  "the cost that bites is labor; by contrast the fuel passes"),
 ('1:06:46','TB','M',-0.6,8,'open',False,
  "intermodal — truck to train for the long haul — is going great; it is about 65% more fuel-efficient than a truck, so it helps shippers; people want intermodal, and that will push up prices",
  "THE MECHANISM: the crunch routes shippers to the fuel-light mode and the price follows them there. Substitution, not shortage",'The invoice',None),
 ('1:07:07','TB','M',-0.7,6,'open',True,
  "contracts are negotiated on a yearly basis; they are underpriced right now, but bid season started in October — they will get higher prices and it will help margins",
  "dates the lag: the pass-through is contractual and arrives on the calendar",'The invoice',
  "contractual repricing is pass-through with a calendar"),
 ('1:07:20','RB','T',-0.7,8,'open',True,
  "intermodal up 20% year-over-year, loads themselves up 8.5% — that is healthy",
  "the activity side: volumes up, not down. No dent in the fuel-light mode",'The invoice',
  "volumes up in the fuel-light mode: no dent"),
 ('1:07:32','TB','T',-0.6,4,'open',True,
  "without a doubt — trucking rates and the spot market are up; that supports the increases in intermodal rates",
  "the record, confirmed",'The invoice',
  "rates up across modes: the price carries it"),
]

NAMES = {'RB':'Romaine Bostick','KA':'Kristine Aquino','TS':'Tim Stenovec','TW':'Tim Walsh (KPMG US CEO)',
         'EN':'Envestnet CIO (unnamed on tape)','TB':'Thomas Black (Bloomberg Opinion)'}

def place(t, dia, z):
    # quadrant B (RI): +x, -y from the object at (0.5, 0.5)
    r = 0.055 + (dia/100.0)*0.38
    j = ((t * 7919) % 1000) / 1000.0            # deterministic jitter 0..1
    ang = math.radians(45 + (j - 0.5) * 24)      # 33°..57°
    return round(0.5 + r*math.cos(ang), 4), round(0.5 - r*math.sin(ang), 4), round(z*0.75, 4)

lines = []
for (t, who, touch, z, dia, mode, inf, quote, note, chapter, why) in L:
    sec = ts(t)
    nx, ny, nz = place(sec, dia, z)
    d = dict(t=sec, who=who, station='RI', quote=quote, touch=touch, z=z, dia=dia, mode=mode,
             note=note, chapter=chapter, normX=nx, normY=ny, normZ=nz, quadrant='B')
    if inf:
        d['zInferred'] = True; d['zWhy'] = why
    lines.append(d)

n = len(lines)
dia = round(sum(l['dia'] for l in lines)/n)
readz = round(sum(l['z'] for l in lines)/n, 2)
spread = [min(l['dia'] for l in lines), max(l['dia'] for l in lines)]
zr = [max(l['z'] for l in lines), min(l['z'] for l in lines)]
rec = {'O','T','B','M','X'}
lum = round(100*sum((1 - l['dia']/100) if l['touch'] in rec else 0 for l in lines)/n)
voices = {}
for w in NAMES:
    ls = [l for l in lines if l['who'] == w]
    if ls:
        voices[w] = dict(dia=round(sum(l['dia'] for l in ls)/len(ls)), readZ=round(sum(l['z'] for l in ls)/len(ls), 2), n=len(ls))

doc = {
 'schema': 'press/parallelogram/v0',
 'id': 'close_2026-10-15',
 'status': 'claude-draft',
 'kind': 'baseline',
 'title': 'The Crunch, Booked',
 'source': {
  'program': 'The Close', 'network': 'Bloomberg', 'date': '2026-10-15',
  'title': 'Stocks Rotate as Tech & Chip Shares Slide',
  'url': 'https://www.youtube.com/watch?v=GEMw6ExKA_Y', 'length': 5513,
  'transcript': 'Parameters/03_Libraries/sources/TheClose_2026-10-15_transcript.md',
  'segmentsCut': ['2:04–2:16','29:01–29:51','39:21–39:57','42:38–42:51','51:04–51:33','1:04:21–1:08:05'],
 },
 'arc': 'PG01',
 'object': {
  'label': 'the refined-products crunch (diesel), as it reaches the balance sheet',
  'layer': 1,
  'zAxis': {'pos': 'bites (physical shortage; activity dents)', 'neg': 'passes through (priced; surcharged; absorbed)'},
 },
 'transform': 'baseline',
 'transformNote': 'no principal in the room — the RI register on an ordinary day, the crunch a line item and not the headline; rule (1): only register-touching segments are cut',
 'scoreboard': {
  'dia': dia, 'tier': 'fluid' if dia <= 33 else ('oscillation' if dia <= 66 else 'denominated'),
  'declaredZ': None, 'readZ': readz, 'readZRange': zr,
  'stations': {'RI': {'dia': dia, 'spread': spread, 'readZ': readz, 'voices': voices}, 'LI': None, 'LP': None, 'RP': None},
  'split': {'topology': 'none', 'station': 'RI', 'strength': 0.0,
            'note': 'every line on the pass side (0.0 → −0.8); the station is aligned — sees the object five ways, never asks the Z question'},
  'mode': 'aligned',
  'lumens': lum,
  'zRule': 'every line carries a z, inferred where implied (Sailor 2026-10-13); inferred lines are marked zInferred with a zWhy',
  'baseline': True,
  'baselineNote': 'the first daily Close cut under the 10-15 proposal: the rolling RI floor is the 7-day mean of baseline pieces; this cut is the only one in its window',
 },
 'names': NAMES,
 'trace': {
  'object': {'x': 0, 'y': 0, 'z': -0.45},
  'shadow': {'x': 0, 'y': 0, 'z': 0.0, 'note': 'none named on this tape; placed at the object for the graphmap'},
  'predicates': {
   'operative': [
    {'type': 'T', 'label': 'JBHT Q3: top line +20% incl. fuel surcharges; intermodal loads +8.5% (reported 10-15)', 'z': 0.9},
    {'type': 'T', 'label': 'PPI at its fastest pace in 4+ years; retail sales ex autos & gas flat (week of 10-15)', 'z': 0.85},
    {'type': 'M', 'label': 'intermodal ≈65% more fuel-efficient than truck; shippers substitute and the price follows', 'z': 0.7},
    {'type': 'M', 'label': 'freight contracts reprice yearly; bid season from October', 'z': 0.6},
    {'type': 'B', 'label': 'Hormuz not flowing freely "for quite some time" (Walsh, by statement)', 'z': 0.5},
   ],
   'stated': [],
   'challenge': [],
  },
  'positions': [
   {'quadrant': 'A', 'station': 'LI', 'fluid': '—', 'denominated': '—', 'distinguishability': 'Low', 'fluidKeywords': [], 'denomKeywords': [], 'note': 'declared empty, by-record: one source, one corner'},
   {'quadrant': 'B', 'station': 'RI',
    'fluid': 'posts the record in order — the print, the strait, the surcharge, the loads — and never assembles it',
    'denominated': '—', 'distinguishability': 'Low',
    'fluidKeywords': ['fastest pace in four years','not flowing freely','diesel prices rising','a lot of this is oil','fuel surcharges','top line up 20%','intermodal','65% more fuel-efficient','bid season','loads up 8.5%'],
    'denomKeywords': [], 'note': 'aligned: zero vehicle words in seventeen lines'},
   {'quadrant': 'C', 'station': 'LP', 'fluid': '—', 'denominated': '—', 'distinguishability': 'Low', 'fluidKeywords': [], 'denomKeywords': [], 'note': 'declared empty, by-record — compare bp_2026-10-12_diesel'},
   {'quadrant': 'D', 'station': 'RP', 'fluid': '—', 'denominated': '—', 'distinguishability': 'Low', 'fluidKeywords': [], 'denomKeywords': [], 'note': 'declared empty, by-record — compare bp_2026-10-12_diesel'},
  ],
 },
 'lines': lines,
 'log': [{'date': '2026-10-15', 'what': 'first cut; baseline kind; z on every line under the z rule; mode aligned (rule 5 exercised)', 'by': 'Claude'}],
}
json.dump(doc, open(OUT, 'w'), ensure_ascii=False, indent=1)
print(f'lines {n} · Dia {dia} · spread {spread} · read z {readz} ({zr}) · lumens {lum}')
for w, v in voices.items(): print(' ', w, v)
