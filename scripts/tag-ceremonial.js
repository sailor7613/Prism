/**
 * tag-ceremonial.js — one-off retag of the on-disk corpus with the
 * ceremonial classifier (2026-07-05). Future fetches tag at write time
 * (fetch-bills.js); this brings the current files up to date without a
 * 3-hour refetch.
 *
 * Touches: data/prism_legislation.json (full tag with lineage) and
 * data/legislation_data.js (cer:1 flag, preserving generated entries).
 *
 * Usage: node scripts/tag-ceremonial.js
 */

const fs = require('fs');
const path = require('path');
const ceremonial = require('./ceremonial-classifier.js');

const dataDir = path.join(__dirname, '..', 'data');

// ── full record ──
const jsonPath = path.join(dataDir, 'prism_legislation.json');
const bills = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
bills.forEach(b => ceremonial.apply(b));
const tagged = bills.filter(b => b.ceremonial);
fs.writeFileSync(jsonPath, JSON.stringify(bills, null, 2));
console.log(`✓ ${jsonPath}: ${tagged.length} of ${bills.length} tagged (${ceremonial.METHOD_ID})`);
const byClass = {};
tagged.forEach(b => byClass[b.ceremonialClass] = (byClass[b.ceremonialClass] || 0) + 1);
console.log(' ', byClass);

// ── UI catalog — parse the generated array, stamp cer flags, rewrite ──
const jsPath = path.join(dataDir, 'legislation_data.js');
const src = fs.readFileSync(jsPath, 'utf8');
const m = src.match(/^([\s\S]*?const LEGISLATION_DATA = )([\s\S]*?)(;\s*)$/);
if (!m) { console.error('✗ could not parse legislation_data.js'); process.exit(1); }
const entries = JSON.parse(m[2]);
const cerIds = new Set(tagged.map(b => b.billId));
let flagged = 0;
entries.forEach(e => {
  if (cerIds.has(e.id)) { e.cer = 1; flagged++; }
  else delete e.cer;
});
fs.writeFileSync(jsPath, m[1] + JSON.stringify(entries, null, 2) + m[3]);
console.log(`✓ ${jsPath}: ${flagged} entries flagged cer:1`);
