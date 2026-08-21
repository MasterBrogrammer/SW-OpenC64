export type SidAudio = {
  resume: () => void;
  setMuted: (muted: boolean) => void;
  setKeepAlive: (keep: boolean) => void;
  setVolume: (level: number) => void;
  close: () => void;
  pushSid: (samples: Float32Array) => void;
  motor: (on: boolean) => void;
  seek: () => void;
  key: () => void;
  whoosh: () => void;
  sampleRate: () => number;
};

const RING = 48000 * 2;

export function createC64Audio(): SidAudio {
  let ctx: AudioContext | null = null;
  let node: ScriptProcessorNode | null = null;
  let muted = false;
  let keepAlive = false;
  let closed = false;
  let motorOn = false;
  let volume = 0.5;
  let master: GainNode | null = null;
  let motorGain: GainNode | null = null;
  let sfxGain: GainNode | null = null;
  let lastSeek = 0;
  let lastKey = 0;
  const ring = new Float32Array(RING);
  let w = 0;
  let r = 0;

  function ensure(): AudioContext | null {
    if (closed) return null;
    if (ctx) return ctx;
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : volume;
      master.connect(ctx.destination);

      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.7;
      sfxGain.connect(master);

      motorGain = ctx.createGain();
      motorGain.gain.value = 0;
      motorGain.connect(master);

      const rumble = ctx.createBiquadFilter();
      rumble.type = "lowpass";
      rumble.frequency.value = 220;
      const rumbleSrc = ctx.createBufferSource();
      rumbleSrc.buffer = noise(ctx, 1.6, "brown");
      rumbleSrc.loop = true;
      rumbleSrc.connect(rumble);
      rumble.connect(motorGain);
      rumbleSrc.start();

      const whir = ctx.createBiquadFilter();
      whir.type = "bandpass";
      whir.frequency.value = 720;
      whir.Q.value = 1.2;
      const whirSrc = ctx.createBufferSource();
      whirSrc.buffer = noise(ctx, 1.6, "pink");
      whirSrc.loop = true;
      whirSrc.connect(whir);
      whir.connect(motorGain);
      whirSrc.start();

      const length = 2048;
      node = ctx.createScriptProcessor(length, 0, 1);
      node.onaudioprocess = (ev) => {
        const out = ev.outputBuffer.getChannelData(0);
        if (muted || (document.hidden && !keepAlive)) {
          out.fill(0);
          return;
        }
        for (let i = 0; i < out.length; i++) {
          if (r === w) {
            out[i] = 0;
          } else {
            const s = ring[r];
            out[i] = s > 1 ? 1 : s < -1 ? -1 : s;
            r = (r + 1) % RING;
          }
        }
      };
      const sidGain = ctx.createGain();
      sidGain.gain.value = 0.728;
      node.connect(sidGain);
      sidGain.connect(master);
      return ctx;
    } catch (err) {
      console.error("c64 audio", err);
      ctx = null;
      return null;
    }
  }

  return {
    resume() {
      const ac = ensure();
      if (!ac) return;
      void ac.resume();
      if (motorGain) {
        motorGain.gain.setTargetAtTime(motorOn && !muted ? 0.32 : 0, ac.currentTime, 0.05);
      }
    },
    setKeepAlive(keep) {
      keepAlive = keep;
      if (keep) this.resume();
    },
    setMuted(next) {
      muted = next;
      if (!next) this.resume();
      if (master && ctx) {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(next ? 0 : volume, ctx.currentTime, 0.04);
      }
    },
    setVolume(level) {
      volume = Math.min(1, Math.max(0, level));
      if (master && ctx && !muted) {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(volume, ctx.currentTime, 0.04);
      }
    },
    sampleRate() {
      return ensure()?.sampleRate ?? 44100;
    },
    pushSid(samples) {
      if (muted || closed || !samples.length) return;
      for (let i = 0; i < samples.length; i++) {
        const n = (w + 1) % RING;
        if (n === r) break;
        const s = samples[i] * 0.485;
        ring[w] = s > 0.95 ? 0.95 : s < -0.95 ? -0.95 : s;
        w = n;
      }
    },
    motor(on) {
      motorOn = on;
      const ac = ensure();
      if (!ac || !motorGain) return;
      motorGain.gain.cancelScheduledValues(ac.currentTime);
      motorGain.gain.setTargetAtTime(on && !muted ? 0.32 : 0, ac.currentTime, 0.07);
    },
    seek() {
      const ac = ensure();
      if (!ac || !sfxGain || muted) return;
      const t = ac.currentTime;
      if (t - lastSeek < 0.012) return;
      lastSeek = t;
      blip(ac, sfxGain, t, 190, 0.04, 0.12);
    },
    key() {
      const ac = ensure();
      if (!ac || !sfxGain || muted) return;
      const t = ac.currentTime;
      if (t - lastKey < 0.02) return;
      lastKey = t;
      blip(ac, sfxGain, t, 920 + Math.random() * 180, 0.035, 0.18);
    },
    whoosh() {
      const ac = ensure();
      if (!ac || !sfxGain || muted) return;
      const t = ac.currentTime;
      blip(ac, sfxGain, t, 420, 0.12, 0.16);
      blip(ac, sfxGain, t + 0.05, 760, 0.1, 0.12);
    },
    close() {
      closed = true;
      try {
        node?.disconnect();
      } catch {
        /* */
      }
      node = null;
      void ctx?.close();
      ctx = null;
    },
  };
}

function blip(
  ac: AudioContext,
  dest: AudioNode,
  t: number,
  freq: number,
  dur: number,
  gain: number,
) {
  const o = ac.createOscillator();
  o.type = "square";
  o.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(Math.max(gain, 0.001), t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.01);
}

function noise(ctx: AudioContext, seconds: number, kind: "brown" | "pink"): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  let b0 = 0,
    b1 = 0,
    b2 = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    if (kind === "brown") {
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.2;
    } else {
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      d[i] = (b0 + b1 + b2 + white * 0.1848) * 0.11;
    }
  }
  return buf;
}

export function resumeAllAudio() {
  const c64 = (
    window as unknown as {
      __c64?: { audio?: SidAudio };
    }
  ).__c64;
  c64?.audio?.resume();
}

export function createSidAudio(): SidAudio {
  return createC64Audio();
}
