/** @fileoverview P0.8 / A15.8 event map in PULSE (#/map[/<country>]), design-pg10 §7 + user t267: OpenFreeMap dark via the
 *  VENDORED maplibre-gl 5.24.0 (no Leaflet, no CDN). Style URL + attribution come from the ONE constant ClustrMap.MAP_SOURCE (map.js).
 *  The vendor script and tiles load only when the map view opens (G23c). On any failure: the country list only (G23d), no other host.
 *  Countries from the event data. shortcut: sample clusters carry no country, so market NO -> Norway, US -> United States. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const Ti = isNode ? require('./tiers.js') : root.PulseTiers;
  const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const VENDOR = 'vendor/maplibre-gl-5.24.0/maplibre-gl';
  const COORDS = { Norway: [60.5, 8.5], 'United States': [37.1, -95.7] };   // from js/config.js COUNTRY_COORDS
  const countryOf = c => c.country || ({ NO: 'Norway', US: 'United States' })[c.market] || 'Global';
  function byCountry(clusters) { const m = new Map(); for (const c of clusters || []) { const k = countryOf(c); m.set(k, [...(m.get(k) || []), c]); } return m; }
  function viewMap(st, country) {
    const m = byCountry(st.visible), sel = m.has(country) ? country : null;
    const list = [...m].map(([k, cs]) => `<li><a href="#/map/${encodeURIComponent(k)}"${k === sel ? ' aria-current="true"' : ''}>${esc(k)} \u00b7 ${cs.length} cluster${cs.length === 1 ? '' : 's'}</a></li>`).join('');
    const panel = sel ? `<h2>// Clusters mentioning ${esc(sel)}</h2><div class="list">${m.get(sel).map(c => `<a class="card" href="#/cluster/${esc(c.id)}"><div><h3>${esc(c.title)}</h3><p class="sub">${esc(Ti.tierLabel(c.s))} \u00b7 ${esc(c.market)}</p></div></a>`).join('')}</div>` : '';
    return `<div class="head"><div><h1>&gt; Event map</h1><div class="sub">Countries in the clusters \u00b7 <span class="tag">Sample data</span></div></div></div>` +
      `<div id="pmap" role="application" aria-label="Event map" style="height:50vh;min-height:280px;border:1px solid var(--line);margin-bottom:12px"></div>` +
      `<p id="pmap-fail" class="note" hidden>Map unavailable; events by country:</p><ul class="days" id="pmap-list">${list || '<li>No clusters in your tier\u2019s data.</li>'}</ul>${panel}`;
  }
  let inst = null;
  function fail(doc) { const el = doc.getElementById('pmap'), f = doc.getElementById('pmap-fail'); if (el) el.hidden = true; if (f) f.hidden = false; }
  function load(doc, done) {   // G23c: the vendor script + css are requested only here (map view open)
    if (root.maplibregl) return done(true);
    const css = doc.createElement('link'); css.rel = 'stylesheet'; css.href = VENDOR + '.css'; doc.head.appendChild(css);
    const s = doc.createElement('script'); s.src = VENDOR + '.js'; s.onload = () => done(!!root.maplibregl); s.onerror = () => done(false); doc.head.appendChild(s);
  }
  function mount(doc, st) {
    if (inst) { try { inst.remove(); } catch {} inst = null; }
    const src = root.ClustrMap && root.ClustrMap.MAP_SOURCE; if (!src) return fail(doc);
    load(doc, ok => {
      const el = doc.getElementById('pmap'); if (!el) return;
      if (!ok) return fail(doc);
      try {
        const gl = root.maplibregl, map = new gl.Map({ container: el, style: src.style, center: [10, 45], zoom: 1.3, attributionControl: false });
        map.addControl(new gl.AttributionControl({ compact: false, customAttribution: src.attribution }), 'bottom-right');   // always visible
        map.on('error', () => fail(doc));   // shortcut: any style/tile error -> list only (G23d)
        for (const [k, cs] of byCountry(st.visible)) {
          const b = doc.createElement('a'); b.href = '#/map/' + encodeURIComponent(k); b.className = 'tk'; b.textContent = String(cs.length); b.setAttribute('aria-label', `${k}: ${cs.length} clusters`);
          const [lat, lng] = COORDS[k] || [20, 0]; new gl.Marker({ element: b }).setLngLat([lng, lat]).addTo(map);
        }
        inst = map;
      } catch { fail(doc); }
    });
  }
  const api = { viewMap, mount, byCountry, VENDOR };
  if (isNode) module.exports = api; else root.PulseMap = api;
})(typeof window !== 'undefined' ? window : globalThis);
