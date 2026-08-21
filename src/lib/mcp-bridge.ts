import { CATALOG } from "@/lib/catalog";
import { resumeAllAudio } from "@/lib/c64-audio";
import { K } from "@/lib/c64-keys";
import type { C64Machine } from "@/lib/c64-machine";
import { useEmu } from "@/lib/emu-store";

const PORT = 9878;
const BASE = `http://127.0.0.1:${PORT}`;

type Cmd = { id: string; name: string; args: Record<string, unknown> };

function machine(): C64Machine | undefined {
  return (window as unknown as { __c64?: C64Machine }).__c64;
}

function snapshot() {
  const emu = useEmu.getState();
  const m = machine();
  let text = "";
  try {
    text = m?.screen() ?? "";
  } catch {
    text = "";
  }
  return {
    connected: Boolean(m),
    loadedId: emu.loadedId,
    loadingId: emu.loadingId,
    bootPhase: emu.bootPhase,
    status: emu.status,
    paused: emu.paused,
    muted: emu.muted,
    drive: { on: emu.drive1On, name: emu.drive1Name },
    text: text.replace(/[\u007f]+/g, "").trim(),
    pc: 0,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitPhase(timeoutMs: number, loadedId?: string) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const s = useEmu.getState();
    if (!loadedId) {
      if (s.bootPhase === "running" || s.bootPhase === "error") return snapshot();
    } else if (
      s.loadedId === loadedId &&
      (s.bootPhase === "running" || s.bootPhase === "error")
    ) {
      return snapshot();
    }
    await sleep(150);
  }
  return snapshot();
}

const KEYS: Record<string, number> = {
  return: K.RETURN,
  enter: K.RETURN,
  esc: K.RUN_STOP,
  escape: K.RUN_STOP,
  runstop: K.RUN_STOP,
  tab: K.CTRL,
  delete: K.DEL,
  backspace: K.DEL,
  left: K.CURSOR_LR,
  right: K.CURSOR_LR,
  up: K.CURSOR_UD,
  down: K.CURSOR_UD,
  space: K.SPACE,
  f1: K.F1,
  f3: K.F3,
  f5: K.F5,
  f7: K.F7,
  commodore: K.COMMODORE,
};

async function runCmd(cmd: Cmd): Promise<unknown> {
  const m = machine();
  const emu = useEmu.getState();
  switch (cmd.name) {
    case "status":
      return snapshot();
    case "catalog":
      return CATALOG.map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        year: t.year ?? null,
        featured: Boolean(t.featured),
      }));
    case "insert": {
      const id = String(cmd.args.id || "");
      if (!id) throw new Error("id required");
      resumeAllAudio();
      emu.requestLoad(id);
      return waitPhase(22000, id);
    }
    case "eject":
      resumeAllAudio();
      emu.requestEject();
      return waitPhase(12000, "basic");
    case "type": {
      if (!m) throw new Error("C64 is not powered on");
      let text = String(cmd.args.text ?? "");
      if (cmd.args.return) text += "\r";
      m.paste(text);
      return { typed: text.replace(/\r/g, "\\r") };
    }
    case "key": {
      if (!m) throw new Error("C64 is not powered on");
      const name = String(cmd.args.name || "").toLowerCase();
      const code = KEYS[name];
      if (code == null) throw new Error(`unknown key ${name}`);
      if (name === "left" || name === "up") m.keyDown(K.SHIFT_LEFT);
      m.keyDown(code);
      window.setTimeout(() => {
        m.keyUp(code);
        if (name === "left" || name === "up") m.keyUp(K.SHIFT_LEFT);
      }, 50);
      return { key: name, code };
    }
    case "reset":
      if (!m) throw new Error("C64 is not powered on");
      m.reset();
      return { reset: true };
    case "wait":
      return waitPhase(Number(cmd.args.timeout_ms) || 15000);
    case "screenshot": {
      const canvas = document.querySelector("canvas.c64-screen");
      if (!(canvas instanceof HTMLCanvasElement)) throw new Error("no CRT");
      const jpeg = await new Promise<string>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("screenshot failed"));
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              const url = String(reader.result || "");
              resolve((url.split(",")[1] as string) || "");
            };
            reader.onerror = () => reject(new Error("screenshot read failed"));
            reader.readAsDataURL(blob);
          },
          "image/jpeg",
          0.55,
        );
      });
      return { ...snapshot(), jpeg };
    }
    default:
      throw new Error(`unknown command ${cmd.name}`);
  }
}

async function pollLoop(stop: () => boolean) {
  while (!stop()) {
    try {
      const res = await fetch(`${BASE}/poll`, { method: "GET" });
      if (stop()) return;
      if (res.status === 204) continue;
      if (!res.ok) {
        await sleep(1500);
        continue;
      }
      const cmd = (await res.json()) as Cmd;
      resumeAllAudio();
      useEmu.getState().beginMcp();
      (
        window as unknown as { __c64?: { audio?: { whoosh: () => void } } }
      ).__c64?.audio?.whoosh();
      let payload: { id: string; ok: boolean; result?: unknown; error?: string };
      try {
        const result = await runCmd(cmd);
        payload = { id: cmd.id, ok: true, result };
      } catch (err) {
        payload = {
          id: cmd.id,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      } finally {
        useEmu.getState().endMcp();
      }
      await fetch(`${BASE}/result`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      await sleep(2000);
    }
  }
}

export function startMcpBridge() {
  if (typeof window === "undefined") return () => {};
  if (window.location.hostname !== "127.0.0.1" && window.location.hostname !== "localhost") {
    return () => {};
  }
  let stopped = false;
  void pollLoop(() => stopped);
  return () => {
    stopped = true;
  };
}
