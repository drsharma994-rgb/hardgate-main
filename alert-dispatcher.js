/**
 * HARDGATE Alert Dispatcher
 * Telegram and Discord when a setup is ARMED. Credentials stay in this browser.
 */
(function (root) {
  'use strict';
  function read(key){
    try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
  }
  function write(key, value){
    try { localStorage.setItem(key, value); } catch (e) {}
  }
  function AlertDispatcher(){
    this.recentAlerts = new Map();
    this.throttleMs = 15 * 60 * 1000;
  }
  AlertDispatcher.prototype.getConfig = function(){
    return {
      telegramToken: read('HG_TG_TOKEN'),
      telegramChatId: read('HG_TG_CHAT_ID'),
      discordWebhook: read('HG_DISCORD_WEBHOOK'),
      enabled: read('HG_ALERTS_ENABLED') === 'true'
    };
  };
  AlertDispatcher.prototype.saveConfig = function(cfg){
    cfg = cfg || {};
    if (cfg.telegramToken !== undefined) write('HG_TG_TOKEN', cfg.telegramToken);
    if (cfg.telegramChatId !== undefined) write('HG_TG_CHAT_ID', cfg.telegramChatId);
    if (cfg.discordWebhook !== undefined) write('HG_DISCORD_WEBHOOK', cfg.discordWebhook);
    if (cfg.enabled !== undefined) write('HG_ALERTS_ENABLED', cfg.enabled ? 'true' : 'false');
  };
  AlertDispatcher.prototype.dispatchArmedSetup = function(setup){
    var cfg = this.getConfig();
    if (!cfg.enabled || !setup || setup.status !== 'ARMED') return;
    var alertKey = String(setup.symbol || '') + '_' + String(setup.direction || '') + '_' + String(setup.type || setup.status || '');
    var now = Date.now();
    if (this.recentAlerts.has(alertKey) && (now - this.recentAlerts.get(alertKey)) < this.throttleMs) return;
    this.recentAlerts.set(alertKey, now);
    var target = setup.targetPrice || setup.takeProfit;
    var rr = setup.netRR || setup.riskReward;
    var text = [
      'HARDGATE ARMED SETUP',
      'Symbol: ' + (setup.symbol || '—') + ' (' + (setup.timeframe || '—') + ')',
      'Direction: ' + (setup.direction || '—'),
      'Entry: ' + setup.entryPrice,
      'Stop: ' + setup.stopLoss,
      'Target: ' + target + (rr ? ' (' + rr + 'R)' : ''),
      'Gates: ' + (setup.gatesPassed != null ? setup.gatesPassed : '—') + '/' + (setup.totalGates != null ? setup.totalGates : '—'),
      'Time: ' + new Date().toUTCString()
    ].join('\n');
    if (cfg.telegramToken && cfg.telegramChatId) this.sendTelegram(cfg.telegramToken, cfg.telegramChatId, text);
    if (cfg.discordWebhook) this.sendDiscord(cfg.discordWebhook, setup);
  };
  AlertDispatcher.prototype.sendTelegram = function(token, chatId, text){
    if (!/^[0-9]+:[A-Za-z0-9_-]+$/.test(token) || !chatId) return;
    fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text })
    }).catch(function(){});
  };
  AlertDispatcher.prototype.sendDiscord = function(webhookUrl, setup){
    if (!/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(webhookUrl)) return;
    var bull = String(setup.direction || '').toUpperCase() === 'BULL' || String(setup.direction || '').toLowerCase() === 'long';
    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: 'ARMED ' + (setup.symbol || '') + ' ' + (setup.direction || ''),
          color: bull ? 3066993 : 15158332,
          fields: [
            { name: 'Entry', value: String(setup.entryPrice), inline: true },
            { name: 'Stop', value: String(setup.stopLoss), inline: true },
            { name: 'Target', value: String(setup.targetPrice || setup.takeProfit), inline: true }
          ],
          timestamp: new Date().toISOString()
        }]
      })
    }).catch(function(){});
  };
  root.HG_AlertDispatcher = AlertDispatcher;
})(typeof globalThis !== 'undefined' ? globalThis : this);
