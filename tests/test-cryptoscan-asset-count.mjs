/* HARDGATE — the headline counted listings, not assets.

   CRYPTO SCAN scans Delta AND CoinDCX, both of which list the majors, and it
   reconciles nothing. BTC on Delta and BTC on CoinDCX are two universe rows,
   two engine runs, two cards and two forward records. The summary line at the
   top of the block -- "12 HIGH-QUALITY setups — 8 LONG · 4 SHORT" -- counts
   listings, and a reader counts it as opportunities.

   I WENT LOOKING FOR THE WRONG THING. The case I expected to matter was
   CONTRADICTION: the same asset LONG on one venue and SHORT on the other, both
   stamped HIGH-QUALITY. Measured over 250 paired tapes through the real
   engine, the second venue quoting the same path plus independent noise:

     venue spread  2 bps   both fired 228   agree 227   opposite 1  (0.4%)
     venue spread  5 bps   both fired 227   agree 227   opposite 0  (0.0%)
     venue spread 10 bps   both fired 227   agree 226   opposite 1  (0.4%)
     venue spread 25 bps   both fired 221   agree 218   opposite 3  (1.4%)

   and in NONE of those did both sides also clear the 75% agreement bar. The
   contradiction is real but rare, and never high-quality. Measuring first is
   what stopped a pack being built around it.

   THE FINDING IS THE OTHER 99.6%. The second venue agrees, on nearly the same
   bars, for nearly the same reason. It is not a second opinion, it is the same
   one printed twice -- and the headline counts it twice. hg-forward already
   knows better: two records on the same bar with the same horizon are
   perfectly concurrent, so pack 878's INDEP collapses them. The evidence layer
   stopped double-counting; the display layer never started.

   Nothing is deduplicated. Which venue to prefer is a trading decision -- the
   fees differ (Delta 0.15% round-trip against CoinDCX 0.20%) and so does the
   liquidity. The count now says how many distinct assets it covers, and each
   card says when the same name fired on the other venue, with the rare
   opposite-side case stamped loudly because rare is exactly when a reader
   needs telling.

   Run: node tests/test-cryptoscan-asset-count.mjs */
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
                   'liquidation-intelligence.js', 'cryptoscan-voting-v3.js',
                   'cryptoultra.js', 'hg-forward.js', 'cryptoscan.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const S = boot();
const SCAN = fs.readFileSync(root + 'cryptoscan.js', 'utf8');

const mk = (label, ex, dir, hq) => ({
  label: label, sym: label + 'X', exchange: ex, dir: dir, isHighQuality: !!hq,
  pct: 0.8, count: { decisive: 40, total: 470, kinds: {} }, line: 'x', price: 100,
  item: { exchange: ex },
  plan: { entry: 100, stop: 98.5, t1: 102.25, stopAtr: 1.5, rr1: 1.5, rr2: 2.5,
          timeoutBars: 24, orderType: 'BUY' }
});

/* ---------------------------------------------------------------- 1
   The tally separates listings from assets. */
{
  const T = S.__csAssetTally;
  ok(typeof T === 'function', 'csAssetTally is exported');

  const rows = [mk('BTC', 'delta', 'long', true), mk('BTC', 'coindcx', 'long', true),
                mk('ETH', 'delta', 'long', true),
                mk('SOL', 'delta', 'short', false), mk('SOL', 'coindcx', 'long', false)];
  const t = T(rows);
  ok(t.setups === 5, 'five listings');
  ok(t.assets === 3, 'but only three assets');
  ok(t.hq === 3 && t.hqAssets === 2,
     'three high-quality listings covering two assets — the number a reader wants');
  ok(t.paired === 2, 'two names fired on both venues');
  ok(t.opposed === 1, 'one of those two fired opposite sides');

  /* a single-venue scan must look exactly as it always did */
  const solo = T([mk('BTC', 'delta', 'long', true), mk('ETH', 'delta', 'short', true)]);
  ok(solo.setups === 2 && solo.assets === 2 && solo.paired === 0 && solo.opposed === 0,
     'a single-venue scan has nothing to reconcile');

  ok(T([]).assets === 0 && T(null).assets === 0, 'an empty or missing list tallies zero');
  ok(T([null, undefined, {}]).setups === 0, 'rows with no name are not counted as assets');
  ok(T([mk('BTC', 'delta', 'long', false), mk('BTC', 'delta', 'long', false)]).paired === 0,
     'two rows on the SAME venue are not a cross-venue pair');
  ok(T([mk('BTC', 'delta', 'long', false), mk('BTC', 'delta', 'long', false)]).assets === 1,
     'though they are still one asset');
}

/* ---------------------------------------------------------------- 2
   The notes appear only when they say something. */
{
  ok(S.__csAssetNote(5, 3) === ' across 3 assets', 'the asset note names the smaller number');
  ok(S.__csAssetNote(3, 3) === '',
     'and says NOTHING when every listing is its own asset — no noise on a single-venue scan');
  ok(S.__csAssetNote(0, 0) === '' && S.__csAssetNote(3, 0) === '', 'nor with nothing to count');
  ok(S.__csAssetNote(3, 5) === '', 'nor if the numbers are the wrong way round');
  ok(S.__csAssetNote(1, 1) === '', 'one listing, one asset, no note');

  const T = S.__csAssetTally;
  const t = T([mk('BTC', 'delta', 'long', true), mk('BTC', 'coindcx', 'long', true)]);
  const pn = S.__csPairedNote(t);
  ok(/1 name fired on both venues/.test(pn), 'the paired note is singular for one');
  ok(/hg-forward already treats those as one observation/.test(pn),
     'and points at the layer that already collapses them');
  ok(!/OPPOSITE/.test(pn), 'with no contradiction, it does not mention one');

  const opp = T([mk('SOL', 'delta', 'short', false), mk('SOL', 'coindcx', 'long', false)]);
  ok(/fired OPPOSITE sides/.test(S.__csPairedNote(opp)), 'a contradiction is called out');
  ok(S.__csPairedNote(T([mk('BTC', 'delta', 'long', true)])) === '',
     'a scan with no pairs carries no paired note');
  ok(S.__csPairedNote(null) === '', 'and a missing tally does not throw');
}

/* ---------------------------------------------------------------- 3
   The card chip. */
{
  const T = S.__csAssetTally;
  const rows = [mk('BTC', 'delta', 'long', true), mk('BTC', 'coindcx', 'long', true),
                mk('ETH', 'delta', 'long', true),
                mk('SOL', 'delta', 'short', false), mk('SOL', 'coindcx', 'long', false)];
  const t = T(rows);

  ok(S.__csPairNote(rows[0], t) === 'same call on CoinDCX',
     'the Delta BTC card names the other venue');
  ok(S.__csPairNote(rows[1], t) === 'same call on Delta', 'and the CoinDCX one names Delta');
  ok(S.__csPairNote(rows[2], t) === '', 'the single-venue name carries no chip');
  ok(/OPPOSITE SIDE ON COINDCX/.test(S.__csPairNote(rows[3], t)),
     'and the contradiction is stamped, loudly');
  ok(S.__csPairNote(rows[3], t) !== S.__csPairNote(rows[0], t),
     'the two cases do not share wording');
  ok(S.__csPairNote(null, t) === '' && S.__csPairNote(rows[0], null) === '',
     'missing inputs produce no chip rather than throwing');

  /* A ROW WITH NO VENUE TAG. csAssetTally only records an exchange it was
     given, so a name with one tagged row and one untagged row has a single
     entry in `venues`. Rendering the untagged card then compares its own
     (absent) exchange against that one venue, finds a difference, and would
     claim a cross-venue pair that does not exist -- unless the count of
     venues is checked first. The `others.length` guard alone does not catch
     this, which a mutation of the venue-count guard proved. */
  const untagged = [mk('XRP', 'delta', 'long', false), mk('XRP', 'delta', 'long', false)];
  delete untagged[1].exchange;
  const ut = T(untagged);
  ok(ut.assets === 1 && ut.paired === 0, 'one asset, one venue, no pair');
  ok(ut.byAsset.XRP.venues.length === 1, 'and only the tagged venue was recorded');
  ok(S.__csPairNote(untagged[1], ut) === '',
     'so the untagged card claims no other venue');
  ok(S.__csPairNote(untagged[0], ut) === '', 'and neither does the tagged one');

  /* csPairNote carries a SECOND guard, `if (!others.length) return ''`, and it
     is unreachable while the venue-count guard above holds: a deduped list of
     two or more venues always contains one that is not this card's. Deleting
     it is therefore an equivalent mutation and survives, as it should. It
     stays because without it an empty `others` would render "same call on "
     with nothing after it, and the list is built a few lines away from where
     it is read. */
  ok(S.__csPairNote(rows[0], t).indexOf('same call on ') === 0
     && S.__csPairNote(rows[0], t).length > 'same call on '.length,
     'the chip never ends on a dangling "on"');

  /* the venue name is shared, so the chip and the label cannot drift apart */
  ok(S.__csVenueName('coindcx') === 'CoinDCX' && S.__csVenueName('cdcx') === 'CoinDCX',
     'both CoinDCX venue codes resolve to one name');
  ok(S.__csVenueName('delta') === 'Delta' && S.__csVenueName('binance') === 'Binance',
     'and the other two');
  ok(S.__csVenueName('') === '' && S.__csVenueName(null) === '', 'an unknown venue names nothing');

  /* rendered */
  const card = text(S.__csSetupCardHTML(rows[0], 0, t));
  ok(/same call on CoinDCX/.test(card), 'the chip reaches the card');
  const oppCard = text(S.__csSetupCardHTML(rows[3], 3, t));
  ok(/OPPOSITE SIDE ON COINDCX/.test(oppCard), 'and so does the opposite-side stamp');
  const soloCard = text(S.__csSetupCardHTML(rows[2], 2, t));
  ok(!/same call on/.test(soloCard) && !/OPPOSITE/.test(soloCard),
     'a single-venue card is unchanged');
  /* a card rendered with no tally at all must still render */
  ok(text(S.__csSetupCardHTML(rows[0], 0)).length > 50,
     'and a card built without a tally still renders');
}

/* ---------------------------------------------------------------- 4
   Source wiring, and the dead pair that went with it. */
{
  const bare = stripComments(SCAN);
  ok(/var tally = csAssetTally\(setups\);/.test(bare), 'renderCards builds the tally once');
  ok((bare.match(/setupCardHTML\((hq|lq)Setups\[i\], setups\.indexOf\((hq|lq)Setups\[i\]\), tally\)/g) || []).length === 2,
     'and hands it to both card blocks');
  ok(/csAssetNote\(tally\.hq, tally\.hqAssets\)/.test(bare),
     'the HIGH-QUALITY count carries its asset count');
  ok(/csAssetNote\(tally\.setups, tally\.assets\)/.test(bare),
     'and so does the total');
  ok(/csPairedNote\(tally\)/.test(bare), 'with the one-line explanation beside them');

  /* allLongs / allShorts were computed on every render and read by nothing */
  ok(!/allLongs/.test(bare) && !/allShorts/.test(bare),
     'the two counts nothing ever read are gone');
  ok(/allLongs/.test(SCAN), 'though the comment still records that they existed');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
