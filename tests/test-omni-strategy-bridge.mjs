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
    setTimeout, clearTimeout };
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

console.log('== build stamp / sw cache ==');
ok(HG_VER === 'hg-v621', 'HG_VER is hg-v621');
ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches build stamp');

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

console.log('== formation nightly paints MODELS tabs ==');
{
  const W = boot();
  const ids = W.HG_TAB_DAY_PAINT_IDS || [];
  ok(ids.indexOf('super-setup') >= 0, 'super-setup in paint list');
  ok(ids.indexOf('pine-msb') >= 0, 'pine-msb in paint list');
  ok(ids.indexOf('formationlab') >= 0, 'formationlab in paint list');
  ok(ids.indexOf('scorecard') >= 0, 'scorecard in paint list');
}

console.log('\n' + pass + ' passed');
