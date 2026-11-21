#!/usr/bin/env python3
"""chinavision-pull — one pull for China Vision, run on Sailor's Mac (11-17).

Reads the public hot lists of Chinese platforms, translates each line with a model on this Mac (Qwen by default),
and writes Prism/data/chinavision/feed_<date>_<time>.json, then lists it in data/chinavision/index.json.
China Vision (press/chinavision.html) shows the newest pull. Nothing is scored: it is only a feed.

  python3 Prism/scripts/chinavision-pull.py              # every board, top 12 of each, translated by local:qwen
  CV_TOP=20 CV_MODEL=local:gemma python3 ...             # more lines, another model
  CV_MODEL=none python3 ...                              # no translation (the Chinese only), to test the boards

NOT YET RUN (written 11-17 from a session that cannot reach these sites). A board that fails is skipped and named.
"""
import datetime as dt, json, os, re, sys, urllib.request, urllib.parse
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'data', 'chinavision'); os.makedirs(OUT, exist_ok=True)
TOP = int(os.environ.get('CV_TOP', '12')); MODEL = os.environ.get('CV_MODEL', 'local:qwen')
UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', 'Accept': 'application/json, text/plain, */*', 'Accept-Language': 'zh-CN,zh;q=0.9'}

def get(url, referer=None):
    h = dict(UA);  h.update({'Referer': referer} if referer else {})
    with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=20) as r: return json.loads(r.read().decode('utf-8', 'replace'))
def wan(n):
    try: n = float(n)
    except Exception: return str(n or '')
    return f'{n / 10000:.1f}万' if n >= 10000 else str(int(n))

def weibo():
    j = get('https://weibo.com/ajax/side/hotSearch', 'https://weibo.com/')
    return [(x.get('word') or x.get('note'), wan(x.get('num') or x.get('raw_hot'))) for x in j['data']['realtime'] if x.get('word') and not x.get('is_ad')]
def baidu():
    j = get('https://top.baidu.com/api/board?platform=wise&tab=realtime', 'https://top.baidu.com/board')
    return [(x.get('word') or x.get('query'), wan(x.get('hotScore')), (x.get('desc') or '').strip()) for x in j['data']['cards'][0]['content'] if x.get('word') or x.get('query')]   # desc: Baidu's own one-line account of the story
def toutiao():
    j = get('https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc', 'https://www.toutiao.com/')
    return [(x.get('Title'), wan(x.get('HotValue'))) for x in j['data'] if x.get('Title')]
def zhihu():
    j = get('https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=30', 'https://www.zhihu.com/hot')
    return [(x['target']['title'], re.sub(r'\s*热度$', '', x.get('detail_text', ''))) for x in j['data'] if x.get('target', {}).get('title')]
def bilibili():
    j = get('https://api.bilibili.com/x/web-interface/wbi/search/square?limit=30', 'https://www.bilibili.com/')
    return [(x.get('show_name') or x.get('keyword'), wan(x.get('heat_score'))) for x in j['data']['trending']['list'] if x.get('keyword')]
def douyin():
    j = get('https://www.douyin.com/aweme/v1/web/hot/search/list/?device_platform=webapp&aid=6383&channel=channel_pc_web', 'https://www.douyin.com/hot')
    return [(x.get('word'), wan(x.get('hot_value'))) for x in j['data']['word_list'] if x.get('word')]

BOARDS = [
 ('weibo', 'Weibo', '微博热搜', 'what people are posting about', 'https://www.baidu.com/s?wd=', weibo),
 ('baidu', 'Baidu', '百度热搜', 'what people are searching for', 'https://www.baidu.com/s?wd=', baidu),
 ('douyin', 'Douyin', '抖音热榜', "what people are watching (China's TikTok)", 'https://www.baidu.com/s?wd=', douyin),
 ('zhihu', 'Zhihu', '知乎热榜', 'what people are asking (a Q&A site)', 'https://www.baidu.com/s?wd=', zhihu),
 ('toutiao', 'Toutiao', '今日头条', "the biggest news app's top stories", 'https://www.baidu.com/s?wd=', toutiao),
 ('bilibili', 'Bilibili', 'B站热搜', 'video site with a young audience', 'https://www.baidu.com/s?wd=', bilibili),
]
KINDS = {'world': 'World and state', 'america': 'About America', 'money': 'Money and business', 'tech': 'Tech and AI', 'life': 'Daily life', 'pop': 'Pop culture', 'games': 'Games', 'sport': 'Sport'}

def translate(items):
    if MODEL == 'none':
        for it in items: it['en'] = it['zh']; it['kind'] = 'life'
        return 'not translated (CV_MODEL=none)'
    sys.path.insert(0, os.path.join(HERE, 'closedform')); import derive as D
    k = 'local' if D.is_local(MODEL) else D.key()
    sys_ = ('You translate Chinese trending headlines into plain English for a reader who does not know China. Translate what the line says; '
            'do not add opinion. Where a name or term would be unknown, add a few words in brackets saying what it is. Reply with JSON only.')
    for c0 in range(0, len(items), 12):
        part = items[c0:c0 + 12]
        user = ('For each line return {"i": its number, "en": the translation of zh, "kind": one of ' + '|'.join(KINDS) + ', "note": only when the line has a desc: one or two plain English sentences saying what the desc says, in your own words, adding nothing; otherwise ""}.\n'
                'kinds: ' + '; '.join(f'{a} = {b}' for a, b in KINDS.items()) + '. america = any line about the United States or an American.\n'
                'LINES:\n' + json.dumps([dict({'i': c0 + n, 'board': it['board'], 'zh': it['zh']}, **({'desc': it['desc'][:400]} if it.get('desc') else {})) for n, it in enumerate(part)], ensure_ascii=False, indent=1) +
                '\nAnswer: {"lines": [ ... ]} with one entry for every line, valid JSON only.')
        try: ans, _use = D.call(sys_, user, k, MODEL)
        except Exception as e: print(f'  translation of lines {c0}–{c0 + len(part) - 1} failed: {e}'); ans = {}
        got = {int(x['i']): x for x in (ans or {}).get('lines', []) if str(x.get('i', '')).lstrip('-').isdigit()}
        for n, it in enumerate(part):
            g = got.get(c0 + n) or {}
            it['en'] = (g.get('en') or '').strip() or it['zh']; it['kind'] = g.get('kind') if g.get('kind') in KINDS else 'life'
            if it.get('desc') and (g.get('note') or '').strip(): it['note'] = g['note'].strip()
        print(f'  translated lines {c0}–{c0 + len(part) - 1}')
    return f'{MODEL}, on this Mac'

def main():
    items, boards, failed = [], {}, []
    for bid, name, zh, about, link, fn in BOARDS:
        try: rows = [(r[0].strip(), r[1], (r[2] if len(r) > 2 else '')) for r in fn() if r[0] and r[0].strip()][:TOP]
        except Exception as e: failed.append(f'{name}: {type(e).__name__} {e}'); print(f'✗ {name}: {e}'); continue
        if not rows: failed.append(f'{name}: empty'); continue
        boards[bid] = {'name': name, 'zh': zh, 'about': about}
        items += [dict({'board': bid, 'rank': n + 1, 'zh': t, 'heat': h, 'link': link + urllib.parse.quote(t), 'linkLabel': 'search Baidu'}, **({'desc': d} if d else {})) for n, (t, h, d) in enumerate(rows)]
        print(f'✓ {name}: {len(rows)} lines')
    if not items: sys.exit('no board could be read — nothing written')
    by = translate(items)
    bj = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))); here = dt.datetime.now()
    fid = 'feed_' + bj.strftime('%Y-%m-%d_%H%M')
    feed = {'schema': 'chinavision/feed/v0', 'id': fid, 'takenBeijing': bj.strftime('%Y-%m-%d %H:%M'), 'takenPacific': here.strftime('%Y-%m-%d %H:%M'),
            'what': '望 (wàng): what is trending in Chinese media right now, translated. A feed to explore. Nothing here is scored or read by Prism.',
            'source': "Each platform's own public hot list, read directly by chinavision-pull.py." + (' Not read this time: ' + '; '.join(failed) + '.' if failed else ''),
            'translatedBy': by, 'boards': boards, 'kinds': KINDS, 'items': items}
    json.dump(feed, open(os.path.join(OUT, fid + '.json'), 'w'), indent=1, ensure_ascii=False)
    ip = os.path.join(OUT, 'index.json'); ix = json.load(open(ip)) if os.path.exists(ip) else {'feeds': []}
    ix['feeds'] = [{'file': fid + '.json', 'takenBeijing': feed['takenBeijing'], 'items': len(items)}] + [f for f in ix.get('feeds', []) if f['file'] != fid + '.json']
    ix['latest'] = fid + '.json'; json.dump(ix, open(ip, 'w'), indent=1, ensure_ascii=False)
    print(f'filed {fid}.json — {len(items)} lines from {len(boards)} boards' + (f' · not read: {len(failed)}' if failed else ''))

if __name__ == '__main__': main()
