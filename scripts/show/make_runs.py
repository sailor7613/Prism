#!/usr/bin/env python3
"""make_runs — one run file per clip, generated from the Press piece + the source's word-level captions.
Scores come only from the piece (data/press/<piece>.json); nothing is re-scored here.
Output: data/show/<ep>/runs/<clip>.json  { clip, piece, in, words:[[w,a,b]], lines:[{i,t_in,t_out,who,name,station,dia,z,touch,quote,caught:[[w,t]]}] }
Times are clip-local seconds (source second − the clip's `in`). Usage: python3 scripts/show/make_runs.py ep01
"""
import json, re, sys, os, html
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))   # Prism/
WS = os.path.dirname(ROOT)
EP = sys.argv[1] if len(sys.argv) > 1 else 'ep01'
# clip → (piece, caption file, clip length s)
CLIPS = {
  'tucker_01_socialism':  ('tcn_2026-04-06_apffel_socialism', 'tucker_ykBp1WhdfLE.en-orig.vtt', 116),
  'badfaith_03_theword':  ('badfaith_2026-10-22_the_word', 'clipsubs_m5Gk-tQ2v-w.en-orig.vtt', 96),
  'badfaith_02_realsocialist': ('badfaith_2026-10-22_the_word', 'clipsubs_m5Gk-tQ2v-w.en-orig.vtt', 57),
  'shapiro_02_pools':     ('shapiro_2026-10-16_roadster', 'clipsubs_uvHVMkXDiNc.en-orig.vtt', 45),
  'shapiro_04_communism': ('shapiro_2026-10-16_roadster', 'clipsubs_uvHVMkXDiNc.en-orig.vtt', 92),
  'shapiro_05_senate':    ('shapiro_2026-10-16_roadster', 'clipsubs_uvHVMkXDiNc.en-orig.vtt', 24),
  'tucker_02_cornelwest': ('fox_2018-07_tucker_cornelwest', 'clipsubs_kuc6C2_Txmw.en-orig.vtt', 115),
  'tucker_03_nothingfree': ('fox_2018-08-30_tucker_nothingfree', 'clipsubs_u8gqHnCB3Qg.en-orig.vtt', 31),
  'gray_01_applepie':     ('trn_2019-09-12_gray_applepie', 'clipsubs_sd6YlIe44o4.en-orig.vtt', 120),
  'msnow_01_morningjoe':  ('msnow_2026-06-29_scarborough_energy', 'clipsubs_rscKKtuWQZk.en.vtt', 92),
}
# sp01 — the Megalopolis special (10-31): its own clips and caption folder; ep01 is unchanged
CLIPS_SP01 = {
  'trump_01_fortune': ('trump_2026-10-24_perry_fortune', 'clipsubs_YxBhgK7GWrc.en-orig.vtt', 117),
  'obama_01_iran':    ('obama_2026-10_georgia_no_relief', 'clipsubs_E1Z0Yhec73U.en-orig.vtt', 114),
  'obama_01_iran_crop': ('obama_2026-10_georgia_no_relief', 'clipsubs_E1Z0Yhec73U.en-orig.vtt', 114),
  'maine_01_iran':    ('maine_2026-10-13_collins_jackson_iran', 'clipsubs_V2YxIgJkrZY.en-orig.vtt', 96),
}
if EP == 'sp01': CLIPS = CLIPS_SP01
CAP_DIR = 'sp01' if EP == 'sp01' else 'ep01'
STOP = set('the a an and or but of to in on at for is it its it\'s that this they them their there what which who with as be are was were have has had not no so if then than just like you your i we our he she his her my me do does did very more most really also about from by'.split())
def ts(s):
    h, m, r = s.split(':'); return int(h) * 3600 + int(m) * 60 + float(r)
def vtt_words(path):
    """YouTube auto-captions: the cue lines with <hh:mm:ss.mmm><c> word</c> tags carry per-word starts."""
    out = []
    txt = open(path, encoding='utf-8').read()
    for blk in txt.split('\n\n'):
        m = re.search(r'(\d\d:\d\d:\d\d\.\d+) --> (\d\d:\d\d:\d\d\.\d+)', blk)
        if not m: continue
        a, b = ts(m.group(1)), ts(m.group(2))
        for line in blk.split('\n'):
            if '<c>' not in line: continue
            line = html.unescape(line).replace('>>', '').replace('&gt;&gt;', '')
            first = re.match(r'\s*([^<]+)<', line)
            items = []
            if first and first.group(1).strip(): items.append((a, first.group(1).strip()))
            for tm, w in re.findall(r'<(\d\d:\d\d:\d\d\.\d+)><c>\s*([^<]*)</c>', line): items.append((ts(tm), w.strip()))
            for k, (t, w) in enumerate(items):
                if not w: continue
                e = items[k + 1][0] if k + 1 < len(items) else b
                out.append([w, round(t, 2), round(e, 2)])
    if not out:   # human captions (no <c> word tags, e.g. MS NOW): spread each cue's words evenly across its span (10-28)
        for blk in txt.split('\n\n'):
            m = re.search(r'(\d\d:\d\d:\d\d\.\d+) --> (\d\d:\d\d:\d\d\.\d+)', blk)
            if not m: continue
            a, b = ts(m.group(1)), ts(m.group(2))
            words = [w for line in blk.split('\n')[1:] if '-->' not in line for w in html.unescape(line).split()]
            if not words: continue
            step = (b - a) / len(words)
            for k, w in enumerate(words): out.append([w, round(a + k * step, 2), round(a + (k + 1) * step, 2)])
    out.sort(key=lambda x: x[1]); dedup = []
    for w in out:
        if dedup and abs(dedup[-1][1] - w[1]) < 0.005 and dedup[-1][0] == w[0]: continue
        dedup.append(w)
    return dedup
norm = lambda w: re.sub(r"[^a-z0-9']", '', w.lower())
def main():
    ep = json.load(open(os.path.join(ROOT, 'data', 'show', EP + '.json')))
    cin = {k: v['in'] for k, v in ep.get('clips', {}).items()}
    cache = {}
    for clip, (pid, cap, length) in CLIPS.items():
        if clip not in cin: print('skip (no clip in episode):', clip); continue
        P = json.load(open(os.path.join(ROOT, 'data', 'press', pid + '.json')))
        names = P.get('names', {})
        if cap not in cache: cache[cap] = vtt_words(os.path.join(WS, 'Transcripts', 'show', CAP_DIR, cap))
        W = [[w, round(a - cin[clip], 2), round(b - cin[clip], 2)] for (w, a, b) in cache[cap] if 0 <= a - cin[clip] <= length]
        lines = []
        for i, l in enumerate(P['lines']):
            t0 = l['t'] - cin[clip]
            if not (-1 <= t0 <= length): continue
            q = [norm(x) for x in re.split(r'\s+', re.sub(r'[“”"…]', ' ', l['quote'])) if norm(x)]
            # where the quote's words fall after t0: the last matched content word ends the line
            win = [w for w in W if t0 - 0.5 <= w[1] <= t0 + 40]
            hits = {}
            for qw in q:
                for w in win:
                    if norm(w[0]) == qw and qw not in hits: hits[qw] = w; break
            ends = [hits[qw][2] for qw in q if qw in hits]
            t_out = max(ends) if ends else t0 + max(2.0, len(q) / 2.6)
            t_out = min(t_out, t0 + 30, length)
            cands = sorted({qw for qw in q if qw not in STOP and len(qw) >= 5 and "'" not in qw and qw in hits}, key=lambda x: (-len(x), x))[:2]
            caught = sorted([[hits[c][0].strip(',.?!'), hits[c][1]] for c in cands], key=lambda x: x[1])
            who = l['who']; nm = re.sub(r'\s*\(.*', '', names.get(who, who))
            lines.append(dict(i=i, t_in=round(max(0, t0), 2), t_out=round(t_out, 2), who=who, name=nm, station=l['station'], dia=l.get('dia'), z=l.get('z'), touch=l.get('touch'), quote=l['quote'], note=l.get('note', ''), caught=caught))
        out = dict(clip=clip, piece=pid, source=P['source'].get('program'), date=P['source'].get('date'), title=P.get('title'), **{'in': cin[clip]}, length=length, words=W, lines=lines)
        fn = os.path.join(ROOT, 'data', 'show', EP, 'runs', clip + '.json')
        json.dump(out, open(fn, 'w'), ensure_ascii=False)
        print(clip, len(W), 'words ·', len(lines), 'lines', [(x['i'], x['t_in'], x['t_out'], x['caught']) for x in lines])
main()
