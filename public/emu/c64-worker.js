/* 50 Hz CRT: one PAL raster frame of c64_step per 20 ms, then a paused
   debugger_update to publish the pixel buffer. debugger_update(1) as the
   CPU driver packed ~4 frames into one blit (right SID at 25% interval,
   ~12 fps picture). Speed only changes how often a PAL frame is emulated;
   we still blit every 20 ms so the CRT is not a slideshow. */
function c64_frame() {}
self.c64_frame = c64_frame;

const WIDTH = 384;
const HEIGHT = 272;
const PIXELS = WIDTH * HEIGHT * 4;
const PAL_MS = 20;
const STEP_CAP = 20000;

let mod = null;
let clock = 0;
let paused = false;
let sidRate = 44100;
let nextDue = 0;
let emuSpeed = 25;
let cpuAcc = 0;

function boot() {
  const factory = self.C64;
  if (typeof factory !== "function") {
    throw new Error("C64 factory missing in worker");
  }
  const instance = factory({
    locateFile: (path) => path,
  });
  const start = () => {
    mod = instance;
    try {
      mod._c64_setModel(1);
    } catch {
      /* PAL */
    }
    mod._c64_init();
    try {
      mod._c64_setDriveEnabled(1);
    } catch {
      /* */
    }
    try {
      mod._sid_setSampleRate(sidRate);
    } catch {
      /* */
    }
    try {
      mod._debugger_set_speed(100);
    } catch {
      /* */
    }
    try {
      mod._debugger_play();
    } catch {
      /* */
    }
    nextDue = performance.now();
    cpuAcc = 0;
    schedule(0);
    postMessage({ type: "ready" });
  };
  if (typeof instance.then === "function") instance.then(start);
  else start();
}

function schedule(delay) {
  if (clock) self.clearTimeout(clock);
  clock = self.setTimeout(step, Math.max(0, delay));
}

function stopClock() {
  if (clock) self.clearTimeout(clock);
  clock = 0;
}

function runPalFrame() {
  let lastY = 0;
  try {
    lastY = mod._c64_getRasterY();
  } catch {
    lastY = 0;
  }
  let steps = 0;
  while (steps++ < STEP_CAP) {
    mod._c64_step();
    let y = lastY;
    try {
      y = mod._c64_getRasterY();
    } catch {
      if (steps >= 6500) break;
      continue;
    }
    if (y < lastY) break;
    lastY = y;
  }
}

function publishPixels() {
  try {
    mod._debugger_pause();
  } catch {
    /* */
  }
  try {
    mod._debugger_update(1);
  } catch {
    /* */
  }
  try {
    mod._debugger_play();
  } catch {
    /* */
  }
}

function step() {
  clock = 0;
  if (!mod) return;
  if (paused) {
    schedule(PAL_MS);
    return;
  }

  const now = performance.now();
  if (now < nextDue - 1) {
    schedule(nextDue - now);
    return;
  }

  nextDue += PAL_MS;
  if (nextDue < now - 40) nextDue = now + PAL_MS;

  cpuAcc += Math.min(100, Math.max(10, emuSpeed)) / 100;
  let runCpu = false;
  if (cpuAcc >= 1) {
    cpuAcc -= 1;
    runCpu = true;
  }
  if (runCpu) {
    try {
      runPalFrame();
      publishPixels();
    } catch (err) {
      postMessage({
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
  blit(runCpu);
  schedule(Math.max(0, nextDue - performance.now()));
}

function blit(withSid) {
  const ptr = mod._c64_getPixelBuffer();
  const pix = mod.HEAPU8.slice(ptr, ptr + PIXELS);
  let driveOn = false;
  try {
    driveOn = (mod._c1541_getStatus() & 0xff) !== 0;
  } catch {
    /* */
  }
  postMessage({ type: "frame", pix, drive: driveOn }, [pix.buffer]);
  if (!withSid) return;
  try {
    const sidPtr = mod._sid_getAudioBuffer();
    const speed = Math.min(100, Math.max(10, emuSpeed));
    const intervalMs = (PAL_MS * 100) / speed;
    const n = Math.max(
      1,
      Math.min(4096, Math.round((sidRate * intervalMs) / 1000)),
    );
    const sid = mod.HEAPF32.slice(sidPtr >> 2, (sidPtr >> 2) + n);
    postMessage({ type: "sid", samples: sid }, [sid.buffer]);
  } catch {
    /* */
  }
}

function copyBytes(bytes) {
  const ptr = mod._malloc(bytes.byteLength);
  mod.HEAPU8.set(bytes, ptr);
  return ptr;
}

onmessage = (event) => {
  const msg = event.data;
  if (!msg || !msg.type) return;
  try {
    if (msg.type === "boot") {
      importScripts("c64.js");
      boot();
      return;
    }
    if (!mod) return;
    switch (msg.type) {
      case "tick":
        break;
      case "speed": {
        const n = Number(msg.value);
        if (Number.isFinite(n)) emuSpeed = Math.min(100, Math.max(10, Math.round(n)));
        cpuAcc = 0;
        nextDue = performance.now();
        break;
      }
      case "pause":
        paused = Boolean(msg.paused);
        try {
          if (paused) mod._debugger_pause();
          else mod._debugger_play();
        } catch {
          /* */
        }
        if (!paused) {
          nextDue = performance.now();
          schedule(0);
        }
        break;
      case "sidRate":
        try {
          sidRate = msg.rate || 44100;
          mod._sid_setSampleRate(sidRate);
        } catch {
          /* */
        }
        break;
      case "reset":
        mod._c64_reset();
        try {
          mod._debugger_play();
        } catch {
          /* */
        }
        nextDue = performance.now();
        break;
      case "keyDown":
        mod._keyboard_keyPressed(msg.index);
        break;
      case "keyUp":
        mod._keyboard_keyReleased(msg.index);
        break;
      case "joyPush":
        mod._c64_joystick_push(1, msg.mask);
        break;
      case "joyRelease":
        mod._c64_joystick_release(1, msg.mask);
        break;
      case "insertDisk": {
        const bytes = new Uint8Array(msg.bytes);
        const ptr = copyBytes(bytes);
        mod._c64_insertDisk(ptr, bytes.byteLength);
        break;
      }
      case "loadPrg": {
        const bytes = new Uint8Array(msg.bytes);
        const ptr = copyBytes(bytes);
        mod._c64_loadPRG(ptr, bytes.byteLength, msg.inject ? 1 : 0);
        mod._free(ptr);
        break;
      }
      case "loadCrt": {
        const bytes = new Uint8Array(msg.bytes);
        const ptr = copyBytes(bytes);
        mod._c64_loadCartridge(ptr, bytes.byteLength);
        mod._free(ptr);
        break;
      }
      case "removeCrt":
        mod._c64_removeCartridge();
        break;
      case "cpuWrite":
        mod._c64_cpuWrite(msg.addr, msg.value);
        break;
      case "cpuRead":
        postMessage({ type: "cpuRead", id: msg.id, value: mod._c64_cpuRead(msg.addr) });
        break;
      case "ramReadRange": {
        const out = new Uint8Array(msg.len);
        for (let i = 0; i < msg.len; i++) out[i] = mod._c64_ramRead(msg.addr + i);
        postMessage({ type: "ramReadRange", id: msg.id, bytes: out }, [out.buffer]);
        break;
      }
      case "drive":
        postMessage({ type: "drive", on: (mod._c1541_getStatus() & 0xff) !== 0 });
        break;
      case "stop":
        stopClock();
        break;
      default:
        break;
    }
  } catch (err) {
    postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
