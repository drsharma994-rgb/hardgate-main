/* PURE GOLD — the IST session EMA cross, and only that.
   Entry is the next open. Stop and target come from the signal close.
   A stack is not a cross. Unread stays unread.
   Run: node tests/test-puregold.mjs */
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
const near = (a, b, m) => ok(typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-6, m + ' (' + a + ' vs ' + b + ')');

const SPEC = ctx.HG_PUREGOLD_SPEC;
ok(SPEC.fast === 21 && SPEC.slow === 55 && SPEC.atr === 14, 'lengths are 21, 55, 14');
ok(SPEC.slMult === 1.5 && SPEC.tpMult === 3, 'stop 1.5 ATR, target 3 ATR');
ok(SPEC.session === '1730-2130' && SPEC.tz === 'Asia/Kolkata', 'session string is 1730-2130 Asia/Kolkata');
ok(SPEC.tf === '15m', 'the working tape is 15m');

console.log('== session clock ==');
{
  const at = s => ctx.hgPureGoldInSession(Date.parse(s));
  ok(at('2026-01-05T12:00:00Z') === true, '17:30 IST is inside');
  ok(at('2026-01-05T11:45:00Z') === false, '17:15 IST is outside');
  ok(at('2026-01-05T11:59:00Z') === false, '17:29 IST is outside');
  ok(at('2026-01-05T15:45:00Z') === true, '21:15 IST is inside');
  ok(at('2026-01-05T16:00:00Z') === false, '21:30 IST is outside — the end is exclusive');
  ok(ctx.hgPureGoldInSession(NaN) === null, 'an unreadable instant is not guessed into the session');
  ok(ctx.hgPureGoldInSession(null) === null, 'a missing instant is not guessed into the session');
}

console.log('\n== the cross, and the two averages ==');
{
  ok(ctx.hgPureGoldCross(1, 2, 3, 2.5) === 'long', 'crossover: was at or below, now above');
  ok(ctx.hgPureGoldCross(2, 2, 3, 2) === 'long', 'a touch on the previous bar can cross');
  ok(ctx.hgPureGoldCross(3, 2, 4, 2.5) === null, 'already above is not a crossover');
  ok(ctx.hgPureGoldCross(1, 2, 2, 2) === null, 'equal on the new bar is not a cross');
  ok(ctx.hgPureGoldCross(3, 2, 1, 1.5) === 'short', 'crossunder: was at or above, now below');
  ok(ctx.hgPureGoldCross(1, 2, NaN, 2) === null, 'an unread EMA is not a cross');

  const closes = [];
  for (let i = 0; i < 30; i++) closes.push(100 + i);
  const ema = ctx.hgPureGoldEma(closes, 21);
  ok(!Number.isFinite(ema[19]), 'EMA is unread before the length');
  let sma = 0;
  for (let i = 0; i < 21; i++) sma += closes[i];
  sma /= 21;
  near(ema[20], sma, 'the first EMA is the SMA of the first 21 closes');
  const k = 2 / 22;
  near(ema[21], closes[21] * k + sma * (1 - k), 'the next EMA is the Pine step');

  const rows = [];
  let prev = 2000;
  for (let i = 0; i < 20; i++){
    const c = 2000 + i;
    rows.push({ t: i, o: prev, h: Math.max(prev, c) + 1, l: Math.min(prev, c) - 1, c: c });
    prev = c;
  }
  const atr = ctx.hgPureGoldAtr(rows, 14);
  ok(!Number.isFinite(atr[13]), 'ATR is unread before the seed completes');
  let seed = 0;
  for (let i = 1; i <= 14; i++){
    seed += Math.max(rows[i].h - rows[i].l, Math.abs(rows[i].h - rows[i - 1].c), Math.abs(rows[i].l - rows[i - 1].c));
  }
  near(atr[14], seed / 14, 'the first ATR is the mean of the first 14 true ranges');
  const tr15 = Math.max(rows[15].h - rows[15].l, Math.abs(rows[15].h - rows[14].c), Math.abs(rows[15].l - rows[14].c));
  near(atr[15], (atr[14] * 13 + tr15) / 14, 'the next ATR is Wilder, not a fresh mean');
}

function build(dir){
  const rows = [];
  let px = 2400, prev = px;
  const push = c => {
    rows.push({
      t: rows.length,
      o: prev,
      h: Math.max(prev, c) + 0.05,
      l: Math.min(prev, c) - 0.05,
      c: c
    });
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
    const side = ctx.hgPureGoldCross(fast[i - 1], slow[i - 1], fast[i], slow[i]);
    if (side === dir){ cross = i; break; }
  }
  if (cross < 1) throw new Error('fixture produced no ' + dir + ' cross');
  return { rows: rows, cross: cross };
}

function stamp(rows, cross, iso){
  const anchor = Date.parse(iso);
  for (let i = 0; i < rows.length; i++) rows[i].t = Math.floor((anchor + (i - cross) * SPEC.barMs) / 1000);
}

function flattenAfter(rows, cross){
  const c = rows[cross].c;
  for (let i = cross + 1; i < rows.length; i++){
    rows[i].o = c;
    rows[i].h = c + 0.1;
    rows[i].l = c - 0.1;
    rows[i].c = c;
  }
}

const FAR = Date.parse('2026-06-01T00:00:00Z');

console.log('\n== a long cross inside the session ==');
{
  const b = build('long');
  stamp(b.rows, b.cross, '2026-01-05T12:30:00Z'); /* 18:00 IST */
  flattenAfter(b.rows, b.cross);
  const atr = ctx.hgPureGoldAtr(b.rows, 14)[b.cross];
  const close = b.rows[b.cross].c;
  const stop = close - 1.5 * atr;
  const target = close + 3 * atr;
  ok(b.rows[b.cross + 1], 'the fixture has a bar after the cross');

  const live = ctx.hgPureGoldRead(b.rows, FAR);
  ok(live.status === 'working' && live.dir === 'long', 'the open long is a working setup');
  near(live.entry, b.rows[b.cross + 1].o, 'entry is the next bar open');
  ok(live.entry !== b.rows[b.rows.length - 1].c || b.rows[b.cross + 1].o === b.rows[b.rows.length - 1].c,
    'entry is not taken from a later print by chasing');
  near(live.stop, stop, 'stop is signal close minus 1.5 ATR');
  near(live.target, target, 'target is signal close plus 3 ATR');
  near(live.signalClose, close, 'the signal close is kept separate from the fill');
  ok(live.entry === close, 'this fixture fills at the signal close, so the two numbers match only because the next open printed there');

  const armedRows = b.rows.slice(0, b.cross + 1);
  const armed = ctx.hgPureGoldRead(armedRows, FAR);
  ok(armed.status === 'armed' && armed.dir === 'long' && armed.entry == null, 'no next bar means the entry is unread');
  near(armed.stop, stop, 'the armed stop is still the signal close minus 1.5 ATR');
  near(armed.target, target, 'the armed target is still the signal close plus 3 ATR');
  const armedHtml = ctx.hgPureGoldHtml(armed, { feed: 'test' });
  ok(armedHtml.indexOf('not in the tape') >= 0, 'the card says the entry is not in the tape');
  ok(!/\bNaN\b|undefined/.test(armedHtml), 'the armed card prints neither NaN nor undefined');

  const stoppedRows = b.rows.slice(0, b.cross + 2);
  stoppedRows[b.cross + 1].o = close;
  stoppedRows[b.cross + 1].h = close + 0.1;
  stoppedRows[b.cross + 1].l = stop - 1;
  stoppedRows[b.cross + 1].c = close;
  const stopped = ctx.hgPureGoldRead(stoppedRows, FAR);
  ok(stopped.status === 'aside' && stopped.reason === 'stopped', 'a later bar through the stop is not a live setup');
  ok(stopped.entry == null && stopped.lastEvent && stopped.lastEvent.kind === 'stop', 'the stop is history, not an order');

  const bothRows = b.rows.slice(0, b.cross + 2);
  bothRows[b.cross + 1].o = close;
  bothRows[b.cross + 1].h = target + 1;
  bothRows[b.cross + 1].l = stop - 1;
  bothRows[b.cross + 1].c = close;
  const both = ctx.hgPureGoldRead(bothRows, FAR);
  ok(both.reason === 'stopped' && both.lastEvent && both.lastEvent.both === true,
    'a bar that trades the stop and the target is the stop');

  const tgtRows = b.rows.slice(0, b.cross + 2);
  tgtRows[b.cross + 1].o = close;
  tgtRows[b.cross + 1].h = target + 1;
  tgtRows[b.cross + 1].l = close - 0.1;
  tgtRows[b.cross + 1].c = close;
  const tgt = ctx.hgPureGoldRead(tgtRows, FAR);
  ok(tgt.reason === 'target hit' && tgt.entry == null, 'a target print closes it; nothing new is issued at the live price');

  const html = ctx.hgPureGoldHtml(live, { feed: 'binance-xau' });
  ok(html.indexOf(live.entry.toFixed(2)) >= 0 && html.indexOf('Entry') >= 0, 'the working card prints the fill');
  ok(html.indexOf('not the live print') >= 0, 'the card says this is not the live print');
  ok(!/\bNaN\b|undefined/.test(html), 'the working card prints neither NaN nor undefined');
}

console.log('\n== a short cross, and a stack that is not a cross ==');
{
  const b = build('short');
  stamp(b.rows, b.cross, '2026-01-05T12:30:00Z');
  flattenAfter(b.rows, b.cross);
  const atr = ctx.hgPureGoldAtr(b.rows, 14)[b.cross];
  const close = b.rows[b.cross].c;
  const live = ctx.hgPureGoldRead(b.rows, FAR);
  ok(live.status === 'working' && live.dir === 'short', 'the open short is a working setup');
  near(live.entry, b.rows[b.cross + 1].o, 'short entry is the next open');
  near(live.stop, close + 1.5 * atr, 'short stop is signal close plus 1.5 ATR');
  near(live.target, close - 3 * atr, 'short target is signal close minus 3 ATR');

  const out = build('long');
  stamp(out.rows, out.cross, '2026-01-05T06:30:00Z'); /* 12:00 IST, outside */
  const outside = out.rows.slice(0, out.cross + 3);
  const early = ctx.hgPureGoldRead(outside, FAR);
  ok(early.status === 'aside' && early.entry == null && early.stop == null, 'a cross outside the session is not a setup');
  ok(early.reason === 'outside session', 'the reason is the session, not a missing price');

  const later = out.rows.slice(0, out.cross + 1);
  const c = later[out.cross].c;
  const evening = Date.parse('2026-01-05T12:30:00Z'); /* 18:00 IST */
  for (let k = 0; k < 4; k++){
    later.push({
      t: Math.floor((evening + k * SPEC.barMs) / 1000),
      o: c, h: c + 0.1, l: c - 0.1, c: c
    });
  }
  const stacked = ctx.hgPureGoldRead(later, FAR);
  ok(stacked.status === 'aside' && stacked.reason === 'no fresh cross', 'inside the session, a stack without a new cross is not an entry');
  ok(stacked.dir == null && stacked.entry == null && stacked.stop == null, 'that stack gets no side and no levels');
  ok(stacked.stacked === 'above' && stacked.fast > stacked.slow, 'the stack is disclosed, and it is still not a vote');
}

console.log('\n== unread stays unread ==');
{
  ok(ctx.hgPureGoldRead(null, FAR).reason === 'tape unread', 'no rows is an unread tape');
  ok(ctx.hgPureGoldRead([], FAR).reason === 'tape unread', 'an empty tape is unread');
  const b = build('long');
  stamp(b.rows, b.cross, '2026-01-05T12:30:00Z');
  ok(ctx.hgPureGoldRead(b.rows, null).reason === 'clock unread', 'no clock means no setup');
  ok(ctx.hgPureGoldRead(b.rows, null).entry == null, 'an unread clock does not invent an entry');

  const shortTape = [];
  const t0 = Date.parse('2026-01-05T12:30:00Z');
  for (let i = 0; i < 10; i++){
    const c = 2300 + i;
    shortTape.push({ t: Math.floor((t0 + i * SPEC.barMs) / 1000), o: c, h: c + 1, l: c - 1, c: c });
  }
  const unread = ctx.hgPureGoldRead(shortTape, FAR);
  ok(unread.reason === 'ema unread' && unread.entry == null && unread.stop == null, 'ten bars cannot price an EMA 55 or a stop');

  const forming = b.rows.slice(0, b.cross + 1);
  const openMs = forming[b.cross].t * 1000;
  const mid = ctx.hgPureGoldRead(forming, openMs + 60 * 1000);
  ok(mid.status === 'aside' && mid.entry == null && mid.stop == null, 'a cross on the forming bar is not a signal');
}

console.log('\n== the tab is wired into the gold group ==');
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  ok(html.indexOf('puregold.js') >= 0, 'index.html loads puregold.js');
  ok(/\{ id:'gold',\s*label:'GOLD',\s*tabs:\[[^\]]*'puregold'/.test(html), 'PURE GOLD is in the GOLD nav group');
  ok(sw.indexOf('./puregold.js') >= 0, 'the shell precaches puregold.js');
  const tab = (ctx.HG_tabs || []).find(t => t && t.id === 'puregold');
  ok(!!tab && tab.label === 'PURE GOLD', 'it registers as PURE GOLD');
  ok(typeof tab.mount === 'function' && typeof tab.refresh === 'function', 'mount and refresh are both there');
  const src = fs.readFileSync(path.join(ROOT, 'puregold.js'), 'utf8');
  ok(!/hgFwdRecord|recordForward/.test(src), 'it writes no forward row — there is no settled book to grade');
}

console.log('\n' + passed + ' passed, 0 failed');
