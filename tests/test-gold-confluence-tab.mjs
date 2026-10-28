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
win.ganeshGoldState = () => ({ plan: { dir: 'long', entry: 2652, stop: 2638, t1: 2672, grade: 'A' } });
win.superGoldScan = () => ({ cands: [row(2650, 2641, 2670)] });
win.hgGoldIuxAnchor = async () => ({ px: 2651.5, at: 1, src: 'gold-api' });

const votes = win.hgGoldConfluenceRead(win);
/* hg-v1393: upstream's hg-v1391 ready gate requires netR>=1.20R after
   measured spread; a build with no cost arg leaves netRr null and ready
   false (correct hg-v966-compliant tightening). Pass a measured cost to
   earn ready. The without-spread case is asserted separately below. */
const built = win.hgGoldConfluenceBuild(votes, { px: 2651.5, src: 'gold-api' }, { spreadUsd: 0.30 });
assert.equal(built.ready, true);
assert.equal(built.side, 'long');
assert.equal(built.entry, 2651);
assert.equal(built.stop, 2640);
assert.equal(built.t1, 2670);
assert.equal(built.mark, 2651.5);
assert.notEqual(built.entry, built.mark);
assert.equal(built.longCount, 3);
assert.ok(built.deskCount >= 3);
assert.ok(built.desks.indexOf('SUPER GOLD') < 0);
const supVote = built.votes.filter(v => v.id === 'super-gold')[0];
assert.equal(supVote.derived, true);
assert.equal(supVote.echo, true);
assert.equal(supVote.sameAs, 'GOLD SCALP');
/* An unread venue spread is named. It does not by itself stand the plan aside. */
const noSpread = win.hgGoldConfluenceBuild(votes, { px: 2651.5, src: 'gold-api' });
assert.equal(noSpread.ready, true);
assert.equal(noSpread.watch, undefined);
assert.match(noSpread.reason, /spread was not read/);

const rec = [];
win.hgFwdRecordScan = (tab, tf, cands) => { rec.push({ tab, tf, cands }); return 1; };
/* hg-v1393: scan path reads measuredSpread from goldspotState; stub it. */
win.goldspotState = () => ({ spot: 2651.5, xm: 2651.2 });
const scanned = await win.hgGoldConfluenceScan(win);
assert.equal(scanned.ready, true);
assert.equal(scanned.entry, 2651);
assert.equal(rec.length, 1);
assert.equal(rec[0].tab, 'CONFLUENCE');
assert.equal(rec[0].tf, '15m');
assert.equal(rec[0].cands[0].dir, 'long');
assert.equal(rec[0].cands[0].entry, 2651);
assert.equal(rec[0].cands[0].ticket, true);
await win.hgGoldConfluenceScan(win);
assert.equal(rec.length, 1);

win.goldDirectionScan = () => ({ cands: [{ dir: 'short', entry: 2652, stop: 2662, t1: 2640, grade: 'A' }] });
const split = win.hgGoldConfluenceBuild(win.hgGoldConfluenceRead(win), { px: 2651.5 });
assert.equal(split.ready, false);
assert.equal(split.longCount, 3);
assert.equal(split.shortCount, 1);
/* hg-v1393: hg-v1391 widened attachWatch so a dominant-side longs+shorts
   split now paints a WATCH naming the dominant side. The pre-pack
   `split.watch === undefined` assertion was the behaviour this pack
   explicitly changed. */
assert.ok(split.watch, 'desks-disagree split now carries a WATCH (hg-v1391)');
assert.equal(split.watch.reason, 'desks disagree');
assert.match(split.watch.label, /DESKS DISAGREE/);

const noPx = win.hgGoldConfluenceBuild(votes, null);
assert.equal(noPx.ready, false);
assert.match(noPx.reason, /not read/);

delete win.goldDirectionScan;
win.goldPineScan = () => ({ cands: [row(3000, 2900, 3200)] });
/* hg-v1393: a far pine that is off-scale from IUX now paints an
   OFF-SCALE watch (hg-v1391 widening). Without a spread, netR cannot
   compute, so ready remains false even on-scale — but the median entry
   is still the median of the on-scale cluster, not the far outlier. */
const far = win.hgGoldConfluenceBuild(win.hgGoldConfluenceRead(win), { px: 2651.5 }, { spreadUsd: 0.30 });
assert.equal(far.ready, true, 'with cluster + spread, far pine is excluded from on-scale and ready stays true');
assert.equal(far.entry, 2651);
assert.ok(far.offChart >= 1);
assert.notEqual(far.entry, 3000);

const two = win.hgGoldConfluenceBuild([
  { desk: 'GOLD SCALP', state: 'setup', side: 'long', entry: 2650, stop: 2640, t1: 2670 },
  { desk: 'GOLD SWING', state: 'setup', side: 'long', entry: 2651, stop: 2641, t1: 2671 }
], { px: 2650 });
assert.equal(two.ready, false);
assert.equal(two.watch.count, 2);
assert.equal(two.watch.entry, 2650.5);
assert.notEqual(two.watch.entry, 2650);
assert.equal(two.ready, false);
assert.equal(two.watch.reads['cf:familyShort'], undefined);
assert.equal(two.watch.reads['cf:synthetic'], true);
assert.equal(two.watch.reads['cf:spreadUnread'], true);
assert.equal(two.watch.reads['cf:sessionSplit'], undefined);

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
assert.equal(one.watch.count, 1);
assert.equal(one.watch.side, 'short');
assert.equal(one.watch.entry, 4174.4);
assert.equal(one.watch.stop, 4210.15);
assert.equal(one.watch.t1, 4120.78);
assert.notEqual(one.watch.entry, 4174.2);
assert.match(one.reason, /WATCH 1 of 3/);

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

win.goldscalpScan = () => ({ cands: [{ dir: 'long', entry: 2650, stop: 2640, t1: 2670 }] });
const bare = win.hgGoldConfluenceRead(win).filter(v => v.id === 'goldscalp')[0];
assert.equal(bare.state, 'none');
assert.match(bare.note, /did not crown/);
win.goldscalpScan = () => ({ cands: [{ dir: 'long', entry: 2650, stop: 2640, t1: 2670, grade: 'B' }] });
const bee = win.hgGoldConfluenceRead(win).filter(v => v.id === 'goldscalp')[0];
assert.equal(bee.state, 'none');
assert.match(bee.note, /did not crown/);

const cheap = win.hgGoldConfluenceBuild(votes, { px: 2651.5 }, { spreadUsd: 0.22 });
assert.equal(cheap.ready, true);
assert.ok(cheap.netRr >= 1);
assert.match(cheap.reason, /Measured spread/);
const wide = win.hgGoldConfluenceBuild(votes, { px: 2651.5 }, { spreadUsd: 20 });
assert.equal(wide.ready, false);
assert.equal(wide.entry, 2651);
assert.ok(wide.netRr < 1);
assert.match(wide.reason, /under 1R/);
assert.match(wide.reason, /not a setup/);

/* hg-v1393: upstream's hg-v1391 ready gate reads vote.grade/lead for the
   crowned filter and needs a measured spread for netRr. Pass both. */
const milli = win.hgGoldConfluenceBuild([
  { id: 'omnigold', desk: 'OMNIGOLD', state: 'setup', side: 'long', entry: 2650, stop: 2640, t1: 2670, grade: 'A' },
  { id: 'milligold', desk: 'MILLI GOLD', state: 'setup', side: 'long', entry: 2650, stop: 2641, t1: 2670, grade: 'A' },
  { id: 'goldscalp', desk: 'GOLD SCALP', state: 'setup', side: 'long', entry: 2651, stop: 2642, t1: 2668, grade: 'A' },
  { id: 'goldswing', desk: 'GOLD SWING', state: 'setup', side: 'long', entry: 2652, stop: 2638, t1: 2672, grade: 'A' }
], { px: 2651 }, { spreadUsd: 0.30 });
assert.equal(milli.ready, true);
assert.equal(milli.longCount, 3);
assert.ok(milli.desks.indexOf('MILLI GOLD') < 0);
const milliVote = milli.votes.filter(v => v.id === 'milligold')[0];
assert.equal(milliVote.derived, true);
assert.equal(milliVote.sameAs, 'OMNIGOLD');

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
/* hg-v1393: scan path reads measuredSpread from goldspotState; stub it. */
gw.goldspotState = () => ({ spot: 2651.5, xm: 2651.2 });
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
assert.equal(gathered.entry, 2651);
assert.equal(gathered.longCount, 3);
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
/* hg-v1393: scan reads measuredSpread from goldspotState (hg-v1391 ready). */
wait.goldspotState = () => ({ spot: 2651.5, xm: 2651.2 });
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
assert.equal(waited.longCount, 3);
assert.equal(waited.entry, 2650);
const again = await wait.hgGoldConfluenceScan(wait, { gather: true });
assert.equal(opened, 1);
assert.equal(clicks, 1);
assert.equal(again.ready, true);
wait.crypto = { randomUUID: () => 'x' };
og = null;
await wait.hgGoldConfluenceScan(wait, { gather: true });
assert.equal(opened, 1);
assert.equal(clicks, 1);

const ultra = win.hgGoldConfluenceRead({
  goldUltraState: () => ({
    fire: false,
    recordOnly: true,
    setups: { pick: { dir: 'long', entry: 2650, stop: 2640, t1: 2670 } }
  })
}).filter(v => v.id === 'goldultra')[0];
assert.equal(ultra.state, 'setup');
assert.equal(ultra.side, 'long');

const pineLead = win.hgGoldConfluenceRead({
  goldPineScan: () => ({
    swing: [{ dir: 'short', entry: 4174.4, stop: 4210.15, t1: 4120.78, grade: 'B' }],
    scalp: []
  })
}).filter(v => v.id === 'goldpine')[0];
assert.equal(pineLead.state, 'setup');
assert.equal(pineLead.side, 'short');
assert.equal(pineLead.entry, 4174.4);

const alone = win.hgGoldConfluenceBuild([
  { id: 'super-gold', desk: 'SUPER GOLD', state: 'setup', side: 'long', entry: 2650, stop: 2640, t1: 2670, grade: 'A', lead: true },
  { id: 'goldpine', desk: 'GOLD PINE', state: 'setup', side: 'long', entry: 2651, stop: 2641, t1: 2671, grade: 'A', lead: true },
  { id: 'ganeshgold', desk: 'GANESH GOLD', state: 'setup', side: 'long', entry: 2652, stop: 2638, t1: 2672, grade: 'A', lead: true }
], { px: 2651 });
assert.equal(alone.ready, true);
assert.equal(alone.longCount, 3);
assert.ok(alone.desks.indexOf('SUPER GOLD') >= 0);

win.goldscalpScan = () => ({ cands: [row(2650, 2640, 2670)] });
win.goldswingScan = () => ({ cands: [row(2651, 2642, 2668)] });
win.ganeshGoldState = () => ({ plan: { dir: 'long', entry: 2652, stop: 2638, t1: 2672, grade: 'A' } });
win.superGoldScan = () => ({ cands: [row(2650, 2641, 2670)] });
const liveAnchor = win.hgGoldIuxAnchor;
win.hgGoldIuxAnchor = async () => null;
win.hgGoldIuxAnchorCached = () => ({ px: 2651.5, at: 1, src: 'gold-api' });
const fromCache = await win.hgGoldConfluenceScan(win);
assert.equal(fromCache.ready, true);
assert.equal(fromCache.mark, 2651.5);
win.hgGoldIuxAnchor = liveAnchor;

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
assert.match(index, /gold-confluence\.js\?v=/);
assert.match(index, /tabs:\['gold-confluence'/);
assert.match(sw, /\.\/gold-confluence\.js/);

console.log('GOLD CONFLUENCE TAB PASSED', built.entry, built.stop, built.t1);
