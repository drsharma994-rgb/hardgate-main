/* HARDGATE — DEEP SCAN gate information families (fix pack 16). */

/** @type {Record<string,{family:string,speed?:string,label:string}>} */
export const HG_DEEP_GATE_META = {
  G1: { family: 'trend', speed: 'slow', label: 'Weekly EMA9/21' },
  G2: { family: 'trend', speed: 'medium', label: '4H EMA cascade' },
  G3: { family: 'trend', speed: 'slow', label: '1D vs EMA50 side' },
  G4: { family: 'trend', speed: 'fast', label: 'Heikin Ashi' },
  G5: { family: 'trend', speed: 'fast', label: 'Hull MA slope' },
  G6: { family: 'trend', speed: 'fast', label: 'TEMA slope' },
  G7: { family: 'trend', speed: 'medium', label: 'Donchian position' },
  G8: { family: 'trend', speed: 'fast', label: 'Parabolic SAR' },
  G9: { family: 'trend', speed: 'medium', label: 'SuperTrend' },
  G10: { family: 'trend', speed: 'slow', label: 'Ichimoku TK+Kumo' },
  G17: { family: 'trend', speed: 'medium', label: 'Keltner mid side' },
  G24: { family: 'trend', speed: 'medium', label: 'Awesome Oscillator' },
  G25: { family: 'trend', speed: 'medium', label: 'Aroon oscillator' },
  G33: { family: 'trend', speed: 'fast', label: 'Fisher slope' },
  G34: { family: 'trend', speed: 'fast', label: 'LinReg slope' },
  G36: { family: 'trend', speed: 'fast', label: 'ATR trailing stop' },

  G14: { family: 'oscillator', label: 'RSI exhaustion' },
  G15: { family: 'oscillator', label: 'Williams %R' },
  G16: { family: 'oscillator', label: 'CCI(20)' },
  G18: { family: 'oscillator', label: 'StochRSI' },
  G19: { family: 'oscillator', label: 'MACD hist' },
  G31: { family: 'oscillator', label: 'Bollinger %B' },
  G32: { family: 'oscillator', label: 'Stochastic K/D' },
  G35: { family: 'oscillator', label: 'RSI divergence' },

  G20: { family: 'flow', label: 'MFI(14)' },
  G21: { family: 'flow', label: 'CMF(20)' },
  G22: { family: 'flow', label: 'Elder Ray' },
  G23: { family: 'flow', label: 'OBV slope' },

  G11: { family: 'adx', label: 'ADX ≥25 + DI' },
  G12: { family: 'dxy', label: 'DXY anti-correlation' },
  G13: { family: 'rates', label: '10Y / real yield' },
  G26: { family: 'tsmom', label: 'TSMOM 30/90d' },
  G27: { family: 'cusum', label: 'CUSUM event alignment' },
  G28: { family: 'volregime', label: 'Vol regime known' },
  G29: { family: 'events', label: 'NFP / event window' },
  G30: { family: 'fix', label: 'London Fix / NY Close' },
  G37: { family: 'squeeze', label: 'Bollinger squeeze' },
};

export const HG_DEEP_FAMILY_ORDER = [
  'trend', 'oscillator', 'flow',
  'adx', 'dxy', 'rates', 'tsmom', 'cusum', 'volregime', 'events', 'fix', 'squeeze',
];

export const HG_DEEP_FAMILY_LABELS = {
  trend: 'TREND',
  oscillator: 'OSCILLATOR',
  flow: 'FLOW',
  adx: 'ADX',
  dxy: 'DXY',
  rates: 'RATES',
  tsmom: 'TSMOM',
  cusum: 'CUSUM',
  volregime: 'VOL REGIME',
  events: 'EVENTS',
  fix: 'FIX/CLOSE',
  squeeze: 'SQUEEZE',
};

export function hgGateFamilies() {
  return HG_DEEP_GATE_META;
}

export function hgDeepSwingGateIds() {
  return Object.keys(HG_DEEP_GATE_META);
}

function familyVerdict(members) {
  const scored = members.filter((m) => m.state !== 'na');
  if (!scored.length) return 'DARK';
  const passes = scored.filter((m) => m.state === 'pass');
  const vetoes = scored.filter((m) => m.state === 'veto');
  if (passes.length === scored.length) return 'AGREE';
  if (vetoes.length === scored.length) return 'OPPOSE';
  return 'SPLIT';
}

function dissenters(members) {
  const scored = members.filter((m) => m.state !== 'na');
  if (scored.length < 2) return [];
  const passN = scored.filter((m) => m.state === 'pass').length;
  const vetoN = scored.length - passN;
  const majorityPass = passN >= vetoN;
  return scored.filter((m) => (majorityPass ? m.state !== 'pass' : m.state !== 'veto'));
}

/**
 * @param {Array<[string,string,string,string]>} gateLedger
 */
export function hgFamilyRollup(gateLedger) {
  const byKey = {};
  for (let i = 0; i < gateLedger.length; i++) {
    const row = gateLedger[i];
    const id = row[0];
    const meta = HG_DEEP_GATE_META[id] || { family: id.toLowerCase(), label: row[1] };
    const fam = meta.family;
    if (!byKey[fam]) {
      byKey[fam] = { family: fam, label: HG_DEEP_FAMILY_LABELS[fam] || fam.toUpperCase(), members: [] };
    }
    byKey[fam].members.push({
      id,
      name: row[1],
      state: row[2],
      detail: row[3],
      speed: meta.speed || null,
      label: meta.label || row[1],
    });
  }

  const out = [];
  for (let j = 0; j < HG_DEEP_FAMILY_ORDER.length; j++) {
    const key = HG_DEEP_FAMILY_ORDER[j];
    const bucket = byKey[key];
    if (!bucket) continue;
    const members = bucket.members;
    const verdict = familyVerdict(members);
    const nPass = members.filter((m) => m.state === 'pass').length;
    const nVeto = members.filter((m) => m.state === 'veto').length;
    const nNa = members.filter((m) => m.state === 'na').length;
    const dissent = dissenters(members);
    const fastFlip = dissent.filter((d) => d.speed === 'fast');
    const slowFlip = dissent.filter((d) => d.speed === 'slow');
    out.push({
      family: key,
      label: bucket.label,
      verdict,
      nPass,
      nVeto,
      nNa,
      members,
      dissent,
      fastFlip,
      slowFlip,
    });
  }
  return out;
}

export function hgFamilyDissentLine(famRow) {
  if (!famRow || famRow.verdict !== 'SPLIT' || !famRow.dissent.length) return '';
  const names = famRow.dissent.map((d) => d.id + ' ' + d.label).join(', ');
  let tag = '';
  if (famRow.family === 'trend') {
    if (famRow.fastFlip.length && !famRow.slowFlip.length) tag = ' · fast members flipping';
    else if (famRow.slowFlip.length && !famRow.fastFlip.length) tag = ' · slow members flipping';
    else if (famRow.fastFlip.length && famRow.slowFlip.length) tag = ' · fast+slow dissent';
  }
  return 'dissent: ' + names + tag;
}
