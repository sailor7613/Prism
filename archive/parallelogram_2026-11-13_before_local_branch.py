#!/usr/bin/env python3
"""parallelogram.py — a raw parallelogram through the closed form (spec: Parameters/00_Architecture/Parallelogram_Unit_v0.md).

  python3 scripts/closedform/parallelogram.py <in-file> [--compare <press piece id>] [--runs 3] [--fresh] [--dry]

Order, always: 1 grammar (lines, subject, object/shadow, touch, measure, due, lit words, z) — one model pass, SAVED and reused so the
same parallelogram gives the same lines (--fresh re-reads it) · 2 context (the object's body as of each line's date — data/active/object.json; forecasts (due) re-read at due and now; the
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


def the_object():
    """The object as Prism holds it (data/active/object.json): its body (what is measured), its room (the daily average of the light on the topic), its topic."""
    return json.load(open(os.path.join(ROOT, 'data', 'active', 'object.json')))


def measure(G, mid):
    """A measure of the body, by id — or the room, looked up the same way but never something a line is lit by."""
    return next((x for x in G['body'] + ([G['room']] if G.get('room') else []) if x['id'] == mid), None)


def topic_label(meta, G):
    return meta.get('object') or f"{G['topic']['id']} — {G['topic']['label']} (zero {G['topic']['zero']})"


def reading_at(T, tid, day):
    """The measure's reading as of a day: the last reading on or before it. Never a reading from after the line —
    except when none exists yet (then the first, flagged nearest=True)."""
    t = measure(T, tid)
    if not t or not t['readings'] or not day: return None
    best = None
    for r in t['readings']:
        if r[0] <= day: best = r
    r = best or t['readings'][0]
    return {'date': r[0], 'z': r[1], 'sigma': r[2], 'nearest': best is None}


def reading_latest(T, tid):
    t = measure(T, tid)
    if not t or not t['readings']: return None
    r = t['readings'][-1]; return {'date': r[0], 'z': r[1], 'sigma': r[2]}


def grammar_prompt(meta, items, G):
    OT = G['body']   # the room is never something a line is about
    gl = '\n'.join(f"- {t['id']} ({t['label']}): {t['source']}. Rule: {t['rule']}." for t in OT)
    enum = '|'.join('"' + t['id'] + '"' for t in OT) + '|"shadow"'
    sys_ = ("You annotate the grammar of political talk for Prism, a closed-form instrument. You split statements into lines and "
            "say what each line is about. You never score how heated a line is. Judge the words, never the speaker's reputation. "
            "Reply with JSON only.")
    posts = json.dumps([{'n': it['n'], 'who': it['who'], 'date': it['date'], 'text': it['text']} for it in items], ensure_ascii=False, indent=1)   # 11-09: items carry their own n (the grammar is asked in chunks)
    user = f"""THE OBJECT: {G['object']} — is it realized, or frustrated.
THE TOPIC (the face of the object these lines are about): {topic_label(meta, G)}
z: +1 = the object realized · -1 = the object frustrated. z is read against the object itself, never against what an audience wants (ruled 11-11). The signs are the body's own: no war, steady prices, work, a Congress that uses its power, a dollar holding its share and a steadier mood read realized; their opposites read frustrated.

THE BODY — what is measured of the object (each a dated series of readings; a line is read against the one it talks about, as of its own date):
{gl}
- shadow: not on the body. A line about WHO IS TO BLAME for a reading, or about a speaker's own record or loyalties, rather than the reading itself. No instrument measures it.

POSTS (in order):
{posts}

Split every post into lines: one statement, one speaker, one thing it says. A short post is often one line; a long one may be two to four.
For every line return:
{{"post": n, "quote": "the fewest of the post's own words that still carry the line (copy them; no paraphrase)",
 "subject": "who is speaking or being spoken for",
 "about": "object"|"shadow",
 "touch": "O"|"T"|"M"|"F"|"X",   // O the object itself · T a dated record (a fact, a vote, a past statement) · M a mechanism (how one thing caused another) · F a frame (a story told about it) · X a challenge (counter-evidence)
 "measure": {enum},   // war = the fact of the war itself (will it happen, is it happening, boots or no boots)
 "due": "YYYY-MM-DD" or null,   // ONLY if the line forecasts: the date by which it says the object will have moved — a date it names, or the plain reading of its own words from the post's date ("within a week", "by the midterms", "this summer"). A line about the present or the past: null
 "z": "realized strongly"|"realized"|"leaning realized"|"neither"|"leaning frustrated"|"frustrated"|"frustrated strongly",   // what THIS line believes happened, on the object's z
 "lit": ["2 to 4 short phrases, copied from the line, that carry it"],
 "credulity": "engaged"|"withdrawn"|"none",   // does the speaker accept (engaged) or refuse (withdrawn) a reading they would otherwise be expected to hold? most lines: none
 "station": "LI"|"RI"|"LP"|"RP",   // only a proposal: Left/Right x Institutional/Populist (outsider); the writer's label wins
 "why": "one plain sentence"}}
Answer: {{"lines": [ ... ]}} — valid JSON only. Inside a string never use a double quote; quote words with single quotes."""
    return sys_, user


def relational_prompt(meta, lines, PAT, G):
    obj = topic_label(meta, G)
    P = {'object': {'label': obj, 'zAxis': {'pos': 'the object realized (read against the object itself, not an audience)', 'neg': 'the object frustrated'}},
         'title': meta.get('title', ''), 'names': {},
         'lines': [{'who': l['who'], 'station': l['station'], 'quote': l['quote'] + (('   [voice: ' + l['subject'] + ' — reported or described by ' + l['who'] + '; the whole post: ' + l.get('post_text', '') + ']') if l.get('subject') and l['subject'].lstrip('@').lower() != l['who'].lstrip('@').lower() else '')} for l in lines]}
    F = [{'id': f"body:{t['id']}", 'fact': f"{t['label']}: {(t['readings'][-1][1] if t['readings'] else 'no reading yet')} on the object's z ({t['source']})",
          'source': "the object's body, data/active/object.json", 'tracked': bool(t['readings'])} for t in G['body']]
    return D.prompt(P, F, PAT)


def forecasts(pid, hg, lines, k, fresh, G=None):
    """11-09: which lines forecast, and when they come due. Asked over the finished grammar (so line numbers and cached
    scores stay put), in chunks, Sonnet. A line can name a date (due), or be conditional on the war (ifWar) with a
    horizon in days (within) — the runner resolves due = the day the war began + within. Saved as <pid>.forecast.json."""
    fp = os.path.join(OUTD, f'{pid}.forecast.json')
    if os.path.exists(fp) and not fresh:
        c = json.load(open(fp))
        if c.get('hash') == hg + '-f3': print('forecasts: reused', fp); return c['lines']   # f3: states + count
    sys_ = ("You read political statements for Prism, a closed-form instrument, and say which ones forecast: which say what the "
            "object will do, or what will follow if it does. Judge the words only. Reply with JSON only.")
    out = {}; FCH = int(os.environ.get('CF_FCHUNK', '12'))
    wt = (G or the_object())['topic']
    vocab = ' · '.join(f'{k2} = {v}' for k2, v in (wt.get('states') or {}).items())
    for c0 in range(0, len(lines), FCH):
        part = lines[c0:c0 + FCH]
        L = [{'i': l['i'], 'date': l['date'], 'measure': l.get('measure'), 'quote': l['quote'], 'post': (l.get('post_text') or '')[:600]} for l in part]
        user = f"""THE OBJECT: the Iran war. The war began 2026-02-28 (US strikes on Iran 2025-06-22; Israel's strikes 2025-06-13; a ceasefire 2025-06-24).

LINES:
{json.dumps(L, ensure_ascii=False, indent=1)}

For EVERY line that forecasts — says what will happen, or what would happen IF the war comes — return one entry:
{{"i": n,
 "ifWar": true|false,          // true when the forecast is conditional on the war happening ("a war with Iran would…", "if we attack…")
 "within": days or null,       // the horizon the line itself gives, in days from the condition or from the line's date: "the first week" 7 · "within days" 5 · "this summer" 90 · "by the midterms" → use due instead · no horizon (an end state: "would end his presidency", "a world war") null
 "due": "YYYY-MM-DD" or null,  // only when the line names or plainly implies a date ("by the midterms" 2026-11-03, "by the end of his term" 2029-01-20)
 "state": one of the names below, or null,   // when the forecast is that a NAMED STATE of the war will (or won't) come about; null when it forecasts a reading (prices, votes, the dollar) or an effect no state names
 "negated": true|false,        // true when the line forecasts the state will NOT come about ("no war", "that won't happen")
 "count": number or null,      // only for a forecast of the dead (state "casualties"): the smallest number the line means — "thousands" 2000 · "hundreds" 200 · "dozens" 24 · a number it names. Otherwise null
 "says": "the forecast in the line's own words, short"}}
STATES: {vocab}
A line about the present or the past is not a forecast: leave it out. A warning with no claim about what will happen is not a forecast. A judgment about a hypothetical is not a forecast either (ruled 11-11): 'X would be a mistake' or 'we should never do X' says what the speaker thinks of X, not that X will or won't happen — leave it out.
Answer: {{"forecasts": [ ... ]}} — valid JSON only. Inside a string never use a double quote."""
        ans, _u = D.call(sys_, user, k, READ_MODEL)
        got = ans.get('forecasts', ans.get('lines', []))
        for f in got:
            try: i = int(f['i'])
            except Exception: continue
            if any(l['i'] == i for l in part): out[str(i)] = {k2: f.get(k2) for k2 in ('ifWar', 'within', 'due', 'says', 'state', 'negated', 'count')}
        print(f"  forecasts: lines {part[0]['i']}–{part[-1]['i']} → {len(got)}")
    json.dump({'hash': hg + '-f3', 'at': datetime.datetime.now().isoformat(timespec='seconds'), 'prompt': 'v3 11-10 (states; a count for the dead)', 'lines': out}, open(fp, 'w'), indent=1, ensure_ascii=False)
    print(f'forecasts: {len(out)} lines forecast'); return out


def gnostic(pid, h, lines, k, runs, fresh):
    gp = os.path.join(OUTD, f'{pid}.gnostic.json')
    if os.path.exists(gp) and not fresh:
        c = json.load(open(gp))
        if c.get('hash') == h: print('second pass: reused', gp); return c['moments']
    sys_ = ("You read a set of political statements for Prism, a closed-form instrument, looking for recognition moments: "
            "where a speaker accepts or refuses a reading or an idea that he himself, or another voice in the same set, stated "
            "elsewhere in it. Judge the words in the set, never reputations or outside knowledge. Reply with JSON only.")
    # 11-08: the object's state on each line's date rides along (the war measure), so 'no war' after the strikes reads as the
    # switch it is; and the reading of the measure the line itself talks about (pump, vote, dollar) on that date
    G = the_object(); wg = measure(G, 'war')
    def state(day):
        if not wg or not day: return None
        best = None
        for r in wg['readings']:
            if r[0] <= day: best = r
        return (best or wg['readings'][0])[3]
    def own(l):
        if l.get('measure') in (None, 'shadow', 'war'): return None
        r = reading_at(G, l['measure'], l['date'])
        return r and {'measure': l['measure'], 'z': r['z'], 'asOf': r['date']}
    L = [{'i': l['i'], 'who': l['who'], 'date': l['date'], 'objectOnThatDate': state(l['date']), 'bodyOnThatDate': own(l), 'due': l.get('due'), 'quote': l['quote'], 'voice': l.get('subject'), 'post': l.get('post_text')} for l in lines]
    user = f"""LINES (every line in the set, in order, with dates):
{json.dumps(L, ensure_ascii=False, indent=1)}

objectOnThatDate is what the object (the war) actually was on the line's date, from the object's body. bodyOnThatDate, where present, is the reading of the measure the line talks about (the pump, the vote, the dollar; z +1 realized … -1 frustrated, read against the object itself) as of that date. due is the date a forecasting line said the object would have moved by.

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
    meta, items = parse(src); G = the_object(); PAT = D.patterns()
    pid = meta.get('id') or re.sub(r'[^a-z0-9]+', '_', meta.get('title', os.path.basename(src)).lower()).strip('_')
    h = hashlib.sha1(open(src, 'rb').read()).hexdigest()[:12]
    hs = h + '-ctx5'   # scoring/second-pass cache key (ctx5 11-08: measures, not gears; the line's own measure in the second pass; ctx4 11-07: the war added): the input + the prompt version (11-07: whole post only where the voice isn't the poster's own — ctx2 gave it to every line and flattened them)
    gpath = os.path.join(OUTD, f'{pid}.grammar.json')
    _PROG['path'] = os.path.join(OUTD, f'_run_{pid}.progress.json'); progress('grammar', posts=[{'n': i, 'who': it['who'], 'date': it['date'], 'station': it['station'], 'text': it['text']} for i, it in enumerate(items)])
    k = None if dry else (D.key() or ('offline' if os.environ.get('CF_ANSWERS') else None))
    if not dry and not k:
        print('no ANTHROPIC_API_KEY — run "Run the Closed Form.command" once (it asks for the key)'); sys.exit(2)
    # 1 · grammar — saved and reused (reproducible)
    hg = h + '-g2'   # grammar cache key (g2 11-08: measure + due fields)
    reused = os.path.exists(gpath) and not fresh and json.load(open(gpath)).get('hash') == hg
    if reused:
        gram = json.load(open(gpath)); print('grammar: reused', gpath)
    else:
        # 11-09: asked in chunks of GCHUNK posts — a whole-set answer stopped mid-list at ~2k tokens (the relational test's old
        # trouble); each chunk's lines keep their real post numbers
        GCHUNK = int(os.environ.get('CF_GCHUNK', '6')); glines = []; uses = []
        numbered = [dict(it, n=i) for i, it in enumerate(items)]
        for c0 in range(0, len(numbered), GCHUNK):
            s_, u_ = grammar_prompt(meta, numbered[c0:c0 + GCHUNK], G)
            if dry:
                open(os.path.join(OUTD, pid + '.grammar.prompt.txt'), 'w').write(s_ + '\n\n' + u_); print('dry: grammar prompt written (first chunk)'); return
            ans, use = D.call(s_, u_, k, READ_MODEL); uses.append(use)
            got = [x for x in ans.get('lines', []) if isinstance(x.get('post'), int) and c0 <= x['post'] < c0 + GCHUNK]
            glines += got; print(f"  grammar: posts {c0}–{min(c0 + GCHUNK, len(numbered)) - 1} → {len(got)} lines")
        use = {'model': uses[-1].get('model'), 'input_tokens': sum(u.get('input_tokens', 0) for u in uses), 'output_tokens': sum(u.get('output_tokens', 0) for u in uses), 'calls': len(uses)}
        gram = {'hash': hg, 'at': datetime.datetime.now().isoformat(timespec='seconds'), 'usage': use, 'lines': glines}
        json.dump(gram, open(gpath, 'w'), indent=1, ensure_ascii=False); print(f"grammar: {len(gram['lines'])} lines ({use.get('model')})")
    lines = []
    for g in gram['lines']:
        it = items[g['post']]; st = it['station'] or g.get('station') or 'RP'
        lines.append({'i': len(lines), 'post': g['post'], 'who': it['who'], 'date': it['date'], 'url': it['url'], 'station': st,
                      'stationProposed': None if it['station'] else g.get('station'), 'quote': g['quote'], 'subject': g.get('subject'),
                      'about': g.get('about'), 'touch': g.get('touch'), 'measure': g.get('measure') or g.get('tracker') or g.get('gear'), 'due': g.get('due') or None,
                      'z': None if (g.get('measure') or g.get('tracker') or g.get('gear')) == 'shadow' or g.get('about') == 'shadow' else ZWORDS.get(g.get('z'), 0.0),
                      'zWord': g.get('z'), 'lit': g.get('lit', []), 'credulity': g.get('credulity', 'none'), 'whyGrammar': g.get('why'), 'post_text': it['text']})
    # 11-09: the forecast pass — conditional forecasts come due when the war measure says the condition was met
    FX = forecasts(pid, hg, lines, k, fresh or '--reforecast' in a, G)
    WAR_DAY = next((r[0] for r in measure(G, 'war')['readings'] if r[1] <= -1), G['topic']['zero'])
    def plus(day, n):
        return (datetime.date.fromisoformat(day) + datetime.timedelta(days=int(n))).isoformat()
    seen = set()
    # 11-11 (ruled): a judgment about a hypothetical is not a forecast. A line Sailor has ruled out (rulings.json → notForecast,
    # matched by its words) keeps no due date, whatever the grammar or the forecast pass said.
    _rp = os.path.join(D.OUT, 'rulings.json')
    _nf = [x_ for x_ in (json.load(open(_rp)).get('notForecast', []) if os.path.exists(_rp) else []) if x_.get('piece') in (None, pid)]
    def not_forecast(l):
        lq = l['quote'].lower().strip()
        for x_ in _nf:
            rq = (x_.get('quote') or '').lower().strip()
            if rq and lq and difflib.SequenceMatcher(None, lq, rq).find_longest_match(0, len(lq), 0, len(rq)).size >= max(16, 0.8 * min(len(lq), len(rq))): return x_
        return None
    for l in lines:
        f = FX.get(str(l['i']))
        nf_ = not_forecast(l)
        if nf_ and (f or l.get('due')):
            l['notForecast'] = {'why': nf_.get('why'), 'readAs': (f or {}).get('says'), 'due': l.get('due')}; l['due'] = None; continue
        if not f: continue
        key_ = (l['post'], f.get('state'), bool(f.get('negated')), (f.get('says') or '')[:40])
        if key_ in seen: continue   # 11-09: the same forecast handed to a second line of the same post
        seen.add(key_)
        l['forecastSays'] = f.get('says'); l['ifWar'] = bool(f.get('ifWar')); l['within'] = f.get('within'); l['state'] = f.get('state'); l['negated'] = bool(f.get('negated')); l['count'] = f.get('count')
        if f.get('due'): l['due'] = f['due']
        elif f.get('ifWar'): l['due'] = plus(WAR_DAY, f['within'] or 0); l['dueFrom'] = f"the war began {WAR_DAY}" + (f" + {f['within']} days" if f.get('within') else '')
        elif f.get('within') and l['date']: l['due'] = plus(l['date'], f['within']); l['dueFrom'] = f"said {l['date']} + {f['within']} days"
        elif not l.get('due'): l['due'] = 'open'
        if l.get('due') and l['due'] != 'open' and l['date'] and l['due'] < l['date']: l['due'] = 'open'; l['dueFrom'] = 'its condition is not the war beginning — open'   # 11-10: a forecast cannot come due before it was said
    progress('relational', lines=[{k2: l[k2] for k2 in ('i', 'post', 'who', 'date', 'station', 'quote', 'about', 'measure', 'due', 'z', 'lit')} for l in lines])
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
    # 11-09: a ruling is matched by its WORDS, not its line number — a re-read grammar renumbers and re-splits the lines.
    # Every line whose quote sits inside the ruled quote (or the reverse) takes the ruling; the line number is the fallback.
    def ruled_lines(R):
        rq = (R.get('quote') or '').lower().strip()
        if not rq: return [q for q in lines if q['i'] == R.get('line')]
        hit = []
        for q in lines:
            lq = q['quote'].lower().strip()
            if not lq: continue
            m = difflib.SequenceMatcher(None, lq, rq).find_longest_match(0, len(lq), 0, len(rq)).size
            if m >= 0.8 * min(len(lq), len(rq)) and m >= 20: hit.append(q)
        return hit or [q for q in lines if q['i'] == R.get('line') and difflib.SequenceMatcher(None, q['quote'].lower(), rq).ratio() > 0.5]
    for R in D.ruled(pid):
        if R.get('piece') != pid: continue
        for l in ruled_lines(R):
            l['handRuled'] = {'tier': R['tier'], 'dia': R.get('dia'), 'derivedDia': l.get('dia'), 'why': R.get('why'), 'ruledLine': R.get('line')}
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
    # 2 · context — the measures as of each line's date; light = calm × proximity, shadow unmeasured
    for l in lines:
        rd = None if l['measure'] in (None, 'shadow') else reading_at(G, l['measure'], l['date'] or G['built'])
        if rd and rd['nearest'] and (measure(G, l['measure']) or {}).get('kind') == 'state': rd = None   # 11-10: a step line has no reading before its first step (the law before its first vote): unmeasured, not borrowed
        if rd is None or l.get('dia') is None or l.get('z') is None: l['lumens'] = 'unmeasured'; continue   # 11-10: a line with no claim (z) has nothing to hold against the body
        d = abs(l['z'] - rd['z']); prox = 1.0 if d <= rd['sigma'] else max(0.0, 1 - (d - rd['sigma']))
        l.update(bodyReading=rd, proximity=round(prox, 3), lumens=round((1 - l['dia'] / 100) * prox, 3))
    # 2a · the room (11-09): the discourse measure's reading on the line's date — within 3 days, else none. room = line z − room z.
    # Never Lumens: nearness to the room is conformity, not signal.
    DT = G.get('room')
    for l in lines:
        l['room'] = None
        if not DT or not DT['readings'] or l.get('z') is None or not l['date']: continue
        rd = reading_at(G, DT['id'], l['date'])
        if rd and not rd['nearest'] and (datetime.date.fromisoformat(l['date']) - datetime.date.fromisoformat(rd['date'])).days <= 3:
            l['room'] = round(l['z'] - rd['z'], 2); l['roomReading'] = rd
    # 2b · forecasts — a line with a due date stays live. Light above is what the line saw on its own day; this is what the
    # measure did afterwards: gap = line z − measure z at due (only once due has passed), exposure = Dia/100 × gap
    # (how much capital rode on the gap), and gapNow against the measure's latest reading.
    WT = G['topic']; LEDGER = WT.get('ledger', []); UNM = set(WT.get('unmeasuredStates', []))
    today = datetime.date.today().isoformat()
    def on_ledger(state, day):
        return next((e for e in LEDGER if e[1] == state and e[0] <= day), None)
    for l in lines:
        if not l.get('due') or l.get('dia') is None or l['measure'] in (None, 'shadow') and not l.get('state'): continue
        came = l['due'] != 'open' and l['due'] <= today
        if l.get('state'):
            # 11-09: a NAMED STATE — right if it is on the war ledger by due (off it, for a negated forecast); wrong if not.
            # gap: 0 right · 1 wrong (a full point); exposure = Dia/100 × gap. An open forecast is read against the ledger today.
            st = l['state']; day = l['due'] if came else today
            # 11-10: a forecast of the dead is read against lives — the count on file as of the day it is judged
            LIVES = next((m_['series'] for m_ in G.get('measures', []) if m_['id'] == 'lives'), None)
            if st == 'casualties' and LIVES and isinstance(l.get('count'), (int, float)) and l['count'] > 0:
                killed = ([v_ for d_, v_ in LIVES if d_ <= day] or [0])[-1]; right = (killed >= l['count']) != l['negated']
                l['forecast'] = {'due': l['due'], 'dueFrom': l.get('dueFrom'), 'says': l.get('forecastSays'), 'state': st, 'negated': l['negated'], 'count': l['count'], 'cameDue': came,
                                 'result': ('right' if right else 'wrong') + ('' if came else ' so far'), 'onLedger': f"{killed} US service members killed by {day} (the line means at least {int(l['count'])})",
                                 'gap': 0.0 if right else 1.0, 'exposure': 0.0 if right else round(l['dia'] / 100, 2)}
                continue
            if st in UNM or st not in (WT.get('states') or {}):
                l['forecast'] = {'due': l['due'], 'dueFrom': l.get('dueFrom'), 'says': l.get('forecastSays'), 'state': st, 'negated': l['negated'], 'cameDue': came, 'result': 'unmeasured', 'gap': None, 'exposure': None}; continue
            hit = on_ledger(st, day); right = bool(hit) != l['negated']
            td = reading_at(G, 'war', day)   # for the pin: where the war measure stood on the day the forecast was judged
            l['forecast'] = {'due': l['due'], 'dueFrom': l.get('dueFrom'), 'says': l.get('forecastSays'), 'state': st, 'negated': l['negated'], 'cameDue': came, 'atDue': td, 'judgedOn': day,
                             'result': ('right' if right else 'wrong') + ('' if came else ' so far'), 'onLedger': hit and f'{hit[2]} ({hit[0]})',
                             'gap': 0.0 if right else 1.0, 'exposure': 0.0 if right else round(l['dia'] / 100, 2)}
            continue
        if l.get('z') is None: continue
        latest = reading_latest(G, l['measure'])
        if not latest: continue
        td = reading_at(G, l['measure'], min(l['due'], latest['date'])) if came else None
        gap = round(l['z'] - td['z'], 2) if td else None
        l['forecast'] = {'due': l['due'], 'dueFrom': l.get('dueFrom'), 'says': l.get('forecastSays'), 'cameDue': came, 'atDue': td, 'gap': gap,
                         'result': None if gap is None else ('right' if abs(gap) <= max(td['sigma'], 0.25) else 'wrong'),
                         'exposure': round(l['dia'] / 100 * gap, 2) if gap is not None else None,
                         'latest': latest, 'gapNow': round(l['z'] - latest['z'], 2)}
    S = [l for l in lines if l.get('dia') is not None]
    mean = lambda xs: sum(xs) / len(xs) if xs else None
    lit = [l['lumens'] for l in S if l['lumens'] != 'unmeasured']
    FC = [l for l in S if l.get('forecast')]; FD = [l for l in FC if l['forecast']['cameDue'] and l['forecast'].get('gap') is not None]
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
                          'dia': l['dia'], 'z': l['z'], 'measure': l['measure'], 'about': l['about'], 'lumens': l['lumens'], 'date': l['date'],
                          'due': l.get('due'), 'gap': (l.get('forecast') or {}).get('gap'),
                          'gnostic': l['credulity'] if l['credulity'] != 'none' else None,
                          'normX': x, 'normY': y, 'normZ': zz, 'step': dates.index(l['date'] or '')})
    sb = {'lines': len(S), 'dia': round(mean([l['dia'] for l in S])) if S else None, 'readZ': round(mean([l['z'] for l in S if l['z'] is not None]), 2) if any(l['z'] is not None for l in S) else None,
          'lumensTracked': round(100 * mean(lit)) if lit else None, 'measured': len(lit), 'unmeasured': len(S) - len(lit),
          'gnostic': [l['i'] for l in S if l['credulity'] != 'none'],
          'forecasts': {'lines': [l['i'] for l in FC], 'cameDue': len(FD), 'right': len([l for l in FD if l['forecast'].get('result') == 'right']), 'wrong': len([l for l in FD if l['forecast'].get('result') == 'wrong']),
                        'meanGap': round(mean([abs(l['forecast']['gap']) for l in FD]), 2) if FD else None,
                        'exposure': round(sum(abs(l['forecast']['exposure']) for l in FD), 2) if FD else None}}
    doc = {'schema': 'parallelogram/derived/v0', 'id': pid, 'title': meta.get('title'), 'object': topic_label(meta, G),
           'context': meta.get('context'), 'contextRule': 'added by the writer, labeled, never scored', 'source': os.path.relpath(src, ROOT),
           'at': datetime.datetime.now().isoformat(timespec='seconds'), 'model': D.MODEL, 'runs': runs, 'grammar': os.path.relpath(gpath, ROOT),
           'theObject': G['object'], 'body': 'data/active/object.json (built ' + G['built'] + ')', 'scoreboard': sb, 'steps': dates,
           'bands': bands, 'lines': lines, 'cloud': cloud, 'status': 'derived draft — Sailor rules'}
    json.dump(doc, open(os.path.join(OUTD, pid + '.json'), 'w'), indent=1, ensure_ascii=False)
    progress('done', lumens={str(l['i']): l['lumens'] for l in S}, forecasts={str(l['i']): l['forecast'] for l in FC})
    # report
    R = [f"# Parallelogram — {meta.get('title', pid)}",
         f"*{doc['at']} · {D.MODEL} · grammar {'reused' if reused else 'read fresh'} · relational test ×{runs} (median) · derived draft*", '',
         f"**{sb['lines']} lines · Dia {sb['dia']} · read z {sb['readZ']} · Lumens {sb['lumensTracked']} tracked ({sb['measured']} measured, {sb['unmeasured']} unmeasured) · credulity moments: {sb['gnostic'] or 'none'} · forecasts: {len(FC)} ({sb['forecasts']['cameDue']} came due: {sb['forecasts']['right']} right, {sb['forecasts']['wrong']} wrong; mean gap {sb['forecasts']['meanGap']}, exposure {sb['forecasts']['exposure']})**", '',
         '| # | who | date | quote | about · measure | touch | z | Dia (runs) | tier | lumens | lit words |', '|---|---|---|---|---|---|---|---|---|---|---|']
    for l in S:
        R.append(f"| {l['i']} | {l['who']} | {l['date']} | {l['quote'][:80]} | {l['about']} · {l['measure']} | {l['touch']} | {'—' if l['z'] is None else format(l['z'], '+.1f')} | {l['dia']} ({' '.join(map(str, l['runs']))}) | {l['tier']} | {l['lumens']} | {' · '.join(l['lit'])} |")
    if FC:
        R += ['', '## Forecasts — lines read again when they came due', '', 'A forecast that names a STATE of the war (a world war, a nuclear strike, no war) is scored against the war ledger: right if the state is on it by due (off it, if the line said it would not come), wrong if not — gap 0 or 1. A forecast of a READING (the pump, the vote, the dollar) is scored by gap = line z − the body at due (negative: more frustrated than the object turned out; right inside the measure\'s sigma). exposure = Dia/100 × gap. A conditional forecast ("a war would…") comes due when the ledger says the war began, plus the horizon the line gave; "now" = against the latest reading or the ledger today.', '',
              '| # | who | said | forecast | state / measure | due | result | line z | the body at due | gap | exposure | now |', '|---|---|---|---|---|---|---|---|---|---|---|---|']
        for l in FC:
            f = l['forecast']; ad = f.get('atDue')
            if f.get('state'):
                R.append(f"| {l['i']} | {l['who']} | {l['date']} | {(f.get('says') or l['quote'])[:70]} | {'not ' if f['negated'] else ''}{f['state']} | {f['due']}{(' — ' + f['dueFrom']) if f.get('dueFrom') else ''} | **{f['result']}** | {'—' if l['z'] is None else format(l['z'], '+.1f')} | {f.get('onLedger') or 'not on the ledger'} | {f['gap'] if f['gap'] is not None else '—'} | {f['exposure'] if f['exposure'] is not None else '—'} | — |"); continue
            R.append(f"| {l['i']} | {l['who']} | {l['date']} | {(f.get('says') or l['quote'])[:70]} | {l['measure']} | {f['due']}{'' if f['cameDue'] or f['due'] == 'open' else ' (open)'}{(' — ' + f['dueFrom']) if f.get('dueFrom') else ''} | {f.get('result') or 'open'} | {l['z']:+.1f} | {(format(ad['z'], '+.2f') + ' (' + ad['date'] + ')') if ad else '—'} | {f['gap'] if f['gap'] is not None else '—'} | {f['exposure'] if f['exposure'] is not None else '—'} | {f['latest']['z']:+.2f} ({f['latest']['date']}) | {f['gapNow']:+.2f} |")
    G2 = [l for l in S if l['credulity'] != 'none']
    R += ['', '## Second pass — where credulity switches (DiaGnostic)', '']
    R += [f"- line {l['i']} ({l['who']}, {l['date']}) **{l['credulity']}**, turning on line {l.get('turnsOn')}: “{l['quote'][:90]}” — {l.get('gnosticWhy', '')}" for l in G2] or ['- none found']
    NF = [l for l in S if l.get('notForecast')]
    if NF: R += ['', '## Ruled not a forecast', ''] + [f"- line {l['i']}: “{l['quote'][:90]}” — {l['notForecast']['why']} (the forecast pass read it as: {l['notForecast'].get('readAs')})" for l in NF]
    HR = [l for l in S if l.get('handRuled')]
    if HR:
        R += ['', "## Held to Sailor's rulings", ''] + [f"- line {l['i']}: {l['handRuled']['tier']} {l['handRuled']['dia']} (the model said {l['handRuled']['derivedDia']}) — {l['handRuled']['why']}" for l in HR]
    R += ['', '## Bands (station × tier)', '', '| band | lines | z | Dia | words |', '|---|---|---|---|---|']
    R += [f"| {b['station']} {b['tier']} | {b['n']} | {b['z']} | {b['dia']} | {' · '.join(b['words'][:8])} |" for b in bands if b['n']]
    if cmp_:
        P = json.load(open(os.path.join(ROOT, 'data', 'press', cmp_ + '.json'))); hs = P['scoreboard']; lt = hs.get('lumensTracked') or {}
        R += ['', f"## Against the hand cut `{cmp_}`", '',
              f"hand: {len([l for l in P['lines'] if l['station'] != 'O'])} lines · Dia {hs['dia']} · read z {hs['readZ']} · Lumens {lt.get('value')} tracked ({lt.get('measured')} measured)  →  derived: {sb['lines']} lines · Dia {sb['dia']} · read z {sb['readZ']} · Lumens {sb['lumensTracked']} ({sb['measured']} measured)", '',
              '| derived # | quote | derived Dia · z · measure | nearest hand line | hand Dia · z · measure |', '|---|---|---|---|---|']
        for l in S:
            best = max(P['lines'], key=lambda hh: difflib.SequenceMatcher(None, l['quote'].lower(), hh['quote'].lower()).ratio())
            sc = difflib.SequenceMatcher(None, l['quote'].lower(), best['quote'].lower()).ratio()
            R.append(f"| {l['i']} | {l['quote'][:60]} | {l['dia']} · {'—' if l['z'] is None else format(l['z'], '+.1f')} · {l['measure']} | {best['t']}: {best['quote'][:50]} ({sc:.2f}) | {best.get('dia')} · {best['z']:+.1f} · {best.get('measure') or best.get('tracker') or best.get('gear', '—')} |")
    open(os.path.join(OUTD, pid + '_report.md'), 'w').write('\n'.join(R))
    print(f"{pid}: {sb['lines']} lines · Dia {sb['dia']} · z {sb['readZ']} · Lumens {sb['lumensTracked']} ({sb['measured']}/{sb['lines']} measured) → {os.path.join(OUTD, pid + '_report.md')}")


if __name__ == '__main__':
    main()
