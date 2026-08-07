/* HARDGATE — a watchdog that lives inside the thing it watches is not a watchdog.
   THE HOLE. alert-notify.yml line 32:
       if: github.event_name != 'schedule' || vars.RENDER_DISPATCH_PRIMARY != 'true'
   With RENDER_DISPATCH_PRIMARY='true' every SCHEDULED run is skipped and the
   only clock is scripts/gh-dispatch.mjs on Render, every 13 minutes. Render
   free instances spin down when idle. If Render sleeps: no dispatch, schedule
   already disabled, pipeline stopped — silently, with nothing in the repo
   changing to show it.
   Fix pack 23's degraded watchdog cannot catch this. It only executes when a
   run executes. A pipeline with no clock never reaches it.
   Read against the live alert-state.json at the time this was written, the
   freshest timestamp anywhere in the file was 2.2 HOURS old against a
   fifteen-minute cron.
   Run: node tests/test-pipeline-heartbeat.mjs                                */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const script = fs.readFileSync(path.join(ROOT, 'scripts/pipeline-heartbeat.mjs'), 'utf8');
const wf = fs.readFileSync(path.join(ROOT, '.github/workflows/pipeline-heartbeat.yml'), 'utf8');
const main = fs.readFileSync(path.join(ROOT, '.github/workflows/alert-notify.yml'), 'utf8');
console.log('== the watchdog is genuinely outside the thing it watches ==');
{
  ok(/RENDER_DISPATCH_PRIMARY/.test(main), 'alert-notify does gate its schedule on the dispatch flag');
  ok(!/if:\s*\$\{\{[^}]*RENDER_DISPATCH_PRIMARY/.test(wf),
     'the heartbeat job has NO dispatch-primary guard — it must tick when the pipeline cannot');
  ok(/schedule:\s*\n\s*- cron:/.test(wf), 'it runs on its own schedule');
  ok(/permissions:\s*\n\s*contents: read/.test(wf), 'read-only — it can never commit or mutate state');
  /* check IMPORTS, not prose — the file's own comments say the word "browser" */
  const imports = (script.match(/^\s*import .*$/gm) || []).join("|");
  ok(!/puppeteer/i.test(imports), 'no puppeteer import — it cannot fail the way the main job fails');
  ok(imports.trim() === "import fs from 'node:fs';", 'its ONLY dependency is node:fs');
  ok(!/import .*alert-check/.test(script), 'it does not import the script it is watching');
}
console.log('== it finds the freshest stamp at any depth ==');
{
  const m = script.match(/function newestStamp[\s\S]*?\n\}/);
  ok(!!m, 'newestStamp is present');
  /* keep the NAME — newestStamp recurses, and an anonymised copy cannot call itself */
  const fn = new Function('return (' + m[0] + ')')();
  const T = (s) => Date.parse(s);
  ok(fn({ a: '2026-08-01T00:00:00Z' }) === T('2026-08-01T00:00:00Z'), 'a top-level stamp is found');
  ok(fn({ x: { y: { z: '2026-08-05T10:00:00Z' } } }) === T('2026-08-05T10:00:00Z'), 'a deeply nested one too');
  ok(fn({ a: '2026-08-01T00:00:00Z', b: { c: '2026-08-06T00:00:00Z' } }) === T('2026-08-06T00:00:00Z'),
     'the FRESHEST wins, not the first or the last');
  ok(fn({ a: 'EDENUSD|short', b: 'p0|f0', c: null, d: 5, e: false }) === 0,
     'non-timestamp strings, nulls, numbers and booleans are ignored');
  ok(fn({}) === 0 && fn(null) === 0, 'empty and null return 0 rather than throwing');
  ok(fn({ a: '2026-13-45T99:99:99Z' }) === 0, 'an ISO-shaped but invalid date is not accepted');
}
console.log('== it alerts when cold and stays quiet when warm ==');
{
  const tmp = path.join(ROOT, '.hb-test');
  fs.mkdirSync(tmp, { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'scripts/pipeline-heartbeat.mjs'), path.join(tmp, 'hb.mjs'));
  const run = (state, env) => {
    fs.writeFileSync(path.join(tmp, 'alert-state.json'), JSON.stringify(state));
    return execFileSync(process.execPath, ['hb.mjs'], { cwd: tmp, encoding: 'utf8',
      env: Object.assign({}, process.env, { TELEGRAM_TOKEN: '', TELEGRAM_CHAT_ID: '' }, env || {}) });
  };
  const iso = (hAgo) => new Date(Date.now() - hAgo * 3600000).toISOString();
  const warm = run({ bookDayHalt: { at: iso(0.1) } });
  ok(/pipeline is alive/.test(warm), 'a fresh stamp reports alive');
  ok(!/no pulse/.test(warm), 'and pushes nothing');
  const cold = run({ bookDayHalt: { at: iso(9) } });
  ok(/no pulse/.test(cold), 'a 9h-old stamp reports no pulse');
  ok(/9\.0 hours/.test(cold), 'and names the age');
  ok(/means UNKNOWN, not none/.test(cold),
     'and says an empty setups list is unknown — the exact confusion that cost six packs');
  const primary = run({ bookDayHalt: { at: iso(9) } }, { RENDER_DISPATCH_PRIMARY: 'true' });
  ok(/Render/.test(primary) && /no clock at all/.test(primary),
     'with dispatch-primary set it names the sleeping-Render cause');
  ok(/RENDER_DISPATCH_PRIMARY=false/.test(primary), 'and gives the one-variable way back');
  const notPrimary = run({ bookDayHalt: { at: iso(9) } }, { RENDER_DISPATCH_PRIMARY: 'false' });
  ok(/auto-disabled/.test(notPrimary), 'without it, it names the 60-day auto-disable cause instead');
  /* every failure path must stay green — a heartbeat that reddens the build on
     a blip trains you to ignore red, which is how the real outage is missed */
  fs.writeFileSync(path.join(tmp, 'alert-state.json'), '{ not json');
  const bad = execFileSync(process.execPath, ['hb.mjs'], { cwd: tmp, encoding: 'utf8' });
  ok(/not valid JSON/.test(bad), 'corrupt state is reported');
  fs.rmSync(path.join(tmp, 'alert-state.json'));
  const gone = execFileSync(process.execPath, ['hb.mjs'], { cwd: tmp, encoding: 'utf8' });
  ok(/unreadable/.test(gone), 'a missing state file is reported');
  const none = run({ ticket: { long: null } });
  ok(/no timestamp in state yet/.test(none), 'a state with no stamps says so rather than crying outage');
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log('\n' + passed + ' passed, 0 failed');
