# Dream News — the show pipeline

Ted at a desk in the Plaza of the Dream Getty, the parallelogram hung in the air behind him, his voice synthesized from Sailor's.
Three steps; each one's file says how to run it at the top.

```
data/show/<episode>.json          the episode: beats (script text, caption, map cues, where Ted looks)
        │
        ▼
scripts/show/tts.py <episode>     the voice → data/show/<episode>/audio.mp3, timeline.json, captions.srt
        │                          (--dry: silence of the right length, for layout work without a key)
        ▼
show/index.html?s=<episode>       the set — opens in a browser to play; under &capture=1 it steps by SHOW.seek(t)
        │
        ▼
scripts/show/render.js <episode>  headless frames → ffmpeg → data/show/<episode>/<episode>_9x16.mp4 (or 16x9)
```

## The voice
- The clone lives at ElevenLabs. Make it from the account page (Voices → Add → Instant or Professional Voice
  Clone); it is Sailor's own voice, so the consent recording is his. Paste the voice id into the episode json
  (`voice.voice_id`) and the key into `scripts/secrets.local.js` as `ELEVENLABS_API_KEY`.
- Every beat is one call to the with-timestamps endpoint, so the words light up on screen as they're spoken and
  the jaw moves on the real audio envelope.
- The end card says the voice is synthesized. Keep it; YouTube and X ask for the disclosure.
- Other providers plug in at `eleven()` in tts.py: anything that returns audio + word times fits.

## The set
- **Dream News (the default)**: `dreamgetty/dream-news.js`, loaded last by the villa and dormant without `?show=<episode>`. A modern desk that floats over the Plaza paving with nothing under it (the pedestal's kind of impossible), Ted seated at it, a dark glass pane and the piece's graphmap hung in front of it, the camera pinned, the villa's HUD hidden. Chyron (The Reduced tag · headline · piece), subtitles, the tape. Open: `http://localhost:5500/Prism/dreamgetty/?show=ep01_reduced_diesel` (`&aspect=16:9`), press play (top-left). The villa's own `buildCoyote` is the anchor; the roaming Ted stands down while the show is on.
- **The black-box set** (`show/index.html`, `--set desk`) is the earlier version and the fallback.
- `show/index.html` draws two canvases: the factory graphmap (`PrismGraphmap.create`, the press piece loaded
  through `loadTrace` + `addDot`, every line hidden until its beat reveals it) and Ted (`PrismGraphmap.buildCoyote`)
  seated behind a desk on a transparent canvas in front. Masthead, scoreboard tiles, lower third, spoken words,
  and the ticker (every scored line of the piece) are HTML over them.
- 9:16 (1080×1920) is the default; `&aspect=16:9` gives 1920×1080 with Ted on the right.
- Open it by hand with the workspace served (`Serve the Workspace.command`): `http://localhost:5500/Prism/show/?s=ep01_reduced_diesel`
  and press play. With audio.mp3 present it plays with the voice.

## The export
- `render.js` needs puppeteer and a Chrome. Puppeteer's own Chrome download is blocked from the Mac VM and the
  sandbox; in the sandbox Playwright's Chromium works (`pip install playwright && python3 -m playwright install chromium-headless-shell`,
  then `PUPPETEER_EXECUTABLE_PATH=$(python3 -c "from playwright.sync_api import sync_playwright as s
  p=s().start();print(p.chromium.executable_path)")`). Any real Chrome works too.
- Software GL is slow: ~3 s a frame at 1080×1920. `--quick` (every 4th frame) and `--scale .5` are for looking;
  the posting render runs unattended (~2.5 h for a 2-minute segment).
- Output is H.264 yuv420p + AAC with faststart: upload as-is to Reels, Shorts, TikTok, X, YouTube.

## Episode one
- `ep01_reduced_diesel` — The Diesel Deal, Reduced (the first piece in `data/press/`). Dry timing runs ~2 min;
  the 90-second cut means tightening the scoreboard and gap beats, or letting the clone read faster than 2.6 words/s.
- The Shapiro / Roadster piece comes once it's cut into `data/press/`; the episode json is the only thing to write.
