import { asset } from "@/lib/asset";
import { useEmu } from "@/lib/emu-store";
import { cn } from "@/lib/utils";

export function WozModeBadge() {
  const live = useEmu((s) => s.mcpLive);
  return (
    <img
      src={asset("/wozmode.png")}
      alt="WOZMCP64"
      width={360}
      height={403}
      data-wozmode={live ? "live" : "idle"}
      className={cn("wozmode-badge w-full", live && "wozmode-badge-live")}
    />
  );
}
