/* HARDGATE — hg-v701 NEW GOLD always-on board tests (newgold.js).

   WHAT THIS PROVES. The NEW GOLD tab used to render ONE static line unless
   a triple-confirmation fire existed, and the replay shows the triple formed
   9 times in 5.5 months (scripts/backtest-newgold-results.json fireLog) —
   the user opened a mostly-blank tab. hg-v701 populates it with an
   ALWAYS-ON HONEST BOARD, never invented setups:

     P1  the checklist is the DETECTOR'S OWN read — ngLegRead is what
         ngAssess fires on, so board and detector cannot disagree.
     P2  CONFIRMATION CHECKLIST renders per horizon (1H + 4H) with every
         leg's state on the last CLOSED bar.
     P3  the needs-line is computed FROM the leg states, per direction,
         and names exactly the leg that fails — no direction recommended.
     P4  structure is CONTEXT, labeled 'not an entry'; the checklist NEVER
         carries entry/stop/t1 — levels exist only on FORMED cards.
     P5  a fire short of the bar renders as WATCH naming the missing class,
         with NO levels (the gold-formation WATCH philosophy).
     P6  participation prints DARK with the measured reason — dark by
         design, never silently omitted, never counted as a pass.
     P7  hybrid lane status says WHY it is empty, with counts — honest at
         every depth of absence (not loaded / no candidates / drops).
     P8  session context strip is labeled measured + informational; the
         session LEG reads the closed signal bar, never the wall clock.
     P9  paid history is read-only forward-ledger truth: settled outcomes
         as lines, honest empty state, DARK (not empty) when unavailable.
     P10 the snapshot (W.newGoldScan) is extended ADDITIVELY — new keys
         only, deep-frozen — mirroring goldscalp publishScan's armed/
         whySilent addition; { at, results, errors } untouched.
     P11 existing behavior preserved: a FORMED fire still renders the same
         levels card; the old one-liner remains only for feeds-failed.

   Pattern per tests/test-newgold-honesty.mjs: boot the real stack in a vm,
   zero network (ctx.fetch rejects), seed candles via W.hgOgFetchRows.

   Run: node tests/test-newgold-populate.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, label) => { if (c){ pass++; console.log('  ok   —', label); } else { fail++; console.log('  FAIL —', label); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(files){
  const ctx = { console:{ log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object, Number, String,
    Promise, RegExp, Error, TypeError, Map, Set, Symbol, Intl,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    encodeURIComponent, decodeURIComponent, AbortController };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){}, clear(){} };
  ctx.sessionStorage = ctx.localStorage;
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
      querySelector: () => null, querySelectorAll: () => [] }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){}, contains: () => false },
    documentElement: { appendChild(){} },
    addEventListener(){}, removeEventListener(){}, visibilityState:'visible', readyState:'complete' };
  ctx.fetch = () => Promise.reject(new Error('no network'));
  ctx.navigator = { userAgent:'node', onLine:false };
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(read(f), ctx, { filename: f });
  /* the desk's real execution venue (XM) — same as the backtest harness */
  ctx.HG_OG_VENUE = 'XM';
  return ctx;
}

const CORE = ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
  'hg-forward.js','hg-gates.js','hg-plan.js','formation.js','hg-solidity.js',
  'backtest-tab-params.js','gold-session.js','goldind.js','gold-catalog.js',
  'gold-formation.js','omniroute.js','omnigold.js'];

const W = boot(CORE.concat(['newgold.js']));
const src = read('newgold.js');

/* ---------- fixtures (per tests/test-newgold-honesty.mjs) -----------------
   70 closed 1h bars: uptrend, bull FVG [4000.0, 4000.6], dip into the gap,
   trigger bar crossing RSI up. hourUTC picks the session cohort of the
   SIGNAL bar: 18 = NY-PM (measured-confirming), 9 = LONDON (measured
   NOT confirming), so the same tape is FORMED or WATCH by the clock the
   evidence licenses — the signal bar's own. */
function mkFixture(hourUTC){
  const rows = [];
  const t0 = Math.floor(Date.UTC(2026, 5, 1, hourUTC, 0, 0) / 1000);
  const n = 70;
  const t = i => t0 - (n - 1 - i) * 3600;
  let c = 3950;
  for (let i = 0; i < 50; i++){
    c += (i % 2 === 0) ? 1.6 : -0.5;
    rows.push({ t: t(i), o: c - 0.2, h: c + 0.45, l: c - 0.5, c: +c.toFixed(2), v: 1000 });
  }
  rows.push({ t: t(50), o: 3999.5, h: 4000.0, l: 3999.2, c: 3999.9, v: 1000 });
  rows.push({ t: t(51), o: 4000.2, h: 4001.6, l: 4000.1, c: 4001.5, v: 1200 });
  rows.push({ t: t(52), o: 4001.6, h: 4002.2, l: 4000.6, c: 4001.9, v: 1000 });
  const dipStart = 4001.8, dipEnd = 4000.1, dipFast = 5, dipLen = 16;
  const closes = [];
  for (let k = 0; k < dipFast; k++) closes.push(dipStart - (dipStart - dipEnd) * ((k + 1) / dipFast));
  for (let k = 0; k < dipLen - dipFast; k++) closes.push(dipEnd + ((dipLen - dipFast - 1 - k) % 2 === 0 ? 0 : 0.05));
  for (let k = 0; k < closes.length; k++){
    const c2 = +closes[k].toFixed(2);
    const o2 = k === 0 ? dipStart + 0.1 : +closes[k - 1].toFixed(2);
    rows.push({ t: t(53 + k), o: o2, h: Math.max(o2, c2) + 0.18,
                l: Math.max(Math.min(o2, c2) - 0.12, 4000.05), c: c2, v: 900 });
  }
  rows.push({ t: t(69), o: 4000.12, h: 4000.55, l: 4000.07, c: 4000.5, v: 1300 });
  return rows;
}
/* same tape, trigger bar replaced by a flat continuation: price stays
   INSIDE the bull gap, VWMA regime stays bull, but RSI does NOT cross —
   exactly ONE leg short of a long fire */
function mkNoCross(){
  const rows = mkFixture(18);
  rows[69] = { ...rows[69], o: 4000.10, h: 4000.22, l: 4000.06, c: 4000.12, v: 900 };
  return rows;
}
/* dead-flat tape: no FVG at all */
function mkFlat(){
  const rows = [];
  for (let i = 0; i < 70; i++) rows.push({ t: 1700000000 + i * 3600, o: 100, h: 100.1, l: 99.9, c: 100, v: 1000 });
  return rows;
}

console.log('\n--- P1: the checklist is the detector\'s own read ---');
{
  ok(typeof W.ngLegRead === 'function', 'ngLegRead is exported (hg-v701)');
  const fire = mkFixture(18), noX = mkNoCross();
  const lf = W.ngLegRead(fire), ln = W.ngLegRead(noX);
  ok(lf.ok === true && lf.fvg.inBull === true && lf.ml.side === 'bull' && lf.rsi.bullCross === true,
     'fire tape: legs read inBull + ml bull + RSI cross up');
  ok(!!W.ngAssess(fire) && W.ngAssess(fire).dir === 'long',
     'ngAssess fires long on exactly those leg reads');
  ok(ln.ok === true && ln.fvg.inBull === true && ln.ml.side === 'bull'
     && ln.rsi.bullCross === false && ln.rsi.bearCross === false,
     'no-cross tape: same structure + ml, RSI leg alone fails');
  ok(W.ngAssess(noX) === null, 'and ngAssess does NOT fire — one reader, one truth');
  ok(isFinite(ln.atr) && ln.atr > 0, 'ATR read from the shared series for display distances');
  const dead = W.ngLegRead([]);
  ok(dead.ok === false && /feed too short/.test(dead.why) && isNaN(dead.atr),
     'empty rows -> ok:false with the reason, nothing claimed (atr stays NaN)');
}

console.log('\n--- P2: checklist renders per horizon with leg states ---');
{
  W.hgOgFetchRows = () => Promise.resolve({ rows: mkFixture(18), source: 'fixture' });
  const pack = await W.ngRunScan();
  const cls = pack.checklist || [];
  ok(cls.length === 2 && cls[0].horizon === '1H' && cls[1].horizon === '4H',
     'one checklist per horizon: 1H + 4H');
  ok(cls.every(c => c.ok === true), 'both horizons read their legs on the closed bar');
  for (const c of cls){
    const keys = (c.legs || []).map(l => l.key).join(',');
    ok(keys === 'structure,ml,rsi,session-htf,participation',
       c.horizon + ': all five legs present in order — ' + keys);
  }
  ok(typeof cls[0].barISO === 'string' && /UTC/.test(cls[0].barISO),
     'the checklist names the CLOSED bar instant it read (' + cls[0].barISO + ')');
  /* existing contract intact on the same scan: the FORMED fire still
     renders the SAME levels card */
  const rec1h = (pack.results || []).filter(r => r.setup && r.horizon === '1H')[0];
  ok(!!rec1h && rec1h.formation && rec1h.formation.tradable === true,
     'the NY-PM fire still FORMS through the shared contract');
  const card = W.ngCardHtml(rec1h);
  ok(/hg-mp-grid/.test(card) && /ENTRY/.test(card) && /T1 \(1\.5R\)/.test(card),
     'FORMED card still carries the exact levels grid (existing behavior preserved)');
  ok((pack.watch || []).every(w => !(w.horizon === '1H' && w.state === 'FORMED')),
     'a FORMED fire is a card, never a watch entry');
}

console.log('\n--- P3: the needs-line names the failing leg, per direction ---');
{
  const cl = W.ngBuildChecklist(mkNoCross(), '1H', { dir: '', src: '' }, 'fixture');
  ok(cl.ok === true && cl.fireDir === '', 'no-cross tape: no fire direction claimed');
  /* hg-v702: the RSI needs-line names the LOOSENED windowed trigger. */
  ok(cl.needs.long.length === 1 && /RSI\(14\) cross above its 9-SMA within the last 3 closed bars \(still held now\)/.test(cl.needs.long[0]),
     'LONG needs names EXACTLY the RSI leg (structure + ml already read long): ' + cl.needs.long[0]);
  ok(cl.needs.short.some(s => /close below VWMA-50/.test(s))
     && cl.needs.short.some(s => /RSI\(14\) cross below its 9-SMA within the last 3 closed bars/.test(s)),
     'SHORT needs (the flip side) names the VWMA side AND the RSI cross');
  const html = W.ngChecklistHtml(cl);
  ok(/LONG needs:/.test(html) && /SHORT needs:/.test(html),
     'the verdict line renders for BOTH directions');
  ok(/no direction is recommended/.test(html), 'and says so: no direction is recommended');
  /* the fire tape: needs are empty for the firing side and the line says
     the fire card carries it */
  const clF = W.ngBuildChecklist(mkFixture(18), '1H', { dir: 'long', src: '4H VWMA-50 regime' }, 'fixture');
  ok(clF.fireDir === 'long' && clF.needs.long.length === 0,
     'fire tape: LONG needs nothing — all three legs read on this bar');
  ok(/nothing — all three signal legs read LONG/.test(W.ngChecklistHtml(clF)),
     'rendered as a statement of fact, not a recommendation');
}

console.log('\n--- P4: structure is context — labeled, and NEVER levels ---');
{
  const cl = W.ngBuildChecklist(mkNoCross(), '1H', { dir: '', src: '' }, 'fixture');
  const html = W.ngChecklistHtml(cl);
  ok(/structure context — not an entry/.test(html),
     'the structure row carries the explicit label');
  ok(/INSIDE the nearest unmitigated bull FVG \[4000\.00 – 4000\.60\]/.test(html),
     'zone bounds + membership printed as CONTEXT');
  ok(!/hg-mp-grid|MARKET BUY|MARKET SELL|>ENTRY<|>STOP<|T1 \(1\.5R\)/.test(html),
     'the checklist NEVER carries entry/stop/target markup');
  ok(!('entry' in cl) && !('stop' in cl) && !('t1' in cl),
     'the checklist object carries no level fields at all');
  /* distance wording when price is OUTSIDE a gap, in ATR */
  const stTxt = cl.legs[0].text;
  ok(/\d+(\.\d+)? ATR (above|below) the nearest unmitigated bear FVG/.test(stTxt),
     'distance printed in ATR against the out-of-reach side: ' + stTxt.slice(0, 120));
  /* no gap at all -> the exact honest sentence */
  const clFlat = W.ngBuildChecklist(mkFlat(), '4H', { dir: '', src: '' }, 'fixture');
  ok(/no unmitigated FVG in range — structure leg cannot fire/.test(clFlat.legs[0].text),
     'no-FVG tape says the structure leg cannot fire');
}

console.log('\n--- P5: a fire short of the bar is a WATCH — missing class named, NO levels ---');
{
  /* LONDON signal bar + no 4h rows: session window does not confirm and no
     htf tape exists, so the desk\'s ONE revocable class is unconfirmed */
  W.hgOgFetchRows = (tf) => Promise.resolve(tf === '1h'
    ? { rows: mkFixture(9), source: 'fixture' } : { rows: [], source: 'fixture' });
  const pack = await W.ngRunScan();
  const rec = (pack.results || []).filter(r => r.setup)[0];
  ok(!!rec && rec.formation && rec.formation.state === 'WATCH' && rec.formation.tradable === false,
     'the LONDON fire is WATCH, not a ticket (fires are never silently dropped)');
  const w = (pack.watch || [])[0];
  ok(!!w && w.state === 'WATCH' && w.missing.indexOf('session-htf') >= 0,
     'watch[] names the missing class: ' + (w ? w.missing.join(',') : '—'));
  ok(!!w && !('entry' in w) && !('stop' in w) && !('t1' in w),
     'watch entries carry NO level fields by construction');
  const card = W.ngCardHtml(rec);
  ok(/NOT A TICKET/.test(card) && !/hg-mp-grid|MARKET BUY/.test(card),
     'the WATCH card prints the blocker and withholds every level');
  const wHtml = W.ngWatchHtml(pack.watch);
  ok(/session-htf/.test(wHtml) && /NO levels by design/.test(wHtml),
     'the board watch section names the class and says why there are no levels');
  ok(/no near-miss fires this scan/.test(W.ngWatchHtml([])),
     'honest empty state when nothing is near');
  /* the dead 4H horizon still gets a DARK checklist entry */
  const cl4 = (pack.checklist || []).filter(c => c.horizon === '4H')[0];
  ok(!!cl4 && cl4.ok === false && /no bars from the feed/.test(cl4.why),
     'a dead feed renders a DARK checklist entry with the reason, never a blank');
  /* session strip on this scan reads the SIGNAL BAR (09:00 -> LONDON) */
  const se = pack.sessionEdge;
  ok(!!se && se.available === true && se.bar && se.bar.key === 'LONDON' && se.bar.confirms === false,
     'session strip: the bar-clock cohort is LONDON, measured NOT confirming');
  const seHtml = W.ngSessionStripHtml(se);
  ok(/informational/.test(seHtml) && /measured/.test(seHtml),
     'strip is labeled measured + informational');
  ok(/leg verdicts read the closed bar/.test(seHtml),
     'and says the legs never read the wall clock');
}

console.log('\n--- P6: participation prints DARK, never a silent omission ---');
{
  const cl = W.ngBuildChecklist(mkFixture(18), '1H', { dir: '', src: '' }, 'fixture');
  const part = cl.legs.filter(l => l.key === 'participation')[0];
  ok(!!part && part.dark === true && part.long === false && part.short === false,
     'participation leg is dark and confirms nothing');
  ok(/DARK by design/.test(part.text) && /no taker delta, no OI and no COT/.test(part.text)
     && /27\.7% n=2856 vs vetoed 35\.2% n=1737/.test(part.text),
     'with the measured reason volume is NOT substituted');
  /* even with a DEAD feed the participation truth still prints */
  const clDead = W.ngBuildChecklist([], '1H', { dir: '', src: '' }, 'no-fetcher');
  ok(clDead.ok === false && clDead.legs.some(l => l.key === 'participation' && l.dark === true),
     'a dead feed still prints the participation truth (it is feed-independent)');
}

console.log('\n--- P7: hybrid lane status is honest at every depth of absence ---');
{
  /* this session: OMNIGOLD loaded but never scanned -> no candidates */
  const st0 = W.ngOmniLaneStatus({ candidates: 0, rowsShort: 0, dedup: 0, noFire: 0, dirDrop: 0, emitted: 0 });
  ok(st0.state === 'empty' && /no ranked candidates/.test(st0.lines.join(' ')),
     'no OMNIGOLD candidates -> says so: ' + st0.lines[0].slice(0, 80));
  /* OMNIGOLD not loaded at all */
  const savedDbg = W.hgOgUniformDebug;
  W.hgOgUniformDebug = undefined;
  const st1 = W.ngOmniLaneStatus(null);
  ok(st1.state === 'dark' && /not loaded/.test(st1.lines.join(' ')) && /no candidates are invented/.test(st1.lines.join(' ')),
     'OMNIGOLD not loaded -> DARK with the reason');
  /* candidates present but every guard dropped them -> counts, one line each */
  W.hgOgUniformDebug = () => ({ swing: [{ kind: 'kzJudas', dir: 'long' }, { kind: 'adrFade', dir: 'short' }],
                                scalp: [{ kind: 'nyOpenDrive', dir: 'long' }] });
  const st2 = W.ngOmniLaneStatus({ candidates: 3, rowsShort: 0, dedup: 0, noFire: 1, dirDrop: 2, emitted: 0 });
  const joined = st2.lines.join(' | ');
  ok(st2.state === 'read' && /2 SWING \+ 1 SCALP/.test(joined),
     'candidate counts read from OMNIGOLD\'s own surface');
  ok(/direction intersection dropped 2/.test(joined),
     'direction-intersection drops are COUNTED, not silent');
  ok(/1 dropped — no triple-confirmation fire/.test(joined),
     'no-fire drops are counted too');
  ok(/0 hybrid cards emitted/.test(joined), 'and the emitted count closes the ledger');
  W.hgOgUniformDebug = savedDbg;
}

console.log('\n--- P9: paid history — read-only, honest empty, DARK when unavailable ---');
{
  /* fresh storage stub -> ledger exists but holds nothing settled */
  const h0 = W.ngHistoryRecords(10);
  ok(Array.isArray(h0) && h0.length === 0, 'empty ledger -> [], not null');
  ok(/no settled TRIPLE-CONF records yet/.test(W.ngHistoryHtml([])),
     'honest empty state: nothing is claimed until an outcome exists');
  /* seeded records: only NEWGOLD* + TRIPLE-CONF* + SETTLED survive */
  const savedRecs = W.hgFwdRecords;
  W.hgFwdRecords = () => [
    { tab: 'NEWGOLD:1H', mechanic: 'TRIPLE-CONF', dir: 'long', state: 't1', r: 1.5, rr: 1.5,
      barT: 1780000000, settledT: 1780050000, ticket: true },
    { tab: 'NEWGOLD:4H', mechanic: 'TRIPLE-CONF', dir: 'short', state: 'stop', r: -1,
      barT: 1780100000, settledT: 1780200000, ticket: false },
    { tab: 'NEWGOLD:OMNI-4H', mechanic: 'TRIPLE-CONF+OMNI:kzJudas', dir: 'long', state: 'expired', r: null,
      barT: 1780300000, settledT: 1780400000, ticket: false },
    { tab: 'NEWGOLD:1H', mechanic: 'TRIPLE-CONF', dir: 'long', state: 'open', r: null, barT: 1780500000 },
    { tab: 'OMNIGOLD:SCALP', mechanic: 'TRIPLE-CONF', dir: 'long', state: 't1', r: 2, settledT: 1780600000 },
    { tab: 'NEWGOLD:1H', mechanic: 'OTHER-KIND', dir: 'long', state: 't1', r: 2, settledT: 1780700000 }
  ];
  const h1 = W.ngHistoryRecords(10);
  ok(h1.length === 3, 'filters to NEWGOLD* + TRIPLE-CONF* + settled only (3 of 6)');
  ok(h1[0].state === 'expired' && h1[1].state === 'stop' && h1[2].state === 't1',
     'newest settled first');
  const hHtml = W.ngHistoryHtml(h1);
  ok(/TRIPLE-CONF<\/b> 1H long · TP1 hit · \+1\.50R gross/.test(hHtml),
     'the line reads: TRIPLE-CONF 1H long · TP1 hit · +1.50R gross');
  ok(/stopped · -1\.00R gross/.test(hHtml), 'a stop prints its gross R');
  ok(/expired unsettled — no outcome claimed/.test(hHtml),
     'an expired record claims NO outcome');
  ok(/read-only/.test(hHtml) && /nothing is re-settled here/.test(hHtml),
     'the section says it is read-only');
  /* read-only IN CODE: the history reader never touches a write/settle
     surface (hgFwdResolve stays where it always was — in the scan) */
  const bodyStart = src.indexOf('function ngHistoryRecords');
  const body = src.slice(bodyStart, src.indexOf('\n}', bodyStart));
  ok(bodyStart > 0 && !/hgFwdResolve|hgFwdRecord\b|hgFwdSettle|hgFwdClear/.test(body),
     'ngHistoryRecords reads hgFwdRecords only — no settle, no write, no clear');
  /* ledger surface missing -> DARK, not empty */
  W.hgFwdRecords = undefined;
  ok(W.ngHistoryRecords(10) === null, 'no ledger surface -> null (dark)');
  ok(/forward ledger unavailable/.test(W.ngHistoryHtml(null)) && /dark, not empty/.test(W.ngHistoryHtml(null)),
     'rendered as DARK with the reason, never as a clean zero');
  W.hgFwdRecords = savedRecs;
}

console.log('\n--- P10: snapshot extended ADDITIVELY, new keys deep-frozen ---');
{
  W.hgOgFetchRows = () => Promise.resolve({ rows: mkFixture(18), source: 'fixture' });
  const pack = await W.ngRunScan();
  const snap = W.newGoldScan();
  ok(!!snap && isFinite(snap.at) && Array.isArray(snap.results) && Array.isArray(snap.errors),
     'the existing { at, results, errors } contract is untouched');
  for (const k of ['checklist', 'watch', 'hybridLaneStatus', 'sessionEdge', 'history']){
    ok(k in snap, 'additive key present: ' + k);
  }
  ok(Object.isFrozen(snap.checklist) && Object.isFrozen(snap.checklist[0])
     && Object.isFrozen(snap.checklist[0].legs) && Object.isFrozen(snap.checklist[0].legs[0]),
     'checklist is DEEP-frozen (array, entry, legs, leg)');
  ok(Object.isFrozen(snap.watch) && Object.isFrozen(snap.hybridLaneStatus)
     && Object.isFrozen(snap.sessionEdge), 'watch / hybridLaneStatus / sessionEdge frozen');
  ok(snap.history === null || Object.isFrozen(snap.history), 'history frozen (or dark-null)');
  ok(snap.results === pack.results, 'results is the SAME array the scan returned — no shape change');
  let threw = false;
  try { snap.checklist.push('x'); } catch (e){ threw = true; }
  ok(threw || snap.checklist[snap.checklist.length - 1] !== 'x',
     'the frozen surface rejects mutation');
}

console.log('\n--- P11: wiring — board div, feeds-failed one-liner, fail-soft sections ---');
{
  ok(/id="ngBoard"/.test(src), '#ngBoard container exists in the mount HTML');
  ok(/id="ngEmpty"[^>]*>FEEDS DOWN/.test(src),
     'the #ngEmpty one-liner is reserved for the feeds-failed case (board is the content otherwise)');
  ok(!/No triple-confirmation fires right now/.test(src),
     'the old always-empty line is gone');
  ok(/ngSecSafe/.test(src) && /section failed soft/.test(src),
     'per-section catch isolation exists (one broken section cannot take the board down)');
  /* board renders even from an empty pack — every section fails soft */
  const emptyBoard = W.ngBoardHtml({});
  ok(/CONFIRMATION CHECKLIST/.test(emptyBoard) && /WATCH \/ NEAR-MISS/.test(emptyBoard)
     && /HYBRID LANE STATUS/.test(emptyBoard) && /SESSION CONTEXT/.test(emptyBoard)
     && /PAID HISTORY/.test(emptyBoard),
     'all five sections render from an empty pack, each with its honest empty/dark state');
  ok(/nothing is invented/.test(emptyBoard), 'and say that nothing is invented');
}

console.log('\n' + pass + ' assertions passed' + (fail ? (', ' + fail + ' FAILED') : ''));
if (fail) process.exit(1);
console.log('OK - hg-v701: NEW GOLD always-on board (checklist / watch / hybrid status / session strip / paid history — honest, never invented)');
