/* hg-v1366: the sniper read is a suggestion. It does not replace the crown. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)));
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok -', m); };

function boot() {
  const ctx = {
    console, Math, Date, Number, String, Object, Array, JSON, Error, isFinite, isNaN, parseInt, parseFloat,
    setTimeout, Promise
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.document = { head: { appendChild: function () {} }, createElement: function () { return { id: '', textContent: '' }; } };
  vm.createContext(ctx);
  for (const f of ['goldind.js', 'supersetup.js', 'super-gold.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  return ctx.window;
}

console.log('== an unread ATR does not move the desk bracket ==');
{
  const W = boot();
  const row = { dir: 'long', entry: 2650, stop: 2640, t1: 2670 };
  const prec = W.sgPrecisionGoldLevels(row, null);
  ok(prec.ok === true && prec.unread === true, 'the suggestion says the ATR was unread');
  ok(prec.entry === 2650 && prec.stop === 2640, 'the desk entry and stop are unchanged');
}

console.log('\n== a measured tape can suggest a level without becoming the crown ==');
{
  const W = boot();
  const now = Date.now();
  const rows = [];
  for (let i = 0; i < 30; i++) rows.push({ t: 1760000000 + i * 900, o: 2640, h: 2660, l: 2630, c: 2650, v: 10 });
  const intel = {
    rows15: rows,
    volRegime: { ok: true, regime: 'NORMAL', atrNow: 4 },
    structure: { ok: true, items: [{ label: 'OB', px: 2650.5 }] }
  };
  const prec = W.sgPrecisionGoldLevels({ dir: 'long', entry: 2650, stop: 2640, t1: 2670 }, intel);
  ok(prec.ok === true && prec.unread !== true, 'a measured ATR produces a suggestion');
  ok(prec.rawEntry === 2650 && prec.rawStop === 2640, 'the raw desk levels stay on the suggestion');
  const snap = {
    at: now, sourceAt: now, intel: intel,
    cands: [
      { id: 'sc', sym: 'XAUUSD', dir: 'long', scanner: 'gold-scalp', entry: 2650, stop: 2640, t1: 2670, mark: 2655, barT: 1760000000, minimalLossPass: true, qty: 1 },
      { id: 'sw', sym: 'XAUUSD', dir: 'long', scanner: 'gold-swing', entry: 2650, stop: 2640, t1: 2670, mark: 2655, barT: 1760000000, minimalLossPass: true, qty: 1 }
    ]
  };
  const acc = W.sgHighAccuracyAudit(snap, W);
  ok(acc.ok === true && acc.total === 12, 'twelve gates are printed (' + acc.tier + ' ' + acc.score + ')');
  const payload = W.sgCrownDispatchPayload(snap, { balance: 1000, riskPct: 1 }, W);
  if (payload.ready){
    ok(payload.entry === 2650 && payload.stop === 2640 && payload.t1 === 2670, 'a ready send still uses the desk bracket');
  } else {
    ok(/stands aside|below B|Tape locked|invalidated|No size|No target|blackout/.test(payload.reason), 'a refused send names the reason (' + payload.reason + ')');
    ok(!payload.entry, 'a refused send carries no invented entry');
  }
}

console.log('\n== the board names the scorecard and does not call it the crown ==');
{
  const src = fs.readFileSync(path.join(root, 'super-gold.js'), 'utf8');
  ok(/data-sg-intel="sniper"/.test(src), 'the sniper line has a home');
  ok(/does not replace the crowned entry or stop/.test(src), 'the suggestion disclaims the crown');
  ok(/Suggestion, not the crown/.test(src), 'the card says the suggestion is not the crown');
}

console.log('\ntest-super-gold-v1366: ' + pass + ' passed');
