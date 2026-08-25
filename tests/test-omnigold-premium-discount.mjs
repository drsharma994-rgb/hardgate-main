/* HARDGATE — OMNIGOLD's premium/discount gate, and the no-double-count rule.

   WHAT HAPPENED HERE, because it is the more useful half of this file.

   Asked to put every gold indicator to work on this tab, the first attempt
   added an "indicator stack" gate: a tally of six gold indicators, each asked
   whether it agreed with the setup's direction. It looked like coverage. It
   was mostly double-counting. hg-gates.js already contributes about eighteen
   indicator gates to this same ledger through hgIndicatorGates, and FIVE of
   the stack's six members — ichimoku, stoch-rsi, cci-stretch, ema-ribbon,
   heikin-trend — were already gates in their own right, each already asked
   the same direction question.

   Counting one reading twice is not a cosmetic problem. Every ticket shows a
   check count ("TICKET 29/32 checks"), and duplicated evidence inflates it
   while adding nothing: the same indicator votes once as itself and again
   inside the tally, so five indicators quietly outweigh the other thirteen.
   That is how a marginal setup reads as a confident one on screen and behaves
   like a marginal one in the market.

   So the stack was cut down to the single read nothing else on the ledger
   asks: ICT premium/discount — where price sits in its own recent range, buy
   the discount and sell the premium.

   THREE THINGS ARE LOAD-BEARING:
     1. NO DUPLICATES. No gate may re-ask an indicator another gate already
        asked. Asserted directly, by key.
     2. MID-RANGE ABSTAINS. A neutral quartile has no view, and recording that
        as agreement would make silence look like confirmation.
     3. UNCHECKED WITHOUT GOLDIND, never PASS. A gate that passes when its
        input is missing reports confluence nobody measured.

   Run: node tests/test-omnigold-premium-discount.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(withGoldind){
  const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, Float64Array, Infinity, NaN };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  const files = ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                 'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js'];
  if (withGoldind) files.push('goldind.js', 'pinegoldmath.js');
  files.push('omniroute.js', 'omnigold.js');
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return ctx;
}

const T0 = 1700000000 - (1700000000 % 86400);
const B = (i, o, h, l, c, v) => ({ t: T0 + i * 3600, o, h, l, c, v: v === undefined ? 1000 : v });

/* A sustained uptrend ends in the PREMIUM quartile of its own range, which is
   the read this gate exists to make. */
function uptrend(n){
  const rows = []; let p = 2000;
  for (let i = 0; i < n; i++){
    const o = p, c = p + 2.2;
    rows.push(B(i, o, c + 1, o - 1, c, 1000 + (i % 7) * 50));
    p = c;
  }
  return rows;
}
const rows = uptrend(320);

const full = boot(true);
ok(typeof full.goldPremiumDiscount === 'function', 'goldind.js is loaded in the full sandbox');
ok(typeof full.hgOgGates === 'function', 'hgOgGates is exported');

function gateFor(ctx, dir, key, bars){
  const gs = ctx.hgOgGates(bars || rows,
    { kind:'ORB', dir, level: (bars || rows)[(bars || rows).length - 1].c, why:'t' }, {});
  return (gs || []).filter(g => g && g.key === key)[0] || null;
}

/* ---- the gate itself ---- */
const pdLong = gateFor(full, 'long', 'premium-discount');
ok(pdLong, 'the premium-discount gate is on the ledger');
ok(pdLong.hard === false, 'it is SOFT — premium/discount never hard-vetoes a gold ticket');
ok(pdLong.info === true, 'it is informational, matching the shared indicator gates');
ok(typeof pdLong.why === 'string' && pdLong.why.length > 0, 'it explains itself');

/* An uptrend ends in the premium quartile, so a LONG there disagrees and a
   SHORT agrees. If both read the same, the gate is not reading direction. */
const pdShort = gateFor(full, 'short', 'premium-discount');
ok(pdShort, 'the gate is present for the short side too');
if (pdLong.pass !== null && pdLong.pass !== undefined){
  ok(pdLong.pass !== pdShort.pass,
     'the gate is direction-aware — long and short cannot both agree with one quartile');
  ok(/quartile/.test(pdLong.why), 'the gate names the quartile it read — "' + pdLong.why.slice(0, 66) + '…"');
}

/* ---- mid-range abstains ---- */
const flat = [];
for (let i = 0; i < 320; i++){
  const p = 2000 + Math.sin(i / 9) * 6;
  flat.push(B(i, p, p + 2, p - 2, p + 0.2));
}
const pdFlat = gateFor(full, 'long', 'premium-discount', flat);
ok(pdFlat, 'the gate is present on a ranging tape');
ok((pdFlat.pass === null || pdFlat.pass === undefined)
     ? /no premium\/discount view|mid-range/.test(pdFlat.why)
     : /quartile/.test(pdFlat.why),
   'a mid-range tape either abstains in plain words or names the quartile it did reach — "' +
   pdFlat.why.slice(0, 66) + '…"');

/* ---- UNCHECKED without goldind ---- */
const bare = boot(false);
ok(typeof bare.goldPremiumDiscount !== 'function', 'goldind.js is absent from the bare sandbox');
const pdBare = gateFor(bare, 'long', 'premium-discount');
ok(pdBare, 'the gate still appears without goldind — it degrades, it does not vanish');
ok(pdBare.pass === null || pdBare.pass === undefined,
   'without goldind the gate is UNCHECKED, not PASS — it never claims unmeasured confluence');

/* ---- THE RULE: no indicator is asked twice ---- */
const all = full.hgOgGates(rows, { kind:'ORB', dir:'long', level: rows[rows.length-1].c, why:'t' }, {});
ok(Array.isArray(all) && all.length > 20, 'the full ledger builds (' + all.length + ' gates)');

const keys = all.map(g => g.key);
const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
ok(dupes.length === 0, 'no gate key appears twice on the ledger' + (dupes.length ? ' — dupes: ' + dupes.join(', ') : ''));

/* The shared set must genuinely already cover these, or cutting the stack was
   the wrong call and this test should fail rather than bless it. */
const SHARED_ALREADY = ['ichimoku', 'stoch-rsi', 'cci-stretch', 'ema-ribbon', 'heikin-trend'];
for (const k of SHARED_ALREADY){
  ok(keys.indexOf(k) >= 0,
     'the shared ledger already asks "' + k + '" — which is why the stack gate was cut');
}
ok(keys.indexOf('premium-discount') >= 0 && SHARED_ALREADY.indexOf('premium-discount') < 0,
   'premium-discount is the one gold read the shared set does NOT already make');

/* The abandoned design must stay abandoned. */
ok(keys.indexOf('indicator-stack') < 0, 'the double-counting indicator-stack gate is gone');
const OG_SRC = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
ok(!/gates\.push\(\{ key:'indicator-stack'/.test(OG_SRC),
   'omnigold.js does not push an indicator-stack gate');

console.log('\nomnigold premium-discount: ' + passed + ' checks passed · no indicator asked twice');
