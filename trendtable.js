/* HARDGATE trendtable loader. hg-v1200. */
(function () {
  var n = 12, acc = '', i = 0;
  function step() {
    if (i >= n) {
      try { (0, eval)(acc); }
      catch (e) { try { console.error('trendtable assemble', e); } catch (e2) {} }
      return;
    }
    fetch('trendtable-src-' + i + '.js?v=1200', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('trendtable part ' + i + ' ' + r.status);
      return r.text();
    }).then(function (t) { acc += t; i += 1; step(); }).catch(function (e) {
      try { console.error(e); } catch (e2) {}
    });
  }
  step();
})();
