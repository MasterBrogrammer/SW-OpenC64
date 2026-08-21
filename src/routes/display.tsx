import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Maximize2, Minimize2, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { C64Machine } from "@/lib/c64-machine";
import { JOY, K, joyFromCode, mapBrowserKey } from "@/lib/c64-keys";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/display")({ component: DisplayPage });

type Opener = Window & { __c64?: C64Machine };

function DisplayPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [full, setFull] = useState(false);
  const [style, setStyle] = useState({
    color: true,
    scanlines: true,
    invert: false,
    joystick: false,
  });

  useEffect(() => {
    const opener = window.opener as Opener | null;
    if (!opener || opener.closed) return;
    const origin = window.location.origin;
    const announce = window.requestAnimationFrame(() => {
      opener.postMessage({ type: "oc64-display-ready" }, origin);
      canvasRef.current?.focus();
    });

    const onMsg = (event: MessageEvent) => {
      if (event.origin !== origin) return;
      const data = event.data as {
        type?: string;
        color?: boolean;
        scanlines?: boolean;
        invert?: boolean;
        joystick?: boolean;
      };
      if (!data || typeof data !== "object") return;
      if (data.type === "oc64-display-style") {
        setStyle({
          color: data.color !== false,
          scanlines: data.scanlines !== false,
          invert: Boolean(data.invert),
          joystick: Boolean(data.joystick),
        });
      }
      if (data.type === "oc64-display-close") window.close();
    };
    const onGone = () => {
      opener.postMessage({ type: "oc64-display-gone" }, origin);
    };
    const onFs = () => setFull(Boolean(document.fullscreenElement));

    window.addEventListener("message", onMsg);
    window.addEventListener("beforeunload", onGone);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.cancelAnimationFrame(announce);
      window.removeEventListener("message", onMsg);
      window.removeEventListener("beforeunload", onGone);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, []);

  useEffect(() => {
    const opener = window.opener as Opener | null;
    const held = new Set<number>();
    const joyHeld = new Set<number>();

    function machine() {
      return opener && !opener.closed ? opener.__c64 : undefined;
    }

    function onKeyDown(event: KeyboardEvent) {
      const m = machine();
      if (!m) return;
      if (event.repeat) {
        event.preventDefault();
        return;
      }
      if (style.joystick) {
        const mask = joyFromCode(event.code);
        if (mask != null) {
          event.preventDefault();
          m.joyPush(mask);
          joyHeld.add(mask);
          return;
        }
      }
      const hit = mapBrowserKey(event);
      if (!hit) return;
      event.preventDefault();
      if (hit.shift) m.keyDown(K.SHIFT_LEFT);
      m.keyDown(hit.index);
      held.add(hit.index);
    }

    function onKeyUp(event: KeyboardEvent) {
      const m = machine();
      if (!m) return;
      const mask = joyFromCode(event.code);
      if (mask != null && joyHeld.has(mask)) {
        m.joyRelease(mask);
        joyHeld.delete(mask);
      }
      const hit = mapBrowserKey(event);
      if (hit) {
        m.keyUp(hit.index);
        held.delete(hit.index);
        if (hit.shift) m.keyUp(K.SHIFT_LEFT);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [style.joystick]);

  const openerOk = typeof window !== "undefined" && window.opener && !window.opener.closed;

  async function toggleFull() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* */
    }
  }

  function dock() {
    const opener = window.opener as Opener | null;
    if (opener && !opener.closed) {
      opener.focus();
      opener.postMessage({ type: "oc64-display-gone" }, window.location.origin);
    }
    window.close();
  }

  return (
    <div className="flex h-dvh flex-col bg-bg text-fg">
      <header
        className={cn(
          "flex shrink-0 items-center gap-2 border-b border-border px-3 py-2",
          full && "hidden",
        )}
      >
        <span className="font-mono text-xs tracking-wide text-accent">C=</span>
        <span className="text-sm font-medium">SW-OpenC64 display</span>
        <span className="hidden text-xs text-muted sm:inline">Keys go to the 64</span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => void toggleFull()}
          >
            {full ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            {full ? "Windowed" : "Fullscreen"}
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={dock}>
            <PanelLeft className="size-3.5" />
            Back to interface
          </Button>
        </div>
      </header>
      <main className="relative min-h-0 flex-1 bg-bg">
        <div className="flex h-full w-full items-center justify-center p-3">
          <div
            className={cn(
              "screen-bezel overflow-hidden rounded-md",
              style.scanlines && "scanlines",
            )}
            style={{
              aspectRatio: "384 / 272",
              height: "100%",
              width: "auto",
              maxWidth: "100%",
            }}
          >
            <canvas
              ref={canvasRef}
              width={384}
              height={272}
              tabIndex={0}
              className={cn(
                "c64-screen block h-full w-full outline-none",
                !style.color && "mono",
                style.invert && "invert",
              )}
              onPointerDown={(event) => {
                event.preventDefault();
                const m = (window.opener as Opener | null)?.__c64;
                canvasRef.current?.focus();
                m?.audio.resume();
                if (style.joystick) m?.joyPush(JOY.FIRE);
              }}
              onPointerUp={() => {
                if (style.joystick) {
                  (window.opener as Opener | null)?.__c64?.joyRelease(JOY.FIRE);
                }
              }}
              onContextMenu={(event) => event.preventDefault()}
            />
          </div>
        </div>
        {!openerOk ? (
          <div className="absolute inset-0 grid place-items-center bg-bg px-6 text-center">
            <p className="max-w-sm text-sm text-muted">
              Open this from SW-OpenC64 with Pop out display. The CRT lives in the
              main window until then.
            </p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
