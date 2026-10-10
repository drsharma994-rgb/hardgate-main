/**
 * HARDGATE quant desk boot: alert settings, macro lock, chime, journal, size.
 * One Binance socket. No exchange keys.
 */
(function (root) {
  'use strict';
  function read(key){ try { return localStorage.getItem(key) || ''; } catch (e) { return ''; } }
  function write(key, value){ try { localStorage.setItem(key, value); } catch (e) {} }

  var alerts = new root.HG_AlertDispatcher();
  var audio = new root.HG_AudioAnnunciator();
  var calendar = new root.HG_MacroCalendar();
  var journal = new root.HG_JournalDB();
  var clusters = new root.HG_LiqClusterEstimator();
  root.HG_alerts = alerts;
  root.HG_audio = audio;
  root.HG_calendar = calendar;
  root.HG_journal = journal;
  root.HG_liq = clusters;

  root.hgMacroEventLock = function(now){
    try { return calendar.checkBlackout(now); }
    /* A fault here used to return the CLEAN path's exact shape —
       `{ veto: false, evidence: 'Macro economic window clean' }` — so a dead
       calendar was indistinguishable from a genuinely clear window, and both
       consumers (formation-patch.js:137, gold-core-engine.js:572) only test
       `lock.veto`. The lock still fails OPEN (a data outage must not halt
       trading), but it no longer claims to have CHECKED: the `unchecked` marker
       is the same one hgNewsRisk uses, and the evidence line says what actually
       happened instead of asserting the window is clean. */
    catch (e) { return { veto: false, unchecked: true, evidence: 'Macro calendar unread — not checked, not clean' }; }
  };

  root.HG_riskLine = function(setup){
    var eq = parseFloat(read('HG_EQUITY'));
    var pct = parseFloat(read('HG_RISK_PCT'));
    if (!(eq > 0) || !setup) return '';
    var sized = new root.HG_RiskAllocator(eq, (pct > 0 ? pct / 100 : 0.01)).calculateSize(
      +setup.entryPrice, +setup.stopLoss, +(setup.targetPrice || setup.takeProfit));
    if (!sized) return '';
    return '<div class="note">Size ' + sized.positionQty + ' · risk $' + sized.riskCapital
      + ' · notional $' + sized.notionalUsd + ' · ' + sized.netRR + 'R net of fees. Not an order.</div>';
  };

  root.HG_quantEmit = function(setup){
    if (!setup || setup.status !== 'ARMED') return;
    root.__hgLastArmed = setup;
    try { alerts.dispatchArmedSetup(setup); } catch (e1) {}
    try { audio.playArmedChime(); } catch (e2) {}
    try {
      if (audio.voiceEnabled){
        audio.speak((setup.symbol || 'Market') + ' ' + (setup.direction || '') + ' armed at ' + setup.entryPrice);
      }
    } catch (e3) {}
    try { journal.recordSetup(setup); } catch (e4) {}
  };

  function bootSocket(){
    if (root.__hgWs || typeof root.HG_WsMultiplex !== 'function') return;
    if (typeof WebSocket === 'undefined') return;
    root.__hgWs = new root.HG_WsMultiplex();
    root.__hgWs.connect();
  }

  function field(id, label, type, value){
    return '<label class="note" style="display:block;margin-top:6px">' + label
      + '<input id="' + id + '" type="' + type + '" value="' + String(value).replace(/"/g, '"')
      + '" style="display:block;width:100%;margin-top:2px;background:#0e1218;color:#d5dbe3;border:1px solid #2a3340;padding:4px"></label>';
  }

  function mountPanel(){
    if (typeof document === 'undefined' || document.getElementById('hgQuantPanel')) return;
    var host = document.getElementById('headerDrawer') || document.body;
    var wrap = document.createElement('div');
    wrap.innerHTML = '<button type="button" class="statuschip header-action" id="hgQuantBtn">QUANT</button>'
      + '<div id="hgQuantPanel" class="panel" style="display:none;margin:8px 0;padding:8px">'
      + '<b>ARMED alerts</b>'
      + '<div class="note">Telegram and Discord fire only while this tab is open, and only when a setup is ARMED. The token stays in this browser. Exchange keys are not stored and no order is sent.</div>'
      + field('hgTgToken', 'Telegram bot token', 'password', read('HG_TG_TOKEN'))
      + field('hgTgChat', 'Telegram chat id', 'text', read('HG_TG_CHAT_ID'))
      + field('hgDiscord', 'Discord webhook', 'password', read('HG_DISCORD_WEBHOOK'))
      + field('hgEquity', 'Equity (USD) for the size line', 'number', read('HG_EQUITY'))
      + field('hgRiskPct', 'Risk percent', 'number', read('HG_RISK_PCT') || '1')
      + '<label class="note" style="display:block;margin-top:6px"><input id="hgAlertOn" type="checkbox"' + (read('HG_ALERTS_ENABLED') === 'true' ? ' checked' : '') + '> Alerts on</label>'
      + '<label class="note" style="display:block"><input id="hgAudioOn" type="checkbox"' + (read('HG_AUDIO_ENABLED') === 'true' ? ' checked' : '') + '> Chime</label>'
      + '<label class="note" style="display:block"><input id="hgVoiceOn" type="checkbox"' + (read('HG_VOICE_ENABLED') === 'true' ? ' checked' : '') + '> Voice</label>'
      + '<div class="row" style="margin-top:8px"><button type="button" class="btn" id="hgQuantSave">SAVE</button> <button type="button" class="btn" id="hgQuantTest">TEST ALERT</button></div>'
      + '<div class="note" id="hgQuantStat"></div>'
      + '</div>';
    host.appendChild(wrap);
    var panel = document.getElementById('hgQuantPanel');
    document.getElementById('hgQuantBtn').addEventListener('click', function(){
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
    document.getElementById('hgQuantSave').addEventListener('click', function(){
      alerts.saveConfig({
        telegramToken: document.getElementById('hgTgToken').value.trim(),
        telegramChatId: document.getElementById('hgTgChat').value.trim(),
        discordWebhook: document.getElementById('hgDiscord').value.trim(),
        enabled: document.getElementById('hgAlertOn').checked
      });
      write('HG_EQUITY', document.getElementById('hgEquity').value.trim());
      write('HG_RISK_PCT', document.getElementById('hgRiskPct').value.trim());
      write('HG_AUDIO_ENABLED', document.getElementById('hgAudioOn').checked ? 'true' : 'false');
      write('HG_VOICE_ENABLED', document.getElementById('hgVoiceOn').checked ? 'true' : 'false');
      audio.enabled = document.getElementById('hgAudioOn').checked;
      audio.voiceEnabled = document.getElementById('hgVoiceOn').checked;
      document.getElementById('hgQuantStat').textContent = 'Saved in this browser.';
    });
    document.getElementById('hgQuantTest').addEventListener('click', function(){
      document.getElementById('hgQuantSave').click();
      alerts.dispatchArmedSetup({
        status: 'ARMED', symbol: 'XAUUSD', timeframe: 'TEST', direction: 'BULL',
        entryPrice: 0, stopLoss: 0, targetPrice: 0, netRR: 0, gatesPassed: 0, totalGates: 0, type: 'TEST'
      });
      document.getElementById('hgQuantStat').textContent = alerts.getConfig().enabled
        ? 'Test sent if the token and chat id are valid.'
        : 'Alerts are off. Turn them on and save.';
    });
  }

  if (typeof document !== 'undefined'){
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountPanel);
    else mountPanel();
  }
  calendar.refreshEvents();
  setInterval(function(){ calendar.refreshEvents(); }, 30 * 60 * 1000);
  bootSocket();
})(typeof globalThis !== 'undefined' ? globalThis : this);
