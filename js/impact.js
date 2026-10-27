/** @fileoverview Impact badge (design-app.md v2 §5, approved 2026-10-27): sign + arrow + word + exponential meter.
 *  Never colour alone. Meter fill per side = 100·2^(|s|/2)/32 %. Calibration pending (mapping map-v1, uncalibrated). */
(function (root) {
  const esc = x => String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = s => { if (s == null || s === '') return null; const n = Math.round(Number(s)); return Number.isFinite(n) ? Math.max(-10, Math.min(10, n)) : null; };
  const tone = s => (s >= 2 ? 'pos' : s <= -2 ? 'neg' : 'neu');
  const signText = s => (s > 0 ? '+' + s : s < 0 ? '\u2212' + Math.abs(s) : '0');
  const arrow = s => (s >= 2 ? '\u25B2' : s <= -2 ? '\u25BC' : '\u25CF');
  const word = s => (s >= 2 ? 'positive' : s <= -2 ? 'negative' : 'neutral');
  const meterPct = s => (s === 0 ? 0 : (100 * Math.pow(2, Math.abs(s) / 2)) / 32);
  function badgeHtml(score) {
    const s = clamp(score); if (s == null) return '';
    const w = meterPct(s).toFixed(1) + '%', t = tone(s);
    return `<div class="imp ${t}" role="img" aria-label="Impact ${esc(signText(s))} of 10, ${word(s)}, uncalibrated">` +
      `<span class="n">${esc(signText(s))}</span><span class="w">${arrow(s)} ${word(s).slice(0, 3)}</span>` +
      `<span class="meter" aria-hidden="true"><i style="--w:${s < 0 ? w : '0%'}"></i><i style="--w:${s > 0 ? w : '0%'}"></i></span></div>`;
  }
  function chipHtml(ticker, score, href) {
    const s = clamp(score); const t = s == null ? 'neu' : tone(s);
    return `<a class="tk ${t}" href="${esc(href || '#/ticker/' + encodeURIComponent(ticker))}">${esc(ticker)}` +
      (s == null ? '' : ` <span class="v">${arrow(s)} ${esc(signText(s))}</span>`) + '</a>';
  }
  const CAL_LABEL = 'calibration pending';
  const api = { badgeHtml, chipHtml, tone, signText, arrow, word, meterPct, clamp, CAL_LABEL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ClustrImpact = api;
})(typeof window !== 'undefined' ? window : null);
