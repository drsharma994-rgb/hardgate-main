/* HARDGATE — with no live gold price the XM bot places no order.

   xmOrderType decides what kind of order to send from where the setup's entry
   sits against the live price: a buy below market rests as a BUY_LIMIT, a buy
   above it as a BUY_STOP, and an entry within 0.03% of market goes as a
   market order. That is right, and the four resting cases are pinned below.

   Its fallback was not. Given no usable live price it returned a LIMIT for
   either direction:

     return long ? { id: 2, name: 'BUY_LIMIT' } : { id: 3, name: 'SELL_LIMIT' };

   which reads conservative and is the opposite. A BUY LIMIT placed ABOVE the
   market, or a SELL LIMIT BELOW it, is not a resting order — the broker fills
   it immediately. The fill price is no worse than the limit (a buy limit fills
   at or below, a sell limit at or above), so the money is not the problem. The
   problem is that a setup meant to WAIT for its entry becomes a position now,
   and the bot's own backtest replays this path as a pending fill at the setup
   entry. An instant fill is not the behaviour that was measured.

   cand.livePx comes from the client's last scan and can be absent: the slim
   payload falls back to hgOgXmLivePx(), which returns undefined when no price
   is available — feeds down, exactly when the desk knows least.

   So the order is refused instead. The rule this desk applies to every other
   claim is that an unmeasured thing is not asserted; not knowing where gold is
   trading is the one condition under which the live path should not guess.

   A LIMIT THAT REMAINS, named rather than assumed away: the payload carries a
   price but no timestamp, so nothing here can tell a price from this second
   from one from the last scan ten minutes ago. Checking that needs the client
   to stamp the payload and a threshold nobody has chosen yet. This file pins
   that the price must EXIST, not that it is fresh.

   Run: node tests/test-omnigold-xm-order-type.mjs */
import { xmOrderType } from '../lib/xm-order-type.mjs';
import { ogXmBotCfg, ogXmBuildOrder } from '../lib/omnigold-xm-bot.mjs';

let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const CFG = ogXmBotCfg({ XM_MT5_URL: 'https://bridge.example', XM_OMNIGOLD_LOTS: '0.01', XM_OMNIGOLD_MAX_LOTS: '0.10' });
const ticket = (dir, entry, livePx) => ({
  ticket: true, grade: { ticket: true, vetoes: [] }, dir: dir, symbol: 'XAUUSD', livePx: livePx,
  plan: dir === 'long' ? { entry: entry, stop: entry - 25, t1: entry + 50, t2: entry + 87 }
                       : { entry: entry, stop: entry + 25, t1: entry - 50, t2: entry - 87 },
  horizon: 'SCALP', kind: 'T'
});

console.log('== the four resting cases, and the ids MT5 expects ==');
{
  const cases = [
    ['long',  4020, 4050, 'BUY_LIMIT',  2, 'a buy below market rests'],
    ['long',  4080, 4050, 'BUY_STOP',   4, 'a buy above market waits for the break'],
    ['short', 4080, 4050, 'SELL_LIMIT', 3, 'a sell above market rests'],
    ['short', 4020, 4050, 'SELL_STOP',  5, 'a sell below market waits for the break']
  ];
  for (const [dir, entry, live, name, id, why] of cases){
    const t = xmOrderType(dir, entry, live);
    ok(t.name === name && t.id === id, `${dir} entry ${entry} against ${live} is ${t.name} (id ${t.id}) — ${why}`);
  }
  /* ENUM_ORDER_TYPE is 0 BUY, 1 SELL, 2 BUY_LIMIT, 3 SELL_LIMIT, 4 BUY_STOP,
     5 SELL_STOP. A transposed id is a different order, silently. */
  const ids = { BUY: 0, SELL: 1, BUY_LIMIT: 2, SELL_LIMIT: 3, BUY_STOP: 4, SELL_STOP: 5 };
  const seen = {};
  for (const [dir, entry, live] of [['long', 4020, 4050], ['long', 4080, 4050], ['short', 4080, 4050],
                                    ['short', 4020, 4050], ['long', 4050, 4050], ['short', 4050, 4050]]){
    const t = xmOrderType(dir, entry, live);
    seen[t.name] = t.id;
  }
  ok(Object.keys(seen).length === 6, `all six order types are reachable (${Object.keys(seen).sort().join(', ')})`);
  ok(Object.keys(seen).every(k => seen[k] === ids[k]),
     'and each carries the ENUM_ORDER_TYPE id MT5 expects, so none is silently a different order');
}

console.log('\n== an entry at the market goes as a market order ==');
{
  ok(xmOrderType('long', 4050, 4050).name === 'BUY', 'entry exactly at market is a market BUY');
  ok(xmOrderType('short', 4050, 4050).name === 'SELL', 'and a market SELL the other way');
  /* the 0.03% band */
  const live = 4050, inside = live * (1 + 0.0002), outside = live * (1 + 0.0006);
  ok(xmOrderType('long', inside, live).name === 'BUY',
     `${inside.toFixed(2)} is inside the 0.03% band and still goes at market`);
  ok(xmOrderType('long', outside, live).name === 'BUY_STOP',
     `${outside.toFixed(2)} is outside it and rests as a stop`);
}

console.log('\n== with no live price the order is refused, not guessed ==');
{
  for (const bad of [undefined, null, 0, -5, NaN, 'abc', '']){
    const built = ogXmBuildOrder(ticket('long', 4020, bad), CFG);
    ok(!built.ok, `livePx ${JSON.stringify(bad)} is refused`);
    ok(/no live gold price/.test(built.reason || ''), `and says why (${(built.reason || '').slice(0, 42)}…)`);
  }
  const short = ogXmBuildOrder(ticket('short', 4080, undefined), CFG);
  ok(!short.ok && /no live gold price/.test(short.reason), 'a short with no live price is refused the same way');
}

console.log('\n== and a real price still builds, on both sides ==');
{
  for (const [dir, entry, live, want] of [['long', 4020, 4050, 'BUY_LIMIT'], ['long', 4080, 4050, 'BUY_STOP'],
                                          ['short', 4080, 4050, 'SELL_LIMIT'], ['short', 4020, 4050, 'SELL_STOP'],
                                          ['long', 4050, 4050, 'BUY']]){
    const built = ogXmBuildOrder(ticket(dir, entry, live), CFG);
    ok(built.ok && built.order.type === want,
       `${dir} ${entry} against ${live} builds a ${built.ok ? built.order.type : built.reason}`);
  }
  ok(ogXmBuildOrder(ticket('long', 4020, '4050'), CFG).ok,
     'and a numerically-stringed price still builds — feeds deliver those');
}

console.log('\n== what the old fallback would have done, so the refusal is justified here ==');
{
  /* xmOrderType still has the fallback — the backtest calls it with a bar
     close, which is always finite. What the live path no longer does is reach
     it. This records what reaching it meant. */
  const noPrice = xmOrderType('long', 4080, undefined);
  ok(noPrice.name === 'BUY_LIMIT', 'with no price the helper still answers BUY_LIMIT for a long');
  ok(xmOrderType('short', 4020, undefined).name === 'SELL_LIMIT', 'and SELL_LIMIT for a short');
  /* and with a price, those same two setups are the OTHER kind of order */
  ok(xmOrderType('long', 4080, 4050).name === 'BUY_STOP',
     'yet that long, priced against a market below it, is a BUY_STOP — the fallback had it on the wrong side');
  ok(xmOrderType('short', 4020, 4050).name === 'SELL_STOP',
     'and that short a SELL_STOP — a wrong-side limit is an immediate fill, not a resting order');
}

console.log('\n== the refusal does not loosen anything else ==');
{
  const good = ogXmBuildOrder(ticket('long', 4020, 4050), CFG);
  ok(good.ok && good.order.volume === 0.01 && good.order.sl === 3995 && good.order.tp === 4070,
     'a clean ticket still builds with its stop as sl and its first target as tp');
  const watch = ogXmBuildOrder(Object.assign(ticket('long', 4020, 4050), { ticket: false, grade: { ticket: false, vetoes: [] } }), CFG);
  ok(!watch.ok, 'a WATCH row is still refused');
  const crypto = ogXmBuildOrder(Object.assign(ticket('long', 4020, 4050), { symbol: 'BTCUSDT' }), CFG);
  ok(!crypto.ok && /gold/i.test(crypto.reason), 'and a crypto symbol is still refused');
}

console.log('\n' + passed + ' passed, 0 failed');
