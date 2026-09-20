/* HARDGATE — CRYPTO SCAN numbered a card #1 while stamping it weaker than the
   card below it.

   Every quality decision this tab makes is three-layer. The block a card is
   painted into is isHighQuality; the PROFESSIONAL-GRADE badge is isPro; the
   mechanic hg-forward pools the record by is voteTier. All three come off
   hgComputeThreeLayerConfidence. The ranking was the one thing that did not --
   csSortSetups read layer-1 agreement alone, and layer 1 is 40% of the number
   the card stamps two lines below it.

   Driven through the real runScan over 87 multi-setup scans (870 contracts,
   801 setups):

     #1 card was NOT the strongest tier on screen   37 of 87 scans (42.5%)
     adjacent pairs ordered against their own tier  100
       of those, at an IDENTICAL printed percentage  23

   The last row is the sharpest. Two cards both showing "92% agree" in the head
   -- a genuine tie to the reader -- with the tie broken by structure and then
   by a float nobody can see, landing WEAK (confidence 0.57) above STANDARD
   (0.72).

   And a second contradiction fell out of the same key. The "#N" badge is the
   card's index in the sorted list, but renderCards PAINTS the high-quality
   block first. Because layer-1 ignores quality entirely, a lower-quality card
   routinely outranked every high-quality one: on 24 of 31 mixed-block scans
   the first card on screen was not #1, and #1 sat further down among the
   lower-quality ones.

   The keys now run in the order the reader meets them: the block renderCards
   will paint it into, the tier stamped on the card, the printed whole percent
   of layer-1, SMC, then raw pct. The first key is not a new judgement -- it is
   what renderCards already does with two filters, moved in front of the sort
   so the sorted list and the painted list are the same list.

   This is NOT a claim that three-layer ranks better by outcome. Nothing here
   has measured that. It is that a desk must not number a card #1 while
   stamping it weaker than the one beneath it.

   Run: node tests/test-cryptoscan-rank-stamp.mjs */
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

/* A PINNED CLOCK.

   runScan reads `new Date(now).getUTCHours()` and adds a `session` quality
   gate outside 07:00-17:00 UTC. isHighQuality needs every quality gate clear,
   so for the fourteen hours a day outside that window NO setup can be
   high-quality -- and section 6's mixed-block check quietly had nothing to
   measure. Shipped in pack 890, it passed because the suite happened to run
   at 13:00 UTC and failed the first time it ran at 17:59.

   A test whose verdict depends on what time it is run is not a test. The
   sandbox gets a Date pinned inside the liquid window, and the tapes are
   anchored to that same instant so the closed-bar trim agrees with it. */
const FIXED_NOW = Date.UTC(2026, 8, 20, 12, 0, 0);   /* 12:00 UTC — a liquid hour */
class FixedDate extends Date {
  constructor(){ if (arguments.length === 0) super(FIXED_NOW); else super(...arguments); }
  static now(){ return FIXED_NOW; }
}
function boot(){
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date: FixedDate,
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
const VOTE = fs.readFileSync(root + 'cryptoscan-voting-v3.js', 'utf8');
const SEC = 900;
const RANK = { weak: 0, standard: 1, professional: 2, 'professional-grade': 3 };

/* ---------------------------------------------------------------- 1 */
console.log('\n1. the ladder is the one hgComputeThreeLayerConfidence returns');
{
  ok(Array.isArray(S.CS_TIER_ORDER) && S.CS_TIER_ORDER.length === 4,
     'CS_TIER_ORDER carries four tiers');
  /* read the tiers that function actually returns, so a new one cannot arrive
     without this list noticing -- the same guard the 230 and the 30 have */
  const body = stripComments(VOTE);
  const at = body.indexOf('function hgComputeThreeLayerConfidence');
  const end = body.indexOf('\nfunction ', at + 10);
  const returned = [];
  const re = /tier:\s*'([^']+)'/g;
  let m;
  const slice = body.slice(at, end < 0 ? body.length : end);
  while ((m = re.exec(slice))) if (returned.indexOf(m[1]) < 0) returned.push(m[1]);
  ok(returned.length === 4, 'and that function returns exactly four (' + returned.join(', ') + ')');
  ok(returned.every(t => S.CS_TIER_ORDER.indexOf(t) >= 0),
     'every tier it returns has a rung on the ladder');
  ok(S.CS_TIER_ORDER.every(t => returned.indexOf(t) >= 0),
     'and the ladder invents none that it does not');

  /* the ladder is ordered by the thresholds that produce it */
  ok(/confidence >= 0\.85/.test(slice) && /confidence >= 0\.75/.test(slice)
     && /confidence >= 0\.65/.test(slice),
     'the tiers come off three confidence thresholds, 0.85 / 0.75 / 0.65');
  const idx = t => S.CS_TIER_ORDER.indexOf(t);
  ok(idx('weak') < idx('standard') && idx('standard') < idx('professional')
     && idx('professional') < idx('professional-grade'),
     'and the ladder runs weakest to strongest, matching those thresholds');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. csTierRank, including the stamp it cannot read');
{
  ok(typeof S.csTierRank === 'function', 'csTierRank is reachable');
  ok(S.csTierRank({ voteTier: 'weak' }) === 0, 'weak is the bottom rung');
  ok(S.csTierRank({ voteTier: 'professional-grade' }) === 3, 'professional-grade the top');
  ok(S.csTierRank({ voteTier: 'professional' }) > S.csTierRank({ voteTier: 'standard' }),
     'professional outranks standard');
  ok(S.csTierRank({ voteTier: 'made-up' }) === -1,
     'a tier this file cannot read ranks -1');
  ok(S.csTierRank({ voteTier: 'made-up' }) < S.csTierRank({ voteTier: 'weak' }),
     'which is BELOW weak — an unreadable stamp is not a flattering default');
  ok(S.csTierRank({}) === -1 && S.csTierRank(null) === -1,
     'and so is no stamp at all');
  ok(S.csTierRank({ voteTier: 'WEAK' }) === -1,
     'the match is exact: the tab lowercases nothing on the reader\'s behalf');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. the order cannot contradict the stamp');
{
  const mk = (sym, tier, pct, hq, smc) => ({ sym: sym, voteTier: tier, pct: pct,
    isHighQuality: !!hq, smc: smc ? { grade: smc } : null, dir: 'long' });

  /* THE CASE THE SWEEP FOUND: an identical printed percentage */
  const tie = S.__csSortSetups([mk('WEAK', 'weak', 0.921), mk('STD', 'standard', 0.919)]);
  ok(Math.round(tie[0].pct * 100) === Math.round(tie[1].pct * 100),
     'both cards print the same whole percent, so the reader sees a tie');
  ok(tie[0].sym === 'STD', 'and the stronger tier is now on top, not the stronger float');

  /* and the case it found more often: a LOWER percent but a stronger stamp */
  const gap = S.__csSortSetups([mk('WEAK', 'weak', 0.90), mk('STD', 'standard', 0.86)]);
  ok(gap[0].sym === 'STD',
     'a STANDARD card at 86% outranks a WEAK one at 90% — the tab stamped them, so it must not reverse them');

  /* inside one tier, layer-1 still orders: the tab makes no claim separating them */
  const same = S.__csSortSetups([mk('LO', 'standard', 0.80), mk('HI', 'standard', 0.93)]);
  ok(same[0].sym === 'HI',
     'inside a tier the printed percent still leads, which is the one key that kept its rationale');

  /* THE TWO KEYS THIS PACK INHERITED AND KEPT, pinned because keeping them is
     also a decision. Both need a fixture where block and tier are equal, or
     the new keys decide first and these never run. */

  /* the PRINTED percent outranks structure: a whole percent the reader can
     see beats a structural grade, so a STRONG card does not climb over a
     visibly higher agreement */
  const pctOverSmc = S.__csSortSetups([mk('STRONG_LO', 'standard', 0.86, false, 'STRONG'),
                                       mk('PLAIN_HI', 'standard', 0.90, false, null)]);
  ok(pctOverSmc[0].sym === 'PLAIN_HI',
     '90% plain outranks 86% STRONG — the printed percent is read before structure');

  /* and it is the PRINTED percent, not the float: two cards shown as "92%"
     are tied to the reader, so structure breaks it rather than a digit nobody
     is shown */
  const printedNotRaw = S.__csSortSetups([mk('HIGHER_FLOAT', 'standard', 0.921, false, null),
                                          mk('STRONG_92', 'standard', 0.919, false, 'STRONG')]);
  ok(Math.round(printedNotRaw[0].pct * 100) === Math.round(printedNotRaw[1].pct * 100),
     'both print 92%, so the reader sees no difference between them');
  ok(printedNotRaw[0].sym === 'STRONG_92',
     'and structure breaks that tie — the invisible 0.002 does not decide the order');

  /* SMC still breaks a tier+percent tie, and still never crosses one */
  const struct = S.__csSortSetups([mk('PLAIN', 'standard', 0.90, false, null),
                                   mk('STRONG', 'standard', 0.90, false, 'STRONG')]);
  ok(struct[0].sym === 'STRONG', 'structure still breaks a tier-and-percent tie');
  const noCross = S.__csSortSetups([mk('STRONG', 'weak', 0.90, false, 'STRONG'),
                                    mk('PLAIN', 'standard', 0.90, false, null)]);
  ok(noCross[0].sym === 'PLAIN', 'but it never lifts a card over a stronger tier');

  /* an unreadable stamp sinks rather than floats */
  const odd = S.__csSortSetups([mk('ODD', 'brand-new-tier', 0.99), mk('W', 'weak', 0.10)]);
  ok(odd[0].sym === 'W',
     'and a tier this file cannot read sorts below weak however high its percent');

  ok(S.__csSortSetups(null) === null && S.__csSortSetups(undefined) === undefined,
     'a missing list is returned as-is, not a throw');
  ok(S.__csSortSetups([]).length === 0, 'and an empty one stays empty');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. the sorted list IS the painted list, so the badge cannot lie');
{
  const mk = (sym, tier, pct, hq) => ({ sym: sym, voteTier: tier, pct: pct,
    isHighQuality: !!hq, smc: null, dir: 'long' });
  /* the lower-quality card has the stronger layer-1 read AND the stronger
     tier -- under the old key it took #1 while being painted below */
  const out = S.__csSortSetups([
    mk('LOUD', 'professional-grade', 0.99, false),
    mk('GOOD', 'professional', 0.80, true)
  ]);
  ok(out[0].sym === 'GOOD',
     'a high-quality card outranks a lower-quality one even with a weaker tier AND a weaker percent');
  ok(out[0].isHighQuality && !out[1].isHighQuality, 'the blocks are contiguous');

  /* renderCards partitions with two filters, which preserve order; the sort
     now encodes that partition, so filter-then-concat is the identity */
  const src = stripComments(SCAN);
  ok(/var hqSetups = setups\.filter\(function\(s\)\{ return s\.isHighQuality; \}\);/.test(src),
     'renderCards still partitions with filter');
  ok(/var ha = \(a && a\.isHighQuality\) \? 1 : 0, hb = \(b && b\.isHighQuality\) \? 1 : 0;/.test(src),
     'and the sort leads with that same partition');
  ok(/setupCardHTML\(hqSetups\[i\], setups\.indexOf\(hqSetups\[i\]\), tally\)/.test(src),
     'the badge is still the index in the sorted list');

  /* so for ANY mix, concat(hq, lq) is the sorted array itself */
  let seed = 9;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  let checked = 0;
  for (let k = 0; k < 300; k++){
    const n = 2 + Math.floor(rnd() * 8), arr = [];
    for (let i = 0; i < n; i++)
      arr.push(mk('S' + i, S.CS_TIER_ORDER[Math.floor(rnd() * 4)], rnd(), rnd() > 0.5));
    const sorted = S.__csSortSetups(arr);
    const painted = sorted.filter(x => x.isHighQuality).concat(sorted.filter(x => !x.isHighQuality));
    for (let i = 0; i < sorted.length; i++){
      if (sorted[i] !== painted[i]){ checked = -1; break; }
    }
    if (checked < 0) break;
    checked++;
  }
  ok(checked === 300,
     'over 300 random mixes, the painted order and the sorted order are the same list');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. the key the cards are ordered by is ON the card');
{
  ok(typeof S.csTierChip === 'function', 'csTierChip is reachable');
  ok(/TIER STANDARD/.test(S.csTierChip({ voteTier: 'standard' })), 'it names the tier');
  ok(/TIER PROFESSIONAL-GRADE/.test(S.csTierChip({ voteTier: 'professional-grade' })),
     'including the longest one');
  ok(S.csTierChip({}) === '' && S.csTierChip(null) === '',
     'no stamp, no chip — it never invents one');
  ok(/UNRECOGNISED/.test(S.csTierChip({ voteTier: 'brand-new' })),
     'and a stamp this file cannot read says so rather than printing as a tier');
  ok(!/UNRECOGNISED/.test(S.csTierChip({ voteTier: 'weak' })), 'while a known one does not');
  /* it must ride the HEAD, which is what shows when the card is collapsed */
  const src = stripComments(SCAN);
  const headAt = src.indexOf('h += csTierChip(s);');
  const bodyAt = src.indexOf('h += \'<div class="cs-card-body"');
  ok(headAt > 0 && bodyAt > headAt,
     'and it is painted in the card HEAD, above the collapsed body where the tier used to hide');
}

/* ---------------------------------------------------------------- 6 */
console.log('\n6. end to end: the real runScan, over tapes that disagree');
{
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
  function tapes(sd){
    let seed = sd;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const drift = (rnd() - 0.5) * 0.35, vol = 0.005 + rnd() * 0.022;
    const N = 300, r15 = []; let px = 100;
    const base = Math.floor(FIXED_NOW / 1000 / SEC) * SEC, t0 = base - N * SEC;
    for (let i = 0; i < N; i++){
      const o = px, c = px * (1 + (rnd() - 0.5 + drift) * vol);
      r15.push({ t: t0 + i * SEC, o: o, c: c, h: Math.max(o, c) * (1 + vol * 0.2),
                 l: Math.min(o, c) * (1 - vol * 0.2), v: 1000 + rnd() * 4000 });
      px = c;
    }
    const H = Math.floor(FIXED_NOW / 1000 / 3600) * 3600, r1h = []; let q = 100;
    for (let i = 199; i >= 0; i--){
      const o = q; q = q * (1 + (rnd() - 0.5 + drift * 2) * vol * 2);
      r1h.push({ t: H - i * 3600, o: o, c: q, h: Math.max(o, q) * (1 + vol * 0.3),
                 l: Math.min(o, q) * (1 - vol * 0.3), v: 3000 + rnd() * 6000 });
    }
    return { r15: r15, r1h: r1h };
  }
  async function scan(sd){
    const syms = []; for (let i = 0; i < 10; i++) syms.push('S' + i);
    const T = {}; syms.forEach((x, i) => { T[x] = tapes(sd + i * 7919); });
    const items = syms.map(x => ({ sym: x, exchange: 'delta', base: x }));
    S.hgDeskLoadDeltaCoinDCX = async () => ({ items: items,
      venueCounts: { delta: items.length, coindcx: 0 }, rawLen: items.length });
    S.hgDeskFetchKlines = async (it, tf) => (tf === '15m' ? T[it.sym].r15.slice() : T[it.sym].r1h.slice());
    S.hgDeskFetchKlinesResult = async (it, tf) => ({
      rows: tf === '15m' ? T[it.sym].r15.slice() : T[it.sym].r1h.slice(),
      ok: true, reason: null, error: null });
    S.hgSentimentLoad = async () => ({});
    const tab = (S.HG_tabs || []).filter(t => t && t.id === 'cryptoscan')[0];
    const el = fakeEl(); tab.mount(el);
    await tab.refresh();
    return { r: S.cryptoScanState(), el: el };
  }

  let scans = 0, setupsSeen = 0, topWrong = 0, inversions = 0, badgeWrong = 0, mixed = 0;
  let tiersSeen = {};
  for (let sd = 17; sd <= 800; sd += 23){
    const { r } = await scan(sd);
    const st = r.setups || [];
    if (st.length < 2) continue;
    scans++; setupsSeen += st.length;
    st.forEach(x => { tiersSeen[x.voteTier] = (tiersSeen[x.voteTier] || 0) + 1; });

    const best = st.reduce((m, x) => RANK[x.voteTier] > RANK[m.voteTier] ? x : m, st[0]);
    if (RANK[st[0].voteTier] < RANK[best.voteTier]) topWrong++;
    for (let i = 0; i < st.length - 1; i++)
      if (RANK[st[i + 1].voteTier] > RANK[st[i].voteTier]) inversions++;

    const hq = st.filter(x => x.isHighQuality), lq = st.filter(x => !x.isHighQuality);
    if (hq.length && lq.length){
      mixed++;
      const painted = hq.concat(lq);
      for (let i = 0; i < painted.length; i++)
        if (st.indexOf(painted[i]) !== i){ badgeWrong++; break; }
    }
  }
  ok(scans >= 20, 'the sweep produced ' + scans + ' multi-setup scans (' + setupsSeen + ' setups)');
  ok(Object.keys(tiersSeen).length >= 2,
     'across more than one tier, so the ordering is actually exercised: ' + JSON.stringify(tiersSeen));
  ok(topWrong === 0,
     'the #1 card is the strongest tier on screen in every scan (was 42.5% wrong)');
  ok(inversions === 0,
     'and no adjacent pair is ordered against its own tier (was 100)');
  ok(mixed >= 5, 'the sweep included ' + mixed + ' scans with both blocks populated');
  ok(badgeWrong === 0,
     'where the #N badge matches the paint order every time (was wrong on 24 of 31)');

  /* and the chip reaches the rendered card */
  const one = await scan(40);
  const cards = one.el._node('csCards');
  ok(cards && /cs-card/.test(cards.innerHTML), 'the scan painted cards');
  ok(/TIER /.test(text(cards.innerHTML)), 'which carry the tier chip in the head');
  const shown = (one.r.setups || [])[0];
  ok(shown && new RegExp('TIER ' + shown.voteTier.toUpperCase()).test(text(cards.innerHTML)),
     'naming the tier the top card actually holds (' + (shown && shown.voteTier) + ')');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
