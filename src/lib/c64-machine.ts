import { asset } from "@/lib/asset";
import { createC64Audio, type SidAudio } from "@/lib/c64-audio";
import type { DiskAudio } from "@/lib/disk-audio";
import { readScreenFromBytes } from "@/lib/c64-screen";
import type { C64Module } from "@/lib/c64-types";

const WIDTH = 384;
const HEIGHT = 272;

export type C64Machine = {
  mod: C64Module | null;
  audio: SidAudio;
  diskSfx: DiskAudio;
  canvas: HTMLCanvasElement;
  diskBytes: Uint8Array | null;
  diskName: string;
  tick: (dt: number) => void;
  blit: () => void;
  reset: () => void;
  pause: (paused: boolean) => void;
  setSpeed: (percent: number) => void;
  insertDisk: (bytes: Uint8Array, name: string) => void;
  loadPrg: (bytes: Uint8Array, inject?: boolean) => void;
  loadCrt: (bytes: Uint8Array) => void;
  removeCrt: () => void;
  keyDown: (index: number) => void;
  keyUp: (index: number) => void;
  joyPush: (mask: number) => void;
  joyRelease: (mask: number) => void;
  paste: (text: string) => void;
  processPaste: () => void;
  screen: () => string;
  dumpBasic: () => Uint8Array | null;
  driveOn: () => boolean;
  setPopoutCanvas: (canvas: HTMLCanvasElement | null) => void;
  close: () => void;
};

declare global {
  interface Window {
    c64_frame?: () => void;
    C64?: (opts?: Record<string, unknown>) => C64Module;
    __c64?: C64Machine;
  }
}

type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
};

export async function createMachine(canvas: HTMLCanvasElement): Promise<C64Machine> {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D canvas");
  const gfx = ctx;
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const imageData = gfx.createImageData(WIDTH, HEIGHT);

  const previous = (window as unknown as { __c64Worker?: Worker }).__c64Worker;
  try {
    previous?.terminate();
  } catch {
    /* */
  }
  const worker = new Worker(`${asset("/emu/c64-worker.js")}?v=sidquiet`);
  (window as unknown as { __c64Worker?: Worker }).__c64Worker = worker;
  const audio = createC64Audio();
  const pending = new Map<number, Pending>();
  let nextId = 1;
  let screenCache = "";
  let spinning = false;
  let wasSpinning = false;
  let closed = false;
  let ticks = 0;
  let popoutGfx: CanvasRenderingContext2D | null = null;
  let popoutImage: ImageData | null = null;
  const pasteQueue: number[] = [];
  let bufLen = 0;

  function rpc(type: string, extra?: Record<string, unknown>): Promise<unknown> {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage({ type, id, ...extra });
    });
  }

  worker.onmessage = (event) => {
    const msg = event.data;
    if (!msg) return;
    if (msg.type === "frame") {
      const pix = msg.pix as Uint8Array;
      const out = imageData.data;
      out.set(pix);
      for (let i = 3; i < out.length; i += 4) out[i] = 255;
      gfx.putImageData(imageData, 0, 0);
      if (popoutGfx) {
        popoutGfx.imageSmoothingEnabled = false;
        try {
          popoutGfx.drawImage(canvas, 0, 0);
        } catch {
          if (popoutImage) {
            popoutImage.data.set(imageData.data);
            popoutGfx.putImageData(popoutImage, 0, 0);
          }
        }
      }
      if (typeof msg.drive === "boolean") {
        spinning = msg.drive;
        if (spinning !== wasSpinning) {
          audio.motor(spinning);
          wasSpinning = spinning;
        }
        if (spinning) audio.seek();
      }
      return;
    }
    if (msg.type === "sid") {
      audio.pushSid(msg.samples as Float32Array);
      return;
    }
    if (msg.type === "drive") {
      spinning = Boolean(msg.on);
      if (spinning !== wasSpinning) {
        audio.motor(spinning);
        wasSpinning = spinning;
      }
      if (spinning) audio.seek();
      return;
    }
    if (msg.type === "cpuRead") {
      pending.get(msg.id)?.resolve(msg.value);
      pending.delete(msg.id);
      return;
    }
    if (msg.type === "ramReadRange") {
      pending.get(msg.id)?.resolve(msg.bytes);
      pending.delete(msg.id);
      return;
    }
    if (msg.type === "stats") {
      console.info("c64 frame", msg);
      return;
    }
    if (msg.type === "error") {
      console.error("c64-worker", msg.message);
      return;
    }
    if (msg.type === "ready") {
      pending.get(0)?.resolve(true);
      pending.delete(0);
    }
  };

  const ready = new Promise<void>((resolve, reject) => {
    pending.set(0, {
      resolve: () => resolve(),
      reject,
    });
    window.setTimeout(() => reject(new Error("C64 worker did not boot")), 20000);
  });
  worker.postMessage({ type: "boot" });
  await ready;
  worker.postMessage({ type: "sidRate", rate: audio.sampleRate() });

  async function refreshScreen() {
    const bytes = (await rpc("ramReadRange", { addr: 0x0400, len: 1000 })) as Uint8Array;
    screenCache = readScreenFromBytes(bytes);
  }

  async function pumpPaste() {
    if (!pasteQueue.length) return;
    const len = (await rpc("cpuRead", { addr: 0xc6 })) as number;
    bufLen = len;
    if (len !== 0) return;
    const n = Math.min(8, pasteQueue.length);
    worker.postMessage({ type: "cpuWrite", addr: 0xc6, value: n });
    for (let i = 0; i < n; i++) {
      worker.postMessage({ type: "cpuWrite", addr: 0x277 + i, value: pasteQueue.shift() });
    }
  }

  const machine: C64Machine = {
    mod: null,
    audio,
    diskSfx: audio.diskSfx,
    canvas,
    diskBytes: null,
    diskName: "Empty",
    tick(_dt) {
      if (closed) return;
      ticks += 1;
      if (pasteQueue.length) void pumpPaste();
      if (ticks % 8 === 0) void refreshScreen();
    },
    blit() {},
    reset() {
      pasteQueue.length = 0;
      screenCache = "";
      worker.postMessage({ type: "reset" });
    },
    pause(paused) {
      worker.postMessage({ type: "pause", paused });
    },
    setSpeed(percent) {
      worker.postMessage({ type: "speed", value: percent });
    },
    insertDisk(bytes, name) {
      const copy = new Uint8Array(bytes);
      machine.diskBytes = copy;
      machine.diskName = name;
      worker.postMessage({ type: "insertDisk", bytes: copy });
      audio.motor(true);
    },
    loadPrg(bytes, inject = true) {
      worker.postMessage({ type: "loadPrg", bytes: new Uint8Array(bytes), inject });
    },
    loadCrt(bytes) {
      worker.postMessage({ type: "loadCrt", bytes: new Uint8Array(bytes) });
    },
    removeCrt() {
      worker.postMessage({ type: "removeCrt" });
    },
    keyDown(index) {
      audio.key();
      worker.postMessage({ type: "keyDown", index });
    },
    keyUp(index) {
      worker.postMessage({ type: "keyUp", index });
    },
    joyPush(mask) {
      worker.postMessage({ type: "joyPush", mask });
    },
    joyRelease(mask) {
      worker.postMessage({ type: "joyRelease", mask });
    },
    paste(text) {
      const upper = text.replace(/\r\n/g, "\n");
      for (const ch of upper) {
        let code = ch.charCodeAt(0);
        if (code === 10) code = 13;
        pasteQueue.push(code);
      }
    },
    processPaste() {
      void pumpPaste();
    },
    screen() {
      void refreshScreen();
      return screenCache;
    },
    dumpBasic() {
      return null;
    },
    driveOn() {
      return spinning;
    },
    setPopoutCanvas(next) {
      if (!next) {
        popoutGfx = null;
        popoutImage = null;
        return;
      }
      next.width = WIDTH;
      next.height = HEIGHT;
      const ctx = next.getContext("2d", { alpha: false });
      if (!ctx) {
        popoutGfx = null;
        popoutImage = null;
        return;
      }
      popoutGfx = ctx;
      popoutGfx.imageSmoothingEnabled = false;
      try {
        popoutImage = ctx.createImageData(WIDTH, HEIGHT);
      } catch {
        popoutImage = null;
      }
      try {
        ctx.drawImage(canvas, 0, 0);
      } catch {
        /* first frame will fill */
      }
    },
    close() {
      closed = true;
      audio.close();
      worker.terminate();
      const slot = window as unknown as { __c64Worker?: Worker };
      if (slot.__c64Worker === worker) delete slot.__c64Worker;
    },
  };

  void refreshScreen();
  return machine;
}
