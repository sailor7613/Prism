#!/usr/bin/env node
// ============================================================
// fetch_members.js — Congress.gov API → prism_members.json
// 
// Usage:
//   node fetch_members.js YOUR_API_KEY
//
// Fetches all current members of the 119th Congress and outputs
// a clean JSON file ready for PrismDB ingestion.
//
// Rate limit: 5,000 requests/hour (Congress.gov)
// Pagination: max 250 per page
// ============================================================

const API_KEY = process.argv[2];
if (!API_KEY) {
  console.error('Usage: node fetch_members.js YOUR_API_KEY');
  process.exit(1);
}

const BASE = 'https://api.congress.gov/v3';
const CONGRESS = 119; // Current congress

// Bioguide photo URL convention
function photoUrl(bioguideId) {
  return `https://bioguide.congress.gov/bioguide/photo/${bioguideId[0]}/${bioguideId}.jpg`;
}

async function fetchPage(offset = 0) {
  const url = `${BASE}/member?congress=${CONGRESS}&currentMember=true&limit=250&offset=${offset}&api_key=${API_KEY}&format=json`;
  console.log(`  Fetching offset ${offset}...`);
  
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  const data = await res.json();
  return data;
}

async function fetchAllMembers() {
  console.log(`Fetching current members of the ${CONGRESS}th Congress...\n`);
  
  let allMembers = [];
  let offset = 0;
  let totalCount = null;
  
  while (true) {
    const data = await fetchPage(offset);
    
    if (totalCount === null) {
      totalCount = data.pagination?.count || 0;
      console.log(`  Total members reported: ${totalCount}\n`);
    }
    
    const members = data.members || [];
    if (members.length === 0) break;
    
    allMembers = allMembers.concat(members);
    offset += members.length;
    
    // Respect rate limits — small delay between pages
    if (offset < totalCount) {
      await new Promise(r => setTimeout(r, 200));
    } else {
      break;
    }
  }
  
  console.log(`\nFetched ${allMembers.length} raw member records.\n`);
  return allMembers;
}

function transformMember(raw) {
  // Congress.gov API member shape:
  // {
  //   bioguideId, name, state, district, partyName,
  //   terms: { item: [{ chamber, congress, startYear, endYear }] },
  //   depiction: { imageUrl, attribution }
  // }
  
  const terms = (raw.terms?.item || []).map(t => ({
    congress: t.congress,
    chamber: t.chamber === 'Senate' ? 'senate' : 'house',
    startYear: t.startYear,
    endYear: t.endYear || null
  }));
  
  // Determine current chamber from most recent term
  const currentTerm = terms.find(t => t.congress === CONGRESS) || terms[0] || {};
  const chamber = currentTerm.chamber || 'house';
  
  // Parse party from partyName
  const partyMap = {
    'Democratic': 'D',
    'Republican': 'R',
    'Independent': 'I',
    'Libertarian': 'L'
  };
  const party = partyMap[raw.partyName] || raw.partyName?.charAt(0) || '?';
  
  // District: null for senators, number for house members
  const district = chamber === 'senate' ? null : (raw.district || null);
  
  return {
    bioguideId: raw.bioguideId,
    name: {
      first: raw.name?.split(',')[1]?.trim() || '',
      last: raw.name?.split(',')[0]?.trim() || '',
      full: raw.name ? raw.name.split(',').reverse().map(s => s.trim()).join(' ') : ''
    },
    party,
    chamber,
    state: raw.state || '',
    district,
    inOffice: true,
    terms,
    nominateD1: null,  // To be merged from Voteview data
    nominateD2: null,
    photoUrl: raw.depiction?.imageUrl || photoUrl(raw.bioguideId),
    lastUpdated: new Date().toISOString()
  };
}

async function main() {
  try {
    const rawMembers = await fetchAllMembers();
    
    const members = rawMembers.map(transformMember);
    
    // Sort by chamber, then state, then name
    members.sort((a, b) => {
      if (a.chamber !== b.chamber) return a.chamber === 'senate' ? -1 : 1;
      if (a.state !== b.state) return a.state.localeCompare(b.state);
      return a.name.last.localeCompare(b.name.last);
    });
    
    // Stats
    const senators = members.filter(m => m.chamber === 'senate');
    const reps = members.filter(m => m.chamber === 'house');
    const parties = {};
    members.forEach(m => { parties[m.party] = (parties[m.party] || 0) + 1; });
    
    console.log('=== Summary ===');
    console.log(`  Senate:  ${senators.length}`);
    console.log(`  House:   ${reps.length}`);
    console.log(`  Total:   ${members.length}`);
    console.log(`  Parties: ${JSON.stringify(parties)}`);
    
    // Write output
    const fs = require('fs');
    const outPath = './prism_members.json';
    fs.writeFileSync(outPath, JSON.stringify(members, null, 2));
    console.log(`\nWritten to ${outPath}`);
    
    // Also write a compact version for production loading
    const compactPath = './prism_members.min.json';
    fs.writeFileSync(compactPath, JSON.stringify(members));
    console.log(`Compact version: ${compactPath}`);
    
    console.log('\nNext steps:');
    console.log('  1. Copy prism_members.json to your Code/ directory');
    console.log('  2. Optional: merge Voteview DW-NOMINATE scores with merge_nominate.js');
    console.log('  3. Load into PrismDB via PrismDB.loadMembers(data)');
    
  } catch (err) {
    console.error('Fatal error:', err.message);
    process.exit(1);
  }
}

main();
