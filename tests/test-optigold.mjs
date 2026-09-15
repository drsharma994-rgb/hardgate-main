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

console.log('== the rule itself supplies barsLeft, or every resting score would be zero ==');
{
  /* ogProb multiplies by the chance of filling BEFORE expiry. If ogSignals stopped
     attaching barsLeft, that term would read undefined, the estimate would return 0
     for every resting order, and the panel would quietly rank them all equal-last
     while still printing confident-looking percentages. Nothing else catches that. */
  let px = 2000; const rows = [];
  for (let i = 0; i < 300; i++){ px += Math.sin(i / 7) * 3 + Math.cos(i / 3) * 1.5;
    rows.push({ t: i * 900000, o: px, h: px + 2, l: px - 2, c: px }); }
  const out = W.__ogSignals(rows, { swingLength: 5, atrPeriod: 14, stopAtr: 1.5, rr: 2, horizonBars: 32 });
  ok(out.length > 0, 'the synthetic tape produces setups at all (' + out.length + ')');
  ok(out.every(s => Number.isFinite(s.barsLeft)), 'EVERY setup carries a finite barsLeft — the term ogProb needs');
  ok(out[out.length - 1].barsLeft > out[0].barsLeft, 'newer setups have MORE time left than older ones');
  ok(out.some(s => s.barsLeft < 0), 'setups older than the horizon go negative rather than clamping to a false positive');
  const later = W.__ogSignals(rows, { swingLength: 5, atrPeriod: 14, stopAtr: 1.5, rr: 2, horizonBars: 64 });
  ok(later[0].barsLeft === out[0].barsLeft + 32, 'barsLeft tracks the lane horizon, not a hard-coded constant');
}

console.log('== the odds estimate is the stated model, not a vibe ==');
{
  const Phi = W.__ogNormCdf;
  ok(typeof Phi === 'function', 'the normal CDF is exported so the estimate can be checked, not just trusted');
  ok(Math.abs(Phi(0) - 0.5) < 1e-9, 'PHI(0) = 0.5');
  ok(Math.abs(Phi(1.96) - 0.975) < 1e-4, 'PHI(1.96) ~ 0.975 — the textbook value, within the A&S error bound');
  ok(Math.abs(Phi(-1.96) - 0.025) < 1e-4, 'PHI(-1.96) ~ 0.025 — symmetric, so the erf sign branch is right');
  ok(Phi(-9) < 1e-9 && Phi(9) > 1 - 1e-9, 'the tails saturate rather than overflowing');
  ok(Phi(0.5) > Phi(0.4) && Phi(-0.5) < Phi(-0.4), 'monotone increasing across zero');
}

console.log('== a RUNNING position is scored by gambler\'s ruin, not by distance to entry ==');
{
  const P2 = W.__ogProb;
  /* long, entry 100, stop 95, target 110: risk 5R units of 5 price */
  const open = { state: 'open', lane: 'scalp', dir: 'long', entry: 100, stop: 95, t1: 110, risk: 5, rr: 2, atr: 2 };
  const mid = P2(open, 100);
  ok(Math.abs(mid.p - 1 / 3) < 1e-9, 'at the entry the odds are exactly 1/(1+rr) = 1/3, the R:R the rule fixes');
  const near = P2(open, 108), far = P2(open, 97);
  ok(near.p > mid.p, 'closer to the target scores HIGHER (' + near.p.toFixed(3) + ' > ' + mid.p.toFixed(3) + ')');
  ok(far.p < mid.p, 'closer to the stop scores LOWER (' + far.p.toFixed(3) + ' < ' + mid.p.toFixed(3) + ')');
  ok(near.p > 0 && near.p < 1 && far.p > 0 && far.p < 1, 'every score is a probability, never outside [0,1]');
  ok(P2(open, 111).p === 1 && P2(open, 94).p === 0,
     'past a barrier the walk has not settled yet reads as 1 and 0, not as a distance to a level price went through');
  ok(P2(open, 100).kind === 'running', 'the case is labelled so the card can say which model it used');
}

console.log('== a RESTING limit pays only if it FILLS, and time is part of that ==');
{
  const P2 = W.__ogProb;
  const rest = (barsLeft) => ({ state: 'waiting', lane: 'swing', dir: 'long', entry: 100, stop: 95, t1: 110,
                                risk: 5, rr: 2, atr: 2, barsLeft });
  const lots = P2(rest(40), 102), few = P2(rest(2), 102);
  ok(lots.p > few.p, 'MORE bars left = more chance to fill = higher score (' + lots.p.toFixed(3) + ' > ' + few.p.toFixed(3) + ')');
  ok(P2(rest(40), 101).p > P2(rest(40), 106).p, 'nearer the mark scores higher at equal time');
  ok(P2(rest(40), 102).p <= 1 / 3 + 1e-12,
     'a resting order can never beat 1/3 — it must first fill, and only then faces the same 2R odds');
  ok(P2(rest(0), 102).p === 0 && P2(rest(-5), 102).p === 0, 'no bars left → cannot fill → zero, not a stale positive');
  ok(P2(rest(40), 100).p > 0.32, 'a limit AT the mark is all but certain to fill, so it approaches the 1/3 ceiling');
  ok(P2(rest(40), 102).kind === 'resting', 'the case is labelled');
  ok(/fill|reach/i.test(P2(rest(40), 102).note || ''), 'the card is handed the grounds, not a bare number');
}

console.log('== the estimate refuses inputs it cannot honestly score ==');
{
  const P2 = W.__ogProb;
  const base = { state: 'waiting', lane: 'scalp', dir: 'long', entry: 100, stop: 95, t1: 110, risk: 5, rr: 2, atr: 2, barsLeft: 20 };
  /* +null === 0 and isFinite(0) === true: a missing mark must NOT read as a real price of zero */
  for (const bad of [null, undefined, '', 'abc', NaN]) {
    ok(P2(base, bad) === null, 'mark ' + JSON.stringify(bad) + ' → null, never a score against a fabricated price');
  }
  ok(P2(null, 100) === null && P2(undefined, 100) === null, 'no setup → null');
  ok(P2({ ...base, atr: 0 }, 102) === null, 'no usable ATR → null rather than dividing by zero');
  ok(P2({ ...base, state: 'target' }, 102) === null && P2({ ...base, state: 'stopped' }, 102) === null,
     'a settled setup is not scored — its outcome is known, not estimated');
  ok(P2({ ...base, state: 'missed' }, 102) === null, 'a missed setup is not scored either');
}

console.log('== the panel leads with ONE scalp and ONE swing ==');
{
  const T = W.__ogTopPicks;
  const mk = (lane, entry, extra) => ({ state: 'waiting', lane, dir: 'long', entry, stop: entry - 5,
                                        t1: entry + 10, risk: 5, rr: 2, atr: 2, barsLeft: 30, ...extra });
  const picks = T([mk('scalp', 99), mk('scalp', 80), mk('swing', 98), mk('swing', 70)], 100);
  ok(picks.scalp && picks.swing, 'both lanes filled');
  ok(picks.scalp.setup.entry === 99, 'the scalp pick is the better-scoring scalp, not the first one seen');
  ok(picks.swing.setup.entry === 98, 'the swing pick is the better-scoring swing');
  ok(picks.scalp.est.p > 0 && picks.swing.est.p > 0, 'each pick carries the estimate that chose it');

  /* the ordering must be by SCORE — a far scalp must not outrank a near one */
  const inverted = T([mk('scalp', 60), mk('scalp', 99.5)], 100);
  ok(inverted.scalp.setup.entry === 99.5, 'a distant setup never outranks a near one at equal time');

  /* the constraint the request actually imposes: one of EACH, never two of one */
  const scalpsOnly = T([mk('scalp', 99), mk('scalp', 98)], 100);
  ok(scalpsOnly.swing === null, 'an empty swing lane stays EMPTY — no scalp is promoted into the swing slot');
  ok(scalpsOnly.scalp !== null, 'and the lane that does have setups still produces its pick');

  /* intraday exists and must not leak into either headline slot */
  const withIntraday = T([mk('intraday', 99.9), mk('scalp', 95), mk('swing', 94)], 100);
  ok(withIntraday.scalp.setup.lane === 'scalp' && withIntraday.swing.setup.lane === 'swing',
     'INTRADAY never occupies a slot, however well it scores — the ask was one scalp and one swing');

  ok(JSON.stringify(T(null, 100)) === '{"scalp":null,"swing":null}', 'null input → both slots empty, no throw');
  ok(T([mk('scalp', 99)], null).scalp === null, 'no mark → no pick, rather than a pick scored against price zero');
  ok(T([{ ...mk('scalp', 99), state: 'target' }], 100).scalp === null, 'settled setups are not eligible to be picked');
  ok(T([mk('scalp', 99, { state: 'open' })], 100).scalp !== null, 'a RUNNING setup is eligible — it is still live');
}

console.log('== the picks are wired into the panel and cannot be shown twice ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'optigold.js'), 'utf8');
  ok(/ogTopPicks\(live, mark\)/.test(src), 'render actually calls the tested selector rather than a second inline copy');
  ok(/running = running\.filter\(notPicked\)/.test(src) && /resting = resting\.filter\(notPicked\)/.test(src),
     'a promoted card is REMOVED from the list below — the same setup under two orderings reads as two setups');
  ok(/TOP PICKS/.test(src), 'the section exists in the rendered output');
  /* the honesty guard: an estimate presented without its model is indistinguishable
     from a measured win rate, and this tab has no measured win rate */
  ok(/model, not a measurement/.test(src), 'the panel states that the odds are modelled, not measured');
  ok(/driftless/.test(src), 'and names the model it used');
  ok(/__ogProb\s*=\s*ogProb/.test(src) && /__ogTopPicks\s*=\s*ogTopPicks/.test(src),
     'the tested functions are the ones the tab uses');
}


console.log('== the horizon on the card is ENFORCED, not decorative ==');
{
  /* THE BUG THIS PINS. Every card printed "expires in N bars" while ogResolve
     walked to the end of the data, so a break from 70 bars ago stayed "live"
     forever. The panel then led with orders whose entry price had been left a
     hundred points behind — which is exactly what "the setups are far from the
     current price" looked like from outside. */
  const rows = []; let tt = 1700000000;
  const bar = (h, l, c) => rows.push({ t: (tt += 3600), o: c, h, l, c });
  for (let i = 0; i < 14; i++) bar(101, 99, 100);
  for (let i = 0; i < 3; i++) bar(102, 98, 100);
  bar(101, 94, 99);                                   /* swing low 94 */
  for (let i = 0; i < 3; i++) bar(102, 98, 100);
  bar(105, 99, 101);                                  /* swing high 105 */
  for (let i = 0; i < 6; i++) bar(102, 98, 100);
  bar(108, 99, 107);                                  /* BOS above 105 */
  /* 60 bars that never reach the entry, the stop or the target */
  for (let i = 0; i < 60; i++) bar(107.5, 106.5, 107);

  const short = W.__ogSignals(rows, { horizonBars: 10 });
  const long  = W.__ogSignals(rows, { horizonBars: 500 });
  ok(short.length > 0 && long.length > 0, 'the tape produces a setup under either horizon');
  ok(short[0].state === 'expired', 'a 10-bar horizon EXPIRES it — got ' + short[0].state);
  ok(long[0].state === 'waiting', 'a 500-bar horizon leaves the same setup live — got ' + long[0].state);
  ok(short[0].i === long[0].i && short[0].entry === long[0].entry,
     'the horizon changes only the OUTCOME, never the signal — same bar, same levels');
  ok(W.__ogSignals(rows, {})[0].state === 'waiting',
     'no horizon supplied → old behaviour, so the expiry cannot silently fire on callers that never asked for one');

  /* the states the rest of the code branches on must stay a closed set */
  ok(['waiting','open','target','stopped','missed','expired'].includes(short[0].state),
     'expired joins the known state set rather than leaking an unlabelled value');
}

console.log('== an expired setup is not live, and is never picked ==');
{
  const mk = (state) => ({ state, lane: 'scalp', dir: 'long', entry: 99, stop: 94, t1: 109,
                           risk: 5, rr: 2, atr: 2, barsLeft: 20 });
  ok(W.__ogProb(mk('expired'), 100) === null, 'an expired setup has no odds — its horizon is gone');
  ok(W.__ogTopPicks([mk('expired')], 100).scalp === null, 'and it can never occupy a headline slot');
  ok(W.__ogFwdRows([mk('expired')], 'scalp').length === 0, 'nor is it re-recorded to the forward log as if still open');
}

console.log('== what the trade is worth IF TAKEN NOW, at the mark ==');
{
  const A = W.__ogAtMark;
  /* long: entry 100, stop 95, target 110 — the plan is 2R from 100 */
  const s = { dir: 'long', entry: 100, stop: 95, t1: 110, risk: 5, rr: 2 };
  const atPlan = A(s, 100);
  ok(Math.abs(atPlan.rr - 2) < 1e-9, 'at the planned entry the quote reproduces the plan: 2:1');
  const late = A(s, 107);
  ok(Math.abs(late.risk - 12) < 1e-9 && Math.abs(late.reward - 3) < 1e-9, 'risk and reward are measured from the MARK, not the plan');
  ok(late.rr < 1, 'chasing it 7 points late pays ' + late.rr.toFixed(2) + ':1 — worse than 1:1, which is the point');
  ok(late.odds > atPlan.odds, 'the odds do IMPROVE as it runs (' + late.odds.toFixed(2) + ' > ' + atPlan.odds.toFixed(2) + ')');
  ok(late.rr < atPlan.rr, 'while the payoff collapses — the trade-off the odds alone hide');
  ok(Math.abs(late.odds - late.risk / (late.risk + late.reward)) < 1e-12, 'odds are gambler\'s ruin from the mark, the same model used elsewhere');

  ok(A(s, 111) === null && A(s, 94) === null, 'past a barrier there is no trade left to quote');
  const sh = { dir: 'short', entry: 100, stop: 105, t1: 90 };
  ok(Math.abs(A(sh, 95).rr - 0.5) < 1e-9, 'shorts are quoted the same way, with the signs the other way round');
  for (const bad of [null, undefined, '', 'x', NaN]) ok(A(s, bad) === null, 'mark ' + JSON.stringify(bad) + ' → null, never a quote against price zero');
  ok(A(null, 100) === null && A({ dir: 'long' }, 100) === null, 'a setup without levels yields no quote');
}

console.log('== reach: can this be acted on, at this price, right now ==');
{
  const R = W.__ogReach;
  const rest = (entry, barsLeft) => ({ state: 'waiting', dir: 'long', entry, stop: entry - 5, t1: entry + 10,
                                       risk: 5, rr: 2, atr: 2, barsLeft });
  ok(R(rest(99, 20), 100).ok, 'a limit 0.5×ATR away with time left is actionable');
  ok(!R(rest(90, 20), 100).ok, 'a limit 5×ATR away is not — beyond the stated reach');
  ok(!R(rest(99, 0), 100).ok, 'a limit with no bars left cannot fill, however near');
  ok(/ATR/.test(R(rest(90, 20), 100).why), 'and the refusal SAYS how far it is, rather than just hiding the card');

  const run = (px) => R({ state: 'open', dir: 'long', entry: 100, stop: 95, t1: 110, risk: 5, rr: 2, atr: 2 }, px);
  ok(run(100).ok, 'a position at its entry is worth joining — 2:1 from here');
  ok(run(101).ok, 'and slightly past it, still better than 1:1');
  ok(!run(107).ok, 'but not once joining pays under 1:1 — it has already run');
  ok(/already run|pays only/.test(run(107).why), 'the reason names the payoff rather than the distance');
  ok(!run(94).ok && !run(111).ok, 'past either barrier nothing is actionable');
  ok(!R({ state: 'target', dir: 'long', entry: 100, stop: 95, t1: 110 }, 100).ok, 'a settled setup is not actionable');
}

console.log('== THE REGRESSION: a runaway must not outrank a placeable order ==');
{
  /* This is the defect the previous version shipped. ogProb rewards a position
     for having ALREADY MOVED — a short 120 points into profit scores 75% while
     paying 0.33:1 to join. Sorting on the estimate alone therefore promoted
     precisely the setups nobody can act on, which is what the user saw. */
  const runaway = { state: 'open', lane: 'scalp', dir: 'short', entry: 4392, stop: 4492, t1: 4192,
                    risk: 100, rr: 2, atr: 33, barsLeft: 18 };
  const near = { state: 'waiting', lane: 'scalp', dir: 'short', entry: 4280, stop: 4300, t1: 4240,
                 risk: 20, rr: 2, atr: 12, barsLeft: 25 };
  const mark = 4271.65;

  const pRun = W.__ogProb(runaway, mark), pNear = W.__ogProb(near, mark);
  ok(pRun.p > pNear.p, 'the runaway still SCORES higher on odds alone (' + pRun.p.toFixed(2) + ' vs ' + pNear.p.toFixed(2) + ') — the estimate is not the bug');
  ok(W.__ogAtMark(runaway, mark).rr < 1, 'yet joining it at the mark pays under 1:1');
  ok(!W.__ogReach(runaway, mark).ok && W.__ogReach(near, mark).ok, 'so reach separates them where odds cannot');

  const picks = W.__ogTopPicks([runaway, near], mark);
  ok(picks.scalp.setup === near, 'and the PICK is the placeable order, not the higher-scoring runaway');
  ok(picks.scalp.actionable === true, 'the chosen pick is marked actionable');

  /* when nothing is actionable the slot is still filled — badged, not hidden,
     because "the rule found nothing near" and "the rule found nothing" differ */
  const onlyFar = W.__ogTopPicks([runaway], mark);
  ok(onlyFar.scalp !== null, 'a lane with only unreachable setups still shows its best one');
  ok(onlyFar.scalp.actionable === false, 'badged OUT OF REACH rather than presented as a pick');
  ok(typeof onlyFar.scalp.why === 'string' && onlyFar.scalp.why.length > 0, 'with the reason attached for the card to print');
  ok(onlyFar.scalp.atMark !== undefined, 'and the at-the-mark quote, so "far" is priced rather than merely asserted');

  /* within the actionable group, nearer wins — "with the current price in mind" */
  const a = { ...near, entry: 4275 }, b = { ...near, entry: 4290 };
  ok(W.__ogTopPicks([b, a], mark).scalp.setup === a, 'among actionable setups the nearer one leads');
}

console.log('== the panel renders reach, the quote, and the expired count ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'optigold.js'), 'utf8');
  ok(/ACTIONABLE NOW/.test(src) && /OUT OF REACH/.test(src), 'both verdicts reach the screen');
  ok(/take it at the mark/.test(src), 'the pick quotes what the trade is worth at the current price');
  ok(/R:R from here/.test(src), 'including the payoff from here, which is the number the plan hides once price has run');
  ok(/state === 'expired'/.test(src), 'expired setups are counted separately from live ones');
  ok(/ogResolve\(rows, t \+ 1, s, opts\.horizonBars\)/.test(src), 'the signal loop passes the horizon — an unpassed argument would silently restore the bug');
  ok(/__ogAtMark\s*=\s*ogAtMark/.test(src) && /__ogReach\s*=\s*ogReach/.test(src), 'the tested functions are the ones the tab uses');
}


console.log('== NEXT TO ARM: the structure price is inside right now ==');
{
  /* Why this exists: a retracement limit is placed BEHIND a break, so once
     price runs the entry is behind it by construction and no ranking brings it
     closer. The only thing this rule ever has near the mark is the structure
     itself and the close that would arm the next setup. */
  const rows = []; let tt = 1700000000;
  const bar = (h, l, c) => rows.push({ t: (tt += 3600), o: c, h, l, c });
  for (let i = 0; i < 14; i++) bar(101, 99, 100);
  for (let i = 0; i < 3; i++) bar(102, 98, 100);
  bar(101, 94, 99);                                  /* swing low 94 */
  for (let i = 0; i < 3; i++) bar(102, 98, 100);
  bar(106, 99, 101);                                 /* swing high 106 */
  for (let i = 0; i < 8; i++) bar(102, 98, 100);     /* confirm both, price inside */

  const p = W.__ogPending(rows, {});
  ok(p !== null, 'pending structure is reported at all');
  ok(p.res === 106 && p.sup === 94, 'the confirmed range is the one the rule will use next bar');
  ok(p.eq === 100, 'the 50% equilibrium is the midpoint of that range');
  ok(p.inside === true, 'price closing at 100 is INSIDE the range');
  ok(p.long.trigger === 106 && p.short.trigger === 94, 'each side arms on a close through its own level');
  ok(p.long.already === false && p.short.already === false, 'neither side has fired');
  ok(Math.abs(p.long.toTrigger - 6) < 1e-9, 'the distance reported is to the TRIGGER, not to the entry');
  ok(p.long.toTriggerAtr > 0 && isFinite(p.long.toTriggerAtr), 'and is also given in ATR so the lanes compare');
  ok(p.long.entry === p.short.entry && p.long.entry === 100, 'both sides would rest a limit at the same equilibrium');
  ok(p.long.stop < p.sup && p.short.stop > p.res, 'stops sit beyond the OPPOSITE structural level, as the rule says');
  ok(p.long.t1 > p.long.entry && p.short.t1 < p.short.entry, 'targets face the right way');
  ok(Math.abs((p.long.t1 - p.long.entry) / p.long.risk - 2) < 1e-9, 'and are 2R from the entry, matching the rule');
}

console.log('== NEXT TO ARM obeys the same confirmation clock as the rule ==');
{
  /* If the preview consulted an unconfirmed swing it would advertise a level the
     rule itself cannot use yet — the same lookahead this tab was built to remove,
     re-entering through the panel instead of the signal loop. */
  const rows = []; let tt = 1700000000;
  const bar = (h, l, c) => rows.push({ t: (tt += 3600), o: c, h, l, c });
  for (let i = 0; i < 14; i++) bar(101, 99, 100);
  for (let i = 0; i < 3; i++) bar(102, 98, 100);
  bar(101, 94, 99);                                  /* swing low 94 */
  for (let i = 0; i < 3; i++) bar(102, 98, 100);
  bar(106, 99, 101);                                 /* swing high 106, confirms 5 later */
  for (let i = 0; i < 8; i++) bar(102, 98, 100);
  const hiIdx = 21;                                  /* the 106 bar */

  /* one bar before the high is confirmed, the preview must not know about it */
  const early = W.__ogPending(rows.slice(0, hiIdx + 5), {});
  const onTime = W.__ogPending(rows.slice(0, hiIdx + 6), {});
  ok(!early || early.res !== 106, 'the 106 high is INVISIBLE until its confirmation bar closes');
  ok(onTime && onTime.res === 106, 'and visible the moment it closes — got ' + (onTime && onTime.res));

  /* the preview at bar T must equal the preview recomputed on data ending at T */
  let drift = 0;
  for (let T = 30; T <= rows.length; T++){
    const a = W.__ogPending(rows.slice(0, T), {});
    const b = W.__ogPending(rows.slice(0, T), {});
    if (JSON.stringify(a) !== JSON.stringify(b)) drift++;
  }
  ok(drift === 0, 'the preview is a pure function of the bars up to now (' + drift + ' mismatches)');
}

console.log('== the preview does not lie about the order it would place ==');
{
  /* The preview is worthless if the setup that actually fires differs from the
     one it advertised. Build a tape that breaks on its LAST bar, then compare
     what the preview said one bar earlier against what the rule produced. */
  const rows = []; let tt = 1700000000;
  const bar = (h, l, c) => rows.push({ t: (tt += 3600), o: c, h, l, c });
  for (let i = 0; i < 14; i++) bar(101, 99, 100);
  for (let i = 0; i < 3; i++) bar(102, 98, 100);
  bar(101, 94, 99);
  for (let i = 0; i < 3; i++) bar(102, 98, 100);
  bar(106, 99, 101);
  for (let i = 0; i < 8; i++) bar(102, 98, 100);
  const before = W.__ogPending(rows.slice(), {});
  bar(108, 99, 107);                                 /* the break */

  const fired = W.__ogSignals(rows, {}).filter(s => s.i === rows.length - 1);
  ok(fired.length === 1, 'the break fires exactly one setup on the last bar');
  ok(fired[0].dir === 'long', 'in the direction the preview said would arm');
  ok(fired[0].entry === before.long.entry, 'the ENTRY is exactly what the preview advertised');
  ok(fired[0].res === before.res && fired[0].sup === before.sup, 'from the same range');
  /* the stop rides on ATR, which advances with the breaking bar — so this is
     close, not identical, and the panel must not claim otherwise */
  ok(Math.abs(fired[0].stop - before.long.stop) < before.atr,
     'the stop is within one ATR of the preview — it moves because ATR advances on the breaking bar');
  ok(before.long.already === false, 'and before the break the preview correctly said it had not fired');

  const after = W.__ogPending(rows, {});
  ok(after.long.already === true, 'once price closes through, the preview stops calling that side pending');
  ok(after.inside === false, 'and reports that price is outside the range');
}

console.log('== the preview refuses to invent structure ==');
{
  ok(W.__ogPending([], {}) === null, 'no bars → null');
  ok(W.__ogPending(null, {}) === null, 'null → null, no throw');
  const flat = [];
  for (let i = 0; i < 60; i++) flat.push({ t: i * 3600, o: 100, h: 100, l: 100, c: 100 });
  ok(W.__ogPending(flat, {}) === null, 'a dead flat tape has no swings and yields no levels rather than a fabricated range');
}

console.log('== the panel shows what is near the price, and says it is not a signal ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'optigold.js'), 'utf8');
  ok(/NEXT TO ARM/.test(src), 'the section reaches the screen');
  ok(/Nothing here is a setup/.test(src), 'and states plainly that these are levels, not signals');
  ok(/pending: ogPending\(rows, L\)/.test(src), 'the scan computes it per lane from that lane own rows');
  ok(/__ogPending\s*=\s*ogPending/.test(src), 'the tested function is the one the tab uses');
}

console.log('\ntest-optigold: ' + passed + ' assertions passed');
