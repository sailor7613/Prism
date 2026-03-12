#!/usr/bin/env node
/**
 * Prism Data Pipeline — Run All
 * 
 * Orchestrator that runs each data fetch module and writes output files.
 * Currently runs: members
 * Future modules: bills, votes
 * 
 * Usage:
 *   CONGRESS_API_KEY=your_key node run-all.js
 * 
 * Outputs (in ./output/):
 *   prism_members.json     — Full member dataset with NOMINATE scores
 *   politicians_data.js    — Drop-in replacement for POLITICIANS_DATA
 *   fetch_stats.json       — Summary for sanity checking
 * 
 * Requirements: Node 18+ (built-in fetch). No npm dependencies.
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');
const { fetchMembers } = require('./fetch-members');
const { fetchBills, writeBillOutputs } = require('./fetch-bills');
// const { fetchVotes } = require('./fetch-votes');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function main() {
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║   Prism — Data Pipeline                       ║');
  console.log('║   Congress.gov API + Voteview NOMINATE         ║');
  console.log('╚═══════════════════════════════════════════════╝\n');
  console.log(`  Congress: ${config.CONGRESS_NUMBER}th`);
  console.log(`  Output:   ${config.OUTPUT_DIR}\n`);

  ensureDir(config.OUTPUT_DIR);

  try {
    // ── Members ───────────────────────────────────────────────────────────
    const members = await fetchMembers();

    // Full dataset
    const membersPath = path.join(config.OUTPUT_DIR, 'prism_members.json');
    fs.writeFileSync(membersPath, JSON.stringify(members, null, 2));
    console.log(`📁 ${membersPath} (${members.length} members)`);

    // Drop-in replacement for POLITICIANS_DATA
    const currentMembers = members.filter(m => m.inOffice);
    const politiciansJS = `// Auto-generated ${new Date().toISOString()}
// ${currentMembers.length} current members, ${config.CONGRESS_NUMBER}th Congress
// Drop-in replacement for POLITICIANS_DATA in index.html

const POLITICIANS_DATA = ${JSON.stringify(
      currentMembers.map(m => ({ name: m.name, meta: m.meta, id: m.bioguideId })),
      null, 2
    )};
`;
    const jsPath = path.join(config.OUTPUT_DIR, 'politicians_data.js');
    fs.writeFileSync(jsPath, politiciansJS);
    console.log(`📁 ${jsPath} (${currentMembers.length} current members)`);

    // ── Bills ─────────────────────────────────────────────────────────────
    const bills = await fetchBills();
    await writeBillOutputs(bills);

    // ── Future: Votes ─────────────────────────────────────────────────────
    // const votes = await fetchVotes();
    // fs.writeFileSync(...);

    // ── Stats ─────────────────────────────────────────────────────────────
    const stats = {
      congress: config.CONGRESS_NUMBER,
      generated: new Date().toISOString(),
      members: {
        total: members.length,
        current: currentMembers.length,
        senate: currentMembers.filter(m => m.chamber === 'senate').length,
        house: currentMembers.filter(m => m.chamber === 'house').length,
        D: currentMembers.filter(m => m.party === 'D').length,
        R: currentMembers.filter(m => m.party === 'R').length,
        I: currentMembers.filter(m => m.party === 'I').length,
        withNominate: members.filter(m => m.nominateD1 !== null).length,
      },
    bills: { total: bills.length },
      // votes: { ... },
    };

    const statsPath = path.join(config.OUTPUT_DIR, 'fetch_stats.json');
    fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
    console.log(`📁 ${statsPath}`);

    // Summary
    console.log(`\n${'─'.repeat(50)}`);
    console.log('  RESULTS');
    console.log(`${'─'.repeat(50)}`);
    console.log(`  Senate:  ${stats.members.senate}`);
    console.log(`  House:   ${stats.members.house}`);
    console.log(`  D: ${stats.members.D}  R: ${stats.members.R}  I: ${stats.members.I}`);
    console.log(`  NOMINATE scores: ${stats.members.withNominate} of ${stats.members.total}`);
    console.log(`${'─'.repeat(50)}\n`);

    console.log('✅ Done. Next steps:');
    console.log('  1. Review output/prism_members.json');
    console.log('  2. Spot-check bioguide IDs and NOMINATE scores');
    console.log('  3. Copy politicians_data.js content into index.html');
    console.log('     (or load prism_members.json via PrismDB)\n');

  } catch (err) {
    console.error('\n❌ Fatal error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
