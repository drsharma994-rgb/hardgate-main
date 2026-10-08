/**
 * HARDGATE annunciator. Off until the QUANT panel turns it on.
 * No sound files: Web Audio for the chime, speech only if voice is on.
 */
(function (root) {
  'use strict';
  function read(key){
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function AudioAnnunciator(){
    this.ctx = null;
    this.enabled = read('HG_AUDIO_ENABLED') === 'true';
    this.voiceEnabled = read('HG_VOICE_ENABLED') === 'true';
  }
  AudioAnnunciator.prototype.initContext = function(){
    if (!this.ctx && typeof window !== 'undefined'){
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  };
  AudioAnnunciator.prototype.playArmedChime = function(){
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;
    var now = this.ctx.currentTime;
    var osc1 = this.ctx.createOscillator(), gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1); gain1.connect(this.ctx.destination);
    osc1.start(now); osc1.stop(now + 0.35);
    var osc2 = this.ctx.createOscillator(), gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1320, now + 0.12);
    gain2.gain.setValueAtTime(0.3, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2); gain2.connect(this.ctx.destination);
    osc2.start(now + 0.12); osc2.stop(now + 0.55);
  };
  AudioAnnunciator.prototype.playVetoThud = function(){
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;
    var now = this.ctx.currentTime;
    var osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.25);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(now); osc.stop(now + 0.25);
  };
  AudioAnnunciator.prototype.speak = function(text){
    if (!this.voiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    var utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  };
  root.HG_AudioAnnunciator = AudioAnnunciator;
})(typeof globalThis !== 'undefined' ? globalThis : this);
