/** @fileoverview t344s1271 + t345u: eventline-style cluster cards for #/feed (the CLUSTERS tab). Each card: name, stance + impact,
 *  linked stocks (default + mentioned; t352u: no movers block), our summary, a 'Show articles (N)' toggle, and the STANCE HISTORY of its default cluster
 *  (stored publishes + allowlisted Supabase rows), newest first. All data text is escaped; links are http/https only. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const I = isNode ? require('./impact.js') : root.ClustrImpact;
  const Ti = isNode ? require('./tiers.js') : root.PulseTiers;   // A13 tier label (calibration pending until H15) + "N stories → 1 event"
  const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const day = iso => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Europe/Oslo' });
  const safeUrl = u => (typeof u === 'string' && /^https?:\/\/[^\s"'<>]+$/i.test(u) ? u : '');
  // same slug as build/clusters/defaults.v1.js, so keys equal the stored theme ids (market + slug of the name)
  const slug = s => String(s).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  /** Join key: cluster_id, else the pipeline's name map (PULSE_PACKAGE.clusterMap), else market + slug(theme for dynamic, else name). */
  function keyOf(c, map) {
    if (c.cluster_id) return String(c.cluster_id);
    const m = map && map[c.title]; if (m) return String(m);
    return `${String(c.market || 'US').toLowerCase()}-${slug(c.kind === 'dynamic' && c.sector ? c.sector : c.title)}`;
  }
  /** Theme rows (stored) + remote entries [{publish_id, created_at, key, stance, impact_score}] -> newest first, deduped, with delta vs the older entry. */
  function historyFor(key, themes, remote) {
    const t = (themes || []).find(x => x.theme_id === key), by = new Map();
    for (const r of (t ? t.rows : [])) by.set(r.publish_id, { publish_id: r.publish_id, created_at: r.created_at, stance: r.stance, impact_score: r.impact_score });
    for (const r of remote || []) if (r.key === key && !by.has(r.publish_id)) by.set(r.publish_id, r);
    const rows = [...by.values()].filter(r => Number.isFinite(Date.parse(r.created_at))).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    // delta vs the nearest OLDER row that also has an impact; first = no older scored row. price_move stays null until a quote source exists
    const ok = v => typeof v === 'number' && Number.isFinite(v);
    return rows.map((r, i) => { const p = ok(r.impact_score) ? rows.slice(i + 1).find(x => ok(x.impact_score)) : null;
      return Object.assign({}, r, { delta: p ? Math.round(r.impact_score) - Math.round(p.impact_score) : null, first: ok(r.impact_score) && !p, price_move: null }); });
  }
  /** Inline SVG of impact over time (oldest left); '' under 2 scored points. */
  function sparkline(rows) {
    const pts = rows.filter(r => typeof r.impact_score === 'number').slice().reverse();
    if (pts.length < 2) return '';
    const W = 120, H = 28, x = i => (i / (pts.length - 1) * (W - 4) + 2).toFixed(1), y = v => ((10 - v) / 20 * (H - 4) + 2).toFixed(1);
    const label = `Impact over time, oldest to newest: ${pts.map(p => (Math.round(p.impact_score) > 0 ? '+' : '') + Math.round(p.impact_score)).join(', ')}`;
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label)}"><line class="zero" x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}"/>` +
      `<polyline fill="none" stroke="currentColor" stroke-width="1.5" points="${pts.map((p, i) => `${x(i)},${y(p.impact_score)}`).join(' ')}"/></svg>`;
  }
  const deltaHtml = r => (r.first ? '<span class="sub">first scored</span>' : r.delta == null ? ''
    : `<span class="${r.delta > 0 ? 'dpos' : r.delta < 0 ? 'dneg' : 'dneu'}">${r.delta > 0 ? '\u25B2 +' : r.delta < 0 ? '\u25BC \u2212' : '\u25CF '}${Math.abs(r.delta)}<span class="sr"> vs previous scored publish</span></span>`);
  const impText = v => (typeof v === 'number' ? (n => `${n > 0 ? '+' : n < 0 ? '\u2212' : ''}${Math.abs(n)}`)(Math.round(v)) : 'n/a');
  const SHOWN = 8;
  let histN = 0;
  const hrow = r => `<tr><td><time datetime="${esc(r.created_at)}">${esc(day(r.created_at))}</time></td><td>${esc(r.stance || 'no stance')}</td>` +
    `<td class="r">${typeof r.impact_score === 'number' ? impText(r.impact_score) : ''}</td><td class="r">${typeof r.impact_score === 'number' ? deltaHtml(r) : ''}</td></tr>`;
  /** Free: latest 3 + Pro note; Pro: latest 8, rest behind 'Show all (N)'. One price line (no quote source yet). */
  function historyHtml(rows, role) {
    if (!rows.length) return '<p class="sub">No stance history yet.</p>';
    const shown = role === 'pro' ? rows : rows.slice(0, 3), more = rows.length - shown.length, head = shown.slice(0, SHOWN), rest = shown.slice(SHOWN), id = `hist${++histN}`;
    const panel = `hist-panel-${id}`;
    return `<details class="hist"><summary><span>Stance history</span>${sparkline(shown)}<span class="hist-count">${shown.length}${more ? '+' : ''} points</span></summary><div class="hist-body" id="${panel}"><p class="sub">Price moves: n/a (no quote source yet)</p>` +
      `<table class="hist-t"><caption class="sr">Stance history, newest first</caption><thead><tr><th scope="col">Date</th><th scope="col">Stance</th><th scope="col" class="r">Impact</th><th scope="col" class="r">Change</th></tr></thead>` +
      `<tbody>${head.map(hrow).join('')}</tbody>${rest.length ? `<tbody id="${id}" hidden>${rest.map(hrow).join('')}</tbody>` : ''}</table>` +
      (rest.length ? `<button type="button" class="btn sec toggle" aria-expanded="false" aria-controls="${id}" data-open="Show fewer" data-closed="Show all (${shown.length})">Show all (${shown.length})</button>` : '') +
      (more ? `<p class="sub">${more} older publish${more === 1 ? '' : 'es'} with Pro.</p>` : '') + '</div></details>';
  }
  let artN = 0;
  const ratingHtml = value => Number.isInteger(value) && value >= -10 && value <= 10
    ? `<span class="article-rating ${value > 0 ? 'is-positive' : value < 0 ? 'is-negative' : 'is-neutral'}" aria-label="Article rating ${value > 0 ? '+' : ''}${value} out of 10">${value > 0 ? '+' : ''}${value}<span>/10</span></span>` : '';
  function articlesHtml(c) {
    if (!Array.isArray(c.articles)) return '<p class="sub">No article list stored for this publish</p>';
    const id = `arts${++artN}`, a = c.articles;
    return `<button type="button" class="btn sec toggle toggle-arts" aria-expanded="false" aria-controls="${id}" data-open="Hide articles (${a.length})" data-closed="Show articles (${a.length})">Show articles (${a.length})</button>` +
      `<div class="arts" id="${id}" hidden>${a.map(x => { const u = safeUrl(x.link);
        return `<article class="art"><div class="art-head"><h4>${esc(x.title)}</h4>${ratingHtml(x.rating)}</div><p class="sub">${esc(x.source)}${x.date ? ` \u00b7 ${esc(x.date)}` : ''}</p>${x.short_summary ? `<p>${esc(x.short_summary)}</p>` : ''}` +
          (u ? `<a class="read" href="${esc(u)}" target="_blank" rel="noopener noreferrer">Read \u2192</a>` : '') + '</article>'; }).join('')}</div>`;
  }
  const chips = xs => (xs.length ? xs.map(t => I.chipHtml(t, null)).join('') : '<span class="sub">No stocks linked yet</span>');
  /** One card; c = a current cluster (or a default theme with no current event: {title, market, theme_id, stocks}). */
  function cardHtml(c, hist, role) {
    const L = c.links || {}, linked = [...new Set([...(L.default || []), ...(L.mentioned || []), ...(c.tickers || []).map(t => t.ticker)])];
    const latest = hist[0], s = c.current ? c.s : latest && latest.impact_score, stance = c.current ? c.stance : latest && latest.stance;
    return `<section class="card group ${typeof s === 'number' ? I.tone(s) : ''}" data-key="${esc(c.key)}"><div>` +
      `<div class="group-top"><h3>${c.current ? `<a href="#/cluster/${esc(c.id)}">${esc(c.title)}</a>` : esc(c.title)}</h3>${typeof s === 'number' ? I.badgeHtml(s) : ''}` +
      `<span class="sub">${esc(stance || 'no stance')} \u00b7 impact ${impText(s)} (\u221210..+10)${c.current ? ` \u00b7 ${esc(Ti.tierLabel(c.s))}${c.n_entries > 1 ? ' \u00b7 ' + esc(Ti.countText(c.n_entries)) : ''}` : ' \u00b7 not in the latest publish'}</span></div>` +
      `<div class="lk"><span class="lk-l">Linked stocks</span><div class="tick">${chips(linked)}</div></div>` +
      (c.current ? `<p>${esc(c.summary)}</p>${articlesHtml(c)}` : '') + historyHtml(hist, role) + '</div></section>';
  }
  /** Current clusters first (given order), then default clusters of the shown markets that have no current event. */
  function cardsHtml(list, st) {
    const themes = st.themes || [], map = st.clusterMap;
    // The live feed is today's events. Historical theme-only rows belong on the Themes view,
    // where they have context, instead of being mixed into today's results.
    return list.map(c => {
      const key = keyOf(c, map);
      return cardHtml(Object.assign({}, c, { key, current: true }), historyFor(key, themes, st.history), st.role);
    }).join('\n');
  }
  /** Delegated click: the articles and history toggles flip aria-expanded, the label and the panel's hidden flag. */
  function wire(app) {
    app.addEventListener('click', e => {
      const b = e.target.closest('button.toggle'); if (!b) return;
      const open = b.getAttribute('aria-expanded') !== 'true', p = app.querySelector('#' + b.getAttribute('aria-controls'));
      b.setAttribute('aria-expanded', String(open)); b.textContent = open ? b.dataset.open : b.dataset.closed; if (p) p.hidden = !open;
    });
  }
  const api = { keyOf, slug, historyFor, sparkline, historyHtml, articlesHtml, cardHtml, cardsHtml, wire, safeUrl };
  if (isNode) module.exports = api; else root.PulseClusters = api;
})(typeof window !== 'undefined' ? window : globalThis);
