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
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
  };

  // ── Phases and their steps ─────────────────────────────────────────
  // wait: 'tap' (bubble/Ted advances) · 'click' (the element itself) ·
  //       'drag' (the rail moved past a third) · 'select' (a card chosen) ·
  //       'pin' (pad pointerup) · 'z' (the z thumb moved) · 'auto' (timer)
  // text: string | function() → string  (default: the element's data-ted-hint)
  const bandLine = (band) => ({
    fluid:       "Outer third — the easy stuff. You two disagree, sure, but you're still arguing about the same thing.",
    coalition:   "Middle third — now it's teams. Pick this and you're picking a whole side, package deal.",
    denominated: "Inner third — the deep end. You're not arguing about the thing now, you're arguing about what it even is.",
  }[band] || '');
  const currentBand = () => {
    const el = q('#captionReal .band') || q('#readoutReal');
    const t = (el && el.textContent || '').toLowerCase();
    return /denominated/.test(t) ? 'denominated' : /coalition/.test(t) ? 'coalition' : 'fluid';
  };

  const PHASES = {
    event: {
      when: () => body.classList.contains('phase-event') && body.classList.contains('ev-step-card'),
      steps: [
        { sel: '#eventPicker, .event-picker select, header select', wait: 'tap',
          text: "This picks the Reading — the moment we're looking at. There are a few in here; start with this one." },
        { sel: '#evBegin', wait: 'click' },
      ],
    },
    framing: {
      when: () => body.classList.contains('phase-event') && body.classList.contains('ev-step-framing'),
      steps: [
        { sel: '#evFraming', wait: 'tap',
          text: "The wall text. What actually happened, dated, no spin — read it once and get the weather of it." },
        { sel: '#evKeywords', wait: 'tap' },
        { sel: '#evEnter', wait: 'click' },
      ],
    },
    diatribe: {
      when: () => body.classList.contains('phase-diatribe'),
      steps: [
        { sel: '#track', wait: 'drag',
          text: "This rail is your aperture. Center is lukewarm; the harder you push out, the more this thing grabs you. Drag it — go on." },
        { sel: '#track', wait: 'tap', text: () => bandLine(currentBand()) },
        { sel: '#captionReal', wait: 'tap' },
        { sel: '#captionGhost', wait: 'tap' },
        { sel: '#toAnswers', wait: 'click', text: "When you've found your band, hit this — the four responses, at that aperture." },
      ],
    },
    answers: {
      when: () => body.classList.contains('phase-answers'),
      steps: [
        { sel: '.answer-card', wait: 'tap',
          text: "Four responses, one per corner of the plane, all at the aperture you just set. Read them like four people at a table." },
        { sel: '.answer-card .ac-z', wait: 'tap',
          text: "That little rail under each one is the author's call on delivery — does this station think the thing actually lands? Left is frustrated, right is realized." },
        { sel: '#answersGrid', wait: 'select', text: "Pick the one that's closest to you. Not the one you admire — the one you'd actually say." },
        { sel: '#aCommit', wait: 'click' },
      ],
    },
    graph: {
      when: () => body.classList.contains('phase-graph') && !body.classList.contains('ticker-live'),
      steps: [
        { sel: '#graphPad', wait: 'pin',
          text: "The plane. Your corner is lit; put your pin down where you sit in it — distance from center is how hard you hold it." },
        { sel: '#zTrack', wait: 'z',
          text: "And the third axis: does it deliver? Pull toward realized if you think this thing lands, frustrated if you think it won't." },
        { sel: '#graphDialect', wait: 'tap', text: "Words if you want them. Optional. Most people don't, the ones who do are worth reading." },
        { sel: '#graphCommit', wait: 'click' },
      ],
    },
    committed: {
      when: () => body.classList.contains('ticker-live'),
      steps: [
        { sel: '#gm3d', wait: 'tap',
          text: "You're on the plane now. Those twelve orbs are the Reading's own stations, floating at the depth their author gave them. Hold one to read it against your pin." },
        { sel: '#zSlider', wait: 'tap', text: "Your delivery call stays live — slide it and watch the distance to each station change." },
        { sel: '#deltaTicker', wait: 'tap', text: "The strip is Burns. Top row: your burns — where your pin and this Reading's stations disagree. Bottom row: every object the newsroom is watching; a frame burns when someone holds it to the light." },
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
      '<div class="tt-bubble"><div class="tt-text"></div><div class="tt-foot"><span class="tt-step"></span><span class="tt-hint">tap to continue · tap outside to skip</span></div></div>' +
    '</div>';
  document.body.appendChild(root);
  const dims = Array.from(root.querySelectorAll('.tt-dim'));
  const ring = root.querySelector('.tt-ring');
  const presenter = root.querySelector('.tt-presenter');
  const bubble = root.querySelector('.tt-bubble');
  const textEl = root.querySelector('.tt-text');
  const stepEl = root.querySelector('.tt-step');
  const hintEl = root.querySelector('.tt-hint');
  const peekCanvas = root.querySelector('#tedPeek');

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
    const key = new THREE.DirectionalLight(0xfff2e0, 1.25); key.position.set(1.6, 2.4, 2.6); scene.add(key);
    const rim = new THREE.DirectionalLight(0x90a8d0, 0.6); rim.position.set(-1.8, 1, -1.2); scene.add(rim);
    scene.add(new THREE.AmbientLight(0x6072a0, 0.6));
    // head-and-shoulders, three-quarter, like he's leaning over the edge of the
    // frame (head is at y≈1.20, z≈0.46 in the model; ears to 1.57, snout to z 0.87)
    const aim = new THREE.Vector3(0.0, 1.22, 0.52);
    function frame(px, py, pz, fov) { cam.position.set(px, py, pz); cam.fov = fov; cam.updateProjectionMatrix(); cam.lookAt(aim); }
    frame(0.66, 1.50, 1.58, 26);
    let yawT = 0, pitchT = 0, yaw = 0, pitch = 0, t = 0, live = false;
    (function loop() {
      requestAnimationFrame(loop);
      if (!live) return;
      t += 0.016;
      yaw += (yawT - yaw) * 0.08; pitch += (pitchT - pitch) * 0.08;
      ted.rotation.y = yaw + Math.sin(t * 0.6) * 0.05;
      if (head) head.rotation.x = pitch + Math.sin(t * 0.9) * 0.03;
      ted.position.y = Math.sin(t * 1.1) * 0.01;
      renderer.render(scene, cam);
    })();
    return {
      look: function (nx, ny) {      // where the target is, relative to Ted, in normalized screen units (−1..1)
        yawT = Math.max(-0.9, Math.min(0.9, nx * 0.95));
        pitchT = Math.max(-0.5, Math.min(0.55, ny * 0.7));
      },
      setLive: function (v) { live = v; },
      frame: frame,   // tuning hook: Ted.peekFrame(px, py, pz, fov)
    };
  })();
  if (!Peek) peekCanvas.style.display = 'none';

  // ── Layout: cutout around the target; presenter row beside it ──────
  let target = null, raf = 0, active = null, stepIdx = -1, cleanupWait = null, phaseKey = null;
  const PAD = 10;
  function rectOf(el) { const r = el.getBoundingClientRect(); return { x: r.left - PAD, y: r.top - PAD, w: r.width + 2 * PAD, h: r.height + 2 * PAD }; }
  function layout() {
    if (!target) return;
    const W = window.innerWidth, H = window.innerHeight;
    const r = rectOf(target);
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
    const below = r.y + r.h + 8, above = r.y - ph - 8;
    let top;
    if (below + ph <= H - 8) top = below;
    else if (above >= 8) top = above;
    else top = Math.max(8, Math.min(H - ph - 8, r.y + r.h - ph));   // overlaps a tall target's foot — rare
    presenter.style.top = top + 'px';
    // the row lines up with the element (on a phone that's the frame edge;
    // on a wide screen Ted peeks in from the dim just left of it)
    const pw = Math.min(W, 560);
    const left = Math.max(0, Math.min(W - pw, r.x - 36));
    presenter.style.left = left + 'px';
    presenter.style.width = pw + 'px';
    // Ted looks from his spot toward the target's center
    if (Peek) {
      const tx = left + 70, ty = top + ph / 2;      // his head, roughly
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      Peek.look((cx - tx) / (W * 0.6), (cy - ty) / (H * 0.5));
    }
  }
  function track() { layout(); raf = requestAnimationFrame(track); }

  // ── Waits ──────────────────────────────────────────────────────────
  function armWait(step, el, done) {
    const kind = step.wait || 'tap';
    let off = () => {};
    if (kind === 'tap') {
      hintEl.textContent = 'tap to continue · tap outside to skip';
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
        clearTimeout(settled); settled = setTimeout(done, 700);
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
    while (i < steps.length && !resolve(steps[i].sel)) i++;
    if (i >= steps.length) return stop(true);
    stepIdx = i;
    const step = steps[i];
    const el = resolve(step.sel);
    target = el;
    try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
    const text = typeof step.text === 'function' ? step.text() : (step.text || el.getAttribute('data-ted-hint') || '');
    textEl.textContent = text;
    stepEl.textContent = (i + 1) + ' / ' + steps.length;
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
    active = null; target = null; phaseKey = null;
    cancelAnimationFrame(raf);
    root.classList.remove('on');
    body.classList.remove('ted-touring');
    window.Ted.touring = false;
    if (Peek) Peek.setLive(false);
  }

  // taps: on Ted or the bubble → next (only for 'tap' steps); on the dim → skip
  presenter.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!active) return;
    const step = active.steps[stepIdx];
    if (!step || (step.wait || 'tap') === 'tap') showStep(stepIdx + 1);
  });
  dims.forEach(d => d.addEventListener('click', (e) => { e.stopPropagation(); stop(false); }));
  window.addEventListener('resize', layout);

  // ── Triggers: first time a phase appears on this device ────────────
  function phaseNow() {
    for (const k of ['committed', 'graph', 'answers', 'diatribe', 'framing', 'event']) { if (PHASES[k].when()) return k; }
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

  // ── Public ─────────────────────────────────────────────────────────
  window.Ted = window.Ted || {};
  window.Ted.tour = function (key) { return start(key || phaseNow()); };
  window.Ted.tourStop = function () { stop(false); };
  window.Ted.touring = false;
  window.Ted.peekFrame = function (px, py, pz, fov) { if (Peek) Peek.frame(px, py, pz, fov); };
  window.Ted.tourReset = function () { Object.keys(PHASES).forEach(k => { try { localStorage.removeItem('prism.tour.' + k); } catch (e) {} }); };
})();
