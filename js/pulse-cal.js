/** @fileoverview Previous-trading-day close, JS mirror of app.prev_close (build/sql/paywall.sql).
 *  Generated from build/sql/holidays.json: derived from rules, verify against official exchange calendars before production; NYSE early closes 13:00 ET included (2026-11-27, 2026-12-24, 2027-11-26); XOSL has no early closes in this file.
 *  UI-side only, for labels and the offline demo. The real paywall is enforced server-side by RLS (A4). */
(function (root) {
  const HOL = {"NYSE": ["2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25", "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24"], "XOSL": ["2026-01-01", "2026-04-02", "2026-04-03", "2026-04-06", "2026-05-01", "2026-05-14", "2026-05-25", "2026-12-24", "2026-12-25", "2026-12-31", "2027-01-01", "2027-03-25", "2027-03-26", "2027-03-29", "2027-05-06", "2027-05-17", "2027-12-24", "2027-12-31"]};
  const EARLY = {"NYSE|2026-11-27": "13:00", "NYSE|2026-12-24": "13:00", "NYSE|2027-11-26": "13:00"};
  const MK = { NO: { ex: 'XOSL', tz: 'Europe/Oslo', open: '09:00', close: '16:20' }, US: { ex: 'NYSE', tz: 'America/New_York', open: '09:30', close: '16:00' } };
  function localParts(t, tz) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
      .formatToParts(t).filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
    return p;
  }
  function zonedToUtc(dateStr, hhmm, tz) {            // local wall time in tz -> Date (2-pass offset fix)
    const [y, m, d] = dateStr.split('-').map(Number), [hh, mm] = hhmm.split(':').map(Number);
    let guess = Date.UTC(y, m - 1, d, hh, mm);
    for (let i = 0; i < 2; i++) {
      const p = localParts(new Date(guess), tz);
      const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
      guess -= asUtc - Date.UTC(y, m - 1, d, hh, mm);
    }
    return new Date(guess);
  }
  function prevClose(market, now) {
    const mk = MK[market] || MK.US, p = localParts(now || new Date(), mk.tz);
    let d = new Date(Date.UTC(+p.year, +p.month - 1, +p.day) - 864e5);
    const iso = x => x.toISOString().slice(0, 10);
    while ([0, 6].includes(d.getUTCDay()) || (HOL[mk.ex] || []).includes(iso(d))) d = new Date(d - 864e5);
    return zonedToUtc(iso(d), EARLY[mk.ex + '|' + iso(d)] || mk.close, mk.tz);
  }
  /** PA4: true when `t` is on a trading day at/after that day's open (so the live quote is today's session). */
  function inSessionDay(market, t) {
    const mk = MK[market] || MK.US, p = localParts(t, mk.tz), d = `${p.year}-${p.month}-${p.day}`;
    const dow = new Date(Date.UTC(+p.year, +p.month - 1, +p.day)).getUTCDay();
    return ![0, 6].includes(dow) && !(HOL[mk.ex] || []).includes(d) && t >= zonedToUtc(d, mk.open, mk.tz);
  }
  /** PA4: start of the move the quote shows. Before the open / on a closed day the quote is still the LAST session's
   *  change, so the window starts one close earlier (yesterday's story counts for a pre-open move). */
  function quoteSessionStart(market, t) { const c = prevClose(market, t); return inSessionDay(market, t) ? c : prevClose(market, c); }
  /** PA8: trading date (YYYY-MM-DD) of the session an event at `t` can first move: same day if before that day's close
   *  (early closes included), else the next trading day. */
  function sessionFor(market, t) {
    const mk = MK[market] || MK.US, p = localParts(t, mk.tz), iso = x => x.toISOString().slice(0, 10);
    let d = new Date(Date.UTC(+p.year, +p.month - 1, +p.day));
    const trading = x => ![0, 6].includes(x.getUTCDay()) && !(HOL[mk.ex] || []).includes(iso(x));
    if (trading(d) && t < zonedToUtc(iso(d), EARLY[mk.ex + '|' + iso(d)] || mk.close, mk.tz)) return iso(d);
    do d = new Date(+d + 864e5); while (!trading(d));
    return iso(d);
  }
  /** t262u ("Only yesterday"): THE free window, defined once (SQL mirror: app.prev_prev_close < ts <= app.prev_close in paywall.sql / summaries.sql).
   *  Free sees only the previous trading day: prior close < ts <= prev_close, PER MARKET (XOSL / NYSE calendar, local tz + DST).
   *  Monday shows Friday (from Thursday's close); holidays are skipped. Confirmed by sir-nitpickalot. */
  function freeWindow(market, now) { const to = prevClose(market, now); return { from: prevClose(market, to), to }; }
  const inFreeWindow = (market, ts, now) => { const w = freeWindow(market, now), t = +new Date(ts); return t > +w.from && t <= +w.to; };
  const FREE_LABEL = 'Free: previous trading day';
  const api = { prevClose, inSessionDay, quoteSessionStart, sessionFor, zonedToUtc, freeWindow, inFreeWindow, FREE_LABEL, HOL, EARLY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PulseCal = api;
})(typeof window !== 'undefined' ? window : null);
