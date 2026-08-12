/* HARDGATE — metals-complex confirmation (fix pack 15). */

const num = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const S = (v) => String(v || '').toUpperCase();

function legTrend(val, dir) {
  if (val === null || val === undefined) return 'dark';
  const t = S(val);
  if (t.includes('RISE') || t.includes('RIS') || t.includes('UP') || t === 'BULLISH') {
    return dir === 'long' ? 'agree' : 'oppose';
  }
  if (t.includes('FALL') || t.includes('DOWN') || t === 'BEARISH') {
    return dir === 'short' ? 'agree' : 'oppose';
  }
  if (t === 'FLAT' || t === 'NEUTRAL') return 'dark';
  return 'dark';
}

function inverseLeg(val, dir) {
  if (val === null || val === undefined) return 'dark';
  const t = S(val);
  if (t.includes('FALL') || t.includes('DOWN')) return dir === 'long' ? 'agree' : 'oppose';
  if (t.includes('RISE') || t.includes('RIS') || t.includes('UP')) return dir === 'short' ? 'agree' : 'oppose';
  if (t === 'FLAT' || t === 'NEUTRAL') return 'dark';
  return 'dark';
}

/**
 * hgMetalsComplex({ xau, xag, dxy, real10y, ratio, ratioTrend, gdx, dir })
 */
export function hgMetalsComplex(input = {}) {
  const dir = String(input.dir || input.direction || 'long').toLowerCase() === 'short' ? 'short' : 'long';
  const evidence = [];
  let agree = 0;
  let oppose = 0;
  const dark = [];

  const xagTrend = input.xag?.trend20 ?? input.xagTrend ?? input.xag;
  const m1 = legTrend(xagTrend, dir);
  evidence.push({ leg: 'M1 XAG trend', state: m1, detail: String(xagTrend || 'dark') });
  if (m1 === 'agree') agree++;
  else if (m1 === 'oppose') oppose++;
  else dark.push('M1 XAG');

  const ratioTrend = input.ratioTrend ?? input.ratio?.trend20 ?? null;
  let m2 = 'dark';
  let m2note = 'ratio dark';
  if (ratioTrend) {
    const rt = S(ratioTrend);
    if (rt.includes('FALL')) {
      m2 = dir === 'long' ? 'agree' : 'oppose';
      m2note = 'falling G/S ratio — risk-on metals bid';
    } else if (rt.includes('RISE')) {
      m2 = dir === 'long' ? 'agree' : 'oppose';
      m2note = 'rising G/S ratio — defensive gold bid (different regime)';
    }
  }
  evidence.push({ leg: 'M2 G/S ratio', state: m2, detail: m2note });
  if (m2 === 'agree') agree++;
  else if (m2 === 'oppose') oppose++;
  else dark.push('M2 G/S ratio');

  const dxyTrend = input.dxy?.trend20 ?? input.dxyTrend ?? input.dxy;
  const m3 = inverseLeg(dxyTrend, dir);
  evidence.push({ leg: 'M3 DXY inverse', state: m3, detail: String(dxyTrend || 'dark') });
  if (m3 === 'agree') agree++;
  else if (m3 === 'oppose') oppose++;
  else dark.push('M3 DXY');

  const realTrend = input.real10y?.trend ?? input.real10y?.trend20 ?? input.realTrend;
  const m4 = inverseLeg(realTrend, dir);
  evidence.push({ leg: 'M4 REAL 10Y inverse', state: m4, detail: String(realTrend || 'dark') });
  if (m4 === 'agree') agree++;
  else if (m4 === 'oppose') oppose++;
  else dark.push('M4 REAL 10Y');

  if (input.gdx !== undefined && input.gdx !== null) {
    const gdxTrend = input.gdx?.trend20 ?? input.gdx;
    const m5 = legTrend(gdxTrend, dir);
    evidence.push({ leg: 'M5 GDX (optional)', state: m5, detail: String(gdxTrend || 'absent') });
  }

  let verdict = 'MIXED';
  if (oppose >= 2) verdict = 'COMPLEX OPPOSES';
  else if (agree >= 3 && oppose === 0) verdict = 'COMPLEX CONFIRMS';

  return { verdict, agree, oppose, dark, evidence };
}

export function hgMetalsComplexForDir(complex, dir) {
  if (!complex) return { ok: false, dark: true };
  const d = String(dir || '').toLowerCase();
  if (complex.verdict === 'COMPLEX OPPOSES') return { ok: false, dark: false };
  if (complex.verdict === 'COMPLEX CONFIRMS') return { ok: true, dark: false };
  if (complex.oppose > 0) return { ok: false, dark: false };
  if (complex.dark && complex.dark.length >= 2) return { ok: false, dark: true };
  return { ok: false, dark: complex.dark.length > 0 };
}
