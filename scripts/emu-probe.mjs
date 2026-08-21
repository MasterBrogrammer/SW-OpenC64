#!/usr/bin/env node
import { chromium } from "playwright";

process.stdout.write("launch\n");
const browser = await chromium.launch({ args: ["--no-sandbox"], timeout: 20000 });
process.stdout.write("launched\n");
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.setDefaultTimeout(10000);
page.on("pageerror", (e) => process.stdout.write("PAGEERROR " + e.message + "\n"));
await page.goto("http://127.0.0.1:8082/", { waitUntil: "commit", timeout: 20000 });
process.stdout.write("goto " + (await page.title()) + "\n");
await page.waitForSelector("canvas.c64-screen", { timeout: 15000 });
process.stdout.write("canvas\n");
await page.screenshot({ path: "/tmp/openc64-full.png" });
process.stdout.write("shot1\n");
await new Promise((r) => setTimeout(r, 6000));
process.stdout.write("waited\n");
await page.screenshot({ path: "/tmp/openc64-full2.png" });
process.stdout.write("shot2\n");
const info = await page.evaluate(() => {
  const s = document.querySelector("section");
  return {
    title: document.title,
    header: document.querySelector("header")?.textContent?.replace(/\s+/g, " ").trim().slice(0, 180),
    status: s?.getAttribute("data-emu-status"),
    phase: s?.getAttribute("data-boot-phase"),
    loaded: s?.getAttribute("data-loaded-id"),
    statusText: document.querySelector("span.min-w-0")?.textContent ?? "",
    hasC64: Boolean(window.__c64),
    screen: window.__c64?.screen?.() ?? "",
  };
});
process.stdout.write("INFO " + JSON.stringify(info) + "\n");
await page.screenshot({ path: "/tmp/openc64-full.png" });
const ten = page.locator('[data-software-id="tenprint"]');
if (await ten.count()) {
  await ten.click();
  await new Promise((r) => setTimeout(r, 4000));
  await page.screenshot({ path: "/tmp/openc64-tenprint.png" });
  process.stdout.write("tenprint\n");
}
process.stdout.write("shot\n");
await browser.close();
