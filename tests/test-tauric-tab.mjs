/* HARDGATE — the TAURIC tab: a foreign multi-agent pipeline, held to this
   desk's rules.

   TradingAgents (TauricResearch) is Python and every one of its agents is an
   LLM call. It cannot run in this page, so it runs out of process behind
   /api/tauric and the tab renders what comes back. That seam is where a desk
   like this one usually starts lying to itself, so this file pins the places
   it must not:

     A VIEW IS NOT A TRADE. The pipeline returns a five-tier rating and no
     levels — it does not produce them. The tab prices the side on THIS
     desk's bars through THIS desk's plan layer, and when either is missing
     it says the view is unpriced rather than printing a number it invented.

     'REVIEW' IS NOT 'HOLD'. TradingAgents returns the literal REVIEW when a
     decision had no parseable rating (its #1170). That is an unreadable
     answer, not a flat one, and mapping it to flat would turn a parse
     failure into a trading opinion.

     THREE FAILURES ARE THREE FAILURES. Not installed, no LLM key, and a
     blocked data vendor need different things from the reader — clone it,
     paste a key, unblock a host. Collapsed into one "error" the tab tells
     somebody their install is broken when they only needed a key.

     THE RULE APPLIES TO THE NEWCOMER TOO. hg-v756 made measured-edge hard.
     TAURIC has no measured record, so it is a WATCH by construction. The
     newest and least-tested source on the desk does not get the exemption
     the 54 measured mechanics never got.

     A REFRESH DOES NOT SPEND MONEY. The page's hard-refresh sweep calls
     every tab's refresh(). If that ran the pipeline, reloading would burn a
     quota.

   Run: node tests/test-tauric-tab.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

const store = {};
const el = () => ({ style: {}, innerHTML: '', textContent: '', className: '',
  classList: { add(){}, remove(){}, toggle(){}, contains: () => false },
  appendChild(){}, setAttribute(){}, addEventListener(){},
  querySelector: () => null, querySelectorAll: () => [], dataset: {} });
const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
              parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Infinity, NaN,
              Float64Array, setTimeout: () => 0, clearTimeout: () => {}, encodeURIComponent,
              fetch: () => Promise.reject(new Error('no net in tests')),
              localStorage: { getItem: k => (k in store ? store[k] : null),
                              setItem: (k, v) => { store[k] = String(v); },
                              removeItem: k => { delete store[k]; } } };
ctx.document = { createElement: el, getElementById: () => null, querySelector: () => null,
                 querySelectorAll: () => [], head: el(), body: el(), documentElement: el(),
                 addEventListener(){}, readyState: 'complete' };
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = [];
vm.createContext(ctx);
for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                 'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js', 'omniroute.js',
                 'omnigold.js', 'tauric.js']){
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
  catch (e) { /* optional deps degrade */ }
}
const TAB = fs.readFileSync(path.join(ROOT, 'tauric.js'), 'utf8');
const API = fs.readFileSync(path.join(ROOT, 'lib/tauric-api.mjs'), 'utf8');
const BRIDGE = fs.readFileSync(path.join(ROOT, 'scripts/tauric-bridge.py'), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SERVER = fs.readFileSync(path.join(ROOT, 'scripts/server.mjs'), 'utf8');

console.log('== the tab exists, in the gold group, after the desk it borrows from ==');
{
  const tab = (ctx.HG_tabs || []).find(t => t && t.id === 'tauric');
  ok(!!tab, 'TAURIC registers on HG_tabs');
  ok(tab.label === 'TAURIC', 'with its own label');
  ok(typeof tab.mount === 'function' && typeof tab.refresh === 'function',
     'and both lifecycle hooks, like every other module');

  const gold = HTML.match(/\{ id:'gold',[^\n]*tabs:\[([^\]]*)\]/);
  ok(!!gold, 'the gold nav group is readable from index.html');
  ok(/'tauric'/.test(gold[1]), 'and TAURIC is in it — under GOLD, not in the TOOLS fallback');

  const iOmni = HTML.indexOf('<script src="omnigold.js');
  const iTau = HTML.indexOf('<script src="tauric.js');
  ok(iOmni > 0 && iTau > 0, 'both scripts are loaded');
  ok(iTau > iOmni,
     'and tauric.js loads AFTER omnigold.js, whose fetcher and plan layer it prices views with');
}

console.log('\n== a rating is a view, and REVIEW is not a view ==');
{
  const R = ctx.hgTauricRating;

  ok(R('Buy').dir === 'long' && R('Buy').conviction === 'high', 'Buy is a high-conviction long');
  ok(R('Overweight').dir === 'long' && R('Overweight').conviction === 'low',
     'Overweight is the same side with less conviction');
  ok(R('Sell').dir === 'short' && R('Sell').conviction === 'high', 'Sell is a high-conviction short');
  ok(R('Underweight').dir === 'short', 'Underweight is the same side with less');
  ok(R('  sell  ').dir === 'short', 'and the rating is read case- and space-insensitively');

  ok(R('Hold').state === 'flat' && R('Hold').dir === null,
     'Hold has no side, so there is nothing to price');

  /* THE ONE THAT MATTERS. TradingAgents returns 'REVIEW' when the decision
     had no parseable rating. Flat and unreadable are different facts. */
  ok(R('REVIEW').state === 'review', 'REVIEW is its own state');
  ok(R('REVIEW').dir === null, 'and takes no direction');
  ok(R('REVIEW').state !== R('Hold').state,
     'and is NOT folded into HOLD — a parse failure is not a trading opinion');
  ok(/no parseable rating/.test(R('REVIEW').why || ''), 'the card says which of the two it is');

  ok(R('banana').state === 'unknown', 'an unrecognised rating is unknown, never a default side');
  ok(R('').state === 'absent' && R(null).state === 'absent', 'and an absent one is absent');
  ok(R(undefined).dir === null, 'with no direction, never a throw');
}

console.log('\n== a view with no levels is not printed as a trade ==');
{
  /* the plan layer is never asked to guess: no bars, no plan, no numbers */
  ok(typeof ctx.hgTauricPricePlan === 'function', 'the pricer is exported');
  ok(/hgOgFetchRows/.test(TAB), 'it prices on the gold desk\'s own fetcher');
  ok(/hgPlanLevels/.test(TAB), 'through the gold desk\'s own plan layer');
  ok(!/entry\s*[:=]\s*\d/.test(TAB.replace(/\/\*[\s\S]*?\*\//g, '')),
     'and nowhere does this file write an entry price of its own');
  ok(/A view with no levels is not a trade/.test(TAB) || /view without levels is not a trade/.test(TAB),
     'the card says so in as many words when it cannot price');
  ok(/will not print numbers it did not get/.test(TAB), 'and that it will not invent them');
}

console.log('\n== pricing degrades to a stated reason, never to a number ==');
{
  /* no fetcher loaded at all is the harshest case and must still be honest */
  const saved = ctx.hgOgFetchRows;
  ctx.hgOgFetchRows = undefined;
  const noFetch = await ctx.hgTauricPricePlan('long');
  ok(noFetch && noFetch.ok === false, 'with no fetcher the pricer refuses');
  ok(typeof noFetch.why === 'string' && noFetch.why.length > 0, 'and gives a reason');
  ok(noFetch.plan === undefined, 'with no plan object at all');
  ctx.hgOgFetchRows = saved;

  const noDir = await ctx.hgTauricPricePlan('sideways');
  ok(noDir && noDir.ok === false && /no direction/.test(noDir.why || ''),
     'and a non-direction is refused rather than coerced to long');

  /* bars that come back empty must not become a plan priced on nothing */
  ctx.hgOgFetchRows = () => Promise.resolve([]);
  const noBars = await ctx.hgTauricPricePlan('long');
  ok(noBars && noBars.ok === false, 'empty bars are refused');
  ok(/not priced rather than priced on nothing/.test(noBars.why || ''),
     'and named as unpriced rather than priced on nothing');
  ctx.hgOgFetchRows = saved;

  /* and a fetcher that throws is a reason, not a crash */
  ctx.hgOgFetchRows = () => Promise.reject(new Error('gateway 403'));
  const threw = await ctx.hgTauricPricePlan('long');
  ok(threw && threw.ok === false && /403/.test(threw.why || ''),
     'a throwing fetcher becomes a stated reason, not an exception');
  ctx.hgOgFetchRows = saved;
}

console.log('\n== an unpriced or non-directional call records NOTHING ==');
{
  /* the forward log is what TAURIC would earn a record from, so writing a
     row for a call that was never priced would be the worst kind of
     pollution: an entry with no trade behind it */
  const flat = ctx.hgTauricRating('Hold');
  ok(ctx.hgTauricRecord(flat, { ok: true, plan: { entry: 1, stop: 2, t1: 3 } }).ok === false,
     'a HOLD is not recorded, however well it could have been priced');
  const buy = ctx.hgTauricRating('Buy');
  ok(ctx.hgTauricRecord(buy, { ok: false, why: 'no bars' }).ok === false,
     'and a directional view that never priced is not recorded either');
  ok(ctx.hgTauricRecord(null, null).ok === false, 'nor is nothing at all');
  ok(ctx.hgTauricRecord(ctx.hgTauricRating('REVIEW'), { ok: true, plan: { entry: 1, stop: 2, t1: 3 } }).ok === false,
     'and REVIEW records nothing — an unreadable decision is not a call');
}

console.log('\n== the three blocked states stay three states ==');
{
  /* Each state is decided by whichever side can actually know it, and
     asserted against THAT file: the handler knows whether an interpreter
     exists, only the bridge can know whether a key is usable or the vendor
     answered. The tab must render all of them apart. */
  for (const state of ['install', 'timeout', 'busy']){
    ok(new RegExp("blocked: '" + state + "'").test(API),
       `the handler owns '${state}' and emits it as its own blocked value`);
  }
  for (const state of ['install', 'key', 'vendor']){
    ok(new RegExp('"blocked"\\] = "' + state + '"').test(BRIDGE),
       `the bridge owns '${state}' and emits it as its own blocked value`);
    ok(new RegExp("b === '" + state + "'").test(TAB),
       `and the tab branches on '${state}' rather than folding it into one error`);
  }
  ok(/NOT INSTALLED/.test(TAB), 'a missing install says to install it');
  ok(/NO LLM KEY/.test(TAB), 'a missing key says to add a key');
  ok(/VENDOR IS UNREACHABLE/.test(TAB), 'a blocked vendor says the data did not get out');
  ok(/403 to CONNECT/.test(TAB),
     'and names a policy denial as one, since it will not clear on a retry');

  /* the bridge decides them in an order that cannot mislead: no install
     means the other two are unknowable, not false */
  ok(BRIDGE.indexOf('out["blocked"] = "install"') < BRIDGE.indexOf('out["blocked"] = "key"'),
     'the bridge reports a missing install before it reports a missing key');
  ok(/if not keys:/.test(BRIDGE), 'and a missing key before a blocked vendor');
}

console.log('\n== a run costs money, so it cannot happen by accident ==');
{
  ok(/method !== 'POST'/.test(API), 'the run route refuses anything but POST');
  ok(/405/.test(API), 'with a 405');
  ok(/a pipeline run costs LLM calls/.test(API), 'and says why');
  ok(/__running/.test(API) && /429/.test(API), 'a second concurrent run is refused, not queued');
  ok(/RUN_TIMEOUT_MS/.test(API), 'and a run has a hard timeout');

  /* THE REFRESH TRAP. index.html sweeps every tab's refresh() on a hard
     refresh. A pipeline run there would burn a quota on a reload. */
  const refreshBody = TAB.split('function refreshTauric')[1].split('\n}')[0];
  ok(!/runPipeline/.test(refreshBody), 'refresh() never runs the pipeline');
  ok(/runPreflight/.test(refreshBody), 'it re-checks preflight, which spends nothing');
  ok(/never re-run the pipeline/i.test(TAB), 'and the source says why');

  /* preflight must not construct the graph either — building it instantiates
     a provider client, and a preflight that costs tokens is one nobody runs */
  const pf = BRIDGE.split('def preflight')[1].split('\ndef ')[0];
  ok(!/TradingAgentsGraph\(/.test(pf), 'preflight never constructs the graph');
  ok(/spending nothing/.test(pf) || /spends nothing/.test(pf), 'and says so');
}

console.log('\n== the newcomer gets no exemption from the desk\'s own rule ==');
{
  ok(/WATCH, NOT A TICKET/.test(TAB), 'every TAURIC call renders as a WATCH');
  ok(/hg-v756/.test(TAB), 'citing the version that made measured-edge hard');
  ok(/no record in the replay/.test(TAB), 'and the reason: it has no measured record');
  ok(/ticket: false/.test(TAB), 'the forward record is written as a non-ticket');
  ok(/gateClear: false/.test(TAB),
     'and as NOT gate-clear — it was never put to the gates, and claiming otherwise would '
     + 'pollute the population that decides promotions');
  ok(/OMNIGOLD:TAURIC/.test(TAB), 'under its own tab key, so it is judged as itself');
  ok(ctx.HG_TAURIC_TAB === 'OMNIGOLD:TAURIC', 'which is exported for the log to pool on');
}

console.log('\n== the symbol mapping is the library\'s, not ours ==');
{
  /* XAUUSD has no spot pair on Yahoo; TradingAgents maps it to the COMEX
     front-month GC=F. Re-deriving that here is how the two drift. */
  ok(/normalize_symbol/.test(BRIDGE), 'the bridge asks symbol_utils to resolve the ticker');
  /* the prose above the tab explains the mapping, which is not the same as
     the code carrying one — strip comments before asserting, or the
     explanation itself fails the check it exists to describe */
  const tabCode = TAB.replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/GC=F/.test(tabCode), 'and no vendor symbol is hard-coded anywhere in the tab\'s code');
  ok(/vendor_symbol/.test(tabCode), 'it renders whichever symbol the library reported');
  ok(/symbol_utils/.test(TAB), 'and says the mapping is the library\'s');

  /* The installed library's own table, when it is here to read. NOT an
     ok(true) in the else branch: an assertion that passes because it was
     skipped is worse than no assertion, since it reports coverage it does
     not have — which is exactly what test-suite-not-vacuous exists to catch,
     and did catch here. Skipping is announced on stderr instead. */
  const ta = path.join(ROOT, '..', 'TradingAgents', 'tradingagents', 'dataflows', 'symbol_utils.py');
  if (fs.existsSync(ta)){
    const src = fs.readFileSync(ta, 'utf8');
    ok(/"XAUUSD":\s*"GC=F"/.test(src),
       'and the installed library really does map XAUUSD to GC=F');
    ok(/_ALIASES/.test(src),
       'through its alias table, so a new instrument is a table row rather than a code change here');
  } else {
    console.error('   (TradingAgents is not installed beside this repo — its symbol table is '
                + 'unchecked in this run, and nothing above asserts that it is)');
  }
}

console.log('\n== the geometry rule applies to the newest tab too ==');
{
  /* a tab that prints a pending entry and stop owes the reader the verdict
     on whether that plan makes sense against where the market is */
  ok(/hgPlanGeometryLineHtml/.test(TAB), 'the card runs the shared geometry check');
  ok(/lastClose/.test(TAB), 'marked against the close the plan was priced on');
  ok(typeof ctx.hgPlanGeometryLineHtml === 'function', 'and that helper is the shared one');
  /* no mark means no verdict — a silent pass would be the tab claiming the
     geometry is fine when it never asked */
  ok(/isFinite\(fin\(priced\.lastClose\)\)/.test(TAB),
     'with no mark it renders no verdict rather than a silent pass');
}

console.log('\n== one JSON object crosses the seam, and stderr cannot corrupt it ==');
{
  ok(/json\.dump\(obj, sys\.stdout/.test(BRIDGE), 'the bridge writes JSON to stdout');
  ok(/One JSON object on stdout, nothing else, ever/.test(BRIDGE), 'and contracts to nothing else');
  ok(/stdio: \['ignore', 'pipe', 'pipe'\]/.test(API), 'the handler keeps stdout and stderr apart');
  ok(/stderr_tail/.test(API),
     'so a library warning is handed back for diagnosis instead of corrupting the payload');
  ok(/MAX_STDOUT/.test(API), 'and a runaway child cannot grow the buffer without bound');
  ok(/did not print JSON/.test(API), 'unparseable output is reported as such, never guessed at');
}

console.log('\n== the bridge runs where the .env actually is ==');
{
  /* THE BUG THIS PINS, because it wasted nobody's time only by luck.
     tradingagents/__init__.py loads its .env with find_dotenv(usecwd=True),
     which walks UP FROM THE CWD. Spawned with cwd = this repo, that walk
     never reaches the TradingAgents checkout, so a key pasted exactly where
     its README says to put it was invisible — and the tab told somebody who
     had just set a key that they had no key. Shipped that way in hg-v767
     and fixed here. */
  ok(/find_dotenv\(usecwd=True\)|walks UP FROM THE CWD/.test(API),
     'the handler records WHY the cwd matters, not just that it is set');
  ok(/const cwd = \(found\.home && fs\.existsSync\(found\.home\)\) \? found\.home : ROOT;/.test(API),
     'it spawns from the checkout when one was located');
  ok(/cwd: cwd/.test(API), 'and passes that as the child cwd');
  ok(/obj\.cwd = cwd/.test(API), 'reporting it back, so "no key" says which directory was searched');
  ok(/the <code>\.env<\/code> is read from/.test(TAB),
     'and the tab prints that directory on the no-key card');

  /* an explicitly-set interpreter still resolves its project, or the fix
     would only work for the two paths that happen to carry `home` */
  ok(/function homeOfInterpreter/.test(API), 'an explicit TAURIC_PYTHON resolves its checkout too');
  ok(/for \(let i = parts\.length - 1; i >= 0; i--\)/.test(API),
     'by walking up to the venv, rather than assuming a fixed depth');

  /* a key from another provider is not enough on its own: the config still
     names the provider to call, and that trap is now on the card */
  ok(/TRADINGAGENTS_LLM_PROVIDER/.test(TAB),
     'and the no-key card warns that a different provider needs the provider set too');
}

console.log('\n== it is wired into the server ==');
{
  ok(/createTauricApi/.test(SERVER), 'the server imports the handler');
  ok(/'\/api\/tauric'/.test(SERVER), 'and routes /api/tauric to it');
  ok(/tauricHandler\(req, res\)/.test(SERVER), 'by calling it');
}

console.log('\n== nothing about the existing gold desk moved ==');
{
  /* A new tab must not re-tune anything it borrows. The plan layer, the
     target multiple and the ranker are the desk's, unchanged. */
  const OG = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  ok(/100 \* tapeScore/.test(OG) && /120 \* ticketN/.test(OG), 'every ranker weight is as it was');
  ok(!/tauric/i.test(OG), 'omnigold.js knows nothing about this tab — the borrowing is one-way');
  ok(/TAURIC_T1_R = 2/.test(TAB),
     'and TAURIC prices at the same 2R the desk measures every gold hit rate against, '
     + 'so its breakeven is the same 33.3% rather than one of its own');
}

console.log('\n' + passed + ' passed, 0 failed');
