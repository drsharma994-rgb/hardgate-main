#!/usr/bin/env node
/* hg-v1164 — new gold Pine layers on GOLD PINE as RECORD-ONLY mechanics.

   Asked for new gold Pine layers after hg-v1163 said why none was added: on
   the measured record a new detector is an unmeasured gate (hg-v966) or
   noise with a label (hg-v987 / v945 / v922). The honest form is the hg-v933
   one: a mechanic that MINTS, is RECORDED on every signal bar, PRINTS its
   levels, and cannot lead or be handed over until the forward ledger reads
   it paying. Five bar-only ports (Supertrend 10x3, Ichimoku TK cross,
   Donchian 20/10, EMA 8/21 + RSI50, Keltner pullback) live in a table of
   their own in pinegoldmath.js so the ten layers, the confluence rows and
   every existing record stay byte-identical; GOLD PINE carries them across
   its seams, records them, withholds the two handoffs and the MOST PROBABLE
   pin, and releases a layer only when hgFwdJudgeSample on that mechanic's
   own pool clears the house floor AND pays.

   Sections:
     1  the five detectors: each fires on a crafted or found bar, in both
        directions, only on the last closed bar, never with a wrong-side stop
     2  the table: five entries, none in PINE_GOLD_LAYERS, the universe and the
        confluence untouched by it; the setups built through the one layer
        builder and stamped record-only + demoted
     3  GOLD PINE end to end: rows on the board, recorded under GOLDPINE with
        the layer label as mechanic, chip + withheld handoff on the card, the
        Ichimoku card quoting its OMNIGOLD twin, the pin never choosing one,
        the ten layers' rows byte-identical with and without the table
     4  the release: 20 settled wins release the layer (handoff + pin back),
        20 settled losses keep it record-only and say so, 19 wins stay under
        the floor, no ledger loaded releases nothing
     5  nothing gated, one home, stamps */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const settle = async (n) => { for (let i = 0; i < (n || 3); i++){ await new Promise(r => setImmediate(r)); await new Promise(r => setTimeout(r, 0)); } };
const body = (src, head) => { const i = src.indexOf(head); if (i < 0) return ''; return src.slice(i, src.indexOf('\n}\n', i) + 2); };

const WED = Date.UTC(2026, 3, 8, 12, 0, 0);
function tapeEnding(endMs, n, stepSec, seed, amp, drift){
  let s = seed || 99, rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const rows = []; let c = 2300;
  const tEnd = Math.floor(endMs / 1000), t0 = tEnd - (n - 1) * stepSec;
  for (let i = 0; i < n; i++){
    const shock = (rnd() < 0.06) ? (rnd() - 0.5) * (amp || 24) : 0;
    const o = c; c = o + (drift || 0) * (stepSec / 14400) + Math.sin(i / 25) * 2.0 + (rnd() - 0.5) * 3.4 + shock;
    const w = 0.8 + rnd() * 2.6;
    rows.push({ t: t0 + i * stepSec, o, h: Math.max(o, c) + w, l: Math.min(o, c) - w, c, v: 700 + rnd() * 2200 });
  }
  return rows;
}
/* the same tape upside down: every level reflected through 2400 */
const mirror = rows => rows.map(r => ({ t: r.t, o: 4800 - r.o, h: 4800 - r.l, l: 4800 - r.h, c: 4800 - r.c, v: r.v }));
function mkEl(){
  const kids = {}, ctl = {};
  const e = { style: {}, innerHTML: '', textContent: '', disabled: false, className: '', dataset: {}, attrs: {}, listeners: {},
    appendChild(){}, setAttribute(k, v){ this.attrs[k] = String(v); }, getAttribute(k){ return this.attrs[k]; },
    addEventListener(t, f){ (this.listeners[t] = this.listeners[t] || []).push(f); }, removeEventListener(){},
    click(){ (this.listeners.click || []).forEach(f => f()); },
    classList: { add(){}, remove(){}, toggle(){}, contains: () => false },
    querySelector(sel){ return kids[sel] || (kids[sel] = mkEl()); },
    querySelectorAll(sel){
      const m = sel.match(/^\[([a-z0-9-]+)\]$/i);
      if (!m) return [];
      const re = new RegExp(m[1] + '="([^"]*)"', 'g'); const out = []; let x;
      while ((x = re.exec(String(this.innerHTML)))){
        const k = m[1] + '=' + x[1];
        if (!ctl[k]){ ctl[k] = mkEl(); ctl[k].attrs[m[1]] = x[1]; }
        if (out.indexOf(ctl[k]) < 0) out.push(ctl[k]);
      }
      return out;
    } };
  return e;
}
function boot(files, clock, extra){
  const FakeDate = clock ? class extends Date { static now(){ return clock.now; } } : Date;
  const ctx = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, Date: FakeDate, Number, String, Object, Array, JSON, Error, TypeError, Promise, RegExp,
    Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt, Float64Array, Infinity, NaN,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {}, setImmediate,
    encodeURIComponent, decodeURIComponent };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  const store = {};
  ctx.localStorage = { getItem: k => (k in store ? store[k] : null), setItem(k, v){ store[k] = String(v); }, removeItem(k){ delete store[k]; }, clear(){} };
  ctx.sessionStorage = ctx.localStorage;
  const byId = {};
  ctx.document = { createElement: mkEl, getElementById: id => (byId[id] || (byId[id] = mkEl())), querySelector: () => mkEl(), querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){}, contains: () => true }, documentElement: { appendChild(){} },
    addEventListener(){}, removeEventListener(){}, visibilityState: 'visible', readyState: 'complete' };
  ctx.fetch = () => Promise.reject(new Error('no network'));
  ctx.navigator = { userAgent: 'node', onLine: false };
  if (extra) Object.assign(ctx, extra);
  vm.createContext(ctx);
  for (const f of files){ try { vm.runInContext(read(f), ctx, { filename: f }); } catch(e){ console.error('boot ' + f + ': ' + e.message); } }
  return ctx;
}
const MATH_BASE = ['indicators.js', 'indicators2.js', 'pinemath.js', 'pinegoldmath.js'];
const PINE_BASE = ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'setup-ui.js', 'gold-forward-read.js', 'hg-forward.js', 'gold-formation.js',
                   'goldind.js', 'gold-catalog.js', 'gold-best-levels.js', 'gold-extra-strategies.js', 'pinemath.js', 'pinegoldmath.js', 'goldpine.js', 'accuracy-floor.js'];
const LAYER_IDS = ['supertrend', 'ichimoku', 'donchian', 'emacross', 'keltner'];
const LAYER_FNS = ['pineGoldSupertrend', 'pineGoldIchimoku', 'pineGoldDonchian', 'pineGoldEmaCrossRsi', 'pineGoldKeltnerPullback'];
const LABELS = { supertrend: 'Supertrend 10x3', ichimoku: 'Ichimoku TK Cross', donchian: 'Donchian 20/10', emacross: 'EMA 8/21 + RSI50', keltner: 'Keltner Pullback' };

/* the first window end on which a detector fires, searched over a tape */
function firstFire(fn, rows, opts, from){
  for (let end = from || 120; end <= rows.length; end++){
    const r = fn(rows.slice(0, end), opts);
    if (r && r.dir) return { end, res: r };
  }
  return null;
}
const sidesOk = r => r.dir === 'long' ? (r.stop < r.entry && r.t1 > r.entry && r.t2 > r.t1) : (r.stop > r.entry && r.t1 < r.entry && r.t2 < r.t1);

/* ------------------------------------------------------------------ 1 */
console.log('== 1) the five detectors fire on the last closed bar, both ways, never with a wrong-side stop ==');
{
  const W = boot(MATH_BASE);
  assert(LAYER_FNS.every(n => typeof W[n] === 'function'), 'the five detectors are exported');
  const tape = tapeEnding(WED, 600, 900, 102, 24, 0);
  const tapeUp = tapeEnding(WED, 600, 900, 103, 24, 40);
  const layerOpts = id => W.PINE_GOLD_RECORD_LAYERS.find(l => l.id === id).opts;
  /* Supertrend, Donchian, EMA cross: found on the synthetic tape */
  for (const [id, fn, rows] of [['supertrend', W.pineGoldSupertrend, tape], ['donchian', W.pineGoldDonchian, tape], ['emacross', W.pineGoldEmaCrossRsi, tape], ['ichimoku', W.pineGoldIchimoku, tapeUp]]){
    const f = firstFire(fn, rows, layerOpts(id), 150);
    assert(!!f, 'REACHABILITY: ' + LABELS[id] + ' fires somewhere on the tape' + (f ? ' (window ' + f.end + ', ' + f.res.dir + ')' : ''));
    if (!f) continue;
    const r = f.res;
    assert(r.newLong === (r.dir === 'long') && r.newShort === (r.dir === 'short') && r.barsAgo === 0 && r.recordOnly === true, LABELS[id] + ': the fire is NEW on the last closed bar (barsAgo 0), record-only');
    assert(r.entry === rows[f.end - 1].c && r.price === r.entry, LABELS[id] + ': entry is the signal bar\'s close');
    assert(sidesOk(r), LABELS[id] + ': stop on the far side, T1 / T2 on the near side (' + r.dir + ' ' + r.entry.toFixed(2) + ' sl ' + r.stop.toFixed(2) + ' t1 ' + r.t1.toFixed(2) + ')');
    const before = fn(rows.slice(0, f.end - 1), layerOpts(id));
    assert(!before || !before.dir, LABELS[id] + ': the window one bar earlier did not fire (first bar of the signal)');
    const m = fn(mirror(rows.slice(0, f.end)), layerOpts(id));
    assert(m && m.dir && m.dir !== r.dir && sidesOk(m), LABELS[id] + ': the mirrored tape fires the other way (' + (m && m.dir) + ')');
    const after = f.end < rows.length ? fn(rows.slice(0, f.end + 1), layerOpts(id)) : null;
    assert(!(after && after.dir === r.dir), LABELS[id] + ': the window one bar LATER does not fire the same way again (a flip or a cross is one bar, not a state)');
  }
  /* the secondary conditions, each against a bar that must NOT fire */
  {
    const f = firstFire(W.pineGoldEmaCrossRsi, tape, layerOpts('emacross'), 150);
    const realRsi = W.rsi;
    W.rsi = (v, p) => realRsi(v, p).map(() => 40);
    const low = W.pineGoldEmaCrossRsi(tape.slice(0, f.end), layerOpts('emacross'));
    W.rsi = (v, p) => realRsi(v, p).map(() => 60);
    const high = W.pineGoldEmaCrossRsi(tape.slice(0, f.end), layerOpts('emacross'));
    W.rsi = realRsi;
    assert(f.res.dir === 'long' ? (!low.dir && high.dir === 'long') : (!high.dir && low.dir === 'short'), 'EMA cross: the same cross bar with RSI14 on the wrong side of 50 does NOT fire, on the right side it does (' + f.res.dir + ')');
  }
  {
    const f = firstFire(W.pineGoldIchimoku, tapeUp, layerOpts('ichimoku'), 150);
    const win = tapeUp.slice(0, f.end).map(r => ({ ...r }));
    const i = win.length - 1;
    /* the Kumo under bar i is drawn from bar i-26 over the 52 bars before it,
       bars the Tenkan / Kijun at i never read: lift those highs and the cloud
       sits above the close while the cross is untouched */
    for (let k = i - 26 - 52; k <= i - 26; k++) win[k].h += 500;
    const inCloud = W.pineGoldIchimoku(win, layerOpts('ichimoku'));
    assert(f.res.dir === 'long' && !inCloud.dir, 'Ichimoku: the same TK cross with the close UNDER the Kumo does NOT fire');
  }
  /* Keltner: a crafted pullback -- a gentle uptrend, one deep bar through the lower band, one bar back above it and up */
  const kRows = []; let px = 2300; const t0 = Math.floor(WED / 1000) - 120 * 900;
  for (let i = 0; i < 120; i++){ const o = px; let c = o + 0.3, l = Math.min(o, c) - 0.4, h = Math.max(o, c) + 0.4;
    if (i === 118){ c = o - 8; l = c - 1; h = o + 0.3; }
    if (i === 119){ c = o + 6; l = o - 0.5; h = c + 0.5; }
    kRows.push({ t: t0 + i * 900, o, h, l, c, v: 1000 }); px = c; }
  const k = W.pineGoldKeltnerPullback(kRows, layerOpts('keltner'));
  assert(k && k.dir === 'long' && k.recordOnly && k.barsAgo === 0 && sidesOk(k), 'REACHABILITY: Keltner pullback fires LONG on the crafted recovery bar (' + JSON.stringify(k && { dir: k.dir, entry: k.entry, stop: k.stop }) + ')');
  assert(k && k.stop === Math.min(kRows[118].l, kRows[119].l), 'its stop is the pullback low');
  const kNo = W.pineGoldKeltnerPullback(kRows.slice(0, 119), layerOpts('keltner'));
  assert(!kNo.dir, 'the dip bar itself does not fire (the close is still below the band)');
  const kDown = kRows.map(r => ({ ...r }));
  /* the recovery bar gaps up above the band and closes DOWN: back inside, not up */
  kDown[119] = { t: kRows[119].t, o: kRows[117].c - 2, h: kRows[117].c - 1.5, l: kRows[117].c - 3, c: kRows[117].c - 2.5, v: 1000 };
  const kD = W.pineGoldKeltnerPullback(kDown, layerOpts('keltner'));
  assert(kD && !kD.dir, 'a recovery bar that reclaims the band but closes DOWN does not fire');
  const kM = W.pineGoldKeltnerPullback(mirror(kRows), layerOpts('keltner'));
  assert(kM && kM.dir === 'short' && sidesOk(kM), 'the mirrored pullback fires SHORT');
  /* none of the five fires on a dead-flat tape, and none throws on junk */
  const flat = kRows.map((r, i) => ({ t: r.t, o: 2300, h: 2300.5, l: 2299.5, c: 2300, v: 1 }));
  assert(LAYER_FNS.every(n => { const r = W[n](flat, {}); return r && !r.dir; }), 'a dead-flat tape fires none of the five');
  assert(LAYER_FNS.every(n => { const r = W[n]([{ t: 1, o: null, h: 'x', l: NaN, c: undefined }], {}); return r && !r.dir; }), 'a junk tape is no signal and no throw');
  assert(LAYER_FNS.every(n => { const r = W[n](null, {}); return r && !r.dir; }), 'no rows is no signal');
  /* a wrong-side stop is no signal: Donchian's exit channel above a long entry */
  const dRows = tape.slice(0, 300).map(r => ({ ...r }));
  const dF = firstFire(W.pineGoldDonchian, tape, layerOpts('donchian'), 150);
  if (dF && dF.res.dir === 'long'){
    const win = tape.slice(0, dF.end).map(r => ({ ...r }));
    for (let i = win.length - 11; i < win.length - 1; i++) win[i].l = win[win.length - 1].c + 50;   /* the exit channel sits ABOVE the entry */
    const bad = W.pineGoldDonchian(win, layerOpts('donchian'));
    assert(bad && !bad.dir, 'a stop that would sit on the wrong side of the entry is NO signal, not a signal with inverted geometry');
  } else assert(true, '(wrong-side case driven on the short branch below)');
  const dS = firstFire(W.pineGoldDonchian, mirror(tape), layerOpts('donchian'), 150);
  if (dS && dS.res.dir === 'short'){
    const win = mirror(tape).slice(0, dS.end).map(r => ({ ...r }));
    for (let i = win.length - 11; i < win.length - 1; i++) win[i].h = win[win.length - 1].c - 50;
    const bad = W.pineGoldDonchian(win, layerOpts('donchian'));
    assert(bad && !bad.dir, 'the mirrored wrong-side stop is NO signal either');
  }
  void dRows;
}

/* ------------------------------------------------------------------ 2 */
console.log('== 2) the table: its own home, the ten layers and the universe untouched ==');
{
  const W = boot(MATH_BASE);
  const T = W.PINE_GOLD_RECORD_LAYERS;
  assert(Array.isArray(T) && T.length === 23 && T.slice(0, 5).map(l => l.id).join(',') === LAYER_IDS.join(',') && T.slice(5, 8).map(l => l.id).join(',') === 'macd,psar,stoch' && T.slice(8, 12).map(l => l.id).join(',') === 'chandelier,hullma,cci,aroon' && T.slice(12, 15).map(l => l.id).join(',') === 'williams,trix,fisher' && T.slice(15, 18).map(l => l.id).join(',') === 'adx,heikin,sessvwap' && T.slice(18, 22).map(l => l.id).join(',') === 'qqe,squeeze,wavwap,efficiency' && T[22].id === 'bpr', 'record layers keep their order and hg-v1202 appends BPR after the hg-v1173 formation family (' + T.map(l => l.id).join(' · ') + ')');
  assert(T.every(l => (LABELS[l.id] ? l.label === LABELS[l.id] : typeof l.label === 'string') && typeof W[l.fn] === 'function' && l.minBars > 0 && l.opts), 'each names its label, its detector and its minimum bars');
  assert(T.find(l => l.id === 'ichimoku').twin === 'ICHI-KUMO' && T.slice(0, 5).filter(l => l.twin).length === 1, 'Ichimoku names its exact OMNIGOLD twin ICHI-KUMO; the other four of the five name none');
  assert(!T.some(l => /pivot/i.test(l.id) || /PIVOT-REJECT/.test(String(l.twin))), 'the daily-pivot bounce is NOT in the table (its twin PIVOT-REJECT is a measured failure past the veto bar)');
  assert(W.PINE_GOLD_LAYERS.length === 10 && !W.PINE_GOLD_LAYERS.some(l => LAYER_IDS.includes(l.id)), 'PINE_GOLD_LAYERS still holds the ten and none of the five');
  const src = strip(read('pinegoldmath.js'));
  for (const h of ['function pineGoldEvalDir(', 'function pineGoldConfluence(', 'function pineGoldUniverse(']){
    assert(!/PINE_GOLD_RECORD_LAYERS|pineGoldRecordLayerSetups/.test(body(src, h)), h.replace('function ', '').replace('(', '') + ' never reads the record table (the confluence and the universe are untouched by it; textual, hg-v956)');
  }
  const tape = tapeEnding(WED, 600, 900, 102, 24, 0);
  const uni = W.pineGoldUniverse(tape, { mode: 'scalp' });
  assert(!uni.setups.some(s => s.recordOnly || LAYER_IDS.includes(s.layerId)), 'pineGoldUniverse emits no record-only row');
  const f = firstFire(W.pineGoldSupertrend, tape, T[0].opts, 150);
  const win = tape.slice(0, f.end);
  const out = W.pineGoldRecordLayerSetups(win, 'scalp');
  const st = out.find(s => s.layerId === 'supertrend');
  assert(!!st, 'REACHABILITY: pineGoldRecordLayerSetups mints the Supertrend row on the fire window');
  assert(st.recordOnly === true && st.demoted === true && /RECORD ONLY/.test(st.demotedWhy) && /Supertrend 10x3/.test(st.demotedWhy), 'stamped record-only + demoted, the reason naming the layer');
  assert(st.recordLayer === 'supertrend' && st.recordTwin === null && st.kind === 'layer' && st.layerLabel === 'Supertrend 10x3', 'carries the layer id, its (absent) twin, kind layer and the label that is its mechanic key');
  assert(st.tier === 'primary' && st.isNew === true && st.display === true && isFinite(st.rr) && st.rr > 0, 'a fresh flip is a primary, new, displayed row with a measured R:R');
  const viaBuilder = W.pineGoldLayerSetup(T[0], W.pineGoldSupertrend(win, T[0].opts), f.res.dir, win, 'scalp');
  assert(viaBuilder && viaBuilder.entry === st.entry && viaBuilder.stop === st.stop && viaBuilder.t1 === st.t1 && viaBuilder.t2 === st.t2, 'built through the ONE layer builder the ten layers use (same levels)');
  assert(W.pineGoldRecordLayerSetups(null, 'scalp').length === 0 && W.pineGoldRecordLayerSetups([], 'swing').length === 0, 'no rows, no setups');
  const uni2 = W.pineGoldUniverse(win, { mode: 'scalp' });
  assert(!uni2.setups.some(s => s.recordOnly), 'and on the very window the record layer fires, the universe still carries no record-only row');
}

/* ------------------------------------------------------------------ 3 */
console.log('== 3) GOLD PINE end to end ==');
const MACRO_ALL = { silverTrend: 'RISING', gsRatioTrend: 'FALLING', vixTrend: 'RISING', usdjpyTrend: 'FALLING',
                    realRateHint: 'TAILWIND', dxy: { trend20: 'FALLING' }, tnxTrend: 'RISING', realRateSource: 'yahoo' };
/* a detector stubbed to fire on the tape in hand: the REAL table, the REAL
   builder, the REAL desk seams run; only whether the bar fired is fixed */
function stubFire(dir){
  return function(rows){ const c = rows[rows.length - 1].c; const risk = 6;
    const stop = dir === 'long' ? c - risk : c + risk;
    return { dir, newLong: dir === 'long', newShort: dir === 'short', barsAgo: 0, price: c, entry: c, stop,
             t1: dir === 'long' ? c + 2 * risk : c - 2 * risk, t2: dir === 'long' ? c + 3.5 * risk : c - 3.5 * risk, recordOnly: true }; };
}
async function pineRun(opts){
  opts = opts || {};
  const clock = { now: WED + 16 * 60 * 1000 };
  const tapes = { '15m': tapeEnding(WED, 300, 900, 102, 24, 0), '1h': tapeEnding(WED, 240, 3600, 103, 30, 0),
                  '4h': tapeEnding(WED, 300, 14400, 104, 40, 6), '1d': tapeEnding(WED, 280, 86400, 105, 60, 20) };
  const pinned = [];
  const extra = {
    getGoldCandles: async tf => ({ rows: tapes[tf] || [], source: 'binance-xau' }),
    hgGoldLiveFeed: async () => ({ perp: null, quote: null, l2: null, macro: null }),
    getGoldMacro: async () => MACRO_ALL,
    goldspotState: () => ({ verdict: 'shorts-crowding', basisPct: -0.2 }),
    S: { fng: { v: 20 } },
    binanceFunding: async () => ({ fundingPct: -0.05 }),
    hgMpPin: (kind, list) => { pinned.push(list); }
  };
  const files = PINE_BASE.filter(f => !(opts.drop || []).includes(f));
  const W = boot(files, clock, extra);
  /* setup-ui.js defines the real hgMpPin at boot; the capture goes on AFTER */
  W.hgMpPin = (kind, list) => { pinned.push(list); };
  if (!opts.noStub){
    W.pineGoldSupertrend = stubFire('long');
    W.pineGoldIchimoku = stubFire('short');
  }
  if (opts.noRecordTable) W.pineGoldRecordLayerSetups = undefined;
  if (opts.before) opts.before(W, tapes);
  const tab = W.HG_tabs.find(t => t && t.id === 'goldpine');
  const el = mkEl();
  tab.mount(el);
  const t0 = Date.now();
  while (Date.now() - t0 < 20000){
    await settle(2);
    const st = el.querySelector('#goldPineStat').textContent;
    if (/^done|^error|^failed/.test(st)) break;
  }
  return { W, el, tapes, pinned, snap: W.goldPineScan(), stat: el.querySelector('#goldPineStat').textContent, html: el.querySelector('#goldPineOut').innerHTML };
}
/* the ledger seed: N settled records under this lane's pool for one mechanic,
   dated on past bars of the tape, settled on the tape's own next bars */
function seedLedger(W, rows, mode, mechanic, n, win){
  const tf = mode === 'swing' ? '4h' : '15m';
  let wrote = 0;
  for (let i = 40; i < 40 + n; i++){
    const b = rows[i], c = b.c;
    /* a long either way: a WIN puts the target half a point up and the stop 30
       down (the next bar's high clears it); a LOSS puts the stop half a point
       down and the target 30 up (the next bar's low takes it) */
    const entry = c, stop = win ? c - 30 : c - 0.5, t1 = win ? c + 0.5 : c + 30;
    const r = W.hgFwdRecord({ tab: 'GOLDPINE:' + mode, mechanic, sym: 'XAUUSD', tf, dir: 'long', entry, stop, t1, barT: b.t, horizonBars: 12 });
    if (r === 'recorded' || r === 'added' || r === true || r === 'ok') wrote++;
  }
  W.hgFwdResolve('XAUUSD', tf, rows);
  return wrote;
}
const cardOf = (html, label) => { const i = html.indexOf('· ' + label + ' · Grade'); if (i < 0) return ''; const s = html.lastIndexOf('<div class="panel', i); const e = html.indexOf('<div class="panel', i + 1); return html.slice(s, e < 0 ? undefined : e); };
{
  const r = await pineRun();
  assert(/^done/.test(r.stat), 'REACHABILITY: the real tab mounted, scanned and painted (' + r.stat + ')');
  const all = r.snap.swing.concat(r.snap.scalp);
  const rec = all.filter(s => s.recordOnly);
  assert(rec.length === 4, 'REACHABILITY: four record-only rows on the board (Supertrend long + Ichimoku short, both lanes): ' + rec.map(s => s.mode + ':' + s.layerLabel + ':' + s.dir).join(' · '));
  assert(rec.every(s => s.demoted === true && /RECORD ONLY/.test(s.demotedWhy) && s.recordJudge && s.recordJudge.n === 0 && s.recordJudge.floor === 20 && s.recordJudge.measured === false), 'each is demoted, record-only, judged at 0 of the house floor 20, unmeasured');
  assert(rec.every(s => s.freeReads && s.indReads && s.fundingPct === -0.05 && s.goldShut !== undefined), 'each carries the hg-v1162 read marks, the funding print and the calendar mark like every other row');
  assert(/ · 4 record-only/.test(r.stat), 'the stat line counts them (' + r.stat + ')');
  /* recorded under the lane pool with the layer label as mechanic */
  for (const mode of ['scalp', 'swing']){
    const recs = r.W.hgFwdRecords('GOLDPINE:' + mode) || [];
    const st = recs.find(x => x.mechanic === 'Supertrend 10x3'), ic = recs.find(x => x.mechanic === 'Ichimoku TK Cross');
    const row = rec.find(s => s.mode === mode && s.layerLabel === 'Supertrend 10x3');
    assert(!!st && !!ic, mode + ': both record-only layers are RECORDED under GOLDPINE:' + mode + ' with the layer label as mechanic');
    assert(st && row && st.entry === row.entry && st.stop === row.stop && st.t1 === row.t1 && st.dir === 'long' && ic.dir === 'short', mode + ': the record carries the row\'s own levels and direction');
    const tape = r.tapes[mode === 'swing' ? '4h' : '15m'];
    assert(st && st.barT === tape[tape.length - 1].t && st.feed === 'binance-xau' && st.reads && st.reads['free:silver'] === true, mode + ': dated on the lane\'s signal bar, naming its feed, carrying the read marks');
  }
  /* the card: chip, withheld handoff, no button; the twin quoted on Ichimoku */
  const stCard = cardOf(r.html, 'SCALP · 15m · Supertrend 10x3'), icCard = cardOf(r.html, 'SCALP · 15m · Ichimoku TK Cross');
  assert(stCard.length > 500 && icCard.length > 500, 'REACHABILITY: both record-only cards painted');
  assert(/RECORD ONLY · 0 of 20 settled/.test(stCard) && /NO TRADE HANDOFF — RECORD ONLY/.test(stCard) && !/class="toTrade"/.test(stCard) && !/ADD TO BOOK/.test(stCard),
    'the Supertrend card carries the RECORD ONLY chip and the withheld-handoff note, and NO handoff button');
  assert(/recorded under GOLDPINE:scalp|recorded under GOLDPINE:swing/.test(stCard) && /paying at or over 20 settled/.test(stCard), 'the note names the pool and the release rule');
  assert(/OMNIGOLD ICHI-KUMO, gate-clear n=106, 89 settled, −0\.161R net at XM, z −1\.27/.test(icCard) && /OMNIGOLD’s gates and 1h horizon/.test(icCard), 'the Ichimoku card quotes its twin\'s gate-clear record through hgGoldSiblingRecord, attributed to OMNIGOLD\'s gates and horizon');
  assert(!/Nearest measured twin/.test(stCard), 'the Supertrend card, with no twin, quotes none');
  assert(/4 RECORD-ONLY Pine layers on this scan/.test(r.html) && /withheld from MOST PROBABLE and the handoff/.test(r.html), 'the board names the record-only rows once');
  assert(/RECORD-ONLY LAYERS <span>4 fired this scan/.test(r.html) && (r.html.match(/NO TRADE HANDOFF — RECORD ONLY/g) || []).length === 4, 'the four paint in a section of their own below the two lanes (a demoted row sinks below the two-card cut and would otherwise never be seen), each with the handoff withheld');
  assert(r.html.indexOf('RECORD-ONLY LAYERS') > r.html.indexOf('SCALP SETUPS (15m)') && r.html.indexOf('RECORD-ONLY LAYERS') < r.html.indexOf('data-hg-gold-catalog'), 'the section sits below the lanes and above the census');
  /* the pin never chooses a record-only row */
  assert(r.pinned.length >= 1 && r.pinned[r.pinned.length - 1].every(s => !s.recordOnly), 'the MOST PROBABLE pin is handed a list with NO record-only row (' + r.pinned[r.pinned.length - 1].length + ' candidates)');
  assert(!/MOST PROBABLE stands empty/.test(r.html), 'and the held note does not blame the tape for a list the record-only rows never joined');
  /* the ten layers' rows are byte-identical with and without the table */
  const r0 = await pineRun({ noRecordTable: true });
  const key = s => [s.mode, s.kind, s.layerLabel || s.nativeStrategy || 'conf', s.dir, s.entry, s.stop, s.t1, s.t2, s.score, s.tier, s.isNew, s.isRecent, s.grade].join('|');
  const withT = all.filter(s => !s.recordOnly).map(key).sort().join('\n'), without = r0.snap.swing.concat(r0.snap.scalp).map(key).sort().join('\n');
  assert(withT === without && withT.length > 0, 'every non-record row (the ten layers, the confluence rows, the native rows) is byte-identical with and without the record table (' + r0.snap.swing.concat(r0.snap.scalp).length + ' rows)');
  assert(!r0.snap.swing.concat(r0.snap.scalp).some(s => s.recordOnly) && !/record-only/.test(r0.stat), 'with the table absent no record-only row forms and the stat line says nothing about one');
  const recKey = x => [x.tab, x.mechanic, x.dir, x.entry, x.stop, x.t1, x.barT].join('|');
  const ledgerWith = ['scalp', 'swing'].flatMap(m => r.W.hgFwdRecords('GOLDPINE:' + m)).filter(x => !LAYER_IDS.some(id => x.mechanic === LABELS[id])).map(recKey).sort().join('\n');
  const ledgerWithout = ['scalp', 'swing'].flatMap(m => r0.W.hgFwdRecords('GOLDPINE:' + m)).map(recKey).sort().join('\n');
  assert(ledgerWith === ledgerWithout, 'and the records the ten layers write are byte-identical too');
  /* a THIN board: nothing but the record-only rows forms, so they make the
     two-card cut -- and still may not lead, and the held note does not fire */
  const rt = await pineRun({ before: (W) => {
    W.pineGoldUniverse = () => ({ setups: [], confluence: { long: null, short: null, layers: {}, native: null }, at: 0 });
    W.goldScalpSetups = () => { const a = []; a.rejected = []; return a; };
    W.goldswingCollectCandidates = () => [];
  } });
  const thin = rt.snap.swing.concat(rt.snap.scalp);
  assert(thin.length === 4 && thin.every(s => s.recordOnly) && rt.snap.scalpTop.length === 2 && rt.snap.swingTop.length === 2, 'REACHABILITY: a thin board of four record-only rows, all inside the two-card cut');
  assert(rt.pinned.length >= 1 && rt.pinned[rt.pinned.length - 1].length === 0, 'the pin is handed an EMPTY list: a record-only row never leads even when it is all there is');
  assert(!/MOST PROBABLE stands empty/.test(rt.html), 'and the held note does not fire (there was no leadable row for the tape to hold)');
  assert((rt.html.match(/NO TRADE HANDOFF — RECORD ONLY/g) || []).length === 4 && !/RECORD-ONLY LAYERS <span>/.test(rt.html), 'the four paint once, in the lanes, with the handoff withheld; the extra section does not paint them twice');
  assert(/4 RECORD-ONLY Pine layers on this scan/.test(rt.html), 'the board still names them');
  /* the real detectors on the real tapes: no throw, and whatever fires is record-only */
  const rr = await pineRun({ noStub: true });
  assert(/^done/.test(rr.stat) && rr.snap.swing.concat(rr.snap.scalp).every(s => !LAYER_IDS.includes(s.recordLayer) || s.recordOnly), 'with the real detectors the scan completes and every layer row that fired is record-only (' + rr.snap.swing.concat(rr.snap.scalp).filter(s => s.recordOnly).length + ' fired on these tapes)');
}

/* ------------------------------------------------------------------ 4 */
console.log('== 4) the release is a measurement ==');
{
  /* 20 settled wins: released */
  const r = await pineRun({ before: (W, tapes) => { seedLedger(W, tapes['15m'], 'scalp', 'Supertrend 10x3', 20, true); } });
  const st = r.snap.scalp.find(s => s.layerLabel === 'Supertrend 10x3');
  const stats = r.W.hgFwdStats('GOLDPINE:scalp', 'Supertrend 10x3', false);
  assert(stats.samples >= 20 && stats.expR > 0, 'REACHABILITY: the seeded pool reads ' + stats.samples + ' settled at ' + (+stats.expR).toFixed(3) + 'R');
  assert(st && st.recordReleased === true && st.recordOnly === false && st.demoted === false && st.demotedWhy === undefined, 'the Supertrend scalp row is RELEASED: not record-only, not demoted');
  assert(st && st.recordJudge.measured && st.recordJudge.paying && st.recordJudge.n >= 20 && st.recordJudge.expR > 0, 'its judge reads measured, paying (' + st.recordJudge.n + ' at ' + st.recordJudge.expR.toFixed(3) + 'R)');
  const stCard = cardOf(r.html, 'SCALP · 15m · Supertrend 10x3');
  assert(/MEASURED · \d+ settled \+/.test(stCard) && /class="toTrade"/.test(stCard) && !/NO TRADE HANDOFF — RECORD ONLY/.test(stCard), 'its card carries the MEASURED chip and the handoff button again');
  assert(/released by the forward ledger \(Supertrend 10x3\)/.test(r.html), 'the board says which layer the ledger released');
  const ic = r.snap.scalp.find(s => s.layerLabel === 'Ichimoku TK Cross');
  assert(ic && ic.recordOnly === true && ic.demoted === true, 'the Ichimoku row, with no record, stays record-only — the release is per mechanic');
  const sw = r.snap.swing.find(s => s.layerLabel === 'Supertrend 10x3');
  assert(sw && sw.recordOnly === true, 'the SWING Supertrend row stays record-only — the release is per lane (its pool is GOLDPINE:swing)');
  const tabR = r.W.HG_tabs.find(t => t && t.id === 'goldpine');
  assert(tabR.mayLead(st) === true && r.snap.scalpTop.indexOf(st) >= 0 && !r.pinned[r.pinned.length - 1].some(s => s.recordOnly),
    'the released row may lead (it made the two-card cut and passes the lead predicate); the record-only ones still may not');
  /* 20 settled losses: measured, not paying, stays record-only and says so */
  const rl = await pineRun({ before: (W, tapes) => { seedLedger(W, tapes['15m'], 'scalp', 'Supertrend 10x3', 20, false); } });
  const stl = rl.snap.scalp.find(s => s.layerLabel === 'Supertrend 10x3');
  assert(stl && stl.recordOnly === true && stl.demoted === true && stl.recordJudge.measured && !stl.recordJudge.paying && stl.recordJudge.expR <= 0, 'twenty settled losses: measured, not paying, still record-only (' + stl.recordJudge.n + ' at ' + stl.recordJudge.expR.toFixed(3) + 'R)');
  assert(/measured 20 settled at −1\.000R on this desk, not paying/.test(stl.demotedWhy), 'and the reason says so: ' + stl.demotedWhy);
  const cardL = cardOf(rl.html, 'SCALP · 15m · Supertrend 10x3');
  assert(/RECORD ONLY · measured 20 at −1\.000R/.test(cardL) && !/class="toTrade"/.test(cardL), 'the card chip names the measured figure and the handoff stays withheld');
  /* 19 wins: under the floor */
  const ru = await pineRun({ before: (W, tapes) => { seedLedger(W, tapes['15m'], 'scalp', 'Supertrend 10x3', 19, true); } });
  const stu = ru.snap.scalp.find(s => s.layerLabel === 'Supertrend 10x3');
  assert(stu && stu.recordOnly === true && stu.recordJudge.measured === false && stu.recordJudge.n === 19, 'nineteen settled wins are under the floor: unmeasured, record-only, the count carried (' + stu.recordJudge.n + ' of 20)');
  assert(/RECORD ONLY · 19 of 20 settled/.test(cardOf(ru.html, 'SCALP · 15m · Supertrend 10x3')), 'the chip says how far');
  /* the floor is the house's, read at call time */
  const rf = await pineRun({ before: (W, tapes) => { W.HG_GOLD_FWD_MIN_JUDGE = 10; seedLedger(W, tapes['15m'], 'scalp', 'Supertrend 10x3', 12, true); } });
  const stf = rf.snap.scalp.find(s => s.layerLabel === 'Supertrend 10x3');
  assert(stf && stf.recordReleased === true && stf.recordJudge.floor === 10, 'the floor is HG_GOLD_FWD_MIN_JUDGE read at call time (12 wins release at a floor of 10)');
  /* no ledger: nothing measured, nothing released, nothing thrown */
  const rn = await pineRun({ drop: ['hg-forward.js', 'gold-forward-read.js'] });
  const stn = rn.snap.scalp.find(s => s.layerLabel === 'Supertrend 10x3');
  assert(/^done/.test(rn.stat) && stn && stn.recordOnly === true && stn.recordJudge.n === 0 && !stn.recordReleased, 'with no ledger loaded the row stays record-only: nothing can be measured, so nothing is released');
}

/* ------------------------------------------------------------------ 5 */
console.log('== 5) nothing gated, one home, stamps ==');
{
  /* hg-v1166: goldind.js MINTS the record layers on GOLD SCALP now (record-only,
     through the one judge), so it names the field -- the gate modules still do not */
  for (const f of ['hg-gates.js', 'cryptogates.js', 'engine.js', 'gold-best-levels.js', 'gold-formation.js', 'hg-forward.js', 'hg-solidity.js', 'plans.js']){
    assert(!/recordOnly|recordReleased|PINE_GOLD_RECORD_LAYERS/.test(strip(read(f))), f + ' never names a record-only field');
  }
  const gp = strip(read('goldpine.js'));
  for (const h of ['function sortSetups(', 'function probScore(', 'function gpTapeAligned(']){
    assert(!/recordOnly|recordReleased/.test(body(gp, h)), h.replace('function ', '').replace('(', '') + ' does not read the record-only mark (the pin exclusion lives at the pin site through gpMayLead; textual)');
  }
  assert((gp.match(/gpMayLead\)/g) || []).length >= 2, 'the pin list and its count both pass through gpMayLead');
  assert(/pineGoldRecordJudge/.test(body(gp, 'function gpRecordLayerJudge(')) && !/hgFwdJudgeSample/.test(gp) && /HG_GOLD_FWD_MIN_JUDGE/.test(body(strip(read('pinegoldmath.js')), 'function pineGoldRecordFloor(')) && /hgFwdJudgeSample/.test(body(strip(read('pinegoldmath.js')), 'function pineGoldRecordJudge(')), 'the release delegates to the ONE judge in pinegoldmath.js (hg-v1166), which reads the house floor and hgFwdJudgeSample, no bar of its own');
  const bs = read('build-stamp.js');
  assert(bs.includes("version: '" + HG_VER + "'"), 'build-stamp.js version is ' + HG_VER);
  assert(swCacheOk(read('sw.js')), 'sw.js HG_CACHE is ' + HG_VER);
}

console.log('\n' + (fail ? 'FAILED' : 'PASSED') + ' ' + pass + ' assertions' + (fail ? ' (' + fail + ' failed)' : ''));
process.exit(fail ? 1 : 0);
