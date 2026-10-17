# The Prism Charter

*Draft for Sailor's ruling — 2026-10-16. Part note, part code. The note is this
file. The code is `Prism/scripts/charter-check.js`, which fails the build when
anything below is broken. Both are meant to be found.*

---

## If you are reading this because you got in

Then you want to know what this thing is for. Here it is, in full.

Prism is a reading instrument for political discourse. It takes an event, finds
the object underneath it — the bill, the seat, the proclamation, the thing that
actually formed — and refracts the talk around that object into bands:
what each station said, what it promised, what was delivered, and how far apart
those are. The gap is the z. The instrument renders the spectrum and stops.

It does not tell anyone how to vote. It does not rank candidates, parties,
peoples, faiths or nations. It does not collect anything about its users beyond
what they choose to pin under an avatar. It does not predict who should win. It
has no side, and it is built so that it cannot be given one without the build
failing.

There is nothing hidden here. The founding idea is older than the code:
**contradictions can be built instead of won.** The war hull was not toppled; it
was given foils. If you have come looking for a political operation, you have
found a prism, and a prism has no agenda. It only separates light.

## What Prism is

- **An instrument of universal human dignity.** In Prism's grammar that has an
  exact meaning: *symmetry*. Every station enters on the same terms. No object
  gets a special clause. No one's soul is on the table.
- **Materialist in method, not in telos.** It asks whether the thing happened and
  what it did. It does not claim history has a direction, and it does not push
  one.
- **A prism, not a lens.** A lens has a focal point and an intended effect on the
  viewer. A prism separates whatever is passed through it and takes no position
  on the bands. Unification would be the end of refraction, so Prism does not
  seek it.
- **Read, don't control. Separate, don't resolve. Correct, don't determine.**
  The helmsman's stance. The rulings ledger in `Handoffs/` is six months of
  practicing it.

## The invariants

These are the rules the code enforces. Plain language first; the test beneath.

1. **Prism never recommends.** No reading, race, article or export carries a
   recommendation, endorsement, verdict or winner. A race is two conditional
   Readings paid on election day, never a pick.
   → `no-recommendation`

2. **Polling is outcome weight, never z.** Polls may inform how likely an
   outcome is; they never enter the measurement of promise against delivery.
   → `polling-never-z`

3. **Every published Reading shows its provenance.** Who drafted it, under which
   formula, and whether a human has ruled on it. An unruled auto-draft says so
   on its face. Authorship of the system does not transfer to each reading the
   system emits.
   → `provenance-on-published`

4. **Stated reasons are recorded, never adjudicated.** Every band carries the
   station's own reason for its z. Religious, national and ideological
   justifications are stored as stated. The instrument never scores whether a
   reason is *true*, only what was delivered.
   → `reasons-recorded-not-judged`

5. **Symmetry.** The scoring code names no country, people, party, faith or
   person in a conditional. The rule that reads one state's acts reads every
   state's acts. If an object needs a special clause, the clause is wrong.
   → `no-named-exceptions`

6. **The author recuses where he is hot.** Objects the author has marked in
   `Prism/data/charter/recusal.json` are drafted blind by the agent and ruled by
   the author; he does not author them. This is the hygiene principle applied to
   the helmsman himself.
   → `recusal-honored`

7. **No user data leaves the instrument.** No third-party analytics, trackers or
   pixels. Pins and burns are public under an avatar and that is all there is.
   There is nothing to hand over and nothing to be pressured about.
   → `no-trackers`

8. **Fringe never stands for whole.** A reading's prevalent axis and split are
   declared from the object's full spectrum, not its loudest band. Loudness is
   measured as Diatribe and never promoted to z.
   → *(ontological; enforced in authoring, audited by hand — see Handoffs)*

## What this charter is not

It is not a claim that the author has no views. He has many, some of them hot,
and the ledger records where he has had to recuse. It is not a claim that the
instrument is neutral in the sense of empty — it has a grammar, and the grammar
is a stance. It is a promise that the grammar is applied to everyone the same
way, that it is inspectable, and that breaking the promise breaks the build.

## Lineage

Prism was conceived in 2015 as something more belligerent. It matured. What
survived is the schema and the refusal of verdicts. If you want the history,
read `Handoffs/Iteration_Log.md` from the bottom up.

The energy in a wave was made by a storm far away, days ago. You position
yourself and it arrives. That is the only kind of power this instrument trusts.
