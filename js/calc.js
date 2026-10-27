/**
 * @fileoverview Pure calculation helpers (Phase A fixes CF1, CF5, CF8 + SN7/SN8 guards).
 * Browser: window.ClustrCalc. Node tests: require('./calc.js').
 */
(function (root) {
  /** SN7: finite and > 0 */
  function validPrice(v) {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  /** CF1: the publish price is ONLY priceAtPublish / price_at_publish. Never fall back to `price` (may be live). */
  function publishPrice(s) {
    if (!s) return null;
    return validPrice(s.priceAtPublish ?? s.price_at_publish);
  }

  function pctChange(from, to) {
    const a = validPrice(from), b = validPrice(to);
    return a == null || b == null ? null : ((b - a) / a) * 100;
  }

  /** Average % since publish over ALL priced stocks (CF1-safe). Returns {avg, n}. */
  function averageSincePublish(list, quotes, normalize) {
    const norm = normalize || (x => String(x || '').trim().toUpperCase());
    const deltas = [];
    for (const s of list || []) {
      const live = (quotes || {})[norm(s.symbol)];
      const d = pctChange(publishPrice(s), live && live.price);
      if (d != null) deltas.push(d);
    }
    return { avg: deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null, n: deltas.length };
  }

  /** CF8: side wins when present; sign of changePercent only when side is empty. */
  function moverSide(m) {
    const side = String((m && m.side) || '').toLowerCase();
    if (side === 'winner' || side === 'loser') return side;
    const pct = m && m.changePercent != null ? Number(m.changePercent) : NaN;
    if (Number.isFinite(pct) && pct > 0) return 'winner';
    if (Number.isFinite(pct) && pct < 0) return 'loser';
    return 'active';
  }

  const STANCE_MIN_N = 3;            // CF5: min publish rows per stance before any insight
  const STANCE_THRESHOLD_PP = 1.0;   // CF5: 1 percentage point, not 0.15/0.2 pp

  /**
   * CF5 + SN8: pooled per-stock stance stats (weighted by sampleN), N shown, thresholds in pp >= 1.
   * Rows: {stance, defaultRet, sampleN, priceBasis}. Rows whose stance is not constructive/watch/cautious are excluded here; api.js maps a missing stance to 'unknown' (SN6, BC10).
   */
  function stancePriceStats(enriched, opts) {
    const minN = (opts && opts.minN) || STANCE_MIN_N;
    const thr = (opts && opts.thresholdPp) || STANCE_THRESHOLD_PP;
    const acc = { constructive: [0, 0, 0], watch: [0, 0, 0], cautious: [0, 0, 0] }; // [sum*w, w, rows]
    for (const r of enriched || []) {
      if (r.defaultRet == null || !Number.isFinite(Number(r.defaultRet))) continue;
      const k = r.stance; if (!acc[k]) continue;
      const w = Math.max(1, Number(r.sampleN) || 1);
      acc[k][0] += Number(r.defaultRet) * w; acc[k][1] += w; acc[k][2] += 1;
    }
    const out = {};
    for (const k of Object.keys(acc)) {
      out[k] = acc[k][1] ? acc[k][0] / acc[k][1] : null;
      out[k + 'N'] = acc[k][2];
    }
    const c = out.constructive, z = out.cautious;
    const enough = k => out[k + 'N'] >= minN;
    let insight = `Not enough history (need ≥${minN} publishes per stance) to compare stance with returns.`;
    if (enough('constructive') && enough('cautious')) {
      if (c > z + thr) insight = 'Defaults did better after Constructive than Cautious stamps.';
      else if (z > c + thr) insight = 'Defaults did better after Cautious than Constructive stamps — stance may lag price.';
      else insight = 'Stance and default-basket moves are mixed — treat stance as context, not a timer.';
    } else if (enough('constructive') && c > thr) {
      insight = 'After Constructive stamps, cluster defaults rose vs those publish prints.';
    } else if (enough('cautious') && z < -thr) {
      insight = 'Cautious periods line up with weaker default-basket moves vs publish prints.';
    }
    out.insight = insight;
    out.label = 'defaults → next publish (last row → live)'; // CF5: label matches the window actually measured
    return out;
  }

  /** CF2 (backend, untitled3/pipeline/yahoo-quotes.js:130-141): stamp once, never overwrite. */
  function stampPublishFields(stock, publishedAt) {
    return {
      ...stock,
      publishedAt: stock.publishedAt || publishedAt,
      priceAtPublish: stock.priceAtPublish ?? stock.price ?? null,
      changePercentAtPublish: stock.changePercentAtPublish ?? stock.changePercent ?? null
    };
  }

  const api = { validPrice, publishPrice, pctChange, averageSincePublish, moverSide, stancePriceStats,
    stampPublishFields, STANCE_MIN_N, STANCE_THRESHOLD_PP };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ClustrCalc = api;
})(typeof window !== 'undefined' ? window : null);
