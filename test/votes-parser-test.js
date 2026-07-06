/**
 * votes-parser-test.js — fixture tests for scripts/fetch-votes.js parsers.
 * Fixtures are verbatim excerpts of the real feeds (fetched 2026-07-05):
 *   clerk.house.gov/evs/2025/roll023.xml  (Laken Riley House passage 263-156)
 *   senate.gov .../vote_119_1_00007.xml   (Laken Riley Senate passage 64-35)
 * Run: node test/votes-parser-test.js
 */
const { parseHouseXml, parseSenateXml, parseSenateMenu, houseBillId, senateBillId, normCast } = require('../scripts/fetch-votes.js');

let n = 0, failed = 0;
function ok(cond, label) { n++; if (!cond) { failed++; console.log('  ✗', label); } else console.log('  ✓', label); }

// ── House fixture (real header, subset of recorded votes) ──
const HOUSE = `<?xml version="1.0" encoding="UTF-8"?>
<rollcall-vote>
<vote-metadata>
<majority>R</majority>
<congress>119</congress>
<session>1st</session>
<chamber>U.S. House of Representatives</chamber>
<rollcall-num>23</rollcall-num>
<legis-num>S 5</legis-num>
<vote-question>On Passage</vote-question>
<vote-type>YEA-AND-NAY</vote-type>
<vote-result>Passed</vote-result>
<action-date>22-Jan-2025</action-date>
<vote-desc>Laken Riley Act</vote-desc>
</vote-metadata>
<vote-data>
<recorded-vote><legislator name-id="A000370" sort-field="Adams" unaccented-name="Adams" party="D" state="NC" role="legislator">Adams</legislator><vote>Nay</vote></recorded-vote>
<recorded-vote><legislator name-id="A000055" sort-field="Aderholt" unaccented-name="Aderholt" party="R" state="AL" role="legislator">Aderholt</legislator><vote>Yea</vote></recorded-vote>
<recorded-vote><legislator name-id="A000371" sort-field="Aguilar" unaccented-name="Aguilar" party="D" state="CA" role="legislator">Aguilar</legislator><vote>Nay</vote></recorded-vote>
<recorded-vote><legislator name-id="A000379" sort-field="Alford" unaccented-name="Alford" party="R" state="MO" role="legislator">Alford</legislator><vote>Yea</vote></recorded-vote>
<recorded-vote><legislator name-id="G000600" sort-field="Golden" unaccented-name="Golden" party="D" state="ME" role="legislator">Golden</legislator><vote>Yea</vote></recorded-vote>
<recorded-vote><legislator name-id="X000001" sort-field="Absent" unaccented-name="Absent" party="R" state="TX" role="legislator">Absent</legislator><vote>Not Voting</vote></recorded-vote>
</vote-data>
</rollcall-vote>`;

console.log('House parser:');
const h = parseHouseXml(HOUSE, 2025);
ok(h.voteId === 'h-119-2025-23', 'voteId h-119-2025-23');
ok(h.billId === 's-119-5', 'legis-num "S 5" joins to s-119-5');
ok(h.question === 'On Passage' && h.result === 'Passed', 'question/result');
ok(h.totals.yea === 3 && h.totals.nay === 2 && h.totals.notVoting === 1, 'totals from recorded votes');
ok(h.positions.yea.includes('A000055') && h.positions.yea.includes('G000600'), 'bioguide positions (incl. cross-party yea)');
ok(h.party.D.yea === 1 && h.party.D.nay === 2 && h.party.R.yea === 2, 'party breakdown catches the D split');
ok(Math.abs(h.margin - 0.2) < 1e-9, 'margin (3-2)/5 = 0.2');

// ── Senate fixture (real header + document block, subset of members) ──
const SENATE = `<?xml version="1.0" encoding="UTF-8"?><roll_call_vote>
  <congress>119</congress>
  <session>1</session>
  <vote_number>7</vote_number>
  <vote_date>January 20, 2025,  06:12 PM</vote_date>
  <question>On Passage of the Bill</question>
  <vote_result>Bill Passed</vote_result>
  <document>
    <document_congress>119</document_congress>
    <document_type>S.</document_type>
    <document_number>5</document_number>
  </document>
  <members>
    <member><member_full>Britt (R-AL)</member_full><last_name>Britt</last_name><first_name>Katie</first_name><party>R</party><state>AL</state><vote_cast>Yea</vote_cast><lis_member_id>S416</lis_member_id></member>
    <member><member_full>Blunt Rochester (D-DE)</member_full><last_name>Blunt Rochester</last_name><first_name>Lisa</first_name><party>D</party><state>DE</state><vote_cast>Nay</vote_cast><lis_member_id>S430</lis_member_id></member>
    <member><member_full>Fetterman (D-PA)</member_full><last_name>Fetterman</last_name><first_name>John</first_name><party>D</party><state>PA</state><vote_cast>Yea</vote_cast><lis_member_id>S418</lis_member_id></member>
    <member><member_full>Ghost (D-ZZ)</member_full><last_name>Ghost</last_name><first_name>No</first_name><party>D</party><state>ZZ</state><vote_cast>Nay</vote_cast><lis_member_id>S999</lis_member_id></member>
  </members>
</roll_call_vote>`;

console.log('Senate parser:');
const joinMap = { 'AL|britt': 'B001319', 'DE|blunt rochester': 'B001303', 'PA|fetterman': 'F000479' };
const senJoin = (st, ln) => joinMap[st + '|' + (ln || '').toLowerCase()] || null;
const s = parseSenateXml(SENATE, senJoin);
ok(s.voteId === 's-119-1-7', 'voteId s-119-1-7');
ok(s.billId === 's-119-5', 'document block joins to s-119-5');
ok(s.positions.yea.includes('B001319') && s.positions.yea.includes('F000479'), 'senate join (incl. cross-party yea)');
ok(s.positions.nay.includes('B001303'), 'two-word last name joins');
ok(s.unmatched.length === 1 && s.unmatched[0].includes('Ghost'), 'unresolved member lands in unmatched, not dropped');
ok(s.totals.yea === 2 && s.totals.nay === 2, 'totals count unmatched too');

// ── menu prefilter + id normalization edges ──
console.log('Menu + normalization:');
const MENU = `<vote_summary><votes>
  <vote><vote_number>00007</vote_number><issue>S. 5</issue></vote>
  <vote><vote_number>00006</vote_number><issue>PN123</issue></vote>
  <vote><vote_number>00005</vote_number><issue>H.R. 29</issue></vote>
  <vote><vote_number>00004</vote_number><issue></issue></vote>
  <vote><vote_number>00003</vote_number><issue>S.J.Res. 11</issue></vote>
  <vote><vote_number>00002</vote_number><issue>H. Res. 5</issue></vote>
</votes></vote_summary>`;
const menu = parseSenateMenu(MENU, 119);
ok(menu.length === 3 && menu.map(v => v.number).join(',') === '7,5,3', 'menu keeps bill documents, skips nominations/resolutions');
ok(houseBillId('H J RES 20', 119) === 'hjres-119-20', 'H J RES normalizes');
ok(houseBillId('H RES 5', 119) === null, 'H RES (non-law resolution) rejected');
ok(houseBillId('QUORUM', 119) === null, 'non-bill legis-num rejected');
ok(senateBillId('H.J.Res.', '25', 118) === 'hjres-118-25', 'senate H.J.Res. normalizes');
ok(normCast('Aye') === 'yea' && normCast('No') === 'nay' && normCast('Present, Giving Live Pair') === 'present', 'vote-cast normalization');

console.log(`\n${n - failed}/${n} assertions passed${failed ? ' — FAILURES ABOVE' : ''}`);
process.exit(failed ? 1 : 0);
