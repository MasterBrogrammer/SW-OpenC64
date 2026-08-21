import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { FolderOpen, Heart, Search, Terminal, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HostUplink } from "@/components/host-uplink";
import {
  CATEGORIES,
  searchTitles,
  type Title,
} from "@/lib/catalog";
import { DISK_ACCEPT } from "@/lib/disk-format";
import { resumeAllAudio } from "@/lib/disk-audio";
import { useEmu } from "@/lib/emu-store";
import { pushRecent, readRecent, readStars, toggleStar } from "@/lib/local-prefs";
import {
  importDiskFiles,
  removeUserDisk,
  useUserDisks,
  userTitleId,
  type UserDisk,
} from "@/lib/user-disks";
import { cn } from "@/lib/utils";

const FILTERS = ["All", ...CATEGORIES, "Mine"] as const;
const PANE_KEY = "oc64-pane";

function readPane(): "library" | "terminal" {
  if (typeof window === "undefined") return "library";
  return window.sessionStorage.getItem(PANE_KEY) === "terminal"
    ? "terminal"
    : "library";
}

export function SoftwareLibrary() {
  const loadedId = useEmu((s) => s.loadedId);
  const loadingId = useEmu((s) => s.loadingId);
  const loadError = useEmu((s) => s.loadError);
  const requestLoad = useEmu((s) => s.requestLoad);
  const uplinkLive = useEmu((s) => s.uplinkLive);
  const [pane, setPane] = useState<"library" | "terminal">(readPane);
  const [termOnce, setTermOnce] = useState(() => readPane() === "terminal");

  function showPane(next: "library" | "terminal") {
    setPane(next);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(PANE_KEY, next);
    }
    if (next === "terminal") setTermOnce(true);
  }
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof FILTERS)[number]>("Games");
  const [stars, setStars] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : readStars(),
  );
  const [recent, setRecent] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : readRecent(),
  );
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { disks: mine } = useUserDisks();

  useEffect(() => {
    function onSaved() {
      showPane("library");
      setCategory("Mine");
    }
    window.addEventListener("oc-disk-saved", onSaved);
    return () => window.removeEventListener("oc-disk-saved", onSaved);
  }, []);

  const titles = useMemo(() => {
    if (category === "Mine") return [];
    let list = searchTitles(query, category);
    if (onlyStarred) list = list.filter((t) => stars.includes(t.id));
    if (recent.length) {
      list = [...list].sort((a, b) => {
        const ai = recent.indexOf(a.id);
        const bi = recent.indexOf(b.id);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
    }
    return list;
  }, [query, category, onlyStarred, stars, recent]);

  const mineFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && category !== "Mine") return [];
    return mine.filter((d) => {
      if (onlyStarred && !stars.includes(userTitleId(d.id))) return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) || d.filename.toLowerCase().includes(q)
      );
    });
  }, [mine, query, category, onlyStarred, stars]);

  async function onFiles(files: FileList | File[] | null) {
    if (!files || (Array.isArray(files) ? files.length === 0 : files.length === 0))
      return;
    setImportError(null);
    try {
      const imported = await importDiskFiles(Array.from(files));
      const last = imported[imported.length - 1];
      if (last) {
        setCategory("Mine");
        boot(userTitleId(last.id));
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Could not import that disk");
    }
  }

  function boot(id: string) {
    resumeAllAudio();
    setRecent(pushRecent(id));
    requestLoad(id);
  }

  return (
    <aside
      className="flex min-h-0 flex-col overflow-hidden rounded-lg bg-surface shadow-[var(--shadow-border)] lg:max-h-full"
      data-library-pane={pane}
    >
      <div className="flex shrink-0 border-b border-border">
        <button
          type="button"
          className={cn(
            "flex h-11 flex-1 items-center justify-center gap-2 text-sm",
            pane === "library"
              ? "text-fg shadow-[inset_0_-2px_0_var(--color-accent)]"
              : "text-muted hover:text-fg",
          )}
          onClick={() => showPane("library")}
        >
          Library
        </button>
        <button
          type="button"
          className={cn(
            "flex h-11 flex-1 items-center justify-center gap-2 text-sm",
            pane === "terminal"
              ? "text-fg shadow-[inset_0_-2px_0_var(--color-accent)]"
              : "text-muted hover:text-fg",
          )}
          onClick={() => {
            showPane("terminal");
            useEmu.getState().setFocused(false);
          }}
        >
          <Terminal className="size-3.5" />
          Terminal
          <span className={cn("uplink-led", uplinkLive && "on")} />
        </button>
      </div>

      {termOnce ? (
        <div
          className={cn(
            "min-h-0 flex-1 flex-col",
            pane === "terminal" ? "flex" : "hidden",
          )}
        >
          <HostUplink />
        </div>
      ) : null}

      <div className={cn("border-b border-border px-4 py-3", pane === "terminal" && "hidden")}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium">Shelf</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              READY. on first boot — no ROM hunt. BASIC, a blank 1541 disk, and
              tiny programs we can legally ship. Drop your own .d64 / .prg for
              the rest.
            </p>
          </div>
          <button
            type="button"
            title="Starred only"
            onClick={() => setOnlyStarred((v) => !v)}
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-md",
              onlyStarred ? "text-accent" : "text-muted hover:text-fg",
            )}
          >
            <Heart className={cn("size-4", onlyStarred && "fill-accent")} />
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept={DISK_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            void onFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-raised text-xs text-muted hover:text-fg"
        >
          <FolderOpen className="size-4" />
          Open disk image…
        </button>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          Last Ninja, Boulder Dash, Impossible Mission — drop your own copies.
          We don’t bundle commercial titles.
        </p>
        {importError ? (
          <p className="mt-2 text-xs text-danger">{importError}</p>
        ) : null}
        {loadError ? <p className="mt-2 text-xs text-danger">{loadError}</p> : null}

        <label className="relative mt-3 block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, author, tag"
            className="h-10 w-full rounded-md bg-raised pr-3 pl-9 text-sm text-fg outline-none placeholder:text-muted"
          />
        </label>
        <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
          {FILTERS.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={cn(
                "h-8 shrink-0 rounded-md px-3 text-xs",
                category === cat
                  ? "bg-accent text-accent-fg"
                  : "bg-raised text-muted hover:text-fg",
              )}
            >
              {cat === "Mine" ? `Mine (${mine.length})` : cat}
            </button>
          ))}
        </div>
      </div>

      <ul className={cn("min-h-0 flex-1 overflow-y-auto p-2", pane === "terminal" && "hidden")}>
        {mineFiltered.length
          ? mineFiltered.map((disk) => (
              <UserRow
                key={disk.id}
                disk={disk}
                active={loadedId === userTitleId(disk.id)}
                loading={loadingId === userTitleId(disk.id)}
                starred={stars.includes(userTitleId(disk.id))}
                onBoot={() => boot(userTitleId(disk.id))}
                onStar={() => setStars(toggleStar(userTitleId(disk.id)))}
                onRemove={() => {
                  void removeUserDisk(disk.id);
                }}
              />
            ))
          : null}

        {titles.map((title) => (
          <TitleRow
            key={title.id}
            title={title}
            active={loadedId === title.id}
            loading={loadingId === title.id}
            starred={stars.includes(title.id)}
            onBoot={() => boot(title.id)}
            onStar={() => setStars(toggleStar(title.id))}
          />
        ))}

        {titles.length === 0 && mineFiltered.length === 0 ? (
          <li className="px-3 py-8 text-center text-xs text-muted">
            {category === "Mine"
              ? "No files yet. Open a .d64 / .prg or drop one on the screen."
              : "Nothing on this shelf matches."}
          </li>
        ) : null}
      </ul>
    </aside>
  );
}

function TitleRow({
  title,
  active,
  loading,
  starred,
  onBoot,
  onStar,
}: {
  title: Title;
  active: boolean;
  loading: boolean;
  starred: boolean;
  onBoot: () => void;
  onStar: () => void;
}) {
  return (
    <li
      className={cn(
        "mb-1 rounded-md p-3",
        active ? "bg-raised" : "hover:bg-raised/60",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{title.name}</p>
            <span className="shrink-0 text-[10px] tracking-wide text-muted uppercase">
              {title.year ?? title.category}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted">{title.summary}</p>
          {title.play ? (
            <p className="mt-1 text-[11px] text-accent/90">{title.play}</p>
          ) : null}
          <p className="mt-1 font-mono text-[10px] text-muted">
            {title.size} · {title.license}
          </p>
        </div>
        <button
          type="button"
          className="grid size-9 shrink-0 place-items-center text-muted hover:text-fg"
          onClick={(e) => {
            e.stopPropagation();
            onStar();
          }}
          aria-label={starred ? "Unstar" : "Star"}
        >
          <Heart className={cn("size-4", starred && "fill-accent text-accent")} />
        </button>
      </div>
      <Button
        type="button"
        size="sm"
        variant={active ? "outline" : "default"}
        className="mt-2 w-full"
        data-software-id={title.id}
        disabled={loading}
        onClick={onBoot}
      >
        {loading
          ? "Loading…"
          : active
            ? "Reboot"
            : "Insert & boot"}
      </Button>
    </li>
  );
}

function UserRow({
  disk,
  active,
  loading,
  starred,
  onBoot,
  onStar,
  onRemove,
}: {
  disk: UserDisk;
  active: boolean;
  loading: boolean;
  starred: boolean;
  onBoot: () => void;
  onStar: () => void;
  onRemove: () => void;
}) {
  return (
    <li
      className={cn(
        "mb-1 rounded-md p-3",
        active ? "bg-raised" : "hover:bg-raised/60",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{disk.name}</p>
            <span className="shrink-0 text-[10px] tracking-wide text-muted uppercase">
              Mine
            </span>
          </div>
          <p className="mt-1 font-mono text-[10px] text-muted">
            {disk.filename} · {disk.size} · {disk.format}
          </p>
        </div>
        <button
          type="button"
          className="grid size-9 shrink-0 place-items-center text-muted hover:text-fg"
          onClick={onStar}
          aria-label={starred ? "Unstar" : "Star"}
        >
          <Heart className={cn("size-4", starred && "fill-accent text-accent")} />
        </button>
        <button
          type="button"
          className="grid size-9 shrink-0 place-items-center text-muted hover:text-danger"
          onClick={onRemove}
          aria-label="Remove"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <Button
        type="button"
        size="sm"
        variant={active ? "outline" : "default"}
        className="mt-2 w-full"
        data-software-id={userTitleId(disk.id)}
        disabled={loading}
        onClick={onBoot}
      >
        {loading
          ? "Loading…"
          : active
            ? "Reboot"
            : "Insert & boot"}
      </Button>
    </li>
  );
}

export function DiskDropBanner({
  active,
}: {
  active: boolean;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 z-40 grid place-items-center bg-bg/70 transition-opacity",
        active ? "opacity-100" : "opacity-0",
      )}
    >
      <div className="flex items-center gap-3 rounded-lg bg-surface px-6 py-4 text-sm shadow-[var(--shadow-border)]">
        <Upload className="size-5 text-accent" />
        Drop a .d64 or .prg to insert it
      </div>
    </div>
  );
}

export function useDiskDrop(onFiles: (files: File[]) => void) {
  const [over, setOver] = useState(false);
  return {
    over,
    props: {
      onDragEnter: (e: DragEvent) => {
        e.preventDefault();
        setOver(true);
      },
      onDragOver: (e: DragEvent) => {
        e.preventDefault();
        setOver(true);
      },
      onDragLeave: (e: DragEvent) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setOver(false);
      },
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        setOver(false);
        const files = [...e.dataTransfer.files];
        if (files.length) onFiles(files);
      },
    },
  };
}

