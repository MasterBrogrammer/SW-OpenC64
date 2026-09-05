import { Power, Volume2, VolumeX } from "lucide-react";
import { MobileTap } from "@/components/mobile-play-shell";
import { SoftwareLibrary } from "@/components/software-library";
import { BOOT_WITH } from "@/lib/catalog";
import { resumeAllAudio } from "@/lib/c64-audio";
import { useEmu } from "@/lib/emu-store";
import { writeVolume } from "@/lib/local-prefs";
import { cn } from "@/lib/utils";

/**
 * Thin C64 adapter for the shared mobile chrome sheet.
 * Volume + mute, essential disk/load. No speed / SID / rumble / badge.
 */
export function MobileC64Chrome() {
  const muted = useEmu((s) => s.muted);
  const volume = useEmu((s) => s.volume);
  const status = useEmu((s) => s.status);
  const loadedId = useEmu((s) => s.loadedId);
  const loadingId = useEmu((s) => s.loadingId);
  const drive1Name = useEmu((s) => s.drive1Name);
  const drive1On = useEmu((s) => s.drive1On);

  return (
    <div className="flex min-h-0 flex-col gap-3 pt-1">
      <section
        className="flex min-h-0 flex-1 flex-col gap-2"
        aria-labelledby="mobile-disks-heading"
      >
        <h2
          id="mobile-disks-heading"
          className="text-[10px] tracking-wide text-muted uppercase"
        >
          Disks
        </h2>
        <div className="mobile-library-list min-h-[40vh] flex-1 overflow-hidden rounded-md border border-border">
          <SoftwareLibrary />
        </div>
      </section>

      <section
        className="flex shrink-0 flex-col gap-3"
        aria-labelledby="mobile-machine-heading"
      >
        <h2
          id="mobile-machine-heading"
          className="text-[10px] tracking-wide text-muted uppercase"
        >
          Machine
        </h2>
        <p className="truncate text-xs text-muted" title={status}>
          {status}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md bg-raised px-3 font-mono text-[11px] text-muted"
            title="Drive 8"
          >
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
          <MobileTap
            label="Eject / reset"
            onClick={() => {
              resumeAllAudio();
              useEmu.getState().requestEject();
            }}
          >
            <Power className="size-4" />
            Reset
          </MobileTap>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <MobileTap
            label={muted ? "Unmute" : "Mute"}
            active={!muted}
            onClick={() => useEmu.getState().setMuted(!muted)}
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </MobileTap>
          <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-md bg-raised px-3">
            <span className="sr-only">Volume</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={volume}
              aria-label="Volume"
              className="h-2 w-full min-w-0 cursor-pointer appearance-none rounded-full bg-border accent-accent"
              onChange={(event) => {
                const next = Number(event.target.value);
                useEmu.getState().setVolume(next);
                writeVolume(next);
                resumeAllAudio();
              }}
            />
            <span className="w-8 shrink-0 font-mono text-[11px] tabular-nums text-muted">
              {volume}%
            </span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] tracking-wide text-muted uppercase">Load</span>
          {BOOT_WITH.map((os) => {
            const active = loadedId === os.id;
            return (
              <MobileTap
                key={os.id}
                label={`Load ${os.label}`}
                active={active}
                onClick={() => {
                  resumeAllAudio();
                  useEmu.getState().requestLoad(os.id);
                }}
                className={cn(loadingId === os.id && "opacity-60")}
              >
                {os.label}
              </MobileTap>
            );
          })}
          <MobileTap
            label="Blank disk"
            onClick={() => {
              resumeAllAudio();
              useEmu.getState().requestLoad("blank-d64");
            }}
          >
            Blank
          </MobileTap>
        </div>
      </section>
    </div>
  );
}
