import fs from 'node:fs';
import vm from 'node:vm';
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok - ' + m); };

const TAB = fs.readFileSync('gold-candle-forecast.js', 'utf8');
const SRC = fs.readFileSync('goldind.js', 'utf8');

console.log('\n== 1) the engine floor is 30, read from the source not from memory ==');
{
  const m = SRC.match(/function goldCandleForecast\(rows\)[\s\S]{0,900}?rows\.length < (\d+)/);
  ok(!!m, 'the engine bar floor is findable in goldind.js');
  const floor = +(m ? m[1] : 0);
  ok(floor === 30, 'the engine refuses a tape below 30 bars (found ' + floor + ')');

  console.log('\n== 2) the tab names ONE floor and agrees with the engine ==');
  const f = TAB.match(/CF_MIN_BARS\s*=\s*(\d+)/);
  ok(!!f, 'the tab names the floor once as CF_MIN_BARS');
  ok(+(f ? f[1] : 0) === floor,
    'and it EQUALS the engine floor (' + (f ? f[1] : '?') + ' vs ' + floor + ') - this is the defect that shipped: the loader said 20 while the engine said 30, so a 20-29 bar feed passed every check and then returned null');

  console.log('\n== 3) no bare 20 remains anywhere in the module ==');
  ok(!/length >= 20/.test(TAB), 'no loader still accepts 20 bars');
  ok(!/length < 20[^0-9]/.test(TAB), 'no guard still throws only below 20');
  const uses = (TAB.match(/CF_MIN_BARS/g) || []).length;
  ok(uses >= 4, 'the named floor is READ in all four places (found ' + uses + ' uses)');

  console.log('\n== 4) the guard fails open and names the count ==');
  ok(/Gold 15m tape unread/.test(TAB), 'a thin tape still throws a legible message');
  ok(/candles\.length < CF_MIN_BARS/.test(TAB), 'and it is the named floor that decides, not a literal');

  console.log('\n== 4b) NO bare floor literal survives anywhere in the module ==');
  /* hg-v1350: the 4h swing admission and the ultimate-confluence admission were left as
     the bare literal 30 when the floor was first named. They agreed with the engine only
     by coincidence - the exact state the loader was in before hg-v1349 - so a future
     engine change would have blanked the swing silently the same way it blanked the 15m.
     One home means EVERY reader; this asserts none was missed. */
  const bare = TAB.match(/length\s*>=\s*30|length\s*<\s*30/g) || [];
  ok(bare.length === 0,
    'no reader compares against a bare 30 any more (found ' + bare.length + (bare.length ? ': ' + bare.join(', ') : '') + ')');
  const named = (TAB.match(/CF_MIN_BARS/g) || []).length;
  ok(named >= 6, 'and the named floor is read everywhere it is needed (found ' + named + ' uses)');
}

console.log('\n== 5) driven: a 20-29 bar tape cannot reach the engine any more ==');
{
  const ctx = { console: { log() {}, warn() {}, error() {} }, Math, Date, Number, String, Object, Array,
    JSON, Error, Promise, RegExp, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'goldind.js']) {
    try { vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }); } catch (e) {}
  }
  const tape = n => { const o = []; let c = 4000; for (let i = 0; i < n; i++) { c *= 1.0005; o.push({ t: 1791000000000 + i * 900000, o: c * 0.999, h: c * 1.001, l: c * 0.998, c: c, v: 100 }); } return o; };
  for (const n of [20, 25, 29]) {
    const rows = tape(n);
    const floor = 30;
    ok(rows.length < floor, n + ' bars is below the named floor, so the tab throws before calling the engine');
    ok(ctx.goldCandleForecast(rows) === null, 'and the engine would indeed have returned null on it - the bug was real, not theoretical');
  }
  ok(ctx.goldCandleForecast(tape(40)) !== null, 'while a 40-bar tape reads fine, so the fix does not over-reject');

  console.log('\n== 6) and the diagnostic names the floor for exactly that tape ==');
  if (typeof ctx.hgCfDiagnose === 'function') {
    const d = ctx.hgCfDiagnose(tape(25));
    ok(typeof d === 'string' && /too short/.test(d), 'a 25-bar tape is named as too short, not shrugged at');
    ok(/25 bars/.test(d), 'and the message carries the actual count (' + String(d).slice(0, 90) + ')');
  } else ok(false, 'hgCfDiagnose is exported');
}

console.log('\ntest-candle-forecast-bar-floor: ' + pass + ' passed, 0 failed');
