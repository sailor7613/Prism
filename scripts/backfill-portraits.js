/**
 * backfill-portraits.js — stamp portraitUrl onto the existing roster.
 * (Photo Grammar Integration, 2026-07-19: fetch-members.js gained the
 * field, but the roster on disk predates it. portraitUrl is DERIVED —
 * a static unitedstates-archive URL keyed by bioguideId, no API call —
 * so the full 15–20-min pipeline rerun is not needed to acquire it.
 * The next real rerun of the pipeline produces the identical field and
 * this script becomes a no-op.)
 *
 * Reads data/prism_members.json, adds portraitUrl (and photoUrl, if a
 * member somehow lacks it) wherever bioguideId is present, writes the
 * roster back, and regenerates data/prism_members.js in EXACTLY the
 * format score-sponsorship-z.js uses (same header, same loader tail),
 * so either script can regenerate after the other without churn.
 *
 * Idempotent: run it twice, the second run reports 0 changes.
 *
 * Usage: node scripts/backfill-portraits.js
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const rosterPath = path.join(DATA_DIR, 'prism_members.json');

const roster = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
const arr = Array.isArray(roster) ? roster : (roster.members || Object.values(roster)[0]);

let addedPortrait = 0, addedPhoto = 0, skipped = 0;
for (const m of arr) {
  if (!m.bioguideId) { skipped++; continue; }
  if (!m.portraitUrl) {
    // canvas-safe (CORS-open) source for the portrait card — mirrors fetch-members.js
    m.portraitUrl = `https://unitedstates.github.io/images/congress/225x275/${m.bioguideId}.jpg`;
    addedPortrait++;
  }
  if (!m.photoUrl) {
    m.photoUrl = `https://bioguide.congress.gov/bioguide/photo/${m.bioguideId.charAt(0)}/${m.bioguideId}.jpg`;
    addedPhoto++;
  }
}

if (addedPortrait || addedPhoto) {
  fs.writeFileSync(rosterPath, JSON.stringify(arr, null, 2));
  const js =
    '/* Auto-generated from prism_members.json so the roster loads on file:// (no fetch/CORS).\n' +
    '   Regenerate: node scripts/score-sponsorship-z.js or re-run the pipeline. ' + arr.length + ' members. */\n' +
    'window.PRISM_MEMBERS_DATA = ' + JSON.stringify(arr) + ';\n' +
    'if (typeof PrismDB!=="undefined" && PrismDB.loadMembers) { try { PrismDB.loadMembers(window.PRISM_MEMBERS_DATA); } catch(e){} }\n';
  fs.writeFileSync(path.join(DATA_DIR, 'prism_members.js'), js);
  console.log(`✓ portraitUrl added to ${addedPortrait} members` +
    (addedPhoto ? ` (photoUrl to ${addedPhoto})` : '') +
    (skipped ? ` · ${skipped} without bioguideId skipped` : '') +
    ' · prism_members.json + prism_members.js regenerated');
} else {
  console.log('nothing to do — every member with a bioguideId already carries portraitUrl' +
    (skipped ? ` (${skipped} without bioguideId)` : ''));
}
