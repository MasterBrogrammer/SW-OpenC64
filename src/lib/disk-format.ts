export type C64Fmt = "d64" | "g64" | "t64" | "tap" | "prg" | "p00" | "crt";

export type Sniffed = { kind: "disk" | "tape" | "prg" | "crt"; format: C64Fmt };

const D64_35 = 174848;
const D64_40 = 196608;
const D64_42 = 205312;

export function sniffDisk(filename: string, byteLength: number): Sniffed | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "d64" || ext === "d71" || ext === "d81") {
    return { kind: "disk", format: "d64" };
  }
  if (ext === "g64") return { kind: "disk", format: "g64" };
  if (ext === "t64") return { kind: "tape", format: "t64" };
  if (ext === "tap") return { kind: "tape", format: "tap" };
  if (ext === "crt") return { kind: "crt", format: "crt" };
  if (ext === "prg" || ext === "p00") return { kind: "prg", format: ext === "p00" ? "p00" : "prg" };
  if (byteLength === D64_35 || byteLength === D64_40 || byteLength === D64_42) {
    return { kind: "disk", format: "d64" };
  }
  if (byteLength > 2 && byteLength < 64_000) return { kind: "prg", format: "prg" };
  return null;
}

export function formatSize(bytes: number): string {
  if (bytes === D64_35) return "170K floppy";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1_048_576) return `${Math.round(bytes / 1024)}K`;
  return `${(bytes / 1_048_576).toFixed(1)}MB`;
}

export const DISK_ACCEPT =
  ".d64,.g64,.t64,.tap,.prg,.p00,.crt,.d71,.d81,application/octet-stream";
