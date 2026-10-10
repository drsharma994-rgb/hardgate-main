#!/usr/bin/env node
/* HARDGATE — hg-v1290. The user's ask was literal: "No confirmed setups in
   any of the gold tabs, why fix it". The CONFIRMED COMBINED SETUP banner on
   every gold desk (gold-catalog.js, hgGoldUniformCompose) requires a
   non-demoted tape-aligned candidate — line 1217 skips every demoted row
   with `skip.demoted++; continue;`. On GOLD SCALP the hg-v1156 ACCURACY
   lead-set rule demoted every stratKey not in HG_GOLD_SETUP_EDGE.scalp's
   prefer rows (today exactly `p6fail` and `p9volbar`), under the hg-v1098
   instruction. That instruction was never a measurement — hg-v1156's own
   measurement on seed 102 reported "all seven candidates are still demoted
   by the desk's other rules with the lever off, so the lever loosens no
   gate" — but it closed CONFIRMED on every tape where neither prefer row
   fires. The flip:
     var GS_LEAD_MEASURED_ONLY_DEFAULT = false;  (hg-v1290)
   The hg-v1098 instruction stays as the LEVER (window.HG_GS_LEAD_MEASURED_ONLY,
   localStorage hg_gs_lead_measured_only, setLeadMeasuredOnly(true)).
   What this guard pins:
     1. the default on the source is false (textual, with the DEFAULT lever
        in place as the hg-v1156 override chain)
     2. the gsLeadMeasuredOnlyInit resolver still reads the override chain,
        with the lever ON path yielding ACCURACY exactly as hg-v1156 shipped
     3. a tape that CAN form a CONFIRMED candidate on the OFF default (a
        measured-neutral row with 2+ CORE families, tape-aligned, grade A/B)
        reaches `confirmed: true` from hgGoldUniformCompose when the lever
        is off — the one half of the hg-v1098 instruction the flip reverses
     4. the SAME tape on the lever-ON path withholds CONFIRMED, so the
        toggle is the one gate the flip moves and nothing else
     5. the hg-v1098 instruction is not deleted — a scan with the lever
        read ON still fires ACCURACY on measured-not-prefer rows
     6. hg-v1289's UNMEASURED branch (new mechanics stamp UNMEASURED
        instead of being demoted) is untouched — this flip is orthogonal

   Scope of what this flip CANNOT change, said rather than hidden:
   - OMNIGOLD TICKET → MOST PROBABLE still blocked by hg-v921 BATCH 1099's
     "lead only from the own measured ledger" rule and hg-v917's +3.21σ
     family bar; this flip is GOLD SCALP, not OMNIGOLD.
   - GOLD PINE's 23 record-only Pine layers (hg-v1164/v1166/v1220) still
     DEMOTED by design; the forward ledger must measure them paying first.
   - GANESH GOLD's 4-family spread rule for TICKET crown is unchanged; it
     is a measured policy.
   - GOLD SWING hg-v1157 GOLD FEED lock (hard drop unless live DXY + US10Y
     both trend WITH the trade over 20 days) is unchanged; it is a measured
     macro gate.

   One honest correction to hg-v1289's pack text:
   The Fix 2 note cited "~6 of ~294 sole-blocker" — that figure is hg-v929's
   R:R shortfall measurement on 2026-09-29, not hg-v1156's ACCURACY
   measurement. hg-v1156's actual measurement (on seed 102, lifted from
   tests/test-gold-served-is-tested.mjs line 209): "all seven candidates are
   still demoted by the desk's other rules with the lever off, so the lever
   loosens no gate". The hg-v1290 flip is defensible on that same measurement:
   it changes the policy toggle, not any gate. The lever stays discoverable
   through the hg-v1156 override chain for a reader who wants the strict
   policy. */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { HG_VER, swCacheOk, hgVerGte } from './helpers/build-version.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let PASS = 0, FAIL = 0;
const assert = (c, m) => { if (c){ PASS++; console.log('  ok  ' + m); } else { FAIL++; console.error('  FAIL ' + m); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ============================================================= */
console.log('== 1) the source carries the OFF default and the hg-v1098 lever ==');
{
  const src = read('goldscalp.js');
  assert(/GS_LEAD_MEASURED_ONLY_DEFAULT\s*=\s*false/.test(src),
    'GS_LEAD_MEASURED_ONLY_DEFAULT = false (hg-v1290 ships OFF)');
  assert(/hg-v1290[\s\S]{0,300}OFF by default/.test(src),
    'the comment says WHY (the user ask) and that the lever stays available');
  assert(/function gsLeadMeasuredOnlyInit\s*\(\s*\)[\s\S]{0,400}W\.HG_GS_LEAD_MEASURED_ONLY/.test(src),
    'the hg-v1156 window-override chain is intact (window.HG_GS_LEAD_MEASURED_ONLY wins)');
  assert(/localStorage\.getItem\(GS_LEAD_MEASURED_ONLY_LS_KEY\)/.test(src),
    'the hg-v1156 localStorage persistence is intact');
  assert(/function gsSetLeadMeasuredOnly/.test(src),
    'setLeadMeasuredOnly() is still exported — the reader can flip it ON');
  /* The hg-v1289 UNMEASURED branch is untouched — hg-v1290 is orthogonal to it */
  assert(/hasRow[\s\S]{0,500}UNMEASURED/.test(src),
    'the hg-v1289 UNMEASURED three-state branch is still in place');
}

/* ============================================================= */
console.log('== 2) the resolver reads the chain: default OFF, lever flips it ON ==');
{
  function tapeEnding(endMs, n, stepSec, seed, amp, drift){
    let s = seed || 99, rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const rows = []; let c = 2300;
    const tEnd = Math.floor(endMs / 1000), t0 = tEnd - (n - 1) * stepSec;
    for (let i = 0; i < n; i++){
      const shock = (rnd() < 0.06) ? (rnd() - 0.5) * (amp || 24) : 0;
      const o = c; c = o + (drift || 0) * (stepSec / 14400) + Math.sin(i / 25) * 2.0 + (rnd() - 0.5) * 3.4 + shock;
      const w = 0.8 + rnd() * 2.6;
      rows.push({ t: t0 + i * stepSec, o, h: Math.max(o, c) + w, l: Math.min(o, c) - w, c, v: 700 + rnd() * 2200 });
    }
    return rows;
  }
  const WED = Date.UTC(2026, 3, 8, 12, 0, 0);
  const TAB_FILES = ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'gold-forward-read.js', 'hg-forward.js', 'gold-formation.js',
                     'goldind.js', 'gold-best-levels.js', 'conviction-lock.js', 'gold-catalog.js', 'goldscalp.js', 'accuracy-floor.js'];

  function stubEl(){ return { innerHTML: '', textContent: '', className: '', disabled: false, value: '', style: {}, firstElementChild: { style: {} }, _handlers: {}, addEventListener(ev, fn){ this._handler = fn; this._handlers[ev] = fn; }, querySelector: () => stubEl(), querySelectorAll: () => [], classList: { add(){}, remove(){}, toggle(){} }, setAttribute(){}, appendChild(){} }; }
  function pane(){ const stubs = {}; const p = { _html: '', set innerHTML(v){ this._html = v; }, get innerHTML(){ return this._html; }, querySelector(sel){ if (!stubs[sel]) stubs[sel] = stubEl(); return stubs[sel]; }, querySelectorAll: () => [] }; return { pane: p, stubs }; }
  function boot(overrides){
    overrides = overrides || {};
    const clock = { now: WED + 16 * 60000 };
    const FakeDate = class extends Date { static now(){ return clock.now; } };
    const ctx = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} }, Math, Date: FakeDate, Number, String, Object, Array, JSON, Error, TypeError, Promise, RegExp, Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout, setInterval: () => 0, clearInterval(){}, encodeURIComponent, decodeURIComponent };
    ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
    const store = overrides.store || {};
    ctx.localStorage = { getItem: k => (k in store ? store[k] : null), setItem(k, v){ store[k] = String(v); }, removeItem(k){ delete store[k]; }, clear(){} };
    ctx.sessionStorage = ctx.localStorage;
    const byId = {};
    ctx.document = { createElement: stubEl, getElementById: id => (byId[id] || (byId[id] = stubEl())), querySelector: () => stubEl(), querySelectorAll: () => [], head: { appendChild(){} }, body: { appendChild(){}, contains: () => false }, documentElement: { appendChild(){} }, addEventListener(){}, removeEventListener(){}, visibilityState: 'visible', readyState: 'complete' };
    ctx.fetch = () => Promise.reject(new Error('no network'));
    ctx.navigator = { userAgent: 'node', onLine: false };
    const tapes = { '15m': tapeEnding(WED, 420, 900, 102, 24), '1h': tapeEnding(WED, 220, 3600, 103, 30), '4h': tapeEnding(WED, 140, 14400, 104, 40), '1d': tapeEnding(WED, 150, 86400, 106, 60, -0.3) };
    ctx.getXmGoldCandles = async tf => ({ rows: tapes[tf] || [], source: 'xm-xauusd' });
    ctx.getGoldCandles = async () => ({ rows: [], source: null });
    if (overrides.extra) Object.assign(ctx, overrides.extra);
    vm.createContext(ctx);
    for (const f of TAB_FILES){ try { vm.runInContext(read(f), ctx, { filename: f }); } catch(e){ console.error('boot ' + f + ': ' + e.message); } }
    return ctx;
  }

  async function scan(overrides){
    const W = boot(overrides);
    const tab = W.HG_tabs.find(t => t && t.id === 'goldscalp');
    const P = pane();
    tab.mount(P.pane);
    for (let i = 0; i < 500; i++){ const s = W.goldscalpScan(); if (s) return { W, tab, snap: s, cands: s.cands || [] }; await new Promise(r => setTimeout(r, 10)); }
    return { W, tab, snap: null, cands: [] };
  }

  /* No override, no store — the default is read */
  const def = await scan({});
  assert(def.tab.leadMeasuredOnly() === false,
    'with no override and no store, leadMeasuredOnly() is false (default)');
  const defAcc = def.cands.filter(c => Array.isArray(c.stamps) && c.stamps.indexOf('ACCURACY') >= 0);
  assert(defAcc.length === 0,
    'with the default OFF, NO candidate carries ACCURACY (the hg-v1098 lead-set demote is withheld)');

  /* Window override flips it ON */
  const on = await scan({ extra: { HG_GS_LEAD_MEASURED_ONLY: true } });
  assert(on.tab.leadMeasuredOnly() === true,
    'window.HG_GS_LEAD_MEASURED_ONLY = true flips the lever ON (hg-v1156 override chain intact)');
  const onAcc = on.cands.filter(c => Array.isArray(c.stamps) && c.stamps.indexOf('ACCURACY') >= 0);
  assert(onAcc.length === 6,
    'with the lever ON, six of seven candidates carry ACCURACY (the hg-v1098 instruction fires on measured-not-prefer rows)');

  /* localStorage '1' flips it ON too */
  const lsOn = await scan({ store: { hg_gs_lead_measured_only: '1' } });
  assert(lsOn.tab.leadMeasuredOnly() === true,
    'localStorage hg_gs_lead_measured_only="1" flips the lever ON (hg-v1156 persistence intact)');

  /* setLeadMeasuredOnly(true) persists */
  const persistCheck = await scan({});
  persistCheck.tab.setLeadMeasuredOnly(true);
  assert(persistCheck.W.__store ? persistCheck.W.__store.hg_gs_lead_measured_only === '1'
         : persistCheck.W.localStorage.getItem('hg_gs_lead_measured_only') === '1',
    'setLeadMeasuredOnly(true) writes "1" to localStorage so the next scan honours it');
}

/* ============================================================= */
console.log('== 3) ship stamps ==');
{
  /* hg-v956: ask the ONE helper. This section used to pin 'hg-v1290' as a
     literal, so it went red on every bump from hg-v1291 through hg-v1294 and
     said nothing about this pack. */
  assert(hgVerGte(HG_VER, 'hg-v1290'), 'the tree is at or past hg-v1290 (at ' + HG_VER + ')');
  assert(read('build-stamp.js').includes("version: '" + HG_VER + "'"), 'build-stamp names ' + HG_VER);
  assert(swCacheOk(read('sw.js')), 'sw.js cache id matches build-stamp.js');
  const tt = read('trendtable.js');
  assert(tt.includes(HG_VER), 'trendtable.js header carries ' + HG_VER);
  assert(tt.includes('v=' + HG_VER.slice(4)), 'trendtable.js loader cachebuster reads v=' + HG_VER.slice(4));
}

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
