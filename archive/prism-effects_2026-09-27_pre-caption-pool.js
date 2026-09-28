// ============================================================
// PRISM · EFFECTS (shared behavior layer)
// ------------------------------------------------------------
// The behavior side of prism-grammar.css. Provides:
//   - Breath generator (one shared sine source, ~0.4 Hz primary)
//   - Caption reform transition (Eyewitness specimen swap)
//   - Caption positioning with home-shelf + rubber-band threshold
//   - Keyword pool builder (schema-tolerant against prismdb.js drift)
//   - Keyword text wrapping (escapes HTML, wraps matches in <span>)
//   - Band utilities (score → band, side normalization, score↔pct math)
//
// Exposed as window.PrismEffects. Plain script — no module syntax —
// so both v2 stages and v56 can include it via <script src>.
// ============================================================

(function (root) {
  'use strict';

  // ── Constants ──────────────────────────────────────────────
  // Schema-tolerant band key aliasing — prismdb.js seed responses
  // still use the older goodFaith/coalition/badFaith vocabulary
  // while the canonical schema is fluid/coalition/denominated.
  const BAND_KEY_ALIASES = {
    fluid:       ['fluid', 'goodFaith'],
    coalition:   ['coalition'],
    denominated: ['denominated', 'badFaith']
  };
  const BANDS = ['fluid', 'coalition', 'denominated'];

  // ── Score / band utilities ─────────────────────────────────
  function bandFromScore(absScore) {
    if (absScore <= 33) return 'fluid';
    if (absScore <= 66) return 'coalition';
    return 'denominated';
  }
  function bandSuffix(b) {
    return b === 'fluid' ? 'F' : b === 'coalition' ? 'C' : 'D';
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function scoreToPct(s)    { return (s + 100) / 2; }   // -100..100 → 0..100
  function pctToScore(p)    { return Math.round(p * 2 - 100); }

  // ── HTML / regex escape utilities ──────────────────────────
  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // ── Breath generator ───────────────────────────────────────
  // Single shared time origin. Stages subscribe by calling breath(now)
  // inside their own requestAnimationFrame loop. Returns {primary, slow, t}.
  let _t0 = null;
  function breath(now) {
    if (_t0 === null) _t0 = now;
    const t = (now - _t0) / 1000;
    return {
      t,
      primary: 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 0.40),
      slow:    0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 0.10)
    };
  }

  // ── Keyword pool builder ───────────────────────────────────
  // For a given (event, side, band), build the keyword pool:
  //   1. wordTags across all bands on this side (load-bearing words
  //      stay load-bearing across intensity; glow colors per band).
  //   2. Event-level framingKeywords if present.
  //   3. Optional augmentation map keyed by {eventId: {side: {band: [phrases]}}}.
  function getKeywordPool(event, side, band, augment) {
    if (!event || !event.responses) return [];
    const quads = side === 'left' ? ['A', 'C'] : ['B', 'D'];
    const pool = [];

    quads.forEach(q => {
      const quad = event.responses[q];
      if (!quad) return;
      BANDS.forEach(b => {
        const keys = BAND_KEY_ALIASES[b];
        let r = null;
        for (const k of keys) { if (quad[k]) { r = quad[k]; break; } }
        if (!r) return;
        if (r.xWord) pool.push(r.xWord.trim());
        if (r.yWord) pool.push(r.yWord.trim());
        if (Array.isArray(r.words)) {
          r.words.forEach(w => {
            const word = (typeof w === 'string') ? w : (w.t || w.word || '');
            if (word) pool.push(word.trim());
          });
        }
      });
    });

    if (Array.isArray(event.framingKeywords)) {
      event.framingKeywords.forEach(k => { if (k) pool.push(String(k).trim()); });
    }

    if (augment && augment[event.id]) {
      const aug = augment[event.id]?.[side]?.[band];
      if (Array.isArray(aug)) aug.forEach(k => pool.push(k));
    }

    // Dedupe (case-insensitive), preserve original casing
    const seen = new Set();
    return pool.filter(w => {
      const k = w.toLowerCase();
      if (seen.has(k) || !k) return false;
      seen.add(k);
      return true;
    });
  }

  // ── Apply keyword wrapping to caption text ─────────────────
  // Wraps matched keywords in <span class="keyword">. Permissive
  // matching: whole-word, case-insensitive, optional plural / -es /
  // -ed / -ing suffix. Multi-word phrases matched first (literal,
  // case-insensitive) so they don't fragment into single-word hits.
  function applyKeywords(text, pool) {
    let safe = escapeHtml(text);
    if (!pool || pool.length === 0) return safe;

    const phrases = pool.filter(w => /\s/.test(w)).sort((a, b) => b.length - a.length);
    const singles = pool.filter(w => !/\s/.test(w)).sort((a, b) => b.length - a.length);

    phrases.forEach(p => {
      const re = new RegExp(`(${escapeRe(p)})`, 'gi');
      safe = safe.replace(re, '<span class="keyword">$1</span>');
    });
    singles.forEach(w => {
      if (w.length < 3) return; // skip very short — would over-match
      const re = new RegExp(`\\b(${escapeRe(w)}(?:s|es|ed|ing)?)\\b(?![^<]*</span>)`, 'gi');
      safe = safe.replace(re, '<span class="keyword">$1</span>');
    });
    return safe;
  }

  // ── Caption reform transition ──────────────────────────────
  // The Eyewitness "specimen morphing under glass" effect. Dims the
  // caption text, swaps the content (with keyword wrapping applied),
  // updates data-side/data-band attributes (which the CSS uses to
  // recolor the keyword halo), then fades back. Synchronizes with
  // any caption position migration via the CSS transition on .left.
  //
  // Options:
  //   el       — the caption element (has .caption-label .side/.band)
  //   txtEl    — the .caption-text inner element
  //   newText  — raw text to render
  //   newSide  — 'left' | 'right'
  //   newBand  — 'fluid' | 'coalition' | 'denominated'
  //   pool     — keyword pool array (from getKeywordPool)
  //   onSwap   — optional callback fired the moment text content is replaced
  // Optional axis-pole labels — when set (per event), the caption side reads the
  // pole name (e.g. "Dignity" / "Security") instead of the raw "left"/"right".
  let _poleLabels = null;
  function setPoleLabels(m) { _poleLabels = (m && (m.left || m.right)) ? { left: m.left || 'left', right: m.right || 'right' } : null; }

  function _updateLabels(el, newSide, newBand) {
    const labelSide = el.querySelector('.caption-label .side');
    const labelBand = el.querySelector('.caption-label .band');
    if (labelSide) labelSide.textContent = (_poleLabels && _poleLabels[newSide]) || newSide;
    if (labelBand) labelBand.textContent = newBand;
  }

  function reformCaption(opts) {
    const { el, txtEl, newText, newSide, newBand, pool, onSwap } = opts;
    el.classList.add('reforming');
    el.setAttribute('data-side', newSide);
    el.setAttribute('data-band', newBand);

    setTimeout(() => {
      txtEl.innerHTML = applyKeywords(newText, pool || []);
      _updateLabels(el, newSide, newBand);
      if (typeof onSwap === 'function') onSwap();
      setTimeout(() => {
        el.classList.remove('reforming');
      }, 40);
    }, 320);
  }

  // Develop — first text appearing after engagement. Label header + body
  // both run through the CSS develop keyframe (blur 8 → 0, opacity 0.15
  // → 1, letter-spacing 0.04em → normal). ~720ms total. Caller tracks
  // materialized state per caption.
  function materializeCaption(opts) {
    const { el, txtEl, newText, newSide, newBand, pool, onSwap } = opts;
    el.setAttribute('data-side', newSide);
    el.setAttribute('data-band', newBand);
    _updateLabels(el, newSide, newBand);
    txtEl.innerHTML = applyKeywords(newText, pool || []);
    txtEl.classList.remove('materializing');
    void txtEl.offsetWidth; // reflow so re-adding the class re-triggers animation
    txtEl.classList.add('materializing');
    if (typeof onSwap === 'function') onSwap();
    setTimeout(() => txtEl.classList.remove('materializing'), 740);
  }

  // Refract — lens flare at the side crossing. A soft warm gradient sweeps
  // across the caption text (left → right); content swaps at the moment the
  // flare hits the center (~50% into the cycle ≈ 300ms) so the bright pass
  // softens the swap. data-side and data-band update immediately so the
  // keyword halo color flips coherently with the cross.
  function refractCaption(opts) {
    const { el, txtEl, newText, newSide, newBand, pool, onSwap } = opts;
    el.setAttribute('data-side', newSide);
    el.setAttribute('data-band', newBand);

    txtEl.classList.remove('refracting');
    void txtEl.offsetWidth;
    txtEl.classList.add('refracting');

    setTimeout(() => {
      txtEl.innerHTML = applyKeywords(newText, pool || []);
      _updateLabels(el, newSide, newBand);
      if (typeof onSwap === 'function') onSwap();
    }, 300);
    setTimeout(() => txtEl.classList.remove('refracting'), 620);
  }

  // ── Caption positioning (home-shelf + rubber-band) ─────────
  // Each caption has a home position on its side's "shelf" (25% / 75%
  // of stage width by default). At |score| <= homeThreshold the caption
  // stays at home; past the threshold it rubber-bands toward the thumb's
  // horizontal position. Updates the optional label-line SVG endpoints.
  //
  // Options:
  //   el            — caption element to position
  //   score         — current score for this caption (-100..100)
  //   stage         — stage container element (provides coordinate frame)
  //   track         — track element (provides x scale)
  //   lineEl        — optional SVG <line> element to update
  //   side          — 'left' | 'right' (overrides el.dataset.side if given)
  //   homeThreshold — score magnitude below which caption stays at home (default 20)
  //   homeLeft      — fractional x of left shelf center (default 0.25)
  //   homeRight     — fractional x of right shelf center (default 0.75)
  function positionCaption(opts) {
    const {
      el, score, stage, track, lineEl,
      side: sideOpt,
      homeThreshold = 20,
      homeLeft = 0.25,
      homeRight = 0.75
    } = opts;

    const sr = stage.getBoundingClientRect();
    const tr = track.getBoundingClientRect();
    const w  = el.offsetWidth || 320;
    const side = sideOpt || el.getAttribute('data-side') || 'left';

    const homeCenter = (side === 'left' ? homeLeft : homeRight) * sr.width;
    const home_x = homeCenter - w / 2;

    const thumbCenter_stage = (tr.left - sr.left) + (tr.width * scoreToPct(score) / 100);
    const track_x = thumbCenter_stage - w / 2;

    const abs_s = Math.abs(score);
    let leftPx;
    if (abs_s <= homeThreshold) {
      leftPx = home_x;
    } else {
      const t = (abs_s - homeThreshold) / (100 - homeThreshold);
      leftPx = home_x + (track_x - home_x) * t;
    }

    leftPx = clamp(leftPx, 8, sr.width - w - 8);
    el.style.left = leftPx + 'px';

    if (lineEl) {
      const thumbY_stage = (tr.top - sr.top) + tr.height / 2;
      const x2 = leftPx + w / 2;
      const y2 = el.offsetTop + el.offsetHeight;
      lineEl.setAttribute('x1', thumbCenter_stage);
      lineEl.setAttribute('y1', thumbY_stage - 11);
      lineEl.setAttribute('x2', x2);
      lineEl.setAttribute('y2', y2);
    }
  }

  // ── Export ─────────────────────────────────────────────────
  root.PrismEffects = {
    // Constants
    BAND_KEY_ALIASES, BANDS,
    // Score / band
    bandFromScore, bandSuffix, scoreToPct, pctToScore, clamp,
    // Text
    escapeHtml, escapeRe, applyKeywords, getKeywordPool,
    // Animation
    breath,
    // Caption helpers
    reformCaption, materializeCaption, refractCaption, positionCaption, setPoleLabels,
  };

})(typeof window !== 'undefined' ? window : globalThis);
