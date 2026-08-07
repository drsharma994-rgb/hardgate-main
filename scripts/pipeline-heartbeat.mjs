/* HARDGATE — pipeline heartbeat.
   =============================================================================
   THE HOLE THIS PLUGS. alert-notify.yml line 32:
       if: ${{ github.event_name != 'schedule' || vars.RENDER_DISPATCH_PRIMARY != 'true' }}
   When the repo variable RENDER_DISPATCH_PRIMARY is 'true', EVERY scheduled run
   is skipped and the only clock is scripts/gh-dispatch.mjs on Render, every 13
   minutes. Render free instances spin down when idle. If Render sleeps, no
   dispatch fires, the schedule is already disabled, and the pipeline has NO
   CLOCK AT ALL — silently, indefinitely, with nothing in the repo changing to
   show it.
   Fix pack 23 added a degraded-run watchdog, and it cannot catch this: it only
   runs when a run runs. A pipeline with no clock never reaches it. A watchdog
   that lives inside the thing it watches is not a watchdog.
   So this is deliberately separate and deliberately dumb: its own workflow, its
   own hourly cron with NO dispatch-primary guard, no Puppeteer, no browser, no
   commit. It reads alert-state.json, takes the freshest timestamp in it, and
   pushes if that is older than the threshold.
   Exit 0 always. A heartbeat that fails the build on a network blip trains you
   to ignore red, which is how you end up not noticing the real outage.
   ============================================================================= */
import fs from 'node:fs';
const STALE_HOURS = Number(process.env.HEARTBEAT_STALE_HOURS || 2);
const STATE = 'alert-state.json';
/* Every ISO timestamp anywhere in the state, at any depth. The freshest one is
   the last time ANY leg of the pipeline did work. Walking the whole object
   rather than naming fields means a new leg is covered automatically. */
function newestStamp(obj, best = 0) {
  if (obj === null || obj === undefined) return best;
  if (typeof obj === 'string') {
    if (!/^\d{4}-\d{2}-\d{2}T/.test(obj)) return best;
    const t = Date.parse(obj);
    return Number.isFinite(t) && t > best ? t : best;
  }
  if (typeof obj !== 'object') return best;
  for (const v of Object.values(obj)) best = newestStamp(v, best);
  return best;
}
/* Mirrors sendTelegramCi in alert-check.mjs rather than importing it: that file
   is a long top-level script with side effects, and a watchdog must not be able
   to fail because the thing it watches failed to load. Deliberate duplication,
   ~10 lines, and it is the reason this can still shout when everything else is
   down. Missing secrets print instead of throwing, so the run stays green. */
async function push(subject, body) {
  const t = process.env.TELEGRAM_TOKEN;
  const c = process.env.TELEGRAM_CHAT_ID;
  const text = subject + '\n\n' + body;
  if (!t || !c) {
    console.log('[heartbeat] no TELEGRAM_TOKEN/TELEGRAM_CHAT_ID — printing instead');
    console.log(text);
    return 'printed';
  }
  try {
    const res = await fetch('https://api.telegram.org/bot' + t + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: c, text: text, disable_web_page_preview: true })
    });
    const okRes = res && (res.ok === true || (res.status >= 200 && res.status < 300));
    console.log('[heartbeat] telegram: ' + (okRes ? 'sent' : 'failed HTTP ' + (res && res.status)));
    return okRes ? 'sent' : 'failed';
  } catch (e) {
    console.log('[heartbeat] telegram failed: ' + ((e && e.message) ? e.message : String(e)));
    return 'failed';
  }
}
async function main() {
  let raw;
  try { raw = fs.readFileSync(STATE, 'utf8'); }
  catch (e) { console.log('[heartbeat] ' + STATE + ' unreadable — nothing to check'); return; }
  let state;
  try { state = JSON.parse(raw); }
  catch (e) { console.log('[heartbeat] ' + STATE + ' is not valid JSON — leaving it alone'); return; }
  const newest = newestStamp(state);
  if (!newest) { console.log('[heartbeat] no timestamp in state yet — nothing to compare'); return; }
  const ageH = (Date.now() - newest) / 3600000;
  console.log('[heartbeat] freshest state stamp is ' + ageH.toFixed(1) + 'h old (threshold ' + STALE_HOURS + 'h)');
  if (ageH <= STALE_HOURS) { console.log('[heartbeat] pipeline is alive'); return; }
  const primary = String(process.env.RENDER_DISPATCH_PRIMARY || '').toLowerCase() === 'true';
  const cause = primary
    ? 'RENDER_DISPATCH_PRIMARY is true, so alert-notify SKIPS its own schedule and relies on Render '
      + 'dispatching every 13 min. A sleeping Render instance leaves the pipeline with no clock at all. '
      + 'Either wake Render, or set RENDER_DISPATCH_PRIMARY=false to hand the schedule back to GitHub.'
    : 'alert-notify should be running on its own 15-min schedule. Check whether GitHub auto-disabled the '
      + 'workflow (it does that after 60 days of repo inactivity) or whether recent runs are failing.';
  await push('🚨 HARDGATE pipeline has no pulse',
    'No leg of the alert pipeline has written state for ' + ageH.toFixed(1) + ' hours.\n\n'
    + cause + '\n\n'
    + 'While this is true, an empty setups list means UNKNOWN, not none — nothing is being measured.');
}
main().catch(e => { console.log('[heartbeat] failed: ' + (e && e.message)); });
