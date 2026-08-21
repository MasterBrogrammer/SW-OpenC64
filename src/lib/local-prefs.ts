const STARS_KEY = "oc64-stars";
const RECENT_KEY = "oc64-recent";
const VOLUME_KEY = "oc64-volume";
const SPEED_KEY = "oc64-speed-v7";

function readList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

function writeList(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    /* quota / private mode */
  }
}

export function readStars(): string[] {
  return readList(STARS_KEY);
}

export function toggleStar(id: string): string[] {
  const cur = readStars();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur];
  writeList(STARS_KEY, next);
  return next;
}

export function readRecent(): string[] {
  return readList(RECENT_KEY);
}

export function pushRecent(id: string): string[] {
  const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, 12);
  writeList(RECENT_KEY, next);
  return next;
}

export function readVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw == null) return 50;
    const n = Number(raw);
    if (!Number.isFinite(n)) return 50;
    return Math.min(100, Math.max(0, Math.round(n)));
  } catch {
    return 50;
  }
}

export function writeVolume(n: number) {
  try {
    localStorage.setItem(VOLUME_KEY, String(Math.min(100, Math.max(0, Math.round(n)))));
  } catch {
    /* */
  }
}

export function readSpeed(): number {
  try {
    const raw = localStorage.getItem(SPEED_KEY);
    if (raw == null) return 25;
    const n = Number(raw);
    if (!Number.isFinite(n)) return 25;
    return Math.min(100, Math.max(10, Math.round(n)));
  } catch {
    return 25;
  }
}

export function writeSpeed(n: number) {
  try {
    const snapped = Math.min(100, Math.max(10, Math.round(n)));
    localStorage.setItem(SPEED_KEY, String(snapped));
  } catch {
    /* */
  }
}
