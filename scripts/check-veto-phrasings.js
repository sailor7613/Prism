/**
 * check-veto-phrasings.js — one-off diagnostic (2026-07-04)
 *
 * The 2973-bill run caught only ONE vetoed bill (s-118-4199) — Biden
 * vetoed 13 in the 118th. Hypothesis: the candidate net misses the
 * House override phrasing ("the objections of the President to the
 * contrary notwithstanding") and possibly others.
 *
 * This scans the 118th list endpoints (list pages only, no enrichment —
 * cheap) and prints every latestAction containing veto-adjacent words,
 * so the net can be extended from observed phrasings, not guesses.
 *
 * Usage: CONGRESS_API_KEY=<key> node check-veto-phrasings.js
 */

const { fetchAll } = require('./congress-client.js');

const PROBE_WORDS = ['veto', 'objections of the president', 'notwithstanding'];
const BILL_TYPES = ['hr', 's', 'hjres', 'sjres'];

(async () => {
  const hits = [];
  for (const congress of [118, 119]) {
    for (const type of BILL_TYPES) {
      console.log(`Scanning ${congress}/${type}...`);
      const bills = await fetchAll(`/bill/${congress}/${type}`, 'bills');
      for (const b of bills) {
        const t = (b.latestAction?.text || '').toLowerCase();
        if (PROBE_WORDS.some(w => t.includes(w))) {
          hits.push({ id: `${type}-${congress}-${b.number}`, text: b.latestAction.text });
        }
      }
    }
  }
  console.log(`\n── ${hits.length} veto-adjacent latestActions ──\n`);
  hits.forEach(h => console.log(`${h.id}\n  ${h.text}\n`));
})();
