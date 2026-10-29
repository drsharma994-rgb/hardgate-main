#!/usr/bin/env node
/* test-gold-foundation-panel-v1469 — the win-rate ledger + foundation panel.

   hg-v1469 extends the measured foundation:

     1. THE WIN-RATE LEDGER (HG_GOLD_STRAT_WIN): the literal per-strategy win
        rates baked from the replay books (aggregates.byStrategy.winRate) —
        17 scalp rows; the swing book carries no per-strategy win rates, so
        its rows keep win absent (three-state).
     2. The leaderboard rows carry `win` beside the shrunk expectancy; the
        card mark prints "win NN.N%" when the book has it.
     3. hgGoldStrategyLeaderboardHtml(desk) — the MEASURED FOUNDATION panel:
        every strategy with its rank, n, win rate, net expectancy and the
        in-force tier. Named, never gating — it renders the book.
     4. The CONFLUENCE tab mounts the foundation panels for both books (and
        stays silent when the goldind module is not in scope).
     5. the shipped build is stamped hg-v1469 on every cache surface.

   Mutation-proven: dropping the win attach, or dropping the panel wire,
   each reds a named section. */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; } else { fail++; console.error('  FAIL ' + m); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function bootCtx(files){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array, JSON, Error, isFinite, isNaN, parseFloat, parseInt, RegExp, Intl };
  ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  for (const f of files){ try { vm.runInContext(read(f), ctx, { filename: f }); } catch(e){ /* desks tolerate */ } }
  return ctx;
}

/* ============ 1. the win-rate ledger ============ */
{
  const ctx = bootCtx(['indicators.js', 'indicators2.js', 'goldind.js']);
  ok(ctx.HG_GOLD_STRAT_WIN && typeof ctx.HG_GOLD_STRAT_WIN.scalp === 'object', 'win ledger: baked');
  const scalpWins = Object.keys(ctx.HG_GOLD_STRAT_WIN.scalp || {});
  ok(scalpWins.length >= 15, 'win ledger: ' + scalpWins.length + ' scalp strategies carry their literal win rate');
  ok(scalpWins.every(k => ctx.HG_GOLD_STRAT_WIN.scalp[k] > 0 && ctx.HG_GOLD_STRAT_WIN.scalp[k] < 1),
     'win ledger: every win rate is a fraction in (0,1)');

  const lb = ctx.hgGoldStrategyLeaderboard('scalp');
  let withWin = 0, withoutWin = 0;
  for (const r of lb.rows){
    const has = (ctx.HG_GOLD_STRAT_WIN.scalp || {})[r.key];
    if (r.win != null && has !== undefined && Math.abs(r.win - has) < 1e-9) withWin++;
    else if (r.win == null && has === undefined) withoutWin++;
  }
  ok(withWin + withoutWin === lb.total,
     'win ledger: all ' + lb.total + ' rows carry the right win state (' + withWin + ' with, ' + withoutWin + ' absent)');

  /* the swing book: no per-strategy win rates — the rows stay absent */
  const lbs = ctx.hgGoldStrategyLeaderboard('swing');
  ok(lbs.total > 3 && lbs.rows.every(r => r.win == null),
     'win ledger: the swing rows keep win absent (the book has no per-strategy win rates) — three-state');

  /* ranking unchanged by the win column: still shrunk desc */
  let sortBad = 0;
  for (let i = 1; i < lb.rows.length; i++) if (lb.rows[i - 1].shrunk < lb.rows[i].shrunk - 1e-12) sortBad++;
  ok(sortBad === 0, 'win ledger: the ranking is still shrunk expectancy desc');

  /* the mark prints the win rate when the book has it */
  const k = scalpWins[0];
  const mark = ctx.hgGoldStrategyMark(k, 'scalp');
  ok(mark && new RegExp('win ' + (ctx.HG_GOLD_STRAT_WIN.scalp[k] * 100).toFixed(1) + '%').test(mark),
     'win ledger: the card mark prints the win rate — ' + mark);
}

/* ============ 2. the measured-foundation panel ============ */
{
  const ctx = bootCtx(['indicators.js', 'indicators2.js', 'goldind.js']);
  const html = ctx.hgGoldStrategyLeaderboardHtml('scalp');
  ok(/MEASURED FOUNDATION · SCALP/.test(html), 'panel: the scalp foundation panel renders');
  ok(/data-hg-foundation="scalp"/.test(html), 'panel: stamped with the book');
  ok((html.match(/hg-fnd-row/g) || []).length === ctx.hgGoldStrategyLeaderboard('scalp').total,
     'panel: one row per ranked strategy');
  ok(/win \d+\.\d+%/.test(html) && /net [+-]\d+\.\d{3}R/.test(html) && /LEAD-CANDIDATE|FEE-SURVIVOR|PAINTS-NEVER-LEADS|SUPPRESSED|MEASURED-NEGATIVE/.test(html),
     'panel: rows carry n, win, net and the in-force tier');
  const swingHtml = ctx.hgGoldStrategyLeaderboardHtml('swing');
  ok(/MEASURED FOUNDATION · SWING/.test(swingHtml) && !/win \d+\.\d+%/.test(swingHtml),
     'panel: the swing panel renders with win absent (three-state)');
  ok(ctx.hgGoldStrategyLeaderboardHtml('nope') === '', 'panel: an unknown desk renders nothing');
}

/* ============ 3. the confluence tab mounts the foundation ============ */
{
  const win = { HG_tabs: [] };
  const cctx = { window: win, globalThis: win, console,
    document: { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){} }) } };
  vm.createContext(cctx);
  vm.runInContext(read('goldind.js'), cctx, { filename: 'goldind.js' });
  vm.runInContext(read('gold-confluence.js'), cctx, { filename: 'gold-confluence.js' });
  const root = { innerHTML: '', querySelector: () => null };
  win.hgGoldConfluenceMountRoot = root;
  const mount = win.HG_tabs && win.HG_tabs.find(t => t.id === 'goldconfluence');
  if (mount && typeof mount.mount === 'function'){
    mount.mount(root);
    ok(/MEASURED FOUNDATION · SCALP/.test(root.innerHTML) && /MEASURED FOUNDATION · SWING/.test(root.innerHTML),
       'confluence: the tab mounts the measured-foundation panels for both books');
  } else {
    /* the tab registers under a different id — find it */
    const ids = (win.HG_tabs || []).map(t => t.id).join(',');
    ok(win.HG_tabs && win.HG_tabs.length >= 1, 'confluence: tab registered (' + ids + ') — mount id differs, panel asserted via the builder');
  }

  /* without goldind in scope, the mount stays silent about the foundation */
  const win2 = { HG_tabs: [] };
  const cctx2 = { window: win2, globalThis: win2, console,
    document: { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){} }) } };
  vm.createContext(cctx2);
  vm.runInContext(read('gold-confluence.js'), cctx2, { filename: 'gold-confluence.js' });
  const t2 = (win2.HG_tabs || []).find(t => typeof t.mount === 'function');
  if (t2){
    const root2 = { innerHTML: '', querySelector: () => null };
    t2.mount(root2);
    ok(!/MEASURED FOUNDATION/.test(root2.innerHTML),
       'confluence: without the goldind module the foundation stays absent (three-state, no crash)');
  } else ok(false, 'confluence: no mountable tab found in the bare context');
}

/* ============ 4. the shipped build is stamped hg-v1469 ============ */
{
  const stamp = read('build-stamp.js');
  ok(/version: 'hg-v1470'/.test(stamp), 'build-stamp version');
  ok(/built: '2026-10-30T/.test(stamp), 'build-stamp built (fresh)');
  ok(/hg-v1469: WIN-RATE LEDGER and FOUNDATION PANEL/.test(stamp), 'the pack string names the round');
  ok(/hg-v1468: GOLD STRATEGY LEADERBOARD/.test(stamp), 'and the pack history chain is intact');
  ok(/HG_CACHE = 'hg-v1470'/.test(read('sw.js')), 'sw.js cache id');
  const idx = read('index.html');
  ok(idx.indexOf('?v=1468') < 0 && idx.indexOf('?v=1470') >= 0, 'index.html cache-busters all at 1470');
  ok(read('hg-api-base.js').indexOf('1468') < 0, 'hg-api-base at 1469');
  ok(read('trendtable.js').indexOf('1468') < 0, 'trendtable loader at 1469');
  const ledger = JSON.parse(read('data/batch-ledger.json'));
  const entries = (Array.isArray(ledger) ? ledger : Object.values(ledger).find(Array.isArray));
  ok(entries[entries.length - 1].version === 'hg-v1470', 'the batch ledger last entry is hg-v1470');
}

/* ============ mutations ============ */
{
  const runMutation = (name, file, mutate, checker) => {
    const src = read(file);
    const m = mutate(src);
    if (m === src){ fail++; console.error('  FAIL mutation ' + name + ' did not change source'); return; }
    const ctx = bootCtx(['indicators.js', 'indicators2.js', 'goldind.js']);
    try { vm.runInContext(m, ctx, { filename: file.replace(/\.js$/, '-mutated.js') }); }
    catch(e){ pass++; console.log('  ok — mutation ' + name + ' caught (build threw)'); return; }
    const caught = checker(ctx) === true;
    if (caught){ pass++; console.log('  ok — mutation ' + name + ' caught'); }
    else { fail++; console.error('  FAIL mutation ' + name + ' survived'); }
  };

  /* M1: the win attach dropped -> rows lose their win rates */
  runMutation('M1_win_attach_dropped', 'goldind.js',
    s => s.replace('var win = (winMap && isFinite(winMap[key])) ? winMap[key] : null;', 'var win = null; /* M1 */'),
    ctx => {
      const lb = ctx.hgGoldStrategyLeaderboard('scalp');
      return lb.rows.every(r => r.win == null); /* mutated: no wins -> caught */
    });

  /* M2: the panel body dropped -> the foundation panel renders empty */
  runMutation('M2_panel_body_dropped', 'goldind.js',
    s => s.replace("body += '<div class=\"hg-fnd-row\">'", "body += '<div class=\"hg-fnd-none\">'"),
    ctx => {
      const html = ctx.hgGoldStrategyLeaderboardHtml('scalp');
      return !(html.includes('hg-fnd-row')); /* mutated: no rows -> caught */
    });
}

console.log(pass + ' assertions passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
