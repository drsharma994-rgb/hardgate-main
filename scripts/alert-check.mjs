import fs from 'fs';
import { pathToFileURL } from 'url';

const SITE_URL = process.env.HARDGATE_URL || 'https://hardgate-main.vercel.app/';
const STATE_FILE = 'alert-state.json';
/* GitHub auto-disables scheduled workflows after 60 days of repository
   inactivity. The heartbeat below stamps lastRunAt into alert-state.json at
   most once per 24h, so the workflow's commit step produces ~1 keep-alive
   commit/day instead of one every 15 minutes. */
const HEARTBEAT_MS = 24 * 60 * 60 * 1000;

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (e) {
    return { delta: null, coindcx: null, gold: null };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

/* true when the committed state's lastRunAt is missing/unparseable or older
   than 24h -> time for a fresh keep-alive stamp. */
function needsHeartbeat(state, now) {
  const ts = Date.parse((state && state.lastRunAt) || '');
  return !Number.isFinite(ts) || (now - ts) > HEARTBEAT_MS;
}

/* Email gate on window.__hgLastEmail ({ok, err, ts} — set by the page's email
   senders after every send attempt). Missing/malformed -> warn only (no send
   was attempted this cycle, or the page isn't instrumented yet); ok:false ->
   hard fail so the GitHub run goes red. */
function emailVerdict(email) {
  if (!email || typeof email.ok !== 'boolean') return { fail: false, warn: true };
  if (email.ok === false) return { fail: true, err: email.err || 'unknown error' };
  return { fail: false };
}

/* ---------------- entry-ticket watch (server-side) ----------------
   The CI run completes a full brain synthesis in the page and reads
   window.__hgBrainTicketNow() -> {at, long:{sym,entry}|null, short:{...}|null}.
   Only sym/entry per side is persisted/compared — same key semantics as the
   in-browser hgalert TICKET class: a new symbol, a moved entry, or a side
   appearing/vanishing is a change. First recorded state seeds silently. */
function ticketSide(s) {
  return (s && s.sym != null && Number.isFinite(+s.entry))
    ? { sym: String(s.sym), entry: +s.entry }
    : null;
}
function ticketSnapshot(raw) {
  return { long: ticketSide(raw && raw.long), short: ticketSide(raw && raw.short) };
}
function ticketChanged(prev, next) {
  return JSON.stringify(ticketSnapshot(prev)) !== JSON.stringify(ticketSnapshot(next));
}
function ticketPushBody(next) {
  const t = ticketSnapshot(next);
  const fmt = (s) => (s ? s.sym + ' @ ' + s.entry : '—');
  return 'Long: ' + fmt(t.long) + '\nShort: ' + fmt(t.short);
}
/* ntfy push straight from Node (no page needed). No topic -> honest skip. */
async function sendTicketPush(topic, next) {
  if (!topic) return 'skipped: no NTFY_TOPIC secret configured';
  try {
    const res = await fetch('https://ntfy.sh/' + encodeURIComponent(topic), {
      method: 'POST',
      headers: {
        'Title': 'HARDGATE entry ticket changed',
        'Priority': '4',
        'Tags': 'chart_with_upwards_trend',
        'Click': SITE_URL
      },
      body: ticketPushBody(next)
    });
    return (res && res.status >= 200 && res.status < 300) ? 'sent' : 'failed: HTTP ' + (res && res.status);
  } catch (e) {
    return 'failed: ' + ((e && e.message) ? e.message : String(e));
  }
}

async function main() {
  // dynamic import: keeps this module loadable without puppeteer installed
  // (tests import the pure helpers above); CI installs puppeteer before running.
  const { default: puppeteer } = await import('puppeteer');

  const prevState = loadState();
  console.log('Previous alert state:', JSON.stringify(prevState));

  const browser = await puppeteer.launch({
    headless: true,
    protocolTimeout: 540000,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  page.on('console', (msg) => console.log('[page]', msg.text()));
  page.on('pageerror', (err) => console.error('[page error]', err.message));

  const cacheBuster = Date.now();
  await page.goto(SITE_URL + '?nocache=' + cacheBuster, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await page.waitForSelector('#bestRun', { timeout: 30000 });
  // small settle delay so init scripts (emailjs.init, exchange setup) finish running
  await new Promise((r) => setTimeout(r, 3000));

  const result = await page.evaluate(async (prev) => {
    if (typeof S !== 'undefined' && S.lastAlertKey) {
      S.lastAlertKey.delta = prev.delta;
      S.lastAlertKey.coindcx = prev.coindcx;
      if ('gold' in S.lastAlertKey) S.lastAlertKey.gold = prev.gold ?? null;
    }
    await runAlertCycle();
    // window.__hgLastEmail = {ok, err, ts} from the page's senders — read AFTER
    // the cycle so any send attempt this run is captured. If several sends fire
    // in one cycle this holds the LAST one (contract limitation).
    const email = (typeof window !== 'undefined' && window.__hgLastEmail) ? window.__hgLastEmail : null;
    return {
      state: { delta: S.lastAlertKey.delta, coindcx: S.lastAlertKey.coindcx, gold: S.lastAlertKey.gold ?? null },
      email: email
    };
  }, prevState);

  /* entry-ticket watch: mount the BRAIN pane offscreen, run ONE full
     synthesis (bounded), read the painted ticket snapshot. The page's own
     alert engine stays unarmed in CI (no gesture), so no double-notify:
     the push below is the only ticket channel here. A slow/failed synthesis
     degrades to a logged warn and no state change — never a red run. */
  const ticketResult = await page.evaluate(async () => {
    try {
      const mods = (typeof HG_TAB_MODS !== 'undefined' && HG_TAB_MODS) ? HG_TAB_MODS : {};
      const mod = mods['brain'];
      if (!mod || typeof mod.mount !== 'function') return { ok: false, err: 'brain module not registered' };
      const pane = document.createElement('div');
      pane.style.display = 'none';
      document.body.appendChild(pane);
      mod.mount(pane);
      const runBtn = pane.querySelector('#brainRun');
      if (!runBtn) return { ok: false, err: 'brain pane incomplete: #brainRun' };
      runBtn.click();
      const t0 = Date.now();
      let stat = '';
      while (Date.now() - t0 < 360000) {
        await new Promise((r) => setTimeout(r, 4000));
        stat = (pane.querySelector('#brainStat') || {}).textContent || '';
        if (/^done|failed/i.test(stat)) break;
      }
      const snap = (typeof window.__hgBrainTicketNow === 'function') ? window.__hgBrainTicketNow() : null;
      return { ok: /^done/i.test(stat), stat: String(stat).slice(0, 160), ticket: snap };
    } catch (e) {
      return { ok: false, err: (e && e.message) ? e.message : String(e) };
    }
  });

  await browser.close();

  const newState = result.state;
  console.log('New alert state:', JSON.stringify(newState));
  console.log('Email status (window.__hgLastEmail):', JSON.stringify(result.email));

  const verdict = emailVerdict(result.email);
  if (verdict.fail) {
    // State intentionally NOT saved: the committed alert keys stay as they were,
    // so the same setup re-fires next run and the email is retried.
    console.error('EMAIL DELIVERY FAILED: ' + verdict.err + ' — alert state left uncommitted so the next run retries.');
    process.exit(1);
  }
  if (verdict.warn) {
    console.warn('WARN: window.__hgLastEmail missing or malformed — no email attempted this cycle (or senders not instrumented yet); continuing.');
  }

  // keep-alive heartbeat (see HEARTBEAT_MS note above): stamp at most once/day,
  // otherwise preserve the committed stamp so the file stays byte-stable.
  if (needsHeartbeat(prevState, Date.now())) {
    newState.lastRunAt = new Date().toISOString();
  } else if (prevState.lastRunAt) {
    newState.lastRunAt = prevState.lastRunAt;
  }

  /* entry-ticket diff + server-side ntfy push. Seeds silently on the first
     recorded state; a failed synthesis leaves prevState.ticket untouched so
     a transient CI wobble never reads as 'ticket vanished'. */
  console.log('Ticket synthesis:', ticketResult.ok
    ? 'ok — ' + (ticketResult.stat || '')
    : 'degraded — ' + (ticketResult.err || ticketResult.stat || 'no detail'));
  if (ticketResult.ok && ticketResult.ticket) {
    const nextTicket = ticketSnapshot(ticketResult.ticket);
    console.log('Ticket now:', JSON.stringify(nextTicket), '· previous:', JSON.stringify(prevState.ticket ?? null));
    if (prevState.ticket === undefined) {
      console.log('Ticket state seeded silently (first recorded run) — no push.');
    } else if (ticketChanged(prevState.ticket, nextTicket)) {
      const pushResult = await sendTicketPush(process.env.NTFY_TOPIC || '', nextTicket);
      console.log('TICKET CHANGED — push: ' + pushResult);
    } else {
      console.log('Ticket unchanged — no push.');
    }
    newState.ticket = nextTicket;
  } else if (prevState.ticket !== undefined) {
    newState.ticket = prevState.ticket;
  }

  saveState(newState);

  const alertChanged = ['delta', 'coindcx', 'gold'].some(
    (k) => JSON.stringify(prevState[k]) !== JSON.stringify(newState[k])
  );
  console.log(
    alertChanged
      ? 'State changed for at least one exchange - a new-setup email should have been sent via EmailJS (check inbox / spam).'
      : 'No change since last cycle - no new email expected (either still WAIT, or same setup as last alert).'
  );
  if (newState.lastRunAt && newState.lastRunAt !== prevState.lastRunAt) {
    console.log('Keep-alive heartbeat stamped lastRunAt=' + newState.lastRunAt + ' (~1 commit/day; defends against GitHub\'s 60-day scheduled-workflow auto-disable).');
  }
}

// only run when invoked directly (`node scripts/alert-check.mjs`), not when imported by tests
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  });
}

export { needsHeartbeat, emailVerdict, HEARTBEAT_MS,
         ticketSnapshot, ticketChanged, ticketPushBody, sendTicketPush };
