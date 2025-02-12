import type { Section } from "types";
import { describe, expect, it } from "vitest";
import findGaps from "./findGaps";

describe("findGaps", () => {
  it("should find gaps between sections", async () => {
    const sections: Section[] = [
      { timestamp: 0, timestamp_end: 10 },
      { timestamp: 20, timestamp_end: 30 },
      { timestamp: 40, timestamp_end: 50 },
    ];
    const minGapDuration = 5;

    const gaps = await findGaps(sections, minGapDuration);

    expect(gaps).toEqual([
      { id: "10-20", start: 10, end: 20 },
      { id: "30-40", start: 30, end: 40 },
    ]);
  });

  it("should return an empty array if no gaps are found", async () => {
    const sections: Section[] = [
      { timestamp: 0, timestamp_end: 10 },
      { timestamp: 11, timestamp_end: 20 },
    ];
    const minGapDuration = 5;

    const gaps = await findGaps(sections, minGapDuration);

    expect(gaps).toEqual([]);
  });

  it("should handle sections with undefined timestamp_end", async () => {
    const sections: Section[] = [
      { timestamp: 0, timestamp_end: 10 },
      { timestamp: 20 },
      { timestamp: 30, timestamp_end: 40 },
    ];
    const minGapDuration = 5;

    const gaps = await findGaps(sections, minGapDuration);

    expect(gaps).toEqual([{ id: "10-30", start: 10, end: 30 }]);
  });

  it("should ignore gaps that are less than the minimum gap duration", async () => {
    const sections: Section[] = [
      { timestamp: 0, timestamp_end: 10 },
      { timestamp: 15, timestamp_end: 25 },
    ];
    const minGapDuration = 10;

    const gaps = await findGaps(sections, minGapDuration);

    expect(gaps).toEqual([]);
  });

  it("should handle an empty array of sections", async () => {
    const sections: Section[] = [];
    const minGapDuration = 5;

    const gaps = await findGaps(sections, minGapDuration);

    expect(gaps).toEqual([]);
  });

  it("should handle a single section", async () => {
    const sections: Section[] = [{ timestamp: 0, timestamp_end: 10 }];
    const minGapDuration = 5;

    const gaps = await findGaps(sections, minGapDuration);

    expect(gaps).toEqual([]);
  });

  it("should find gaps greater than or equal to the minimum gap duration but ignore gaps less than the minimum gap duration", async () => {
    const sections: Section[] = [
      { timestamp: 0, timestamp_end: 10 },
      { timestamp: 15, timestamp_end: 25 },
      { timestamp: 35, timestamp_end: 40 },
    ];
    const minGapDuration = 10;

    const gaps = await findGaps(sections, minGapDuration);

    expect(gaps).toEqual([{ id: "25-35", start: 25, end: 35 }]);
  });

  it("should handle timestamps that are floats", async () => {
    const sections: Section[] = [
      { timestamp: 0, timestamp_end: 10.5 },
      { timestamp: 20.5, timestamp_end: 30.5 },
    ];
    const minGapDuration = 5;

    const gaps = await findGaps(sections, minGapDuration);

    expect(gaps).toEqual([{ id: "10.5-20.5", start: 10.5, end: 20.5 }]);
  });
});
