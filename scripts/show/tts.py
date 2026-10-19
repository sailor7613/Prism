#!/usr/bin/env python3
"""
The voice — one audio file per beat, concatenated, with the timing the set needs.

  python3 scripts/show/tts.py ep01_reduced_diesel            # ElevenLabs, Sailor's cloned voice
  python3 scripts/show/tts.py ep01_reduced_diesel --dry      # silence of the right length (no key needed)

Reads   data/show/<id>.json           (the beats; voice.voice_id)
Writes  data/show/<id>/beats/<n>_<id>.mp3
        data/show/<id>/audio.mp3      (all beats, a short breath between)
        data/show/<id>/timeline.json  { duration, fps, beats:[{id,start,end,words:[{w,s,e}]}], envelope:[0..1 per frame] }
        data/show/<id>/captions.srt

The key: ELEVENLABS_API_KEY in the environment, or ELEVENLABS_API_KEY in scripts/secrets.local.js.
The voice: make the clone at elevenlabs.io (Voices → Add → Instant/Professional Voice Clone — it is your
voice, so it asks for your consent recording), copy the voice id into data/show/<id>.json → voice.voice_id.
The end card says the voice is synthesized; keep it there.
"""
import json, os, re, sys, base64, subprocess, struct, wave, math, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # Prism/
BREATH = 0.55   # seconds between beats

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
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *args], check=True)

def ffprobe_duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], capture_output=True, text=True, check=True).stdout.strip()
    return float(out)

def eleven(text, voice, api_key):
    """Returns (mp3 bytes, words:[{w,s,e}]) using the with-timestamps endpoint."""
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice['voice_id']}/with-timestamps?output_format=mp3_44100_128"
    body = json.dumps({
        'text': text, 'model_id': voice.get('model_id', 'eleven_multilingual_v2'),
        'voice_settings': { 'stability': voice.get('stability', 0.45), 'similarity_boost': voice.get('similarity', 0.8), 'style': voice.get('style', 0.2), 'use_speaker_boost': True },
    }).encode()
    req = urllib.request.Request(url, data=body, headers={'xi-api-key': api_key, 'content-type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        j = json.loads(r.read())
    audio = base64.b64decode(j['audio_base64'])
    al = j.get('alignment') or j.get('normalized_alignment') or {}
    chars, starts, ends = al.get('characters', []), al.get('character_start_times_seconds', []), al.get('character_end_times_seconds', [])
    words, cur, s0 = [], '', None
    for c, s, e in zip(chars, starts, ends):
        if c.isspace():
            if cur: words.append({'w': cur, 's': s0, 'e': e}); cur, s0 = '', None
        else:
            if s0 is None: s0 = s
            cur += c; last = e
    if cur: words.append({'w': cur, 's': s0, 'e': last})
    return audio, words

def silence(seconds, path):
    ffmpeg('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', f'{seconds:.3f}', '-c:a', 'libmp3lame', '-b:a', '96k', path)

def estimate_words(text, start):
    ws = text.split(); dur = len(ws) / 2.6; t = start; out = []
    for w in ws:
        d = dur * (len(w) + 1) / (len(text) + len(ws)); out.append({'w': w, 's': t, 'e': t + d}); t += d
    return out, dur

def envelope(mp3, fps):
    wav = mp3[:-4] + '.env.wav'
    ffmpeg('-i', mp3, '-ac', '1', '-ar', '8000', '-f', 'wav', wav)
    with wave.open(wav) as w:
        n = w.getnframes(); raw = w.readframes(n); sr = w.getframerate()
    rm(wav)
    samples = struct.unpack('<%dh' % (len(raw) // 2), raw)
    per = max(1, int(sr / fps)); env = []
    for i in range(0, len(samples), per):
        chunk = samples[i:i + per]
        rms = math.sqrt(sum(x * x for x in chunk) / max(1, len(chunk))) / 32768.0
        env.append(rms)
    peak = max(env) or 1.0
    env = [min(1.0, (v / peak) ** 0.6) for v in env]
    # a little smoothing so the jaw doesn't chatter
    sm = []
    for i, v in enumerate(env):
        sm.append(max(v, env[i - 1] * 0.6 if i else 0))
    return sm

def srt(beats, path):
    def ts(t):
        h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
        return f"{h:02d}:{m:02d}:{int(s):02d},{int((s - int(s)) * 1000):03d}"
    lines = []; n = 1
    for b in beats:
        ws = b['words']; i = 0
        while i < len(ws):
            chunk = ws[i:i + 7]
            lines.append(f"{n}\n{ts(chunk[0]['s'])} --> {ts(chunk[-1]['e'])}\n{' '.join(w['w'] for w in chunk)}\n"); n += 1; i += 7
    open(path, 'w').write('\n'.join(lines))

def main():
    if len(sys.argv) < 2: print(__doc__); sys.exit(1)
    sid = sys.argv[1]; dry = '--dry' in sys.argv
    ep = json.load(open(os.path.join(ROOT, 'data', 'show', sid + '.json')))
    out = os.path.join(ROOT, 'data', 'show', sid); os.makedirs(os.path.join(out, 'beats'), exist_ok=True)
    fps = ep.get('fps', 24); voice = ep.get('voice', {})
    api = None if dry else key()
    if not dry and not api: print('no ELEVENLABS_API_KEY — run with --dry, or add the key (see the docstring)'); sys.exit(2)
    if not dry and not voice.get('voice_id'): print('voice.voice_id is empty in the episode json — paste the clone\'s id (see the docstring)'); sys.exit(2)

    t = 0.4; timeline = []; parts = []
    for n, b in enumerate(ep['beats']):
        path = os.path.join(out, 'beats', f"{n:02d}_{b['id']}.mp3")
        if dry:
            words, dur = estimate_words(b['text'], t); silence(dur, path)
        else:
            audio, words = eleven(b['text'], voice, api); open(path, 'wb').write(audio)
            dur = ffprobe_duration(path); words = [{'w': w['w'], 's': t + w['s'], 'e': t + w['e']} for w in words]
        timeline.append({'id': b['id'], 'start': t, 'end': t + dur, 'words': words}); parts.append((path, dur))
        print(f"  {b['id']:<12} {t:7.2f} → {t + dur:7.2f}  ({len(words)} words)")
        t += dur + BREATH

    # concat with the breaths as silence
    lst = os.path.join(out, 'concat.txt'); gap = os.path.join(out, 'beats', 'breath.mp3'); lead = os.path.join(out, 'beats', 'lead.mp3')
    silence(BREATH, gap); silence(0.4, lead)
    with open(lst, 'w') as f:
        f.write(f"file '{lead}'\n")
        for i, (p, _) in enumerate(parts):
            f.write(f"file '{p}'\n")
            if i < len(parts) - 1: f.write(f"file '{gap}'\n")
    audio_path = os.path.join(out, 'audio.mp3')
    ffmpeg('-f', 'concat', '-safe', '0', '-i', lst, '-c:a', 'libmp3lame', '-b:a', '128k', audio_path)
    rm(lst)
    duration = ffprobe_duration(audio_path)
    env = [] if dry else envelope(audio_path, fps)
    json.dump({'duration': duration, 'fps': fps, 'beats': timeline, 'envelope': env, 'dry': dry}, open(os.path.join(out, 'timeline.json'), 'w'))
    srt(timeline, os.path.join(out, 'captions.srt'))
    print(f"audio {duration:.1f}s → {audio_path}\ntimeline → {out}/timeline.json" + ("  (dry: silence, no envelope)" if dry else ""))

if __name__ == '__main__':
    main()
