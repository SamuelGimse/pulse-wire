/** @fileoverview P0.2 / A14.5 theme history in PULSE: #/themes and #/theme/<id>. Reads PulseHistoryData (SAMPLE, generated
 *  by build/clusters/gen-ui.js); no network, no render.js/api.js (T15b). Free: previous trading day only (t262u, PulseCal.freeWindow). */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const Cal = isNode ? require('./pulse-cal.js') : root.PulseCal;
  const HD = () => (isNode ? require('./pulse-history-data.js') : root.PulseHistoryData);
  const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const when = iso => new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/Oslo', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' Oslo';
  const pct = v => v == null ? 'n/a' : `${v > 0 ? '+' : v < 0 ? '\u2212' : ''}${Math.abs(v).toFixed(2)}%`;
  const SAMPLE = '<span class="tag">Sample data</span>';
  const DESC = 'Descriptive only: equal-weight basket move of the theme\u2019s fixed stocks between publishes (not benchmark-adjusted, not a performance claim, not investment advice).';
  const emptyText = d => `History starts ${esc(d.launch_date)}.`;   // A14-10 day-1 empty state

  /** Split a theme's rows for the role: free sees only the previous trading day's publishes; the rest is counted and hidden.
   *  PREVIEW ONLY (N1): the sample data is all in the client, so this is not a paywall; the real one is server-side RLS (paywall.sql). */
  function visible(rows, role, now) {
    if (role === 'pro') return { rows, locked: 0 };
    const ok = rows.filter(r => Cal.inFreeWindow(r.market, r.created_at, now)); return { rows: ok, locked: rows.length - ok.length };
  }
  function viewThemes(st) {
    const d = HD();
    const li = d.themes.map(t => { const v = visible(t.rows, st.role, st.now);
      return `<a class="card" href="#/theme/${esc(t.theme_id)}"><div><h3>${esc(t.name)}</h3><p class="sub">${esc(t.market)} \u00b7 ${esc(t.tickers.join(', '))} \u00b7 ${t.rows.length ? `${v.rows.length} publish${v.rows.length === 1 ? '' : 'es'} shown${v.locked ? ` \u00b7 ${v.locked} locked` : ''}` : emptyText(d)}</p></div></a>`; }).join('');
    return `<div class="head"><div><h1>&gt; Themes</h1><div class="sub">${st.role === 'free' ? Cal.FREE_LABEL : 'All publishes'} \u00b7 ${SAMPLE}</div></div></div><div class="list">${li}</div>`;
  }
  function viewTheme(st, id) {
    const d = HD(), t = d.themes.find(x => x.theme_id === id), back = '<a class="back" href="#/themes">\u2190 Themes</a>';
    if (!t) return `${back}<h1>&gt; Not found</h1><p class="note">No theme with this id.</p>`;
    const v = visible(t.rows, st.role, st.now);
    const rows = v.rows.map(r => `<tr><td>${when(r.created_at)}</td><td>${esc(r.publish_title)}</td><td>${esc(r.stance)}</td><td>${esc(r.tier)}</td><td>${esc(r.flag)}</td>` +
      `<td class="r">${r.since_prev ? `${pct(r.since_prev.pct)} <small>${esc(r.since_prev.label)}${r.since_prev.n ? ` \u00b7 n=${r.since_prev.n}` : ''}</small>` : '<small>first publish</small>'}</td></tr>`).join('');
    const lock = v.locked ? `<section class="wall"><h3>${v.locked} more publish${v.locked === 1 ? '' : 'es'} with Pro</h3><p>${esc(Cal.FREE_LABEL)}. Pro shows today and the full history.</p><a class="btn primary" href="#/account">Upgrade \u00b7 99 kr/month</a></section>` : '';
    const body = t.rows.length === 0 ? `<div class="empty">${emptyText(d)}</div>` : rows ? `<div class="tw"><table><thead><tr><th>Published</th><th>Publish</th><th>Stance</th><th>Tier</th><th>Flag</th><th class="r">Basket move</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">No publishes in the free window.</div>';
    return `${back}<div class="head"><div><h1>&gt; ${esc(t.name)}</h1><div class="sub">${esc(t.market)} \u00b7 fixed stocks ${esc(t.tickers.join(', '))} \u00b7 ${st.role === 'free' ? esc(Cal.FREE_LABEL) : 'All publishes'} \u00b7 ${SAMPLE}</div></div></div>` +
      `${body}${lock}<p class="note">${DESC}</p>`;
  }
  const api = { visible, viewThemes, viewTheme, DESC };
  if (isNode) module.exports = api; else root.PulseHistory = api;
})(typeof window !== 'undefined' ? window : globalThis);
