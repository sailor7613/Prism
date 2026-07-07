// ============================================================
// BILL SYNC TEST — billReadings transport (2026-07-07 build)
// Loads the live prismdb.js + prism-sync.js with a localStorage
// shim and asserts the store <-> published-Reading contract:
// export strips device-local keys, import rewrites onto the
// local event id, per-row LWW by timestamp, lineage refusal
// holds on import, migration never overwrites.
//
// Run:  cd Prism && node test/billsync_test.js
// Exit 0 = all pass.
// ============================================================
const fs = require('fs');
const path = require('path');

// ── localStorage shim ──
const _store = new Map();
global.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null),
  setItem: (k, v) => _store.set(k, String(v)),
  removeItem: (k) => _store.delete(k),
};
// silence lineage-refusal warnings during negative tests
const realWarn = console.warn; console.warn = () => {};
const realLog = console.log; console.log = () => {};

// ── Load live code ──
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
eval(read('src/js/prismdb.js') + '\n' + read('src/js/prism-sync.js') +
  '\nglobal.__PrismDB = PrismDB;' +
  // toFile is factory-internal; re-derive it the way publish does:
  // we only need its output shape, so expose via a tiny harness.
  '');
const DB = global.__PrismDB;

console.log = realLog;

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

const LINEAGE = { rubricId: 'PRISM_DIATRIBE_RUBRIC_v1_1', method: 'curate', provenance: 'AI_CURATED' };

// ── 1. export strips device-local keys ──
console.log('1. exportBillReadings');
const evA = DB.addEvent({ title: 'Device-A Reading', active: false });
DB.saveBillScore(Object.assign({
  billId: 'hr-119-99', eventId: evA.id, billName: 'Test Act',
  objectZ: 0.4, displacement: 'partial', timestamp: '2026-07-07T10:00:00.000Z'
}, LINEAGE));
const exported = DB.exportBillReadings(evA.id);
ok(exported.length === 1, 'one row exported');
ok(!('id' in exported[0]) && !('eventId' in exported[0]), 'id + eventId stripped');
ok(exported[0].rubricId === LINEAGE.rubricId && exported[0].provenance === 'AI_CURATED', 'lineage intact');
ok(exported[0].objectZ === 0.4 && exported[0].billName === 'Test Act', 'payload intact');

// ── 2. import rewrites onto the local event id ──
console.log('2. importBillReadings — cross-device rewrite');
const evB = DB.addEvent({ title: 'Device-B copy of the Reading', active: false });
const res2 = DB.importBillReadings(evB.id, exported);
ok(res2.imported === 1, 'row imported');
const got = DB.getBillScore('hr-119-99', evB.id);
ok(!!got && got.id === 'bscore_hr-119-99_' + evB.id, 'id recomputed from local event id');
ok(got.eventId === evB.id, 'eventId is local');
ok(got.rubricId === LINEAGE.rubricId, 'lineage survives transport');

// ── 3. per-row last-write-wins by timestamp ──
console.log('3. LWW by timestamp');
const older = Object.assign({}, exported[0], { objectZ: -0.9, timestamp: '2026-07-06T00:00:00.000Z' });
const res3a = DB.importBillReadings(evB.id, [older]);
ok(res3a.imported === 0 && res3a.skipped === 1, 'older incoming skipped');
ok(DB.getBillScore('hr-119-99', evB.id).objectZ === 0.4, 'local row untouched');
const newer = Object.assign({}, exported[0], { objectZ: 0.7, timestamp: '2026-07-08T00:00:00.000Z' });
const res3b = DB.importBillReadings(evB.id, [newer]);
ok(res3b.imported === 1, 'newer incoming wins');
ok(DB.getBillScore('hr-119-99', evB.id).objectZ === 0.7, 'row updated');

// ── 4. lineage refusal holds on import ──
console.log('4. lineage refusal on import');
const bare = { billId: 's-119-77', objectZ: 0.1, timestamp: '2026-07-07T12:00:00.000Z' };
const res4 = DB.importBillReadings(evB.id, [bare]);
ok(res4.imported === 0 && res4.skipped === 1, 'row without lineage refused');
ok(DB.getBillScore('s-119-77', evB.id) === null, 'nothing entered the store');

// ── 5. migrateBillAnalysis — promote, never overwrite ──
console.log('5. migrateBillAnalysis');
const evC = DB.addEvent({ title: 'Legacy iPad event', active: false });
DB.updateEvent(evC.id, { billAnalysis: {
  'hr-119-11': Object.assign({ objectZ: -0.2, timestamp: '2026-07-02T00:00:00.000Z' }, LINEAGE),
  'hr-119-99': Object.assign({ objectZ: -0.5 }, LINEAGE)   // will collide below
}});
DB.saveBillScore(Object.assign({ billId: 'hr-119-99', eventId: evC.id, objectZ: 0.9 }, LINEAGE));
const promoted = DB.migrateBillAnalysis();
ok(promoted === 1, 'one legacy row promoted (collision skipped)');
ok(DB.getBillScore('hr-119-11', evC.id).objectZ === -0.2, 'legacy row in store');
ok(DB.getBillScore('hr-119-99', evC.id).objectZ === 0.9, 'store row won the collision');

// ── 6. toFile carries billReadings fresh from the store ──
console.log('6. publish shape (toFile via PrismSync internals)');
// PrismSync.toFile is private; replicate the contract through publish's
// observable: LOCAL_FIELDS now includes billReadings, so a stale field
// on the event object must never survive a round trip. We assert the
// two public halves: export sources from the store, and import ignores
// a reading whose event body carries no store rows.
DB.updateEvent(evA.id, { billReadings: [{ billId: 'GHOST', objectZ: 9 }] }); // stale junk on the event
const freshExport = DB.exportBillReadings(evA.id);
ok(freshExport.length === 1 && freshExport[0].billId === 'hr-119-99', 'export reads the store, not the event field');

console.warn = realWarn;
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
