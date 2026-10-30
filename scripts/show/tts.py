#!/usr/bin/env python3
"""
The voice and the sound — one part per beat, laid on the frame grid, mixed into one track.

  python3 scripts/show/tts.py ep01            # ElevenLabs for text beats; clip sound cut from the clip files; silence for landings
  python3 scripts/show/tts.py ep01 --dry      # no ElevenLabs call: text beats become silence of the estimated length (clip sound still real)

Reads   data/show/<id>.json           v1 (beats = text) or v2 (beats typed text | clip | land); voice.voice_id
Writes  data/show/<id>/beats/<beat>.mp3 + .json   the voice, cached per beat: a text beat is voiced again only when its text changes
        data/show/<id>/audio.mp3      the mix — voice, clip sound, silence — every part padded to whole frames, cuts hard
        data/show/<id>/voice.mp3      the voice alone (silence where the clips are); the jaw envelope reads this one
        data/show/<id>/timeline.json  { duration, fps, beats:[{id,block,type,start,end,words,src,in,out,layout,piece,line}], blocks:[{id,title,clip,start,end}], envelope:[0..1 per frame] }
        data/show/<id>/captions.srt   the spoken words

Beat types (v2):
  text   { text, caption, map, ted }                    one call to the with-timestamps endpoint; words carry times
  clip   { src, in, out, layout, piece, line }           duration out − in; the clip file's own sound, loudness-matched to the voice
  land   { dur, piece, line, orbit, zoom }               silence of dur; the map alone, a dot landing
A beat may set "gap" (seconds of silence after it). Default: 0.55 after a text beat, 0 after a clip or a landing — hard cuts.
Everything is padded up to the next whole frame (fps from the episode) so the renderer's cuts fall exactly where the sound does.

The key: ELEVENLABS_API_KEY in the environment, or ELEVENLABS_API_KEY in scripts/secrets.local.js.
ffmpeg: FFMPEG in the environment, or one on PATH, or imageio-ffmpeg's own (pip install --user imageio-ffmpeg). ffprobe is not needed.
The end card says the voice is synthesized; keep it there.
"""
import json, os, re, sys, base64, subprocess, struct, wave, math, hashlib, shutil, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # Prism/
WORKSPACE = os.path.dirname(ROOT)                                                     # the folder that holds Prism/ and Transcripts/
BREATH = 0.55   # seconds between text beats
LEAD = 0.4      # seconds of black before the first beat
SR, CH = 44100, 2
LOUD = 'loudnorm=I=-16:TP=-1.5:LRA=11'   # every part lands at the same loudness (the clips were ripped at YouTube's levels, the voice at ElevenLabs')

def ffmpeg_bin():
    if os.environ.get('FFMPEG'): return os.environ['FFMPEG']
    w = shutil.which('ffmpeg')
    if w: return w
    try:
        import imageio_ffmpeg; return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        pass
    print('no ffmpeg: set FFMPEG=/path/to/ffmpeg, or pip install --user imageio-ffmpeg'); sys.exit(2)
FF = ffmpeg_bin()

def key():
    k = os.environ.get('ELEVENLABS_API_KEY')
    if k: return k
    p = os.path.join(ROOT, 'scripts', 'secrets.local.js')
    if os.path.exists(p):
        m = re.search(r"ELEVENLABS_API_KEY:\s*'([^']+)'", open(p).read())
        if m and not m.group(1).startswith('paste'): return m.group(1)
    return None

def rm(p):
    try: os.remove(p)
    except OSError: pass

def ffmpeg(*args):
    subprocess.run([FF, '-y', '-loglevel', 'error', *args], check=True)

# ── wav plumbing (everything inside is 44.1 kHz stereo 16-bit; one encode at the end)
def to_wav(src, dst, ss=None, t=None, loud=True):
    pre = []
    if ss is not None: pre += ['-ss', f'{ss:.3f}']
    if t is not None: pre += ['-t', f'{t:.3f}']
    af = ['-af', LOUD] if loud else []
    ffmpeg(*pre, '-i', src, '-vn', *af, '-ac', str(CH), '-ar', str(SR), '-c:a', 'pcm_s16le', dst)

def wav_seconds(path):
    with wave.open(path) as w: return w.getnframes() / w.getframerate()

def write_wav(path, frames_bytes):
    with wave.open(path, 'wb') as w:
        w.setnchannels(CH); w.setsampwidth(2); w.setframerate(SR); w.writeframes(frames_bytes)

def read_wav(path):
    with wave.open(path) as w:
        assert w.getnchannels() == CH and w.getframerate() == SR and w.getsampwidth() == 2, path
        return w.readframes(w.getnframes())

def fit_wav(path, seconds):
    """Pad with silence, or trim, so the file is exactly `seconds` long."""
    want = int(round(seconds * SR)) * CH * 2
    b = read_wav(path)
    b = b[:want] if len(b) >= want else b + bytes(want - len(b))
    write_wav(path, b)

def silence_bytes(seconds): return bytes(int(round(seconds * SR)) * CH * 2)

def envelope_from_bytes(b, fps):
    n = len(b) // (CH * 2)
    if n == 0: return []
    # streamed (10-28): unpacking a 36-minute mix into one Python tuple took ~5 GB and got the mix killed; the left channel
    # is read frame by frame with the array module instead, a few thousand samples at a time
    import array
    per = max(1, int(SR / fps)); env = []
    stride = CH * 2
    for i in range(0, n, per):
        m = min(per, n - i)
        chunk = array.array('h'); chunk.frombytes(b[i * stride:(i + m) * stride])
        mono = chunk[::CH]
        rms = math.sqrt(sum(x * x for x in mono) / max(1, len(mono))) / 32768.0
        env.append(rms)
    peak = max(env) or 1.0
    env = [min(1.0, (v / peak) ** 0.6) for v in env]
    sm = []
    for i, v in enumerate(env):
        sm.append(max(v, env[i - 1] * 0.6 if i else 0))   # a little smoothing so the jaw doesn't chatter
    return sm

# ── the voice
def eleven(text, voice, api_key):
    """Returns (mp3 bytes, words:[{w,s,e}] relative to the clip) using the with-timestamps endpoint."""
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice['voice_id']}/with-timestamps?output_format=mp3_44100_128"
    body = json.dumps({
        'text': text, 'model_id': voice.get('model_id', 'eleven_multilingual_v2'),
        'voice_settings': { 'stability': voice.get('stability', 0.45), 'similarity_boost': voice.get('similarity', 0.8), 'style': voice.get('style', 0.2), 'use_speaker_boost': True },
    }).encode()
    req = urllib.request.Request(url, data=body, headers={'xi-api-key': api_key, 'content-type': 'application/json'})
    ctx = None   # python.org's Python on a Mac has no root certificates of its own; certifi's bundle stands in (as the rip script does)
    try:
        import ssl, certifi; ctx = ssl.create_default_context(cafile=certifi.where())
    except Exception: pass
    with urllib.request.urlopen(req, timeout=120, context=ctx) as r:
        j = json.loads(r.read())
    audio = base64.b64decode(j['audio_base64'])
    al = j.get('alignment') or j.get('normalized_alignment') or {}
    chars, starts, ends = al.get('characters', []), al.get('character_start_times_seconds', []), al.get('character_end_times_seconds', [])
    words, cur, s0, last = [], '', None, 0
    for c, s, e in zip(chars, starts, ends):
        if c.isspace():
            if cur: words.append({'w': cur, 's': s0, 'e': e}); cur, s0 = '', None
        else:
            if s0 is None: s0 = s
            cur += c; last = e
    if cur: words.append({'w': cur, 's': s0, 'e': last})
    return audio, words

def estimate_words(text, start):
    ws = text.split(); dur = len(ws) / 2.6; t = start; out = []
    for w in ws:
        d = dur * (len(w) + 1) / (len(text) + len(ws)); out.append({'w': w, 's': t, 'e': t + d}); t += d
    return out, dur

def srt(beats, path):
    def ts(t):
        h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
        return f"{h:02d}:{m:02d}:{int(s):02d},{int((s - int(s)) * 1000):03d}"
    lines = []; n = 1
    for b in beats:
        ws = b.get('words') or []; i = 0
        while i < len(ws):
            chunk = ws[i:i + 7]
            lines.append(f"{n}\n{ts(chunk[0]['s'])} --> {ts(chunk[-1]['e'])}\n{' '.join(w['w'] for w in chunk)}\n"); n += 1; i += 7
    open(path, 'w').write('\n'.join(lines))

def main():
    if len(sys.argv) < 2: print(__doc__); sys.exit(1)
    sid = sys.argv[1]; dry = '--dry' in sys.argv
    ep = json.load(open(os.path.join(ROOT, 'data', 'show', sid + '.json')))
    out = os.path.join(ROOT, 'data', 'show', sid); bdir = os.path.join(out, 'beats'); os.makedirs(bdir, exist_ok=True)
    fps = ep.get('fps', 24); voice = ep.get('voice', {})
    q = lambda s: math.ceil(s * fps - 1e-6) / fps      # up to the next whole frame
    clips_dir = os.path.join(WORKSPACE, ep.get('clipsDir', 'Transcripts/show/ep01/clips'))
    api = None if dry else key()
    blocks = ep.get('blocks') or [{'id': 'all', 'title': ep.get('segment', ''), 'clip': True, 'beats': ep['beats']}]
    flat = [(blk, bt) for blk in blocks for bt in blk['beats']]
    if not dry and any(b.get('type', 'text') == 'text' for _, b in flat):
        if not api: print('no ELEVENLABS_API_KEY — run with --dry, or add the key (see the docstring)'); sys.exit(2)
        if not voice.get('voice_id'): print('voice.voice_id is empty in the episode json — paste the clone\'s id (see the docstring)'); sys.exit(2)
    ids = [b['id'] for _, b in flat]
    if len(set(ids)) != len(ids): print('beat ids must be unique across blocks'); sys.exit(2)

    t = q(LEAD); timeline = []; mix = [silence_bytes(t)]; voice_only = [silence_bytes(t)]; block_times = {}
    for blk, b in flat:
        kind = b.get('type', 'text'); words = []; entry = {'id': b['id'], 'block': blk['id'], 'type': kind}
        tmp = os.path.join(bdir, f"{b['id']}.wav")
        if kind == 'text':
            mp3 = os.path.join(bdir, f"{b['id']}.mp3"); meta = os.path.join(bdir, f"{b['id']}.json")
            if dry:
                words, dur = estimate_words(b['text'], 0); dur = q(dur)
                write_wav(tmp, silence_bytes(dur))
            else:
                cached = None
                if os.path.exists(mp3) and os.path.exists(meta):
                    try:
                        m = json.load(open(meta))
                        if m.get('text') == b['text'] and m.get('voice_id') == voice.get('voice_id'): cached = m
                    except Exception: cached = None
                if cached: words = cached['words']
                else:
                    audio, words = eleven(b['text'], voice, api); open(mp3, 'wb').write(audio)
                    json.dump({'text': b['text'], 'voice_id': voice.get('voice_id'), 'words': words}, open(meta, 'w'))
                to_wav(mp3, tmp); dur = q(wav_seconds(tmp)); fit_wav(tmp, dur)
            words = [{'w': w['w'], 's': t + w['s'], 'e': t + w['e']} for w in words]
            part = read_wav(tmp); mix.append(part); voice_only.append(part)
            gap = q(b.get('gap', BREATH))
        elif kind == 'clip':
            dur = q(b['out'] - b['in']); src = os.path.join(clips_dir, b['src'] + '.mp4')
            if not os.path.exists(src): print(f"missing clip file {src} — run 'Rip Episode One Clips.command'"); sys.exit(3)
            to_wav(src, tmp, ss=b['in'], t=dur + 0.25); fit_wav(tmp, dur)
            part = read_wav(tmp); mix.append(part); voice_only.append(silence_bytes(dur))
            for k in ('src', 'in', 'out', 'layout', 'piece', 'line', 'lines', 'lower'):
                if k in b: entry[k] = b[k]
            gap = q(b.get('gap', 0))
        else:   # land, hold: silence
            dur = q(b.get('dur', 1.5)); mix.append(silence_bytes(dur)); voice_only.append(silence_bytes(dur))
            for k in ('piece', 'line', 'orbit', 'zoom'):
                if k in b: entry[k] = b[k]
            gap = q(b.get('gap', 0))
        rm(tmp)
        entry.update({'start': t, 'end': t + dur, 'words': words})
        timeline.append(entry)
        bt_ = block_times.setdefault(blk['id'], {'id': blk['id'], 'title': blk.get('title', ''), 'clip': bool(blk.get('clip')), 'start': t, 'end': t + dur}); bt_['end'] = t + dur
        print(f"  {b['id']:<18} {kind:<5} {t:7.2f} → {t + dur:7.2f}" + (f"  ({len(words)} words)" if words else f"  ({b['src']} {b['in']}–{b['out']})" if kind == 'clip' else ''))
        t += dur
        if gap > 0: mix.append(silence_bytes(gap)); voice_only.append(silence_bytes(gap)); t += gap

    mixw = os.path.join(out, 'audio.wav'); voxw = os.path.join(out, 'voice.wav')
    write_wav(mixw, b''.join(mix)); write_wav(voxw, b''.join(voice_only))
    ffmpeg('-i', mixw, '-c:a', 'libmp3lame', '-b:a', '192k', os.path.join(out, 'audio.mp3'))
    ffmpeg('-i', voxw, '-c:a', 'libmp3lame', '-b:a', '128k', os.path.join(out, 'voice.mp3'))
    duration = wav_seconds(mixw)
    env = [] if dry else envelope_from_bytes(b''.join(voice_only), fps)
    rm(mixw); rm(voxw)
    json.dump({'schema': 'show/timeline/v2', 'duration': duration, 'fps': fps, 'beats': timeline, 'blocks': list(block_times.values()), 'envelope': env, 'dry': dry}, open(os.path.join(out, 'timeline.json'), 'w'))
    srt(timeline, os.path.join(out, 'captions.srt'))
    print(f"audio {duration:.2f}s ({round(duration * fps)} frames at {fps}) → {out}/audio.mp3\nvoice → {out}/voice.mp3\ntimeline → {out}/timeline.json" + ("  (dry: the voice is silence, no envelope)" if dry else ""))

if __name__ == '__main__':
    main()
