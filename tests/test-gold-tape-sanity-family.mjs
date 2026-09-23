/* HARDGATE — THE WHOLE GOLD FAMILY SAYS WHEN ITS TAPE IS NOT MADE OF
   POSSIBLE CANDLES.

   Pack 906 gave GOLD SCALP a check for bars a market could not have
   produced — a high below its own low, a range that does not contain the
   body, a price that is not a number, a timestamp that repeats. Pack 907
   asked the obvious next question: what do the OTHER fifteen gold tabs do
   with such a tape?

   MEASURED, by driving index.html's whole GOLD nav group twice — once on a
   clean tape and once on the same tape with one bar in twenty inverted:

     8 of the 15 that can be driven rendered DIFFERENT NUMBERS
     1 of those 8 said so

   The eight were omnigold1, optigold, newgold, goldswing, goldscalp,
   goldultra, goldpine and 80percent, and the same eight move at 2%, 5% and
   10% inversion, so the set is a property of what each desk computes rather
   than of one draw. The one that spoke was GOLD SCALP, from pack 906.

   The size of the move is not uniform and is not "fewer setups": GOLD SWING
   rendered a THIRD LESS than on the clean tape, while OPTI GOLD and
   80PERCENT roughly DOUBLED. A malformed tape does not fail loudly. It
   quietly produces a different board.

   This file holds the rule for the family: a gold tab that fetches gold
   candles must be able to say when those candles are impossible. It checks
   the shared implementation's arithmetic, checks that it REPORTS rather than
   gates, checks by source that every candle-fetching gold tab is wired to
   it, and then re-runs the measurement above so the claim is evidence and
   not a comment.

   WHAT IT DOES NOT CLAIM. Four wired tabs — omnigold, golddirection, goldpro
   and tauric — still do not disclose in this harness, because the harness
   reaches their mount shell and not their scan. That is a limit of the
   harness, not a gap in the wiring, and it is asserted as such below: they
   are checked at the SOURCE for the call, not at the render. Saying "13 of
   15 disclose" would be the false half of a true sentence.

   Run: node tests/test-gold-tape-sanity-family.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const groupMatch = INDEX.match(/\{\s*id:\s*'gold',[^}]*tabs:\s*\[([^\]]*)\]/);
const GOLD = groupMatch
  ? groupMatch[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean)
  : [];
const SCRIPTS = [...INDEX.matchAll(/<script src="([A-Za-z0-9._/-]+\.js)(?:\?v=\d+)?"/g)].map(m => m[1]);

console.log('== the shared rule exists, and it loads before the tabs that use it ==');
{
  ok(fs.existsSync(path.join(ROOT, 'gold-tape-sanity.js')), 'gold-tape-sanity.js is on disk');
  const i = SCRIPTS.indexOf('gold-tape-sanity.js');
  ok(i >= 0, 'index.html loads it');
  /* Every GOLD-group tab's own file must come AFTER it, or the tab would see
     an undefined helper at load time. The map is derived from the group, not
     hand-written, so a seventeenth tab cannot slip past it. */
  const FILE_OF = { '80percent': 'eightypercent.js', gold: null };
  const late = [];
  for (const id of GOLD){
    const f = Object.prototype.hasOwnProperty.call(FILE_OF, id) ? FILE_OF[id] : (id + '.js');
    if (!f) continue;
    const j = SCRIPTS.indexOf(f);
    if (j >= 0 && j < i) late.push(f);
  }
  ok(late.length === 0, `all ${GOLD.length} gold tabs load after it` + (late.length ? (' — before it: ' + late.join(', ')) : ''));
  ok(/'\.\/gold-tape-sanity\.js'/.test(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')),
     'and the service worker caches it, so the offline shell is not missing the rule');
}

/* ---- the rule itself, run in isolation ---- */
const ctxS = { Math, isFinite, String, Number, RegExp, Array, Object, JSON };
ctxS.window = ctxS;
vm.createContext(ctxS);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'gold-tape-sanity.js'), 'utf8'), ctxS, { filename: 'gold-tape-sanity.js' });
const SAN = ctxS.hgGoldTapeSanity, NOTE = ctxS.hgGoldTapeSanityNote;
const bar = (t, o, h, l, c) => ({ t, o, h, l, c, v: 1 });

console.log('\n== it counts each kind of impossible candle, and names it ==');
{
  ok(typeof SAN === 'function' && typeof NOTE === 'function', 'both helpers are exported on window');

  const clean = [bar(1, 10, 11, 9, 10), bar(2, 10, 11, 9, 10.5), bar(3, 10.5, 12, 10, 11)];
  const r0 = SAN(clean);
  ok(r0.ok === true && r0.bad === 0 && r0.bars === 3, 'a clean tape reports ok with nothing bad');
  ok(NOTE(r0, '4h') === '', 'and renders no note at all — a clean tape is not something to announce');

  const inv = SAN([bar(1, 10, 9, 11, 10), bar(2, 10, 11, 9, 10)]);
  ok(inv.inverted === 1 && inv.bad === 1 && inv.ok === false, 'a high below its own low is counted as inverted');

  const body = SAN([bar(1, 10, 10.5, 9, 12), bar(2, 10, 11, 9, 10)]);
  ok(body.bodyOutside === 1 && body.inverted === 0, 'a close outside the range is bodyOutside, not inverted');

  const nf = SAN([bar(1, 10, NaN, 9, 10), bar(2, 10, 11, 9, 10)]);
  ok(nf.nonFinite === 1, 'a price that is not a number is counted');
  ok(SAN([null, bar(2, 10, 11, 9, 10)]).nonFinite === 1, 'and so is a missing bar, rather than throwing on it');

  const back = SAN([bar(5, 10, 11, 9, 10), bar(3, 10, 11, 9, 10)]);
  ok(back.timeOrder === 1, 'a timestamp that goes backwards is counted');
  ok(SAN([bar(5, 10, 11, 9, 10), bar(5, 10, 11, 9, 10)]).timeOrder === 1, 'and so is one that repeats');

  /* Each fault is named separately rather than folded into one number, so a
     reader can tell a merge that swapped two columns from a feed that sent
     nulls. */
  const note = NOTE(SAN([bar(1, 10, 9, 11, 10), bar(2, 10, 11, 9, 10)]), '4h');
  ok(/high below the low/.test(note), 'the note says which fault it found');
  ok(/4h bars/.test(note), 'and names the timeframe it was handed');
  ok(!/\bundefined\b/.test(NOTE(SAN([bar(1, 10, 9, 11, 10)]))), 'with no timeframe it says "bars", never "undefined bars"');
}

console.log('\n== absent is absent: it never invents a verdict it did not reach ==');
{
  for (const [label, input] of [['null', null], ['undefined', undefined], ['empty array', []], ['a non-array', 42], ['a string', 'x']]){
    const r = SAN(input);
    ok(r && r.bars === 0 && r.ok === true && r.bad === 0, `${label} reports bars:0 rather than a fabricated fault`);
    ok(NOTE(r, '4h') === '', `and renders nothing for ${label} — "no bars" is a different complaint, made elsewhere`);
  }
  const rows = [bar(1, 10, 9, 11, 10), bar(2, 10, 11, 9, 10)];
  const before = JSON.stringify(rows);
  SAN(rows);
  ok(JSON.stringify(rows) === before, 'and it does not touch the rows it was handed — no silent repair in passing');
}

console.log('\n== the cap bounds the work, and the count is allowed to say so ==');
{
  /* 6000 bars each carrying TWO faults. The walk stops at the cap; because a
     single bar can add two, the reported number may exceed it by one. That is
     documented in the source and pinned here, because a prettier clamped
     number would be a less true one. */
  const many = [];
  for (let i = 0; i < 6000; i++) many.push(bar(1, 10, 9, 11, 10));  /* inverted AND a repeating t */
  const r = SAN(many);
  ok(r.bars === 6000, 'it still reports the full bar count');
  ok(r.bad >= 5000 && r.bad <= 5001, `bad is ${r.bad} — the cap, or the cap plus the second fault on the last bar`);
  ok(r.inverted + r.timeOrder === r.bad, 'and the per-kind tallies still add up to it');
}

console.log('\n== it REPORTS; it does not gate, drop or correct ==');
{
  const note = NOTE(SAN([bar(1, 10, 9, 11, 10), bar(2, 10, 11, 9, 10)]), '15m');
  const txt = note.replace(/<[^>]+>/g, ' ');
  /* The promise sentence is checked first and then set aside, because it is
     the one place these words are ALLOWED to appear — it is what makes the
     promise. Everything before it is then held to the plain rule. An earlier
     draft of this file banned the vocabulary outright and failed on the
     disclaimer. */
  ok(/Nothing here is dropped or corrected/i.test(txt), 'the note states in as many words that nothing is dropped or corrected');
  const body = txt.replace(/Nothing here is dropped or corrected[\s\S]*$/i, ' ');
  for (const claim of ['removed', 'excluded', 'dropped', 'discarded', 'corrected', 'repaired', 'fixed', 'ignored', 'skipped'])
    ok(!new RegExp('\\b' + claim + '\\b', 'i').test(body),
       `and nowhere else does it say the bars were ${claim} — because they are not`);
  ok(/data-repair/i.test(note), 'and leaves the repair decision with the reader');
  const src = fs.readFileSync(path.join(ROOT, 'gold-tape-sanity.js'), 'utf8');
  ok(!/\.splice\(|\.filter\(|rows\s*=\s*rows\./.test(src.split('W.hgGoldTapeSanity =')[0]),
     'and the implementation contains no filter or splice — there is nowhere for a silent drop to hide');
}

console.log('\n== GOLD SCALP delegates rather than keeping a second copy ==');
{
  const gs = fs.readFileSync(path.join(ROOT, 'goldscalp.js'), 'utf8');
  ok(/W\.hgGoldTapeSanity\b/.test(gs), 'goldscalp.js calls the shared rule');
  ok(!/out\.inverted\+\+/.test(gs) && !/bodyOutside\+\+/.test(gs),
     'and no longer carries the counting loop itself — two copies of a rule are two things to drift');
  ok(/hgGoldTapeNotes\(rows, '15m'\)/.test(gs), "and it passes its own timeframe, so the note says 15m");
}

console.log('\n== every gold tab that fetches candles is wired to the rule ==');
{
  /* Earned exemptions, not asserted ones: each is checked to own no candle
     fetch of its own. A tab that grows one will fail here until it is wired. */
  const EXEMPT = {
    'super-gold.js': 'reads other desks\' published snapshots; fetches no gold candles of its own',
    'goldspot.js': 'a spot-price readout with no candle fetch at all'
  };
  const FETCH = /getGoldCandles|getXAUCandles|hgOgFetchRows|binanceKlines|fetchGoldKlines|getXmGoldCandles|getSilverCandles/;
  const FILE_OF = { '80percent': 'eightypercent.js', gold: null };
  const unwired = [], wired = [];
  for (const id of GOLD){
    const f = Object.prototype.hasOwnProperty.call(FILE_OF, id) ? FILE_OF[id] : (id + '.js');
    if (!f || !fs.existsSync(path.join(ROOT, f))) continue;
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const fetches = FETCH.test(src);
    /* Pack 908: a tab is wired if it reaches ANY of the shared tape rules.
       Most now call hgGoldTapeNotes, which asks both questions at once. */
    const calls = /hgGoldTape(Notes|Sanity|Gaps)\b/.test(src);
    if (Object.prototype.hasOwnProperty.call(EXEMPT, f)){
      ok(!fetches, `${f} is exempt and earns it — ${EXEMPT[f]}`);
      continue;
    }
    if (fetches && !calls) unwired.push(f);
    if (calls) wired.push(f);
  }
  ok(unwired.length === 0,
     `every candle-fetching gold tab calls the rule (${wired.length} wired)`
     + (unwired.length ? (' — not wired: ' + unwired.join(', ')) : ''));
  ok(wired.length >= 13, `${wired.length} of them, which is the whole group bar the two that own no tape`);
}

/* ------------------------------------------------------------------ */
/* THE MEASUREMENT ITSELF, re-run rather than quoted.                   */
/* ------------------------------------------------------------------ */
function makeDom(sink){
  const byKey = new Map();
  function node(key){
    if (byKey.has(key)) return byKey.get(key);
    const L = Object.create(null);
    const el = {
      _html: '', style: {}, dataset: {}, children: [], disabled: false, checked: false,
      textContent: '', value: '', tagName: 'DIV',
      classList: { _s: new Set(), add(c){ this._s.add(c); }, remove(c){ this._s.delete(c); },
                   toggle(c, o){ o ? this._s.add(c) : this._s.delete(c); }, contains(c){ return this._s.has(c); } },
      appendChild(c){ el.children.push(c); return c; }, removeChild(){}, remove(){},
      setAttribute(k, v){ el.dataset[k] = v; }, getAttribute(){ return null; }, removeAttribute(){},
      closest(){ return null; }, contains(){ return false; },
      addEventListener(t, f){ (L[t] || (L[t] = [])).push(f); }, removeEventListener(){},
      dispatchEvent(ev){ const a = L[(ev && ev.type) || 'click'] || []; let r;
                         for (const f of a){ try { r = f.call(el, ev); } catch (e) {} } return r; },
      click(){ return el.dispatchEvent({ type: 'click', target: el, preventDefault(){}, stopPropagation(){} }); },
      focus(){}, blur(){}, scrollIntoView(){},
      querySelector(s){ return node(key + ' ' + s); }, querySelectorAll(){ return []; },
      insertAdjacentHTML(_, h){ sink.push(String(h)); },
      getBoundingClientRect(){ return { top: 0, left: 0, width: 100, height: 20, bottom: 20, right: 100 }; },
      _listeners: L
    };
    Object.defineProperty(el, 'innerHTML', { get(){ return el._html; }, set(v){ el._html = String(v); sink.push(String(v)); } });
    byKey.set(key, el);
    return el;
  }
  return node;
}
const T0 = 1700000000 - (1700000000 % 86400);
const TFS = { '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '2h': 7200, '4h': 14400, '1d': 86400 };
function bars(n, tf, fault){
  /* Two faults, driven through the same harness because they are two
     questions about one tape: are the bars POSSIBLE (pack 907), and are they
     CONSECUTIVE (pack 908). */
  const invertPct = (fault && fault.invertPct) || 0;
  const holeBars = (fault && fault.holeBars) || 0;
  let p = 4000, s = 7;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const o = [];
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd() - 0.48) * 0.004);
    const r = p * 0.002 * (0.5 + rnd());
    let hi = p + r, lo = p - r;
    if (invertPct && rnd() < invertPct){ const t = hi; hi = lo; lo = t; }
    o.push({ t: T0 + i * tf, o: p - r * 0.25, h: hi, l: lo, c: p, v: 900 + rnd() * 1200 });
  }
  /* A contiguous run vanishes from the middle. Every remaining bar is
     individually possible — 907's check passes — but the array is no longer a
     continuous tape. */
  if (holeBars > 0 && n > holeBars * 3) o.splice(Math.floor(n / 2), holeBars);
  return o;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const strip = h => String(h).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

function boot(fault){
  const sharedSink = [];
  const node = makeDom(sharedSink);
  const store = Object.create(null);
  const doc = {
    createElement: t => { const n = node('new:' + t + ':' + Math.random()); n.tagName = String(t || 'div').toUpperCase(); return n; },
    createDocumentFragment: () => node('frag:' + Math.random()), getElementById: id => node('#' + id),
    querySelector: s => node('doc ' + s), querySelectorAll: () => [], head: node('head'), body: node('body'),
    documentElement: node('html'), addEventListener(){}, removeEventListener(){},
    hidden: false, visibilityState: 'visible', cookie: '', title: '', readyState: 'complete'
  };
  const ctx = {
    console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, isFinite, isNaN, parseFloat, parseInt, Number, String, Object, Array, JSON, Date, RegExp,
    Boolean, Set, Map, WeakMap, WeakSet, Symbol, Proxy, Reflect, Function,
    Promise, Error, TypeError, RangeError, NaN, Infinity, Intl,
    encodeURIComponent, decodeURIComponent, encodeURI, decodeURI, document: doc,
    setTimeout: (f, ms) => globalThis.setTimeout(f, Math.min(Number(ms) || 0, 5)),
    clearTimeout: h => globalThis.clearTimeout(h), setInterval: () => 0, clearInterval: () => {},
    requestAnimationFrame: f => globalThis.setTimeout(f, 0), cancelAnimationFrame: () => {},
    requestIdleCallback: f => globalThis.setTimeout(f, 0), cancelIdleCallback: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, performance: { now: () => Date.now() },
    TextEncoder, TextDecoder, URL, URLSearchParams, AbortController, structuredClone,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); },
                    removeItem: k => { delete store[k]; }, clear(){}, key: () => null, length: 0 },
    sessionStorage: { getItem: () => null, setItem(){}, removeItem(){} },
    matchMedia: () => ({ matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} }),
    WebSocket: function(){ this.close = () => {}; this.send = () => {}; this.addEventListener = () => {}; },
    alert(){}, confirm: () => false, prompt: () => null,
    btoa: s => Buffer.from(String(s), 'binary').toString('base64'),
    atob: s => Buffer.from(String(s), 'base64').toString('binary'),
    crypto: { getRandomValues: a => a, randomUUID: () => 'x' }
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.location = { href: 'https://x/', search: '', hash: '', protocol: 'https:', host: 'x',
                   hostname: 'x', origin: 'https://x', pathname: '/', reload(){} };
  ctx.navigator = { userAgent: 'node', onLine: true, language: 'en-GB', clipboard: { writeText: () => Promise.resolve() } };
  ctx.fetch = () => Promise.resolve({ ok: true, status: 200, headers: { get: () => null },
    json: () => Promise.resolve({ ok: true, decision: 'HOLD', confidence: 0.5, rationale: 'stub', agents: [], asOf: T0 }),
    text: () => Promise.resolve('{}') });
  vm.createContext(ctx);
  const failed = [];
  for (const f of SCRIPTS){
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)){ failed.push(f + ' (missing)'); continue; }
    try { vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); }
    catch (e) { failed.push(f + ' :: ' + e.message.slice(0, 80)); }
  }
  const mk = (res, count) => bars(Math.max(60, Math.min(220, count || 200)), TFS[String(res)] || 3600, fault);
  ctx.getXAUCandles    = async (r, c) => mk(r, c);
  ctx.getGoldCandles   = async (r, c) => ({ rows: mk(r, c), source: 'gold-spot' });
  ctx.getXmGoldCandles = async (r, c) => ({ rows: mk(r, c), source: 'xm-xauusd' });
  ctx.binanceKlines    = async (s, r, c) => mk(r, c);
  ctx.dropForming      = r => r;
  return { ctx, failed };
}

async function drive(fault){
  const { ctx, failed } = boot(fault);
  const reg = new Map((ctx.HG_tabs || []).filter(t => t && t.id).map(t => [t.id, t]));
  const out = {};
  for (const id of GOLD){
    if (!reg.has(id)) continue;
    const tab = reg.get(id);
    const sink = [];
    const node = makeDom(sink);
    try { tab.mount(node('root:' + id)); } catch (e) {}
    try { const r = tab.refresh && tab.refresh(); if (r && r.then) await Promise.race([r, sleep(20000)]); } catch (e) {}
    await sleep(120);
    out[id] = sink.map(strip).join(' · ');
  }
  return { out, failed };
}

console.log('\n== and the measurement is re-run, not quoted ==');
{
  const A = await drive(null);
  const B = await drive({ invertPct: 0.05 });
  ok(A.failed.length === 0 && B.failed.length === 0,
     `every script loaded on both runs — the comparison is of the real app, not a crippled one`);

  const numsOf = t => (String(t).match(/\d+\.\d+/g) || []).join(',');
  const ids = Object.keys(A.out);
  ok(ids.length >= 14, `${ids.length} gold tabs driven on each tape`);

  const moved = [], silentMovers = [], disclosed = [];
  for (const id of ids){
    const a = A.out[id], b = B.out[id] || '';
    const says = /MALFORMED BARS/.test(b);
    if (says) disclosed.push(id);
    if (numsOf(a) !== numsOf(b)){
      moved.push(id);
      if (!says) silentMovers.push(id);
    }
  }
  ok(moved.length >= 6,
     `${moved.length} tabs render different numbers on the malformed tape (${moved.join(', ')}) — the fault really is reaching them`);
  ok(silentMovers.length === 0,
     'and NOT ONE of them changes its numbers without saying why'
     + (silentMovers.length ? (' — silent: ' + silentMovers.join(', ')) : ''));
  ok(disclosed.length >= moved.length,
     `${disclosed.length} disclosed, against ${moved.length} that moved — a desk may report a fault that did not move its own numbers, which is the honest direction to err`);

  /* The clean tape must stay quiet. A banner that fires on good bars would
     train the reader to ignore it, which is worse than not having it. */
  const falsePositives = ids.filter(id => /MALFORMED BARS/.test(A.out[id]));
  ok(falsePositives.length === 0,
     'and no tab prints the banner on the CLEAN tape' + (falsePositives.length ? (': ' + falsePositives.join(', ')) : ''));

  /* ---- THE SECOND FAULT: a tape that is continuous no longer ---- */
  const G = await drive({ holeBars: 12 });
  ok(G.failed.length === 0, 'the holed-tape run loaded every script too');
  const movedG = [], silentG = [], saidG = [];
  for (const id of ids){
    const a = A.out[id], g = G.out[id] || '';
    const says = /TAPE NOT CONTINUOUS/.test(g);
    if (says) saidG.push(id);
    if (numsOf(a) !== numsOf(g)){ movedG.push(id); if (!says) silentG.push(id); }
  }
  /* Before this pack the same run gave FIVE movers and ZERO disclosures. The
     only gap check in the tree was gold-seven-step.js, on the 1H series, at a
     three-day threshold — so a 12-bar hole was invisible everywhere. */
  ok(movedG.length >= 4,
     `${movedG.length} tabs render different numbers on a tape with a 12-bar hole (${movedG.join(', ')})`);
  /* hg-v936. ONE SILENCE IS CORRECT, AND IT IS PROVED RATHER THAN EXCUSED.

     The synthetic hole is cut at the middle of the series, so WHERE it lands
     in real time depends on the tab's bar size. On a 1H series of this length
     it falls between Sat 05 Sep 13:00 and Sun 06 Sep 02:00 UTC — entirely
     inside the gold weekend closure — and the shared rule's own stated
     principle is that "a gap the closure fully explains is not a gap". A tab
     reading 1H bars therefore MOVES (twelve rows really are missing) and
     correctly says nothing, and making it warn would be exactly the false
     positive the next assertion forbids.

     So the exemption is not a name on a list: the rule is asked directly,
     below, whether this hole is a fault on a 1H series. If a future change
     made it one, this proof fails and the tab is back on the hook. */
  const oneHourHoleIsReal = (() => {
    /* The rule's weekend exemption depends on helpers spread across the gold
       scripts, so the proof loads the SAME set the drive does. Rebuilding it
       from two files answered a different question and said the hole was
       real — which is exactly the sort of near-miss this proof exists to
       avoid, so it is loaded the way the tab sees it. */
    const c = { Math, Date, JSON, isFinite, parseFloat, parseInt, Array, Object, String, Number, Intl,
      Promise, setTimeout, clearTimeout, setInterval: () => 0, clearInterval(){},
      console: { log(){}, warn(){}, error(){} },
      localStorage: { getItem: () => null, setItem(){} },
      document: { getElementById: () => null, addEventListener(){},
        createElement: () => ({ style: {}, appendChild(){}, classList: { add(){} } }),
        querySelector: () => null, querySelectorAll: () => [], body: { appendChild(){} } },
      location: { href: '', hostname: 'x', origin: 'https://x', pathname: '/' },
      navigator: { userAgent: 'node' },
      fetch: () => Promise.resolve({ ok: true, status: 200, headers: { get: () => null },
        json: () => Promise.resolve({}), text: () => Promise.resolve('{}') }) };
    c.window = c; c.self = c; c.globalThis = c;
    vm.createContext(c);
    for (const f of SCRIPTS){
      const fp = path.join(ROOT, f);
      if (!fs.existsSync(fp)) continue;
      try { vm.runInContext(fs.readFileSync(fp, 'utf8'), c, { filename: f }); } catch (e){}
    }
    if (typeof c.hgGoldTapeNotes !== 'function') return true;   /* no rule -> not exempt */
    const rows = bars(220, 3600, { holeBars: 12 });
    return /TAPE NOT CONTINUOUS/.test(String(c.hgGoldTapeNotes(rows, '1h') || ''));
  })();
  ok(!oneHourHoleIsReal,
     'the 12-bar hole lands inside the gold weekend on a 1H series, so the rule itself '
     + 'reports no fault there — a 1H tab that stays quiet is obeying the rule, not skipping it');
  const HOUR_SERIES = oneHourHoleIsReal ? [] : ['milligold'];
  const silentGReal = silentG.filter(id => HOUR_SERIES.indexOf(id) < 0);
  ok(silentGReal.length === 0,
     'and not one of them changes its numbers without saying the tape is not continuous'
     + (silentGReal.length ? (' — silent: ' + silentGReal.join(', ')) : ''));
  ok(saidG.length >= movedG.length - HOUR_SERIES.length,
     `${saidG.length} disclosed the hole against ${movedG.length} that moved (less the `
     + `${HOUR_SERIES.length} whose series makes this hole a weekend) — again the honest direction`);
  const fpG = ids.filter(id => /TAPE NOT CONTINUOUS/.test(A.out[id]));
  ok(fpG.length === 0,
     'and no tab claims a hole on the continuous tape' + (fpG.length ? (': ' + fpG.join(', ')) : ''));
  /* The two faults are independent: a holed tape must not be reported as
     malformed, nor an inverted one as discontinuous. */
  const crossA = ids.filter(id => /MALFORMED BARS/.test(G.out[id] || ''));
  const crossB = ids.filter(id => /TAPE NOT CONTINUOUS/.test(B.out[id] || ''));
  ok(crossA.length === 0 && crossB.length === 0,
     'and the two faults never stand in for one another — a hole is not reported as a malformed bar, nor the reverse');

  /* Stated so the green is not read as more than it is. */
  const quiet = ids.filter(id => !disclosed.includes(id));
  console.log(`  note — ${quiet.length} wired tabs stay quiet here (${quiet.join(', ')}): this harness reaches`);
  console.log('         their mount shell rather than their scan, so they are checked at the SOURCE above.');
}

console.log(`\n${passed} passed, 0 failed`);
