/** @fileoverview A8 (O17) "Why is it moving?": for each top mover, find a STORED cluster (our own data, no NewsWeb)
 *  with the same ticker published in [start of the quote's session move, mover.as_of] (PA4: pre-open = one close earlier). Context only, never advice.
 *  Deterministic join, no LLM (the optional one-line Grok explanation is OFF and needs a new approval). */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const Cal = isNode ? require('./pulse-cal.js') : root.PulseCal;
  const Calc = isNode ? require('./calc.js') : root.ClustrCalc;
  const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').trim().toUpperCase();
  const NO_STORY = 'no story found';
  const DISCLAIMER = 'Context only: a stored news cluster published in the window of the quoted move (from the close before that session). It does not show cause. Not investment advice.';
  function explain(movers, clusters) {
    return (movers || []).map(m => {
      const asOf = new Date(m.as_of), from = Cal.quoteSessionStart(m.market || 'US', asOf), sym = norm(m.symbol);
      const hits = (clusters || []).flatMap(c => {
        if (!(c.tickers || []).some(x => norm(x.ticker || x.symbol || x) === sym)) return [];
        const inWindow = (c.articles || []).map(article => ({ article, time: Date.parse(article.date) }))
          .filter(x => Number.isFinite(x.time) && x.time >= +from && x.time <= +asOf); // compare story publication time, not later pipeline insert time
        if (inWindow.length) return inWindow.map(x => ({ cluster: c, article: x.article, time: x.time }));
        if (!(c.articles || []).some(article => Number.isFinite(Date.parse(article.date)))) {
          const time = Date.parse(c.published_at);
          if (Number.isFinite(time) && time >= +from && time <= +asOf) return [{ cluster: c, article: null, time }];
        }
        return [];
      }).sort((a, b) => Math.abs(b.cluster.s || 0) - Math.abs(a.cluster.s || 0) || b.time - a.time);
      const side = Calc.moverSide(m);   // CF8: side wins; sign only when side is empty
      const hit = hits[0], c = hit && hit.cluster;
      return { symbol: sym, market: m.market, side, direction: side === 'winner' ? 'up' : side === 'loser' ? 'down' : 'flat',
        changePercent: m.changePercent, window: [from.toISOString(), asOf.toISOString()],
        story: c ? { id: c.id, title: c.title, href: '#/cluster/' + encodeURIComponent(c.id), article_title: hit.article && hit.article.title, source_link: hit.article && hit.article.link || c.link || null, published_at: hit.article && hit.article.date || c.published_at } : null,
        text: c ? c.title : NO_STORY };
    });
  }
  function panelHtml(rows) {
    const li = rows.map(r => {
      const arrow = r.direction === 'up' ? '\u25B2 rising' : r.direction === 'down' ? '\u25BC falling' : '\u25CF flat';
      const pct = r.changePercent == null ? 'n/a' : (r.changePercent > 0 ? '+' : r.changePercent < 0 ? '\u2212' : '') + Math.abs(r.changePercent).toFixed(1) + '%';
      return `<li class="mx"><span class="mono ${r.direction === 'up' ? 'dpos' : r.direction === 'down' ? 'dneg' : 'dneu'}">${esc(r.symbol)} ${arrow} ${pct}</span>` +
        (r.story ? `<a href="${esc(r.story.href)}">${esc(r.story.title)}</a>` : `<span class="sub">${NO_STORY}</span>`) + '</li>';
    }).join('');
    return `<h2>// Why is it moving?</h2><ul class="mxl">${li}</ul><p class="sub">${DISCLAIMER}</p>`;
  }
  const api = { explain, panelHtml, NO_STORY, DISCLAIMER };
  if (isNode) module.exports = api;
  if (root) root.MoversExplain = api;
})(typeof window !== 'undefined' ? window : null);
