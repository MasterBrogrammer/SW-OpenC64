# SW-OpenC64 — handoff

Sibling of SW-OpenApple. Same TanStack Start + IBM Plex CRT shell.

Public repo: https://github.com/MasterBrogrammer/SW-OpenC64  
Play: https://masterbrogrammer.github.io/SW-OpenC64/

- App: **SW-OpenC64** at http://127.0.0.1:8082
- MCP: **WOZMCP64** (port 9878)
- Apple: SW-OpenApple :8080, MCP **WOZMCP** :9877

## Boot

`npm install && npm run start` then open :8082. Cold start loads Commodore BASIC
(`id: basic`) and waits for READY. on screen RAM ($0400).

## Runtime

- `public/emu/c64.js` + `c64.wasm` (lvllvl / chips-family, 384×272 RGBA)
- `vendor/chips` — header C64 (source of truth)
- `vendor/open-roms` + `public/roms` — MEGA65 Open ROMs (LGPL)

The WASM has baked firmware; Open ROMs are shipped for legality / future inject.
No local `emcc`, so VICE was not compiled to WASM.

## Library

`src/lib/catalog.ts` — BASIC, hello.prg, tenprint.prg, colors.prg, blank.d64.
Rebuild PRGs/disk: `node scripts/make-disks.mjs`.

## Key files

| Path | Role |
|---|---|
| `src/lib/c64-machine.ts` | WASM load, blit, disk/PRG, paste buffer |
| `src/components/emulator-screen.tsx` | CRT, 1541 LED, Save BASIC |
| `src/lib/catalog.ts` | Legal shelf |
| `mcp/server.mjs` | WOZMCP64 stdio + :9878 bridge |
