/* HARDGATE trendtable loader. BATCH 1135.
   The desk source is stored as trendtable-src-N.js because a single
   commit of the full file was truncated. Indirect eval keeps the
   classic-script globals (HG_tabs, trendScore) on window. */
(function () {
  var n = 12;
  var acc = '';
  var i = 0;
  function step() {
    if (i >= n) {
      try { (0, eval)(acc); }
      catch (e) { try { console.error('trendtable assemble', e); } catch (e2) {} }
      return;
    }
    var url = 'trendtable-src-' + i + '.js?v=1135';
    fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('trendtable part ' + i + ' ' + r.status);
      return r.text();
    }).then(function (t) {
      acc += t;
      i += 1;
      step();
    }).catch(function (e) {
      try { console.error(e); } catch (e2) {} });
  }
  step();
})();
