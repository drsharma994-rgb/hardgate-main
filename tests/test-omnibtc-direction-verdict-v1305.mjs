#!/usr/bin/env node
/* hg-v1305 — the pooled proven-edge verdict crowned a short on the long
   side's record. hg-v1303 named this as defect (b) and deferred it:
   hgProvenEdgeVerdict read the pooled verdict for every candidate, and
   hgFwdStats carried a byDir split the measured-rank path never consulted.
   On OMNIBTC a mechanic positive on longs and negative on shorts shows
   positive in the pool, so the override at omnibtc.js:1122 crowned a
   short the record said should lose.

   This pack: byDir buckets gain rrSum per direction (live loop + aggregate
   seed + fold), hgProvenEdgeVerdict accepts opts.dir and synthesizes a
   per-direction stats object the judge reads, and the three OMNIBTC call
   sites pass the candidate's direction.

   Guard drives real hg-forward.js + real proven-edge.js in a vm sandbox
   (hg-v967: no re-implementation), uses hgFwdStatsOf + hgFwdNormalize
   directly (the pattern test-omnigold-direction-split.mjs established),
   and asserts:
     - §1 byDir carries rrSum per direction (live loop)
     - §2 fold carries rrSum per direction (survives pruning)
     - §3 pool verdict unchanged (backward compat)
     - §4 dir-aware verdict reads per-direction (proven long, losing short)
     - §5 junk / missing dir falls through to pool verdict
     - §6 textual pin on the three OMNIBTC call sites (hg-v956)
     - §7 behavioural override: pool verdict crowns a short on long record
          (the defect); dir-aware verdict does not (the fix)
     - §8 mutation-pass anchors on the shipped source

   Run: node tests/test-omnibtc-direction-verdict-v1305.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let passed = 0, failed = 0;
const ok = (c, label) => { if (c){ passed++; console.log('ok —', label); } else { failed++; console.log('FAIL —', label); } };

/* -------------------- boot hg-forward.js + proven-edge.js -------------------- */

function bootLedger(){
  const store = {};
  const doc = {
    getElementById: () => null,
    createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){}, addEventListener(){} }),
    querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){} }, documentElement: { appendChild(){} },
    addEventListener(){}, readyState: 'complete'
  };
  const ctx = {
    console: { log(){}, warn(){}, error(){} },
    Math, isFinite, isNaN, parseFloat, parseInt, Number, String, Object, Array,
    JSON, Date, RegExp, Promise, Infinity, NaN,
    setTimeout: () => 0, clearTimeout: () => {},
    document: doc,
    addEventListener: () => {},
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    }
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('hg-forward.js'), ctx, { filename: 'hg-forward.js' });
  vm.runInContext(read('proven-edge.js'), ctx, { filename: 'proven-edge.js' });
  return ctx;
}

/* -------------------- build a MMOVE record list with hgFwdNormalize -------------------- */

function buildMMOVE(ctx){
  const N = ctx.hgFwdNormalize;
  const base = { tab: 'OMNIBTC', mechanic: 'MMOVE', sym: 'BTCUSD', tf: '4h', horizonBars: 20 };
  const geo = dir => (dir === 'short')
    ? { entry: 100, stop: 105, t1: 90, mark: 100 }
    : { entry: 100, stop: 95,  t1: 110, mark: 100 };
  /* hgFwdNormalize strips `state` from its whitelist; Object.assign puts it
     back on afterwards. Same technique test-omnigold-direction-split.mjs uses. */
  const mk = (i, dir, state) => Object.assign(
    N(Object.assign({}, base, geo(dir), { barT: 1700000000 + i * 3600, dir })),
    { state }
  );
  const recs = [];
  /* 20 long wins — long reads 'proven' (hit=1, expR=+2) */
  for (let i = 0; i < 20; i++) recs.push(mk(i, 'long', 't1'));
  /* 20 short losses — short reads 'losing' (hit=0, expR=-1) */
  for (let i = 0; i < 20; i++) recs.push(mk(i + 100, 'short', 'stop'));
  return recs;
}

/* ===================== §1: byDir carries rrSum per direction ===================== */

(function(){
  const ctx = bootLedger();
  const recs = buildMMOVE(ctx);
  const s = ctx.hgFwdStatsOf(recs, 'OMNIBTC', 'MMOVE', false, null);
  ok(s && s.byDir && s.byDir.long && s.byDir.short, '§1 byDir returned with both buckets');
  ok(s.byDir.long.n === 20 && s.byDir.long.w === 20, '§1 long bucket: 20 settled, 20 wins');
  ok(s.byDir.short.n === 20 && s.byDir.short.w === 0, '§1 short bucket: 20 settled, 0 wins');
  ok(s.byDir.long.rrSum === 40, '§1 long rrSum = 2 * 20 = 40 (hg-v1305)');
  ok(s.byDir.short.rrSum === 0, '§1 short rrSum = 0 (no wins)');
  /* Pool arithmetic sanity */
  ok(Math.abs(s.hit - 0.5) < 1e-9, '§1 pool hit = 0.5');
  ok(Math.abs(s.expR - 0.5) < 1e-9, '§1 pool expR = +0.5 (would read PROVEN)');
})();

/* ===================== §2: aggregate fold carries rrSum per direction ===================== */

(function(){
  const ctx = bootLedger();
  const F = ctx.hgFwdFold, N = ctx.hgFwdNormalize;
  const base = { tab: 'OMNIBTC', mechanic: 'MMOVE', sym: 'BTCUSD', tf: '4h', horizonBars: 20 };
  const geo = dir => (dir === 'short')
    ? { entry: 100, stop: 105, t1: 90, mark: 100 }
    : { entry: 100, stop: 95,  t1: 110, mark: 100 };
  const mk = (i, dir, state) => Object.assign(
    N(Object.assign({}, base, geo(dir), { barT: 1700000000 + i * 3600, dir })),
    { state }
  );
  /* 2 long wins, 1 long loss, 1 short win, 1 short loss */
  const recs = [
    mk(0, 'long', 't1'), mk(1, 'long', 't1'), mk(2, 'long', 'stop'),
    mk(3, 'short', 't1'), mk(4, 'short', 'stop')
  ];
  const agg = F({}, recs);
  const key = 'OMNIBTC|MMOVE';
  ok(agg[key] && agg[key].dir_long && agg[key].dir_short, '§2 fold writes dir_long and dir_short');
  ok(agg[key].dir_long.n === 3 && agg[key].dir_long.w === 2, '§2 long fold: 3 settled, 2 wins');
  /* rr for long = (110 - 100) / (100 - 95) = 2, so rrSum long = 2 * 2 wins = 4 */
  ok(agg[key].dir_long.rrSum === 4, '§2 long rrSum fold = 4 (hg-v1305)');
  /* rr for short = (100 - 90) / (105 - 100) = 2, so rrSum short = 2 * 1 win = 2 */
  ok(agg[key].dir_short.n === 2 && agg[key].dir_short.w === 1, '§2 short fold: 2 settled, 1 win');
  ok(agg[key].dir_short.rrSum === 2, '§2 short rrSum fold = 2 (hg-v1305)');

  /* Fold survives the live-record purge — hgFwdStatsOf with [] + agg reads back */
  const st = ctx.hgFwdStatsOf([], 'OMNIBTC', 'MMOVE', false, agg);
  ok(st.byDir.long.rrSum === 4, '§2 agg survives the live purge: long rrSum = 4');
  ok(st.byDir.short.rrSum === 2, '§2 agg survives the live purge: short rrSum = 2');
})();

/* ===================== §3: pool verdict unchanged (backward compat) ===================== */

(function(){
  const ctx = bootLedger();
  const recs = buildMMOVE(ctx);
  /* Install records directly into storage so proven-edge.js reads them. */
  ctx.localStorage.setItem('hg_forward_v1', JSON.stringify(recs));
  const v = ctx.hgProvenEdgeVerdict('omnibtc', 'MMOVE', { pool: 'OMNIBTC', mechanic: 'MMOVE' });
  ok(v.state === 'proven', '§3 pool verdict: proven (unchanged — backward compat)');
  ok(!v.dir, '§3 no dir stamped when none passed');
})();

/* ===================== §4: dir-aware verdict reads per-direction ===================== */

(function(){
  const ctx = bootLedger();
  const recs = buildMMOVE(ctx);
  ctx.localStorage.setItem('hg_forward_v1', JSON.stringify(recs));
  const pool = { pool: 'OMNIBTC', mechanic: 'MMOVE' };
  const vLong = ctx.hgProvenEdgeVerdict('omnibtc', 'MMOVE', Object.assign({}, pool, { dir: 'long' }));
  const vShort = ctx.hgProvenEdgeVerdict('omnibtc', 'MMOVE', Object.assign({}, pool, { dir: 'short' }));
  ok(vLong.state === 'proven' && vLong.n === 20, '§4 LONG verdict: proven, n=20');
  ok(vShort.state === 'losing' && vShort.n === 20, '§4 SHORT verdict: losing, n=20');
  ok(Math.abs(vLong.expR - 2) < 1e-9, '§4 LONG expR = +2 (20 wins of 20 at avgRr=2)');
  ok(Math.abs(vShort.expR - (-1)) < 1e-9, '§4 SHORT expR = -1 (0 wins of 20)');
  ok(vLong.dir === 'long' && vShort.dir === 'short', '§4 verdict stamps the direction queried');
})();

/* ===================== §5: junk / missing dir falls through to pool ===================== */

(function(){
  const ctx = bootLedger();
  const recs = buildMMOVE(ctx);
  ctx.localStorage.setItem('hg_forward_v1', JSON.stringify(recs));
  const pool = { pool: 'OMNIBTC', mechanic: 'MMOVE' };
  const vJunk1 = ctx.hgProvenEdgeVerdict('omnibtc', 'MMOVE', Object.assign({}, pool, { dir: 'LONG' }));
  const vJunk2 = ctx.hgProvenEdgeVerdict('omnibtc', 'MMOVE', Object.assign({}, pool, { dir: 'buy' }));
  const vJunk3 = ctx.hgProvenEdgeVerdict('omnibtc', 'MMOVE', Object.assign({}, pool, { dir: null }));
  const vJunk4 = ctx.hgProvenEdgeVerdict('omnibtc', 'MMOVE', Object.assign({}, pool, { dir: undefined }));
  const vJunk5 = ctx.hgProvenEdgeVerdict('omnibtc', 'MMOVE', Object.assign({}, pool, { dir: 1 }));
  ok(vJunk1.state === 'proven' && !vJunk1.dir, '§5 "LONG" (uppercase) → pool');
  ok(vJunk2.state === 'proven' && !vJunk2.dir, '§5 "buy" → pool');
  ok(vJunk3.state === 'proven' && !vJunk3.dir, '§5 null → pool');
  ok(vJunk4.state === 'proven' && !vJunk4.dir, '§5 undefined → pool');
  ok(vJunk5.state === 'proven' && !vJunk5.dir, '§5 numeric → pool');
})();

/* ===================== §6: thin dir records as unproven, not losing ===================== */

(function(){
  const ctx = bootLedger();
  const N = ctx.hgFwdNormalize;
  const base = { tab: 'OMNIBTC', mechanic: 'NR7', sym: 'BTCUSD', tf: '4h', horizonBars: 20 };
  const geo = dir => (dir === 'short')
    ? { entry: 100, stop: 105, t1: 90, mark: 100 }
    : { entry: 100, stop: 95,  t1: 110, mark: 100 };
  const mk = (i, dir, state) => Object.assign(
    N(Object.assign({}, base, geo(dir), { barT: 1700000000 + i * 3600, dir })),
    { state }
  );
  const recs = [];
  /* 20 long wins (clearly proven) */
  for (let i = 0; i < 20; i++) recs.push(mk(i, 'long', 't1'));
  /* 5 short losses — under floor (20) */
  for (let i = 0; i < 5; i++) recs.push(mk(i + 100, 'short', 'stop'));
  ctx.localStorage.setItem('hg_forward_v1', JSON.stringify(recs));
  const vShort = ctx.hgProvenEdgeVerdict('omnibtc', 'NR7', { pool: 'OMNIBTC', mechanic: 'NR7', dir: 'short' });
  ok(vShort.state === 'unproven', '§6 thin short (n=5 < floor=20): unproven, not losing');
})();

/* ===================== §7: textual pins on the three OMNIBTC call sites ===================== */

(function(){
  const src = read('omnibtc.js');
  ok(/hgProvenEdgeVerdict\('omnibtc',\s*pickMech,[\s\S]{0,200}dir:\s*pick\.row\s*&&\s*pick\.row\.dir/.test(src),
    '§7 pickV call site passes pick.row.dir');
  ok(/hgProvenEdgeVerdict\('omnibtc',\s*bm,[\s\S]{0,200}dir:\s*btcForProven\[bi\]\s*&&\s*btcForProven\[bi\]\.dir/.test(src),
    '§7 override iteration passes btcForProven[bi].dir');
  ok(/hgProvenEdgeVerdict\('omnibtc',\s*mechName,[\s\S]{0,200}dir:\s*pick\.row\s*&&\s*pick\.row\.dir/.test(src),
    '§7 final measured demote passes pick.row.dir');
})();

/* ===================== §8: behavioural override — short crown refused ===================== */

(function(){
  const ctx = bootLedger();
  const recs = buildMMOVE(ctx);
  ctx.localStorage.setItem('hg_forward_v1', JSON.stringify(recs));
  /* Walk the same loop as omnibtc.js hg-v1051 override at line 1119-1128.
     btcForProven = two clean candidates. */
  const btcForProven = [
    { sym: 'BTCUSD', dir: 'short', entry: 100, stop: 105, t1: 90, clean: true, omniKind: 'MMOVE' },
    { sym: 'BTCUSD', dir: 'long',  entry: 100, stop: 95,  t1: 110, clean: true, omniKind: 'NR7-BREAK' }
  ];
  const mechOf = r => String(r.omniKind || r.kind || r.engine || 'UNKNOWN').toUpperCase().slice(0, 28);

  /* PRE-PACK behaviour (what the hg-v1303 defect looked like): no dir in opts */
  let prePick = null;
  for (let bi = 0; bi < btcForProven.length; bi++){
    if (!btcForProven[bi].clean) continue;
    const bm = mechOf(btcForProven[bi]);
    const bv = ctx.hgProvenEdgeVerdict('omnibtc', bm, { pool: 'OMNIBTC', mechanic: bm });
    if (bv && bv.state === 'proven'){ prePick = btcForProven[bi]; break; }
  }
  ok(prePick && prePick.dir === 'short' && prePick.omniKind === 'MMOVE',
    '§8 PRE-PACK (no dir): pool verdict crowns a SHORT on the long-side record');

  /* POST-PACK behaviour: pass dir */
  let postPick = null;
  for (let bi = 0; bi < btcForProven.length; bi++){
    if (!btcForProven[bi].clean) continue;
    const bm = mechOf(btcForProven[bi]);
    const bv = ctx.hgProvenEdgeVerdict('omnibtc', bm, { pool: 'OMNIBTC', mechanic: bm, dir: btcForProven[bi].dir });
    if (bv && bv.state === 'proven'){ postPick = btcForProven[bi]; break; }
  }
  ok(!postPick, '§8 POST-PACK (dir-aware): the short crown on long-only record is refused');

  /* A long MMOVE still crowns on long-paying record */
  const longCand = { sym: 'BTCUSD', dir: 'long', entry: 100, stop: 95, t1: 110, clean: true, omniKind: 'MMOVE' };
  const bvLong = ctx.hgProvenEdgeVerdict('omnibtc', mechOf(longCand),
    { pool: 'OMNIBTC', mechanic: mechOf(longCand), dir: longCand.dir });
  ok(bvLong && bvLong.state === 'proven', '§8 a long MMOVE still crowns on long-paying record');
})();

/* ===================== §9: desk-wide readers (no dir) read pool ===================== */

(function(){
  const ctx = bootLedger();
  const recs = buildMMOVE(ctx);
  ctx.localStorage.setItem('hg_forward_v1', JSON.stringify(recs));
  /* reversalsniper.js / chartvision-tab.js / trendtable.combined.js ask the
     pooled verdict (no opts.dir). Prove that path reads unchanged. */
  const v = ctx.hgProvenEdgeVerdict('reversalsniper', 'REVERSALSNIPER', { pool: 'OMNIBTC', mechanic: 'MMOVE' });
  ok(v.state === 'proven' && !v.dir, '§9 desk-wide readers (no opts.dir) read pool unchanged');
})();

/* ===================== §10: mutation-pass anchors ===================== */

(function(){
  const fwd = read('hg-forward.js');
  const pe = read('proven-edge.js');
  const ob = read('omnibtc.js');
  /* The nine behavioural mutations, pinned both at an anchor in the source
     and in a §1-§8 assertion above — so a textual revert of one does not
     silently restore the defect. */
  ok(/byDir\.long\.rrSum\s*\+=/.test(fwd), '§10/M1 live loop writes long rrSum');
  ok(/byDir\.short\.rrSum\s*\+=|if \(r\.state === 't1'\)\{ byDir\[r\.dir\]\.w\+\+; byDir\[r\.dir\]\.rrSum/.test(fwd), '§10/M1 live loop writes rrSum on t1 for both sides');
  ok(/\{\s*n\s*:\s*0\s*,\s*w\s*:\s*0\s*,\s*rrSum\s*:\s*0\s*\}/.test(fwd), '§10/M2 byDir buckets seed rrSum');
  ok(/out\[key\]\[dk\]\.rrSum\s*\+=/.test(fwd), '§10/M3 fold writes rrSum on t1');
  ok(/opts\.dir === 'long' \|\| opts\.dir === 'short'/.test(pe), '§10/M4+M9 strict long/short in verdict');
  ok(/stats\.byDir\[opts\.dir\]/.test(pe), '§10/M5 byDir lookup by exact dir string');
  ok(/dir:\s*pick\.row\s*&&\s*pick\.row\.dir/.test(ob), '§10/M6+M8 omnibtc.js pickV + measured pass pick.row.dir');
  ok(/dir:\s*btcForProven\[bi\]\s*&&\s*btcForProven\[bi\]\.dir/.test(ob), '§10/M7 omnibtc.js override passes candidate.dir');
})();

if (failed){ console.log('\n' + failed + ' failures'); process.exit(1); }
console.log('\npassed: ' + passed);
