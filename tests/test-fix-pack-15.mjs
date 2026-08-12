/* HARDGATE — fix pack 15 regression guards (EDGE + GOLD A+). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { hgEdgeFor, hgEdgeArchetypeLine } from '../lib/edge-lookup.mjs';
import { fingerprint } from '../lib/setup-fingerprint.mjs';
import { hgVenuePremium, hgVenuePremiumZ } from '../lib/venue-premium.mjs';
import { hgSignalRarity } from '../lib/rarity.mjs';
import { hgBarFreshnessChip } from '../lib/freshness.mjs';
import { hgRealRate, hgRealRateGoldHint } from '../lib/real-rate.mjs';
import { hgMetalsComplex } from '../lib/metals-complex.mjs';
import { hgGoldVenueSpread } from '../lib/gold-venue-spread.mjs';
import { hgTallyLegAudit } from '../lib/gold-tally-audit.mjs';
import { hgGoldAPlus, hgGoldAPlusAssertNoConvictionWrite } from '../lib/gold-aplus.mjs';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };

function mkRec(overrides = {}) {
  const fp = fingerprint({
    symbol: overrides.sym || 'BTCUSDT',
    side: overrides.dir || 'long',
    poiKind: 'sweep',
    regime: 'trend',
    htfAlign: true,
    confluence: 2,
    atrPct: 1.0,
    ts: Date.UTC(2026, 0, 15, 14),
    rr: 2.0,
  });
  return Object.assign({
    status: 'settled', r: 0.5, sym: 'BTCUSDT', dir: 'long',
    fpKey: fp.key, fpCoarse: [fp.parts.cls, fp.parts.side, fp.parts.poi, fp.parts.regime].join('|'),
    fpParts: fp.parts,
    at: Date.UTC(2026, 0, 10),
    closedAt: Math.floor(Date.UTC(2026, 0, 11) / 1000),
  }, overrides);
}

console.log('== fingerprint edge ==');
{
  const fp = fingerprint({ symbol: 'BTCUSDT', side: 'long', poiKind: 'sweep', regime: 'trend', htfAlign: true, confluence: 3, atrPct: 1.2, ts: Date.UTC(2026, 6, 1, 13), rr: 2.1 });
  ok(fp.key && fp.parts, 'fingerprint produces key + parts');
  const noFp = [{ status: 'settled', r: 1, sym: 'X', dir: 'long' }];
  const e0 = hgEdgeFor({ symbol: 'BTCUSDT', side: 'long', poiKind: 'sweep', regime: 'trend', htfAlign: true, confluence: 3, atrPct: 1.2, ts: Date.UTC(2026, 6, 1, 13), rr: 2.1 }, noFp);
  ok(e0.source === 'prior' && e0.noFingerprint === 1, 'records without fpKey excluded; prior fallback');

  const recs = [];
  for (let i = 0; i < 22; i++) {
    recs.push(mkRec({ r: i < 14 ? 0.4 : -0.2, at: Date.UTC(2026, 0, i + 1) }));
  }
  const cand = { symbol: 'BTCUSDT', side: 'long', poiKind: 'sweep', regime: 'trend', htfAlign: true, confluence: 2, atrPct: 1.0, ts: Date.UTC(2026, 0, 15, 14), rr: 2.0 };
  const exact = hgEdgeFor(cand, recs);
  ok(exact.source === 'exact' && exact.n === 22, 'hgEdgeFor exact when n>=minFull');
  const oneWin = [mkRec({ r: 1 })];
  const many = recs.slice();
  const e1 = hgEdgeFor(cand, oneWin);
  const e22 = hgEdgeFor(cand, many);
  ok((e1.wilsonLB ?? -9) < (e22.wilsonLB ?? 0), 'ranking uses wilsonLB — 1/1 does not beat 14/22 lower bound');

  const badRecs = recs.map((r) => Object.assign({}, r, { r: -0.5 }));
  const bad = hgEdgeFor(cand, badRecs);
  ok(bad.tier === 'PROVEN-BAD', 'PROVEN-BAD when exp bad and effN>=8');
  ok(hgEdgeArchetypeLine(exact).includes('this archetype'), 'archetype line formats');
}

console.log('== venue premium ==');
{
  ok(hgVenuePremium({ deltaMark: null, binanceMark: 100 }) === null, 'null on missing Delta leg');
  ok(hgVenuePremium({ deltaMark: 100, binanceMark: null }) === null, 'never infers missing leg');
  const p = hgVenuePremium({ deltaMark: 100.5, binanceMark: 100 });
  ok(p && Math.abs(p.premBps - 50) < 1, 'premBps computed');
  const hist = Array.from({ length: 80 }, (_, i) => 10 + (i % 3));
  const z = hgVenuePremiumZ(hist, 240, 10);
  ok(!z.stretched, 'hgVenuePremiumZ needs n>=60 before stretched at |z|>=2');
  const hist2 = Array.from({ length: 80 }, (_, i) => (i % 5) * 0.1);
  const z2 = hgVenuePremiumZ(hist2, 240, 5);
  ok(z2.stretched, 'stretched when |z|>=2 and n>=60');
}

console.log('== rarity + freshness ==');
{
  const cands = Array.from({ length: 40 }, (_, i) => ({ dir: 'long', stratKey: 'ema', sym: 'S' + i }));
  for (let i = 0; i < 10; i++) cands[i].stratKey = 'unique';
  const r = hgSignalRarity(cands, 40, { dir: 'long', stratKey: 'ema' });
  ok(r.label === 'COMMON' && r.rarityPct >= 0.25, 'COMMON at >=25% universe');
  ok(hgBarFreshnessChip(0, '4h').html === 'FRESH', 'freshness chip FRESH at barAge 0');
  ok(hgBarFreshnessChip(3, '4h').stale === true, '4h stale beyond 1 bar');
}

console.log('== real rates ==');
{
  const rows = Array.from({ length: 25 }, (_, i) => ({
    date: '2026-01-' + String(25 - i).padStart(2, '0'),
    value: 2.0 - i * 0.01,
  }));
  const now = Date.parse('2026-01-25T12:00:00Z');
  const staleNow = Date.parse('2026-02-10T12:00:00Z');
  const rr = hgRealRate({ dfii10Rows: rows, nowMs: now });
  ok(rr.measured && rr.source === 'fred-dfii10', 'hgRealRate measured from DFII10');
  const stale = hgRealRate({ dfii10Rows: rows, nowMs: staleNow });
  ok(stale.stale === true, 'stale beyond 3 business days');
  const hint = hgRealRateGoldHint(null, 'TAILWIND');
  ok(hint.measured === false && hint.label.includes('fallback'), 'fallback never wears measured label');
}

console.log('== metals + gold venue ==');
{
  const mc = hgMetalsComplex({
    dir: 'long',
    xagTrend: 'RISING',
    ratioTrend: 'FALLING',
    dxy: { trend20: 'FALLING' },
    real10y: { trend: 'FALLING' },
  });
  ok(mc.verdict === 'COMPLEX CONFIRMS', 'metals complex confirms');
  const mc2 = hgMetalsComplex({ dir: 'long', xagTrend: 'FALLING', dxy: { trend20: 'RISING' }, real10y: { trend: 'RISING' } });
  ok(mc2.verdict === 'COMPLEX OPPOSES' || mc2.oppose >= 2, 'complex opposes');
  ok(!mc.dark.includes('M5'), 'GDX absence does not darken A+ legs list');

  const gated = hgGoldVenueSpread({ spot: 2000, paxg: 2010, cashOpen: false });
  ok(gated.gated === true, 'gold venue spread gated off outside cash hours');
}

console.log('== gold A+ ==');
{
  const cand = {
    dir: 'long', barAge: 0, htfAlign: true, rr: 2.2, anchor: 'OB', er: 0.4,
    killzoneWeight: 3, killzone: 'LONDON',
  };
  const ctx = {
    style: 'goldscalp',
    newsCaution: false,
    metalsComplex: { verdict: 'COMPLEX CONFIRMS', oppose: 0, dark: [] },
    realRate: { measured: true, trend: 'FALLING' },
    cot: { crowding: 'NEUTRAL' },
    goldVenueSpread: { gated: false, darkVenues: [] },
    edge: { tier: 'UNPROVEN', n: 4 },
    volRegime: { regime: 'NORMAL' },
  };
  const ap = hgGoldAPlus(cand, ctx);
  ok(ap.aplus === true, 'candidate passes all available A+ legs');

  const sweep = Object.assign({}, cand, { sweepExempt: true });
  const ap2 = hgGoldAPlus(sweep, ctx);
  ok(!ap2.aplus && ap2.failed.includes('L2 HTF alignment'), 'sweep exempt never A+');

  const lowRr = Object.assign({}, cand, { rr: 1.7 });
  const ap3 = hgGoldAPlus(lowRr, ctx);
  ok(ap3.failed.includes('L3 structural R:R'), 'A+ requires >=2.0R not 1.2R');

  const darkCtx = Object.assign({}, ctx, { cot: null, realRate: { measured: false } });
  const ap4 = hgGoldAPlus(cand, darkCtx);
  ok(ap4.darkLegs.length > 0 && !ap4.aplus, 'DARK legs block A+ and are named');

  const oneFail = Object.assign({}, cand, { rr: 1.5 });
  const ap5 = hgGoldAPlus(oneFail, ctx);
  ok(ap5.soleBlocker === 'L3 structural R:R', 'sole blocker surfaced');

  let wrote = false;
  try {
    hgGoldAPlusAssertNoConvictionWrite(() => { wrote = true; }, 'hgGoldscalpConviction');
    ok(false, 'should throw on conviction write');
  } catch (e) {
    ok(!wrote, 'A+ never mutates conviction lock');
  }
}

console.log('== tally audit ==');
{
  const recs = [];
  for (let i = 0; i < 20; i++) {
    recs.push({
      status: 'settled', r: i % 2 ? 0.5 : -0.3,
      tallyParts: [{ label: 'crypto fear & greed 20', pts: 1, leg: 'crypto fng' }],
    });
  }
  const audit = hgTallyLegAudit(recs);
  ok(audit.length >= 1, 'hgTallyLegAudit produces rows');
  const noise = audit.find((a) => a.leg === 'crypto fng' || a.leg === 'fear');
  if (noise) ok(noise.verdict === 'NOISE' || noise.verdict === 'UNPROVEN', 'NOISE/unproven legs identifiable');
}

console.log('== sw cache + execute disarmed ==');
{
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  ok(sw.includes("'hg-v263'"), 'sw.js cache hg-v263');
  ok(sw.includes('fixpack15-core.js'), 'fixpack15-core precached');
  ok(sw.includes('venuepremium.js'), 'venuepremium.js precached');
  const exec = fs.readFileSync(path.join(root, 'execute.js'), 'utf8');
  ok(!/hgGoldAPlus|hgVenuePremium/.test(exec), 'execute.js stays disarmed');
}

console.log('\nPASS fix-pack-15 — ' + pass + ' assertions');
