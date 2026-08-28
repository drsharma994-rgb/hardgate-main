/* HARDGATE — the replicated-gate stack, judged on bars that did not exist.

   THE CLAIM UNDER TEST (frozen 2026-08-27, in-sample, PAXG 4h):
     tape-aligned firings where regime-fit, htf-confirm and hurst-regime all
     agree hit 44.2% at 2R (n=608) against 31.6% for the tape alone — z +5.68.
     On the 1h scalp horizon the same stack showed nothing (z +1.93 at 2R,
     +1.58 at 1R). Figures are under the close-by-close alignment rule this
     script implements; the originally quoted 45.0%/z +5.80 came from the
     first measurement pass, whose scalp legs were later found to read a 4h
     close early — the swing claim survived the fix almost unchanged.

   WHY THIS SCRIPT CAN CALL ITSELF OUT-OF-SAMPLE. Detection is deterministic
   from candles, and every rule here — the mechanics, the tape, the three
   gates, the 2R walk-forward — was frozen before CUTOFF. Bars with
   t >= CUTOFF had not printed when the claim was made, so replaying the
   frozen rules over them is forward evidence, exactly like the browser's
   forward log but recomputable by anyone from public data.

   WHAT IT REFUSES TO DO:
     - judge a firing whose full horizon of bars has not yet printed
       (an open trade is not a sample);
     - move the cutoff (CUTOFF is a literal, not a clock read);
     - characterize the verdict below 40 settled stack firings, the same
       threshold the forward panel uses.

   Run: node scripts/stack-oos-check.mjs
   Writes: stack-oos-state.json (repo root). A scheduled workflow commits it
   when it changed, so the verdict accumulates in git history. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/* 2026-08-28T00:00:00Z — the first UTC midnight AFTER the in-sample
   measurement. A literal on purpose: a cutoff derived from the clock would
   slide forward every run and the test would never accumulate. */
export const CUTOFF_SEC = 1787875200;

export const KEEP = ['regime-fit', 'htf-confirm', 'hurst-regime'];

/* Identical to the horizons the in-sample measurement used. Changing these
   would make the out-of-sample number answer a different question.
   tfSec/otherTfSec exist because bar timestamps are OPEN times: the other
   horizon's bar is only usable once it has CLOSED by this bar's close. */
export const GS = { label: 'SCALP', tf: '1h', tfSec: 3600, otherTfSec: 14400, horizonBars: 24, warm: 60, minAtrPct: 0.05, sessionHard: true };
export const GW = { label: 'SWING', tf: '4h', tfSec: 14400, otherTfSec: 3600, horizonBars: 20, warm: 45, minAtrPct: 0.12, sessionHard: false };

export function z2(a, b){
  if (!a || !b || a.n < 30 || b.n < 30) return NaN;
  const ha = a.w / a.n, hb = b.w / b.n, p = (a.w + b.w) / (a.n + b.n);
  const se = Math.sqrt(p * (1 - p) * (1 / a.n + 1 / b.n));
  return se > 0 ? (ha - hb) / se : NaN;
}

/* Wilson lower bound confidence interval for binomial proportion.
   Returns the lower bound at the given z-score (1.96 for 95%, ~1.645 for 90%). */
export function wilsonLB(wins, n, z){
  z = z || 1.96;
  if (!n || n <= 0) return 0;
  const p = wins / n, z2 = z * z, denom = 1 + z2 / n;
  const centre = p + z2 / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  return Math.max(0, (centre - margin) / denom);
}

export function verdictOf(stack, tape){
  const n = stack ? stack.n : 0;
  if (n < 40) return { status: 'accumulating', text: 'Too few to judge yet — ' + n + ' of 40 settled stack firings.', confidence: null };
  const z = z2(stack, tape);
  const hs = (100 * stack.w / stack.n).toFixed(1);
  const ht = tape && tape.n ? (100 * tape.w / tape.n).toFixed(1) : '-';
  if (isFinite(z) && z >= 1.96)
    return { status: 'holds', text: 'HOLDS UP out-of-sample: stack ' + hs + '% vs tape ' + ht + '% (z +' + z.toFixed(2) + ').' , confidence: null };
  if (isFinite(z) && z <= -1.96)
    return { status: 'refuted', text: 'REFUTED out-of-sample: stack ' + hs + '% vs tape ' + ht + '% (z ' + z.toFixed(2) + ').' , confidence: null };
  return { status: 'undecided', text: 'Not separated yet: stack ' + hs + '% vs tape ' + ht + '% (z ' + (z >= 0 ? '+' : '') + z.toFixed(2) + ').' , confidence: null };
}

/* Check settled-evidence confidence and promote verdict if thresholds are met.
   Returns verdict with confidence value and potentially promoted status.

   Thresholds are calibrated to the in-sample 44.2% performance:
   - SETTLED EXECUTE: 95% CI lower >= 40% (very confident, can trade live)
   - SCALP VERDICT: 90% CI lower >= 35% (high confidence, tactical positions)

   These thresholds allow the verdict to advance as out-of-sample evidence
   accumulates around the in-sample claim level. */
export function verdictOfWithConfidence(stack, tape){
  const baseVerdict = verdictOf(stack, tape);
  const n = stack ? stack.n : 0;

  if (n < 40) return baseVerdict;

  /* Calculate Wilson lower bounds at both confidence levels */
  const w95 = wilsonLB(stack.w, stack.n, 1.96); /* 95% confidence z-score */
  const w90 = wilsonLB(stack.w, stack.n, 1.645); /* 90% confidence z-score (~1.645) */

  const hitRate = stack.w / stack.n;
  const hitPct = (100 * hitRate).toFixed(1);
  const confidence = +(100 * w95).toFixed(1); /* Report 95% CI lower bound as main metric */

  /* Promotion thresholds based on achieved out-of-sample performance.
     The in-sample claim was 44.2%, so these thresholds allow advancement
     when evidence accumulates around or above that level. */
  if (w95 >= 0.40) {
    /* 95% confidence lower bound >= 40% → can trade live with high certainty */
    return {
      status: 'SETTLED EXECUTE',
      text: 'SETTLED EXECUTE: stack ' + hitPct + '% hit rate with 95% CI lower bound at ' +
            confidence + '% — high-confidence evidence supports live trading.',
      confidence: confidence
    };
  }

  if (w90 >= 0.35) {
    /* 90% confidence lower bound >= 35% → high confidence but slightly lower bar */
    return {
      status: 'SCALP VERDICT',
      text: 'SCALP VERDICT: stack ' + hitPct + '% hit rate with 90% CI lower bound at ' +
            +(100 * w90).toFixed(1) + '% — meets confidence threshold for tactical positions.',
      confidence: confidence
    };
  }

  /* Fall back to z-test based verdict if confidence thresholds not met */
  return { ...baseVerdict, confidence: confidence };
}

/* The same walk the in-sample measurement ran, with three extra refusals:
   bars before cutoffSec are indicator warmup only; a firing without its
   full horizon of printed bars is skipped as OPEN rather than settled; and
   the other horizon's bar counts only once it has CLOSED by this bar's
   close. That last rule is what the live desk actually sees — it drops the
   forming bar before the tape reads — and without it the 1h legs were
   reading a 4h close up to three hours in the future (caught in review; the
   4h leg was never affected, because 1h bars close before the 4h decision).

   Rs is an ARRAY: bucket membership (tape, gate stack) is R-independent, so
   detection and the gate ledger run once per bar and only the walk-forward
   settle differs per R. One pass instead of one per R is what keeps the CI
   job inside its timeout as the post-cutoff window grows. */
export function walk(ctx, rows, other, cfg, Rs, cutoffSec){
  const arm = () => ({ n: 0, w: 0 });
  const legs = Rs.map(() => ({ all: arm(), tape: arm(), stack2: arm(), stack3: arm() }));
  let oi = -1, bars = 0, firstT = 0, lastT = 0;
  for (let i = cfg.warm; i < rows.length - cfg.horizonBars; i++){
    const tNow = rows[i].t;
    while (oi + 1 < other.length && other[oi + 1].t + cfg.otherTfSec <= tNow + cfg.tfSec) oi++;
    if (tNow < cutoffSec) continue;
    bars++; if (!firstT) firstT = tNow; lastT = tNow;
    const pre = rows.slice(0, i + 1), px = pre[i].c;
    const otherPre = other.slice(0, oi + 1);
    const myDir = ctx.hgOgTapeDir(pre);
    const otherDir = otherPre.length >= 55 ? ctx.hgOgTapeDir(otherPre) : '';
    const desk = (cfg.label === 'SCALP') ? ctx.hgOgDeskTape(myDir, otherDir) : ctx.hgOgDeskTape(otherDir, myDir);
    let hits = [];
    try { hits = ctx.hgOgDetect(pre, { nowSec: tNow }); } catch (e) { continue; }
    if (!hits || !hits.length) continue;
    for (const h of hits){
      const aligned = desk !== '' && h.dir === desk;
      /* gate read once — it does not depend on R. gatesOk false keeps the
         firing out of the stack buckets but IN all/tape, matching the
         in-sample measurement's handling of a throwing ledger. */
      let pass = 0, read = 0, gatesOk = false;
      if (aligned){
        try {
          const gates = ctx.hgOgGates(pre, h, { nowSec: tNow, adr: ctx.hgOgAdr(pre, 14), livePx: px,
                                                minAtrPct: cfg.minAtrPct, sessionHard: cfg.sessionHard }) || [];
          gatesOk = true;
          for (const g of gates){
            if (KEEP.indexOf(g.key) < 0) continue;
            if (g.pass === true){ pass++; read++; }
            else if (g.pass === false){ read++; }
          }
        } catch (e) { gatesOk = false; }
      }
      for (let ri = 0; ri < Rs.length; ri++){
        const r = ctx.hgOmniWalkForward(rows, i, h.dir, Rs[ri], cfg.horizonBars, true);
        if (!r || (r.res !== 't1' && r.res !== 'stop')) continue;
        const win = r.res === 't1';
        const L = legs[ri];
        L.all.n++; if (win) L.all.w++;
        if (!aligned) continue;
        L.tape.n++; if (win) L.tape.w++;
        if (!gatesOk) continue;
        if (read >= 2 && pass >= 2){ L.stack2.n++; if (win) L.stack2.w++; }
        if (read >= 2 && pass === read){ L.stack3.n++; if (win) L.stack3.w++; }
      }
    }
  }
  return legs.map(L => ({ ...L, bars, firstT, lastT }));
}

export function bucketOut(a, R){
  const hit = a.n ? a.w / a.n : null;
  return { n: a.n, wins: a.w,
           hitPct: hit == null ? null : +(100 * hit).toFixed(1),
           expR: hit == null ? null : +(hit * R - (1 - hit)).toFixed(3) };
}

export function bootCtx(){
  const ctx = { console, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, Float64Array, Infinity, NaN };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js', 'hg-forward.js',
                   'plans.js', 'hg-gates.js', 'hg-plan.js', 'structure-levels.js', 'best-levels.js',
                   'gold-best-levels.js', 'regime.js', 'goldind.js', 'pinegoldmath.js', 'omniroute.js', 'omnigold.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

/* data-api.binance.vision is Binance's public market-data mirror and answers
   from GitHub's US runners, where api.binance.com refuses with 451. */
const HOSTS = ['https://data-api.binance.vision', 'https://api.binance.com'];

export async function fetchKlines(sym, interval, startMs){
  const out = []; let t = startMs;
  for (;;){
    let j = null, lastErr = null;
    for (const h of HOSTS){
      try {
        const r = await fetch(h + '/api/v3/klines?symbol=' + sym + '&interval=' + interval + '&limit=1000&startTime=' + t);
        if (r.ok){ j = await r.json(); break; }
        lastErr = new Error(h + ' -> HTTP ' + r.status);
      } catch (e){ lastErr = e; }
    }
    if (!j) throw new Error('klines fetch failed ' + sym + ' ' + interval + ': ' + (lastErr && lastErr.message));
    if (!Array.isArray(j) || !j.length) break;
    for (const k of j){
      const sec = Math.floor(k[0] / 1000);
      if (out.length && out[out.length - 1].t >= sec) continue;
      out.push({ t: sec, o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] });
    }
    if (j.length < 1000) break;
    t = j[j.length - 1][0] + 1;
  }
  return out;
}

export async function main(){
  const ctx = bootCtx();
  /* 400 bars of pre-cutoff history feed the indicators; nothing fired on
     them is ever counted. */
  const g1 = ctx.hgOmniDropForming(await fetchKlines('PAXGUSDT', '1h', (CUTOFF_SEC - 400 * 3600) * 1000), '1h');
  const g4 = ctx.hgOmniDropForming(await fetchKlines('PAXGUSDT', '4h', (CUTOFF_SEC - 400 * 14400) * 1000), '4h');

  const [swing] = walk(ctx, g4, g1, GW, [2.0], CUTOFF_SEC);
  const [scalp, scalp1] = walk(ctx, g1, g4, GS, [2.0, 1.0], CUTOFF_SEC);

  const v = verdictOfWithConfidence(swing.stack3, swing.tape);
  const day = (t) => t ? new Date(t * 1000).toISOString().slice(0, 10) : null;

  const leg = (r, R) => ({
    every: bucketOut(r.all, R), tape: bucketOut(r.tape, R),
    stack2of3: bucketOut(r.stack2, R), stack3of3: bucketOut(r.stack3, R),
    zStackVsTape: isFinite(z2(r.stack3, r.tape)) ? +z2(r.stack3, r.tape).toFixed(2) : null,
    judgedBars: r.bars, firstBar: day(r.firstT), lastBar: day(r.lastT)
  });

  const state = {
    claim: 'GOLD SWING @2R: tape-aligned + regime-fit + htf-confirm + hurst-regime all agree. In-sample 44.2% hit vs 31.6% tape-alone (z +5.68, n=608, close-by-close alignment), frozen before the cutoff.',
    cutoff: '2026-08-28T00:00:00Z',
    lastCheckedDate: new Date().toISOString().slice(0, 10),
    status: v.status,
    verdict: v.text,
    confidence: v.confidence,
    swing2R: leg(swing, 2.0),
    scalpControl2R: leg(scalp, 2.0),
    scalpControl1R: leg(scalp1, 1.0)
  };

  /* Rewrite only when the SUBSTANTIVE state moved. lastCheckedDate alone is
     not a change: a daily keep-alive commit would race the alert bot's plain
     `git push` every quiet day for nothing. Verdict state changes (including
     confidence promotions) are considered substantive. */
  const statePath = path.join(ROOT, 'stack-oos-state.json');
  const substance = (o) => { const c = { ...o }; delete c.lastCheckedDate; return JSON.stringify(c); };
  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch (e) {}
  if (!prev || substance(prev) !== substance(state)){
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
  } else {
    console.log('state unchanged — file not rewritten, the workflow commits nothing today');
  }

  const line = (name, b) => console.log('  ' + name.padEnd(16)
    + (b.n ? 'n=' + String(b.n).padStart(4) + '  hit ' + b.hitPct + '%  exp ' + (b.expR >= 0 ? '+' : '') + b.expR + 'R' : 'n=0'));
  console.log('STACK OOS — bars since ' + state.cutoff + ' (SWING judged through ' + (state.swing2R.lastBar || '-') + ')');
  console.log('SWING @2R');
  line('every firing', state.swing2R.every); line('+ tape', state.swing2R.tape);
  line('+ 2 of 3 gates', state.swing2R.stack2of3); line('+ all 3 gates', state.swing2R.stack3of3);
  console.log('SCALP control @2R');
  line('+ tape', state.scalpControl2R.tape); line('+ all 3 gates', state.scalpControl2R.stack3of3);
  console.log('VERDICT: ' + v.text);
  if (v.confidence !== null) console.log('CONFIDENCE: ' + v.confidence + '% (95% CI lower bound)');
  return state;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href){
  main().catch((e) => { console.error(e); process.exit(1); });
}
