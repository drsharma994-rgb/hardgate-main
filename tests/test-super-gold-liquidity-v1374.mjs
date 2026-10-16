/* Liquidity map and the pre-fill knife check. Neither one moves the desk entry
   or invents an ATR. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code = fs.readFileSync(new URL('../super-gold.js', import.meta.url), 'utf8');
const win = {
  Date, Math, Number, String, Array, Object, Promise, setTimeout, clearTimeout,
  setInterval: () => 1, clearInterval: () => {},
  HG_tabs: [], HG_warmups: []
};
win.window = win; win.globalThis = win;
vm.createContext(win);
vm.runInContext(code, win);

const flat = Array.from({ length: 12 }, (_, i) => ({
  o: 2650, h: 2652, l: 2648, c: 2651
}));
flat[3] = { o: 2650, h: 2660.0, l: 2649, c: 2651 };
flat[4] = { o: 2651, h: 2654, l: 2649, c: 2652 };
flat[5] = { o: 2652, h: 2653, l: 2648, c: 2650 };
flat[8] = { o: 2650, h: 2660.2, l: 2649, c: 2651 };
flat[9] = { o: 2651, h: 2654, l: 2648, c: 2650 };
const map = win.sgSessionLiquidityMap(flat, 'long', 2651);
assert.equal(map.ok, true);
assert.ok(map.eqHighs.length >= 1, 'equal highs');
assert.equal(map.drawOnLiquidity.type, 'BSL_EQH');
assert.ok(Math.abs(map.equilibrium - ((map.rangeHigh + map.rangeLow) / 2)) < 0.02);
assert.ok(map.atr == null || map.atr !== 3.5 || map.atrUnread !== true);
assert.notEqual(map.zonePricing, 'UNREAD');
const unread = win.sgAdverseSelectionGuard({ dir: 'long' }, { unread: true }, {
  rows15: [
    { o: 2650, h: 2652, l: 2648, c: 2649 },
    { o: 2649, h: 2651, l: 2647, c: 2648 }
  ]
});
assert.equal(unread.status, 'UNREAD');
assert.equal(unread.approachVelocityAtr, null);

const knife = win.sgAdverseSelectionGuard({ dir: 'long' }, { atr: 4, unread: false }, {
  rows15: [
    { o: 2660, h: 2662, l: 2658, c: 2661 },
    { o: 2661, h: 2663, l: 2659, c: 2660 },
    { o: 2664, h: 2672, l: 2648, c: 2649 }
  ]
});
assert.equal(knife.status, 'KNIFE_HAZARD');
assert.ok(knife.approachVelocityAtr >= 1.75);
assert.equal(knife.executionMode, 'CONFIRMATION_CLOSE_ONLY');

const safe = win.sgAdverseSelectionGuard({ dir: 'long' }, { atr: 4, unread: false }, {
  rows15: [
    { o: 2650, h: 2653, l: 2649, c: 2652 },
    { o: 2652, h: 2654, l: 2651, c: 2653 },
    { o: 2653, h: 2655, l: 2652, c: 2654 }
  ]
});
assert.equal(safe.status, 'SAFE_LIMIT');
console.log('LIQUIDITY AND KNIFE GUARD PASSED', map.drawOnLiquidity.label, knife.approachVelocityAtr);
