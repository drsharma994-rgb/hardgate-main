/* HARDGATE — XM_OMNIGOLD_MAX_LOTS is a maximum, and now behaves like one.

   OMNIGOLD's XM bot sends gold lots to a live MT5 bridge. Two environment
   variables size it: XM_OMNIGOLD_LOTS, documented as the default, and
   XM_OMNIGOLD_MAX_LOTS, documented as the cap. ogXmBotCfg read them like this:

     var lots = num(env.XM_OMNIGOLD_LOTS);
     if (!(lots >= 0.01)) lots = 0.01;
     var maxLots = num(env.XM_OMNIGOLD_MAX_LOTS);
     if (!(maxLots >= 0.01)) maxLots = 0.10;
     if (maxLots < lots) maxLots = lots;        // <- the cap yields to the size

   So XM_OMNIGOLD_LOTS=5.00 against XM_OMNIGOLD_MAX_LOTS=0.10 did not clip to
   0.10. It rewrote the cap to 5 and sent FIVE LOTS — fifty times the ceiling
   that was configured, on the live gold-order path.

   It compounded twice over. ogXmBuildOrder clips a client-supplied
   cand.volume with ogXmClipLots(volume, cfg.maxLots), so once the cap had
   raised itself that clip was a no-op too and any volume the payload asked
   for went through. And the status line prints the pair together —
   "5 lots (max 5)" — so a reader saw two numbers that agreed with each other
   and never the ceiling they had set.

   WHY THE EXISTING TEST DID NOT CATCH IT, which is the useful part.
   test-omnigold-xm-bot asserts ogXmClipLots(0.5, 0.10) === 0.10: the clip
   helper is correct and always was. What was wrong was the cap handed TO it.
   The unit was right and the wiring was not, and the only test of the wiring
   used LOTS 0.02 against MAX 0.10 — a pair that never exercises the branch.

   The size yields to the cap now, not the other way round.

   Run: node tests/test-omnigold-xm-lot-cap.mjs */
import { ogXmBotCfg, ogXmBuildOrder, ogXmBotStatus, ogXmClipLots } from '../lib/omnigold-xm-bot.mjs';

let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const cfgOf = (lots, max, extra) =>
  ogXmBotCfg(Object.assign({ XM_MT5_URL: 'https://bridge.example' },
                           lots == null ? {} : { XM_OMNIGOLD_LOTS: String(lots) },
                           max == null ? {} : { XM_OMNIGOLD_MAX_LOTS: String(max) },
                           extra || {}));

console.log('== the cap caps, including the case that was fifty times over ==');
{
  for (const [lots, max, want] of [[0.50, 0.10, 0.10], [5.00, 0.10, 0.10], [100, 0.10, 0.10],
                                   [0.05, 0.02, 0.02], [1, 0.25, 0.25]]){
    const cfg = cfgOf(lots, max);
    ok(cfg.lots === want,
       `LOTS ${lots} against MAX ${max} must size at ${want} — it sizes at ${cfg.lots}`);
    ok(cfg.maxLots === max,
       `and the cap is still the ${max} that was configured — it does not rewrite itself to the request`);
  }
}

console.log('\n== and nothing changes for a configuration that was already sane ==');
{
  const d = cfgOf(null, null);
  ok(d.lots === 0.01 && d.maxLots === 0.10, `unset reads 0.01 lots with a 0.10 cap, the documented defaults`);
  for (const [lots, max] of [[0.01, 0.10], [0.02, 0.10], [0.10, 0.10], [0.03, 0.50]]){
    const cfg = cfgOf(lots, max);
    ok(cfg.lots === lots && cfg.maxLots === max,
       `LOTS ${lots} under MAX ${max} is untouched — ${cfg.lots} / ${cfg.maxLots}`);
  }
  ok(cfgOf(0.001, 0.10).lots === 0.01, 'a sub-minimum size still floors at 0.01 rather than refusing');
  ok(cfgOf('nonsense', 'rubbish').lots === 0.01 && cfgOf('nonsense', 'rubbish').maxLots === 0.10,
     'and unreadable values fall back to the defaults, not to zero or NaN');
}

console.log('\n== a volume the payload asks for is clipped to that same cap ==');
{
  const cfg = cfgOf(0.01, 0.10);
  const ticket = volume => ({
    ticket: true, grade: { ticket: true, vetoes: [] }, dir: 'long', symbol: 'XAUUSD',
    livePx: 4050, plan: { entry: 4050, stop: 4025, t1: 4100, t2: 4136 },
    horizon: 'SCALP', kind: 'TEST', volume: volume
  });
  for (const [v, want] of [[0.01, 0.01], [0.10, 0.10], [0.50, 0.10], [5, 0.10], [100, 0.10], ['0.30', 0.10]]){
    const built = ogXmBuildOrder(ticket(v), cfg);
    ok(built.ok && built.order.volume === want,
       `a payload asking for ${v} builds an order of ${built.ok ? built.order.volume : built.reason}`);
  }
  ok(ogXmBuildOrder(ticket(undefined), cfg).order.volume === 0.01,
     'and no volume at all falls back to the configured size');
  ok(ogXmBuildOrder(ticket(null), cfg).order.volume === 0.01, 'as does a null one');
  const neg = ogXmBuildOrder(ticket(-1), cfg);
  ok(!neg.ok && /below 0\.01/.test(neg.reason), `a negative volume is refused (${neg.reason})`);

  /* The bug's real shape: with the cap raised, this clip was a no-op. */
  const broken = cfgOf(5, 0.10);
  ok(ogXmClipLots(100, broken.maxLots) === 0.10,
     'and with the cap held at 0.10 even a 100-lot request clips to 0.10 — which is what the raised cap defeated');
}

console.log('\n== the refusals that keep this path narrow still refuse ==');
{
  const cfg = cfgOf(0.01, 0.10);
  const base = { dir: 'long', symbol: 'XAUUSD', livePx: 4050, horizon: 'SCALP', kind: 'T',
                 plan: { entry: 4050, stop: 4025, t1: 4100, t2: 4136 } };
  const cases = [
    ['a WATCH row', Object.assign({}, base, { ticket: false, grade: { ticket: false, vetoes: [] } })],
    ['a vetoed ticket', Object.assign({}, base, { ticket: true, grade: { ticket: true, vetoes: ['weekend'] } })],
    ['a long whose stop is above entry', Object.assign({}, base, { ticket: true, grade: { ticket: true, vetoes: [] },
       plan: { entry: 4050, stop: 4075, t1: 4100 } })],
    ['a long whose target is below entry', Object.assign({}, base, { ticket: true, grade: { ticket: true, vetoes: [] },
       plan: { entry: 4050, stop: 4025, t1: 4010 } })],
    ['a zero entry', Object.assign({}, base, { ticket: true, grade: { ticket: true, vetoes: [] },
       plan: { entry: 0, stop: 4025, t1: 4100 } })],
    ['no direction', Object.assign({}, base, { ticket: true, grade: { ticket: true, vetoes: [] }, dir: '' })]
  ];
  for (const [label, cand] of cases){
    const built = ogXmBuildOrder(cand, cfg);
    ok(!built.ok, `${label} is refused (${built.reason})`);
  }
  const crypto = ogXmBuildOrder(Object.assign({}, base, { ticket: true, grade: { ticket: true, vetoes: [] },
                                                          symbol: 'BTCUSDT' }), cfg);
  ok(!crypto.ok && /gold/i.test(crypto.reason), `a crypto symbol is refused (${crypto.reason})`);
  /* and the control: the same shape WITH a clean ticket does build, so the
     refusals above are not passing because everything is refused */
  const good = ogXmBuildOrder(Object.assign({}, base, { ticket: true, grade: { ticket: true, vetoes: [] } }), cfg);
  ok(good.ok && good.order.volume === 0.01, 'while a clean gold ticket builds an order at the configured size');
}

console.log('\n== and the status line now reports the ceiling that was set ==');
{
  const st = ogXmBotStatus({ XM_MT5_URL: 'https://bridge.example',
                             XM_OMNIGOLD_LOTS: '5.00', XM_OMNIGOLD_MAX_LOTS: '0.10' });
  ok(st.maxLots === 0.10, `the reported cap is the configured 0.10, not the 5 that was asked for`);
  ok(st.lots === 0.10, `and the reported size is ${st.lots}, clipped to it`);
  ok(st.dryRun === true && st.live === false,
     'with the bot still in DRY RUN by default — nothing here arms the live path');
  const halted = ogXmBotStatus({ XM_MT5_URL: 'https://bridge.example', HARDGATE_KILL_SWITCH: '1' });
  ok(halted.halted === true, 'and the kill switch still halts it');
}

console.log('\n' + passed + ' passed, 0 failed');
