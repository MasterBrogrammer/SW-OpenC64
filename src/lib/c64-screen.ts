import type { C64Module } from "./c64-types";

const SCREEN = 0x0400;

function screenCodeToChar(sc: number): string {
  const c = sc & 0x7f;
  if (c < 32) return String.fromCharCode(c + 64);
  if (c < 64) return String.fromCharCode(c);
  if (c < 96) return String.fromCharCode(c + 32);
  return " ";
}

export function readScreenFromBytes(bytes: ArrayLike<number>): string {
  const rows: string[] = [];
  for (let y = 0; y < 25; y++) {
    let row = "";
    for (let x = 0; x < 40; x++) {
      row += screenCodeToChar(bytes[y * 40 + x] ?? 0);
    }
    rows.push(row.replace(/ +$/g, "").trimEnd());
  }
  return rows.join("\n").replace(/\n+$/g, "");
}

/** VIC text at $0400, 40×25 screen codes. */
export function readScreen(mod: C64Module): string {
  const bytes = new Uint8Array(1000);
  for (let i = 0; i < 1000; i++) bytes[i] = mod._c64_ramRead(SCREEN + i);
  return readScreenFromBytes(bytes);
}

export function screenHasReady(text: string): boolean {
  return /\bREADY\.?/.test(text);
}
