import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { screenHasReady } from "./c64-screen.ts";

describe("screenHasReady", () => {
  it("finds READY. in a C64 boot screen", () => {
    const text = "    **** COMMODORE 64 BASIC V2 ****\n\n 64K RAM SYSTEM  38911 BASIC BYTES FREE\n\nREADY.";
    assert.equal(screenHasReady(text), true);
  });
  it("rejects empty screen", () => {
    assert.equal(screenHasReady(""), false);
  });
});
