/* HARDGATE — OMNIROUTE must not throw away a finished scan.

   Field report: the tab "scans and gives me setup but the setup disappears
   after 1 minute, there is a error".

   Two cooperating defects:

     1. runScan blanks #omniCards the instant a rescan starts
        (`ui.cards.innerHTML = ''`). A tab-switch auto-scan or the 5-min
        hardRefreshAll click of #omniRun therefore wipes the desk before
        the new universe has even loaded.

     2. A failed rescan (venue empty, render throw, proxy 429) then leaves
        that blank standing. The previous snapshot is still in __omni.snap
        but nothing paints it back. The reader sees "scan failed: …" on an
        empty desk.

   Contract: a completed scan stays on screen until a newer scan SUCCESSFULLY
   replaces it. Failures name themselves on the warn line and keep the last
   cards. Global auto-scan goes through refresh() so a busy/fresh desk is
   not kicked into a second full-universe sweep.

   Run: node tests/test-omniroute-keep-results.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SRC = read('omniroute.js');
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
                   'hg-forward.js','hg-gates.js','hg-plan.js','omniroute.js']){
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
    out.push({ t: 1700000000 + i * 14400, o: p - r * 0.3, h: p + r, l: p - r, c: p, v: 900 + rnd() * 300 });
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
  ok(/lastCardsHtml|keepLast|previous results still showing/.test(SRC),
     'a last-paint snapshot is kept so a failed rescan can put the cards back');
  ok(/lastMpHtml/.test(SRC), 'MOST PROBABLE panel is kept across remount / failed rescan');
}

console.log('\n== source: auto-scan goes through refresh(), not a raw RUN click ==');
{
  const auto = HTML.slice(HTML.indexOf('const HG_TAB_AUTO_SCAN'), HTML.indexOf('const HG_SCAN_RUN_BTN'));
  const block = auto.slice(auto.indexOf('omniroute:'), auto.indexOf('omnipresent:'));
  ok(/mod\.refresh|HG_TAB_MODS\.omniroute/.test(block)
     && /refresh\(/.test(block),
     'tab-open / hardRefreshAll uses refreshOmniroute, which can skip when busy or fresh');
  ok(!/runBtn\.click\(\)/.test(block)
     || /skip/.test(block),
     'a raw #omniRun click is only the first-run fallback, not every auto-scan');
}

console.log('\n== a failed rescan keeps the last cards and names the error ==');
const W = boot();
const UNI = [];
for (let i = 0; i < 18; i++) UNI.push({ sym: 'TK' + i + 'USD', base: 'TK' + i, exchange: 'delta' });

let uniCalls = 0;
W.xuUniverse = () => {
  uniCalls++;
  if (uniCalls === 1) return Promise.resolve(UNI);
  return Promise.reject(new Error('venue down on rescan'));
};
W.xuCandles = (item) => Promise.resolve(tape(1 + Number(item.base.slice(2))));
W.xuUniverseNote = () => null;

const stat = mkEl();
const warn = mkEl();
const ui = { btn: mkEl(), stat, warn, cards: mkEl(), pool: mkEl(), matrix: mkEl() };

await W.hgOmniRunScan(ui);
const firstHtml = ui.cards.innerHTML;
const firstStat = String(stat.textContent || '');
const nCards = (firstHtml.match(/<div class="card">/g) || []).length;
const nOverflow = (firstHtml.match(/class="dim"/g) || []).length;
ok(firstHtml.length > 0 && (nCards > 0 || nOverflow > 0 || /SUPER SOLID bar/.test(firstHtml)),
   'first scan painted the desk (' + nCards + ' card(s), ' + nOverflow + ' overflow line(s))');
ok(/setup\(s\)/.test(firstStat), 'first scan reported setups: "' + firstStat.slice(0, 80) + '"');

await W.hgOmniRunScan(ui);
const afterHtml = ui.cards.innerHTML;
const afterStat = String(stat.textContent || '');
const afterWarn = String(warn.textContent || '');
ok(afterHtml.length > 0, 'rescan failure did not leave the desk empty');
ok((afterHtml.match(/<div class="card">/g) || []).length > 0
   || (afterHtml.match(/class="dim"/g) || []).length > 0
   || /SUPER SOLID bar/.test(afterHtml),
   'the last paint is still in the DOM');
ok(/venue down|failed|keeping last|last scan|rescan/i.test(afterStat + ' ' + afterWarn),
   'the error is named without discarding the scan (stat="' + afterStat.slice(0, 90)
   + '" warn="' + afterWarn.slice(0, 90) + '")');

console.log('\n== refresh skips a first-time sweep and a busy desk ==');
{
  const W2 = boot();
  const tab = (W2.HG_tabs || []).filter(t => t.id === 'omniroute')[0];
  ok(tab && typeof tab.refresh === 'function', 'omniroute registers refresh');
  const st = await tab.refresh();
  ok(String(st).indexOf('skip') === 0, 'refresh before any run skips the universe sweep (got "' + st + '")');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL OMNIROUTE KEEP-RESULTS TESTS PASSED');
