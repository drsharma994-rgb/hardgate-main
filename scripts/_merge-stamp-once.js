/* one-shot: rebuild build-stamp + ledger + AGENTS for the hg-v1463 union merge */
const fs = require('fs');
const { execSync } = require('child_process');
const show = f => execSync('git show origin/main:' + f, { maxBuffer: 64 * 1024 * 1024 }).toString();

/* ---- build-stamp.js ---- */
const upLine = show('build-stamp.js').split('\n').find(l => l.startsWith("  pack: 'hg-v146"));
const open = "  pack: '".length;
const last = upLine.lastIndexOf("'");
const upInner = upLine.slice(open, last);   // upstream chain: v1462? + v1461? + older
console.log('upstream pack head:', upInner.slice(0, 80));

const PACK = [
  "hg-v1463: GOLD SETUP LOGIC — three producers corrected, and the CONFLUENCE tab accords with upstream hg-v1462's leader-quote card. ",
  "(1) hgPlanFromRisk (plans.js, the shared plan builder behind NEWGOLD, OMNIGOLD, OMNIROUTE and FORMATION) could ship an INVERTED T2: the v675 fall-through resolves T2 as the t2R policy rung whenever the t2Hint fails rew2 > rew1, but when the surviving T1 sits BEYOND that policy rung (a structural 4.16R hint against the 3.5R policy T2) — or a caller configures t2R <= t1R — the resolved T2 landed CLOSER to entry than T1: the card advertised T2 as the further rung while T2 paid LESS R, and a ledger closing at T2 realised less than the card claimed (2875 of 20000 fuzzed plans inverted). The resolved T2 that fails rew2 > rew1 is dropped to ABSENT with a named t2Unordered flag and rr2 unread — the plan does not invent an R; it still passes (named, never gating); clean 2R/3.5R ladders are bit-identical. ",
  "(2) GANESH GOLD planFor: TP2 is the range EQUILIBRIUM before the week extreme, and the equilibrium of a compressing range can sit NEARER than the previous day high (mirrored on shorts); TP3 can sit nearer than a kept TP2 — the same inverted-ladder lie. An unordered rung is dropped to absent (the paint already prints n/a) with named tp2Unordered/tp3Unordered flags; ok still keys on TP1 only; planFor is exported read-only for the suite. ",
  "(3) GOLD CONFLUENCE accords with hg-v1462's one-desk leader quote and upstream hg-v1459's target-less ranker rule: the watch and the tie card no longer go SILENT when the leader publishes no target — a risk-only quote (quoteSideRiskOnly) paints the leader entry/stop with the reward leg absent and named (NO TARGET PUBLISHED), a broken stop still returns null; applyCost leaves rr and net R unread (null) and names the unread net instead of a phantom under-1R failure; the cf:synthetic t1 leg is absent, not silently passed by a NaN comparison. The ready path keeps hg-v1462's honest refusal (the nearest desk plan without a target beyond the entry forms no setup). ",
  "(4) ROOT CAUSE under all of it: the median filter used the COERCING global isFinite — isFinite(null) is true — so a null level leaked through and median returned null, crashing the first median ever taken over a field a desk may leave unread. Strictly numeric now. ",
  "Tests: tests/test-gold-setup-logic-v1463.mjs, mutation-proven. Not re-walked; the forward ledger decides. "
].join('');
const packEsc = PACK.split("'").join("\\'");

let bs = fs.readFileSync('build-stamp.js', 'utf8');
const re = /^  pack: '.*$/m;
if (!re.test(bs)) throw new Error('pack line not found');
bs = bs.replace(re, "  pack: '" + packEsc + upInner + "',");
bs = bs.replace(/version: '[^']*'/, "version: 'hg-v1463'");
bs = bs.replace(/built: '[^']*'/, "built: '2026-10-29T18:10:00Z'");
fs.writeFileSync('build-stamp.js', bs);
console.log('build-stamp rebuilt');

/* ---- batch-ledger.json ---- */
const led = JSON.parse(show('data/batch-ledger.json'));
const arr = Array.isArray(led) ? led : Object.values(led).find(Array.isArray);
arr.push({
  version: 'hg-v1463',
  built: '2026-10-29T18:10:00Z',
  note: "GOLD SETUP LOGIC, accords with hg-v1462's leader-quote card. hgPlanFromRisk (the shared plan builder behind NEWGOLD, OMNIGOLD, OMNIROUTE and FORMATION) could ship an inverted T2 — the resolved T2 landing closer to entry than the surviving T1 when a structural T1 hint sat past the t2R policy rung or a caller configured t2R <= t1R (2875 of 20000 fuzzed plans inverted); the unordered T2 is dropped to absent with a named t2Unordered flag, rr2 unread, the plan still passes. GANESH GOLD planFor drops an unordered rung (the range equilibrium can sit nearer than the previous day high; TP3 nearer than a kept TP2) to absent with named tp2Unordered/tp3Unordered flags; ok still keys on TP1 only. GOLD CONFLUENCE: the watch and the tie card no longer go silent when the leader publishes no target — a risk-only quote paints the leader entry/stop with the reward leg absent and named; applyCost leaves rr and net R unread and names the unread net; the cf:synthetic t1 leg is absent, not silently passed; the ready path keeps hg-v1462's honest refusal. Root cause: the median filter used the coercing global isFinite (isFinite(null) true) and could return null — strictly numeric now. Not re-walked; the forward ledger decides."
});
fs.writeFileSync('data/batch-ledger.json', JSON.stringify(led, null, 2));
console.log('ledger appended at', arr[arr.length - 1].version);
