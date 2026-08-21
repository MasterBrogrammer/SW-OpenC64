import { readFileSync } from "node:fs";

const path = process.argv[2] || "public/json/disks/dos33master.json";
const disk = JSON.parse(readFileSync(path, "utf8"));
const tracks = disk.data;
const decode = (t, s) => Buffer.from(tracks[t][s], "base64");

const vtoc = decode(17, 0);
const catTrack = vtoc[0x01];
const catSec = vtoc[0x02];
console.log("VTOC catalog at T%s S%s vol %s", catTrack, catSec, vtoc[0x06]);

function nameAt(buf, off) {
  let n = "";
  for (let i = 0; i < 30; i++) {
    const c = buf[off + i] & 0x7f;
    n += c >= 32 && c < 127 ? String.fromCharCode(c) : ".";
  }
  return n.trimEnd();
}

const types = { 0: "T", 1: "I", 2: "A", 4: "B", 8: "S", 16: "R", 32: "AA", 64: "B" };
let t = catTrack;
let s = catSec;
const seen = new Set();
while (t && !seen.has(`${t}:${s}`)) {
  seen.add(`${t}:${s}`);
  const sec = decode(t, s);
  for (let e = 0; e < 7; e++) {
    const off = 0x0b + e * 0x23;
    const track = sec[off];
    if (track === 0 || track === 255) continue;
    const typ = sec[off + 2];
    const kind = types[typ & 0x7f] || `?${typ}`;
    const locked = typ & 0x80 ? "*" : " ";
    const len = sec[off + 0x21] + sec[off + 0x22] * 256;
    console.log(`${locked}${kind.padEnd(3)} ${String(len).padStart(3)} ${nameAt(sec, off + 3)}`);
  }
  t = sec[1];
  s = sec[2];
}
