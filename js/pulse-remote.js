/** @fileoverview t318u: live feed from Supabase for the public (Pages) app. Read-only REST GET with the PUBLISHABLE key only
 *  (the browser-safe key, same as legacy js/config.js); never a service key. Reads only our own pipeline rows of `publishes`
 *  (notes start "PULSE pipeline"); legacy rows are never fetched. t344s1271: groups' articles[] (title, source, date, link,
 *  short_summary) are shown, E24/Finansavisen included (supersedes t288u/t289u); the UI escapes them and keeps http/https links only.
 *  Runs only when the package config says remote (window.PULSE_PACKAGE.remote); the local app stays offline. Any failure or an
 *  empty answer -> the caller keeps the labelled sample data. */
(function (root) {
  const SUPABASE_URL = 'https://yrykmwjcarytyroofiar.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_I6HgMNkoKiMcAghe0oyMxA_YNKfurSq';
  const TIMEOUT_MS = 5000;
  // own pipeline rows only, newest first; the columns the legacy frontend reads (api.js fetchPublishes), groups_json holds our own words
  const QUERY = 'pulse_publishes?select=id,title,market,created_at,groups_json&notes=like.PULSE%20pipeline*&order=id.desc&limit=';
  const LATEST_QUERY = 'pulse_publishes?select=id,title,market,created_at,groups_json,notes&notes=like.PULSE%20pipeline*&order=id.desc&limit=500';
  // should 40: the notes prefix alone can be spoofed by anyone who can insert, so only ids WE inserted are read: an allowlist generated
  // into the package config (window.PULSE_PACKAGE.ids, from supabase-write/insert-result.json). Prefix check kept too.
  // Future option (needs a schema change + user yes): an owner column with RLS, or a separate own table/view.
  const allowIds = () => { const p = root.PULSE_PACKAGE; return p && Array.isArray(p.ids) ? p.ids.filter(n => Number.isInteger(n) && n > 0) : []; };
  const GOV = /^https:\/\/(www\.)?(federalregister\.gov|fda\.gov|justice\.gov|federalreserve\.gov)\//;
  const syms = list => (Array.isArray(list) ? list.map(x => String((x && x.symbol) || x || '')).filter(Boolean) : []);
  const num = v => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-10, Math.min(10, Math.round(v))) : 0);
  const str = v => (typeof v === 'string' ? v : '');
  const dayKey = iso => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Europe/Oslo' });
  const averageRating = articles => {
    const scores = (Array.isArray(articles) ? articles : []).map(x => x && x.rating).filter(x => Number.isInteger(x) && x >= -10 && x <= 10);
    return scores.length ? Math.max(-10, Math.min(10, Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length))) : null;
  };
  // t344s1271: only the 5 article fields, strings only; no articles[] stays undefined ('No article list stored')
  const arts = a => (Array.isArray(a) ? a.filter(x => x && typeof x === 'object').map(x => ({ title: str(x.title), source: str(x.source), date: str(x.date), link: str(x.link), short_summary: str(x.short_summary), ...(Number.isInteger(x.rating) && x.rating >= -10 && x.rating <= 10 ? { rating: x.rating } : {}) })) : undefined);
  /** One publishes row -> PULSE clusters. Own-words fields plus articles[] when stored. */
  function toClusters(row, liveQuotes = {}) {
    return (Array.isArray(row.groups_json) ? row.groups_json : []).filter(g => g && g.name && (g.summary || g.reason)).map((g, i) => {
      const a = arts(g.articles), articleAverage = averageRating(g.articles), s = articleAverage == null ? num(g.cluster_score ?? g.impact_score) : articleAverage, rows = [g.stocks, g.direct_stocks, g.mentioned_stocks, g.close_stocks, g.related_stocks].flatMap(list => Array.isArray(list) ? list : []).map(x => typeof x === 'string' ? { symbol: x } : x).filter(x => x && x.symbol), bySymbol = new Map(rows.map(x => [String(x.symbol).toUpperCase(), x]));
      const stance = articleAverage == null ? String(g.stance || '') : s > 0 ? 'constructive' : s < 0 ? 'cautious' : 'watch';
      const mentioned = [...new Set([...syms(g.direct_stocks), ...syms(g.mentioned_stocks), ...syms(g.close_stocks), ...syms(g.stocks), ...syms(g.related_stocks)])], dflt = syms(g.fixed_stocks).filter(x => !mentioned.includes(x));
      const defaultStocks = (g.fixed_stocks || []).map(x => { const stock = x && typeof x === 'object' ? x : { symbol: x }, symbol = String(stock.symbol || '').toUpperCase(), saved = bySymbol.get(symbol), quote = liveQuotes[symbol] || liveQuotes[symbol.replace(/\.[A-Z]+$/, '')]; return { symbol, priceAtPublish: stock.priceAtPublish ?? stock.price_at_publish ?? (saved && (saved.priceAtPublish ?? saved.price_at_publish)) ?? null, live: quote && Number.isFinite(Number(quote.price)) ? { price: Number(quote.price) } : null }; }).filter(x => x.symbol);
      return { id: `sb-${row.id}-${i}`, market: String(row.market || g.market || 'US'), published_at: row.created_at, s, title: String(g.name), summary: String(g.summary || g.reason || ''),
        sector: String(g.theme || 'Event'), sources: num(g.count) || 1, n_entries: num(g.count) || 1, ours: true, stance,
        tickers: mentioned.map(t => { const stock = bySymbol.get(t), quote = liveQuotes[t] || liveQuotes[t.replace(/\.[A-Z]+$/, '')]; return { ticker: t, s, evidence: '', novelty: 'new', priceAtPublish: stock && (stock.priceAtPublish ?? stock.price_at_publish) != null ? Number(stock.priceAtPublish ?? stock.price_at_publish) : stock && Number.isFinite(Number(stock.price)) ? Number(stock.price) : null, live: quote && Number.isFinite(Number(quote.price)) ? { price: Number(quote.price) } : null }; }), defaultStocks,
        links: { default: dflt, mentioned }, sourcesList: [], cluster_id: g.cluster_id ? String(g.cluster_id) : undefined, kind: String(g.kind || ''),
        articles: a && a.length ? a : undefined, url: GOV.test(String(g.url || '')) ? g.url : undefined,
        model_id: 'grok (stored)', rubric_version: 'filter-v1', mapping_version: 'none', calibrated: false };
    });
  }
  function marketMoversOf(row) {
    const source = Array.isArray(row && row.groups_json) ? row.groups_json.find(g => g && g.market_movers)?.market_movers : null;
    if (!source || !['winners', 'losers', 'mostTraded'].every(k => Array.isArray(source[k]))) return null;
    const list = rows => rows.filter(x => x && typeof x.symbol === 'string' && x.symbol).map(x => ({
      symbol: str(x.symbol).toUpperCase(), name: str(x.name) || str(x.symbol), market: str(source.market || row.market || 'US'),
      side: str(x.side), changePercent: typeof x.changePercent === 'number' && Number.isFinite(x.changePercent) ? x.changePercent : null,
      price: typeof x.price === 'number' && Number.isFinite(x.price) ? x.price : null,
      volume: typeof x.volume === 'number' && Number.isFinite(x.volume) ? x.volume : null,
      as_of: str(x.as_of) || str(source.as_of), source: str(x.source) || str(source.provider)
    }));
    const quotes = source.quotes && typeof source.quotes === 'object' ? Object.fromEntries(Object.entries(source.quotes).filter(([, q]) => q && Number.isFinite(Number(q.price))).map(([symbol, q]) => [symbol.toUpperCase(), { price: Number(q.price), as_of: str(q.as_of) || str(source.as_of) }])) : {};
    return { provider: str(source.provider) || 'Market data', market: str(source.market || row.market || 'US'), as_of: str(source.as_of || row.created_at), quotes,
      winners: list(source.winners), losers: list(source.losers), mostTraded: list(source.mostTraded) };
  }
  /** t345u stance history: one entry per (row, join key), the strongest |impact| group wins. */
  const historyOf = (rows, CL, map) => rows.flatMap(r => { const by = new Map();
    for (const c of toClusters(r)) { const key = CL.keyOf(c, map), o = by.get(key); if (!o || Math.abs(c.s) > Math.abs(o.impact_score)) by.set(key, { publish_id: 'own:' + r.id, created_at: r.created_at, key, stance: c.stance, impact_score: c.s }); }
    return [...by.values()]; });
  /** GET all allowlisted own rows; resolves { clusters (newest row), history, updated_at } or rejects (HTTP error, timeout, bad JSON, no rows). */
  async function fetchLive(fetchImpl = root.fetch && root.fetch.bind(root), ids = allowIds(), token) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, timer = ctl && setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      if (!token) throw new Error('sign in to load live feed');
      const headers = { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + token, Accept: 'application/json' }, requests = [];
      if (ids.length) requests.push(SUPABASE_URL + '/rest/v1/' + QUERY + ids.length + '&id=in.(' + ids.join(',') + ')');
      requests.push(SUPABASE_URL + '/rest/v1/' + LATEST_QUERY);
      const results = await Promise.all(requests.map(async url => {
        const res = await fetchImpl(url, { headers, signal: ctl && ctl.signal });
        if (!res.ok) throw new Error('Supabase HTTP ' + res.status);
        return res.json();
      }));
      const allowed = new Set(ids), unique = new Map();
      for (const result of results) for (const row of (Array.isArray(result) ? result : [])) {
        if (!row || !Number.isInteger(row.id) || !Array.isArray(row.groups_json)) continue;
        if (allowed.has(row.id) || (typeof row.notes === 'string' && row.notes.startsWith('PULSE pipeline'))) unique.set(row.id, row);
      }
      const rows = [...unique.values()].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id);
      if (!rows.length) throw new Error('no live rows');
      const CL = typeof module !== 'undefined' && module.exports ? require('./pulse-clusters.js') : root.PulseClusters, pkg = root.PULSE_PACKAGE;
      const marketMovers = rows.map(marketMoversOf).find(Boolean) || null, liveQuotes = marketMovers && marketMovers.quotes || {};
      const clusters = toClusters(rows[0], liveQuotes);   // newest row = default feed
      const byDay = new Map();
      for (const row of rows) {
        const date = dayKey(row.created_at), report = byDay.get(date), clustersForRow = toClusters(row, liveQuotes);
        if (!report) byDay.set(date, { date, publish_id: row.id, title: str(row.title), market: str(row.market || 'US'), updated_at: row.created_at, clusters: clustersForRow });
        else report.clusters.push(...clustersForRow);
      }
      return { clusters, dailyReports: [...byDay.values()], marketMovers, history: historyOf(rows, CL, pkg && pkg.clusterMap), updated_at: rows[0].created_at };
    } finally { if (timer) clearTimeout(timer); }
  }
  /** Fill PulseData from Supabase (live) or keep the sample (fallback). Always resolves; true = live. */
  async function apply(data, fetchImpl, token) {
    try {
      const r = await fetchLive(fetchImpl, allowIds(), token), PS = root.PulseSource;
      PS.applyStore(data, { live: true, clusters: r.clusters, updated_at: r.updated_at, charts: {} });
      data.marketMovers = r.marketMovers && (!Array.isArray(root.PULSE_MARKETS) || root.PULSE_MARKETS.includes(r.marketMovers.market)) ? r.marketMovers : null;
      data.movers = data.marketMovers ? [...data.marketMovers.mostTraded, ...data.marketMovers.winners, ...data.marketMovers.losers] : [];
      PS.applyMarkets(root.PULSE_MARKETS, data); data.remoteHistory = r.history; data.dailyReports = r.dailyReports;
      return data.live === true;
    } catch (e) { if (root.console) root.console.warn('Live feed unavailable, showing sample data:', e.message); return false; }
  }
  const api = { toClusters, averageRating, marketMoversOf, historyOf, fetchLive, apply, allowIds, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, QUERY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PulseRemote = api;
})(typeof window !== 'undefined' ? window : globalThis);
