/* hg-v1421 — CRYPTO SCANNER SWEEP: the mutation-proof authorizations for the
   adopted set (impl-brief-r2, desks/cryptosweep):

     ① 80PERCENT cost floor — hg80CostFloorWhy, three-state, both venue tiers,
        paint-level stand-aside (UNDER THE COST FLOOR), never hidden.
     ② CRYPTO SCAN chop floor — Kaufman ER(20) < 0.30 stand-aside gate
        (measured -0.147R/-0.124R both halves on the skipped cohort), lever
        HG_CS_ER_FLOOR; EMA150(1d) is a FOOTNOTE, never a gate.
     ③ SMART $ / OI FLOW positioning realignment — retail-contrarian,
        funding-fade, funding-z fade and top−retail reads are CONTEXT, not
        votes (wide02: retail L/S contrarian 5/5 OOS failures; funding-
        contrarian the worst bucket, p=0.002). Lever HG_POS_CONTRARIAN_VOTES
        restores them for the forward-ledger comparison.

   Every pin is written to kill a mutation: remove the vote → RED; restore the
   old behaviour without the lever → RED; flip a boundary or a tier → RED.

   Run: node tests/test-cryptosweep-v1410.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const strip = s => String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

function ctx0(){
  const s = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, Number, String,
              Object, Array, JSON, parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, Set, Map };
  s.window = s; s.globalThis = s;
  s.setTimeout = f => { try{ f && f(); }catch(e){} return 0; }; s.clearTimeout = () => {};
  s.setInterval = () => 0; s.clearInterval = () => {};
  s.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  vm.createContext(s);
  return s;
}

/* ================= 1) hg80CostFloorWhy — three-state, both tiers ================= */
console.log('== 1. 80PERCENT cost floor predicate ==');
{
  const T = ctx0();
  vm.runInContext(read('eightypercent.js'), T, { filename: 'eightypercent.js' });
  const F = T.hg80CostFloorWhy;
  ok(typeof F === 'function' && T.HG_80_COST_FLOOR_MULT === 4, 'exported, 4x multiplier');

  /* unreadable geometry is NOT a verdict (hg-v1418 shape) */
  ok(F(3000, null, 'long', 0.0002) === null, 'missing stop → null (no claim)');
  ok(F(3000, 3001, 'long', 0.0002) === null, 'inverted stop → null (no claim)');
  ok(F(3000, 3000, 'long', 0.0002) === null, 'zero-width stop → null (no claim)');
  ok(F(3000, 2998, 'long', NaN) === null, 'unread venue → null (fail open)');
  ok(F(3000, 2998, 'sideways', 0.0002) === null, 'unknown dir → null');

  /* XM tier (0.02% RT → floor 0.08% of entry) */
  ok(typeof F(3000, 3000 * (1 - 0.0007), 'long', 0.0002) === 'string'
     && F(3000, 3000 * (1 - 0.0007), 'long', 0.0002).includes('0.080%')
     && F(3000, 3000 * (1 - 0.0007), 'long', 0.0002).includes('4x'),
     'XM: stopPct 0.07% under the 0.08% floor → reason names 4x and 0.080%');
  ok(F(3000, 3000 * (1 - 0.0008), 'long', 0.0002) === null, 'XM: 0.08% boundary passes (inclusive floor, strict <)');
  ok(F(3000, 3000 * (1 - 0.0009), 'long', 0.0002) === null, 'XM: 0.09% passes');

  /* PAXG tier (0.26% RT → floor 1.04% of entry) */
  ok(typeof F(3000, 3000 * (1 + 0.0103), 'short', 0.0026) === 'string'
     && F(3000, 3000 * (1 + 0.0103), 'short', 0.0026).includes('1.040%'),
     'PAXG: stopPct 1.03% under the 1.04% floor → reason (tier math on the short side too)');
  ok(F(3000, 3000 * (1 + 0.0105), 'short', 0.0026) === null, 'PAXG: 1.05% passes');

  /* measured reason text: the floor cites its own evidence */
  ok(F(3000, 2998, 'long', 0.0002).includes('-0.744R'), 'reason cites the measured sub-floor cohort');

  /* spec geometry (4xATR stops) is never floor-refused at XM costs */
  ok(F(3000, 3000 * (1 - 0.004), 'long', 0.0002) === null, 'spec-geometry stop (0.4% of entry) passes at XM');

  /* lever */
  T.HG_80_COST_FLOOR = false;
  ok(F(3000, 2998, 'long', 0.0002) === null, 'HG_80_COST_FLOOR=false restores pre-v1421 counting');
  T.HG_80_COST_FLOOR = 0; /* unreadable lever = ON (safe side) */
  ok(typeof F(3000, 2998, 'long', 0.0002) === 'string', 'unreadable lever (0, not false) = floor stays ON');
}

/* ================= 2) hg80Quality: floor-refused joins the arithmetic-refused bucket == */
console.log('== 2. 80PERCENT quality seam (paint-level, never hidden) ==');
{
  const T = ctx0();
  vm.runInContext(read('eightypercent.js'), T, { filename: 'eightypercent.js' });
  const mkSig = (entry, stop) => ({ dir: 'long', variant: 'spec',
    plan: { dir: 'long', entry: entry, stop: stop, t1: entry * 1.002, stopPct: Math.abs(entry - stop) / entry * 100 } });
  const rung = { be: { rtFrac: 0.0002, cost: 0.6, target: 2.5, risk: 10 } };   /* XM */
  const qFloor = T.hg80Quality(mkSig(3000, 2998), rung, 'pending', NaN);       /* 0.067% stop < 0.08% floor */
  ok(qFloor.pays === false && typeof qFloor.floorWhy === 'string' && qFloor.floorWhy.includes('COST FLOOR'),
     'sub-floor setup: pays=false with the floor reason attached');
  const qClear = T.hg80Quality(mkSig(3000, 3000 * (1 - 0.004)), rung, 'pending', NaN);
  ok(qClear.pays === !(qClear.verdict.key === 'gone' || qClear.verdict.key === 'negative') && qClear.floorWhy === null,
     'above-floor setup: floor silent, the old verdict math decides');
  const qNoVenue = T.hg80Quality(mkSig(3000, 2998), { be: { cost: 0.6, target: 2.5, risk: 10 } }, 'pending', NaN);
  ok(qNoVenue.floorWhy === null, 'venue unreadable → the floor makes NO claim (fail open)');
  T.HG_80_COST_FLOOR = false;
  const qOff = T.hg80Quality(mkSig(3000, 2998), rung, 'pending', NaN);
  ok(qOff.floorWhy === null, 'lever off: quality path behaves as pre-v1421');

  /* the mount header carries the venue fact (measured, both venues named) */
  const mnt = read('eightypercent.js');
  ok(/84\.35% against an 84\.21% gross bar/.test(mnt) && /-2\.58R at Binance-PAXG taker/.test(mnt),
     'venue fact text present with the measured walk numbers');
}

/* ================= 3) positioning.js — contrarian/fade votes demoted ================= */
console.log('== 3. positioning classifier realignment ==');
{
  const T = ctx0();
  vm.runInContext(read('positioning.js'), T, { filename: 'positioning.js' });
  const C = T.hgPositioningClassify;

  /* retail extreme: context only, no vote, no direction from it alone */
  let r = C({ retailLongPct: 70 });
  ok(r.dir === null && r.shortEv.length === 0 && r.regime.some(e => e.includes('retail extremely long')),
     'retail 70% long → context string, NO contrarian vote (removing the vote turns this RED on revert)');
  r = C({ retailLongPct: 30 });
  ok(r.dir === null && r.longEv.length === 0 && r.regime.some(e => e.includes('retail extremely short')),
     'retail 30% long → context string, no vote');

  /* funding extreme: fade vote gone; regime + fundingFade intact */
  r = C({ fundingPct: 0.06 });
  ok(r.dir === null && r.shortEv.length === 0 && r.fundingFade === true
     && r.regime.some(e => e.includes('longs crowded')),
     'funding +0.06% → crowding context; fundingFade flag intact; no fade vote');

  /* the confirmation-shaped half survives: trend fuel suppressed while crowded */
  r = C({ chg24: 2, oiChgPct: 3, fundingPct: 0.06 });
  ok(!r.longEv.some(e => e.includes('trend fuel')), 'trend-fuel vote stays suppressed under extreme funding');
  r = C({ chg24: 2, oiChgPct: 3, fundingPct: 0.01 });
  ok(r.longEv.some(e => e.includes('trend fuel')), 'trend-fuel vote fires when funding is calm');

  /* funding-z fade: context only */
  r = C({ fundingZ: 2.5 });
  ok(r.dir === null && r.shortEv.length === 0 && r.regime.some(e => e.includes('crowded long')),
     'funding z +2.5 → crowding context, no squeeze-down vote');

  /* top−retail diff: context only */
  r = C({ retailLongPct: 40, topLongPct: 60 });
  ok(r.dir === null && r.longEv.length === 0 && r.regime.some(e => e.includes('top traders long vs retail')),
     'top−retail +20pp → context, no follow-top vote');

  /* direction still forms from quadrants + taker */
  r = C({ chg24: 2, oiChgPct: 3, takerRatio: 1.2 });
  ok(r.dir === 'long' && r.score === 2, 'direction forms from quadrant + taker without the demoted class');

  /* lever restores everything, both surfaces */
  T.HG_POS_CONTRARIAN_VOTES = true;
  r = C({ retailLongPct: 70 });
  ok(r.dir === 'short' && r.shortEv.some(e => e.includes('≥65')), 'lever: retail contrarian vote restored');
  r = C({ fundingPct: 0.06 });
  ok(r.shortEv.some(e => e.includes('longs pay')), 'lever: funding fade restored');
  r = C({ fundingZ: 2.5 });
  ok(r.shortEv.some(e => e.includes('CROWDED LONG')), 'lever: funding-z fade restored');
  r = C({ retailLongPct: 40, topLongPct: 60 });
  ok(r.longEv.some(e => e.includes('follow top')), 'lever: follow-top restored');
  T.HG_POS_CONTRARIAN_VOTES = false;
  r = C({ retailLongPct: 70 });
  ok(r.dir === null, 'lever off again → demotion is the default');
}

/* ================= 4) oiflow.js fallback — same demotion without positioning.js = */
console.log('== 4. OI FLOW fallback parity ==');
{
  const T = ctx0();
  vm.runInContext(read('oiflow.js'), T, { filename: 'oiflow.js' });
  ok(typeof T.hgPositioningClassify === 'undefined', 'fallback path: shared classifier absent');
  const C = T.oiflowClassify;
  let r = C({ fundingZ: 2.5 });
  ok(r.dir === null && r.shortEv.length === 0 && /crowded long/.test(String(r.regime)),
     'fallback: funding z +2.5 → context only');
  r = C({ longPct: 70 });
  ok(r.dir === null && r.shortEv.length === 0 && /retail extremely long/.test(String(r.regime)),
     'fallback: retail 70% → context only');
  T.HG_POS_CONTRARIAN_VOTES = true;
  r = C({ fundingZ: 2.5 });
  ok(r.dir === 'SHORT' && r.evidence[0].includes('CROWDED LONG'), 'fallback lever: funding-z fade restored');
  r = C({ longPct: 70 });
  ok(r.dir === 'SHORT' && r.evidence[0].includes('RETAIL MAX LONG'), 'fallback lever: retail fade restored');
}

/* ================= 5) index.html smartClassify — fallback parity with the delegate == */
console.log('== 5. SMART $ fallback parity ==');
{
  const html = read('index.html');
  const block = html.match(/\/\* >>> SMART MONEY \(BINANCE\) >>>[\s\S]*?<<< SMART MONEY END <<< \*\//);
  ok(!!block, 'smart-money markers found');

  /* fallback (no positioning.js) */
  const F = ctx0();
  vm.runInContext(block[0], F, { filename: 'smart-extract.js' });
  /* delegate (positioning.js present) */
  const D = ctx0();
  vm.runInContext(read('positioning.js'), D, { filename: 'positioning.js' });
  vm.runInContext(block[0], D, { filename: 'smart-extract.js' });

  const inputs = [
    { chg24: 2, oiChgPct: 3, fundingPct: 0.06, retailLongPct: 70, topLongPct: 80, takerRatio: 1.2 },
    { chg24: -2, oiChgPct: 3, fundingPct: -0.06, retailLongPct: 30, topLongPct: 40, takerRatio: 0.8 },
    { chg24: 0, oiChgPct: 0, fundingPct: 0.01, retailLongPct: 50, topLongPct: 50, takerRatio: 1.0 },
    { chg24: 2, oiChgPct: -3, fundingPct: 0.01, retailLongPct: 68, topLongPct: 68, takerRatio: 1.1 }
  ];
  for (const d of inputs){
    const rf = F.smartClassify(JSON.parse(JSON.stringify(d)));
    const rd = D.smartClassify(JSON.parse(JSON.stringify(d)));
    ok(rf.dir === rd.dir,
       'fallback and delegate agree on dir (' + JSON.stringify(d.chg24) + '/' + JSON.stringify(d.oiChgPct)
       + ' → ' + rd.dir + ')');
    ok(rf.longEv.length === rd.longEv.length && rf.shortEv.length === rd.shortEv.length,
       'and on evidence counts (' + rf.longEv.length + 'v' + rf.shortEv.length + ')');
  }
  /* and the demotion holds in the fallback too */
  const r = F.smartClassify({ chg24: 0, oiChgPct: 0, fundingPct: 0.06, retailLongPct: 70, topLongPct: 80, takerRatio: 1.0 });
  ok(r.dir === null && r.regime.some(e => e.includes('retail extremely long')) && !r.shortEv.length,
     'fallback: an all-contrarian input forms NO majority');
}

/* ================= 6) cryptoscan — chop floor gate + EMA150 footnote ============ */
console.log('== 6. CRYPTO SCAN ER stand-aside ==');
{
  const T = ctx0();
  T.HG_tabs = []; T.HG_warmups = []; T.HG_TAB_MODS = {};
  T.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }),
                 head: { appendChild(){} }, addEventListener(){} };
  T.location = { href: 'https://x/', search: '', protocol: 'https:' };
  T.navigator = { userAgent: 'node' };
  for (const f of ['indicators.js', 'indicators2.js', 'order-flow.js',
                   'liquidation-intelligence.js', 'cryptoscan-voting-v3.js',
                   'cryptoultra.js', 'hg-forward.js', 'cryptoscan.js'])
    vm.runInContext(read(f), T, { filename: f });

  const ER = T.__csKaufmanER;
  ok(typeof ER === 'function', 'csKaufmanER exported');
  ok(ER([{ c: 1 }, { c: 2 }], 20) === null, 'short tape → null (fail open)');

  /* trending tape: monotone drift → ER near 1; two-sided chop → ER near 0 */
  const trend = []; let px = 100;
  for (let i = 0; i < 60; i++){ px *= 1.002; trend.push({ t: i, o: px, h: px * 1.001, l: px * 0.999, c: px, v: 1 }); }
  const chop = trend.map((r, i) => ({ t: i, o: 100, h: 101, l: 99, c: 100 + (i % 2 ? 0.6 : -0.6), v: 1 }));
  ok(ER(trend, 20) > 0.9, 'trending tape ER ≈ 1 (gate stays clear)');
  ok(ER(chop, 20) < 0.05, 'chop tape ER ≈ 0 (gate would fire)');

  /* the gate is wired: gate text + lever + measured citation, and the tape is
     the closed 15m bars the engine voted on */
  const src = read('cryptoscan.js');
  ok(/addGate\('er-floor', 'CHOP FLOOR — Kaufman ER\(20\) '/.test(src), "er-floor gate exists with the CHOP FLOOR reason");
  ok(/HG_CS_ER_FLOOR !== false/.test(src), 'gate is levered (HG_CS_ER_FLOOR=false restores)');
  ok(/-0\.147R\/-0\.124R both halves/.test(src), 'gate reason cites the measured skipped cohort');
  ok(/var er20 = csKaufmanER\(closed15, 20\)/.test(src), 'ER computed on closed15 — the bars the engine voted on');
  ok(/er20 !== null && er20 < 0\.30\)/.test(src), 'the gate threshold is exactly 0.30 (kills 0.20/0.40 flips)');
  ok(src.indexOf('var closed15 = csTrimToBar') < src.indexOf('var er20 = csKaufmanER'),
     'ER computed AFTER closed15 is defined (no hoisted-undefined fail-open bug)');

  /* EMA150 is a footnote, never a gate */
  ok(!/addGate\('ema/.test(src) && !/addGate\("ema/.test(src), 'no EMA150 gate key exists');
  ok(/s\.ema150dNote = counter/.test(src) && /unadopted as a gate/.test(src),
     'EMA150 counter-regime footnote carries the unadopted-as-gate wording');

  /* the footnote reaches the card; gates stay gate-shaped */
  const s = { label: 'BTC', sym: 'BTCX', exchange: 'delta', dir: 'long', isHighQuality: false,
    pct: 0.8, count: { decisive: 40, total: 470, kinds: {} }, line: 'x', price: 100,
    item: { exchange: 'delta' },
    ema150dNote: 'counter-regime — 1d close below EMA150; the counter-regime cohort measured -0.151R net (both halves, hg-v1421). Annotation only, unadopted as a gate (stacking thins the stream 89%)',
    qualityGates: [], gateKeys: [],
    plan: { entry: 100, stop: 98.5, t1: 102.25, stopAtr: 1.5, rr1: 1.5, rr2: 2.5, timeoutBars: 24, orderType: 'BUY' } };
  const card = strip(T.__csSetupCardHTML(s, 0, null));
  ok(/1D REGIME:/.test(card) && /counter-regime/.test(card), 'EMA150 footnote renders on the card');
  const s2 = Object.assign({}, s, { ema150dNote: null });
  ok(!/1D REGIME:/.test(strip(T.__csSetupCardHTML(s2, 0, null))), 'no footnote when the daily leg is unread (fail open)');

  /* RECORD ONLY re-cite: the tab header names the hg-v1421 priced rebake */
  ok(/hg-v1421\s*\n?\s*rebake on a priced walk/.test(src) && /0%-win out-of-sample/.test(src),
     'tab header re-cites the priced rebake (0%-win OOS, 14 cells)');
}

console.log('\nALL ' + passed + ' CRYPTO-SWEEP-v1421 ASSERTIONS PASSED');
