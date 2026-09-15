/* HARDGATE — OPTI GOLD: the rule, and proof it does not read the future.

   Run: node tests/test-optigold.mjs

   THE BUG THIS TAB WAS BORN FROM
   ------------------------------
   The supplied Python marked swings with a CENTRED rolling window
   (`.rolling(2*w+1, center=True)`), so the level at bar i was computed from
   bars i-5 .. i+5 — five bars of future. Those levels were forward-filled and
   compared against the current close to detect the break, which means every
   signal was partly informed by candles that had not printed. It backtests
   beautifully and cannot be traded.

   The decisive assertion here is PREFIX INVARIANCE: signals computed on
   rows[0..T] must be identical to the same signals computed on the full
   series. If any future bar can change a past signal, the rule is looking
   ahead. Under the original centred-window logic this test fails; it is the
   reason the tab exists in this form.

   (Outcome fields — state, resolvedAt — DO legitimately depend on later bars.
   They report what became of a setup; they never inform it. They are excluded
   from the invariance comparison and asserted separately.) */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array,
    JSON, Error, Promise, RegExp, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.document = { createElement: () => ({ style: {}, appendChild(){}, addEventListener(){} }),
                   querySelector: () => null, addEventListener(){} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'optigold.js'), 'utf8'), ctx, { filename: 'optigold.js' });
  return ctx;
}
const W = boot();

/* deterministic synthetic tape: a range, an upside break, a retrace, a drift */
function tape(){
  const rows = [];
  let t = 1700000000;
  const bar = (o, h, l, c) => rows.push({ t: (t += 3600), o, h, l, c });
  for (let i = 0; i < 14; i++) bar(100, 101, 99, 100);        /* seed ATR */
  for (let i = 0; i < 6; i++) bar(100, 102, 98, 100);          /* range */
  bar(100, 106, 99, 101);                                     /* swing high 106 */
  for (let i = 0; i < 6; i++) bar(101, 102, 98, 100);
  bar(100, 101, 94, 99);                                      /* swing low 94 */
  for (let i = 0; i < 8; i++) bar(99, 101, 98, 100);          /* confirm both */
  bar(100, 108, 99, 107);                                     /* BOS above 106 */
  for (let i = 0; i < 20; i++) bar(107, 108, 99, 101);        /* drift back down */
  return rows;
}

console.log('== the rule core is reachable without a live gold feed ==');
ok(typeof W.__ogSignals === 'function', '__ogSignals exported — runOptiGold needs network, so the rule must be liftable');
ok(typeof W.__ogSwings === 'function' && typeof W.__ogAtr === 'function', 'swing and ATR helpers exported');
ok(W.HG_tabs.some(t => t.id === 'optigold' && t.label === 'OPTI GOLD'), 'the tab registers as optigold / OPTI GOLD');

console.log('== a swing is not knowable until it is confirmed ==');
{
  const rows = [];
  for (let i = 0; i < 40; i++) rows.push({ t: i * 3600, o: 100, h: i === 20 ? 110 : 100, l: 99, c: 100 });
  const sw = W.__ogSwings(rows, 5);
  const hi = sw.find(s => s.i === 20);
  ok(hi && hi.kind === 'high' && hi.px === 110, 'the spike at bar 20 is detected as a swing high');
  ok(hi.confirmedAt === 25, 'confirmedAt is i+swingLength (25), not i — a centred window would say 20');
  ok(sw.every(s => s.confirmedAt > s.i), 'no swing is ever confirmed on the bar it printed');
}

console.log('== PREFIX INVARIANCE — the lookahead detector ==');
{
  const rows = tape();
  const full = W.__ogSignals(rows, {});
  ok(full.length > 0, 'the synthetic tape produces at least one setup (' + full.length + ')');

  const key = s => [s.i, s.dir, s.entry.toFixed(6), s.stop.toFixed(6), s.t1.toFixed(6)].join('|');

  /* THE DECISIVE DIRECTION — full -> minimal prefix.
     For every signal the full series produces at bar i, recompute on rows[0..i]
     — the least data that contains bar i and NOTHING after it. A causal rule
     must produce the identical signal, because it only ever consulted swings
     already confirmed by bar i. A lookahead rule cannot: on the full series it
     used a swing that bar i could not yet see, and that swing is absent here.

     Comparing prefix -> full instead (the obvious direction) is BLIND to this:
     a lookahead prefix simply yields FEWER signals, and every one it does yield
     still matches. My first version of this test made exactly that mistake and
     passed the injected bug. */
  let checked = 0, missing = 0, changed = 0;
  for (const f of full){
    const pre = W.__ogSignals(rows.slice(0, f.i + 1), {});
    const p = pre.find(x => x.i === f.i);
    checked++;
    if (!p) { missing++; continue; }
    if (key(p) !== key(f)) changed++;
  }
  ok(checked > 0, 'every full-series signal was re-derived from data ending at its own bar (' + checked + ')');
  ok(missing === 0,
     'each signal still appears when NOTHING after its bar exists — ' + missing + ' vanished');
  ok(changed === 0,
     'and none changed value — ' + changed + ' differed. A lookahead rule fails both.');

  /* the reverse direction too, so a rule cannot pass by inventing signals late */
  let late = 0;
  for (let T = 30; T <= rows.length; T++){
    const pre = W.__ogSignals(rows.slice(0, T), {});
    for (const p of pre) if (!full.find(x => x.i === p.i && key(x) === key(p))) late++;
  }
  ok(late === 0, 'no prefix invented a signal the full series does not have (' + late + ')');
}

console.log('== the discriminating case: a level broken while a HIGHER swing is unconfirmed ==');
{
  /* This is the tape that actually separates causal from lookahead, and it took
     two failed attempts to find. The obvious construction does not work: a bar
     only qualifies as a swing high if nothing exceeds it for `len` bars AFTER,
     so a break of that level cannot occur inside its own confirmation window —
     breaking it would disqualify it. The lookahead is partly self-limiting.

     The difference is INVERTED instead. With a centred window, resistance jumps
     to a new, higher swing EARLY — suppressing a break of the older, lower level
     that a causal rule legitimately fires. Here: resistance 105 is confirmed, a
     higher swing 110 prints at bar 28 but cannot be known until bar 33, and
     price closes 106 at bar 29.
       causal    -> resistance is still 105, 106 > 105, BOS fires
       lookahead -> resistance is already 110, 106 < 110, signal SUPPRESSED */
  const rows = []; let tt = 1700000000;
  const bar = (h, l, c) => rows.push({ t: (tt += 3600), o: c, h, l, c });
  for (let i = 0; i < 14; i++) bar(101, 99, 100);
  for (let i = 0; i < 3; i++) bar(102, 98, 100);
  bar(101, 94, 99);                                  /* swing low 94 */
  for (let i = 0; i < 3; i++) bar(102, 98, 100);
  bar(105, 99, 101);                                 /* swing high 105 */
  for (let i = 0; i < 6; i++) bar(102, 98, 100);
  bar(110, 99, 101);                                 /* swing high 110 — unconfirmed until bar 33 */
  bar(107, 99, 106);                                 /* close 106 crosses the CONFIRMED 105 */
  for (let i = 0; i < 2; i++) bar(107, 99, 106);
  for (let i = 0; i < 12; i++) bar(102, 98, 100);

  const sigs = W.__ogSignals(rows, {});
  ok(sigs.length === 1, 'exactly one setup fires on the discriminating tape (got ' + sigs.length + ')');
  ok(sigs[0].i === 29, 'it fires at bar 29, the bar that crossed the confirmed level (got ' + sigs[0].i + ')');
  ok(sigs[0].res === 105,
     'it used the CONFIRMED resistance 105, not the unconfirmed 110 (got ' + sigs[0].res + ')');
  ok(sigs[0].dir === 'long', 'and it is a long');
  /* under the original centred-window logic this array is EMPTY — the rule sees
     110 at bar 29 and suppresses the break. That is the regression this pins. */
}

console.log('== the rule mechanics match the specification ==');
{
  const rows = tape();
  const sigs = W.__ogSignals(rows, { swingLength: 5, atrPeriod: 14, stopAtr: 1.5, rr: 2 });
  const s = sigs[0];
  ok(s.dir === 'long', 'the upside break produces a long (got ' + s.dir + ')');
  ok(Math.abs(s.entry - (s.res + s.sup) / 2) < 1e-9, 'entry is the 50% equilibrium of the broken range');
  ok(Math.abs(s.stop - (s.sup - 1.5 * s.atr)) < 1e-9, 'stop is 1.5xATR beyond the opposite structural level');
  ok(Math.abs(s.risk - (s.entry - s.stop)) < 1e-9, 'risk is entry minus stop');
  ok(Math.abs(s.t1 - (s.entry + 2 * s.risk)) < 1e-9, 'target is entry + 2R');
  ok(s.entry < s.brokeAt, 'the long entry rests BELOW the breakout close — it is a retracement limit, not a market fill');
  ok(s.retracePct > 0, 'the distance price must retrace to fill is reported (' + s.retracePct.toFixed(2) + '%)');
}

console.log('== outcome resolution is pessimistic and honest ==');
{
  const rows = tape();
  const sigs = W.__ogSignals(rows, {});
  const states = new Set(sigs.map(s => s.state));
  ok(sigs.every(s => ['waiting', 'open', 'target', 'stopped', 'missed'].includes(s.state)),
     'every setup carries a known state (' + [...states].join(', ') + ')');
  ok(sigs.every(s => s.state !== 'open' || s.filledAt != null), 'an open setup records when it filled');
}

console.log('== a rising tape with no structure break yields nothing ==');
{
  const rows = [];
  for (let i = 0; i < 120; i++) rows.push({ t: i * 3600, o: 100 + i, h: 100 + i + 0.5, l: 100 + i - 0.5, c: 100 + i });
  const sigs = W.__ogSignals(rows, {});
  ok(sigs.length === 0, 'a monotonic ramp has no swing highs to break, so no setups are invented (' + sigs.length + ')');
}

console.log('== forward rows reject missing levels rather than coercing them ==');
{
  const R = W.__ogFwdRows;
  const base = { dir: 'long', state: 'waiting', entry: 100, stop: 95, t1: 110 };
  ok(R([base]).length === 1, 'a complete live setup is recorded');
  ok(R([{ ...base, state: 'stopped' }]).length === 0, 'only LIVE orders are recorded, not settled history');
  for (const [label, patch] of [
    ['stop null', { stop: null }], ['stop empty', { stop: '' }],
    ['entry null', { entry: null }], ['t1 undefined', { t1: undefined }],
  ]) ok(R([{ ...base, ...patch }]).length === 0, label + ' → dropped, not coerced to zero');
  ok(R([{ ...base, entry: 100, stop: 100 }]).length === 0, 'zero risk is unscoreable in R and is refused');
  ok(R([base])[0].ticket === false, 'never flagged a ticket — the rule is unmeasured by design');
  ok(/BOS-RETRACE/.test(R([base])[0].mechanic), 'mechanic names the rule so the forward log can judge it separately');
  ok(JSON.stringify(R(null)) === '[]' && JSON.stringify(R([])) === '[]', 'degenerate input returns []');
}

console.log('== degenerate input never throws ==');
{
  ok(JSON.stringify(W.__ogSignals(null, {})) === '[]', 'null rows → []');
  ok(JSON.stringify(W.__ogSignals([], {})) === '[]', 'empty rows → []');
  ok(JSON.stringify(W.__ogSignals([{ t: 1, o: 1, h: 1, l: 1, c: 1 }], {})) === '[]', 'one bar → []');
  const flat = [];
  for (let i = 0; i < 80; i++) flat.push({ t: i, o: 100, h: 100, l: 100, c: 100 });
  ok(Array.isArray(W.__ogSignals(flat, {})), 'a flat tape (zero ATR) returns an array rather than throwing');
}

console.log('== three lanes, and the SAME rule on each ==');
{
  const L = W.__ogLanes;
  ok(Array.isArray(L) && L.length === 3, 'three lanes are defined (' + (L && L.length) + ')');
  ok(L.map(x => x.key).join(',') === 'scalp,intraday,swing', 'scalp / intraday / swing — got ' + L.map(x => x.key).join(','));
  ok(L.map(x => x.interval).join(',') === '15m,1h,4h', 'on 15m / 1h / 4h — got ' + L.map(x => x.interval).join(','));

  /* THE DESIGN DECISION THIS PINS. Three lanes with three tuned parameter sets
     would be three separately-fitted rules wearing one name, and nothing here
     has the evidence to justify per-lane tuning. If someone later "improves"
     one lane's stop or target in isolation, this fails and asks them why. */
  for (const field of ['swingLength', 'atrPeriod', 'stopAtr', 'rr']){
    const vals = new Set(L.map(x => x[field]));
    ok(vals.size === 1, 'every lane shares the same ' + field + ' (' + [...vals].join('/') + ') — no per-lane fitting');
  }
  const horizons = new Set(L.map(x => x.horizonBars));
  ok(horizons.size > 1, 'but horizons DO differ by lane, matched to the style rather than the rule');
  ok(L.every(x => x.horizonBars > 0 && x.bars > 0), 'every lane has a positive horizon and bar count');
}

console.log('== distance is measured from the live mark, in ATR ==');
{
  const D = W.__ogDistance;
  const s = { entry: 100, atr: 2 };
  const above = D(s, 104);
  ok(above.px === 4, 'absolute distance is |mark - entry| (4)');
  ok(above.atr === 2, 'and 2x the ATR of 2 — the unit that compares across lanes');
  ok(Math.abs(above.pct - (4 / 104 * 100)) < 1e-9, 'percent is relative to the mark, not the entry');
  ok(above.side === 'above', 'side says the mark is ABOVE the entry — price must fall to fill a long');
  ok(D(s, 96).side === 'below', 'and below when it is under the entry');
  ok(D(s, 100).side === 'at', 'and "at" when they coincide');

  /* the same absolute move is a different distance on a different lane */
  ok(D({ entry: 100, atr: 1 }, 104).atr === 4 && D({ entry: 100, atr: 8 }, 104).atr === 0.5,
     'identical 4-point gap reads as 4xATR on a tight lane and 0.5xATR on a wide one');

  /* +null is 0 and isFinite(0) is true — a missing mark must not become a price */
  for (const bad of [null, undefined, '', NaN, 'abc'])
    ok(D(s, bad) === null, 'a missing mark (' + JSON.stringify(bad) + ') returns null, never a distance from zero');
  ok(D(null, 100) === null && D({}, 100) === null, 'a missing setup returns null');
  ok(D({ entry: 100 }, 104).atr === null, 'no ATR yields a null ATR distance rather than Infinity or NaN');
}

console.log('== a FILLED position is read differently from a resting order ==');
{
  /* The bug this pins was live on the page: 8 of 10 live setups had already
     filled, and every card still said "price must fall 0.52xATR to fill".
     Distance-to-entry is meaningless once an order is done. */
  const O = W.__ogOpenRead;
  const long = { dir: 'long', entry: 100, stop: 95, t1: 110, risk: 5 };

  const half = O(long, 105);
  ok(half.unrealR === 1, 'a long 5 points up on 5 of risk is +1.00R');
  ok(half.toStopR === 2, 'with 2R of room back to the stop');
  ok(half.toTargetR === 1, 'and 1R left to the target');

  const down = O(long, 97.5);
  ok(down.unrealR === -0.5, 'below entry it reads negative (-0.50R)');
  ok(down.toStopR === 0.5, 'and the room to the stop shrinks to 0.5R');

  const short = O({ dir: 'short', entry: 100, stop: 105, t1: 90, risk: 5 }, 95);
  ok(short.unrealR === 1, 'a short measures the opposite way (+1.00R at 95)');

  /* the mark can outrun a state resolved on closed bars */
  ok(O(long, 94).beyondStop === true && O(long, 94).beyondTarget === false, 'a mark past the stop is flagged');
  ok(O(long, 111).beyondTarget === true, 'and a mark past the target is flagged');
  ok(O(long, 105).beyondStop === false && O(long, 105).beyondTarget === false, 'a mark between them is flagged as neither');

  for (const bad of [null, undefined, '', NaN])
    ok(O(long, bad) === null, 'a missing mark (' + JSON.stringify(bad) + ') returns null, never a fabricated R');
  ok(O({ dir: 'long', entry: 100, stop: 100, t1: 110, risk: 0 }, 105) === null, 'zero risk returns null rather than dividing by zero');
  ok(O(null, 100) === null, 'a missing setup returns null');
}

console.log('== the card asks the right question for each state ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'optigold.js'), 'utf8');
  ok(/ogOpenRead\(s, mark\)/.test(src), 'card() consults ogOpenRead for filled positions');
  ok(/s\.state === 'open'/.test(src), 'and branches on the filled state rather than treating all live alike');
  ok(/RUNNING/.test(src) && /RESTING/.test(src), 'the render separates running positions from resting orders');
}

console.log('== forward records are tagged by lane ==');
{
  const R = W.__ogFwdRows;
  const base = { dir: 'long', state: 'waiting', entry: 100, stop: 95, t1: 110 };
  const scalp = R([base], 'scalp')[0].mechanic;
  const swing = R([base], 'swing')[0].mechanic;
  ok(scalp !== swing, 'lanes get DIFFERENT mechanics (' + scalp + ' vs ' + swing + ')');
  ok(/SCALP/.test(scalp) && /SWING/.test(swing), 'each names its own lane');
  ok(/LONG/.test(scalp) && /SHORT/.test(R([{ ...base, dir: 'short' }], 'scalp')[0].mechanic),
     'direction is still in the mechanic');
  ok(R([base], 'scalp')[0].mechanic.length <= 28, 'mechanic fits the forward log field (<=28 chars)');
  ok(/BOS-RETRACE/.test(R([base])[0].mechanic), 'an untagged call still names the rule rather than throwing');
}

console.log('== the source documents the lookahead it removed ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'optigold.js'), 'utf8');
  ok(/center=True|centred/i.test(src), 'the centred-window defect is documented for the next reader');
  ok(/confirmedAt/.test(src), 'the confirmation clock is explicit in the code');
  /* the prefix-invariance test above is the real proof; this is the anti-dead-code
     guard — the confirmation clock must be CONSULTED in the signal loop, not merely
     computed and ignored, which is how a guard silently stops guarding */
  ok(/confirmedAt\s*<=\s*t/.test(src), 'the signal loop actually gates on confirmedAt <= t');
  ok(/__ogSignals\s*=\s*ogSignals/.test(src), 'the tested function is the one the tab uses');
}

console.log('\ntest-optigold: ' + passed + ' assertions passed');
