/* HARDGATE — a six-day-old sentiment reading was being scored as a live one.

   Every row scripts/sentiment-engine.py writes carries its own `ttl`, and the
   engine enforces it on the producing side:

     def is_cache_fresh(self, symbol):
         if symbol not in self.cache: return False
         try:
             age = (utcnow() - parse(entry['timestamp'])).total_seconds()
             return age < entry.get('ttl', CACHE_TTL)
         except: return False

   The browser never implemented its half. sentiment.js read `stale` straight
   off the row and nothing else — and the engine only sets that flag when it
   fails to find any source, never on a row it wrote successfully. So:

     scripts/sentiment-cache/sentiment.json, as committed
       BTCUSDT / ETHUSDT / SOLUSDT   score +0.272   ttl 300   age 6.4 days
       is_cache_fresh says False for all three; the browser said fresh

   That reading carried 25% of the three-layer confidence — worth 0.078 on
   every BTC/ETH/SOL card — while the badge beside it read "bullish lean"
   rather than stale. Over 280 swept cells, 27 long setups held the >= 0.75
   PROFESSIONAL-GRADE bar ONLY on that stale number, and 144 (51%) printed a
   different tier than they should have.

   It cut the other way too: hgSentimentGate can push a major conflict into
   CRYPTO SCAN's quality gates, so a six-day-old headline score could also
   VETO a setup. Neither direction is defensible, and both close here.

   What ships is a port of is_cache_fresh, rule for rule, including its two
   False-by-default cases: a symbol with no row, and a timestamp that will not
   parse. No threshold in it is invented — the ttl is the data's own, and the
   default is the engine's CACHE_TTL used exactly where the engine uses it.

   The loader is fixed with it, because otherwise the rule would mark
   everything stale five minutes in and never recover: hgSentimentLoad
   memoised its promise for the life of the page, so sentiment was fetched
   once per load and never again on a tab built to stay open across a
   10-minute scan cycle.

   Run: node tests/test-cryptoscan-sentiment-stale.mjs */
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

function boot(fetchStub){
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date,
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error };
  s.window = s; s.globalThis = s; s.self = s;
  s.fetch = fetchStub || (() => Promise.reject(new Error('no network in this harness')));
  s.document = { getElementById: () => null, querySelector: () => null,
                 createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }),
                 head: { appendChild(){} }, addEventListener(){} };
  vm.createContext(s);
  for (const f of ['sentiment.js', 'cryptoscan-voting-v3.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const S = boot();
const SENT_SRC = fs.readFileSync(root + 'sentiment.js', 'utf8');
const SCAN_SRC = fs.readFileSync(root + 'cryptoscan.js', 'utf8');
const NOW = Date.UTC(2026, 8, 19, 12, 0, 0);
const iso = ms => new Date(ms).toISOString();
const seed = obj => { S.HG_SENTIMENT.cache = obj; };
const near = (a, b) => Math.abs(a - b) < 1e-9;

/* ---------------------------------------------------------------- 1 */
console.log('\n1. the contract, and which side of it was implemented');
{
  const py = fs.readFileSync(root + 'scripts/sentiment-engine.py', 'utf8');
  ok(/CACHE_TTL = 300/.test(py), 'the engine defines CACHE_TTL = 300');
  ok(/'ttl': CACHE_TTL/.test(py), 'and stamps it onto every row it writes');
  ok(/return age < entry\.get\('ttl', CACHE_TTL\)/.test(py),
     'is_cache_fresh compares age against that ttl — the rule being ported');
  ok(/if symbol not in self\.cache:\s*\n\s*return False/.test(py),
     'a symbol with no row is False there');
  ok(/'stale': True/.test(py),
     "and the engine's own stale flag is set only when no source was reachable");

  const js = stripComments(SENT_SRC);
  ok(/var SENTIMENT_TTL_DEFAULT = 300;/.test(js), 'sentiment.js mirrors CACHE_TTL as its default');
  ok(!/loadThreshold/.test(js),
     'the unused loadThreshold config is gone — the ttl on the data is the only clock');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. the cache as committed, read through the ported rule');
{
  const disk = JSON.parse(fs.readFileSync(root + 'scripts/sentiment-cache/sentiment.json', 'utf8'));
  const keys = Object.keys(disk);
  ok(keys.length === 3, 'the shipped cache carries three symbols');
  seed(disk);

  let stale = 0, aged = 0;
  for (const k of keys){
    const g = S.hgSentimentGet(k, NOW);
    if (g.stale) stale++;
    if (g.ageSec > g.ttl * 100) aged++;
  }
  ok(stale === 3, 'all three read stale');
  ok(aged === 3, 'each is more than a hundred times its own ttl past its stamp');

  const btc = S.hgSentimentGet('BTCUSDT', NOW);
  ok(btc.ttl === 300 && btc.fresh === false, 'BTCUSDT: ttl 300, fresh false');
  ok(btc.score === 0.272, 'and the raw score is still reported — it is what was read');
  ok(/^6\.\dd$/.test(S.hgSentimentAgeLabel(btc)), 'its age prints in days (' + S.hgSentimentAgeLabel(btc) + ')');
  const badge = S.hgSentimentBadge(btc);
  ok(badge.cls === 'stale' && /stale/.test(badge.label),
     'the badge says stale, where it used to say "bullish lean" (' + badge.label + ')');
  ok(/ttl/.test(badge.title || ''), 'and its tooltip names the ttl it failed');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. the two cases the engine defaults to False, ported as they are');
{
  seed({ GOOD: { score: 0.5, timestamp: iso(NOW - 60000), ttl: 300 } });

  const none = S.hgSentimentGet('NOSUCHUSDT', NOW);
  ok(none.missing === true && none.stale === true, 'a symbol with no row is missing and stale');
  ok(none.score === 0 && none.ageSec === null, 'it reports no score and no age, rather than a zero reading');
  ok(S.hgSentimentBadge(none).label.indexOf('no sentiment data') >= 0,
     'and its badge says so, instead of "neutral" (' + S.hgSentimentBadge(none).label + ')');

  seed({ BAD: { score: 0.9, timestamp: 'not a date', ttl: 300 } });
  ok(S.hgSentimentGet('BAD', NOW).stale === true, 'a timestamp that will not parse is stale, not fresh');
  seed({ BAD2: { score: 0.9, ttl: 300 } });
  ok(S.hgSentimentGet('BAD2', NOW).stale === true, 'and so is a row with no timestamp at all');

  /* the engine's own flag still forces it, even on a fresh stamp */
  seed({ FLAGGED: { score: 0.9, timestamp: iso(NOW - 10000), ttl: 300, stale: true } });
  const fl = S.hgSentimentGet('FLAGGED', NOW);
  ok(fl.fresh === true && fl.stale === true,
     "a row the engine marked stale stays stale however recent its stamp");

  seed({ NOTTL: { score: 0.5, timestamp: iso(NOW - 400000), ttl: undefined } });
  ok(S.hgSentimentGet('NOTTL', NOW).ttl === 300, "a row with no ttl falls back to the engine's 300");
  ok(S.hgSentimentGet('NOTTL', NOW).stale === true, 'and is judged against it');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. a fresh reading behaves exactly as it did before');
{
  /* hgSentimentScoreSignal and hgSentimentGate read the clock themselves — they
     call hgSentimentGet(symbol) with no nowMs — so a fixture meant for them has
     to be stamped against the real Date.now(), not this file's fixed NOW. */
  seed({ FRESHUSDT: { score: -0.80, timestamp: iso(Date.now() - 60000), ttl: 300, source_count: 2 } });
  const f = S.hgSentimentGet('FRESHUSDT');
  ok(f.fresh === true && f.stale === false, 'one minute old against a 300s ttl is fresh');
  ok(S.hgSentimentBadge(f).cls === 'bearish', 'its badge reads the direction, not a staleness chip');

  ok(near(S.hgSentimentScoreSignal('FRESHUSDT', 0.80, 'long'), 0.64),
     'a long against strong bearish sentiment is still penalised to 0.64');
  ok(S.hgSentimentScoreSignal('FRESHUSDT', 0.80, 'short') > 0.80,
     'and a short with it is still boosted');
  const g = S.hgSentimentGate('FRESHUSDT', 'long', 0.60);
  ok(g.shouldTrade === false && g.conflictLevel === 'major',
     'the gate still blocks a low-confidence long into strong bearish sentiment');

  /* the boundary itself: ttl seconds old is already too old, per `age < ttl` */
  seed({ EDGE: { score: 0.5, timestamp: iso(NOW - 299000), ttl: 300 } });
  ok(S.hgSentimentGet('EDGE', NOW).fresh === true, '299s old is fresh');
  seed({ EDGE: { score: 0.5, timestamp: iso(NOW - 300000), ttl: 300 } });
  ok(S.hgSentimentGet('EDGE', NOW).fresh === false, 'exactly 300s is not — the engine uses a strict <');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. nothing scores a stale reading, and nothing vetoes on one');
{
  seed({ STALEUSDT: { score: 0.90, timestamp: iso(NOW - 6.4 * 86400000), ttl: 300, source_count: 2 } });

  ok(near(S.hgSentimentScoreSignal('STALEUSDT', 0.80, 'long'), 0.80),
     'hgSentimentScoreSignal hands back the base confidence untouched');
  ok(near(S.hgSentimentScoreSignal('STALEUSDT', 0.80, 'short'), 0.80),
     'in both directions — it neither boosts nor penalises');

  const gate = S.hgSentimentGate('STALEUSDT', 'short', 0.60);
  ok(gate.shouldTrade === true && gate.conflictLevel === 'none',
     'hgSentimentGate does not veto: a cold headline score is not grounds to kill a setup');
  ok(/stale/.test(gate.reason) && /ttl 300s/.test(gate.reason),
     'and it says why in words the card can print (' + gate.reason + ')');

  /* the blend: what the stale number was worth */
  const blend = sent => S.hgComputeThreeLayerConfidence(
    { pct: 0.80, dir: 'long' }, { score: 0.5, dir: 'long' }, { sentiment: sent }, {}).confidence;
  const live = blend(0.272), dropped = blend(0);
  ok(near(live - dropped, 0.272 * 0.25 * 1.15),
     'the shipped +0.272 was worth ' + (live - dropped).toFixed(3) + ' of confidence on every card');

  /* how many cards crossed 0.75 on it alone */
  const conf = (d, pct, flow, sent) => S.hgComputeThreeLayerConfidence(
    { pct: pct, dir: d }, { score: (d === 'short' ? -flow : flow), dir: d },
    { sentiment: sent }, {}).confidence;
  let cells = 0, onlyOnStale = 0, tierMoved = 0;
  const tierOf = c => c >= 0.85 ? 'professional-grade' : c >= 0.75 ? 'professional'
                    : c >= 0.65 ? 'standard' : 'weak';
  for (let pct = 0.60; pct <= 0.98001; pct += 0.02){
    for (let flow = 0.3; flow <= 0.9001; flow += 0.1){
      for (const d of ['long', 'short']){
        cells++;
        const scored = conf(d, +pct.toFixed(2), +flow.toFixed(2), d === 'short' ? -0.272 : 0.272);
        const notScored = conf(d, +pct.toFixed(2), +flow.toFixed(2), 0);
        if (d === 'long' && scored >= 0.75 && notScored < 0.75) onlyOnStale++;
        if (tierOf(scored) !== tierOf(notScored)) tierMoved++;
      }
    }
  }
  ok(cells === 280, 'the grid is the 280 cells the report measured');
  ok(onlyOnStale === 27, '27 long setups held the pro-grade bar only on the stale reading');
  ok(tierMoved === 144, 'and 144 of 280 printed a tier they had not earned');
}

/* ---------------------------------------------------------------- 6 */
console.log('\n6. the loader refetches instead of memoising for the life of the page');
{
  let calls = 0;
  const body = { X: { score: 0.1, timestamp: iso(Date.now()), ttl: 300 } };
  const T = boot(() => { calls++; return Promise.resolve({ ok: true, json: () => Promise.resolve(body) }); });

  await T.hgSentimentLoad();
  ok(calls === 1, 'the first call fetches');
  await T.hgSentimentLoad();
  ok(calls === 1, 'a second call while the data is inside its ttl does not');

  /* age the cache past its ttl and ask again */
  T.HG_SENTIMENT.cache.X.timestamp = iso(Date.now() - 400000);
  ok(T.hgSentimentCacheFresh() === false, 'once past the ttl the cache reports itself cold');
  await T.hgSentimentLoad();
  ok(calls === 2, 'and the next call fetches again — it used to never fetch twice');

  const inflight = [T.hgSentimentLoad(true), T.hgSentimentLoad(true)];
  await Promise.all(inflight);
  ok(calls === 3, 'two forced calls at once still share one request');

  const src = stripComments(SENT_SRC);
  ok(/HG_SENTIMENT\.loadPromise = null;/.test(src),
     'the promise is cleared when it settles, which is what makes a refetch possible');

  /* ------------------------------------------------------------ 7 */
  console.log('\n7. the tab stops feeding the stale number to the scorer');
  {
    const scan = stripComments(SCAN_SRC);
    ok(/sentimentLive = \(sentiment && sentiment\.stale\) \? 0 : \(sentiment\.score \|\| 0\)/.test(scan),
       'cryptoscan.js computes a sentimentLive that is 0 when the row is stale');
    ok(/\{ sentiment: sentimentLive \}/.test(scan),
       'and that, not the raw score, is what reaches the confidence blend');
    ok(!/\{ sentiment: sentiment\.score \|\| 0 \}/.test(scan),
       'the raw score no longer goes straight in');
    ok(/sentiment: sentiment,/.test(scan) && /sentimentLive: sentimentLive,/.test(scan),
       'both are kept on the setup, so the card can print what was read and what counted');
    ok(/s\.sentiment\.stale/.test(scan) && /not scored/.test(scan),
       'and the layer-3 line on the card labels a stale read instead of colouring it');
  }
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
