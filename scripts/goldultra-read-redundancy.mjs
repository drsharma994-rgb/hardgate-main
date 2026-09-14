/* HARDGATE — how independent are GOLD ULTRA's 319 directional reads, really?

   Run:  node scripts/goldultra-read-redundancy.mjs [--bars=N] [--thr=0.9]

   THE QUESTION
   ------------
   goldultra.js states its own defect: "the 319 directional reads ... are
   heavily correlated (dozens are moving-average variants); agreement % is a
   count, not an independence-weighted probability". The plain vote measured
   -0.215R/trade OOS and four re-runs that ADDED reads never changed the sign.

   This script measures the redundancy instead of asserting it. It reads the
   per-bar vote vectors captured by goldultra-vote-vectors.mjs, correlates
   every pair of reads, and clusters them into families. The output answers:
   how many genuinely independent opinions does the tab actually hold?

   It also flags two things that quietly distort the count:
     DEAD reads   — never decisive across the whole window. They can never move
                    the numerator but they are not in the denominator either
                    (decisive is counted per bar), so they are harmless to pct
                    but they inflate the advertised "319 reads" figure.
     PINNED reads — decisive on almost every bar and almost always the same
                    side. A read that says "long" 95% of the time is a constant,
                    not an opinion, and it biases every count it enters.

   NOTHING HERE CHANGES THE APP. It is a measurement. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const CACHE_DIR = path.join(ROOT, 'scripts', '.bt-cache');
const argv = process.argv.slice(2);
const opt = (n, d) => { const a = argv.find(x => x.startsWith(n + '=')); return a ? a.split('=')[1] : d; };
const BARS = +opt('--bars', 6000);
const THR = +opt('--thr', 0.9);

const file = fs.readdirSync(CACHE_DIR)
  .filter(f => f.startsWith('goldultra-votevectors-' + BARS + '-'))
  .map(f => path.join(CACHE_DIR, f))[0];
if (!file) throw new Error('no vote-vector cache for --bars=' + BARS + ' — run scripts/goldultra-vote-vectors.mjs --bars=' + BARS + ' first');

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const ids = data.ids, R = ids.length, N = data.rows.length;
console.log('=== GOLD ULTRA read-redundancy · ' + N + ' bars x ' + R + ' directional reads ===');
console.log('    source: ' + path.basename(file));

/* decode columns: series[r][bar] in {-1,0,1} */
const series = Array.from({ length: R }, () => new Int8Array(N));
for (let b = 0; b < N; b++){
  const s = data.rows[b][1];
  for (let r = 0; r < R; r++){
    const ch = s.charCodeAt(r);
    series[r][b] = ch === 43 ? 1 : ch === 45 ? -1 : 0;   /* '+' : '-' : '0' */
  }
}

/* per-read behaviour */
const stat = [];
for (let r = 0; r < R; r++){
  let dec = 0, long = 0, sum = 0;
  for (let b = 0; b < N; b++){ const v = series[r][b]; if (v){ dec++; if (v > 0) long++; } sum += v; }
  const mean = sum / N;
  let ss = 0;
  for (let b = 0; b < N; b++){ const d = series[r][b] - mean; ss += d * d; }
  stat.push({ id: ids[r], r, decisiveRate: dec / N, longShare: dec ? long / dec : null, mean, sd: Math.sqrt(ss / N) });
}
const dead = stat.filter(s => s.decisiveRate === 0);
const pinned = stat.filter(s => s.decisiveRate >= 0.8 && s.longShare !== null && (s.longShare >= 0.95 || s.longShare <= 0.05));
const live = stat.filter(s => s.sd > 0);

console.log('\n-- per-read behaviour --');
console.log('  never decisive (DEAD)      : ' + dead.length + (dead.length ? '  e.g. ' + dead.slice(0, 8).map(s => s.id).join(', ') : ''));
console.log('  near-constant side (PINNED): ' + pinned.length + (pinned.length ? '  e.g. ' + pinned.slice(0, 8).map(s => s.id + '(' + (s.longShare * 100).toFixed(0) + '%L)').join(', ') : ''));
console.log('  usable (non-zero variance) : ' + live.length);

/* pairwise Pearson over live reads */
const L = live.length;
const z = live.map(s => {
  const a = series[s.r], out = new Float64Array(N);
  for (let b = 0; b < N; b++) out[b] = (a[b] - s.mean) / s.sd;
  return out;
});
function corr(i, j){ let acc = 0; const x = z[i], y = z[j]; for (let b = 0; b < N; b++) acc += x[b] * y[b]; return acc / N; }

/* union-find clustering at |rho| >= THR.
   ABSOLUTE correlation on purpose: a read that is reliably the NEGATIVE of
   another carries the same information, just inverted, and counting both is
   the same double-count as counting two copies of the same read. */
const parent = new Int32Array(L).map((_, i) => i);
const find = x => { while (parent[x] !== x){ parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };

let pairs = 0, linked = 0, maxRho = 0;
const strongest = [];
for (let i = 0; i < L; i++){
  for (let j = i + 1; j < L; j++){
    const rho = corr(i, j); pairs++;
    const a = Math.abs(rho);
    if (a > maxRho) maxRho = a;
    if (a >= THR){ union(i, j); linked++; if (strongest.length < 2000) strongest.push({ i, j, rho }); }
  }
}
const fam = new Map();
for (let i = 0; i < L; i++){ const k = find(i); if (!fam.has(k)) fam.set(k, []); fam.get(k).push(live[i].id); }
const families = [...fam.values()].sort((a, b) => b.length - a.length);
const singles = families.filter(f => f.length === 1).length;

console.log('\n-- clustering at |rho| >= ' + THR + ' --');
console.log('  pairs compared      : ' + pairs.toLocaleString());
console.log('  pairs above cutoff  : ' + linked.toLocaleString());
console.log('  FAMILIES            : ' + families.length + '   (from ' + L + ' live reads)');
console.log('  singletons          : ' + singles);
console.log('  largest families:');
for (const f of families.slice(0, 8)){
  if (f.length < 2) break;
  console.log('    [' + String(f.length).padStart(3) + '] ' + f.slice(0, 12).join(', ') + (f.length > 12 ? ', +' + (f.length - 12) + ' more' : ''));
}

console.log('\n-- sensitivity: families vs cutoff --');
for (const t of [0.99, 0.95, 0.9, 0.85, 0.8, 0.7, 0.6]){
  const p2 = new Int32Array(L).map((_, i) => i);
  const f2 = x => { while (p2[x] !== x){ p2[x] = p2[p2[x]]; x = p2[x]; } return x; };
  for (let i = 0; i < L; i++) for (let j = i + 1; j < L; j++){
    if (Math.abs(corr(i, j)) >= t){ const a = f2(i), b = f2(j); if (a !== b) p2[a] = b; }
  }
  const s = new Set(); for (let i = 0; i < L; i++) s.add(f2(i));
  console.log('    |rho| >= ' + t.toFixed(2) + '  ->  ' + String(s.size).padStart(4) + ' families');
}

const OUT = path.join(ROOT, 'scripts', 'goldultra-read-redundancy-results.json');
fs.writeFileSync(OUT, JSON.stringify({
  generated: new Date().toISOString(), source: path.basename(file),
  bars: N, reads: R, live: L, threshold: THR,
  dead: dead.map(s => s.id), pinned: pinned.map(s => ({ id: s.id, longShare: s.longShare, decisiveRate: s.decisiveRate })),
  families, maxAbsRho: maxRho,
}, null, 1));
console.log('\n  -> ' + OUT);
