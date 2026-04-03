/**
 * Sound Module — Independent sound system for Claude Island
 *
 * Usage:
 *   const sound = new IslandSound();
 *   sound.play('permission');
 *   sound.setVolume(0.5);
 *   sound.setEnabled(false);
 *
 * Uses Web Audio API to generate tones (no external files needed).
 * Custom sounds can be loaded from files.
 */

const DEFAULT_SOUNDS = {
  permission: { freq: [523, 659, 784], duration: 0.12, type: 'sine', gap: 0.08 },      // C-E-G ascending chime
  complete:   { freq: [784, 988, 1175], duration: 0.1, type: 'sine', gap: 0.06 },       // G-B-D happy ding
  error:      { freq: [440, 349], duration: 0.15, type: 'square', gap: 0.1 },           // A-F descending buzz
  notify:     { freq: [659], duration: 0.08, type: 'sine', gap: 0 },                    // E single ping
  click:      { freq: [1000], duration: 0.03, type: 'sine', gap: 0 },                   // Quick tap
};

class IslandSound {
  constructor(config) {
    this.enabled = config?.enabled !== false;
    this.volume = config?.volume ?? 0.3;
    this.customSounds = config?.customSounds || {};
    this.audioCtx = null;
  }

  _getCtx() {
    if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return this.audioCtx;
  }

  setEnabled(v) { this.enabled = v; }
  setVolume(v) { this.volume = Math.max(0, Math.min(1, v)); }

  // Play a built-in or custom sound
  play(name) {
    if (!this.enabled) return;

    // Custom sound file?
    if (this.customSounds[name]) {
      this._playFile(this.customSounds[name]);
      return;
    }

    // Built-in synthesized sound
    var def = DEFAULT_SOUNDS[name];
    if (!def) return;

    var ctx = this._getCtx();
    var now = ctx.currentTime;

    def.freq.forEach(function(freq, i) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = def.type;
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(this.volume * 0.3, now);
      gain.gain.linearRampToValueAtTime(this.volume, now + 0.01);

      var start = now + i * (def.duration + def.gap);
      gain.gain.setValueAtTime(this.volume, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + def.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + def.duration + 0.05);
    }.bind(this));
  }

  // Play from audio file (URL or path)
  _playFile(src) {
    var audio = new Audio(src);
    audio.volume = this.volume;
    audio.play().catch(function() {});
  }

  // Map events to sounds
  playForEvent(eventType) {
    switch (eventType) {
      case 'permission': this.play('permission'); break;
      case 'stop': this.play('notify'); break;
      case 'tool_done': this.play('click'); break;
      case 'notification': this.play('notify'); break;
      case 'error': this.play('error'); break;
    }
  }

  // Register custom sound
  setCustomSound(name, filePath) {
    this.customSounds[name] = filePath;
  }

  static getDefaultSounds() {
    return Object.keys(DEFAULT_SOUNDS);
  }
}

if (typeof module !== 'undefined') module.exports = { IslandSound, DEFAULT_SOUNDS };
if (typeof window !== 'undefined') window.IslandSound = IslandSound;
