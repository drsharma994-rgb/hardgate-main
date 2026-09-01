/* HARDGATE — OMNIPRESENT must not throw away a finished scan.

   Same contract as test-omniroute-keep-results.mjs: a tab-switch auto-scan or
   hardRefreshAll must not blank the desk mid-rescan, and a failed rescan must
   restore the last cards with the error named.

   Run: node tests/test-omnipresent-keep-results.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SRC = read('omnipresent.js');
const HTML = read('index.html');

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error, TypeError,
                setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  const store = {};
  ctx.localStorage = { getItem: k => (k in store ? store[k] : null),
                       setItem(k, v){ store[k] = String(v); }, removeItem(k){ delete store[k]; } };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
    addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }), getElementById:()=>null,
    querySelector:()=>null, querySelectorAll:()=>[], head:{appendChild(){}}, body:{appendChild(){}},
    documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
                   'hg-forward.js','hg-gates.js','hg-plan.js','omniroute.js','omnipresent.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

function tape(seed){
  const out = []; let p = 40 + seed, s = seed * 7919 + 3;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < 181; i++){
    p = p * (1 + ((rnd() - 0.44)) * 0.006);
    const r = p * 0.004 * (0.5 + rnd());
    out.push({ t: 1700000000 + i * 3600, o: p - r * 0.3, h: p + r, l: p - r, c: p, v: 900 + rnd() * 300 });
  }
  return out;
}

function mkEl(){ return { innerHTML: '', textContent: '', disabled: false,
  style: {}, addEventListener(){}, appendChild(){} }; }

console.log('== source: rescan must not blank a live desk ==');
{
  ok(!/ui\.cards\.innerHTML = '';/.test(SRC)
     || /lastCardsHtml|keeping last|previous results/.test(SRC),
     'runScan no longer blindly blanks the cards, or it restores the last paint');
  ok(/lastCardsHtml|opKeepLast|keeping last scan/.test(SRC),
     'a last-paint snapshot is kept so a failed rescan can put the cards back');
  ok(/OP_FRESH_MS/.test(SRC), 'freshness skip window is defined');
  ok(/value-area edges/.test(SRC) && !/volume POC/.test(SRC.split('mountOmnipresent')[1] || ''),
     'mount copy names value-area edges, not volume POC');
}

console.log('\n== source: auto-scan goes through refresh(), not a raw RUN click ==');
{
  const auto = HTML.slice(HTML.indexOf('const HG_TAB_AUTO_SCAN'), HTML.indexOf('const HG_SCAN_RUN_BTN'));
  const block = auto.slice(auto.indexOf('omnipresent:'), auto.indexOf('omnigold:'));
  ok(/mod\.refresh|HG_TAB_MODS\.omnipresent/.test(block)
     && /refresh\(/.test(block),
     'tab-open / hardRefreshAll uses refreshOmnipresent, which can skip when busy or fresh');
  const ogBlock = auto.slice(auto.indexOf('omnigold:'), auto.indexOf('omnibtc:'));
  ok(/mod\.refresh|HG_TAB_MODS\.omnigold/.test(ogBlock),
     'omnigold auto-scan goes through refreshOmnigold');
}

console.log('\n== a failed rescan keeps the last cards and names the error ==');
const W = boot();
const UNI = [];
for (let i = 0; i < 12; i++) UNI.push({ sym: 'TK' + i + 'USD', base: 'TK' + i, exchange: 'delta' });

let uniCalls = 0;
W.xuUniverse = () => {
  uniCalls++;
  if (uniCalls === 1) return Promise.resolve(UNI);
  return Promise.reject(new Error('venue down on rescan'));
};
W.xuCandles = (item) => Promise.resolve(tape(1 + Number(item.base.slice(2))));

const stat = mkEl();
const warn = mkEl();
const x20 = mkEl();
const side = mkEl();
const ui = { btn: mkEl(), stat, warn, cards: mkEl(), x20, side };

await W.hgOpRunScan(ui);
const firstHtml = ui.cards.innerHTML;
const firstStat = String(stat.textContent || '');
ok(firstHtml.length > 0, 'first scan painted cards');
ok(/zone\(s\)|scanned|contracts/i.test(firstStat), 'first scan reported status: "' + firstStat.slice(0, 80) + '"');

await W.hgOpRunScan(ui);
const afterHtml = ui.cards.innerHTML;
const afterStat = String(stat.textContent || '');
const afterWarn = String(warn.textContent || '');
ok(afterHtml.length > 0, 'rescan failure did not leave the desk empty');
ok(/venue down|failed|keeping last|last scan|rescan/i.test(afterStat + ' ' + afterWarn),
   'the error is named without discarding the scan');

console.log('\n== refresh skips a first-time sweep and a fresh desk ==');
{
  const W2 = boot();
  const tab = (W2.HG_tabs || []).filter(t => t.id === 'omnipresent')[0];
  ok(tab && typeof tab.refresh === 'function', 'omnipresent registers refresh');
  const st = await tab.refresh();
  ok(String(st).indexOf('skip') === 0, 'refresh before any run skips the universe sweep (got "' + st + '")');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL OMNIPRESENT KEEP-RESULTS TESTS PASSED');
