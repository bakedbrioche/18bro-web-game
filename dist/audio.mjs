/** Short sound effects for 18Bro: Run for Chips. No background music.
 * Call unlock() from a pointer/key gesture, then update(dt) once per frame.
 * No timers, worklets, fetched assets, or automatic AudioContext resume calls.
 */
export class ArcadeAudio {
  constructor() {
    this.music = false;
    this.sfx = true;
    this.mode = 'menu';
    this.context = null;
    this._voices = new Set();
    this._lastEffects = new Map();
    this._next = 0;
    this._step = 0;
    this._disposed = false;
  }

  async unlock() {
    if (this._disposed) return false;
    try {
      if (!this.context) {
        const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Context) return false;
        this.context = new Context({ latencyHint: 'interactive' });
        const ctx = this.context;
        this._master = ctx.createGain();
        this._master.gain.value = 0.72;
        this._compressor = ctx.createDynamicsCompressor();
        this._compressor.threshold.value = -16;
        this._compressor.knee.value = 14;
        this._compressor.ratio.value = 4;
        this._compressor.attack.value = 0.006;
        this._compressor.release.value = 0.14;
        this._musicBus = ctx.createGain();
        this._musicBus.gain.value = this.music ? 0.23 : 0;
        this._sfxBus = ctx.createGain();
        this._sfxBus.gain.value = this.sfx ? 0.43 : 0;
        this._musicBus.connect(this._compressor);
        this._sfxBus.connect(this._compressor);
        this._compressor.connect(this._master);
        this._master.connect(ctx.destination);
        // Low-rate, sample-held noise gives a crunchy old sampler texture.
        this._noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.6), ctx.sampleRate);
        const samples = this._noiseBuffer.getChannelData(0);
        let value = 0;
        for (let i = 0; i < samples.length; i++) {
          if (i % 3 === 0) value = Math.random() * 2 - 1;
          samples[i] = value;
        }
      }
      // The caller must invoke this method directly from a user gesture.
      if (this.context.state !== 'running') await this.context.resume();
      this._next = 0;
      return this.context.state === 'running';
    } catch (_) {
      return false;
    }
  }

  setEnabled(music, sfx) {
    const musicChanged = this.music !== Boolean(music);
    const sfxChanged = this.sfx !== Boolean(sfx);
    this.music = false;
    this.sfx = Boolean(sfx);
    if (!musicChanged && !sfxChanged) return;
    if (!this.context || this._disposed) return;
    try {
      const now = this.context.currentTime;
      this._musicBus?.gain.setTargetAtTime(this.music ? 0.23 : 0, now, 0.025);
      this._sfxBus?.gain.setTargetAtTime(this.sfx ? 0.43 : 0, now, 0.015);
      if (!this.music) this._stop('music');
      if (!this.sfx) this._stop('sfx');
      if (musicChanged) this._next = 0;
    } catch (_) { /* Audio is optional. */ }
  }

  setMode(mode = 'menu') {
    if (!['menu', 'run', 'moon', 'paused', 'over'].includes(mode)) mode = 'menu';
    if (this.mode === mode) return;
    this.mode = mode;
    this._stop('music');
    this._next = 0;
    this._step = 0;
  }

  update() {} // This edition has no background music.

  play(kind) {
    const ctx = this.context;
    if (this._disposed || !this.sfx || !ctx || ctx.state !== 'running') return;
    try {
      const now = ctx.currentTime;
      const cooldown = { coin: 0.028, chip: 0.045, hit: 0.15, siren: 0.7, whistle: 0.25 }[kind] ?? 0.065;
      if (now - (this._lastEffects.get(kind) ?? -100) < cooldown) return;
      // Only a known finite set of effect names enters the cooldown map.
      if (!['coin', 'chip', 'jump', 'slide', 'hit', 'whistle', 'siren', 'confirm', 'power', 'gameover'].includes(kind)) return;
      this._lastEffects.set(kind, now);
      const t = now + 0.003;
      const tone = (hz, length, volume = 0.22, shape = 'square', delay = 0, end = hz) =>
        this._tone(hz, length, volume, shape, t + delay, 'sfx', end);
      switch (kind) {
        case 'coin':
          tone(1174.66, 0.055, 0.16);
          tone(1760, 0.13, 0.13, 'triangle', 0.04);
          break;
        case 'chip':
          tone(880, 0.06, 0.16);
          tone(1318.5, 0.08, 0.14, 'square', 0.035);
          tone(1760, 0.15, 0.16, 'triangle', 0.075);
          this._noise(0.032, 0.08, t, 'sfx', 1800, 'highpass');
          break;
        case 'jump':
          tone(240, 0.15, 0.19, 'triangle', 0, 720);
          tone(480, 0.09, 0.055, 'square', 0.025, 1100);
          break;
        case 'slide':
          this._noise(0.18, 0.16, t, 'sfx', 950, 'bandpass');
          tone(230, 0.15, 0.11, 'sawtooth', 0, 70);
          break;
        case 'hit':
          this._noise(0.18, 0.32, t, 'sfx', 1500, 'lowpass');
          tone(130, 0.24, 0.36, 'triangle', 0, 38);
          tone(170, 0.09, 0.10, 'square', 0, 54);
          break;
        case 'whistle':
          tone(1320, 0.12, 0.14, 'sine', 0, 1760);
          tone(1760, 0.17, 0.12, 'sine', 0.15, 1480);
          break;
        case 'siren':
          for (let i = 0; i < 3; i++) {
            tone(620, 0.15, 0.10, 'triangle', i * 0.29, 1030);
            tone(1030, 0.15, 0.10, 'triangle', i * 0.29 + 0.14, 620);
          }
          break;
        case 'confirm':
          tone(440, 0.055, 0.16, 'square');
          tone(880, 0.10, 0.14, 'triangle', 0.055);
          break;
        case 'power':
          [440, 554.37, 659.25, 880, 1108.73, 1318.51].forEach((hz, i) =>
            tone(hz, 0.17, 0.12, i % 2 ? 'triangle' : 'square', i * 0.052));
          tone(220, 0.4, 0.12, 'sine', 0, 440);
          break;
        case 'gameover':
          [440, 392, 329.63, 220].forEach((hz, i) =>
            tone(hz, i === 3 ? 0.52 : 0.18, 0.17, 'triangle', i * 0.17));
          tone(110, 0.6, 0.12, 'sine', 0.5, 55);
          break;
      }
    } catch (_) { /* Unsupported or interrupted audio must not interrupt play. */ }
  }

  _tone(hz, duration, volume, shape, time, group, endHz = hz, cutoff = 0) {
    if (this._voices.size >= 64) return;
    const ctx = this.context;
    const source = ctx.createOscillator();
    source.type = shape;
    source.frequency.setValueAtTime(Math.max(20, hz), time);
    if (endHz !== hz) source.frequency.exponentialRampToValueAtTime(Math.max(20, endHz), time + duration);
    this._voice(source, duration, volume, time, group, cutoff, 'lowpass');
  }

  _noise(duration, volume, time, group, cutoff, type) {
    if (this._voices.size >= 64) return;
    const source = this.context.createBufferSource();
    source.buffer = this._noiseBuffer;
    source.loop = true;
    this._voice(source, duration, volume, time, group, cutoff, type);
  }

  _voice(source, duration, volume, time, group, cutoff, type) {
    const ctx = this.context;
    const envelope = ctx.createGain();
    const filter = cutoff ? ctx.createBiquadFilter() : null;
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(volume, time + Math.min(0.005, duration * 0.15));
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    if (filter) {
      filter.type = type;
      filter.frequency.value = Math.min(cutoff, ctx.sampleRate * 0.44);
      filter.Q.value = 0.7;
      source.connect(filter);
      filter.connect(envelope);
    } else source.connect(envelope);
    envelope.connect(group === 'music' ? this._musicBus : this._sfxBus);
    const voice = { source, envelope, filter, group };
    this._voices.add(voice);
    source.onended = () => {
      source.disconnect();
      envelope.disconnect();
      filter?.disconnect();
      this._voices.delete(voice);
    };
    source.start(time);
    source.stop(time + duration + 0.012);
  }

  _stop(group) {
    if (!this.context) return;
    const now = this.context.currentTime;
    for (const voice of this._voices) {
      if (group && voice.group !== group) continue;
      try {
        // Cancel scheduled future attacks as well as currently audible notes.
        voice.envelope.gain.cancelScheduledValues(now);
        voice.envelope.gain.setTargetAtTime(0, now, 0.004);
        voice.source.stop(now + 0.025);
      } catch (_) { /* A source may already have ended. */ }
    }
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this._stop();
    for (const voice of this._voices) {
      try {
        voice.source.onended = null;
        voice.source.disconnect();
        voice.envelope.disconnect();
        voice.filter?.disconnect();
      } catch (_) { /* Best effort after context interruption. */ }
    }
    this._voices.clear();
    this._lastEffects.clear();
    try { this.context?.close()?.catch(() => {}); } catch (_) { /* Optional API. */ }
    this.context = null;
    this._noiseBuffer = null;
    this._musicBus = this._sfxBus = this._compressor = this._master = null;
  }
}
