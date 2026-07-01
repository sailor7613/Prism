/**
 * Prism Data Pipeline — Configuration
 * 
 * Central config for all fetch scripts. API key comes from
 * environment variable, everything else is set here.
 */

const path = require('path');

// Key resolution order:
//   1. CONGRESS_API_KEY environment variable (CI / one-off runs)
//   2. scripts/secrets.local.js  — a gitignored local file you set ONCE so you
//      never have to retype the key. Copy secrets.local.example.js → secrets.local.js
//      and paste your key. This file is in .gitignore and never ships.
// The Congress.gov key is a free api.data.gov key with no billing attached, and
// it is only ever used by these build-time scripts — it never reaches the browser
// or the beta testers (who load the pre-generated static data).
let localSecrets = {};
try { localSecrets = require('./secrets.local.js'); } catch (e) { /* optional */ }

const API_KEY = process.env.CONGRESS_API_KEY || localSecrets.CONGRESS_API_KEY;
if (!API_KEY) {
  console.error('ERROR: No Congress.gov API key found.');
  console.error('  Option A (persistent): cp scripts/secrets.local.example.js scripts/secrets.local.js  then paste your key');
  console.error('  Option B (one-off):    CONGRESS_API_KEY=your_key node scripts/fetch-sponsorship.js');
  process.exit(1);
}

module.exports = {
  API_KEY,
  CONGRESS_NUMBER: 119,
  BASE_URL: 'https://api.congress.gov/v3',
  PAGE_SIZE: 250,
  DELAY_MS: 500,           // Pause between API calls (conservative)
  RETRY_DELAY_MS: 60000,   // Wait on rate limit (429)
  VOTEVIEW_URL: 'https://voteview.com/static/data/out/members/HSall_members.csv',
  OUTPUT_DIR: path.join(__dirname, '..', 'data'),
};
