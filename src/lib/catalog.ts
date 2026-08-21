export type Media =
  | { kind: "none" }
  | { kind: "prg"; url: string }
  | { kind: "disk"; url: string }
  | { kind: "crt"; url: string };

export type BootStep = {
  waitReady?: boolean;
  waitMs?: number;
  type?: string;
};

export type Title = {
  id: string;
  name: string;
  category: (typeof CATEGORIES)[number];
  summary: string;
  play?: string;
  media: Media;
  size: string;
  license: string;
  year?: number;
  author?: string;
  tags?: string[];
  featured?: boolean;
  joystick?: boolean;
  bootSteps?: BootStep[];
};

export const CATEGORIES = ["Games", "Demos", "System"] as const;

export const BOOT_WITH: { id: string; label: string }[] = [
  { id: "basic", label: "BASIC" },
];

export const CATALOG: Title[] = [
  {
    id: "c64anabalt",
    name: "C64anabalt",
    category: "Games",
    featured: true,
    year: 2011,
    author: "Paul Koller / RGCD",
    joystick: true,
    summary:
      "Official Canabalt on a 16K cart. One button, collapsing city, SID. Author-released freeware.",
    play: "Fire / Space to jump. Joystick port 2.",
    media: { kind: "prg", url: "/disks/c64anabalt.prg" },
    size: "16K PRG",
    license: "Freeware — Paul Koller / RGCD",
    tags: ["arcade", "runner", "sid"],
  },
  {
    id: "super-bread-box",
    name: "Super Bread Box",
    category: "Games",
    featured: true,
    year: 2012,
    author: "Paul Koller / RGCD",
    joystick: true,
    summary:
      "Official Super Crate Box conversion. Guns, crates, chaos. The 16K cart the scene still talks about.",
    play: "Joystick port 2. Grab crates, don’t die.",
    media: { kind: "prg", url: "/disks/super-bread-box.prg" },
    size: "16K PRG",
    license: "Freeware — Paul Koller / RGCD",
    tags: ["arcade", "shooter", "sid"],
  },
  {
    id: "basic",
    name: "Commodore BASIC",
    category: "System",
    featured: true,
    year: 1982,
    author: "MEGA65 Open ROMs / C64 KERNAL",
    summary:
      "Cold start. The blue screen and READY. live in ROM — no disk hunt.",
    play: "Click the CRT, then 10 PRINT \"HELLO\": 20 GOTO 10",
    media: { kind: "none" },
    size: "ROM",
    license: "Open ROMs (LGPL) + chips runtime",
    tags: ["basic", "ready"],
  },
  {
    id: "hello",
    name: "Hello, C64",
    category: "Demos",
    featured: true,
    year: 2026,
    author: "SW-OpenC64",
    summary: "A tiny BASIC greeting. Proof the machine types and RUNs.",
    play: "It RUNs itself. LIST to see the program.",
    media: { kind: "prg", url: "/disks/hello.prg" },
    size: "PRG",
    license: "Public domain — bundled",
    tags: ["basic", "hello"],
  },
  {
    id: "tenprint",
    name: "10 PRINT maze",
    category: "Demos",
    featured: true,
    year: 1982,
    author: "C64 folklore",
    summary:
      "10 PRINT CHR$(205.5+RND(1)); : GOTO 10 — the maze that made BASIC feel like magic.",
    play: "RUN STOP to break. The maze is the program.",
    media: { kind: "prg", url: "/disks/tenprint.prg" },
    size: "PRG",
    license: "Public domain idiom",
    tags: ["basic", "maze", "10print"],
  },
  {
    id: "colors",
    name: "Border flash",
    category: "Demos",
    year: 2026,
    author: "SW-OpenC64",
    summary: "POKE the VIC border and background. Cheap, loud, very 1982.",
    play: "RUN STOP when your eyes give up.",
    media: { kind: "prg", url: "/disks/colors.prg" },
    size: "PRG",
    license: "Public domain — bundled",
    tags: ["vic", "poke"],
  },
  {
    id: "blank-d64",
    name: "Blank 1541 disk",
    category: "System",
    featured: true,
    summary:
      "Formatted empty .d64. Type a program, SAVE \"HELLO\",8 — then Save BASIC into Mine.",
    play: "DOS is the KERNAL. SAVE \"NAME\",8 then Save BASIC if you want a PRG in Mine.",
    media: { kind: "disk", url: "/disks/blank.d64" },
    size: "170K floppy",
    license: "Blank image",
    tags: ["blank", "1541"],
  },
];

export function getTitle(id: string) {
  return CATALOG.find((t) => t.id === id);
}

export function searchTitles(query: string, category: string): Title[] {
  const q = query.trim().toLowerCase();
  const filtered = CATALOG.filter((title) => {
    if (!q && category !== "All" && title.category !== category) return false;
    if (!q) return true;
    const hay = [
      title.name,
      title.summary,
      title.category,
      title.license,
      title.author ?? "",
      title.play ?? "",
      ...(title.tags ?? []),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
  return filtered.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
