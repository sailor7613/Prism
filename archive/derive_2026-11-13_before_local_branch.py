#!/usr/bin/env python3
"""derive.py — the closed form, run. A Press piece's lines go through the Diatribe Derivation Protocol as fixed
questions a small model answers (Claude Haiku, JSON only); the scores then come from rules, never from the model.

  python3 scripts/closedform/derive.py <piece id> [<piece id> …]     # or --show sp01 for every piece in an episode
  python3 scripts/closedform/derive.py --show sp01 --dry               # build the prompts, call nothing

What the model answers per line (the protocol's own steps, 1.4 revised):
  substance  does the line touch the object's measurable substance — and which tracker facts (ids) does it touch?
  contradicts which tracker facts does it contradict?
  object     step 3, the relational test (ruled 11-05), toward the object: substance | signal
  others     toward the other subjects: open (states it, no need to convince) | working (works to win them over, still
             answers them) | closed (talks over them — the answer fixed before they speak)
  capital    is the speaker spending political capital to make the point, willing to burn a bridge?
  stage      step 4: the five-stage gradient, 0–4
  patterns   step 5: the denomination patterns present (library numbers), with the phrase that shows each
  facing     toward the object, or toward the argument about it (the lumens arc)
  place      low | mid | high within the band the rules give
What the rules do (this file, no model): the relational test sets the tier (fluid 0–33 · coalition 34–66 · denominated
67–100); the stage and the patterns' library ranges place the line inside it; where they can't agree the line is
flagged for Sailor's ruling instead of averaged. Each piece runs --runs times (default 3); the median is kept. Lumens: a line facing the
object lets through (1 − Dia/100) of its light, else none (press-build's rule).
Writes data/closedform/<piece>.json and data/closedform/<show or piece>_report.md (hand score beside derived)."""
import json, os, re, sys, ssl, urllib.request, datetime
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE)); WS = os.path.dirname(ROOT)
OUT = os.path.join(ROOT, 'data', 'closedform'); os.makedirs(OUT, exist_ok=True)
MODEL = os.environ.get('CF_MODEL', 'claude-haiku-5-5')
LIB = os.path.join(WS, 'Parameters', '03_Libraries', 'denomination_pattern_library.md')
STAGES = {0: (0, 10, 'Liquid — meets the object with no frame'), 1: (10, 33, 'Vehicle emergence — an orientation, still falsifiable'),
          2: (34, 55, 'Frame consolidation — the frame filters the object, contrary evidence still reachable'),
          3: (55, 80, 'Substance replacement — answers its story about the object, not the object'),
          4: (80, 100, 'Totalization — the vehicle is the whole framework; new objects absorbed on arrival')}
PLACE = {'low': 0.2, 'mid': 0.5, 'high': 0.8}

def key():
    k = os.environ.get('ANTHROPIC_API_KEY')
    if k: return k
    p = os.path.join(ROOT, 'scripts', 'secrets.local.js')
    if os.path.exists(p):
        m = re.search(r"ANTHROPIC_API_KEY:\s*'([^']+)'", open(p).read())
        if m and not m.group(1).startswith('paste'): return m.group(1)
    return None

def patterns():
    s = open(LIB).read(); out = []
    for m in re.finditer(r'### Pattern (\d+) — (.+?)\n(.*?)(?=\n### Pattern |\n## )', s, re.S):
        n, name, body = int(m.group(1)), m.group(2).strip(), m.group(3)
        g = lambda f: (re.search(r'\*\*' + f + r':\*\*\s*(.+)', body) or [None, ''])[1].strip()
        r = re.search(r'(\d+)\s*[–-]\s*(\d+)', g('Diatribe range'))
        out.append({'n': n, 'name': name, 'mode': g('Mode'), 'stage': g('Stage').split(' (')[0], 'desc': g('Description'),
                    'range': [int(r.group(1)), int(r.group(2))] if r else None})
    return out

# ── the trackers' facts: what the object measurably is, dated and sourced. The supply shock tracker (PG01's active
#    layer) is read from data/active; the conflict casualty tracker doesn't exist yet, so its objects carry the piece's
#    own declared notes, marked 'declared, not tracked'.
def series_at(pts, day):
    best = None
    for d, v in pts:
        if d <= day: best = (d, v)
    return best
def sst_facts(war_start='2026-02-28'):
    P = json.load(open(os.path.join(ROOT, 'data', 'active', 'price.json')))['series']; F = []
    for sid, lab in (('EMM_EPMR_PTE_NUS_DPG', 'US regular gasoline, retail'), ('RBRTE', 'Brent crude'), ('RWTC', 'WTI crude')):
        s = P.get(sid)
        if not s: continue
        a, b = series_at(s['points'], war_start), s['points'][-1]
        if a: F.append({'id': f'sst:{sid}', 'fact': f"{lab}: {a[1]} on {a[0]} (before the war) → {b[1]} on {b[0]} ({(b[1] / a[1] - 1) * 100:+.0f}%)",
                        'source': 'EIA, via the supply shock tracker (data/active/price.json)', 'asOf': b[0], 'tracked': True})
    return F
OBJECT_TRACKERS = {   # piece id → which tracker holds its object (prototype map; to be ruled per object)
    'trump_2026-10-24_perry_fortune': 'sst', 'obama_2026-10_georgia_no_relief': 'sst', 'maine_2026-10-13_collins_jackson_iran': 'sst',
    'stevens_2026-11-01_country': 'cct', 'reingold_2026-11-02_gist': 'cct', 'contain_2024-10_megalopolis': None}
def facts_for(pid, P):
    t = OBJECT_TRACKERS.get(pid, 'sst' if 'iran' in json.dumps(P.get('object', {})).lower() else None)
    F = sst_facts() if t == 'sst' else []
    leg = (P.get('object') or {}).get('legislative') or {}
    if leg.get('note'): F.append({'id': 'decl:legislative', 'fact': leg['note'], 'source': 'the piece, declared', 'tracked': False})
    if t == 'cct': F.append({'id': 'cct:none', 'fact': 'No conflict casualty tracker yet — casualty figures for this object are not tracked.', 'source': 'closed form', 'tracked': False})
    return t, F

def ruled(pid):
    # Sailor's rulings (data/closedform/rulings.json): shown to the model as ruled cases; a line he has ruled on is also
    # held to his tier by the rules below, whatever the model answers
    p = os.path.join(OUT, 'rulings.json')
    return json.load(open(p)).get('rows', []) if os.path.exists(p) else []

def prompt(P, F, PAT):
    obj = P.get('object') or {}; za = obj.get('zAxis') or {}
    lines = [{'i': i, 'who': (P.get('names') or {}).get(l['who'], l['who']), 'station': l['station'], 'quote': l['quote']} for i, l in enumerate(P['lines']) if l['station'] != 'O']
    sys_ = ("You answer fixed questions from Prism's Diatribe Derivation Protocol about scored lines of political talk. You never give a "
            "Diatribe number; rules compute it from your answers. Judge the line, never the speaker's reputation, and never tone: a calm line can be "
            "fully denominated and an angry one fluid. Judge both sides of the map the same way. Holding a firm view is not "
            "denomination; talking over the other side, with the answer fixed before they speak, is. Reply with JSON only.")
    pat = '\n'.join(f"#{p['n']} {p['name']} [{p['mode']}; stage {p['stage']}] — {p['desc'][:220]}" for p in PAT)
    stg = '\n'.join(f"{k}: {v[2]}" for k, v in STAGES.items())
    rul = '\n'.join(f"- {r['who']}: '{r['quote']}' → object: {r['object']} · others: {r['others']} · capital: {str(r['capital']).lower()} · {r['tier']} — {r['why']}" for r in ruled(None)) or '(none yet)'
    # 11-07: Sailor's principles (rulings that are rules, not single lines) ride along with the ruled cases
    _pp = os.path.join(OUT, 'rulings.json')
    _pr = json.load(open(_pp)).get('principles', []) if os.path.exists(_pp) else []
    if _pr: rul += '\n' + '\n'.join(f"- PRINCIPLE · {x['name']}: {x['rule']} (case: {x['case']})" for x in _pr)
    fac = '\n'.join(f"[{f['id']}] {f['fact']}  ({f['source']}{'' if f['tracked'] else '; not tracked'})" for f in F) or '(no tracker facts for this object)'
    user = f"""OBJECT: {obj.get('label', P.get('title'))}
z: +1 = {za.get('pos', 'the object realized')}  ·  −1 = {za.get('neg', 'the object frustrated')}

TRACKER FACTS (what the object measurably is):
{fac}

DENOMINATION PATTERNS (library):
{pat}

RULED CASES (Sailor's own rulings — follow their reasoning):
{rul}

LINES:
{json.dumps(lines, ensure_ascii=False, indent=1)}

For every line return:
{{"i": n,
 "substance": true|false,            // does it engage the object's actual substance? Substance is whatever THIS object is made of: for a war, costs, flows, votes, deaths; for a cultural object, the works themselves and how people take them
 "facts_touched": ["fact id", …],
 "contradicts": ["fact id", …],
 "object": "substance"|"signal",     // does it take up the object's substance (as defined above), or a signal about it (who said it, which side, the controversy)?
 "others": "open"|"working"|"closed",// toward the other side and the audience. open: states a belief, no instinct to convince or qualify. working: built to persuade or rally — a campaign or rally line, an applause line, an argument aimed at winning a room or an opponent over, still answering them. closed: talks over them, its answer fixed before they speak (pre-empts or dismisses their response). Most political speech to a crowd is working.
 "capital": true|false,              // is THE SPEAKER spending their own political capital in this statement — burning a bridge of their own rather than gathering support? (describing someone else's defiance is not the speaker's capital)
 "patterns": [{{"n": number, "phrase": "the words that show it"}}],   // only patterns plainly present; [] is a fine answer
 "facing": "object"|"argument",      // toward the thing, or toward the argument about the thing
 "place": "low"|"mid"|"high",        // where in its band
 "why": "one plain sentence"}}
Answer: {{"lines": [ … ]}} — valid JSON only. Inside a string never use a double quote; quote words with single quotes."""
    return sys_, user


def _fix_quotes(obj):
    # 11-07: a quote inside a string ("War with Iran") breaks the JSON — escape any " that doesn't close the string
    out = []; ins = False; n = len(obj)
    for j, c in enumerate(obj):
        if c == '"' and (j == 0 or obj[j-1] != '\\'):
            if not ins: ins = True; out.append(c); continue
            k = j + 1
            while k < n and obj[k] in ' \t\r\n': k += 1
            if k >= n or obj[k] in ',:}]': ins = False; out.append(c)
            else: out.append('\\"')
        else: out.append(c)
    return ''.join(out)

def salvage(t):
    # 11-07: keep the objects that parse (each carries its own "i"); fix inner quotes; a cut-off answer gives a partial list
    key = 'lines' if '"lines"' in t[:200] else ('moments' if '"moments"' in t[:200] else None)
    if not key: return None
    objs = []   # balanced-brace scan (objects nest: "patterns": [{...}])
    for m0 in re.finditer(r'\{\s*"(?:i|post)"\s*:', t):   # 11-09: grammar lines start with "post", not "i"
        j = m0.start(); depth = 0; ins = False
        for k in range(j, len(t)):
            c = t[k]
            if c == '"' and t[k-1] != '\\': ins = not ins
            elif not ins and c == '{': depth += 1
            elif not ins and c == '}':
                depth -= 1
                if depth == 0: objs.append(t[j:k+1]); break
        else: objs.append(t[j:])
    got = []
    for o in objs:
        for cand in (o, _fix_quotes(o)):
            try: got.append(json.loads(cand)); break
            except ValueError: pass
    return {key: got} if got else None

def call(sys_, user, k, model=None):
    # 11-07: offline mode — CF_ANSWERS names a JSON list of answers (one per call, in order); used when Claude answers in chat instead of the API
    if os.environ.get('CF_ANSWERS'):
        A = json.load(open(os.environ['CF_ANSWERS'])); n = int(os.environ.get('CF_ANSWERS_I', '0'))
        if n >= len(A): raise SystemExit(f'CF_ANSWERS: no answer #{n} (have {len(A)})')
        os.environ['CF_ANSWERS_I'] = str(n + 1); print(f'  offline answer #{n} ({os.environ["CF_ANSWERS"]})')
        return A[n], {'model': 'claude-in-chat (offline)', 'input_tokens': 0, 'output_tokens': 0}
    # 11-04: Anthropic's reason is printed on any refusal; a setting the model won't take is dropped and the call retried,
    # and if the model name is refused the next one in CF_MODELS is tried
    import urllib.error
    ctx = ssl.create_default_context(cafile=os.environ.get('SSL_CERT_FILE')) if os.environ.get('SSL_CERT_FILE') else None
    M0 = model or MODEL   # 11-08: a pass can name its own model (grammar and the second pass read across lines → Sonnet; the relational test answers fixed questions → Haiku)
    models = [M0] + [m for m in os.environ.get('CF_MODELS', 'claude-haiku-5-5,claude-sonnet-5-5').split(',') if m != M0]
    body = {'max_tokens': 8000, 'system': sys_, 'messages': [{'role': 'user', 'content': user}]}
    last = ''
    for model in models:
        for attempt in range(3):
            b = dict(body, model=model)
            req = urllib.request.Request('https://api.anthropic.com/v1/messages', data=json.dumps(b).encode(), headers={'content-type': 'application/json', 'x-api-key': k, 'anthropic-version': '2023-06-01'})
            try:
                with urllib.request.urlopen(req, timeout=180, context=ctx) as r: d = json.load(r)
            except urllib.error.HTTPError as e:
                last = e.read().decode('utf-8', 'replace')[:600]; print(f'  {model}: HTTP {e.code} — {last}')
                low = last.lower(); dropped = False
                for f in ('temperature', 'top_p', 'top_k'):
                    if f in low and f in body: body.pop(f); dropped = True; print(f'  retrying without {f}')
                if dropped: continue
                if e.code in (400, 404) and 'model' in low: break          # try the next model
                if e.code in (429, 500, 529): import time; time.sleep(8); continue
                raise SystemExit(f'Anthropic refused the request: {last}')
            t = ''.join(c.get('text', '') for c in d.get('content', []))
            m = re.search(r'\{.*\}', t, re.S); u = d.get('usage', {}); u['model'] = model
            try:
                if not m: raise ValueError('no JSON')
                return json.loads(m.group(0)), u
            except ValueError as e:   # 11-05: a stray quote or a cut-off answer — keep the raw text; 11-07: salvage what parses before asking again
                open(os.path.join(OUT, '_last_bad_answer.txt'), 'w').write(t)
                sv = salvage(t)
                if sv:
                    kk = list(sv)[0]; cut = d.get('stop_reason') == 'max_tokens' or not t.rstrip().endswith('}')
                    print(f"  {model}: the answer was not clean JSON ({e}) — salvaged {len(sv[kk])} {kk}{' (answer cut off; stop_reason=' + str(d.get('stop_reason')) + ', output_tokens=' + str(u.get('output_tokens')) + ')' if cut else ''}"); return sv, u
                print(f"  {model}: the answer was not clean JSON ({e}; stop_reason={d.get('stop_reason')}, output_tokens={u.get('output_tokens')}, {len(t)} chars) — asking again"); continue
    raise SystemExit(f'no model took the request: {last}')

TIERS = {'fluid': (0, 33), 'coalition': (34, 66), 'denominated': (67, 100)}
def tier_of(a):
    # the relational test (Sailor, 11-05): the band is the speaker's relationship with the other subjects — talking over
    # them, or spending their own capital → denominated; working to win them → coalition; stating it → fluid.
    # 11-05 (2nd run): taking up a signal instead of the substance no longer moves the band; it dims the line's lumens
    # and places it higher inside its band
    # 11-05 (3rd run): capital comes with denomination, it doesn't make it — denominated needs talking over the other
    # side; capital spent while still leaving room is coalition
    if a.get('others') == 'closed': return 'denominated'
    if a.get('others') == 'working' or a.get('capital') is True: return 'coalition'
    return 'fluid'
def rules(a, PAT):
    pr = {p['n']: p for p in PAT}; flags = []
    tr = tier_of(a); lo, hi = TIERS[tr]
    # the #1 / #28 split (Sailor, 11-05): a foreclosure that talks over the reply is #28 by definition, whichever the model named
    if a.get('others') == 'closed' and 28 in pr and any(q.get('n') == 1 for q in a.get('patterns', [])):
        a['patterns'] = list({(28 if q.get('n') == 1 else q.get('n')): dict(q, n=(28 if q.get('n') == 1 else q.get('n'))) for q in a['patterns']}.values()); flags.append('#1 read as #28 (the split: it talks over the reply)')
    rs = [pr[p['n']]['range'] for p in a.get('patterns', []) if p.get('n') in pr and pr[p['n']]['range']]
    if rs:
        plo, phi = min(r[0] for r in rs), max(r[1] for r in rs)
        if max(lo, plo) <= min(hi, phi): lo, hi = max(lo, plo), min(hi, phi)
        else: flags.append(f"patterns {', '.join('#' + str(p['n']) for p in a['patterns'])} say {plo}–{phi}, the band says {tr} {lo}–{hi}")
    pl = PLACE.get(a.get('place'), 0.5)
    if a.get('object') == 'signal': pl = min(0.9, pl + 0.25)
    if a.get('capital') is True: pl = min(0.9, pl + 0.25)
    dia = round(lo + (hi - lo) * pl)
    return {'dia': dia, 'band': [lo, hi], 'stage': None, 'tier': tr, 'flags': flags}

def main():
    args = [x for x in sys.argv[1:] if not x.startswith('--')]; dry = '--dry' in sys.argv
    if '--show' in sys.argv:
        sid = sys.argv[sys.argv.index('--show') + 1]; args = [x for x in args if x != sid]
        args = json.load(open(os.path.join(ROOT, 'data', 'show', sid + '.json'))).get('pieces', []); tag = sid
    else: tag = args[0] if args else 'pieces'
    k = None if dry else key()
    if not dry and not k: print('no ANTHROPIC_API_KEY — run "Run the Closed Form.command" (it asks for the key once)'); sys.exit(2)
    PAT = patterns(); rep = [f"# Closed form — {tag}", f"*{datetime.date.today()} · {MODEL} answers the protocol's questions; the rules score. Hand = Claude's scores in the piece.*", '']
    for pid in args:
        pf = os.path.join(ROOT, 'data', 'press', pid + '.json')
        if not os.path.exists(pf): print('no piece', pid); continue
        P = json.load(open(pf)); tr, F = facts_for(pid, P); s_, u_ = prompt(P, F, PAT)
        if dry: open(os.path.join(OUT, pid + '.prompt.txt'), 'w').write(s_ + '\n\n' + u_); print('prompt →', pid, len(u_), 'chars'); continue
        RUNS = int(sys.argv[sys.argv.index('--runs') + 1]) if '--runs' in sys.argv else 3
        runs = []; use = {'input_tokens': 0, 'output_tokens': 0}
        for _ in range(RUNS):
            ans, u = call(s_, u_, k); runs.append({a['i']: a for a in ans.get('lines', [])})
            use['input_tokens'] += u.get('input_tokens', 0); use['output_tokens'] += u.get('output_tokens', 0); use['model'] = u.get('model')
        by = {}
        for i_ in set().union(*[set(r) for r in runs]):
            got = [(rules(r[i_], PAT), r[i_]) for r in runs if i_ in r]; got.sort(key=lambda x: x[0]['dia'])
            med = got[len(got) // 2]; a = dict(med[1]); a['_runs'] = [g[0]['dia'] for g in got]; by[i_] = a
        rows = []; rep += [f"## {P.get('title', pid)}  ·  `{pid}`", f"object: {(P.get('object') or {}).get('label', '')}  ·  tracker: {tr or 'none'}", '',
                           '| # | who | quote | hand | derived | runs | tier | object · others · capital | patterns | facing | flags |', '|---|---|---|---|---|---|---|---|---|---|---|']
        for i, l in enumerate(P['lines']):
            if l['station'] == 'O' or i not in by: continue
            a = by[i]; r = rules(a, PAT)
            R = next((x for x in ruled(pid) if x['piece'] == pid and x['line'] == i), None)
            if R and R['tier'] != r['tier']:
                a = dict(a, others=R['others'], capital=R['capital'], object=R['object']); r = rules(a, PAT); r['flags'].append(f"held to Sailor's ruling ({R['tier']}); the model said otherwise")
            elif R: r['flags'].append("agrees with Sailor's ruling")
            rows.append({'i': i, 'who': l['who'], 'hand': {'dia': l.get('dia'), 'touch': l.get('touch')}, 'answers': a, 'derived': r})
            rr = a.get('_runs', [r['dia']]); spread = max(rr) - min(rr)
            if spread > 15: r['flags'].append(f'runs disagree ({min(rr)}–{max(rr)})')
            rep.append(f"| {i} | {l['who']} | {l['quote'][:70]}… | {l.get('dia')} | **{r['dia']}** | {' '.join(map(str, rr))} | {r['tier']} | {a.get('object')} · {a.get('others')} · {'capital' if a.get('capital') else '—'} | {' '.join('#' + str(p['n']) for p in a.get('patterns', [])) or '—'} | {a.get('facing')} | {'; '.join(r['flags']) or ''} |")
        S = [x for x in rows]; md = lambda xs: round(sum(xs) / len(xs)) if xs else None
        dd = md([x['derived']['dia'] for x in S]); lum = md([100 * (1 - x['derived']['dia'] / 100) * (1 if x['answers'].get('object') == 'substance' else 0.5) if x['answers'].get('facing') == 'object' else 0 for x in S])
        hs = P.get('scoreboard') or {}
        rep += ['', f"piece: hand Dia {hs.get('dia')} · lumens {hs.get('lumens')}  →  derived Dia **{dd}** · lumens **{lum}**", '']
        rep += [f"- line {x['i']} ({x['who']}): {x['answers'].get('why', '')}" for x in S] + ['']
        json.dump({'piece': pid, 'model': MODEL, 'at': datetime.datetime.now().isoformat(timespec='seconds'), 'tracker': tr, 'facts': F, 'usage': use,
                   'derived': {'dia': dd, 'lumens': lum}, 'lines': rows}, open(os.path.join(OUT, pid + '.json'), 'w'), indent=1, ensure_ascii=False)
        # 11-05 (Sailor: "draft over and keep the data"): the run is added to the piece as a derived draft, beside the hand
        # scores, never over them — the hand scores, the drafts and Sailor's rulings together are the classifier's data
        P.setdefault('closedform', []).append({'at': datetime.datetime.now().isoformat(timespec='seconds'), 'model': use.get('model', MODEL),
            'protocol': 'relational test, ruled 2026-11-05', 'status': 'derived draft — beside the hand scores, never over them',
            'scoreboard': {'dia': dd, 'lumens': lum},
            'lines': [{'i': x['i'], 'dia': x['derived']['dia'], 'tier': x['derived']['tier'], 'runs': x['answers'].get('_runs'),
                       'object': x['answers'].get('object'), 'others': x['answers'].get('others'), 'capital': x['answers'].get('capital'),
                       'patterns': [q.get('n') for q in x['answers'].get('patterns', [])], 'facing': x['answers'].get('facing'),
                       'why': x['answers'].get('why'), 'flags': x['derived'].get('flags')} for x in S]})
        json.dump(P, open(pf, 'w'), indent=1, ensure_ascii=False)
        print(f"{pid}: hand {hs.get('dia')} → derived {dd}  ({use.get('input_tokens')} in / {use.get('output_tokens')} out)")
    if not dry:
        open(os.path.join(OUT, tag + '_report.md'), 'w').write('\n'.join(rep)); print('report →', os.path.join(OUT, tag + '_report.md'))

if __name__ == '__main__': main()
