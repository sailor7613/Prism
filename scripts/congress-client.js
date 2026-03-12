/**
 * Prism Data Pipeline — Congress.gov API Client
 * 
 * Shared fetch wrapper used by all data scripts. Handles:
 *   - Appending API key to every request
 *   - Paginating through large result sets
 *   - Rate limit detection and retry
 *   - Progress logging
 * 
 * Usage:
 *   const { fetchAll, fetchOne } = require('./congress-client');
 *   const members = await fetchAll('/member/congress/119', 'members');
 *   const bill = await fetchOne('/bill/119/hr/1');
 */

const config = require('./config');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch a single endpoint (no pagination).
 * Returns the parsed JSON response body.
 */
async function fetchOne(endpoint) {
  const url = `${config.BASE_URL}${endpoint}?api_key=${config.API_KEY}&format=json`;
  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 429) {
      console.log('  ⏳ Rate limited — waiting 60s...');
      await sleep(config.RETRY_DELAY_MS);
      return fetchOne(endpoint);  // Retry
    }
    const text = await response.text();
    throw new Error(`API ${response.status} on ${endpoint}: ${text}`);
  }

  return response.json();
}

/**
 * Fetch all pages from a paginated endpoint.
 * 
 * @param {string} endpoint    — API path, e.g. '/member/congress/119'
 * @param {string} resultKey   — JSON key containing the array, e.g. 'members'
 * @returns {Array}            — All results merged across pages
 */
async function fetchAll(endpoint, resultKey) {
  let allResults = [];
  let offset = 0;
  let totalCount = null;

  while (true) {
    const url = `${config.BASE_URL}${endpoint}?api_key=${config.API_KEY}&limit=${config.PAGE_SIZE}&offset=${offset}&format=json`;

    console.log(`  Fetching offset ${offset}...`);
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 429) {
        console.log('  ⏳ Rate limited — waiting 60s...');
        await sleep(config.RETRY_DELAY_MS);
        continue;  // Retry same offset
      }
      const text = await response.text();
      throw new Error(`API ${response.status} on ${endpoint}: ${text}`);
    }

    const data = await response.json();

    if (totalCount === null) {
      totalCount = data.pagination?.count || '?';
      console.log(`  Total reported by API: ${totalCount}`);
    }

    const results = data[resultKey] || [];
    if (results.length === 0) break;

    allResults = allResults.concat(results);
    console.log(`  Got ${results.length} (total so far: ${allResults.length})`);

    if (results.length < config.PAGE_SIZE) break;

    offset += config.PAGE_SIZE;
    await sleep(config.DELAY_MS);
  }

  return allResults;
}

module.exports = { fetchOne, fetchAll };
