/* HARDGATE — reversalsniper.js unit tests (Node 18+, no live network). */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk } from './helpers/build-version.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext(Object.create(null));
ctx.window = ctx;
ctx.globalThis = ctx;
for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'meanrev.js', 'reversalsniper.js']){
  vm.runInContext(readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const W = ctx.window;

let pass = 0, fail = 0;
function ok(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

ok(typeof W.rsMaxSafeLev === 'function', 'rsMaxSafeLev exported');
ok(typeof W.rsAssess === 'function', 'rsAssess exported');
ok(typeof W.rsConviction === 'function', 'rsConviction exported');
ok(Array.isArray(W.HG_tabs) && W.HG_tabs.some(t => t && t.id === 'reversalsniper'),
   'HG_tabs registers reversalsniper');

/* 30× needs stop ≤ ~1.9% */
ok(W.rsMaxSafeLev(100, 98.112) >= 30, 'rsMaxSafeLev: ~1.888% stop -> ≥30×');
ok(W.rsMaxSafeLev(100, 97) >= 20, 'rsMaxSafeLev: 3% stop -> ≥20×');
ok(W.rsMaxSafeLev(100, 100) === 1, 'rsMaxSafeLev: degenerate -> 1');

ok(W.rsAssess(null) === null && W.rsAssess([]) === null, 'rsAssess: null/empty -> null');

ok(W.rsConviction({ triggers: ['sweep'] }) === 4, 'rsConviction: sweep = 4');
ok(W.rsConviction({ triggers: ['meanrev', 'drawdown'], bt: { n: 5, expR: 0.5, winPct: 60 } }) >= 6,
   'rsConviction: meanrev + drawdown + paying bt');
ok(W.rsConviction({ triggers: ['rsi', 'drawdown'], rsi2: 0, drawdownPct: 8 }) >= 4,
   'rsConviction: extreme RSI + drawdown reaches sniper floor');

ok(W.rsIsDeskVenue('delta') && W.rsIsDeskVenue('coindcx') && !W.rsIsDeskVenue('binance'),
   'rsIsDeskVenue: delta + coindcx only');
ok(typeof W.rsLoadUniverse === 'function', 'rsLoadUniverse exported');
ok(swCacheOk(readFileSync(path.join(root, 'sw.js'), 'utf8')), 'cache matches build stamp');
/* Timestamps must be FRESH wall-clock ms: v677 stamps formedT off the last
   closed bar and rsConviction penalises stale setups (-2 past ~4 bars), and
   v678 charges -3 for an against-tape long — a dump tape is by definition
   against-tape. The old epoch-0 t:i*14400 fixture read as a 1970 setup and
   the two penalties together (8 - 2 - 3 = 3) sank it below MIN_CONVICTION 4.
   A fresh last bar keeps the deep-RSI + drawdown snipe above the floor
   (8 + 1 - 3 = 6), exactly the "strong ones survive" case v678 documents. */
function tapeOversold(){
  const out=[]; let p=100;
  const t0 = Date.now() - 120*14400*1000;   // 4H bars ending NOW (fresh)
  for(let i=0;i<120;i++){
    if(i>=100) p*=0.985;
    else if(i>=80) p*=0.995;
    out.push({t:t0+i*14400*1000,o:p,h:p*1.01,l:p*0.992,c:p,v:1000});
  }
  return out;
}
const hit = W.rsAssess(tapeOversold());
ok(hit && hit.conviction >= 4 && hit.lev >= 30, 'rsAssess: oversold dump tape yields sniper setup');
ok(typeof W.rsTradeable === 'function', 'rsTradeable exported');
ok(W.rsTradeable(hit) === true, 'without desk-edge overlay a formed setup stays fail-open');
ok(/Delta.*CoinDCX.*full universe/i.test(readFileSync(path.join(root, 'reversalsniper.js'), 'utf8')),
   'reversalsniper scans Delta + CoinDCX full universe');

/* Desk-edge overlay: PIN-REJECT suppress — bounce is watch only. */
vm.runInContext(readFileSync(path.join(root, 'desk-formation-edge.js'), 'utf8'), ctx, { filename: 'desk-formation-edge.js' });
const watched = W.rsAssess(tapeOversold());
ok(watched && watched.deskEdgeAction === 'suppress', 'desk-edge stamps PIN-REJECT suppress');
ok(watched.watchOnly === true && watched.ticket === false, 'suppressed bounce is watch-only');
ok(W.rsTradeable(watched) === false, 'rsTradeable refuses a suppressed bounce');
ok(typeof W.rsCardHTML === 'function', 'rsCardHTML exported');
const card = W.rsCardHTML({ setup: watched, item: { sym: 'ETHUSD' }, sym: 'ETHUSD', best: true });
ok(/WATCH ONLY/.test(card), 'card says WATCH ONLY');
ok(!/<button class="toTrade"/.test(card), 'card has no SEND TO TRADE PLAN button');
ok(!/onclick="addToBook/.test(card) && !/class="bookBtn"/.test(card), 'card has no ADD TO BOOK button');
ok(!/class="card long best"/.test(card), 'watch card is not MOST PROBABLE / best');

console.log('\n' + pass + ' passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
