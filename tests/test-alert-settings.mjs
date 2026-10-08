/* HARDGATE — alert settings surface tests (task #3): user cycle + quiet hours.
   Loads hgalert.js as a classic script via vm.runInThisContext (the
   tests/test-hgalert.mjs harness style) with stubbed window/document/localStorage,
   plus source pins on index.html wiring. Zero network, no real audio.
   Run: node tests/test-alert-settings.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const SRC = fs.readFileSync(root + 'hgalert.js', 'utf8');
const HTML = fs.readFileSync(root + 'index.html', 'utf8');

let pass = 0, fail = 0;
function ok(cond, msg){ if (cond){ pass++; console.log('  ok - ' + msg); } else { fail++; console.error('  FAIL - ' + msg); } }

function memLocalStorage(){
  const m = {};
  return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); },
           removeItem: k => { delete m[k]; }, _map: m };
}
function stubEl(){
  return { innerHTML: '', textContent: '', className: '', value: '', id: '',
           disabled: false, style: {}, _handlers: {}, _qs: {},
           addEventListener: function(ev, fn){ this._handlers[ev] = fn; },
           querySelector: function(sel){ if (!this._qs[sel]) this._qs[sel] = stubEl(); return this._qs[sel]; } };
}
function stubDocument(){
  const body = stubEl();
  body.appendChild = function(c){ return c; };
  return { body, createElement: () => stubEl(), addEventListener: function(){} };
}
function boot(ls){
  globalThis.window = {};
  globalThis.localStorage = ls || memLocalStorage();
  globalThis.document = stubDocument();
  vm.runInThisContext(SRC, { filename: 'hgalert.js' });
  return globalThis.window;
}
function fmt(min){
  const m = ((min % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}
/** Freeze the wall clock at hh:mm for fn() — nowMinutes() must follow. */
function withClock(hhmm, fn){
  const RealDate = globalThis.Date;
  const [h, m] = hhmm.split(':').map(Number);
  function FakeDate(...args){
    return args.length ? new RealDate(...args) : new RealDate(2026, 0, 15, h, m, 0);
  }
  FakeDate.now = () => new RealDate(2026, 0, 15, h, m, 0).getTime();
  FakeDate.parse = RealDate.parse; FakeDate.UTC = RealDate.UTC;
  globalThis.Date = FakeDate;
  try{ return fn(); } finally { globalThis.Date = RealDate; }
}

console.log('== 1) exports + panel UI ==');
{
  const W = boot();
  ok(typeof W.hgAlertQuietNow === 'function', 'hgAlertQuietNow exported');
  ok(typeof W.hgAlertsMuted === 'function', 'hgAlertsMuted exported');
  ok(typeof W.hgAlertCycleUserMs === 'function', 'hgAlertCycleUserMs exported');
  ok(SRC.includes('id="hgAlertCycle"') && SRC.includes('id="hgAlertQStart"') && SRC.includes('id="hgAlertQEnd"'),
    'bell panel carries cycle + quiet-hours inputs');
}

console.log('== 2) user cycle override (default 10 min = the tab clock) ==');
{
  const W = boot();
  ok(W.hgAlertCycleUserMs() === 10 * 60 * 1000, 'no saved cycle -> the 10-min default');
  globalThis.localStorage.setItem('hgAlertCycleMin', '7');
  ok(W.hgAlertCycleUserMs() === 7 * 60 * 1000, 'saved 7 min -> 7-min cadence');
  globalThis.localStorage.setItem('hgAlertCycleMin', '120');
  ok(W.hgAlertCycleUserMs() === 120 * 60 * 1000, '120 (the clamp ceiling) accepted');
  globalThis.localStorage.setItem('hgAlertCycleMin', '999');
  ok(W.hgAlertCycleUserMs() === 10 * 60 * 1000, 'above the clamp falls back to default');
  globalThis.localStorage.setItem('hgAlertCycleMin', '0');
  ok(W.hgAlertCycleUserMs() === 10 * 60 * 1000, '0/empty clears back to default');
  globalThis.localStorage.removeItem('hgAlertCycleMin');
  globalThis.window.HG_TAB_ALERT_MS = 15 * 60 * 1000;
  ok(W.hgAlertCycleUserMs() === 15 * 60 * 1000, 'no override -> mirrors the page HG_TAB_ALERT_MS');
}

console.log('== 3) quiet hours: windows, wrap-over-midnight, exclusivity ==');
{
  const W = boot();
  ok(W.hgAlertQuietNow() === false, 'no window saved -> never quiet');
  globalThis.localStorage.setItem('hgAlertQuietStart', '09:00');
  globalThis.localStorage.setItem('hgAlertQuietEnd', '17:00');
  ok(withClock('12:00', () => W.hgAlertQuietNow()) === true, 'midday inside 09:00-17:00 -> quiet');
  ok(withClock('08:59', () => W.hgAlertQuietNow()) === false, 'before the window -> not quiet');
  ok(withClock('17:00', () => W.hgAlertQuietNow()) === false, 'window end is exclusive');
  ok(withClock('09:00', () => W.hgAlertQuietNow()) === true, 'window start is inclusive');
  globalThis.localStorage.setItem('hgAlertQuietStart', '22:00');
  globalThis.localStorage.setItem('hgAlertQuietEnd', '06:00');
  ok(withClock('23:30', () => W.hgAlertQuietNow()) === true, '23:30 inside 22:00-06:00 wrap -> quiet');
  ok(withClock('03:00', () => W.hgAlertQuietNow()) === true, '03:00 inside the wrap -> quiet');
  ok(withClock('12:00', () => W.hgAlertQuietNow()) === false, 'midday outside the wrap -> not quiet');
  ok(withClock('06:00', () => W.hgAlertQuietNow()) === false, 'wrap end is exclusive');
  globalThis.localStorage.setItem('hgAlertQuietEnd', '22:00');
  ok(withClock('22:00', () => W.hgAlertQuietNow()) === false, 'equal ends -> never quiet');
}

console.log('== 4) mute export + source pins ==');
{
  const W = boot();
  ok(W.hgAlertsMuted() === false, 'fresh boot -> not muted');
  const W2 = boot((() => { const ls = memLocalStorage(); ls.setItem('hgAlertMuted', '1'); return ls; })());
  ok(W2.hgAlertsMuted() === true, "persisted 'hgAlertMuted'='1' -> muted");
  ok(/if \(__muted\) return 'muted';\n  if \(hgAlertQuietNow\(\)\) return 'quiet';/.test(SRC),
    'tryChime gates quiet hours after MUTE, before the throttle');
  ok(SRC.includes("(quiet hours)"), 'held chimes are acknowledged as quiet hours in the panel');
}

console.log('== 5) index.html wiring pins ==');
{
  ok(/const HG_ALERT_CYCLE_MS = HG_TAB_ALERT_MS;/.test(HTML),
    'pinned alias intact: HG_ALERT_CYCLE_MS = HG_TAB_ALERT_MS (test-check-production, test-scan-every-10m)');
  ok(/S\.alertTimer = setInterval\(runAlertCycle, \(typeof hgAlertCycleUserMs === 'function'\) \? hgAlertCycleUserMs\(\) : HG_ALERT_CYCLE_MS\);/.test(HTML),
    'armAlertCycle uses the user cadence with the pinned constant as fallback');
  ok(/if \(HG_ALERTS_FORCED_ON\)\{[\s\S]{0,400}armAlertCycle\(\);/.test(HTML),
    'test-v656 boot branch intact: if (HG_ALERTS_FORCED_ON){ armAlertCycle(); }');
  ok(/if \(typeof hgAlertsMuted === 'function' && hgAlertsMuted\(\)\) return;/.test(HTML)
     && /if \(typeof hgAlertQuietNow === 'function' && hgAlertQuietNow\(\)\) return;/.test(HTML),
    'sendAlertPush gates on MUTE + quiet hours (feature-checked)');
  const gateAt = HTML.indexOf('typeof hgAlertsMuted');
  const topicAt = HTML.indexOf("topic = localStorage.getItem('hg_ntfy_topic')");
  ok(gateAt !== -1 && topicAt !== -1 && gateAt < topicAt,
    'the gate runs before the topic read — recording still happens, noise stops');
}

console.log(`\nalert-settings tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
