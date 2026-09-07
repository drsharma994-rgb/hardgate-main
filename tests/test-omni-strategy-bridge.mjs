/* HARDGATE — OMNI strategy bridge across MODELS tabs. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(extra){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN,
    parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error,
    setTimeout, clearTimeout, setInterval, clearInterval };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){} }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){} }, addEventListener(){} };
  if (extra) Object.assign(ctx, extra);
  vm.createContext(ctx);
  vm.runInContext(read('desk-formation-edge.js'), ctx, { filename: 'desk-formation-edge.js' });
  vm.runInContext(read('formation-nightly-boot.js'), ctx, { filename: 'formation-nightly-boot.js' });
  vm.runInContext(read('formation-nightly.js'), ctx, { filename: 'formation-nightly.js' });
  vm.runInContext(read('hg-omni-strategy-bridge.js'), ctx, { filename: 'hg-omni-strategy-bridge.js' });
  vm.runInContext(read('super-desk-common.js'), ctx, { filename: 'super-desk-common.js' });
  return ctx;
}

console.log('== tab kind map covers COMMAND desks ==');
{
  const W = boot();
  const tabs = [
    'brain', 'book', 'trade', 'log', 'news', 'bias', 'regime', 'trendmx',
    'rotation', 'execute', 'startrader'
  ];
  for (const t of tabs){
    const kind = W.hgOmniPrincipalKind(t, '');
    ok(!!kind, t + ' → ' + kind);
    ok(!!W.hgOmniPrincipalDesk(t), t + ' desk resolves');
  }
}

console.log('== tab kind map covers MODELS desks ==');
{
  const W = boot();
  const tabs = [
    'super-setup', 'super-best', 'super-sniper', 'super-book', 'super-calibrate',
    'pine', 'pine-msb', 'pine-sqz', 'strats', 'meanrev', 'formationlab', 'scorecard', 'reliability'
  ];
  for (const t of tabs){
    const kind = W.hgOmniPrincipalKind(t, '');
    ok(!!kind, t + ' → ' + kind);
    ok(!!W.hgOmniPrincipalDesk(t), t + ' desk resolves');
  }
  ok(W.hgOmniPrincipalTabForScript('msb-ob') === 'pine-msb', 'script → tab map');
}

console.log('== gold tabs skip crypto desk nightly banners ==');
{
  const W = boot();
  const goldTabs = [
    'super-gold', 'omnigold', 'goldswing', 'goldscalp', 'gold', 'goldpro',
    'goldspot', 'goldcoint', 'goldpine', 'signallog'
  ];
  for (const t of goldTabs){
    ok(!!W.HG_GOLD_TAB_IDS[t], t + ' flagged as gold tab');
    ok(!W.hgOmniPrincipalKind(t, ''), t + ' has no crypto OMNI kind');
    const html = W.hgTabFormationDayHtml(t);
    ok(/OG1/.test(html), t + ' gold nightly mentions OG1');
    ok(!/SWING SCAN|SCALP SCAN|OMNIROUTE BEST/.test(html), t + ' skips crypto desk banner');
  }
  ok(W.hgTabFormationDayPaint('omnigold1') === null, 'omnigold1 skips external paint');
}

console.log('== tab kind map covers TOOLS desks ==');
{
  const W = boot();
  const tabs = ['risk', 'basis', 'search', 'finder', 'tradeos', 'hey', 'aiagent'];
  for (const t of tabs){
    const kind = W.hgOmniPrincipalKind(t, '');
    ok(!!kind, t + ' → ' + kind);
    ok(!!W.hgOmniPrincipalDesk(t), t + ' desk resolves');
  }
}

console.log('== replay demote on toxic analogues ==');
{
  const W = boot();
  const sniper = W.hgOmniPrincipalApply(
    { dir: 'long', entry: 100, stop: 98, t1: 104, tier: 'clean', minimalLossPass: true },
    { tab: 'super-sniper' }
  );
  ok(sniper.omniKind === 'PIN-REJECT', 'super-sniper maps PIN-REJECT');
  ok(sniper.demoted === true, 'PIN-REJECT demoted');
  ok(sniper.omniPrincipal === 'replay-demoted' || sniper.omniPrincipal === 'desk-edge-suppress',
    'principal stamped');

  const smc = W.hgOmniPrincipalApply(
    { dir: 'short', entry: 100, stop: 102, t1: 96, tier: 'clean', edgeTicket: true },
    { tab: 'pine-msb', strategy: 'msb-ob' }
  );
  ok(smc.deskEdgeAction === 'suppress' || smc.demoted === true, 'pine-msb FVG suppress path');

  const mean = W.hgOmniPrincipalApply(
    { dir: 'long', entry: 100, stop: 98, t1: 104, tier: 'clean' },
    { tab: 'meanrev', strategy: 'meanrev' }
  );
  ok(mean.omniKind === 'VWAP-REVERT', 'meanrev maps VWAP-REVERT');
}

console.log('== super-desk-common applies demote effects ==');
{
  const W = boot();
  const hit = { tier: 'clean', minimalLossPass: true, sizingPass: true, entry: 1, stop: 0.9, t1: 1.2, dir: 'long' };
  W.hgSuperDeskApplyOmniPrincipal(hit, 'super-sniper');
  ok(hit.tier === 'near', 'demote strips CLEAN tier');
  ok(hit.minimalLossPass === false, 'demote clears min-loss pass');
}

console.log('== formation nightly paints all nav tabs ==');
{
  const W = boot();
  const ids = W.HG_TAB_DAY_PAINT_IDS || [];
  const navTabs = [
    'brain', 'book', 'trade', 'log', 'news', 'bias', 'regime', 'trendmx', 'rotation', 'execute', 'startrader',
    'combi', 'omnibtc', 'omnipresent', 'omniroute', 'dexscreener', 'setupconfirm', 'best', 'swing', 'scalp',
    'edge', 'smart', 'squeeze', 'reversalsniper', 'smc', 'ob', 'trap', 'div', 'coil', 'apex', 'oiflow', 'liqs',
    'onchain', 'chartvision', 'carry', 'venueprem', 'termbasis',
    'super-setup', 'super-best', 'super-sniper', 'super-book', 'super-calibrate',
    'pine', 'pine-msb', 'pine-sqz', 'strats', 'meanrev', 'formationlab', 'scorecard', 'reliability',
    'super-gold', 'omnigold', 'omnigold1', 'goldswing', 'goldscalp', 'gold', 'goldpro', 'goldspot', 'goldcoint',
    'goldpine', 'signallog',
    'risk', 'basis', 'search', 'finder', 'tradeos', 'hey', 'aiagent'
  ];
  for (const t of navTabs) ok(ids.indexOf(t) >= 0, t + ' in paint list');
  ok(typeof W.hgCollectTabDayPaintIds === 'function', 'hgCollectTabDayPaintIds export');
  ok(typeof W.hgFormationNightlyScheduleTick === 'function', 'nightly schedule tick export');
}

console.log('== build stamp / sw cache ==');
ok(HG_VER === 'hg-v624', 'HG_VER is hg-v624');
ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches build stamp');

console.log('\n' + pass + ' passed');
