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
 * Fetch a URL and parse its JSON body, retrying on BOTH rate limits and
 * transient network faults.
 *
 * Congress.gov drops long-running connections ("other side closed",
 * UND_ERR_SOCKET, ECONNRESET, "terminated") — observed live 2026-07-02 when a
 * bills run died at offset 8000 with no partial output, and again 2026-07-04
 * at offset 6250 where the socket closed DURING the body read (headers had
 * already arrived, so the old headers-only retry never fired). Those surface
 * as thrown TypeErrors from fetch()/response.json(), not as HTTP statuses, so
 * both the request AND the body read live inside the retry path with backoff.
 * Server-side 5xx get the same treatment.
 */
async function fetchJsonWithRetry(url, label) {
  const MAX_ATTEMPTS = 6;
  for (let attempt = 1; ; attempt++) {
    let response;
    try {
      response = await fetch(url);
      // Body read MUST stay inside the try: Congress.gov also closes sockets
      // mid-body ("TypeError: terminated" from Fetch.onAborted) — observed
      // live 2026-07-04 at offset 6250, where the headers arrived fine and
      // response.json() threw OUTSIDE the old retry loop, killing the run.
      if (response.ok) return await response.json();
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS) throw err;
      const waitMs = Math.min(60000, 2000 * Math.pow(2, attempt - 1));
      console.log(`  ⚠ Network fault on ${label} (${err.cause?.code || err.message}) — retry ${attempt}/${MAX_ATTEMPTS - 1} in ${Math.round(waitMs/1000)}s...`);
      await sleep(waitMs);
      continue;
    }
    if (response.status === 429) {
      console.log('  ⏳ Rate limited — waiting 60s...');
      await sleep(config.RETRY_DELAY_MS);
      continue;
    }
    if (response.status >= 500 && attempt < MAX_ATTEMPTS) {
      const waitMs = Math.min(60000, 2000 * Math.pow(2, attempt - 1));
      console.log(`  ⚠ API ${response.status} on ${label} — retry ${attempt}/${MAX_ATTEMPTS - 1} in ${Math.round(waitMs/1000)}s...`);
      await sleep(waitMs);
      continue;
    }
    const text = await response.text().catch(() => '(body unreadable)');
    throw new Error(`API ${response.status} on ${label}: ${text}`);
  }
}

/**
 * Fetch a single endpoint (no pagination).
 * Returns the parsed JSON response body.
 */
async function fetchOne(endpoint) {
  const url = `${config.BASE_URL}${endpoint}?api_key=${config.API_KEY}&format=json`;
  return fetchJsonWithRetry(url, endpoint);
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
    const data = await fetchJsonWithRetry(url, `${endpoint} @${offset}`);

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

module.exports = { fetchOne, fetchAll, fetchJsonWithRetry };
