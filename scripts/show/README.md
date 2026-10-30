# The Parallelogram Report — the show pipeline

Ted at a desk in the Plaza of the Dream Getty, the parallelogram hung in the air behind him, his voice synthesized from Sailor's.
Three steps; each one's file says how to run it at the top.

```
data/show/<episode>.json          the episode: blocks of beats — text (Ted speaks), clip (a cut from a clip file), land (the map alone)
        │
        ▼
scripts/show/tts.py <episode>     the sound → data/show/<episode>/audio.mp3 (voice + clip sound, mixed), voice.mp3, timeline.json, captions.srt
        │                          (--dry: the voice becomes silence of the estimated length; the clip sound is still real)
        ▼
dreamgetty/?show=<episode>        the set — opens in a browser to play; under &capture=1 it steps by SHOW.seek(t)
        │
        ▼
scripts/show/render.js <episode>  Chrome steps the set's frames → ffmpeg; the clips are cut in by ffmpeg → data/show/<episode>/<episode>_16x9.mp4
```

## The episode file (v2, 2026-10-25)
`blocks: [{ id, title, chrome: 'full'|'bug', clip: true|false, beats: [...] }]`. Beat ids are unique across the episode. Beat types:
- **text** `{ text, caption, map: { reveal, focus, orbit, zoom, paths, trace }, ted: 'camera'|'map' }` — one voice call; the words light up as spoken.
- **clip** `{ src, in, out, layout: 'full', piece, line }` — `src` is a file stem in `clipsDir` (the workspace's `Transcripts/show/ep01/clips/`), `in`/`out` are seconds inside that file. `piece` + `line` name the press line this cut *is*, so it lands on the map as it plays. `clips[src].in` is the second on the source tape where the clip file starts (a press line's `t` → clip-local `t − in`). `lower: [who, what]` overrides the lower third (otherwise the piece's name and program).
- **land** `{ dur, piece, line, orbit, zoom }` — the map alone on a dark card, the stage camera, the line's dot dropping in with its Dia on a card.
`pieces` lists every press piece on the map (each dot in its station colour; `piece` on v1 episodes still works). `chrome: 'bug'` shows only the bug and the spoken words (the cold open). `endHold` = seconds held after the last beat (3 by default). `fps` 30 for episode one (the clips are 25 and 29.97).
Cuts are hard. Every beat is padded to whole frames by `tts.py` so the renderer's cuts fall exactly where the sound does; `gap` seconds of silence after a beat (0.55 after a text beat, 0 after a clip or a landing).

## The voice and the sound
- `tts.py` voices text beats at ElevenLabs (one call each, with word timestamps) and caches them in `beats/<id>.mp3` + `.json`: a beat is voiced again only when its text changes. Clip beats take their sound from the clip file; landings are silence. Every part is loudness-matched (`loudnorm` to −16 LUFS) and padded to the frame grid, then mixed into `audio.mp3`. `voice.mp3` is the voice alone; the jaw envelope reads that one, so Ted's mouth is still during clips.
- The clone lives at ElevenLabs (Voices → Add → Instant or Professional Voice Clone; it is Sailor's voice, so the consent recording is his). Paste the voice id into the episode json (`voice.voice_id`) and the key into `scripts/secrets.local.js` as `ELEVENLABS_API_KEY`. On the Mac, python.org's Python needs certifi for the TLS call; `tts.py` finds it itself.
- The end card says the voice is synthesized. Keep it; YouTube and X ask for the disclosure.
- Other providers plug in at `eleven()` in tts.py: anything that returns audio + word times fits.

## The set
- **The desk in the Plaza (the default)**: `dreamgetty/dream-news.js`, loaded last by the villa and dormant without `?show=<episode>`. The floating desk, Ted seated at it, the current graphmap factory hung at the pedestal with every piece's lines as dots, the camera pinned. Chyron, subtitles, the tape (`chrome: 'full'`), or just the bug (`chrome: 'bug'`).
- **Clip beats** (`layout: 'full'`): in the browser the `<video>` plays full-frame with a lower third (name · station · show · date) and the bug; under capture the renderer composites the clip itself and asks the page only for the lower third as markup (`SHOW.overlayHTML(beatId)`).
- **Landing beats**: the map flies to its spot beside the desk, the desk is hidden, an opaque dark card hangs behind the plane, and the camera renders only the stage's layer (the villa draws its statue and pictures with depth testing off, so they'd show through otherwise). The line's dot drops in at 3× and settles; the card shows Dia, the name, the station, the show, the quote.
- **Checking a frame:** `node scripts/show/step.js ep01 309.4 316 310 313.9` steps the set every frame from 309.4 s to 316 s the way the renderer does and screenshots the moments listed (`data/show/ep01/stills/`), printing `SHOW.dbg()` at each (the map's wanted and actual pose, the desk spot, the map's position in the desk's frame). Step; don't jump: the villa's own loop settles every pose between jumps and hides what continuous stepping (and the load order) shows.
- Open: `http://localhost:5500/Prism/dreamgetty/?show=ep01&aspect=16:9` with the workspace served from its root (`Serve the Workspace.command`, range-capable so the clips seek), press play (top-left). The browser plays `audio.mp3` (the mix); the clip video stays muted.
- `show/index.html` (`--set desk`) is the earlier black-box set and the fallback; it knows nothing of clip beats.
- `src/js/prism-graphmap.js` is read by the set, never written: all the show's additions live in `dream-news.js`.

## The export
- `render.js` needs node, puppeteer (in `Prism/node_modules`), Chrome and ffmpeg. On the Mac it finds `/Applications/Google Chrome.app` and imageio-ffmpeg's ffmpeg (`pip install --user imageio-ffmpeg`) by itself; `PUPPETEER_EXECUTABLE_PATH` / `FFMPEG` override. Run `tts.py` first.
- **The GPU**: headless Chrome renders on Metal (`--use-angle=metal`) — ~0.35 s a frame at 1920×1080 on an M1 Air (the sandbox's SwiftShader was ~4 s). `--software` for SwiftShader, `--window` for a visible Chrome if headless can't reach the GPU.
- The page's frames are piped straight into ffmpeg (nothing written to disk but the segment files); clip spans are cut from the clip files on the show's frame grid with the lower third laid over; the segments are joined and the mix is muxed on. `--keep` keeps `data/show/<id>/segments/`.
- `--quick` (every 4th frame, everywhere) and `--scale .5` are for looking; `--clip <blockId>` renders one block as its own file (`<id>_16x9_<block>.mp4`: 0.4 s before the block to 0.6 s after); `--to <blockId>` renders from the top through that block's end + 0.6 s under the plain file name, for a cut of the episode's head before the rest is written. A long block is 35–80 minutes on the Air (0.35 s a frame cool, 0.65 throttled), so render block by block and let the machine breathe between.
- Output is H.264 yuv420p + AAC with faststart: upload as-is.
- If a run dies, kill stale headless Chromes before the next (`pkill -f remote-debugging-pipe`); a leftover one can keep the page from loading.

## Episode one
- `ep01` — blocks 1–5 so far: the cold open (four clip beats with landings, then Ted's "Can you do two more years of this?"), the welcome (four text beats; the elephant walks through the background on the first), you deserve better (14 text beats) and the modes (22 text beats; the three "moments" beats carry `piece` + `map.focus` so the landed dot swells and the chyron names the show). The script is `data/show/ep01_script_v1.md`; blocks 6–7 are still to be written into `ep01.json` (the three moments scored, the Ledger + sign-off). Rendered (2026-10-25): `data/show/ep01/ep01_16x9.mp4` (blocks 1–3, `--to welcome`, re-rendered 2026-10-26 after the DESK_SPOT fix), `ep01_16x9_better.mp4`, `ep01_16x9_modes.mp4` and `ep01_16x9_welcome.mp4` (blocks 4, 5 and 2 as their own clips, `--clip`). The timeline is one file: a `--clip` render cuts the block's span out of it, so re-run `tts.py` before any render when the episode changes.
- **The elephant** (`dreamgetty/dream-elephant.js`, loaded by the set only when a beat asks): a beat with `elephant: { from: [x, z], to: [x, z], lead, span }` (desk-local units; x right, z toward the camera) walks it along that line over the beat, its feet on the villa's ground. The desk camera is a long lens (about 18° effective), so "the background" is 20 units back at most — the villa's mountain mesh stands behind that and would swallow it. Episode one's path: `[15, −21.5] → [−15, −19]`, behind the desk and the map, legs hidden by the desk until it reaches the galleria at frame left.
- `ep01_reduced_diesel` — The Diesel Deal, Reduced (the first piece in `data/press/`), a v1 episode; still renders.
- Clip in/out points came from YouTube's word-level auto-captions (`Transcripts/show/ep01/clipsubs_*.en-orig.vtt`, pulled with yt-dlp) and were snapped to the nearest pause in the clip's own audio.
