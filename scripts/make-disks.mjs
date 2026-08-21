#!/usr/bin/env node
/** Build blank 1541 image + tiny BASIC PRGs we can legally ship. */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public/disks");
mkdirSync(out, { recursive: true });

const TRACK_SECS = [
  0, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 19, 19,
  19, 19, 19, 19, 19, 18, 18, 18, 18, 18, 18, 17, 17, 17, 17, 17,
];

function trackOffset(track) {
  let off = 0;
  for (let t = 1; t < track; t++) off += TRACK_SECS[t] * 256;
  return off;
}

function petsciiName(name, len) {
  const s = name.toUpperCase().slice(0, len);
  const out = new Uint8Array(len).fill(0xa0);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function makeBlankD64(diskName = "OPENC64") {
  const img = new Uint8Array(174848);
  const bamOff = trackOffset(18);
  const bam = img.subarray(bamOff, bamOff + 256);
  bam[0] = 18;
  bam[1] = 1;
  bam[2] = 0x41;
  for (let t = 1; t <= 35; t++) {
    const n = TRACK_SECS[t];
    let map = (1n << BigInt(n)) - 1n;
    if (t === 18) map &= ~3n;
    const p = 4 + (t - 1) * 4;
    let free = 0;
    let bits = map;
    while (bits) {
      if (bits & 1n) free++;
      bits >>= 1n;
    }
    bam[p] = free;
    bam[p + 1] = Number(map & 0xffn);
    bam[p + 2] = Number((map >> 8n) & 0xffn);
    bam[p + 3] = Number((map >> 16n) & 0xffn);
  }
  const name = petsciiName(diskName, 16);
  bam.set(name, 0x90);
  bam[0xa0] = 0xa0;
  bam[0xa1] = 0xa0;
  bam[0xa2] = 0x30;
  bam[0xa3] = 0x43;
  bam[0xa4] = 0xa0;
  bam[0xa5] = 0x32;
  bam[0xa6] = 0x41;
  for (let i = 0xa7; i <= 0xff; i++) bam[i] = 0xa0;
  return img;
}

const T = {
  END: 0x80,
  FOR: 0x81,
  NEXT: 0x82,
  GOTO: 0x89,
  POKE: 0x97,
  PRINT: 0x99,
  TO: 0xa4,
  PLUS: 0xaa,
  MUL: 0xac,
  INT: 0xb5,
  RND: 0xbb,
  CHR: 0xc7,
};

function bytes(...parts) {
  const out = [];
  for (const p of parts) {
    if (typeof p === "number") out.push(p & 0xff);
    else if (typeof p === "string") {
      for (const ch of p) out.push(ch.charCodeAt(0) & 0xff);
    } else {
      out.push(...p);
    }
  }
  return out;
}

function packPrg(lines) {
  const load = 0x0801;
  let addr = load;
  const body = [];
  for (const [num, toks] of lines) {
    const payload = [...toks, 0x00];
    const next = addr + 2 + 2 + payload.length;
    body.push(next & 0xff, (next >> 8) & 0xff, num & 0xff, (num >> 8) & 0xff, ...payload);
    addr = next;
  }
  body.push(0x00, 0x00);
  return Uint8Array.from([0x01, 0x08, ...body]);
}

const hello = packPrg([
  [10, bytes(T.PRINT, T.CHR, "(147)")],
  [20, bytes(T.PRINT, '"    SW-OPENC64"')],
  [30, bytes(T.PRINT)],
  [40, bytes(T.PRINT, '" COMMODORE 64 BASIC"')],
  [50, bytes(T.PRINT)],
  [60, bytes(T.PRINT, '" TYPE A LINE, THEN RUN"')],
]);

const tenprint = packPrg([
  [10, bytes(T.PRINT, T.CHR, "(205.5", T.PLUS, T.RND, "(1));:", T.GOTO, "10")],
]);

const colors = packPrg([
  [10, bytes(T.POKE, "53280,", T.INT, "(", T.RND, "(1)", T.MUL, "16)")],
  [20, bytes(T.POKE, "53281,", T.INT, "(", T.RND, "(1)", T.MUL, "16)")],
  [30, bytes(T.FOR, "I=1", T.TO, "500:NEXT")],
  [40, bytes(T.GOTO, "10")],
]);

writeFileSync(join(out, "blank.d64"), makeBlankD64("BLANK"));
writeFileSync(join(out, "hello.prg"), hello);
writeFileSync(join(out, "tenprint.prg"), tenprint);
writeFileSync(join(out, "colors.prg"), colors);
console.log("wrote blank.d64 hello.prg tenprint.prg colors.prg");
