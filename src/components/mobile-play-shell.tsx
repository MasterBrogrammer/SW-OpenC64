import { useEffect, useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared mobile play shell (frozen brief v2):
 * CRT-first portrait, contain-to-width (shrink beats clip),
 * collapsible chrome (default collapsed) with Library/Disks cue,
 * landscape = rotate-to-portrait only. Desktop callers keep their layout.
 */
export function MobilePlayShell({
  crt,
  chrome,
  brand,
  sheetLabel = "Library",
  badge,
  className,
}: {
  crt: ReactNode;
  chrome: ReactNode;
  /** Short label shown on the collapsed handle, e.g. "][" or "C=". */
  brand: string;
  /** Collapsed/open sheet noun — "Library" (Apple) or "Disks" (C64). */
  sheetLabel?: string;
  /** Optional count badge next to the sheet label when collapsed. */
  badge?: number | string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [landscape, setLandscape] = useState(false);
  const panelId = useId();

  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape)");
    const sync = () => setLandscape(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (landscape) {
    return (
      <div
        className={cn(
          "mobile-play-shell mobile-play-shell-landscape flex h-dvh max-h-dvh flex-col items-center justify-center overflow-hidden bg-bg px-6",
          className,
        )}
        data-orientation="landscape"
      >
        <p className="max-w-xs text-center text-sm leading-relaxed text-muted">
          Rotate to portrait to play
        </p>
      </div>
    );
  }

  const badgeText =
    badge === undefined || badge === null || badge === ""
      ? null
      : String(badge);

  return (
    <div
      className={cn(
        "mobile-play-shell flex h-dvh max-h-dvh flex-col overflow-hidden bg-bg",
        className,
      )}
      data-chrome={open ? "open" : "collapsed"}
      data-orientation="portrait"
    >
      <div className="mobile-crt-stage relative min-h-0 flex-1 px-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        {crt}
      </div>

      {open ? (
        <button
          type="button"
          aria-label={`Close ${sheetLabel}`}
          className="mobile-chrome-scrim absolute inset-0 z-20 bg-bg/50"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div
        className={cn(
          "mobile-chrome-sheet z-30 flex shrink-0 flex-col border-t border-border bg-surface",
          open && "mobile-chrome-sheet-open",
        )}
      >
        <button
          type="button"
          className="mobile-chrome-handle flex h-11 w-full shrink-0 items-center justify-center gap-2 px-4"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? `Hide ${sheetLabel}` : `Show ${sheetLabel}`}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="mobile-chrome-grip" aria-hidden />
          <span className="font-mono text-[11px] tracking-wide text-muted">
            {brand}
          </span>
          <span className="text-xs text-fg">
            {open ? `Hide ${sheetLabel}` : sheetLabel}
          </span>
          {!open && badgeText ? (
            <span className="mobile-chrome-badge inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-raised px-1.5 font-mono text-[10px] tabular-nums text-muted">
              {badgeText}
            </span>
          ) : null}
        </button>

        <div
          id={panelId}
          hidden={!open}
          className="mobile-chrome-body min-h-0 overflow-y-auto overscroll-contain px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          {chrome}
        </div>
      </div>
    </div>
  );
}

/** ≥44px tap target used inside mobile chrome adapters. */
export function MobileTap({
  label,
  onClick,
  active,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-md px-3 text-sm",
        active
          ? "bg-accent text-accent-fg"
          : "bg-raised text-muted hover:text-fg",
        className,
      )}
    >
      {children}
    </button>
  );
}
