/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private engineGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineSub: OscillatorNode | null = null;
  private flightGain: GainNode | null = null;
  private flightOsc: OscillatorNode | null = null;
  private isInitialized: boolean = false;

  constructor() {
    // Check localStorage preference
    const savedMute = localStorage.getItem('neon_overdrive_muted');
    this.isMuted = savedMute === 'true';
  }

  public init() {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.isInitialized = true;
      this.setupContinuousLoops();
    } catch {
      // AudioContext not supported or restricted
    }
  }

  private setupContinuousLoops() {
    if (!this.ctx) return;

    try {
      // Continuous engine hum generator
      const masterEngine = this.ctx.createGain();
      masterEngine.gain.value = 0;
      masterEngine.connect(this.ctx.destination);
      this.engineGain = masterEngine;

      // Low rumble
      const osc1 = this.ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.value = 55; // A1
      const filter1 = this.ctx.createBiquadFilter();
      filter1.type = 'lowpass';
      filter1.frequency.value = 220;

      // Sub bass
      const sub = this.ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.value = 40;

      osc1.connect(filter1);
      filter1.connect(masterEngine);
      sub.connect(masterEngine);

      osc1.start();
      sub.start();
      this.engineOsc = osc1;
      this.engineSub = sub;

      // Flight hover thruster generator
      const masterFlight = this.ctx.createGain();
      masterFlight.gain.value = 0;
      masterFlight.connect(this.ctx.destination);
      this.flightGain = masterFlight;

      const flightOsc = this.ctx.createOscillator();
      flightOsc.type = 'triangle';
      flightOsc.frequency.value = 180;
      const flightFilter = this.ctx.createBiquadFilter();
      flightFilter.type = 'bandpass';
      flightFilter.frequency.value = 440;
      flightFilter.Q.value = 3.0;

      flightOsc.connect(flightFilter);
      flightFilter.connect(masterFlight);
      flightOsc.start();
      this.flightOsc = flightOsc;
    } catch {
      // Fail silently if loop initialization encounters permission issues
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    localStorage.setItem('neon_overdrive_muted', muted ? 'true' : 'false');
    if (this.isMuted) {
      if (this.engineGain) this.engineGain.gain.value = 0;
      if (this.flightGain) this.flightGain.gain.value = 0;
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public updateEngine(speedKmH: number, isFlying: boolean, isPlaying: boolean) {
    if (!this.ctx || this.isMuted || !isPlaying) {
      if (this.engineGain) this.engineGain.gain.value = 0;
      if (this.flightGain) this.flightGain.gain.value = 0;
      return;
    }

    const t = this.ctx.currentTime;
    const speedRatio = Math.min(1, Math.max(0, (speedKmH - 120) / 240));

    if (this.engineGain && this.engineOsc && this.engineSub) {
      // Smooth engine volume and pitch
      const targetGain = isFlying ? 0.04 : 0.09;
      this.engineGain.gain.setTargetAtTime(targetGain, t, 0.1);

      const targetFreq = 50 + speedRatio * 80;
      this.engineOsc.frequency.setTargetAtTime(targetFreq, t, 0.1);
      this.engineSub.frequency.setTargetAtTime(targetFreq * 0.7, t, 0.1);
    }

    if (this.flightGain && this.flightOsc) {
      const flightVol = isFlying ? 0.12 : 0;
      this.flightGain.gain.setTargetAtTime(flightVol, t, 0.08);
      const targetFlightFreq = 160 + speedRatio * 140;
      this.flightOsc.frequency.setTargetAtTime(targetFlightFreq, t, 0.08);
    }
  }

  public stopLoops() {
    if (this.engineGain) this.engineGain.gain.value = 0;
    if (this.flightGain) this.flightGain.gain.value = 0;
  }

  public playLaneShift(direction: 'left' | 'right') {
    if (!this.ctx || this.isMuted) return;
    this.init();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const pan = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

    osc.type = 'sine';
    const startFreq = direction === 'left' ? 320 : 280;
    const endFreq = direction === 'left' ? 440 : 480;

    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.12);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    if (pan) {
      pan.pan.value = direction === 'left' ? -0.4 : 0.4;
      osc.connect(gain);
      gain.connect(pan);
      pan.connect(this.ctx.destination);
    } else {
      osc.connect(gain);
      gain.connect(this.ctx.destination);
    }

    osc.start(t);
    osc.stop(t + 0.13);
  }

  public playFlightEngage() {
    if (!this.ctx || this.isMuted) return;
    this.init();

    const t = this.ctx.currentTime;
    // Harmonic energetic chord sweep
    const freqs = [330, 440, 660];
    freqs.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq * 0.7, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.3, t + 0.25);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, t);
      filter.frequency.exponentialRampToValueAtTime(2800, t + 0.2);

      gain.gain.setValueAtTime(0.07 / (idx + 1), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  public playCoinCollect(combo: number = 1) {
    if (!this.ctx || this.isMuted) return;
    this.init();

    const t = this.ctx.currentTime;
    // Pleasant high electronic crystal chime (B5 -> E6 pentatonic cascade)
    const tones = [987.77, 1174.66, 1318.51, 1567.98, 1760.0, 2093.0];
    const freq = tones[(combo - 1) % tones.length];

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.33, t + 0.08);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.16);
  }

  public playPowerupPickup(type: 'fuel' | 'shield' | 'magnet' | 'multiplier') {
    if (!this.ctx || this.isMuted) return;
    this.init();

    const t = this.ctx.currentTime;

    if (type === 'fuel') {
      // Rapid dual ascending energy surge
      [240, 480].forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 2.5, t + 0.22);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, t);
        filter.frequency.exponentialRampToValueAtTime(3200, t + 0.22);

        gain.gain.setValueAtTime(0.08 / (idx + 1), t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.25);
      });
    } else if (type === 'shield') {
      // Shimmering harmonic shield bell
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + i * 0.04);
        gain.gain.setValueAtTime(0.09, t + i * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.04 + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t + i * 0.04);
        osc.stop(t + i * 0.04 + 0.35);
      });
    } else if (type === 'magnet') {
      // High magnetic resonant pulse
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.linearRampToValueAtTime(880, t + 0.1);
      osc.frequency.linearRampToValueAtTime(660, t + 0.2);

      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.25);
    } else {
      // 2x Multiplier: triumphant power fanfare
      [587.33, 739.99, 880.0, 1174.66].forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + i * 0.05);

        gain.gain.setValueAtTime(0.1, t + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.28);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t + i * 0.05);
        osc.stop(t + i * 0.05 + 0.28);
      });
    }
  }

  public playShieldDeflect() {
    if (!this.ctx || this.isMuted) return;
    this.init();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.18);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.Q.value = 5.0;

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.2);
  }

  public playLanding() {
    if (!this.ctx || this.isMuted) return;
    this.init();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.15);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.16);
  }

  public playNearMiss() {
    if (!this.ctx || this.isMuted) return;
    this.init();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(700, t);
    osc.frequency.exponentialRampToValueAtTime(950, t + 0.12);

    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.2);
  }

  public playCollision() {
    if (!this.ctx || this.isMuted) return;
    this.init();

    const t = this.ctx.currentTime;

    // Sub rumble
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(140, t);
    subOsc.frequency.exponentialRampToValueAtTime(30, t + 0.4);

    subGain.gain.setValueAtTime(0.35, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(t);
    subOsc.stop(t + 0.4);

    // Noise blast
    const bufferSize = this.ctx.sampleRate * 0.25;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, t);
    filter.frequency.exponentialRampToValueAtTime(200, t + 0.25);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.25, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    whiteNoise.start(t);
    whiteNoise.stop(t + 0.25);
  }

  public playLowFlightEnergyWarning() {
    if (!this.ctx || this.isMuted) return;
    this.init();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(880, t + 0.05);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.1);
  }

  public playGameOver() {
    if (!this.ctx || this.isMuted) return;
    this.init();
    this.stopLoops();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.8);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.8);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.9);
  }

  public playUiClick() {
    if (!this.ctx || this.isMuted) return;
    this.init();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(450, t + 0.04);

    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.04);
  }
}

export const sound = new SoundEngine();
