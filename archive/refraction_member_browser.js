// ============================================================
// REFRACTION PANEL — Member Browser
// 
// This file contains the HTML, CSS, and JS patches to wire the
// Refraction panel to PrismDB member data. Apply to index-v56.html.
//
// Three sections:
//   1. CSS — add to the stylesheet section
//   2. HTML — replace the "Legislators on Graph — still locked" div
//   3. JS — add functions after renderRefractionSubs()
// ============================================================


// ─────────────────────────────────────────────────────────────
// 1. CSS — Insert after the existing refraction CSS block
//    (after .ref-topic-tag { ... })
// ─────────────────────────────────────────────────────────────

/*

/* Refraction member browser */
.ref-member-browser { padding: 0; }

.ref-search-bar {
  display: flex; gap: 6px; padding: 0 24px 10px;
}
.ref-search-bar input {
  flex: 1; min-width: 0;
  font-family: 'DM Mono', monospace; font-size: 9px;
  letter-spacing: 0.06em; color: var(--text);
  background: var(--surface-raised); border: 1px solid var(--border);
  padding: 7px 10px; outline: none;
  transition: border-color 0.2s;
}
.ref-search-bar input:focus { border-color: var(--border-strong); }
.ref-search-bar input::placeholder { color: var(--text-muted); opacity: 0.5; }

.ref-filter-row {
  display: flex; gap: 4px; padding: 0 24px 10px;
  flex-wrap: wrap;
}
.ref-filter-btn {
  font-family: 'DM Mono', monospace; font-size: 7px;
  letter-spacing: 0.14em; text-transform: uppercase;
  padding: 4px 8px; background: var(--surface-raised);
  border: 1px solid var(--border); color: var(--text-muted);
  cursor: pointer; transition: all 0.2s;
}
.ref-filter-btn:hover { border-color: var(--border-strong); }
.ref-filter-btn.active {
  background: var(--ink); color: var(--surface);
  border-color: var(--ink);
}
.ref-filter-btn.active-d { background: var(--blue); border-color: var(--blue); color: white; }
.ref-filter-btn.active-r { background: var(--red); border-color: var(--red); color: white; }
.ref-filter-btn.active-i { background: var(--green); border-color: var(--green); color: white; }

.ref-member-list {
  max-height: 360px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 4px;
  padding: 0 24px;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}
.ref-member-list::-webkit-scrollbar { width: 4px; }
.ref-member-list::-webkit-scrollbar-track { background: transparent; }
.ref-member-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

.ref-member-card {
  display: flex; align-items: center; gap: 10px;
  background: var(--surface-raised); border: 1px solid var(--border);
  padding: 8px 12px; position: relative; overflow: hidden;
  transition: border-color 0.2s; cursor: pointer;
}
.ref-member-card:hover { border-color: var(--border-strong); }
.ref-member-card::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
}
.ref-member-card.party-d::before { background: var(--blue); }
.ref-member-card.party-r::before { background: var(--red); }
.ref-member-card.party-i::before { background: var(--green); }

.ref-member-card .ref-card-initial {
  width: 26px; height: 26px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Playfair Display', serif; font-size: 10px; color: white;
  flex-shrink: 0;
}
.ref-member-card .ref-card-info { flex: 1; min-width: 0; }
.ref-member-card .ref-card-name {
  font-family: 'Playfair Display', serif; font-size: 11px; color: var(--text);
  line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ref-member-card .ref-card-meta {
  font-family: 'DM Mono', monospace; font-size: 7px; color: var(--text-muted);
  letter-spacing: 0.08em; margin-top: 1px;
}

.ref-member-card .ref-quad-badge {
  font-family: 'DM Mono', monospace; font-size: 7px;
  letter-spacing: 0.12em; text-transform: uppercase;
  padding: 2px 6px; border: 1px solid var(--border);
  color: var(--text-muted); flex-shrink: 0;
}
.ref-member-card .ref-quad-badge.has-position {
  border-color: var(--gold); color: var(--gold);
}

.ref-member-count {
  font-family: 'DM Mono', monospace; font-size: 7px;
  letter-spacing: 0.12em; color: var(--text-muted);
  padding: 6px 24px 0; text-transform: uppercase;
}

.ref-member-empty {
  padding: 20px 24px; text-align: center;
}
.ref-member-empty .empty-icon {
  font-size: 16px; opacity: 0.15; margin-bottom: 6px;
}
.ref-member-empty .empty-text {
  font-family: 'DM Mono', monospace; font-size: 8px;
  letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--text-muted);
}

*/


// ─────────────────────────────────────────────────────────────
// 2. HTML — Replace this entire block:
//
//   <!-- Legislators on Graph — still locked -->
//   <div style="padding: 14px 24px 0;">
//     ...everything through the closing </div> of that section...
//   </div>
//
// With this:
// ─────────────────────────────────────────────────────────────

/*

      <!-- Legislators — Live from Congress.gov -->
      <div style="padding: 14px 0 0;" class="ref-member-browser">
        <div class="section-label" style="padding: 0 24px 8px;">Members of Congress</div>

        <div class="ref-search-bar">
          <input type="text" id="refMemberSearch" placeholder="Search by name, state..."
            oninput="filterRefractionMembers()">
        </div>

        <div class="ref-filter-row">
          <button class="ref-filter-btn active" data-filter="chamber" data-value="all" onclick="setRefFilter(this)">All</button>
          <button class="ref-filter-btn" data-filter="chamber" data-value="senate" onclick="setRefFilter(this)">Senate</button>
          <button class="ref-filter-btn" data-filter="chamber" data-value="house" onclick="setRefFilter(this)">House</button>
          <span style="width:6px;"></span>
          <button class="ref-filter-btn active" data-filter="party" data-value="all" onclick="setRefFilter(this)">All</button>
          <button class="ref-filter-btn" data-filter="party" data-value="D" onclick="setRefFilter(this)">D</button>
          <button class="ref-filter-btn" data-filter="party" data-value="R" onclick="setRefFilter(this)">R</button>
          <button class="ref-filter-btn" data-filter="party" data-value="I" onclick="setRefFilter(this)">I</button>
        </div>

        <div class="ref-member-count" id="refMemberCount"></div>
        <div class="ref-member-list" id="refMemberList"></div>
        <div class="ref-member-empty" id="refMemberEmpty" style="display:none;">
          <div class="empty-icon">◇</div>
          <div class="empty-text">No members loaded</div>
        </div>
      </div>

*/


// ─────────────────────────────────────────────────────────────
// 3. JS — Add after the renderRefractionSubs() function
// ─────────────────────────────────────────────────────────────

// ── Refraction Member Browser ─────────────────────────────
const _refFilters = { chamber: 'all', party: 'all' };

function setRefFilter(btn) {
  const filterType = btn.dataset.filter;
  const value = btn.dataset.value;
  _refFilters[filterType] = value;

  // Update active states within this filter group
  btn.parentElement.querySelectorAll(`[data-filter="${filterType}"]`).forEach(b => {
    b.classList.remove('active', 'active-d', 'active-r', 'active-i');
  });
  if (filterType === 'party' && value !== 'all') {
    btn.classList.add('active-' + value.toLowerCase());
  } else {
    btn.classList.add('active');
  }

  filterRefractionMembers();
}

function filterRefractionMembers() {
  const query = (document.getElementById('refMemberSearch')?.value || '').toLowerCase().trim();
  const { chamber, party } = _refFilters;

  let members = PrismDB.getMembers();
  if (!members.length) {
    document.getElementById('refMemberEmpty').style.display = 'block';
    document.getElementById('refMemberList').innerHTML = '';
    document.getElementById('refMemberCount').textContent = '';
    return;
  }
  document.getElementById('refMemberEmpty').style.display = 'none';

  // Apply filters
  if (chamber !== 'all') {
    members = members.filter(m => m.chamber === chamber);
  }
  if (party !== 'all') {
    members = members.filter(m => m.party === party);
  }
  if (query) {
    members = members.filter(m =>
      m.name.full.toLowerCase().includes(query) ||
      m.state.toLowerCase().includes(query) ||
      m.bioguideId.toLowerCase().includes(query)
    );
  }

  // Update count
  const total = PrismDB.getMembers().length;
  document.getElementById('refMemberCount').textContent =
    members.length === total
      ? `${total} members`
      : `${members.length} of ${total} members`;

  // Get active event for position lookups
  const activeEvent = PrismDB.getActiveEvent();
  const activeEventId = activeEvent ? activeEvent.id : null;

  // Render (cap at 100 for scroll performance; full list on search)
  const display = members.slice(0, query ? 200 : 100);
  const list = document.getElementById('refMemberList');

  list.innerHTML = display.map(m => {
    const partyClass = m.party === 'D' ? 'party-d' : m.party === 'R' ? 'party-r' : 'party-i';
    const partyColor = m.party === 'D' ? 'var(--blue)' : m.party === 'R' ? 'var(--red)' : 'var(--green)';
    const initials = m.name.full.split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 2);
    const chamberLabel = m.chamber === 'senate' ? 'Sen.' : 'Rep.';
    const district = m.chamber === 'house' && m.district ? '-' + m.district : '';
    const meta = `${chamberLabel} · ${m.party} · ${m.state}${district}`;

    // Check for position on active event
    let positionBadge = '';
    if (activeEventId) {
      const pos = PrismDB.getMemberPosition(m.bioguideId, activeEventId);
      if (pos) {
        positionBadge = `<div class="ref-quad-badge has-position">${pos.quadrant}</div>`;
      }
    }

    return `
      <div class="ref-member-card ${partyClass}" data-bioguide="${m.bioguideId}">
        <div class="ref-card-initial" style="background:${partyColor};">${initials}</div>
        <div class="ref-card-info">
          <div class="ref-card-name">${m.name.full}</div>
          <div class="ref-card-meta">${meta}</div>
        </div>
        ${positionBadge}
      </div>`;
  }).join('');

  // Show truncation notice
  if (display.length < members.length) {
    list.innerHTML += `
      <div style="padding:8px 0; text-align:center;">
        <span style="font-family:'DM Mono',monospace; font-size:7px; letter-spacing:0.12em; color:var(--text-muted); text-transform:uppercase;">
          ${members.length - display.length} more — search to narrow
        </span>
      </div>`;
  }
}

// Initialize member browser on app load
function initRefractionMembers() {
  const members = PrismDB.getMembers();
  if (members.length) {
    filterRefractionMembers();
  } else {
    // Show empty state with load instruction
    const empty = document.getElementById('refMemberEmpty');
    if (empty) {
      empty.style.display = 'block';
      empty.querySelector('.empty-text').textContent = 'Run PrismDB.loadMembers() to populate';
    }
  }
}

// Call after app initialization:
// initRefractionMembers();
