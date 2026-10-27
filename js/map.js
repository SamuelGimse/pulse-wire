/**
 * @fileoverview Leaflet world map with country event bubbles.
 */

(function () {
  /** ONE place for the map source (user t267: OpenFreeMap dark only, no other tile host). Loaded only in ensureMap(), when the
   *  map view opens: no prefetch, no cache/proxy. Attribution per terms-check.md, always visible bottom-right. */
  const MAP_SOURCE = {
    style: 'https://tiles.openfreemap.org/styles/dark',
    attribution: '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
  };
  /** @type {Array<{country: string, count: number}>} */
  let lastCountries = [];
  let failed = false;
  /** G23d: if the style or tiles fail, hide the map and show the countries as a plain list (no other tile host). */
  function showList() {
    failed = true;
    const el = document.getElementById('map');
    if (!el) return;
    el.style.display = 'none';
    let list = document.getElementById('map-list');
    if (!list) { list = document.createElement('ul'); list.id = 'map-list'; list.className = 'map-list'; el.parentNode.insertBefore(list, el.nextSibling); }
    list.innerHTML = '<li class="map-list-note">Map unavailable; events by country:</li>' +
      lastCountries.map(c => `<li>${String(c.country).replace(/[&<>"]/g, '')}: ${c.count} event${c.count === 1 ? '' : 's'}</li>`).join('');
  }
  /** @type {L.Map|null} */
  let map = null;
  /** @type {L.Layer[]} */
  let mapMarkers = [];

  /**
   * Ensure Leaflet map exists and is sized.
   * @returns {L.Map}
   */
  function ensureMap() {
    if (map) {
      map.invalidateSize(true);
      return map;
    }

    map = L.map('map', {
      worldCopyJump: true,
      minZoom: 1,
      maxZoom: 6
    }).setView([20, 0], 2);

    map.attributionControl.setPosition('bottomright');
    if (typeof L.maplibreGL !== 'function') { showList(); return map; }   // vendored plugin missing -> list view
    const layer = L.maplibreGL({ style: MAP_SOURCE.style, attribution: MAP_SOURCE.attribution }).addTo(map);
    const gl = layer.getMaplibreMap && layer.getMaplibreMap();
    // shortcut: any MapLibre error switches to the list (also a single failed tile); narrow to style/source errors if it flickers.
    if (gl && gl.on) gl.on('error', showList);   // style, tile or glyph load failure -> G23d list view

    return map;
  }

  /**
   * Remove all country markers.
   * @returns {void}
   */
  function clearMarkers() {
    if (!map) return;
    mapMarkers.forEach(layer => {
      try {
        map.removeLayer(layer);
      } catch (e) {
        /* ignore */
      }
    });
    mapMarkers = [];
  }

  /**
   * Force Leaflet to recalculate container size.
   * @returns {void}
   */
  function invalidate() {
    if (map) map.invalidateSize(true);
  }

  /**
   * DivIcon sized by event count.
   * @param {number} count
   * @returns {L.DivIcon}
   */
  function countIcon(count) {
    const size = count > 9 ? 36 : 28;
    return L.divIcon({
      className: 'map-count-bubble',
      html: `<div class="count-dot" aria-hidden="true">${count}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  }

  /**
   * Render country bubbles for current groups.
   * @param {Array<Object>} groups
   * @param {{onCountry?: (country: string, coords: [number, number]) => void}} [handlers]
   * @returns {void}
   */
  function render(groups, handlers = {}) {
    const m = ensureMap();
    clearMarkers();

    const coordsMap =
      (window.ClustrConfig && window.ClustrConfig.COUNTRY_COORDS) || {};
    const countries =
      window.ClustrRender && window.ClustrRender.collectCountries
        ? window.ClustrRender.collectCountries(groups || [])
        : [];
    lastCountries = countries;
    if (failed) { showList(); return; }

    for (const c of countries) {
      const coords =
        coordsMap[c.country] || coordsMap.Global || [20, 0];

      const marker = L.marker(coords, {
        icon: countIcon(c.count),
        keyboard: true,
        title: `${c.country}: ${c.count} events`
      }).addTo(m);

      marker.bindPopup(
        `<strong>${c.country}</strong><br>${c.count} event${
          c.count === 1 ? '' : 's'
        }`
      );

      marker.on('click', () => {
        if (handlers.onCountry) handlers.onCountry(c.country, coords);
      });

      mapMarkers.push(marker);
    }

    setTimeout(() => m.invalidateSize(true), 80);
  }

  /**
   * Pan map to a country.
   * @param {string} country
   * @returns {void}
   */
  function focusCountry(country) {
    if (!map) return;
    const coordsMap =
      (window.ClustrConfig && window.ClustrConfig.COUNTRY_COORDS) || {};
    const coords = coordsMap[country] || coordsMap.Global || [20, 0];
    map.setView(coords, 3);
  }

  window.ClustrMap = {
    MAP_SOURCE,   // P0.8: the PULSE #/map reads the same ONE constant
    ensureMap,
    clearMarkers,
    invalidate,
    render,
    renderBubbles: render,
    focusCountry
  };

  /** @deprecated */
  window.EventlineMap = window.ClustrMap;
})();
