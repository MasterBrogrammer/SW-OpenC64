#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const outDir = "/workspace/screenshots";
mkdirSync(outDir, { recursive: true });

function canvasStats() {
  const canvas = document.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let bright = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] + data[i + 1] + data[i + 2] > 80) bright += 1;
  }
  const m = window.__oa;
  let text = "";
  try {
    text = m.apple2.getVideoModes().getText();
  } catch {
    text = "";
  }
  return {
    width,
    height,
    bright,
    loaded: document.querySelector("[data-loaded-id]")?.getAttribute("data-loaded-id"),
    text: text.replace(/\s+$/g, "").slice(0, 500),
    pc: m?.apple2.getCPU().getPC(),
    frames: m?.apple2.getStats().renderedFrames,
  };
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.setDefaultTimeout(40000);
await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(
  () => document.querySelector("[data-emu-status]")?.getAttribute("data-emu-status") === "ready",
);
await page.waitForTimeout(8000);

const report = {};
await page.locator("canvas").screenshot({ path: `${outDir}/emu-dos.png` });
await page.screenshot({ path: `${outDir}/emu-ready.png` });
report.dos33 = await page.evaluate(canvasStats);
console.log("dos33", report.dos33);

async function bootId(id, wait) {
  await page.locator(`[data-software-id="${id}"]`).scrollIntoViewIfNeeded();
  await page.locator(`[data-software-id="${id}"]`).click();
  await page.waitForFunction(
    (want) => document.querySelector("[data-loaded-id]")?.getAttribute("data-loaded-id") === want,
    id,
  );
  await page.waitForTimeout(wait);
}

await bootId("applesoft", 3500);
await page.locator("canvas").screenshot({ path: `${outDir}/emu-basic.png` });
report.applesoft = await page.evaluate(canvasStats);
console.log("applesoft", report.applesoft);

await bootId("prodos", 10000);
await page.locator("canvas").screenshot({ path: `${outDir}/emu-prodos.png` });
report.prodos = await page.evaluate(canvasStats);
console.log("prodos", report.prodos);

writeFileSync(`${outDir}/emu-verify.json`, JSON.stringify(report, null, 2));
await browser.close();

if (report.dos33.bright < 1000) {
  console.error("DOS screen too dark");
  process.exit(1);
}
