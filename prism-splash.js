// prism-splash.js — Splash, onboarding, profile setup, portal entry

let appEntered = false;

// ============================================================
// SPLASH AVATARS — helix float via requestAnimationFrame
// ============================================================
const AVATAR_CONFIG = [
  { id:'av-buddy',   src:'../Artwork/Avatars/Buddy.png',   arrive:'arriveLeft',  delay:1.2 },
  { id:'av-charlie', src:'../Artwork/Avatars/Charlie.png', arrive:'arriveLeft',  delay:1.35 },
  { id:'av-gary',    src:'../Artwork/Avatars/Gary.png',    arrive:'arriveLeft',  delay:1.5 },
  { id:'av-george',  src:'../Artwork/Avatars/George.png',  arrive:'arriveLeft',  delay:1.65 },
  { id:'av-gorku',   src:'../Artwork/Avatars/Gorku.png',   arrive:'arriveLeft',  delay:1.8 },
  { id:'av-max',     src:'../Artwork/Avatars/Max.png',     arrive:'arriveLeft',  delay:1.95 },
  { id:'av-nick',    src:'../Artwork/Avatars/Nick.png',    arrive:'arriveLeft',  delay:2.1 },
  { id:'av-ross',    src:'../Artwork/Avatars/Ross.png',    arrive:'arriveLeft',  delay:2.25 },
  { id:'av-paul',    src:'../Artwork/Avatars/Paul.png',    arrive:'arriveRight', delay:2.0 },
  { id:'av-ted',     src:'../Artwork/Avatars/Ted.png',     arrive:'arriveBelow', delay:2.4 },
  { id:'av-sally',   src:'../Artwork/Avatars/Sally.png',   arrive:'arriveBelow', delay:2.6 },
  { id:'av-peter',   src:'../Artwork/Avatars/Peter.png',   arrive:'arriveBelow', delay:2.8 },
];

// Helix phase offsets — evenly distributed around the ellipse so no two avatars
// are at the same point simultaneously. Paul and the bottom three get their own
// gentler amplitude so they feel distinct from the left cluster.
const HELIX_PHASES  = [0, 0.52, 1.05, 1.57, 2.09, 2.62, 3.14, 3.67, 1.2, 0.8, 2.0, 3.0];
const HELIX_SPEEDS  = [0.48, 0.44, 0.50, 0.46, 0.52, 0.42, 0.49, 0.45, 0.38, 0.40, 0.43, 0.41]; // radians/sec
const HELIX_AMP_Y   = [7, 6, 8, 5, 7, 6, 8, 5,  5,  6,  5,  7 ]; // vertical px
const HELIX_AMP_X   = [2, 1.5, 2, 1, 2, 1.5, 2, 1, 1.5, 2, 1.5, 2]; // subtle horizontal drift

let helixEls = [];
let helixActive = false;

function initAvatars() {
  AVATAR_CONFIG.forEach((cfg, i) => {
    const el = document.getElementById(cfg.id);
    if (!el) return;
    el.innerHTML = `<img src="${cfg.src}" alt="">`;
    const arriveDuration = 0.65;
    el.style.animation = `${cfg.arrive} ${arriveDuration}s cubic-bezier(0.22,1,0.36,1) ${cfg.delay}s forwards`;

    const readyAt = (cfg.delay + arriveDuration + 0.05) * 1000;
    setTimeout(() => {
      el.style.opacity = '1';
      el.style.animation = 'none';
      helixEls.push({ el, i, phase: HELIX_PHASES[i] });
      if (!helixActive) startHelix();
    }, readyAt);
  });
}

function startHelix() {
  helixActive = true;
  let last = null;
  function tick(ts) {
    if (!helixActive) return;
    if (!last) last = ts;
    const dt = (ts - last) / 1000;
    last = ts;
    helixEls.forEach(({ el, i, phase }, idx) => {
      helixEls[idx].phase += HELIX_SPEEDS[i] * dt;
      const dy = Math.sin(helixEls[idx].phase) * HELIX_AMP_Y[i];
      const dx = Math.cos(helixEls[idx].phase * 0.7) * HELIX_AMP_X[i];
      el.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`;
    });
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ============================================================
// ONBOARDING SLIDES
// ============================================================
let obSlide = 0;
const OB_TOTAL = 3;
let obSwipeStartX = 0;

function showOnboarding() {
  if (appEntered) return;
  appEntered = true;
  helixActive = false;

  const splash = document.getElementById('splash');
  const ob = document.getElementById('onboarding');
  const outProps = 'opacity 0.45s ease, transform 0.45s ease';

  // Animate wordmark up and away
  const wordmark = splash.querySelector('.splash-wordmark-wrap');
  if (wordmark) {
    wordmark.style.transition = outProps;
    wordmark.style.opacity = '0';
    wordmark.style.transform = 'translateY(-30px)';
  }

  // Avatars and credits scatter out
  splash.querySelectorAll('.splash-avatar').forEach((av, i) => {
    av.style.transition = outProps;
    setTimeout(() => {
      av.style.opacity = '0';
      av.style.transform = 'scale(0.6)';
    }, i * 35);
  });

  const ui = splash.querySelector('.splash-ui');
  if (ui) {
    ui.style.transition = outProps;
    setTimeout(() => { ui.style.opacity = '0'; ui.style.transform = 'translateY(16px)'; }, 80);
  }

  // Logo rises — fade splash, fade in onboarding
  const logo = splash.querySelector('.splash-logo-wrap');
  if (logo) {
    logo.style.transition = outProps;
    setTimeout(() => { logo.style.opacity = '0'; logo.style.transform = 'translateY(-20px)'; }, 40);
  }

  setTimeout(() => {
    splash.style.display = 'none';
    ob.classList.add('visible');
    requestAnimationFrame(() => requestAnimationFrame(() => ob.classList.add('in')));
  }, 520);

  // Swipe support on the slide track
  const wrap = document.getElementById('obTrackWrap');
  wrap.addEventListener('touchstart', e => { obSwipeStartX = e.touches[0].clientX; }, { passive: true });
  wrap.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - obSwipeStartX;
    if (dx < -40) goObSlide(obSlide + 1);
    if (dx >  40) goObSlide(obSlide - 1);
  }, { passive: true });
  // Mouse drag support for desktop testing
  let mouseDown = false, mouseStartX = 0;
  wrap.addEventListener('mousedown', e => { mouseDown = true; mouseStartX = e.clientX; });
  wrap.addEventListener('mouseup', e => {
    if (!mouseDown) return; mouseDown = false;
    const dx = e.clientX - mouseStartX;
    if (dx < -40) goObSlide(obSlide + 1);
    if (dx >  40) goObSlide(obSlide - 1);
  });
}

function goObSlide(idx) {
  if (idx < 0 || idx >= OB_TOTAL) return;
  obSlide = idx;
  document.getElementById('obTrack').style.transform = `translateX(${-idx * 100}%)`;
  document.querySelectorAll('.ob-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
  // Show BEAM button only on last slide
  const beamWrap = document.getElementById('obBeamWrap');
  beamWrap.style.opacity = idx === OB_TOTAL - 1 ? '1' : '0';
  beamWrap.style.pointerEvents = idx === OB_TOTAL - 1 ? 'auto' : 'none';
}

// ============================================================
// LAUNCH — slide 3 BEAM → profile setup (video fires on Enter Prism)
// ============================================================
function launchApp() {
  const ob = document.getElementById('onboarding');

  ob.querySelectorAll('.ob-slide, .ob-logo, .ob-dots, .ob-beam-wrap').forEach(el => {
    el.style.transition = 'opacity 0.4s ease';
    el.style.opacity = '0';
  });

  setTimeout(() => {
    ob.style.display = 'none';
    showProfileSetup();
  }, 450);
}

// ============================================================
// PROFILE SETUP
// ============================================================

// ── Avatar data ──
const AVATARS = [
  { id:'buddy',   name:'Buddy',   color:'#d45555' },
  { id:'charlie', name:'Charlie', color:'#5a82b8' },
  { id:'gary',    name:'Gary',    color:'#5ea872' },
  { id:'george',  name:'George',  color:'#d49245' },
  { id:'gorku',   name:'Gorku',   color:'#9a6ab8' },
  { id:'max',     name:'Max',     color:'#d4b550' },
  { id:'nick',    name:'Nick',    color:'#3a9a8a' },
  { id:'paul',    name:'Paul',    color:'#b85a5a' },
  { id:'peter',   name:'Peter',   color:'#5a8ab8' },
  { id:'ross',    name:'Ross',    color:'#8ab85a' },
  { id:'sally',   name:'Sally',   color:'#b87aaa' },
  { id:'ted',     name:'Ted',     color:'#d45555' },
];


// ── Legislation data ──


// ── Topics data ──
const TOPICS_DATA = [
  'Foreign Policy', 'East Asia & Taiwan', 'NATO & Ukraine',
  'Immigration & Border', 'Healthcare Policy', 'Climate & Energy',
  'Technology & AI', 'Housing & Rent', 'Criminal Justice',
  'Election Integrity', 'Trade & Tariffs', 'Defense Spending',
  'Social Security', 'Tax Policy', 'Free Speech & Censorship',
  'Drug Policy', 'Education', 'Labor & Unions',
  'Financial Regulation', 'Gun Policy', 'Abortion & Reproductive Rights',
  'Race & Civil Rights', 'LGBTQ+ Rights', 'Police Reform',
];

// ── State ──
let psSelectedAvatarId = null;
let psFollowing = { politicians: new Set(), legislation: new Set() };
let psTopicsFollowing = new Set();
let psActiveTab = 'politicians';

function showProfileSetup() {
  const ps = document.getElementById('profileSetup');
  ps.classList.add('visible');
  requestAnimationFrame(() => requestAnimationFrame(() => ps.classList.add('in')));
  buildAvatarGrid();
  buildPoliticiansList();
  buildLegislationList();
  buildTopicGrid();
  // Watch username input to enable continue
  document.getElementById('psUsernameInput').addEventListener('input', checkStep1Ready);
}

function buildAvatarGrid() {
  const grid = document.getElementById('psAvatarGrid');
  grid.innerHTML = AVATARS.map(av => `
    <div class="ps-av-item" id="psAvItem-${av.id}" onclick="psSelectAvatar('${av.id}')">
      <div class="ps-av-circle" style="background:${av.color};">
        <img src="../Artwork/Avatars/${av.id}.png" alt="${av.name}"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <span class="ps-av-fallback" style="display:none;">${av.name[0]}</span>
      </div>
      <div class="ps-av-name">${av.name}</div>
    </div>
  `).join('');
}

function psSelectAvatar(id) {
  psSelectedAvatarId = id;
  // Clear all selected states
  document.querySelectorAll('.ps-av-item').forEach(el => el.classList.remove('selected'));
  document.getElementById('psAvItem-'+id).classList.add('selected');
  // Update preview
  const av = AVATARS.find(a => a.id === id);
  const preview = document.getElementById('psSelectedAvatar');
  preview.classList.add('chosen');
  preview.innerHTML = `
    <img src="../Artwork/Avatars/${id}.png" alt="${av.name}"
      onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
    <span class="ps-av-initial" style="display:none; color:white; background:${av.color}; width:100%; height:100%; border-radius:50%; align-items:center; justify-content:center;">${av.name[0]}</span>
  `;
  checkStep1Ready();
}

function checkStep1Ready() {
  const hasAvatar = psSelectedAvatarId !== null;
  const hasName = document.getElementById('psUsernameInput').value.trim().length >= 2;
  document.getElementById('psStep1Btn').disabled = !(hasAvatar && hasName);
}

function goProfileStep2() {
  document.getElementById('psStep1').style.display = 'none';
  document.getElementById('psStep2').style.display = 'flex';
  document.getElementById('psStepLabel').textContent = 'Step 2 of 2 — Your Feed';
}

function psSetTab(tab) {
  psActiveTab = tab;
  ['politicians','legislation','topics'].forEach(t => {
    document.getElementById('psTab-'+t).classList.toggle('active', t===tab);
    const panel = document.getElementById('psPanel-'+t);
    panel.style.display = t===tab ? 'flex' : 'none';
  });
}

function buildPoliticiansList() {
  renderList('politicians', POLITICIANS_DATA, psFollowing.politicians);
}

function buildLegislationList() {
  renderList('legislation', LEGISLATION_DATA, psFollowing.legislation);
}

function renderList(type, data, followSet) {
  const container = document.getElementById('psList-'+type);
  container.innerHTML = data.map(item => `
    <div class="ps-list-item">
      <div class="ps-item-info">
        <div class="ps-item-name">${item.name}</div>
        <div class="ps-item-meta">${item.meta}</div>
      </div>
      <button class="ps-follow-btn ${followSet.has(item.id)?'following':''}"
        id="psFollow-${type}-${item.id}"
        onclick="psToggleFollow('${type}','${item.id}',this)">
        ${followSet.has(item.id)?'✓':'+'}
      </button>
    </div>
  `).join('');
}

function psToggleFollow(type, id, btn) {
  const set = psFollowing[type];
  if (set.has(id)) { set.delete(id); btn.classList.remove('following'); btn.textContent = '+'; }
  else { set.add(id); btn.classList.add('following'); btn.textContent = '✓'; }
}

function psFilterList(type) {
  const data = type === 'politicians' ? POLITICIANS_DATA : LEGISLATION_DATA;
  const query = document.getElementById('psSearch'+type.charAt(0).toUpperCase()+type.slice(1)).value.toLowerCase();
  const filtered = query ? data.filter(d => d.name.toLowerCase().includes(query) || d.meta.toLowerCase().includes(query)) : data;
  const container = document.getElementById('psList-'+type);
  const followSet = psFollowing[type];
  container.innerHTML = filtered.map(item => `
    <div class="ps-list-item">
      <div class="ps-item-info">
        <div class="ps-item-name">${item.name}</div>
        <div class="ps-item-meta">${item.meta}</div>
      </div>
      <button class="ps-follow-btn ${followSet.has(item.id)?'following':''}"
        id="psFollow-${type}-${item.id}"
        onclick="psToggleFollow('${type}','${item.id}',this)">
        ${followSet.has(item.id)?'✓':'+'}
      </button>
    </div>
  `).join('');
}

function buildTopicGrid() {
  const grid = document.getElementById('psTopicGrid');
  grid.innerHTML = TOPICS_DATA.map(t => `
    <button class="ps-topic-tag ${psTopicsFollowing.has(t)?'selected':''}"
      onclick="psToggleTopic('${t}',this)">
      ${t}
    </button>
  `).join('');
}

function psToggleTopic(topic, btn) {
  if (psTopicsFollowing.has(topic)) { psTopicsFollowing.delete(topic); btn.classList.remove('selected'); }
  else { psTopicsFollowing.add(topic); btn.classList.add('selected'); }
}

function psFilterTopics() {
  const query = document.getElementById('psSearchTopics').value.toLowerCase();
  const filtered = query ? TOPICS_DATA.filter(t => t.toLowerCase().includes(query)) : TOPICS_DATA;
  const grid = document.getElementById('psTopicGrid');
  grid.innerHTML = filtered.map(t => `
    <button class="ps-topic-tag ${psTopicsFollowing.has(t)?'selected':''}"
      onclick="psToggleTopic('${t}',this)">
      ${t}
    </button>
  `).join('');
}

function finishProfileSetup() {
  const username = document.getElementById('psUsernameInput').value.trim() || 'Guest';
  window.PRISM_USER = {
    name: username,
    avatarId: psSelectedAvatarId,
    following: {
      politicians: [...psFollowing.politicians],
      legislation: [...psFollowing.legislation],
      topics: [...psTopicsFollowing],
    }
  };
  // Apply username to profile panel
  const pname = document.getElementById('profileName');
  if (pname) pname.textContent = username;

  // Populate the Refraction panel with subscription data
  renderRefractionSubs();

  // Fade out profile setup, then play spectral portal video, then reveal app
  const ps = document.getElementById('profileSetup');
  ps.style.transition = 'opacity 0.45s ease';
  ps.style.opacity = '0';

  setTimeout(() => {
    ps.style.display = 'none';
    playPortalThenApp();
  }, 480);
}

// ============================================================
// REFRACTION SUBSCRIPTIONS — render onboarding follows
// ============================================================
function renderRefractionSubs() {
  const user = window.PRISM_USER;
  if (!user) return;
  const { politicians, legislation, topics } = user.following;
  const hasAnything = politicians.length || legislation.length || topics.length;

  const wrap = document.getElementById('refractionSubs');
  wrap.style.display = 'block';

  // Empty state
  const empty = document.getElementById('refEmptyState');
  empty.style.display = hasAnything ? 'none' : 'block';
  if (!hasAnything) return;

  // Politicians
  if (politicians.length) {
    const section = document.getElementById('refPolSection');
    section.style.display = 'block';
    const list = document.getElementById('refPolList');
    list.innerHTML = politicians.map(id => {
      const pol = POLITICIANS_DATA.find(p => p.id === id);
      if (!pol) return '';
      const party = pol.meta.startsWith('D') ? 'd' : pol.meta.startsWith('R') ? 'r' : 'i';
      const partyColor = party === 'd' ? 'var(--blue)' : party === 'r' ? 'var(--red)' : 'var(--green)';
      const initials = pol.name.split(' ').map(w => w[0]).join('').slice(0,2);
      return `
        <div class="ref-sub-card party-${party}">
          <div class="ref-card-initial" style="background:${partyColor};">${initials}</div>
          <div class="ref-card-info">
            <div class="ref-card-name">${pol.name}</div>
            <div class="ref-card-meta">${pol.meta}</div>
          </div>
          <div class="ref-card-status">tracking</div>
        </div>`;
    }).join('');
  }

  // Legislation
  if (legislation.length) {
    const section = document.getElementById('refLegSection');
    section.style.display = 'block';
    const list = document.getElementById('refLegList');
    list.innerHTML = legislation.map(id => {
      const leg = LEGISLATION_DATA.find(l => l.id === id);
      if (!leg) return '';
      const isActive = leg.meta.includes('Active') || leg.meta.includes('Pending');
      return `
        <div class="ref-sub-card type-leg">
          <div class="ref-card-initial" style="background:var(--gold);">§</div>
          <div class="ref-card-info">
            <div class="ref-card-name">${leg.name}</div>
            <div class="ref-card-meta">${leg.meta}</div>
          </div>
          <div class="ref-card-status">${isActive ? 'active' : 'enacted'}</div>
        </div>`;
    }).join('');
  }

  // Topics
  if (topics.length) {
    const section = document.getElementById('refTopSection');
    section.style.display = 'block';
    const list = document.getElementById('refTopList');
    list.innerHTML = topics.map(t =>
      `<div class="ref-topic-tag">${t}</div>`
    ).join('');
  }
}

function playPortalThenApp() {
  const overlay = document.getElementById('spectralVideo');
  const vid = document.getElementById('portalVid');

  overlay.classList.add('visible');
  vid.play().catch(() => {});
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('playing')));

  let done = false;
  function finishEntry() {
    if (done) return; done = true;
    vid.removeEventListener('ended', finishEntry);
    overlay.classList.remove('playing');
    overlay.classList.add('out');
    setTimeout(() => { overlay.style.display = 'none'; }, 700);
    // Diatribe-first: open aperture overlay after portal clears
    setTimeout(() => openDiatribeForEvent(), 900);
  }
  vid.addEventListener('ended', finishEntry);
  setTimeout(finishEntry, 6000); // safety fallback
}

function skipToApp() {
  const ps = document.getElementById('profileSetup');
  ps.style.transition = 'opacity 0.4s ease';
  ps.style.opacity = '0';
  setTimeout(() => {
    ps.style.display = 'none';
    playPortalThenApp();
  }, 420);
}

// ── wire up splash BEAM button to showOnboarding ──
function enterApp() { showOnboarding(); }
