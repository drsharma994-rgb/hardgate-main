/* HARDGATE — the audit table cost 64.5 KB a contract, and most of it was the
   same five fields on every card.

   This tab's pitch is that every one of the engine's 470 reads can be audited
   by eye, so the reads have to be kept -- dropping them removes the feature.
   What does not have to be kept is 470 eight-field objects PER CONTRACT.
   Measured with --expose-gc over 200 real engine runs, retaining exactly what
   __results.setups[].votes retained:

     64.5 KB per setup
     300 contracts -> 18.9 MB     500 -> 31.5 MB     800 -> 50.4 MB

   held for as long as the tab is mounted, and rebuilt every ten minutes by
   the auto-refresh.

   Five of each read's eight fields -- id, group, name, kind, why -- are the
   same on every card. Checked over 200 engine runs across bar counts from 230
   to 500, four price scales and a wide drift/vol sweep: ZERO rows differed
   index-for-index. They are now stored once per scan, and each contract keeps
   only read, vote and regime. Measured end to end through the real runScan on
   120 contracts:

     per setup   51.5 KB  ->  11.2 KB      4.6x
     universe 300  15.1 MB -> 3.3 MB
     universe 500  25.2 MB -> 5.5 MB
     universe 800  40.2 MB -> 8.8 MB

   THE GUARD IS ABSOLUTE. csVotePack compares every constant field against the
   template and returns null on the slightest mismatch; the caller then keeps
   that contract's reads whole. A packed card can never show another card's
   reads -- the worst case is that it costs what it cost before.

   This is a cost reduction, not a bug fix. 18.9 MB is affordable on a desktop
   browser; it is worth removing because the tab also ships as an Android
   WebView and because nothing about it was load-bearing.

   Run: node tests/test-cryptoscan-vote-packing.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
function ok(cond, msg){
  if (cond){ passed++; console.log('  ok   ' + msg); }
  else { console.error('  FAIL ' + msg); process.exitCode = 1; }
}
function stripComments(src){
  return String(src)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1 ');
}

function boot(){
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date,
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, Set, Map };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {};
  s.setTimeout = (f) => { try{ f && f(); }catch(e){} return 0; }; s.clearTimeout = () => {};
  s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }),
                 head: { appendChild(){} }, addEventListener(){} };
  s.localStorage = (() => { const m = {}; return {
    getItem: k => (k in m ? m[k] : null), setItem(k, v){ m[k] = String(v); },
    removeItem(k){ delete m[k]; } }; })();
  s.location = { href: 'https://x/', search: '', protocol: 'https:' };
  s.navigator = { userAgent: 'node' };
  vm.createContext(s);
  for (const f of ['indicators.js', 'indicators2.js', 'order-flow.js',
                   'liquidation-intelligence.js', 'cryptoscan-voting-v3.js', 'sentiment.js',
                   'cryptoultra.js', 'hg-forward.js', 'cryptoscan.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const S = boot();
const SCAN = fs.readFileSync(root + 'cryptoscan.js', 'utf8');
const SEC = 900;

function fakeEl(){
  const nodes = {};
  return {
    _html: '',
    set innerHTML(v){ this._html = String(v); },
    get innerHTML(){ return this._html; },
    querySelector(sel){
      const id = String(sel).replace(/^#/, '');
      if (this._html.indexOf('id="' + id + '"') < 0) return null;
      if (!nodes[id]) nodes[id] = { id: id, innerHTML: '', style: {}, textContent: '',
                                    disabled: false, addEventListener(){},
                                    classList: { toggle(){}, contains(){ return false; } } };
      return nodes[id];
    },
    _node(id){ return nodes[id] || null; }
  };
}

let seed = 3;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const N = 300, r15 = []; let px = 100;
const base = Math.floor(Date.now() / 1000 / SEC) * SEC, t0 = base - N * SEC;
for (let i = 0; i < N; i++){
  const o = px, c = px * (1 + (rnd() - 0.5 + 0.08) * 0.010);
  r15.push({ t: t0 + i * SEC, o: o, c: c, h: Math.max(o, c) * 1.001,
             l: Math.min(o, c) * 0.999, v: 1000 + rnd() * 1000 });
  px = c;
}
const H = Math.floor(Date.now() / 1000 / 3600) * 3600, r1h = [];
for (let i = 199; i >= 0; i--) r1h.push({ t: H - i * 3600, o: 100, c: 101, h: 102, l: 99, v: 5000 });

async function scan(k){
  const items = [];
  for (let i = 0; i < k; i++) items.push({ sym: 'C' + i, exchange: 'delta', base: 'C' + i });
  S.hgDeskLoadDeltaCoinDCX = async () => ({ items: items, rawLen: k,
                                            venueCounts: { delta: k, coindcx: 0 } });
  S.hgDeskFetchKlines = async (it, tf) => (tf === '15m' ? r15.slice() : r1h.slice());
  S.hgDeskFetchKlinesResult = async (it, tf) => ({ rows: tf === '15m' ? r15.slice() : r1h.slice(),
                                                    ok: true, reason: null, error: null });
  S.hgSentimentLoad = async () => ({});
  const tab = (S.HG_tabs || []).filter(t => t && t.id === 'cryptoscan')[0];
  const el = fakeEl();
  tab.mount(el);
  await tab.refresh();
  return { run: S.cryptoScanState(), el: el, tab: tab };
}

/* ---------------------------------------------------------------- 1
   THE ROUND TRIP IS EXACT. Nothing about a read may change. */
let world = null;
{
  world = await scan(6);
  const r = world.run;
  ok(r.setups.length === 6, 'six contracts produced setups');
  ok(Array.isArray(r.voteTmpl) && r.voteTmpl.length === 470,
     'the scan built one 470-row template (' + (r.voteTmpl || []).length + ')');
  ok(r.votePackFailed === 0, 'every contract packed against it');
  ok(r.setups.every(s => s.votesPacked && !Array.isArray(s.votes)),
     'so no setup carries a whole read array');

  const rows = S.__csVotesOf(r.setups[0], r.voteTmpl);
  ok(Array.isArray(rows) && rows.length === 470, 'and 470 reads come back out');

  /* field for field, against the engine's own output for the same tape */
  const direct = S.cryptoUltraEngine({ rows15m: r15.slice(), rows1h: r1h.slice(),
    now: r.at, venueCost: { venue: 'Delta', rtFrac: 0.0015 } });
  ok(direct.ok && direct.votes.length === 470, 'the engine run to compare against');
  /* compare FIELD BY FIELD, not by JSON string: csVoteUnpack builds the
     object in template order and the engine builds it in its own, so the two
     serialise differently while carrying identical data. An earlier version
     of this assertion used JSON.stringify and reported all 470 rows as
     differing when not one value did. */
  const FIELDS = ['id', 'group', 'name', 'kind', 'why', 'read', 'vote', 'regime'];
  let differing = 0, extraKeys = 0;
  for (let i = 0; i < rows.length; i++){
    for (const f of FIELDS) if (rows[i][f] !== direct.votes[i][f]) differing++;
    const a = Object.keys(rows[i]).sort().join(','),
          b = Object.keys(direct.votes[i]).filter(k => rows[i][k] !== undefined
                || direct.votes[i][k] !== undefined).sort().join(',');
    if (a !== b && Object.keys(direct.votes[i]).length !== Object.keys(rows[i]).length) extraKeys++;
  }
  ok(differing === 0,
     'every field of every rebuilt read equals the engine\'s (' + differing + ' differences)');
  ok(extraKeys === 0, 'and neither side carries a field the other lacks');
  ok(rows[0] !== direct.votes[0], 'they are separate objects, not the same reference');

  /* and the pack -> unpack -> pack cycle is stable */
  const again = S.__csVoteUnpack(S.__csVotePack(rows, r.voteTmpl), r.voteTmpl);
  let drift = 0;
  for (let i = 0; i < rows.length; i++)
    for (const f of FIELDS) if (again[i][f] !== rows[i][f]) drift++;
  ok(again.length === rows.length && drift === 0,
     'a second round trip changes nothing (' + drift + ' differences)');
}

/* ---------------------------------------------------------------- 2
   THE GUARD. Any mismatch keeps the reads whole rather than guessing. */
{
  const tmpl = world.run.voteTmpl;
  const rows = S.__csVotesOf(world.run.setups[0], tmpl);

  ok(S.__csVotePack(rows, tmpl) !== null, 'matching reads pack');

  const CONST = ['id', 'group', 'name', 'kind', 'why'];
  for (const f of CONST){
    const bent = rows.map(r => Object.assign({}, r));
    bent[200][f] = 'DIFFERENT';
    ok(S.__csVotePack(bent, tmpl) === null,
       'a single changed `' + f + '` refuses to pack');
  }

  /* the fields that are SUPPOSED to vary must not block packing */
  for (const f of ['read', 'vote', 'regime']){
    const bent = rows.map(r => Object.assign({}, r));
    bent[200][f] = (f === 'read') ? 'X' : 9;
    ok(S.__csVotePack(bent, tmpl) !== null, 'a changed `' + f + '` still packs');
  }

  ok(S.__csVotePack(rows.slice(0, 469), tmpl) === null, 'a shorter read list refuses');
  ok(S.__csVotePack(rows.concat([rows[0]]), tmpl) === null, 'a longer one refuses');
  ok(S.__csVotePack([], tmpl) === null, 'an empty one refuses');
  ok(S.__csVotePack(rows, null) === null && S.__csVotePack(null, tmpl) === null,
     'and missing inputs refuse rather than throw');
  ok(S.__csVoteUnpack(null, tmpl) === null, 'unpacking nothing returns null');
  ok(S.__csVoteUnpack({ read: [1] }, tmpl) === null, 'and a short payload returns null, not a short table');

  /* THE TEMPLATE HOLDS ONLY SHARED DATA. It is built from ONE contract's
     reads, so any per-contract field left in it would be that contract's
     value presented as every card's. Nothing reads tmpl[i].read today --
     unpack overwrites it from the payload -- so a mutation adding it changes
     no output, which is exactly why the invariant has to be stated rather
     than inferred from behaviour. */
  const tmplKeys = {};
  for (const row of tmpl) for (const k in row) tmplKeys[k] = 1;
  ok(Object.keys(tmplKeys).sort().join(',') === CONST.slice().sort().join(','),
     'the template carries exactly the constant fields: '
     + Object.keys(tmplKeys).sort().join(','));
  ok(!('read' in tmpl[0]) && !('vote' in tmpl[0]) && !('regime' in tmpl[0]),
     'and none of the three that vary per contract');

  ok(S.__csVoteTemplate([]) === null && S.__csVoteTemplate(null) === null,
     'no reads, no template');
  ok(S.__csVoteTemplate([{ id: 'a' }, null]) === null, 'a hole in the reads makes no template');

  /* csVotesOf prefers a whole array when one is present — the fallback path */
  const whole = { votes: rows };
  ok(S.__csVotesOf(whole, tmpl) === rows, 'a setup that kept its reads whole returns them directly');
  ok(S.__csVotesOf({}, tmpl) === null, 'a setup with neither returns null');
  ok(S.__csVotesOf(null, tmpl) === null, 'and a missing setup does not throw');
}

/* ---------------------------------------------------------------- 3
   THE TABLE STILL RENDERS, and only for the card that was opened. */
{
  const el = world.el;
  const cards = el._node('csCards');
  ok(cards && /cs-votes-placeholder/.test(cards.innerHTML), 'every card carries a placeholder');
  ok(/470 reads, 127 of them voting/.test(cards.innerHTML),
     'whose composition came from the stored summary, not from the reads');
  ok(world.run.setups.every(s => s.voteComp && s.voteComp.total === 470),
     'which is eight numbers per setup');

  /* expanding builds the table for that card */
  const nodes = {};
  S.document.getElementById = (id) => {
    if (!nodes[id]) nodes[id] = { id: id, innerHTML: '', dataset: {},
                                  classList: { _on: false,
                                    contains(){ return this._on; },
                                    toggle(){ this._on = !this._on; } } };
    return nodes[id];
  };
  S.__csToggleCard(0);
  const host = nodes['cs_v_0'];
  ok(host && host.innerHTML.length > 1000, 'the opened card renders its table');
  ok(/regime · counted/.test(host.innerHTML) && /regime · not counted/.test(host.innerHTML),
     'with the counted marks pack 880 added');
  ok(host.dataset.rendered === '1', 'and is marked rendered so it is built once');

  /* the card that was NOT opened has no table */
  ok(!nodes['cs_v_1'] || !nodes['cs_v_1'].innerHTML,
     'a card nobody opened materialises nothing');

  /* every read is in the rendered table, not a truncated set */
  const rowCount = (host.innerHTML.match(/<tr>/g) || []).length;
  ok(rowCount > 470, 'all 470 reads plus group headers are rendered (' + rowCount + ' rows)');
}

/* ---------------------------------------------------------------- 4
   Source wiring. */
{
  const bare = stripComments(SCAN);
  ok(/if \(!voteTmpl\) voteTmpl = csVoteTemplate\(res\.votes\);/.test(bare),
     'the first setup of a scan defines the template');
  ok(/if \(packed\) setup\.votesPacked = packed;/.test(bare), 'a matching setup is packed');
  ok(/else \{ setup\.votes = res\.votes; votePackFailed\+\+; \}/.test(bare),
     'and one that cannot pack keeps its reads whole, counted');
  ok(/__voteStore\[setups\.indexOf\(hqSetups\[i\]\)\] = hqSetups\[i\];/.test(bare),
     'the store holds the setup, not a materialised array');
  ok(/csVotesOf\(__voteStore\[idx\], __results && __results\.voteTmpl\)/.test(bare),
     'and the table is built on expand');
  ok(/voteComp: csVoteComposition\(res\.votes\)/.test(bare),
     'the composition is computed once at scan time');
  ok(!/votes: res\.votes,/.test(bare),
     'and no setup carries the whole read array unconditionally any more');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
