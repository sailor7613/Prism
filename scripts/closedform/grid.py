#!/usr/bin/env python3
"""grid.py — the same lines, several readers (2026-11-14).

  python3 scripts/closedform/grid.py annotate <in-file> <model>     # with CF_OUT=grid_<reader>
  python3 scripts/closedform/grid.py table <id> [<id> ...]

The trouble it answers: a model's read mixed two things, how it CUT the record into lines and how it READ them. Here the
cut is fixed. The lines are Sonnet's (BASE, below), and every reader answers the same questions about the same lines.

annotate  takes the base cut and asks <model> the grammar's questions about each line, without letting it re-cut:
          object or shadow, the measure, the touch, the due date, z. The quote and the post are copied from the base,
          never from the model. It writes <id>.grammar.json into the reader's own folder (data/parallelograms/reads/grid_<reader>/)
          under the same cache key parallelogram.py looks for, so parallelogram.py then reuses it and only scores.
table     lays the readers side by side: each line, each reader, each field. Counts agreement; scores nothing.
          Writes data/parallelograms/grid/<id>_grid.md and .json, and grid/summary.md."""
import json, os, re, sys, hashlib, datetime, itertools, statistics
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import derive as D
try: sys.stdout.reconfigure(line_buffering=True)   # 11-14: each line shows as it is printed, also when the output is piped into a log
except Exception: pass
import parallelogram as P

PG = os.path.join(D.ROOT, 'data', 'parallelograms')
BASE = os.path.join(PG, 'baselines', os.environ.get('CF_BASE', 'sonnet_2026-11-14_run2'))   # whose line cuts every reader is given
GRID = os.path.join(PG, os.environ.get('CF_GRID', 'grid')); os.makedirs(GRID, exist_ok=True)   # 11-17: a new set keeps its own grid folder (CF_GRID), so the working set's summary is not written over
READERS = ['sonnet', 'qwen', 'gemma']     # counted: agreement is measured among these
TRACKED = ['deepseek']                    # 11-15 (Sailor): read and shown beside the others, never counted. Its own three runs of a line spread about 38 points,
                                          # so it cannot say whether a question is tight; but how unsteady it is, and on which lines, is kept and watched over time
ASKED = ('subject', 'about', 'touch', 'measure', 'due', 'z', 'lit', 'credulity', 'kind', 'why')


def annotate_prompt(meta, posts, lines, G):
    """The grammar question, with the cutting taken out. Built from parallelogram.py's own prompt so the object, the body
    and the three rules for z are word for word the ones a full read gets."""
    _s, u = P.grammar_prompt(meta, posts, G)
    for mark in ('POSTS (in order):', 'For every line return:\n', 'HOW TO CHOOSE z', 'Answer:'):
        if mark not in u: raise SystemExit(f'grid: the grammar question changed shape (no "{mark}") — grid.py needs the same change')
    head = u.split('POSTS (in order):')[0]
    fields = u.split('For every line return:\n')[1].split('HOW TO CHOOSE z')[0]
    rules = 'HOW TO CHOOSE z' + u.split('HOW TO CHOOSE z')[1].split('Answer:')[0]
    first, _, rest = fields.partition('\n')
    if '"post"' not in first or '"quote"' not in first: raise SystemExit('grid: the grammar question changed shape (its first field line) — grid.py needs the same change')
    fields = '{"i": the line\'s number, copied from the list above,\n' + rest
    sys_ = ("You annotate the grammar of political talk for Prism, a closed-form instrument. The statements are already split "
            "into lines; you say what each line is about. You never score how heated a line is. Judge the words, never the "
            "speaker's reputation. Reply with JSON only.")
    pj = json.dumps([{'n': it['n'], 'who': it['who'], 'date': it['date'], 'text': it['text']} for it in posts], ensure_ascii=False, indent=1)
    lj = json.dumps([{'i': l['i'], 'post': l['post'], 'quote': l['quote']} for l in lines], ensure_ascii=False, indent=1)
    user = (head + 'POSTS (for context, in order):\n' + pj + '\n\n'
            'THE LINES — already cut from those posts. Each is one statement. Do not split, merge, reword or skip any. '
            'Answer for every one of them, by its number i:\n' + lj + '\n\nFor every line return:\n' + fields + rules +
            'Answer: {"lines": [ ... ]} — one entry for every line above, valid JSON only. Inside a string never use a double quote; quote words with single quotes.')
    return sys_, user


def annotate(src, model):
    if not os.environ.get('CF_OUT'): raise SystemExit('grid annotate: set CF_OUT=grid_<reader> first, so the read is kept apart')
    meta, items = P.parse(src); G = P.the_object()
    pid = meta.get('id') or re.sub(r'[^a-z0-9]+', '_', meta.get('title', os.path.basename(src)).lower()).strip('_')
    h = hashlib.sha1(open(src, 'rb').read()).hexdigest()[:12]
    km = re.search(r"hg = h \+ '(-g\d+)'", open(os.path.join(HERE, 'parallelogram.py')).read())
    if not km: raise SystemExit("grid: could not find parallelogram.py's grammar key")
    hg = h + km.group(1)   # parallelogram.py's grammar cache key, whatever the question's version is now (11-15)
    bp = os.path.join(BASE, pid + '.grammar.json')
    if not os.path.exists(bp): raise SystemExit(f'grid: no base cut for {pid} in {BASE}')
    base = json.load(open(bp))
    # the base gives only the CUT (post and quote); every answer is asked again under the question as it stands. So the base
    # may have been cut under an older question, as long as the record itself has not changed.
    if not str(base.get('hash', '')).startswith(h): raise SystemExit(f'grid: {pid} has changed since the base cut was made ({base.get("hash")} vs {h}) — take a new Sonnet baseline first')
    out = os.path.join(P.OUTD, pid + '.grammar.json')
    if os.path.exists(out) and '--fresh' not in sys.argv:
        c = json.load(open(out))
        if c.get('hash') == hg and c.get('fixedLines') and c.get('reader') == model and len(c['lines']) == len(base['lines']):
            print('annotate: reused', out); return
    k = 'local' if D.is_local(model) else (D.key() or ('offline' if os.environ.get('CF_ANSWERS') else None))
    if not k and '--dry' not in sys.argv: print('no ANTHROPIC_API_KEY — this reader is skipped'); sys.exit(2)
    B = [dict(b, i=i) for i, b in enumerate(base['lines'])]
    ids = [t['id'] for t in G['body']] + ['shadow']
    CH = int(os.environ.get('CF_ACHUNK', '8')); got = {}; uses = []

    def ask(part):
        ps = sorted({l['post'] for l in part}); posts = [dict(items[n], n=n) for n in ps]
        s_, u_ = annotate_prompt(meta, posts, part, G)
        if '--dry' in sys.argv:
            open(os.path.join(P.OUTD, pid + '.annotate.prompt.txt'), 'w').write(s_ + '\n\n' + u_); print('dry: the question was written (first chunk)'); sys.exit(0)
        ans, use = D.call(s_, u_, k, model); uses.append(use); want = {l['i'] for l in part}; n = 0
        for x in ans.get('lines', []) if isinstance(ans, dict) else []:
            try: i = int(x.get('i'))
            except Exception: continue
            if i in want and i not in got: got[i] = x; n += 1
        return n

    for c0 in range(0, len(B), CH):
        part = B[c0:c0 + CH]; n = ask(part)
        miss = [l for l in part if l['i'] not in got]
        if miss: n += ask(miss)   # asked once more, for the ones it left out
        print(f"  annotate: lines {part[0]['i']}–{part[-1]['i']} → {n} of {len(part)}")
    lines = []; missing = 0; bad = 0
    for b in B:
        x = got.get(b['i']); l = {'post': b['post'], 'quote': b['quote']}
        if not x:
            l.update(subject=b.get('subject'), about=None, touch=None, measure=None, due=None, z='neither', lit=[], credulity='none', why=None, missing=True); missing += 1
        else:
            for f in ASKED: l[f] = x.get(f)
            inv = []
            if l['about'] not in ('object', 'shadow'): inv.append('about')
            if l['measure'] not in ids: inv.append('measure')
            if l['z'] not in P.ZWORDS: inv.append('z')
            if l['due'] in ('', 'null', 'None'): l['due'] = None
            if not isinstance(l['lit'], list): l['lit'] = [str(l['lit'])] if l['lit'] else []
            l['lit'] = [str(w) for w in l['lit']]
            if l['credulity'] not in ('engaged', 'withdrawn', 'none'): l['credulity'] = 'none'
            if inv: l['invalid'] = inv; bad += 1   # kept as the model gave it; the table shows it as its own answer
        lines.append(l)
    use = {'model': model, 'input_tokens': sum(u.get('input_tokens', 0) for u in uses), 'output_tokens': sum(u.get('output_tokens', 0) for u in uses), 'calls': len(uses)}
    json.dump({'hash': hg, 'at': datetime.datetime.now().isoformat(timespec='seconds'), 'usage': use, 'fixedLines': True, 'reader': model,
               'cutsFrom': os.path.relpath(bp, D.ROOT), 'missing': missing, 'lines': lines}, open(out, 'w'), indent=1, ensure_ascii=False)
    print(f"annotate: {len(lines)} lines ({model}) · left out {missing} · answers outside the choices {bad} → {out}")


# ---- the table ----
ZSTEP = {'realized strongly': 3, 'realized': 2, 'leaning realized': 1, 'neither': 0, 'leaning frustrated': -1, 'frustrated': -2, 'frustrated strongly': -3}
def zword(l): return None if l.get('about') == 'shadow' else l.get('zWord')
def zside(l):
    if l.get('about') == 'shadow': return None
    v = ZSTEP.get(l.get('zWord'), 0); return 'realized' if v > 0 else 'frustrated' if v < 0 else 'neither'
FIELDS = [('object or shadow', lambda l: l.get('about')), ('measure', lambda l: l.get('measure')), ('z word', zword), ('z side', zside),
          ('is a forecast', lambda l: bool(l.get('due'))), ('forecast call', lambda l: (l.get('forecast') or {}).get('result')),
          ('tier', lambda l: l.get('tier')), ('others', lambda l: (l.get('relational') or {}).get('others')), ('verdict', lambda l: (l.get('relational') or {}).get('verdict')), ('reason', lambda l: (l.get('relational') or {}).get('reason')), ('teaser', lambda l: l.get('kind') == 'teaser')]
SHORT = {'realized strongly': 'R++', 'realized': 'R+', 'leaning realized': 'r', 'neither': '0', 'leaning frustrated': 'f', 'frustrated': 'F-', 'frustrated strongly': 'F--'}


def table(pid):
    reads = {}
    for r in READERS:
        p = os.path.join(PG, 'reads', 'grid_' + r, pid + '.json')
        if os.path.exists(p): reads[r] = json.load(open(p))
    cut = json.load(open(os.path.join(BASE, pid + '.json')))
    if 'sonnet' not in reads: reads = dict({'sonnet (its own cut)': cut}, **reads)   # no fixed-line Sonnet read: its own 11-14 read stands in
    names = list(reads)
    tracked = {}
    for r in TRACKED:
        p = os.path.join(PG, 'reads', 'grid_' + r, pid + '.json')
        if os.path.exists(p): tracked[r] = json.load(open(p))
    if len(names) < 2: print(f'{pid}: fewer than two readers so far — nothing to set side by side'); return None
    n = len(cut['lines'])
    for r, d in {**reads, **tracked}.items():
        if len(d['lines']) != n or any(a['quote'] != b['quote'] for a, b in zip(d['lines'], cut['lines'])):
            raise SystemExit(f'{pid}: {r} is not reading the base lines ({len(d["lines"])} lines against {n}) — its folder holds an older read')
    combos = list(itertools.combinations(names, 2))
    rows = []; allagree = {f: 0 for f, _ in FIELDS}; pairs = {f: {c: 0 for c in combos} for f, _ in FIELDS}; within5 = 0; spreads = []; pd = {}
    for i in range(n):
        L = {r: reads[r]['lines'][i] for r in names}; row = {'i': i, 'who': cut['lines'][i]['who'], 'date': cut['lines'][i]['date'], 'quote': cut['lines'][i]['quote'], 'by': {}, 'differs': []}
        for f, get in FIELDS:
            vals = {r: get(L[r]) for r in names}
            for r in names: row['by'].setdefault(r, {})[f] = vals[r]
            if len(set(map(str, vals.values()))) == 1: allagree[f] += 1
            else: row['differs'].append(f)
            for a, b in combos: pairs[f][(a, b)] += vals[a] == vals[b]
        dias = {r: L[r].get('dia') for r in names}
        for r in names: row['by'][r]['Dia'] = dias[r]; row['by'][r]['missing'] = bool(L[r].get('missing'))
        have = [v for v in dias.values() if v is not None]
        row['diaSpread'] = (max(have) - min(have)) if len(have) > 1 else None
        if row['diaSpread'] is not None:
            spreads.append(row['diaSpread']); within5 += row['diaSpread'] <= 5
            if row['diaSpread'] > 5: row['differs'].append('Dia')
        for a, b in combos:
            if dias[a] is not None and dias[b] is not None: pd.setdefault((a, b), []).append(abs(dias[a] - dias[b]))
        for r in tracked:   # shown in the row, left out of every count above
            l = tracked[r]['lines'][i]; row['by'][r] = dict({f: get(l) for f, get in FIELDS}, Dia=l.get('dia'), missing=bool(l.get('missing')))
        rows.append(row)
    pct = lambda x, m=n: f'{round(100 * x / m)}%' if m else '—'
    M = [f'# The grid — {cut.get("title", pid)}', f'*{datetime.datetime.now().isoformat(timespec="minutes")} · {n} lines, cut by Sonnet on 11-14 (run 2) and given to every reader as they are · readers: {", ".join(names)}{(" · tracked, not counted: " + ", ".join(tracked)) if tracked else ""}*', '',
         'Every reader answered the same questions about the same lines. This counts where they agree; it scores nothing.', '',
         '## Which questions hold', '', 'A question every reader answers the same way is tight. One that scatters is loose.', '',
         '| question | all readers agree | ' + ' | '.join(f'{a} · {b}' for a, b in combos) + ' |', '|---|---|' + '---|' * len(combos)]
    for f, _ in FIELDS:
        M.append(f'| {f} | **{pct(allagree[f])}** | ' + ' | '.join(pct(pairs[f][c]) for c in combos) + ' |')
    M.append(f'| Dia within 5 points | **{pct(within5, len(spreads))}** | ' + ' | '.join((pct(sum(g <= 5 for g in pd[c]), len(pd[c])) if pd.get(c) else '—') for c in combos) + ' |')
    M += ['', f'Dia: the middle spread across readers is {statistics.median(spreads) if spreads else "—"} points; the widest is {max(spreads) if spreads else "—"}.', '']
    lost = {r: sum(1 for i in range(n) if reads[r]['lines'][i].get('missing')) for r in names}
    if any(lost.values()): M += ['Lines a reader left unanswered (shown as ·): ' + ', '.join(f'{r} {v}' for r, v in lost.items() if v), '']
    # how steady each reader is against itself: the spread of its own runs of the same line
    def own(d): return [max(l['runs']) - min(l['runs']) for l in d['lines'] if l.get('runs')]
    split_t = {r['i'] for r in rows if 'tier' in r['differs']}
    M += ['## How steady each reader is', '', 'The relational test is asked several times. This is how far a reader\'s own answers to the same line spread, in Dia points (the middle line).', '',
          '| reader | its own spread | on lines where the counted readers agree on tier | on lines where they split |', '|---|---|---|---|']
    steady = {}
    for r, d in {**reads, **tracked}.items():
        o = own(d); a = [max(l['runs']) - min(l['runs']) for i, l in enumerate(d['lines']) if l.get('runs') and i not in split_t]; b = [max(l['runs']) - min(l['runs']) for i, l in enumerate(d['lines']) if l.get('runs') and i in split_t]
        md = lambda x: statistics.median(x) if x else '—'; steady[r] = md(o)
        M.append(f"| {r}{' (tracked)' if r in tracked else ''} | **{md(o)}** | {md(a)} | {md(b)} |")
    M.append('')
    if tracked:
        M += ['## Tracked, not counted', '', 'Read on the same lines and shown in every row below, but left out of the counts above. The share of lines on which it gives the answer most of the counted readers gave:', '',
              '| question | ' + ' | '.join(tracked) + ' |', '|---|' + '---|' * len(tracked)]
        for f, _ in FIELDS:
            cells = []
            for r in tracked:
                hit = tot = 0
                for row in rows:
                    v = [str(row['by'][nm][f]) for nm in names]; top = max(set(v), key=v.count)
                    if v.count(top) * 2 > len(v): tot += 1; hit += str(row['by'][r][f]) == top
                cells.append(pct(hit, tot) if tot else '—')
            M.append(f'| {f} | ' + ' | '.join(cells) + ' |')
        M.append('')
    hard = sorted([r for r in rows if r['differs']], key=lambda r: (-len(r['differs']), r['i']))
    M += ['## The lines the readers split on, most split first', '', f'{len(hard)} of {n} lines differ somewhere. {n - len(hard)} are read the same way by every reader.', '']
    def cell(b):
        if b.get('missing'): return '·'
        z = '—' if b['z word'] is None else SHORT.get(b['z word'], str(b['z word']))
        fc = (' · due' + (f" ({b['forecast call']})" if b['forecast call'] else '')) if b['is a forecast'] else ''
        return f"{b['object or shadow'] or '?'} · {b['measure'] or '?'} · {z} · {b['tier'] or '?'} {b['Dia'] if b['Dia'] is not None else '?'}{fc}"
    for r in hard:
        M += [f"**{r['i']}** · {r['who']} · {r['date']} · “{r['quote']}”", '', f"differs on: {', '.join(r['differs'])}" + (f" (Dia spread {r['diaSpread']})" if r['diaSpread'] is not None else ''), ''] + [f'- {nm}: {cell(r["by"][nm])}' for nm in names] + [f'- ({nm}, tracked: {cell(r["by"][nm])})' for nm in tracked] + ['']
    M += ['## Every line', '', 'Each cell: object or shadow · measure · z · tier and Dia · due if it forecasts. z is written R++ R+ r 0 f F- F-- (realized strongly down to frustrated strongly); — on a shadow line.', '',
          '| # | quote | ' + ' | '.join(names) + ''.join(f' | ({t})' for t in tracked) + ' | differs on |', '|---|---|' + '---|' * (len(names) + len(tracked)) + '---|']
    for r in rows:
        M.append(f"| {r['i']} | {r['quote'][:70].replace('|', '/')} | " + ' | '.join(cell(r['by'][nm]) for nm in list(names) + list(tracked)) + f" | {', '.join(r['differs']) or 'nothing'} |")
    os.makedirs(GRID, exist_ok=True)
    open(os.path.join(GRID, pid + '_grid.md'), 'w').write('\n'.join(M) + '\n')
    S = {'id': pid, 'title': cut.get('title'), 'lines': n, 'readers': names, 'allAgree': {f: round(100 * allagree[f] / n) for f, _ in FIELDS},
         'diaWithin5': round(100 * within5 / len(spreads)) if spreads else None, 'split': len(hard), 'tracked': list(tracked), 'ownSpread': steady, 'rows': rows}
    json.dump(S, open(os.path.join(GRID, pid + '_grid.json'), 'w'), indent=1, ensure_ascii=False)
    print(f'{pid}: {len(names)} readers · {n} lines · {len(hard)} split → {os.path.join(GRID, pid + "_grid.md")}')
    return S


def main():
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    if a and a[0] == 'annotate' and len(a) == 3: return annotate(a[1], a[2])
    if a and a[0] == 'table' and len(a) >= 2:
        SS = [s for s in (table(p) for p in a[1:]) if s]
        if SS:
            qs = [f for f, _ in FIELDS]
            R = ['# The grid — what holds across readers', f'*{datetime.datetime.now().isoformat(timespec="minutes")}*', '',
                 'The share of lines on which every reader gave the same answer.', '', '| question | ' + ' | '.join(f"{s['id']} ({len(s['readers'])} readers, {s['lines']} lines)" for s in SS) + ' |', '|---|' + '---|' * len(SS)]
            R += [f'| {q} | ' + ' | '.join(f"{s['allAgree'][q]}%" for s in SS) + ' |' for q in qs]
            R += ['| Dia within 5 points | ' + ' | '.join((f"{s['diaWithin5']}%" if s['diaWithin5'] is not None else '—') for s in SS) + ' |', '',
                  'Readers: ' + ' · '.join(f"{s['id']}: {', '.join(s['readers'])}" for s in SS), '',
                  'How steady each reader is against itself (Dia points between its own runs of a line; tracked readers included): ' + ' · '.join(f"{s['id']}: " + ', '.join(f"{k} {v}" for k, v in s['ownSpread'].items()) for s in SS), '', 'The full grids, line by line: ' + ', '.join(f"`{s['id']}_grid.md`" for s in SS)]
            open(os.path.join(GRID, 'summary.md'), 'w').write('\n'.join(R) + '\n')
            # 11-15: one line per run is kept, so the readers can be watched over time (which question version, what held, how steady each was)
            km = re.search(r"hg = h \+ '-(g\d+)'", open(os.path.join(HERE, 'parallelogram.py')).read())
            if '--final' in sys.argv:
              with open(os.path.join(GRID, 'history.jsonl'), 'a') as hf:
                  hf.write(json.dumps({'at': datetime.datetime.now().isoformat(timespec='minutes'), 'question': km.group(1) if km else None,
                                       'sets': [{k: s_[k] for k in ('id', 'lines', 'readers', 'tracked', 'allAgree', 'diaWithin5', 'split', 'ownSpread')} for s_ in SS]}, ensure_ascii=False) + '\n')
        return
    print(__doc__); sys.exit(1)


if __name__ == '__main__':
    main()
