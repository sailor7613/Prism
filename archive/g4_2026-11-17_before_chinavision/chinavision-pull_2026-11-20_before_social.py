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
    rows = []
    def take(xs):   # 11-19: the first probe got 0 rows; the phone layout nests the rows inside groups, so both shapes are read
        for x in xs or []:
            if x.get('word') or x.get('query'): rows.append((x.get('word') or x.get('query'), wan(x.get('hotScore')), (x.get('desc') or '').strip()))
            elif isinstance(x.get('content'), list): take(x['content'])
    for c in j.get('data', {}).get('cards', []): take(c.get('content')); take(c.get('topContent'))
    return rows
def toutiao():
    j = get('https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc', 'https://www.toutiao.com/')
    return [(x.get('Title'), wan(x.get('HotValue'))) for x in j['data'] if x.get('Title')]
def zhihu():
    # 11-19: the list's data address asks for a login (401), and that is respected. Zhihu's public billboard page, the one it
    # shows to visitors who are not logged in, carries the same list; that page is read. If it gives nothing, Zhihu is left out.
    h = page('https://www.zhihu.com/billboard', 'https://www.zhihu.com/')
    m_ = re.search(r'"hotList":(\[.*?\]),"guestFeeds"', h, re.S) or re.search(r'"hotList":(\[.*?\])\}', h, re.S)
    L = json.loads(m_.group(1)) if m_ else []
    return [(x['target']['titleArea']['text'], x['target'].get('metricsArea', {}).get('text', '').replace(' 热度', '')) for x in L if x.get('target', {}).get('titleArea', {}).get('text')]
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
NAMES = [('俄', r'Russia|Putin|Kremlin|Moscow'), ('普京', r'Putin'), ('特朗普', r'Trump'), ('习近平', r'Xi\b'), ('习主席', r'Xi\b'), ('马斯克', r'Musk'), ('日本', r'Japan'), ('韩国', r'Korea'), ('印度', r'India'), ('伊朗', r'Iran'), ('乌克兰', r'Ukrain'), ('台湾', r'Taiwan'), ('英伟达', r'Nvidia'), ('黄仁勋', r'Huang')]
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
    # 11-19: '中俄美元首会晤' came back as a meeting of the Chinese and US presidents: Russia was dropped. A short list of names that
    # must survive translation; a line that loses one is translated again alone, and marked if it still fails.
    for n, it in enumerate(items):
        miss = [e for z, e in NAMES if z in it['zh'] and not re.search(e, it.get('en', ''), re.I)]
        if not miss: continue
        try:
            ans, _u = D.call(sys_, 'Translate this one trending headline into plain English. Every country and person named in it must be named in the English.\nLINE: ' + it['zh'] + '\nAnswer: {"en": "..."} valid JSON only.', k, MODEL)
            en = str((ans or {}).get('en') or '').strip()
            if en and all(re.search(e, en, re.I) for z, e in NAMES if z in it['zh']): it['en'] = en; print(f'  line {n} translated again (a name had been dropped)'); continue
        except (Exception, SystemExit): pass
        it['enCheck'] = 'a name in the Chinese is missing from the English'; print(f'  line {n}: still missing a name — marked')
    return f'{MODEL}, on this Mac'

# ── the extraction (11-18). For the top stories of each board the pull finds what was written and what was said, reads it on
# this Mac, and has the model write the item: an account in its own words, one or two short quotes, how it was received.
#   · the article text is kept whole in data/chinavision/raw/<feed>/ for later analysis. That folder is NOT
#     committed (.gitignore) and nothing in it is shown. Only the account, the short quotes and the links go into the feed.
#   · a quote is kept only if it is found, character for character, in the text it is said to come from, and is short.
# CV_STORIES = how many items per board get this (default 4; 0 = none).
STORIES = int(os.environ.get('CV_STORIES', '6')); QMAX = 28   # the longest quote kept, in characters
OUTLETS = {'thepaper.cn': 'The Paper', 'sina.com.cn': 'Sina', 'sina.cn': 'Sina', '163.com': 'NetEase', 'qq.com': 'Tencent News', 'sohu.com': 'Sohu', 'ifeng.com': 'Phoenix',
           'news.cn': 'Xinhua', 'xinhuanet.com': 'Xinhua', 'people.com.cn': "People's Daily", 'cctv.com': 'CCTV', 'cctv.cn': 'CCTV', 'huxiu.com': 'Huxiu', '36kr.com': '36Kr',
           'yicai.com': 'Yicai', 'caixin.com': 'Caixin', 'guancha.cn': 'Guancha', 'bjnews.com.cn': 'Beijing News', 'chinanews.com.cn': 'China News Service', 'chinanews.com': 'China News Service',
           'thecover.cn': 'The Cover', 'dayoo.com': 'Guangzhou Daily', 'gov.cn': 'gov.cn (the State Council site)', 'baijiahao.baidu.com': 'Baijiahao (hosted by Baidu)', 'ce.cn': 'China Economic Net', 'cnstock.com': 'Shanghai Securities News', 'bjd.com.cn': 'Beijing Daily', 'southcn.com': 'Nanfang Daily', 'nbd.com.cn': 'National Business Daily', 'jiemian.com': 'Jiemian', 'toutiao.com': 'Toutiao', 'gmw.cn': 'Guangming Daily', 'huanqiu.com': 'Global Times', 'cls.cn': 'Cailian Press',
           'tmtpost.com': 'TMTPost', 'ithome.com': 'IT Home', '21jingji.com': '21st Century Business Herald', 'stcn.com': 'Securities Times', 'china.com.cn': 'China.org.cn', 'cnr.cn': 'China National Radio'}
def outlet(url):
    host = urllib.parse.urlparse(url).netloc.lower()
    return next((v for k, v in OUTLETS.items() if host == k or host.endswith('.' + k)), host.replace('www.', '').replace('m.', '', 1))
def page(url, referer=None):
    h = dict(UA, Accept='text/html,application/xhtml+xml,*/*;q=0.8'); h.update({'Referer': referer} if referer else {})
    with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=20) as r:
        b = r.read(); cs = r.headers.get_content_charset()
    for enc in ([cs] if cs else []) + ['utf-8', 'gb18030']:
        try: return b.decode(enc)
        except Exception: pass
    return b.decode('utf-8', 'replace')
def untag(x):
    import html as _h
    return re.sub(r'\s+', ' ', _h.unescape(re.sub(r'<[^>]+>', '', x))).strip()
def article_text(html_):
    """The words of ONE article on a page. 11-19: the first pull took every paragraph on the page, and a page with other stories
    down its side came out as 'a disjointed collection of snippets'. Now the paragraphs are taken in runs (paragraphs that sit
    close together in the page) and the run with the most Chinese in it is the article."""
    html_ = re.sub(r'(?is)<(script|style|noscript|iframe|header|footer|nav|aside)[^>]*>.*?</\1>', ' ', html_)
    runs = [[]]; last = None
    for m_ in re.finditer(r'(?is)<p[^>]*>(.*?)</p>', html_):
        x = untag(m_.group(1))
        if len(x) < 18 or len(re.findall(r'[\u4e00-\u9fff]', x)) < len(x) * .5: continue
        if last is not None and m_.start() - last > 900: runs.append([])   # a gap in the page: another block
        runs[-1].append(x); last = m_.end()
    best = '\n'.join(max(runs, key=lambda r: sum(len(x) for x in r)))
    # 11-19: some outlets do not put the article in <p> (China News Service came out as 378 characters of something else).
    # Second way: every line of text on the page, in runs of neighbouring lines that are mostly Chinese; the longest run. The longer of the two ways is used.
    lines = [untag(x) for x in re.split(r'(?i)<br\s*/?>|</p>|</div>|</li>|</h\d>|</td>|\n', html_)]
    runs2 = [[]]; gap = 0
    for x in lines:
        if len(x) >= 30 and len(re.findall(r'[\u4e00-\u9fff]', x)) >= len(x) * .5: runs2[-1].append(x); gap = 0
        elif runs2[-1]:
            gap += 1 if x else 0
            if gap > 2: runs2.append([]); gap = 0
    alt = '\n'.join(max(runs2, key=lambda r: sum(len(x) for x in r)))
    return (alt if len(alt) > len(best) * 1.5 else best)[:7000]
def page_dates(html_):
    """Every date written on the page (2026-11-19, 2026年11月19日, 2026/11/19), as dates."""
    out = set()
    for y, mo, d in re.findall(r'(20\d\d)[-/年.](\d{1,2})[-/月.](\d{1,2})', html_[:400000]):
        try: out.add(dt.date(int(y), int(mo), int(d)))
        except ValueError: pass
    return out
def fits(term, text, html_, today):
    """Is this page about the trending line, and from now? Two plain tests, no model: enough of the headline's own character pairs
    are in the article, and the page carries a date within three days. (The first pull put a 2019 digest under a Musk headline
    and a story about Britain under 'Trump leaves for home'.) Returns (yes or no, why)."""
    cj = re.findall(r'[\u4e00-\u9fffA-Za-z0-9]', term); pairs = {a + b for a, b in zip(cj, cj[1:])}
    share = sum(1 for x in pairs if x in text) / max(1, len(pairs))
    ds = page_dates(html_); near = any(abs((today - d).days) <= 3 for d in ds)
    if share < .5: return False, f'only {share:.0%} of the headline is in it'
    if ds and not near: return False, f'no date within three days (newest on the page: {max(ds)})'
    if not ds and share < .7: return False, 'no date on the page and a weak match'
    return True, f'{share:.0%} of the headline, dated'
# 11-19: where the articles come from. Three pulls searched Baidu's news page for each headline; it closed the connection on a third
# of the searches and then gave no results at all. A search page is not there to be read by a program, and that was the answer.
# So the stories now come from the outlets' own RSS feeds, which they publish for programs to read. Every feed is read once per
# pull; a headline is matched to a feed item by its own characters and the item's date, then the outlet's page is opened.
FEEDS = [('People\'s Daily', 'http://www.people.com.cn/rss/politics.xml'), ('People\'s Daily', 'http://www.people.com.cn/rss/world.xml'), ('People\'s Daily', 'http://www.people.com.cn/rss/finance.xml'),
         ('China News Service', 'https://www.chinanews.com.cn/rss/scroll-news.xml'), ('China News Service', 'https://www.chinanews.com.cn/rss/world.xml'), ('China News Service', 'https://www.chinanews.com.cn/rss/finance.xml'),
         ('Sina', 'https://rss.sina.com.cn/news/china/focus15.xml'), ('Sina', 'https://rss.sina.com.cn/news/world/focus15.xml'), ('Sina', 'https://rss.sina.com.cn/tech/rollnews.xml'), ('Sina', 'https://rss.sina.com.cn/ent/hot_roll.xml'),
         ('Huxiu', 'https://www.huxiu.com/rss/0.xml'), ('36Kr', 'https://36kr.com/feed'), ('IT Home', 'https://www.ithome.com/rss/'), ('Xinhua', 'http://www.news.cn/rss/politics.xml'), ('Xinhua', 'http://www.news.cn/rss/world.xml'),
         ('Global Times (Chinese)', 'https://www.huanqiu.com/rss'), ('Jiemian', 'https://a.jiemian.com/index.php?m=article&a=rss'), ('Zaobao (Singapore)', 'https://www.zaobao.com.sg/rss/realtime/china')]
_RSS = {}
def rss_items():
    """Every item of every feed, once per pull: {outlet, title, link, text (title + summary), date}. A feed that does not answer is named and skipped."""
    if 'items' in _RSS: return _RSS['items']
    import xml.etree.ElementTree as ET, email.utils, time
    items, rep_ = [], []
    for name, url in FEEDS:
        try:
            x = re.sub(r'^\s*<\?xml[^>]*\?>', '', page(url)); root = ET.fromstring(x.encode('utf-8')); n = 0
            for it in list(root.iter('item')) + [e for e in root.iter() if e.tag.endswith('}entry')]:
                g = lambda t: next((c.text or '' for c in it if c.tag.split('}')[-1] == t and c.text), '')
                link = g('link') or next((c.get('href') for c in it if c.tag.split('}')[-1] == 'link' and c.get('href')), '')
                when = g('pubDate') or g('published') or g('updated') or g('date'); d = None
                try: d = email.utils.parsedate_to_datetime(when).date()
                except Exception:
                    m_ = re.search(r'(20\d\d)-(\d\d)-(\d\d)', when or '')
                    if m_: d = dt.date(*map(int, m_.groups()))
                title = untag(g('title'))
                if title and link.startswith('http'): items.append({'outlet': name, 'title': title, 'link': link.strip(), 'text': title + ' ' + untag(g('description') or g('summary') or g('encoded'))[:6000], 'date': d}); n += 1
            rep_.append(f'✓ {name}: {n} items · {url}')
        except Exception as e: rep_.append(f'✗ {name}: {type(e).__name__} {str(e)[:80]} · {url}')
        time.sleep(1)
    _RSS['items'] = items; _RSS['report'] = rep_; return items
def pairs_of(term):
    cj = re.findall(r'[\u4e00-\u9fffA-Za-z0-9]', term); return {a + b for a, b in zip(cj, cj[1:])}
def find_articles(term):
    """Feed items about a trending line: at least half of the headline's character pairs are in the item's title and summary, and
    the item is dated within three days (or carries no date). Best match first."""
    today = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date(); P_ = pairs_of(term); hits = []
    its = rss_items()
    # 11-19: 'APEC connectivity blueprint' was matched to a story about a Thai delegation, because half its character pairs are
    # the words everyone is using this week (亚太, 经合, 组织). So the pairs are split: common ones (in more than 8% of all feed
    # items) and the headline's own. When a headline has at least two pairs of its own, half of THOSE must be in the item too.
    if 'df' not in _RSS:
        df = {}
        for it in its:
            for x in pairs_of(it['text'][:1500]): df[x] = df.get(x, 0) + 1
        _RSS['df'] = df
    own = {x for x in P_ if _RSS['df'].get(x, 0) <= max(2, len(its) * .08)}
    for it in its:
        if it['date'] and abs((today - it['date']).days) > 3: continue
        sc = sum(1 for x in P_ if x in it['text']) / max(1, len(P_))
        if len(own) >= 2 and sum(1 for x in own if x in it['text']) / len(own) < .5: continue
        if sc >= .5: hits.append((sc, it['link'], it))
    out = []; seen_ = set()
    for sc, u, it in sorted(hits, key=lambda h_: -h_[0]):
        if u not in seen_: seen_.add(u); out.append(it)
    return out[:4]
def model_json(sys_, user):
    sys.path.insert(0, os.path.join(HERE, 'closedform')); import derive as D
    ans, _u = D.call(sys_, user, 'local' if D.is_local(MODEL) else D.key(), MODEL); return ans or {}
def quotes_ok(qs, text):
    """Only quotes that are in the text, exactly, and short. The model's translation is kept beside the Chinese."""
    out = []
    for q in qs or []:
        zh = str((q or {}).get('zh', '')).strip().strip('“”"「」'); en = str((q or {}).get('en', '')).strip().strip('“”"')
        if zh and en and '\n' not in zh and len(zh) <= QMAX and zh in text and len(en.split()) <= 14: out.append({'zh': zh, 'en': en, 'who': str(q.get('who') or '').strip()[:60]})
    return out[:2]
def enrich(items, fid, save=None):
    if MODEL == 'none' or STORIES <= 0: return
    print(f'  the feeds: {len(rss_items())} items from {sum(1 for r in _RSS["report"] if r[0] == "✓")} of {len(FEEDS)} feeds'); [print('   ', r) for r in _RSS['report'] if r[0] != '✓']
    rawd = os.path.join(OUT, 'raw', fid); os.makedirs(rawd, exist_ok=True); seen = {}
    for it in [x for x in items if x['rank'] <= STORIES]:
        key = it['zh']
        if key in seen:   # the same story on another board: written once
            for f_ in ('note', 'words', 'reception', 'sources'):
                if seen[key].get(f_): it[f_] = seen[key][f_]
            continue
        seen[key] = it; raw = {'zh': key, 'board': it['board'], 'articles': []}
        print(f"  {it['board']} {it['rank']}: {key[:30]}")
        try: story(it, key, raw, rawd)
        except (Exception, SystemExit) as e: print(f'    this story was left as a headline: {type(e).__name__} {str(e)[:120]}')   # SystemExit: the model worker gives up that way
        if save: save()

def story(it, key, raw, rawd):
    if True:
        text = ''; src = None
        today = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date()
        for fi in find_articles(key):
            u = fi['link']; body = fi['text'][len(fi['title']):].strip()
            if len(body) >= 400: tx, h_ = body, str(fi['date'] or '') + ' ' + fi['text']   # the feed carries the article itself: no page is opened
            else:
                try: h_ = page(u); tx = article_text(h_); h_ = str(fi['date'] or '') + ' ' + h_
                except Exception as e: print(f'    could not open {u[:60]}: {type(e).__name__}'); continue
            ok, why = fits(key, fi['title'] + ' ' + tx, h_, today)
            raw['articles'].append({'url': u, 'outlet': outlet(u), 'fits': ok, 'why': why, 'text': tx})
            if not ok: print(f'    not used ({outlet(u)}): {why}'); continue
            if len(tx) > len(text): text, src = tx, u
            if len(text) > 1200: break
        if len(text) > 300:
            a = model_json('You read a Chinese news article and report on it in plain English for a reader who does not know China. You add no opinion and nothing that is not in the article. Reply with JSON only.',
                           'HEADLINE (trending): ' + key + '\nOUTLET: ' + outlet(src) + '\nARTICLE:\n' + text[:5000] + '\n\nFirst decide: is this text one article, and is it about the headline? If it is a list of unrelated items, or about something else, return only {"about": false}. Otherwise return {"about": true, "account": three to five plain sentences in your own words: what happened, and how this piece presents it. Do not translate the article and do not copy its sentences. Explain any name or term an American would not know in a few words, '
                           '"quotes": up to two items {"zh": a phrase copied exactly from the article, at most ' + str(QMAX - 4) + ' characters, chosen because its wording matters, "en": its English, at most 12 words, "who": who says it (the person quoted, or the outlet)}, '
                           '"reception": ONLY if the article itself reports how people reacted (readers, users online, other officials or companies): one or two plain sentences saying what it reports; otherwise "", '
                           '"voices": ONLY if the article quotes such reactions: up to two items {"zh": copied exactly, at most ' + str(QMAX - 4) + ' characters, "en": its English, at most 12 words}; otherwise []}. Valid JSON only.')
            if a.get('about') is False: print('    the model says this is not about the headline: left as a headline'); a = {}
            acc = str(a.get('account') or '').strip()
            if acc: it['note'] = acc; it['sources'] = [{'name': outlet(src), 'url': src}]
            w = quotes_ok(a.get('quotes'), text)
            if w: it['words'] = w
            rc = ([{'en': str(a['reception']).strip()}] if str(a.get('reception') or '').strip() else []) + [{'en': '“' + v['en'] + '”', 'zh': v['zh']} for v in quotes_ok(a.get('voices'), text)]
            if rc: it['reception'] = rc   # reception as the article reports it; no comment threads are read (they sit behind logins)
        json.dump(raw, open(os.path.join(rawd, f"{it['board']}_{it['rank']:02d}.json"), 'w'), indent=1, ensure_ascii=False)

def probe():
    """No model. Tries every source once and writes what came back to data/chinavision/_probe/, so the readers can be fitted to the real pages."""
    pd = os.path.join(OUT, '_probe'); os.makedirs(pd, exist_ok=True); R = []; term = None
    for bid, name, zh, about, link, fn in BOARDS:
        try: rows = fn(); R.append(f'✓ board {name}: {len(rows)} rows · first: {rows[0][0] if rows else ""}'); term = term or (rows[0][0] if rows else None)
        except Exception as e: R.append(f'✗ board {name}: {type(e).__name__} {str(e)[:160]}')
    term = term or 'APEC'; R.append(f'— term used for the story tests: {term}')
    its = rss_items(); R += _RSS['report']; R.append(f'— feeds: {len(its)} items in all; dated within 3 days: {sum(1 for i in its if i["date"] and abs((dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date() - i["date"]).days) <= 3)}; with no date: {sum(1 for i in its if not i["date"])}')
    json.dump([dict(i, date=str(i['date'])) for i in its], open(os.path.join(pd, 'rss_items.json'), 'w'), indent=1, ensure_ascii=False)
    terms = []
    for bid, name, zh, about, link, fn in BOARDS:
        try: terms += [(name, r[0]) for r in fn()[:6]]
        except Exception: pass
    hit = 0
    for name, t in terms:
        a = find_articles(t); hit += bool(a); R.append(f'{"✓" if a else "·"} {name}: {t[:24]} → {len(a)} ' + (a[0]['link'][:70] if a else ''))
    R.append(f'— of {len(terms)} top lines, {hit} have at least one feed item')
    for fi in (find_articles(terms[0][1]) if terms else [])[:2]:
        u = fi['link']
        try: h = page(u); open(os.path.join(pd, 'rss_article_' + outlet(u).split()[0] + '.html'), 'w').write(h); tx = article_text(h); R.append(f'  article opened ({outlet(u)}): {len(tx)} chars · fits: {fits(terms[0][1], tx, h, dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date())}')
        except Exception as e: R.append(f'  article: {type(e).__name__} {str(e)[:100]}')
    open(os.path.join(pd, 'report.txt'), 'w').write('\n'.join(R) + '\n'); print('\n'.join(R)); print('\nwritten to data/chinavision/_probe/report.txt — tell Claude.')

def main():
    if len(sys.argv) > 1 and sys.argv[1] == 'probe': return probe()
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
    def save():
        feed = {'schema': 'chinavision/feed/v0', 'id': fid, 'takenBeijing': bj.strftime('%Y-%m-%d %H:%M'), 'takenPacific': here.strftime('%Y-%m-%d %H:%M'),
                'what': '望 (wàng): what is trending in Chinese media right now, translated. A feed to explore. Nothing here is scored or read by Prism.',
                'source': "Each platform's own public hot list, read directly by chinavision-pull.py." + (' Not read this time: ' + '; '.join(failed) + '.' if failed else ''),
                'translatedBy': by, 'notesBy': 'Accounts, quotes and reception are written by ' + by + ' from the news pages it read. Reception is what those pages themselves report; no comment threads are read. Accounts are in its own words; a quote is kept only when it is found exactly in its source and is short. The full texts stay on this Mac (data/chinavision/raw/) and are not shown.',
                'boards': boards, 'kinds': KINDS, 'items': [{k: v for k, v in it.items() if k != 'desc' or not it.get('note')} for it in items]}
        json.dump(feed, open(os.path.join(OUT, fid + '.json'), 'w'), indent=1, ensure_ascii=False)
        ip = os.path.join(OUT, 'index.json'); ix = json.load(open(ip)) if os.path.exists(ip) else {'feeds': []}
        ix['feeds'] = [{'file': fid + '.json', 'takenBeijing': feed['takenBeijing'], 'items': len(items)}] + [f for f in ix.get('feeds', []) if f['file'] != fid + '.json']
        ix['latest'] = fid + '.json'; json.dump(ix, open(ip, 'w'), indent=1, ensure_ascii=False)
    save(); print(f'filed {fid}.json — {len(items)} lines from {len(boards)} boards' + (f' · not read: {len(failed)}' if failed else '') + ' · it can be opened now; the stories are added as they are read')
    print('reading the stories …'); enrich(items, fid, save)
    n = sum(1 for it in items if it.get('note') and it.get('sources')); print(f'done — {n} items carry an account')

if __name__ == '__main__': main()
