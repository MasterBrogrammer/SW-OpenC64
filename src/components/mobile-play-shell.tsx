import { useEffect, useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared mobile play shell (frozen brief):
 * CRT-first, portrait, collapsible chrome sheet (default collapsed),
 * tap targets ≥44px, safe-area. Desktop callers should keep their own layout.
 */
export function MobilePlayShell({
  crt,
  chrome,
  brand,
  className,
}: {
  crt: ReactNode;
  chrome: ReactNode;
  /** Short label shown on the collapsed handle, e.g. "][" or "C=". */
  brand: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div
      className={cn(
        "mobile-play-shell flex h-dvh max-h-dvh flex-col overflow-hidden bg-bg",
        className,
      )}
      data-chrome={open ? "open" : "collapsed"}
    >
      <div className="mobile-crt-stage relative min-h-0 flex-1 px-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        {crt}
      </div>

      {open ? (
        <button
          type="button"
          aria-label="Close controls"
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
          onClick={() => setOpen((v) => !v)}
        >
          <span className="mobile-chrome-grip" aria-hidden />
          <span className="font-mono text-[11px] tracking-wide text-muted">
            {brand}
          </span>
          <span className="text-xs text-muted">
            {open ? "Hide controls" : "Controls"}
          </span>
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
