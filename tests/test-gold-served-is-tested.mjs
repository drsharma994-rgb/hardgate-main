/**
 * hg-v1156 — the GOLD SCALP the browser runs is the GOLD SCALP the suite boots.
 *
 * Since hg-v1085 / v1095 / v1098 (all on 2026-10-05) scripts/server.mjs
 * REWROTE goldscalp.js at serve time (goldLiveSource): a feed warm, a cached
 * macro fallback, the forming-bar strip, an ACCURACY demote that let only two
 * hand-typed mechanics lead, a 90-minute conviction TTL, a release of every
 * ACCURACY-failed conviction, and a scan kicked from mount. None of it was in
 * the file the suite boots, so 711 green files proved a desk nobody was served:
 * booting the suite on what the browser received turned 22 files red. This
 * pack BAKES the goldscalp leg into goldscalp.js and serves the file unchanged.
 *
 * What this guard pins:
 *   1. the REAL server, spawned, returns goldscalp.js byte-identical to disk
 *      (and names the two gold files it still rewrites, so the next pack bakes
 *      those with its eyes open rather than finding them the way this one did);
 *   2. every baked leg, through the real tab: the closed-bar strip, the ACCURACY
 *      demote whose lead set is READ off the edge table (not typed), its fail-
 *      closed branch, the release from the conviction store, the lever, the
 *      mount kick and the 90-minute TTL;
 *   3. the remaining goldind / goldswing splice, pinned BEHAVIOURALLY through
 *      the server's own rewriter so a later bake knows the contract it inherits.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const assert = (c, m) => { if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ---------------------------------------------------------------- harness */
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
const TAPES = () => ({ '15m': tapeEnding(WED, 420, 900, 102, 24), '1h': tapeEnding(WED, 220, 3600, 103, 30), '4h': tapeEnding(WED, 140, 14400, 104, 40), '1d': tapeEnding(WED, 150, 86400, 106, 60, -0.3) });
function stubEl(){
  return { innerHTML: '', textContent: '', className: '', disabled: false, value: '', style: {}, firstElementChild: { style: {} }, _handlers: {},
    addEventListener(ev, fn){ this._handler = fn; this._handlers[ev] = fn; }, querySelector: () => stubEl(), querySelectorAll: () => [],
    classList: { add(){}, remove(){}, toggle(){} }, setAttribute(){}, appendChild(){} };
}
function pane(){
  const stubs = {};
  const p = { _html: '', set innerHTML(v){ this._html = v; }, get innerHTML(){ return this._html; },
    querySelector(sel){ if (!stubs[sel]) stubs[sel] = stubEl(); return stubs[sel]; }, querySelectorAll: () => [] };
  return { pane: p, stubs };
}
const TAB_FILES = ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'gold-forward-read.js', 'hg-forward.js', 'gold-formation.js',
                   'goldind.js', 'gold-best-levels.js', 'conviction-lock.js', 'gold-catalog.js', 'goldscalp.js', 'accuracy-floor.js'];
function boot(opts){
  opts = opts || {};
  const clock = { now: opts.now || (WED + 16 * 60000) };
  const FakeDate = class extends Date { static now(){ return clock.now; } };
  const ctx = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} }, Math, Date: FakeDate, Number, String, Object, Array, JSON, Error,
    TypeError, Promise, RegExp, Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout,
    setInterval: () => 0, clearInterval(){}, encodeURIComponent, decodeURIComponent };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  const store = opts.store || {};
  ctx.localStorage = { getItem: k => (k in store ? store[k] : null), setItem(k, v){ store[k] = String(v); }, removeItem(k){ delete store[k]; }, clear(){} };
  ctx.sessionStorage = ctx.localStorage;
  const byId = {};
  ctx.document = { createElement: stubEl, getElementById: id => (byId[id] || (byId[id] = stubEl())), querySelector: () => stubEl(), querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){}, contains: () => false }, documentElement: { appendChild(){} },
    addEventListener(){}, removeEventListener(){}, visibilityState: 'visible', readyState: 'complete' };
  ctx.fetch = () => Promise.reject(new Error('no network'));
  ctx.navigator = { userAgent: 'node', onLine: false };
  const tapes = opts.tapes || TAPES();
  ctx.getXmGoldCandles = async tf => ({ rows: tapes[tf] || [], source: 'xm-xauusd' });
  ctx.getGoldCandles = async () => ({ rows: [], source: null });
  if (opts.extra) Object.assign(ctx, opts.extra);
  vm.createContext(ctx);
  const files = opts.files || TAB_FILES;
  for (const f of files){
    const src = (opts.sources && opts.sources[f]) ? opts.sources[f] : read(f);
    try { vm.runInContext(src, ctx, { filename: f }); } catch(e){ console.error('boot ' + f + ': ' + e.message); }
  }
  ctx.__store = store;
  if (opts.afterBoot) opts.afterBoot(ctx);
  return ctx;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
/* the mount KICKS the first scan; wait for its snapshot rather than start a second one */
async function kicked(W){
  for (let i = 0; i < 800; i++){ const s = W.goldscalpScan(); if (s) return s; await sleep(10); }
  return null;
}
async function scan(opts){
  const W = boot(opts);
  const tab = W.HG_tabs.find(t => t && t.id === 'goldscalp');
  const P = pane();
  tab.mount(P.pane);
  const snap = await kicked(W);
  return { W, tab, P, snap, cands: (snap && snap.cands) || [], stat: P.stubs['#gsStat'] ? P.stubs['#gsStat'].textContent : '', cards: P.stubs['#gsCards'] ? P.stubs['#gsCards'].innerHTML : '' };
}
const liveKeys = W => { const raw = W.__store.hgGoldscalpConviction; const j = raw ? JSON.parse(raw) : null; return j && j.live ? Object.keys(j.live) : []; };
const hasAcc = c => Array.isArray(c.stamps) && c.stamps.indexOf('ACCURACY') >= 0;

/* ------------------------------------------------------------------ 1 */
console.log('== 1) the real server serves goldscalp.js byte-identical to disk ==');
{
  const srvSrc = read('scripts/server.mjs');
  assert(!/kind === 'goldscalp'/.test(srvSrc), 'scripts/server.mjs carries no goldscalp rewrite leg any more');
  assert(!/u\.pathname === '\/goldscalp\.js'/.test(srvSrc), 'and /goldscalp.js is not in the gold serve-time branch');
  assert(!/goldLiveSource/.test(srvSrc) && !/kind === 'goldind'/.test(srvSrc) && !/kind === 'goldswing'/.test(srvSrc), 'hg-v1157: the goldind and goldswing legs are baked too — goldLiveSource is gone from scripts/server.mjs');
  assert(/function omnibtcTicketSource/.test(srvSrc), 'omnibtc.js is the other file still rewritten at serve time (hg-v1083) — named, not touched by this pack');

  const port = 18000 + (process.pid % 1000);
  const child = spawn(process.execPath, ['scripts/server.mjs'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(port), HARDGATE_DAEMON_AUTOSTART: '0' }), stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', d => { out += String(d); });
  child.stderr.on('data', d => { out += String(d); });
  const up = await new Promise(res => {
    const t0 = Date.now();
    const poll = () => { if (/listening on :/.test(out)) return res(true); if (Date.now() - t0 > 40000) return res(false); setTimeout(poll, 100); };
    poll();
  });
  assert(up, 'the real server boots on :' + port + ' (' + out.split('\n').filter(l => /listening/.test(l)).join('') + ')');
  const get = p => new Promise((res, rej) => { http.get({ host: '127.0.0.1', port, path: p }, r => { const bufs = []; r.on('data', b => bufs.push(b)); r.on('end', () => res({ status: r.statusCode, body: Buffer.concat(bufs) })); }).on('error', rej); });
  if (up){
    const served = {};
    for (const f of ['goldscalp.js', 'goldind.js', 'goldswing.js', 'omnigold.js', 'omnibtc.js']){
      try { served[f] = await get('/' + f); } catch(e){ served[f] = { status: 0, body: Buffer.alloc(0), err: e.message }; }
    }
    const disk = f => fs.readFileSync(path.join(ROOT, f));
    assert(served['goldscalp.js'].status === 200 && served['goldscalp.js'].body.equals(disk('goldscalp.js')),
      'GET /goldscalp.js is BYTE-IDENTICAL to goldscalp.js on disk — the browser runs what the suite boots (' + served['goldscalp.js'].body.length + ' bytes)');
    assert(served['omnigold.js'].status === 200 && served['omnigold.js'].body.equals(disk('omnigold.js')),
      'GET /omnigold.js is byte-identical too (its hg-v1099 leg was baked earlier; the splice is a no-op on it)');
    assert(served['goldind.js'].status === 200 && served['goldind.js'].body.equals(disk('goldind.js')) && /GOLD FEED — /.test(read('goldind.js')),
      'GET /goldind.js is byte-identical to disk, and the hg-v1085 GOLD FEED lock is IN the file (hg-v1157) — not spliced on the way out');
    assert(served['goldswing.js'].status === 200 && served['goldswing.js'].body.equals(disk('goldswing.js')) && /needs the live dollar/.test(read('goldswing.js')),
      'GET /goldswing.js is byte-identical to disk, and the hg-v1085 swing drop is IN the file (hg-v1157)');
    assert(served['omnibtc.js'].status === 200 && !served['omnibtc.js'].body.equals(disk('omnibtc.js')),
      'GET /omnibtc.js is NOT the file on disk (hg-v1083 ticket-shape splice) — the ONE file still rewritten at serve time, named so the next pack finds it here and not the way hg-v1156 did');
  }
  child.kill('SIGTERM');
  await new Promise(res => { child.on('exit', () => res()); setTimeout(res, 3000); });
}

/* ------------------------------------------------------------------ 2 */
console.log('== 2) the baked legs, through the real tab ==');
let LEAD_TODAY = null;
{
  /* (a) the closed-bar strip: 16 min past the last bar's open it is closed; 5 min past, it is forming and stripped.
     hg-v1290: A drives the lever ON explicitly so sections (b)(c)(d) measure
     the ACCURACY path verbatim; the OFF default (user ask) is asserted at
     the bottom of this block, in its own scan. */
  const A = await scan({ now: WED + 16 * 60000, extra: { HG_GS_LEAD_MEASURED_ONLY: true } });
  const B = await scan({ now: WED + 5 * 60000, extra: { HG_GS_LEAD_MEASURED_ONLY: true } });
  assert(!!A.snap && A.cands.length === 7, 'REACHABILITY: at +16 min the desk reads the closed WED bar and forms on seed 102 (' + A.cands.length + ' candidates)');
  assert(/420 15m bars/.test(A.stat), 'the stat line counts all 420 bars when the last one is closed (' + A.stat.slice(0, 60) + ')');
  assert(/419 15m bars/.test(B.stat), 'at +5 min the FORMING bar is stripped: 419 bars (hg-v1095 closed-bar rule, baked) — ' + B.stat.slice(0, 60));
  assert(B.cands.length === 0 && A.cands.length > 0, 'and the board differs: ' + B.cands.length + ' on the closed tape vs ' + A.cands.length + ' with the forming bar — the suite used to test the forming-bar board');

  /* (b) the ACCURACY lead set is the edge table's PREFER rows, read through hgGoldEdgeAction */
  const T = A.W.HG_GOLD_SETUP_EDGE.scalp;
  const preferRows = Object.keys(T).filter(k => A.W.hgGoldEdgeAction(T[k]) === 'prefer').sort();
  LEAD_TODAY = preferRows;
  assert(typeof A.tab.leadKeys === 'function' && JSON.stringify(A.tab.leadKeys()) === JSON.stringify(preferRows),
    'the lead set rides the HG_tabs registration and equals the table\'s prefer rows (' + preferRows.join(', ') + ')');
  assert(preferRows.join(',') === 'p6fail,p9volbar', 'today that set is exactly the two keys the server splice had typed by hand — same set, now READ');
  const acc = A.cands.filter(hasAcc), notAcc = A.cands.filter(c => !hasAcc(c));
  assert(acc.length === 6 && notAcc.length === 1 && notAcc[0].stratKey === 'p6fail',
    'six of seven carry ACCURACY; the one that does not is the prefer row p6fail (' + notAcc.map(c => c.stratKey).join(',') + ')');
  assert(acc.every(c => preferRows.indexOf(c.stratKey) < 0), 'every ACCURACY-stamped candidate is outside the prefer set');
  assert(acc.every(c => c.demoted === true) && A.snap.bestId === null, 'ACCURACY demotes (cannot lead); nothing leads on this board — bestId null');
  assert(/ACCURACY — 6 scalps cannot lead/.test(A.stat), 'the stat line says what the leg did: "ACCURACY — 6 scalps cannot lead"');
  assert(/ACCURACY — only p6fail \/ p9volbar has held up on this desk/.test(A.cards.replace(/&#39;|&apos;/g, "'")),
    'the card note NAMES the set it read (p6fail / p9volbar), not a sentence typed about two mechanics');

  /* (c) READ, not typed: move a row to prefer at runtime and the leg follows; an unreadable table fails CLOSED.
     hg-v1290: lever driven ON explicitly so the ACCURACY path is tested. */
  const C = await scan({ now: WED + 16 * 60000, extra: { HG_GS_LEAD_MEASURED_ONLY: true }, afterBoot: W => { W.HG_GOLD_SETUP_EDGE.scalp.liqsweep.action = 'prefer'; } });
  const liq = C.cands.find(c => c.stratKey === 'liqsweep');
  assert(!!liq && !hasAcc(liq) && JSON.stringify(C.tab.leadKeys()) === JSON.stringify(['liqsweep', 'p6fail', 'p9volbar']),
    'with liqsweep read as a prefer row the leg lets it through — the set is READ off the table at scan time');
  assert(/ACCURACY — 5 scalps cannot lead/.test(C.stat), 'and the stat leg counts five (' + C.stat.match(/ACCURACY[^·]*/) + ')');
  const D = await scan({ now: WED + 16 * 60000, extra: { HG_GS_LEAD_MEASURED_ONLY: true }, afterBoot: W => { W.HG_GOLD_SETUP_EDGE = null; } });
  assert(D.cands.length === 7 && D.cands.every(hasAcc) && D.tab.leadKeys() === null,
    'with the table unreadable NO mechanic is measured: every candidate carries ACCURACY (fail CLOSED, the hg-v946 GOLD ULTRA rule), leadKeys() is null');
  assert(/the edge table is unreadable/.test(D.cards), 'and the card says so');

  /* (d) the release: an ACCURACY-stamped scalp is NOT held in the conviction store.
     On this tape p6fail (and sweepob) MERGE into a same-zone record rather than
     minting their own key (conviction-lock clMergeCompatible), so releasing the
     six ACCURACY rows empties the store entirely: nothing of theirs survives. */
  const accKinds = acc.map(c => c.stratKey);
  const live = liveKeys(A.W);
  assert(live.length === 0 && live.every(k => !accKinds.some(kind => k.indexOf(kind + '|') === 0)),
    'no ACCURACY-stamped scalp is held in the conviction store after the scan (held: ' + (live.join(', ') || 'none') + ')');
  assert(/0 live convictions/.test(A.stat), 'the stat line counts zero live convictions on this board');
  const liveC = liveKeys(C.W);
  assert(liveC.length === 1 && /^liqsweep\|/.test(liveC[0]), 'with liqsweep read as prefer, the one record held is liqsweep\'s (' + liveC.join(', ') + ') — the release follows the set the leg read');

  /* (e) the lever: OFF withholds the lead-set demote and its release; nothing else */
  const E = await scan({ now: WED + 16 * 60000, extra: { HG_GS_LEAD_MEASURED_ONLY: false } });
  assert(E.cands.length === 7 && E.cands.every(c => !hasAcc(c)), 'lever OFF (window override): no candidate carries ACCURACY on this tape');
  assert(!/ACCURACY —/.test(E.stat) && liveKeys(E.W).length === 5, 'no ACCURACY stat leg, and every minted conviction is held — five keys, p6fail and sweepob having merged into same-zone records (' + liveKeys(E.W).length + ')');
  assert(E.cands.every(c => c.demoted === true) && E.snap.bestId === null, 'the desk\'s OTHER demotes still hold: all seven demoted, nothing leads — the lever loosens no gate');
  assert(typeof E.tab.setLeadMeasuredOnly === 'function' && E.tab.setLeadMeasuredOnly(false) === false && E.W.__store.hg_gs_lead_measured_only === '0',
    'setLeadMeasuredOnly(false) persists "0" under hg_gs_lead_measured_only');
  const F = await scan({ now: WED + 16 * 60000, store: { hg_gs_lead_measured_only: '0' } });
  assert(F.cands.every(c => !hasAcc(c)) && F.tab.leadMeasuredOnly() === false, 'and a persisted "0" is honoured on the next scan (headless warms read it per scan)');
  /* hg-v1290: no override, no persisted value — the default is now OFF
     (user ask: "No confirmed setups in any of the gold tabs, fix it").
     A persisted "1" still flips it back ON (the hg-v1098 lever stays). */
  const Adef = await scan({ now: WED + 16 * 60000 });
  assert(Adef.tab.leadMeasuredOnly() === false && Adef.cands.every(c => !hasAcc(c)),
    'default is OFF (hg-v1290: flipped on user ask; the hg-v1098 instruction stays as the lever)');
  const Aon = await scan({ now: WED + 16 * 60000, store: { hg_gs_lead_measured_only: '1' } });
  assert(Aon.tab.leadMeasuredOnly() === true && /ACCURACY —/.test(Aon.stat),
    'and a persisted "1" flips it back ON — the hg-v1098 instruction is still available');

  /* (f) mount KICKS the scan: no click, no refresh, a snapshot appears */
  const G = boot({ now: WED + 16 * 60000 });
  const gTab = G.HG_tabs.find(t => t.id === 'goldscalp');
  assert(G.goldscalpScan() === null, 'before mount there is no snapshot');
  gTab.mount(pane().pane);
  const gSnap = await kicked(G);
  assert(!!gSnap && gSnap.cands.length === 7, 'mount kicks the first scan with no click and no refresh (' + (gSnap && gSnap.cands.length) + ' candidates)');

  /* (g) the 90-minute TTL: a held record older than 90 min expires on the next scan; a 60-minute one stands.
     Seeded from the lever-OFF store (E), which is the one that holds records on this tape; the
     TTL is the conviction lock's, not the lever's, so the lever stays OFF in these two scans. */
  const seed = JSON.parse(E.W.__store.hgGoldscalpConviction);
  const k0 = Object.keys(seed.live)[0];
  assert(!!k0, 'REACHABILITY: the lever-OFF store holds a record to age (' + k0 + ')');
  const old = JSON.parse(JSON.stringify(seed)); old.live[k0].issuedAt = (WED + 16 * 60000) - 100 * 60000;
  const H = await scan({ now: WED + 16 * 60000, store: { hgGoldscalpConviction: JSON.stringify(old), hg_gs_lead_measured_only: '0' } });
  const hStore = JSON.parse(H.W.__store.hgGoldscalpConviction);
  const hist = (hStore.history || []).concat((H.snap && H.snap.history) || []);
  assert(hist.some(h => h && /EXPIRED/i.test(String(h.status || h.state || ''))) || /EXPIRED/i.test(H.stat) || !hStore.live[k0] || (hStore.live[k0] && hStore.live[k0].issuedAt !== old.live[k0].issuedAt),
    'a record issued 100 min ago does not survive as-is under the 90-minute TTL (expired, or re-minted fresh)');
  const young = JSON.parse(JSON.stringify(seed)); young.live[k0].issuedAt = (WED + 16 * 60000) - 60 * 60000;
  const I = await scan({ now: WED + 16 * 60000, store: { hgGoldscalpConviction: JSON.stringify(young), hg_gs_lead_measured_only: '0' } });
  const iStore = JSON.parse(I.W.__store.hgGoldscalpConviction);
  assert(iStore.live[k0] && iStore.live[k0].issuedAt === young.live[k0].issuedAt, 'a record issued 60 min ago keeps its issuedAt — inside the 90-minute TTL (the raw file said 6 h; the browser has run 90 min since hg-v1095)');
  assert(/CONVICTION_TTL_MS = 90\*60\*1000/.test(read('goldscalp.js')), 'and the constant reads 90 minutes (textual, because the lever has no reader)');

  /* the hand-typed book is gone from the source */
  const src = read('goldscalp.js').replace(/\/\*[\s\S]*?\*\//g, '');
  assert(!/sk !== 'p6fail'|'p9volbar'/.test(src), 'goldscalp.js carries no hand-typed prefer key in code — the only p6fail / p9volbar left are in comments');
}

/* ------------------------------------------------------------------ 3 */
console.log('== 3) the hg-v1085 GOLD FEED lock, in the files on disk (hg-v1157), through the filter, the mint and the real GOLD SWING tab ==');
{
  const srvSrc = read('scripts/server.mjs');
  assert(!/function goldLiveSource/.test(srvSrc), 'goldLiveSource no longer exists in scripts/server.mjs');
  assert(/function omnibtcTicketSource/.test(srvSrc), 'omnibtcTicketSource is the one rewriter left (hg-v1083), named here');

  /* the goldind lock: a NON-scalp candidate with no macro is dropped; aligned legs pass; FLAT locks; the scalp path escapes */
  const G = boot({ files: ['indicators.js', 'indicators2.js', 'gold-formation.js', 'goldind.js'] });
  const rows = tapeEnding(WED, 120, 14400, 104, 40);
  const cand = () => ({ stratKey: 'bos', dir: 'long', id: 'bos|long|2300', strategy: 'BOS', stamps: [], gateNotes: [], entry: 2300, stop: 2290, t1: 2320 });
  const noMacro = G.hgGoldInstFilter(cand(), { rows, nowMs: WED, scalp: false });
  assert(noMacro && noMacro.dropped === true && /GOLD FEED — DXY unread; US10Y unread/.test(noMacro.reason),
    'goldind.js on disk: a swing-path long with NO macro is DROPPED — "' + String(noMacro && noMacro.reason).slice(0, 60) + '…"');
  const aligned = G.hgGoldInstFilter(cand(), { rows, nowMs: WED, scalp: false, macro: { dxy: { trend20: 'FALLING' }, tnxTrend: 'FALLING' } });
  assert(aligned && !(aligned.macroLock && aligned.macroLock.lock) && !/GOLD FEED/.test(String(aligned.reason || '')),
    'with DXY FALLING and US10Y FALLING (both with a gold long) the lock does not fire');
  const flat = G.hgGoldInstFilter(cand(), { rows, nowMs: WED, scalp: false, macro: { dxy: { trend20: 'FLAT' }, tnxTrend: 'FLAT' } });
  assert(flat && flat.dropped === true && /GOLD FEED — DXY unread; US10Y unread/.test(flat.reason), 'a FLAT read is a lock too ("a quiet feed is not a yes") — and this leg WORDS a FLAT trend as "unread", because hgGoldMacroLeg gives FLAT neither a bull nor a bear verdict (the swing mint\'s own push() names it FLAT; two wordings of one rule, said here)');
  const half = G.hgGoldInstFilter(cand(), { rows, nowMs: WED, scalp: false, macro: { dxy: { trend20: 'FALLING' }, tnxTrend: 'FLAT' } });
  assert(half && half.dropped === true && /GOLD FEED — US10Y unread\./.test(half.reason) && !/DXY/.test(half.reason), 'one leg with and one FLAT locks, naming only the leg that is not with (' + String(half.reason).slice(0, 50) + ')');
  const against = G.hgGoldInstFilter(cand(), { rows, nowMs: WED, scalp: false, macro: { dxy: { trend20: 'FALLING' }, tnxTrend: 'RISING' } });
  assert(against && against.dropped === true && /GOLD FEED — US10Y not with this gold long\./.test(against.reason), 'a leg trending AGAINST is named as not with (' + String(against.reason).slice(0, 50) + ')');
  const bothBull = G.hgGoldInstFilter(cand(), { rows, nowMs: WED, scalp: false, macro: { dxy: { trend20: 'RISING' }, tnxTrend: 'RISING' } });
  assert(bothBull && bothBull.dropped === true && /CONVICTION LOCK/.test(bothBull.reason) && !/GOLD FEED/.test(bothBull.reason),
    'both legs BULLISH against a long is still the hgGoldMacroLock CONVICTION LOCK — the feed rule yields to the lock that already fired and keeps its name');
  const scalpPath = G.hgGoldInstFilter(cand(), { rows, nowMs: WED, scalp: true, hardReject: false });
  assert(scalpPath && !/GOLD FEED/.test(String(scalpPath.reason || '')), 'the GOLD SCALP path (scalp, hardReject:false) ESCAPES the lock');
  const scalpHard = G.hgGoldInstFilter(cand(), { rows, nowMs: WED, scalp: true });
  assert(scalpHard && scalpHard.dropped === true && /GOLD FEED/.test(scalpHard.reason), 'but a scalp candidate on the HARD path (OMNIGOLD native) does not — the escape is hardReject:false, not the word scalp');

  /* the goldswing drop at push(): the mint on disk */
  const S = boot({ files: ['indicators.js', 'indicators2.js', 'gold-formation.js', 'goldind.js', 'goldswing.js'] });
  const swInp = extra => Object.assign({ rows4h: tapeEnding(WED, 300, 14400, 103, 40, -0.3), rows1d: tapeEnding(WED, 150, 86400, 106, 60, -0.3), now: WED, news: null }, extra || {});
  const swNone = S.goldSwingSetups(swInp()) || {};
  assert((swNone.ranked || []).length === 0 && (swNone.rejected || []).some(r => /GOLD FEED — DXY unread, US10Y unread\. A gold short needs the live dollar/.test(String(r.reason || ''))),
    'goldswing.js on disk: with no macro the swing mint forms NOTHING and every reject names the GOLD FEED (' + (swNone.rejected || []).length + ' rejected)');
  const swShort = S.goldSwingSetups(swInp({ macro: { dxy: { trend20: 'RISING' }, tnxTrend: 'RISING' } })) || {};
  const swLong = S.goldSwingSetups(swInp({ macro: { dxy: { trend20: 'FALLING' }, tnxTrend: 'FALLING' } })) || {};
  assert((swShort.ranked || []).length > 0 && (swShort.ranked || []).every(c => c.dir === 'short'), 'under RISING/RISING the falling tape forms its shorts (' + (swShort.ranked || []).length + ')');
  assert((swLong.ranked || []).length === 0 && (swLong.rejected || []).some(r => /GOLD FEED — DXY FALLING, US10Y FALLING/.test(String(r.reason || ''))),
    'under FALLING/FALLING the same shorts are dropped naming both legs — only the side the two legs support forms');
  const swHalf = S.goldSwingSetups(swInp({ macro: { dxy: { trend20: 'RISING' }, tnxTrend: 'FLAT' } })) || {};
  assert((swHalf.ranked || []).length === 0 && (swHalf.rejected || []).some(r => /GOLD FEED — US10Y FLAT\. A gold short/.test(String(r.reason || ''))),
    'one leg with and one FLAT drops the shorts naming only the FLAT leg — both legs are required, not either (' + (swHalf.rejected || []).length + ' rejected)');
  /* the LONG branch of the same rule, on a tape that forms longs (seed 105, the hg-v972 long seed) */
  const lgInp = extra => Object.assign({ rows4h: tapeEnding(WED, 300, 14400, 105, 40, -0.3), rows1d: tapeEnding(WED, 150, 86400, 108, 60, -0.3), now: WED, news: null }, extra || {});
  const lgOk = S.goldSwingSetups(lgInp({ macro: { dxy: { trend20: 'FALLING' }, tnxTrend: 'FALLING' } })) || {};
  assert((lgOk.ranked || []).length > 0 && (lgOk.ranked || []).every(c => c.dir === 'long'), 'REACHABILITY: seed 105 forms LONGS under FALLING/FALLING (' + (lgOk.ranked || []).length + ')');
  const lgBull = S.goldSwingSetups(lgInp({ macro: { dxy: { trend20: 'RISING' }, tnxTrend: 'RISING' } })) || {};
  assert((lgBull.ranked || []).length === 0 && (lgBull.rejected || []).some(r => /GOLD FEED — DXY RISING, US10Y RISING\. A gold long/.test(String(r.reason || ''))),
    'under RISING/RISING the longs are dropped naming both legs (the long branch reads FALLING, not RISING)');
  const lgHalf = S.goldSwingSetups(lgInp({ macro: { dxy: { trend20: 'FALLING' }, tnxTrend: 'FLAT' } })) || {};
  assert((lgHalf.ranked || []).length === 0 && (lgHalf.rejected || []).some(r => /GOLD FEED — US10Y FLAT\. A gold long/.test(String(r.reason || ''))),
    'one leg FALLING and one FLAT drops the longs naming only the FLAT leg');

  /* the real GOLD SWING tab, headless: the board the browser shows */
  async function swingTab(macroFn){
    const extra = macroFn ? { getGoldMacro: macroFn } : {};
    const W = boot({ files: ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'gold-forward-read.js', 'hg-forward.js', 'gold-formation.js', 'goldind.js', 'gold-best-levels.js', 'conviction-lock.js', 'gold-catalog.js', 'goldswing.js', 'accuracy-floor.js'],
      tapes: { '4h': tapeEnding(WED, 300, 14400, 103, 40, -0.3), '1d': tapeEnding(WED, 150, 86400, 106, 60, -0.3), '1h': tapeEnding(WED, 220, 3600, 103, 30) }, extra });
    const tab = W.HG_tabs.find(x => x && x.id === 'goldswing');
    const P = pane(); tab.mount(P.pane);
    const r = await tab.refresh();
    const snap = W.goldswingScan();
    return { r, cands: (snap && snap.cands) || [], rejected: (snap && snap.rejected) || [], stat: P.stubs['#gwStat'] ? P.stubs['#gwStat'].textContent : '' };
  }
  const tNone = await swingTab(null);
  assert(tNone.cands.length === 0 && tNone.rejected.length > 0 && tNone.rejected.every(c => /GOLD FEED/.test(String(c.reason || ''))),
    'GOLD SWING tab with no macro feed: an EMPTY board, every reject a GOLD FEED (' + tNone.rejected.length + ') — the board the browser has shown since 2026-10-05 whenever the dollar / 10-year feed is unread');
  const tShort = await swingTab(async () => ({ dxy: { trend20: 'RISING' }, tnxTrend: 'RISING' }));
  assert(tShort.cands.length > 0 && tShort.cands.every(c => c.dir === 'short'), 'GOLD SWING tab under RISING/RISING: the shorts form (' + tShort.cands.length + ')');
  const tFlat = await swingTab(async () => ({ dxy: { trend20: 'FLAT' }, tnxTrend: 'FLAT' }));
  assert(tFlat.cands.length === 0 && tFlat.rejected.some(c => /GOLD FEED — DXY FLAT, US10Y FLAT/.test(String(c.reason || ''))), 'GOLD SWING tab under a FLAT read: empty, and the reject names FLAT — a quiet feed is not a yes');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
