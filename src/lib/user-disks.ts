import { useEffect, useState } from "react";
import { formatSize, sniffDisk, type Sniffed } from "@/lib/disk-format";

export type UserDisk = {
  id: string;
  name: string;
  filename: string;
  kind: Sniffed["kind"];
  format: Sniffed["format"];
  size: string;
  byteLength: number;
  addedAt: number;
};

type StoredDisk = UserDisk & { bytes: ArrayBuffer };

const DB_NAME = "sw-openc64";
const STORE = "disks";

const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

export function subscribeUserDisks(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

export async function listUserDisks(): Promise<UserDisk[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const rows = await reqToPromise(tx.objectStore(STORE).getAll() as IDBRequest<StoredDisk[]>);
  return rows
    .map(({ bytes: _bytes, ...meta }) => meta)
    .sort((a, b) => b.addedAt - a.addedAt);
}

export async function getUserDiskBytes(id: string): Promise<StoredDisk | null> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const row = await reqToPromise(tx.objectStore(STORE).get(id) as IDBRequest<StoredDisk | undefined>);
  return row ?? null;
}

export async function importDiskFiles(files: File[]): Promise<UserDisk[]> {
  const imported: UserDisk[] = [];
  const db = await openDb();
  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const sniffed = sniffDisk(file.name, bytes.byteLength);
    if (!sniffed) {
      throw new Error(
        `${file.name} is not an image I recognize. Use .d64, .prg, .crt, .t64, or .tap.`,
      );
    }
    const id = crypto.randomUUID();
    const meta: UserDisk = {
      id,
      name: file.name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " "),
      filename: file.name,
      kind: sniffed.kind,
      format: sniffed.format,
      size: formatSize(bytes.byteLength),
      byteLength: bytes.byteLength,
      addedAt: Date.now(),
    };
    const stored: StoredDisk = { ...meta, bytes };
    const tx = db.transaction(STORE, "readwrite");
    await reqToPromise(tx.objectStore(STORE).put(stored));
    imported.push(meta);
  }
  emit();
  return imported;
}

export async function saveUserDisk(opts: {
  id?: string;
  name: string;
  filename: string;
  bytes: ArrayBuffer;
  format?: UserDisk["format"];
  kind?: UserDisk["kind"];
}): Promise<UserDisk> {
  const copy = opts.bytes.slice(0);
  const sniffed =
    sniffDisk(opts.filename, copy.byteLength) ??
    (opts.kind && opts.format ? { kind: opts.kind, format: opts.format } : null);
  if (!sniffed) throw new Error("Could not encode that image");
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const rows = await reqToPromise(store.getAll() as IDBRequest<StoredDisk[]>);
  const existing =
    (opts.id ? rows.find((r) => r.id === opts.id) : undefined) ??
    rows.find((r) => r.filename === opts.filename);
  const id = existing?.id ?? opts.id ?? crypto.randomUUID();
  const meta: UserDisk = {
    id,
    name: opts.name,
    filename: opts.filename,
    kind: sniffed.kind,
    format: sniffed.format,
    size: formatSize(copy.byteLength),
    byteLength: copy.byteLength,
    addedAt: existing?.addedAt ?? Date.now(),
  };
  await reqToPromise(store.put({ ...meta, bytes: copy }));
  emit();
  return meta;
}

export async function removeUserDisk(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  await reqToPromise(tx.objectStore(STORE).delete(id));
  emit();
}

export function useUserDisks() {
  const [disks, setDisks] = useState<UserDisk[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      listUserDisks()
        .then((rows) => {
          if (!cancelled) {
            setDisks(rows);
            setReady(true);
          }
        })
        .catch(() => {
          if (!cancelled) setReady(true);
        });
    };
    refresh();
    const unsub = subscribeUserDisks(refresh);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return { disks, ready };
}

export function userTitleId(id: string) {
  return `user:${id}`;
}

export function parseUserTitleId(id: string): string | null {
  return id.startsWith("user:") ? id.slice(5) : null;
}
