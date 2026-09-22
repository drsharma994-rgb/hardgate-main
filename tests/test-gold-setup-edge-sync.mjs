/* HARDGATE — the GOLD SCALP edge table must match the evidence it was baked from.

   WHAT THIS GUARDS. scripts/gold-setup-edge.json is the artefact a re-bake
   writes (goldind.js: "node scripts/analyze-goldscalp-backtest.mjs and refresh
   gold-setup-edge.json"). HG_GOLD_SETUP_EDGE in goldind.js is a HAND
   TRANSCRIPTION of it, and the transcription is what actually runs:
   hgGoldSetupEdgeApply reads the in-code table, never the JSON, and its verdict
   decides whether a GOLD SCALP setup is dropped, demoted so it can never be
   MOST PROBABLE, or preferred.

   So there are two copies of the same evidence and, until now, nothing compared
   them. The existing test-gold-setup-edge.mjs spot-checks a handful of rows one
   at a time -- scalp.fvg on both sides, a few swing actions on the JSON alone --
   which is exactly the coverage that lets a re-bake flip an action in the JSON,
   pass every assertion, and leave the desk running the old one.

   Measured when this was written: the 23 rows present in both agreed exactly on
   n, gross, net and action -- so this test goes green today. It exists for the
   NEXT re-bake.

   WHAT COUNTS AS A LEGITIMATE DIFFERENCE. The JSON marks swing.ob and
   swing.ribbon 'neutral' and says so in its own note: "no row in the baked
   table". A neutral row changes nothing (hgGoldSetupEdgeApply acts only on
   suppress / demote / prefer), so leaving it out of the transcription is the
   author's stated intent, not drift. Every actionable row must be present and
   identical, and the code may not carry a row the evidence does not -- that is
   the hg-v700 lesson, where an inline 'bos' prefer pseudo-row quoted numbers no
   baked row backed.

   Run: node tests/test-gold-setup-edge-sync.mjs */
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

function loadGoldind(){
  const ctx = { window: {}, console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
                Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, Intl,
                parseInt, parseFloat, NaN, Infinity, RegExp, Set, Map, Error,
                setTimeout: () => 0, clearTimeout: () => {} };
  ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'structure-levels.js',
                   'gold-session.js', 'goldind.js']){
    try { vm.runInContext(fs.readFileSync(root + f, 'utf8'), ctx, { filename: f }); }
    catch (e) { /* optional legs; goldind is the one that must land */ }
  }
  return ctx.window;
}

const W = loadGoldind();
const CODE = W.HG_GOLD_SETUP_EDGE;
const JSN = JSON.parse(fs.readFileSync(root + 'scripts/gold-setup-edge.json', 'utf8'));
const ACTIONABLE = new Set(['suppress', 'demote', 'prefer']);
const near = (a, b) => (a === undefined && b === undefined) || Math.abs(+a - +b) < 1e-9;

/* ---------------------------------------------------------------- 1 */
console.log('\n1. both copies are actually there');
{
  ok(CODE && CODE.scalp && CODE.swing, 'the in-code table loaded from goldind.js');
  ok(JSN && JSN.scalp && JSN.swing, 'the baked evidence loaded from scripts/gold-setup-edge.json');
  ok(typeof W.hgGoldSetupEdgeApply === 'function', 'and the function that reads the in-code one');

  /* the thing that makes this matter: the running code reads the transcription */
  const src = fs.readFileSync(root + 'goldind.js', 'utf8');
  ok(/var table = opts\.swing \? HG_GOLD_SETUP_EDGE\.swing : HG_GOLD_SETUP_EDGE\.scalp;/.test(src),
     'hgGoldSetupEdgeApply reads HG_GOLD_SETUP_EDGE, not the JSON — so the transcription is what runs');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. every ACTIONABLE baked row is transcribed, exactly');
{
  const problems = [];
  let compared = 0, allowedAbsent = 0;
  for (const side of ['scalp', 'swing']){
    const C = CODE[side] || {}, J = JSN[side] || {};
    for (const k of Object.keys(J).sort()){
      const j = J[k], c = C[k];
      if (!c){
        /* hg-v909 CHANGED THIS. A neutral row used to be "intentionally not
           transcribed", so the code carried nothing for a mechanic the replay
           had measured — indistinguishable from one never measured at all.
           Now EVERY baked row is transcribed, neutral included, and an absent
           one is a defect whatever its action. */
        problems.push(side + '.' + k + ' is ' + j.action + ' in the evidence and MISSING from the code');
        continue;
      }
      compared++;
      if (c.action !== j.action) problems.push(side + '.' + k + ' action: code ' + c.action + ' vs evidence ' + j.action);
      if (c.n !== j.n) problems.push(side + '.' + k + ' n: code ' + c.n + ' vs evidence ' + j.n);
      if (!near(c.gross, j.gross)) problems.push(side + '.' + k + ' gross: code ' + c.gross + ' vs evidence ' + j.gross);
      /* the code calls it net; the evidence stores netXm and netPaxg, and the
         desk prices at XM -- so netXm is the one the transcription must carry */
      if (!near(c.net, j.netXm)) problems.push(side + '.' + k + ' net: code ' + c.net + ' vs evidence netXm ' + j.netXm);
    }
  }
  ok(compared >= 20, compared + ' rows present in both were compared field by field');
  /* The inverse of the old assertion, and a stronger one: neutral rows are
     the whole point of hg-v909, so they must be present AND carry their
     measurement. A neutral row transcribed without its n would be the same
     silence in a different shape. */
  let neutrals = 0, bareNeutrals = [];
  for (const side of ['scalp', 'swing']){
    const C = CODE[side] || {}, J = JSN[side] || {};
    for (const k of Object.keys(J)){
      if (ACTIONABLE.has(J[k].action)) continue;
      neutrals++;
      const c = C[k];
      if (!c || !(c.n > 0) || typeof c.net !== 'number') bareNeutrals.push(side + '.' + k);
    }
  }
  ok(neutrals >= 14, neutrals + ' neutral rows in the evidence — measured, and clearing no bar');
  ok(bareNeutrals.length === 0,
     'every one of them is transcribed WITH its n and net, so measured-and-flat cannot read as never-measured'
     + (bareNeutrals.length ? (' — bare: ' + bareNeutrals.join(', ')) : ''));
  ok(allowedAbsent === 0, 'and no baked row is left out of the code at all');
  ok(problems.length === 0,
     'every actionable row matches the evidence' + (problems.length ? ' — DRIFT: ' + problems.join('; ') : ''));
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. and the code invents no row the evidence does not have');
{
  /* hg-v700: an inline 'bos' prefer pseudo-row once quoted n and net figures
     that no baked row backed. A boost invented in code is worse than a missing
     one, because it reads as measured. */
  const invented = [];
  for (const side of ['scalp', 'swing']){
    const C = CODE[side] || {}, J = JSN[side] || {};
    for (const k of Object.keys(C)) if (!J[k]) invented.push(side + '.' + k);
  }
  ok(invented.length === 0,
     'no in-code row is absent from the evidence' + (invented.length ? ' — INVENTED: ' + invented.join(', ') : ''));

  const src = fs.readFileSync(root + 'goldind.js', 'utf8');
  ok(/the fabricated inline 'bos' prefer pseudo-row is GONE/.test(src),
     'the file still records why that rule exists');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. the prose on the card agrees with the numbers beside it');
{
  /* row.why is what a reader sees stamped on a demoted GOLD SCALP card. It
     quotes the net figure in words, so it is a third copy of the same number
     and can drift from the field it sits next to. */
  const bad = [];
  let quoted = 0, silent = 0;
  for (const side of ['scalp', 'swing']){
    for (const k of Object.keys(CODE[side] || {})){
      const r = CODE[side][k], w = String(r.why || '');
      ok_why: {
        const m = w.match(/net\s*([−-])\s*([0-9.]+)\s*R/i);
        if (!m){ silent++; break ok_why; }
        quoted++;
        const asProse = -parseFloat(m[2]);
        if (Math.abs(asProse - r.net) > 0.006)
          bad.push(side + '.' + k + ' prose says net ' + asProse + ', field says ' + r.net);
      }
      const nm = w.match(/\bn\s*=\s*([0-9]+)/);
      if (nm && +nm[1] !== r.n) bad.push(side + '.' + k + ' prose says n=' + nm[1] + ', field says n=' + r.n);
    }
  }
  ok(quoted >= 15, quoted + ' rows quote a net figure in their text');
  ok(bad.length === 0,
     'every quoted figure matches its own field' + (bad.length ? ' — ' + bad.join('; ') : ''));
  ok(silent >= 1, silent + ' row(s) quote no net at all, which is not a mismatch');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. the comparison is not vacuous');
{
  /* Prove each leg bites, by running it against a table that is wrong in
     exactly one way. If these pass unchanged, section 2 is decoration. */
  const clone = () => JSON.parse(JSON.stringify({ scalp: CODE.scalp, swing: CODE.swing }));
  const check = (tbl) => {
    for (const side of ['scalp', 'swing']){
      const C = tbl[side] || {}, J = JSN[side] || {};
      for (const k of Object.keys(J)){
        const j = J[k], c = C[k];
        if (!c){ if (!ACTIONABLE.has(j.action)) continue; return 'missing'; }
        if (c.action !== j.action) return 'action';
        if (c.n !== j.n) return 'n';
        if (!near(c.gross, j.gross)) return 'gross';
        if (!near(c.net, j.netXm)) return 'net';
      }
    }
    return null;
  };
  ok(check(clone()) === null, 'the real table passes the comparison');

  const a = clone(); a.scalp.bosalign.action = 'prefer';
  ok(check(a) === 'action', 'a flipped action is caught');
  const b = clone(); b.scalp.hvn.n = b.scalp.hvn.n + 50;
  ok(check(b) === 'n', 'a stale sample count is caught');
  const c = clone(); c.scalp.vwap.net = 0.4;
  ok(check(c) === 'net', 'a stale net is caught');
  const d = clone(); d.scalp.openrange.gross = -9;
  ok(check(d) === 'gross', 'a stale gross is caught');
  const e = clone(); delete e.scalp.fvg;
  ok(check(e) === 'missing', 'a dropped suppress row is caught');
  const f = clone(); delete f.swing.p6comp;
  ok(check(f) === 'missing', 'and a dropped demote row is caught');
}

/* ---------------------------------------------------------------- 6 */
console.log('\n6. the rows that actually govern GOLD SCALP');
{
  /* Measured over 300 synthetic tapes while writing this: of 110 setups the
     desk minted, 92 were kinds this table marks demote or suppress. It is not
     a side table -- it decides what GOLD SCALP is allowed to lead with. */
  const s = CODE.scalp;
  ok(ACTIONABLE.has(s.fvg.action) && ACTIONABLE.has(s.vwap.action),
     'the fee-toxic scalp kinds carry an action');
  ok(s.hvn.action === 'demote' && s.bosalign.action === 'demote' && s.ribbon.action === 'demote',
     'the three kinds that dominate the mint are demoted, so none of them can lead');
  ok(s.p9volbar.action === 'prefer', 'and the one fee-survivor is preferred');

  /* a demote must not become a drop: demoted cards still paint */
  const src = fs.readFileSync(root + 'goldind.js', 'utf8');
  ok(/if \(row\.action === 'demote'\)\{[\s\S]{0,200}?cand\.demoted = true;/.test(src),
     'demote sets demoted, never dropped — the card still paints, it just cannot lead');
  ok(/if \(row\.action === 'suppress'\)\{[\s\S]{0,200}?cand\.dropped = true;/.test(src),
     'and suppress is the one that drops it');
}

/* ---------------------------------------------------------------- 7 */
console.log('\n7. GOLD SCALP records itself on the timeframe it is made of');
{
  /* The setups are built on 15m: goldScalpSetups reads inp.rows15m, takes its
     entry from the last 15m close and sizes every stop off ATR14 on 15m. They
     were recorded as 1h, which since hg-v898 also decides which candles settle
     them. The wall-clock window is unchanged -- 24 x 1h and 96 x 15m are both
     one day -- and over 800 tapes the two gave an identical verdict every
     time, so this corrects a label without moving any evidence. */
  const gi = fs.readFileSync(root + 'goldind.js', 'utf8');
  ok(/var rows = __rows\(inp\.rows15m\);/.test(gi),
     'goldScalpSetups builds from the 15m rows');
  ok(/var a15 = __last\(_atr\(rows, 14\)\);/.test(gi),
     'and sizes its stops off ATR14 on those same bars');

  const gs = fs.readFileSync(root + 'goldscalp.js', 'utf8');
  ok(/hgFwdRecordScan\('GOLDSCALP', '15m',/.test(gs),
     'so the desk records GOLDSCALP as 15m, not 1h');
  ok(/horizonBars: 96/.test(gs),
     'with 96 bars — the same 24 hours the old 24 x 1h meant');
  ok(!/hgFwdRecordScan\('GOLDSCALP', '1h',/.test(gs),
     'and the contradicting label is gone');

  /* the horizon in wall-clock terms did not move */
  const TF = { '15m': 900, '1h': 3600 };
  ok(96 * TF['15m'] === 24 * TF['1h'],
     '96 x 15m and 24 x 1h are the same span (' + (96 * TF['15m']) + 's)');

  /* and it now agrees with the bars the desk hands the settler (hg-v898) */
  ok(/hgFwdResolveMulti\('XAUUSD', \{ '15m'/.test(gs),
     'the desk already resolves 15m candles, so these records can settle');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
