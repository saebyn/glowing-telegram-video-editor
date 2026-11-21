import { describe, expect, it } from "vitest";
import { framesToSeconds, getProjectFrameCount, secondsToFrame } from "./frames";

describe("frame conversions", () => {
  it("round trips native positions at an exact fractional rate", () => {
    const rate = { numerator: 30_000, denominator: 1001 };
    expect(framesToSeconds(30_000, rate)).toBe(1001);
    expect(secondsToFrame(1001, rate)).toBe(30_000);
  });

  it("counts each nonempty source range independently of its in point", () => {
    const sourceFrameRate = { numerator: 60, denominator: 1 };
    const at30 = { numerator: 30, denominator: 1 };
    const clip = { sourceFrameRate, sourceInFrame: 3, sourceOutFrame: 18 };
    expect(getProjectFrameCount(clip, sourceFrameRate)).toBe(15);
    expect(getProjectFrameCount(clip, at30)).toBe(8);
    expect(getProjectFrameCount({ ...clip, sourceInFrame: 4, sourceOutFrame: 19 }, at30)).toBe(8);
    expect(
      getProjectFrameCount({ ...clip, sourceOutFrame: 4 }, { numerator: 24, denominator: 1 }),
    ).toBe(1);
    expect(getProjectFrameCount({ ...clip, sourceOutFrame: 3 }, at30)).toBe(0);
    expect(getProjectFrameCount({ ...clip, sourceOutFrame: 2 }, at30)).toBe(0);
  });

  it("respects both denominators when converting between project rates", () => {
    const clip = {
      sourceInFrame: 1,
      sourceOutFrame: 2001,
      sourceFrameRate: { numerator: 30_000, denominator: 1001 },
    };
    expect(getProjectFrameCount(clip, { numerator: 30_000, denominator: 1000 })).toBe(2002);
  });
});
