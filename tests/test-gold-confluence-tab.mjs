import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../gold-confluence.js', import.meta.url), 'utf8');
const win = {
  Date, Math, Number, String, Array, Object, Promise, isFinite,
  HG_tabs: []
};
win.window = win;
win.globalThis = win;
vm.createContext(win);
vm.runInContext(code, win);

function row(entry, stop, t1, dir){
  return { dir: dir || 'long', entry: entry, stop: stop, t1: t1, grade: 'A' };
}

win.goldscalpScan = () => ({ cands: [row(2650, 2640, 2670)] });
win.goldswingScan = () => ({ cands: [row(2651, 2642, 2668)] });
win.superGoldScan = () => ({ cands: [row(2652, 2638, 2672)] });
win.hgGoldIuxAnchor = async () => ({ px: 2651.5, at: 1, src: 'gold-api' });

const votes = win.hgGoldConfluenceRead(win);
const built = win.hgGoldConfluenceBuild(votes, { px: 2651.5, src: 'gold-api' });
assert.equal(built.ready, true);
assert.equal(built.side, 'long');
assert.equal(built.entry, 2651);
assert.equal(built.stop, 2640);
assert.equal(built.t1, 2670);
assert.equal(built.mark, 2651.5);
assert.notEqual(built.entry, built.mark);
assert.ok(built.deskCount >= 3);

const scanned = await win.hgGoldConfluenceScan(win);
assert.equal(scanned.ready, true);
assert.equal(scanned.entry, 2651);

win.goldDirectionScan = () => ({ cands: [{ dir: 'short', entry: 2652, stop: 2662, t1: 2640, grade: 'A' }] });
const split = win.hgGoldConfluenceBuild(win.hgGoldConfluenceRead(win), { px: 2651.5 });
assert.equal(split.ready, false);
assert.equal(split.longCount, 3);
assert.equal(split.shortCount, 1);

const noPx = win.hgGoldConfluenceBuild(votes, null);
assert.equal(noPx.ready, false);
assert.match(noPx.reason, /not read/);

delete win.goldDirectionScan;
win.goldPineScan = () => ({ cands: [row(3000, 2900, 3200)] });
const far = win.hgGoldConfluenceBuild(win.hgGoldConfluenceRead(win), { px: 2651.5 });
assert.equal(far.ready, true);
assert.equal(far.entry, 2651);
assert.ok(far.offChart >= 1);
assert.notEqual(far.entry, 3000);

const two = win.hgGoldConfluenceBuild([
  { desk: 'GOLD SCALP', state: 'setup', side: 'long', entry: 2650, stop: 2640, t1: 2670 },
  { desk: 'GOLD SWING', state: 'setup', side: 'long', entry: 2651, stop: 2641, t1: 2671 }
], { px: 2650 });
assert.equal(two.ready, false);

const chased = win.hgGoldConfluenceBuild([
  { desk: 'A', state: 'setup', side: 'long', entry: 2650, stop: 2640, t1: 2652 },
  { desk: 'B', state: 'setup', side: 'long', entry: 2650.2, stop: 2640, t1: 2652 },
  { desk: 'C', state: 'setup', side: 'long', entry: 2650.4, stop: 2640, t1: 2652 }
], { px: 2651.8 });
assert.equal(chased.ready, false);
assert.notEqual(chased.entry, 2651.8);

const crown = win.hgGoldConfluenceRead(Object.assign({}, win, {
  goldscalpScan: () => ({
    bestId: 'keep',
    cands: [
      { id: 'keep', dir: 'long', entry: 2650, stop: 2640, t1: 2670 },
      { id: 'other', dir: 'short', entry: 2652, stop: 2662, t1: 2640 }
    ]
  })
}));
const scalp = crown.filter(v => v.id === 'goldscalp')[0];
assert.equal(scalp.state, 'setup');
assert.equal(scalp.side, 'long');

const one = win.hgGoldConfluenceBuild([
  { desk: 'GOLD SWING', state: 'setup', side: 'short', entry: 4174.4, stop: 4210.15, t1: 4120.78 }
], { px: 4174.2 });
assert.equal(one.ready, false);
assert.equal(one.shortCount, 1);
assert.match(one.reason, /1 gold desk published/);
assert.doesNotMatch(one.reason, /1 gold desks/);

const copied = win.hgGoldConfluenceBuild([
  { desk: 'GOLD SWING', state: 'setup', side: 'short', entry: 4174.4, stop: 4210.15, t1: 4120.78 },
  { desk: 'SUPER GOLD', state: 'setup', side: 'short', entry: 4174.4, stop: 4210.15, t1: 4120.78 },
  { desk: 'GOLD PINE', state: 'setup', side: 'short', entry: 4174.42, stop: 4210.16, t1: 4120.79 }
], { px: 4174 });
assert.equal(copied.ready, false);
assert.equal(copied.shortCount, 1);

const twoShort = win.hgGoldConfluenceBuild([
  { desk: 'GOLD SWING', state: 'setup', side: 'short', entry: 4174.4, stop: 4210.15, t1: 4120.78 },
  { desk: 'GOLD SCALP', state: 'setup', side: 'short', entry: 4170, stop: 4205, t1: 4110 }
], { px: 4174 });
assert.equal(twoShort.ready, false);
assert.equal(twoShort.shortCount, 2);

win.goldscalpScan = () => ({ cands: [], whySilent: 'no 15m setup' });
const silent = win.hgGoldConfluenceRead(win).filter(v => v.id === 'goldscalp')[0];
assert.equal(silent.state, 'none');
assert.match(silent.note, /no entry, stop, and target/);
assert.match(silent.note, /no 15m setup/);
win.goldDirectionScan = () => null;
const dir = win.hgGoldConfluenceRead(win).filter(v => v.id === 'golddirection')[0];
assert.equal(dir.state, 'unread');
assert.match(dir.note, /LONG or SHORT/);

const gw = {
  Date, Math, Number, String, Array, Object, Promise, isFinite,
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h),
  HG_tabs: [],
  HG_warmups: []
};
gw.window = gw;
gw.globalThis = gw;
vm.createContext(gw);
vm.runInContext(code, gw);
gw.goldscalpScan = () => ({ cands: [row(2650, 2640, 2670)] });
gw.goldswingScan = () => ({ cands: [row(2651, 2642, 2668)] });
gw.superGoldScan = () => ({ cands: [row(2652, 2638, 2672)] });
gw.goldPineScan = () => null;
gw.hgGoldIuxAnchor = async () => ({ px: 2651.5, at: 1, src: 'gold-api' });
let warmed = 0;
gw.HG_warmups.push({
  id: 'goldpine',
  run(){
    warmed += 1;
    gw.goldPineScan = () => ({ cands: [row(2653, 2641, 2674)] });
    return 'warmed';
  }
});
const gathered = await gw.hgGoldConfluenceScan(gw, { gather: true });
assert.equal(warmed, 1);
assert.equal(gathered.ready, true);
assert.equal(gathered.entry, 2651.5);
assert.equal(gathered.longCount, 4);
warmed = 0;
gw.goldPineScan = () => null;
await gw.hgGoldConfluenceScan(gw);
assert.equal(warmed, 0);
gw.crypto = { randomUUID: () => 'x' };
await gw.hgGoldConfluenceScan(gw, { gather: true });
assert.equal(warmed, 0);

/* A desk that only scans once its tab is open is opened and waited on.
   The button's click does not return the scan promise, so the wait is
   the published plan, not the click. */
const wait = {
  Date, Math, Number, String, Array, Object, Promise, isFinite,
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h),
  HG_tabs: [],
  HG_warmups: []
};
wait.window = wait;
wait.globalThis = wait;
const nodes = {};
wait.document = {
  body: { appendChild(n){ nodes[n.id] = n; return n; } },
  getElementById(id){ return nodes[id] || null; },
  createElement(){ return { id: '', querySelector(){ return null; } }; }
};
vm.createContext(wait);
vm.runInContext(code, wait);
wait.goldscalpScan = () => ({ cands: [row(2650, 2640, 2670)] });
wait.goldswingScan = () => ({ cands: [row(2651, 2642, 2668)] });
wait.superGoldScan = () => ({ cands: [row(2652, 2638, 2672)] });
wait.hgGoldIuxAnchor = async () => ({ px: 2651.5, at: 1, src: 'gold-api' });
let og = null;
let opened = 0;
let clicks = 0;
wait.hgOgState = () => og;
wait.HG_tabs.push({
  id: 'omnigold',
  mount(pane){
    opened += 1;
    const btn = {
      disabled: false,
      click(){
        clicks += 1;
        this.disabled = true;
        const self = this;
        globalThis.setTimeout(function(){
          og = { cands: [row(2649, 2639, 2669)] };
          self.disabled = false;
        }, 40);
      }
    };
    pane.querySelector = (sel) => (sel === '#ogRun' ? btn : null);
  }
});
const waited = await wait.hgGoldConfluenceScan(wait, { gather: true });
assert.equal(opened, 1);
assert.equal(clicks, 1);
assert.equal(waited.ready, true);
assert.equal(waited.longCount, 4);
assert.equal(waited.entry, 2650.5);
const again = await wait.hgGoldConfluenceScan(wait, { gather: true });
assert.equal(opened, 1);
assert.equal(clicks, 1);
assert.equal(again.ready, true);
wait.crypto = { randomUUID: () => 'x' };
og = null;
await wait.hgGoldConfluenceScan(wait, { gather: true });
assert.equal(opened, 1);
assert.equal(clicks, 1);

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
assert.match(index, /gold-confluence\.js\?v=/);
assert.match(index, /tabs:\['gold-confluence'/);
assert.match(sw, /\.\/gold-confluence\.js/);

console.log('GOLD CONFLUENCE TAB PASSED', built.entry, built.stop, built.t1);
