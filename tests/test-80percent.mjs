/* HARDGATE — the 80PERCENT tab: a supplied strategy, implemented literally
   and priced honestly.

   THE SPEC, which this file checks line by line rather than in spirit:

     5-minute XAUUSD; EMA(200), EMA(50), RSI(14), ATR(14)
     session 13:00-18:00 UTC ONLY
     long   close > EMA50 AND EMA50 > EMA200 AND RSI < 45 AND close > open
     short  close < EMA50 AND EMA50 < EMA200 AND RSI > 55 AND close < open
     entry  the trigger candle's close
     target entry +/- 0.75 x ATR
     stop   entry -/+ 4.00 x ATR

   Nothing is loosened or "improved". A supplied strategy that gets quietly
   adjusted is no longer the thing that was asked for, and the person who
   supplied it can no longer tell whether it works.

   THE ARITHMETIC IT CANNOT ESCAPE, which is why the tab leads with it:

     risking 4.00 to make 0.75 is 1:5.333, so the win rate that breaks even
     BEFORE COST is 4.00/4.75 = 84.2105%. The claim is 85%: 0.79 points of
     margin, worth +0.0375 ATR a trade.

     Cost eats it. On this desk's own numbers (gold ~4358, 5m ATR ~3.32) a
     round trip at XM's 0.020% is ~0.87 against a target of ~2.49 — 35% of
     the entire winner. The cost-adjusted bar is 89.74%, not 84.21%, and at
     the claimed 85% the strategy nets -0.0563R per trade. At PAXG's 0.26%
     the required rate exceeds 100% and no win rate can save it.

   The tab must therefore COMPUTE that bar from live ATR and the selected
   venue rather than carry a number baked in here — if volatility widens,
   the verdict genuinely changes and the card has to follow it.

   Run: node tests/test-80percent.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };
const near = (a, b, eps) => Math.abs(a - b) <= (eps == null ? 1e-9 : eps);

const store = {};
const el = () => ({ style: {}, innerHTML: '', textContent: '', className: '',
  classList: { add(){}, remove(){}, toggle(){}, contains: () => false },
  appendChild(){}, setAttribute(){}, addEventListener(){},
  querySelector: () => null, querySelectorAll: () => [], dataset: {} });
const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
              parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Infinity, NaN,
              Float64Array, setTimeout: () => 0, clearTimeout: () => {},
              localStorage: { getItem: k => (k in store ? store[k] : null),
                              setItem: (k, v) => { store[k] = String(v); },
                              removeItem: k => { delete store[k]; } } };
ctx.document = { createElement: el, getElementById: () => null, querySelector: () => null,
                 querySelectorAll: () => [], head: el(), body: el(), documentElement: el(),
                 addEventListener(){}, readyState: 'complete' };
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = [];
vm.createContext(ctx);
for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                 'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js', 'omniroute.js',
                 'omnigold.js', 'eightypercent.js']){
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
  catch (e) { /* optional deps degrade */ }
}
const SRC = fs.readFileSync(path.join(ROOT, 'eightypercent.js'), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* A series that ends on a bar which MUST fire a long: a long uptrend (so
   EMA50 > EMA200 and close > EMA50), then a run of red bars to drive RSI
   under 45, then one green trigger — anchored so the last bar sits at 15:00
   UTC, inside the window. */
function series(n, opts){
  const o = opts || {};
  const endHour = o.endHour == null ? 15 : o.endHour;
  const base = Date.UTC(2026, 8, 16, endHour, 0, 0) / 1000 - (n - 1) * 300;
  const rows = [];
  let px = o.start == null ? 4000 : o.start;
  const up = o.down ? -1 : 1;
  for (let i = 0; i < n; i++){
    const t = base + i * 300;
    const oo = px;
    let c;
    if (i < n - 8) c = px + 1.2 * up;             /* the trend */
    else if (i < n - 1) c = px - 2.6 * up;        /* the pullback */
    else c = px + 1.4 * up;                       /* the trigger */
    rows.push({ t, o: oo, h: Math.max(oo, c) + 0.4, l: Math.min(oo, c) - 0.4, c, v: 100 });
    px = c;
  }
  return rows;
}

console.log('== the tab exists, in the gold group ==');
{
  const tab = (ctx.HG_tabs || []).find(t => t && t.id === '80percent');
  ok(!!tab, '80percent registers on HG_tabs');
  ok(tab.label === '80PERCENT', 'with the label 80PERCENT');
  ok(typeof tab.mount === 'function' && typeof tab.refresh === 'function', 'and both lifecycle hooks');
  const gold = HTML.match(/\{ id:'gold',[^\n]*tabs:\[([^\]]*)\]/);
  ok(!!gold && /'80percent'/.test(gold[1]), 'and it is in the GOLD group, not the TOOLS fallback');
  const iInd = HTML.indexOf('<script src="indicators.js');
  const iP80 = HTML.indexOf('<script src="eightypercent.js');
  ok(iInd > 0 && iP80 > iInd, 'loaded after indicators.js, whose ema/rsi/atr it uses');
}

console.log('\n== every constant is the spec\'s, to the digit ==');
{
  const S = ctx.HG_P80_SPEC;
  ok(S.tf === '5m', 'timeframe is 5m');
  ok(S.emaFast === 50 && S.emaSlow === 200, 'EMA 50 and 200');
  ok(S.rsiLen === 14 && S.atrLen === 14, 'RSI(14) and ATR(14)');
  ok(S.rsiLong === 45, 'long pullback threshold is RSI < 45');
  ok(S.rsiShort === 55, 'short pullback threshold is RSI > 55');
  ok(S.tpAtr === 0.75, 'target is 0.75 x ATR');
  ok(S.slAtr === 4.00, 'stop is 4.00 x ATR');
  ok(S.utcFrom === 13 && S.utcTo === 18, 'session is 13:00-18:00 UTC');
}

console.log('\n== the session filter admits exactly five hours ==');
{
  const day = Date.UTC(2026, 8, 16) / 1000;
  const inHours = [];
  for (let h = 0; h < 24; h++) if (ctx.hg80InSession(day + h * 3600)) inHours.push(h);
  ok(inHours.join(',') === '13,14,15,16,17',
     'hours 13-17 are in, so the last eligible bar opens 17:55 (' + inHours.join(',') + ')');
  ok(!ctx.hg80InSession(day + 18 * 3600), '18:00 itself is OUT — the window is [13:00, 18:00)');
  ok(!ctx.hg80InSession(day + 12 * 3600 + 3599), '12:59 is out');
  ok(ctx.hg80InSession(day + 13 * 3600), 'and 13:00 exactly is in');
  ok(!ctx.hg80InSession(0) && !ctx.hg80InSession(NaN) && !ctx.hg80InSession(null),
     'a bar with no usable timestamp is OUT of session, never quietly in it');
}

console.log('\n== all four conditions must hold on the same candle ==');
{
  const rows = series(280);
  const ind = ctx.hg80Indicators(rows);
  ok(!!ind, 'indicators compute on 280 bars');
  const last = rows.length - 1;
  const sig = ctx.hg80SignalAt(rows, ind, last);
  ok(!!sig, 'the last bar evaluates');
  ok(sig.longChecks.trend === true, 'trend: close > EMA50 > EMA200');
  ok(sig.rsi < 45 && sig.longChecks.pullback === true, `pullback: RSI ${sig.rsi.toFixed(2)} < 45`);
  ok(sig.longChecks.trigger === true, 'trigger: the candle closed green');
  ok(sig.longChecks.session === true, 'session: the bar is inside 13:00-18:00 UTC');
  ok(sig.dir === 'long', 'so it fires LONG');

  /* and each condition is load-bearing — break one, lose the signal */
  const outOfHours = series(280, { endHour: 9 });
  const oi = ctx.hg80Indicators(outOfHours);
  const os = ctx.hg80SignalAt(outOfHours, oi, outOfHours.length - 1);
  ok(os.longChecks.trend && os.longChecks.pullback && os.longChecks.trigger,
     'the same setup outside the window still passes the other three');
  ok(os.longChecks.session === false && os.dir === null,
     'but the session filter alone kills it — the window is not decorative');

  /* a red final candle fails the trigger even with everything else true */
  const redEnd = series(280);
  const n = redEnd.length - 1;
  redEnd[n] = Object.assign({}, redEnd[n], { c: redEnd[n].o - 1.0 });
  const ri = ctx.hg80Indicators(redEnd);
  const rs = ctx.hg80SignalAt(redEnd, ri, n);
  ok(rs.longChecks.trigger === false && rs.dir === null,
     'a red close fails the long trigger, whatever the trend says');
}

console.log('\n== a short is the mirror, not a re-derivation ==');
{
  const rows = series(280, { down: true, start: 4600 });
  const ind = ctx.hg80Indicators(rows);
  const sig = ctx.hg80SignalAt(rows, ind, rows.length - 1);
  ok(sig.shortChecks.trend === true, 'trend: close < EMA50 < EMA200');
  ok(sig.rsi > 55 && sig.shortChecks.pullback === true, `pullback: RSI ${sig.rsi.toFixed(2)} > 55`);
  ok(sig.shortChecks.trigger === true, 'trigger: the candle closed red');
  ok(sig.dir === 'short', 'so it fires SHORT');
  ok(sig.longChecks.trend === false, 'and the long side is simultaneously false — they cannot both fire');
}

console.log('\n== the exit protocol is exactly 0.75 and 4.00 ATR ==');
{
  const rows = series(280);
  const ind = ctx.hg80Indicators(rows);
  const sig = ctx.hg80SignalAt(rows, ind, rows.length - 1);
  const p = ctx.hg80Plan(sig);
  ok(p.entry === sig.close, 'entry is the trigger candle\'s CLOSE, per the spec');
  ok(near(p.reward / sig.atr, 0.75, 1e-12), `target is 0.7500 x ATR (${(p.reward / sig.atr).toFixed(6)})`);
  ok(near(p.risk / sig.atr, 4.00, 1e-12), `stop is 4.0000 x ATR (${(p.risk / sig.atr).toFixed(6)})`);
  ok(near(p.rr, 4 / 0.75, 1e-12), `R:R is 1 : ${p.rr.toFixed(4)}`);
  ok(p.t1 > p.entry && p.stop < p.entry, 'a long targets above and stops below');

  const sh = { dir: 'short', close: 4000, atr: 2 };
  const ps = ctx.hg80Plan(sh);
  ok(ps.t1 < ps.entry && ps.stop > ps.entry, 'and a short is the mirror of that');
  ok(near(ps.t1, 4000 - 1.5) && near(ps.stop, 4000 + 8),
     'with the same multiples: 0.75x2 below, 4.00x2 above');

  ok(ctx.hg80Plan({ dir: 'long', close: 100, atr: 0 }) === null, 'a zero ATR prices nothing');
  ok(ctx.hg80Plan(null) === null, 'and no signal prices nothing — never a throw');
}

console.log('\n== the breakeven is arithmetic, and the tab computes it ==');
{
  const B = ctx.hg80Breakeven;

  /* 4.00 / (4.00 + 0.75) — a constant of the spec, whatever the market does */
  const bare = B(NaN, NaN, NaN);
  ok(near(bare.gross, 4 / 4.75, 1e-12),
     `the gross breakeven is ${(100 * bare.gross).toFixed(4)}% — fixed by the R:R alone`);
  ok(bare.net === null, 'and with no ATR or venue the cost-adjusted bar is null, never guessed');

  /* the desk's own numbers: gold 4358.55, 5m ATR ~3.319 */
  const atr = 3.319, px = 4358.55;
  const xm = B(atr, px, 0.00020);
  ok(near(xm.risk, 4 * atr, 1e-9) && near(xm.target, 0.75 * atr, 1e-9), 'risk and target scale with ATR');
  ok(near(xm.cost, px * 0.00020, 1e-9), 'cost is the round trip on this price');
  ok(xm.net > xm.gross,
     `cost RAISES the bar: ${(100 * xm.net).toFixed(2)}% at XM vs ${(100 * xm.gross).toFixed(2)}% gross`);
  ok(xm.net > 0.85,
     'and it lands ABOVE the claimed 85%, so the claim does not clear its own spread');
  ok(near(xm.net, (xm.cost + xm.risk) / (xm.risk + xm.target), 1e-12),
     'computed as (cost + risk) / (risk + target), not approximated');

  const paxg = B(atr, px, 0.0026);
  ok(paxg.net > 1,
     `at PAXG's 0.26% the required rate is ${(100 * paxg.net).toFixed(1)}% — above 100%, so unreachable`);

  /* expectancy at the CLAIMED rate, cost included */
  const e85 = ctx.hg80ExpectancyR(0.85, xm);
  ok(e85 < 0, `at 85% the strategy nets ${e85.toFixed(4)}R per trade at XM — a loss`);
  const eNeeded = ctx.hg80ExpectancyR(xm.net, xm);
  ok(Math.abs(eNeeded) < 1e-9, 'and at exactly the computed bar it nets zero, which is what breakeven means');

  /* the relationship that decides everything: a wider ATR dilutes the fixed
     spread, so the bar falls. The tab must track that, not a baked number. */
  const wide = B(atr * 4, px, 0.00020);
  ok(wide.net < xm.net,
     `a 4x wider ATR lowers the bar to ${(100 * wide.net).toFixed(2)}% — the verdict genuinely moves`);
  ok(wide.net > wide.gross, 'though never below the gross bar, which no volatility can change');
}

console.log('\n== the tab shows the arithmetic rather than asserting a verdict ==');
{
  ok(/hg80Breakeven\(lastAtr, lastPx/.test(SRC), 'the bar is computed from the LIVE ATR and price');
  ok(/hg80VenueRt/.test(SRC), 'at the venue the desk is currently set to');
  ok(/hgOgVenueCost/.test(SRC), 'read from the gold desk\'s own cost model, not a second copy');
  ok(/84\.2105/.test(SRC), 'the gross bar is stated in the prose, where it is a constant');
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/89\.7|0\.0563|156\./.test(code),
     'but no cost-adjusted verdict is hard-coded in the CODE — those move with ATR');
  ok(/it needs/.test(SRC), 'and the card prints the required rate it computed');
}

console.log('\n== nothing about the spec was quietly improved ==');
{
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  /* the numbers that would be tempting to "fix" */
  ok(/P80_TP_ATR\s*=\s*0\.75/.test(code), 'the target was not widened to make the maths work');
  ok(/P80_SL_ATR\s*=\s*4\.00/.test(code), 'the stop was not tightened');
  ok(/P80_RSI_LONG\s*=\s*45/.test(code) && /P80_RSI_SHORT\s*=\s*55/.test(code),
     'the RSI thresholds are the supplied ones');
  /* exactly one declaration of each multiple, so there is no second R:R
     policy anywhere in the file to disagree with the spec */
  ok((code.match(/P80_SL_ATR\s*=/g) || []).length === 1, 'the stop multiple is declared exactly once');
  ok((code.match(/P80_TP_ATR\s*=/g) || []).length === 1, 'and the target multiple exactly once');
  /* NO SECOND R:R POLICY — which is the property this was after, and it is
     now checked directly rather than by banning a word.

     The tab reads its own forward ledger, and the shared reader takes a
     minRr. Omitting it gets the desk-wide 2R default, which would judge
     these trades against a target they never had, so one has to be passed.
     What must never happen is a NUMBER: the moment a literal appears there
     is a second R:R in the file free to disagree with 0.75 / 4.00. So the
     value is required to be derived from the two multiples themselves. */
  ok(/minRr: hg80FwdMinRr\(\)/.test(code),
     'the only minRr passed anywhere is hg80FwdMinRr()');
  ok(/function hg80FwdMinRr\(\)\{ return P80_TP_ATR \/ P80_SL_ATR; \}/.test(
       code.replace(/\s+/g, ' ').replace(/\{ /g, '{').replace(/ \}/g, '}')
           .replace(/function hg80FwdMinRr\(\)\{return/, 'function hg80FwdMinRr(){ return')
           .replace(/P80_SL_ATR;\}/, 'P80_SL_ATR; }'))
     || /return P80_TP_ATR \/ P80_SL_ATR;/.test(code),
     'and it is COMPUTED from the spec multiples, not a number of its own');
  ok(!/minRr\s*[:=]\s*[0-9]/.test(code),
     'no numeric minRr literal anywhere — a second R:R policy could disagree with the spec, '
     + 'which is what this guard has always been for');

  /* the desk's 0.50% stop floor is CONTRADICTED by a 4 ATR 5m stop, and the
     card says so rather than silently clipping the level */
  /* the apostrophe is backslash-escaped in the source string literal, so
     match around it rather than through it */
  ok(/below this desk\\?'s [^]{0,40}floor/.test(SRC),
     'where the plan sits under the desk\'s stop floor, the card says so');
  ok(!/Math\.max\([^)]*stopFloor/.test(code), 'and does not clip the stop to satisfy it');
}

console.log('\n== it is a WATCH, and it records so it can stop being one ==');
{
  /* THE RULE, NOT THE WORDING. This pinned the literal "WATCH, NOT A
     TICKET", which was a thirty-five word block repeated on every FULL
     card — and which also asserted, without checking, that the strategy
     had no measured record. hg-v803 replaced it with the ledger-reading
     line the SIMPLE card already used, and moved the standing claims into
     the panel preamble where they are said once. What must hold is that
     every card is marked a WATCH and that the 85% is named as a claim. */
  ok(/WATCH — not a signal to act on/.test(SRC),
     'every setup renders as a WATCH, through the one line both card renderers share');
  ok(/WATCH, not a ticket/.test(SRC), 'and the panel says so over the cards too');
  ok(/hg-v756/.test(SRC), 'citing the rule that makes measured-edge hard');
  ok(/own claim and not a measurement/.test(SRC),
     'and naming the 85% as a claim rather than a measurement');
  ok(!/WATCH, NOT A TICKET/.test(SRC),
     'with the old per-card block gone rather than duplicated alongside it');

  for (const k of Object.keys(store)) delete store[k];
  const rows = series(280);
  const ind = ctx.hg80Indicators(rows);
  const sig = ctx.hg80SignalAt(rows, ind, rows.length - 1);
  sig.plan = ctx.hg80Plan(sig);
  const rec = ctx.hg80Record(sig);
  ok(rec.ok === true && rec.reason === 'recorded', 'a fired setup is written to the forward log');

  const log = JSON.parse(ctx.localStorage.getItem('hg_forward_v1') || '[]');
  ok(log.length === 1, 'asserted against the LOG, not against what the recorder returned');
  ok(log[0].tab === 'OMNIGOLD:P80', 'under its own tab, so it is judged as itself');
  ok(log[0].ticket === false, 'as a non-ticket');
  ok(log[0].gateClear !== true, 'and not gate-clear — it was put to no gates');
  ok(log[0].barT % 300 === 0, 'with barT floored to the 5m bar, the log\'s dedup rule');

  const again = ctx.hg80Record(sig);
  ok(again.ok === false && again.reason === 'already recorded',
     'the same bar twice records once, and the card is told which');
  for (const k of Object.keys(store)) delete store[k];
}

console.log('\n== no win rate is displayed that was not measured ==');
{
  /* the tab lists historical firings; it must NOT resolve them and quote a
     rate, because nothing here has walked them forward */
  ok(/NOT a backtest/.test(SRC), 'the historical list says it is not a backtest');
  ok(/no win rate is shown/i.test(SRC), 'and that no win rate is shown from it');
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/winRate|hitRate/.test(code), 'and the code computes no win rate at all');
  /* The 85% may appear — the card has to name the claim it is testing. What
     it must never do is appear UNQUALIFIED, as though it were a measured
     result. So every occurrence has to sit next to the word that marks it
     as an assertion. */
  /* flattened first: the copy is built by string concatenation, so a
     qualifier can sit on the next source line and still be the same
     sentence to a reader */
  const flat = code.replace(/P80/g, '').replace(/'\s*\+\s*'/g, '').replace(/\s+/g, ' ');
  const hits = [...flat.matchAll(/.{0,90}8[05]%.{0,90}/g)].map(m => m[0]);
  ok(hits.length > 0, 'the card does mention the claimed rate — it is what is under test');
  const unqualified = hits.filter(h => !/claim|assert/i.test(h));
  ok(unqualified.length === 0,
     'and every mention is marked as a CLAIM, never stated as a result'
     + (unqualified.length ? ' — bare: ' + JSON.stringify(unqualified[0]) : ''));
}

console.log('\n' + passed + ' passed, 0 failed');
