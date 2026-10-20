/* HARDGATE — hg-v1417 CANDLE FORECAST admission floor.

   The desk's first outcome census (38.5k 15m + 2.5k 4h PAXG bars, 13+ months,
   both chronological halves, independently re-run) measured what this desk's
   reads are worth; this pack moves three PUBLICATION seams and pins them:

     1. hgCfSwingHtfConfirm is three-state (confirm / read-and-declined /
        never-measured) and hgCfBuildSetup stamps published:false + the
        withhold sentence on a formed 4h whose higher-timeframe-structure
        voter read and did not lean with the call. Fail-open ONLY on the two
        unmeasured states: no confluence, no higher tape handed in.
     2. The publication seams honor the flag: the swing card (swingHasLevels),
        the day list (hgCfDaySwings.take) and the executable card + alert
        (executionCard candidate build). The ledger keeps recording BOTH
        cohorts under the new cf:htfWith mark (added to the reads bag AFTER
        the pinned hgCfPatternMarks call — the v1358 shapes survive verbatim).
     3. The measured scalp cost floor (0.25% of entry): sub-floor scalp
        brackets are NO-TRADE with the cost named; at or past the floor a
        scalp still arms. The 4h swing outranks.
     4. Display-only census lines: the pattern-against READ caution (a veto
        was measured and refused — formed setups against the pattern vote do
        NOT anti-predict), the COMPRESSION annotation (annotation, not gate),
        the five-timeframe line, and the strength anti-calibration honesty
        line. The engine result carries the additive patternVotes field.

   Mutation checklist (each must go RED): delete the floor check (§5 flips),
   zero CF_MIN_SCALP_STOP_PCT (§10), drop the published clause in
   swingHasLevels (§3), drop the take() refusal (§4), return null always from
   hgCfSwingHtfConfirm (§1/§2), write the mark outside the reads bag (§6),
   drop patternVotes from the engine return (§7), remove the caution line
   (§8), gate instead of annotate on COMPRESSION (§9 — levels must still
   print).

   Run: node tests/test-cf-admission-floor-v1406.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const GOLDIND = read('goldind.js');
const INTEL = read('candle-forecast-intel.js');
const TAB = read('gold-candle-forecast.js');
const INDICATORS = read('indicators.js');

let pass = 0;
function ok(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
  pass++;
  console.log('  ok - ' + msg);
}
function lift(name) {
  const start = GOLDIND.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('could not locate ' + name);
  let depth = 0, i = GOLDIND.indexOf('{', start), end = -1;
  for (; i < GOLDIND.length; i++) {
    const c = GOLDIND[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end < 0) throw new Error('could not close ' + name);
  return GOLDIND.slice(start, end);
}
function tape(n, step, startC, ivSec) {
  const rows = [];
  const t0 = 1760000000;
  let c = startC || 4100;
  for (let i = 0; i < n; i++) {
    c += (step == null ? 0.25 : step);
    rows.push({ t: t0 + i * (ivSec || 900), o: c - 0.2, h: c + 2, l: c - 2, c, v: 10 });
  }
  return rows;
}
function compressingTape(n) { /* ATR now far under the 60-median: COMPRESSION */
  const rows = [];
  const t0 = 1760000000;
  let c = 4100;
  for (let i = 0; i < n; i++) {
    c += 0.05;
    const wide = i < n - 15;
    rows.push({ t: t0 + i * 14400, o: c, h: c + (wide ? 10 : 0.4), l: c - (wide ? 10 : 0.4), c, v: 10 });
  }
  return rows;
}
function bootGoldind(extra) {
  const window = Object.assign({}, extra || {});
  const ctx = { console, window, Date, Math, isFinite, JSON, NaN, Array, Object, String, Number, Boolean };
  ctx.window = ctx; Object.assign(ctx, window);
  vm.createContext(ctx);
  vm.runInContext(INDICATORS, ctx, { filename: 'indicators.js' });
  vm.runInContext(GOLDIND, ctx, { filename: 'goldind.js' });
  return ctx;
}
function htfFc(lean, why) { /* a formed 4h forecast carrying a confluence */
  return {
    dir: 'BULL', close: 100, atr: 1, sl: 98, tp1: 102, tp2: 104, stopSource: 'pattern',
    setup: 'LONG SETUP', setupParts: 'hammer + structure', patterns: ['hammer'], advancedPatterns: [],
    reasons: [], session: 'LONDON',
    confluence: {
      ok: true, why: 'families with', ticket: true, familiesWith: 2, familiesAgainst: 0,
      with_: 3, against: 0, unread: 5, desks: [],
      voters: [{ family: 'higher', name: 'higher-timeframe structure', lean: lean, why: why || '' }]
    }
  };
}
function swingBracket(over) {
  return Object.assign({
    ok: true, tf: '4h', dir: 'BULL', formed: true, label: 'LONG SETUP',
    entry: 100, stop: 98, tp1: 102, tp2: 104, rr: 2, riskAtr: 2, stopSource: 'pattern',
    parts: 'hammer', patterns: ['hammer'], advancedPatterns: [], confluenceView: null,
    why: 'LONG SETUP on 4h — hammer'
  }, over || {});
}
function bootTab() {
  const window = { HG_tabs: [], HG_BUILD: { version: 'hg-v1417' } };
  const ctx = {
    console, window,
    document: { getElementById: () => null },
    Date, isFinite, Math, setTimeout, Promise, JSON
  };
  vm.createContext(ctx);
  vm.runInContext(INTEL, ctx, { filename: 'candle-forecast-intel.js' });
  vm.runInContext(TAB, ctx, { filename: 'gold-candle-forecast.js' });
  const mod = window.HG_tabs.find(t => t && t.id === 'candle-forecast');
  if (!mod) throw new Error('the candle-forecast tab did not register');
  return { window, mod };
}
function renderWith(mod, forecast) {
  const container = { innerHTML: '', className: '' };
  const statusEl = { textContent: '' };
  mod.renderResult(container, statusEl, forecast);
  return { html: container.innerHTML, status: statusEl.textContent };
}
function baseForecast(over) {
  return Object.assign({
    dir: 'BULL', close: 100, strength: 1.234, driftT: 1.234, agrees: 2, against: 0, checked: 5,
    reasons: [], patterns: ['hammer'], advancedPatterns: [], desk: 'unread', tabs: 'unread',
    higher: 'unread', note: 'test note', source: 'test-feed', macroRead: false,
    confluence: null, ultimate: null, measure: null, scalp: null, swing: null,
    daySwings: { ok: true, setups: [], why: 'none today' }
  }, over || {});
}

/* ------------------------------------------------------------------ */
console.log('== 1) hgCfSwingHtfConfirm is three-state, fail-open only on the unmeasured ==');
{
  const ctx = bootGoldind();
  const F = ctx.hgCfSwingHtfConfirm;
  ok(typeof F === 'function', 'the helper is exported (window.hgCfSwingHtfConfirm)');
  const cv = (lean, why) => ({ confluenceView: { ok: true, voters: [{ family: 'higher', name: 'higher-timeframe structure', lean: lean, why: why || '' }] } });
  ok(F(cv(true, '1d bull BOS')) === true, 'lean WITH the call confirms');
  ok(F(cv(null, '1d no structure')) === false, 'the voter read and DECLINED — the measured withheld cohort, not a fail-open');
  ok(F(cv(false, '1d bear CHoCH')) === false, 'the voter read AGAINST — false as well');
  ok(F(cv(null, 'no higher tape was handed in')) === null, 'a rows1d load failure is never measured — fail open');
  ok(F({}) === null, 'no confluence is never measured — fail open');
  ok(F({ confluenceView: { ok: true } }) === null, 'no voters array is fail open');
  ok(F({ confluenceView: { ok: true, voters: [{ family: 'technicals', name: 'RSI(14) vs 50', lean: true, why: '' }] } }) === null,
     'a voter list without the higher voter is fail open');
}

console.log('\n== 2) hgCfBuildSetup stamps the publication flag on a formed 4h, and only there ==');
{
  const ctx = bootGoldind();
  const rows = tape(40, 0.25, 100, 14400);
  const declined = ctx.hgCfBuildSetup(rows, { tf: '4h' }, htfFc(null, '1d no structure'));
  ok(declined.formed === true, 'the fixture forms (sanity)');
  ok(declined.htfConfirm === false && declined.published === false, 'read-and-declined stamps published:false');
  ok(/higher timeframe does not confirm/.test(declined.why) && /withheld/.test(declined.why),
     'the withhold sentence is on the bracket why');
  ok(/58% next-candle/.test(declined.why) && /\+0\.28R at XM/.test(declined.why),
     'the why carries the census numbers (confirmed 58% / +0.28R XM)');
  ok(/The 4h read stands/.test(declined.why), 'the read still stands — publication gate, not a veto');
  ok(declined.entry === 100 && declined.stop === 98 && declined.tp1 === 102,
     'the bracket object still exists for the ledger and the horizon table');
  const confirmed = ctx.hgCfBuildSetup(rows, { tf: '4h' }, htfFc(true, '1d bull BOS'));
  ok(confirmed.published === true && confirmed.htfConfirm === true, 'a confirming voter publishes');
  const noConf = ctx.hgCfBuildSetup(rows, { tf: '4h' }, Object.assign(htfFc(true, 'x'), { confluence: null }));
  ok(noConf.published === true && noConf.htfConfirm === null, 'no confluence fails OPEN (published, unread mark)');
  const noTape = ctx.hgCfBuildSetup(rows, { tf: '4h' }, htfFc(null, 'no higher tape was handed in'));
  ok(noTape.published === true && noTape.htfConfirm === null, 'a rows1d load failure fails OPEN');
  const scalp = ctx.hgCfBuildSetup(rows, { tf: '15m' }, htfFc(null, '1d no structure'));
  ok(scalp.published === true && scalp.htfConfirm === null,
     'the flag gates nothing on the 15m lane (the mark still rides its ledger record — §6)');
}

console.log('\n== 3) the swing card honors the flag (swingHasLevels) ==');
{
  const { mod } = bootTab();
  const withheld = renderWith(mod, baseForecast({
    swing: swingBracket({
      published: false, htfConfirm: false,
      why: 'LONG SETUP on 4h — hammer · The 4h read stands, but the higher timeframe does not confirm it, so the bracket is withheld. In the desk census (13 months, 455 formed swings) confirmed reads hit 58% next-candle and paid +0.28R at XM costs; unconfirmed reads hit 44% and paid -0.13R. Nothing was invented.'
    })
  }));
  ok(/higher timeframe does not confirm/.test(withheld.html), 'the withheld swing prints the withhold sentence');
  ok(!/Entry <b>/.test(withheld.html), 'the withheld swing prints no levels');
  ok(withheld.status === 'No swing setup', 'the status line stands down');
  const shown = renderWith(mod, baseForecast({ swing: swingBracket({ published: true }) }));
  ok(/Entry <b>/.test(shown.html) && /Stop:/.test(shown.html), 'a confirmed swing prints its bracket');
  const legacy = renderWith(mod, baseForecast({ swing: swingBracket({}) }));
  ok(/Entry <b>/.test(legacy.html), 'a bracket without the field prints exactly as before (fail open)');
}

console.log('\n== 4) the day list refuses an unpublished swing, fail-open on the walked class ==');
{
  const ctx = bootGoldind();
  const rows = tape(20, 0.25, 100, 14400); /* < 30 bars: live-only arm, no walk */
  const refused = ctx.hgCfDaySwings(rows, { live: swingBracket({ published: false }), limit: 2 });
  ok(refused.setups.length === 0, 'an unpublished swing is not on the day list');
  ok(/formed, then the higher timeframe did not confirm, so it is not shown/.test(refused.why),
     'the day list says WHY it is not shown');
  const taken = ctx.hgCfDaySwings(rows, { live: swingBracket({ published: true }), limit: 2 });
  ok(taken.setups.length === 1, 'a published swing is confirmed');
  const walkedClass = ctx.hgCfDaySwings(rows, { live: swingBracket({}), limit: 2 });
  ok(walkedClass.setups.length === 1, 'a setup without the field (the walked class) is confirmed — same fail-open class as familiesAgainst');
}

console.log('\n== 5) the executable card: the unpublished swing is skipped, the scalp floor is measured ==');
{
  const { window } = bootTab();
  const I = window.hgCfIntel;
  const unpub = I.executionCard({ close: 100, swing: swingBracket({ published: false, ticket: true }) });
  ok(unpub.state === 'NO-TRADE', 'an unpublished swing never reaches the executable card');
  const subFloor = I.executionCard({ close: 100, scalp: { ok: true, dir: 'BULL', entry: 100, stop: 99.9, tp1: 100.2, formed: true, ticket: true } });
  ok(subFloor.state === 'NO-TRADE' && /cost floor/.test(subFloor.why),
     'a 0.1% scalp stop is NO-TRADE and names the measured cost floor');
  ok(/-0\.28R per trade at XM costs and -3\.43R at Binance/.test(subFloor.why),
     'the NO-TRADE why carries the census numbers');
  const wide = I.executionCard({ close: 100.1, scalp: { ok: true, dir: 'BULL', entry: 100, stop: 99.7, tp1: 100.6, formed: true, ticket: true } });
  ok(wide.state === 'ARMED' && wide.horizon === 'SCALP', 'a 0.3% scalp stop arms — the floor is a floor, not a ban');
  const boundary = I.executionCard({ close: 100.1, scalp: { ok: true, dir: 'BULL', entry: 100, stop: 99.75, tp1: 100.5, formed: true, ticket: true } });
  ok(boundary.state === 'ARMED', 'exactly 0.25% of entry is admitted (the floor is inclusive)');
  const skipWins = I.executionCard({
    close: 100.1,
    scalp: { ok: true, dir: 'BULL', entry: 100, stop: 99.7, tp1: 100.6, formed: true, ticket: true },
    swing: swingBracket({ published: false, ticket: true })
  });
  ok(skipWins.horizon === 'SCALP', 'the unpublished swing is SKIPPED, not ranked — the wide scalp picks');
}

console.log('\n== 6) the ledger rides cf:htfWith on both lanes and records BOTH cohorts ==');
{
  let lastRecord = null;
  const sandbox = {
    console,
    hgCfHost: () => null,
    hgFwdResolve: () => 0,
    hgFwdRecordScan: (pool, frame, recs) => { lastRecord = { pool, frame, rec: recs && recs[0] }; return recs ? recs.length : 0; },
    hgCfPerfectAsk: () => null,
    hgCfWalk: () => null
  };
  vm.createContext(sandbox);
  vm.runInContext(
    lift('hgCfSwingHtfConfirm') + '\n' + lift('hgCfPatternMarks') + '\n' + lift('hgCfForwardMark') + '\n' +
    'this.hgCfForwardMark = hgCfForwardMark;', sandbox);
  const rows = tape(60, 1, 2500);
  const mk = (tf, lean, why) => ({
    formed: true, dir: 'BULL', entry: 2600, stop: 2590, tp1: 2620, tp2: 2640, tf: tf, ticket: true,
    patterns: ['hammer'], advancedPatterns: [],
    confluenceView: { ok: true, voters: [{ family: 'higher', name: 'higher-timeframe structure', lean: lean, why: why || '' }] }
  });
  const r1 = sandbox.hgCfForwardMark(mk('4h', true, '1d bull BOS'), rows, '4h');
  ok(r1.recorded === 1 && lastRecord.rec.reads['cf:htfWith'] === true, 'a confirmed swing records cf:htfWith true');
  ok(lastRecord.rec.reads['pattern:anyFire'] === true, 'the v1351 pattern marks still ride beside it');
  const withheld = mk('4h', null, '1d no structure'); withheld.published = false;
  const r2 = sandbox.hgCfForwardMark(withheld, rows, '4h');
  ok(r2.recorded === 1, 'the WITHHELD bracket still records — both cohorts stay measurable');
  ok(lastRecord.rec.reads['cf:htfWith'] === false, 'cf:htfWith false rides the withheld cohort');
  const r3 = sandbox.hgCfForwardMark(mk('15m', null, '1d no structure'), rows, '15m');
  ok(r3.recorded === 1 && lastRecord.rec.reads['cf:htfWith'] === false,
     'the mark rides the 15m book too (it gates nothing there — the scalp book stays splittable)');
  const noConf = mk('4h', true, 'x'); delete noConf.confluenceView;
  const r4 = sandbox.hgCfForwardMark(noConf, rows, '4h');
  ok(r4.recorded === 1 && !(lastRecord.rec.reads && ('cf:htfWith' in lastRecord.rec.reads)),
     'unreadable confluence state: the mark is ABSENT, never a guessed false (hg-v989)');
}

console.log('\n== 7) the engine result carries the additive patternVotes field ==');
{
  const ctx = bootGoldind();
  const fc = ctx.goldCandleForecast(tape(60, 0.5, 100), null, null);
  ok(fc && fc.patternVotes && typeof fc.patternVotes.bull === 'number' && typeof fc.patternVotes.bear === 'number',
     'patternVotes { bull, bear } rides the engine result');
  ok(fc && !('confidence' in fc), 'the hg-v1309 shape is untouched — still no confidence key');
}

console.log('\n== 8) the pattern-against READ caution (a veto was measured and refused) ==');
{
  const { mod } = bootTab();
  const scalpRead = pv => baseForecast({
    swing: swingBracket({ published: true }),
    scalp: { ok: true, tf: '15m', dir: 'BULL', formed: false, label: 'LONG READ', entry: 100, stop: 99, tp1: 101, why: 'no 15m setup: test', patterns: [], advancedPatterns: [] },
    patternVotes: pv
  });
  const against = renderWith(mod, scalpRead({ bull: 0, bear: 2 }));
  ok(/candle-pattern layer votes against this read/.test(against.html) && /41% next-candle/.test(against.html),
     'an unformed 15m read the patterns vote against names the caution with the census number');
  const withIt = renderWith(mod, scalpRead({ bull: 2, bear: 0 }));
  ok(!/candle-pattern layer votes against/.test(withIt.html), 'a read the patterns vote WITH prints no caution');
  const formedR = renderWith(mod, baseForecast({
    swing: swingBracket({ published: true }),
    scalp: { ok: true, tf: '15m', dir: 'BULL', formed: true, label: 'LONG SETUP', entry: 100, stop: 99, tp1: 101, why: 'formed', patterns: [], advancedPatterns: [] },
    patternVotes: { bull: 0, bear: 2 }
  }));
  ok(!/candle-pattern layer votes against/.test(formedR.html),
     'a FORMED setup against the pattern vote prints NO caution (that cohort does not anti-predict — the veto was refused)');
  const noVotes = renderWith(mod, baseForecast({ swing: swingBracket({ published: true }), scalp: { ok: true, tf: '15m', dir: 'BULL', formed: false, label: 'LONG READ', entry: 100, stop: 99, tp1: 101, why: 'x', patterns: [], advancedPatterns: [] } }));
  ok(!/candle-pattern layer votes against/.test(noVotes.html), 'no patternVotes field, no line (fail open)');
}

console.log('\n== 9) the census lines annotate and never gate ==');
{
  const { mod } = bootTab();
  const compressing = renderWith(mod, baseForecast({
    swing: swingBracket({ published: true }),
    _c4: compressingTape(80),
    _c15: tape(60, 0.5), _tapes: { rows1h: tape(60, 0.5), rows1d: tape(60, 0.5) }
  }));
  ok(/last 20 bars compress/.test(compressing.html) && /45% next-candle/.test(compressing.html),
     'a COMPRESSION swing regime prints its measured 45% hit rate');
  ok(/Entry <b>/.test(compressing.html), 'COMPRESSION does NOT gate — the bracket still publishes (the R halves disagreed, so annotation only)');
  ok(/Four of five timeframes align/.test(compressing.html) && /62%/.test(compressing.html),
     'a four-of-five alignment is named on the card (+13.8pp, n=750 — named, not trusted)');
  ok(/Do not read it as confidence/.test(compressing.html) && /WORST bucket \(43%\)/.test(compressing.html),
     'the strength anti-calibration honesty line prints');
  const bare = renderWith(mod, baseForecast({ swing: swingBracket({ published: true }) }));
  ok(!/last 20 bars compress/.test(bare.html) && !/Four of five timeframes align/.test(bare.html),
     'no tapes stashed, no regime or alignment lines (fail open in hand-built fixtures)');
  ok(/Do not read it as confidence/.test(bare.html), 'the strength line still prints — it reads the engine field alone');
}

console.log('\n== 10) mutation guards and the pinned shapes ==');
{
  ok(/var CF_MIN_SCALP_STOP_PCT = 0\.25;/.test(INTEL), 'the scalp floor is the MEASURED constant (0.25%)');
  ok(!/CF_MIN_SCALP_STOP_PCT\s*=\s*0(?:\.0+)?\s*;/.test(INTEL), 'the floor constant is not zeroed (mutation guard)');
  ok(/window\.hgCfSwingHtfConfirm = hgCfSwingHtfConfirm/.test(GOLDIND), 'the admission read is exported');
  ok(/b\.published === false\) return/.test(TAB) || /if \(b\.published === false\) return false;/.test(TAB),
     'the card honors the publication flag (mutation guard)');
  ok(/reads = hgCfPatternMarks\(setup, rows\)/.test(GOLDIND), 'the hg-v1358 pinned call site survives verbatim');
  ok(/reads: reads/.test(GOLDIND), 'the hg-v1358 record shape survives verbatim');
  ok(/record\('CANDLE FORECAST', frame,/.test(GOLDIND), 'the ONE pool and writer are untouched');
  const bs = read('build-stamp.js');
  const v = (bs.match(/version\s*:\s*'hg-v(\d+)'/) || [])[1];
  const html = read('index.html');
  ok(!!v && html.indexOf('gold-candle-forecast.js?v=' + v) >= 0 && html.indexOf('candle-forecast-intel.js?v=' + v) >= 0,
     'index.html loads both desk scripts at the stamped version (hg-v' + v + ')');
}

console.log('\n' + pass + ' passed, 0 failed');
