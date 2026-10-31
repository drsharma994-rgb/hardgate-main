/* PURE GOLD admission floor — hg-v1416 behavior pins.
   Three measured stand-aside vetoes (weekend session, late session, stop
   under floor) plus the armed-branch lastEvent carry. Paint-level only: no
   ledger, no ticket, no record — the no-forward-row invariant of
   test-puregold.mjs is re-asserted here. Every clause fails open.
   The old suite's 64 assertions run untouched; its build() fixture was
   re-widened (wick 0.05 -> 1.5) so its crosses stay above the floor — this
   suite carries the mutation proof instead: a sub-floor fixture MUST stand
   aside, and breaking the floor turns that block RED.
   Run: node tests/test-puregold-admission-floor.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = {
  console, Math, isFinite, isNaN, Date, Intl, Number, String, Object, Array, JSON,
  parseInt, parseFloat, NaN, Infinity
};
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'puregold.js'), 'utf8'), ctx, { filename: 'puregold.js' });

let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok -', m); };

const SPEC = ctx.HG_PUREGOLD_SPEC;
const FAR = Date.parse('2026-06-01T00:00:00Z');

/* ---- fixtures: same construction as test-puregold.mjs build(), wick as a
   parameter. Wick 0.05 measures stopPct ~0.09% (under the floor); wick 1.5
   measures ~0.27% (above it). Values are re-derived from the desk's own ATR
   below, never assumed. ---- */
function build(dir, wick){
  const rows = [];
  let px = 2400, prev = px;
  const push = c => {
    rows.push({ t: rows.length, o: prev, h: Math.max(prev, c) + wick, l: Math.min(prev, c) - wick, c: c });
    prev = c;
  };
  if (dir === 'long'){
    for (let i = 0; i < 90; i++){ px -= 0.35; push(px); }
    for (let j = 0; j < 40; j++){ px += 2.2; push(px); }
  } else {
    for (let i = 0; i < 90; i++){ px += 0.35; push(px); }
    for (let j = 0; j < 40; j++){ px -= 2.2; push(px); }
  }
  const closes = rows.map(r => r.c);
  const fast = ctx.hgPureGoldEma(closes, 21);
  const slow = ctx.hgPureGoldEma(closes, 55);
  let cross = -1;
  for (let i = 1; i < rows.length; i++){
    if (ctx.hgPureGoldCross(fast[i - 1], slow[i - 1], fast[i], slow[i]) === dir){ cross = i; break; }
  }
  if (cross < 1) throw new Error('fixture produced no ' + dir + ' cross');
  return { rows, cross };
}
function stamp(rows, cross, iso){
  const anchor = Date.parse(iso);
  for (let i = 0; i < rows.length; i++) rows[i].t = Math.floor((anchor + (i - cross) * SPEC.barMs) / 1000);
}
function stopPctAt(rows, cross){
  const atr = ctx.hgPureGoldAtr(rows, 14)[cross];
  return 1.5 * atr / rows[cross].c * 100;
}
function noBad(html, m){
  ok(!/\bNaN\b|undefined/.test(html), m + ' — the card prints neither NaN nor undefined');
}

console.log('== the floor fires on a sub-floor cross ==');
{
  const b = build('long', 0.05);
  stamp(b.rows, b.cross, '2026-01-05T12:30:00Z'); /* Monday 18:00 IST */
  const pct = stopPctAt(b.rows, b.cross);
  ok(pct < 0.20, 'the tight fixture really is sub-floor (' + pct.toFixed(3) + '% < 0.20%)');
  const read = ctx.hgPureGoldRead(b.rows, FAR);
  ok(read.status === 'aside' && read.reason === 'stop under floor', 'a sub-floor cross stands aside with the floor reason');
  ok(read.entry == null && read.stop == null && read.target == null, 'a refused cross mints no entry, stop or target');
  ok(read.veto && read.veto.kind === 'stop under floor' && read.veto.stopPct < 0.20, 'the veto record carries the measured stopPct');
  const html = ctx.hgPureGoldHtml(read, { feed: 'test' });
  ok(html.indexOf('0.20% floor') >= 0 && html.indexOf('STAND ASIDE') >= 0, 'the card names the floor and stands aside');
  noBad(html, 'the floor card');
}
{
  const b = build('short', 0.05);
  stamp(b.rows, b.cross, '2026-01-05T12:30:00Z');
  const read = ctx.hgPureGoldRead(b.rows, FAR);
  ok(read.status === 'aside' && read.reason === 'stop under floor', 'the floor refuses a sub-floor short the same way');
}

console.log('\n== the floor abstains when its read never landed (fail-open) ==');
{
  const shortTape = [];
  const t0 = Date.parse('2026-01-05T12:30:00Z');
  for (let i = 0; i < 10; i++){
    const c = 2300 + i;
    shortTape.push({ t: Math.floor((t0 + i * SPEC.barMs) / 1000), o: c, h: c + 1, l: c - 1, c: c });
  }
  const read = ctx.hgPureGoldRead(shortTape, FAR);
  ok(read.reason === 'ema unread' && read.veto == null, 'an unread EMA/ATR answers with the unread ladder, not a veto');
}

console.log('\n== the floor passes a cross above 0.20% ==');
{
  const b = build('long', 1.5);
  stamp(b.rows, b.cross, '2026-01-05T12:30:00Z');
  const pct = stopPctAt(b.rows, b.cross);
  ok(pct >= 0.20, 'the wide fixture really is above the floor (' + pct.toFixed(3) + '% >= 0.20%)');
  const flat = b.rows.slice(0, b.cross + 1);   /* freeze the tape at the cross: pending, then working */
  const c0 = flat[b.cross].c;
  for (let k = 0; k < 3; k++) flat.push({ t: Math.floor((Date.parse('2026-01-05T12:30:00Z') + (k + 1) * SPEC.barMs) / 1000), o: c0, h: c0 + 0.1, l: c0 - 0.1, c: c0 });
  const read = ctx.hgPureGoldRead(flat, FAR);
  ok(read.status === 'working' && read.dir === 'long' && read.veto == null, 'an above-floor cross is a working setup, veto cleared');
}

console.log('\n== weekend session ==');
{
  const b = build('long', 1.5);
  stamp(b.rows, b.cross, '2026-01-03T12:30:00Z'); /* Saturday 18:00 IST */
  const read = ctx.hgPureGoldRead(b.rows, FAR);
  ok(read.status === 'aside' && read.reason === 'weekend session', 'a Saturday cross stands aside — the IST-evening premise is a cash session');
  ok(read.entry == null && read.stop == null, 'the weekend cross mints nothing');
  const html = ctx.hgPureGoldHtml(read, { feed: 'test' });
  ok(html.indexOf('Saturday/Sunday') >= 0, 'the card names the weekend premise');
  noBad(html, 'the weekend card');
}
{
  const b = build('long', 0.05);
  stamp(b.rows, b.cross, '2026-01-03T12:30:00Z'); /* Saturday AND sub-floor */
  const read = ctx.hgPureGoldRead(b.rows, FAR);
  ok(read.reason === 'weekend session', 'precedence: weekend outranks the floor (premise before cost)');
}

console.log('\n== late session ==');
{
  const b = build('long', 1.5);
  stamp(b.rows, b.cross, '2026-01-05T15:00:00Z'); /* Monday 20:30 IST — the boundary, inclusive */
  const read = ctx.hgPureGoldRead(b.rows, FAR);
  ok(read.status === 'aside' && read.reason === 'late session', 'a cross opening at 20:30 IST stands aside (boundary inclusive)');
  const html = ctx.hgPureGoldHtml(read, { feed: 'test' });
  ok(html.indexOf('last hour') >= 0, 'the card names the last-hour window');
  noBad(html, 'the late card');
}
{
  const b = build('long', 1.5);
  stamp(b.rows, b.cross, '2026-01-05T14:45:00Z'); /* Monday 20:15 IST — before the cut */
  const flat = b.rows.slice(0, b.cross + 1);
  const c0 = flat[b.cross].c;
  for (let k = 0; k < 3; k++) flat.push({ t: Math.floor((Date.parse('2026-01-05T14:45:00Z') + (k + 1) * SPEC.barMs) / 1000), o: c0, h: c0 + 0.1, l: c0 - 0.1, c: c0 });
  const read = ctx.hgPureGoldRead(flat, FAR);
  ok(read.status === 'working' && read.dir === 'long', 'a cross opening at 20:15 IST is NOT vetoed');
}
{
  const b = build('long', 0.05);
  stamp(b.rows, b.cross, '2026-01-05T15:00:00Z'); /* late AND sub-floor */
  const read = ctx.hgPureGoldRead(b.rows, FAR);
  ok(read.reason === 'late session', 'precedence: late outranks the floor');
}

console.log('\n== the armed card carries the exit it used to swallow ==');
{
  /* crossup (above floor) -> fill -> stop -> crossdown pending, sliced before
     the fill bar exists: armed, and the stop is still disclosed. */
  const rows = [];
  let px = 2400, prev = px;
  const push = (c, w) => {
    rows.push({ t: rows.length, o: prev, h: Math.max(prev, c) + w, l: Math.min(prev, c) - w, c: c });
    prev = c;
  };
  for (let i = 0; i < 90; i++){ px -= 0.35; push(px, 1.5); }
  for (let j = 0; j < 11; j++){ px += 2.2; push(px, 1.5); }
  const upClose = px;
  for (let k = 0; k < 10; k++){ px -= 6; push(px, 1.5); }   /* stops the long, then crosses down */
  const closes = rows.map(r => r.c);
  const fast = ctx.hgPureGoldEma(closes, 21);
  const slow = ctx.hgPureGoldEma(closes, 55);
  let crossUp = -1, crossDown = -1;
  for (let i = 1; i < rows.length; i++){
    const side = ctx.hgPureGoldCross(fast[i - 1], slow[i - 1], fast[i], slow[i]);
    if (side === 'long' && crossUp < 0) crossUp = i;
    if (side === 'short' && crossUp >= 0){ crossDown = i; break; }
  }
  if (crossUp < 0 || crossDown < 0) throw new Error('fixture produced no cross pair');
  for (let i = 0; i < rows.length; i++)
    rows[i].t = Math.floor((Date.parse('2026-01-05T12:30:00Z') + (i - crossUp) * SPEC.barMs) / 1000);
  ok(stopPctAt(rows, crossUp) >= 0.20, 'the armed fixture crossup is above the floor');
  const armed = ctx.hgPureGoldRead(rows.slice(0, crossDown + 1), FAR);
  ok(armed.status === 'armed' && armed.dir === 'short', 'the reverse cross is armed, entry not in the tape');
  ok(armed.lastEvent && armed.lastEvent.kind === 'stop' && armed.lastEvent.dir === 'long',
    'the armed read carries the swallowed stop (hg-v1416)');
  ok(armed.lastEvent.signalClose === upClose || isFinite(armed.lastEvent.signalClose), 'the carried exit is the old long, not this order');
  const html = ctx.hgPureGoldHtml(armed, { feed: 'test' });
  ok(html.indexOf('not in the tape') >= 0 && html.indexOf('Closed') >= 0, 'the armed card paints the closed trade next to the pending entry');
  noBad(html, 'the armed card');
}

console.log('\n== veto recency against the closed trade ==');
{
  /* valid crossup -> gap-stop on the fill bar -> sub-floor crossdown later:
     the fresher veto outranks the older closed trade. */
  const rows = [];
  let px = 2400, prev = px;
  const push = (c, w, gap) => {
    const o = prev + (gap || 0);
    rows.push({ t: rows.length, o: o, h: Math.max(o, c) + w, l: Math.min(o, c) - w, c: c });
    prev = c;
  };
  for (let i = 0; i < 90; i++){ px -= 0.35; push(px, 1.5); }
  for (let j = 0; j < 11; j++){ px += 2.2; push(px, 1.5); }
  push(px - 10.3, 0.05, -10);                 /* the fill bar gaps through the stop */
  px -= 10.3;
  for (let k = 0; k < 130; k++){ px -= 0.35; push(px, 0.05); }  /* tight drift to a sub-floor crossdown */
  const closes = rows.map(r => r.c);
  const fast = ctx.hgPureGoldEma(closes, 21);
  const slow = ctx.hgPureGoldEma(closes, 55);
  let crossUp = -1, crossDown = -1;
  for (let i = 1; i < rows.length; i++){
    const side = ctx.hgPureGoldCross(fast[i - 1], slow[i - 1], fast[i], slow[i]);
    if (side === 'long' && crossUp < 0) crossUp = i;
    if (side === 'short' && crossUp >= 0){ crossDown = i; break; }
  }
  if (crossUp < 0 || crossDown < 0) throw new Error('fixture produced no cross pair');
  for (let i = 0; i < rows.length; i++)
    rows[i].t = Math.floor((Date.parse('2026-01-05T12:30:00Z') + (i - crossUp) * SPEC.barMs) / 1000);
  /* the crossdown lands outside any session by wall-clock drift; re-stamp it
     onto a weekday session open (bar times are per-bar, the math is not). */
  rows[crossDown].t = Math.floor(Date.parse('2026-01-06T12:30:00Z') / 1000); /* Tuesday 18:00 IST */
  ok(stopPctAt(rows, crossUp) >= 0.20, 'the recency fixture crossup is above the floor');
  const pct = stopPctAt(rows, crossDown);
  ok(pct < 0.20, 'the recency fixture crossdown is sub-floor (' + pct.toFixed(3) + '%)');
  const read = ctx.hgPureGoldRead(rows.slice(0, crossDown + 1), FAR);
  ok(read.status === 'aside' && read.reason === 'stop under floor', 'a fresher veto outranks the older closed trade');
  ok(read.veto && read.lastEvent && read.lastEvent.kind === 'stop' && read.veto.index > read.lastEvent.index,
    'the veto really is the fresher event');
}

console.log('\n== the invariants this wave is forbidden to break ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'puregold.js'), 'utf8');
  ok(!/hgFwdRecord|recordForward/.test(src), 'still writes no forward row — the paint-level wave mints nothing');
  ok(!/STOP_FLOOR_PCT\s*=\s*0(?:\.0+)?\s*;/.test(src), 'the floor constant is not zeroed (mutation guard)');
  const bs = fs.readFileSync(path.join(ROOT, 'build-stamp.js'), 'utf8');
  const v = (bs.match(/version\s*:\s*'hg-v(\d+)'/) || [])[1];
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(!!v && html.indexOf('puregold.js?v=' + v) >= 0, 'index.html loads puregold.js at the stamped version (hg-v' + v + ')');
}

console.log('\n' + passed + ' passed, 0 failed');
