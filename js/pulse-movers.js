/** @fileoverview P0.6 / A15.7 movers with Active / Winners / Losers tabs (design-pg7.md v2, user t253). Route #/movers[/<tab>[/<n>]].
 *  Membership from the SIGN of the displayed move only (CF8; not calc.js moverSide, which prefers `side`): Winners > 0, Losers < 0,
 *  0.0% only in Active. "Winners"/"Losers" appear ONLY as the two tab labels (DA9 exception). Story context from A8 (movers-explain),
 *  never a cause or forecast. Free: a story outside the free window shows a lock row with no headline/tier/theme/id (DA7). */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const MX = isNode ? require('./movers-explain.js') : root.MoversExplain;
  const Ti = isNode ? require('./tiers.js') : root.PulseTiers;
  const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TABS = [['active', 'Active'], ['winners', 'Winners'], ['losers', 'Losers']], CAP = 10;
  const NOTE = 'Context, not cause: a story shown here was published in our feed during the move\u2019s window. It does not explain why the price moved. Moves are session change vs the previous close. Not investment advice.';
  // P30: round once to the shown 0.1 (half away from zero) so tab, sign and label agree; + 0 turns -0 into 0
  const pctOf = m => { if (m.changePercent == null || m.changePercent === '') return null; const v = Number(m.changePercent); return Math.sign(v) * Math.round(Math.abs(v) * 10) / 10 + 0; };
  const signOf = m => { const p = pctOf(m); return p == null || !Number.isFinite(p) ? null : p > 0 ? 'up' : p < 0 ? 'down' : 'flat'; };
  /** PG7-3/PG7-4: tab membership + order. Null quotes are in no tab. */
  function tabRows(movers, tab) {
    const q = (movers || []).filter(m => signOf(m)), byAbs = (a, b) => Math.abs(pctOf(b)) - Math.abs(pctOf(a)) || String(a.symbol).localeCompare(String(b.symbol));
    if (tab === 'winners') return q.filter(m => pctOf(m) > 0).sort((a, b) => pctOf(b) - pctOf(a) || String(a.symbol).localeCompare(String(b.symbol)));
    if (tab === 'losers') return q.filter(m => pctOf(m) < 0).sort((a, b) => pctOf(a) - pctOf(b) || String(a.symbol).localeCompare(String(b.symbol)));
    return q.sort(byAbs);
  }
  function moveHtml(m) {
    const p = pctOf(m), s = signOf(m), [ar, sg, w] = s === 'up' ? ['\u25B2', '+', 'UP'] : s === 'down' ? ['\u25BC', '\u2212', 'DOWN'] : ['\u25CF', '\u00b1', 'FLAT'];
    return `<span class="mv-move" aria-label="${w.toLowerCase()} ${s === 'down' ? 'minus ' : s === 'up' ? 'plus ' : ''}${Math.abs(p).toFixed(1)} percent">${ar} ${sg}${Math.abs(p).toFixed(1)}%<small>${w}</small></span>`;
  }
  const ago = (iso, now) => { const h = Math.max(0, Math.round((+now - Date.parse(iso)) / 36e5)); return h < 1 ? 'less than 1 h ago' : `${h} h ago`; };
  const oslo = iso => new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/Oslo' }) + ' Oslo';
  function storyHtml(m, st) {
    const [e] = MX.explain([m], st.all || []), c = e.story && (st.all || []).find(x => x.id === e.story.id);
    if (!c) return `<span class="nostory">No story in our feed for this window</span>`;
    if (!(st.visible || []).some(x => x.id === c.id)) return `<a class="lockrow" href="#/account">\u25A3 Story in today\u2019s feed \u00b7 Pro</a>`;   // shortcut: any non-visible story uses this wording
    const t = Ti.tier(c.s), tl = t === Ti.NONE ? 'UNSCORED' : t.toUpperCase();
    return `<div class="wiim"><a href="#/cluster/${esc(c.id)}">${esc(c.title)}</a><div class="meta sub"><span class="tb">\u25AE ${tl}</span> ${esc(c.sector || '')} \u00b7 in our feed <time datetime="${esc(c.published_at)}" title="${esc(oslo(c.published_at))}">${ago(c.published_at, st.now)}</time></div>${linksHtml(c)}</div>`;
  }
  // t305u linked stocks: Mentioned (our ticker DB matches) + Default (theme basket). Tickers only; DA9: no advice words.
  // skipMentioned: the feed card already shows mentioned stocks as chips (pulse.js tickHtml).
  let lkN = 0;
  function linksHtml(c, skipMentioned) {
    const L = c.links || {}, mentioned = skipMentioned ? [] : L.mentioned || [], def = L.default || [];
    if (!mentioned.length && !def.length) return '';
    const list = (lab, xs) => { const id = `lk${++lkN}`; return xs.length ? `<div class="lk"><span class="lk-l" id="${id}">${lab}</span><ul class="lk-t" aria-labelledby="${id}">${xs.map(t => `<li><a class="tk" href="#/ticker/${encodeURIComponent(t)}">${esc(t)}</a></li>`).join('')}</ul></div>` : ''; };
    return `<div class="links" role="group" aria-label="Linked stocks">${list('Mentioned', mentioned)}${list('Default', def)}<p class="sub">Context, not advice.</p></div>`;
  }
  const row = (m, st) => `<li class="mrow ${({ up: 'up', down: 'dn', flat: 'fl' })[signOf(m)]}"><a class="tk" href="#/ticker/${encodeURIComponent(m.symbol)}">${esc(m.symbol)}</a>${moveHtml(m)}${storyHtml(m, st)}</li>`;
  const EMPTY = { active: 'No moves yet for this session. Quotes update after the market opens.', winners: 'No tickers are up this session.', losers: 'No tickers are down this session.' };
  const SAMPLE_MOVERS = 'Sample movers (no live quotes yet)';
  const viewSeg = cur => `<nav class="viewseg" aria-label="Clusters or movers"><a href="#/feed"${cur === 'feed' ? ' aria-current="page"' : ''}>Clusters</a><a href="#/movers"${cur === 'movers' ? ' aria-current="page"' : ''}>Movers</a></nav>`;
  function viewMovers(st, tabArg, nArg) {
    const tab = TABS.some(([k]) => k === tabArg) ? tabArg : 'active', n = Math.max(CAP, Number(nArg) || CAP), rows = tabRows(st.movers, tab), noQ = (st.movers || []).filter(m => !signOf(m)).length;
    const tl = `<div class="tabs" role="tablist" aria-label="Movers">${TABS.map(([k, lab]) => `<button type="button" role="tab" id="tab-${k}" data-href="#/movers/${k}" aria-controls="panel-mv" aria-selected="${k === tab}" tabindex="${k === tab ? 0 : -1}">${lab}<span class="n">${tabRows(st.movers, k).length}</span></button>`).join('')}</div>`;
    const more = rows.length > n ? `<a class="btn sec more" href="#/movers/${tab}/${n + CAP}">Show 10 more (${rows.length - n} left)</a>` : '';
    const body = rows.length ? `<ul class="mv">${rows.slice(0, n).map(m => row(m, st)).join('')}</ul>${more}` : `<div class="empty">${EMPTY[tab]}</div>`;
    return `${viewSeg('movers')}<div class="mv-head"><div><h1>&gt; Movers</h1><div class="sub">Session move vs previous close \u00b7 NO + US \u00b7 sorted by size of move \u00b7 <span class="tag">${esc(SAMPLE_MOVERS)}</span></div></div></div>` +
      `${tl}<section id="panel-mv" role="tabpanel" aria-labelledby="tab-${tab}">${body}${noQ ? `<p class="note">${noQ} ticker${noQ === 1 ? '' : 's'} without a quote</p>` : ''}</section><p class="ctx-note">${NOTE}</p>`;
  }
  /** t338: no live quotes exist yet, so movers are always the sample, labelled as such (label, not hide). */
  /** Right-rail module (replaces A8 "Why is it moving?"): top 3 Active rows. */
  const railHtml = st => `<h2>// Movers</h2><p class="sub">${esc(SAMPLE_MOVERS)}</p><ul class="railmv">${tabRows(st.movers, 'active').slice(0, 3).map(m => `<li><a class="tk" href="#/ticker/${encodeURIComponent(m.symbol)}">${esc(m.symbol)}</a>${moveHtml(m)}</li>`).join('')}</ul><p class="sub"><a href="#/movers">All movers \u2192</a> \u00b7 Context, not cause.</p>`;
  /** Browser: real tabs (click, \u2190/\u2192, Home/End; automatic activation; selected tab kept in the route). */
  function wire(doc) {
    const go = b => { if (!b) return; root.location.hash = b.dataset.href; setTimeout(() => { const s = doc.querySelector('[role=tab][aria-selected=true]'); if (s) s.focus(); }, 0); };
    doc.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[role=tab][data-href]'); if (b) go(b); });
    doc.addEventListener('keydown', e => {
      const b = e.target.closest && e.target.closest('[role=tab][data-href]'); if (!b) return;
      const all = [...b.parentNode.querySelectorAll('[role=tab]')], i = all.indexOf(b);
      const j = e.key === 'ArrowRight' ? (i + 1) % all.length : e.key === 'ArrowLeft' ? (i - 1 + all.length) % all.length : e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : -1;
      if (j >= 0) { e.preventDefault(); go(all[j]); }
    });
  }
  const api = { SAMPLE_MOVERS, tabRows, signOf, viewMovers, railHtml, viewSeg, wire, NOTE, linksHtml };
  if (isNode) module.exports = api; else { root.PulseMovers = api; document.addEventListener('DOMContentLoaded', () => wire(document)); }
})(typeof window !== 'undefined' ? window : globalThis);
