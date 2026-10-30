# Fukuyama runs — uncut, through Prism (2026-10-21)

The two Charlie Rose interviews, each played uncut with Prism running live behind them: the black
studio is keyed out, the graphmap hangs in the void, words are caught out of the speech as they're
said, and each scored line lands on the plane when the speaker finishes it. Source material for us,
not a cut. Scores are **Claude drafts** — proposals for Sailor's ruling.

Open: double-click `Serve the Workspace.command`, then
`http://localhost:5500/Prism/runs/fukuyama/?y=1992` (or `?y=2011`). If the recording doesn't load
(the simple local server can't stream large files to every browser), press **Choose recording** and
pick the MP4 from the PARALLELOGRAM PRISM folder. Keys: space · ←/→ · H hides the controls · L opens the Layers panel · 1/2.

**Layers.** The figures (the keyed recording) and the graphmap are separate layers. Auto layout opens on the
full frame, then pulls the figures down to ~60% and puts the map in the void over their shoulders. Touch any
control and you take over: size, position and edge fade for the figures; cut-out level and softness for the key;
size, position, tilt, turn and strength for the map; map in front or behind. Drag on the picture to move the
chosen layer, scroll to resize it. Your manual layout is remembered per run; Reset goes back to the default.

| Run | Recording | Lines | Dia | Read z | Lumens |
|---|---|---|---|---|---|
| 1992 · The End of History | `ScreenRecording_10-21-2026 17-09-18_1.MP4` | 34 (FF 23 · CR 11) | 18 | +0.36 | 68 |
| 2011 · The Origins of Political Order | `ScreenRecording_10-21-2026 17-37-19_1.MP4` | 30 (FF 22 · CR 8) | 15 | +0.03 | 57 |

Fukuyama is Dia 12 in both years; his read z falls from +0.50 (1992) to +0.05 (2011).

## How it was made
- Timing: the transcripts were aligned to each recording's own audio (offline speech recognition,
  90%+ of words matched; the rest interpolated), so every line and word has an in/out time.
- Scoring: one line per substantive turn, Press grammar (`[pos, who@station, touch, z, Dia, mode, note]`),
  placed by `press-build.py`'s rule (station quadrant, radius by Dia). Charlie's questions are scored too
  (diamonds), so the host's frames sit beside the guest's answers.
- One declared object per run, so every z is about the same thing:
  - 1992 — *liberal democracy as the end point*: +1 it has no serious rival or fatal flaw ↔ −1 one undoes it.
  - 2011 — *durable political institutions*: +1 the democratic impulse becomes institutions that deliver ↔ −1 the gap stays open.

## Calls that were mine (for ruling)
- Stations: Charlie @LI in both; Fukuyama **@RI in 1992** (Reagan/Bush State Department) and **@LI in 2011**
  (after his break with the neoconservatives). The move is visible on the map; it's a parameter call, so it's yours.
- The two declared objects and Z wordings above.
- Transcript fixes: "third country B.C." → century; "surge divergent" → such divergent; the cut-off Tata answer
  and the mislabelled "Ok:" turn (2011 lines 38–39) are left as transcribed.

Files: `index.html` (the run), `run_1992.js` / `run_2011.js` (lines, scores, aligned transcript), `score.py` (the scoring source).

## The feature cut (2026-10-23) — `feature.js`
One feature, 1992 then 2011 back to back. Open `?y=1992&cut=feature`: the 1992 context opening plays, then only the
chosen segments (gold bands on the scrub bar; the clock shows feature time and tape time). When 1992 ends, the player
loads 2011 on its own, and the 2011 context opening (9/11, Iraq, the Orange Revolution, the 2008 crash, the Arab Spring)
is the bridge between the tapes. 1992: 12 segments, 8:18. 2011: 8 segments, 7:33. Each segment lists its lines and why
it's in. The uncut runs (`?y=1992`, `?y=2011`) are unchanged.

## The word thread (2026-10-23) — `words.js`
From The Parallelogram Report, episode one: "communism" and "fascism" get used as charges instead of as names for
modes of political economy. Every use on both tapes is tagged:
- **a name** — the word points at how a system works: who owns, who plans, how power is held.
- **a charge** — the word passes a verdict (a losing side, a boot, a pedigree) and says nothing about how it works.
A chip over the caption shows the word, the reading and one plain sentence as it's said. W hides it; `&nowords` turns it off.
Readings are Claude drafts.

## The camera, the z planes, Thymos, photos (2026-10-26)
- **Camera (auto):** a function of tape time, so an export matches playback. Between lines: a high three-quarter view
  (about 34° above the plane) that turns slowly the whole time. While a line is said: the map swings in on where it lands.
  As it lands: the view drops near the plane's level, from the side, and pulls back so its height reads against both planes.
- **Z planes:** translucent planes at z +1 ("Realized") and z −1 ("Frustrated"), each with its word set into it. The flat
  lettering flips to stay upright as the map turns; in side views upright labels take over.
- **Thymos:** appears over Fukuyama's dot on the Realized plane at 1992 lines 18 and 54, marked as his word.
- **Photos in the opening (`photos.js`, `photos/`):** each event's still lies on its plane while it drops in. Iran-Contra's
  split shows North above (the good-faith reading) and the hearing room below (the contradictions). Stills so far:
  Iran-Contra and the Berlin Wall; the other events still need footage.
- Pre-change copy: `Prism/archive/runs_fukuyama_index_2026-10-26_pre-camera.html`.
