/* HARDGATE — hg-v1318: A SCALP SETUP AND A SWING SETUP on CANDLE FORECAST.

   WHAT IT IS. The tab printed ONE bracket with no statement of which horizon it
   belonged to. A 15m read and a 4h read are different trades — the scalp lives or
   dies inside a session, the swing rides a move for days — so both are built now,
   each on its own tape and each carrying its OWN ATR, because risk has to be
   measured on the timeframe the trade is taken on.

   THE INVARIANTS THIS GUARD PROTECTS
     1. ONE HOME. There is a single bracket builder; the scalp and the swing are two
        CALLS to it with different tapes, never two copies of the maths (hg-v949).
     2. The builder is PURE and TAPE-DRIVEN — it fetches nothing, so the horizon a
        bracket describes can never depend on a network call made inside it.
     3. A bracket that did not FORM still reports its risk in ATRs, so the two
        horizons can be compared without pretending their dollars are the same.
     4. Nothing here gates, scores or prices: it turns a verdict the engine already
        reached into entry, stop and two targets.
     5. It fails open: a thin tape, a missing read or a missing builder is named.

   Run: node tests/test-candle-forecast-two-horizons.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok - ' + m); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SRC = read('goldind.js');
const TAB = read('gold-candle-forecast.js');

/* BRACE-COUNTED lift, comment- and string-aware, at module scope because more than
   one section needs it. ORDER MATTERS: comments and strings are checked BEFORE braces,
   but the `{` itself must be counted by the brace branch — an earlier draft tested the
   string case first, and the search string `'function ' + name` supplied a stray quote
   that swallowed the opening brace as an unterminated string, truncating the lift and
   making the engine look like it refused every tape. */
function lift(text, name) {
  const start = text.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('could not lift ' + name + ' (renamed or deleted?)');
  let d = 0, i = text.indexOf('{', start);
  for (; i < text.length; i++) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '/'){ while (i < text.length && text[i] !== '\n') i++; continue; }
    if (c === '/' && text[i + 1] === '*'){ i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '{'){ d++; continue; }
    if (c === '}'){ d--; if (d === 0) return text.slice(start, i + 1); continue; }
    if (c === '"' || c === "'" || c === '`'){ const q = c; i++; while (i < text.length && text[i] !== q){ if (text[i] === '\\') i++; i++; } i++; continue; }
  }
  throw new Error('unbalanced braces lifting ' + name);
}

console.log('== 1) ONE HOME: a single builder, called twice ==');
{
  const defs = [...SRC.matchAll(/function hgCfBuildSetup\(/g)].length;
  ok(defs === 1, 'exactly one bracket builder is defined (' + defs + ')');
  ok(/window\.hgCfBuildSetup\s*=\s*hgCfBuildSetup/.test(SRC), 'and it is exported for the tab');
  /* the tab must CALL it for both horizons rather than carry its own levels maths */
  const calls = [...TAB.matchAll(/hgCfBuildSetup\(/g)].length;
  ok(calls >= 2, 'the tab calls it for both horizons (' + calls + ' call sites)');
  ok(/tf:\s*'15m'/.test(TAB) && /tf:\s*'4h'/.test(TAB), 'once as 15m and once as 4h');
  ok(!/tp1\s*=\s*[^=]/.test(TAB), 'the tab computes no targets of its own');
  ok(!/stop\s*=\s*[^=]/.test(TAB), 'and no stop of its own');
}

console.log('\n== 2) the builder is PURE and TAPE-DRIVEN ==');
{
  const fn = (() => {
    const start = SRC.indexOf('function hgCfBuildSetup(');
    let d = 0, i = SRC.indexOf('{', start);
    for (; i < SRC.length; i++) {
      const c = SRC[i];
      if (c === '/' && SRC[i + 1] === '/'){ while (i < SRC.length && SRC[i] !== '\n') i++; continue; }
      if (c === '/' && SRC[i + 1] === '*'){ i += 2; while (i < SRC.length && !(SRC[i] === '*' && SRC[i + 1] === '/')) i++; i += 2; continue; }
      if (c === '"' || c === "'" || c === '`'){ const q = c; i++; while (i < SRC.length && SRC[i] !== q){ if (SRC[i] === '\\') i++; i++; } i++; continue; }
      if (c === '{') d++; else if (c === '}'){ d--; if (d === 0) return SRC.slice(start, i + 1); }
    }
    throw new Error('unbalanced');
  })();
  ok(!/fetch\(|XMLHttpRequest|await /.test(fn), 'the builder opens no network path');
  ok(!/document\.|innerHTML/.test(fn), 'and touches no DOM');
  ok(/barsPerDay/.test(fn), 'it states the horizon in bars per day');
  ok(/96/.test(fn) && /6/.test(fn), 'with 15m and 4h mapped to 96 and 6');
}

console.log('\n== 3) it builds BOTH horizons, each with its own ATR ==');
{
  const ctx = { console, Math, Date, JSON, Number, String, Object, Array, RegExp, Error, TypeError, Promise,
    isFinite, isNaN, parseFloat, parseInt, Infinity, NaN };
  vm.createContext(ctx);
  /* the engine and the builder are lifted together — the builder calls the engine */
  const hs = SRC.indexOf('function hgCfPack');
  const he = SRC.indexOf('function goldCandleForecast');
  const block = SRC.slice(hs, he);
  /* EVERY helper the engine calls must be lifted. The engine's own catch turns a
     missing one into `return null`, so a short list here does not fail loudly — it
     silently makes the engine look like it refused the tape, which is exactly how
     this guard first failed. hgCfStructure and hgCfGoldDesk are upstream's additions
     and the engine calls both. */
  const NEEDED = ['hgCfPack', 'hgCfCandlePatterns', 'hgCfAdvancedPatterns', 'hgCfStructure', 'aAdvance', 'hgCfGoldDesk'];
  const helpers = NEEDED.map(n => lift(block, n)).join('\n');
  ok(helpers.length > 20000, 'every helper the engine calls was lifted (' + helpers.length + ' chars)');
  /* the engine references W for the structure and desk readers */
  ctx.W = ctx;
  ctx.__last = a => (a && a.length) ? a[a.length - 1] : NaN;
  ctx._ema = (vals, n) => { const k = 2 / (n + 1), out = []; let e = vals[0]; for (let i = 0; i < vals.length; i++){ e = i ? (vals[i] * k + e * (1 - k)) : vals[i]; out.push(e); } return out; };
  ctx._atr = (rows, n) => { const trs = rows.map((r, i) => { if (!i) return r.h - r.l; const q = rows[i - 1]; return Math.max(r.h - r.l, Math.abs(r.h - q.c), Math.abs(r.l - q.c)); });
    const out = []; for (let i = 0; i < trs.length; i++){ if (i < n - 1){ out.push(trs[i]); continue; } let s = 0; for (let j = i - n + 1; j <= i; j++) s += trs[j]; out.push(s / n); } return out; };
  ctx.atr = ctx._atr; ctx.ema = ctx._ema;
  vm.runInContext(helpers + '\n' + lift(SRC, 'goldCandleForecast') + '\n' + lift(SRC, 'hgCfBuildSetup') +
    '\nthis.engine = goldCandleForecast; this.build = hgCfBuildSetup;', ctx, { filename: 'lifted' });

  const bar = (o, h, l, c) => ({ o, h, l, c, v: 1000, t: 0 });
  /* a 15m tape: small ranges (a scalp tape) */
  const t15 = []; let c1 = 2300;
  for (let i = 0; i < 110; i++) { c1 += (i % 4 === 0 ? -0.2 : 0.25); t15.push(bar(c1 - 0.15, c1 + 0.3, c1 - 0.35, c1)); }
  /* NOTE the high must be ABOVE the high of open/close: an earlier fixture here built
     h < l (the "wick" was set below the body) and the engine correctly refused the
     tape — the bug was the fixture's, not the engine's. */
  t15.push(bar(c1 - 0.6, c1 + 0.9, c1 - 0.7, c1 + 0.7));
  t15.push(bar(c1 + 0.7, c1 + 1.1, c1 + 0.3, c1 + 0.5));
  t15.push(bar(c1 + 0.5, c1 + 1.8, c1 + 0.4, c1 + 1.7));
  /* a 4h tape: much wider ranges (a swing tape) */
  const t4 = []; let c2 = 2300;
  for (let i = 0; i < 110; i++) { c2 += (i % 4 === 0 ? -3 : 4); t4.push(bar(c2 - 3, c2 + 5, c2 - 6, c2)); }
  t4.push(bar(c2 - 6, c2 + 14, c2 - 8, c2 + 12));
  t4.push(bar(c2 + 12, c2 + 18, c2 + 6, c2 + 8));
  t4.push(bar(c2 + 8, c2 + 27, c2 + 5, c2 + 25));

  const s15 = ctx.build(t15, { tf: '15m' }, ctx.engine(t15));
  const s4 = ctx.build(t4, { tf: '4h' }, ctx.engine(t4));
  ok(s15.ok === true && s4.ok === true, 'both horizons build a bracket');
  ok(s15.tf === '15m' && s4.tf === '4h', 'and each states its own timeframe');
  ok(s15.barsPerDay === 96 && s4.barsPerDay === 6, 'with the right bars per day (' + s15.barsPerDay + ' / ' + s4.barsPerDay + ')');
  ok(isFinite(s15.entry) && isFinite(s4.entry), 'both carry an entry');
  /* THE POINT OF THE PACK: the two tapes have very different volatility, and each
     bracket must be measured against its OWN ATR rather than a shared one */
  ok(isFinite(s15.riskAtr) && isFinite(s4.riskAtr),
    'both report risk in ATRs, so the horizons are comparable (' + s15.riskAtr + 'x / ' + s4.riskAtr + 'x)');
  ok(s4.entry !== s15.entry || s4.risk !== s15.risk, 'and the two brackets are genuinely different trades');
}

console.log('\n== 4) a non-formed bracket still reports its risk ==');
{
  const fn = lift(SRC, 'hgCfBuildSetup');
  ok(/else if \(isFinite\(out\.entry\)[\s\S]{0,600}out\.riskAtr/.test(fn),
    'the builder reports risk even when no setup formed (a declined call still has a bracket to weigh)');
  ok(/NOT FORMED still reports/.test(fn) && /never labelled a setup/.test(fn),
    'and the source states the rule in words: reported, never labelled a setup');
}

console.log('\n== 5) the tab shows both, labelled, and fails open ==');
{
  ok(/data-cf-horizons="1"/.test(TAB), 'the card carries a horizons block');
  ok(/SCALP AND SWING/.test(TAB), 'labelled SCALP AND SWING');
  ok(/scalp.*'SCALP'|'SCALP'/.test(TAB) && /'SWING'/.test(TAB), 'both horizons are named');
  ok(/not the same risk/.test(TAB), 'and the card states that the two stops are not the same risk');
  ok(/the 4h gold tape could not be read/.test(TAB), 'an unread 4h tape is named rather than blanking the swing');
  ok(/mod\.loadGold = async function/.test(TAB), 'one loader serves every horizon');
  ok(/mod\.loadGold15m = function \(\) \{ return mod\.loadGold\('15m', 80\); \}/.test(TAB),
    'the old 15m name is kept as a thin alias so nothing else breaks');
  ok(!/getGoldCandles\('15m'/.test(TAB) || /loadGold\('15m'/.test(TAB), 'the loader is parameterised, not duplicated');
  ok(/hg-v1318/.test(SRC), 'the pack is identified in the source (hg-v956 textual pin)');
}

console.log('\ntest-candle-forecast-two-horizons: ' + pass + ' passed, 0 failed');
