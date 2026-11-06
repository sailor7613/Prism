# The Parallelogram Report — Explainer · "Watch the Barrel" · draft v1
*2026-11-05 · The supply shock tracker, 3–5 min. ~612 words of Ted ≈ 4:54 with breaths in the clone (2.2 w/s), no tape. Episode file: `data/show/ex01.json`.*

**What it is (handoff §3A):** PG01's active layer, the globe on the pedestal. Flows are the realized layer, OSINT events are the detection series, price is the shadow. The question it answers: is more or less energy being sold in dollars. Sailor's framing: a lot of our predicates come from here; currency exchange is the central object of geopolitical economy.
**Numbers:** the tracker's own computation (`trackerCompute` in `dreamgetty/index.html`), run over `data/active/` as fetched 10-21. The panel is the five stations that report every month (US, EU-27, India, Japan, Brazil). The window runs from the first full-panel month (Sep 2025) to the last month EIA reports (Jul 2026). EIA and Comtrade are blocked from both the Mac's shell and the cloud, so the 11-05 refetch didn't run (see "To check").
**Visuals:** the globe sits still on the pedestal the whole way (`globe: true, globeTurn: 0`). `globeMonth` holds it on the month Ted is reading. Four stills, drawn from the same data: the needle, America's barrel, Russia → India, the shadow.

| # | Block | Clips | ≈ |
|---|---|---|---|
| 1 | The question | yes | 0:35 |
| 2 | The globe | yes | 1:25 |
| 3 | The reading | yes | 1:40 |
| 4 | Where the claims get checked | yes | 0:50 |
| 5 | The bet, and out | — | 0:25 |

---

## 1 · The question
**TED:** Is more of the world's oil being sold in dollars this year, or less?
That's the whole question. It's the one thing this globe reads.
I scroll Twitter like everybody else. Every day there's a hurricane about oil. A lot of vibes, almost no signal.
So we built something that only watches the barrel. Where it goes, and what money it's paid in.
I'm Ted Turner. I'm a sonnetbot — I say what the guy who built this thinks. This is the Parallelogram Report.

## 2 · The globe
**TED:** This is the Supply Shock Tracker. It sits on the pedestal here at the Getty Villa.
Every line on it is oil crossing a border. Gold means it was paid for in dollars. Blue means it wasn't. Dashed means nobody can say. We draw the not-knowing instead of guessing.
Why the money? Because the money is underneath everything else. When the world's oil is sold in dollars, the world needs dollars. That keeps the dollar on top. The writer Richard Medhurst calls it the petrogas-dollar. We borrowed the name.
The tracker has three layers.
First, the flows. Where the barrels actually went, month by month, from official customs numbers. What really happened.
Second, the events. Strikes, seizures, sanctions, licenses. Each gets two dates: the day it happened, and the day we heard about it.
Third, the price. It's what everyone's shouting about, so we keep it. But we keep it last. The price is the shadow. The barrel is the thing.

## 3 · The reading
**TED:** So here's what it reads right now. The official numbers run a few months behind, so the latest full month is July.
We read five big buyers: the US, Europe, India, Japan and Brazil. Last September, ninety-two percent of the oil they bought was sold in dollars. In July, eighty-seven.
Five points down. The needle says falling. Less of the world's energy is being sold in dollars.
Now look at it from America's side. Last fall, about seven percent of the oil America imported came from the Persian Gulf. By July, zero. Our own hemisphere went from eighty-four percent to ninety-eight. Venezuela alone went from about a hundred thousand barrels a day to seven hundred thousand. Seven times as much.
And every one of those barrels gets paid in dollars. That's how the American market works.
So the shock re-routed America's barrel without touching its money.
Then where did the dollar lose ground? Mostly here. Russia to India, paid in rupees, dirhams and yuan. The biggest blue line on the globe. Last September, under two million barrels a day. In July, almost three million.
Both things are true at once. America's barrel got more American. The world's barrel got a little less dollar.

## 4 · Where the claims get checked
**TED:** When we score what somebody says, we check it against the thing they're talking about. If it's the war, the oil or the money, this is the thing.
Take October eleventh. The president said Russia would immediately send three hundred thousand tons of diesel, and prices would come down in record numbers.
So we filed it as a claim the world can check. Does the diesel land here? Does the price fall? The first test date was November third. The numbers haven't come in yet.
When they do, the claim gets scored by what the barrels did. Not by how it sounded.

## 5 · The bet, and out
**TED:** I have a bet on the record, from October second. The shock doesn't loosen the dollar's grip on America's oil. It re-routes the oil toward it. So far, that's what the numbers show. The world's needle is a separate question. Right now it's falling.
The discourse is noise. The barrel isn't. Watch the barrel.
I'm Ted Turner. Goodnight from the Getty Villa.

---
### To check before voicing
- **Refetch first.** `Fetch Active Layer.command` (EIA + Comtrade). August 2026 has probably landed since 10-21. If it moves the numbers, I re-run the reading and the beats change. The script is written so only the figures change.
- **Figures on air, as computed:** the dollar share of the panel 91.9% (Sep 2025) → 86.9% (Jul 2026), Δ −5.0, so FALLING (the tracker's threshold is ±3). Named share 96% of what moved; 45% of the named rests on the industry default ("about half"). US imports: Gulf 7.3% → 0.0%, hemisphere 84.4% → 97.5%, Venezuela 102 → 701 kb/d. Russia → India 7,534 kt → 11,757 kt a month (Comtrade, importer-reported). At the tracker's 4.08 kt per kb/d-month that's ≈1.85 → ≈2.88 million b/d. That's crude plus products, so "barrels a day" is by volume equivalence.
- **Diesel claim:** H1 / S2 (Trump, 10-11, via the Breaking Points cut 10-12). H1a's test date was 11-03 (≥300,000 t cleared by CBP); it's unscored because the data is stale. If the refetch settles it, the beat says so instead.
- **The bet:** P3, 10-02. On air it's read narrowly, as America's barrel (P3's own observables), and kept apart from the world needle. The US edges count as dollars by construction (the settlement rule), and Ted says so ("that's how the American market works").
- **Medhurst** credited by name for the term (PG01 §1.4, the founding citation).
- **The default share** (45% of the named volume) is off air for time and goes on the needle still's caption instead.
- **Sonnetbot line** is in because a stand-alone explainer has no cold open to carry it, and "I have a bet" needs it.
