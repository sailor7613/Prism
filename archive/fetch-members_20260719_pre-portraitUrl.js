/**
 * Prism Data Pipeline — Fetch Members
 * 
 * Pulls all current members of Congress from Congress.gov API,
 * downloads DW-NOMINATE ideology scores from Voteview, merges
 * on bioguide ID, and returns the combined dataset.
 * 
 * Not meant to be run directly — called by run-all.js
 */

const config = require('./config');
const { fetchAll } = require('./congress-client');

// ── State Abbreviations ─────────────────────────────────────────────────────

const STATE_ABBREV = {
  'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA',
  'Colorado':'CO','Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA',
  'Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA',
  'Kansas':'KS','Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD',
  'Massachusetts':'MA','Michigan':'MI','Minnesota':'MN','Mississippi':'MS',
  'Missouri':'MO','Montana':'MT','Nebraska':'NE','Nevada':'NV',
  'New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM','New York':'NY',
  'North Carolina':'NC','North Dakota':'ND','Ohio':'OH','Oklahoma':'OK',
  'Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC',
  'South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT',
  'Virginia':'VA','Washington':'WA','West Virginia':'WV','Wisconsin':'WI',
  'Wyoming':'WY','District of Columbia':'DC','American Samoa':'AS','Guam':'GU',
  'Northern Mariana Islands':'MP','Puerto Rico':'PR','U.S. Virgin Islands':'VI',
};

function abbrevState(fullName) {
  return STATE_ABBREV[fullName] || fullName;
}

/**
 * Parse "Last, First M." into { firstName, lastName }
 * e.g. "Alsobrooks, Angela D." → { firstName: "Angela D.", lastName: "Alsobrooks" }
 */
function parseName(combined) {
  if (!combined) return { firstName: null, lastName: null };
  const commaIdx = combined.indexOf(',');
  if (commaIdx === -1) return { firstName: null, lastName: combined.trim() };
  return {
    lastName: combined.substring(0, commaIdx).trim(),
    firstName: combined.substring(commaIdx + 1).trim(),
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function partyLetter(partyName) {
  if (!partyName) return '?';
  const lower = partyName.toLowerCase();
  if (lower.includes('democrat')) return 'D';
  if (lower.includes('republican')) return 'R';
  if (lower.includes('independent')) return 'I';
  return partyName.charAt(0).toUpperCase();
}

function formatDistrict(state, district, chamber) {
  if (chamber === 'senate') return state;
  if (!district || district === 'At-Large') return `${state}-AL`;
  return `${state}-${district}`;
}

function chamberLabel(chamber) {
  if (chamber === 'senate') return 'Senator';
  if (chamber === 'house') return 'Representative';
  return chamber;
}

/**
 * Parse a CSV line that may contain quoted fields with commas inside.
 * e.g.  1,President,99869,99,0,USA,5000,,,"WASHINGTON, George",,,,
 * Returns an array of field values with quotes stripped.
 */
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());  // Last field
  return fields;
}

// ── Voteview NOMINATE Download ──────────────────────────────────────────────

async function fetchNominateScores() {
  console.log('📡 Downloading Voteview DW-NOMINATE data...');
  console.log(`   (${config.VOTEVIEW_URL})`);
  console.log('   This file is ~25MB, may take a moment...\n');

  let response;
  try {
    response = await fetch(config.VOTEVIEW_URL);
  } catch (err) {
    console.log(`   ⚠️  Voteview download failed: ${err.message}`);
    console.log('   Continuing without NOMINATE scores.\n');
    return new Map();
  }

  if (!response.ok) {
    console.log(`   ⚠️  Voteview returned ${response.status}`);
    console.log('   Continuing without NOMINATE scores.\n');
    return new Map();
  }

  const csvText = await response.text();
  const lines = csvText.split('\n');

  // Parse header row to find column positions
  const headers = parseCSVLine(lines[0]);
  const col = {};
  ['bioguide_id', 'congress', 'nominate_dim1', 'nominate_dim2'].forEach(name => {
    col[name] = headers.indexOf(name);
    if (col[name] === -1) {
      console.log(`   ⚠️  Column "${name}" not found in Voteview CSV`);
    }
  });

  // Keep only the most recent congress entry per member
  const scoreMap = new Map();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);

    const bioguide = fields[col.bioguide_id];
    const congress = parseInt(fields[col.congress]);
    const dim1 = parseFloat(fields[col.nominate_dim1]);
    const dim2 = parseFloat(fields[col.nominate_dim2]);

    // Skip rows with no bioguide ID (early historical members)
    if (!bioguide || bioguide === 'NA' || bioguide === '') continue;

    const existing = scoreMap.get(bioguide);
    if (!existing || congress > existing.congress) {
      scoreMap.set(bioguide, { dim1, dim2, congress });
    }
  }

  console.log(`✅ NOMINATE scores: ${scoreMap.size} unique members\n`);
  return scoreMap;
}

// ── Main Export ──────────────────────────────────────────────────────────────

async function fetchMembers() {
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  MEMBERS — ${config.CONGRESS_NUMBER}th Congress`);
  console.log(`${'═'.repeat(50)}\n`);

  // Fetch both sources (API + Voteview) at the same time
  const [apiMembers, nominateScores] = await Promise.all([
    fetchAll(`/member/congress/${config.CONGRESS_NUMBER}`, 'members'),
    fetchNominateScores(),
  ]);

  console.log('🔧 Merging data...\n');

  let matched = 0;
  let unmatched = 0;

  const prismMembers = apiMembers.map(m => {
    const bioguideId = m.bioguideId || null;

    // Find the latest term for current chamber/state/district
    const terms = m.terms?.item || [];
    const latestTerm = terms.reduce((latest, t) => {
      if (!latest) return t;
      return (t.startYear || 0) > (latest.startYear || 0) ? t : latest;
    }, null);

    const rawChamber = latestTerm?.chamber || terms[0]?.chamber || '';
    const chamber = rawChamber.toLowerCase().includes('senate') ? 'senate' : 'house';
    const rawState = m.state || latestTerm?.stateCode || '';
    const stateCode = abbrevState(rawState);
    const district = m.district || latestTerm?.district || null;
    const party = m.partyName || latestTerm?.partyName || '';
    const pLetter = partyLetter(party);

    // Parse "Last, First M." into separate fields
    const fullName = m.name || '';
    const { firstName, lastName } = parseName(fullName);
    // Display name: "First Last" instead of "Last, First"
    const displayName = firstName && lastName
      ? `${firstName} ${lastName}`
      : fullName;

    // NOMINATE lookup
    const nominate = nominateScores.get(bioguideId);
    if (nominate) matched++;
    else unmatched++;

    // Build display string: "D-MD · Senator" or "D-NY-14 · Representative"
    const distLabel = formatDistrict(stateCode, district, chamber);
    const meta = `${pLetter}-${distLabel} · ${chamberLabel(chamber)}`;

    return {
      bioguideId,
      name: displayName,
      firstName: firstName || null,
      lastName: lastName || null,
      meta,
      party: pLetter,
      partyFull: party,
      chamber,
      state: stateCode,
      district: district || null,
      inOffice: m.currentMember !== false,
      terms: terms.map(t => ({
        congress: t.congress || null,
        chamber: t.chamber || '',
        startYear: t.startYear || null,
        endYear: t.endYear || null,
      })),
      nominateD1: nominate && !isNaN(nominate.dim1) ? nominate.dim1 : null,
      nominateD2: nominate && !isNaN(nominate.dim2) ? nominate.dim2 : null,
      nominateCongress: nominate ? nominate.congress : null,
      photoUrl: bioguideId
        ? `https://bioguide.congress.gov/bioguide/photo/${bioguideId.charAt(0)}/${bioguideId}.jpg`
        : null,
      positions: [],
      lastUpdated: new Date().toISOString(),
    };
  });

  // Sort: senators first, then reps, alphabetical by last name within
  prismMembers.sort((a, b) => {
    if (a.chamber !== b.chamber) return a.chamber === 'senate' ? -1 : 1;
    return (a.lastName || a.name).localeCompare(b.lastName || b.name);
  });

  console.log(`  NOMINATE matched: ${matched}`);
  console.log(`  NOMINATE unmatched: ${unmatched} (likely freshmen)\n`);

  return prismMembers;
}

module.exports = { fetchMembers };
