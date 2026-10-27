/** @fileoverview Offline SAMPLE data for the PULSE//WIRE UI (A6). Not real scores; real rows come from
 *  app.stories / app.story_scores (A3/A4) once live. Track-record numbers are fake samples (design-app.md Q5). */
(function (root) {
  const C = (id, market, published_at, s, title, summary, sector, sources, tickers, extra) =>
    Object.assign({ id, market, published_at, s, title, summary, sector, sources, tickers,
      model_id: 'mock-llm', rubric_version: 'rubric-v1', mapping_version: 'map-v1-2026-10-27', calibrated: false }, extra || {});
  const T = (ticker, s, evidence, novelty, priceAtPublish, live) => ({ ticker, s, evidence, novelty, priceAtPublish, live });
  // P0.3: SAMPLE article URLs on the reserved example.com domain (RFC 2606), never a real outlet; live data carries the story's own URL.
  const S = (outlet, title, at, primary) => ({ outlet, title, at, primary: !!primary, url: `https://example.com/sample/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}` });
  const clusters = [
    // today, 2026-10-27 (paid only)
    C('c-eqnr-capex', 'NO', '2026-10-27T07:14:00Z', 7, 'Equinor lifts 2026 capex guidance after Johan Castberg ramp-up',
      'Company raised output guidance and capex range; three outlets confirm, primary source is the Oslo Børs filing.', 'energy', 6,
      [T('EQNR.OL', 7, '“raises 2026 production guidance to 2.2 mboe/d”', 'new', 268.4, 274.9), T('AKRBP.OL', 3, '“partner share in Castberg area”', 'new', 251.0, 252.6)],
      { n_entries: 3, sourcesList: [S('Oslo Børs NewsWeb', 'Equinor: updated 2026 guidance', '07:14', true), S('E24', 'Equinor øker investeringene', '07:31'), S('Reuters', 'Equinor raises output outlook', '07:40')] }),
    C('c-chip-rules', 'US', '2026-10-27T11:52:00Z', -8, 'US widens chip export rules to more data-center GPUs',
      'Commerce Department filing extends licence requirement; vendors named in the rule text.', 'semis', 11,
      [T('NVDA', -8, '“licence required for … H-series accelerators”', 'new', 141.2, 136.8), T('AMD', -6, '“MI-series named in annex”', 'new', 152.0, 149.1), T('ASML', -4, '“equipment servicing restricted”', 'update', 712.0, 705.3)], { n_entries: 1 }),
    C('c-mowi-q3', 'NO', '2026-10-27T06:30:00Z', 5, 'Mowi Q3 harvest volume above company guidance',
      'Quarterly trading update shows higher volume; prices per kg flat.', 'seafood', 4,
      [T('MOWI.OL', 5, '“harvest 152 kt vs guidance 140 kt”', 'new', 201.4, 204.0), T('SALM.OL', 2, '“sector read-across”', 'repeat', 598.0, 599.5)]),
    C('c-tsla-recall', 'US', '2026-10-27T10:58:00Z', -4, 'Tesla recalls 48k vehicles over seat-belt warning software',
      'Voluntary recall, over-the-air fix; regulator notice published.', 'autos', 5, [T('TSLA', -4, '“48,212 vehicles affected”', 'new', 248.0, 246.1)]),
    C('c-fed-speak', 'US', '2026-10-27T10:10:00Z', 1, 'Fed speakers repeat data-dependent line ahead of FOMC',
      'No new information versus the last statement.', 'rates', 9, [T('SPY', 1, '“data-dependent”', 'repeat', 581.0, 581.4)]),
    // after yesterday's US close (2026-10-26 21:30Z > 20:00Z): still locked for free
    C('c-late-us', 'US', '2026-10-26T21:30:00Z', -3, 'Chipmaker cuts Q4 revenue outlook after the bell',
      'Late filing lowers the quarterly range.', 'semis', 3, [T('MU', -3, '“Q4 revenue $8.1–8.5bn vs $8.9bn prior”', 'new', 102.0, 99.7)]),
    // yesterday before close (free + paid)
    C('c-dnb-buyback', 'NO', '2026-10-26T06:45:00Z', 4, 'DNB announces new share repurchase programme of NOK 3bn',
      'Board approved programme after Q3; FSA approval received.', 'banks', 5, [T('DNB.OL', 4, '“programme of up to NOK 3bn”', 'new', 226.0, 228.2)]),
    C('c-boeing-strike', 'US', '2026-10-26T14:05:00Z', -5, 'Boeing machinists reject contract offer, strike extends',
      'Union vote result published; production halt continues at two plants.', 'aerospace', 8,
      [T('BA', -5, '“64% voted against”', 'update', 158.0, 154.9), T('SPR', -3, '“supplier deliveries paused”', 'update', 31.0, 30.6)]),
    C('c-nhy-price', 'NO', '2026-10-26T08:20:00Z', -2, 'Aluminium price slips as Chinese output rises',
      'Exchange data show higher September output; spot price down 1.8%.', 'metals', 4, [T('NHY.OL', -2, '“spot −1.8%”', 'repeat', 70.2, 69.9)]),
    C('c-msft-ai', 'US', '2026-10-26T13:40:00Z', 0, 'Microsoft confirms date for annual developer event',
      'Scheduling announcement only.', 'software', 6, [T('MSFT', 0, '“event on 12 Nov”', 'repeat', 428.0, 428.9)]),
  ];
  // Track record (SAMPLE): 1-trading-day move after publish, hit = sign(move) == sign(score), |s| >= 2 only.
  const track = [
    ['2026-10-23', 'Orkla raises margin outlook', 'ORK.OL', 4, 1.6], ['2026-10-23', 'Netflix subscriber growth above range', 'NFLX', 6, 4.8],
    ['2026-10-22', 'Kongsberg wins frigate sonar order', 'KOG.OL', 5, 2.1], ['2026-10-22', 'Intel delays fab timeline', 'INTC', -5, -3.2],
    ['2026-10-21', 'Telenor sells tower stake', 'TEL.OL', 3, -0.7], ['2026-10-21', 'GM lifts full-year guidance', 'GM', 6, 5.9],
    ['2026-10-20', 'Salmon export price falls', 'MOWI.OL', -3, 0.9], ['2026-10-20', 'Tesla deliveries below consensus', 'TSLA', -6, -4.4],
    ['2026-10-19', 'Yara curtails ammonia output', 'YAR.OL', -4, -1.9], ['2026-10-19', 'Apple supplier flags weaker orders', 'AAPL', -3, 0.6],
    ['2026-10-16', 'Equinor gas field restart', 'EQNR.OL', 2, 0.4], ['2026-10-16', 'Boeing new 737 inspection order', 'BA', -7, -6.1],
    ['2026-10-15', 'Nordic Semi wins design slot', 'NOD.OL', 5, -1.2], ['2026-10-15', 'J&J talc ruling', 'JNJ', -4, -2.3],
  ].map(([date, title, ticker, s, move]) => ({ date, title, ticker, s, move, hit: Math.sign(move) === Math.sign(s) }));
  // A8 SAMPLE movers (not real quotes); side empty -> direction from the sign (CF8 rule in calc.js).
  const movers = [
    { symbol: 'NVDA', market: 'US', side: '', changePercent: -3.1, as_of: '2026-10-27T15:00:00Z' },
    { symbol: 'EQNR.OL', market: 'NO', side: '', changePercent: 2.4, as_of: '2026-10-27T15:00:00Z' },
    { symbol: 'BA', market: 'US', side: '', changePercent: -1.9, as_of: '2026-10-27T15:00:00Z' },
    { symbol: 'AAPL', market: 'US', side: '', changePercent: 1.2, as_of: '2026-10-27T15:00:00Z' },
  ];
  const api = { clusters, track, movers, demoNow: '2026-10-27T15:00:00Z' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PulseData = api;
})(typeof window !== 'undefined' ? window : null);
