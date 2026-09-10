/* HARDGATE — GOLD SWING gate stack at the push() choke point (hg-v700).

   goldswing.js's own level builder (__swLevels) floors stops at 1.5×ATR14(4h),
   but engine-plan binds used to bypass it entirely: the VP §10 direct-mint
   copied vpb.stop verbatim, Part4–9 hgGoldBindEnginePlan binds copied plan
   stops, and none of them ever saw hgGoldInstFilter, the stop floor, the
   replay edge table or the cost gate. The 140-day swing replay
   (scripts/backtest-goldswing-results.json, n=292 settled, XM costs) measured:
     - gate-bypass mints (session=null — never saw hgGoldSessionGate):
       n=119 at −0.544R/trade
     - stops under the 1.5×ATR(4h) floor: counters.stopUnderFloor=170;
       floor violators n=137 −0.448R/trade vs contract-true n=155 +0.098
     - the MP cohort n=100 ALL stamped CONF NO TRADE at −0.209R/trade
   hg-v700 closes all three at goldswing's push() choke point (mirroring the
   v699 GOLD SCALP push() order): inst gates → sides-guarded 1.5×ATR(4h) floor
   → replay edge → cost gate; hgGoldApplyConfluence now DEMOTES NO_TRADE; and
   goldSwingSetups surfaces buildCandidates' rejected side-channel.
   Run: node tests/test-goldswing-stopfloor.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);

globalThis.window = {};
vm.runInThisContext(fs.readFileSync(root + 'goldind.js', 'utf8'), { filename: 'goldind.js' });
vm.runInThisContext(fs.readFileSync(root + 'goldswing.js', 'utf8'), { filename: 'goldswing.js' });
const W = globalThis.window;

let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

/* ---------- fixtures ---------- */
const H4 = 4 * 3600;
/* Tuesday 2026-03-10 14:30 UTC — NY_OVERLAP for hgGoldSessionGate (weight 3,
   no Asia demote), so the session-cohort assertion below is deterministic. */
const NOW = Date.UTC(2026, 2, 10, 14, 30, 0);

function mkRows(n, start, step, wick){
  const t0 = Math.floor(NOW / 1000) - n * H4;
  const r = []; let c = start;
  for (let i = 0; i < n; i++){
    const o = c;
    c += (i % 2 === 0) ? step : -step * 0.9;          /* choppy — no clean 4h stack */
    r.push({ t: t0 + i * H4, o, h: Math.max(o, c) + wick, l: Math.min(o, c) - wick, c, v: 1000 + (i % 5) * 300 });
  }
  return r;
}
function atr14(rows){                                  /* Wilder, mirrors the module */
  const p = 14; let a = null;
  for (let i = 1; i < rows.length; i++){
    const r = rows[i], q = rows[i - 1];
    const tr = Math.max(r.h - r.l, Math.abs(r.h - q.c), Math.abs(r.l - q.c));
    if (a === null){
      if (i >= p){ let s = 0; for (let k = i - p + 1; k <= i; k++){ const rk = rows[k], rj = rows[k - 1]; s += Math.max(rk.h - rk.l, Math.abs(rk.h - rj.c), Math.abs(rk.l - rj.c)); } a = s / p; }
    } else a = (a * (p - 1) + tr) / p;
  }
  return a;
}

const ROWS = mkRows(80, 4300, 3.0, 1.5);
const A4 = atr14(ROWS);
const LAST = ROWS[ROWS.length - 1].c;
assert(isFinite(A4) && A4 > 0, 'fixture premise: finite 4h ATR (' + A4.toFixed(2) + ')');

/* stub the VP §10 playbook so buildCandidates mints a vpbook candidate whose
   plan WE control — the exact engine-plan bypass route the replay measured */
function stubVp(plan){
  W.hgGoldVpPlaybook = function(){
    return Object.assign({
      ok: true, decision: 'ENTER', dir: 'long', gatesPass: 10,
      why: 'synthetic VP ENTER (test)', grade: { grade: 'B' }, size: { pick: 'FULL' }
    }, plan);
  };
}
function runSwing(extra){
  return W.goldSwingSetups(Object.assign({ rows4h: ROWS, now: NOW }, extra || {}));
}

/* ---------- 1) swing floor direct drives at 4h ATR scale ---------- */
{
  const floor = W.hgGoldScalpStopFloor;   /* TF-agnostic — v699 export, driven here at 4h widths */
  assert(typeof floor === 'function', 'hgGoldScalpStopFloor exported (TF-agnostic)');
  const a4 = 8;
  const c = { dir: 'long', entry: 4400, stop: 4398, t1: 4436, t2: 4460, stamps: [] };
  floor(c, a4);
  assert(!c.dropped && Math.abs(c.stop - (4400 - 1.5 * a4)) < 1e-9,
    'long 0.25×ATR(4h) stop re-anchored to entry − 1.5×ATR(4h)');
  assert(Math.abs(c.rr - 36 / 12) < 1e-9 && c.stamps.indexOf('STOP FLOORED 1.5×ATR') >= 0,
    'rr re-priced against the floored 4h risk + stamped');
  const s = { dir: 'short', entry: 4400, stop: 4400.5, t1: 4360, stamps: [] };
  floor(s, a4);
  assert(!s.dropped && Math.abs(s.stop - 4412) < 1e-9, 'short floors symmetrically at 4h widths');
  const d = { dir: 'long', entry: 4400, stop: 4399, t1: 4408 };
  floor(d, a4);
  assert(d.dropped === true && /1\.2R minimum/.test(d.reason || ''),
    'floored 4h TP1 < 1.2R drops the candidate with the named reason');
  const w = { dir: 'long', entry: 4400, stop: 4401, t1: 4436 };
  floor(w, a4);
  assert(!w.dropped && w.stop === 4401, 'wrong-side stop untouched — sides gate owns it (v681 lesson)');
}

/* ---------- 2) VP direct-mint bypass now passes the FULL gate stack ---------- */
{
  /* tight stop (≈0.2×ATR) + far TP1 -> floored, gated, painted */
  stubVp({ entry: LAST, stop: LAST - 0.2 * A4, t1: LAST + 3 * A4, t2: LAST + 5 * A4 });
  const rk = runSwing();
  const vp = (rk.ranked || []).find(c => c && c.stratKey === 'vpbook');
  assert(!!vp, 'synthetic VP ENTER mints a vpbook candidate');
  assert(vp && Math.abs(vp.entry - vp.stop) >= 1.5 * vp.atr * (1 - 1e-6),
    'bypass mint stop FLOORED to ≥1.5×ATR(4h) — replay: floor violators n=137 −0.448R vs contract-true n=155 +0.098');
  assert(vp && Array.isArray(vp.stamps) && vp.stamps.indexOf('STOP FLOORED 1.5×ATR') >= 0,
    'floor stamp carried on the minted card');
  /* the session=null cohort (n=119 −0.544R/trade) is closed: the mint now
     carries hgGoldInstFilter's session gate read like every other candidate */
  assert(vp && vp.sessionGate && vp.sessionGate.session === 'NY_OVERLAP',
    'bypass mint passed hgGoldSessionGate — session cohort stamped (was session=null, n=119 −0.544R/trade)');
  assert(vp && vp.newsGate && !vp.newsGate.lock, 'bypass mint passed hgGoldNewsGate (no lock on quiet calendar)');
  assert(vp && vp.session && vp.session !== null, 'published session field never null (hg-v700)');

  /* hg-v700 CONF NO TRADE demotion: rows-free rank ctx scores below the 65
     bar -> demoted, and an all-demoted board has NO lead (v699 precedent);
     replay: MP cohort n=100 all stamped CONF NO TRADE at −0.209R/trade */
  assert(vp && vp.demoted === true && vp.stamps.indexOf('CONF NO TRADE') >= 0,
    'stamped-no-trade mint is DEMOTED — paints, never leads (hg-v700)');
  assert(vp && Array.isArray(vp.gateNotes) && /no-trade — paints, never leads/.test(vp.gateNotes.join(' ')),
    'gate note names the confluence demotion');
  assert(rk.best === null, 'all-demoted board -> best null (never a stamped-no-trade lead)');

  /* pipeline invariant: NOTHING goldSwingSetups ranks ships under the floor */
  let checked = 0, viol = 0;
  for (const c of rk.ranked || []){
    if (!c || !isFinite(c.entry) || !isFinite(c.stop) || !isFinite(c.atr) || !(c.atr > 0)) continue;
    checked++;
    if (Math.abs(c.entry - c.stop) < 1.5 * c.atr * (1 - 1e-6)) viol++;
  }
  assert(checked >= 1 && viol === 0,
    'pipeline invariant: every ranked swing candidate has |entry−stop| ≥ 1.5×ATR(4h) (' + checked + ' checked)');
}

/* ---------- 3) floor drop + rejected-channel surfacing (goldSwingSetups) ---------- */
{
  /* tight stop + NEAR TP1 -> floored TP1 pays <1.2R -> DROPPED, and the drop
     now SURFACES on the exported API: rankSetups' own .rejected used to be
     returned alone, silently swallowing every build-time rejection (the
     replay harness saw counters.edgeSuppressed=0 / otherRejected=0 across
     841 scans for exactly this reason). */
  stubVp({ entry: LAST, stop: LAST - 0.2 * A4, t1: LAST + 1.0 * A4 });
  const rk = runSwing();
  assert(!(rk.ranked || []).some(c => c && c.stratKey === 'vpbook'),
    'cost-toxic geometry (floored TP1 < 1.2R) never becomes a card');
  const drops = (rk.rejected || []).filter(r => r && r.stratKey === 'vpbook');
  assert(drops.length === 1, 'exactly ONE vpbook entry on .rejected — surfaced, not double-counted (hg-v700)');
  const drop = drops[0];
  assert(!!drop && /1\.2R minimum/.test(String(drop.reason || '')) && /×ATR/.test(String(drop.reason || '')),
    'rejected entry names the floor and the 1.2R bar: "' + (drop && drop.reason) + '"');
  assert(!!drop && Array.isArray(drop.stamps) && drop.stamps.indexOf('STOP FLOOR') >= 0
      && isFinite(drop.entry) && isFinite(drop.stop),
    'rejected entry is the FULL candidate (stamps + levels) — shadow ledger can measure the counterfactual');
}

/* ---------- 4) wrong-side plan REJECTED (never floored into a "fixed" one) ---------- */
{
  stubVp({ entry: LAST, stop: LAST - 2 * A4, t1: LAST - 1 * A4 });   /* long with TP1 below entry */
  const rk = runSwing();
  assert(!(rk.ranked || []).some(c => c && c.stratKey === 'vpbook'),
    'wrong-side TP1 never becomes a card');
  const bad = (rk.rejected || []).find(r => r && r.stratKey === 'vpbook');
  assert(!!bad && Array.isArray(bad.stamps) && bad.stamps.indexOf('BAD PLAN SIDES') >= 0,
    'wrong-side plan rejected with BAD PLAN SIDES (v681/v698: reject, never rewrite invalid geometry)');
}

/* ---------- 5) cost gate wired after edge apply (demote-only) ---------- */
{
  /* 4h-wide stops never bind the XM 0.020% bar — force it with an absurd
     venue override to prove the push() wire end-to-end. Demote-only: the
     card still paints, it can never lead. */
  stubVp({ entry: LAST, stop: LAST - 1.6 * A4, t1: LAST + 3 * A4 });
  const rk = runSwing({ rtCostPct: 5 });                 /* 8×5% = 40% risk bar */
  const vp = (rk.ranked || []).find(c => c && c.stratKey === 'vpbook');
  assert(!!vp && vp.costHeavy === true && vp.stamps.indexOf('COST-HEAVY') >= 0,
    'inp.rtCostPct reaches the push() cost gate — COST-HEAVY demote-only (paints, never leads)');
  assert(!!vp && !vp.dropped, 'cost gate never drops (gross-positive cohort discipline)');
  /* at the real desk preset the same geometry passes untouched */
  stubVp({ entry: LAST, stop: LAST - 1.6 * A4, t1: LAST + 3 * A4 });
  const rk2 = runSwing();
  const vp2 = (rk2.ranked || []).find(c => c && c.stratKey === 'vpbook');
  assert(!!vp2 && !vp2.costHeavy, '4h-wide stop clears the XM 0.020% RT bar — cost gate principled, rarely binds');
}
delete W.hgGoldVpPlaybook;

/* ---------- 6) CONF NO TRADE demotion — direct drive (shared helper).
   hg-v700 refined: the demote fires only from a DATA-BACKED score; a
   rows-free ctx stamps CONF UNCHECKED and never gates (v698 unchecked rule
   — SUPER GOLD's rows-free re-rank must not clobber evaluated cards). ---------- */
{
  const rows = mkRows(240, 4200, 2, 1);
  const weak = { dir: 'long', stratKey: 'pullback', entry: 4300, agree: 1, stamps: [] };
  W.hgGoldApplyConfluence(weak, { rows4h: rows, rows: rows });
  assert(weak.confTier === 'NO_TRADE' && weak.demoted === true,
    'hgGoldApplyConfluence: data-backed NO_TRADE tier demotes at the stamp site (hg-v700)');
  assert(Array.isArray(weak.gateNotes) && /confluence tier says no-trade — paints, never leads/.test(weak.gateNotes.join(' ')),
    'demotion carries the exact gate note');
  const starved = { dir: 'long', stratKey: 'pullback', entry: 4300, agree: 1, stamps: [] };
  W.hgGoldApplyConfluence(starved, {});
  assert(starved.demoted !== true && starved.stamps.indexOf('CONF UNCHECKED') >= 0,
    'rows-free ctx: CONF UNCHECKED, never a manufactured demote (hg-v700 refined)');
  const r = W.goldRankSetups([{ id: 'x|long|1', dir: 'long', entry: 4300, stop: 4280, t1: 4340,
    stratKey: 'pullback', strategy: '4H TREND PULLBACK', grade: 'B', agree: 4, oppose: 0, atr: 10 }],
    { rows4h: rows, rows: rows });
  assert(r.ranked.length === 1 && r.ranked[0].demoted === true && r.best === null,
    'goldRankSetups (rows-fed): stamped-no-trade card ranks but can never be MOST PROBABLE (v699 bestId-null precedent)');
}

console.log('\n' + pass + ' assertions passed' + (fail ? (', ' + fail + ' FAILED') : ''));
if (fail) process.exit(1);
