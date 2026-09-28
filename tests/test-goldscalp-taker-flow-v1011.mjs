/* HARDGATE — hg-v1011: GOLDSCALP'S TAKER-FLOW CONFIRMATION.

   Gate 1 knows what time it is, gate 15 knows whether the crowd showed up —
   this read knows which SIDE the crowd is hitting. A scalp borrows the next
   few bars from whoever is aggressing the tape; a long minted into net
   aggressive selling is borrowing against the lender. The desk now reads
   REAL Binance taker long/short flow (omniroute.js's hgOmniCvd) over the 30
   windows up to each candidate's own signal bar — only when the 15m leg's
   own feed is the Binance gold perp the flow belongs to (the hg-v1009
   independence rule: the candle stand-in derives from the same closes the
   tape gates already read, so it never speaks here). Flow AGAINST demotes
   (paints, named reason, never MOST PROBABLE); flow WITH chips; anything
   unreadable demotes nothing.

   Harness: classic scripts in a vm context (the v1009 route). The desk seam
   rides the HG_tabs registration (hg-v967/v968) — zero new module-scope
   exports, so the render-integrity guard stays green. hgOmniCvd is the REAL
   primitive from omniroute.js; every number below was derived by probing it
   on these exact fixtures, never asserted blind.

   Run: node tests/test-goldscalp-taker-flow-v1011.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(withOmni){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array,
    JSON, Error, Promise, RegExp, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, addEventListener(){}, setAttribute(){}, querySelector:()=>null, querySelectorAll:()=>[] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, body: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  const files = withOmni === false ? ['goldscalp.js'] : ['indicators.js', 'omniroute.js', 'goldscalp.js'];
  for (const f of files)
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return ctx;
}
function seam(W){ const t = W.HG_tabs.filter(function(x){ return x.id === 'goldscalp'; })[0]; return t || {}; }

/* The fixture: 120 bars of 15m, a mild uptrend, t in SECONDS (the desk's
   own unit — hgSessionVolPct's harness proved the same). T0 is the last
   bar's open instant. */
const T0 = 1750000000;
function tape(){
  const rows = []; let c = 3000;
  for (let i = 0; i < 120; i++){
    const o = c; c = c + 0.6;
    rows.push({ t: T0 - (119 - i) * 900, o, h: Math.max(o, c) + 0.4, l: Math.min(o, c) - 0.4, c, v: 1000 });
  }
  return rows;
}
function taker(ratio, n, endT){
  const s = [];
  for (let k = n - 1; k >= 0; k--) s.push({ buySellRatio: ratio, t: endT - k * 900 });
  return { latest: s[s.length - 1], series: s };
}
/* probed on the real hgOmniCvd over this exact tape: 30 windows of 0.8 ->
   delta -3.33 source taker dir short divergence bear (price up into
   selling); 1.25 -> +3.33 long, no divergence; 1.0 -> delta 0; 0-ratios ->
   source 'candles' (the stand-in this gate refuses to hear). */
const SELL = taker(0.8, 500, T0), BUY = taker(1.25, 500, T0),
      FLAT = taker(1.0, 500, T0), JUNK = taker(0, 500, T0);
function cand(dir, extra){
  return Object.assign({ sym: 'XAUUSD', dir: dir, signalT: T0 * 1000,
                         entry: 3600, stop: dir === 'long' ? 3590 : 3610, t1: dir === 'long' ? 3620 : 3580 }, extra || {});
}

console.log('== the read — real flow, sliced at the signal bar ==');
{
  const W = boot(); const f = seam(W).takerFlowScan;
  ok(typeof f === 'function', 'the taker-flow pass rides the HG_tabs registration (no 20th export)');

  const long = cand('long'), short = cand('short');
  const out = f([long, short], tape(), SELL);
  ok(out.read === 'taker', 'a real series on a real tape reads as taker flow');
  ok(out.demoted === 1 && out.stamped === 2, 'one demoted (the long), both stamped');
  ok(long.demoted === true, 'the long into net aggressive selling is demoted');
  ok(long.stamps.indexOf('FLOW AGAINST') >= 0, 'the FLOW AGAINST stamp lands');
  ok(/taker flow against/.test((long.gateNotes || [])[0] || '') && /net selling/.test(long.gateNotes[0])
     && /bear divergence/.test(long.gateNotes[0]),
     'the named reason says what was read: selling flow, bear divergence, against a long');
  ok(long.takerFlow.verdict === 'against' && long.takerFlow.delta === -3.33 && long.takerFlow.bars === 30,
     'the stamp carries the probed numbers (delta -3.33 over 30 windows)');
  ok(short.demoted !== true && short.takerFlow.verdict === 'with' && short.takerFlow.delta === -3.33,
     'the same selling flow is WITH the short — evidence, not a demotion');
  ok(short.takerFlow.divergence === 'bear', 'the divergence rides the stamp for the chip title');

  const long2 = cand('long');
  const out2 = f([long2], tape(), BUY);
  ok(out2.demoted === 0 && long2.takerFlow.verdict === 'with' && long2.takerFlow.delta === 3.33,
     'buying flow backs a long — WITH, never a demote');
}

console.log('== causality — a stale setup is judged on the flow that existed THEN ==');
{
  const W = boot(); const f = seam(W).takerFlowScan;
  /* the tape changed its mind 40 windows ago: buying before, selling since */
  const flip = { latest: null, series: taker(1.25, 460, T0 - 40 * 900).series.concat(taker(0.8, 40, T0).series) };
  flip.latest = flip.series[flip.series.length - 1];
  const stale = cand('long', { signalT: (T0 - 40 * 900) * 1000 });
  const fresh = cand('long');
  f([stale, fresh], tape(), flip);
  ok(stale.takerFlow.verdict === 'with',
     'the stale long is judged on the buying flow that existed at ITS bar — not on the selling that came after');
  ok(fresh.takerFlow.verdict === 'against' && fresh.demoted === true,
     'the fresh long answers to the selling tape of NOW');
  const noT = cand('long', { signalT: undefined });
  f([noT], tape(), SELL);
  ok(noT.takerFlow.verdict === 'against',
     'a candidate with no readable mint instant is judged at the tape end — the scan just ran');
}

console.log('== honest degradation — what cannot be read demotes nothing ==');
{
  const W = boot(); const f = seam(W).takerFlowScan;
  const none = f([cand('long')], tape(), null);
  ok(none.read === 'no real flow' && none.demoted === 0 && none.stamped === 0,
     'no taker series (a non-Binance feed, a failed fetch) — the pass stands aside entirely');
  const junk = cand('long');
  const oJunk = f([junk], tape(), JUNK);
  ok(oJunk.read === 'taker' && junk.takerFlow.verdict === 'unreadable' && junk.demoted !== true,
     'junk ratios fall back to the candle stand-in — and the stand-in never speaks here (the independence rule)');
  const flat = cand('short');
  f([flat], tape(), FLAT);
  ok(flat.takerFlow.verdict === 'unreadable' && flat.demoted !== true,
     'a zero delta is no side — UNREAD, never a coin-flip verdict');
  const ancient = cand('long', { signalT: (T0 - 900 * 900) * 1000 });
  f([ancient], tape(), SELL);
  ok(ancient.takerFlow.verdict === 'unreadable' && /thin slice/.test(ancient.takerFlow.why || ''),
     'a signal bar beyond the fetched windows slices too thin to judge — UNREAD, named why');
  const locked = cand('long', { locked: true }), vetoed = cand('long', { vetoed: true }),
        dropped = cand('long', { dropped: true }), noDir = { sym: 'XAUUSD', signalT: T0 * 1000 },
        noSym = cand('long'); delete noSym.sym;
  const oSkip = f([locked, vetoed, dropped, noDir, noSym], tape(), SELL);
  ok(oSkip.stamped === 0 && oSkip.demoted === 0
     && !locked.takerFlow && !vetoed.takerFlow && !dropped.takerFlow && !noDir.takerFlow && !noSym.takerFlow
     && locked.demoted !== true,
     'locked / vetoed / dropped / sym-less / dir-less rows are skipped — the trade you are IN keeps running');
  const thinTape = f([cand('long')], tape().slice(0, 12), SELL);
  ok(thinTape.read === 'no real flow', 'a tape under 30 bars cannot host the look — stands aside');
  const W2 = boot(false);
  const off = seam(W2).takerFlowScan([cand('long')], tape(), SELL);
  ok(off.read === 'unavailable', 'hgOmniCvd absent — feature-checked away, nothing stamped, nothing thrown');
}

console.log('== the chip — reads the stamp, never recomputes ==');
{
  const W = boot(); const chip = seam(W).takerFlowChipHtml;
  ok(typeof chip === 'function', 'the chip rides the same registration');
  const a = chip({ dir: 'long', takerFlow: { verdict: 'against', delta: -3.33, bars: 30, divergence: 'bear' } });
  ok(/gpip bad/.test(a) && /TAKER FLOW AGAINST · never MOST PROBABLE/.test(a) && /bear divergence/.test(a),
     'AGAINST renders bad, says never-lead, names the divergence');
  const w = chip({ dir: 'short', takerFlow: { verdict: 'with', delta: -3.33, bars: 30, divergence: null } });
  ok(/gpip ok/.test(w) && /TAKER FLOW WITH IT/.test(w) && /never a tally point/.test(w),
     'WITH renders ok and says what it is worth — evidence, never a tally point');
  const u = chip({ dir: 'long', takerFlow: { verdict: 'unreadable', why: 'thin slice at the signal bar' } });
  ok(/TAKER FLOW UNREAD/.test(u) && /thin slice/.test(u) && !/gpip bad/.test(u),
     'UNREAD renders neutral and names why — a gate that looked and could not speak');
  ok(chip({ dir: 'long' }) === '' && chip(null) === '' && chip({ takerFlow: {} }) === '',
     'no stamp, no chip — an absent read is not decorated');
}

console.log('== wiring pins — the shipped file actually calls it ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'goldscalp.js'), 'utf8');
  ok(/flowScan = gsTakerFlowScan\(ranked, gold && gold\.rows15m, gsTaker\)/.test(src),
     'runScan calls the pass on the ranked board with the main 15m tape');
  ok(/gsTkFeed === 'binance-xau'\) \? 'XAUUSDT'/.test(src) && /gsTkFeed === 'binance-paxg'\) \? 'PAXGUSDT'/.test(src),
     'the fetch is keyed on the 15m leg\'s own feed — the hg-v1009 flow-of-the-tape rule');
  ok(/await gsTkFn\(gsTkSym, '15m', 500\)/.test(src), 'one cached 15m fetch per scan, 500 windows deep');
  ok(src.indexOf('+ gsTakerFlowChipHtml(c)') > src.indexOf('+ gsSessionChipHtml(c)'),
     'the chip renders on the card beside its session-floor sibling');
  ok(/16\) TAKER-FLOW CONFIRMATION/.test(src), 'the header names gate 16 — the contract documents itself');
  const note = /TAKER FLOW — '.{0,20}\+ flowScan\.demoted/.test(src);
  ok(note, 'a demotion reaches the scan legs line — nothing is dropped silently');
}

console.log('\ntest-goldscalp-taker-flow-v1011: ' + passed + ' passed, 0 failed');
