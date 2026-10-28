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
  const fmtPrice = v => { const n = Calc.validPrice(v); return n == null ? 'n/a' : n.toFixed(2); };

  // ---- views ----
  // N1 (sir-nitpickalot r2): the free/Pro split here is client-side on sample data, so it is NOT a paywall; the real one is backend RLS.
  // cz29: the banner says what the page shows: sample data (Pages default package, or no live publish yet) vs live store data.
  const PREVIEW_SAMPLE = 'Sample preview. Sign in for the free live feed.', PREVIEW_SAMPLE_PAID = 'Sample preview.', PREVIEW_LIVE = 'Live feed from our latest run.';
  const proLabel = st => (st.live === true ? 'PRO \u00b7 LIVE' : 'PRO \u00b7 SAMPLE');   // cz34: LIVE only with live store data
  const previewText = st => (st.live === true ? PREVIEW_LIVE : st.user ? PREVIEW_SAMPLE_PAID : PREVIEW_SAMPLE);
  /** t312u: default tier from the package config (window.PULSE_PACKAGE.defaultTier, Pages = 'pro'); an explicit ?tier= wins; else free. */
  const defaultRole = auth => (auth && auth.role === 'pro' ? 'pro' : 'free');
  const DISC = 'Scores describe the expected size of a news story\u2019s market effect, from \u221210 to +10 on an exponential scale (each step \u2248 \u00d71.41, every 2 steps \u00d72). Calibration pending: the scale is not yet fitted to measured moves. Not investment advice. Past results do not predict future moves.';
  // t338: the footer names the source of what THIS view shows (feed vs history vs sample-only views)
  const srcNote = (view, st) => (['themes', 'theme', 'archive'].includes(view) ? (PH_DATA() && PH_DATA().sample === false ? 'Themes and archive: stored publishes.' : 'Sample data.')
    : view === 'movers' ? (st.marketMovers ? `Movers: stored ${st.marketMovers.provider} snapshot.` : 'Sample movers (no live quotes yet).') : ['feed', 'cluster', 'ticker', 'map', undefined, ''].includes(view) ? (st.live === true ? 'Feed: stored daily reports.' : 'Sample data.') : 'Sample data.');
  const PH_DATA = () => (isNode ? require('./pulse-history-data.js') : root.PulseHistoryData);
  const CAL = '<span class="cal">\u25C6 Calibration pending</span>';
  const timeOf = iso => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo' });
  const dateOf = iso => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Europe/Oslo' });

  // t305u + cz19: mentioned = scored tickers, then unscored mentioned stocks; a card with neither says so (no empty labelled group).
  function tickHtml(c) {
    const have = new Set(c.tickers.map(t => t.ticker)), extra = ((c.links || {}).mentioned || []).filter(t => !have.has(t));
    const chips = c.tickers.map(t => { const move = Calc.pctChange(Calc.publishPrice(t), t.live), tone = move > 0 ? 'dpos' : move < 0 ? 'dneg' : 'dneu'; return `<span class="tick-quote">${I.chipHtml(t.ticker, t.s)}<small class="${tone}">${pct(move)} since publish</small></span>`; }).concat(extra.map(t => I.chipHtml(t, null))).join('');
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
  function viewFeed(st, requestedDay) {
    const reports = Array.isArray(root.PulseData.dailyReports) ? root.PulseData.dailyReports : [];
    if (requestedDay) st.reportDay = requestedDay;
    const report = reports.find(x => x.date === st.reportDay) || reports[0];
    if (report) { st.reportDay = report.date; st.visible = forRole(report.clusters, st.role, st.now); st.all = report.clusters; }
    const list = sortClusters(st.visible, st.sort);
    const lockedN = st.role === 'free' ? st.all.length - st.visible.length : 0;
    const dayLabel = report ? report.date : 'Latest';
    const dayNav = reports.length ? `<div class="report-days"><button class="btn sec" type="button" data-report-step="older" ${reports.findIndex(x => x.date === dayLabel) >= reports.length - 1 ? 'disabled' : ''}>← Older</button>` +
      `<label class="sr" for="report-day">Report day</label><select id="report-day" data-report-day aria-label="Choose report day">${reports.map(x => `<option value="${esc(x.date)}" ${x.date === dayLabel ? 'selected' : ''}>${esc(x.date)} · ${x.clusters.length} clusters</option>`).join('')}</select>` +
      `<button class="btn sec" type="button" data-report-step="newer" ${reports.findIndex(x => x.date === dayLabel) <= 0 ? 'disabled' : ''}>Newer →</button></div>` : '';
    const head = `<div class="head"><div><h1>${report ? `Clusters · ${esc(dayLabel)}` : 'Today’s clusters'}</h1><div class="sub">${st.role === 'free' ? 'Free · previous trading day only' : st.live === true ? `Live report · ${esc(dayLabel)}` : 'Sample feed'} · sorted by ${st.sort === 'impact' ? 'impact' : st.sort} · ${list.length} shown</div></div><span class="sp"></span>` +
      `<div class="seg" role="group" aria-label="Sort">${['impact', 'newest', 'coverage'].map(m => `<button type="button" data-sort="${m}" aria-pressed="${st.sort === m}">${m}</button>`).join('')}</div></div>`;
    const cards = CL.cardsHtml(list, Object.assign({ themes: PH_DATA().themes, markets: root.PULSE_MARKETS, clusterMap: (root.PULSE_PACKAGE || {}).clusterMap }, st));
    const body = (list.length ? '' : `<div class="empty">No clusters for this report day.</div>`) + cards;
    return PM.viewSeg('feed') + stanceDefaultsChart(st) + dayNav + head + `<div class="list">${lockedN ? paywall(lockedN) : ''}${body}</div>`;
  }
  function viewCluster(st, id) {
    const c = st.visible.find(x => x.id === id);
    if (!c) return `<a class="back" href="#/feed">\u2190 Clusters</a><h1>&gt; Not available</h1><p class="note">This cluster is not in your tier\u2019s data (free: the previous trading day only).</p>${st.role === 'free' ? paywall(1) : ''}`;
    const rows = c.tickers.map(t => { const mv = Calc.pctChange(Calc.publishPrice(t), t.live);
      return `<tr><td class="tcol">${I.chipHtml(t.ticker, null)}</td><td class="r">${I.arrow(I.clamp(t.s))} ${fmtMinus(I.signText(I.clamp(t.s)))}</td><td>${esc(t.evidence)}</td><td>${esc(t.novelty)}</td><td class="r">${fmtPrice(Calc.publishPrice(t))}</td><td class="r">${fmtPrice(t.live && t.live.price)}</td><td class="r ${mv > 0 ? 'dpos' : mv < 0 ? 'dneg' : 'dneu'}">${mv == null ? 'n/a' : (mv > 0 ? '\u25B2 ' : mv < 0 ? '\u25BC ' : '\u25CF ') + pct(mv)}</td></tr>`; }).join('');
    const srcs = (c.sourcesList || []).map(s => `<div>${esc(s.title)}<small>${esc(s.outlet)} \u00b7 ${esc(s.at)}${s.primary ? ' \u00b7 PRIMARY' : ''}</small>${readLink(s.url)}</div>`).join('') || `<p class="sub">${c.sources} sources (list not in sample).</p>`;
    return `<a class="back" href="#/feed">\u2190 Clusters</a><div class="head"><div><h1>&gt; Cluster</h1><div class="sub">${dateOf(c.published_at)} ${timeOf(c.published_at)} Oslo \u00b7 ${c.market} \u00b7 ${esc(c.sector)}</div></div></div>` +
      `<div class="list"><article class="card hero ${I.tone(c.s)}">${I.badgeHtml(c.s)}<div><h3>${esc(c.title)}</h3><p>${esc(c.summary)}</p></div></article></div>` +
      `<div class="det-grid"><div><h2>// Linked tickers</h2><div class="tw"><table><thead><tr><th>Ticker</th><th class="r">Impact</th><th>Evidence</th><th>Novelty</th><th class="r">At publish</th><th class="r">Live</th><th class="r">Since publish</th></tr></thead><tbody>${rows}</tbody></table></div>` +
      `<p class="note">Move since publish uses the price stamped at publish (CF1/CF2-safe, js/calc.js); n/a when missing.</p>${PM.linksHtml(c)}${extrasHtml(c.tickers.map(t => t.ticker))}</div>` +
      `<div><h2>// Sources</h2><div class="src">${srcs}</div><h2>// Score record</h2><dl class="kv"><dt>Model</dt><dd>${esc(c.model_id)}</dd><dt>Rubric</dt><dd>${esc(c.rubric_version)}</dd><dt>Mapping</dt><dd>${esc(c.mapping_version)}</dd><dt>Scored at</dt><dd><time datetime="${esc(c.scored_at || c.published_at)}" title="${esc(c.scored_at || c.published_at)}">${dateOf(c.scored_at || c.published_at)} ${timeOf(c.scored_at || c.published_at)} Oslo</time></dd><dt>Calibration</dt><dd>${CAL}</dd></dl></div></div>`;
  }
  function stanceDefaultsChart(st) {
    const stanceValue = stance => ({ constructive: 1, bullish: 1, positive: 1, watch: 0, neutral: 0, cautious: -1, bearish: -1, negative: -1 })[String(stance || '').toLowerCase()] ?? null;
    const reports = (st.dailyReports || []).map(report => {
      const clusters = (report.clusters || []).filter(c => Array.isArray(c.defaultStocks) && c.defaultStocks.length);
      const stances = clusters.map(c => stanceValue(c.stance)).filter(v => v != null), returns = clusters.map(c => {
        const moves = c.defaultStocks.map(stock => Calc.pctChange(Calc.publishPrice(stock), stock.live)).filter(v => v != null);
        return moves.length ? { value: moves.reduce((a, b) => a + b, 0) / moves.length, n: moves.length } : null;
      }).filter(Boolean), t = Date.parse(report.updated_at || report.date);
      return { t, stance: stances.length ? stances.reduce((a, b) => a + b, 0) / stances.length : null,
        defaults: returns.length ? returns.reduce((a, b) => a + b.value, 0) / returns.length : null,
        n: returns.reduce((a, b) => a + b.n, 0), groups: returns.length };
    }).filter(p => Number.isFinite(p.t)).sort((a, b) => a.t - b.t);
    if (reports.length < 2) return '<section class="stance-defaults"><h2>// Stance × cluster defaults</h2><p class="empty">Two reports with priced default stocks are needed to draw this chart.</p></section>';
    const W = 820, H = 250, L = 48, R = 58, T = 30, B = 38, t0 = reports[0].t, span = Math.max(1, reports[reports.length - 1].t - t0),
      x = t => L + ((t - t0) / span) * (W - L - R), values = reports.map(p => p.defaults).filter(v => v != null);
    if (!values.length) return '<section class="stance-defaults"><h2>// Stance × cluster defaults</h2><p class="empty">No linked default-stock prices are available for these reports.</p></section>';
    let lo = Math.min(0, ...values), hi = Math.max(0, ...values); if (hi - lo < 1) { lo -= 0.5; hi += 0.5; } else { const pad = (hi - lo) * 0.12; lo -= pad; hi += pad; }
    const yStance = v => T + ((1 - v) / 2) * (H - T - B), yReturn = v => T + ((hi - v) / (hi - lo)) * (H - T - B);
    const line = (field, y) => { let d = '', active = false; for (const p of reports) { const v = p[field]; if (v == null) { active = false; continue; } d += `${active ? ' L' : ' M'}${x(p.t).toFixed(1)},${y(v).toFixed(1)}`; active = true; } return d; };
    const grid = Array.from({ length: 5 }, (_, i) => { const value = hi - (hi - lo) * i / 4, py = T + (H - T - B) * i / 4; return `<line class="sd-grid" x1="${L}" x2="${W - R}" y1="${py}" y2="${py}"/><text class="sd-axis" x="${W - R + 6}" y="${py + 4}">${value > 0 ? '+' : ''}${value.toFixed(1)}%</text>`; }).join('');
    const dots = reports.map(p => { const color = p.stance > 0 ? 'var(--cp-green)' : p.stance < 0 ? 'var(--cp-red)' : 'var(--cp-idle)', stanceLabel = p.stance === 1 ? 'Constructive' : p.stance === -1 ? 'Cautious' : p.stance === 0 ? 'Watch' : p.stance > 0 ? 'Mixed, leaning constructive' : 'Mixed, leaning cautious';
      const stanceDot = p.stance == null ? '' : `<circle cx="${x(p.t)}" cy="${yStance(p.stance)}" r="4" fill="${color}"><title>${esc(dateOf(p.t))}: stance ${stanceLabel}</title></circle>`;
      const returnDot = p.defaults == null ? '' : `<circle cx="${x(p.t)}" cy="${yReturn(p.defaults)}" r="3.5" fill="var(--cp-blue,#78a8ff)"><title>${esc(dateOf(p.t))}: defaults ${pct(p.defaults)} since publish; ${p.n} priced stocks across ${p.groups} clusters</title></circle>`;
      return stanceDot + returnDot; }).join('');
    const labels = [reports[0], reports[Math.floor((reports.length - 1) / 2)], reports[reports.length - 1]].map((p, i) => `<text class="sd-axis" text-anchor="${i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}" x="${x(p.t)}" y="${H - 10}">${esc(dateOf(p.t))}</text>`).join('');
    return `<section class="stance-defaults"><h2>// Stance × cluster defaults</h2><div class="sd-legend"><span><i class="sd-stance-key"></i>Stance</span><span><i class="sd-return-key"></i>Defaults · since publish / live %</span></div>` +
      `<figure><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Stance and linked cluster default stock return by report date">${grid}` +
      `<text class="sd-axis" text-anchor="end" x="${L - 8}" y="${yStance(1) + 4}">C+</text><text class="sd-axis" text-anchor="end" x="${L - 8}" y="${yStance(0) + 4}">Watch</text><text class="sd-axis" text-anchor="end" x="${L - 8}" y="${yStance(-1) + 4}">C−</text>` +
      `<path d="${line('stance', yStance)}" fill="none" stroke="var(--cp-line)" stroke-width="2"/><path d="${line('defaults', yReturn)}" fill="none" stroke="var(--cp-blue,#78a8ff)" stroke-width="2" stroke-dasharray="4 4"/>${dots}${labels}</svg>` +
      `<figcaption>Each point is a report date. Stance is averaged across clusters (C+ constructive, C− cautious); dashed line is the mean default-stock move since publish using the latest stored quotes. Descriptive only.</figcaption></figure></section>`;
  }
  function viewTrack(st) {
    const t = trackStats(st.track), f = st.filter;   // BC23: n === 0 -> rate and CI show n/a (not 0%)
    const rows = st.track.filter(x => Math.abs(x.s) >= 2).filter(x => f === 'hits' ? x.hit : f === 'misses' ? !x.hit : true)
      .map(x => `<tr><td>${x.date}</td><td>${esc(x.title)}</td><td>${I.chipHtml(x.ticker, x.s)}</td><td class="r">${fmtMinus(I.signText(x.s))}</td><td class="r ${x.move > 0 ? 'dpos' : 'dneg'}">${x.move > 0 ? '\u25B2' : '\u25BC'} ${pct(x.move)}</td><td>${x.hit ? '<span class="hit">\u2713 HIT</span>' : '<span class="miss">\u2715 MISS</span>'}</td></tr>`).join('');
    const bk = t.buckets.map(b => `<tr><td>${b.lo}\u2013${b.hi}</td><td class="r">${b.n}</td><td class="r hit">${b.hits}</td><td class="r miss">${b.misses}</td><td class="r">${b.medianAbsMove == null ? 'n/a' : b.medianAbsMove.toFixed(1) + '%'}</td></tr>`).join('');
    return `<div class="head"><div><h1>&gt; Track record</h1><div class="sub">Same page for Free and Pro \u00b7 1-day move after publish \u00b7 |score| \u2265 2 \u00b7 SAMPLE numbers until B1/B2</div></div></div>` + stanceDefaultsChart(st) +
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
  function viewAccount(st) {
    const message = st.authMessage ? `<p class="auth-message" role="status">${esc(st.authMessage)}</p>` : '';
    if (!st.user) return `<div class="head"><div><h1>&gt; Account</h1><div class="sub">Sign in or create your free account</div></div></div>` +
      `<section class="wall auth-panel"><h3>${st.authMode === 'signup' ? 'Create account' : 'Sign in'}</h3>${message}<form data-auth-form>` +
      `<label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" minlength="8" autocomplete="${st.authMode === 'signup' ? 'new-password' : 'current-password'}" required></label>` +
      `<button class="btn primary" type="submit">${st.authMode === 'signup' ? 'Create free account' : 'Sign in'}</button></form>` +
      `<div class="auth-actions"><button class="btn sec" type="button" data-auth-action="switch">${st.authMode === 'signup' ? 'Already have an account? Sign in' : 'Create a free account'}</button>` +
      `${st.authMode === 'signin' ? '<button class="btn sec" type="button" data-auth-action="reset">Reset password</button>' : ''}</div></section>`;
    if (st.recovery) return `<div class="head"><div><h1>&gt; Set a new password</h1><div class="sub">${esc(st.user.email || '')}</div></div></div>${message}` +
      `<section class="wall auth-panel"><form data-password-reset><label>New password<input name="password" type="password" minlength="8" autocomplete="new-password" required></label><button class="btn primary" type="submit">Update password</button></form></section>`;
    return `<div class="head"><div><h1>&gt; Account</h1><div class="sub">${esc(st.user.email || '')}</div></div></div>${message}` +
      (st.role === 'pro' ? `<section class="wall"><h3>Pro subscription active</h3><p>Full live feed and archive access. ${st.plan && st.plan.current_period_end ? `Current period ends ${esc(new Date(st.plan.current_period_end).toLocaleDateString())}.` : ''}</p><div class="btnrow"><button class="btn sec" type="button" data-auth-action="portal">Manage subscription</button><button class="btn sec" type="button" data-auth-action="logout">Sign out</button></div></section>` :
        `<section class="wall"><h3>Free plan</h3><p>Access the previous trading day’s live feed for free. Pro unlocks live clusters as they are scored and the full publish history.</p><p>Pro · 99 kr/month</p><div class="btnrow"><button class="btn primary" type="button" data-auth-action="checkout">Continue to secure checkout</button>${st.plan && st.plan.stripe_customer_id ? '<button class="btn sec" type="button" data-auth-action="portal">Manage billing</button>' : ''}<button class="btn sec" type="button" data-auth-action="logout">Sign out</button></div></section>`);
  }  function boot() {
    const pkg = root.PULSE_PACKAGE, R = root.PulseRemote, A = root.PulseAuth;
    const ready = A ? A.restore() : Promise.resolve({ session: null, user: null, role: 'free', plan: null });
    return ready.then(async auth => { if (pkg && pkg.remote && R && auth.session) await R.apply(root.PulseData, undefined, auth.session.access_token); start(auth); }).catch(() => start({ session: null, user: null, role: 'free', plan: null }));
  }

  function start(auth = {}) {
    const qs = new URLSearchParams(location.search), D = root.PulseData;
    const role = defaultRole(auth), paidDefault = false;
    const now = new Date(qs.get('now') || D.demoNow);
    const st = { role, user: auth.user || null, session: auth.session || null, plan: auth.plan || null, recovery: auth.recovery === true, authMode: 'signin', authMessage: qs.get('checkout') === 'success' ? 'Payment received. Pro access will appear after Stripe confirms your subscription.' : '', now, live: D.live === true, paidDefault, all: D.clusters, visible: forRole(D.clusters, role, now), track: D.track, dailyReports: D.dailyReports || [], movers: D.movers, marketMovers: D.marketMovers || null, history: D.remoteHistory || [], sort: 'impact', filter: 'all',
      watch: ['EQNR.OL', 'NVDA', 'TSLA', 'DNB.OL'].filter(s => !root.PULSE_MARKETS || root.PULSE_MARKETS.includes(root.PulseSource.marketOf(s))), hash: location.hash, theme: TH.read(root.localStorage) };
    const app = document.getElementById('app');
    const draw = () => { st.hash = location.hash || '#/feed'; app.innerHTML = render(st); if (/^#\/map(\/|$)/.test(st.hash)) PMAP.mount(document, st); };   // P0.8: map loads only on its view
    CL.wire(app);
    TH.wire(document, root.localStorage, () => { st.theme = TH.read(root.localStorage); draw(); });
    app.addEventListener('click', e => {
      const action = e.target.closest('[data-auth-action]');
      if (action) { const A = root.PulseAuth; if (action.dataset.authAction === 'switch') { st.authMode = st.authMode === 'signup' ? 'signin' : 'signup'; st.authMessage = ''; draw(); } if (action.dataset.authAction === 'logout') A.signOut().then(() => root.location.reload()).catch(err => { st.authMessage = err.message; draw(); }); if (action.dataset.authAction === 'reset') { const email = app.querySelector('[name="email"]')?.value || ''; if (!email) { st.authMessage = 'Enter your email first.'; draw(); return; } A.resetPassword(email).then(() => { st.authMessage = 'Password reset email sent. Check your inbox.'; draw(); }).catch(err => { st.authMessage = err.message; draw(); }); } if (action.dataset.authAction === 'checkout') A.checkout().catch(err => { st.authMessage = err.message; draw(); }); if (action.dataset.authAction === 'portal') A.portal().catch(err => { st.authMessage = err.message; draw(); }); return; }
      const step = e.target.closest('button[data-report-step]');
      if (step && !step.disabled) { const reports = root.PulseData.dailyReports || [], i = reports.findIndex(x => x.date === st.reportDay), next = reports[i + (step.dataset.reportStep === 'older' ? 1 : -1)]; if (next) location.hash = `#/feed/${next.date}`; return; }
      const b = e.target.closest('button[data-sort],button[data-filter]'); if (!b) return;
      if (b.dataset.sort) st.sort = b.dataset.sort; else st.filter = b.dataset.filter;
      draw(); const again = app.querySelector(`button[data-${b.dataset.sort ? 'sort' : 'filter'}="${b.dataset.sort || b.dataset.filter}"]`); if (again) again.focus();
    });
    app.addEventListener('submit', async e => { const reset = e.target.closest('[data-password-reset]'); if (reset) { e.preventDefault(); try { await root.PulseAuth.updatePassword(String(new FormData(reset).get('password') || '')); root.location.reload(); } catch (err) { st.authMessage = err.message; draw(); } return; } const form = e.target.closest('[data-auth-form]'); if (!form) return; e.preventDefault(); const fields = new FormData(form), email = String(fields.get('email') || '').trim(), password = String(fields.get('password') || ''), A = root.PulseAuth; try { if (st.authMode === 'signup') { const result = await A.signUp(email, password); if (result.needsConfirmation) { st.authMessage = 'Check your email to confirm your account, then sign in.'; draw(); return; } } else await A.signIn(email, password); root.location.reload(); } catch (err) { st.authMessage = err.message; draw(); } });
    app.addEventListener('change', e => { if (e.target.matches('select[data-report-day]')) location.hash = `#/feed/${e.target.value}`; });
    window.addEventListener('hashchange', () => { draw(); window.scrollTo(0, 0); });
    draw();
  }
  const api = { forRole, sortClusters, wilson, trackStats, render, extrasHtml, defaultRole, PREVIEW_SAMPLE, PREVIEW_SAMPLE_PAID, PREVIEW_LIVE };
  if (isNode) module.exports = api; else { root.Pulse = api; document.addEventListener('DOMContentLoaded', boot); }
})(typeof window !== 'undefined' ? window : globalThis);
