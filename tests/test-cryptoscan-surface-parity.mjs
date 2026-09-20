/* HARDGATE — the same fact, told four different ways on one screen.

   CRYPTO SCAN states its counts on FOUR surfaces: the live status line, the
   summary block above the cards, the COVERAGE line, and the closing footer.
   Three packs in a row added a fact to one of them and did not walk the rest:

     pack 882  split a SCORING CRASH out of `errors` -- read, voted on, and
               then our own code threw -- and taught COVERAGE to say so. The
               empty state still rendered "The other 0 were never read"
               (fixed in 885), and the STATUS LINE still reported "0 errors"
               for a run where forty contracts crashed (fixed here).

     pack 883  taught the summary block that this desk counts LISTINGS, not
               assets -- BTC on Delta and BTC on CoinDCX are two rows for one
               asset -- and qualified both its numbers with "across N assets".
               The FOOTER restates the same two numbers unqualified (fixed
               here).

   Each was an additive change that improved the surface it was aimed at and
   left a sibling contradicting it. This file is the guard: it renders every
   surface from ONE run and asserts they agree, so the next addition has to
   walk them or fail here.

   Run: node tests/test-cryptoscan-surface-parity.mjs */
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
const text = h => String(h).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

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

const realFlow = S.hgOrderFlowScore;

/** drive the real runScan and capture every surface it writes */
async function drive(items, opts){
  const o = opts || {};
  S.hgDeskLoadDeltaCoinDCX = async () => ({ items: items, rawLen: items.length,
    venueCounts: { delta: items.filter(x => x.exchange === 'delta').length,
                   coindcx: items.filter(x => x.exchange === 'coindcx').length } });
  S.hgDeskFetchKlines = async (it, tf) => (tf === '15m' ? r15.slice() : r1h.slice());
  S.hgDeskFetchKlinesResult = async (it, tf) => {
    if (o.fetchThrow && o.fetchThrow.indexOf(it.sym) >= 0) throw new Error('fetch exploded');
    return { rows: tf === '15m' ? r15.slice() : r1h.slice(), ok: true, reason: null, error: null };
  };
  S.hgSentimentLoad = async () => ({});
  S.hgOrderFlowScore = function(sym, a, b){
    if (o.scoreThrow && o.scoreThrow.indexOf(sym) >= 0) throw new Error('scoring blew up');
    return realFlow.call(this, sym, a, b);
  };
  const tab = (S.HG_tabs || []).filter(t => t && t.id === 'cryptoscan')[0];
  const el = fakeEl();
  tab.mount(el);
  await tab.refresh();
  S.hgOrderFlowScore = realFlow;
  const r = S.cryptoScanState();
  const cards = el._node('csCards');
  const cardHtml = cards ? cards.innerHTML : '';
  return {
    run: r,
    /* setStat writes textContent, not innerHTML — reading the wrong property
       made every status assertion below pass or fail on an empty string */
    status: (el._node('csStat') || {}).textContent || '',
    cards: text(cardHtml),
    /* The footer is rendered INTO the cards host, so a regex over the whole
       host is satisfied by either surface — which let a mutation deleting the
       summary block's qualifier survive. Cut the summary block out on its own. */
    summary: text((/<div class="cs-summary">[\s\S]*?<\/div>\s*<\/div>/.exec(cardHtml) || [''])[0]),
    coverage: text(S.csCoverageHTML(r)),
    footer: text(S.csFooterNote(r.setups, r.setups.filter(x => x.isHighQuality).length,
                                S.csBlockerTally(r.setups)))
  };
}

const sym = (s, ex) => ({ sym: s, exchange: ex, base: s });

/* ---------------------------------------------------------------- 1
   A SCORING CRASH REACHES EVERY SURFACE. */
{
  const v = await drive([sym('AAA', 'delta'), sym('BBB', 'delta'), sym('CCC', 'delta')],
                        { scoreThrow: ['BBB'] });
  ok(v.run.scoreFailed === 1, 'one contract crashed in scoring');
  ok(v.run.errors === 0, 'and it is not counted as a fetch error');

  ok(/1 scoring crash/.test(v.status),
     'the STATUS LINE names it: "' + text(v.status) + '"');
  ok(/0 errors/.test(v.status), 'while still reporting zero fetch errors');
  ok(/read and voted, then scoring threw/.test(v.coverage),
     'the COVERAGE line names it');

  /* the status line is where a reader watches the scan run — it must not be
     the one surface that stays silent */
  ok(text(v.status).indexOf('scoring') >= 0 && v.coverage.indexOf('scoring') >= 0,
     'both the transient and the persistent surface mention scoring');

  /* and a clean run says nothing about scoring anywhere */
  const clean = await drive([sym('AAA', 'delta'), sym('BBB', 'delta')]);
  ok(clean.run.scoreFailed === 0, 'a clean run crashes nowhere');
  /* assert the line is PRESENT before asserting what it omits — against an
     empty string every "does not mention" check passes for the wrong reason */
  ok(/setup\(s\) from 2 scanned/.test(text(clean.status)),
     'the clean status line is rendered: "' + text(clean.status).slice(0, 70) + '"');
  ok(!/scoring/.test(text(clean.status)), 'and stays quiet about scoring');
  ok(clean.coverage.length > 20 && !/scoring threw/.test(clean.coverage),
     'COVERAGE is rendered and quiet too');
}

/* ---------------------------------------------------------------- 2
   THE ASSET QUALIFIER REACHES EVERY SURFACE THAT COUNTS SETUPS. */
{
  /* the same base on both venues: two listings, one asset */
  const v = await drive([sym('BTC', 'delta'), sym('BTC', 'coindcx'), sym('ETH', 'delta')]);
  const t = S.__csAssetTally(v.run.setups);
  ok(t.setups > t.assets,
     v.run.setups.length + ' listings covering ' + t.assets + ' assets');
  ok(t.paired === 1, 'one name fired on both venues');

  ok(v.summary.length > 20, 'the summary block was captured on its own ('
     + v.summary.slice(0, 60) + ')');
  ok(!/FILTERED FOR QUALITY/.test(v.summary), 'without the footer inside it');
  ok(/across \d+ assets?/.test(v.summary),
     'the SUMMARY BLOCK carries the qualifier');
  ok(/across \d+ assets?/.test(v.footer),
     'and so does the FOOTER: "' + v.footer.slice(0, 90) + '..."');

  /* the two surfaces must agree on the number, not merely both mention one */
  const inCards = (/across (\d+) assets?/.exec(v.summary) || [])[1];
  const inFooter = (/across (\d+) assets?/.exec(v.footer) || [])[1];
  ok(inCards && inFooter, 'both surfaces state a number');
  ok(+inFooter === t.assets,
     'and the footer states the total asset count (' + inFooter + ')');

  /* a single-venue scan gains nothing on either surface */
  const solo = await drive([sym('BTC', 'delta'), sym('ETH', 'delta')]);
  const st = S.__csAssetTally(solo.run.setups);
  ok(st.setups === st.assets, 'a single-venue scan is one listing per asset');
  ok(!/across \d+ assets?/.test(solo.summary), 'the summary adds nothing');
  ok(!/across \d+ assets?/.test(solo.footer), 'and neither does the footer');
}

/* ---------------------------------------------------------------- 3
   THE SURFACES DO NOT CONTRADICT EACH OTHER. */
{
  const v = await drive([sym('BTC', 'delta'), sym('BTC', 'coindcx'),
                         sym('ETH', 'delta'), sym('SOL', 'delta')],
                        { scoreThrow: ['SOL'] });

  /* the setup count is the same number wherever it is stated */
  const n = v.run.setups.length;
  ok(new RegExp('Out of ' + n + ' total signals').test(v.footer),
     'the footer states ' + n + ' signals');
  ok(new RegExp('\\b' + n + ' total signals').test(v.cards),
     'and the summary block states the same ' + n);
  ok(new RegExp(n + ' setup\\(s\\) from').test(text(v.status)),
     'and so does the status line');

  /* the scanned count is one per contract, everywhere */
  ok(v.run.scanned === 4, 'four contracts, scanned four');
  ok(/from 4 scanned/.test(text(v.status)), 'the status line says four');
  ok(/of 4 contracts read/.test(v.coverage), 'and COVERAGE says four');

  /* the crash is named on both the transient and the persistent surface, and
     nowhere claimed as something else */
  ok(/1 scoring crash/.test(text(v.status)) && /scoring threw/.test(v.coverage),
     'the crash is on both');
  ok(!/1 errors/.test(text(v.status)), 'and is not double-counted as an error');

  /* A FETCH THROW reaches the OUTER catch — the one that used to tick
     `scanned` a second time for a contract the body had already counted. The
     scoring crash above never reaches it, so without this case a mutation
     restoring the double tick survives every assertion here. */
  const f = await drive([sym('AAA', 'delta'), sym('BBB', 'delta'), sym('CCC', 'delta')],
                        { fetchThrow: ['BBB'] });
  ok(f.run.errors === 1, 'the fetch throw is one error');
  ok(f.run.scanned === 3,
     'and the contract is counted once, not twice (' + f.run.scanned + ' of 3)');
  ok(/from 3 scanned/.test(text(f.status)), 'the status line says three');
  ok(/of 3 contracts read/.test(f.coverage) || /2 of 3 contracts read/.test(f.coverage),
     'and COVERAGE is built on the same three');
  ok(/1 errors/.test(text(f.status)), 'with the error named');
  ok(!/scoring crash/.test(text(f.status)), 'and not confused with a scoring crash');

  /* The `!scannedThis` guard in the outer catch (pack 882) cannot be shown to
     fire by any stub, and a mutation removing it survives. That is correct
     rather than a gap: since 882 wrapped the scoring in its own try, the only
     code between the tick and that inner try is setProgress, which swallows
     its own errors, so nothing in that window can reach the outer catch after
     the body has already counted. The guard is defence against a future
     unguarded statement landing there — which is exactly the shape of the bug
     882 fixed. What IS testable is that both paths count once, and both cases
     are covered: a fetch throw above (never ticked) and a scoring crash
     (ticked, inner catch). */
  ok(f.run.scanned === 3 && v.run.scanned === 4,
     'both catch paths count each contract exactly once');
}

/* ---------------------------------------------------------------- 4
   Source: the fixes are wired where they were missing. */
{
  const bare = stripComments(SCAN);
  ok(/\(scoreFailed \? ' · ' \+ scoreFailed \+ ' scoring crashes' : ''\)/.test(bare),
     'the status line consults scoreFailed');
  ok(/var assets = csAssetTally\(setups\);/.test(bare),
     'the footer builds its own asset tally, as it already did for the blocker tally');
  ok(/csAssetNote\(assets\.setups, assets\.assets\)/.test(bare),
     'and qualifies the total with it');

  /* the WHY EMPTY panel deliberately keeps LISTING counts: a gate blocked that
     listing, on that venue's bars, so per-listing is the right unit there */
  ok(/tally\.n \+ ' signal'/.test(bare),
     'WHY EMPTY still counts listings, which is the right unit for a per-gate tally');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
