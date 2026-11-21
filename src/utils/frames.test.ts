import { describe, expect, it } from "vitest";
import { framesToSeconds, getProjectFrameCount, layoutSequence, secondsToFrame } from "./frames";

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

  it("hands off contiguous placements while passing the unmodified native ranges", () => {
    const frameRate = { numerator: 30, denominator: 1 };
    const first = {
      id: "a",
      sourceId: "source-a",
      sourceFrameRate: { numerator: 60, denominator: 1 },
      sourceInFrame: 3,
      sourceOutFrame: 18,
    };
    const second = {
      id: "b",
      sourceId: "source-b",
      sourceFrameRate: { numerator: 30_000, denominator: 1001 },
      sourceInFrame: 2,
      sourceOutFrame: 1002,
    };
    expect(layoutSequence([first, second], frameRate)).toEqual({
      frameRate,
      durationFrames: 1009,
      placements: [
        { clip: first, sequenceStartFrame: 0, durationFrames: 8 },
        { clip: second, sequenceStartFrame: 8, durationFrames: 1001 },
      ],
    });
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
