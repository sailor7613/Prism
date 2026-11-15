#!/usr/bin/env python3
"""folder_index.py — lets a chat read the PARALLELOGRAM PRISM folder (2026-11-13).

Chat (press/chat.html, through serve-range.py's /local/talk) asks this for the passages in the project folder that bear
on what was just said. Nothing here calls a model and nothing leaves the Mac: it is a word search, done in memory.

  what is read    every .md and .txt file under Handoffs, Specs, Parameters, Shared, Transcripts, Archive, Claude outputs, ENIGMA (the text of its PDFs),
                  the reports in Prism/data/parallelograms, the ruled rows in Prism/data/closedform/rulings.json, and the
                  README and CHARTER at the top. Not code, not data, not media.
  how             each file is cut into passages of about 1,400 characters at paragraph breaks. A question is matched to
                  passages by its words (BM25: rare words count more, long passages are not favoured). Newer files and
                  the working folders (Handoffs, Specs, Parameters) are leaned toward; Archive and Transcripts away from.
  kept current    before every chat the folder is looked over again; a file that changed, came or went is re-read.
                  That look takes a fraction of a second.

  python3 scripts/folder_index.py "what is the window rule"     # try it: prints the passages a chat would be given"""
import os, re, math, json, time, sys

HERE = os.path.dirname(os.path.abspath(__file__)); WS = os.path.dirname(os.path.dirname(HERE))
ROOTS = ['Handoffs', 'Specs', 'Parameters', 'Shared', 'Transcripts', 'Archive', 'Claude outputs', os.path.join('Prism', 'data', 'parallelograms'),
         'ENIGMA']   # 11-14: Sailor's folder on Bob Simmons and the planing hull. It is PDFs; their words are kept beside them in ENIGMA/_text/*.txt, which is what is read
TOP = ['README.md', 'CHARTER.md', os.path.join('Prism', 'README.md'), os.path.join('Prism', 'data', 'closedform', 'rulings.json')]
SKIP = ('a_reading_by_', os.path.join('data', 'chat') + os.sep, 'node_modules', '_to_delete', '_session_tmp', os.sep + 'in' + os.sep, os.sep + 'reads' + os.sep, '_before_', '.prompt.txt', os.sep + '.')
LEAN = {'ENIGMA': 1.15, 'Handoffs': 1.25, 'Specs': 1.2, 'Parameters': 1.15, 'Shared': 1.1, 'Archive': 0.6, 'Transcripts': 0.5}   # 11-14: transcripts are other people's talk; a chatty question matched them on small words
STOP = set('the a an and or of to in on at for with by is are was were be been it its this that these those as from not but if then so than which who what when where how why i you he she we they his her our their my your me do does did have has had will would can could should about into over under more most some any all no one two'.split())
WORD = re.compile(r"[a-z0-9][a-z0-9'’\-]*[a-z0-9]|[a-z0-9]")

def words(t): return [w for w in WORD.findall(t.lower()) if w not in STOP]

def cut(text, size=1400):
    """Passages of about `size` characters, broken at blank lines; a heading stays with what follows it."""
    paras = [p.strip() for p in re.split(r'\n\s*\n', text) if p.strip()]; out = []; cur = ''
    for p in paras:
        while len(p) > size * 1.6:   # one very long paragraph (a pasted transcript): cut it at sentence ends
            k = p.rfind('. ', 0, size); k = k + 1 if k > size * 0.4 else size
            if cur: out.append(cur); cur = ''
            out.append(p[:k].strip()); p = p[k:].strip()
        if cur and len(cur) + len(p) > size and not cur.lstrip().startswith('#') or (cur and len(cur) > size): out.append(cur); cur = p
        else: cur = (cur + '\n\n' + p) if cur else p
    if cur: out.append(cur)
    return out

class Folder:
    def __init__(self, ws=WS): self.ws = ws; self.files = {}; self.df = {}; self.n = 0; self.total = 0
    def listing(self):
        got = {}
        for r in ROOTS:
            for d, _dn, fn in os.walk(os.path.join(self.ws, r)):
                for f in fn:
                    p = os.path.join(d, f)
                    if not f.lower().endswith(('.md', '.txt')) or any(s in p for s in SKIP): continue
                    try: st = os.stat(p)
                    except OSError: continue
                    if st.st_size < 3_000_000: got[os.path.relpath(p, self.ws)] = st.st_mtime
        for t in TOP:
            p = os.path.join(self.ws, t)
            if os.path.exists(p): got[t] = os.stat(p).st_mtime
        return got
    def read(self, rel):
        try: text = open(os.path.join(self.ws, rel), encoding='utf-8', errors='replace').read()
        except OSError: return []
        if rel.endswith('rulings.json'):
            try: text = '\n\n'.join(json.dumps(x, ensure_ascii=False, indent=1) for k, v in json.load(open(os.path.join(self.ws, rel))).items() if isinstance(v, list) for x in v)
            except Exception: pass
        title = (re.search(r'^#\s+(.+)$', text, re.M) or [None, ''])[1]
        ch = []
        for c in cut(text):
            tf = {}
            for w in words(c + ' ' + os.path.basename(rel).replace('_', ' ') + ' ' + title): tf[w] = tf.get(w, 0) + 1
            ch.append((c, tf, sum(tf.values())))
        return ch
    def refresh(self):
        """Look the folder over; re-read what changed. Returns how many files were re-read."""
        now = self.listing(); changed = 0
        for rel in [r for r in self.files if r not in now]: self._drop(rel)
        for rel, mt in now.items():
            if rel in self.files and self.files[rel]['mt'] == mt: continue
            if rel in self.files: self._drop(rel)
            ch = self.read(rel); self.files[rel] = {'mt': mt, 'ch': ch}; changed += 1
            for _c, tf, ln in ch:
                self.n += 1; self.total += ln
                for w in tf: self.df[w] = self.df.get(w, 0) + 1
        return changed
    def _drop(self, rel):
        for _c, tf, ln in self.files.pop(rel)['ch']:
            self.n -= 1; self.total -= ln
            for w in tf:
                self.df[w] -= 1
                if self.df[w] <= 0: del self.df[w]
    def find(self, query, k=6, budget=9000):
        """The passages that best match the query: [{path, date, text, score}], at most k and at most `budget` characters."""
        self.refresh(); q = set(words(query))
        if not q or not self.n: return []
        avg = self.total / self.n; newest = max(f['mt'] for f in self.files.values()); hits = []
        ql = words(query); pairs = [ql[i] + ' ' + ql[i + 1] for i in range(len(ql) - 1)]   # two of the question's words side by side in a passage count for more
        for rel, f in self.files.items():
            top = rel.split(os.sep)[0]; lean = LEAN.get(top, 1.0)
            if 'transcript' in rel.lower() or os.sep + 'sources' + os.sep in rel: lean *= 0.45   # 11-14: other people's talk kept as source material, wherever it is filed
            age = (newest - f['mt']) / 86400.0; lean *= 1.0 + 0.35 * math.exp(-age / 30.0)   # the last month or so counts for more
            for i, (c, tf, ln) in enumerate(f['ch']):
                s = 0.0
                for w in q:
                    n = tf.get(w)
                    if n: s += math.log(1 + (self.n - self.df[w] + 0.5) / (self.df[w] + 0.5)) * n * 2.5 / (n + 1.5 * (0.25 + 0.75 * ln / avg))
                if s > 0:
                    if pairs:
                        low = c.lower(); s *= 1.0 + 0.3 * sum(1 for pr in pairs if pr in low)
                    hits.append((s * lean, rel, i))
        hits.sort(reverse=True); out = []; used = 0; per = {}
        for s, rel, i in hits:
            if per.get(rel, 0) >= 2: continue   # no more than two passages from one file, so one long file cannot crowd the rest out
            c = self.files[rel]['ch'][i][0]
            if used + len(c) > budget and out: continue
            per[rel] = per.get(rel, 0) + 1; used += len(c)
            out.append({'path': rel, 'date': time.strftime('%Y-%m-%d', time.localtime(self.files[rel]['mt'])), 'text': c, 'score': round(s, 2)})
            if len(out) >= k: break
        return out
    def whole(self, message, budget=138000, big=120000):
        """When a message asks to read a folder by name ("Read the Enigma folder"), the folder's own documents, whole.
        Returns (root, [{path, text, cut}]) or None. Only for a folder small enough to hand over (40 files or fewer);
        smallest files first; a file larger than `big` characters gives its opening only, and says so. Notes ABOUT the
        folder kept elsewhere (handoffs) are left out on purpose, so the reading is the reader's own."""
        self.refresh(); low = message.lower().strip()
        if re.match(r"(can|could|are|do|does|did|will|would|is) ", low): return None   # "can you read the X folder?" is a question, not the asking
        if not re.search(r"\b(read|reading|go through|synthesi[sz]e|interpret|summari[sz]e|study|look at|take in)\b", low): return None
        roots = {}
        for rel in self.files: roots.setdefault(rel.split(os.sep)[0], []).append(rel)
        for root, rels in roots.items():
            if os.sep not in rels[0] or len(rels) > 40: continue
            if not re.search(r"\b" + re.escape(root.lower()) + r"\b", low): continue
            docs = []; used = 0
            for rel in sorted(rels, key=lambda r: min(os.path.getsize(os.path.join(self.ws, r)), 9000 if os.path.getsize(os.path.join(self.ws, r)) > big else 10**9)):   # by what will be handed over, smallest first
                try: t = open(os.path.join(self.ws, rel), encoding='utf-8', errors='replace').read()
                except OSError: continue
                t = re.sub(r"\n{3,}", "\n\n", t).strip(); cut = False
                if len(t) > big: t = t[:9000]; cut = True
                if used + len(t) > budget: t = t[:max(0, budget - used)]; cut = True
                if len(t) < 400: continue
                used += len(t); docs.append({'path': rel, 'text': t, 'cut': cut})
            return root, docs
        return None
    def brief(self):
        """What every chat is told, whatever the question: where it is, and the newest handoff's opening."""
        hs = sorted((f['mt'], r) for r, f in self.files.items() if r.startswith('Handoffs' + os.sep) and r.count(os.sep) == 1 and 'Iteration_Log' not in r)
        newest = hs[-1][1] if hs else None; head = ''
        if newest: head = '\n\n'.join(c for c, _t, _l in self.files[newest]['ch'][:2])[:1800]
        return newest, head

if __name__ == '__main__':
    F = Folder(); t0 = time.time(); n = F.refresh(); print(f'{n} files · {F.n} passages · {time.time() - t0:.1f}s to read', file=sys.stderr)
    t0 = time.time(); F.refresh(); print(f'{time.time() - t0:.2f}s to look it over again', file=sys.stderr)
    for h in F.find(' '.join(sys.argv[1:]) or 'the window rule'):
        print(f"\n── {h['path']} · {h['date']} · {h['score']}\n{h['text'][:500]}")
