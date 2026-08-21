#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:8080/";
const outDir = "/workspace/screenshots";
mkdirSync(outDir, { recursive: true });

const ids = process.argv.slice(3).length
  ? process.argv.slice(3)
  : [
      "painter",
      "tombombem",
      "mazezam",
      "mystery-house",
      "eamon",
      "colossal-cave",
      "bam",
      "silvern",
      "applewriter",
      "fredwriter",
      "electric-duet",
      "applepi-music",
    ];

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const report = { url, items: {} };

for (const id of ids) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(40000);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas");
  await page.waitForFunction(
    () =>
      document.querySelector("[data-emu-status]")?.getAttribute("data-emu-status") ===
      "ready",
  );
  const card = page.locator(`[data-software-id="${id}"]`);
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await page.waitForFunction(
    (want) =>
      document.querySelector("[data-loaded-id]")?.getAttribute("data-loaded-id") ===
      want,
    id,
  );
  const started = Date.now();
  let stats = { bright: 0 };
  while (Date.now() - started < 16000) {
    await page.waitForTimeout(800);
    stats = await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
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
      const vm = window.__oa?.apple2.getVideoModes();
      const cpu = window.__oa?.apple2.getCPU();
      return {
        bright,
        mean: sum / (width * height * 3),
        pc: cpu ? cpu.getPC() : 0,
        text: vm ? vm.getText().replace(/\s+/g, " ").trim().slice(0, 280) : "",
        drive: document.querySelector("[data-emu-status]")?.getAttribute("data-emu-status"),
      };
    });
    if (stats.bright > 400) break;
  }
  await page.locator("canvas").screenshot({ path: `${outDir}/qa-${id}.png` });
  report.items[id] = { ...stats, loaded: id, ok: stats.bright > 400 };
  console.log(
    id,
    report.items[id].ok ? "OK" : "DIM",
    "bright",
    stats.bright,
    "pc",
    stats.pc,
    stats.text?.slice(0, 90),
  );
  await page.close();
}

writeFileSync(`${outDir}/qa-foss.json`, JSON.stringify(report, null, 2));
await browser.close();
const failed = ids.filter((id) => !report.items[id].ok);
if (failed.length) {
  console.error("FAILED", failed.join(", "));
  process.exit(1);
}
console.log("all foss titles showed pixels");
