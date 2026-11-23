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
    return [(x.get('Title'), wan(x.get('HotValue')), '', x.get('Url') or '') for x in j['data'] if x.get('Title')]
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
EN_NAME = {'中俄美': 'China, Russia and the US', '中美': 'China and the US', '美国': 'the US', '俄': 'Russia', '普京': 'Putin', '特朗普': 'Trump', '习近平': 'Xi Jinping', '习主席': 'Xi Jinping', '马斯克': 'Musk', '日本': 'Japan', '韩国': 'South Korea', '印度': 'India', '伊朗': 'Iran', '乌克兰': 'Ukraine', '台湾': 'Taiwan', '英伟达': 'Nvidia', '黄仁勋': 'Jensen Huang'}
NAMES = [('中俄美', r'\bUS\b|U\.S\.|United States|America'), ('中美', r'\bUS\b|U\.S\.|United States|America|Sino-US'), ('美国', r'\bUS\b|U\.S\.|United States|America'), ('俄', r'Russia|Putin|Kremlin|Moscow'), ('普京', r'Putin'), ('特朗普', r'Trump'), ('习近平', r'Xi\b'), ('习主席', r'Xi\b'), ('马斯克', r'Musk'), ('日本', r'Japan'), ('韩国', r'Korea'), ('印度', r'India'), ('伊朗', r'Iran'), ('乌克兰', r'Ukrain'), ('台湾', r'Taiwan'), ('英伟达', r'Nvidia'), ('黄仁勋', r'Huang')]
KINDS = {'world': 'World and state', 'america': 'About America', 'money': 'Money and business', 'tech': 'Tech and AI', 'life': 'Daily life', 'pop': 'Pop culture', 'games': 'Games', 'sport': 'Sport'}

def translate(items):
    if MODEL == 'none':
        for it in items: it['en'] = it['zh']; it['kind'] = 'life'
        return 'not translated (CV_MODEL=none)'
    sys.path.insert(0, os.path.join(HERE, 'closedform')); import derive as D
    k = 'local' if D.is_local(MODEL) else D.key()
    sys_ = ('You translate Chinese trending headlines into plain English for a reader who does not know China. Translate what the line says; '
            'do not add opinion. Where a name or term would be unknown, add a few words in brackets saying what it is, but never a title or office the line does not give. Chinese personal names: standard pinyin, family name first, no tone marks (李雪琴 → Li Xueqin). Reply with JSON only.')
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
            ans, _u = D.call(sys_, 'Translate this one trending headline into plain English. Every country and person named in it must be named in the English. This translation must name: ' + '; '.join(sorted({EN_NAME.get(z, z) for z, e in NAMES if z in it['zh']})) + '.\nLINE: ' + it['zh'] + '\nAnswer: {"en": "..."} valid JSON only.', k, MODEL)
            en = str((ans or {}).get('en') or '').strip()
            if en and all(re.search(e, en, re.I) for z, e in NAMES if z in it['zh']): it['en'] = en; print(f'  line {n} translated again (a name had been dropped)'); continue
        except (Exception, SystemExit): pass
        # 11-20: about one line in two still lost a name on the second try. The missing names are now put back, in brackets, from the
        # Chinese itself, so the English never leaves a country out; the line is no longer marked.
        lost = [z for z, e in NAMES if z in it['zh'] and not re.search(e, it.get('en', ''), re.I)]
        lost = [z for z in lost if not any(z != y and z in y for y in lost)]   # 中俄美 covers 美国
        it['en'] = it.get('en', '').rstrip() + ' [' + '; '.join(dict.fromkeys(EN_NAME.get(z, z) for z in lost)) + ']'; print(f'  line {n}: names put back from the Chinese')
    return f'{MODEL}, on this Mac'

# ── the extraction (11-18). For the top stories of each board the pull finds what was written and what was said, reads it on
# this Mac, and has the model write the item: an account in its own words, one or two short quotes, how it was received.
#   · the article text is kept whole in data/chinavision/raw/<feed>/ for later analysis. That folder is NOT
#     committed (.gitignore) and nothing in it is shown. Only the account, the short quotes and the links go into the feed.
#   · a quote is kept only if it is found, character for character, in the text it is said to come from, and is short.
# CV_STORIES = how many items per board get this (default: every line the board shows, since 11-20, so that any headline can be opened; 0 = none).
STORIES = int(os.environ.get('CV_STORIES', str(TOP))); QMAX = 28   # the longest quote kept, in characters
OUTLETS = {'thepaper.cn': 'The Paper', 'sina.com.cn': 'Sina', 'sina.cn': 'Sina', '163.com': 'NetEase', 'qq.com': 'Tencent News', 'sohu.com': 'Sohu', 'ifeng.com': 'Phoenix',
           'news.cn': 'Xinhua', 'xinhuanet.com': 'Xinhua', 'people.com.cn': "People's Daily", 'cctv.com': 'CCTV', 'cctv.cn': 'CCTV', 'huxiu.com': 'Huxiu', '36kr.com': '36Kr',
           'yicai.com': 'Yicai', 'caixin.com': 'Caixin', 'guancha.cn': 'Guancha', 'bjnews.com.cn': 'Beijing News', 'chinanews.com.cn': 'China News Service', 'chinanews.com': 'China News Service',
           'thecover.cn': 'The Cover', 'dayoo.com': 'Guangzhou Daily', 'gov.cn': 'gov.cn (the State Council site)', 'baijiahao.baidu.com': 'Baijiahao (hosted by Baidu)', 'ce.cn': 'China Economic Net', 'cnstock.com': 'Shanghai Securities News', 'bjd.com.cn': 'Beijing Daily', 'southcn.com': 'Nanfang Daily', 'nbd.com.cn': 'National Business Daily', 'jiemian.com': 'Jiemian', 'toutiao.com': 'Toutiao', 'gmw.cn': 'Guangming Daily', 'huanqiu.com': 'Global Times', 'cls.cn': 'Cailian Press',
           'tmtpost.com': 'TMTPost', 'ithome.com': 'IT Home', '21jingji.com': '21st Century Business Herald', 'stcn.com': 'Securities Times', 'china.com.cn': 'China.org.cn', 'cnr.cn': 'China National Radio'}
def outlet(url):
    host = urllib.parse.urlparse(url).netloc.lower()
    return next((v for k, v in OUTLETS.items() if host == k or host.endswith('.' + k)), host.replace('www.', '').replace('m.', '', 1))
def page(url, referer=None, timeout=20):
    h = dict(UA, Accept='text/html,application/xhtml+xml,*/*;q=0.8'); h.update({'Referer': referer} if referer else {})
    with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=timeout) as r:
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
def fits(term, text, html_, today, least=.5):
    """Is this page about the trending line, and from now? Two plain tests, no model: enough of the headline's own character pairs
    are in the article, and the page carries a date within three days. (The first pull put a 2019 digest under a Musk headline
    and a story about Britain under 'Trump leaves for home'.) Returns (yes or no, why)."""
    cj = re.findall(r'[\u4e00-\u9fffA-Za-z0-9]', term); pairs = {a + b for a, b in zip(cj, cj[1:])}
    share = sum(1 for x in pairs if x in text) / max(1, len(pairs))
    ds = page_dates(html_); near = any(abs((today - d).days) <= 3 for d in ds)
    if share < least: return False, f'only {share:.0%} of the headline is in it'
    if ds and not near: return False, f'no date within three days (newest on the page: {max(ds)})'
    if not ds and share < .7: return False, 'no date on the page and a weak match'
    return True, f'{share:.0%} of the headline, dated'
# 11-19: where the articles come from. Three pulls searched Baidu's news page for each headline; it closed the connection on a third
# of the searches and then gave no results at all. A search page is not there to be read by a program, and that was the answer.
# So the stories now come from the outlets' own RSS feeds, which they publish for programs to read. Every feed is read once per
# pull; a headline is matched to a feed item by its own characters and the item's date, then the outlet's page is opened.
FEEDS = [('China News Service', 'https://www.chinanews.com.cn/rss/' + c + '.xml') for c in
         ('scroll-news', 'importnews', 'china', 'world', 'society', 'finance', 'life', 'culture', 'sports', 'dwq', 'fz', 'edu', 'jk', 'dxw')] + \
        [('IT Home', 'https://www.ithome.com/rss/'), ('Jiemian', 'https://a.jiemian.com/index.php?m=article&a=rss'), ('36Kr', 'https://36kr.com/feed'), ('Huxiu', 'https://www.huxiu.com/rss/0.xml')]
# 11-20: the 09:31 pull had 525 feed items, but only 180 from this week. People's Daily's feeds stop in June 2025 and Sina's in
# 2018; Xinhua, Global Times and Zaobao answer "not found". Those are dropped. China News Service publishes a feed for each of its
# channels (chinanews.com/rss/index.shtml): politics (Taiwan and cross-strait news sit there), society, life, culture and
# entertainment, sport, the Greater Bay Area, law, education, health. All are added. 36Kr is read leniently (it sends a stray
# character that broke the reader) and Huxiu is given longer to answer.
_RSS = {}
def rss_items():
    """Every item of every feed, once per pull: {outlet, title, link, text (title + summary), date}. A feed that does not answer is named and skipped."""
    if 'items' in _RSS: return _RSS['items']
    import xml.etree.ElementTree as ET, email.utils, time
    items, rep_ = [], []
    for name, url in FEEDS:
        try:
            x = re.sub(r'^\s*<\?xml[^>]*\?>', '', page(url, timeout=40))
            try: root = ET.fromstring(x.encode('utf-8'))
            except ET.ParseError:   # a stray control character or a bare & in the feed: cleaned once, then read
                x = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', x); x = re.sub(r'&(?!(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);)', '&amp;', x)
                try: root = ET.fromstring(x.encode('utf-8'))
                except ET.ParseError:   # 11-23: 36Kr still failed after cleaning. Each <item> is then read on its own; a broken one is skipped
                    root = ET.Element('rss')
                    for blk in re.findall(r'(?is)<item\b.*?</item>', x):
                        blk = re.sub(r'(?is)<(description|content:encoded)>(?!<!\[CDATA\[)(.*?)</\1>', lambda m_: '<' + m_.group(1) + '><![CDATA[' + m_.group(2).replace(']]>', '') + ']]></' + m_.group(1) + '>', blk)
                        try: root.append(ET.fromstring(blk.encode('utf-8')))
                        except ET.ParseError: pass
            n = 0
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
def find_articles(term, ask=True):
    """Feed items about a trending line, best match first. An item is taken when at least half of the headline's character pairs
    are in its title and summary and it is dated within three days. 11-20: a hot-list line is reworded by the platform
    ('美国三大股指全线大跌' against the outlet's '美股大跌 纳指年内涨幅悉数回吐', 33%), so a near miss (30 to 49%) is put to the
    model in one short question: is this the same story? Only a yes is taken. Lowering the bar without the question let in
    wrong stories ('问界M9' matched a Geely M8 launch)."""
    today = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date(); P_ = pairs_of(term); hits = []; near = []
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
        so = sum(1 for x in own if x in it['text']) / len(own) if len(own) >= 2 else sc
        if sc >= .5 and so >= .5: hits.append((sc, it['link'], it))
        elif sc >= .3 and so >= .25: near.append((sc, it['link'], it))
    out = []; seen_ = set()
    for sc, u, it in sorted(hits, key=lambda h_: -h_[0]):
        if u not in seen_: seen_.add(u); out.append(it)
    near = [h_ for h_ in sorted(near, key=lambda h_: -h_[0]) if h_[1] not in seen_][:5]
    if near and ask and MODEL != 'none':
        try:
            a = model_json('You compare a trending line from a Chinese hot list with news headlines and say which headlines report the same story. Same story means the same event, not the same topic. Reply with JSON only.',
                           'TRENDING LINE: ' + term + '\nHEADLINES:\n' + '\n'.join(str(n_ + 1) + '. ' + h_[2]['title'] for n_, h_ in enumerate(near)) +
                           '\n\nReturn {"same": [the numbers of the headlines that report the same event as the trending line]}. [] if none.')
            for n_ in a.get('same') or []:
                if isinstance(n_, int) and 1 <= n_ <= len(near) and near[n_ - 1][1] not in seen_:
                    it = dict(near[n_ - 1][2], _near=True); seen_.add(it['link']); out.append(it)
            print(f'    near matches put to the model: {len(near)}, same story: {sum(1 for x in out if x.get("_near"))}')
        except (Exception, SystemExit) as e: print(f'    near-match check failed: {type(e).__name__}')
    return out[:4]
def model_json(sys_, user):
    sys.path.insert(0, os.path.join(HERE, 'closedform')); import derive as D
    ans, _u = D.call(sys_, user, 'local' if D.is_local(MODEL) else D.key(), MODEL); return ans or {}
def quotes_ok(qs, text, most=2):
    """Only quotes that are in the text, exactly, and short. The model's translation is kept beside the Chinese."""
    out = []
    for q in qs or []:
        zh = str((q or {}).get('zh', '')).strip().strip('“”"「」'); en = str((q or {}).get('en', '')).strip().strip('“”"')
        if any(o['zh'] == zh or o['en'].lower() == en.lower() for o in out): continue   # 11-23: the same voice came back twice
        if re.search(r'[\u4e00-\u9fff]', en): continue   # 11-23: 'Great power博弈' — Chinese left in the English
        if zh and en and '\n' not in zh and len(zh) <= QMAX and zh in text and len(en.split()) <= 14: out.append({'zh': zh, 'en': en, 'who': str(q.get('who') or '').strip()[:60]})
    return out[:most]
# ── how it was received (11-20). Two sources, both open to a visitor who is not logged in, both read slowly and once per pull.
#   1 · Sina's hourly roundups of what is trending (the account 每日新闻摘录). Each numbered item says what happened and often how
#       people took it. An item is matched to a headline the way a feed item is.
#   2 · Bilibili: the day's most-watched videos, and the top comments under each. Real voices, of one crowd (young).
# If either source refuses (an error, a 'risk control' answer), it is named and left alone for the rest of the pull. Nothing is retried
# around a refusal. Commenters' names are not kept; only the words and the like count.
SINA_UID = '7857201856'; _SINA = {}; _BILI = {}
def own_share(term, text):
    """How much of a headline is in a text: (share of all its character pairs, share of the pairs that are the headline's own this week)."""
    P_ = pairs_of(term); df = _RSS.get('df') or {}; n = len(_RSS.get('items') or [])
    own = {x for x in P_ if df.get(x, 0) <= max(2, n * .08)}
    return (sum(1 for x in P_ if x in text) / max(1, len(P_)), (sum(1 for x in own if x in text) / len(own)) if len(own) >= 2 else 1.0)
def sina_sections():
    """The numbered items of the newest roundups: {title, body, roundup, url}."""
    if 'secs' in _SINA: return _SINA['secs']
    # 11-23: switched off. The list was finally read (k.sina.cn/aj/newmedia/list) and the account is dead: its newest post is
    # 2026-07-25, and the posts are mixed filler (property ads, novel excerpts), not hourly roundups. CV_SINA=1 reads it again.
    if os.environ.get('CV_SINA') != '1': _SINA['secs'] = []; _SINA['report'] = ['· Sina roundups: off (the account stopped posting in July 2026)']; return []
    import time
    secs, rep_ = [], []
    try:
        h = page('http://k.sina.com.cn/mediaDocList.d.html?uid=' + SINA_UID, 'http://k.sina.com.cn/'); _SINA['list_html'] = h
        ids = []
        for m_ in re.finditer(r'article_%s_([0-9a-z]+)\.html|articles/view/%s/([0-9a-z]+)' % (SINA_UID, SINA_UID), h):
            a = m_.group(1) or m_.group(2)
            if a not in ids: ids.append(a)
        # 11-23: the page fills its list after it opens, from k.sina.cn/aj/newmedia/list (found in its own script, saved by the
        # probe). The page carries the account's muid in globalConfig; the list is read from the same address the page uses.
        mu = re.search(r'"muid"\s*:\s*"?(\d+)', h)
        if not ids and mu:
            for pg in (1, 2):
                try:
                    raw_ = page(f'https://k.sina.cn/aj/newmedia/list?source=js&muid={mu.group(1)}&page={pg}', 'https://k.sina.cn/'); _SINA.setdefault('list_api', []).append(raw_)
                    for m_ in re.finditer(r'article_%s_([0-9a-z]+)\.html' % SINA_UID, raw_.replace('\\/', '/')):
                        if m_.group(1) not in ids: ids.append(m_.group(1))
                except Exception as e: rep_.append(f'  ✗ list page {pg}: {type(e).__name__} {str(e)[:60]}')
                time.sleep(1.5)
        rep_.append(f'✓ Sina roundups: the list has {len(ids)} articles' + (' (read from the list address)' if _SINA.get('list_api') else ''))
        today = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date()
        for a in ids[:int(os.environ.get('CV_ROUNDUPS', '8'))]:
            u = f'https://k.sina.com.cn/article_{SINA_UID}_{a}.html'; time.sleep(1.5)
            try: hh = page(u, 'http://k.sina.com.cn/')
            except Exception as e: rep_.append(f'  ✗ {a}: {type(e).__name__}'); continue
            tm = re.search(r'<title>(.*?)</title>', hh, re.S); title = untag(tm.group(1)) if tm else a
            dm = re.search(r'(20\d\d)年(\d{1,2})月(\d{1,2})日', title)
            if dm and abs((today - dt.date(*map(int, dm.groups()))).days) > 2: continue
            body = re.sub(r'(?is)<(script|style|noscript|iframe)[^>]*>.*?</\1>', ' ', hh)
            lines = [untag(x) for x in re.split(r'(?i)<br\s*/?>|</p>|</div>|</li>|</h\d>|\n', body)]
            cur = None; n = 0
            for x in lines:
                hm = re.match(r'^(\d{1,2})[、.．]\s*(\S.{3,80})$', x)
                if hm: cur = {'title': hm.group(2).strip(), 'body': '', 'roundup': title, 'url': u}; secs.append(cur); n += 1
                elif cur is not None and len(x) >= 20 and not x.startswith('http') and len(re.findall(r'[一-鿿]', x)) >= len(x) * .4 and len(cur['body']) < 2500: cur['body'] += x + '\n'
            rep_.append(f'  ✓ {title[:40]}: {n} items')
    except Exception as e: rep_.append(f'✗ Sina roundups: {type(e).__name__} {str(e)[:100]}')
    _SINA['secs'] = [x for x in secs if len(x['body']) >= 60]; _SINA['report'] = rep_; return _SINA['secs']
def bili_popular():
    j = get('https://api.bilibili.com/x/web-interface/popular?ps=30&pn=1', 'https://www.bilibili.com/v/popular/all')
    if j.get('code') != 0: raise RuntimeError(f"Bilibili answered code {j.get('code')}: {str(j.get('message'))[:60]}")
    return [{'aid': v['aid'], 'bvid': v['bvid'], 'title': v['title'], 'desc': (v.get('desc') or '')[:400], 'owner': (v.get('owner') or {}).get('name', ''), 'views': (v.get('stat') or {}).get('view', 0), 'likes': (v.get('stat') or {}).get('like'), 'replies': (v.get('stat') or {}).get('reply'), 'danmaku': (v.get('stat') or {}).get('danmaku'), 'pubdate': v.get('pubdate'), 'duration': v.get('duration'), 'tname': v.get('tname') or ''} for v in j['data']['list']]
def bili_comments(aid):
    """The most-liked comments under a video, as a visitor sees them. Words and like counts only."""
    if _BILI.get('off'): return []
    j = get(f'https://api.bilibili.com/x/v2/reply?type=1&oid={aid}&sort=2&ps=20&pn=1', 'https://www.bilibili.com/')
    if j.get('code') != 0: _BILI['off'] = f"code {j.get('code')}: {str(j.get('message'))[:60]}"; print(f"    Bilibili comments refused ({_BILI['off']}); left alone for this pull"); return []
    cs = [{'text': re.sub(r'\s+', ' ', (r.get('content') or {}).get('message', ''))[:300], 'likes': r.get('like', 0)} for r in (j.get('data') or {}).get('replies') or []]
    return sorted([c for c in cs if len(c['text']) >= 6], key=lambda c: -c['likes'])[:15]
RECEPTION_SYS = 'You read what Chinese users or a Chinese roundup say about a trending topic and report, in plain English, how people are taking it. You report; you do not judge, and you add nothing that is not in the text. Describe a person only as the text does: never add a title, office or job from what you know (11-23: Trump was called the former president, a doctor was given two different specialties). Spell Chinese names in standard pinyin, family name first, no tone marks, the same way every time. Say what the words say. Do not name a tone (mocking, angry, proud) unless the words plainly show it; a joke or a reference you are not sure of is reported as what it literally says. Write only English: no Chinese characters in the English. A nickname or a name an American would not know gets a few words in square brackets saying who or what it is. Reply with JSON only.'
IMPLIED = re.compile(r'[,;:]?\s*(?:\(|—|-)?\s*\b(?:implying|implies|implied|suggesting|suggests|hinting|hints|insinuating|presumably|perhaps referring|likely referring|possibly referring)\b[^.]*', re.I)
def plain_gist(g):
    """11-20: Qwen added what a comment 'implies' (the GitHub joke). The instruction now forbids it; anything that still comes
    back after 'implying', 'suggesting', 'hinting' and the like is cut, so a gist says only what the comment says."""
    g = IMPLIED.sub('', str(g or '')).strip().rstrip(',;:—- ')
    return (g + '.') if g and g[-1] not in '.!?”"' else g
def reception_from(it, topic, text, where, ask, video=None, n_each=0):
    """One model call: how people took it, from a text. Voices are kept only when found exactly in the text and short.
    For a video (11-20) the same call also says what the video is, from its title and the uploader's own description, and gives
    each comment in one sentence, so that the opened item can show every comment beside its like count."""
    extra = ''
    if video: extra += ', "about": one or two plain sentences saying what the video is, going only by the title and the DESCRIPTION; "" if they do not say'
    if n_each: extra += ', "each": for every numbered comment, in order: {"n": its number, "gist": one plain sentence saying what that comment\'s words say, in your own words. Only what the words say: never what the comment implies, suggests or hints at, and never explain a joke. If you are not sure what a reference means, report the words as they are}'
    a = model_json(RECEPTION_SYS, 'TOPIC: ' + topic + ('\nDESCRIPTION written by the uploader: ' + video[:400] if video else '') + '\n' + ask + '\n' + text[:4500] + '\n\nReturn {"reception": one or two plain sentences on how people are reacting and how they split, if they do. If the text reports no reaction at all, "", '
                   '"voices": up to two items {"zh": a phrase copied exactly from the text, at most ' + str(QMAX - 4) + ' characters, "en": its English, at most 12 words}' + extra + '}. Valid JSON only.')
    cjk = lambda x: re.search(r'[一-鿿]', str(x or ''))
    if cjk(a.get('reception')): a['reception'] = ''   # 11-20: a summary came back with Chinese left in it; such a summary is dropped, the quoted voices stay
    rc = ([{'en': str(a['reception']).strip() + ' (' + where + ')'}] if str(a.get('reception') or '').strip() else []) + [{'en': '“' + v['en'] + '”', 'zh': v['zh']} for v in quotes_ok(a.get('voices'), text)]
    if rc: it['reception'] = (it.get('reception') or []) + rc
    ab = str(a.get('about') or '').strip()
    if video and ab and not cjk(ab): it.setdefault('video', {})['about'] = ab
    a['_each'] = [(int(e['n']), plain_gist(e.get('gist'))) for e in (a.get('each') or []) if isinstance(e, dict) and str(e.get('n', '')).isdigit() and str(e.get('gist') or '').strip() and not cjk(e.get('gist'))] if n_each else []
    it['_last'] = a
    return bool(rc)

def titles_en(titles):
    """Other outlets' headlines on the same story, in English. One model call; the answer is used only if it has one line for each headline."""
    if not titles: return []
    a = model_json('You translate Chinese news headlines into plain English. Translate what the line says; add no opinion. Every country and person named must be named in the English. Reply with JSON only.',
                   'HEADLINES:\n' + json.dumps(titles, ensure_ascii=False, indent=1) + '\nAnswer: {"en": [one English line for each headline, in the same order]} valid JSON only.')
    en = [str(x).strip() for x in (a.get('en') or [])] if isinstance(a.get('en'), list) else []
    return en if len(en) == len(titles) and not any(re.search(r'[一-鿿]', x) for x in en) else [''] * len(titles)

# ── Toutiao's topic pages (11-23). Each entry on Toutiao's hot board has its own page: the event as the platform states it, with
# its source, and the posts users wrote about it. The page builds itself by script, so it is opened in a real browser (Chrome on
# this Mac, through Playwright), the way a visitor opens it. Sailor's call, 11-23. Same limits as everywhere: a login or a robot
# check stops it. CV_TOPICS=0 turns it off. Install once: "Install the Browser.command".
TOPICS = {}
TOPIC_JS = """() => {
  const t = document.body.innerText || '';
  const i = t.indexOf('事件详情'), j = t.indexOf('相关内容');
  const ev = (i >= 0 && j > i) ? t.slice(i + 4, j).trim() : '';
  const seen = new Set(), posts = [];
  for (const a of document.querySelectorAll('a[href*="/w/"], a[href*="/article/"]')) {
    const x = (a.innerText || '').trim();
    if (x.length >= 25 && !seen.has(x)) { seen.add(x); posts.push({text: x.slice(0, 700), url: a.href.split('#')[0]}); }
  }
  return {ev: ev, posts: posts.slice(0, 12), head: t.slice(0, 3000)};
}"""
def toutiao_topics(items):
    if os.environ.get('CV_TOPICS') == '0': return
    want = [it for it in items if it.get('_turl') and it['rank'] <= STORIES]
    if not want: return
    try: from playwright.sync_api import sync_playwright
    except ImportError: print('  Toutiao topic pages: off (double-click "Install the Browser.command" once)'); return
    import time
    with sync_playwright() as pw:
        try: br = pw.chromium.launch(channel='chrome', headless=os.environ.get('CV_HEADFUL') != '1')
        except Exception: br = pw.chromium.launch(headless=os.environ.get('CV_HEADFUL') != '1')
        ctx = br.new_context(locale='zh-CN', user_agent=UA['User-Agent']); pg = ctx.new_page(); n_ok = 0
        for it in want:
            try:
                pg.goto(it['_turl'], wait_until='domcontentloaded', timeout=30000)
                try: pg.wait_for_function("document.body.innerText.indexOf('事件详情') >= 0", timeout=15000)
                except Exception: pass
                pg.wait_for_timeout(1200); d = pg.evaluate(TOPIC_JS)
                if re.search(r'验证码|安全验证|captcha|请完成验证|登录后查看', d.get('head', ''), re.I):
                    print('  Toutiao topic pages: a robot check or a login came up — stopped here, as the rule says'); break
                lines = [x.strip() for x in (d.get('ev') or '').split('\n') if x.strip() and not re.fullmatch(r'\d{1,2}:\d{2}(:\d{2})?', x.strip())]
                summ = max(lines, key=len) if lines else ''
                srcl = lines[lines.index(summ) + 1] if summ and lines.index(summ) + 1 < len(lines) else ''
                srcm = re.match(r'^(.*?)(?:\d+评论)?(\d+\s*(?:分钟|小时|天)前|刚刚|(?:昨天|前天)?\s*\d{1,2}:\d{2}|(?:\d{4}-)?\d{1,2}-\d{1,2}(?:\s*\d{1,2}:\d{2})?|\d{1,2}月\d{1,2}日)?$', srcl)
                TOPICS[it['_turl']] = {'url': it['_turl'], 'title': it['zh'], 'event': summ, 'source': (srcm.group(1).strip() if srcm else srcl)[:40],
                                       'posts': [p_ for p_ in d.get('posts', []) if p_['text'] != summ]}
                n_ok += bool(summ)
            except Exception as e: print(f"  Toutiao topic {it['rank']}: {type(e).__name__} {str(e)[:80]}")
            time.sleep(1.5)
        br.close()
    print(f'  Toutiao topic pages: {len(TOPICS)} opened, {n_ok} with the event stated')
    # the stated events join the pool, so the same story on another board is matched to them like any article
    today_ = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date()
    for t_ in TOPICS.values():
        if t_['event']: rss_items().append({'outlet': 'Toutiao topic page' + (' · ' + t_['source'] if t_['source'] else ''), 'title': t_['title'], 'link': t_['url'], 'text': t_['title'] + ' ' + t_['event'], 'date': today_, '_topic': t_})
    _RSS.pop('df', None)
def topic_story(it, key, t_, raw):
    """An item written from a Toutiao topic page: the account from the event as stated, how it was received from the users' posts."""
    raw['topic'] = t_
    a = model_json('You read the one-paragraph statement of a trending event on a Chinese platform and report it in plain English for a reader who does not know China. You add nothing that is not in the statement. Describe a person only as the text does: never add a title, office or job from what you know (11-23: Trump was called the former president, a doctor was given two different specialties). Spell Chinese names in standard pinyin, family name first, no tone marks, the same way every time. Reply with JSON only.',
                   'HEADLINE (trending): ' + key + '\nTHE HEADLINE IN ENGLISH (spell names as it does): ' + it.get('en', '') + '\nSTATEMENT (' + (t_['source'] or 'Toutiao') + '):\n' + t_['event'][:1500] +
                   '\n\nReturn {"about": true if the statement is about the headline, else false, "account": two or three plain sentences in your own words: what happened, as the statement gives it. Explain any name or term an American would not know in a few words. Do not copy its sentences, '
                   '"quotes": up to two items {"zh": a phrase copied exactly from the statement, at most ' + str(QMAX - 4) + ' characters, "en": its English, at most 12 words, "who": "' + (t_['source'] or 'Toutiao') + '"}}. Valid JSON only.')
    acc = str(a.get('account') or '').strip()
    if a.get('about') is False or not acc or re.search(r'[\u4e00-\u9fff]', acc): return False
    it['note'] = acc; it['sources'] = [{'name': 'Toutiao topic page' + (' · ' + t_['source'] if t_['source'] else ''), 'url': t_['url'], 'title': t_['title']}]
    w = quotes_ok(a.get('quotes'), t_['event'], 2)
    if w: it['words'] = w
    ps = t_.get('posts') or []
    if len(ps) >= 2: reception_from(it, key, '\n'.join(f'{n_ + 1}. {p_["text"]}' for n_, p_ in enumerate(ps[:10])), f'from the top {min(len(ps), 10)} posts on Toutiao\'s page for this topic', 'POSTS by users on the topic page, numbered:')
    return True
def enrich(items, fid, save=None):
    if MODEL == 'none' or STORIES <= 0: return
    print(f'  the feeds: {len(rss_items())} items from {sum(1 for r in _RSS["report"] if r[0] == "✓")} of {len(FEEDS)} feeds'); [print('   ', r) for r in _RSS['report'] if r[0] != '✓']
    toutiao_topics(items)
    rawd = os.path.join(OUT, 'raw', fid); os.makedirs(rawd, exist_ok=True); seen = {}
    # 11-23: the whole pool is kept with the pull (raw/, not committed), so a headline with no account can be traced to the pool
    today_ = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date(); per = {}
    for x in rss_items():
        o = per.setdefault(x['outlet'], [0, 0]); o[0] += 1; o[1] += bool(x['date'] and abs((today_ - x['date']).days) <= 3)
    print('  this week, by outlet: ' + ' · '.join(f'{k} {v[1]}/{v[0]}' for k, v in per.items()))
    json.dump([dict(x, date=str(x['date'])) for x in rss_items()], open(os.path.join(rawd, '_feeds.json'), 'w'), indent=1, ensure_ascii=False)
    json.dump(_RSS['report'], open(os.path.join(rawd, '_feeds_report.json'), 'w'), indent=1, ensure_ascii=False)
    secs = sina_sections(); print(f'  Sina roundups: {len(secs)} items'); [print('   ', r) for r in _SINA.get('report', []) if '✗' in r]
    for it in [x for x in items if x['rank'] <= STORIES or x.get('_aid')]:
        key = it['zh']
        if key in seen:   # the same story on another board: written once
            for f_ in ('note', 'more', 'words', 'reception', 'sources', 'coverage', 'noAccount'):
                if seen[key].get(f_): it[f_] = seen[key][f_]
            continue
        seen[key] = it; raw = {'zh': key, 'board': it['board'], 'articles': []}
        print(f"  {it['board']} {it['rank']}: {key[:30]}")
        try: story(it, key, raw, rawd)
        except (Exception, SystemExit) as e: print(f'    this story was left as a headline: {type(e).__name__} {str(e)[:120]}')   # SystemExit: the model worker gives up that way
        if save: save()

def story(it, key, raw, rawd):
    if True:
        text = ''; src = None; srcfi = None; cov = []; found = 0; told_no = False
        today = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date()
        own = TOPICS.get(it.get('_turl') or '')
        if own and own.get('event') and topic_story(it, key, own, raw): found += 1
        for fi in ([] if (it.get('_aid') or it.get('note')) else find_articles(key)):
            if fi.get('_topic'):   # the same story stated on a Toutiao topic page
                found += 1
                if topic_story(it, key, fi['_topic'], raw): break
                continue
            u = fi['link']; body = fi['text'][len(fi['title']):].strip()
            if len(body) >= 400: tx, h_ = body, str(fi['date'] or '') + ' ' + fi['text']   # the feed carries the article itself: no page is opened
            else:
                try: h_ = page(u); tx = article_text(h_); h_ = str(fi['date'] or '') + ' ' + h_
                except Exception as e: print(f'    could not open {u[:60]}: {type(e).__name__}'); continue
            ok, why = fits(key, fi['title'] + ' ' + tx, h_, today, .3 if fi.get('_near') else .5)
            raw['articles'].append({'url': u, 'outlet': outlet(u), 'fits': ok, 'why': why, 'title': fi['title'], 'text': tx}); found += 1
            if not ok: print(f'    not used ({outlet(u)}): {why}'); continue
            cov.append(fi)
            if len(tx) > len(text): text, src, srcfi = tx, u, fi
            if len(text) > 1200: break
        if len(text) > 300:
            a = model_json('You read a Chinese news article and report on it in plain English for a reader who does not know China. You add no opinion and nothing that is not in the article. Describe a person only as the text does: never add a title, office or job from what you know (11-23: Trump was called the former president, a doctor was given two different specialties). Spell Chinese names in standard pinyin, family name first, no tone marks, the same way every time. Reply with JSON only.',
                           'HEADLINE (trending): ' + key + '\nTHE HEADLINE IN ENGLISH (spell names as it does): ' + it.get('en', '') + '\nOUTLET: ' + outlet(src) + '\nARTICLE:\n' + text[:5000] + '\n\nFirst decide: is this text one article, and is it about the headline? If it is a list of unrelated items, or about something else, return only {"about": false}. Otherwise return {"about": true, "account": three to five plain sentences in your own words: what happened, and how this piece presents it. Do not translate the article and do not copy its sentences. Explain any name or term an American would not know in a few words, '
                           '"more": two to four further plain sentences, in your own words, with what a reader would ask next and the article answers: the numbers, the names, the dates, what is said to come next. Nothing that repeats the account and nothing that is not in the article; "" if the article has no more, '
                           '"quotes": up to three items {"zh": a phrase copied exactly from the article, at most ' + str(QMAX - 4) + ' characters, chosen because its wording matters, "en": its English, at most 12 words, "who": who says it (the person quoted, or the outlet)}, '
                           '"reception": ONLY if the article itself reports how people reacted (readers, users online, other officials or companies): one or two plain sentences saying what it reports; otherwise "", '
                           '"voices": ONLY if the article quotes such reactions: up to two items {"zh": copied exactly, at most ' + str(QMAX - 4) + ' characters, "en": its English, at most 12 words}; otherwise []}. Valid JSON only.')
            if a.get('about') is False: print('    the model says this is not about the headline: left as a headline'); a = {}; told_no = True
            acc = str(a.get('account') or '').strip()
            if acc:
                it['note'] = acc; it['sources'] = [{'name': outlet(src), 'url': src}]
                mo = str(a.get('more') or '').strip()
                if mo and not re.search(r'[\u4e00-\u9fff]', mo): it['more'] = mo
                # 11-20, for the opened item: the source's own headline and date, and how the other outlets headlined the same story
                cov = [srcfi] + [c for c in cov if c is not srcfi]; en = titles_en([c['title'] for c in cov])
                it['sources'][0].update({'title': srcfi['title'], 'date': str(srcfi['date'] or '')}, **({'titleEn': en[0]} if en[0] else {}))
                if len(cov) > 1: it['coverage'] = [dict({'outlet': c['outlet'], 'zh': c['title'], 'url': c['link'], 'date': str(c['date'] or '')}, **({'en': e} if e else {})) for c, e in zip(cov, en)]
            w = quotes_ok(a.get('quotes'), text, 3)
            if w: it['words'] = w
            rc = ([{'en': str(a['reception']).strip()}] if str(a.get('reception') or '').strip() else []) + [{'en': '“' + v['en'] + '”', 'zh': v['zh']} for v in quotes_ok(a.get('voices'), text)]
            if rc: it['reception'] = rc   # reception as the article reports it; no comment threads are read (they sit behind logins)
        if not it.get('_aid') and not (it.get('note') and it.get('sources')):   # 11-20: the opened item says plainly why there is no account
            it['noAccount'] = ('An article was found in the news feeds, but it was not about this line, so no account was written.' if told_no else
                               'Articles near this line were found in the news feeds, but none passed the checks (on the topic, and from the last three days), so no account was written.' if found else
                               'No article about this line was found in the news feeds 望 reads, so no account was written. The feeds carry only the last few hours of a few outlets, and the hot lists draw on all of Chinese media, so most lines have no article there. Use the links below to look further.')
        if it.get('_aid'):   # a Bilibili video: what viewers wrote under it
            cs = bili_comments(it['_aid']); raw['comments'] = cs
            v = it.get('_v') or {}; bjz = dt.timezone(dt.timedelta(hours=8)); d_ = v.get('duration')
            it['video'] = {k: x for k, x in {'owner': v.get('owner'), 'posted': (dt.datetime.fromtimestamp(v['pubdate'], bjz).strftime('%Y-%m-%d %H:%M') + ' Beijing time') if v.get('pubdate') else '', 'length': (f'{d_ // 60} min {d_ % 60:02d} s' if isinstance(d_, int) and d_ > 0 else ''),
                           'views': v.get('views'), 'likes': v.get('likes'), 'replies': v.get('replies'), 'danmaku': v.get('danmaku')}.items() if x not in (None, '')}
            # 11-20: a visitor is shown three comments, not fifteen. Three is thin, and the line under the item says how many it rests on
            if len(cs) >= 3 and reception_from(it, key, '\n'.join(f"{n_ + 1}. [{c['likes']} likes] {c['text']}" for n_, c in enumerate(cs)), f'from the top {len(cs)} comments shown to visitors on Bilibili', 'COMMENTS under the video, numbered, most liked first:', video=(v.get('desc') or '').strip() or v.get('title', ''), n_each=len(cs)):
                it['sources'] = (it.get('sources') or [])
            each = (it.pop('_last', None) or {}).get('_each') or []
            if each: it['comments'] = [{'gist': g, 'likes': cs[n_ - 1]['likes']} for n_, g in each if 1 <= n_ <= len(cs)]
        else:
            best = None
            for sec in sina_sections():
                sc, own = own_share(key, sec['title'] + ' ' + sec['body'])
                if sc >= .5 and own >= .5 and (best is None or sc > best[0]): best = (sc, sec)
            if best:
                sec = best[1]; raw['roundup'] = sec
                if reception_from(it, key, sec['title'] + '\n' + sec['body'], "as Sina's hourly roundup reports it", 'A ROUNDUP ITEM about it:'):
                    it['sources'] = (it.get('sources') or []) + [{'name': 'Sina hourly roundup', 'url': sec['url']}]
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
        a = find_articles(t, ask=False); hit += bool(a); R.append(f'{"✓" if a else "·"} {name}: {t[:24]} → {len(a)} ' + (a[0]['link'][:70] if a else ''))
    R.append(f'— of {len(terms)} top lines, {hit} have at least one feed item')
    for fi in (find_articles(terms[0][1], ask=False) if terms else [])[:2]:
        u = fi['link']
        try: h = page(u); open(os.path.join(pd, 'rss_article_' + outlet(u).split()[0] + '.html'), 'w').write(h); tx = article_text(h); R.append(f'  article opened ({outlet(u)}): {len(tx)} chars · fits: {fits(terms[0][1], tx, h, dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date())}')
        except Exception as e: R.append(f'  article: {type(e).__name__} {str(e)[:100]}')
    secs = sina_sections(); R += _SINA.get('report', []); R.append(f'— Sina roundup items usable: {len(secs)}' + (f' · first: {secs[0]["title"][:40]} | {secs[0]["body"][:80]}' if secs else ''))
    if _SINA.get('list_html'): open(os.path.join(pd, 'sina_list.html'), 'w').write(_SINA['list_html'])
    for n_, r_ in enumerate(_SINA.get('list_api', [])): open(os.path.join(pd, f'sina_list_api_{n_ + 1}.json'), 'w').write(r_)
    try:   # 11-20: the list page is filled in by its script. The script is saved so the address it reads the list from can be found
        js = page('https://mjs.sinaimg.cn/wap/project/media_detail/0.1.20/index_v2/static/js/index_v2.min.js'); open(os.path.join(pd, 'sina_list.js'), 'w').write(js)
        R.append(f'· Sina list script: {len(js)} chars · addresses in it: ' + ' | '.join(sorted(set(re.findall(r'[\w./:-]*(?:interface|api)[\w./:?=&-]*', js)))[:12]))
    except Exception as e: R.append(f'· Sina list script: {type(e).__name__} {str(e)[:100]}')
    m2 = sum(1 for name, t in terms if any(own_share(t, x['title'] + ' ' + x['body'])[0] >= .5 and own_share(t, x['title'] + ' ' + x['body'])[1] >= .5 for x in secs)); R.append(f'— of {len(terms)} top lines, {m2} match a roundup item')
    try:
        vs = bili_popular(); R.append(f'✓ Bilibili videos: {len(vs)} · first: {vs[0]["title"][:40]}')
        cs = bili_comments(vs[0]['aid']); R.append((f'✓ Bilibili comments: {len(cs)} · top ({cs[0]["likes"]} likes): {cs[0]["text"][:60]}') if cs else f'✗ Bilibili comments: none · {_BILI.get("off", "")}')
    except Exception as e: R.append(f'✗ Bilibili videos: {type(e).__name__} {str(e)[:120]}')
    # 11-23 result: the topic page is an empty shell that registers a browser id by script before showing anything. Getting past it
    # would mean posing as a browser, so it is not used. The test stays in the probe, to see if that ever changes.
    try:   # 11-23: one test of Toutiao's own topic page for its top entry. Saved as it comes; the reader is fitted only if it gives articles cleanly
        tj = get('https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc', 'https://www.toutiao.com/'); e0 = (tj.get('data') or [{}])[0]
        R.append('· Toutiao entry fields: ' + ', '.join(sorted(e0.keys())))
        tu = e0.get('Url') or ''
        if tu:
            th = page(tu, 'https://www.toutiao.com/'); open(os.path.join(pd, 'toutiao_topic.html'), 'w').write(th)
            blocked = bool(re.search(r'captcha|verify|验证|登录后|请登录', th[:20000], re.I))
            arts = sorted(set(re.findall(r'(?:toutiao\.com)?/(?:article|group|a)/?(\d{12,})', th)))
            R.append(f'· Toutiao topic page: {len(th)} chars · article ids in it: {len(arts)} · a login or robot check: {"yes" if blocked else "no"} · {tu[:80]}')
            if arts:
                ah = page('https://www.toutiao.com/article/' + arts[0] + '/', tu); open(os.path.join(pd, 'toutiao_article.html'), 'w').write(ah)
                R.append(f'  first article: {len(ah)} chars · text found: {len(article_text(ah))} chars')
    except Exception as e: R.append(f'· Toutiao topic page: {type(e).__name__} {str(e)[:100]}')
    open(os.path.join(pd, 'report.txt'), 'w').write('\n'.join(R) + '\n'); print('\n'.join(R)); print('\nwritten to data/chinavision/_probe/report.txt — tell Claude.')

def main():
    if len(sys.argv) > 1 and sys.argv[1] == 'probe': return probe()
    items, boards, failed = [], {}, []
    for bid, name, zh, about, link, fn in BOARDS:
        try: rows = [(r[0].strip(), r[1], (r[2] if len(r) > 2 else ''), (r[3] if len(r) > 3 else '')) for r in fn() if r[0] and r[0].strip()][:TOP]
        except Exception as e: failed.append(f'{name}: {type(e).__name__} {e}'); print(f'✗ {name}: {e}'); continue
        if not rows: failed.append(f'{name}: empty'); continue
        boards[bid] = {'name': name, 'zh': zh, 'about': about}
        items += [dict({'board': bid, 'rank': n + 1, 'zh': t, 'heat': h, 'link': link + urllib.parse.quote(t), 'linkLabel': 'search Baidu'}, **({'desc': d} if d else {}), **({'_turl': u} if u else {})) for n, (t, h, d, u) in enumerate(rows)]
        print(f'✓ {name}: {len(rows)} lines')
    if not items: sys.exit('no board could be read — nothing written')
    try:   # 11-20: a second Bilibili board: the videos most watched today, with what viewers wrote under them
        vids = bili_popular()[:int(os.environ.get('CV_VIDEOS', '8'))]
        boards['bilipop'] = {'name': 'Bilibili videos', 'zh': 'B站热门视频', 'about': 'the most-watched videos today, and what viewers wrote under them'}
        items += [{'board': 'bilipop', 'rank': n + 1, 'zh': v['title'], 'heat': wan(v['views']) + ' views', 'link': 'https://www.bilibili.com/video/' + v['bvid'], 'linkLabel': 'watch on Bilibili', 'source': 'Bilibili · ' + v['owner'], '_aid': v['aid'], '_v': v} for n, v in enumerate(vids)]
        print(f'✓ Bilibili videos: {len(vids)}')
    except Exception as e: failed.append(f'Bilibili videos: {type(e).__name__} {str(e)[:80]}'); print(f'✗ Bilibili videos: {e}')
    by = translate(items)
    bj = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))); here = dt.datetime.now()
    fid = 'feed_' + bj.strftime('%Y-%m-%d_%H%M')
    def save():
        feed = {'schema': 'chinavision/feed/v0', 'id': fid, 'takenBeijing': bj.strftime('%Y-%m-%d %H:%M'), 'takenPacific': here.strftime('%Y-%m-%d %H:%M'),
                'what': '望 (wàng): what is trending in Chinese media right now, translated. A feed to explore. Nothing here is scored or read by Prism.',
                'source': "Each platform's own public hot list, read directly by chinavision-pull.py." + (' Not read this time: ' + '; '.join(failed) + '.' if failed else ''),
                'translatedBy': by, 'notesBy': 'Accounts, quotes and reception are written by ' + by + ' from the news pages it read. Reception comes from three places, each named beside it: the article itself, the hourly roundup published on Sina, and the top comments under the most-watched videos on Bilibili. What is visible is what was allowed to stay up. Accounts are in its own words; a quote is kept only when it is found exactly in its source and is short. The full texts stay on this Mac (data/chinavision/raw/) and are not shown.',
                'boards': boards, 'kinds': KINDS, 'items': [{k: v for k, v in it.items() if not k.startswith('_') and (k != 'desc' or not it.get('note'))} for it in items]}
        json.dump(feed, open(os.path.join(OUT, fid + '.json'), 'w'), indent=1, ensure_ascii=False)
        ip = os.path.join(OUT, 'index.json'); ix = json.load(open(ip)) if os.path.exists(ip) else {'feeds': []}
        ix['feeds'] = [{'file': fid + '.json', 'takenBeijing': feed['takenBeijing'], 'items': len(items)}] + [f for f in ix.get('feeds', []) if f['file'] != fid + '.json']
        ix['latest'] = fid + '.json'; json.dump(ix, open(ip, 'w'), indent=1, ensure_ascii=False)
    save(); print(f'filed {fid}.json — {len(items)} lines from {len(boards)} boards' + (f' · not read: {len(failed)}' if failed else '') + ' · it can be opened now; the stories are added as they are read')
    print('reading the stories …'); enrich(items, fid, save)
    n = sum(1 for it in items if it.get('note') and it.get('sources')); print(f'done — {n} items carry an account, {sum(1 for it in items if it.get("reception"))} carry a reception')

if __name__ == '__main__': main()
