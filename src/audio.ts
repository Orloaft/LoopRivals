// Lightweight procedural SFX layer. No audio assets: every sound is synthesized
// from oscillators + a gain envelope through a single shared AudioContext, so it
// adds no network/bundle weight. The context is created lazily and resumed on
// the first user gesture (browsers block audio before that). All output is
// gated behind a user-toggleable, persisted preference.

type Ctx = AudioContext;

let ctx: Ctx | null = null;
let master: GainNode | null = null;
let enabled = loadEnabledPref();

function loadEnabledPref(): boolean {
  try {
    return localStorage.getItem('loopduel.sfx') !== 'off';
  } catch {
    return true;
  }
}

export function isSfxEnabled(): boolean {
  return enabled;
}

export function setSfxEnabled(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem('loopduel.sfx', on ? 'on' : 'off');
  } catch {
    /* storage unavailable — keep the in-memory value */
  }
  if (on) ensureCtx();
}

function ensureCtx(): Ctx | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.42;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
  return ctx;
}

// Resume/create the context from a real user gesture. Call once on mount; the
// listeners self-remove after the first interaction.
export function unlockAudio(): void {
  if (typeof window === 'undefined') return;
  const unlock = () => {
    ensureCtx();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
}

function vary(value: number, pct: number): number {
  return value * (1 + (Math.random() * 2 - 1) * pct);
}

type ToneSpec = {
  type: OscillatorType;
  freq: number;
  freqTo?: number;
  start?: number; // seconds from now
  dur: number;
  attack?: number;
  vol: number;
};

function tone(c: Ctx, spec: ToneSpec): void {
  const t0 = c.currentTime + (spec.start ?? 0);
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = spec.type;
  osc.frequency.setValueAtTime(spec.freq, t0);
  if (spec.freqTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, spec.freqTo), t0 + spec.dur);
  }
  const attack = spec.attack ?? 0.005;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(spec.vol, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.dur);
  osc.connect(gain).connect(master as GainNode);
  osc.start(t0);
  osc.stop(t0 + spec.dur + 0.02);
}

function noise(c: Ctx, dur: number, vol: number, filterHz: number, start = 0): void {
  const t0 = c.currentTime + start;
  const frames = Math.max(1, Math.floor(c.sampleRate * dur));
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterHz;
  const gain = c.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(gain).connect(master as GainNode);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

function play(fn: (c: Ctx) => void): void {
  if (!enabled) return;
  const c = ensureCtx();
  if (!c || c.state !== 'running') return;
  try {
    fn(c);
  } catch {
    /* never let audio throw into the render path */
  }
}

export const sfx = {
  cardPlay(): void {
    play((c) => {
      noise(c, 0.06, 0.18, 2600);
      tone(c, { type: 'triangle', freq: vary(520, 0.03), freqTo: 300, dur: 0.09, vol: 0.12 });
    });
  },
  hit(): void {
    play((c) => {
      tone(c, { type: 'square', freq: vary(150, 0.04), freqTo: 90, dur: 0.13, vol: 0.16 });
      noise(c, 0.05, 0.14, 1400);
    });
  },
  crit(): void {
    play((c) => {
      tone(c, { type: 'square', freq: vary(200, 0.03), freqTo: 110, dur: 0.22, vol: 0.18 });
      tone(c, { type: 'sawtooth', freq: vary(620, 0.03), freqTo: 300, dur: 0.2, vol: 0.1 });
      noise(c, 0.08, 0.16, 2200);
    });
  },
  loot(): void {
    play((c) => {
      tone(c, { type: 'sine', freq: vary(660, 0.02), dur: 0.12, vol: 0.13 });
      tone(c, { type: 'sine', freq: vary(990, 0.02), dur: 0.16, vol: 0.12, start: 0.07 });
    });
  },
  levelUp(): void {
    play((c) => {
      [523, 659, 784].forEach((freq, i) => {
        tone(c, { type: 'triangle', freq, dur: 0.16, vol: 0.13, start: i * 0.07 });
      });
    });
  },
  victory(): void {
    play((c) => {
      [523, 659, 784, 1047].forEach((freq, i) => {
        tone(c, { type: 'triangle', freq, dur: 0.34, vol: 0.14, start: i * 0.11 });
      });
    });
  },
  defeat(): void {
    play((c) => {
      [440, 392, 330, 262].forEach((freq, i) => {
        tone(c, { type: 'sawtooth', freq, freqTo: freq * 0.97, dur: 0.34, vol: 0.12, start: i * 0.13 });
      });
    });
  }
};
