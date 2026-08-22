import { useEffect, useRef, useState } from "react";
import { asset } from "@/lib/asset";
import { useEmu } from "@/lib/emu-store";
import { cn } from "@/lib/utils";

export function WozModeBadge() {
  const live = useEmu((s) => s.mcpLive);
  const [shown, setShown] = useState(false);
  const hideRef = useRef(0);

  function flash() {
    setShown(true);
    window.clearTimeout(hideRef.current);
    hideRef.current = window.setTimeout(() => setShown(false), 4600);
  }

  useEffect(() => {
    if (live) flash();
  }, [live]);

  useEffect(() => {
    window.addEventListener("woz-ping", flash);
    return () => window.removeEventListener("woz-ping", flash);
  }, []);

  return (
    <img
      src={asset("/wozmode.png")}
      alt="WOZMCP64"
      width={360}
      height={403}
      data-wozmode={shown ? "live" : "idle"}
      aria-hidden={!shown}
      className={cn("wozmode-badge w-full", shown && "wozmode-badge-live")}
    />
  );
}
