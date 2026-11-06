# The Parallelogram Report — Explainer · "Watch the Barrel" · draft v2
*2026-11-06 · v2: refetched 11-06, August is in — the needle now reads holding, July is the low, the Gulf barrel came back to the US (P3's falsifier clause; flagged below). Was v1 2026-11-05 · The supply shock tracker, 3–5 min. ~636 words of Ted ≈ 5:04 with breaths in the clone (2.2 w/s), no tape. Episode file: `data/show/ex01.json`.*

**What it is (handoff §3A):** PG01's active layer, the globe on the pedestal. Flows are the realized layer, OSINT events are the detection series, price is the shadow. The question it answers: is more or less energy being sold in dollars. Sailor's framing: a lot of our predicates come from here; currency exchange is the central object of geopolitical economy.
**Numbers:** the tracker's own computation (`trackerCompute` in `dreamgetty/index.html`), run over `data/active/` as fetched 11-06. The panel is the five stations that report every month (US, EU-27, India, Japan, Brazil). The window runs from the first full-panel month (Oct 2025) to the last month EIA reports (Aug 2026).
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
That's the one thing this globe reads.
I scroll Twitter like everybody else. A hurricane of vibes about oil, almost no signal.
So we built something that only watches the barrel. Where it goes, and what money it's paid in.
I'm Ted Turner. I'm a sonnetbot — I say what the guy who built this thinks. This is the Parallelogram Report.

## 2 · The globe
**TED:** This is the Supply Shock Tracker, on the pedestal here at the Getty Villa.
Every line on it is oil crossing a border. Gold means it was paid for in dollars. Blue means it wasn't. Dashed means nobody can say. We draw the not-knowing instead of guessing.
Why the money? When the world's oil is sold in dollars, the world needs dollars. That keeps the dollar on top. The writer Richard Medhurst calls it the petrogas-dollar. We borrowed the name.
The tracker has three layers.
First, the flows. Where the barrels actually went, month by month. What really happened.
Second, the events. Strikes, seizures, sanctions, licenses. Each gets two dates: the day it happened, and the day we heard about it.
Third, the price. Everyone's shouting about it, so we keep it. But last. The price is the shadow. The barrel is the thing.

## 3 · The reading
**TED:** Here's what it reads now. The official numbers run behind, so the latest full month is August.
We read five big buyers: the US, Europe, India, Japan and Brazil. Last October, ninety-one percent of the oil they bought was sold in dollars. In August, ninety.
One point. The needle says holding. But in July it hit eighty-seven, the low of the year. Then it came back.
Now look at it from America's side. Last fall, about eight percent of the oil America imported came from the Persian Gulf. In July, zero. Not one barrel.
Our own hemisphere filled the gap, up to ninety-eight percent. Venezuela went from about a hundred and thirty thousand barrels a day to seven hundred thousand. Five times as much.
And every one of those barrels gets paid in dollars. That's how the American market works.
So the shock re-routed America's barrel without touching its money.
Then where did the dollar lose ground? Mostly here. Russia to India, the biggest blue line, paid in rupees, dirhams and yuan. Last fall, about two million barrels a day. By July, almost three million.
Then August. Russia to India fell back to about two point two million. And the Gulf came back to America. About half a million barrels a day.
So the summer pulled the world's barrel away from the dollar. August pulled it back. That's why we watch it month by month.

## 4 · Where the claims get checked
**TED:** When we score what somebody says, we check it against the thing they're talking about. If it's the war, the oil or the money, this is the thing.
Take October eleventh. The president said Russia would immediately send three hundred thousand tons of diesel, and prices would come down in record numbers.
So we filed it as a claim the world can check. The first test date was November third. The numbers haven't come in yet.
When they do, the claim gets scored by what the barrels did. Not by how it sounded.

## 5 · The bet, and out
**TED:** I have a bet on the record, from October second. The shock doesn't loosen the dollar's grip on America's oil. It re-routes the oil toward it. And I wrote down how I'd be wrong: if the Gulf barrel came back before our own hemisphere locked in.
In August, the Gulf barrel came back. Did the hemisphere lock in first? That's my call to make, and I'll make it on the record.
The discourse is noise. The barrel isn't. Watch the barrel.
I'm Ted Turner. Goodnight from the Getty Villa.

---
### To check before voicing
- **P3 — yours to rule.** P3's falsifier: "the Gulf edge returns before the hemisphere edges consolidate." EIA August: Gulf → US back to 542 kb/d (Kuwait 262, Saudi 209, UAE 51, Iraq 20) = 8.1% of US crude imports, after 0 in July; hemisphere 97.5% (Jul) → 89.1% (Aug). Whether the hemisphere had consolidated (May–Jul at 94 → 96 → 98%) is the ruling. Block 5 states the clause and says the call is owed; it doesn't make it. If you rule before voicing, o_call says the result.
- **Figures on air, as computed (refetch 11-06):** panel dollar share 91.1% (Oct 2025) → 90.2% (Aug 2026), Δ −0.9 → HOLDING (threshold ±3); low 86.9% (Jul). Named 97% of what moved; 47% of the named rests on the industry default (needle still, off air). US imports: Gulf 7.6% (Oct) → 0.0% (Jul) → 8.1% (Aug); hemisphere 85.6% → 97.5% (Jul) → 89.1% (Aug); Venezuela 135 → 701 (Jul) → 655 kb/d (Aug). Russia → India 7,999 → 11,757 (Jul) → 8,940 kt a month ≈ 1.96 → 2.88 → 2.19 M b/d at the tracker's 4.08 (crude + products, by volume equivalence). Sep 2025 dropped out of the window: Comtrade's preview now serves 2025-10 → 2026-09.
- **Diesel claim (H1):** still unreadable. EIA monthly ends at August; H1a's 11-03 test needs CBP clearances and the weekly retail diesel isn't in the fetch (gasoline is). c_file keeps "the numbers haven't come in yet."
- **Medhurst** credited by name for the term (PG01 §1.4).
- **Sonnetbot line** is in because a stand-alone explainer has no cold open to carry it, and "I have a bet" needs it.
- **Fetch errors (not on air):** Comtrade 403 on US products 2026-04 → 06 (the US side is read from EIA anyway); GDELT settlement query gave up.
