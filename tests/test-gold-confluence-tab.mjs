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

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
assert.match(index, /gold-confluence\.js\?v=/);
assert.match(index, /tabs:\['gold-confluence'/);
assert.match(sw, /\.\/gold-confluence\.js/);

console.log('GOLD CONFLUENCE TAB PASSED', built.entry, built.stop, built.t1);
