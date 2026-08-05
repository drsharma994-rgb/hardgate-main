/* HARDGATE — app.js daemon boot smoke (dry-run, no CCXT, no long-lived process).
   Spawns app.js with HARDGATE_DAEMON_DRY_RUN and unreachable site URL so the
   first scan fails fast after boot banners print.
   Run: node tests/test-app-boot.mjs */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);

let pass = 0;
const ok = (cond, label) => {
  if (!cond) throw new Error('FAIL: ' + label);
  pass++;
  console.log('  ok —', label);
};

console.log('== app.js source contract ==');
{
  const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  ok(/bootHardgate/.test(src), 'app.js defines bootHardgate');
  ok(/StateDatabase/.test(src), 'app.js wires StateDatabase');
  ok(/runBrainSynthesis/.test(src), 'app.js calls runBrainSynthesis');
  ok(/runMarketScan/.test(src), 'app.js schedules runMarketScan');
  ok(/HARDGATE_DAEMON_DRY_RUN/.test(src), 'app.js honors HARDGATE_DAEMON_DRY_RUN');
  ok(/HARDGATE_SCAN_MS/.test(src), 'app.js reads HARDGATE_SCAN_MS');
}

console.log('== dry-run boot spawn ==');
{
  const logs = [];
  const child = spawn(process.execPath, ['app.js'], {
    cwd: root,
    env: Object.assign({}, process.env, {
      HARDGATE_DAEMON_DRY_RUN: '1',
      HARDGATE_DAEMON_DEBUG: '0',
      HARDGATE_SCAN_MS: '900000',
      HARDGATE_URL: 'http://127.0.0.1:59999/',
    }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try{ child.kill('SIGTERM'); }catch(e){}
      reject(new Error('app.js boot timed out after 45s'));
    }, 45000);

    function maybeFinish(){
      const text = logs.join('');
      if (text.indexOf('[SCAN START]') >= 0 || text.indexOf('[FATAL LOOP ERROR]') >= 0
          || text.indexOf('[BOOT FAILED]') >= 0){
        clearTimeout(timer);
        try{ child.kill('SIGTERM'); }catch(e){}
        resolve(text);
      }
    }

    child.stdout.on('data', (buf) => { logs.push(String(buf)); maybeFinish(); });
    child.stderr.on('data', (buf) => { logs.push(String(buf)); maybeFinish(); });
    child.on('error', reject);
    child.on('close', () => { clearTimeout(timer); resolve(logs.join('')); });
  });

  const out = await done;
  ok(out.indexOf('HARDGATE INSTITUTIONAL ENGINE') >= 0, 'boot banner printed');
  ok(out.indexOf('[BOOT]') >= 0, 'boot log lines present');
  ok(out.indexOf('DRY RUN') >= 0, 'dry-run mode acknowledged');
  ok(out.indexOf('[SCAN START]') >= 0 || out.indexOf('[FATAL LOOP ERROR]') >= 0,
    'first scan cycle started or failed fast with loop error');
  ok(out.indexOf('[BOOT FAILED]') < 0, 'bootHardgate did not exit on startup throw');
}

console.log('\n' + pass + ' passed');
