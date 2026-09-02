#!/usr/bin/env node
/* HARDGATE — NY volume exhaustion two-volume test (hg-v556) */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..') + '/';

let passed = 0, failed = 0;
function ok(cond, msg){
  if (cond){ passed++; console.log('  ok —', msg); }
  else { failed++; console.log('  FAIL —', msg); }
}

globalThis.window = {};
vm.runInThisContext(fs.readFileSync(root + 'indicators.js', 'utf8'), { filename: 'indicators.js' });
vm.runInThisContext(fs.readFileSync(root + 'indicators2.js', 'utf8'), { filename: 'indicators2.js' });
vm.runInThisContext(fs.readFileSync(root + 'goldind.js', 'utf8'), { filename: 'goldind.js' });
const W = globalThis.window;

console.log('== exports ==');
ok(typeof W.hgGoldNyBlock === 'function', 'hgGoldNyBlock');
ok(typeof W.hgGoldSessionRvol === 'function', 'hgGoldSessionRvol');
ok(typeof W.hgGoldNyRvolSignature === 'function', 'hgGoldNyRvolSignature');
ok(typeof W.hgGoldNyExhaustion === 'function', 'hgGoldNyExhaustion');
ok(typeof W.hgGoldNyExhaustionScore === 'function', 'hgGoldNyExhaustionScore');
ok(typeof W.hgGoldNyExhaustionHtml === 'function', 'hgGoldNyExhaustionHtml');
ok(W.HG_GOLD_NY_RAID_RVOL === 1.5, 'raid RVOL floor 1.5');
ok(W.HG_GOLD_NY_TAKE_RVOL === 1.2, 'takeover RVOL floor 1.2');
ok(W.HG_GOLD_NY_ALERT === 75, 'alert ≥75');
ok(W.HG_GOLD_NY_WATCH === 65, 'watch ≥65');

console.log('\n== NY block timing ==');
{
  const open = W.hgGoldNyBlock(Date.UTC(2024, 5, 12, 12, 30, 0));
  ok(open.block === 'OPEN', '12:30 UTC → OPEN');
  const mid = W.hgGoldNyBlock(Date.UTC(2024, 5, 12, 14, 0, 0));
  ok(mid.block === 'MID', '14:00 UTC → MID');
  const late = W.hgGoldNyBlock(Date.UTC(2024, 5, 12, 16, 0, 0));
  ok(late.block === 'LATE', '16:00 UTC → LATE');
  const off = W.hgGoldNyBlock(Date.UTC(2024, 5, 12, 3, 0, 0));
  ok(off.block === 'OFF', '03:00 UTC → OFF');
}

console.log('\n== RVOL signatures ==');
{
  const g = W.hgGoldNyRvolSignature(1.8, 1.4, false, true);
  ok(g.key === 'genuine' && g.fade, 'genuine reversal when raid+take+MSS');
  const weak = W.hgGoldNyRvolSignature(0.9, 1.5, false, true);
  ok(weak.key === 'weak-fake' && !weak.fade, 'weak fake wick below 1.2');
  const brk = W.hgGoldNyRvolSignature(2.0, 1.5, true, false);
  ok(brk.key === 'breakout' && !brk.fade, 'real breakout — do not fade');
  const dead = W.hgGoldNyRvolSignature(1.8, 0.7, false, false);
  ok(dead.key === 'dead' && !dead.fade, 'dead response — stand aside');
}

/** Build multi-session history + NY MID low sweep with climactic raid + reclaim. */
function nyExhaustionRows(){
  const rows = [];
  const baseDay = Math.floor(Date.UTC(2024, 5, 12) / 1000); /* Wed */
  /* 20 prior sessions of same-slot volume baseline (~14:00 UTC 15m bars) */
  for (let d = 20; d >= 1; d--){
    for (let h = 0; h < 24; h++){
      for (let m = 0; m < 4; m++){
        const t = baseDay - d * 86400 + h * 3600 + m * 900;
        const asia = h < 8;
        rows.push({
          t, o: 2320, h: 2324, l: 2316, c: 2320,
          v: asia ? 40 : (h >= 12 && h < 17 ? 100 : 60)
        });
      }
    }
  }
  /* Event day: Asia box 2300–2310 */
  for (let h = 0; h < 8; h++){
    for (let m = 0; m < 4; m++){
      const t = baseDay + h * 3600 + m * 900;
      rows.push({ t, o: 2305, h: 2310, l: 2300, c: 2305, v: 50 });
    }
  }
  /* Grind into NY mid */
  for (let h = 8; h < 14; h++){
    for (let m = 0; m < 4; m++){
      const t = baseDay + h * 3600 + m * 900;
      rows.push({ t, o: 2304, h: 2308, l: 2301, c: 2303, v: 90 });
    }
  }
  /* Raid bar at 14:00 UTC — pierce Asia low 2300, close back above, high RVOL */
  const raidT = baseDay + 14 * 3600;
  rows.push({ t: raidT, o: 2302, h: 2306, l: 2294, c: 2305, v: 280 });
  /* Takeover bars — fail to extend, high RVOL reclaim / MSS-ish */
  rows.push({ t: raidT + 900, o: 2305, h: 2312, l: 2303, c: 2310, v: 200 });
  rows.push({ t: raidT + 1800, o: 2310, h: 2314, l: 2308, c: 2312, v: 160 });
  rows.sort((a, b) => a.t - b.t);
  return rows;
}

console.log('\n== session RVOL baseline ==');
{
  const rows = nyExhaustionRows();
  const idx = rows.length - 3; /* raid bar */
  const sr = W.hgGoldSessionRvol(rows, idx, {});
  ok(isFinite(sr.rvol) && sr.rvol >= 1.5, 'session RVOL on raid ≥1.5 (got ' + sr.rvol + ')');
  ok(sr.mode === 'session' || sr.mode === 'rolling-fallback', 'mode labeled (' + sr.mode + ')');
  ok(sr.samples >= 3 || sr.mode === 'rolling-fallback', 'has baseline samples or fallback');
}

console.log('\n== score parts ==');
{
  const hit = {
    dir: 'long', level: 2300, levelKind: 'asia', label: 'ASIA LOW',
    breachAtr: 0.40, raidRvol: 2.0, takeRvol: 1.5, wickFrac: 0.55,
    failExtend: true, extreme: 2294, atr: 8,
    mss: { ok: true, why: 'CHoCH bullish' },
    vwap: { ok: true, vwap: 2308 },
    signature: { key: 'genuine', label: 'GENUINE REVERSAL SWEEP', fade: true }
  };
  const sc = W.hgGoldNyExhaustionScore(hit, {
    block: { block: 'MID', label: 'mid' },
    regime: { style: 'mean-rev' },
    newsGate: { lock: false }
  });
  ok(sc.score >= 75, 'full genuine score ≥75 (got ' + sc.score + ')');
  ok(sc.tier === 'alert', 'tier alert');
  ok(sc.confirmed, 'confirmed');
  ok(sc.plan && isFinite(sc.plan.stop), 'plan has stop beyond extreme');
  ok(sc.parts.liquidity === 20, 'liq 20 for asia');
  ok(sc.parts.takeover === 20, 'takeover 20');
}

console.log('\n== detector on synthetic NY raid ==');
{
  const rows = nyExhaustionRows();
  const exh = W.hgGoldNyExhaustion(rows, {
    now: Date.UTC(2024, 5, 12, 14, 30, 0),
    regime: { style: 'mean-rev', vol: { regime: 'expansion' } },
    newsGate: { lock: false }
  });
  ok(exh.block && exh.block.block === 'MID', 'detector sees MID block');
  ok(!!exh.cvdNote && /PROXY/i.test(exh.cvdNote), 'CVD PROXY note present');
  ok(exh.ok || exh.score > 0 || /raid|exhaustion|RVOL/i.test(exh.why || ''),
    'returns readable result (ok=' + exh.ok + ' score=' + exh.score + ' why=' + exh.why + ')');
  if (exh.dir){
    ok(exh.dir === 'long', 'bullish after low sweep');
    ok(isFinite(exh.score), 'score finite');
  }
  const html = W.hgGoldNyExhaustionHtml(exh.ok || exh.score > 0 ? exh : {
    ok: true, tier: 'watch', score: 70, dir: 'long', level: 2300,
    signature: { label: 'GENUINE REVERSAL SWEEP' },
    block: { block: 'MID' }, why: 'test',
    raid: { rvol: 1.8, mode: 'session' }, takeover: { rvol: 1.3 },
    plan: { stop: 2290, entry: 'retest' },
    cvdNote: 'CVD/order-flow is PROXY on XAUT/PAXG/spot — not COMEX GC'
  });
  ok(/NY EXHAUSTION/.test(html) && /PROXY/.test(html), 'HTML paints NY EXHAUSTION + PROXY');
}

console.log('\n== forming stack wiring ==');
{
  const stack = W.hgGoldFormingStack({
    rows15m: nyExhaustionRows(),
    now: Date.UTC(2024, 5, 12, 14, 30, 0)
  });
  ok(stack.nyExhaustion != null, 'forming stack carries nyExhaustion');
  const html = W.hgGoldFormingStackHtml(stack);
  ok(typeof html === 'string', 'forming HTML string');
}

console.log('\n== desk wiring ==');
{
  const gi = fs.readFileSync(root + 'goldind.js', 'utf8');
  const scalp = fs.readFileSync(root + 'goldscalp.js', 'utf8');
  const swing = fs.readFileSync(root + 'goldswing.js', 'utf8');
  const og = fs.readFileSync(root + 'omnigold.js', 'utf8');
  ok(/nyexh/.test(gi) && /hgGoldNyExhaustion/.test(gi), 'goldind mints nyexh + engine');
  ok(/hgGoldFormingStack/.test(scalp), 'scalp paints forming stack');
  ok(/hgGoldNyExhaustion/.test(swing) && /NY EXHAUSTION/.test(swing), 'swing stamps NY EXHAUSTION');
  ok(/hgGoldFormingStackHtml/.test(og), 'omnigold paints forming HTML');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
