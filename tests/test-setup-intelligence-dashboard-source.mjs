/* HARDGATE — the Setup Intelligence dashboard must read a store that has data,
   and must not render an absence as a measurement (hg-v734).

   Run: node tests/test-setup-intelligence-dashboard-source.mjs

   WHAT WAS WRONG
   --------------
   The dashboard reported "Total Setups 0 / Win Rate 0%" permanently. Four
   separate stores existed and it read the only empty one:

     hg_forward_v1 (hg-forward.js)  355 real records, settled forward evidence
     activate-setup-recording       signals from SMC and every tab; nothing reads it
     HG_SETUP_INTELLIGENCE          EMPTY — what the dashboard read
     factory's six hardcoded tabs   zero overlap with the seven that record

   Three naming schemes for the same tabs made translation hopeless
   ('GOLDULTRA' in the forward log, 'GOLD ULTRA' in the factory, 'GOLD_ULTRA'
   from smc-setups), so the fix reads whichever tabs the log actually contains.

   Two latent bugs went with it: winRate is a PERCENT STRING ("66.7%") but was
   parsed as a fraction and re-multiplied by 100, inflating every rate 100x; and
   the summary carried its own '%' while the template appended another, so the
   page literally rendered "0%%". Both were invisible only because the store was
   always empty.

   Every assertion below fails if the fix is reverted. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

const FACTORY = fs.readFileSync(path.join(ROOT, 'hardgate-all-tabs-integration-factory.js'), 'utf8');
const DASH = fs.readFileSync(path.join(ROOT, 'hardgate-setup-intelligence-dashboard.js'), 'utf8');

/* a fake window carrying a forward log shaped exactly like hg-forward.js's */
function makeW(records, pools){
  const store = { hg_forward_v1: JSON.stringify(records) };
  return {
    localStorage: { getItem: k => (k in store ? store[k] : null) },
    hgFwdPool: tab => pools[tab] || {},
    HG_SETUP_INTELLIGENCE: null,       /* the empty store the bug read */
  };
}
function loadFactory(W){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, JSON, Object, Array, Number, String,
    parseFloat, parseInt, isFinite, isNaN, Set, Promise, setTimeout };
  ctx.window = W; ctx.globalThis = ctx;
  vm.createContext(ctx);
  /* a top-level `class` is a lexical binding, not a property of the context,
     so it has to be captured explicitly at the end of the same script */
  vm.runInContext(FACTORY + '\n;globalThis.__FACTORY_CLASS = HardgateAllTabsIntegrationFactory;',
                  ctx, { filename: 'factory.js' });
  const Klass = ctx.__FACTORY_CLASS;
  if (!Klass) throw new Error('factory class not reachable in sandbox');
  return new Klass(W);
}

console.log('== the dashboard no longer double-prints the percent sign ==');
ok(!/\$\{summary\.overallWinRate\}%/.test(DASH),
   'the template no longer appends % to a value that already carries one (this rendered "0%%")');
ok(/\$\{summary\.overallWinRate\}/.test(DASH), 'it still renders the win rate');

console.log('== the win-rate unit bug is fixed ==');
ok(/parseFloat\(perf\.winRate\)[^\n]*\/\s*100/.test(FACTORY),
   'winRate is divided by 100 before weighting — it is a percent string, not a fraction');

console.log('== the factory reads the forward log ==');
ok(/getForwardLogPerformance/.test(FACTORY), 'getForwardLogPerformance exists');
ok(/hgFwdPool/.test(FACTORY), 'it calls hgFwdPool');
ok(/hg_forward_v1/.test(FACTORY), 'it reads the forward log storage key');

console.log('== with settled data, real numbers come through ==');
{
  const records = [
    { tab: 'GOLDSCALP', mechanic: 'OB', sym: 'XAUUSD' },
    { tab: 'PINE', mechanic: 'SQZ', sym: 'BTCUSD' },
  ];
  const pools = {
    GOLDSCALP: { OB: { samples: 10, wins: 6, open: 5, avgRr: 2.0 } },
    PINE: { SQZ: { samples: 10, wins: 2, open: 0, avgRr: 1.0 } },
  };
  const f = loadFactory(makeW(records, pools));
  const perf = f.getAllTabsPerformance();

  ok(Object.keys(perf).length === 2, 'both forward-log tabs appear (' + Object.keys(perf).join(', ') + ')');
  ok(perf.GOLDSCALP.closedSetups === 10 && perf.GOLDSCALP.totalSetups === 15,
     'settled and open are counted separately (10 settled of 15)');
  ok(perf.GOLDSCALP.winRate === '60.0%', 'per-tab win rate is real — got ' + perf.GOLDSCALP.winRate);

  const rep = f.getUnifiedPerformanceReport();
  /* 6 wins + 2 wins = 8 of 20 settled = 40.0%. Under the old arithmetic this
     came out as 4000%. */
  ok(rep.summary.overallWinRate === '40.0%',
     'aggregate win rate is not inflated 100x — got ' + rep.summary.overallWinRate);
  ok(rep.summary.closedSetups === 20 && rep.summary.totalSetups === 25,
     'aggregate counts are right (20 settled of 25)');
  ok(rep.summary.overallRiskReward === '1.50', 'R:R averaged across tabs — got ' + rep.summary.overallRiskReward);
}

console.log('== with NOTHING settled, an absence is not rendered as a zero ==');
{
  /* This is the honest-empty-state case, and it is not hypothetical: a forward
     record cannot resolve until bars after its firing bar exist, so on a 4h
     record with a 20-bar horizon that is ~80 hours. A young log is CORRECTLY
     all-open, and calling that "0% win rate" asserts a measurement nobody made. */
  const records = [{ tab: 'GOLDSWING', mechanic: 'P9VOLBAR', sym: 'XAUUSD' }];
  const pools = { GOLDSWING: { P9VOLBAR: { samples: 0, wins: 0, open: 12, avgRr: null } } };
  const f = loadFactory(makeW(records, pools));
  const perf = f.getAllTabsPerformance();

  ok(perf.GOLDSWING, 'a tab with only open records still appears — the setups exist');
  ok(perf.GOLDSWING.totalSetups === 12 && perf.GOLDSWING.closedSetups === 0, '12 open, 0 settled');
  ok(perf.GOLDSWING.winRate === null, 'win rate is null, not 0 — no outcome has happened yet');

  const rep = f.getUnifiedPerformanceReport();
  ok(rep.summary.overallWinRate === '—', 'summary shows an em dash, not "0%" — got ' + rep.summary.overallWinRate);
  ok(rep.summary.overallRiskReward === '—', 'and so does R:R — got ' + rep.summary.overallRiskReward);
  ok(rep.summary.totalSetups === 12, 'but the open setups are still counted and shown');
}

console.log('== a tab with no records at all is omitted, not shown as zeros ==');
{
  const f = loadFactory(makeW([], {}));
  const perf = f.getAllTabsPerformance();
  ok(Object.keys(perf).length === 0, 'empty log yields no rows rather than a wall of 0.0% tabs');
  const rep = f.getUnifiedPerformanceReport();
  ok(rep.summary.overallWinRate === '—', 'and the summary still declines to invent a number');
}

console.log('== degrades when the forward log is absent entirely ==');
{
  const W = { localStorage: null, HG_SETUP_INTELLIGENCE: null };   /* no hgFwdPool */
  const f = loadFactory(W);
  ok(JSON.stringify(f.getForwardLogPerformance()) === '{}', 'no hgFwdPool → empty object, no throw');
  const rep = f.getUnifiedPerformanceReport();
  ok(rep && rep.summary, 'the report is still produced');
}

console.log('\ntest-setup-intelligence-dashboard-source: ' + passed + ' assertions passed');
