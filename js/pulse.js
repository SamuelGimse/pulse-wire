/** @fileoverview PULSE//WIRE UI (A6, design-app.md v2). Hash routes: #/feed, #/cluster/<id>, #/track, #/ticker/<t>, #/themes, #/theme/<id>, #/summary, #/archive[/<publish_id>], #/movers[/<tab>[/<n>]], #/more, #/map[/<country>],
 *  #/watchlist, #/account. Tier via ?tier=free|pro (DEMO switch only; the real split is server-side RLS, A4:
 *  the free role never receives today's rows). Offline: sample data, no network. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const I = isNode ? require('./impact.js') : root.ClustrImpact;
  const Cal = isNode ? require('./pulse-cal.js') : root.PulseCal;
  const Calc = isNode ? require('./calc.js') : root.ClustrCalc;
  const MX = isNode ? require('./movers-explain.js') : root.MoversExplain;   // A8
  const EX = isNode ? require('./pulse-extras.js') : root.PulseExtras;        // A10 salmon + A11 shorts (SAMPLE)
  const TH = isNode ? require('./pulse-themes.js') : root.PulseThemes;       // P0.7 A15.10 theme picker (#/more)
  const PMAP = isNode ? require('./pulse-map.js') : root.PulseMap;           // P0.8 A15.8 event map (#/map)
  const PM = isNode ? require('./pulse-movers.js') : root.PulseMovers;       // P0.6 A15.7 movers tabs (design-pg7 v2)
  const AR = isNode ? require('./pulse-archive.js') : root.PulseArchive;     // P0.5 A15.5 archive (SAMPLE)
  const SU = isNode ? require('./summary.js') : root.PulseSummary;           // P0.4 A16.4 Daily summary (SAMPLE)
  const PH = isNode ? require('./pulse-history.js') : root.PulseHistory;      // P0.2 A14.5 theme history (SAMPLE)
  const CL = isNode ? require('./pulse-clusters.js') : root.PulseClusters;      // t344s1271 eventline cards + t345u stance history
  const Ti = isNode ? require('./tiers.js') : root.PulseTiers;                // A13 tier + "N stories → 1 event" 
  /** A10/A11 context cards for a set of tickers; every card carries its source credit + link. */
  function extrasHtml(tickers) {
    if (!EX) return '';
    const set = new Set(tickers), out = [];
    if (tickers.some(t => EX.salmon.seafood.includes(t))) { const c = EX.salmon.card;
      out.push(`<div class="xcard"><h2>// ${esc(c.title)}</h2><p class="mono">${esc(c.price)} \u00b7 w/w ${esc(c.price_wow)} \u00b7 volume ${esc(c.volume)} (w/w ${esc(c.volume_wow)})</p><p class="note">${credit(c.credit)} \u00b7 ${esc(c.published)} \u00b7 sample data</p></div>`); }
    const sh = EX.shorts.filter(x => set.has(x.ticker));
    if (sh.length) out.push(`<div class="xcard"><h2>// Short positions</h2>${sh.map(x => `<p><span class="mono">${esc(x.ticker)}</span> ${esc(x.text)}</p>`).join('')}<p class="note">Only positions \u2265 0.5% are published, so totals understate short interest. ${credit(sh[0].credit)} \u00b7 sample data</p></div>`);
    return out.join('');
  }
  // PA5/PA6: one credit line for every external dataset: source link, licence link, and the "changes made" note.
  const credit = c => `<a href="${esc(c.href)}">${esc(c.text)}</a>` + (c.licence ? ` \u00b7 <a href="${esc(c.licence.href)}">${esc(c.licence.text)}</a>` : '') + (c.changes ? ` \u00b7 ${esc(c.changes)}` : '');
  /** P0.3 A15.3: "Read \u2192" opens the original article in a new tab; https only (no javascript:/data:/http), else no link. */
  const readLink = u => typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/.test(u) ? `<a class="read" href="${esc(u)}" target="_blank" rel="noopener noreferrer">Read \u2192</a>` : '';
  const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---- pure logic (tested in tests/pulse.test.js) ----
  /** Mirrors the RLS rule (t262u): free = the previous trading day only (prior close < ts <= prev close), per the item's market. */
  function forRole(clusters, role, now) {
    if (role === 'pro') return clusters.slice();
    return clusters.filter(c => Cal.inFreeWindow(c.market, c.published_at, now));
  }
  function sortClusters(list, mode) {
    const a = list.slice();
    if (mode === 'newest') return a.sort((x, y) => new Date(y.published_at) - new Date(x.published_at));
    if (mode === 'coverage') return a.sort((x, y) => y.sources - x.sources || Math.abs(y.s) - Math.abs(x.s));
    return a.sort((x, y) => Math.abs(y.s) - Math.abs(x.s) || new Date(y.published_at) - new Date(x.published_at));
  }
  function wilson(k, n, z) {
    z = z || 1.96; if (!n) return [0, 0];
    const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
    return [(c - m) / d, (c + m) / d];
  }
  const BUCKETS = [[2, 3], [4, 5], [6, 7], [8, 10]];
  function trackStats(track) {
    const ev = track.filter(t => Math.abs(t.s) >= 2), hits = ev.filter(t => t.hit).length;
    return { n: ev.length, hits, misses: ev.length - hits, rate: ev.length ? hits / ev.length : null, ci: wilson(hits, ev.length),
      buckets: BUCKETS.map(([lo, hi]) => { const b = ev.filter(t => Math.abs(t.s) >= lo && Math.abs(t.s) <= hi), h = b.filter(t => t.hit).length;
        const moves = b.map(t => Math.abs(t.move)).sort((x, y) => x - y), k = moves.length >> 1;   // P3: even count = mean of the 2 middle values
        return { lo, hi, n: b.length, hits: h, misses: b.length - h, medianAbsMove: !moves.length ? null : moves.length % 2 ? moves[k] : (moves[k - 1] + moves[k]) / 2 }; }) };
  }
  const fmtMinus = s => String(s).replace(/^-/, '\u2212');
  const pct = v => (v == null ? 'n/a' : (v > 0 ? '+' : v < 0 ? '\u2212' : '') + Math.abs(v).toFixed(2) + '%');

  // ---- views ----
  // N1 (sir-nitpickalot r2): the free/Pro split here is client-side on sample data, so it is NOT a paywall; the real one is backend RLS.
  // cz29: the banner says what the page shows: sample data (Pages default package, or no live publish yet) vs live store data.
  const PREVIEW_SAMPLE = 'Preview: sample data. Paywall not enforced.', PREVIEW_SAMPLE_PAID = 'Preview: sample data. Showing paid tier. Paywall not enforced.', PREVIEW_LIVE = 'Preview: paywall not enforced. Feed from our latest run; sentiment history from stored data.';
  const proLabel = st => (st.live === true ? 'PRO \u00b7 LIVE' : 'PRO \u00b7 SAMPLE');   // cz34: LIVE only with live store data
  const previewText = st => (st.live === true ? PREVIEW_LIVE : st.paidDefault && st.role === 'pro' ? PREVIEW_SAMPLE_PAID : PREVIEW_SAMPLE);
  /** t312u: default tier from the package config (window.PULSE_PACKAGE.defaultTier, Pages = 'pro'); an explicit ?tier= wins; else free. */
  const defaultRole = (tierParam, pkg) => (tierParam === 'pro' || tierParam === 'free' ? tierParam : pkg && pkg.defaultTier === 'pro' ? 'pro' : 'free');
  const DISC = 'Scores describe the expected size of a news story\u2019s market effect, from \u221210 to +10 on an exponential scale (each step \u2248 \u00d71.41, every 2 steps \u00d72). Calibration pending: the scale is not yet fitted to measured moves. Not investment advice. Past results do not predict future moves.';
  // t338: the footer names the source of what THIS view shows (feed vs history vs sample-only views)
  const srcNote = (view, st) => (['themes', 'theme', 'archive'].includes(view) ? (PH_DATA() && PH_DATA().sample === false ? 'Themes and archive: stored publishes.' : 'Sample data.')
    : view === 'movers' ? 'Sample movers (no live quotes yet).' : ['feed', 'cluster', 'ticker', 'map', undefined, ''].includes(view) ? (st.live === true ? 'Feed: our latest run.' : 'Sample data.') : 'Sample data.');
  const PH_DATA = () => (isNode ? require('./pulse-history-data.js') : root.PulseHistoryData);
  const CAL = '<span class="cal">\u25C6 Calibration pending</span>';
  const timeOf = iso => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo' });
  const dateOf = iso => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Europe/Oslo' });

  // t305u + cz19: mentioned = scored tickers, then unscored mentioned stocks; a card with neither says so (no empty labelled group).
  function tickHtml(c) {
    const have = new Set(c.tickers.map(t => t.ticker)), extra = ((c.links || {}).mentioned || []).filter(t => !have.has(t));
    const chips = c.tickers.map(t => I.chipHtml(t.ticker, t.s)).concat(extra.map(t => I.chipHtml(t, null))).join('');
    return chips ? `<div class="tick" aria-label="Mentioned stocks">${chips}</div>` : '<div class="tick"><span class="sub">No mentioned stock</span></div>';
  }
  function card(c) {
    return `<article class="card ${I.tone(c.s)}" data-score="${c.s}" data-date="${dateOf(c.published_at)}">${I.badgeHtml(c.s)}` +
      `<div><h3><a href="#/cluster/${esc(c.id)}">${esc(c.title)}</a></h3><p>${esc(c.summary)}</p>` +
      `<div class="meta"><span>${esc(Ti.tierLabel(c.s))}${c.n_entries > 1 ? ' \u00b7 ' + esc(Ti.countText(c.n_entries)) : ''} \u00b7 ${c.sources} sources \u00b7 ${esc(c.sector)} \u00b7 ${c.market} \u00b7 ${timeOf(c.published_at)} Oslo</span></div>` +
      `${PM.linksHtml(c, true)}</div>` + tickHtml(c) + '</article>';
  }
  function paywall(n) {
    return `<section class="wall" aria-labelledby="wall-h"><h3 id="wall-h">Today\u2019s ${n} clusters are locked</h3>` +
      `<p>Free shows the previous trading day\u2019s clusters only. Pro shows today and all history as they are scored.</p>` +
      `<ul><li>Live clusters and impact scores, NO + US</li><li>Per-ticker impact, evidence and sources</li><li>Same public track record, misses included</li></ul>` +
      `<div class="btnrow"><a class="btn primary" href="#/account">Upgrade to Pro \u00b7 99 kr/month</a><a class="btn sec" href="#/track">See track record first</a></div></section>` +
      `<div class="locked" aria-hidden="true"><span>\u25A3 \u00b1?</span><div>today<div class="bar"></div><div class="bar" style="width:60%"></div></div></div>` +
      `<div class="locked" aria-hidden="true"><span>\u25A3 \u00b1?</span><div>today<div class="bar"></div><div class="bar" style="width:45%"></div></div></div>`;
  }
  function rail(st) {
    const scale = [2, 4, 6, 8, 10].map(s => `<tr><td>${s}</td><td class="r">\u00d7${Math.pow(2, s / 2).toFixed(1)}</td></tr>`).join('');
    const wl = (st.watch || []).map(t => { const hit = st.visible.flatMap(c => c.tickers).find(x => x.ticker === t); return I.chipHtml(t, hit ? hit.s : null); }).join('');
    return `<h2>// Scale</h2><table><thead><tr><th>|score|</th><th class="r">Relative size</th></tr></thead><tbody>${scale}</tbody></table>` +
      `<p class="sub" style="margin-top:8px">\u25C6 Calibration pending: relative sizes only, no % yet.</p>` +
      `<h2>// Watchlist</h2><div class="list rail-list">${wl || '<span class="sub">No tickers yet.</span>'}</div>` +
      (st.movers ? PM.railHtml(st) : '') +   // P0.6: replaces the A8 panel (design-pg7 v2 §3)
      `<h2>// How to read</h2><p class="sub">Sign + arrow + word give the direction; the meter grows \u00d72 every 2 steps. Hits and misses are on the track record.</p>`;
  }
  function viewFeed(st) {
    const list = sortClusters(st.visible, st.sort);
    const lockedN = st.role === 'free' ? st.all.length - st.visible.length : 0;
    const head = `<div class="head"><div><h1>Today’s clusters</h1><div class="sub">${st.role === 'free' ? 'Free \u00b7 previous trading day only' : st.live === true ? 'Live market feed' : 'Sample feed'} \u00b7 sorted by ${st.sort === 'impact' ? 'impact' : st.sort} \u00b7 ${list.length} shown</div></div><span class="sp"></span>` +
      `<div class="seg" role="group" aria-label="Sort">${['impact', 'newest', 'coverage'].map(m => `<button type="button" data-sort="${m}" aria-pressed="${st.sort === m}">${m}</button>`).join('')}</div></div>`;
    const cards = CL.cardsHtml(list, Object.assign({ themes: PH_DATA().themes, markets: root.PULSE_MARKETS, clusterMap: (root.PULSE_PACKAGE || {}).clusterMap }, st));
    const body = (list.length ? '' : `<div class="empty">No clusters from the previous trading day.</div>`) + cards;
    return PM.viewSeg('feed') + head + `<div class="list">${lockedN ? paywall(lockedN) : ''}${body}</div>`;
  }
  function viewCluster(st, id) {
    const c = st.visible.find(x => x.id === id);
    if (!c) return `<a class="back" href="#/feed">\u2190 Clusters</a><h1>&gt; Not available</h1><p class="note">This cluster is not in your tier\u2019s data (free: the previous trading day only).</p>${st.role === 'free' ? paywall(1) : ''}`;
    const rows = c.tickers.map(t => { const mv = Calc.pctChange(Calc.publishPrice(t), t.live);
      return `<tr><td class="tcol">${I.chipHtml(t.ticker, null)}</td><td class="r">${I.arrow(I.clamp(t.s))} ${fmtMinus(I.signText(I.clamp(t.s)))}</td><td>${esc(t.evidence)}</td><td>${esc(t.novelty)}</td><td class="r ${mv > 0 ? 'dpos' : mv < 0 ? 'dneg' : 'dneu'}">${mv == null ? 'n/a' : (mv > 0 ? '\u25B2 ' : mv < 0 ? '\u25BC ' : '\u25CF ') + pct(mv)}</td></tr>`; }).join('');
    const srcs = (c.sourcesList || []).map(s => `<div>${esc(s.title)}<small>${esc(s.outlet)} \u00b7 ${esc(s.at)}${s.primary ? ' \u00b7 PRIMARY' : ''}</small>${readLink(s.url)}</div>`).join('') || `<p class="sub">${c.sources} sources (list not in sample).</p>`;
    return `<a class="back" href="#/feed">\u2190 Clusters</a><div class="head"><div><h1>&gt; Cluster</h1><div class="sub">${dateOf(c.published_at)} ${timeOf(c.published_at)} Oslo \u00b7 ${c.market} \u00b7 ${esc(c.sector)}</div></div></div>` +
      `<div class="list"><article class="card hero ${I.tone(c.s)}">${I.badgeHtml(c.s)}<div><h3>${esc(c.title)}</h3><p>${esc(c.summary)}</p></div></article></div>` +
      `<div class="det-grid"><div><h2>// Linked tickers</h2><div class="tw"><table><thead><tr><th>Ticker</th><th class="r">Impact</th><th>Evidence</th><th>Novelty</th><th class="r">Move since publish</th></tr></thead><tbody>${rows}</tbody></table></div>` +
      `<p class="note">Move since publish uses the price stamped at publish (CF1/CF2-safe, js/calc.js); n/a when missing.</p>${PM.linksHtml(c)}${extrasHtml(c.tickers.map(t => t.ticker))}</div>` +
      `<div><h2>// Sources</h2><div class="src">${srcs}</div><h2>// Score record</h2><dl class="kv"><dt>Model</dt><dd>${esc(c.model_id)}</dd><dt>Rubric</dt><dd>${esc(c.rubric_version)}</dd><dt>Mapping</dt><dd>${esc(c.mapping_version)}</dd><dt>Scored at</dt><dd><time datetime="${esc(c.scored_at || c.published_at)}" title="${esc(c.scored_at || c.published_at)}">${dateOf(c.scored_at || c.published_at)} ${timeOf(c.scored_at || c.published_at)} Oslo</time></dd><dt>Calibration</dt><dd>${CAL}</dd></dl></div></div>`;
  }
  function viewTrack(st) {
    const t = trackStats(st.track), f = st.filter;   // BC23: n === 0 -> rate and CI show n/a (not 0%)
    const rows = st.track.filter(x => Math.abs(x.s) >= 2).filter(x => f === 'hits' ? x.hit : f === 'misses' ? !x.hit : true)
      .map(x => `<tr><td>${x.date}</td><td>${esc(x.title)}</td><td>${I.chipHtml(x.ticker, x.s)}</td><td class="r">${fmtMinus(I.signText(x.s))}</td><td class="r ${x.move > 0 ? 'dpos' : 'dneg'}">${x.move > 0 ? '\u25B2' : '\u25BC'} ${pct(x.move)}</td><td>${x.hit ? '<span class="hit">\u2713 HIT</span>' : '<span class="miss">\u2715 MISS</span>'}</td></tr>`).join('');
    const bk = t.buckets.map(b => `<tr><td>${b.lo}\u2013${b.hi}</td><td class="r">${b.n}</td><td class="r hit">${b.hits}</td><td class="r miss">${b.misses}</td><td class="r">${b.medianAbsMove == null ? 'n/a' : b.medianAbsMove.toFixed(1) + '%'}</td></tr>`).join('');
    return `<div class="head"><div><h1>&gt; Track record</h1><div class="sub">Same page for Free and Pro \u00b7 1-day move after publish \u00b7 |score| \u2265 2 \u00b7 SAMPLE numbers until B1/B2</div></div></div>` +
      `<div class="stat"><div><b>${t.n}</b><span>Events</span></div><div><b>${t.hits}</b><span>Hits</span></div><div><b>${t.misses}</b><span>Misses</span></div><div><b>${t.n ? Math.round(100 * t.rate) + '%' : 'n/a'}</b><span>Hit rate \u00b7 95% CI ${t.n ? Math.round(100 * t.ci[0]) + '\u2013' + Math.round(100 * t.ci[1]) + '%' : 'n/a'}</span></div></div>` +
      `<h2>// By |score| bucket</h2><div class="tw"><table><thead><tr><th>|score|</th><th class="r">N</th><th class="r">Hits</th><th class="r">Misses</th><th class="r">Median |move|</th></tr></thead><tbody>${bk}</tbody></table></div>` +
      `<h2>// Events</h2><div class="filter"><div class="seg" role="group" aria-label="Filter">${['all', 'hits', 'misses'].map(m => `<button type="button" data-filter="${m}" aria-pressed="${f === m}">${m}</button>`).join('')}</div></div>` +
      `<div class="tw"><table><thead><tr><th>Date</th><th>Cluster</th><th>Ticker</th><th class="r">Score</th><th class="r">1d move</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function viewTicker(st, tk) {
    const list = sortClusters(st.visible.filter(c => c.tickers.some(t => t.ticker === tk)), 'impact');
    return `<a class="back" href="#/feed">\u2190 Clusters</a><div class="head"><div><h1>&gt; ${esc(tk)}</h1><div class="sub">Clusters touching this ticker \u00b7 ${list.length}</div></div></div>` +
      `${extrasHtml([tk])}<div class="list">${list.map(card).join('') || '<div class="empty">No clusters for this ticker in your tier\u2019s data.</div>'}</div>`;
  }
  const viewWatch = st => `<div class="head"><div><h1>&gt; Watchlist</h1><div class="sub">Tickers you follow (local sample)</div></div></div><div class="list rail-list">${st.watch.map(t => I.chipHtml(t, null)).join('')}</div>`;
  const viewAccount = st => `<div class="head"><div><h1>&gt; Account</h1><div class="sub">Plan: ${st.role === 'pro' ? proLabel(st) : 'FREE \u00b7 PREVIOUS TRADING DAY'}</div></div></div>` +
    (st.role === 'free' ? `<section class="wall" aria-labelledby="acc-h"><h3 id="acc-h">Pro \u00b7 99 kr/month</h3><p>Live clusters as they are scored. Cancel any time. Payments are not wired in this build.</p><a class="btn primary" href="#/account" aria-disabled="true">Upgrade to Pro \u00b7 99 kr/month</a></section>` : '<p class="sub">You have Pro.</p>');

  function render(st) {
    const [, view, arg, arg2] = (st.hash || '#/feed').split('/');
    const main = view === 'cluster' ? viewCluster(st, decodeURIComponent(arg || '')) : view === 'track' ? viewTrack(st)
      : view === 'more' ? TH.viewMore(st) : view === 'map' ? PMAP.viewMap(st, decodeURIComponent(arg || ''))
      : view === 'movers' ? PM.viewMovers(st, arg, arg2) : view === 'archive' ? AR.viewArchive(st, decodeURIComponent(arg || '')) : view === 'summary' ? SU.viewSummary(st) : view === 'themes' ? PH.viewThemes(st) : view === 'theme' ? PH.viewTheme(st, decodeURIComponent(arg || ''))
      : view === 'ticker' ? viewTicker(st, decodeURIComponent(arg || '')) : view === 'watchlist' ? viewWatch(st) : view === 'account' ? viewAccount(st) : viewFeed(st);
    const cur = view === 'track' ? 'track' : view === 'themes' || view === 'theme' ? 'themes' : view === 'summary' ? 'summary' : view === 'archive' ? 'archive' : view === 'movers' ? 'movers' : view === 'map' ? 'map' : view === 'more' || view === 'account' ? 'more' : view === 'watchlist' ? 'watchlist' : view === 'account' ? 'account' : 'feed';
    const nav = [['feed', 'Clusters', 'Clusters'], ['movers', 'Movers', 'Movers'], ['summary', 'Daily summary', 'Brief'], ['map', 'World map', 'Map'], ['archive', 'Days', 'Days'], ['track', 'Track record', 'Track'], ['watchlist', 'Watchlist', 'Watch'], ['more', 'More', 'More']];
    const phone = nav.filter(([k]) => ['feed', 'track', 'watchlist', 'more'].includes(k));   // design-pg10 §5: 4 phone tabs
    const q = st.role === 'pro' ? '?tier=pro' : '?tier=free';
    return `<a class="skip" href="#main">Skip to content</a><div class="frame">` +
      `<header class="top"><span class="brand">PULSE<b>//</b>WIRE</span><span class="ctx">news impact \u00b7 ${esc((root.PULSE_MARKETS || ['NO', 'US']).join(' + '))}</span><span class="sp"></span>${CAL}` +
      `<span class="tier ${st.role === 'pro' ? 'paid' : 'free'}">${st.role === 'pro' ? proLabel(st) : 'FREE \u00b7 PREVIOUS TRADING DAY'}</span>` +
      (st.role === 'free' ? `<a class="btn sec" href="#/account">Upgrade \u00b7 99 kr/month</a>` : '') + `</header>` +
      `<nav class="side" aria-label="Primary"><div class="grp">// VIEWS</div>${nav.map(([k, n]) => `<a href="${q}#/${k}"${k === cur ? ' aria-current="page"' : ''}>${n}</a>`).join('')}<a class="theme-link" href="${q}#/more">\u25D0 Theme: ${TH.nameOf(st.theme || TH.DEFAULT)}</a></nav>` +
      `<main id="main" tabindex="-1"><p class="preview-note" role="note">${previewText(st)}</p><p class="calm">${CAL}</p>${main}<p class="disc">${DISC} ${srcNote(view, st)}</p></main>` +
      `<aside class="rail" aria-label="Context">${rail(st)}</aside></div>` +
      `<nav class="tabbar" aria-label="Primary (phone)">${phone.map(([k, , s]) => `<a href="${q}#/${k}"${k === cur ? ' aria-current="page"' : ''}>${s}</a>`).join('')}</nav>`;
  }

  // t318u: the Pages package (PULSE_PACKAGE.remote) loads the live feed from Supabase first; failure/empty -> sample, labelled.
  function boot() {
    const pkg = root.PULSE_PACKAGE, R = root.PulseRemote;
    if (pkg && pkg.remote && R) return R.apply(root.PulseData).then(start, start);
    start();
  }
  function start() {
    const qs = new URLSearchParams(location.search), D = root.PulseData;
    const role = defaultRole(qs.get('tier'), root.PULSE_PACKAGE), paidDefault = !!(root.PULSE_PACKAGE && root.PULSE_PACKAGE.defaultTier === 'pro');
    const now = new Date(qs.get('now') || D.demoNow);
    const st = { role, now, live: D.live === true, paidDefault, all: D.clusters, visible: forRole(D.clusters, role, now), track: D.track, movers: D.movers, history: D.remoteHistory || [], sort: 'impact', filter: 'all',
      watch: ['EQNR.OL', 'NVDA', 'TSLA', 'DNB.OL'].filter(s => !root.PULSE_MARKETS || root.PULSE_MARKETS.includes(root.PulseSource.marketOf(s))), hash: location.hash, theme: TH.read(root.localStorage) };
    const app = document.getElementById('app');
    const draw = () => { st.hash = location.hash || '#/feed'; app.innerHTML = render(st); if (/^#\/map(\/|$)/.test(st.hash)) PMAP.mount(document, st); };   // P0.8: map loads only on its view
    CL.wire(app);
    TH.wire(document, root.localStorage, () => { st.theme = TH.read(root.localStorage); draw(); });
    app.addEventListener('click', e => {
      const b = e.target.closest('button[data-sort],button[data-filter]'); if (!b) return;
      if (b.dataset.sort) st.sort = b.dataset.sort; else st.filter = b.dataset.filter;
      draw(); const again = app.querySelector(`button[data-${b.dataset.sort ? 'sort' : 'filter'}="${b.dataset.sort || b.dataset.filter}"]`); if (again) again.focus();
    });
    window.addEventListener('hashchange', () => { draw(); window.scrollTo(0, 0); });
    draw();
  }
  const api = { forRole, sortClusters, wilson, trackStats, render, extrasHtml, defaultRole, PREVIEW_SAMPLE, PREVIEW_SAMPLE_PAID, PREVIEW_LIVE };
  if (isNode) module.exports = api; else { root.Pulse = api; document.addEventListener('DOMContentLoaded', boot); }
})(typeof window !== 'undefined' ? window : globalThis);
