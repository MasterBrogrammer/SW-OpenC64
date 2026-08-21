#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:8080/";
const outDir = "/workspace/screenshots";
mkdirSync(outDir, { recursive: true });

function canvasStats() {
  const canvas = document.querySelector("canvas");
  if (!canvas) return { missing: true };
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let bright = 0;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const v = data[i] + data[i + 1] + data[i + 2];
    sum += v;
    if (v > 80) bright += 1;
  }
  return { width, height, bright, mean: sum / (width * height * 3) };
}

function machineInfo() {
  const m = window.__oa;
  if (!m) return { hasMachine: false };
  const stats = m.apple2.getStats();
  const cpu = m.apple2.getCPU();
  let text = "";
  try {
    text = m.apple2.getVideoModes().getText();
  } catch (e) {
    text = String(e);
  }
  return {
    hasMachine: true,
    cycles: stats.cycles,
    frames: stats.frames,
    rendered: stats.renderedFrames,
    pc: cpu.getPC(),
    running: m.apple2.isRunning(),
    text: text.slice(0, 400),
  };
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(30000);
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

const report = { url, errors, items: {} };

try {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas");
  await page.waitForFunction(
    () => document.querySelector("[data-emu-status]")?.getAttribute("data-emu-status") === "ready",
    null,
    { timeout: 25000 },
  );
  await page.waitForTimeout(4500);
  await page.locator("canvas").screenshot({ path: `${outDir}/emu-dos.png` });
  await page.screenshot({ path: `${outDir}/emu-ready.png` });
  report.items.dos33 = {
    ...(await page.evaluate(canvasStats)),
    ...(await page.evaluate(machineInfo)),
    loaded: await page.getAttribute("[data-loaded-id]", "data-loaded-id"),
    status: await page.getAttribute("[data-loaded-id]", "data-emu-status"),
  };
  console.log("dos33", report.items.dos33);

  const applesoft = page.locator('[data-software-id="applesoft"]');
  await applesoft.scrollIntoViewIfNeeded();
  await applesoft.click();
  await page.waitForFunction(
    () => document.querySelector("[data-loaded-id]")?.getAttribute("data-loaded-id") === "applesoft",
    null,
    { timeout: 15000 },
  );
  await page.waitForTimeout(2500);
  await page.locator("canvas").screenshot({ path: `${outDir}/emu-basic.png` });
  report.items.applesoft = {
    ...(await page.evaluate(canvasStats)),
    ...(await page.evaluate(machineInfo)),
    loaded: await page.getAttribute("[data-loaded-id]", "data-loaded-id"),
  };
  console.log("applesoft", report.items.applesoft);

  const prodos = page.locator('[data-software-id="prodos"]');
  await prodos.scrollIntoViewIfNeeded();
  await prodos.click();
  await page.waitForFunction(
    () => document.querySelector("[data-loaded-id]")?.getAttribute("data-loaded-id") === "prodos",
    null,
    { timeout: 15000 },
  );
  await page.waitForTimeout(5000);
  await page.locator("canvas").screenshot({ path: `${outDir}/emu-prodos.png` });
  report.items.prodos = {
    ...(await page.evaluate(canvasStats)),
    ...(await page.evaluate(machineInfo)),
    loaded: await page.getAttribute("[data-loaded-id]", "data-loaded-id"),
  };
  console.log("prodos", report.items.prodos);
} catch (err) {
  report.fail = String(err);
  console.error(err);
  try {
    await page.screenshot({ path: `${outDir}/emu-fail.png` });
    report.failInfo = await page.evaluate(machineInfo);
    report.failCanvas = await page.evaluate(canvasStats);
  } catch {
    /* ignore */
  }
}

report.errors = errors;
writeFileSync(`${outDir}/emu-verify.json`, JSON.stringify(report, null, 2));
console.log("errors", errors);
await browser.close();
if (report.fail || (report.items.dos33 && report.items.dos33.bright < 200)) {
  process.exit(1);
}
