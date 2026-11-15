#!/usr/bin/env python3
"""local_worker.py — holds a local model in memory and answers requests, one JSON line in, JSON lines out (2026-11-13).

The closed form (derive.py) and the workspace server (serve-range.py) each start one of these when a local model is
asked for. It runs under the Python that has mlx-lm installed (~/.prism-local/venv, made by "Install the Local Models.command"),
so the runner itself can stay on any Python.

  in   {"model": "gemma" | "qwen" | "deepseek" | "<hugging face repo>", "system": "...", "user": "...",
        "messages": [...] (instead of system+user, for the talk box), "max_tokens": 8000, "stream": false}
  out  {"tok": "..."} per piece when stream is true, then one last line:
       {"text": "...", "think": "...", "repo": "...", "input_tokens": n, "output_tokens": n, "secs": s, "tps": t}
       or {"error": "..."}
Everything a library prints goes to stderr, so stdout carries only these lines.
CF_LOCAL_FAKE=<file>: no model is loaded; the answers come from that JSON list in order (a plumbing test)."""
import sys, os, json, re, time
OUT = sys.stdout; sys.stdout = sys.stderr
HERE = os.path.dirname(os.path.abspath(__file__))
REG = json.load(open(os.path.join(HERE, 'local_models.json')))['models']
LOADED = {}; FAKE = os.environ.get('CF_LOCAL_FAKE'); FAKE_I = [0]


def emit(o): OUT.write(json.dumps(o, ensure_ascii=False) + '\n'); OUT.flush()


THINK = [('<think>', '</think>'), ('<|channel>thought', '<channel|>')]   # how a model marks thinking out loud: DeepSeek and Qwen; Gemma 4
def split_think(t):
    """A reasoning model thinks out loud first. Keep the thinking apart from the answer."""
    think = []
    for o, c in THINK:
        while c in t:   # a closed thought (the opening mark may be missing: some templates open it themselves)
            head, _, rest = t.partition(c); i = head.rfind(o)
            if i >= 0: think.append(head[i + len(o):]); t = head[:i] + rest
            else: think.append(head); t = rest
        if o in t: i = t.rfind(o); think.append(t[i + len(o):]); t = t[:i]   # cut off mid-thought: there is no answer yet
    return t.replace('<turn|>', '').strip(), ' '.join(x.strip() for x in think if x.strip())


def load(name):
    if name in LOADED: return LOADED[name]
    ent = REG.get(name, {}); repos = ent.get('repos') or [name]
    held = sum(e.get('gb', 20) for _m, _t, _r, e in LOADED.values())
    if LOADED and held + ent.get('gb', 20) > 44:   # two fit in 64 GB, three do not: let the others go before loading another
        LOADED.clear(); import gc; gc.collect()
        try:
            import mlx.core as mx; mx.clear_cache()
        except Exception: pass
    from mlx_lm import load as mlx_load
    last = None
    for repo in repos:
        try:
            print(f'  local: loading {repo} …', file=sys.stderr); t0 = time.time()
            model, tok = mlx_load(repo)
            print(f'  local: {repo} ready in {time.time() - t0:.0f}s', file=sys.stderr)
            LOADED[name] = (model, tok, repo, ent); return LOADED[name]
        except Exception as e:
            last = e; print(f'  local: {repo} would not load ({type(e).__name__}: {str(e)[:200]})', file=sys.stderr)
    raise RuntimeError(f'no build of {name} would load: {last}')


def template(tok, messages, ent):
    kw = {}
    if 'think' in ent: kw['enable_thinking'] = bool(ent['think'])
    tries = [(messages, kw), (messages, {})]
    if messages and messages[0]['role'] == 'system':   # a model with no system turn: the system text leads the first user turn
        folded = [dict(messages[1], content=messages[0]['content'] + '\n\n' + messages[1]['content'])] + messages[2:] if len(messages) > 1 else [{'role': 'user', 'content': messages[0]['content']}]
        tries += [(folded, kw), (folded, {})]
    err = None
    for msgs, k in tries:
        try: return tok.apply_chat_template(msgs, add_generation_prompt=True, tokenize=False, **k)
        except Exception as e: err = e
    raise err


def answer(req):
    name = req['model']; msgs = req.get('messages') or [{'role': 'system', 'content': req.get('system', '')}, {'role': 'user', 'content': req.get('user', '')}]
    msgs = [m for m in msgs if m.get('content')]
    if FAKE:
        A = json.load(open(FAKE)); a = A[FAKE_I[0] % len(A)]; FAKE_I[0] += 1
        t = '<think>working it out {not: json}</think>\n' + (a if isinstance(a, str) else json.dumps(a))
        if req.get('stream'):
            for w in t.split(' '): emit({'tok': w + ' '})
        ans, think = split_think(t); return {'text': ans, 'think': think, 'repo': 'fake', 'input_tokens': 0, 'output_tokens': len(t.split()), 'secs': 0, 'tps': 0}
    model, tok, repo, ent = load(name)
    prompt = template(tok, msgs, ent)
    from mlx_lm import stream_generate
    kw = {'max_tokens': int(req.get('max_tokens', 8000))}
    try:
        from mlx_lm.sample_utils import make_sampler
        kw['sampler'] = make_sampler(temp=float(req.get('temp', ent.get('temp', 0.3))))
    except Exception as e: print(f'  local: default sampling ({e})', file=sys.stderr)
    if req.get('repeat'):   # a chat is kept from saying its last answer over again
        try:
            from mlx_lm.sample_utils import make_logits_processors
            kw['logits_processors'] = make_logits_processors(repetition_penalty=float(req['repeat']))
        except Exception as e: print(f'  local: no repetition guard ({e})', file=sys.stderr)
    t0 = time.time(); text = ''; last = None
    for r in stream_generate(model, tok, prompt, **kw):
        piece = getattr(r, 'text', '') or ''; text += piece; last = r
        if req.get('stream') and piece: emit({'tok': piece})
    secs = time.time() - t0; n_out = getattr(last, 'generation_tokens', None) or len(text) // 4
    ans, think = split_think(text)
    return {'text': ans, 'think': think, 'repo': repo, 'input_tokens': getattr(last, 'prompt_tokens', 0) or 0, 'output_tokens': n_out,
            'secs': round(secs, 1), 'tps': round(getattr(last, 'generation_tps', 0) or (n_out / secs if secs else 0), 1)}


for line in sys.stdin:
    line = line.strip()
    if not line: continue
    try: emit(answer(json.loads(line)))
    except Exception as e: emit({'error': f'{type(e).__name__}: {e}'})
