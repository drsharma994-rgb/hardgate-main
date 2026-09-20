/* HARDGATE — CRYPTO SCAN's 1h leg failed in silence, and the silence promoted.

   Pack 870 moved the 15m leg onto hgDeskFetchKlinesResult because
   hgDeskFetchKlines swallows the reason and resolves to [] whatever went
   wrong: a venue outage and a three-bar contract arrived indistinguishable,
   and a Binance 451 for every symbol read out as "fewer than 230 closed 15m
   bars". The 1h leg, fetched one line further down, was left on the swallowing
   wrapper and never picked the instrument up.

   It has exactly one consumer -- read 4 of hgOrderFlowScore, the 1h
   candle-volume imbalance, which runs only `if (rows1h && rows1h.length >=
   30)`. Below that it is not pushed at all: no vote, no value, no note. And
   layer 2 aggregates as the MEAN of the reads that cleared their own gates,
   so dropping one does not pull the score toward zero. It removes a divisor.

   Swept over 1,500 random tapes, full 1h leg against none:

     |layer-2 score| ROSE        912 (60.8%)
     |layer-2 score| FELL        151 (10.1%)
     tier PROMOTED               204 (13.6%)
     tier DEMOTED                  1 ( 0.1%)
     gained PROFESSIONAL-GRADE    74
     lost   PROFESSIONAL-GRADE     0

   A failed fetch is a one-way promotion. The 1h read carries weight 0.8 where
   the others carry 1.0, so it dilutes more often than it decides, and losing
   it concentrates whatever is left. The tier is what the card stamps, what
   renderCards partitions on, and what hg-forward pools by -- so a contract
   whose 1h request timed out could be recorded under a stronger mechanic than
   the same contract on the same bars with its feed up, and nothing on the
   card, the status line, the coverage line or the log said which had happened.

   The score is NOT changed. Re-weighting a layer whose 0.35 share and 0.2
   direction band were fitted together is a calibration decision, the same one
   order-flow.js leaves alone in its note about the gated-mean cliff. What
   changes is that the fact stops being invisible.

   Run: node tests/test-cryptoscan-h1-leg.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
function ok(cond, msg){
  if (cond){ passed++; console.log('  ok   ' + msg); }
  else { console.error('  FAIL ' + msg); process.exitCode = 1; }
}
function stripComments(src){
  return String(src)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1 ');
}
const text = h => String(h).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

function boot(){
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date,
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, Set, Map };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {};
  s.setTimeout = (f) => { try{ f && f(); }catch(e){} return 0; }; s.clearTimeout = () => {};
  s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }),
                 head: { appendChild(){} }, addEventListener(){} };
  s.localStorage = (() => { const m = {}; return {
    getItem: k => (k in m ? m[k] : null), setItem(k, v){ m[k] = String(v); },
    removeItem(k){ delete m[k]; } }; })();
  s.location = { href: 'https://x/', search: '', protocol: 'https:' };
  s.navigator = { userAgent: 'node' };
  vm.createContext(s);
  for (const f of ['indicators.js', 'indicators2.js', 'order-flow.js',
                   'liquidation-intelligence.js', 'cryptoscan-voting-v3.js', 'sentiment.js',
                   'cryptoultra.js', 'hg-forward.js', 'cryptoscan.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const S = boot();
const SCAN = fs.readFileSync(root + 'cryptoscan.js', 'utf8');
const FLOW = fs.readFileSync(root + 'order-flow.js', 'utf8');
const UNI  = fs.readFileSync(root + 'desk-scan-universe.js', 'utf8');
const SEC = 900;

/* ---------------------------------------------------------------- 1 */
console.log('\n1. the wrapper the 1h leg was using discards the reason');
{
  const uni = stripComments(UNI);
  ok(/async function hgDeskFetchKlines\(item, tf, n\)\{\s*var r = await hgDeskFetchKlinesResult\(item, tf, n\);\s*return r\.rows;/.test(uni.replace(/\s+/g, ' ').replace(/ \{/g, '{')),
     'hgDeskFetchKlines calls the result form and returns only .rows');
  ok(/out\.reason = 'fetch-failed'/.test(uni) && /out\.reason = 'bad-shape'/.test(uni),
     'so five distinct reasons are computed one call deeper');
  ok(/'no-symbol'/.test(uni) && /'no-source'/.test(uni), 'including no-symbol and no-source');

  const scan = stripComments(SCAN);
  /* the fix: the 1h leg now takes the same instrumented path the 15m leg has */
  ok(/var got1h = fetchRes\s*\?\s*await fetchRes\(item, '1h', KL_1H\)/.test(scan),
     'the scan now fetches the 1h leg through the result form');
  ok(/: \{ rows: \(await fetchKl\(item, '1h', KL_1H\)\) \|\| \[\], ok: true, reason: null \}/.test(scan),
     'falling back to the array form for an older desk-scan-universe.js, exactly as the 15m leg does');
  ok(!/var rows1h = await fetchKl\(/.test(scan),
     'and the bare swallowing call is gone');
}

/* ---------------------------------------------------------------- 2 */
console.log("\n2. 30 is order-flow.js's own gate, not a number this tab invented");
{
  ok(/if \(rows1h && rows1h\.length >= 30\)\{/.test(FLOW),
     'hgOrderFlowScore runs its 1h read only at 30+ bars');
  ok(S.CS_MIN_1H === 30, 'CS_MIN_1H is that same 30 (' + S.CS_MIN_1H + ')');
  ok(/'thin-1h':\s*'fewer than ' \+ CS_MIN_1H \+ ' closed 1h bars'/.test(SCAN),
     'and the sentence quotes the constant rather than restating the digits');
  /* the read is weighted BELOW the others, which is why losing it concentrates */
  ok(/scores\.push\(ba1h \* 0\.8\);/.test(FLOW),
     'the 1h read is weighted 0.8 where the 15m reads are 1.0');
  ok(/var aggregated = scores\.reduce\(function\(a, b\)\{ return a \+ b; \}\) \/ scores\.length;/.test(FLOW),
     'and the aggregate is a MEAN of the reads that cleared their gates, so one fewer read removes a divisor');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. csH1State separates a dead feed from a young contract');
{
  ok(typeof S.csH1State === 'function', 'csH1State is reachable');
  const many = new Array(40).fill(0).map((_, i) => ({ t: i * 3600, c: 100 }));
  const few  = many.slice(0, 29);

  const good = S.csH1State({ ok: true, reason: null }, many);
  ok(good.ok === true && good.reason === null && good.closed === 40,
     'bars arrived and there are enough of them');

  const thin = S.csH1State({ ok: true, reason: null }, few);
  ok(thin.ok === false && thin.reason === 'thin-1h' && thin.closed === 29,
     'bars arrived and there are not: a fact about the CONTRACT (29 < 30)');
  ok(S.csH1State({ ok: true, reason: null }, many.slice(0, 30)).ok === true,
     'exactly 30 is enough — the boundary matches order-flow.js, which tests >= 30');

  const dead = S.csH1State({ ok: false, reason: 'fetch-failed' }, []);
  ok(dead.ok === false && dead.reason === 'fetch-failed',
     'a failed request keeps its OWN reason: a fact about the FEED');
  /* the distinction is the whole point of pack 870, applied to the other leg */
  ok(S.csH1State({ ok: false, reason: 'fetch-failed' }, many).reason === 'fetch-failed',
     'and a failed fetch stays a failed fetch even if rows somehow came with it — never relabelled thin');
  ok(S.csH1State({ ok: false, reason: null }, []).reason === 'unknown',
     'a failure with no reason recorded says so rather than inventing one');
  ok(S.csH1State(null, null).ok === false && S.csH1State(null, null).closed === 0,
     'nothing at all is not a claim that the leg was fine');
  ok(S.csH1State(undefined, many).ok === true,
     'but no result object with a full tape is the array-fallback path, which cannot report failure');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. the measured asymmetry: losing the read RAISES the score');
{
  let seed = 4242;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  function tape(n, sec, drift, vol){
    const out = []; let p = 100;
    for (let i = 0; i < n; i++){
      const r = (rnd() - 0.5) * vol + drift, o = p;
      p = Math.max(1, p * (1 + r));
      out.push({ t: 1e9 + i * sec, o: o, h: Math.max(o, p) * (1 + rnd() * vol * 0.4),
                 l: Math.min(o, p) * (1 - rnd() * vol * 0.4), c: p, v: 1000 + rnd() * 4000 });
    }
    return out;
  }
  const RANK = { weak: 0, standard: 1, professional: 2, 'professional-grade': 3 };
  let up = 0, down = 0, promo = 0, demo = 0, proGain = 0, proLoss = 0, n = 0;
  for (let k = 0; k < 400; k++){
    const drift = (rnd() - 0.5) * 0.004, vol = 0.004 + rnd() * 0.02;
    const r15 = tape(300, 900, drift, vol), r1h = tape(120, 3600, drift * 4, vol * 2);
    const full = S.hgOrderFlowScore('X', r15, r1h);
    const none = S.hgOrderFlowScore('X', r15, []);
    n++;
    const af = Math.abs(full.score || 0), an = Math.abs(none.score || 0);
    if (an > af + 1e-9) up++; else if (an < af - 1e-9) down++;
    const l1dir = rnd() > 0.5 ? 'long' : 'short', l1pct = 0.55 + rnd() * 0.45;
    const a = S.hgComputeThreeLayerConfidence({ pct: l1pct, dir: l1dir },
      { score: full.score || 0, dir: full.direction }, { sentiment: 0 }, {});
    const b = S.hgComputeThreeLayerConfidence({ pct: l1pct, dir: l1dir },
      { score: none.score || 0, dir: none.direction }, { sentiment: 0 }, {});
    if (RANK[b.tier] > RANK[a.tier]) promo++; else if (RANK[b.tier] < RANK[a.tier]) demo++;
    const agA = full.direction === 'neutral' ? 1 : (full.direction === l1dir ? 2 : 0);
    const agB = none.direction === 'neutral' ? 1 : (none.direction === l1dir ? 2 : 0);
    const pa = S.hgIsProGradeSetup({ threeLayerConfidence: a.confidence, layerAgreement: agA,
                                     externalRisk: {}, qualityGates: [], plan: {} });
    const pb = S.hgIsProGradeSetup({ threeLayerConfidence: b.confidence, layerAgreement: agB,
                                     externalRisk: {}, qualityGates: [], plan: {} });
    if (!pa.isPro && pb.isPro) proGain++; else if (pa.isPro && !pb.isPro) proLoss++;
  }
  ok(up > 0 && down > 0, 'the absence moves layer 2 in both directions on individual tapes');
  ok(up > down * 2, 'but it RAISES |score| far more often than it lowers it (' + up + ' up vs ' + down + ' down of ' + n + ')');
  ok(promo > 0, 'and that reaches the tier (' + promo + ' promoted)');
  ok(promo > demo, 'promoting more often than demoting (' + promo + ' vs ' + demo + ')');
  ok(proGain >= proLoss,
     'the PROFESSIONAL-GRADE stamp is handed out more often than taken away ('
     + proGain + ' gained vs ' + proLoss + ' lost) — a dead feed is not a better setup');
  /* the number the card prints is downstream of all of it */
  ok(/threeLayerConfidence: Math\.max\(0, Math\.min\(1, threeLayerConfidence\)\)/.test(SCAN),
     'and the confidence the card prints is that same blend');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. end to end through the real runScan');
{
  let seed = 3;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const N = 300, r15 = []; let px = 100;
  const base = Math.floor(Date.now() / 1000 / SEC) * SEC, t0 = base - N * SEC;
  for (let i = 0; i < N; i++){
    const o = px, c = px * (1 + (rnd() - 0.5 + 0.08) * 0.010);
    r15.push({ t: t0 + i * SEC, o: o, c: c, h: Math.max(o, c) * 1.001,
               l: Math.min(o, c) * 0.999, v: 1000 + rnd() * 1000 });
    px = c;
  }
  const H = Math.floor(Date.now() / 1000 / 3600) * 3600, r1h = [];
  for (let i = 199; i >= 0; i--) r1h.push({ t: H - i * 3600, o: 100, c: 101, h: 102, l: 99, v: 5000 });

  function fakeEl(){
    const nodes = {};
    return {
      _html: '',
      set innerHTML(v){ this._html = String(v); },
      get innerHTML(){ return this._html; },
      querySelector(sel){
        const id = String(sel).replace(/^#/, '');
        if (this._html.indexOf('id="' + id + '"') < 0) return null;
        if (!nodes[id]) nodes[id] = { id: id, innerHTML: '', style: {}, textContent: '',
                                      disabled: false, addEventListener(){},
                                      classList: { toggle(){}, contains(){ return false; } } };
        return nodes[id];
      },
      _node(id){ return nodes[id] || null; }
    };
  }
  const realFetchRes = S.hgDeskFetchKlinesResult;

  /* sabotage is keyed on TF as well as symbol — the 15m leg stays healthy, so
     every one of these contracts is READ, SCORED and SHOWN */
  async function scan(syms, o){
    o = o || {};
    const items = syms.map(x => ({ sym: x, exchange: 'delta', base: x }));
    S.hgDeskLoadDeltaCoinDCX = async () => ({ items: items,
      venueCounts: { delta: items.length, coindcx: 0 }, rawLen: items.length });
    S.hgDeskFetchKlines = async (it, tf) => (tf === '15m' ? r15.slice() : r1h.slice());
    S.hgDeskFetchKlinesResult = async (it, tf) => {
      if (tf === '1h' && o.h1Dead && o.h1Dead.indexOf(it.sym) >= 0)
        return { rows: [], ok: false, reason: o.h1Reason || 'fetch-failed', error: null };
      if (tf === '1h' && o.h1Thin && o.h1Thin.indexOf(it.sym) >= 0)
        return { rows: r1h.slice(0, 12), ok: true, reason: null, error: null };
      return { rows: tf === '15m' ? r15.slice() : r1h.slice(), ok: true, reason: null, error: null };
    };
    S.hgSentimentLoad = async () => ({});
    const tab = (S.HG_tabs || []).filter(t => t && t.id === 'cryptoscan')[0];
    const el = fakeEl();
    tab.mount(el);
    const out = await tab.refresh();
    S.hgDeskFetchKlinesResult = realFetchRes;
    return { out: out, r: S.cryptoScanState(), el: el };
  }

  const clean = await scan(['AAA', 'BBB', 'CCC']);
  ok(clean.out === 'refreshed', 'a clean scan runs');
  ok(clean.r.noH1 === 0, 'with every 1h leg present, noH1 is 0');
  ok(clean.r.scanned === 3 && clean.r.setups.length > 0,
     'three contracts read, and they produce setups (' + clean.r.setups.length + ')');
  ok(clean.r.setups.every(s => s.h1 && s.h1.ok === true),
     'every setup carries a 1h state, and every one of them is ok');
  const cleanCov = text(S.csCoverageHTML(clean.r));
  ok(!/1h leg/.test(cleanCov), 'and the coverage line does not invent a row for it: ' + cleanCov);
  ok(!/1h read missing/.test(text(clean.el._node('csCards').innerHTML)), 'nor does any card');

  const dead = await scan(['AAA', 'BBB', 'CCC'], { h1Dead: ['BBB'] });
  ok(dead.r.scanned === 3, 'with one 1h leg dead the 15m leg is untouched: still 3 scanned');
  ok(dead.r.unread === 0 && dead.r.skipped === 0 && dead.r.errors === 0,
     'the contract is not unread, not skipped and not an error — it was read and shown');
  ok(dead.r.noH1 === 1, 'it is counted exactly once, as noH1 (' + dead.r.noH1 + ')');
  ok(dead.r.noH1Why['fetch-failed'] === 1, 'under the reason the FETCH gave, not a guess');
  const bad = dead.r.setups.filter(s => s.sym === 'BBB')[0];
  ok(bad && bad.h1 && bad.h1.ok === false && bad.h1.reason === 'fetch-failed',
     'and the setup itself carries it, so the card can say so');
  ok(dead.r.setups.filter(s => s.sym === 'AAA')[0].h1.ok === true,
     'while its neighbours on the same scan are unaffected');

  const cov = text(S.csCoverageHTML(dead.r));
  ok(/1 scored without a 1h leg/.test(cov), 'the coverage line names the count: ' + cov);
  ok(/the request failed \(1\)/.test(cov), 'and the reason, in the fetch\'s own words');
  ok(/3 of 3 contracts read/.test(cov),
     'beside "3 of 3 read" — because they WERE read; this is a different silence, not a smaller read');
  ok(/#92400E/.test(S.csCoverageHTML(dead.r)),
     'and the line is coloured as a warning even though the run is not `partial`');
  ok(S.csCoverage(dead.r).partial === false,
     'partial keeps its pinned meaning — contracts the engine never read');

  const thin = await scan(['AAA', 'BBB', 'CCC'], { h1Thin: ['CCC'] });
  ok(thin.r.noH1 === 1 && thin.r.noH1Why['thin-1h'] === 1,
     'a contract with 12 closed 1h bars is counted under its own reason, not as a fetch failure');
  ok(/fewer than 30 closed 1h bars \(1\)/.test(text(S.csCoverageHTML(thin.r))),
     'and the coverage line says which');

  const both = await scan(['AAA', 'BBB', 'CCC'], { h1Dead: ['AAA'], h1Thin: ['CCC'] });
  ok(both.r.noH1 === 2, 'the two causes tally together');
  const bothTxt = text(S.csCoverageHTML(both.r));
  ok(/the request failed \(1\)/.test(bothTxt) && /fewer than 30 closed 1h bars \(1\)/.test(bothTxt),
     'and are still reported apart: ' + bothTxt);

  /* the card — the surface where the tier is actually claimed. renderCards
     writes into #csCards, a child of the host, not the host itself. */
  const deadCards = dead.el._node('csCards');
  ok(deadCards && /cs-card/.test(deadCards.innerHTML), 'the run painted cards');
  const html = text(deadCards.innerHTML);
  ok(/1h read missing/.test(html), 'the card says the read was missing');
  ok(/the request failed/.test(html), 'naming the reason');
  ok(/layer 2 scored on 3 of its 4 reads/.test(html), 'and how many reads the number behind it had');
  ok(/raises its score more often than it lowers it/.test(html),
     'and which way that biases it — the measured direction, not a neutral shrug');
  const cleanHtml = text(clean.el._node('csCards').innerHTML);
  ok(/Confidence/.test(cleanHtml) && !/1h read missing/.test(cleanHtml),
     'a clean card still prints its Confidence line and stays clean');

  /* AN OLDER desk-scan-universe.js, which has no result form at all. The 15m
     leg has carried this fallback since pack 870 and the 1h leg now shares it.
     What it CANNOT do is name a cause -- the old wrapper discards it before
     this file sees anything -- so a leg that arrives empty is reported as
     thin. That is a true statement about what layer 2 was handed (0 < 30) and
     it does not claim the feed was healthy; it simply cannot tell you the
     feed was not. Recorded here as a decision rather than left to be
     rediscovered. */
  const realFetch = S.hgDeskFetchKlines;
  async function legacy(h1rows){
    const items = ['AAA', 'BBB'].map(x => ({ sym: x, exchange: 'delta', base: x }));
    S.hgDeskLoadDeltaCoinDCX = async () => ({ items: items,
      venueCounts: { delta: 2, coindcx: 0 }, rawLen: 2 });
    S.hgDeskFetchKlines = async (it, tf) =>
      (tf === '1h' ? h1rows : r15.slice());
    const savedRes = S.hgDeskFetchKlinesResult;
    delete S.hgDeskFetchKlinesResult;
    S.hgSentimentLoad = async () => ({});
    const tab = (S.HG_tabs || []).filter(t => t && t.id === 'cryptoscan')[0];
    const el = fakeEl(); tab.mount(el);
    await tab.refresh();
    S.hgDeskFetchKlinesResult = savedRes;
    S.hgDeskFetchKlines = realFetch;
    return S.cryptoScanState();
  }
  const legacyOk = await legacy(r1h.slice());
  ok(legacyOk.scanned === 2 && legacyOk.setups.length === 2,
     'with no result form the scan still runs and still produces setups');
  ok(legacyOk.noH1 === 0, 'and a healthy 1h leg is still recognised as healthy');

  const legacyEmpty = await legacy([]);
  ok(legacyEmpty.scanned === 2 && legacyEmpty.noH1 === 2,
     'an empty 1h leg is still COUNTED on the legacy path, not waved through');
  ok(legacyEmpty.noH1Why['thin-1h'] === 2,
     'under thin-1h — the old wrapper destroyed the cause, so none is invented');
  ok(!legacyEmpty.noH1Why['fetch-failed'],
     'and no failure is asserted that this path could not have observed');

  const legacyNull = await legacy(null);
  ok(legacyNull.noH1 === 2 && legacyNull.setups.length === 2,
     'and a null 1h leg is the same story, not a crash');
}

/* ---------------------------------------------------------------- 6 */
console.log('\n6. the note itself, and the tape both surfaces describe');
{
  ok(S.csH1Note({ h1: { ok: true } }) === '', 'a present leg produces no note');
  ok(S.csH1Note({}) === '' && S.csH1Note(null) === '', 'and neither does a setup with no 1h state at all');
  const n = S.csH1Note({ h1: { ok: false, reason: 'thin-1h', closed: 12 } });
  ok(/fewer than 30 closed 1h bars/.test(n), 'a thin leg names the bar count in words');
  ok(/3 of its 4 reads/.test(n), 'and says what layer 2 was left with');
  ok(/1h read missing \(reason not recorded\)/.test(S.csH1Note({ h1: { ok: false, reason: null } })),
     'an unrecorded reason says so rather than printing "null"');
  ok(/1h read missing \(weird-new-reason\)/.test(S.csH1Note({ h1: { ok: false, reason: 'weird-new-reason' } })),
     'and a reason with no label falls through as itself, never swallowed');

  const scan = stripComments(SCAN);
  /* ONE TRIM. The counter and the card must describe the same tape, or the
     coverage line can say the leg was fine about a card scored without it. */
  ok((scan.match(/csClosedRows\(rows1h/g) || []).length === 1,
     'the 1h tape is trimmed exactly once in the whole scan');
  ok(/var closed1h = csClosedRows\(rows1h, 3600, now\);\s*var h1 = csH1State\(got1h, closed1h\);/.test(scan),
     'and csH1State judges that same trimmed tape');
  const trimAt = scan.indexOf('var closed1h = csClosedRows(rows1h');
  const useAt = scan.indexOf('hgOrderFlowScore(item.sym, closed15, closed1h)');
  ok(trimAt > 0 && useAt > trimAt, 'which is the tape layer 2 is then handed');
  ok(/noH1Why\[h1\.reason\] = \(noH1Why\[h1\.reason\] \|\| 0\) \+ 1;/.test(scan),
     'the tally is keyed by that same reason');
  ok(/noH1: noH1, noH1Why: noH1Why,/.test(scan), 'and both reach __results');
  ok(/csWhyText/.test(scan), 'one why-text body serves both legs');
  ok((scan.match(/CS_UNREAD_LABELS\[k\] \|\| k/g) || []).length === 1,
     'so the label lookup exists once, not once per leg');

  /* A CAUSE THAT DID NOT HAPPEN IS NOT A CAUSE. The tally only ever
     increments, so the scan cannot produce a zeroed key -- but a run object
     rebuilt from an older shape, or hand-assembled, can, and "the request
     failed (0)" on the coverage line is a false statement about the feed. The
     guard predates this pack; it now serves two legs, so it is pinned. */
  const zeroed = S.csCoverageHTML({ universe: 3, scanned: 3, noH1: 1,
    noH1Why: { 'thin-1h': 1, 'fetch-failed': 0, 'no-source': 0 }, setups: [] });
  ok(/fewer than 30 closed 1h bars \(1\)/.test(text(zeroed)),
     'the cause that happened is named');
  ok(!/\(0\)/.test(text(zeroed)),
     'and a cause with a count of zero is not printed at all: ' + text(zeroed));
  ok(!/the request failed/.test(text(zeroed)) && !/no candle source/.test(text(zeroed)),
     'so the line never claims a failure the scan did not see');
  ok(!/\(0\)/.test(text(S.csCoverageHTML({ universe: 3, scanned: 3, unread: 1,
       unreadWhy: { 'fetch-failed': 1, 'bad-shape': 0 }, setups: [] }))),
     'and the 15m leg gets that for free, from the same body');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
