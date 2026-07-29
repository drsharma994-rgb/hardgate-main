/* HARDGATE — GitHub workflow dispatcher (server-side, v51).
   GitHub's scheduled cron (every 15 min) drifts badly on free runners — observed
   multi-hour gaps — which delays the alert pipeline (confirmed setups sweep,
   blackout pings, digest). This module fires workflow_dispatch for
   alert-notify.yml every 13 min from the Render service, which is already
   kept awake by the keep-alive self-ping. GitHub remains the runner; this
   only replaces the unreliable clock.

   Env:
     GH_DISPATCH_TOKEN — fine-grained PAT, repo-scoped, Actions: write
     GH_REPO           — optional override, default drsharma994-rgb/hardgate-main
     GH_WORKFLOW       — optional override, default alert-notify.yml

   Honest no-op without the token. A 422/403/404 logs and retries next tick
   (no tight loop). Rate math: 13 min ≈ 110 dispatches/day, far under the
   1000/hr API budget. */

const INTERVAL_MS = 13 * 60 * 1000;

let __timer = null, __armed = false, __last = null;   /* {at, result} counts only, no secrets */

function repo(){ return process.env.GH_REPO || 'drsharma994-rgb/hardgate-main'; }
function workflow(){ return process.env.GH_WORKFLOW || 'alert-notify.yml'; }

async function dispatch(){
  const token = process.env.GH_DISPATCH_TOKEN;
  if (!token) return 'not-configured';
  try{
    const r = await fetch('https://api.github.com/repos/' + repo()
      + '/actions/workflows/' + encodeURIComponent(workflow()) + '/dispatches', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'hardgate-gh-dispatch/1.0',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ref: 'main' })
    });
    if (r.status === 204) return true;
    return 'HTTP ' + r.status;
  }catch(e){ return String((e && e.message) || e).slice(0, 120); }
}

async function tick(){
  const r = await dispatch();
  __last = { at: new Date().toISOString(), result: r === true ? 'dispatched' : String(r) };
  if (r !== true) console.warn('[gh-dispatch] dispatch failed (next in 13 min): ' + __last.result);
  else console.log('[gh-dispatch] alert-notify dispatched');
}

/* started by scripts/server.mjs when GH_DISPATCH_TOKEN is set; honest no-op
   otherwise. First dispatch 90s after boot (let the service settle). */
function startGhDispatch(){
  if (__timer) return 'already running';
  if (!process.env.GH_DISPATCH_TOKEN){
    console.log('[gh-dispatch] disabled — GH_DISPATCH_TOKEN not set (GitHub cron remains the only clock)');
    return 'disabled: no token';
  }
  setTimeout(() => { tick(); }, 90000).unref?.();
  __timer = setInterval(() => { tick(); }, INTERVAL_MS);
  try{ __timer.unref(); }catch(e){}
  __armed = true;
  console.log('[gh-dispatch] armed — workflow_dispatch every 13 min → ' + repo() + '/' + workflow());
  return 'armed';
}

/* status for GET /api/gh-dispatch — armed flag + last dispatch result only.
   Never exposes the token. */
function ghDispatchStatus(){
  return { armed: __armed, intervalMin: INTERVAL_MS / 60000,
           tokenConfigured: !!process.env.GH_DISPATCH_TOKEN,
           repo: repo(), workflow: workflow(), lastDispatch: __last };
}

export { startGhDispatch, ghDispatchStatus, dispatch, INTERVAL_MS };
