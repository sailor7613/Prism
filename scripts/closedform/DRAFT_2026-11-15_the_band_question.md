# Draft — the band question, taken apart
*2026-11-15, late · drafted by Claude for Sailor · NOT applied. The grid run of 11-15 evening is still using the questions as they stand; nothing in `derive.py` or `parallelogram.py` changes until that run has finished.*

## Why

The 11-15 evening run reworded the "others" question (what is in the line, not what the speaker meant) and took out the "most speech is working" default. Tier agreement among Sonnet, Qwen and Gemma did not move (Tucker 40% → 43%, the Crystal 61% → 58%) and the middle gap in Dia widened (Tucker 23.5 → 34 points).

Reading each reader's own reasons on the split lines showed three separate causes:

1. **The pattern library steers Qwen.** Every scoring question carries the whole library of named patterns (about 6,000 tokens). Qwen finds a pattern to pin on a line and lets it set the band. Its reason for "Thank God." was "treats the political outcome as aesthetic spectacle"; its three runs on that line were 15, 71, 75.
2. **The question shows the Object as it is now, not as it was.** The facts block gives each measure's latest reading. Qwen read "War is simply not in the cards" (November 2024) as "dismisses the reality of the war", a war that began in 2026.
3. **A three-way choice has a middle.** Gemma softens verdicts to "working" ("He's not interested in the details" → "a critique") and promotes bare facts to arguments.

Asked only "closed or not", the three agree on 69% of lines (Sonnet and Gemma 85%). Open against working is where they scatter.

## The draft: three changes, tested together

### 1. Two yes-or-no questions in place of one three-way question

The reader no longer picks open, working or closed. It answers two questions about the words of the line, and Python picks the band.

```
"verdict": true|false
   Does the line pass a verdict on the people on the other side: say what they really want, what kind of
   people they are, that they lie, or that whatever they answer does not count?
   A claim about the object is not a verdict on people, however sure it sounds.
     'The tariff is a tax.'                              false
     'A tariff this size is simply not going to happen.' false   (sure of itself, but about the object)
     'Thank goodness.'                                   false
     'Anyone defending the tariff is lying or bought.'   true
     'He is not interested in the details.'              true

"reason": true|false
   Does the line do more than state? True if the line itself gives its own because (a cause, or a
   consequence that would follow), or speaks to someone directly (a call, an instruction, a question put to them).
   Judge only the words of this line. A fact with no because, no consequence and nobody addressed is false,
   even if the lines around it use it as an argument.
     'Imports cost more this year than last.'                               false
     'The tariff will raise prices, because importers pass the cost on.'    true
     'Call your senator and tell him to vote no.'                           true
```

```python
# derive.py — the band from two answers (the rest of the rules are unchanged)
others = 'closed' if a.get('verdict') else 'working' if a.get('reason') else 'open'
```

The examples are about a tariff on purpose: none of them is a line from a record the grid reads.

### 2. Each line is shown the Object as it stood on the line's own date

Now: one facts block for the whole chunk, each measure at its latest reading.
Draft: the facts block names what is measured, without values. Each line carries its own reading:

```python
# parallelogram.py — relational_prompt, per line
rd = reading_at(G, l['measure'], l['date'])            # the last reading on or before the line's date
line['then'] = f"{measure_label}: {rd['z']:+.2f} on {rd['date']}" if rd else 'no reading of this measure by that date'
```

And one sentence in the question: "Judge each line against what was known on its own date. Nothing that happened later may count for or against it."

### 3. The pattern library leaves the band question

Now: band and patterns are asked in one call, with the library in front of the reader the whole time.
Draft: two calls.
- **Call A (short):** the two yes-or-no questions, capital, substance or signal, facing. No library.
- **Call B:** the library and the lines; the reader names only patterns plainly present. Asked after A, never shown A's answers.

Python combines them as it does now: the band from A, the place inside the band from A and B. A smaller question for Call A (about 1,500 tokens against 6,500) should also make the slow readers quicker, though there is one more call per chunk.

## What to watch for in the run that tests this

- Tier agreement among the three counted readers, against 43% (Tucker) and 58% (the Crystal).
- Each reader's own spread. Qwen's rose to 15 points on Tucker under the 11-15 wording.
- The five lines read closely on 11-15: the military-spending fact, "He's not interested in the details", "Thank God.", "War is simply not in the cards", "until then, I'm right yet again". The last is a hard line and may stay split; it is a candidate for Sailor's ruling.

## Not in this draft

- Giving the reader the whole post while it answers for one line (tried 11-07, flattened the lines).
- Making open-or-working a property of the post rather than the line.
Both stay open if the three changes above do not tighten the band.

---

## Applied 2026-11-16 (morning), after the 11-15 run finished at 00:32

All three changes are in `derive.py` and `parallelogram.py`; the scoring cache key is `ctx7`. Checked with stand-in answers in a scratch copy: a verdict gives denominated, a reason gives coalition, neither gives fluid; the patterns from call B are joined to each run's answers.

**A fourth thing was found while checking, and fixed in the same change.** The scoring question is meant to attach a line's whole post only when the line is in someone else's voice (ruled 11-07; attaching it to every line flattened them). The check compared the speaker's name with the poster's handle letter for letter, so "Tucker Carlson" never matched "TuckerCarlson" and "captive dreamer" never matched "captivedreamer7". Every one of Tucker's 42 lines, and 16 of the Crystal's 36, has been scored with its whole post attached, in every read since the check was written. `same_voice()` now compares names without spaces, marks or case. After the fix: 6 of Tucker's lines carry their post (all genuinely reported speech), none of the Crystal's.

This bears on the 11-15 reading of the split lines: the readers were not looking at Tucker's lines alone. Gemma calling the military-spending fact "an argument" had the rest of the post in front of it.

Sizes as measured: call A is about 4,400 tokens per chunk (not the 1,500 guessed above: the facts block and the ruled cases are most of it), call B about 2,400. Before, one call of about 6,500.
