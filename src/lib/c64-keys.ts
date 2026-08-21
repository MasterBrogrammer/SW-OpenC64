/** C64 CIA keyboard matrix indices (lvllvl / chips). */
export const K = {
  ARROW_LEFT: 0,
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
  SIX: 6,
  SEVEN: 7,
  EIGHT: 8,
  NINE: 9,
  ZERO: 10,
  PLUS: 11,
  MINUS: 12,
  POUND: 13,
  HOME: 14,
  DEL: 15,
  CTRL: 16,
  Q: 17,
  W: 18,
  E: 19,
  R: 20,
  T: 21,
  Y: 22,
  U: 23,
  I: 24,
  O: 25,
  P: 26,
  AT: 27,
  STAR: 28,
  ARROW_UP: 29,
  RUN_STOP: 30,
  A: 31,
  S: 32,
  D: 33,
  F: 34,
  G: 35,
  H: 36,
  J: 37,
  K: 38,
  L: 39,
  COLON: 40,
  SEMICOLON: 41,
  EQUALS: 42,
  RETURN: 43,
  COMMODORE: 44,
  SHIFT_LEFT: 45,
  Z: 46,
  X: 47,
  C: 48,
  V: 49,
  B: 50,
  N: 51,
  M: 52,
  COMMA: 53,
  PERIOD: 54,
  SLASH: 55,
  SHIFT_RIGHT: 56,
  CURSOR_UD: 57,
  CURSOR_LR: 58,
  SPACE: 59,
  F1: 60,
  F3: 61,
  F5: 62,
  F7: 63,
  RESTORE: 64,
} as const;

export const JOY = {
  UP: 0x01,
  DOWN: 0x02,
  LEFT: 0x04,
  RIGHT: 0x08,
  FIRE: 0x10,
} as const;

export type KeyHit = {
  index: number;
  /** Extra shift to hold for this key (C64 up/left, shifted punctuation). */
  shift?: boolean;
};

const LETTER: Record<string, number> = {
  q: K.Q,
  w: K.W,
  e: K.E,
  r: K.R,
  t: K.T,
  y: K.Y,
  u: K.U,
  i: K.I,
  o: K.O,
  p: K.P,
  a: K.A,
  s: K.S,
  d: K.D,
  f: K.F,
  g: K.G,
  h: K.H,
  j: K.J,
  k: K.K,
  l: K.L,
  z: K.Z,
  x: K.X,
  c: K.C,
  v: K.V,
  b: K.B,
  n: K.N,
  m: K.M,
};

export function mapBrowserKey(e: KeyboardEvent): KeyHit | null {
  const key = e.key;
  const lower = key.length === 1 ? key.toLowerCase() : key.toLowerCase();

  if (lower === "enter") return { index: K.RETURN };
  if (lower === " ") return { index: K.SPACE };
  if (lower === "backspace" || lower === "delete") return { index: K.DEL };
  if (lower === "escape") return { index: K.RUN_STOP };
  if (lower === "home") return { index: K.HOME };
  if (lower === "tab") return { index: K.CTRL };
  if (lower === "control") return { index: K.COMMODORE };
  if (lower === "meta" || lower === "os") return { index: K.COMMODORE };
  if (lower === "alt") return { index: K.CTRL };
  if (lower === "shift") return { index: K.SHIFT_LEFT };
  if (lower === "capslock") return { index: K.COMMODORE };
  if (lower === "f1") return { index: K.F1 };
  if (lower === "f2") return { index: K.F1, shift: true };
  if (lower === "f3") return { index: K.F3 };
  if (lower === "f4") return { index: K.F3, shift: true };
  if (lower === "f5") return { index: K.F5 };
  if (lower === "f6") return { index: K.F5, shift: true };
  if (lower === "f7") return { index: K.F7 };
  if (lower === "f8") return { index: K.F7, shift: true };
  if (lower === "pageup") return { index: K.RESTORE };

  if (lower === "arrowdown") return { index: K.CURSOR_UD };
  if (lower === "arrowup") return { index: K.CURSOR_UD, shift: true };
  if (lower === "arrowright") return { index: K.CURSOR_LR };
  if (lower === "arrowleft") return { index: K.CURSOR_LR, shift: true };

  if (lower in LETTER) return { index: LETTER[lower] };

  switch (key) {
    case "1":
      return { index: K.ONE };
    case "2":
      return { index: K.TWO };
    case "3":
      return { index: K.THREE };
    case "4":
      return { index: K.FOUR };
    case "5":
      return { index: K.FIVE };
    case "6":
      return { index: K.SIX };
    case "7":
      return { index: K.SEVEN };
    case "8":
      return { index: K.EIGHT };
    case "9":
      return { index: K.NINE };
    case "0":
      return { index: K.ZERO };
    case "-":
      return { index: K.MINUS };
    case "=":
      return { index: K.EQUALS };
    case "+":
      return { index: K.PLUS };
    case "*":
      return { index: K.STAR };
    case "@":
      return { index: K.AT };
    case "^":
      return { index: K.ARROW_UP };
    case "\\":
      return { index: K.POUND };
    case "`":
      return { index: K.ARROW_LEFT };
    case "~":
      return { index: K.ARROW_UP };
    case ";":
      return { index: K.SEMICOLON };
    case ":":
      return { index: K.COLON };
    case ",":
    case "<":
      return { index: K.COMMA };
    case ".":
    case ">":
      return { index: K.PERIOD };
    case "/":
    case "?":
      return { index: K.SLASH };
    case "[":
      return { index: K.COLON, shift: true };
    case "]":
      return { index: K.SEMICOLON, shift: true };
    case "!":
      return { index: K.ONE, shift: true };
    case '"':
      return { index: K.TWO, shift: true };
    case "#":
      return { index: K.THREE, shift: true };
    case "$":
      return { index: K.FOUR, shift: true };
    case "%":
      return { index: K.FIVE, shift: true };
    case "&":
      return { index: K.SIX, shift: true };
    case "'":
      return { index: K.SEVEN, shift: true };
    case "(":
      return { index: K.EIGHT, shift: true };
    case ")":
      return { index: K.NINE, shift: true };
    default:
      return null;
  }
}

export function joyFromCode(code: string): number | null {
  switch (code) {
    case "ArrowUp":
    case "KeyW":
      return JOY.UP;
    case "ArrowDown":
    case "KeyS":
      return JOY.DOWN;
    case "ArrowLeft":
    case "KeyA":
      return JOY.LEFT;
    case "ArrowRight":
    case "KeyD":
      return JOY.RIGHT;
    case "Space":
    case "KeyZ":
    case "ControlLeft":
    case "ControlRight":
      return JOY.FIRE;
    default:
      return null;
  }
}
