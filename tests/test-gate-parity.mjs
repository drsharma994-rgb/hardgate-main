/* HARDGATE — gate threshold parity.
   engine.js, edge.js, plans.js and cryptogates.js each carry their own copy of
   the SWING gate thresholds. In Aug 2026 they had drifted: cryptogates used a
   0.30xATR G1 spread (engine 0.25), a 0.75 volume-z floor (engine 0.5) and a
   1.25xATR EMA21 anchor (engine 1.5), and hgSwingG5OK computed the RSI-slope
   stand-in and threw it away. Net effect: the ticket-producing path was 3.2x
   stricter than the engine it claims parity with, and silently rejected ~32%
   of aligned cascades that engine.js accepts.
   Run: node tests/test-gate-parity.mjs                                      */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const num = (src, re, label) => {
  const m = src.match(re);
  if (!m) throw new Error('FAIL: could not read ' + label);
  return parseFloat(m[1]);
};
console.log('== SWING thresholds agree across engine / edge / cryptogates / plans ==');
{
  const eng = read('engine.js'), cg = read('cryptogates.js'), pl = read('plans.js'), ed = read('edge.js');
  const engSpread = num(eng, /var SPREAD_MIN_ATR\s*=\s*([\d.]+)/, 'engine SPREAD_MIN_ATR');
  const cgSpread  = num(cg,  /var CG_G1_SPREAD_ATR\s*=\s*([\d.]+)/, 'CG_G1_SPREAD_ATR');
  const edSpread  = num(ed,  /Math\.abs\(e21 - e50\) >= ([\d.]+) \* a4/, 'edge spread');
  ok(engSpread === cgSpread, 'G1 spread: cryptogates ' + cgSpread + ' == engine ' + engSpread);
  ok(engSpread === edSpread, 'G1 spread: edge ' + edSpread + ' == engine ' + engSpread);
  const engVolz = num(eng, /var VOLZ_MIN\s*=\s*([\d.]+)/, 'engine VOLZ_MIN');
  const cgVolz  = num(cg,  /var CG_G5_VZ_MIN\s*=\s*([\d.]+)/, 'CG_G5_VZ_MIN');
  const plVolz  = num(pl,  /var HG_G5_VOLZ_MIN\s*=\s*([\d.]+)/, 'HG_G5_VOLZ_MIN');
  ok(engVolz === cgVolz, 'G5 volume-z: cryptogates ' + cgVolz + ' == engine ' + engVolz);
  ok(engVolz === plVolz, 'G5 volume-z: plans ' + plVolz + ' == engine ' + engVolz);
  const engAnchor = num(eng, /var ANCHOR_MAX_ATR\s*=\s*([\d.]+)/, 'engine ANCHOR_MAX_ATR');
  const cgAnchor  = num(cg,  /var CG_SWING_ANCHOR_ATR\s*=\s*([\d.]+)/, 'CG_SWING_ANCHOR_ATR');
  ok(engAnchor === cgAnchor, 'EMA21 anchor: cryptogates ' + cgAnchor + ' == engine ' + engAnchor);
  ok(/G6 dynamic R:R\s*<\s*2\.5/.test(eng) === false,
     'engine G6 veto text no longer names a stale 2.5 threshold');
  ok(/R:R ≥2\.5/.test(ed) === false, 'edge tally label no longer names a stale 2.5 threshold');
}
console.log('== hgSwingG5OK honours the quiet-tape RSI-slope stand-in ==');
{
  const ctx = { console, Math, Date, isFinite, parseFloat, JSON, Array, Object, Number, String, setTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'plans.js']) {
    vm.runInContext(read(f), ctx, { filename: f });
  }
  /* Choppy drift, then a late acceleration => RSI slope UP over the last 3
     bars; last bar closes at its high => closeOK; flat volume => z ~0, i.e. a
     QUIET tape. engine.js passes this; the old hgSwingG5OK rejected it. */
  const c = [];
  for (let i = 0; i < 112; i++) c.push(100 + i * 0.2 + (i % 2 ? -0.35 : 0.35));
  for (let i = 0; i < 8; i++) c.push(c[c.length - 1] * 1.012);
  const rows = c.map((v, i) => ({ t: i, o: v - 0.4, h: v, l: v - 0.5, c: v, v: 1000 }));
  const r14 = ctx.rsi(c, 14)[c.length - 1];
  const vz = ctx.volZ(rows, 20);
  const quiet = ctx.hgSwingG5OK('long', rows, c, r14, vz);
  ok(!(vz > 0.5), 'fixture really is a quiet tape (volume z ' + vz.toFixed(2) + ')');
  ok(quiet.slopeOK === true, 'RSI slope is running with the trade');
  ok(quiet.ok === true, 'quiet tape + RSI slope + strong close PASSES G5 (engine parity)');
  ok(quiet.quiet === true, 'the pass is flagged as a quiet-tape stand-in, not a volume pass');
  /* volume collapsing into a weak close stays a hard no */
  const bad = rows.slice();
  const n = bad.length - 1;
  bad[n] = { t: n, o: c[n] + 1, h: c[n] + 1.5, l: c[n] - 1, c: c[n] - 0.9, v: 1 };
  const badVz = ctx.volZ(bad, 20);
  const res = ctx.hgSwingG5OK('long', bad, bad.map(r => r.c), ctx.rsi(bad.map(r => r.c), 14)[n], badVz);
  ok(res.ok === false, 'weak close still fails G5 regardless of RSI slope');
}
console.log('\n' + passed + ' passed, 0 failed');
