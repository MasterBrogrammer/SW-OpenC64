#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const URL = "http://127.0.0.1:8082/";
const OUT_PNG = "screenshots/landscape-prove.png";
const SE_PNG = "screenshots/landscape-prove-se.png";

mkdirSync("screenshots", { recursive: true });

function readLayout() {
  const overlap = (a, b) => {
    const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return { x: Math.round(x), y: Math.round(y), area: Math.round(x * y) };
  };
  const box = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return {
      x: Math.round(b.left),
      y: Math.round(b.top),
      w: Math.round(b.width),
      h: Math.round(b.height),
      right: Math.round(b.right),
      bottom: Math.round(b.bottom),
    };
  };
  const shell = document.querySelector(".mobile-play-shell");
  const canvas = document.querySelector("canvas.c64-screen");
  const kb = document.querySelector(".soft-keyboard > button")
    ?? document.querySelector(".soft-keyboard");
  const sheet = document.querySelector(".mobile-chrome-sheet");
  const body = document.querySelector(".mobile-chrome-body");
  const list = document.querySelector(".mobile-library-list");
  const canvasR = canvas?.getBoundingClientRect();
  const kbR = kb?.getBoundingClientRect();
  return {
    vw: window.innerWidth,
    vh: window.innerHeight,
    orientation: shell?.getAttribute("data-orientation") ?? null,
    chrome: shell?.getAttribute("data-chrome") ?? null,
    hasShellLandscape: !!document.querySelector(
      '.mobile-play-shell[data-orientation="landscape"]',
    ),
    canvas: box(canvas),
    kb: box(kb),
    sheet: box(sheet),
    body: box(body),
    list: box(list),
    overlapKbCanvas: canvasR && kbR ? overlap(canvasR, kbR) : null,
    rotateCopy: /rotate to portrait/i.test(document.body.innerText),
  };
}

const browser = await chromium.launch({ headless: true });
const fails = [];
const metrics = {};

async function openPage(width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  return { context, page };
}

try {
  const wide = await openPage(844, 390);
  metrics.collapsed844 = await wide.page.evaluate(readLayout);

  if (!metrics.collapsed844.hasShellLandscape) {
    fails.push('missing .mobile-play-shell[data-orientation="landscape"]');
  }
  if (!metrics.collapsed844.canvas) {
    fails.push("missing canvas.c64-screen");
  } else {
    if (metrics.collapsed844.canvas.h < 280) {
      fails.push(
        `canvas height ${metrics.collapsed844.canvas.h} < 280 (near-full 390)`,
      );
    }
    if (metrics.collapsed844.canvas.w < 400) {
      fails.push(`canvas width ${metrics.collapsed844.canvas.w} < 400`);
    }
    if (metrics.collapsed844.canvas.bottom > metrics.collapsed844.vh + 1) {
      fails.push(
        `canvas bottom ${metrics.collapsed844.canvas.bottom} > viewport ${metrics.collapsed844.vh} + 1`,
      );
    }
  }
  if (metrics.collapsed844.rotateCopy) {
    fails.push("body text matches /rotate to portrait/i");
  }
  if (
    metrics.collapsed844.sheet == null ||
    metrics.collapsed844.sheet.w > 64
  ) {
    fails.push(
      `collapsed chrome sheet width ${metrics.collapsed844.sheet?.w} > 64`,
    );
  }
  if ((metrics.collapsed844.overlapKbCanvas?.area ?? 0) > 0) {
    fails.push(
      `keyboard overlaps CRT by ${metrics.collapsed844.overlapKbCanvas.area}px on 844 collapsed`,
    );
  }

  const handle = wide.page.locator(".mobile-chrome-handle").first();
  if ((await handle.count()) === 0) {
    fails.push("missing .mobile-chrome-handle to open Disks");
  } else {
    await handle.click();
    await wide.page.waitForTimeout(600);
    metrics.open844 = await wide.page.evaluate(readLayout);
    if (metrics.open844.canvas == null || metrics.open844.canvas.h < 280) {
      fails.push(
        `after opening Disks, canvas height ${metrics.open844.canvas?.h} < 280`,
      );
    }
    if ((metrics.open844.overlapKbCanvas?.area ?? 0) > 0) {
      fails.push(
        `keyboard overlaps CRT by ${metrics.open844.overlapKbCanvas.area}px on 844 open`,
      );
    }
  }

  await wide.page.screenshot({ path: OUT_PNG, fullPage: false });
  await wide.context.close();

  const se = await openPage(667, 375);
  const seHandle = se.page.locator(".mobile-chrome-handle").first();
  if ((await seHandle.count()) === 0) {
    fails.push("SE missing .mobile-chrome-handle");
  } else {
    await seHandle.click();
    await se.page.waitForTimeout(600);
  }
  metrics.openSE = await se.page.evaluate(readLayout);
  if ((metrics.openSE.overlapKbCanvas?.area ?? 0) > 0) {
    fails.push(
      `keyboard overlaps CRT by ${metrics.openSE.overlapKbCanvas.area}px on SE open`,
    );
  }
  if ((metrics.openSE.sheet?.w ?? 0) < 250) {
    fails.push(
      `SE open Disks rail ${metrics.openSE.sheet?.w}px < 250 (16rem floor)`,
    );
  }
  if ((metrics.openSE.body?.w ?? 0) < 180) {
    fails.push(
      `SE open Disks body ${metrics.openSE.body?.w}px < 180`,
    );
  }
  if (
    metrics.openSE.list == null ||
    metrics.openSE.list.w < 160 ||
    metrics.openSE.list.h < 120 ||
    metrics.openSE.list.y >= metrics.openSE.vh
  ) {
    fails.push(
      `SE Disks list crushed: ${JSON.stringify(metrics.openSE.list)}`,
    );
  }
  if ((metrics.openSE.canvas?.w ?? 0) < 200) {
    fails.push(`SE open canvas width ${metrics.openSE.canvas?.w} < 200`);
  }
  await se.page.screenshot({ path: SE_PNG, fullPage: false });
  await se.context.close();
} catch (err) {
  fails.push(`prove crashed: ${err?.message ?? String(err)}`);
} finally {
  await browser.close();
}

const verdict = {
  ok: fails.length === 0,
  fails,
  metrics,
  screenshot: OUT_PNG,
  seScreenshot: SE_PNG,
};

console.log(JSON.stringify(verdict, null, 2));
process.exit(fails.length === 0 ? 0 : 1);
