/** @fileoverview P0.5 / A15.5 per-day archive: #/archive (newest you can see) and #/archive/<publish_id>, with older/newer
 *  arrows and a Days list. Reads PulseHistoryData.publishes (SAMPLE). Free: previous trading day only (t262u); other
 *  publishes are listed as locked with no content. No network, no render.js/api.js. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const Cal = isNode ? require('./pulse-cal.js') : root.PulseCal;
  const HD = () => (isNode ? require('./pulse-history-data.js') : root.PulseHistoryData);
  const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const day = iso => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Europe/Oslo' });
  const hm = iso => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo' });
  const PH = () => (isNode ? require('./pulse-history.js') : root.PulseHistory);   // t338: shared start date + source tag
  const open = (p, st) => st.role === 'pro' || Cal.inFreeWindow(p.market, p.publish_ts, st.now);
  function viewArchive(st, id) {
    const all = HD().publishes.slice().sort((a, b) => Date.parse(a.publish_ts) - Date.parse(b.publish_ts));
    if (!all.length) return `<h1>&gt; Archive</h1><div class="empty">${PH().emptyText(HD())}</div>`;
    const seen = all.filter(p => open(p, st)), cur = all.find(p => p.publish_id === id) || seen[seen.length - 1] || all[all.length - 1];
    const i = all.indexOf(cur), older = all[i - 1], newer = all[i + 1];
    const arrow = (p, txt, rel) => p ? `<a class="btn sec" rel="${rel}" href="#/archive/${esc(p.publish_id)}">${txt}</a>` : `<span class="btn sec" aria-disabled="true">${txt}</span>`;
    const body = open(cur, st)
      ? `<div class="list">${cur.themes.map(t => `<a class="card" href="#/theme/${esc(t.theme_id)}"><div><h3>${esc(t.name)}</h3><p class="sub">${esc(t.tier)} \u00b7 ${esc(t.stance)} \u00b7 ${esc(t.flag)}</p></div></a>`).join('')}</div>`
      : `<section class="wall"><h3>This publish is Pro</h3><p>${esc(Cal.FREE_LABEL)}.</p><a class="btn primary" href="#/account">Upgrade \u00b7 99 kr/month</a></section>`;
    const days = [...new Set(all.map(p => day(p.publish_ts)))].reverse().map(d => {
      const ps = all.filter(p => day(p.publish_ts) === d);
      return `<li><b>${d}</b> ${ps.map(p => `<a href="#/archive/${esc(p.publish_id)}"${p === cur ? ' aria-current="page"' : ''}>${hm(p.publish_ts)}${open(p, st) ? '' : ' \u00b7 locked'}</a>`).join(' ')}</li>`; }).join('');
    return `<div class="head"><div><h1>&gt; Archive</h1><div class="sub">${esc(day(cur.publish_ts))} ${hm(cur.publish_ts)} Oslo \u00b7 ${esc(cur.market)} \u00b7 ${st.role === 'free' ? esc(Cal.FREE_LABEL) : 'All publishes'}${PH().tag(HD())}</div></div>` +
      `<nav class="seg" aria-label="Older and newer">${arrow(older, '\u2190 Older', 'prev')}${arrow(newer, 'Newer \u2192', 'next')}</nav></div>${body}<h2>// Days</h2><ul class="days">${days}</ul>`;
  }
  const api = { viewArchive };
  if (isNode) module.exports = api; else root.PulseArchive = api;
})(typeof window !== 'undefined' ? window : globalThis);
