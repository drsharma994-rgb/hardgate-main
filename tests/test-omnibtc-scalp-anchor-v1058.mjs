/* HARDGATE — hg-v1058: THE HONEST SCALP ANCHOR.

   The honest replacement for the fixed-dollar "scalp prompt" metrics: a REAL
   rolling VWAP anchor on the winner's own tape (15m for scalp-priced engines,
   4h otherwise), mean-reversion bands ATR-scaled around it (never fixed
   dollars), the Bollinger squeeze state, and the session. The panel prints on
   the OMNIBTC card; two forward marks (vwapDevPct, bbSqueeze) ride the record
   so the ledger can later split on the mean-reversion state.

   Evidence, never a gate: every unreadable input fails open to null / ''.

   Run: node tests/test-omnibtc-scalp-anchor-v1058.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function mk(){
  return { innerHTML: '', textContent: '', disabled: false, style: {},
           classList: { add(){}, remove(){}, contains: () => false },
           addEventListener(){}, setAttribute(){}, appendChild(){},
           querySelector: () => null, querySelectorAll: () => [] };
}
function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array,
    JSON, Error, Promise, RegExp, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => mk(), getElementById: () => null,
                   querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, body: { appendChild(){} },
                   documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'hg-gates.js', 'hg-perfect-setup.js', 'hg-setup-core.js',
                   'crypto-position-risk.js', 'formation.js', 'plans.js', 'setup-ui.js',
                   'onchain-alt-data.js', 'omnibtc-engines.js', 'omnibtc.js'])
    vm.runInContext(read(f), ctx, { filename: f });
  return ctx;
}

const T4 = 14400, N4 = 220, LAST_T = 1760000000;
function tape(closeOf, rangeOf, volOf){
  const rows = [];
  for (let i = 0; i < N4; i++){
    const c = closeOf(i), r = rangeOf(i);
    rows.push({ t: LAST_T - (N4 - 1 - i) * T4, o: c - r / 4, h: c + r / 2, l: c - r / 2, c, v: volOf(i) });
  }
  return rows;
}
/* a clean trend: er ~1, BB width constant -> NORMAL; dev from 50-bar VWAP small */
const TREND = tape(i => 100 + i * 0.5, () => 0.4, () => 100);
/* a compression: wiggle amplitude collapses in the LAST 20 bars, so the
   20-bar width now reads far below the trailing 50-bar average of widths */
const SQUEEZE = tape(i => 100 + Math.sin(i / 4) * (i < N4 - 20 ? 1.2 : 0.15), () => 0.3, () => 100);
/* a spike out of the band: last bar closes far above the anchor */
const SPIKE = (function(){
  const rows = tape(i => 100 + i * 0.2, () => 0.4, () => 100);
  const last = rows[rows.length - 1];
  rows[rows.length - 1] = Object.assign({}, last, { o: last.c, h: last.c + 30, l: last.c + 25, c: last.c + 28 });
  return rows;
})();
/* a range day: closes oscillate mildly — price stays inside the day bands */
const RANGE = tape(i => 100 + Math.sin(i / 6) * 0.3, () => 0.2, () => 100);
/* the same range tape on 15m stamps (scalp-priced engines read the 15m tape) */
const RANGE15 = RANGE.map(function(r, i){ return Object.assign({}, r, { t: LAST_T - (N4 - 1 - i) * 900 }); });

console.log('== 1) the anchor read: real day-VWAP, ATR bands, squeeze state ==');
{
  const W = boot();
  const pick = { row: { engine: 'SMC ChoCh', dir: 'long' } };
  const match = { _rows: TREND };
  const a = W.hgObtcScalpAnchorRead(pick, match);
  ok(a && isFinite(a.vwap) && a.vwap > 0, 'a readable tape yields a real day-VWAP anchor (' + (a && a.vwap && a.vwap.toFixed(2)) + ')');
  ok(a && a.dayBars >= 2 && a.dayBars <= 6, '  the anchor is the current UTC day so far (' + (a && a.dayBars) + ' bars), never a rolling window');
  ok(a && a.devPct > 0, '  an uptrend trades ABOVE its day anchor (' + (a && a.devPct.toFixed(2)) + '%)');
  ok(a.bandLo < a.vwap && a.vwap < a.bandUp, '  the mean-reversion bands straddle the anchor (ATR-scaled, never fixed dollars)');
  const rg = W.hgObtcScalpAnchorRead(pick, { _rows: RANGE });
  ok(rg && Math.abs(rg.devPct) < 1 && rg.over === false, '  a range day stays inside the bands (' + (rg && rg.devPct.toFixed(2)) + '%)');
  ok(a.tapeLabel === '4h', '  a swing-priced engine reads the 4h tape');
  /* scalp-priced engines read the 15m tape the desk holds */
  const a15 = W.hgObtcScalpAnchorRead({ row: { engine: 'SCALP funding fade' } }, { _rows: RANGE, _rows15: RANGE15 });
  ok(a15 && a15.tapeLabel === '15m', '  a scalp-priced engine reads the 15m tape');
  /* squeeze state on the compressing tape */
  const sq = W.hgObtcScalpAnchorRead(pick, { _rows: SQUEEZE });
  ok(sq && sq.bbState === 'SQUEEZE', '  the compressing tape reads SQUEEZE (width ' + (sq && sq.wNow && sq.wNow.toFixed(2)) + '% vs ' + (sq && sq.wAvg && sq.wAvg.toFixed(2)) + '%)');
  /* the spike closes beyond the upper band */
  const sp = W.hgObtcScalpAnchorRead(pick, { _rows: SPIKE });
  ok(sp && sp.over === true && sp.overSide === 'upper', '  a close beyond 2xATR14 of the anchor reads OVEREXTENDED upper');
  /* fail open */
  ok(W.hgObtcScalpAnchorRead(null, match) === null, 'no pick -> null');
  ok(W.hgObtcScalpAnchorRead(pick, null) === null, 'no winner tape -> null');
  ok(W.hgObtcScalpAnchorRead(pick, { _rows: tape(i => 100, () => 0.4, () => 100).slice(0, 20) }) === null,
     'a thin tape (< 40 bars) -> null, never a guess');
}

console.log('== 2) the panel prints the honest rows, or nothing ==');
{
  const W = boot();
  const pick = { row: { engine: 'SMC ChoCh', scalpAnchor: W.hgObtcScalpAnchorRead({ row: { engine: 'SMC ChoCh' } }, { _rows: RANGE }) } };
  const h = W.hgObtcScalpAnchorHtml(pick);
  ok(h.indexOf('SCALP ANCHOR') >= 0, 'the panel title prints');
  ok(h.indexOf('VWAP anchor') >= 0 && h.indexOf('Mean-reversion bands') >= 0 && h.indexOf('Bollinger state') >= 0,
     '  the three honest rows print');
  ok(h.indexOf('OVEREXTENDED') < 0, '  a range day claims no overextension');
  const sp = { row: { engine: 'SMC ChoCh', scalpAnchor: W.hgObtcScalpAnchorRead({ row: { engine: 'SMC ChoCh' } }, { _rows: SPIKE }) } };
  ok(W.hgObtcScalpAnchorHtml(sp).indexOf('OVEREXTENDED') >= 0, '  the spike panel names the overextension');
  ok(W.hgObtcScalpAnchorHtml({ row: {} }) === '', 'no anchor -> empty panel');
}

console.log('== 3) the scan stashes, the record marks, the panel wires ==');
{
  const src = read('omnibtc.js');
  ok(src.indexOf('pick.row.scalpAnchor = accAnchor') >= 0, 'the scan stashes the anchor on the row (panel never recomputes)');
  ok(src.indexOf('dhtml += hgObtcScalpAnchorHtml(pick);') >= 0, 'the panel is wired into the detail area');
  ok(src.indexOf('W.hgObtcScalpAnchorRead = hgObtcScalpAnchorRead') >= 0 && src.indexOf('W.hgObtcScalpAnchorHtml = hgObtcScalpAnchorHtml') >= 0,
     'the seams are exported for tests');
  ok(src.indexOf('vwapDevPct: (isFinite(pfReads.vwapDevPct)') >= 0 && src.indexOf('bbSqueeze: (pfReads.bbSqueeze || undefined)') >= 0,
     'both marks ride the fwdRow literal');
  /* the censuses still see their carriers inside the same literal */
  ok(src.indexOf('fundingPct: (fwdTk') >= 0 && src.indexOf('mark: fwdLast') >= 0,
     'fundingPct + mark stay inside the record literal (the call-shape censuses)');
  ok(src.indexOf("var fwdRows = [fwdRow];") >= 0, 'the named record array is untouched');
}

console.log('== 4) the forward ledger accepts the marks, refuses junk ==');
{
  /* hg-forward.js alone, the session-split test's own boot shape */
  const store = {};
  const S = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} }, Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, Intl,
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, TypeError, Set, Map, encodeURIComponent, setTimeout, clearTimeout, AbortController };
  S.window = S; S.globalThis = S; S.self = S; S.HG_tabs = []; S.HG_warmups = []; S.HG_TAB_MODS = {}; S.setInterval = () => 0; S.clearInterval = () => {};
  S.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){}, addEventListener(){}, querySelector: () => null, querySelectorAll: () => [] }),
                 head: { appendChild(){} }, body: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  S.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  S.location = { href: 'https://x/', search: '', protocol: 'https:' }; S.navigator = { userAgent: 'node' }; S.fetch = async () => ({ ok: false, status: 500, text: async () => '' });
  vm.createContext(S);
  vm.runInContext(read('hg-forward.js'), S, { filename: 'hg-forward.js' });

  const rec = (extra) => Object.assign({
    tab: 'OBTC', mechanic: 'CROWN', sym: 'GOOD', tf: '4h', dir: 'long',
    entry: 100, stop: 95, t1: 110, barT: 1700000000, horizonBars: 20
  }, extra || {});
  const good = S.hgFwdNormalize(rec({ vwapDevPct: 0, bbSqueeze: 'SQUEEZE' }));
  ok(good.vwapDevPct === 0 && good.bbSqueeze === 'SQUEEZE', 'valid marks survive — and a ZERO deviation is a READ zero');
  const okEnums = S.hgFwdNormalize(rec({ vwapDevPct: -1.25, bbSqueeze: 'EXPANSION' }));
  ok(okEnums.vwapDevPct === -1.25 && okEnums.bbSqueeze === 'EXPANSION', 'signed deviation and EXPANSION survive');
  const junk = S.hgFwdNormalize(rec({ vwapDevPct: 'wide', bbSqueeze: 'wide', trendQuality: 'NOPE' }));
  ok(junk.vwapDevPct === undefined && junk.bbSqueeze === undefined && junk.trendQuality === undefined,
     'junk is refused, never coerced (the enum whitelists hold)');
  const abs = S.hgFwdNormalize(rec({}));
  ok(abs.vwapDevPct === undefined && abs.bbSqueeze === undefined, 'absent means absent');
  /* fold buckets: bbs per enum, vwp sum+count (fold reads SETTLED records —
     the session split's own seam, so settle all three first) */
  S.hgFwdRecord(rec({ sym: 'A1', bbSqueeze: 'SQUEEZE', vwapDevPct: 0.5 }));
  S.hgFwdRecord(rec({ sym: 'A2', bbSqueeze: 'SQUEEZE', vwapDevPct: 1.5 }));
  S.hgFwdRecord(rec({ sym: 'A3', bbSqueeze: 'NORMAL', vwapDevPct: -1 }));
  const win  = [{ t: 1700014400, o: 100, h: 111, l: 99, c: 110, v: 1 }];
  S.hgFwdResolve('A1', '4h', win); S.hgFwdResolve('A2', '4h', win); S.hgFwdResolve('A3', '4h', win);
  const f = S.hgFwdFold({}, S.hgFwdRecords('OBTC'))['OBTC|CROWN'];
  ok(f && f.bbs && f.bbs.SQUEEZE && f.bbs.SQUEEZE.wins === 2 && f.bbs.NORMAL.wins === 1, 'bbSqueeze folds per enum value (the house blank shape)');
  ok(f && f.vwp && f.vwp.n === 3 && Math.abs(f.vwp.sum - 1) < 1e-9, 'vwapDevPct folds sum+count (mean survives pruning)');
}

console.log('\ntest-omnibtc-scalp-anchor-v1058: ' + passed + ' passed, 0 failed');
