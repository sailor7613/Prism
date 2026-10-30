# Fukuyama runs — Press-grammar scoring, Claude draft (2026-10-21). Every score is a proposal for Sailor's ruling.
# One line per substantive turn: [transcript line no. (1-based), who, station, touch, z, dia, mode, inferred, quote, note, lit-words]
# z is written against each run's declared Z (below) before the words are read.
import json, sys

RUNS = {
 '1992': dict(
  source=dict(program='Charlie Rose', date='1992-02-11', segment='Francis Fukuyama — The End of History and the Last Man', runtime='21:11'),
  object='Liberal democracy as the end point of history',
  Z='+1: liberal democracy has no serious rival and no fatal flaw — it holds  ↔  −1: a rival or an internal flaw undoes it',
  layer='the regime form',
  names={'CR': 'Charlie Rose', 'FF': 'Francis Fukuyama'},
  stations={'CR': 'LI', 'FF': 'RI'},
  lines=[
   [1, 'CR', 'LI', 'F', .3, 30, 'open', True, 'does the end of the Cold War mean the end of history? he says yes — a storm of controversy', 'frames the guest by the headline', ['end of history', 'storm', 'controversy']],
   [3, 'CR', 'LI', 'F', .2, 34, 'open', True, 'a provocative title — why is history ending, and who is the last man?', 'the title as a dare', ['provocative', 'last man']],
   [4, 'FF', 'RI', 'O', .9, 8, 'open', False, 'history with a capital H — the evolution of all societies, culminating in liberal democracy', 'defines the term; sizes the object', ['capital', 'evolution', 'liberal democracy']],
   [5, 'CR', 'LI', 'F', .8, 38, 'open', True, 'the good guys won — over fascism, then communism', 'the scoreboard frame', ['good guys', 'fascism', 'communism']],
   [7, 'CR', 'LI', 'X', -.1, 22, 'open', True, 'how do we know it\'s over? another ideology might arise', 'states the falsifier', ['ideology', 'arise']],
   [8, 'FF', 'RI', 'X', .5, 10, 'open', False, 'we can\'t know 100 years out — the question is whether it has internal contradictions', 'concedes the horizon; names the test', ['100 years', 'contradictions', 'house of cards']],
   [12, 'FF', 'RI', 'T', .9, 6, 'open', False, 'about 60 democracies, 40% of the world — 3 in 1790', 'the record, counted', ['60 democracies', '40%', '1790']],
   [14, 'FF', 'RI', 'M', .8, 12, 'open', False, 'people hated police states; markets bring prosperity; the deeper reason is the desire to be recognized', 'the mechanism', ['police states', 'prosperity', 'recognized']],
   [18, 'FF', 'RI', 'O', .7, 10, 'open', False, 'thymos — the part of us that demands recognition; pride, self-esteem', 'names the instrument', ['thymos', 'recognition', 'pride']],
   [21, 'CR', 'LI', 'F', .6, 28, 'open', True, 'it\'s never extinguished, no matter how brutal the boot?', 'leading question', ['brutal', 'boot', 'extinguish']],
   [22, 'FF', 'RI', 'O', .8, 12, 'open', False, 'our desire to have our human dignity recognized is what makes us human', 'THE DIGNITY LINE', ['human dignity', 'recognized']],
   [23, 'CR', 'LI', 'X', -.3, 24, 'open', True, 'it hasn\'t done well on racism and poverty — contradictions?', 'the challenge predicate', ['racism', 'poverty', 'contradictions']],
   [24, 'FF', 'RI', 'X', .7, 16, 'open', False, 'the problem is how we implement equality, not the principle — nobody has improved on liberty and equality', 'answers the challenge by moving it to implementation', ['principle', 'liberty', 'equality']],
   [28, 'FF', 'RI', 'T', .6, 10, 'open', False, 'Hegel invented history as progressive; Marx was his student; the founders\' ideas are key', 'cites the lineage', ['Hegel', 'Marx', 'founding']],
   [29, 'CR', 'LI', 'F', -.2, 40, 'open', True, 'no competition means no creativity — a world of cultural banality; ain\'t no fun about that', 'the critics\' frame, voiced', ['banality', 'no fun']],
   [30, 'FF', 'RI', 'X', -.2, 18, 'open', False, 'I agree — peace and prosperity shrink our horizon; a side of man wants great causes, struggle, risk', 'concedes the flaw inside his own thesis', ['great causes', 'struggle', 'risk']],
   [38, 'FF', 'RI', 'X', -.4, 20, 'open', False, 'people want ideals to live by — achieve them and you create the grounds for a problem', 'THE LAST MAN: a dated warning', ['ideals', 'grounds for a problem']],
   [40, 'FF', 'RI', 'X', .1, 14, 'open', False, 'intolerant nationalism is a competitor — Serbia and Croatia', 'names the rival', ['nationalism', 'Serbia', 'Croatia']],
   [42, 'FF', 'RI', 'F', .6, 18, 'open', False, 'Russia and Ukraine are developing a reasonably moderate nationalism', 'a prediction, dated 1992', ['moderate', 'Russia', 'Ukraine']],
   [46, 'FF', 'RI', 'M', .1, 12, 'open', False, 'many places won\'t become democracies — they need an economy and a civic culture', 'the preconditions', ['civic culture', 'economic system']],
   [47, 'CR', 'LI', 'X', -.4, 26, 'open', True, 'Russians in the streets asking for communism back — democracy wasn\'t good to them', 'counter-evidence, dated', ['communism', 'command economy']],
   [48, 'FF', 'RI', 'T', .3, 14, 'open', False, 'people are waiting in the wings — but they came into the streets last August', 'pessimist short, optimist long', ['waiting in the wings', 'streets', 'coup']],
   [54, 'FF', 'RI', 'O', .8, 10, 'open', False, 'I am not willing to sell my human dignity for a piece of sausage', 'the protester\'s line, quoted', ['dignity', 'sausage']],
   [55, 'CR', 'LI', 'X', -.2, 36, 'open', True, 'the Cold War is over and Japan and Germany won — the coming war with Japan', 'the rival, by economics', ['Japan', 'Germany', 'coming war']],
   [56, 'FF', 'RI', 'M', .7, 12, 'open', False, 'a trade war is a war by metaphor only — shared interest in an open economy', 'the mechanism of restraint', ['trade war', 'metaphor', 'open']],
   [62, 'FF', 'RI', 'M', .6, 16, 'open', False, 'the trouble with Japan is our recession — it will end and feelings will ease', 'a dated forecast', ['recession', 'ameliorate']],
   [65, 'CR', 'LI', 'X', -.2, 22, 'open', True, 'have we lost sight of the third world — Africa, Asia?', 'widens the frame', ['third world', 'Africa']],
   [66, 'FF', 'RI', 'T', .3, 14, 'open', False, 'the third world splits — Latin America and Mexico rising; South Asia and Africa stuck in history', 'sorts the record', ['Mexico', 'stuck in history']],
   [68, 'FF', 'RI', 'X', -.3, 16, 'open', False, 'Africa has moved backward at an astounding pace — it may be marginalised', 'counter-evidence he volunteers', ['backward', 'marginalised']],
   [80, 'FF', 'RI', 'O', .8, 8, 'open', False, 'the end of history means the large countries agree on ends', 'the definition, restated', ['agree on ends']],
   [84, 'FF', 'RI', 'O', .9, 12, 'open', False, 'history ended with the French and American revolutions — 200 years of applying the principles', 'the boldest line, said flat', ['French', 'American', 'revolutions']],
   [88, 'FF', 'RI', 'T', .7, 8, 'open', False, 'the Soviet press in \'87, \'88 talking about private property — then what are we fighting about?', 'where the idea came from, dated', ['Soviet press', 'private property']],
   [92, 'FF', 'RI', 'T', .5, 10, 'open', False, 'my superiors read it as: democracy is winning', 'the reception', ['democracy is winning']],
   [97, 'CR', 'LI', 'F', .2, 30, 'open', True, 'Will: we\'ve won the heart of humanity — not necessarily good for its soul; banality breeds instability, nativism', 'the close, read from a blurb', ['heart', 'soul', 'banality', 'nativism']],
  ]),
 '2011': dict(
  source=dict(program='Charlie Rose', date='2011', segment='Francis Fukuyama — The Origins of Political Order', runtime='13:12'),
  object='Durable political institutions',
  Z='+1: the democratic impulse becomes durable institutions that deliver  ↔  −1: it doesn\'t — the gap stays open',
  layer='the state, the rule of law, accountability',
  names={'CR': 'Charlie Rose', 'FF': 'Francis Fukuyama'},
  stations={'CR': 'LI', 'FF': 'LI'},
  lines=[
   [1, 'CR', 'LI', 'F', .3, 18, 'open', True, 'from pre-human times to the eve of the French and American revolutions', 'sets the span', ['pre-human', 'revolutions']],
   [3, 'CR', 'LI', 'X', 0, 24, 'open', True, 'Huntington\'s clash of civilizations — confirmed, rejected, or misunderstood?', 'the verdict question', ['clash', 'confirmed', 'rejected']],
   [4, 'FF', 'LI', 'X', .6, 14, 'open', False, 'the Arab spring cuts against him — Egyptians don\'t like authoritarian government any more than anyone', 'counter-evidence to a cultural exception', ['Arab spring', 'authoritarian']],
   [6, 'FF', 'LI', 'M', .2, 10, 'open', False, 'instability comes from educated middle classes shut out of participation and jobs', 'Huntington\'s mechanism', ['middle-class', 'educations', 'participate']],
   [7, 'CR', 'LI', 'X', 0, 24, 'open', True, 'the End of History — confirmed, rebutted, or misunderstood?', 'the same verdict question, turned on him', ['End of History', 'rebutted']],
   [10, 'FF', 'LI', 'X', .5, 14, 'open', False, 'the argument looks better today — no cultural exception, though no good Arab democracies yet', 'reads his 1992 thesis from 2011', ['looks better', 'culture exception']],
   [12, 'FF', 'LI', 'T', -.6, 10, 'open', False, 'Ukraine: the Orange Revolution couldn\'t deliver; the man who stole the 2004 election just got elected', 'the record against the impulse', ['Ukraine', 'orange revolution', 'stole']],
   [14, 'FF', 'LI', 'T', -.6, 14, 'open', False, 'basically the same guy, authoritarian instincts — they couldn\'t create durable institutions', 'names the failure', ['authoritarian instincts', 'durable institutions']],
   [15, 'CR', 'LI', 'O', -.2, 16, 'open', True, 'a gap between the instinct for democracy and the capacity to sustain it', 'Charlie states the object', ['gap', 'capacity']],
   [16, 'FF', 'LI', 'O', .4, 6, 'open', False, 'the gap is called an institution — durable beyond any leader, delivering what people want', 'THE OBJECT, named', ['institution', 'durable', 'deliver']],
   [18, 'FF', 'LI', 'O', .6, 8, 'open', False, 'the state concentrates power; the rule of law limits it; accountability removes leaders', 'the three parts', ['state', 'rule of law', 'accountability']],
   [20, 'FF', 'LI', 'T', -.3, 10, 'open', False, 'developing countries lack institutions — so crime, corruption, insecurity', 'the cost of absence', ['corruption', 'insecurity']],
   [22, 'FF', 'LI', 'M', .4, 12, 'open', False, 'before the state there was no war of all against all — we are social by nature', 'overturns Hobbes', ['social creatures', 'war of all against all']],
   [24, 'FF', 'LI', 'M', .4, 10, 'open', False, 'kin preference and reciprocal altruism — the building blocks of order', 'the mechanism, biological', ['reciprocal altruism', 'building blocks']],
   [26, 'FF', 'LI', 'T', .5, 10, 'open', False, 'China invented the merit exam and bureaucracy — still good at centralized, authoritarian government', 'the first modern state', ['civil service', 'bureaucracy', 'authoritarian']],
   [28, 'FF', 'LI', 'F', -.1, 14, 'open', False, 'the big question for China: will anything check the power of its government?', 'a dated question', ['checks and balances', 'China']],
   [30, 'FF', 'LI', 'M', -.2, 12, 'open', False, 'we\'re rule-making animals — rules get sanctified and stick after they stop working', 'the mechanism of decay', ['rule-making', 'sticky', 'dysfunctional']],
   [31, 'CR', 'LI', 'F', -.4, 32, 'open', True, 'dysfunction keeps the US from its biggest problems — inevitable decline', 'the decline frame', ['dysfunction', 'decline']],
   [32, 'FF', 'LI', 'T', -.5, 16, 'open', False, 'so checked and so balanced and so polarized it can\'t make decisions', 'THE AMERICA LINE', ['checked', 'balanced', 'polarized']],
   [34, 'FF', 'LI', 'T', -.2, 14, 'open', False, 'India: too much democracy — China moves a million people for a dam', 'the mirror case', ['too much democracy', 'three gorges']],
   [36, 'FF', 'LI', 'T', -.3, 10, 'open', False, 'India stores a fifth of China\'s water — Tata: lawsuits, peasants\' associations', 'the record, counted', ['one-fifth', 'Tata', 'lawsuits']],
   [39, 'CR', 'LI', 'X', 0, 20, 'open', True, 'the Arab spring and violent Islamic extremism?', 'the risk question', ['extremism']],
   [40, 'FF', 'LI', 'F', 0, 14, 'open', False, 'Egyptians are moderate but unorganized — the organized forces are the army and the Brotherhood', 'a dated read of who holds power', ['army', 'Muslim Brotherhood', 'organized']],
   [42, 'FF', 'LI', 'F', 0, 12, 'open', False, 'the army surely doesn\'t want an Iran; the Brotherhood is mixed', 'a forecast', ['army', 'Turkey']],
   [44, 'FF', 'LI', 'F', -.4, 16, 'open', False, 'Yemen could sink into Somalia-like chaos — another breeding ground', 'THE YEMEN WARNING, dated 2011', ['Yemen', 'Somalia', 'breeding ground']],
   [45, 'CR', 'LI', 'F', -.3, 26, 'open', True, 'is the United States in decline?', 'the closing frame', ['decline']],
   [46, 'FF', 'LI', 'T', -.4, 22, 'open', False, 'we partied for 30 years into the biggest global debtor — 1989 to 2009 was an aberration', 'the record, with a vehicle', ['partying', 'debtor', 'aberration']],
   [48, 'FF', 'LI', 'F', .6, 12, 'open', False, 'fundamentally optimistic about the United States', 'the verdict', ['optimistic']],
   [50, 'FF', 'LI', 'F', .6, 14, 'open', False, 'Americans can believe dumb things, but not for long — the marketplace of ideas works', 'a dated bet', ['dumb things', 'marketplace of ideas']],
   [51, 'CR', 'LI', 'F', .4, 22, 'open', True, 'we eventually get it right after trying everything else', 'the close, borrowed', ['get it right']],
  ]),
}

if __name__ == '__main__':
    import math
    Q = {'LI': ('A', -1, -1), 'RI': ('B', 1, -1), 'LP': ('C', -1, 1), 'RP': ('D', 1, 1)}
    for yr, R in RUNS.items():
        T = json.load(open(f'lines{yr}.json'))
        out = []
        for (n, who, st, touch, z, dia, mode, inf, quote, note, lit) in R['lines']:
            L = T[n - 1]
            # lit words: find each phrase's first word in this line's aligned words
            caught = []
            for ph in lit:
                first = ph.lower().split()[0].strip('%\'')
                hit = next((w for w in L['words'] if w[0].startswith(first[:6])), None)
                caught.append([ph, hit[1] if hit else L['in'] + (L['out'] - L['in']) * (len(caught) + 1) / (len(lit) + 1)])
            q, ux, uy = Q[st]
            r = 0.055 + dia / 100 * 0.38
            j = ((int(L['in']) * 7919) % 1000) / 1000
            a = math.radians(45 + (j - .5) * 24)
            out.append(dict(n=n, t_in=L['in'], t_out=L['out'], who=who, station=st, touch=touch, z=z, dia=dia, mode=mode,
                            zInferred=inf, quote=quote, note=note, caught=caught, said=L['text'],
                            normX=round(.5 + ux * r * math.cos(a), 4), normY=round(.5 + uy * r * math.sin(a), 4), normZ=round(z * .75, 4), quadrant=q))
        S = [l for l in out]
        ff = [l for l in out if l['who'] == 'FF']; cr = [l for l in out if l['who'] == 'CR']
        mean = lambda xs: round(sum(xs) / len(xs), 2)
        REC = {'O', 'T', 'B', 'M', 'X'}
        board = dict(dia=round(mean([l['dia'] for l in S])), readZ=mean([l['z'] for l in S]),
                     lumens=round(100 * mean([(1 - l['dia'] / 100) if l['touch'] in REC else 0 for l in S])),
                     voices={w: dict(dia=round(mean([l['dia'] for l in v])), readZ=mean([l['z'] for l in v]), n=len(v)) for w, v in (('FF', ff), ('CR', cr))})
        doc = {k: v for k, v in R.items() if k != 'lines'}
        doc.update(status='claude-draft', scoreboard=board, lines=out,
                   transcript=[{k: L[k] for k in ('speaker', 'text', 'in', 'out')} | {'words': L['words']} for L in T])
        json.dump(doc, open(f'run_{yr}.json', 'w'), ensure_ascii=False)
        print(yr, len(out), 'lines', board)

# ── The objects pass (2026-10-21): every line also sorted to the object it actually talks about, with a z
# against that object's own Z. Same orientation everywhere: +1 = the object holds / delivers what its
# holders claim for it; −1 = it fails or is undone. Claude draft, for ruling.
OBJECTS = {
 '1992': {
  'LD':  ('Liberal democracy', '+1 it holds as the end point ↔ −1 a rival or flaw undoes it'),
  'COM': ('Communism', '+1 a viable, legitimate regime ↔ −1 dead, illegitimate'),
  'MKT': ('Market capitalism', '+1 delivers prosperity people want ↔ −1 fails them'),
  'NAT': ('Post-Soviet nationalism', '+1 compatible with democracy ↔ −1 becomes its rival'),
  'RUS': ('Russia\'s transition', '+1 becomes a stable democracy ↔ −1 reverts'),
  'JPN': ('The US–Japan trade conflict', '+1 stays a war by metaphor ↔ −1 becomes a real one'),
  'SOUTH': ('The developing world', '+1 joins modern institutions ↔ −1 stays stuck'),
 },
 '2011': {
  'INST': ('Durable institutions', '+1 the impulse becomes institutions that deliver ↔ −1 the gap stays open'),
  'EOH':  ('The End of History thesis', '+1 it holds ↔ −1 it\'s rebutted'),
  'ARAB': ('The Arab Spring', '+1 becomes durable democracy ↔ −1 reverts or collapses'),
  'UKR':  ('Ukraine after the Orange Revolution', '+1 delivered good government ↔ −1 failed'),
  'CHN':  ('The Chinese state', '+1 its power gets checked ↔ −1 stays unchecked'),
  'USP':  ('The US political system', '+1 can decide and deliver ↔ −1 gridlocked'),
  'IND':  ('Indian democracy', '+1 delivers what it promises ↔ −1 blocked by itself'),
  'USW':  ('American standing', '+1 resilient ↔ −1 in decline'),
 },
}
# line no. → (object, z on that object)
LINE_OBJ = {
 '1992': {1:('LD',.3),3:('LD',.2),4:('LD',.9),5:('COM',-.9),7:('LD',-.1),8:('LD',.5),12:('LD',.9),14:('MKT',.8),18:('LD',.7),
          21:('COM',-.6),22:('LD',.8),23:('LD',-.3),24:('LD',.7),28:('LD',.6),29:('LD',-.2),30:('LD',-.2),38:('LD',-.4),
          40:('NAT',-.5),42:('NAT',.6),46:('RUS',-.3),47:('MKT',-.6),48:('RUS',.2),54:('COM',-.9),55:('JPN',-.4),56:('JPN',.8),
          62:('JPN',.6),65:('SOUTH',-.2),66:('SOUTH',.2),68:('SOUTH',-.7),80:('LD',.8),84:('LD',.9),88:('COM',-.8),92:('LD',.5),97:('LD',.2)},
 '2011': {1:('INST',.3),3:('ARAB',0),4:('ARAB',.6),6:('ARAB',.1),7:('EOH',0),10:('EOH',.5),12:('UKR',-.7),14:('UKR',-.7),15:('INST',-.2),
          16:('INST',.4),18:('INST',.6),20:('INST',-.4),22:('INST',.4),24:('INST',.4),26:('CHN',-.6),28:('CHN',-.2),30:('INST',-.2),
          31:('USP',-.5),32:('USP',-.6),34:('IND',-.3),36:('IND',-.5),39:('ARAB',-.2),40:('ARAB',0),42:('ARAB',.1),44:('ARAB',-.5),
          45:('USW',-.3),46:('USW',-.5),48:('USW',.6),50:('USW',.6),51:('USW',.4)},
}

if __name__ == '__main__':
    for yr in RUNS:
        doc = json.load(open(f'run_{yr}.json'))
        doc['objects'] = {k: dict(name=v[0], Z=v[1]) for k, v in OBJECTS[yr].items()}
        for l in doc['lines']:
            o, z = LINE_OBJ[yr][l['n']]; l['obj'] = o; l['zObj'] = z
        json.dump(doc, open(f'run_{yr}.json', 'w'), ensure_ascii=False)
        from collections import Counter
        print(yr, Counter(l['obj'] for l in doc['lines']))
