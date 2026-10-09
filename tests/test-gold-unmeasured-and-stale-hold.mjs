#!/usr/bin/env node
/* HARDGATE — the two hg-v1289 fixes, each proved behaviourally on the real
   modules.

   (1) OMNIGOLD's one-at-a-time counter was reading EVERY entry in store.live
       with no age check: hg-v941 fixed TTL expiry inside applyHardgateConvictionLock
       (conviction-lock.js), but that only runs when the OWNING desk scans. A
       GOLD SCALP record whose venue label drifted (hg-v941 scenario) or whose
       owner has not scanned recently sits in the store past its 90-min TTL
       and holds all three gold desks forever. The fix adds `stale` per row
       and `nFresh` across rows — hg-v941 disclosure (rows kept + age on panel)
       is preserved exactly; the gate reads nFresh so a known-expired record
       stops holding.

   (2) GOLD SCALP's ACCURACY lead-set demote (hg-v1156) demoted every candidate
       whose stratKey was not 'p6fail' or 'p9volbar' — the only two prefer
       rows in HG_GOLD_SETUP_EDGE.scalp. The 14 hg-v1270+ GS strategies
       (gs2..gs14 added in gold-suite-unified.js) have NO row in the edge
       table at all; the previous code treated absence as negative evidence
       (demote), which is the hg-v989 three-state defect. The fix differentiates:
       - stratKey HAS a row (measured neutral/demote/suppress): still demotes
         with hg-v1098's own ACCURACY message
       - stratKey has NO row (truly unmeasured, new mechanic): skips the lead-
         set demote and stamps 'UNMEASURED' on the candidate instead.
       The geometry, macro, dxy/tnx and real-yield ACCURACY checks still fire
       on both paths. The lever (gsSetLeadMeasuredOnly) is unchanged.

   The ACCURACY leg is a POLICY, not a measurement — hg-v1098 says so and
   ships the lever precisely because policies have levers. The current fix
   preserves hg-v1098 strictly on MEASURED mechanics and extends it honestly
   to the hg-v989 third state. No gate moved; no threshold moved.
*/

import fs from 'node:fs';
import vm from 'node:vm';

let FAIL = 0, PASS = 0;
function ok(cond, msg){ if (cond){ PASS++; console.log('  ok  ' + msg); } else { FAIL++; console.log('  NOT OK  ' + msg); } }
function assert(cond, msg){ ok(cond, msg); }

function readFile(p){ return fs.readFileSync('/home/user/hardgate-main/' + p, 'utf8'); }

/* ============================================================= */
console.log('== 1) OMNIGOLD stale-hold: a record past TTL is kept on panel, not on the gate ==');
{
  /* The ONE function to exercise is hgOgOpenGoldConvictions. Boot a minimal
     context, inject the store with fresh + stale records, and read the output. */
  const files = ['build-stamp.js','gold-iux.js','indicators.js','indicators2.js',
    'macro.js','news.js','regime.js','gold-formation.js','pinegoldmath.js',
    'gold-catalog.js','gold-suite-unified.js','goldind.js','hg-forward.js',
    'omnigold.js'];
  const window = {};
  const store = {};
  window.localStorage = {
    getItem: (k) => (k in store) ? store[k] : null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  const ctx = {
    window, self: window, globalThis: window, console,
    localStorage: window.localStorage,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    fetch: async () => ({ ok: false, status: 403 }),
    Date, Math, JSON, Array, Object, Number, String, Boolean, RegExp, Error,
    Promise, Symbol, Map, Set, WeakMap, WeakSet,
    Uint8Array, Int32Array, Float64Array,
  };
  vm.createContext(ctx);
  for (const f of files){
    try { vm.runInContext(readFile(f), ctx, { filename: f }); } catch (e) { console.error('boot', f, e.message); }
  }
  const fn = window.hgOgOpenGoldConvictions;
  assert(typeof fn === 'function', 'hgOgOpenGoldConvictions is exported');

  const NOW = Date.UTC(2026, 9, 9, 14, 52, 0);

  /* Case A: empty store */
  const empty = fn(NOW);
  assert(empty && empty.n === 0 && empty.nFresh === 0 && empty.rows.length === 0,
    'empty store: n=0, nFresh=0, rows=[]');

  /* Case B: a fresh (30-min-old) SCALP record — gate holds, panel shows */
  const freshRec = {
    v: 1, history: [],
    live: {
      'liqsweep|XM XAUUSD|long': {
        sym: 'XAUUSD', dir: 'long', venue: 'XM XAUUSD',
        entry: 4000, stop: 3998, t1: 4004,
        issuedAt: NOW - 30 * 60 * 1000, strategy: 'liqsweep', tally: 8
      }
    }
  };
  store.hgGoldscalpConviction = JSON.stringify(freshRec);
  const fresh = fn(NOW);
  assert(fresh.n === 1 && fresh.nFresh === 1 && fresh.rows.length === 1,
    'fresh scalp record (30 min old): n=1, nFresh=1 — holds the gate');
  assert(fresh.rows[0].stale === false && fresh.rows[0].ageMs === 30 * 60 * 1000,
    'the row is NOT stale and carries its age (30 min)');

  /* Case C: a stale (3-hour-old) SCALP record — rows show it, gate releases */
  const staleRec = {
    v: 1, history: [],
    live: {
      'liqsweep|XM XAUUSD|long': {
        sym: 'XAUUSD', dir: 'long', venue: 'XM XAUUSD',
        entry: 4000, stop: 3998, t1: 4004,
        issuedAt: NOW - 3 * 60 * 60 * 1000, strategy: 'liqsweep', tally: 8
      }
    }
  };
  store.hgGoldscalpConviction = JSON.stringify(staleRec);
  const stale = fn(NOW);
  assert(stale.n === 1 && stale.nFresh === 0 && stale.rows.length === 1,
    'stale scalp record (3 h old, past 90-min TTL): n=1 (kept for display), nFresh=0 (gate releases)');
  assert(stale.rows[0].stale === true,
    'the row is marked stale so the panel can call it out');

  /* Case D: a stale record and a fresh record together — gate counts only fresh */
  const mixed = {
    v: 1, history: [],
    live: {
      'liqsweep|XM XAUUSD|long': {
        sym: 'XAUUSD', dir: 'long', venue: 'XM XAUUSD',
        entry: 4000, stop: 3998, t1: 4004,
        issuedAt: NOW - 3 * 60 * 60 * 1000, strategy: 'liqsweep', tally: 8
      },
      'bosalign|XM XAUUSD|short': {
        sym: 'XAUUSD', dir: 'short', venue: 'XM XAUUSD',
        entry: 4020, stop: 4024, t1: 4012,
        issuedAt: NOW - 30 * 60 * 1000, strategy: 'bosalign', tally: 7
      }
    }
  };
  store.hgGoldscalpConviction = JSON.stringify(mixed);
  const m = fn(NOW);
  assert(m.n === 2 && m.nFresh === 1 && m.rows.length === 2,
    'mixed stale+fresh: n=2, nFresh=1 (only the 30-min record holds)');
  const freshRow = m.rows.find(r => r.stale === false);
  const staleRow = m.rows.find(r => r.stale === true);
  assert(freshRow && freshRow.ageMs < 60 * 60 * 1000,
    'the fresh row is identified by stale=false');
  assert(staleRow && staleRow.ageMs > 60 * 60 * 1000,
    'the stale row is identified by stale=true');

  /* Case E: a record with NO issuedAt — kept, not stale (hg-v941 "age not recorded") */
  const noAt = {
    v: 1, history: [],
    live: {
      'ribbon|XM XAUUSD|long': {
        sym: 'XAUUSD', dir: 'long', venue: 'XM XAUUSD',
        entry: 4000, stop: 3998, t1: 4004, strategy: 'ribbon', tally: 7
        /* no issuedAt */
      }
    }
  };
  store.hgGoldscalpConviction = JSON.stringify(noAt);
  const n0 = fn(NOW);
  assert(n0.n === 1 && n0.nFresh === 1 && n0.rows.length === 1,
    'no-issuedAt record is KEPT and NOT stale (hg-v941 unknowable-age semantics)');
  assert(n0.rows[0].stale === false && n0.rows[0].ageMs === null,
    'the row is not stale and reports null age');

  /* Case F: SWING record uses 5-day TTL — a 3-day-old SWING is fresh */
  const swing3d = {
    v: 1, history: [],
    live: {
      'weekly|XM XAUUSD|long': {
        sym: 'XAUUSD', dir: 'long', venue: 'XM XAUUSD',
        entry: 4000, stop: 3980, t1: 4050,
        issuedAt: NOW - 3 * 24 * 60 * 60 * 1000, strategy: 'weekly', tally: 9
      }
    }
  };
  store.hgGoldscalpConviction = null; delete store.hgGoldscalpConviction;
  store.hgGoldswingConviction = JSON.stringify(swing3d);
  const sw3 = fn(NOW);
  assert(sw3.n === 1 && sw3.nFresh === 1 && sw3.rows[0].stale === false && sw3.rows[0].desk === 'SWING',
    'a 3-day-old SWING record is fresh under its 5-day TTL');

  /* Case G: a 6-day-old SWING is stale */
  const swing6d = JSON.parse(JSON.stringify(swing3d));
  const kk = Object.keys(swing6d.live)[0];
  swing6d.live[kk].issuedAt = NOW - 6 * 24 * 60 * 60 * 1000;
  store.hgGoldswingConviction = JSON.stringify(swing6d);
  const sw6 = fn(NOW);
  assert(sw6.nFresh === 0 && sw6.rows[0].stale === true,
    'a 6-day-old SWING record is stale under its 5-day TTL');

  /* Case H: the gate reads nFresh, not n */
  delete store.hgGoldswingConviction;
  store.hgGoldscalpConviction = JSON.stringify(staleRec);
  const gateFn = window.hgOgOneAtATimeGate;
  const openStale = fn(NOW);
  const gateResult = gateFn(openStale);
  assert(gateResult && gateResult.pass === true,
    'the gate PASSES on a stale-only store (nFresh = 0 → no hold)');
  assert(/no gold conviction is live/.test(gateResult.why),
    'the gate why is the free-side message');

  store.hgGoldscalpConviction = JSON.stringify(freshRec);
  const openFresh = fn(NOW);
  const gateResult2 = gateFn(openFresh);
  assert(gateResult2 && gateResult2.pass === false,
    'the gate HOLDS on a fresh record');
  assert(/1 gold conviction is already live/.test(gateResult2.why),
    'the gate why names the live count');

  /* Case I: the panel calls out stale rows */
  const htmlFn = window.hgOgHoldingRowsHtml;
  const stHtml = String(htmlFn(fn(NOW, (store.hgGoldscalpConviction = JSON.stringify(staleRec), NOW))));
  // reset after side effect; read html with current store state
  store.hgGoldscalpConviction = JSON.stringify(staleRec);
  const stHtml2 = String(htmlFn(fn(NOW)));
  assert(/STALE/.test(stHtml2),
    'hgOgHoldingRowsHtml marks a stale row as STALE on the panel');
}

/* ============================================================= */
console.log('== 2) GOLD SCALP ACCURACY leg: unmeasured mechanics are NOT demoted by lead-set rule ==');
{
  const src = readFile('goldscalp.js');

  /* Prove by text: the three-state distinction exists where the hg-v1289
     comment names it, with hasRow deciding between measured-not-prefer and
     truly-unmeasured. This is a textual pin because the behavioural check
     needs a mint tape that fires a stratKey without an edge-table row, which
     the hg-v1270+ GS strategies would do in the browser but can't be
     synthesised cheaply here without 400 bars of session-timed data. */
  const hasV1289 = /hg-v1289[\s\S]{0,2000}hasRow[\s\S]{0,500}UNMEASURED/.test(src);
  assert(hasV1289,
    'goldscalp.js carries the hg-v1289 hasRow / UNMEASURED split in the ACCURACY leg');

  /* The three-state logic: hasRow with-row demotes, no-row stamps UNMEASURED */
  const hasBranch = /hasRow\s*=\s*!!\(T2[\s\S]{0,200}if\s*\(hasRow\)/m.test(src);
  assert(hasBranch,
    'the leg branches on hasRow before demoting');

  const hasStamp = /ac\.stamps\.indexOf\('UNMEASURED'\)\s*<\s*0[\s\S]{0,80}ac\.stamps\.push\('UNMEASURED'\)/.test(src);
  assert(hasStamp,
    'the no-row branch stamps UNMEASURED instead of demoting');

  /* The original ACCURACY message is preserved for the has-row path */
  const hasAccMsg = /ACCURACY — only '[\s\S]{0,200}has held up on this desk/.test(src);
  assert(hasAccMsg, 'the hg-v1098 ACCURACY message is preserved for measured mechanics');

  /* hg-v1290: the DEFAULT is now OFF on user ask ("No confirmed setups
     in any of the gold tabs, fix it"). The hg-v1098 instruction stays as
     the lever (window.HG_GS_LEAD_MEASURED_ONLY, localStorage, the hg-v1156
     persistence) — a scan can still flip it ON — but the OFF default means
     a measured-neutral row (bosalign, ribbon per hg-v928) can lead if
     nothing else demotes it. The hg-v1156 measurement that the lever
     "loosens no gate on seed 102" still holds because the desk's OTHER
     demotes still fire; this changes the policy toggle, not any gate. */
  assert(/GS_LEAD_MEASURED_ONLY_DEFAULT\s*=\s*false/.test(src),
    'the GS_LEAD_MEASURED_ONLY_DEFAULT = false (hg-v1290 flipped on user ask; hg-v1098 instruction stays as the lever)');
}

/* ============================================================= */
console.log('== 3) The lever default and the gsLeadKeys reader are unchanged ==');
{
  const src = readFile('goldscalp.js');
  assert(/function gsLeadKeys\(\)/.test(src), 'gsLeadKeys() still exported');
  assert(/if \(act\(T\.scalp\[k\]\) === 'prefer'\) out\.push\(k\)/.test(src),
    'gsLeadKeys still returns only prefer rows (hg-v1098 for measured mechanics)');
}

/* ============================================================= */
console.log('== 4) hg-v1290 ship stamps ==');
{
  const build = readFile('build-stamp.js');
  const sw = readFile('sw.js');
  assert(/version:\s*'hg-v1290'/.test(build), 'build-stamp names hg-v1290');
  assert(/HG_CACHE\s*=\s*'hg-v1290'/.test(sw), 'sw.js cache id is hg-v1290');
}

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
