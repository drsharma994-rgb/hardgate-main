/* HARDGATE — a DRY RUN preview no longer eats the live order that follows it.

   OMNIGOLD's XM bot keeps a 24-hour idempotency map so one ticket cannot be
   filled twice. It recorded the key like this:

     if (placed.ok){ __idemp.set(key, { hash, response: out, at: Date.now() }); }

   placed.ok is true for a DRY RUN as well. A dry run posts nothing and still
   comes back ok, so previewing a ticket wrote its key into the map — and the
   LIVE send of that same ticket, any time in the next 24 hours, replayed the
   cached dry-run response instead of placing the order:

     preview (DRY RUN)      -> ok true, posted false, 0 calls to the bridge
     arm live, send it      -> ok true, posted FALSE, 0 calls to the bridge

   No order. No error. DRY RUN is the DEFAULT, so preview-then-arm-then-send —
   the obvious way anyone would use this — was the broken path, and it stayed
   broken for a day per ticket. The status line would read "DRY RUN ok —
   previewed, not sent" while the desk was in live mode, which is a clue and
   not an error message.

   A dry run has nothing to deduplicate against, because nothing went out.
   Only a POSTED order claims the key now.

   WHY THE EXISTING TEST DID NOT CATCH IT, which is the point worth keeping.
   test-omnigold-xm-bot does cover idempotency — "live send POSTs once and is
   idempotent", and the key-reused-with-a-different-payload conflict. But it
   calls ogXmIdempotencyClear() at the top of every scenario, and never runs a
   dry run and a live send against the same map. The bug lives entirely in the
   TRANSITION between the two modes, and a test that resets state between
   modes cannot see it. Every sequence below deliberately does not reset.

   A LIMIT THAT REMAINS, stated rather than papered over: the key is claimed on
   ok, so a live send whose response is lost AFTER the broker accepted the
   order does not claim it, and a retry would place a second order. That was
   true before this change and is true after it. At-least-once is the choice
   this path makes.

   Run: node tests/test-omnigold-xm-idempotency.mjs */
import { ogXmExecuteTicket, ogXmIdempotencyKey, ogXmIdempotencyClear } from '../lib/omnigold-xm-bot.mjs';

let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const TICKET = over => Object.assign({
  ticket: true, grade: { ticket: true, vetoes: [] }, dir: 'long', symbol: 'XAUUSD', livePx: 4050,
  plan: { entry: 4050, stop: 4025, t1: 4100, t2: 4136 }, horizon: 'SCALP', kind: 'ROUND-MAGNET'
}, over || {});
const ENV_DRY  = { XM_MT5_URL: 'https://bridge.example', XM_MT5_TOKEN: 'tok' };
const ENV_LIVE = Object.assign({}, ENV_DRY, { XM_OMNIGOLD_LIVE: '1' });

let calls = 0;
const bridgeOk  = async () => { calls++; return { ok: true,  status: 200, json: async () => ({ ok: true, ticket: 1 }), text: async () => '{}' }; };
const bridgeBad = async () => { calls++; return { ok: false, status: 500, json: async () => ({ ok: false, error: 'boom' }), text: async () => 'boom' }; };
const send = (env, impl) => ogXmExecuteTicket(TICKET(), { env, fetchImpl: impl || bridgeOk });

console.log('== a preview costs nothing and claims nothing ==');
{
  ogXmIdempotencyClear(); calls = 0;
  const a = await send(ENV_DRY);
  ok(a.ok === true && a.dryRun === true && a.posted === false, 'a DRY RUN preview reports ok, dryRun, not posted');
  ok(calls === 0, `and makes ${calls} calls to the bridge`);
  const b = await send(ENV_DRY);
  ok(b.ok === true && calls === 0, 'a second preview of the same ticket still reaches the bridge zero times');
}

console.log('\n== and the live send that follows it actually goes ==');
{
  /* NO reset here. The two previews above are still in the map — that is the
     whole test. */
  const live = await send(ENV_LIVE);
  ok(live.dryRun === false, 'the live send is not reported as a dry run');
  ok(live.posted === true, 'it posted');
  ok(calls > 0, `and it reached the bridge (${calls} call${calls === 1 ? '' : 's'}) — under the bug this was still zero`);
}

console.log('\n== while a real duplicate is still suppressed ==');
{
  const before = calls;
  const again = await send(ENV_LIVE);
  ok(calls === before, `a second live send of the same ticket adds no bridge calls (still ${calls})`);
  ok(again.posted === true, 'and replays the original posted response rather than reporting a failure');
  const third = await send(ENV_LIVE);
  ok(calls === before, 'a third send likewise');
}

console.log('\n== a live send that fails does not claim the key ==');
{
  ogXmIdempotencyClear(); calls = 0;
  const bad = await ogXmExecuteTicket(TICKET(), { env: ENV_LIVE, fetchImpl: bridgeBad });
  ok(bad.ok === false, `the failed send reports not ok (${bad.reason || 'no reason'})`);
  const after = calls;
  const retry = await send(ENV_LIVE);
  ok(calls > after, `and the retry reaches the bridge — a failure must not lock the ticket out for a day`);
  ok(retry.ok === true && retry.posted === true, 'and it posts');
}

console.log('\n== the key is the setup, not the paperwork ==');
{
  const base = ogXmIdempotencyKey(TICKET());
  ok(base === ogXmIdempotencyKey(TICKET({ plan: { entry: 4050, stop: 4025, t1: 4199, t2: 4444 } })),
     'the same entry and stop is the same setup, whatever the target — one key');
  ok(base !== ogXmIdempotencyKey(TICKET({ dir: 'short' })), 'the other direction is a different key');
  ok(base !== ogXmIdempotencyKey(TICKET({ kind: 'ORB' })), 'another mechanic is a different key');
  ok(base !== ogXmIdempotencyKey(TICKET({ horizon: 'SWING' })), 'the other horizon is a different key');
  ok(base !== ogXmIdempotencyKey(TICKET({ plan: { entry: 4051, stop: 4025, t1: 4100 } })),
     'and a different entry is a different key');
}

console.log('\n== changing the order under a claimed key is refused, not filled ==');
{
  ogXmIdempotencyClear(); calls = 0;
  await send(ENV_LIVE);
  const before = calls;
  /* same key (entry, stop, dir, kind, horizon) but a different payload */
  const conflict = await ogXmExecuteTicket(
    TICKET({ plan: { entry: 4050, stop: 4025, t1: 4199, t2: 4444 } }), { env: ENV_LIVE, fetchImpl: bridgeOk });
  ok(conflict.ok === false && /idempotency/i.test(conflict.reason || ''),
     `a same-key order with different levels is refused (${conflict.reason})`);
  ok(calls === before, 'and never reaches the bridge');
}

console.log('\n== a preview answers for itself, even after the order went live ==');
{
  /* The map is not consulted by a dry run at all. Reading it was its own
     small dishonesty: a preview of a ticket already sent live used to replay
     the LIVE receipt, so the desk asked "what would this do" and was told
     "posted to XM" about an order placed earlier. */
  const before = calls;
  const p = await send(ENV_DRY);
  ok(calls === before, 'a preview of a ticket already sent live still costs no bridge call');
  ok(p.dryRun === true, 'and reports itself as a DRY RUN, not as the live order that came before it');
  ok(p.posted === false, 'with posted false, because this preview posted nothing');
}

console.log('\n' + passed + ' passed, 0 failed');
