/* HARDGATE — formation lab tab + bridges. Run: node tests/test-formation-lab.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const ctx = {
  console, Math, Date, isFinite, parseFloat, JSON, Array, Object, Number, String, Promise,
  localStorage: { _m: {}, getItem(k){ return this._m[k] || null; }, setItem(k,v){ this._m[k]=v; } },
  HG_tabs: [],
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);

for (const f of [
  'indicators.js', 'indicators2.js', 'plans.js', 'scorecard.js', 'formation.js',
  'meta-label.js', 'tear-sheet.js', 'purged-cv.js', 'agent-debate.js',
  'gate-replay-oos.js', 'cryptogates.js', 'walkforward-ui.js', 'formation-lab.js',
]) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const W = ctx;

console.log('== formation lab exports ==');
{
  ok(typeof W.hgMetaLabel === 'function', 'hgMetaLabel');
  ok(typeof W.hgTearSheet === 'function', 'hgTearSheet');
  ok(typeof W.hgAgentDebate === 'function', 'hgAgentDebate');
  ok(typeof W.hgReplaySweepPurged === 'function', 'hgReplaySweepPurged');
  const tab = (W.HG_tabs || []).find(t => t.id === 'formationlab');
  ok(tab && typeof tab.mount === 'function', 'FORMATION LAB tab registered');
}

console.log('== tear sheet on empty ledger ==');
{
  const ts = W.hgTearSheet([]);
  ok(ts.ok === false, 'empty -> not ok');
}

console.log('== agent debate advisory ==');
{
  const d = W.hgAgentDebate({ sym: 'BTCUSDT', dir: 'long', formationScore: 72, rr: 2.5, tier: 'PRIME', clean7: true });
  ok(d.bull.length > 0, 'bull args');
  ok(d.bear.length > 0, 'bear args');
  ok(d.risk && d.risk.verdict, 'risk verdict');
}

console.log('== hgFormTicket stamps metaLabel when bridge loaded ==');
{
  function synthRows(n){
    const out = [];
    for (let i = 0; i < n; i++){
      const c = 100 + i * 0.15;
      out.push({ t: i * 14400, o: c, h: c + 0.4, l: c - 0.4, c, v: 1000 });
    }
    return out;
  }
  const rows = synthRows(120);
  const mark = rows[rows.length - 1].c;
  const hit = { dir: 'long', entry: mark, stop: mark - 4, t1: mark + 8, rr: 2, mark, planSrc: 'test' };
  const fm = W.hgFormTicket(hit, { rows, style: 'swing', a4: 1.2, skipPoi: true });
  ok(fm.ok === true, 'formation ok');
  ok(fm.metaLabel && typeof fm.metaLabel.prob === 'number', 'metaLabel on ticket');
}

console.log('\nPassed:', passed);
