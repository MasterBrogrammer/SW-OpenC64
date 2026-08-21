#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const outDir = "/workspace/screenshots";
mkdirSync(outDir, { recursive: true });

function canvasStats(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;
    let bright = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] + data[i + 1] + data[i + 2] > 80) bright += 1;
    }
    return { bright };
  });
}

const ids = ["a2osx", "a2osx-800", "contiki", "contiki-800", "plasma", "plforth", "audit", "blank-dos"];
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
await page.waitForSelector("canvas");
await page.waitForFunction(() => document.querySelector("[data-emu-status]")?.getAttribute("data-emu-status") === "ready", null, { timeout: 25000 });

const report = {};
for (const id of ids) {
  const card = page.locator(`[data-software-id="${id}"]`);
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await page.waitForFunction(
    (want) => {
      const el = document.querySelector("[data-loaded-id]");
      return el?.getAttribute("data-emu-status") === "ready" && el?.getAttribute("data-loaded-id") === want;
    },
    id,
    { timeout: 25000 },
  );
  await page.waitForTimeout(id.includes("osx") ? 10000 : 5000);
  await page.locator("canvas").screenshot({ path: `${outDir}/qa-${id}.png` });
  report[id] = { ...(await canvasStats(page)), loaded: await page.getAttribute("[data-loaded-id]", "data-loaded-id") };
  console.log(id, report[id]);
}
writeFileSync(`${outDir}/qa-rest.json`, JSON.stringify(report, null, 2));
await browser.close();
