/**
 * overlay.js — the drafting overlay on the object register (2026-09-25).
 *
 * Two writers used to share data/newsroom/objects.json: the GitHub Action
 * (scan-objects.js) and the drafting task on Sailor's Mac. Every pull then
 * collided. Now each file has exactly one writer:
 *
 *   objects.json        written ONLY by the scan (GitHub Action)
 *   objects.local.json  written ONLY by the drafting task (Sailor commits it)
 *
 * Readers (the scan itself, the portal/admin sync) apply the overlay on top of
 * the register with applyOverlay(). The overlay's drafting fields win; the
 * scanner's fields (lastSeen, permanence counters, articles…) are never in it.
 *
 * Overlay shape: { schema: 'prism_object_overlay_v1', updatedAt,
 *                  objects: { <oid>: { status, drafts, draftedOn, corrections,
 *                  inversions, permanenceNote, aliasCandidates, dismissedWhy } } }
 *
 * The browser keeps a byte-identical copy of applyOverlay in src/js/prism-sync.js.
 */
'use strict';
const OVERLAY_FIELDS = ['status', 'drafts', 'draftedOn', 'corrections', 'inversions',
  'permanenceNote', 'aliasCandidates', 'dismissedWhy'];
// A scanner status never overrides a drafting status, and vice versa: the
// overlay only carries statuses the drafting task decides.
const OVERLAY_STATUSES = ['drafted', 'dismissed', 'promoted'];
function applyOverlay(reg, overlay) {
  if (!reg || !Array.isArray(reg.objects) || !overlay || !overlay.objects) return reg;
  reg.objects.forEach(o => {
    const e = overlay.objects[o.oid];
    if (!e) return;
    OVERLAY_FIELDS.forEach(f => {
      if (!(f in e)) return;
      if (f === 'status') { if (OVERLAY_STATUSES.includes(e.status)) o.status = e.status; return; }
      if (f === 'drafts') { o.drafts = Object.assign({}, o.drafts || {}, e.drafts || {}); return; }
      o[f] = e[f];
    });
  });
  reg.overlayAppliedAt = overlay.updatedAt || null;
  return reg;
}
module.exports = { applyOverlay, OVERLAY_FIELDS, OVERLAY_STATUSES };
