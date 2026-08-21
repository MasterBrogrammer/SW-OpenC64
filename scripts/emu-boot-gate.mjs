#!/usr/bin/env node
/**
 * Boot contract gate. Must fail on an idle `]` cursor.
 * Usage: node scripts/emu-boot-gate.mjs [url]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const outDir = join(root, "screenshots");
mkdirSync(outDir, { recursive: true });

const url = process.argv[2] || "http://127.0.0.1:8080/";

function idlePrompt(text) {
  const compact = String(text || "").replace(/[\s\u007f]+/g, "");
  return compact === "]" || compact === ">" || compact === "][";
}

function hasBrickOutTitle(text) {
  const t = String(text || "");
  return /PRESS THE SPACE BAR/i.test(t) || /COPYRIGHT 1979 APPLE COMPUTER/i.test(t);
}

async function inspect(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const host = document.querySelector("[data-boot-phase]");
    const apple2 = window.__oa?.apple2;
    const vm = apple2?.getVideoModes?.();
    const cpu = apple2?.getCPU?.();
    let bright = 0;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      const { width, height } = canvas;
      const data = ctx.getImageData(0, 0, width, height).data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] + data[i + 1] + data[i + 2] > 80) bright += 1;
      }
    }
    const text = vm ? vm.getText() : "";
    return {
      bright,
      text: text.replace(/\s+/g, " ").trim().slice(0, 280),
      rawText: text,
      hires: vm ? vm.isHires() : false,
      textMode: vm ? vm.isText() : true,
      pc: cpu ? cpu.getPC() : 0,
      loaded: host?.getAttribute("data-loaded-id") || "",
      phase: host?.getAttribute("data-boot-phase") || "",
      status: host?.getAttribute("data-emu-status") || "",
    };
  });
}

async function insert(page, id) {
  const card = page.locator(`[data-software-id="${id}"]`);
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await page.waitForFunction(
    (want) =>
      document.querySelector("[data-loaded-id]")?.getAttribute("data-loaded-id") ===
      want,
    id,
    { timeout: 20000 },
  );
}

async function waitForGame(page, id, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = await inspect(page);
  while (Date.now() < deadline) {
    last = await inspect(page);
    if (last.loaded !== id) {
      await page.waitForTimeout(250);
      continue;
    }
    if (last.phase === "error") return last;
    if (id === "little-brick-out" && hasBrickOutTitle(last.text)) return last;
    if (id === "painter") {
      const idle = idlePrompt(last.rawText);
      const prodos = /PRODOS 8/i.test(last.text);
      if (!idle && !prodos && last.bright > 0 && (last.hires || !last.textMode)) {
        return last;
      }
    }
    await page.waitForTimeout(400);
  }
  return last;
}

function verdict(id, stats) {
  const idle = idlePrompt(stats.rawText);
  const reasons = [];
  if (stats.phase === "error") reasons.push(`boot-phase error (${stats.text})`);
  if (stats.bright === 0) reasons.push("black CRT (bright=0)");
  if (idle && !stats.hires) {
    reasons.push(`idle BASIC prompt: ${JSON.stringify(stats.text)}`);
  }
  if (id === "little-brick-out" && !hasBrickOutTitle(stats.text)) {
    reasons.push("Brick Out title never appeared");
  }
  if (id === "painter" && idle && !stats.hires) {
    reasons.push("Painter still at ] — not the playfield");
  }
  return { ok: reasons.length === 0, reasons, ...stats };
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(40000);

const report = { url, items: {} };
let failed = false;

try {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas");
  await page.waitForFunction(
    () => {
      const phase = document
        .querySelector("[data-boot-phase]")
        ?.getAttribute("data-boot-phase");
      return phase === "running" || phase === "error";
    },
    null,
    { timeout: 25000 },
  );

  for (const id of ["little-brick-out", "painter"]) {
    console.log("insert", id);
    await insert(page, id);
    const stats = await waitForGame(page, id, id === "little-brick-out" ? 28000 : 18000);
    await page.locator("canvas").screenshot({
      path: join(outDir, `gate-${id}.png`),
    });
    const item = verdict(id, stats);
    report.items[id] = item;
    console.log(
      id,
      item.ok ? "OK" : "FAIL",
      "bright",
      item.bright,
      "hires",
      item.hires,
      "phase",
      item.phase,
      item.text?.slice(0, 80),
      item.reasons?.join("; ") || "",
    );
    if (!item.ok) failed = true;
  }
} finally {
  writeFileSync(join(outDir, "gate-boot.json"), JSON.stringify(report, null, 2));
  await browser.close();
}

if (failed) {
  console.error("BOOT GATE FAILED");
  process.exit(1);
}
console.log("boot gate passed");
