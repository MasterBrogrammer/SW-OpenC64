import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Contrast,
  Gamepad2,
  Monitor,
  Pause,
  PictureInPicture2,
  Play,
  Power,
  RotateCcw,
  Save,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SoftKeyboard } from "@/components/soft-keyboard";
import { WozModeBadge } from "@/components/wozmode-badge";
import { loadStarAndRun, waitReady } from "@/lib/boot-exec";
import { asset } from "@/lib/asset";
import { BOOT_WITH, getTitle, type Title } from "@/lib/catalog";
import { resumeAllAudio } from "@/lib/c64-audio";
import { JOY, K, joyFromCode, mapBrowserKey } from "@/lib/c64-keys";
import { createMachine, type C64Machine } from "@/lib/c64-machine";
import { openCrtPopout } from "@/lib/crt-popout";
import { screenHasReady } from "@/lib/c64-screen";
import { useEmu } from "@/lib/emu-store";
import { pushRecent, readVolume, writeVolume } from "@/lib/local-prefs";
import {
  getUserDiskBytes,
  parseUserTitleId,
  saveUserDisk,
  userTitleId,
} from "@/lib/user-disks";
import { cn } from "@/lib/utils";

let loadGeneration = 0;

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function slug(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 28) || "saved"
  );
}

async function saveBasic(machine: C64Machine) {
  const emu = useEmu.getState();
  const prg = machine.dumpBasic();
  if (!prg || prg.byteLength < 6) {
    emu.setStatus("No BASIC program in memory — type one, then Save BASIC");
    return;
  }
  const name = emu.loadedId === "basic" ? "BASIC program" : (emu.drive1Name || "BASIC program");
  const saved = await saveUserDisk({
    name,
    filename: `${slug(name)}.prg`,
    bytes: Uint8Array.from(prg).buffer,
    kind: "prg",
    format: "prg",
  });
  emu.setLoaded(userTitleId(saved.id), saved.name);
  emu.setStatus(`Saved ${saved.name} into Mine`);
  window.dispatchEvent(
    new CustomEvent("oc-disk-saved", { detail: { id: saved.id, name: saved.name } }),
  );
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(asset(url));
  if (!res.ok) throw new Error(`Could not fetch ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function loadTitle(machine: C64Machine, id: string) {
  const gen = ++loadGeneration;
  const cancelled = () => gen !== loadGeneration;
  const emu = useEmu.getState();
  emu.setLoading(id);
  emu.setBootPhase("loading");
  emu.setLoadError(null);
  machine.audio.motor(true);
  emu.setJoystick(false);
  machine.removeCrt();

  try {
    const userId = parseUserTitleId(id);
    if (userId) {
      const row = await getUserDiskBytes(userId);
      if (!row) throw new Error("That file is gone from Mine");
      if (cancelled()) return;
      const bytes = new Uint8Array(row.bytes);
      machine.reset();
      if (row.kind === "prg") {
        emu.setStatus(`Loading ${row.name}…`);
        const ready = await waitReady(machine, cancelled);
        if (!ready || cancelled()) return;
        machine.loadPrg(bytes, true);
        await sleep(400);
        if (screenHasReady(machine.screen())) machine.paste("RUN\r");
        emu.setLoaded(id, row.name);
        emu.setDriveName(row.name);
        emu.setJoystick(false);
      } else if (row.kind === "crt") {
        machine.loadCrt(bytes);
        machine.reset();
        emu.setLoaded(id, row.name);
        emu.setDriveName(row.name);
        emu.setJoystick(true);
      } else {
        machine.insertDisk(bytes, row.name);
        machine.reset();
        emu.setDriveName(row.name);
        await loadStarAndRun(machine, cancelled);
        if (cancelled()) return;
        emu.setLoaded(id, row.name);
        emu.setJoystick(true);
      }
      emu.setBootPhase("running");
      emu.setStatus(row.name);
      pushRecent(id);
      return;
    }

    const title: Title | undefined = getTitle(id) ?? getTitle("basic");
    if (!title) throw new Error(`Unknown title ${id}`);
    emu.setJoystick(Boolean(title.joystick));
    machine.reset();

    if (title.media.kind === "none") {
      await waitReady(machine, cancelled);
      if (cancelled()) return;
      emu.setLoaded(title.id, "Empty");
      emu.setBootPhase("running");
      emu.setStatus("READY.");
      return;
    }

    if (title.media.kind === "prg") {
      emu.setStatus(`Loading ${title.name}…`);
      const bytes = await fetchBytes(title.media.url);
      if (cancelled()) return;
      const ready = await waitReady(machine, cancelled);
      if (!ready || cancelled()) return;
      machine.loadPrg(bytes, true);
      await sleep(500);
      if (screenHasReady(machine.screen())) machine.paste("RUN\r");
      emu.setLoaded(title.id, title.name);
      emu.setDriveName(title.name);
      emu.setBootPhase("running");
      emu.setStatus(title.play ?? title.name);
      return;
    }

    if (title.media.kind === "crt") {
      const bytes = await fetchBytes(title.media.url);
      if (cancelled()) return;
      machine.loadCrt(bytes);
      machine.reset();
      emu.setLoaded(title.id, title.name);
      emu.setDriveName(title.name);
      emu.setBootPhase("running");
      emu.setStatus(title.play ?? title.name);
      return;
    }

    const bytes = await fetchBytes(title.media.url);
    if (cancelled()) return;
    machine.insertDisk(bytes, title.name);
    machine.reset();
    emu.setDriveName(title.name);
    if (title.bootSteps?.length) {
      await waitReady(machine, cancelled);
      for (const step of title.bootSteps) {
        if (cancelled()) return;
        if (step.waitMs) await sleep(step.waitMs);
        if (step.type) machine.paste(step.type);
      }
    } else {
      await loadStarAndRun(machine, cancelled);
    }
    if (cancelled()) return;
    emu.setLoaded(title.id, title.name);
    emu.setBootPhase("running");
    emu.setStatus(title.play ?? title.name);
  } catch (err) {
    if (cancelled()) return;
    const message = err instanceof Error ? err.message : "Could not load that title";
    emu.setLoadError(message);
    emu.setBootPhase("error");
    emu.setStatus(message);
  }
}

export function EmulatorScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const machineRef = useRef<C64Machine | null>(null);
  const popoutRef = useRef<Window | null>(null);
  const [poppedOut, setPoppedOut] = useState(false);
  const pending = useEmu((s) => s.pendingLoad);
  const pendingNonce = pending?.nonce ?? 0;
  const paused = useEmu((s) => s.paused);
  const color = useEmu((s) => s.color);
  const scanlines = useEmu((s) => s.scanlines);
  const invert = useEmu((s) => s.invert);
  const volume = useEmu((s) => s.volume);
  const focused = useEmu((s) => s.focused);
  const joystick = useEmu((s) => s.joystick);
  const drive1On = useEmu((s) => s.drive1On);
  const drive1Name = useEmu((s) => s.drive1Name);
  const status = useEmu((s) => s.status);
  const loadedId = useEmu((s) => s.loadedId);
  const loadingId = useEmu((s) => s.loadingId);
  const booted = useEmu((s) => s.booted);
  const bootPhase = useEmu((s) => s.bootPhase);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let raf = 0;
    let last = performance.now();

    void createMachine(canvas)
      .then(async (machine) => {
        if (cancelled) {
          machine.close();
          return;
        }
        machineRef.current = machine;
        window.__c64 = machine;
        const vol =
          typeof window !== "undefined" ? readVolume() : useEmu.getState().volume;
        useEmu.getState().setVolume(vol);
        useEmu.getState().setMuted(false);
        useEmu.getState().setEmuSpeed(27);
        machine.audio.setMuted(false);
        machine.audio.setVolume(vol / 100);
        machine.setSpeed(27);
        const want =
          useEmu.getState().pendingLoad?.id ??
          useEmu.getState().loadedId ??
          "basic";
        const loop = (t: number) => {
          raf = requestAnimationFrame(loop);
          const dt = Math.min(t - last, 100);
          last = t;
          const m = machineRef.current;
          if (!m) return;
          if (!useEmu.getState().paused) m.tick(dt);
          else m.blit();
          const st = useEmu.getState();
          const spinning = m.driveOn();
          st.setDrive(spinning);
          const loading = st.bootPhase === "loading" || st.bootPhase === "booting";
          m.audio.motor(loading || spinning);
          if (loading || spinning) m.audio.seek();
        };
        raf = requestAnimationFrame(loop);
        await loadTitle(machine, want);
        useEmu.getState().setBooted(true);
        canvas.focus();
        useEmu.getState().setFocused(true);
      })
      .catch((err) => {
        console.error(err);
        useEmu.getState().setStatus(
          err instanceof Error ? err.message : "The C64 failed to power on",
        );
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      useEmu.getState().setBooted(false);
      try {
        popoutRef.current?.close();
      } catch {
        /* */
      }
      popoutRef.current = null;
      machineRef.current?.setPopoutCanvas(null);
      machineRef.current?.close();
      machineRef.current = null;
      if (window.__c64) delete window.__c64;
    };
  }, []);

  useEffect(() => {
    if (!booted || !pending) return;
    const machine = machineRef.current;
    if (!machine) return;
    void loadTitle(machine, pending.id);
  }, [pendingNonce, booted, pending]);

  useEffect(() => {
    machineRef.current?.pause(paused);
  }, [paused]);

  useEffect(() => {
    machineRef.current?.audio.setMuted(false);
  }, []);

  useEffect(() => {
    machineRef.current?.setSpeed(27);
  }, []);

  useEffect(() => {
    const win = popoutRef.current;
    if (!win || win.closed) return;
    win.postMessage(
      {
        type: "oc64-display-style",
        color,
        scanlines,
        invert,
        joystick,
        volume,
        muted: false,
      },
      window.location.origin,
    );
  }, [color, scanlines, invert, joystick, volume, poppedOut]);

  useEffect(() => {
    machineRef.current?.audio.setVolume(volume / 100);
  }, [volume]);

  useEffect(() => {
    const unlock = () => machineRef.current?.audio.resume();
    const opts = { capture: true } as const;
    window.addEventListener("pointerdown", unlock, opts);
    window.addEventListener("pointerup", unlock, opts);
    window.addEventListener("click", unlock, opts);
    window.addEventListener("keydown", unlock, opts);
    return () => {
      window.removeEventListener("pointerdown", unlock, opts);
      window.removeEventListener("pointerup", unlock, opts);
      window.removeEventListener("click", unlock, opts);
      window.removeEventListener("keydown", unlock, opts);
    };
  }, []);

  useEffect(() => {
    const held = new Set<number>();
    const joyHeld = new Set<number>();

    function onKeyDown(event: KeyboardEvent) {
      if (!useEmu.getState().focused) return;
      const machine = machineRef.current;
      if (!machine) return;
      if (event.repeat) {
        event.preventDefault();
        return;
      }
      if (event.ctrlKey && (event.key === "F12" || event.key === "Delete")) {
        event.preventDefault();
        machine.reset();
        return;
      }
      const joyMode = useEmu.getState().joystick;
      if (joyMode) {
        const mask = joyFromCode(event.code);
        if (mask != null) {
          event.preventDefault();
          machine.joyPush(mask);
          joyHeld.add(mask);
          return;
        }
      }
      const hit = mapBrowserKey(event);
      if (!hit) return;
      event.preventDefault();
      if (hit.shift) machine.keyDown(K.SHIFT_LEFT);
      machine.keyDown(hit.index);
      held.add(hit.index);
    }

    function onKeyUp(event: KeyboardEvent) {
      const machine = machineRef.current;
      if (!machine) return;
      const mask = joyFromCode(event.code);
      if (mask != null && joyHeld.has(mask)) {
        machine.joyRelease(mask);
        joyHeld.delete(mask);
      }
      const hit = mapBrowserKey(event);
      if (hit) {
        machine.keyUp(hit.index);
        held.delete(hit.index);
        if (hit.shift) machine.keyUp(K.SHIFT_LEFT);
      }
      if (event.key === "Shift") {
        machine.keyUp(K.SHIFT_LEFT);
        machine.keyUp(K.SHIFT_RIGHT);
      }
    }

    function onBlur() {
      const machine = machineRef.current;
      if (!machine) return;
      for (const idx of held) machine.keyUp(idx);
      held.clear();
      for (const mask of joyHeld) machine.joyRelease(mask);
      joyHeld.clear();
      machine.keyUp(K.SHIFT_LEFT);
      machine.keyUp(K.SHIFT_RIGHT);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  function dockDisplay() {
    const win = popoutRef.current;
    machineRef.current?.audio.setKeepAlive(false);
    machineRef.current?.audio.resume();
    machineRef.current?.setPopoutCanvas(null);
    if (win && !win.closed) {
      try {
        win.postMessage({ type: "oc64-display-close" }, window.location.origin);
        win.close();
      } catch {
        /* */
      }
    }
    popoutRef.current = null;
    setPoppedOut(false);
  }

  function popOutDisplay() {
    resumeAllAudio();
    if (popoutRef.current && !popoutRef.current.closed) {
      popoutRef.current.focus();
      return;
    }
    const win = openCrtPopout();
    if (!win) {
      useEmu.getState().setStatus("Allow pop-ups to pop out the CRT");
      return;
    }
    popoutRef.current = win;
    const origin = window.location.origin;
    const onMsg = (event: MessageEvent) => {
      if (event.origin !== origin) return;
      const type = (event.data as { type?: string } | null)?.type;
      if (type === "oc64-display-ready") {
        const attach = () => {
          const canvas = win.document.querySelector("canvas.c64-screen");
          if (!canvas || canvas.nodeName !== "CANVAS") return false;
          machineRef.current?.setPopoutCanvas(canvas as HTMLCanvasElement);
          machineRef.current?.audio.setKeepAlive(true);
          win.postMessage(
            {
              type: "oc64-display-style",
              color: useEmu.getState().color,
              scanlines: useEmu.getState().scanlines,
              invert: useEmu.getState().invert,
              joystick: useEmu.getState().joystick,
            },
            origin,
          );
          return true;
        };
        if (!attach()) {
          let tries = 0;
          const retry = window.setInterval(() => {
            tries += 1;
            if (attach() || tries > 40) window.clearInterval(retry);
          }, 50);
        }
        setPoppedOut(true);
      }
      if (type === "oc64-display-gone") {
        window.removeEventListener("message", onMsg);
        machineRef.current?.audio.setKeepAlive(false);
        machineRef.current?.audio.resume();
        machineRef.current?.setPopoutCanvas(null);
        popoutRef.current = null;
        setPoppedOut(false);
      }
    };
    window.addEventListener("message", onMsg);
    const poll = window.setInterval(() => {
      if (!popoutRef.current || popoutRef.current.closed) {
        window.clearInterval(poll);
        window.removeEventListener("message", onMsg);
        machineRef.current?.audio.setKeepAlive(false);
        machineRef.current?.audio.resume();
        machineRef.current?.setPopoutCanvas(null);
        popoutRef.current = null;
        setPoppedOut(false);
      }
    }, 400);
    win.addEventListener("load", () => {
      win.document.title = "SW-OpenC64 display";
    });
  }

  const emuStatus = booted && loadedId ? "ready" : booted ? "on" : "loading";

  return (
    <section
      className="flex h-full min-h-0 flex-col rounded-lg bg-surface p-3 shadow-[var(--shadow-border)] sm:p-4"
      data-loaded-id={loadedId ?? ""}
      data-emu-status={emuStatus}
      data-boot-phase={bootPhase}
    >
      <div className="flex min-h-0 flex-1">
        <div className="screen-stage min-w-0 flex-1">
          <div className={cn("screen-bezel rounded-md", scanlines && "scanlines")}>
            <canvas
              ref={canvasRef}
              width={384}
              height={272}
              tabIndex={0}
              className={cn(
                "c64-screen h-full w-full outline-none",
                !color && "mono",
                invert && "invert",
              )}
              onFocus={() => useEmu.getState().setFocused(true)}
              onBlur={() => useEmu.getState().setFocused(false)}
              onPointerDown={(event) => {
                event.preventDefault();
                const canvas = canvasRef.current;
                canvas?.focus();
                machineRef.current?.audio.resume();
                if (useEmu.getState().joystick) {
                  machineRef.current?.joyPush(JOY.FIRE);
                }
              }}
              onPointerUp={() => {
                if (useEmu.getState().joystick) {
                  machineRef.current?.joyRelease(JOY.FIRE);
                }
              }}
              onContextMenu={(event) => event.preventDefault()}
              onClick={() => {
                canvasRef.current?.focus();
                machineRef.current?.audio.resume();
              }}
            />
            {!focused && !poppedOut ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end p-3">
                <span className="rounded-md px-2 py-1 font-mono text-[11px] text-accent/90">
                  Click to type
                </span>
              </div>
            ) : null}
            {poppedOut ? (
              <div className="absolute inset-0 grid place-items-center bg-bg/80 p-4 text-center">
                <div className="flex flex-col items-center gap-2">
                  <p className="font-mono text-xs text-muted">CRT is in another window</p>
                  <Button type="button" size="sm" className="h-8" onClick={dockDisplay}>
                    Bring back
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <aside className="flex w-28 shrink-0 items-end justify-center pb-1 pl-1 sm:w-32">
          <WozModeBadge />
        </aside>
      </div>

      <div className="mt-3 flex shrink-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex min-w-0 items-center gap-2 rounded-md bg-raised px-2.5 py-1.5 font-mono text-[11px] text-muted">
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                drive1On
                  ? "bg-accent shadow-[0_0_8px_var(--color-accent)]"
                  : "bg-border",
              )}
            />
            <span className="shrink-0 text-[10px] tracking-wide uppercase">8:</span>
            <span className="truncate text-fg">{drive1Name}</span>
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2"
            title="Boot a formatted blank 1541 disk"
            onClick={() => {
              resumeAllAudio();
              useEmu.getState().requestLoad("blank-d64");
            }}
          >
            Blank
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2"
            title="Save the BASIC program in memory into Mine"
            onClick={() => {
              const machine = machineRef.current;
              if (machine) void saveBasic(machine);
            }}
          >
            <Save className="size-3.5" />
            Save BASIC
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => useEmu.getState().requestEject()}
          >
            <Power className="size-3.5" />
            Eject / reset
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] tracking-wide text-muted uppercase">
            Boot with
          </span>
          {BOOT_WITH.map((os) => {
            const active = loadedId === os.id;
            return (
              <button
                key={os.id}
                type="button"
                data-boot-with={os.id}
                disabled={loadingId === os.id}
                onClick={() => {
                  resumeAllAudio();
                  useEmu.getState().requestLoad(os.id);
                }}
                className={cn(
                  "h-7 rounded-md px-2 font-mono text-[11px]",
                  active
                    ? "bg-accent text-accent-fg"
                    : "bg-raised text-muted hover:text-fg",
                )}
              >
                {os.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-xs text-muted">{status}</span>
          <div className="flex flex-wrap items-center gap-1">
            <IconBtn
              label={joystick ? "Joystick port 2 on" : "Joystick port 2 off"}
              onClick={() => useEmu.getState().setJoystick(!joystick)}
            >
              <Gamepad2 className={cn("size-4", joystick && "text-accent")} />
            </IconBtn>
            <IconBtn
              label={color ? "Color" : "Mono"}
              onClick={() => useEmu.getState().setColor(!color)}
            >
              <Monitor className="size-4" />
            </IconBtn>
            <IconBtn
              label="Scanlines"
              onClick={() => useEmu.getState().setScanlines(!scanlines)}
            >
              <ScanLine className="size-4" />
            </IconBtn>
            <IconBtn
              label="Invert"
              onClick={() => useEmu.getState().setInvert(!invert)}
            >
              <Contrast className="size-4" />
            </IconBtn>
            <label className="flex h-10 items-center gap-2 pr-1" title="Volume">
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={volume}
                aria-label="Volume"
                className="h-2 w-24 cursor-pointer appearance-none rounded-full bg-raised accent-accent"
                onChange={(event) => {
                  const next = Number(event.target.value);
                  useEmu.getState().setVolume(next);
                  writeVolume(next);
                  machineRef.current?.audio.resume();
                }}
              />
              <span className="w-8 font-mono text-[11px] tabular-nums text-muted">
                {volume}%
              </span>
            </label>
            <IconBtn
              label={poppedOut ? "Display is popped out" : "Pop out display"}
              onClick={() => {
                resumeAllAudio();
                if (poppedOut) dockDisplay();
                else popOutDisplay();
              }}
            >
              <PictureInPicture2 className={cn("size-4", poppedOut && "text-accent")} />
            </IconBtn>
            <IconBtn
              label={paused ? "Run" : "Pause"}
              onClick={() => useEmu.getState().setPaused(!useEmu.getState().paused)}
            >
              {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
            </IconBtn>
            <IconBtn
              label="Warm reset"
              onClick={() => machineRef.current?.reset()}
            >
              <RotateCcw className="size-4" />
            </IconBtn>
          </div>
        </div>
      </div>

      <SoftKeyboard
        onKey={(index) => machineRef.current?.keyDown(index)}
        onUp={(index) => machineRef.current?.keyUp(index)}
      />
    </section>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
