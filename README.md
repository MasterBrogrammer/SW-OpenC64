# SW-OpenC64

A browser Commodore 64. Same shelf-and-CRT shell as SW-OpenApple.

Family: **SW-Open** + the machine. Apple is SW-OpenApple. This one is SW-OpenC64.
The Grok MCP for this tab is **WOZMCP64** (Apple’s is **WOZMCP**).

## What is running

VICE is the reference C64 emulator, but it is too large to compile to WASM here
(no Emscripten toolchain on this machine). The browser runtime is a chips-family
C64 compiled to WASM (`public/emu/c64.wasm`, from [lvllvl](https://github.com/jaammees/lvllvl)).
Header source of truth is vendored [floooh/chips](https://github.com/floooh/chips)
(`vendor/chips`, zlib). Legal firmware we ship is [MEGA65 Open ROMs](https://github.com/MEGA65/open-roms)
(`vendor/open-roms`, LGPL).

First boot is **READY.** — no ROM hunt.

## Run it

```
npm install
npm run start
```

Then open [http://127.0.0.1:8082](http://127.0.0.1:8082). Port **8082** (8080 is SW-OpenApple).

Or `./launch.sh`.

## Play in a browser

Same idea as SW-OpenApple — GitHub Pages hosts a static build:

**https://masterbrogrammer.github.io/SW-OpenC64/**

The C64, shelf, Blank disk, and Save BASIC all run in the browser. The Terminal tab is this Mac’s shell, so it only works when you run SW-OpenC64 locally.

Source: **https://github.com/MasterBrogrammer/SW-OpenC64**

## Library

Only titles we can legally ship:

- Commodore BASIC (READY. in ROM)
- 10 PRINT maze, Hello, border-flash POKEs
- Blank formatted 1541 `.d64` — type a program, **Save BASIC** into Mine

**Last Ninja, Boulder Dash, Impossible Mission, etc.** stay copyrighted. Drop
your own `.d64` / `.prg` / `.crt` onto the window. They stay in this browser
(IndexedDB). They never upload.

Stars are local. Sign-in is optional.

## Keys

| | |
|---|---|
| Click the CRT | Focus + SID audio |
| Esc | RUN/STOP |
| Tab | CTRL |
| Ctrl / Cmd | Commodore key |
| F1–F7 | Function keys |
| Gamepad icon | Joystick port 2 (WASD / arrows, Space fire) |
| Ctrl+F12 | Reset |

## MCP (WOZMCP64)

With the SW-OpenC64 tab open on :8082:

```
npm run mcp
```

Grok is configured as `[mcp_servers.wozmcp64]` in `~/.grok/config.toml`.

## License

- chips: zlib — `vendor/chips/LICENSE`
- Open ROMs: LGPL-3.0 — `vendor/open-roms/LICENSE`
- WASM runtime: lvllvl C64 core, see `vendor/lvllvl/NOTICE.txt`
- Bundled PRGs / blank disk: public domain, `public/disks/FOSS-DISKS.txt`
