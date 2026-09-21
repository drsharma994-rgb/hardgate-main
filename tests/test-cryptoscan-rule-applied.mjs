/* HARDGATE — the engine behind CRYPTO SCAN advertised a rule it never applied.

   CRYPTO SCAN runs cryptoUltraEngine over every Delta + CoinDCX contract and
   records the result. THE RULE, as both of that engine's surfaces state it:

     "When >=N reads are decisive, X% of them agree ... that side fires"

   Neither N nor X exists. `rule.minAvail` and `rule.minPct` are read in four
   places and appear in neither RULE nor any caller's override, so both gates
   were `x < undefined` -- false for every x. Neither has ever fired. And
   because both surfaces interpolated the keys straight, the tab rendered

     Rule: >=undefined decisive - NaN% agree

   Measured over 400 tapes through the real engine: 310 produced a direction
   AND a priced plan, agreement ran as low as 50%, 45 fired under 60% and 25
   under 55%.

   A TIE WAS A LONG. `lead = L >= S ? 'long' : 'short'` handed the long side
   every exact split, so forty reads long against forty short -- the engine
   saying it does not know -- was reported as a LONG signal at "50% agree",
   priced with a real entry, stop and targets, and written into CRYPTO SCAN's
   forward log with a direction half hg-forward splits on. 3 of those 310 were
   exact ties.

   The thresholds are NOT invented here: choosing a decisive-count floor and an
   agreement floor is a calibration decision for the desk. What changes is that
   an absent threshold is an explicit fact instead of a comparison that
   silently passes, both surfaces say what is actually enforced, and a coin
   flip produces no side.

   Run: node tests/test-cryptoscan-rule-applied.mjs */
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

/* A PINNED CLOCK — hg-v903.

   The tie sweep below anchors its tapes to Date.now() and passes now:
   Date.now() into the engine, whose session gates are time-of-day dependent.
   Whether any of the 400 tapes lands on an exact L == S tie therefore moved
   with the wall clock: this file passed in isolation and failed inside a
   suite run fourteen minutes earlier, reporting "0 of them were exact ties".

   Same defect, same fix as test-cryptoscan-rank-stamp.mjs in hg-v894: pin the
   instant and anchor the tapes to it, so the sweep asks the same question
   every run. Nothing about what is asserted changes. */
const FIXED_NOW = Date.UTC(2026, 8, 20, 12, 0, 0);   /* 12:00 UTC — a liquid hour */
class FixedDate extends Date {
  constructor(){ if (arguments.length === 0) super(FIXED_NOW); else super(...arguments); }
  static now(){ return FIXED_NOW; }
}

function boot(){
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date: FixedDate, Intl,
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
const ULTRA = fs.readFileSync(root + 'cryptoultra.js', 'utf8');
const SCAN = fs.readFileSync(root + 'cryptoscan.js', 'utf8');
const SEC = 900;

/* ---------------------------------------------------------------- 1 */
console.log('\n1. every threshold the rule reads has to exist');
{
  /* THE STRUCTURAL GUARD. This is the defect class, not just the two
     instances: any `rule.X` / `RULE.X` whose key is absent compares as
     `x < undefined` and passes forever, silently. */
  const bare = stripComments(ULTRA);
  const refs = [];
  (bare.match(/\b(?:rule|RULE)\.([a-zA-Z_$][\w$]*)/g) || []).forEach(m => {
    const k = m.split('.')[1];
    if (refs.indexOf(k) < 0) refs.push(k);
  });
  ok(refs.length >= 6, 'the engine reads ' + refs.length + ' distinct rule keys');
  const R = S.HG_CRYPTO_ULTRA_RULE;
  ok(R && typeof R === 'object', 'and RULE is exported so they can be checked');
  const dangling = refs.filter(k => !(k in R));
  ok(dangling.length === 0,
     'every one of them exists in RULE — a dangling key compares as `x < undefined` '
     + 'and passes forever' + (dangling.length ? ' (dangling: ' + dangling.join(', ') + ')' : ''));
  /* THE TWO THAT WERE DANGLING NO LONGER APPEAR IN THAT LIST AT ALL, and that
     is the fix rather than a hole in the guard: they are reached through
     ruleThreshold(rule, 'minAvail'), which returns null for an absent key
     instead of handing the comparison an undefined. A direct `rule.minAvail`
     is exactly the shape that passes silently, so the guard above watches for
     it and these two deliberately stopped being one. */
  ok(refs.indexOf('minAvail') < 0 && refs.indexOf('minPct') < 0,
     'minAvail and minPct are no longer read as bare property accesses');
  ok(/ruleThreshold\(rule, 'minAvail'\)/.test(bare) && /ruleThreshold\(rule, 'minPct'\)/.test(bare),
     'they go through ruleThreshold, which can report an absence');
  ok(/minAvail/.test(bare) && /minPct/.test(bare),
     'so the rule still describes both floors — it just no longer pretends to enforce them');
  /* and the guard is not vacuous: it is watching real accesses */
  ok(refs.indexOf('stopAtr') >= 0 && refs.indexOf('timeoutBars') >= 0,
     'the guard still covers the keys that ARE read directly (' + refs.join(', ') + ')');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. an absent threshold is a fact, not a comparison that passes');
{
  const th = S.HG_CRYPTO_ULTRA_RULE_THRESHOLD;
  ok(typeof th === 'function', 'ruleThreshold is reachable');
  ok(th({ x: 1.5 }, 'x') === 1.5, 'a configured number is returned');
  ok(th({ x: 0 }, 'x') === 0, 'and zero IS a threshold, not an absence');
  ok(th({}, 'x') === null, 'a missing key is null');
  ok(th({ x: null }, 'x') === null && th({ x: undefined }, 'x') === null,
     'so are null and undefined');
  ok(th({ x: 'abc' }, 'x') === null, 'and so is something that is not a number');
  ok(th(null, 'x') === null, 'no rule at all does not throw');
  ok(th({ x: '0.62' }, 'x') === 0.62, 'a numeric string is coerced once, here, not at the comparison');

  /* the guard the whole finding rests on */
  ok((5 < undefined) === false && (0.5 < undefined) === false,
     'because `x < undefined` is false for every x — which is why neither gate ever fired');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. the gates apply only when configured, and say when they are not');
{
  const R = S.HG_CRYPTO_ULTRA_RULE;
  const T = S.HG_CRYPTO_ULTRA_VOTE_FLOOR_TEXT;
  ok(typeof T === 'function', 'the rule text is a function, not an interpolation at two call sites');

  const today = T();
  ok(!/undefined/.test(today) && !/NaN/.test(today),
     'as configured today it prints neither undefined nor NaN: "' + today + '"');
  ok(/no decisive-count floor/.test(today) && /no agreement floor/.test(today),
     'it names both missing floors');
  ok(/not applied/.test(today), 'and says they are not applied');

  /* and it becomes the plain rule the moment the desk configures them.
     Restored with `delete`, not by writing the saved value back: assigning
     undefined CREATES the key, which is the same "absent vs present-but-
     unusable" confusion this whole pack is about. */
  const hadA = ('minAvail' in R), hadP = ('minPct' in R);
  const savedA = R.minAvail, savedP = R.minPct;
  const putBack = () => {
    if (hadA) R.minAvail = savedA; else delete R.minAvail;
    if (hadP) R.minPct = savedP; else delete R.minPct;
  };
  R.minAvail = 60; R.minPct = 0.62;
  const both = T();
  ok(/≥60 decisive/.test(both) && /62% agree/.test(both),
     'configured, it states the floors: "' + both + '"');
  ok(!/not applied/.test(both), 'with no disclaimer left over');
  if (hadP) R.minPct = savedP; else delete R.minPct;
  const one = T();
  ok(/≥60 decisive/.test(one) && /no agreement floor is configured/.test(one),
     'one of each reads correctly, singular: "' + one + '"');
  ok(/that gate is not applied/.test(one), 'and agrees in number');
  putBack();
  ok(/are configured, so those gates are not applied/.test(T()),
     'while two missing agrees in the plural');
  ok(('minAvail' in R) === hadA && ('minPct' in R) === hadP,
     'and the fixture put RULE back exactly as it found it');

  /* the surfaces use it rather than interpolating the keys */
  const bare = stripComments(ULTRA);
  ok(!/RULE\.minAvail \+/.test(bare) && !/Math\.round\(RULE\.minPct \* 100\)/.test(bare),
     'neither surface interpolates the raw keys any more');
  ok((bare.match(/ruleVoteFloorText\(\)/g) || []).length >= 2,
     'both of them call the shared text instead');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. a tie is not a side');
{
  const bare = stripComments(ULTRA);
  ok(!/lead = L >= S \? 'long' : 'short'/.test(bare),
     "the `L >= S ? 'long'` tie-break is gone");
  ok(/var lead = L > S \? 'long' : S > L \? 'short' : null;/.test(bare),
     'a tie now produces no side at all');
  ok(/a tie is not a direction/.test(bare),
     'and the gate says so in the tally\'s own numbers');

  /* driven through the real engine over tapes that actually tie */
  let seed = 11;
  function tape(sd){
    let s2 = sd;
    const r = () => { s2 = (s2 * 1103515245 + 12345) & 0x7fffffff; return s2 / 0x7fffffff; };
    const drift = (r() - 0.5) * 0.06, vol = 0.004 + r() * 0.03;
    const N = 300, out = []; let px = 100;
    const base = Math.floor(FIXED_NOW / 1000 / SEC) * SEC, t0 = base - N * SEC;
    for (let i = 0; i < N; i++){
      const o = px, c = px * (1 + (r() - 0.5 + drift) * vol);
      out.push({ t: t0 + i * SEC, o: o, c: c, h: Math.max(o, c) * (1 + vol * 0.2),
                 l: Math.min(o, c) * (1 - vol * 0.2), v: 1000 + r() * 4000 });
      px = c;
    }
    return out;
  }
  let ties = 0, tiesWithDir = 0, tiesWithPlan = 0, fired = 0, seen = 0, lowest = 1;
  let tieLine = '';
  for (let k = 0; k < 400; k++){
    const res = S.cryptoUltraEngine({ rows15m: tape(17 + k * 97), rows1h: [],
      now: FIXED_NOW, venueCost: { rtFrac: 0.0011, venue: 'delta' } });
    if (!res.ok || !res.count) continue;
    seen++;
    if (res.count.L === res.count.S && res.count.decisive > 0){
      ties++;
      if (res.dir) tiesWithDir++;
      if (res.plan) tiesWithPlan++;
      if (!tieLine) tieLine = res.line;
    }
    if (res.dir && res.plan){ fired++; if (res.count.pct < lowest) lowest = res.count.pct; }
  }
  ok(seen > 300, 'the sweep reached the engine on ' + seen + ' tapes');
  ok(ties > 0, 'and ' + ties + ' of them were exact ties — the case that used to read LONG');
  ok(tiesWithDir === 0, 'none of those now carries a direction');
  ok(tiesWithPlan === 0, 'and none is priced with an entry, stop and targets');
  ok(/no side/.test(tieLine), 'the tally line says so: "' + tieLine + '"');
  ok(!/agree (LONG|SHORT)/.test(tieLine), 'rather than claiming a side agreed');
  ok(fired > 100, 'while ' + fired + ' non-tied tapes still fire normally');
  ok(lowest > 0.5, 'and the lowest agreement that fires is now above 50% ('
     + Math.round(lowest * 100) + '%) — it was exactly 50%');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. the unapplied floors are reported on the result');
{
  const res = S.cryptoUltraEngine({ rows15m: (function(){
    let s2 = 4242;
    const r = () => { s2 = (s2 * 1103515245 + 12345) & 0x7fffffff; return s2 / 0x7fffffff; };
    const N = 300, out = []; let px = 100;
    const base = Math.floor(FIXED_NOW / 1000 / SEC) * SEC, t0 = base - N * SEC;
    for (let i = 0; i < N; i++){
      const o = px, c = px * (1 + (r() - 0.5 + 0.09) * 0.010);
      out.push({ t: t0 + i * SEC, o: o, c: c, h: Math.max(o, c) * 1.001,
                 l: Math.min(o, c) * 0.999, v: 1000 + r() * 1000 });
      px = c;
    }
    return out;
  })(), rows1h: [], now: FIXED_NOW, venueCost: { rtFrac: 0.0011, venue: 'delta' } });
  ok(res.ok, 'the engine ran');
  ok(Array.isArray(res.unapplied), 'the result carries an `unapplied` list');
  ok(res.unapplied.indexOf('minAvail') >= 0 && res.unapplied.indexOf('minPct') >= 0,
     'naming both floors that are not enforced: ' + JSON.stringify(res.unapplied));
  ok(!res.gates.some(g => /undefined|NaN/.test(g)),
     'and no gate message carries undefined or NaN');
  ok(res.unapplied.length === 2,
     'and nothing else is listed — the other six rule keys are all configured');
}

/* ---------------------------------------------------------------- 6 */
console.log('\n6. a configured floor gates, and CRYPTO SCAN stops passing a dead flag');
{
  const R = S.HG_CRYPTO_ULTRA_RULE;
  function upTape(){
    let s2 = 4242;
    const r = () => { s2 = (s2 * 1103515245 + 12345) & 0x7fffffff; return s2 / 0x7fffffff; };
    const N = 300, out = []; let px = 100;
    const base = Math.floor(FIXED_NOW / 1000 / SEC) * SEC, t0 = base - N * SEC;
    for (let i = 0; i < N; i++){
      const o = px, c = px * (1 + (r() - 0.5 + 0.09) * 0.010);
      out.push({ t: t0 + i * SEC, o: o, c: c, h: Math.max(o, c) * 1.001,
                 l: Math.min(o, c) * 0.999, v: 1000 + r() * 1000 });
      px = c;
    }
    return out;
  }
  const arg = { rows1h: [], now: FIXED_NOW, venueCost: { rtFrac: 0.0011, venue: 'delta' } };
  const open = S.cryptoUltraEngine(Object.assign({ rows15m: upTape() }, arg));
  ok(open.dir && open.plan, 'with no floors configured this tape fires');

  R.minPct = 0.999;
  const gated = S.cryptoUltraEngine(Object.assign({ rows15m: upTape() }, arg));
  ok(!gated.dir && !gated.plan, 'a 99.9% agreement floor stops it');
  ok(gated.gates.some(g => /agreement \d+% < 99%/.test(g) || /agreement/.test(g)),
     'naming the floor it missed: ' + JSON.stringify(gated.gates));
  ok(gated.unapplied.indexOf('minPct') < 0, 'and minPct is no longer listed as unapplied');
  ok(gated.unapplied.indexOf('minAvail') >= 0, 'while minAvail still is');
  delete R.minPct;

  R.minAvail = 1e9;
  const gated2 = S.cryptoUltraEngine(Object.assign({ rows15m: upTape() }, arg));
  ok(!gated2.dir && /fewer than 1000000000 decisive/.test(gated2.gates.join(' ')),
     'and a decisive-count floor gates the same way');
  delete R.minAvail;
  ok(S.cryptoUltraEngine(Object.assign({ rows15m: upTape() }, arg)).dir === open.dir,
     'removing them restores the original behaviour exactly');

  /* the flag CRYPTO SCAN passed that the engine never read */
  const scan = stripComments(SCAN);
  ok(!/allowUnverified/.test(scan),
     'cryptoscan no longer passes allowUnverified');
  ok(!/allowUnverified/.test(stripComments(ULTRA)),
     'which the engine never read — it was the only occurrence of that name in the app');
  ok(/venueCost: costFor\(item\) \}\);/.test(scan),
     'and the call is otherwise unchanged');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
