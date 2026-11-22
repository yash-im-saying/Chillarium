export class AmbientAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private breezeGain: GainNode | null = null;
  private padGain: GainNode | null = null;
  private chimeTimer: number | null = null;
  private enabled = false;
  private rainLevel = 0;
  private mistLevel = 0;
  private breezeLevel = 0.45;
  private currentNight = 0;

  private ensureInitialized() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);
    this.masterGain = master;

    // Create 4-second looping pink noise buffer
    const bufferSize = ctx.sampleRate * 4;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
      b6 = white * 0.115926;
    }

    // Rain channel (bandpass + gentle high shelf)
    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = noiseBuffer;
    rainSrc.loop = true;
    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 1450;
    rainFilter.Q.value = 0.65;
    const rainGain = ctx.createGain();
    rainGain.gain.value = 0.0;
    rainSrc.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(master);
    rainSrc.start();
    this.rainGain = rainGain;

    // Airy glasshouse breeze channel
    const breezeSrc = ctx.createBufferSource();
    breezeSrc.buffer = noiseBuffer;
    breezeSrc.loop = true;
    const breezeFilter = ctx.createBiquadFilter();
    breezeFilter.type = 'lowpass';
    breezeFilter.frequency.value = 340;
    const breezeGain = ctx.createGain();
    breezeGain.gain.value = 0.22;
    breezeSrc.connect(breezeFilter);
    breezeFilter.connect(breezeGain);
    breezeGain.connect(master);
    breezeSrc.start();
    this.breezeGain = breezeGain;

    // Warm harmonic pad (soft sine fifth: C3 + G3)
    const padGain = ctx.createGain();
    padGain.gain.value = 0.04;
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 130.81; // C3
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 196.0; // G3
    osc1.connect(padGain);
    osc2.connect(padGain);
    padGain.connect(master);
    osc1.start();
    osc2.start();
    this.padGain = padGain;

    // Occasional soft glass-bell water chime
    const scheduleChime = () => {
      if (this.enabled && this.ctx && this.masterGain && this.ctx.state === 'running') {
        this.triggerSoftChime();
      }
      this.chimeTimer = window.setTimeout(scheduleChime, 4500 + Math.random() * 5500);
    };
    this.chimeTimer = window.setTimeout(scheduleChime, 2600);
  }

  private triggerSoftChime() {
    if (!this.ctx || !this.masterGain) return;
    const notes = [523.25, 587.33, 659.25, 783.99, 880.0]; // C5 pentatonic
    const freq = notes[Math.floor(Math.random() * notes.length)];
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.032, now + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 2.7);
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled) {
      this.ensureInitialized();
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
    }
    this.applyMix();
  }

  public updateAtmosphere(
    rainIntensity: number,
    mistIntensity: number,
    breeze: number,
    nightFactor: number
  ) {
    this.rainLevel = rainIntensity;
    this.mistLevel = mistIntensity;
    this.breezeLevel = breeze;
    this.currentNight = nightFactor;
    this.applyMix();
  }

  private applyMix() {
    if (!this.ctx || !this.masterGain || !this.rainGain || !this.breezeGain || !this.padGain) return;
    const now = this.ctx.currentTime;
    const targetMaster = this.enabled ? 0.55 : 0.0001;
    this.masterGain.gain.setTargetAtTime(targetMaster, now, 0.35);

    const targetRain = this.rainLevel * 0.65;
    const targetBreeze = 0.1 + this.breezeLevel * 0.18 + this.mistLevel * 0.12;
    const targetPad = 0.03 + this.currentNight * 0.035;

    this.rainGain.gain.setTargetAtTime(targetRain, now, 0.45);
    this.breezeGain.gain.setTargetAtTime(targetBreeze, now, 0.45);
    this.padGain.gain.setTargetAtTime(targetPad, now, 0.8);
  }

  public dispose() {
    if (this.chimeTimer !== null) {
      clearTimeout(this.chimeTimer);
      this.chimeTimer = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
