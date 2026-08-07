/* HARDGATE — the scan funnel was showing a number you cannot act on.
   THE GAP. hgScanFunnelRows already tallies how many symbols each gate BLOCKS
   and sorts by it. That number is not a decision, because a gate that blocks a
   lot may be blocking symbols that three other gates were failing anyway.
   Measured over 20,910 aligned cascades (27 CLEAN):
       gate     blocks    ONLY blocker
       G6        20153        1795
       G5        13169          50
       G7         8138           9
       ANCHOR     7453           0   <- relaxing it adds NOTHING
       G4         4221           5
       G3         4016           0   <- relaxing it adds NOTHING
       G2         2035           3
       G1         1728           4
   ANCHOR and G3 sit 4th and 6th in the left column — they look like major
   constraints — and are worth exactly zero setups in the right one. That is
   the same result pack 12 found from the other direction: G3 and ANCHOR are
   consequences of G6's risk cap, not independent gates.
   With the app currently emitting zero setups (alert-state.json: setups 0,
   tickets null), the question "which gate do I relax" is live. The old panel
   would have pointed at ANCHOR. It would have bought nothing.
   Run: node tests/test-sole-blocker.mjs                                      */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const ctx = { console, Math, Date, isFinite, parseFloat, JSON, Array, Object, Number, String, setTimeout };
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
vm.createContext(ctx);
for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'cryptogates.js'])
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const G = (names, anchorOK, clean) => ({
  dir: 'long', clean: clean, anchorOK: anchorOK,
  gates: ['G1 a', 'G2 b', 'G3 c', 'G4 d', 'G5 e', 'G6 f', 'G7 g']
    .map(function(g){ return [g, names.indexOf(g.split(' ')[0]) < 0]; })
});
console.log('== one failing gate is named, several are not ==');
{
  ok(ctx.cgSoleBlocker(G(['G6'], true, false)) === 'G6', 'a single failing gate is returned');
  ok(ctx.cgSoleBlocker(G(['G5'], true, false)) === 'G5', 'and it is the right one');
  ok(ctx.cgSoleBlocker(G(['G5', 'G6'], true, false)) === null, 'two failing gates -> null, no single relaxation helps');
  ok(ctx.cgSoleBlocker(G(['G1', 'G3', 'G6'], true, false)) === null, 'three -> null');
}
console.log('== the EMA21 anchor counts as a gate, because clean requires it ==');
{
  ok(ctx.cgSoleBlocker(G([], false, false)) === 'ANCHOR',
     '7/7 gates but the anchor missed -> ANCHOR is the sole blocker');
  ok(ctx.cgSoleBlocker(G(['G6'], false, false)) === null,
     'a gate AND the anchor -> null, not "G6"');
}
console.log('== a clean or directionless matrix has no blocker ==');
{
  ok(ctx.cgSoleBlocker(G([], true, true)) === null, 'a CLEAN setup is not blocked by anything');
  ok(ctx.cgSoleBlocker({ dir: null, gates: [], clean: false }) === null, 'no direction -> null');
  ok(ctx.cgSoleBlocker(null) === null, 'null -> null, never throws');
  ok(ctx.cgSoleBlocker({}) === null, 'a malformed matrix -> null');
}
console.log('== on real matrices it separates "blocks a lot" from "blocks alone" ==');
{
  function rng(seed){ let s = seed; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }
  const blocks = {}, sole = {};
  let aligned = 0;
  for (let seed = 1; seed <= 4000; seed++){
    const r = rng(seed * 7919), mkt = []; let m = 100;
    for (let i = 0; i < 300; i++){ m = m * (1 + (r() - 0.5) * 0.02 + (r() < 0.5 ? 0.002 : -0.001)); mkt.push(m); }
    const beta = 0.6 + r() * 1.2, alpha = (r() - 0.5) * 0.004, vol = 0.012 + r() * 0.02;
    const bars = []; let p = 100;
    for (let i = 0; i < 300; i++){
      const mr = i ? (mkt[i] / mkt[i - 1] - 1) : 0, o = p;
      p = p * (1 + beta * mr + alpha + (r() - 0.5) * vol);
      bars.push({ t: i * 14400, o, h: Math.max(o, p) * (1 + r() * vol * 0.4),
                  l: Math.min(o, p) * (1 - r() * vol * 0.4), c: p, v: 1000 + r() * 500 });
    }
    const mm = ctx.swingGateMatrix(bars, { symbol: 'X', fundingPct: [-0.06, -0.02, 0, 0.02, 0.06][seed % 5] });
    if (!mm || !mm.dir || mm.clean) continue;
    aligned++;
    mm.gates.forEach(function(g){ if (!g[1]){ const k = g[0].split(' ')[0]; blocks[k] = (blocks[k] || 0) + 1; } });
    if (!mm.anchorOK) blocks.ANCHOR = (blocks.ANCHOR || 0) + 1;
    const sb = ctx.cgSoleBlocker(mm);
    if (sb) sole[sb] = (sole[sb] || 0) + 1;
  }
  ok(aligned > 500, 'the sample produced ' + aligned + ' blocked cascades');
  ok((blocks.ANCHOR || 0) > 500, 'ANCHOR blocks a lot on its own count (' + blocks.ANCHOR + ')');
  ok(!sole.ANCHOR, 'and is NEVER the sole blocker — relaxing it buys nothing');
  ok((blocks.G3 || 0) > 300, 'G3 also blocks a lot (' + blocks.G3 + ')');
  ok(!sole.G3, 'and is also never the sole blocker');
  ok((sole.G6 || 0) > 0, 'G6 IS a sole blocker (' + sole.G6 + ') — the one real lever');
  const topBlock = Object.keys(blocks).sort(function(a, b){ return blocks[b] - blocks[a]; })[0];
  const topSole = Object.keys(sole).sort(function(a, b){ return sole[b] - sole[a]; })[0];
  ok(topSole === 'G6', 'the top sole blocker is G6');
  ok(sole[topSole] < blocks[topBlock] / 5,
     'and the two columns disagree by an order of magnitude — which is the point');
}
console.log('== the funnel panel reports both, and says which is which ==');
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/may also be failing others/.test(html), 'the BLOCK rows are labelled as non-actionable');
  ok(/ONLY blocker/.test(html), 'a separate ONLY-blocker section exists');
  ok(/relaxing this gate would add/.test(html), 'each ONLY row states what relaxing it buys');
  ok(/any gate absent from the ONLY list adds nothing/.test(html),
     'and absence from the list is explained rather than left as silence');
  ok(/no single relaxation helps/.test(html), 'the empty case is stated too');
  ok(/audit\.sole\[sb\] = \(audit\.sole\[sb\] \|\| 0\) \+ 1/.test(html), 'the scan actually tallies it');
}
console.log('\n' + passed + ' passed, 0 failed');
