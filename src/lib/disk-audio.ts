/**
 * Mechanical Disk II: motor whir + stepper click-clack in a small cabinet.
 * These are the drive, not the IIe speaker.
 */
export type DiskAudio = {
  motor: (on: boolean) => void;
  seek: () => void;
  whoosh: () => void;
  resume: () => void;
  reattach: (win: Window) => void;
  setVolume: (level: number) => void;
  setMuted: (muted: boolean) => void;
  close: () => void;
};

/** Call from click/tap handlers — AudioContext will not start in a later effect. */
export function resumeAllAudio() {
  const c64 = (
    window as unknown as {
      __c64?: { diskSfx?: { resume: () => void }; audio?: { resume: () => void } };
    }
  ).__c64;
  c64?.diskSfx?.resume();
  c64?.audio?.resume();
}

export function createDiskAudio(): DiskAudio {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let dry: GainNode | null = null;
  let clickWet: GainNode | null = null;
  let motorGain: GainNode | null = null;
  let clickBuf: AudioBuffer | null = null;
  let lastSeek = 0;
  let lastWhoosh = 0;
  let closed = false;
  let host: Window = window;
  // Mix at slider 100%. Today's fixed master was 0.3. Slider 50% => 0.15.
  const DISK_TRIM = 0.3;
  let volume = 0.5;
  let muted = false;
  let motorOn = false;

  function applyMaster() {
    if (!master || !ctx) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(
      muted ? 0 : DISK_TRIM * volume,
      ctx.currentTime,
      0.04,
    );
  }


  function graphWindow(): Window {
    return host && !host.closed ? host : window;
  }

  function teardownGraph() {
    try {
      void ctx?.close();
    } catch {
      /* */
    }
    ctx = null;
    master = null;
    dry = null;
    clickWet = null;
    motorGain = null;
    clickBuf = null;
  }

  function ensure(): AudioContext | null {
    if (closed) return null;
    if (ctx) return ctx;
    try {
      const w = graphWindow();
      const AC =
        w.AudioContext ||
        (w as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC({ sampleRate: 22050 });
      master = ctx.createGain();
      applyMaster();
      master.connect(ctx.destination);

      dry = ctx.createGain();
      dry.gain.value = 1;
      dry.connect(master);

      const cabinet = ctx.createConvolver();
      cabinet.buffer = makeCabinetIR(ctx);
      const wet = ctx.createGain();
      wet.gain.value = 1;
      cabinet.connect(wet);
      wet.connect(master);

      clickWet = ctx.createGain();
      clickWet.gain.value = 0.24;
      clickWet.connect(cabinet);

      motorGain = ctx.createGain();
      motorGain.gain.value = 0;
      motorGain.connect(dry);
      const motorWet = ctx.createGain();
      motorWet.gain.value = 0.16;
      motorGain.connect(motorWet);
      motorWet.connect(cabinet);

      const rumbleFilter = ctx.createBiquadFilter();
      rumbleFilter.type = "lowpass";
      rumbleFilter.frequency.value = 190;
      rumbleFilter.Q.value = 0.6;
      const rumbleGain = ctx.createGain();
      rumbleGain.gain.value = 0.55;
      const rumbleSrc = ctx.createBufferSource();
      rumbleSrc.buffer = brownNoise(ctx, 1.8);
      rumbleSrc.loop = true;
      rumbleSrc.connect(rumbleFilter);
      rumbleFilter.connect(rumbleGain);
      rumbleGain.connect(motorGain);
      rumbleSrc.start();

      const whirFilter = ctx.createBiquadFilter();
      whirFilter.type = "bandpass";
      whirFilter.frequency.value = 640;
      whirFilter.Q.value = 1.1;
      const whirGain = ctx.createGain();
      whirGain.gain.value = 0.38;
      const whirSrc = ctx.createBufferSource();
      whirSrc.buffer = pinkNoise(ctx, 1.8);
      whirSrc.loop = true;
      whirSrc.connect(whirFilter);
      whirFilter.connect(whirGain);
      whirGain.connect(motorGain);
      whirSrc.start();

      // 300 RPM platter — a little AM, not a tone.
      const spin = ctx.createOscillator();
      spin.frequency.value = 5;
      const spinDepth = ctx.createGain();
      spinDepth.gain.value = 0.07;
      spin.connect(spinDepth);
      spinDepth.connect(whirGain.gain);
      spin.start();

      clickBuf = makeStepperClick(ctx);
    } catch {
      ctx = null;
    }
    return ctx;
  }

  return {
    motor(on) {
      motorOn = on;
      const ac = ensure();
      if (!ac || !motorGain) return;
      motorGain.gain.cancelScheduledValues(ac.currentTime);
      motorGain.gain.value = on && !muted ? 0.42 : 0;
      motorGain.gain.setTargetAtTime(on && !muted ? 0.42 : 0, ac.currentTime, 0.06);
    },
    seek() {
      const ac = ensure();
      if (!ac || !dry || !clickWet || !clickBuf) return;
      const t = ac.currentTime;
      if (t - lastSeek < 0.011) return;
      lastSeek = t;
      const src = ac.createBufferSource();
      src.buffer = clickBuf;
      const g = ac.createGain();
      g.gain.value = 0.55 + Math.random() * 0.2;
      src.connect(g);
      g.connect(dry);
      g.connect(clickWet);
      src.start(t);
    },
    whoosh() {
      const ac = ensure();
      if (!ac || !dry) return;
      const fire = () => {
        if (!dry || ac.state !== "running") return;
        const t = ac.currentTime;
        if (t - lastWhoosh < 0.28) return;
        lastWhoosh = t;
        const src = ac.createBufferSource();
        src.buffer = pinkNoise(ac, 0.55);
        const bp = ac.createBiquadFilter();
        bp.type = "bandpass";
        bp.Q.value = 1.2;
        bp.frequency.setValueAtTime(280, t);
        bp.frequency.linearRampToValueAtTime(1600, t + 0.22);
        bp.frequency.linearRampToValueAtTime(420, t + 0.5);
        const g = ac.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.55, t + 0.06);
        g.gain.linearRampToValueAtTime(0, t + 0.52);
        src.connect(bp);
        bp.connect(g);
        g.connect(dry);
        if (clickWet) {
          const wet = ac.createGain();
          wet.gain.value = 0.16;
          g.connect(wet);
          wet.connect(clickWet);
        }
        src.start(t);
        src.stop(t + 0.55);
      };
      if (ac.state !== "running") {
        void ac.resume().then(fire);
        return;
      }
      fire();
    },
    reattach(win: Window) {
      host = win && !win.closed ? win : window;
      teardownGraph();
      this.resume();
    },
    setVolume(level: number) {
      volume = Math.min(1, Math.max(0, level));
      applyMaster();
    },
    setMuted(next: boolean) {
      muted = next;
      applyMaster();
    },
    resume() {
      const ac = ensure();
      if (!ac) return;
      void ac.resume().then(() => {
        if (!motorGain || closed) return;
        motorGain.gain.value = motorOn && !muted ? 0.42 : 0;
      });
    },
    close() {
      closed = true;
      try {
        void ctx?.close();
      } catch {
        /* already closed */
      }
      ctx = null;
      master = null;
      dry = null;
      clickWet = null;
      motorGain = null;
      clickBuf = null;
    },
  };
}

function brownNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buffer;
}

function pinkNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0,
    b1 = 0,
    b2 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.11;
  }
  return buffer;
}

/** Two short noise knocks — the staccato. Keep this dry and sharp. */
function makeStepperClick(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * 0.016);
  const buffer = ctx.createBuffer(1, n, sr);
  const d = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const noise = Math.random() * 2 - 1;
    const knock1 = Math.exp(-t * 520) * noise;
    const t2 = t - 0.0055;
    const knock2 =
      t2 > 0 ? Math.exp(-t2 * 640) * (Math.random() * 2 - 1) * 0.55 : 0;
    d[i] = (knock1 + knock2) * 0.85;
  }
  return buffer;
}

/** Short, dark box — a Disk II in a IIe case, not a hall. */
function makeCabinetIR(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * 0.11);
  const buffer = ctx.createBuffer(2, n, sr);
  const tapsL = [0.0028, 0.0074, 0.0136, 0.024];
  const tapsR = [0.0022, 0.0086, 0.0165, 0.029];
  for (let ch = 0; ch < 2; ch++) {
    const d = buffer.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const white = Math.random() * 2 - 1;
      lp = lp * 0.88 + white * 0.12;
      d[i] = lp * Math.exp(-t * 26) * 0.5;
    }
    const taps = ch === 0 ? tapsL : tapsR;
    for (const tap of taps) {
      const idx = Math.floor(tap * sr);
      if (idx < n) {
        d[idx] += (Math.random() * 2 - 1) * 0.32 * Math.exp(-tap * 16);
      }
    }
  }
  return buffer;
}
