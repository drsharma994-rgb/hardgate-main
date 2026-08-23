/* HARDGATE — the ?diag=1 cold-load probe.

   WHY IT EXISTS.
   A warm desk is clean: a full hardRefreshAll on production produced three
   errors, all /api/xm/candles 503 from an unconfigured broker. A COLD load is
   not — it shows a run of 429s and 400s in its first seconds, and those could
   not be attributed by any means available after the fact:

     - a fetch wrapper installed from the console arrives long after the app
       has already made the calls;
     - performance.getEntriesByType('resource') caps at 250 entries and then
       SILENTLY stops recording — it dropped 1,707 of 1,957 requests when this
       was first investigated, and a truncated sample was very nearly reported
       as a clean one;
     - the devtools capture window had already scrolled past them.

   Only something running before the first fetching script can see a cold
   load. Hence a block that is literally first in the document.

   WHAT THIS FILE PINS.
   The probe is a diagnostic on a live trading desk, so the properties that
   matter are not "does it collect data" but "is it free when off" and "does
   it change nothing when on". Both are asserted here, along with the
   ordering that makes it work at all.

   Run: node tests/test-cold-load-diag.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const html = fs.readFileSync(root + 'index.html', 'utf8');

let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

/* ---------- 1) it must be FIRST, or it sees nothing ---------- */
{
  const diagAt = html.indexOf('?diag=1');
  assert(diagAt > 0, 'the ?diag=1 block exists in index.html');

  /* Compare against the block's OWN opening tag, not the flag string inside
     its comment — the first cut compared against the latter and "failed"
     because the block's own <script> preceded it. */
  const blockStart = html.lastIndexOf('<script', diagAt);
  const firstScript = html.indexOf('<script');
  assert(blockStart === firstScript,
    'it IS the first script in the document — a probe that loads second misses '
      + 'precisely the requests it was written to catch');
  const blockEnd = html.indexOf('</script>', diagAt);
  assert(html.slice(blockEnd).indexOf('<script') > 0, 'and the app scripts follow it');

  /* THE FLAG TEST MUST CONTAIN NO CONTROL CHARACTERS. A \b written through a
     shell heredoc once collapsed into a literal backspace (0x08), leaving
     /[?&]diag=1/ — a regex that can never match, so the probe would have
     shipped permanently dead while looking correct in a diff. */
  const block = html.slice(blockStart, blockEnd);
  const ctrl = [...block].filter(function(c){ const n = c.charCodeAt(0); return n < 9 || (n > 13 && n < 32); });
  assert(ctrl.length === 0,
    'the probe source carries no stray control characters (found ' + ctrl.length + ')');
}

/* ---------- 2) extract the block and run it ---------- */
const m = html.match(/<script>\s*\n\/\* \?diag=1[\s\S]*?<\/script>/);
assert(!!m, 'the probe block is extractable for testing');
const SRC = m[0].replace(/^<script>/, '').replace(/<\/script>$/, '');

function run(search, fetchImpl){
  const calls = [];
  const ctx = { console, Date, Math, JSON, Object, String, RegExp };
  ctx.location = { search: search };
  ctx.fetch = fetchImpl || function(u){ calls.push(String(u)); return Promise.resolve({ status: 200 }); };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 'diag.js' });
  return { ctx, calls };
}

/* ---------- 3) OFF by default, and genuinely free ---------- */
{
  const { ctx } = run('');
  const before = ctx.fetch;
  assert(typeof ctx.hgDiagReport === 'undefined',
    'without ?diag=1 no reporter is defined');
  assert(ctx.fetch === before,
    'and window.fetch is left completely untouched — no wrapper on the hot path');

  const { ctx: c2 } = run('?foo=1&bar=2');
  assert(typeof c2.hgDiagReport === 'undefined', 'unrelated query params do not enable it');

  /* guard against a sloppy substring match enabling it by accident */
  const { ctx: c3 } = run('?nodiag=1');
  assert(typeof c3.hgDiagReport === 'undefined',
    '"nodiag=1" does not enable it — the flag is matched on a boundary');
}

/* ---------- 4) ON: records failures, ignores successes ---------- */
{
  const seen = [];
  const { ctx } = run('?diag=1', function(u){
    seen.push(String(u));
    const t = String(u);
    if (t.indexOf('/bad') >= 0) return Promise.resolve({ status: 429 });
    if (t.indexOf('/gone') >= 0) return Promise.resolve({ status: 400 });
    return Promise.resolve({ status: 200 });
  });
  assert(typeof ctx.hgDiagReport === 'function', 'with ?diag=1 the reporter is defined');

  await Promise.all([
    ctx.fetch('https://x.test/ok'),
    ctx.fetch('https://x.test/bad'),
    ctx.fetch('https://x.test/bad'),
    ctx.fetch('https://x.test/gone')
  ]);
  const rep = ctx.hgDiagReport();
  assert(rep.failures === 3, 'only non-2xx responses are recorded (got ' + rep.failures + ')');
  assert(seen.length === 4, 'and every request still reached the real fetch (got ' + seen.length + ')');
  assert(rep.byEndpoint.some(function(l){ return /2 x 429/.test(l); }),
    'repeated failures are grouped with a count: ' + rep.byEndpoint.join(' | '));
  assert(rep.byEndpoint.some(function(l){ return /1 x 400/.test(l); }),
    'and distinct statuses stay distinct');
}

/* ---------- 5) it must not CHANGE anything, only observe ---------- */
{
  const { ctx } = run('?diag=1', function(){ return Promise.reject(new Error('network down')); });
  let caught = null;
  try{ await ctx.fetch('https://x.test/boom'); }catch(e){ caught = e; }
  assert(caught instanceof Error && caught.message === 'network down',
    'a rejected fetch is re-thrown unchanged — the caller sees exactly what it would have');
  const rep = ctx.hgDiagReport();
  assert(rep.failures === 1 && /THREW:network down/.test(rep.byEndpoint.join(' ')),
    'and the throw is recorded rather than swallowed: ' + rep.byEndpoint.join(' | '));

  /* a successful response object must pass through by identity, not a copy */
  const marker = { status: 200, marker: Symbol('body') };
  const { ctx: c2 } = run('?diag=1', function(){ return Promise.resolve(marker); });
  const got = await c2.fetch('https://x.test/ok');
  assert(got === marker, 'a 2xx response is passed through by identity, never wrapped or cloned');
}

/* ---------- 6) the buffer cannot grow without bound ---------- */
{
  const { ctx } = run('?diag=1', function(){ return Promise.resolve({ status: 500 }); });
  const CAP = 4000;
  const batch = [];
  for (let i = 0; i < CAP + 25; i++) batch.push(ctx.fetch('https://x.test/f' + i));
  await Promise.all(batch);
  const rep = ctx.hgDiagReport();
  assert(rep.failures === CAP,
    'the buffer stops at its cap on a long session (got ' + rep.failures + ')');
  assert(rep.droppedOverCap === 25,
    'and says honestly how many it dropped rather than pretending it saw everything (got '
      + rep.droppedOverCap + ')');
}

console.log(String.fromCharCode(10) + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
console.log('ALL COLD-LOAD DIAG TESTS PASSED');
