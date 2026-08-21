export type TermKind = "sys" | "in" | "out" | "err" | "grok";
export type TermMode = "shell" | "grok";
export type TermRow = {
  id: string;
  kind: TermKind;
  text: string;
  prompt?: string;
};
export type TermMeta = {
  session: string;
  user: string;
  host: string;
  shell: string;
  home: string;
};

type TermState = {
  session: string | null;
  rows: TermRow[];
  mode: TermMode;
  cwd: string;
  meta: TermMeta | null;
  hist: string[];
  busy: boolean;
};

let n = 0;
export function termRid() {
  n += 1;
  return `u${n}`;
}

let state: TermState = {
  session: null,
  rows: [],
  mode: "shell",
  cwd: "",
  meta: null,
  hist: [],
  busy: false,
};

const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

export function getTermState() {
  return state;
}

export function subscribeTerm(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function patchTerm(partial: Partial<TermState>) {
  state = { ...state, ...partial };
  emit();
}

export function pushTermRow(kind: TermKind, text: string, prompt?: string) {
  const row: TermRow = { id: termRid(), kind, text, prompt };
  state = { ...state, rows: [...state.rows, row] };
  emit();
  return row.id;
}

export function patchTermRow(id: string, next: Partial<TermRow>) {
  state = {
    ...state,
    rows: state.rows.map((row) => (row.id === id ? { ...row, ...next } : row)),
  };
  emit();
}

export function clearTermRows() {
  state = { ...state, rows: [] };
  emit();
}
