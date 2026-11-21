import { describe, expect, it } from "vitest";
import findGaps from "./findGaps";

const settings = { minSectionFrames: 5, minGapFrames: 10, durationFrames: 50 };

describe("findGaps", () => {
  it("finds native ranges between sections", () => {
    expect(
      findGaps(settings, [
        { sourceFrame: 0, sourceOutFrame: 10 },
        { sourceFrame: 20, sourceOutFrame: 30 },
        { sourceFrame: 40, sourceOutFrame: 50 },
      ]),
    ).toEqual([
      { sourceInFrame: 10, sourceOutFrame: 20 },
      { sourceInFrame: 30, sourceOutFrame: 40 },
    ]);
  });

  it("ignores point events and short sections", () => {
    expect(
      findGaps(settings, [
        { sourceFrame: 0, sourceOutFrame: 10 },
        { sourceFrame: 14, sourceOutFrame: 17 },
        { sourceFrame: 20 },
        { sourceFrame: 30, sourceOutFrame: 40 },
      ]),
    ).toEqual([
      { sourceInFrame: 10, sourceOutFrame: 30 },
      { sourceInFrame: 40, sourceOutFrame: 50 },
    ]);
  });

  it("ignores gaps smaller than the threshold", () => {
    expect(
      findGaps(settings, [
        { sourceFrame: 0, sourceOutFrame: 10 },
        { sourceFrame: 19, sourceOutFrame: 41 },
      ]),
    ).toEqual([]);
  });

  it("includes the entire source when there are no qualifying sections", () => {
    expect(findGaps(settings, [])).toEqual([{ sourceInFrame: 0, sourceOutFrame: 50 }]);
  });

  it("does not split overlapping silence sections", () => {
    expect(
      findGaps(settings, [
        { sourceFrame: 17, sourceOutFrame: 22 },
        { sourceFrame: 12, sourceOutFrame: 36 },
      ]),
    ).toEqual([
      { sourceInFrame: 0, sourceOutFrame: 12 },
      { sourceInFrame: 36, sourceOutFrame: 50 },
    ]);
  });
});
