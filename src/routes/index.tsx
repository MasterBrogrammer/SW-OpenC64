import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { EmulatorScreen } from "@/components/emulator-screen";
import {
  DiskDropBanner,
  SoftwareLibrary,
  useDiskDrop,
} from "@/components/software-library";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { resumeAllAudio } from "@/lib/c64-audio";
import { MCP_BRIDGE_REV, startMcpBridge } from "@/lib/mcp-bridge";
import { useEmu } from "@/lib/emu-store";
import { importDiskFiles, userTitleId } from "@/lib/user-disks";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const requestLoad = useEmu((s) => s.requestLoad);
  const [dropError, setDropError] = useState<string | null>(null);
  useEffect(() => startMcpBridge(), [MCP_BRIDGE_REV]);
  const drop = useDiskDrop((files) => {
    setDropError(null);
    resumeAllAudio();
    void importDiskFiles(files)
      .then((imported) => {
        const last = imported[imported.length - 1];
        if (last) requestLoad(userTitleId(last.id));
      })
      .catch((err: unknown) => {
        setDropError(err instanceof Error ? err.message : "Could not open that file");
      });
  });

  return (
    <div
      className="flex min-h-dvh flex-col lg:h-dvh lg:max-h-dvh lg:overflow-hidden"
      {...drop.props}
    >
      <DiskDropBanner active={drop.over} />
      <Header />
      {dropError ? (
        <div className="border-b border-danger/40 bg-danger/10 px-4 py-2 text-center text-xs text-danger">
          {dropError}
        </div>
      ) : null}
      <main className="mx-auto grid w-full max-w-[1400px] min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] lg:overflow-hidden">
        <EmulatorScreen />
        <SoftwareLibrary />
      </main>
      <footer className="hidden shrink-0 border-t border-border px-4 py-2 text-center text-xs text-muted lg:block">
        Runtime is a chips-family C64 in WASM. Firmware: MEGA65 Open ROMs (LGPL).
        Bundled programs are FOSS or public-domain BASIC; drop your own .d64 for
        the rest. MCP: WOZMCP64.
      </footer>
    </div>
  );
}

function Header() {
  return (
    <header className="shrink-0 border-b border-border">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4">
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <span className="grid size-8 place-items-center rounded-md bg-raised font-mono text-sm font-semibold text-accent shadow-[inset_0_0_0_1px_var(--color-border)]">
            C=
          </span>
          <span className="font-medium tracking-tight text-fg">SW-OpenC64</span>
        </Link>
        <span className="hidden text-xs text-muted sm:inline">
          Commodore 64 · drop a .d64 to play
        </span>
        <div className="ml-auto">
          <AuthSlot />
        </div>
      </div>
    </header>
  );
}

function AuthSlot() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return <div className="size-8 animate-pulse rounded-full bg-raised" />;
  }
  if (user) {
    return (
      <div className="text-fg">
        <UserButton />
      </div>
    );
  }
  return (
    <Link
      to="/login"
      className="inline-flex h-10 items-center rounded-md px-3 text-sm text-muted no-underline hover:bg-raised hover:text-fg"
    >
      Sign in
    </Link>
  );
}
