#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(
  () => document.querySelector("[data-emu-status]")?.getAttribute("data-emu-status") === "ready",
);
await page.waitForTimeout(5000);

const canvas = page.locator("canvas");
await canvas.click();
await page.waitForTimeout(200);
await page.keyboard.type("CATALOG");
await page.keyboard.press("Enter");
await page.waitForTimeout(4000);

const info = await page.evaluate(() => {
  const m = window.__oa;
  const canvas = document.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let bright = 0;
  let lastY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i] + data[i + 1] + data[i + 2] > 80) {
        bright++;
        lastY = y;
      }
    }
  }
  return {
    bright,
    lastY,
    text: m.apple2.getVideoModes().getText(),
    pc: m.apple2.getCPU().getPC(),
    stats: m.apple2.getStats(),
  };
});
console.log(JSON.stringify(info, null, 2));
await canvas.screenshot({ path: "/workspace/screenshots/emu-catalog.png" });
await page.screenshot({ path: `${"/workspace/screenshots"}/emu-catalog-page.png` });
await browser.close();
