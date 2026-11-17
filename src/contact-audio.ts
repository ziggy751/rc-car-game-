import type { ContactSample } from './environment-effects';
/** Procedural, gesture-unlocked surface sound. No external samples or audio requests. */
export class ContactAudio {
  surface: GainNode;
  water: GainNode;
  scrape: GainNode;
  wind: GainNode;
  filter: BiquadFilterNode;
  constructor(public context: AudioContext) {
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate),
      data = buffer.getChannelData(0);
    let low = 0,
      seed = 72;
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const white = (seed / 4294967296) * 2 - 1;
      low = (low + 0.025 * white) / 1.025;
      data[i] = white * 0.4 + low * 2;
    }
    const noise = context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const voice = (frequency: number, type: BiquadFilterType) => {
      const filter = context.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = frequency;
      filter.Q.value = 0.7;
      const gain = context.createGain();
      gain.gain.value = 0;
      noise.connect(filter).connect(gain).connect(context.destination);
      return { gain, filter };
    };
    const surface = voice(1500, 'bandpass');
    this.surface = surface.gain;
    this.filter = surface.filter;
    this.water = voice(700, 'lowpass').gain;
    this.scrape = voice(2800, 'highpass').gain;
    this.wind = voice(180, 'lowpass').gain;
    noise.start();
  }
  update(samples: ContactSample[], scrape: number, enabled: boolean, outdoor: boolean) {
    let rolling = 0,
      splash = 0,
      slip = 0;
    for (const s of samples) {
      if (s.contact) {
        rolling += Math.abs(s.speed) * Math.min(1, s.load / 8);
        slip += Math.abs(s.slip) * Math.abs(s.omega * s.radius);
      }
      if (s.water) splash += Math.abs(s.speed) + Math.abs(s.omega * s.radius) * 0.2;
    }
    const t = this.context.currentTime;
    this.surface.gain.setTargetAtTime(
      enabled ? Math.min(0.025, rolling * 0.012 + slip * 0.015) : 0,
      t,
      0.06,
    );
    this.water.gain.setTargetAtTime(enabled ? Math.min(0.035, splash * 0.03) : 0, t, 0.04);
    this.scrape.gain.setTargetAtTime(enabled ? Math.min(0.018, scrape * 0.0006) : 0, t, 0.025);
    this.wind.gain.setTargetAtTime(enabled && outdoor ? 0.003 : 0, t, 0.8);
    const surface = samples.find((s) => s.contact)?.surface;
    this.filter.frequency.setTargetAtTime(
      surface === 'Gravel'
        ? 1800
        : surface === 'Mud'
          ? 350
          : surface === 'Forest loam'
            ? 900
            : 2400,
      t,
      0.1,
    );
  }
}
