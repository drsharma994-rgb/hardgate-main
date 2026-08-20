/* HARDGATE — book.js runtime tests (offline, mocked fetch).
   Run: node tests/test-book.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const load = f => vm.runInThisContext(fs.readFileSync(root + f, 'utf8'), { filename: f });

function memStore(){
  const m = {};
  return {
    getItem(k){ return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem(k, v){ m[k] = String(v); },
    removeItem(k){ delete m[k]; },
  };
}

function loadBookStack(extra){
  globalThis.localStorage = memStore();
  globalThis.window = globalThis;
  globalThis.document = {
    getElementById(){ return null; },
    querySelectorAll(){ return []; },
  };
  globalThis.alert = () => {};
  globalThis.confirm = () => true;
  extra = extra || {};
  const W = globalThis.window;

  W.hgApiAvailable = extra.hgApiAvailable !== undefined ? extra.hgApiAvailable : () => true;
  W.hgNewsRisk = extra.hgNewsRisk || (() => ({ risk: 'low', blackout: false }));
  W.brainLiveModeOn = extra.brainLiveModeOn || (() => false);
  W.brainLiveEligible = extra.brainLiveEligible || (() => ({ ok: true, reasons: [] }));
  W.hgBrainBookLayerRecord = extra.hgBrainBookLayerRecord || (() => {});
  W.showTab = extra.showTab || (() => {});
  W.hgScoreRecord = extra.hgScoreRecord || (() => {});

  load('book-routing.js');
  load('braininvalidation.js');
  load('book.js');
  Object.keys(extra).forEach(function(k){
    if (extra[k] !== undefined) W[k] = extra[k];
  });
  return W;
}

let pass = 0;
const ok = (cond, label) => {
  if (!cond) throw new Error('FAIL: ' + label);
  pass++;
  console.log('  ok —', label);
};

async function withFetch(stub, fn){
  const orig = globalThis.fetch;
  globalThis.fetch = stub;
  try { await fn(); }
  finally { globalThis.fetch = orig; }
}

console.log('== exports ==');
{
  const W = loadBookStack();
  ok(typeof W.addToBook === 'function', 'addToBook exported');
  ok(typeof W.bookBtnHTML === 'function', 'bookBtnHTML exported');
  ok(typeof W.bookResolveFund === 'function', 'bookResolveFund exported');
  ok(typeof W.hgBookStampHTML === 'function', 'hgBookStampHTML exported');
  ok(typeof W.hgBookStampForMeta === 'function', 'hgBookStampForMeta exported');
  ok(typeof W.hgBookStampChip === 'function', 'hgBookStampChip exported');
  ok(typeof W.bookPositionKey === 'function', 'bookPositionKey exported');
  ok(typeof W.bookContractsCell === 'function', 'bookContractsCell exported');
}

console.log('== bookContractsCell ==');
{
  const W = loadBookStack({
    hgQtyToContracts: (sym, qty) => (sym === 'BTCUSD' && qty > 0)
      ? { lots: 23, cv: 0.001, unit: 'BTC', coinActual: 0.023, shortfallPct: 0 }
      : null,
  });
  ok(W.bookContractsCell({ sym: 'BTCUSD', mark: 100, notionalUsd: 2300 }) === '23',
     'lots column shows rounded-down Delta contracts');
  ok(W.bookContractsCell({ sym: 'BTCUSD', mark: 0, notionalUsd: 0 }) === '—',
     'missing sizing returns em dash');
}

console.log('== bookResolveFund + bookBtnHTML ==');
{
  const W = loadBookStack();
  ok(W.bookResolveFund({ scanner: 'brain', lane: 'gold' }) === 'gold', 'brain gold lane → gold fund');
  ok(W.bookResolveFund({ scanner: 'carry' }) === 'macro', 'carry scanner → macro fund');
  const btn = W.bookBtnHTML('BTCUSDT', 'long', 100, 95, 110, {
    strategy: 'edge', scanner: 'edge', layers: ['edge', 'regime'],
  });
  ok(btn.indexOf('ADD · SWING') >= 0, 'bookBtnHTML labels fund in button');
  ok(btn.indexOf('"strategy":"edge"') >= 0, 'bookBtnHTML embeds strategy in onclick payload');
  ok(btn.indexOf('addToBook') >= 0, 'bookBtnHTML wires addToBook onclick');
}

console.log('== IN BOOK stamps ==');
await withFetch(async (url) => {
  const u = String(url);
  if (u.indexOf('/api/book/funds') >= 0){
    return { ok: true, json: async () => ({ funds: [{ id: 'main' }] }) };
  }
  if (u.indexOf('/api/book?fund=') >= 0){
    return {
      ok: true,
      json: async () => ({ book: { positions: [{ sym: 'BTCUSDT', dir: 'long' }] } }),
    };
  }
  return { ok: false, json: async () => null };
}, async () => {
  const W = loadBookStack();
  await W.bookRefreshOpenKeys();
  ok(W.hgBookStampHTML('BTCUSDT', 'long', 'main').indexOf('IN BOOK') >= 0, 'stamp when key open');
  ok(W.hgBookStampHTML('ETHUSDT', 'short', 'main') === '', 'no stamp when not in book');
  ok(W.hgBookStampForMeta('BTCUSDT', 'long', { scanner: 'brain', lane: 'crypto' }).indexOf('IN BOOK') >= 0,
    'hgBookStampForMeta resolves fund from meta');
  const chip = W.hgBookStampChip('BTCUSDT', 'long', { scanner: 'brain' });
  ok(chip.indexOf('hg-book-stamp') >= 0 && chip.indexOf('data-hg-book-sym') >= 0,
    'hgBookStampChip slotted for repaint');
  ok(W.bookPositionKey('swing', 'SOLUSDT', 'short') === 'swing:SOLUSDT:short', 'bookPositionKey shape');
});

console.log('== addToBook vetoes ==');
{
  const W = loadBookStack({
    hgNewsRisk: () => ({ risk: 'high', blackout: true, note: 'NFP' }),
  });
  const veto = await W.addToBook({ sym: 'BTCUSDT', dir: 'long', entry: 100, stop: 95, t1: 110 });
  ok(veto.ok === false && veto.veto === true, 'news blackout vetoes add');
  ok((veto.reasons || []).join(' ').indexOf('BLACKOUT') >= 0, 'blackout reason in response');
}

{
  const W = loadBookStack();
  const bad = await W.addToBook({ sym: 'BTCUSDT', dir: 'long', entry: 100, stop: NaN });
  ok(bad.ok === false && bad.reason === 'invalid plan', 'invalid plan rejected');
}

{
  const W = loadBookStack();
  const unchk = await W.addToBook({
    sym: 'BTCUSDT', dir: 'long', entry: 100, stop: 95, t1: 110,
    postGateUnchecked: true, tradeReady: false, silent: true
  });
  ok(unchk.ok === false && unchk.veto === true, 'UNCHECKED ticket is not bookable');
  ok((unchk.reasons || []).join(' ').indexOf('UNCHECKED') >= 0, 'UNCHECKED book veto names the ledger gap');
}

{
  const W = loadBookStack({
    brainLiveModeOn: () => true,
    brainLiveEligible: () => ({ ok: false, reasons: ['TRIPLE STACK missing'] }),
  });
  const liveVeto = await W.addToBook({
    sym: 'BTCUSDT', dir: 'long', entry: 100, stop: 95, t1: 110,
    scanner: 'brain', strategy: 'brain', tier: 'PRIME',
    _brainRow: { sym: 'BTCUSDT', dec: { dir: 'long', tier: 'PRIME' } },
  });
  ok(liveVeto.ok === false && liveVeto.veto === true, 'brain LIVE gate vetoes ineligible row');
}

console.log('== addToBook success + brain layer record ==');
await withFetch(async (url, opts) => {
  const u = String(url);
  if (u.indexOf('/api/book/intent') >= 0){
    ok(opts && opts.method === 'POST', 'POST /api/book/intent');
    const body = JSON.parse(opts.body);
    ok(body.sym === 'BTCUSDT' && body.fund === 'main', 'intent body carries sym + fund');
    return {
      ok: true,
      json: async () => ({
        ok: true,
        position: { id: 'p1', sym: 'BTCUSDT', dir: 'long', entry: 100, stop: 95, notionalUsd: 5000 },
        fundId: 'main',
      }),
    };
  }
  if (u.indexOf('/api/book') >= 0){
    return {
      ok: true,
      json: async () => ({
        ok: true,
        book: { positions: [], blotter: [], closed: [] },
        summary: { equityUsd: 1e6, navUsd: 1e6, openCount: 0, at: Date.now() },
        fundId: 'main',
        funds: [{ id: 'main', label: 'Main', equityUsd: 1e6, openCount: 0 }],
        capabilities: {},
      }),
    };
  }
  return { ok: false, json: async () => null };
}, async () => {
  var recorded = null;
  var tabShown = false;
  const W = loadBookStack({
    hgBrainBookLayerRecord: (opts) => { recorded = opts; },
    showTab: (t) => { tabShown = t; },
  });
  const r = await W.addToBook({
    sym: 'BTCUSDT', dir: 'long', entry: 100, stop: 95,
    scanner: 'brain', strategy: 'brain', tier: 'PRIME',
    layers: ['regime', 'oiflow'], layerSig: 'regime:long|oiflow:long',
    silent: true,
  });
  ok(r && r.ok === true, 'successful add returns ok');
  ok(recorded && recorded.sym === 'BTCUSDT' && recorded.tier === 'PRIME', 'hgBrainBookLayerRecord on brain add');
  ok(recorded.fund === 'main' && recorded.layerSig === 'regime:long|oiflow:long', 'layer snapshot includes fund + sig');
  ok(tabShown !== 'book', 'silent:true skips showTab');

  var nonBrainRecorded = false;
  W.hgBrainBookLayerRecord = () => { nonBrainRecorded = true; };
  await W.addToBook({
    sym: 'ETHUSDT', dir: 'short', entry: 50, stop: 52, t1: 46,
    scanner: 'edge', strategy: 'edge', silent: true,
  });
  ok(nonBrainRecorded === false, 'non-brain add skips hgBrainBookLayerRecord');
});

console.log('== auto t1 from 1R ==');
await withFetch(async (url) => {
  if (String(url).indexOf('/api/book/intent') >= 0){
    return {
      ok: true,
      json: async () => ({ ok: true, position: { id: 'p2', sym: 'SOLUSDT', dir: 'long' }, fundId: 'swing' }),
    };
  }
  return {
    ok: true,
    json: async () => ({
      ok: true,
      book: { positions: [], blotter: [], closed: [] },
      summary: { equityUsd: 1e6, navUsd: 1e6, openCount: 0, at: Date.now() },
      fundId: 'swing',
      funds: [{ id: 'swing', label: 'Swing', equityUsd: 1e6, openCount: 0 }],
    }),
  };
}, async () => {
  var posted = null;
  const W = loadBookStack({ hgBrainBookLayerRecord: () => {} });
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (String(url).indexOf('/api/book/intent') >= 0){
      posted = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ ok: true, fundId: 'swing' }) };
    }
    return origFetch(url, opts);
  };
  await W.addToBook({ sym: 'SOLUSDT', dir: 'long', entry: 100, stop: 95, scanner: 'swing', silent: true });
  globalThis.fetch = origFetch;
  ok(posted && posted.t1 === 105, 'missing t1 filled to 1R target (long entry + risk)');
});

console.log('== API off ==');
{
  const W = loadBookStack({ hgApiAvailable: () => false });
  const r = await W.addToBook({ sym: 'BTCUSDT', dir: 'long', entry: 100, stop: 95, t1: 110, silent: true });
  ok(r === undefined || r.ok !== true, 'API off does not succeed add');
}

console.log('\n' + pass + ' passed');
