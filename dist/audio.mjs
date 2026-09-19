/** Synthesized effects and a quiet, crossfaded street-market ambience loop.
 * Unlock from a user gesture; one AudioBufferSource loops through all game states.
 */
export class ArcadeAudio {
  constructor({ambienceUrl=new URL('./assets/audio/street-market.mp3',import.meta.url).href}={}) {
    this.ambience=true;
    this._ambienceBytes=ambienceUrl?fetch(ambienceUrl).then(r=>{if(!r.ok)throw Error('Ambience unavailable');return r.arrayBuffer();}).catch(()=>null):Promise.resolve(null);
    this.music = false;
    this.sfx = true;
    this.mode = 'menu';
    this.context = null;
    this._voices = new Set();
    this._lastEffects = new Map();
    this._next = 0;
    this._step = 0;
    this._disposed = false;
    this.environment = { night: 0, siren: 0, intersection: 0, interior: 0, arcade: 0, speed: 0, paused: false };
    this._environmentNodes = [];
    this._environmentSources = [];
    this._nextEnvironmentMix = 0;
    this._nextHorn = null;
    this._nextArcade = null;
    this._hornStep = 0;
    this._arcadeStep = 0;
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
        this._ambienceBus=ctx.createGain();this._ambienceBus.gain.value=0;
        this._ambienceFilter=ctx.createBiquadFilter();this._ambienceFilter.type='lowpass';
        this._ambienceFilter.frequency.value=11000;this._ambienceFilter.Q.value=.5;
        this._ambienceBus.connect(this._ambienceFilter);this._ambienceFilter.connect(this._master);
        this._environmentBus=ctx.createGain();this._environmentBus.gain.value=0;
        this._environmentBus.connect(this._master);
        // Low-rate, sample-held noise gives a crunchy old sampler texture.
        this._noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.6), ctx.sampleRate);
        const samples = this._noiseBuffer.getChannelData(0);
        let value = 0;
        for (let i = 0; i < samples.length; i++) {
          if (i % 3 === 0) value = Math.random() * 2 - 1;
          samples[i] = value;
        }
        this._buildEnvironment();
        this._mixEnvironment();
      }
      // The caller must invoke this method directly from a user gesture.
      if (this.context.state !== 'running') await this.context.resume();
      this._startAmbience();
      this._next = 0;
      return this.context.state === 'running';
    } catch (_) {
      return false;
    }
  }

  setEnabled(ambience,sfx) {
    this.ambience=Boolean(ambience);this.sfx=Boolean(sfx);this.music=false;
    if(!this.context||this._disposed)return;
    const now=this.context.currentTime;
    this._sfxBus?.gain.setTargetAtTime(this.sfx?.43:0,now,.015);
    this._mixEnvironment();
    if(!this.sfx)this._stop('sfx');
    if(!this.ambience)this._stop('environment');
  }

  _makeAmbienceLoop(buffer) {
    const n=buffer.length,fade=Math.min(Math.floor(buffer.sampleRate*1.5),Math.floor(n/4));
    const loop=this.context.createBuffer(buffer.numberOfChannels,n-fade,buffer.sampleRate);
    for(let channel=0;channel<buffer.numberOfChannels;channel++){
      const input=buffer.getChannelData(channel),output=loop.getChannelData(channel),body=n-2*fade;
      output.set(input.subarray(fade,n-fade));
      for(let i=0;i<fade;i++){
        const t=i/(fade-1),a=Math.cos(t*Math.PI/2),b=Math.sin(t*Math.PI/2);
        output[body+i]=input[n-fade+i]*a+input[i]*b;
      }
    }
    return loop;
  }

  _startAmbience() {
    if(this._ambienceLoading||this._ambienceSource||this._disposed)return this._ambienceLoading;
    const ctx=this.context;
    this._ambienceLoading=(async()=>{
      const bytes=await this._ambienceBytes;if(!bytes||this._disposed)return;
      const decoded=await ctx.decodeAudioData(bytes.slice(0));if(this._disposed)return;
      const source=ctx.createBufferSource();source.buffer=this._makeAmbienceLoop(decoded);
      source.loop=true;source.connect(this._ambienceBus);source.start();this._ambienceSource=source;
      this._mixEnvironment();
    })().catch(()=>{});
    return this._ambienceLoading;
  }

  setMode(mode = 'menu') {
    if (!['menu', 'run', 'moon', 'paused', 'over'].includes(mode)) mode = 'menu';
    if (this.mode === mode) return;
    this.mode = mode;
    this._stop('music');
    this._next = 0;
    this._step = 0;
  }

  /** All route blends are 0..1; speed is world units/sec. Safe before unlock. */
  setEnvironment({ night=0, siren=0, intersection=0, interior=0, arcade=0, speed=0, paused=false }={}) {
    const unit=value=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
    this.environment={night:unit(night),siren:unit(siren),intersection:unit(intersection),interior:unit(interior),arcade:unit(arcade),speed:Number.isFinite(speed)?Math.max(0,speed):0,paused:Boolean(paused)};
  }

  _buildEnvironment() {
    const ctx=this.context;
    const layer=(source,cutoff)=>{
      const filter=ctx.createBiquadFilter(),gain=ctx.createGain();
      filter.type='lowpass';filter.frequency.value=cutoff;filter.Q.value=.45;gain.gain.value=0;
      source.connect(filter);filter.connect(gain);gain.connect(this._environmentBus);
      this._environmentNodes.push(filter,gain);this._environmentSources.push(source);
      source.start();return {source,filter,gain};
    };
    const traffic=ctx.createBufferSource();traffic.buffer=this._noiseBuffer;traffic.loop=true;
    this._trafficLayer=layer(traffic,210);
    const hum=ctx.createOscillator();hum.type='triangle';hum.frequency.value=87;
    this._nightLayer=layer(hum,175);
    const siren=ctx.createOscillator();siren.type='triangle';siren.frequency.value=720;
    this._sirenLayer=layer(siren,1200);
    // One slow sweep, already sounding in the distance before vehicles appear.
    const sweep=ctx.createOscillator(),sweepDepth=ctx.createGain();
    sweep.type='sine';sweep.frequency.value=.37;sweepDepth.gain.value=175;
    sweep.connect(sweepDepth);sweepDepth.connect(siren.frequency);sweep.start();
    this._environmentSources.push(sweep);this._environmentNodes.push(sweepDepth);
  }

  _mixEnvironment() {
    if(!this.context||this._disposed)return;
    const now=this.context.currentTime,e=this.environment;
    const active=this.mode==='run'||this.mode==='moon';
    const paused=e.paused||this.mode==='paused';
    const movement=active?1:paused?.35:0;
    const indoors=Math.max(e.interior*.72,e.arcade);
    const outside=1-indoors*.78;
    // The supplied recording never restarts, even as sound changes at doorways.
    this._ambienceBus.gain.setTargetAtTime(this.ambience?.0225*(1-indoors*.55):0,now,.5);
    this._ambienceFilter.frequency.setTargetAtTime(11000-indoors*10300,now,.38);
    this._environmentBus.gain.setTargetAtTime(this.ambience?.0225:0,now,.18);
    this._trafficLayer.gain.gain.setTargetAtTime(movement*outside*(.045+e.intersection*.20+Math.min(e.speed/30,1)*.04),now,.65);
    this._trafficLayer.filter.frequency.setTargetAtTime(180+e.intersection*210,now,.7);
    this._nightLayer.gain.gain.setTargetAtTime(movement*e.night*outside*.033,now,.8);
    this._sirenLayer.gain.gain.setTargetAtTime(movement*e.siren*outside*.065,now,.8);
    this._sirenLayer.filter.frequency.setTargetAtTime(1300-indoors*650,now,.6);
    this._nextEnvironmentMix=now+.09;
  }

  update() {
    const ctx=this.context;
    if(this._disposed||!ctx||ctx.state!=='running')return;
    const now=ctx.currentTime,e=this.environment;
    if(now>=this._nextEnvironmentMix)this._mixEnvironment();
    const active=this.mode==='run'||this.mode==='moon';
    if(!this.ambience||!active||e.paused){this._nextHorn=null;this._nextArcade=null;return;}
    // Audio-clock deadlines cannot duplicate cues at high frame rates or burst
    // after a paused/background tab resumes. No frame-count or random timers.
    if(e.intersection>.2&&e.arcade<.4){
      if(this._nextHorn===null)this._nextHorn=now+6.5;
      if(now>=this._nextHorn){
        const t=now+.015,volume=.07*e.intersection*(1-e.interior*.8);
        this._tone(220,.34,volume,'triangle',t,'environment',210,650);
        this._tone(277,.31,volume*.5,'triangle',t,'environment',269,650);
        this._nextHorn=now+[11.7,15.1,13.4][this._hornStep++%3];
      }
    }else this._nextHorn=null;
    if(e.arcade>.035){
      if(this._nextArcade===null)this._nextArcade=now+.35;
      if(now>=this._nextArcade){
        const notes=this._arcadeStep++%2?[784,1046.5,1568,1046.5]:[659.25,880,1318.5,1760];
        notes.forEach((hz,i)=>this._tone(hz,.12,.10*e.arcade,'square',now+.015+i*.13,'environment',hz,2200));
        this._nextArcade=now+2.65;
      }
    }else this._nextArcade=null;
  }

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
    envelope.connect(group === 'music' ? this._musicBus : group === 'environment' ? this._environmentBus : this._sfxBus);
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
    try{this._ambienceSource?.stop();this._ambienceSource?.disconnect();this._ambienceBus?.disconnect();this._ambienceFilter?.disconnect();this._environmentBus?.disconnect();}catch{}
    for(const source of this._environmentSources){try{source.stop();source.disconnect();}catch{}}
    for(const node of this._environmentNodes){try{node.disconnect();}catch{}}
    this._environmentSources.length=0;this._environmentNodes.length=0;
    this._ambienceSource=null;this._ambienceBus=null;
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
    this._ambienceFilter=this._environmentBus=this._trafficLayer=this._nightLayer=this._sirenLayer=null;
  }
}
