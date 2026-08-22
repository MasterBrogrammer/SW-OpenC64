import type { C64Machine } from "@/lib/c64-machine";
import { screenHasReady } from "@/lib/c64-screen";
import type { BootStep } from "@/lib/catalog";
import { useEmu } from "@/lib/emu-store";

export type { BootStep };

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

export async function waitReady(
  machine: C64Machine,
  isCancelled: () => boolean,
  timeoutMs = 8000,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (isCancelled()) return false;
    if (screenHasReady(machine.screen())) return true;
    await sleep(60);
  }
  return screenHasReady(machine.screen());
}

export async function runBootSteps(
  machine: C64Machine,
  steps: BootStep[],
  isCancelled: () => boolean,
) {
  for (const step of steps) {
    if (isCancelled()) return;
    if (step.waitReady) {
      const ok = await waitReady(machine, isCancelled, 10000);
      if (!ok && isCancelled()) return;
    }
    if (step.waitMs) await sleep(step.waitMs);
    if (step.type) machine.paste(step.type);
  }
}

export async function loadStarAndRun(
  machine: C64Machine,
  isCancelled: () => boolean,
) {
  const ready = await waitReady(machine, isCancelled, 8000);
  if (!ready || isCancelled()) return;
  useEmu.getState().setStatus('LOAD "*",8,1');
  machine.audio.motor(true);
  machine.paste('LOAD "*",8,1\r');
  await sleep(400);
  const start = Date.now();
  let sawDrive = false;
  while (Date.now() - start < 28000) {
    if (isCancelled()) return;
    const spinning = machine.driveOn();
    if (spinning) sawDrive = true;
    const text = machine.screen();
    if (sawDrive && !spinning && screenHasReady(text)) break;
    if (/\bREADY\.?/.test(text) && /LOAD/.test(text) && Date.now() - start > 4000 && !spinning) {
      break;
    }
    await sleep(80);
  }
  if (isCancelled()) return;
  machine.audio.motor(machine.driveOn());
  machine.paste("RUN\r");
}
