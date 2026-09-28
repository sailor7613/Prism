// ═══════════════════════════════════════════════════════════════════════
// TED'S TOUR — the tutorial as isolation + a peeking presenter (2026-09-22)
//
// Each phase of the portal has a short tour: one element at a time is cut
// out of a dim over the whole screen (it stays exactly where it lives — you
// learn the control in its place), and Ted peeks into the frame beside it,
// looking at it, with his line in a bubble. Passive elements advance on a
// tap; controls advance when you actually USE them (drag the rail, place
// the pin, pull the z), and his next line reacts to what you did.
//
// Lines come from the elements themselves: data-ted-hint is the script.
// A step may override with its own text, or a function of the live state.
//
// Runs once per phase per device (prism.tour.<phase>); tap Ted's face to
// replay the current phase; tap the dim to skip. While a tour runs, the
// old pre-emptive beats are held (Ted.say checks Ted.touring) and the
// full-body stage steps back so nothing else is talking.
//
// Public: Ted.tour(phase?)  ·  Ted.tourStop()  ·  Ted.touring (bool)
// ═══════════════════════════════════════════════════════════════════════
(function TedTour() {
  'use strict';
  const body = document.body;
  const q = (s) => document.querySelector(s);
  // ?intro (the intro test) keeps the tour's memory in this tab only, so a
  // test run never changes what the working index does on this device
  const box = () => (window.PRISM_INTRO_TEST ? sessionStorage : localStorage);
  const store = {
    get: (k) => { try { return box().getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { box().setItem(k, v); } catch (e) {} },
  };

  // ── Phases and their steps ─────────────────────────────────────────
  // wait: 'tap' (bubble/Ted advances) · 'click' (the element itself) ·
  //       'drag' (the rail moved past a third) · 'select' (a card chosen) ·
  //       'pin' (pad pointerup) · 'z' (the z thumb moved) · 'auto' (timer)
  // text: string | function() → string  (default: the element's data-ted-hint)
  // The three thirds as an argument (Sailor, 2026-09-27): how far you'd take
  // it with someone across the table. Fluid states a belief; coalition tries
  // to win people over; denominated stops gathering support and spends
  // political capital. Fluid sits nearest the center of the rail, denominated
  // at the edges.
  const bandLine = (band) => ({
    fluid:       "First third: fluid. You'd say what you think and leave it there. No urge to explain it or qualify it.",
    coalition:   "Middle third: coalition. You'd go two or three rounds with somebody to bring them around. You're gathering support.",
    denominated: "Last third: denominated. You're done gathering support. You'd burn a bridge to make the point, and spend political capital doing it.",
  }[band] || '');
  const currentBand = () => {
    const el = q('#readoutReal') || q('#captionReal .band');   // readout is live; the caption label develops late
    const t = (el && el.textContent || '').toLowerCase();
    return /denominated/.test(t) ? 'denominated' : /coalition/.test(t) ? 'coalition' : 'fluid';
  };

  const wide = () => window.innerWidth >= 900;
  const selOf = (v) => (typeof v === 'function' ? v() : v);
  const PHASES = {
    firstReal: {
      when: () => !window.PRISM_ON_EXAMPLE && store.get('prism.example.done') === '1' &&
                  body.classList.contains('phase-event') && body.classList.contains('ev-step-card'),
      steps: [
        { sel: '#evCard', wait: 'tap', move: 'read',
          text: "That was practice. This one's live: your pin goes on the record next to everyone else's. Same three moves. I'll be in the corner if you want me." },
      ],
    },
    event: {
      when: () => body.classList.contains('phase-event') && body.classList.contains('ev-step-card'),
      steps: [
        { sel: '#evLogo', also: () => (wide() ? null : '#evCard'), wait: 'tap', move: 'read', skipUnless: () => !!window.PRISM_ON_EXAMPLE,
          text: "Welcome to Prism, a political econometric system meant to cancel out the noise of pop political discourse and instantiate object permanence. Think of it as a fun interactive Bloomberg Terminal for legislation." },
        { sel: () => (wide() ? '.ev-example-tag' : '#evCard'), also: () => (wide() ? '#evTitle' : null), wait: 'tap', move: 'read', skipUnless: () => !!window.PRISM_ON_EXAMPLE,
          text: "I'm Ted. I'll walk you through this once. This first one's a practice round: a small, real law about leaf blowers. Nothing rides on it, so the only new thing is how Prism works." },
        { sel: '#eventPicker, .event-picker select, header select', wait: 'tap', move: 'read', skipUnless: () => !window.PRISM_ON_EXAMPLE,
          text: "This picks the Reading — the moment we're looking at. There are a few in here; start with this one." },
        { sel: '#evBegin', wait: 'click', move: 'read',
          text: () => window.PRISM_ON_EXAMPLE ? "Start by reading what actually happened." : null },
      ],
    },
    framing: {
      when: () => body.classList.contains('phase-event') && body.classList.contains('ev-step-framing'),
      steps: [
        { sel: '#evFraming', wait: 'tap', move: 'read',
          text: "The wall text. What actually happened, dated, no spin — read it once and get the weather of it." },
        { sel: '#evKeywords', wait: 'tap', move: 'read' },
        { sel: '#evEnter', wait: 'click', move: 'read' },
      ],
    },
    diatribe: {
      when: () => body.classList.contains('phase-diatribe'),
      steps: [
        { sel: '#track', wait: 'tap', move: 'heat', skipUnless: () => !!window.PRISM_ON_EXAMPLE, 
          text: "Here's the whole logic, three moves. One: how hard would you push this? Two: which corner of the plane are you standing in? Three: does the law actually deliver? This rail is move one." },
        { sel: '#track', wait: 'tap', move: 'heat', skipUnless: () => !!window.PRISM_ON_EXAMPLE,
          text: "Picture arguing this with somebody. First third: you say what you think and leave it. Middle third: you'd go two or three rounds to win them over. Last third: you'd burn a bridge to make the point." },
        { sel: '#track', wait: 'drag', move: 'heat',
          text: () => window.PRISM_ON_EXAMPLE
            ? "Now drag it out to where you'd actually be on leaf blowers. Either side. Go on."
            : "This rail is your aperture. Center, you'd barely argue it; the farther out you drag, the harder you'd push. Drag it — go on." },
        { sel: '#track', wait: 'tap', move: 'heat', live: true, text: () => bandLine(currentBand()) },
        { sel: '#captionReal', wait: 'tap', move: 'heat',
          text: () => window.PRISM_ON_EXAMPLE
            ? "That's your position, spelled out. It rewrites itself every time you move the rail. The faint one across from it is the other chair: the same heat, mirrored."
            : null },
        { sel: '#captionGhost', wait: 'tap', move: 'heat', skipUnless: () => !window.PRISM_ON_EXAMPLE },
        { sel: '#toAnswers', wait: 'click', move: 'heat', text: "When you've found your band, hit this — the four responses, at that aperture." },
      ],
    },
    answers: {
      when: () => body.classList.contains('phase-answers'),
      steps: [
        { sel: '.answer-card', wait: 'tap', move: 'corner',
          text: "Four responses, one per corner of the plane, all at the aperture you just set. Read them like four people at a table." },
        { sel: '#answersGrid', wait: 'tap', move: 'corner', skipUnless: () => !!window.PRISM_ON_EXAMPLE, 
          text: "Move two: the corners are two axes. Across is left ↔ right. Up and down is institutional ↔ populist: the top row trusts the state to run this, the bottom row is talking from the driveway. Top-left calls it a rule with a runway. Bottom-right says my blower works fine." },
        { sel: '.answer-card .ac-z', wait: 'tap', move: 'corner',
          text: "That little rail under each one is the author's call on delivery — does this station think the thing actually lands? Left is frustrated, right is realized." },
        { sel: '#answersGrid', wait: 'select', move: 'corner', text: "Pick the one that's closest to you. Not the one you admire — the one you'd actually say." },
        { sel: '#aCommit', wait: 'click', move: 'corner' },
      ],
    },
    graph: {
      when: () => body.classList.contains('phase-graph') && !body.classList.contains('ticker-live'),
      steps: [
        { sel: '#padAxisX', wait: 'tap', move: 'corner', skipUnless: () => !!window.PRISM_ON_EXAMPLE, 
          text: "Axis one runs across: left ↔ right. On leaf blowers that's clean air first versus the cost landing on small crews." },
        { sel: '#padAxisY', wait: 'tap', move: 'corner', skipUnless: () => !!window.PRISM_ON_EXAMPLE, 
          text: "Axis two runs up and down: institutional ↔ populist. Up top you trust the Air Board to write the rule and pay the rebates. Down low you trust your own garage." },
        { sel: '#graphPad', wait: 'pin', move: 'corner',
          text: "The plane. Your corner is lit; put your pin down where you sit in it — distance from center is how hard you hold it." },
        { sel: '#zTrack', wait: 'z', move: 'delivery',
          text: () => window.PRISM_ON_EXAMPLE
            ? "Move three, the third axis: delivery. Here it's the question the law is really asking. Does it actually clear the air, or does nothing change on your street? Pull toward the one you believe."
            : "And the third axis: does it deliver? Pull toward realized if you think this thing lands, frustrated if you think it won't." },
        { sel: '#graphDialect', wait: 'tap', move: 'delivery', text: "Words if you want them. Optional. Most people don't, the ones who do are worth reading." },
        { sel: '#graphCommit', wait: 'click', move: 'delivery' },
      ],
    },
    committed: {
      when: () => body.classList.contains('ticker-live'),
      steps: [
        { sel: '#gm3d', wait: 'tap', move: 'space',
          text: () => (window.PRISM_ON_EXAMPLE ? "All three axes, one space: across is left ↔ right, up is institutional, depth is delivery. " : "") + "You're on the plane now. Those twelve orbs are the Reading's own stations, floating at the depth their author gave them. Hold one to read it against your pin." },
        { sel: '#zSlider', wait: 'tap', move: 'space', skipUnless: () => !window.PRISM_ON_EXAMPLE, text: "Your delivery call stays live — slide it and watch the distance to each station change." },
        { sel: '#deltaTicker', wait: 'tap', move: 'space', text: "The strip is Burns. Top row: your burns — where your pin and this Reading's stations disagree. Bottom row: every object the newsroom is watching; a frame burns when someone holds it to the light." },
        { sel: '#exampleNext', wait: 'click', move: 'space', skipUnless: () => !!window.PRISM_ON_EXAMPLE,
          text: "That's the whole loop: read it, find your band, pick a voice, pin it, call the delivery. Now do it for real." },
      ],
    },
  };

  // ── DOM ────────────────────────────────────────────────────────────
  const root = document.createElement('div');
  root.id = 'tedTour';
  root.innerHTML =
    '<div class="tt-dim tt-top"></div><div class="tt-dim tt-bottom"></div>' +
    '<div class="tt-dim tt-left"></div><div class="tt-dim tt-right"></div>' +
    '<div class="tt-ring"></div>' +
    '<div class="tt-presenter">' +
      '<canvas class="tt-ted" id="tedPeek" width="220" height="220"></canvas>' +
      '<div class="tt-bubble"><div class="tt-moves"></div><div class="tt-text"></div><div class="tt-foot"><span class="tt-step"></span><span class="tt-hint">tap to continue</span><button type="button" class="tt-skip">skip the tour</button></div></div>' +
    '</div>';
  document.body.appendChild(root);
  const dims = Array.from(root.querySelectorAll('.tt-dim'));
  const ring = root.querySelector('.tt-ring');
  const presenter = root.querySelector('.tt-presenter');
  const bubble = root.querySelector('.tt-bubble');
  const textEl = root.querySelector('.tt-text');
  const stepEl = root.querySelector('.tt-step');
  const hintEl = root.querySelector('.tt-hint');
  const movesEl = root.querySelector('.tt-moves');
  // One arc across the whole first run (2026-09-26): read it → the three
  // moves → the space. Replaces a per-phase "1 / 6" that restarted each screen.
  const MOVES = [['read', 'read it'], ['heat', 'heat'], ['corner', 'corner'], ['delivery', 'delivery'], ['space', 'the space']];
  movesEl.innerHTML = MOVES.map(([k, l]) => '<i data-m="' + k + '" title="' + l + '"></i>').join('') + '<b></b>';
  function paintMoves(m) {
    const at = MOVES.findIndex(([k]) => k === m);
    movesEl.style.display = at < 0 ? 'none' : '';
    movesEl.querySelectorAll('i').forEach((d, i) => { d.classList.toggle('now', i === at); d.classList.toggle('past', i < at); });
    const lbl = at < 0 ? '' : (at >= 1 && at <= 3 ? 'move ' + at + ' · ' : '') + MOVES[at][1];
    movesEl.querySelector('b').textContent = lbl;
  }
  const peekCanvas = root.querySelector('#tedPeek');
  const skipBtn = root.querySelector('.tt-skip');

  // ── The peeking head (a third little coyote renderer, only live in a tour) ──
  const Peek = (function () {
    if (typeof THREE === 'undefined' || typeof PrismGraphmap === 'undefined' || !PrismGraphmap.buildCoyote) return null;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: peekCanvas, alpha: true, antialias: true }); }
    catch (e) { return null; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(220, 220, false);

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const ted = PrismGraphmap.buildCoyote(); scene.add(ted);
    const head = ted.userData.head;
    // head only (2026-09-27): the coyote is built flat — every part is a direct
    // child, positioned in body space — so the body, neck, legs and tail are
    // the children sitting below the head (y < 1.05, or at the origin for the
    // tube geometries). Hide those; what's left is the head, brows to snout.
    ted.children.forEach(c => { if (c.position.y < 1.05) c.visible = false; });
    const key = new THREE.DirectionalLight(0xfff2e0, 1.25); key.position.set(1.6, 2.4, 2.6); scene.add(key);
    const rim = new THREE.DirectionalLight(0x90a8d0, 0.6); rim.position.set(-1.8, 1, -1.2); scene.add(rim);
    scene.add(new THREE.AmbientLight(0x6072a0, 0.6));
    // head-and-shoulders, three-quarter, like he's leaning over the edge of the
    // frame (head is at y≈1.20, z≈0.46 in the model; ears to 1.57, snout to z 0.87)
    // FACE ONLY (Sailor, 2026-09-23: "his body with the cut frame is weird") —
    // a round portrait medallion: the camera sits on the muzzle, the canvas is
    // clipped to a circle in CSS, so nothing is ever cut mid-body.
    // 2026-09-27 (Sailor: no frame): the canvas is transparent and unclipped, so
    // the camera frames the WHOLE head — ears to chin — three-quarter, with air
    // around it. Nothing below the neck is in shot (the body is out of frame
    // below the canvas), so he reads as a head looking in, not a bust in a hole.
    const aim = new THREE.Vector3(0.0, 1.26, 0.52);
    function frame(px, py, pz, fov) { cam.position.set(px, py, pz); cam.fov = fov; cam.updateProjectionMatrix(); cam.lookAt(aim); }
    frame(0.60, 1.36, 1.60, 28);
    let yawT = 0, pitchT = 0, yaw = 0, pitch = 0, t = 0, live = false;
    (function loop() {
      requestAnimationFrame(loop);
      if (!live) return;
      t += 0.016;
      yaw += (yawT - yaw) * 0.08; pitch += (pitchT - pitch) * 0.08;
      // the medallion is face-only: turning the whole body swung his face out of
      // the circle (2026-09-26) — the head does the looking, the body a little
      ted.rotation.y = yaw * 0.18 + Math.sin(t * 0.6) * 0.04;
      if (head) { head.rotation.y = yaw * 0.55; head.rotation.x = pitch + Math.sin(t * 0.9) * 0.03; }
      ted.position.y = Math.sin(t * 1.1) * 0.01;
      renderer.render(scene, cam);
    })();
    return {
      look: function (nx, ny) {      // where the target is, relative to Ted, in normalized screen units (−1..1)
        yawT = Math.max(-0.7, Math.min(0.7, nx * 0.9));
        pitchT = Math.max(-0.35, Math.min(0.4, ny * 0.6));
      },
      setLive: function (v) { live = v; },
      frame: frame,   // tuning hook: Ted.peekFrame(px, py, pz, fov)
    };
  })();
  if (!Peek) peekCanvas.style.display = 'none';

  // ── Layout: cutout around the target; presenter row beside it ──────
  let waitIdx = -1, waitTries = 0, waitTm = 0;
  let target = null, targetAlso = null, raf = 0, active = null, stepIdx = -1, cleanupWait = null, phaseKey = null;
  const PAD = 10;
  function rectOf(el) { const r = el.getBoundingClientRect(); return { x: r.left - PAD, y: r.top - PAD, w: r.width + 2 * PAD, h: r.height + 2 * PAD }; }
  function layout() {
    if (!target) return;
    const W = window.innerWidth, H = window.innerHeight;
    let r = rectOf(target);
    if (targetAlso) { const b = rectOf(targetAlso); const x = Math.min(r.x, b.x), y = Math.min(r.y, b.y);
      r = { x, y, w: Math.max(r.x + r.w, b.x + b.w) - x, h: Math.max(r.y + r.h, b.y + b.h) - y }; }
    // four panels around the hole
    const px = (el, x, y, w, h) => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = Math.max(0, w) + 'px'; el.style.height = Math.max(0, h) + 'px'; };
    px(dims[0], 0, 0, W, r.y);
    px(dims[1], 0, r.y + r.h, W, H - (r.y + r.h));
    px(dims[2], 0, r.y, r.x, r.h);
    px(dims[3], r.x + r.w, r.y, W - (r.x + r.w), r.h);
    px(ring, r.x, r.y, r.w, r.h);
    // presenter: a row (Ted peeking in from the left edge + bubble), placed
    // below the target when there's room, else above; never over it.
    const ph = presenter.offsetHeight || 150;
    let top, left, pw;
    // Wide screens (2026-09-23, Sailor: "his speech boxes totally cover the
    // text"): sit BESIDE the element — right if there's room, else left — so
    // the bubble never lands on the text around it. Phones: below, else above.
    // Wide screens: beside the element when the margin is roomy; otherwise
    // below/above like a phone; a narrow side margin only as a last resort
    // before landing on the element (2026-09-26, the welcome's wide hero).
    const roomR = W - (r.x + r.w) - 24, roomL = r.x - 24, room = Math.max(roomR, roomL);
    const below = r.y + r.h + 8, above = r.y - ph - 8;
    const side = (w) => { pw = w; left = roomR >= roomL ? r.x + r.w + 16 : r.x - w - 16;
      top = Math.max(8, Math.min(H - ph - 8, r.y + Math.min(r.h, 160) / 2 - ph / 2)); };
    if (W >= 900 && room >= 320) side(Math.min(440, W * 0.34, room));
    else if (below + ph <= H - 8 || above >= 8 || !(W >= 900 && room >= 240)) {
      if (below + ph <= H - 8) top = below;
      else if (above >= 8) top = above;
      else top = Math.max(8, Math.min(H - ph - 8, r.y + r.h - ph));
      pw = Math.min(W, 560);
      left = Math.max(0, Math.min(W - pw, W >= 900 ? r.x + r.w / 2 - pw / 2 : r.x - 36));
    } else side(room);
    presenter.style.top = top + 'px';
    presenter.style.left = left + 'px';
    presenter.style.width = pw + 'px';
    // Ted looks from his spot toward the target's center
    if (Peek) {
      const tx = left + 70, ty = top + ph / 2;      // his head, roughly
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      Peek.look((cx - tx) / (W * 0.6), (cy - ty) / (H * 0.5));
    }
  }
  function track() {
    layout();
    // a 'live' step's line follows the state (the band line tracks the rail)
    const st = active && active.steps[stepIdx];
    if (st && st.live && typeof st.text === 'function') { const t = st.text(); if (t && textEl.textContent !== t) textEl.textContent = t; }
    raf = requestAnimationFrame(track);
  }
  // is a finger / button down right now? (a drag step settles only after release)
  let pointerDown = false;
  window.addEventListener('pointerdown', () => { pointerDown = true; }, true);
  window.addEventListener('pointerup', () => { pointerDown = false; }, true);
  window.addEventListener('pointercancel', () => { pointerDown = false; }, true);

  // ── Waits ──────────────────────────────────────────────────────────
  function armWait(step, el, done) {
    const kind = step.wait || 'tap';
    let off = () => {};
    if (kind === 'tap') {
      hintEl.textContent = 'tap to continue';
      off = () => {};
    } else if (kind === 'click') {
      hintEl.textContent = 'go ahead — press it';
      const h = () => { setTimeout(done, 80); };
      el.addEventListener('click', h, { once: true });
      off = () => el.removeEventListener('click', h);
    } else if (kind === 'drag') {
      hintEl.textContent = 'drag the rail';
      const thumb = q('#thumbReal');
      let last = thumb ? thumb.style.left : '';
      let settled = null;
      // the thumb's glow is restyled every frame — only a change of POSITION
      // counts, and the step settles 700ms after the last one
      const mo = new MutationObserver(() => {
        if (!thumb || thumb.style.left === last) return;
        last = thumb.style.left;
        const pct = parseFloat(last);
        if (Math.abs(pct - 50) < 14) return;               // past the first third mark
        clearTimeout(settled);
        const settle = () => { if (pointerDown) { settled = setTimeout(settle, 250); return; } done(); };
        settled = setTimeout(settle, 700);
      });
      if (thumb) mo.observe(thumb, { attributes: true, attributeFilter: ['style'] });
      off = () => { mo.disconnect(); clearTimeout(settled); };
    } else if (kind === 'select') {
      hintEl.textContent = 'tap the one that fits';
      const mo = new MutationObserver(() => { if (el.classList.contains('has-selection')) { setTimeout(done, 500); } });
      mo.observe(el, { attributes: true, attributeFilter: ['class'] });
      off = () => mo.disconnect();
    } else if (kind === 'pin') {
      hintEl.textContent = 'tap or drag on the plane';
      const h = () => { setTimeout(done, 500); };
      el.addEventListener('pointerup', h, { once: true }); el.addEventListener('touchend', h, { once: true });
      off = () => { el.removeEventListener('pointerup', h); el.removeEventListener('touchend', h); };
    } else if (kind === 'z') {
      hintEl.textContent = 'slide it either way';
      const thumb = q('#zThumb') || el.querySelector('.z-thumb');
      let last = thumb ? thumb.style.left : '';
      let settled = null;
      const mo = new MutationObserver(() => { if (thumb && thumb.style.left !== last) { last = thumb.style.left; clearTimeout(settled); settled = setTimeout(done, 700); } });
      if (thumb) mo.observe(thumb, { attributes: true, attributeFilter: ['style'] });
      off = () => { mo.disconnect(); clearTimeout(settled); };
    } else if (kind === 'auto') {
      const tm = setTimeout(done, step.ms || 3500);
      off = () => clearTimeout(tm);
    }
    return off;
  }

  // ── Run ────────────────────────────────────────────────────────────
  function resolve(sel) {
    if (!sel) return null;
    for (const s of sel.split(',')) {
      const el = q(s.trim()); if (!el) continue;
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();   // fixed elements have no offsetParent — go by the box
      if (cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05 && r.width > 0 && r.height > 0) return el;
    }
    return null;
  }
  function showStep(i) {
    if (!active) return;
    if (cleanupWait) { cleanupWait(); cleanupWait = null; }
    const steps = active.steps;
    // skip steps whose element isn't on screen right now
    const applies = (st) => !st.skipUnless || st.skipUnless();
    while (i < steps.length && !applies(steps[i])) i++;
    // the element may still be fading in (the 3D space after commit) — give it
    // up to ~2s before skipping past it (2026-09-27)
    if (i < steps.length && !resolve(selOf(steps[i].sel))) {
      waitTries = (waitIdx === i) ? waitTries + 1 : 1; waitIdx = i;
      if (waitTries <= 8) { clearTimeout(waitTm); waitTm = setTimeout(() => showStep(i), 250); return; }
    }
    waitIdx = -1; waitTries = 0;
    while (i < steps.length && (!applies(steps[i]) || !resolve(selOf(steps[i].sel)))) i++;
    if (i >= steps.length) return stop(true);
    stepIdx = i;
    const step = steps[i];
    const el = resolve(selOf(step.sel));
    const alsoSel = selOf(step.also);
    target = el; targetAlso = alsoSel ? resolve(alsoSel) : null;
    try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
    const text = (typeof step.text === 'function' ? step.text() : step.text) || el.getAttribute('data-ted-hint') || '';
    textEl.textContent = text;
    const live = steps.filter(applies);
    if (step.move) { stepEl.textContent = ''; paintMoves(step.move); }
    else { paintMoves(null); stepEl.textContent = (live.indexOf(step) + 1) + ' / ' + live.length; }
    root.classList.add('tt-swap'); setTimeout(() => root.classList.remove('tt-swap'), 60);
    layout();
    cleanupWait = armWait(step, el, () => showStep(stepIdx + 1));
    // the old bubble's voice, if it's on
    try { if (window.Ted && window.Ted.speak) window.Ted.speak(text); } catch (e) {}
  }
  function start(key) {
    const phase = PHASES[key]; if (!phase) return false;
    if (active) stop(false);
    active = phase; phaseKey = key; stepIdx = -1;
    window.Ted.touring = true;
    body.classList.add('ted-touring');
    root.classList.add('on');
    if (Peek) Peek.setLive(true);
    try { if (window.Ted && window.Ted.hide) window.Ted.hide(); } catch (e) {}
    cancelAnimationFrame(raf); track();
    showStep(0);
    return true;
  }
  function stop(completed) {
    if (!active) return;
    if (cleanupWait) { cleanupWait(); cleanupWait = null; }
    if (phaseKey) store.set('prism.tour.' + phaseKey, completed ? 'done' : 'skipped');
    active = null; target = null; targetAlso = null; phaseKey = null; clearTimeout(waitTm); waitIdx = -1; waitTries = 0;
    cancelAnimationFrame(raf);
    root.classList.remove('on');
    body.classList.remove('ted-touring');
    window.Ted.touring = false;
    if (Peek) Peek.setLive(false);
  }

  // taps: on Ted or the bubble → next (only for 'tap' steps); on the dim → skip
  // "skip the tour" means the WHOLE tour (Sailor, 2026-09-27: it used to close
  // this screen's leg and the next screen started its own). Every phase is
  // marked skipped; a tap on Ted's face still replays the current one.
  skipBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    Object.keys(PHASES).forEach(k => store.set('prism.tour.' + k, 'skipped'));
    stop(false);
  });
  presenter.addEventListener('click', (e) => {
    e.stopPropagation();
    if (e.target === skipBtn) return;
    if (!active) return;
    const step = active.steps[stepIdx];
    if (!step || (step.wait || 'tap') === 'tap') showStep(stepIdx + 1);
  });
  // A tap on the dim (2026-09-26): a stray tap used to end the whole tour on a
  // phone. Now it advances a 'tap' step and, on an action step, nudges the ring
  // toward the thing to do. Leaving is only ever the skip button.
  dims.forEach(d => d.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!active) return;
    const step = active.steps[stepIdx];
    if (!step || (step.wait || 'tap') === 'tap') return showStep(stepIdx + 1);
    root.classList.remove('tt-nudge'); void root.offsetWidth; root.classList.add('tt-nudge');
  }));
  window.addEventListener('resize', layout);

  // ── Triggers: first time a phase appears on this device ────────────
  function phaseNow() {
    for (const k of ['committed', 'graph', 'answers', 'diatribe', 'framing', 'firstReal', 'event']) { if (PHASES[k].when()) return k; }
    return null;
  }
  let lastPhase = null, pending = null;
  function onPhaseMaybe() {
    const k = phaseNow();
    if (k === lastPhase) return;
    lastPhase = k;
    if (active && phaseKey !== k) stop(true);          // the flow moved on — the tour did its job
    clearTimeout(pending);
    if (!k) return;
    if (store.get('prism.tour.' + k)) return;
    if (store.get('prism.ted.away') === '1') return;   // he's been sent away — no tours
    pending = setTimeout(() => { if (phaseNow() === k && !active) start(k); }, k === 'committed' ? 4200 : 1400);
  }
  try { new MutationObserver(onPhaseMaybe).observe(body, { attributes: true, attributeFilter: ['class'] }); } catch (e) {}
  setTimeout(onPhaseMaybe, 1600);

  // ── Ted in the corner (phones, 2026-09-23) ──────────────────────────
  // The full-body stage is gone from the phone flow; he's a face in the
  // corner instead. Rendered ONCE (a still portrait, no loop — one more GL
  // context that costs nothing after the first frame). Tap → this phase's tour.
  (function corner() {
    const btn = document.createElement('button');
    btn.id = 'tedCorner'; btn.type = 'button'; btn.setAttribute('aria-label', 'Ted — replay the tour');
    const cv = document.createElement('canvas'); cv.width = 96; cv.height = 96; btn.appendChild(cv);
    document.body.appendChild(btn);
    btn.addEventListener('click', (e) => { e.stopPropagation(); if (window.Ted && window.Ted.tour) window.Ted.tour(); });
    if (typeof THREE === 'undefined' || typeof PrismGraphmap === 'undefined' || !PrismGraphmap.buildCoyote) return;
    try {
      const r = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true });
      r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.setSize(96, 96, false);
      const sc = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(22, 1, 0.1, 100);
      const t = PrismGraphmap.buildCoyote(); sc.add(t);
      const k = new THREE.DirectionalLight(0xfff2e0, 1.25); k.position.set(1.6, 2.4, 2.6); sc.add(k);
      const rim = new THREE.DirectionalLight(0x90a8d0, 0.6); rim.position.set(-1.8, 1, -1.2); sc.add(rim);
      sc.add(new THREE.AmbientLight(0x6072a0, 0.6));
      cam.position.set(0.50, 1.38, 1.62); cam.lookAt(new THREE.Vector3(0.0, 1.27, 0.55));
      const draw = () => { try { r.render(sc, cam); } catch (e) {} };
      draw(); setTimeout(draw, 400);   // once more after fonts/layout settle
      window.addEventListener('resize', draw);
      // drawn while hidden (a tour running) the buffer can come back blank —
      // redraw each time he's shown again (2026-09-26)
      let shown = false;
      new MutationObserver(() => { const v = btn.offsetParent !== null || getComputedStyle(btn).display !== 'none';
        if (v && !shown) requestAnimationFrame(draw); shown = v; }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } catch (e) {}
  })();

  // ── Send Ted away / call him back (2026-09-23) ───────────────────────
  (function awayControl() {
    const b = document.createElement('button'); b.id = 'tedAway'; b.type = 'button';
    document.body.appendChild(b);
    const narrow = () => window.innerWidth <= 700;
    function paint() {
      const gone = document.body.classList.contains('ted-away');
      b.classList.toggle('gone', gone); b.classList.toggle('present', !gone);
      if (gone) { b.innerHTML = '<span aria-hidden="true">◐</span> Ted'; b.setAttribute('aria-label', 'Call Ted back'); b.title = 'Call Ted back'; }
      else if (narrow()) { b.textContent = '✕'; b.setAttribute('aria-label', 'Send Ted away'); b.title = 'Send Ted away'; }
      else { b.innerHTML = '<span aria-hidden="true">✕</span> send Ted away'; b.setAttribute('aria-label', 'Send Ted away'); b.title = 'Send Ted away'; }
    }
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const gone = document.body.classList.contains('ted-away');
      if (!gone && active) stop(false);
      if (window.Ted && window.Ted.setAway) window.Ted.setAway(!gone);
    });
    try { new MutationObserver(paint).observe(document.body, { attributes: true, attributeFilter: ['class'] }); } catch (e) {}
    window.addEventListener('resize', paint);
    paint();
  })();

  // the practice run handed off → the first live Reading gets one line
  { const nx = document.getElementById('exampleNext');
    if (nx) nx.addEventListener('click', () => store.set('prism.example.done', '1')); }

  // ── Public ─────────────────────────────────────────────────────────
  window.Ted = window.Ted || {};
  window.Ted.tour = function (key) { return start(key || phaseNow()); };
  window.Ted.tourStop = function () { stop(false); };
  window.Ted.touring = false;
  window.Ted.peekFrame = function (px, py, pz, fov) { if (Peek) Peek.frame(px, py, pz, fov); };
  window.Ted.tourReset = function () { Object.keys(PHASES).forEach(k => { try { box().removeItem('prism.tour.' + k); } catch (e) {} }); try { box().removeItem('prism.example.done'); } catch (e) {} };

  // the intro-test badge: you're in the sandbox; tap to run it again from zero
  if (window.PRISM_INTRO_TEST) {
    const t = document.createElement('button'); t.id = 'introTest'; t.type = 'button';
    t.textContent = 'intro test ↺'; t.title = 'Restart the intro from zero';
    t.addEventListener('click', (e) => { e.stopPropagation(); const u = new URL(location.href);
      ['event', 'reading', 'example'].forEach(k => u.searchParams.delete(k)); u.searchParams.set('intro', ''); location.href = u.toString(); });
    document.body.appendChild(t);
  }
})();
