#!/usr/bin/env python3
"""voice_new.py <episode> [max] — voices only the text beats whose cache is missing or stale (same cache as tts.py), then stops.
For the Mac, where a full tts.py mix runs too long: voice here, mix in the cloud from the cache."""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(__file__)); import tts
sid = sys.argv[1]; cap = int(sys.argv[2]) if len(sys.argv) > 2 else 99
ep = json.load(open(os.path.join(tts.ROOT, 'data', 'show', sid + '.json'))); voice = ep['voice']; api = tts.key()
bdir = os.path.join(tts.ROOT, 'data', 'show', sid, 'beats'); os.makedirs(bdir, exist_ok=True); n = 0; t0 = time.time()   # 11-08: a new episode has no beats folder yet
for blk in ep['blocks']:
    for b in blk['beats']:
        if b.get('type', 'text') != 'text': continue
        meta = os.path.join(bdir, b['id'] + '.json')
        try: m = json.load(open(meta)); ok = m.get('text') == b['text'] and m.get('voice_id') == voice['voice_id']
        except Exception: ok = False
        if ok: continue
        if n >= cap or time.time() - t0 > 140: print('more to voice — run again'); sys.exit(0)
        audio, words = tts.eleven(b['text'], voice, api)
        open(os.path.join(bdir, b['id'] + '.mp3'), 'wb').write(audio)
        json.dump({'text': b['text'], 'voice_id': voice['voice_id'], 'words': words}, open(meta, 'w'))
        n += 1; print('voiced', b['id'], len(words), 'words')
print('all voiced', n)
