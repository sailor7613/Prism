/**
 * Prism Data Pipeline — Configuration
 * 
 * Central config for all fetch scripts. API key comes from
 * environment variable, everything else is set here.
 */

const path = require('path');

const API_KEY = process.env.CONGRESS_API_KEY;
if (!API_KEY) {
  console.error('ERROR: Set CONGRESS_API_KEY environment variable before running.');
  console.error('  macOS/Linux:  CONGRESS_API_KEY=your_key node run-all.js');
  console.error('  Windows cmd:  set CONGRESS_API_KEY=your_key && node run-all.js');
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
  OUTPUT_DIR: path.join(__dirname, 'output'),
};
