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
  const QUERY = 'publishes?select=id,title,market,created_at,groups_json&notes=like.PULSE%20pipeline*&order=id.desc&limit=';
  // should 40: the notes prefix alone can be spoofed by anyone who can insert, so only ids WE inserted are read: an allowlist generated
  // into the package config (window.PULSE_PACKAGE.ids, from supabase-write/insert-result.json). Prefix check kept too.
  // Future option (needs a schema change + user yes): an owner column with RLS, or a separate own table/view.
  const allowIds = () => { const p = root.PULSE_PACKAGE; return p && Array.isArray(p.ids) ? p.ids.filter(n => Number.isInteger(n) && n > 0) : []; };
  const GOV = /^https:\/\/(www\.)?(federalregister\.gov|fda\.gov|justice\.gov|federalreserve\.gov)\//;
  const syms = list => (Array.isArray(list) ? list.map(x => String((x && x.symbol) || x || '')).filter(Boolean) : []);
  const num = v => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-10, Math.min(10, Math.round(v))) : 0);
  const str = v => (typeof v === 'string' ? v : '');
  // t344s1271: only the 5 article fields, strings only; no articles[] stays undefined ('No article list stored')
  const arts = a => (Array.isArray(a) ? a.filter(x => x && typeof x === 'object').map(x => ({ title: str(x.title), source: str(x.source), date: str(x.date), link: str(x.link), short_summary: str(x.short_summary) })) : undefined);
  /** One publishes row -> PULSE clusters. Own-words fields plus articles[] when stored. */
  function toClusters(row) {
    return (Array.isArray(row.groups_json) ? row.groups_json : []).filter(g => g && g.name && g.summary).map((g, i) => {
      const s = num(g.impact_score), a = arts(g.articles), mentioned = syms(g.direct_stocks), dflt = syms(g.fixed_stocks).filter(x => !mentioned.includes(x));
      return { id: `sb-${row.id}-${i}`, market: String(row.market || g.market || 'US'), published_at: row.created_at, s, title: String(g.name), summary: String(g.summary),
        sector: String(g.theme || 'Event'), sources: num(g.count) || 1, n_entries: num(g.count) || 1, ours: true, stance: String(g.stance || ''),
        tickers: mentioned.map(t => ({ ticker: t, s, evidence: '', novelty: 'new', priceAtPublish: null, live: null })),
        links: { default: dflt, mentioned }, sourcesList: [], cluster_id: g.cluster_id ? String(g.cluster_id) : undefined, kind: String(g.kind || ''),
        articles: a && a.length ? a : undefined, url: GOV.test(String(g.url || '')) ? g.url : undefined,
        model_id: 'grok (stored)', rubric_version: 'filter-v1', mapping_version: 'none', calibrated: false };
    });
  }
  /** t345u stance history: one entry per (row, join key), the strongest |impact| group wins. */
  const historyOf = (rows, CL, map) => rows.flatMap(r => { const by = new Map();
    for (const c of toClusters(r)) { const key = CL.keyOf(c, map), o = by.get(key); if (!o || Math.abs(c.s) > Math.abs(o.impact_score)) by.set(key, { publish_id: 'own:' + r.id, created_at: r.created_at, key, stance: c.stance, impact_score: c.s }); }
    return [...by.values()]; });
  /** GET all allowlisted own rows; resolves { clusters (newest row), history, updated_at } or rejects (HTTP error, timeout, bad JSON, no rows). */
  async function fetchLive(fetchImpl = root.fetch && root.fetch.bind(root), ids = allowIds()) {
    if (!ids.length) throw new Error('no allowlisted publish ids');
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, timer = ctl && setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const res = await fetchImpl(SUPABASE_URL + '/rest/v1/' + QUERY + ids.length + '&id=in.(' + ids.join(',') + ')', { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + SUPABASE_PUBLISHABLE_KEY, Accept: 'application/json' }, signal: ctl && ctl.signal });
      if (!res.ok) throw new Error('Supabase HTTP ' + res.status);
      const all = await res.json(), rows = (Array.isArray(all) ? all : []).filter(r => r && ids.includes(r.id)), clusters = rows.length ? toClusters(rows[0]) : [];   // allowlist again client-side; newest row = the feed
      if (!clusters.length) throw new Error('no live rows');
      const CL = typeof module !== 'undefined' && module.exports ? require('./pulse-clusters.js') : root.PulseClusters, pkg = root.PULSE_PACKAGE;
      return { clusters, history: historyOf(rows, CL, pkg && pkg.clusterMap), updated_at: rows[0].created_at };
    } finally { if (timer) clearTimeout(timer); }
  }
  /** Fill PulseData from Supabase (live) or keep the sample (fallback). Always resolves; true = live. */
  async function apply(data, fetchImpl) {
    try {
      const r = await fetchLive(fetchImpl), PS = root.PulseSource;
      PS.applyStore(data, { live: true, clusters: r.clusters, updated_at: r.updated_at, charts: {} });
      PS.applyMarkets(root.PULSE_MARKETS, data); data.remoteHistory = r.history;
      return data.live === true;
    } catch (e) { if (root.console) root.console.warn('Live feed unavailable, showing sample data:', e.message); return false; }
  }
  const api = { toClusters, historyOf, fetchLive, apply, allowIds, SUPABASE_URL, QUERY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PulseRemote = api;
})(typeof window !== 'undefined' ? window : globalThis);
