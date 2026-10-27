/** @fileoverview A13 (F2) importance tier + "N stories → 1 event" + new/repeat/follow-up.
 *  A15.0 (user t240u/t241u): display text renamed to English; the cut-points are unchanged (registry "A13-tier v1"). Pure, no LLM, $0.
 *  Tier cut-points are FROZEN v1 (method-registry.md "A13-tier v1"): never tune them on results; a change is a new registry row. */
(function (root) {
  const H15_PASSED = false;   // label carries "calibration pending" until H15 passes (then flip here + new registry row)
  const CAL = 'calibration pending', NONE = 'no score', WINDOW_MS = 72 * 3600e3;
  /** |s| 9–10 Critical, 6–8 High, 3–5 Medium, 0–2 Low; missing / non-numeric / outside ±10 = "no score" (never Low). */
  function tier(s) {
    const a = s == null || s === '' ? NaN : Math.abs(Number(s));
    return !(a <= 10) ? NONE : a >= 9 ? 'Critical' : a >= 6 ? 'High' : a >= 3 ? 'Medium' : 'Low';
  }
  const tierLabel = s => { const t = tier(s); return t === NONE || H15_PASSED ? t : `${t} (${CAL})`; };
  const countText = n => (n > 1 ? `${n} stories \u2192 1 event` : '');
  /** One cluster (array of entries) -> entries with flag; earliest published_at is the head (tie: id), the rest fold under it.
   *  prev = [{cluster_id, at}] from earlier runs; a head id seen within 72h before `now` is "follow-up" instead of "new". */
  // shortcut: cluster_id = the head entry's id, so a NEW earlier entry joining later starts a new id; use a stored cluster key if that bites.
  function flag(cluster, prev = [], now = new Date()) {
    const at = e => { const v = +new Date(e.published_at ?? e.publishedAt); return Number.isNaN(v) ? Infinity : v; };   // P15: sorter uses publishedAt; undated sorts last
    const ord = cluster.slice().sort((a, b) => (at(a) - at(b) || 0) || String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
    const cluster_id = String(ord[0].id), t = +new Date(now);
    const seen = prev.some(p => String(p.cluster_id) === cluster_id && t - new Date(p.at) >= 0 && t - new Date(p.at) <= WINDOW_MS);
    return { cluster_id, n: ord.length, count_text: countText(ord.length), head: { ...ord[0], flag: seen ? 'follow-up' : 'new' },
      folded: ord.slice(1).map(e => ({ ...e, flag: 'repeat' })) };
  }
  const api = { tier, tierLabel, countText, flag, H15_PASSED, CAL, NONE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PulseTiers = api;
})(typeof window !== 'undefined' ? window : null);
