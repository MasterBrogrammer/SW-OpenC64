import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir, hostname, userInfo } from "node:os";
import { join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";

export type HostTermBody =
  | { action: "open" }
  | { action: "exec"; session: string; line: string }
  | { action: "grok"; session: string; prompt: string }
  | { action: "kill"; session: string }
  | { action: "close"; session: string };

export type HostTermOk =
  | {
      ok: true;
      action: "open";
      session: string;
      user: string;
      host: string;
      shell: string;
      cwd: string;
      home: string;
    }
  | {
      ok: true;
      action: "exec";
      out: string;
      err: string;
      code: number | null;
      cwd: string;
      timedOut?: boolean;
    }
  | { ok: true; action: "kill" | "close" };

type Session = {
  id: string;
  cwd: string;
  shell: string;
  user: string;
  host: string;
  home: string;
  current: ChildProcess | null;
  grokId: string | null;
  grokUsed: boolean;
  lastUsed: number;
};

const sessions = new Map<string, Session>();
const MAX_LINE = 8000;
const MAX_OUT = 120_000;
const EXEC_MS = 25_000;
const GROK_MS = 180_000;
const IDLE_MS = 30 * 60 * 1000;

function localHost(request: Request): boolean {
  const raw = (request.headers.get("host") ?? "").split(",")[0]?.trim() ?? "";
  const host = raw.replace(/^\[/, "").replace(/\]:\d+$/, "").replace(/:\d+$/, "");
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

function deny(): Response {
  return Response.json(
    {
      ok: false,
      error: "This terminal is local-only. Open SW-OpenC64 at http://127.0.0.1:8082/",
    },
    { status: 403 },
  );
}

function defaultShell() {
  return process.env.SHELL?.trim() || "/bin/zsh";
}

function grokBin() {
  return join(homedir(), ".grok", "bin", "grok");
}

function pathWithGrok() {
  const extra = join(homedir(), ".grok", "bin");
  const path = process.env.PATH ?? "";
  if (path.split(":").includes(extra)) return path;
  return `${extra}:${path}`;
}

function sweep() {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.lastUsed > IDLE_MS) {
      s.current?.kill("SIGKILL");
      sessions.delete(id);
    }
  }
}

function decode(buf: Buffer) {
  return buf
    .toString("utf8")
    .replace(/\x1b\[[0-9;?=]*[ -/]*[@-~]/g, "")
    .replace(/\x1b\][^\x07]*\x07/g, "")
    .replace(/\r/g, "");
}

function clip(s: string) {
  if (s.length <= MAX_OUT) return s;
  return `${s.slice(0, MAX_OUT)}\n… (truncated)`;
}

function runLine(session: Session, line: string): Promise<{
  out: string;
  err: string;
  code: number | null;
  cwd: string;
  timedOut: boolean;
}> {
  if (session.current) {
    session.current.kill("SIGKILL");
    session.current = null;
  }
  const mark = `__OA_${randomBytes(6).toString("hex")}__`;
  const wrap = [
    'cd -- "$OA_CWD" || exit 1',
    'eval "$OA_CMD"',
    "OA_STATUS=$?",
    `printf '\\n%s\\n%d\\n%s\\n' '${mark}' "$OA_STATUS" "$(pwd)"`,
    'exit "$OA_STATUS"',
  ].join("\n");

  return new Promise((resolve) => {
    const child = spawn(session.shell, ["-lc", wrap], {
      cwd: session.cwd,
      env: {
        ...process.env,
        PATH: pathWithGrok(),
        TERM: "dumb",
        OA_CWD: session.cwd,
        OA_CMD: line,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    session.current = child;
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    child.stdout?.on("data", (d: Buffer) => chunks.push(d));
    child.stderr?.on("data", (d: Buffer) => errChunks.push(d));

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, EXEC_MS);

    child.on("close", (code) => {
      clearTimeout(timer);
      if (session.current === child) session.current = null;
      const raw = decode(Buffer.concat(chunks));
      const err = clip(decode(Buffer.concat(errChunks)).trimEnd());
      const idx = raw.lastIndexOf(mark);
      const timedOut = idx < 0 && code === null;
      if (idx < 0) {
        resolve({
          out: clip(raw.trimEnd()),
          err: timedOut ? [err, "timed out"].filter(Boolean).join("\n") : err,
          code,
          cwd: session.cwd,
          timedOut,
        });
        return;
      }
      const before = raw.slice(0, idx).replace(/\n+$/, "");
      const rest = raw
        .slice(idx + mark.length)
        .trim()
        .split("\n");
      const parsed = Number(rest[0]);
      const nextCwd = rest[1]?.trim();
      if (nextCwd && (Number.isNaN(parsed) ? code : parsed) === 0) {
        session.cwd = nextCwd;
      }
      resolve({
        out: clip(before),
        err,
        code: Number.isNaN(parsed) ? code : parsed,
        cwd: session.cwd,
        timedOut: false,
      });
    });

    child.on("error", (e) => {
      clearTimeout(timer);
      if (session.current === child) session.current = null;
      resolve({
        out: "",
        err: e.message,
        code: 1,
        cwd: session.cwd,
        timedOut: false,
      });
    });
  });
}

function streamGrok(session: Session, prompt: string): Response {
  const bin = grokBin();
  if (!existsSync(bin)) {
    return Response.json(
      { ok: false, error: "grok CLI not found at ~/.grok/bin/grok" },
      { status: 500 },
    );
  }
  if (session.current) {
    session.current.kill("SIGKILL");
    session.current = null;
  }
  const grokId = session.grokId ?? randomUUID();
  session.grokId = grokId;
  const args = [
    "-p",
    prompt,
    "--output-format",
    "plain",
    "--cwd",
    session.cwd,
    "--yolo",
    "--no-auto-update",
    "--max-turns",
    "4",
    "--tools",
    "read_file,grep,list_dir",
    "--disallowed-tools",
    "Agent,run_terminal_cmd,search_replace",
    "--deny",
    "MCPTool",
    "--deny",
    "Bash",
    "--deny",
    "Edit",
    "--deny",
    "Write",
    ...(session.grokUsed ? ["--resume", grokId] : ["--session-id", grokId]),
  ];
  session.grokUsed = true;

  const child = spawn(bin, args, {
    cwd: session.cwd,
    env: {
      ...process.env,
      PATH: pathWithGrok(),
      TERM: "dumb",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  session.current = child;

  const encoder = new TextEncoder();
  let errAcc = "";
  const timer = setTimeout(() => child.kill("SIGKILL"), GROK_MS);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const pushText = (text: string) => {
        if (!text) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          /* closed */
        }
      };
      child.stdout?.on("data", (d: Buffer) => pushText(decode(d)));
      child.stderr?.on("data", (d: Buffer) => {
        errAcc += decode(d);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (session.current === child) session.current = null;
        if (code && errAcc.trim()) pushText(`\n${clip(errAcc.trim())}`);
        try {
          controller.close();
        } catch {
          /* closed */
        }
      });
      child.on("error", (e) => {
        clearTimeout(timer);
        if (session.current === child) session.current = null;
        pushText(e.message);
        try {
          controller.close();
        } catch {
          /* closed */
        }
      });
    },
    cancel() {
      clearTimeout(timer);
      child.kill("SIGKILL");
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-cache",
      "x-accel-buffering": "no",
    },
  });
}

export async function handleHostTerm(request: Request): Promise<Response> {
  if (!localHost(request)) return deny();
  sweep();

  let body: HostTermBody;
  try {
    body = (await request.json()) as HostTermBody;
  } catch {
    return Response.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  if (body.action === "open") {
    const id = randomUUID();
    const home = homedir();
    const info = userInfo();
    const session: Session = {
      id,
      cwd: process.cwd() || home,
      shell: defaultShell(),
      user: info.username || "user",
      host: hostname() || "localhost",
      home,
      current: null,
      grokId: null,
      grokUsed: false,
      lastUsed: Date.now(),
    };
    sessions.set(id, session);
    const payload: HostTermOk = {
      ok: true,
      action: "open",
      session: id,
      user: session.user,
      host: session.host,
      shell: session.shell,
      cwd: session.cwd,
      home: session.home,
    };
    return Response.json(payload);
  }

  const session = sessions.get(body.session);
  if (!session) {
    return Response.json({ ok: false, error: "Session ended — refresh the tab" }, { status: 410 });
  }
  session.lastUsed = Date.now();

  if (body.action === "close") {
    session.current?.kill("SIGKILL");
    sessions.delete(session.id);
    return Response.json({ ok: true, action: "close" } satisfies HostTermOk);
  }

  if (body.action === "kill") {
    session.current?.kill("SIGINT");
    setTimeout(() => session.current?.kill("SIGKILL"), 400);
    return Response.json({ ok: true, action: "kill" } satisfies HostTermOk);
  }

  if (body.action === "grok") {
    const prompt = body.prompt ?? "";
    if (prompt.length > MAX_LINE) {
      return Response.json({ ok: false, error: "Line too long" }, { status: 400 });
    }
    return streamGrok(session, prompt);
  }

  if (body.action === "exec") {
    const line = body.line ?? "";
    if (line.length > MAX_LINE) {
      return Response.json({ ok: false, error: "Line too long" }, { status: 400 });
    }
    const result = await runLine(session, line);
    return Response.json({
      ok: true,
      action: "exec",
      ...result,
    } satisfies HostTermOk);
  }

  return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
