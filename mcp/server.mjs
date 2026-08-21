#!/usr/bin/env node
/**
 * WOZMCP64 — stdio to Grok, HTTP to the running SW-OpenC64 tab.
 * Bind: 127.0.0.1:9878 (WOZMCP64_PORT).
 */
import http from "node:http";
import { Buffer } from "node:buffer";
import { mkdirSync, writeFileSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.WOZMCP64_PORT || 9878);
const HOST = "127.0.0.1";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHOT_DIR = join(ROOT, "screenshots");

const TOOLS = [
  {
    name: "status",
    description:
      "Snapshot of the running SW-OpenC64: loaded disk, boot phase, drive 8, screen text, PC.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "catalog",
    description: "List bundled titles (id, name, category, year) the emulator can insert.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "insert",
    description:
      "Insert and boot a catalog title by id (e.g. basic, tenprint, hello, blank-d64).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Catalog title id" },
      },
      required: ["id"],
    },
  },
  {
    name: "eject",
    description: "Eject the disk and cold-reset to Commodore BASIC READY.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "type",
    description:
      "Type into the C64 keyboard buffer (PETSCII). Adds Return if return is true.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        return: { type: "boolean", description: "Append Return (0x0D)" },
      },
      required: ["text"],
    },
  },
  {
    name: "key",
    description: "Press a special key: return, esc, tab, delete, up, down, left, right, space.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "reset",
    description: "Warm reset the C64.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "screenshot",
    description:
      "Grab the CRT as JPEG. Writes screenshots/mcp-last.jpg and returns screen text plus the path.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "wait",
    description: "Wait until boot phase is running (or error), up to timeout_ms.",
    inputSchema: {
      type: "object",
      properties: {
        timeout_ms: { type: "number" },
      },
    },
  },
];

/** @type {{ res: http.ServerResponse, timeout: NodeJS.Timeout }[]} */
const waiters = [];
/** @type {Map<string, { resolve: (v: unknown) => void, reject: (e: Error) => void, timeout: NodeJS.Timeout }>} */
const inflight = new Map();
let cmdSeq = 0;
let lastSeen = 0;

function log(...args) {
  process.stderr.write(`[wozmcp64] ${args.join(" ")}\n`);
}

// MCP stdio is JSON-RPC on stdout. Never let console.log leak into the pipe.
console.log = (...args) => log(...args);
console.info = (...args) => log(...args);
console.warn = (...args) => log(...args);

function flushWaiter(payload) {
  const w = waiters.shift();
  if (!w) return false;
  clearTimeout(w.timeout);
  w.res.writeHead(200, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
  });
  w.res.end(JSON.stringify(payload));
  return true;
}

function sendToBrowser(name, args, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const id = `c${++cmdSeq}`;
    const timeout = setTimeout(() => {
      inflight.delete(id);
      reject(new Error("Emulator did not answer (is SW-OpenC64 open on :8082?)"));
    }, timeoutMs);
    inflight.set(id, { resolve, reject, timeout });
    const payload = { id, name, args: args ?? {} };
    if (!flushWaiter(payload)) {
      // No tab polling yet — keep it queued on the first waiter timeout path
      // by attaching to a one-shot queue.
      queued.push(payload);
    }
  });
}

/** @type {object[]} */
const queued = [];

const httpServer = http.createServer((req, res) => {
  const origin = String(req.headers.origin || "");
  const allow =
    /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin) ? origin : "";
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": allow || "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    });
    res.end();
    return;
  }
  const cors = { "access-control-allow-origin": allow || "*" };
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);

  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json", ...cors });
    res.end(
      JSON.stringify({
        ok: true,
        waiters: waiters.length,
        queued: queued.length,
        lastSeen,
      }),
    );
    return;
  }

  if (req.method === "GET" && url.pathname === "/poll") {
    lastSeen = Date.now();
    if (queued.length) {
      res.writeHead(200, { "content-type": "application/json", ...cors });
      res.end(JSON.stringify(queued.shift()));
      return;
    }
    const timeout = setTimeout(() => {
      const i = waiters.findIndex((w) => w.res === res);
      if (i >= 0) waiters.splice(i, 1);
      res.writeHead(204, cors);
      res.end();
    }, 15000);
    waiters.push({ res, timeout });
    req.on("close", () => {
      clearTimeout(timeout);
      const i = waiters.findIndex((w) => w.res === res);
      if (i >= 0) waiters.splice(i, 1);
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/result") {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 8_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        const msg = JSON.parse(body);
        const slot = inflight.get(msg.id);
        if (slot) {
          inflight.delete(msg.id);
          clearTimeout(slot.timeout);
          if (msg.ok) slot.resolve(msg.result);
          else slot.reject(new Error(msg.error || "emulator error"));
        }
      } catch (err) {
        log("bad result", err);
      }
      res.writeHead(204, cors);
      res.end();
    });
    return;
  }

  res.writeHead(404, cors);
  res.end("not found");
});

httpServer.on("error", (err) => {
  // Handshake must not die if a leftover process still holds the bridge port.
  log("http", err.message);
});
httpServer.listen(PORT, HOST, () => {
  log(`bridge http://${HOST}:${PORT}`);
});

/** @type {"ndjson" | "lsp"} */
let framing = "ndjson";
const SUPPORTED_PROTOCOL = new Set([
  "2024-11-05",
  "2025-03-26",
  "2025-06-18",
  "2025-11-25",
  "2026-07-28",
]);

function writeRpc(msg) {
  const json = JSON.stringify(msg);
  if (framing === "lsp") {
    const payload = Buffer.from(json, "utf8");
    writeSync(1, `Content-Length: ${payload.length}\r\n\r\n`);
    writeSync(1, payload);
  } else {
    writeSync(1, json + "\n");
  }
}

async function handleCall(name, args) {
  if (name === "screenshot") {
    const result = await sendToBrowser("screenshot", args || {}, 12000);
    const shot = result && typeof result === "object" ? result : {};
    const b64 = shot.jpeg;
    delete shot.jpeg;
    if (typeof b64 === "string" && b64.length) {
      mkdirSync(SHOT_DIR, { recursive: true });
      const path = join(SHOT_DIR, "mcp-last.jpg");
      writeFileSync(path, Buffer.from(b64, "base64"));
      shot.path = path;
    }
    return shot;
  }
  const timeout =
    name === "insert" && args && args.id === "sword-of-kadash" ? 75000 : 20000;
  return sendToBrowser(name, args || {}, timeout);
}

function toolText(value) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  };
}

function toolError(message) {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

let buf = Buffer.alloc(0);
let loggedFirstChunk = false;

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function looksLikeLsp(buffer) {
  const head = buffer.subarray(0, Math.min(buffer.length, 48)).toString("utf8");
  return /^\s*Content-Length:/i.test(head);
}

function pumpStdin() {
  for (;;) {
    if (!buf.length) break;

    if (looksLikeLsp(buf)) {
      const crlf = buf.indexOf("\r\n\r\n");
      const lf = buf.indexOf("\n\n");
      let headerEnd = -1;
      let sep = 0;
      if (crlf >= 0 && (lf < 0 || crlf <= lf)) {
        headerEnd = crlf;
        sep = 4;
      } else if (lf >= 0) {
        headerEnd = lf;
        sep = 2;
      }
      if (headerEnd < 0) break;
      const header = buf.subarray(0, headerEnd).toString("utf8");
      const match = /Content-Length:\s*(\d+)/i.exec(header);
      if (!match) {
        buf = buf.subarray(headerEnd + sep);
        continue;
      }
      const len = Number(match[1]);
      const start = headerEnd + sep;
      if (buf.length < start + len) break;
      const body = buf.subarray(start, start + len).toString("utf8");
      buf = buf.subarray(start + len);
      framing = "lsp";
      const msg = parseJson(body);
      if (msg) void onMessage(msg);
      continue;
    }

    const nl = buf.indexOf(0x0a);
    if (nl < 0) {
      const text = buf.toString("utf8").trim();
      if (text.startsWith("{")) {
        const msg = parseJson(text);
        if (msg) {
          buf = Buffer.alloc(0);
          framing = "ndjson";
          void onMessage(msg);
          continue;
        }
      }
      break;
    }

    const line = buf.subarray(0, nl).toString("utf8").replace(/\r$/, "").trim();
    buf = buf.subarray(nl + 1);
    if (!line || /^Content-Length:/i.test(line)) continue;
    framing = "ndjson";
    const msg = parseJson(line);
    if (msg) void onMessage(msg);
  }
}

process.stdin.on("data", (chunk) => {
  if (!loggedFirstChunk) {
    loggedFirstChunk = true;
    const preview = chunk.subarray(0, 96).toString("utf8").replace(/\n/g, "\\n").replace(/\r/g, "\\r");
    log("stdin", `${chunk.length}B`, preview);
  }
  buf = Buffer.concat([buf, chunk]);
  pumpStdin();
});
process.stdin.resume();

async function onMessage(msg) {
  const id = msg.id;
  const method = msg.method;
  if (method === "initialize") {
    const requested = String(msg.params?.protocolVersion || "");
    const protocolVersion = SUPPORTED_PROTOCOL.has(requested)
      ? requested
      : "2025-03-26";
    writeRpc({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "WOZMCP64", version: "1.0.0" },
        instructions:
          "SW-OpenC64 Commodore 64 emulator. Tools talk to the browser tab at http://127.0.0.1:8082/ via a localhost bridge. If status says the emulator is not connected, the user needs that tab open.",
      },
    });
    log("initialize", protocolVersion, `id=${JSON.stringify(id)}`);
    return;
  }
  if (method === "notifications/initialized" || method === "notifications/cancelled") {
    return;
  }
  if (method === "ping") {
    writeRpc({ jsonrpc: "2.0", id, result: {} });
    return;
  }
  if (method === "tools/list") {
    writeRpc({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
    return;
  }
  if (method === "tools/call") {
    const name = msg.params?.name;
    const args = msg.params?.arguments || {};
    try {
      const result = await handleCall(name, args);
      writeRpc({ jsonrpc: "2.0", id, result: toolText(result) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      writeRpc({ jsonrpc: "2.0", id, result: toolError(message) });
    }
    return;
  }
  if (id !== undefined) {
    writeRpc({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Unknown method ${method}` },
    });
  }
}

process.on("uncaughtException", (err) => {
  log("uncaught", err?.stack || err);
});

if (!process.stdin.isTTY) {
  process.stdin.on("end", () => {
    httpServer.close();
    process.exit(0);
  });
} else {
  log("TTY stdin — HTTP bridge only (Grok is not attached)");
}
