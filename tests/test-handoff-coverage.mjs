/* HARDGATE — static coverage: tabs with book CTAs must wire trade handoff + stamps.
   Run: node tests/test-handoff-coverage.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
const ok = (cond, label) => {
  if (!cond) throw new Error('FAIL: ' + label);
  passed++;
  console.log('  ok —', label);
};

const bookFiles = [
  'carry.js', 'termbasis.js', 'goldpro.js', 'edge.js', 'brain.js', 'engine.js',
  'squeeze.js', 'meanrev.js', 'oiflow.js', 'liqs.js', 'goldscalp.js', 'goldswing.js',
  'goldpine.js', 'startradertab.js', 'trendtable.js', 'pine.js', 'setup-ui.js',
  'index.html', 'scripts/best-v9-inline.js'
];

console.log('== book + trade handoff coverage ==');
for (const f of bookFiles){
  const src = fs.readFileSync(root + f, 'utf8');
  if (src.indexOf('bookBtnHTML') >= 0 || src.indexOf('hgBookBtn') >= 0){
    ok(/hgToTradePlan|toTrade/.test(src), f + ' has trade handoff or legacy toTrade');
  }
  if (f !== 'book.js' && (src.indexOf('bookBtnHTML') >= 0 || src.indexOf('hgBookBtn') >= 0)){
    ok(/hgBookStampChip|hgSetupPanelHTML|hgSetupCardHead/.test(src) || f === 'scripts/best-v9-inline.js',
      f + ' uses slotted IN BOOK chip or setup-ui wrapper');
  }
}

const sw = fs.readFileSync(root + 'sw.js', 'utf8');
ok(/HG_CACHE\s*=\s*'hg-v\d+'/.test(sw), 'sw.js uses a versioned cache name hg-vN');

const brainJs = fs.readFileSync(root + 'brain.js', 'utf8');
ok(brainJs.indexOf('hgBrainInvAlertsFromRows') >= 0, 'brain.js fires invalidation after synthesis');
const bookJs = fs.readFileSync(root + 'book.js', 'utf8');
ok(bookJs.indexOf('hgBrainBookLayerRecord') >= 0, 'book.js records brain layer snapshot on ADD TO BOOK');
ok(fs.readFileSync(root + 'tabalerts.js', 'utf8').indexOf('hgBrainInvAlertsMaybeRun') >= 0,
  'tabalerts.js runs invalidation on 5-min cycle');

const swShell = fs.readFileSync(root + 'sw.js', 'utf8');
ok(swShell.indexOf("'./hghost.js'") >= 0, 'sw.js precaches hghost.js');
ok(swShell.indexOf("'./conviction-lock.js'") >= 0, 'sw.js precaches conviction-lock.js');
ok(swShell.indexOf("'./macro-feeds.js'") >= 0, 'sw.js precaches macro-feeds.js');

console.log('\n' + passed + ' passed');
