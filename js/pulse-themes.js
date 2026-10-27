/** @fileoverview P0.7 / A15.10 theme picker (design-pg10.md, user t253): exactly 6 dark themes, choice saved in
 *  localStorage 'pulse-theme'. Unknown/dropped/empty value or a throwing localStorage -> default, never rewritten.
 *  Picker lives on #/more (phone 4th tab; desktop side-nav footer link). Cosmetic only: never changes tier, data or wording.
 *  shortcut: desktop popover + phone bottom sheet (design §5) are simplified to the #/more listbox for the P0 preview. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const KEY = 'pulse-theme', DEFAULT = 'cp2077-terminal';
  const THEMES = [['cp2077-terminal', 'CP2077 Terminal', ['#020409', '#B0EEEC', '#5EF6FF', '#1BD075', '#F45952']], ['dark-blue', 'Dark Blue', ['#0b1220', '#e2e8f0', '#38bdf8', '#4ade80', '#f87171']],
    ['github-dark', 'GitHub Dark', ['#0d1117', '#c9d1d9', '#58a6ff', '#4ade80', '#f87171']], ['midnight', 'Midnight', ['#070b14', '#e2e8f0', '#5b8def', '#34d399', '#f87171']],
    ['graphite', 'Graphite', ['#0e0e0e', '#e8e8e8', '#90caf9', '#81c784', '#e57373']], ['amber-terminal', 'Amber Terminal', ['#0c0a04', '#ffd27a', '#ffb000', '#c8ff5a', '#ff5a3a']]];
  const IDS = THEMES.map(t => t[0]), nameOf = id => (THEMES.find(t => t[0] === id) || THEMES[0])[1];
  /** Saved theme or the default; never throws, never writes. */
  function read(storage) { try { const v = storage && storage.getItem(KEY); return IDS.includes(v) ? v : DEFAULT; } catch { return DEFAULT; } }
  function apply(doc, id) { if (id === DEFAULT) doc.documentElement.removeAttribute('data-theme'); else doc.documentElement.setAttribute('data-theme', id); }
  /** Write only on a user selection. */
  function choose(storage, doc, id) { if (!IDS.includes(id)) return read(storage); try { storage.setItem(KEY, id); } catch {} if (doc) apply(doc, id); return id; }
  const esc = x => String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function viewMore(st) {
    const cur = st.theme || DEFAULT;
    const opts = THEMES.map(([id, name, sw]) => `<li><button type="button" class="theme-opt" role="option" id="th-${id}" data-theme-id="${id}" aria-selected="${id === cur}" tabindex="${id === cur ? 0 : -1}">` +
      `<span class="sw" aria-hidden="true">${sw.map(c => `<i style="background:${c}"></i>`).join('')}</span>${esc(name)}${id === cur ? ' \u2713' : ''}</button></li>`).join('');
    return `<div class="head"><div><h1>&gt; More</h1><div class="sub">Account, theme and map</div></div></div>` +
      `<div class="list"><a class="card" href="#/account"><div><h3>Account</h3><p class="sub">Plan and upgrade</p></div></a><a class="card" href="#/map"><div><h3>Event map</h3><p class="sub">Countries in the clusters (OpenFreeMap tiles)</p></div></a></div>` +
      `<h2 id="theme-h">// THEME</h2><p class="sub">Saved on this device</p><ul role="listbox" aria-labelledby="theme-h" class="themes" style="list-style:none;padding:0;display:grid;gap:8px">${opts}</ul>` +
      `<p class="sub" role="status" aria-live="polite">Theme: ${esc(nameOf(cur))}</p>`;
  }
  function wire(doc, storage, redraw) {
    const pick = b => { choose(storage, doc, b.dataset.themeId); redraw(); const n = doc.querySelector('[data-theme-id][aria-selected=true]'); if (n) n.focus(); };
    doc.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-theme-id]'); if (b) pick(b); });
    doc.addEventListener('keydown', e => {
      const b = e.target.closest && e.target.closest('[data-theme-id]'); if (!b) return;
      const all = [...doc.querySelectorAll('[data-theme-id]')], i = all.indexOf(b);
      const j = e.key === 'ArrowDown' ? Math.min(i + 1, all.length - 1) : e.key === 'ArrowUp' ? Math.max(i - 1, 0) : e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : -1;
      if (j >= 0) { e.preventDefault(); all[j].focus(); }   // Enter/Space activate the focused button (native click)
    });
  }
  const api = { KEY, DEFAULT, THEMES, IDS, read, apply, choose, viewMore, wire, nameOf };
  if (isNode) module.exports = api; else root.PulseThemes = api;
})(typeof window !== 'undefined' ? window : globalThis);
