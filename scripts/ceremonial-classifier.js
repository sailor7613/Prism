/**
 * ceremonial-classifier.js — record-tier ceremonial bill classification.
 *
 * 2026-07-05 (substance-lens session). Congress's consensus output is
 * heavily ceremonial — 26% of enacted bills in the current corpus are
 * facility namings and commemoratives. Browsing surfaces need to fold
 * that fog away so the contested field is what a user feels first
 * ("the congressional narrative" is a LENS, not an object — nothing is
 * deleted, nothing is authored; the filter's criteria are record facts).
 *
 * Lineage discipline: this is a pattern-match heuristic, and it says so.
 * Every positive carries { ceremonial: true, ceremonialClass,
 * ceremonialMethod: METHOD_ID }. Substantive bills carry no field at all
 * (absence = untagged, not "certified substantive"). Bump METHOD_ID when
 * the patterns change so stale tags are detectable, same rule as rubrics.
 *
 * Deliberately NOT ceremonial here: land/wilderness designations (policy),
 * "awareness" program bills that direct agency activity (borderline —
 * excluded from v1 to keep false positives near zero; the roll-call tier
 * of the substance lens arrives with the votes pipeline and needs no
 * patterns at all).
 *
 * Used by: fetch-bills.js (every future fetch) and tag-ceremonial.js
 * (one-off retag of the on-disk corpus). Browsers read the tag from the
 * data files; the patterns live only here.
 */

const METHOD_ID = 'pattern_match_v1';

// Each rule: [class, regex tested against title + titleFull].
// Order matters — first hit wins.
const RULES = [
  // "To designate the facility of the United States Postal Service located
  // at 123 Main St ... as the John Doe Post Office Building"
  ['postal_naming', /facility of the united states postal service|as the .{0,80}post office/i],
  ['postal_naming', /post office building|post office,? and for other purposes/i],
  // Federal building / courthouse / VA clinic namings
  ['building_naming', /to designate the .{0,120}(federal building|courthouse|court house|clinic|medical center|hospital|building located)/i],
  ['building_naming', /designating the .{0,120}(federal building|courthouse)/i],
  // Renamings of existing facilities/units
  ['renaming', /to rename|renaming (of|the)|to redesignate the name/i],
  // Commemorative coins and congressional gold medals
  ['commemorative', /commemorative coin|congressional gold medal|to mint coins/i],
  // Pure observances (rare in hr/s corpus; resolutions are already excluded)
  ['observance', /national .{0,50}(day|week|month) of (recognition|remembrance|awareness)/i],
  // Honorific designations: memorials, monuments, routes, national symbols.
  // Tight on purpose — "designate Haiti for TPS" and park-boundary work are
  // substantive and must not match.
  ['honorific_designation', /to (re)?designate the .{0,120}(memorial|monument|visitor .{0,24}center|interpretive center|house,? in the commonwealth|house in the commonwealth)/i],
  ['honorific_designation', /to designate .{0,80}(united states route|state route|highway|interchange|bridge) /i],
  ['honorific_designation', /as the national (bird|mammal|tree|flower|anthem|motto)/i],
  ['commemorative', /to authorize the president to award the .{0,60}medal/i],
];

/**
 * classify(bill) → { ceremonial, ceremonialClass, ceremonialMethod } | null
 * Reads only record fields (title, titleFull). Null = untagged.
 */
function classify(bill) {
  const hay = ((bill.title || '') + ' ' + (bill.titleFull || '')).slice(0, 800);
  for (const [cls, re] of RULES) {
    if (re.test(hay)) {
      return { ceremonial: true, ceremonialClass: cls, ceremonialMethod: METHOD_ID };
    }
  }
  return null;
}

/** apply(bill) — stamps the tag onto the record in place (or strips a
 *  stale one when the current patterns no longer match). Returns bill. */
function apply(bill) {
  const tag = classify(bill);
  if (tag) Object.assign(bill, tag);
  else if (bill.ceremonial) { delete bill.ceremonial; delete bill.ceremonialClass; delete bill.ceremonialMethod; }
  return bill;
}

module.exports = { METHOD_ID, RULES, classify, apply };
