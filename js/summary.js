/** @fileoverview A16.4 "Daily summary" card per market (#/summary). Reads PulseSummaryData (SAMPLE: fixtures + mock writer).
 *  Free lock as A14 (t269): free sees only the brief published on the previous trading day; today's 07:00 brief is Pro only.
 *  Links to the themes (#/theme/<id>) and movers (#/ticker/<T>) in the brief. No network, no render.js/api.js. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const Cal = isNode ? require('./pulse-cal.js') : root.PulseCal;
  const SD = () => (isNode ? require('./pulse-summary-data.js') : root.PulseSummaryData);
  const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NAME = { NO: 'Oslo Børs', US: 'US markets' }, SAMPLE = '<span class="tag">Sample data</span>';
  const pct = v => v == null ? 'n/a' : `${v > 0 ? '+' : v < 0 ? '\u2212' : ''}${Math.abs(v).toFixed(2)}%`;
  const visibleFor = (b, role, now) => role === 'pro' || Cal.inFreeWindow(b.market, b.published_at, now);
  function card(b) {
    const f = b.facts, th = f.themes.map(t => `<a href="#/theme/${esc(t.theme_id)}">${esc(t.name)}</a>`).join(' \u00b7 ');
    const mv = [...f.winners, ...f.losers].map(m => `<a href="#/ticker/${esc(m.symbol)}">${esc(m.symbol)} ${pct(m.pct)}</a> <small>${esc(m.why)}</small>`).join('<br>');
    return `<article class="card"><div><h3>Daily summary \u00b7 ${esc(NAME[b.market])}</h3><p class="sub">${esc(b.brief_date)} ${esc(SD().brief_time)} Oslo \u00b7 session ${esc(f.session)}${b.source === 'fallback' ? ' \u00b7 facts only' : ''} \u00b7 ${SAMPLE}</p>` +
      `<p>${esc(b.text)}</p><p class="sub">Themes: ${th || 'none'}</p><p class="sub">${mv || 'no movers'}</p><p class="note">${esc(b.disclaimer)}</p></div></article>`;
  }
  function viewSummary(st) {
    const all = SD().briefs, rows = [];
    for (const m of ['NO', 'US']) {
      const mine = all.filter(b => b.market === m).sort((a, b) => b.brief_date.localeCompare(a.brief_date));
      const vis = mine.filter(b => b.text && visibleFor(b, st.role, st.now)), locked = mine.filter(b => b.text && !visibleFor(b, st.role, st.now) && Date.parse(b.published_at) > +Cal.freeWindow(m, st.now).to);
      const quiet = mine.find(b => !b.text && (st.role === 'pro' || Cal.inFreeWindow(m, Cal.zonedToUtc(b.brief_date, SD().brief_time, 'Europe/Oslo'), st.now)));
      if (locked.length) rows.push(`<section class="wall"><h3>Today\u2019s ${esc(NAME[m])} brief is Pro</h3><p>${esc(Cal.FREE_LABEL)}: you see yesterday\u2019s morning brief.</p><a class="btn primary" href="#/account">Upgrade \u00b7 99 kr/month</a></section>`);
      rows.push(...vis.slice(0, st.role === 'pro' ? 2 : 1).map(card));
      if (!vis.length && quiet) rows.push(`<div class="empty">Daily summary \u00b7 ${esc(NAME[m])} ${esc(quiet.brief_date)}: no brief (${esc(quiet.reason)}).</div>`);
    }
    return `<div class="head"><div><h1>&gt; Daily summary</h1><div class="sub">Pre-open brief at ${esc(SD().brief_time)} Oslo \u00b7 ${st.role === 'free' ? esc(Cal.FREE_LABEL) : 'Today and yesterday'} \u00b7 ${SAMPLE}</div></div></div><div class="list">${rows.join('')}</div>`;
  }
  const api = { viewSummary, visibleFor };
  if (isNode) module.exports = api; else root.PulseSummary = api;
})(typeof window !== 'undefined' ? window : globalThis);
