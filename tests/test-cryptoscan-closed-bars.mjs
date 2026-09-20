/* HARDGATE — CRYPTO SCAN's layer 2 was reading the forming bar.

   cryptoultra.js drops the forming bar (closedRows) before any of its 470
   reads run, so layer 1's direction, its `pct` and `res.bar` all describe one
   CLOSED bar. cryptoscan.js's SMC block already trimmed its tape to that same
   bar and said why: "so SMC grades the same bar". Layer 2 did not -- it was
   handed the raw fetch, forming bar and all -- and layer 2 carries 35% of the
   confidence, sets layerAgreement, and pays the +15% / -20% multiplier.

   Two consequences, both defects rather than preferences.

   LOOKAHEAD. The forward record is keyed at res.bar.t (pack 873) and
   hgFwdSettle walks bars STRICTLY AFTER it, so the forming bar sits inside the
   trade's own settlement window. The tier is the forward log's pooling key, so
   the question the log exists to answer -- do this desk's tiers separate? --
   was being asked of labels that had read their own future.

   A CLOCK IS NOT A MARKET FACT. hgSweepPattern compares the forming bar's
   PARTIAL volume against an average of COMPLETE bars: volRatio = f x fullVol /
   avgVol against a 1.5 gate, so it needs f >= 1.5 x avgVol / fullVol, and an
   ordinary bar (fullVol ~ avgVol) needs f >= 1.5, which cannot happen. On one
   fixed tape with one fixed forming bar, moving only the moment the scan ran:

     0-50% into the bar   layer 2 = +0.7224   3 reads   no sweep
     75% in               layer 2 = +0.2821   4 reads   sweep fires
     97% in               layer 2 = +0.2236   4 reads   sweep fires

   Trimmed it is +0.7224 at all of them. Swept over 495 tapes (9 drifts x 5
   vols x 11 elapsed fractions), 476 with a layer-1 direction:

     layer-2 score differs        405 / 495   (81.8%)
     layer-2 direction differs     10 / 495   (2.0%)
     voteTier differs              34 / 476   (7.1%)   <- the log's pooling key
     shouldTrade differs           27 / 476   (5.7%)
     PROFESSIONAL-GRADE differs     9 / 476   (1.9%)   <- the log's ticket split
     sweep fired         raw 3/495, all three at 0.99 elapsed
                         closed 8/495, spread across the grid

   No threshold, weight or multiplier moves. Both layers are shown the same
   bars, and CS_LABEL_V goes to 5 so v1-v4 records stop pooling with them.

   Run: node tests/test-cryptoscan-closed-bars.mjs */
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
function fnBody(src, name){
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) return '';
  let d = 0, i = src.indexOf('{', start);
  for (; i < src.length; i++){
    const c = src[i];
    if (c === '{') d++;
    else if (c === '}'){ d--; if (!d) break; }
  }
  return src.slice(start, i + 1);
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
  for (const f of ['indicators.js', 'indicators2.js', 'order-flow.js', 'cryptoultra.js',
                   'cryptoscan-voting-v3.js', 'sentiment.js', 'liquidation-intelligence.js',
                   'hg-forward.js', 'cryptoscan.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const S = boot();
const SCAN = fs.readFileSync(root + 'cryptoscan.js', 'utf8');
const ULTRA = fs.readFileSync(root + 'cryptoultra.js', 'utf8');
const FLOW = fs.readFileSync(root + 'order-flow.js', 'utf8');
const SEC = 900;

/* ---------------------------------------------------------------- 1
   csTrimToBar: pure, and it is the ONLY thing that decides which bar both
   layers end on. */
{
  const T = S.__csTrimToBar;
  ok(typeof T === 'function', 'csTrimToBar is exported');

  const rows = [{ t: 100 }, { t: 200 }, { t: 300 }, { t: 400 }];
  ok(T(rows, 300).length === 3 && T(rows, 300)[2].t === 300,
     'a tape trimmed to bar 300 ends on bar 300');
  ok(T(rows, 400).length === 4, 'trimming to the last bar keeps the whole tape');
  ok(T(rows, 100).length === 1, 'trimming to the first bar keeps one row');

  /* absent / unusable bar -> the engine\'s own fallback, drop the last row */
  ok(T(rows, null).length === 3 && T(rows, null)[2].t === 300,
     'no bar stamp drops the last row');
  ok(T(rows, undefined).length === 3, 'undefined drops the last row');
  ok(T(rows, NaN).length === 3, 'NaN drops the last row');
  ok(T(rows, 'abc').length === 3, 'an unparseable stamp drops the last row');
  ok(T(rows, 999).length === 3, 'a stamp no bar carries drops the last row');

  /* 0 is a legitimate epoch stamp and must not read as absent */
  ok(T([{ t: 0 }, { t: 900 }, { t: 1800 }], 0).length === 1,
     't=0 is a bar, not a missing value (a truthiness test would leave 2 rows)');

  const empty = [];
  ok(T(empty, 100).length === 0, 'an empty tape stays empty');
  ok(T(empty, 100) !== empty, 'and the caller\'s array is never handed back to be written through');
  ok(Array.isArray(T(null, 100)) && T(null, 100).length === 0,
     'a null tape returns an empty array, never null');
  ok(T([{ t: 5 }], null).length === 0, 'a one-bar tape with no stamp trims to nothing');

  /* does not mutate its input */
  const src = [{ t: 1 }, { t: 2 }, { t: 3 }];
  T(src, 2);
  ok(src.length === 3, 'the input tape is not mutated');
}

/* ---------------------------------------------------------------- 2
   csClosedRows must agree with the engine\'s own rule, because the whole point
   is that both layers see the same bars. Compare against cryptoultra\'s
   closedRows, extracted from its source rather than re-derived here. */
{
  const C = S.__csClosedRows;
  ok(typeof C === 'function', 'csClosedRows is exported');

  const src = fnBody(ULTRA, 'closedRows');
  ok(src.length > 0, 'cryptoultra.js still defines closedRows to compare against');
  const engineClosed = vm.runInNewContext('(' + src + ')', { Math });

  let seed = 3;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  let checked = 0, agreed = 0;
  for (let trial = 0; trial < 240; trial++){
    const n = 3 + Math.floor(rnd() * 40);
    const iv = [900, 3600][trial % 2];
    const t0 = Math.floor(1789000000 / iv) * iv;
    const rows = [];
    for (let i = 0; i < n; i++) rows.push({ t: t0 + i * iv, c: 1 });
    /* nowMs anywhere inside, before or after the tape */
    const nowMs = (t0 + (rnd() * (n + 2) - 1) * iv) * 1000;
    const a = C(rows, iv, nowMs), b = engineClosed(rows, iv, nowMs);
    checked++;
    if (a.length === b.length && a.every((r, i) => r.t === b[i].t)) agreed++;
  }
  ok(checked === 240 && agreed === 240,
     'csClosedRows matches cryptoultra closedRows on all ' + checked + ' tapes (' + agreed + ')');

  /* the rule itself, stated directly: a bar opening at t closes at t + iv */
  const now = 1789000000 * 1000;
  const rows = [{ t: 1789000000 - 2700 }, { t: 1789000000 - 1800 },
                { t: 1789000000 - 900 }, { t: 1789000000 }];
  const out = C(rows, 900, now);
  ok(out.length === 3 && out[2].t === 1789000000 - 900,
     'the bar that opened at now is still forming and is dropped');

  ok(C([], 900, now).length === 0, 'an empty tape stays empty');
  ok(C(null, 900, now).length === 0, 'a null tape returns an empty array');
  /* Every one of these tapes ENDS on a genuinely forming bar, so at least one
     row is droppable and the trailing fallback stays out of the way. Without
     that the fallback masks the guard: a tape whose rows all pass returns
     slice(0,-1) either way, and a mutation that files stamp-less rows as
     closed gives the same length. Correct answer below is 2 -- the two real
     bars -- and a mutant that keeps the bad row returns 3. */
  const forming = { t: 1789000000 };
  ok(C([{ t: 'x' }, { t: 1 }, { t: 2 }, forming], 900, now).length === 2,
     'a row with an unreadable stamp is not counted as closed');
  /* +null, +undefined and +'' are all 0, and 0 <= cutoff, so a bare
     `<= cutoff` files a stamp-less row as a bar that closed in 1970 */
  ok(C([{ t: null }, { t: 1 }, { t: 2 }, forming], 900, now).length === 2,
     'and neither is a row whose stamp is null');
  ok(C([{ t: undefined }, { t: 1 }, { t: 2 }, forming], 900, now).length === 2, 'nor undefined');
  ok(C([{ t: '' }, { t: 1 }, { t: 2 }, forming], 900, now).length === 2, 'nor an empty string');
  ok(C([{ t: -Infinity }, { t: 1 }, { t: 2 }, forming], 900, now).length === 2, 'nor -Infinity');
  ok(C([{ t: NaN }, { t: 1 }, { t: 2 }, forming], 900, now).length === 2, 'nor NaN');
  ok(C([{ t: '1800' }, { t: 1 }, { t: 2 }], 900, now).length
      === C([{ t: 1800 }, { t: 1 }, { t: 2 }], 900, now).length,
     'a numeric string stamp reads exactly as its number does');
  ok(C([{ t: '1800' }, { t: 1 }], 900, now)[0].t === '1800',
     'and the row itself is kept, not a rewritten copy');
}

/* ---------------------------------------------------------------- 3
   THE DEFECT ITSELF. One tape. One forming bar whose finished shape is fixed.
   Move only the moment the scan ran. */
let clockSpread = 0, clockSweeps = 0, trimConstant = true, trimScore = null;
{
  let seed = 99;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const n = 300, rows = []; let px = 100;
  const t0 = Math.floor(Date.UTC(2026, 8, 19, 12, 0, 0) / 1000 / SEC) * SEC - n * SEC;
  for (let i = 0; i < n; i++){
    const o = px, c = px * (1 + (rnd() - 0.5 + 0.10) * 0.012);
    rows.push({ t: t0 + i * SEC, o: o, c: c,
                h: Math.max(o, c) * (1 + rnd() * 0.005),
                l: Math.min(o, c) * (1 - rnd() * 0.005), v: 800 + rnd() * 2000 });
    px = c;
  }
  const lt = rows[n - 1].t;
  /* a heavy down bar: ~2.3x the running average volume when finished */
  const fo = px, fcFull = px * 0.988, fhFull = px * 1.001, flFull = px * 0.986, fvFull = 4200;
  const to1h = r => { const o = []; for (let i = 0; i + 4 <= r.length; i += 4){ const q = r.slice(i, i + 4);
    o.push({ t: q[0].t, o: q[0].o, c: q[3].c, h: Math.max(...q.map(x => x.h)),
             l: Math.min(...q.map(x => x.l)), v: q.reduce((a, x) => a + x.v, 0) }); } return o; };

  const trimmed = S.hgOrderFlowScore('X', rows, to1h(rows));
  trimScore = trimmed.score;
  ok(S.hgSweepPattern(rows).detected === false,
     'on the closed tape this fixture shows no sweep');

  const seen = [], sweeps = [];
  for (const f of [0.02, 0.05, 0.10, 0.25, 0.50, 0.75, 0.90, 0.97, 1.00]){
    const forming = { t: lt + SEC, o: fo, c: fo + (fcFull - fo) * f,
                      h: fo + (fhFull - fo) * f, l: fo + (flFull - fo) * f, v: fvFull * f };
    const raw = rows.concat([forming]);
    seen.push(S.hgOrderFlowScore('X', raw, to1h(raw)).score);
    sweeps.push(S.hgSweepPattern(raw).detected);
  }
  clockSpread = Math.max(...seen) - Math.min(...seen);
  clockSweeps = sweeps.filter(Boolean).length;

  ok(clockSpread > 0.4,
     'including the forming bar, layer 2 spans ' + clockSpread.toFixed(4)
     + ' across nothing but the scan clock');
  ok(clockSweeps > 0 && clockSweeps < sweeps.length,
     'and the sweep read fires at some clock positions and not others ('
     + clockSweeps + ' of ' + sweeps.length + ')');
  ok(sweeps[0] === false && sweeps[sweeps.length - 1] === true,
     'specifically: not early in the bar, yes at the end of it');
  /* the partial-volume arithmetic, stated: the gate needs f >= 1.5*avg/full */
  ok(sweeps.indexOf(true) >= 5,
     'the sweep cannot appear before f >= 1.5 x avgVol / fullVol (~0.64 here)');

  /* THE SAME TAPE TRIMMED GIVES ONE ANSWER, whatever the clock says. Run the
     real csTrimToBar over each of those nine raw tapes and score what comes
     back: the forming bar is removed, so all nine must land on one number. */
  const afterTrim = [];
  for (const f of [0.02, 0.05, 0.10, 0.25, 0.50, 0.75, 0.90, 0.97, 1.00]){
    const forming = { t: lt + SEC, o: fo, c: fo + (fcFull - fo) * f,
                      h: fo + (fhFull - fo) * f, l: fo + (flFull - fo) * f, v: fvFull * f };
    const raw = rows.concat([forming]);
    const cut = S.__csTrimToBar(raw, lt);
    afterTrim.push(S.hgOrderFlowScore('X', cut, to1h(cut)).score);
  }
  trimConstant = afterTrim.every(v => Math.abs(v - afterTrim[0]) < 1e-12);
  ok(seen.every(v => isFinite(v)) && afterTrim.every(v => isFinite(v)),
     'every reading, raw and trimmed, is a number');
  ok(afterTrim.length === seen.length && trimConstant,
     'trimmed, all ' + afterTrim.length + ' clock positions give ONE score ('
     + afterTrim[0].toFixed(4) + ') — the spread collapses from '
     + clockSpread.toFixed(4) + ' to 0');
  ok(Math.abs(afterTrim[0] - trimScore) < 1e-12,
     'and it is the score the closed tape had all along');
  ok(Math.abs(trimScore - seen[seen.length - 1]) > 0.4,
     'which differs from the late-in-bar raw reading by '
     + Math.abs(trimScore - seen[seen.length - 1]).toFixed(4));
  ok(S.__csTrimToBar(rows.concat([{ t: lt + SEC, o: fo, c: fo, h: fo, l: fo, v: fvFull }]), lt)
      .length === rows.length,
     'the trim removes exactly the forming bar, nothing else');
}

/* ---------------------------------------------------------------- 4
   THE FIX IS WIRED. A source grep cannot tell a wired call from a dead one, so
   drive the real runScan against stubs and record exactly which rows layer 2
   was handed. */
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

  /* a tape whose LAST row is unmistakably the forming bar */
  let seed = 41;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const N = 300, r15 = []; let px = 100;
  const base = Math.floor(Date.now() / 1000 / SEC) * SEC;
  const t0 = base - N * SEC;
  for (let i = 0; i < N; i++){
    const o = px, c = px * (1 + (rnd() - 0.5 + 0.08) * 0.010);
    r15.push({ t: t0 + i * SEC, o: o, c: c, h: Math.max(o, c) * 1.001,
               l: Math.min(o, c) * 0.999, v: 1000 + rnd() * 1000 });
    px = c;
  }
  const FORMING_T = r15[N - 1].t;                  /* the bar that opened at `base - SEC`… */
  /* 1h bars ending on the hour that is CURRENTLY forming, so the last row is
     unambiguously incomplete exactly as a live fetch would hand it over */
  const FORMING_1H = Math.floor(Date.now() / 1000 / 3600) * 3600;
  const r1h = [];
  for (let i = 199; i >= 0; i--) r1h.push({ t: FORMING_1H - i * 3600, o: 100, c: 101, h: 102, l: 99, v: 5000 });

  const calls = [];
  const realFlow = S.hgOrderFlowScore;
  S.hgOrderFlowScore = function(sym, a, b){
    calls.push({ sym: sym, last15: a && a.length ? a[a.length - 1].t : null, n15: a ? a.length : 0,
                 last1h: b && b.length ? b[b.length - 1].t : null, n1h: b ? b.length : 0 });
    return realFlow.call(this, sym, a, b);
  };
  const smcSeen = [];
  S.hgSmcEnrich = function(row, ctx){
    smcSeen.push(ctx && ctx.rows && ctx.rows.length ? ctx.rows[ctx.rows.length - 1].t : null);
  };
  S.hgDeskLoadDeltaCoinDCX = async () => ({ items: [{ sym: 'ZZZUSDT', exchange: 'delta', base: 'ZZZ' }],
                                            venueCounts: { delta: 1, coindcx: 0 }, rawLen: 1 });
  S.hgDeskFetchKlines = async (item, tf) => (tf === '15m' ? r15.slice() : r1h.slice());
  S.hgDeskFetchKlinesResult = async (item, tf) => ({ rows: tf === '15m' ? r15.slice() : r1h.slice(),
                                                     ok: true, reason: null, error: null });
  S.hgSentimentLoad = async () => ({});

  const tab = (S.HG_tabs || []).filter(t => t && t.id === 'cryptoscan')[0];
  ok(!!tab, 'the tab is registered');
  const el = fakeEl();
  tab.mount(el);

  const out = await tab.refresh();
  ok(out === 'refreshed', 'the stubbed scan ran to completion (' + out + ')');
  ok(calls.length === 1, 'layer 2 was called once');

  const engineBar = S.cryptoScanState().setups.length
    ? S.cryptoScanState().setups[0].bar : null;
  ok(!!engineBar, 'the scan produced a setup carrying the engine bar');

  ok(calls[0].last15 !== FORMING_T,
     'layer 2 did NOT receive the forming 15m bar');
  ok(engineBar && calls[0].last15 === engineBar.t,
     'it received exactly the bar layer 1 voted on');
  ok(calls[0].n15 === N - 1, 'one bar shorter than the raw fetch (' + calls[0].n15 + ' of ' + N + ')');

  ok(calls[0].last1h !== FORMING_1H,
     'layer 2 did NOT receive the forming 1h bar either');
  ok(calls[0].n1h === r1h.length - 1,
     'exactly the forming 1h bar came off (' + calls[0].n1h + ' of ' + r1h.length + ')');
  ok(calls[0].last1h === FORMING_1H - 3600, 'so the 1h leg ends on the last CLOSED hour');

  ok(smcSeen.length === 1 && smcSeen[0] === calls[0].last15,
     'SMC and layer 2 now grade the same bar');

  /* and that bar is BEFORE anything the forward log will settle against */
  const recs = JSON.parse(S.localStorage.getItem('hg_forward_v1') || '{"rows":[]}');
  const rows = recs.rows || recs || [];
  const rec = (Array.isArray(rows) ? rows : []).filter(r => r && r.sym === 'ZZZUSDT')[0];
  ok(!!rec, 'the scan wrote a forward record');
  ok(rec && rec.barT === calls[0].last15,
     'the record is keyed on the same bar layer 2 read, so nothing it read is in its own settlement window');

  S.hgOrderFlowScore = realFlow;
}

/* ---------------------------------------------------------------- 5
   Source guards for what the comment claims, and for the label version. */
{
  const bare = stripComments(SCAN);
  ok(/hgOrderFlowScore\(\s*item\.sym\s*,\s*closed15\s*,\s*closed1h\s*\)/.test(bare),
     'layer 2 is called with the trimmed tapes');
  ok(!/hgOrderFlowScore\([^)]*rows15m/.test(bare),
     'and never with the raw 15m fetch');
  ok(!/hgOrderFlowScore\([^)]*rows1h/.test(bare),
     'and never with the raw 1h fetch');

  /* ordering: closed15 must exist before layer 2 uses it */
  ok(bare.indexOf('var closed15') > 0
     && bare.indexOf('var closed15') < bare.indexOf('hgOrderFlowScore(item.sym'),
     'closed15 is computed before layer 2 reads it');

  ok(S.CS_LABEL_V === 5, 'CS_LABEL_V is 5 — the tier pipeline moved, so old labels stop pooling');
  ok(/@v5/i.test(S.__csFwdRows([{ sym: 'A', dir: 'long', voteTier: 'strong', price: 1,
                                  plan: { entry: 1, stop: 0.9, t1: 1.2 } }])[0].mechanic),
     'and the version rides in the mechanic key');

  /* The stale correlation figure. 0.872 was measured BEFORE pack 867 fixed
     hgSweepPattern's volume divisor, which changes this function's output, so
     it never described the code it sat inside. The header was corrected then;
     this copy was missed. It may still appear as history, never as a claim. */
  ok(/measured correlation with layer 1's direction is 0\.957/.test(FLOW),
     'the return comment now carries the re-measured 0.957');
  ok(!/is 0\.872/.test(FLOW) && !/0\.872, agreement/.test(FLOW),
     'and no longer states 0.872 as the correlation');
  ok((FLOW.match(/0\.957/g) || []).length >= 2,
     'the measured figure appears in both the header and the return');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
