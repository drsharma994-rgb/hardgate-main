/* HARDGATE — CRYPTO SCAN accumulated forward evidence nobody could see.

   hg-forward.js ships hgFwdPanelHTML as "a drop-in panel any tab can render
   with one line. Kept here rather than in each tab so the wording, the
   thresholds and the honest empty state stay identical everywhere — the
   alternative is forty tabs each describing out-of-sample evidence slightly
   differently."

   Five desks render it: REVERSALSNIPER, SQUEEZE, OIFLOW, OMNIGOLD, OMNIROUTE.
   CRYPTO SCAN never did. Everything it recorded went into localStorage and
   stayed there, so no reader of this tab has ever seen whether one of its own
   setups paid.

   That is the last leg of a chain. Pack 873 gave the records the bar the
   engine actually read; 874 let the fill model settle them; 875 made the scan
   settle them at all. None of it was visible. Meanwhile the closing note
   asserted the engine "produces high volume but low accuracy" while claiming
   "No win rates claimed" — an assertion about accuracy with no evidence shown
   for it, beside a promise not to show any.

   minRr is the tab's OWN ladder, not the helper's default of 2. cryptoultra
   prices T1 at RULE.t1R = 1.5, so the breakeven this pool must beat is
   1/(1+1.5) = 40%; judging it at 2R would test a plan the desk does not place.

   Run: node tests/test-cryptoscan-forward-panel.mjs */
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
  const store = {};
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, Intl,
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, Set, Map };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {};
  s.setTimeout = () => 0; s.clearTimeout = () => {};
  s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }),
                 head: { appendChild(){} }, addEventListener(){} };
  s.localStorage = { getItem: k => (k in store ? store[k] : null),
                     setItem: (k, v) => { store[k] = String(v); },
                     removeItem: k => { delete store[k]; } };
  s.location = { href: 'https://x/', search: '', protocol: 'https:' };
  s.fetch = () => Promise.reject(new Error('no network in tests'));
  vm.createContext(s);
  for (const f of ['hg-forward.js', 'cryptoscan.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const S = boot();
const SCAN = fs.readFileSync(root + 'cryptoscan.js', 'utf8');
const FWD = fs.readFileSync(root + 'hg-forward.js', 'utf8');
const LS = 'hg_forward_v1';
const SEC = 900;
/* a bar near the present: a record more than STALE_HORIZONS old is reported
   as stale rather than open, which is a different (and correct) row */
const BAR = Math.floor((Date.now() / 1000) / SEC) * SEC - SEC;
const OLD_BAR = BAR - 500 * SEC;
const wipe = () => S.localStorage.removeItem(LS);
const text = h => String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/* ---------------------------------------------------------------- 1 */
console.log('\n1. every other desk shows this panel; this one did not');
{
  const renderers = [];
  for (const f of fs.readdirSync(root)){
    if (!f.endsWith('.js')) continue;
    const src = stripComments(fs.readFileSync(root + f, 'utf8'));
    if (/hgFwdPanelHTML\(\s*'/.test(src)) renderers.push(f);
  }
  ok(renderers.length >= 5, 'the panel is rendered by several desks (' + renderers.join(', ') + ')');
  ok(renderers.indexOf('cryptoscan.js') >= 0, 'and cryptoscan.js is one of them now');

  ok(/drop-in panel any tab can render with one line/.test(FWD),
     'the helper exists so every desk words it the same way');
  ok(typeof S.hgFwdPanelHTML === 'function', 'and it is reachable');
  ok(typeof S.csFwdPanelHTML === 'function', 'this tab wraps it');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. it is judged against this tab\'s own ladder');
{
  ok(S.CS_FWD_MIN_RR === 1.5, 'minRr is 1.5');
  const ultra = stripComments(fs.readFileSync(root + 'cryptoultra.js', 'utf8'));
  ok(/t1R: 1\.5/.test(ultra), "which is cryptoultra's RULE.t1R, not a number this tab invented");
  ok(/minRr: CS_FWD_MIN_RR/.test(stripComments(SCAN)), 'and it is what gets passed');

  /* the helper's default would test a plan this desk does not place */
  const fwd = stripComments(FWD);
  ok(/var minRr = isFinite\(\+o\.minRr\) \? \+o\.minRr : 2;/.test(fwd),
     'the helper would otherwise default to 2R');
  ok(Math.abs(1 / (1 + 1.5) - 0.4) < 1e-9, 'at 1.5R the breakeven hit rate is 40%');
  ok(Math.abs(1 / (1 + 2) - 0.3333) < 1e-3, 'at 2R it would be 33%, a different question');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. the empty state says what will fill it');
{
  wipe();
  const t = text(S.csFwdPanelHTML());
  ok(/do this desk's own confidence tiers separate\?/.test(t),
     'the title names the question pack 872 versioned the tiers to answer');
  ok(/Nothing recorded yet/.test(t), 'and it says nothing is recorded yet');
  ok(/settled later by bars that had not printed at the time/.test(t),
     'explaining what will settle it');
  ok(!/0%|NaN|undefined/.test(t), 'without inventing a rate for an empty pool');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. with evidence, it tabulates the versioned tiers');
{
  wipe();
  const mk = (sym, tier) => ({ sym: sym, dir: 'long', voteTier: tier, isHighQuality: tier !== 'weak',
                               price: 100, bar: { t: BAR }, plan: { entry: 100, stop: 95, t1: 107.5 } });
  S.hgFwdRecordScan('CRYPTO SCAN', '15m',
    S.__csFwdRows([mk('BTCUSDT', 'professional'), mk('ETHUSDT', 'weak')]), { horizonBars: 24 });

  const pending = text(S.csFwdPanelHTML());
  ok(/awaiting settlement/.test(pending),
     'before settlement it reports them as waiting, not as never having fired');
  ok(!/never fired/.test(pending),
     'which is the distinction the helper exists to make');

  /* and a record too old for its bars to still be arriving reads differently
     again — "recorded, then the contract went quiet" is not "still running" */
  wipe();
  S.hgFwdRecordScan('CRYPTO SCAN', '15m',
    S.__csFwdRows([mk('OLDUSDT', 'weak')]).map(r => Object.assign({}, r, { barT: OLD_BAR })),
    { horizonBars: 24 });
  const staleTxt = text(S.csFwdPanelHTML());
  ok(/nothing settled/.test(staleTxt) && /stale/.test(staleTxt),
     'an ancient unsettled record is reported as stale, not as awaiting settlement');
  ok(!/awaiting settlement/.test(staleTxt), 'and not as still running');

  wipe();
  S.hgFwdRecordScan('CRYPTO SCAN', '15m',
    S.__csFwdRows([mk('BTCUSDT', 'professional'), mk('ETHUSDT', 'weak')]), { horizonBars: 24 });

  S.hgFwdResolve('BTCUSDT', '15m', [{ t: BAR, h: 101, l: 99 }, { t: BAR + SEC, h: 108, l: 99 }]);
  S.hgFwdResolve('ETHUSDT', '15m', [{ t: BAR, h: 101, l: 99 }, { t: BAR + SEC, h: 101, l: 94 }]);

  const t = text(S.csFwdPanelHTML());
  ok(/VOTE-PROFESSIONAL@V5/.test(t) && /VOTE-WEAK@V5/.test(t),
     'each versioned tier is its own row');
  ok(/MECHANIC/.test(t) && /SETTLED/.test(t) && /T1-FIRST/.test(t) && /EXPECTANCY/.test(t),
     'with the columns every other desk shows');
  ok(/unjudged/.test(t), 'and one sample reads unjudged rather than as a verdict');
  ok(!/has paid/.test(t), 'nothing is declared to have paid on a sample of one');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. wired where an empty scan cannot hide it');
{
  const scan = stripComments(SCAN);
  ok(/<div id="csFwd"/.test(scan), 'the host exists');
  const cardsAt = scan.indexOf("'<div id=\"csCards\"></div>'");
  const fwdAt = scan.indexOf("'<div id=\"csFwd\"");
  ok(cardsAt > 0 && fwdAt > cardsAt, 'and sits outside the cards host, after it');
  ok(/fwd: fwd \}/.test(scan), 'mount keeps a handle on it');
  ok(/csPaintFwd\(\);\s*$/m.test(scan) || /csPaintFwd\(\);/.test(scan), 'and paints it');

  const paints = (scan.match(/csPaintFwd\(\)/g) || []).length;
  ok(paints >= 3, 'painted from more than one place (' + paints + ' references)');
  const mountAt = scan.indexOf('if (__results && __results.setups) renderCards');
  ok(scan.indexOf('csPaintFwd();', mountAt) > mountAt,
     'including on mount, because the evidence outlives the session');
  const scanAt = scan.indexOf('renderCards(setups, __results);');
  ok(scan.indexOf('csPaintFwd();', scanAt) > scanAt,
     'and after every scan, which may have settled records');

  /* the footer no longer promises silence it is about to break */
  ok(!/No win rates claimed\./.test(scan),
     'the blanket "No win rates claimed" is gone');
  ok(/No win rate is claimed from the scan window/.test(scan),
     'replaced by the claim that is actually true and not circular');
  ok(/outcomes settled by bars that had not printed when the setup fired/.test(scan),
     'and it points at what the panel does report');
}

/* ---------------------------------------------------------------- 6 */
console.log('\n6. mounted for real, the host actually receives the panel');
{
  /* A source grep cannot tell a wired handle from a dead one: renaming the id
     in querySelector while the markup keeps the old one leaves csPaintFwd
     writing to null, and every assertion in section 5 still passes. So mount
     the tab against a DOM stub that only resolves ids the markup declared. */
  function fakeEl(){
    const nodes = {};
    return {
      _html: '',
      set innerHTML(v){ this._html = String(v); },
      get innerHTML(){ return this._html; },
      querySelector(sel){
        const id = String(sel).replace(/^#/, '');
        if (this._html.indexOf('id="' + id + '"') < 0) return null;
        if (!nodes[id]) nodes[id] = { id: id, innerHTML: '', style: {},
                                      textContent: '', disabled: false,
                                      addEventListener(){}, classList: { toggle(){}, contains(){ return false; } } };
        return nodes[id];
      },
      _node(id){ return nodes[id] || null; }
    };
  }

  const tab = (S.HG_tabs || []).filter(t => t && t.id === 'cryptoscan')[0];
  ok(!!tab && typeof tab.mount === 'function', 'the tab registers a mount');

  wipe();
  const el = fakeEl();
  tab.mount(el);
  ok(/id="csFwd"/.test(el.innerHTML), 'the markup declares the forward host');
  const host = el._node('csFwd');
  ok(!!host, 'and mount resolved it');
  ok(host && /Nothing recorded yet/.test(host.innerHTML),
     'which received the empty panel on mount, before any scan has run');

  /* now record and settle, remount, and the same host carries the table */
  const mk2 = (sym, tier) => ({ sym: sym, dir: 'long', voteTier: tier, isHighQuality: false,
                                price: 100, bar: { t: BAR }, plan: { entry: 100, stop: 95, t1: 107.5 } });
  S.hgFwdRecordScan('CRYPTO SCAN', '15m', S.__csFwdRows([mk2('BTCUSDT', 'professional')]),
                    { horizonBars: 24 });
  S.hgFwdResolve('BTCUSDT', '15m', [{ t: BAR, h: 101, l: 99 }, { t: BAR + SEC, h: 108, l: 99 }]);

  const el2 = fakeEl();
  tab.mount(el2);
  const host2 = el2._node('csFwd');
  ok(host2 && /VOTE-PROFESSIONAL@V5/.test(host2.innerHTML),
     'and after evidence exists, the mounted host carries the tier row');
  ok(host2 && !/Nothing recorded yet/.test(host2.innerHTML), 'not the empty state');

  /* the cards host is a different node, so an empty scan cannot blank it */
  const cards = el2._node('csCards');
  ok(cards !== host2, 'the forward panel lives in its own node, not inside the cards');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
