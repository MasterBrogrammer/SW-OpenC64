import { useEffect, useRef, useSyncExternalStore } from "react";
import { useEmu } from "@/lib/emu-store";
import {
  clearTermRows,
  getTermState,
  patchTerm,
  patchTermRow,
  pushTermRow,
  subscribeTerm,
  type TermMode,
} from "@/lib/term-live";
import { cn } from "@/lib/utils";

type OpenOk = {
  ok: true;
  action: "open";
  session: string;
  user: string;
  host: string;
  shell: string;
  cwd: string;
  home: string;
};

type ExecOk = {
  ok: true;
  action: "exec";
  out: string;
  err: string;
  code: number | null;
  cwd: string;
  timedOut?: boolean;
};

type Fail = { ok: false; error: string };

function tilde(cwd: string, home: string) {
  if (!home) return cwd;
  if (cwd === home) return "~";
  if (cwd.startsWith(`${home}/`)) return `~${cwd.slice(home.length)}`;
  return cwd;
}

function shortHost(host: string) {
  return host.replace(/\.local$/, "").split(".")[0] ?? host;
}

async function frame(body: unknown): Promise<OpenOk | ExecOk | Fail | Response> {
  const res = await fetch("/api/host-term", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const ctype = res.headers.get("content-type") ?? "";
  if (ctype.includes("text/plain")) return res;
  const json = (await res.json()) as OpenOk | ExecOk | Fail;
  if (!res.ok && !("error" in json)) {
    return { ok: false, error: `Terminal ${res.status}` };
  }
  return json;
}

function setMode(next: TermMode) {
  patchTerm({ mode: next });
}

export function HostUplink() {
  const term = useSyncExternalStore(subscribeTerm, getTermState, getTermState);
  const inputRef = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const histAt = useRef(-1);
  const connectGen = useRef(0);

  const home = term.meta?.home ?? "";
  const promptCwd = tilde(term.cwd, home);
  const livePrompt = term.mode === "grok" ? "grok>" : `${promptCwd} %`;

  function readDraft() {
    return inputRef.current?.value ?? "";
  }

  function setDraft(value: string) {
    if (inputRef.current) inputRef.current.value = value;
  }

  async function freshConnect() {
    const gen = ++connectGen.current;
    patchTerm({ busy: true });
    useEmu.getState().setFocused(false);
    const res = await frame({ action: "open" });
    if (gen !== connectGen.current) return;
    if (res instanceof Response || !res.ok || res.action !== "open") {
      pushTermRow(
        "err",
        !(res instanceof Response) && !res.ok ? res.error : "Could not open a shell",
      );
      patchTerm({ busy: false });
      return;
    }
    patchTerm({
      session: res.session,
      meta: {
        session: res.session,
        user: res.user,
        host: res.host,
        shell: res.shell,
        home: res.home,
      },
      cwd: res.cwd,
      mode: getTermState().mode,
      busy: false,
    });
    useEmu.getState().beginUplink();
    const sh = res.shell.split("/").pop() ?? "zsh";
    if (getTermState().rows.length === 0) {
      pushTermRow(
        "sys",
        `${sh}  ${res.user}@${shortHost(res.host)}  ${tilde(res.cwd, res.home)}\ntype grok to talk · exit leaves grok · this is your Mac`,
      );
    }
    inputRef.current?.focus();
  }

  async function ensureSession() {
    const existing = getTermState().session;
    if (existing) {
      const ping = await frame({
        action: "exec",
        session: existing,
        line: "true",
      });
      if (!(ping instanceof Response) && ping.ok && ping.action === "exec") {
        patchTerm({ cwd: ping.cwd, busy: false });
        useEmu.getState().beginUplink();
        inputRef.current?.focus();
        return;
      }
      patchTerm({ session: null });
      pushTermRow("sys", "shell restarted");
    }
    await freshConnect();
  }

  async function runShell(line: string) {
    const session = getTermState().session;
    if (!session) {
      pushTermRow("err", "Shell is gone — click Terminal again");
      return;
    }
    patchTerm({ busy: true });
    const res = await frame({ action: "exec", session, line });
    patchTerm({ busy: false });
    if (res instanceof Response || !res.ok) {
      pushTermRow("err", res instanceof Response ? "Unexpected response" : res.error);
      return;
    }
    if (res.action !== "exec") return;
    patchTerm({ cwd: res.cwd });
    if (res.out) pushTermRow("out", res.out);
    if (res.err) pushTermRow("err", res.err);
    if (!res.out && !res.err && res.code && res.code !== 0) {
      pushTermRow("err", `exit ${res.code}`);
    }
  }

  async function runGrok(prompt: string) {
    const session = getTermState().session;
    if (!session) {
      pushTermRow("err", "Shell is gone — click Terminal again");
      return;
    }
    const id = pushTermRow("grok", "");
    patchTerm({ busy: true });
    try {
      const res = await fetch("/api/host-term", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "grok", session, prompt }),
      });
      const ctype = res.headers.get("content-type") ?? "";
      if (!res.ok && !ctype.includes("text/plain")) {
        const json = (await res.json()) as Fail;
        patchTermRow(id, { text: json.error || `grok ${res.status}`, kind: "err" });
        return;
      }
      if (!res.body) {
        patchTermRow(id, { text: "no reply" });
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        patchTermRow(id, { text: acc });
      }
      if (!acc.trim()) patchTermRow(id, { text: "(no output)" });
    } catch (err) {
      patchTermRow(id, {
        text: err instanceof Error ? err.message : "grok failed",
        kind: "err",
      });
    } finally {
      patchTerm({ busy: false });
    }
  }

  async function exec(raw: string) {
    const line = raw.replace(/\s+$/, "");
    if (!line) return;
    patchTerm({
      hist: [line, ...getTermState().hist.filter((h) => h !== line)].slice(0, 80),
    });
    histAt.current = -1;
    setDraft("");

    const low = line.trim().toLowerCase();
    if (low === "clear" || low === "cls") {
      clearTermRows();
      return;
    }

    const mode = getTermState().mode;
    const cwdNow = getTermState().cwd;
    const homeNow = getTermState().meta?.home ?? "";
    const promptNow = `${tilde(cwdNow, homeNow)} %`;

    if (mode === "grok") {
      if (low === "exit" || low === "quit" || low === "q") {
        pushTermRow("in", line, "grok>");
        pushTermRow("sys", "back in the shell");
        setMode("shell");
        return;
      }
      pushTermRow("in", line, "grok>");
      await runGrok(line);
      return;
    }

    if (low === "grok") {
      pushTermRow("in", line, promptNow);
      setMode("grok");
      pushTermRow("sys", "talking to grok. type as usual. exit returns to the shell.");
      return;
    }
    if (/^grok\s+\S/.test(line) && !/^grok\s+-/.test(line)) {
      const prompt = line.replace(/^grok\s+/, "");
      pushTermRow("in", line, promptNow);
      setMode("grok");
      await runGrok(prompt);
      return;
    }

    pushTermRow("in", line, promptNow);
    await runShell(line);
  }

  useEffect(() => {
    useEmu.getState().setFocused(false);
    void ensureSession();
    return () => {
      connectGen.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [term.rows, term.busy]);

  const connected = Boolean(term.session);
  const shellName = term.meta?.shell.split("/").pop() ?? "zsh";

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      data-uplink={connected ? "carrier" : "idle"}
      data-term-mode={term.mode}
    >
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <span className={cn("uplink-led", connected && "on")} />
        <p className="min-w-0 flex-1 truncate font-mono text-xs text-fg">
          {connected
            ? term.mode === "grok"
              ? "grok"
              : `${shellName}  ${promptCwd}`
            : "starting…"}
        </p>
        <button
          type="button"
          className="h-9 rounded-md px-2 font-mono text-xs text-muted hover:text-fg"
          onClick={() => clearTermRows()}
        >
          Clear
        </button>
      </div>

      <div
        ref={scroller}
        role="log"
        aria-live="polite"
        className="uplink-crt min-h-0 flex-1 overflow-y-auto px-3 py-2"
        onClick={() => inputRef.current?.focus()}
      >
        {term.rows.map((row) => (
          <pre
            key={row.id}
            className={cn(
              "uplink-line",
              row.kind === "in" && "uplink-in",
              row.kind === "err" && "uplink-err",
              row.kind === "sys" && "uplink-sys",
              row.kind === "grok" && "uplink-grok",
            )}
          >
            {row.kind === "in"
              ? `${row.prompt ?? "%"} ${row.text}`
              : row.text || " "}
          </pre>
        ))}
        {term.busy ? (
          <pre className="uplink-sys uplink-wait">
            {term.mode === "grok" ? "grok is thinking…" : "…"}
          </pre>
        ) : null}
      </div>

      <form
        className="uplink-input-row shrink-0"
        onSubmit={(e) => {
          e.preventDefault();
          if (term.busy) return;
          void exec(readDraft());
        }}
      >
        <span className="uplink-prompt" aria-hidden>
          {livePrompt}
        </span>
        <input
          ref={inputRef}
          disabled={!connected || term.busy}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          aria-label={term.mode === "grok" ? "Message for Grok" : "Shell command"}
          className="uplink-field"
          onFocus={() => useEmu.getState().setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "c" && e.ctrlKey) {
              e.preventDefault();
              const id = getTermState().session;
              if (id) void frame({ action: "kill", session: id });
              return;
            }
            const hist = getTermState().hist;
            if (e.key === "ArrowUp") {
              e.preventDefault();
              const next = Math.min(histAt.current + 1, hist.length - 1);
              if (next < 0) return;
              histAt.current = next;
              setDraft(hist[next] ?? "");
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              const next = histAt.current - 1;
              if (next < 0) {
                histAt.current = -1;
                setDraft("");
                return;
              }
              histAt.current = next;
              setDraft(hist[next] ?? "");
            }
          }}
        />
      </form>
    </div>
  );
}
