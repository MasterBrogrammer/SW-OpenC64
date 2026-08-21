#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:8080/";
const outDir = "/workspace/screenshots";
mkdirSync(outDir, { recursive: true });

function canvasStats(page) {
  return page.evaluate(() => {
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
  });
}

async function shot(page, name) {
  const canvas = page.locator("canvas");
  await canvas.screenshot({ path: `${outDir}/${name}.png` });
}

async function waitReady(page, id, timeout = 20000) {
  await page.waitForFunction(
    (want) => {
      const el = document.querySelector("[data-loaded-id]");
      const status = el?.getAttribute("data-emu-status");
      const loaded = el?.getAttribute("data-loaded-id");
      return status === "ready" && (!want || loaded === want);
    },
    id,
    { timeout },
  );
}

async function runItem(page, id) {
  const card = page.locator(`[data-software-id="${id}"]`);
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await waitReady(page, id, 25000);
  await page.waitForTimeout(id.includes("desktop") || id.includes("osx") ? 8000 : 3500);
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(30000);

const report = { url, items: {} };

try {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas");
  await waitReady(page, "dos33", 25000);
  await page.waitForTimeout(4000);
  await shot(page, "qa-dos33");
  await page.screenshot({ path: `${outDir}/qa-home.png` });
  report.items.dos33 = {
    ...(await canvasStats(page)),
    loaded: await page.getAttribute("[data-loaded-id]", "data-loaded-id"),
    title: await page.locator("text=DOS 3.3").first().isVisible(),
  };

  for (const id of ["a2desktop", "a2desktop-800", "prodos", "applesoft"]) {
    await runItem(page, id);
    await shot(page, `qa-${id}`);
    report.items[id] = {
      ...(await canvasStats(page)),
      loaded: await page.getAttribute("[data-loaded-id]", "data-loaded-id"),
    };
  }

  console.log(JSON.stringify(report, null, 2));
  writeFileSync(`${outDir}/qa-report.json`, JSON.stringify(report, null, 2));
} catch (err) {
  await page.screenshot({ path: `${outDir}/qa-error.png` }).catch(() => {});
  console.error(err);
  report.error = String(err);
  writeFileSync(`${outDir}/qa-report.json`, JSON.stringify(report, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
