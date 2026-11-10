#!/usr/bin/env python3
"""parallelogram.py — a raw parallelogram through the closed form (spec: Parameters/00_Architecture/Parallelogram_Unit_v0.md).

  python3 scripts/closedform/parallelogram.py <in-file> [--compare <press piece id>] [--runs 3] [--fresh] [--dry]

Order, always: 1 grammar (lines, subject, object/shadow, touch, gear, lit words, z) — one model pass, SAVED and reused so the
same parallelogram gives the same lines (--fresh re-reads it) · 2 context (the clockwork's gears as of each line's date; the
writer's added context labeled, never scored) · 3 the relational test (derive.py's questions and rules, --runs times, median)
· 4 twelve bands (station × tier, each with its own z) · 5 the word cloud (lit words placed where their lines sit, by date).
The model answers questions; the rules make every number. Writes data/parallelograms/<id>.json and <id>_report.md."""
import json, os, re, sys, hashlib, datetime, math, difflib
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import derive as D
ROOT = D.ROOT; OUTD = os.path.join(ROOT, 'data', 'parallelograms'); os.makedirs(os.path.join(OUTD, 'in'), exist_ok=True)
STATIONS = ['LI', 'RI', 'LP', 'RP']; TIERS = ['fluid', 'coalition', 'denominated']
ZWORDS = {'realized strongly': 0.9, 'realized': 0.6, 'leaning realized': 0.3, 'neither': 0.0,
          'leaning frustrated': -0.3, 'frustrated': -0.6, 'frustrated strongly': -0.9}
Q = {'LI': ('A', -1, -1), 'RI': ('B', 1, -1), 'LP': ('C', -1, 1), 'RP': ('D', 1, 1)}


def parse(path):
    s = open(path).read(); head, _, body = s.partition('\n---\n')
    meta = {m.group(1).strip(): m.group(2).strip() for m in re.finditer(r'^#\s*(\w+):\s*(.+)$', head, re.M)}
    items = []
    for chunk in [c.strip() for c in body.split('\n---\n') if c.strip()]:
        first, _, text = chunk.partition('\n'); parts = [p.strip() for p in first.lstrip('@').split('·')]
        it = {'who': parts[0], 'station': None, 'date': None, 'url': None, 'text': text.strip()}
        for p in parts[1:]:
            if p in STATIONS: it['station'] = p
            elif re.match(r'\d{4}-\d{2}-\d{2}$', p): it['date'] = p
            elif p.startswith('http'): it['url'] = p
        items.append(it)
    return meta, items


READ_MODEL = os.environ.get('CF_MODEL_READ', 'claude-sonnet-5-5')   # 11-08 (Sailor): Sonnet where the model has to read across lines (grammar, second pass); Haiku where it only answers (relational)


def gears():
    return json.load(open(os.path.join(ROOT, 'data', 'active', 'gears.json')))


def gear_at(G, gid, day):
    g = next((x for x in G['gears'] if x['id'] == gid), None)
    if not g or not g['readings']: return None
    best = None
    for r in g['readings']:
        if r[0] <= day: best = r
    r = best or g['readings'][0]
    return {'date': r[0], 'z': r[1], 'sigma': r[2], 'nearest': best is None}


def grammar_prompt(meta, items, G):
    gl = '\n'.join(f"- {g['id']} ({g['label']}, {g['speed']}): {g['tracker']}. Rule: {g['rule']}." for g in G['gears'])
    sys_ = ("You annotate the grammar of political talk for Prism, a closed-form instrument. You split statements into lines and "
            "say what each line is about. You never score how heated a line is. Judge the words, never the speaker's reputation. "
            "Reply with JSON only.")
    posts = json.dumps([{'n': i, 'who': it['who'], 'date': it['date'], 'text': it['text']} for i, it in enumerate(items)], ensure_ascii=False, indent=1)
    user = f"""OBJECT (what the lines are read against): {meta.get('object') or G['object']}
z: +1 = the object realized for the audience (American citizens and voters) · -1 = it frustrated them

GEARS (trackers turning at different speeds — a line is read against the one it talks about):
{gl}
- shadow: not a gear. A line about WHO IS TO BLAME for a reading, or about a speaker's own record or loyalties, rather than the reading itself. No instrument measures it.

POSTS (in order):
{posts}

Split every post into lines: one statement, one speaker, one thing it says. A short post is often one line; a long one may be two to four.
For every line return:
{{"post": n, "quote": "the fewest of the post's own words that still carry the line (copy them; no paraphrase)",
 "subject": "who is speaking or being spoken for",
 "about": "object"|"shadow",
 "touch": "O"|"T"|"M"|"F"|"X",   // O the object itself · T a dated record (a fact, a vote, a past statement) · M a mechanism (how one thing caused another) · F a frame (a story told about it) · X a challenge (counter-evidence)
 "gear": "war"|"pump"|"vote"|"dollar"|"shadow",   // war = the fact of the war itself (will it happen, is it happening, boots or no boots)
 "z": "realized strongly"|"realized"|"leaning realized"|"neither"|"leaning frustrated"|"frustrated"|"frustrated strongly",   // what THIS line believes happened, on the object's z
 "lit": ["2 to 4 short phrases, copied from the line, that carry it"],
 "credulity": "engaged"|"withdrawn"|"none",   // does the speaker accept (engaged) or refuse (withdrawn) a reading they would otherwise be expected to hold? most lines: none
 "station": "LI"|"RI"|"LP"|"RP",   // only a proposal: Left/Right x Institutional/Populist (outsider); the writer's label wins
 "why": "one plain sentence"}}
Answer: {{"lines": [ ... ]}} — valid JSON only. Inside a string never use a double quote; quote words with single quotes."""
    return sys_, user


def relational_prompt(meta, lines, PAT, G):
    obj = meta.get('object') or G['object']
    P = {'object': {'label': obj, 'zAxis': {'pos': 'realized for the audience', 'neg': 'frustrated for the audience'}},
         'title': meta.get('title', ''), 'names': {},
         'lines': [{'who': l['who'], 'station': l['station'], 'quote': l['quote'] + (('   [voice: ' + l['subject'] + ' — reported or described by ' + l['who'] + '; the whole post: ' + l.get('post_text', '') + ']') if l.get('subject') and l['subject'].lstrip('@').lower() != l['who'].lstrip('@').lower() else '')} for l in lines]}
    F = [{'id': f"gear:{g['id']}", 'fact': f"{g['label']}: {(g['readings'][-1][1] if g['readings'] else 'no reading yet')} on the object's z ({g['tracker']})",
          'source': 'the clockwork, data/active/gears.json', 'tracked': bool(g['readings'])} for g in G['gears']]
    return D.prompt(P, F, PAT)


def gnostic(pid, h, lines, k, runs, fresh):
    gp = os.path.join(OUTD, f'{pid}.gnostic.json')
    if os.path.exists(gp) and not fresh:
        c = json.load(open(gp))
        if c.get('hash') == h: print('second pass: reused', gp); return c['moments']
    sys_ = ("You read a set of political statements for Prism, a closed-form instrument, looking for recognition moments: "
            "where a speaker accepts or refuses a reading or an idea that he himself, or another voice in the same set, stated "
            "elsewhere in it. Judge the words in the set, never reputations or outside knowledge. Reply with JSON only.")
    # 11-08: the object's state on each line's date rides along (the war gear), so 'no war' after the strikes reads as the switch it is
    G = gears(); wg = next((g for g in G['gears'] if g['id'] == 'war'), None)
    def state(day):
        if not wg or not day: return None
        best = None
        for r in wg['readings']:
            if r[0] <= day: best = r
        return (best or wg['readings'][0])[3]
    L = [{'i': l['i'], 'who': l['who'], 'date': l['date'], 'objectOnThatDate': state(l['date']), 'quote': l['quote'], 'voice': l.get('subject'), 'post': l.get('post_text')} for l in lines]
    user = f"""LINES (every line in the set, in order, with dates):
{json.dumps(L, ensure_ascii=False, indent=1)}

objectOnThatDate is what the object (the war) actually was on the line's date, from the tracker.

A CREDULITY SWITCH is where a speaker's own earlier words in this set come due and he refuses them, or where he takes up what he had refused. Check every line against every earlier line by the same speaker (or an ally in the set). Three kinds count, all equally:
1. A test he set comes due and he refuses it: he said what would change his mind, or made a bet; objectOnThatDate shows the condition met (or the object moved against his forecast), and he holds the forecast anyway, narrows its terms, or settles the bet himself. (withdrawn)
2. He revises his own record: he claims to have held a position that an earlier line in this set shows he did not hold, or dates his position earlier than the set shows. (withdrawn)
3. He accepts what he had denied: an earlier line denied the object or mocked those who warned of it; now he treats it as real or takes up their reading. (engaged)
Ordinary consistency, insults, and new claims with no earlier line to turn on are not switches. A view he REPORTS (a friend's belief, what others say) is not his own unless he affirms it. Every moment must name the specific earlier line it turns on; if several, the earliest.
Answer: {{"moments": [{{"i": n, "kind": 1|2|3, "credulity": "withdrawn"|"engaged", "turnsOn": earlier line number, "why": "one plain sentence"}}]}} — valid JSON only. Inside a string never use a double quote."""
    votes = {}; raw = []
    for _ in range(runs):
        ans, _u = D.call(sys_, user, k, READ_MODEL); raw.append(ans.get('moments', []))
        for m in ans.get('moments', []):
            try: key_ = (int(m['i']), m['credulity'])
            except Exception: continue
            votes.setdefault(key_, []).append(m)
    need = 2 if runs >= 2 else 1
    moments = {}
    for (i, cr), ms in votes.items():
        if len(ms) >= need and str(i) not in moments:
            moments[str(i)] = {'credulity': cr, 'kind': ms[0].get('kind'), 'turnsOn': ms[0].get('turnsOn'), 'why': ms[0].get('why'), 'votes': f'{len(ms)}/{runs}'}
    json.dump({'hash': h, 'at': datetime.datetime.now().isoformat(timespec='seconds'), 'prompt': 'v2 11-08 (three kinds of switch)', 'moments': moments, 'runs': raw}, open(gp, 'w'), indent=1, ensure_ascii=False)
    print(f'second pass: {len(moments)} moments'); return moments


def place(i, st, dia, z):
    q, ux, uy = Q[st]; r = 0.055 + (dia / 100.0) * 0.38; j = ((int(i) * 7919) % 1000) / 1000.0
    ang = math.radians(45 + (j - 0.5) * 24)
    return round(0.5 + ux * r * math.cos(ang), 4), round(0.5 + uy * r * math.sin(ang), 4), round(z * 0.75, 4), q


# 11-08 (the drop's stage): the run tells what it has so far — grammar lines as they land, scores as each chunk comes back —
# so the page can draw the words lifting out of the posts into the cloud while the model is still answering.
_PROG = {'path': None, 'stage': 'start', 'lines': [], 'scores': {}, 'moments': []}
def progress(stage=None, **kw):
    if not _PROG['path']: return
    if stage: _PROG['stage'] = stage
    _PROG.update(kw); _PROG['at'] = datetime.datetime.now().isoformat(timespec='seconds')
    tmp = _PROG['path'] + '.tmp'
    json.dump({k: v for k, v in _PROG.items() if k != 'path'}, open(tmp, 'w'), ensure_ascii=False); os.replace(tmp, _PROG['path'])


def main():
    a = sys.argv[1:]; dry = '--dry' in a; fresh = '--fresh' in a
    runs = int(a[a.index('--runs') + 1]) if '--runs' in a else 3
    cmp_ = a[a.index('--compare') + 1] if '--compare' in a else None
    skip = {cmp_, str(runs)} if '--runs' in a else {cmp_}
    src = [x for x in a if not x.startswith('--') and x not in skip][0]
    meta, items = parse(src); G = gears(); PAT = D.patterns()
    pid = meta.get('id') or re.sub(r'[^a-z0-9]+', '_', meta.get('title', os.path.basename(src)).lower()).strip('_')
    h = hashlib.sha1(open(src, 'rb').read()).hexdigest()[:12]
    hs = h + '-ctx4'   # scoring/second-pass cache key (ctx4 11-07: the war gear added): the input + the prompt version (11-07: whole post only where the voice isn't the poster's own — ctx2 gave it to every line and flattened them)
    gpath = os.path.join(OUTD, f'{pid}.grammar.json')
    _PROG['path'] = os.path.join(OUTD, f'_run_{pid}.progress.json'); progress('grammar', posts=[{'n': i, 'who': it['who'], 'date': it['date'], 'station': it['station'], 'text': it['text']} for i, it in enumerate(items)])
    k = None if dry else (D.key() or ('offline' if os.environ.get('CF_ANSWERS') else None))
    if not dry and not k:
        print('no ANTHROPIC_API_KEY — run "Run the Closed Form.command" once (it asks for the key)'); sys.exit(2)
    # 1 · grammar — saved and reused (reproducible)
    reused = os.path.exists(gpath) and not fresh and json.load(open(gpath)).get('hash') == h
    if reused:
        gram = json.load(open(gpath)); print('grammar: reused', gpath)
    else:
        s_, u_ = grammar_prompt(meta, items, G)
        if dry:
            open(os.path.join(OUTD, pid + '.grammar.prompt.txt'), 'w').write(s_ + '\n\n' + u_); print('dry: grammar prompt written'); return
        ans, use = D.call(s_, u_, k, READ_MODEL)
        gram = {'hash': h, 'at': datetime.datetime.now().isoformat(timespec='seconds'), 'usage': use, 'lines': ans.get('lines', [])}
        json.dump(gram, open(gpath, 'w'), indent=1, ensure_ascii=False); print(f"grammar: {len(gram['lines'])} lines ({use.get('model')})")
    lines = []
    for g in gram['lines']:
        it = items[g['post']]; st = it['station'] or g.get('station') or 'RP'
        lines.append({'i': len(lines), 'post': g['post'], 'who': it['who'], 'date': it['date'], 'url': it['url'], 'station': st,
                      'stationProposed': None if it['station'] else g.get('station'), 'quote': g['quote'], 'subject': g.get('subject'),
                      'about': g.get('about'), 'touch': g.get('touch'), 'gear': g.get('gear'), 'z': None if g.get('gear') == 'shadow' or g.get('about') == 'shadow' else ZWORDS.get(g.get('z'), 0.0),
                      'zWord': g.get('z'), 'lit': g.get('lit', []), 'credulity': g.get('credulity', 'none'), 'whyGrammar': g.get('why'), 'post_text': it['text']})
    progress('relational', lines=[{k2: l[k2] for k2 in ('i', 'post', 'who', 'date', 'station', 'quote', 'about', 'gear', 'z', 'lit')} for l in lines])
    # 3 · the relational test — derive.py's questions and rules, median of the runs. Saved like the grammar (same
    # grammar → same scores); --fresh or --rescore asks again
    rpath = os.path.join(OUTD, f'{pid}.relational.json')
    rel = json.load(open(rpath)) if os.path.exists(rpath) else None
    if rel and rel.get('hash') == hs and not fresh and '--rescore' not in a:
        print('relational: reused', rpath)
    else:
        got = {}
        # 11-08: asked in chunks of CHUNK lines — a 30-line answer kept getting cut off mid-list (three runs, 23/16/15 lines);
        # each chunk's lines keep their real 'i' (the prompt's own numbering is remapped back)
        CHUNK = int(os.environ.get('CF_CHUNK', '10'))
        for c0 in range(0, len(lines), CHUNK):
            part = lines[c0:c0 + CHUNK]
            s_, u_ = relational_prompt(meta, part, PAT, G)
            for _ in range(runs):
                ans, _u = D.call(s_, u_, k)
                for x in ans.get('lines', []):
                    try: j = int(x['i'])
                    except Exception: continue
                    if 0 <= j < len(part): x['i'] = part[j]['i']; got.setdefault(x['i'], []).append(x)
                sc = {}
                for i2, xs in got.items():
                    rs2 = sorted(D.rules(dict(x2), PAT)['dia'] for x2 in xs); sc[str(i2)] = {'dia': rs2[len(rs2) // 2], 'tier': D.rules(dict(xs[0]), PAT)['tier'], 'runs': len(rs2)}
                progress('relational', scores=sc, chunk=[c0, min(c0 + CHUNK, len(lines)), len(lines)])
        rel = {'hash': hs, 'at': datetime.datetime.now().isoformat(timespec='seconds'), 'lines': {}}
        for l in lines:
            rs = sorted([(D.rules(dict(x), PAT), x) for x in got.get(l['i'], [])], key=lambda r: r[0]['dia'])
            if not rs: continue
            r, x = rs[len(rs) // 2]
            rel['lines'][str(l['i'])] = dict(dia=r['dia'], tier=r['tier'], runs=[q[0]['dia'] for q in rs], flags=r['flags'],
                                            relational={k2: x.get(k2) for k2 in ('object', 'others', 'capital', 'facing', 'why')},
                                            patterns=[p.get('n') for p in x.get('patterns', [])])
        json.dump(rel, open(rpath, 'w'), indent=1, ensure_ascii=False)
    for l in lines:
        x = rel['lines'].get(str(l['i']))
        if x: l.update(x)
        else: l['dia'] = None
    # Sailor's rulings hold: a line he has ruled on keeps his tier and his number, whatever the model said
    for R in D.ruled(pid):
        if R.get('piece') != pid: continue
        l = next((q for q in lines if q['i'] == R.get('line')), None)
        if not l: continue
        l['handRuled'] = {'tier': R['tier'], 'dia': R.get('dia'), 'derivedDia': l.get('dia'), 'why': R.get('why')}
        l['tier'] = R['tier']
        if R.get('dia') is not None: l['dia'] = R['dia']
    # 3b · the second pass (DiaGnostic): read ACROSS lines — where a speaker accepts or refuses a reading that he, or
    # the other voice in the set, stated elsewhere in it. Saved like the others; three runs, a moment kept if two agree
    progress('relational', scores={str(l['i']): {'dia': l['dia'], 'tier': l['tier'], 'runs': len(l.get('runs', []))} for l in lines if l.get('dia') is not None})
    progress('gnostic')
    gn = gnostic(pid, hs, lines, k, runs, fresh or '--regnostic' in a)
    progress('context', moments=[{'i': int(i2), 'credulity': m['credulity'], 'turnsOn': m.get('turnsOn')} for i2, m in gn.items()])
    for l in lines:
        m = gn.get(str(l['i']))
        l['credulity'] = m['credulity'] if m else 'none'
        if m: l['turnsOn'] = m['turnsOn']; l['gnosticWhy'] = m['why']
    # 2 · context — gears as of each line's date; light = calm × proximity, shadow unmeasured
    for l in lines:
        rd = None if l['gear'] in (None, 'shadow') else gear_at(G, l['gear'], l['date'] or G['built'])
        if rd is None or l.get('dia') is None: l['light'] = 'unmeasured'; continue
        d = abs(l['z'] - rd['z']); prox = 1.0 if d <= rd['sigma'] else max(0.0, 1 - (d - rd['sigma']))
        l.update(gearReading=rd, proximity=round(prox, 3), light=round((1 - l['dia'] / 100) * prox, 3))
    S = [l for l in lines if l.get('dia') is not None]
    mean = lambda xs: sum(xs) / len(xs) if xs else None
    lit = [l['light'] for l in S if l['light'] != 'unmeasured']
    # 4 · bands — station × tier, each with its own z
    bands = []
    for st in STATIONS:
        for t in TIERS:
            b = [l for l in S if l['station'] == st and l['tier'] == t]
            zb = [l['z'] for l in b if l['z'] is not None]
            bands.append({'station': st, 'tier': t, 'n': len(b), 'z': round(mean(zb), 2) if zb else None,
                          'dia': round(mean([l['dia'] for l in b])) if b else None, 'lines': [l['i'] for l in b],
                          'words': [w for l in b for w in l['lit']]})
    # 5 · the cloud — every lit phrase where its line sits, ordered by date; tied to its line
    cloud = []; dates = sorted({l['date'] or '' for l in S})
    for l in sorted(S, key=lambda l: (l['date'] or '', l['i'])):
        x, y, zz, q = place(l['i'], l['station'], l['dia'], l['z'] or 0.0)
        for w in l['lit']:
            cloud.append({'text': w, 'line': l['i'], 'who': l['who'], 'station': l['station'], 'quadrant': q, 'tier': l['tier'],
                          'dia': l['dia'], 'z': l['z'], 'gear': l['gear'], 'about': l['about'], 'light': l['light'], 'date': l['date'],
                          'gnostic': l['credulity'] if l['credulity'] != 'none' else None,
                          'normX': x, 'normY': y, 'normZ': zz, 'step': dates.index(l['date'] or '')})
    sb = {'lines': len(S), 'dia': round(mean([l['dia'] for l in S])) if S else None, 'readZ': round(mean([l['z'] for l in S if l['z'] is not None]), 2) if any(l['z'] is not None for l in S) else None,
          'lumensTracked': round(100 * mean(lit)) if lit else None, 'measured': len(lit), 'unmeasured': len(S) - len(lit),
          'gnostic': [l['i'] for l in S if l['credulity'] != 'none']}
    doc = {'schema': 'parallelogram/derived/v0', 'id': pid, 'title': meta.get('title'), 'object': meta.get('object') or G['object'],
           'context': meta.get('context'), 'contextRule': 'added by the writer, labeled, never scored', 'source': os.path.relpath(src, ROOT),
           'at': datetime.datetime.now().isoformat(timespec='seconds'), 'model': D.MODEL, 'runs': runs, 'grammar': os.path.relpath(gpath, ROOT),
           'gears': 'data/active/gears.json (built ' + G['built'] + ')', 'scoreboard': sb, 'steps': dates,
           'bands': bands, 'lines': lines, 'cloud': cloud, 'status': 'derived draft — Sailor rules'}
    json.dump(doc, open(os.path.join(OUTD, pid + '.json'), 'w'), indent=1, ensure_ascii=False)
    progress('done', lights={str(l['i']): l['light'] for l in S})
    # report
    R = [f"# Parallelogram — {meta.get('title', pid)}",
         f"*{doc['at']} · {D.MODEL} · grammar {'reused' if reused else 'read fresh'} · relational test ×{runs} (median) · derived draft*", '',
         f"**{sb['lines']} lines · Dia {sb['dia']} · read z {sb['readZ']} · Lumens {sb['lumensTracked']} tracked ({sb['measured']} measured, {sb['unmeasured']} unmeasured) · credulity moments: {sb['gnostic'] or 'none'}**", '',
         '| # | who | date | quote | about · gear | touch | z | Dia (runs) | tier | light | lit words |', '|---|---|---|---|---|---|---|---|---|---|---|']
    for l in S:
        R.append(f"| {l['i']} | {l['who']} | {l['date']} | {l['quote'][:80]} | {l['about']} · {l['gear']} | {l['touch']} | {'—' if l['z'] is None else format(l['z'], '+.1f')} | {l['dia']} ({' '.join(map(str, l['runs']))}) | {l['tier']} | {l['light']} | {' · '.join(l['lit'])} |")
    G2 = [l for l in S if l['credulity'] != 'none']
    R += ['', '## Second pass — where credulity switches (DiaGnostic)', '']
    R += [f"- line {l['i']} ({l['who']}, {l['date']}) **{l['credulity']}**, turning on line {l.get('turnsOn')}: “{l['quote'][:90]}” — {l.get('gnosticWhy', '')}" for l in G2] or ['- none found']
    HR = [l for l in S if l.get('handRuled')]
    if HR:
        R += ['', "## Held to Sailor's rulings", ''] + [f"- line {l['i']}: {l['handRuled']['tier']} {l['handRuled']['dia']} (the model said {l['handRuled']['derivedDia']}) — {l['handRuled']['why']}" for l in HR]
    R += ['', '## Bands (station × tier)', '', '| band | lines | z | Dia | words |', '|---|---|---|---|---|']
    R += [f"| {b['station']} {b['tier']} | {b['n']} | {b['z']} | {b['dia']} | {' · '.join(b['words'][:8])} |" for b in bands if b['n']]
    if cmp_:
        P = json.load(open(os.path.join(ROOT, 'data', 'press', cmp_ + '.json'))); hs = P['scoreboard']; lt = hs.get('lumensTracked') or {}
        R += ['', f"## Against the hand cut `{cmp_}`", '',
              f"hand: {len([l for l in P['lines'] if l['station'] != 'O'])} lines · Dia {hs['dia']} · read z {hs['readZ']} · Lumens {lt.get('value')} tracked ({lt.get('measured')} measured)  →  derived: {sb['lines']} lines · Dia {sb['dia']} · read z {sb['readZ']} · Lumens {sb['lumensTracked']} ({sb['measured']} measured)", '',
              '| derived # | quote | derived Dia · z · gear | nearest hand line | hand Dia · z · gear |', '|---|---|---|---|---|']
        for l in S:
            best = max(P['lines'], key=lambda hh: difflib.SequenceMatcher(None, l['quote'].lower(), hh['quote'].lower()).ratio())
            sc = difflib.SequenceMatcher(None, l['quote'].lower(), best['quote'].lower()).ratio()
            R.append(f"| {l['i']} | {l['quote'][:60]} | {l['dia']} · {'—' if l['z'] is None else format(l['z'], '+.1f')} · {l['gear']} | {best['t']}: {best['quote'][:50]} ({sc:.2f}) | {best.get('dia')} · {best['z']:+.1f} · {best.get('gear', '—')} |")
    open(os.path.join(OUTD, pid + '_report.md'), 'w').write('\n'.join(R))
    print(f"{pid}: {sb['lines']} lines · Dia {sb['dia']} · z {sb['readZ']} · Lumens {sb['lumensTracked']} ({sb['measured']}/{sb['lines']} measured) → {os.path.join(OUTD, pid + '_report.md')}")


if __name__ == '__main__':
    main()
