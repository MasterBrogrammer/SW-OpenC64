import { useEffect, useState } from "react";

/** True at Tailwind `lg` and up. SSR / first paint assume mobile (CRT-first). */
export function useDesktopLayout() {
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return desktop;
}
