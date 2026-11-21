import { describe, expect, it } from "vitest";
import {
  createLens,
  getLensLength,
  zoomIn,
  zoomInTowards,
  zoomOut,
  zoomOutTowards,
} from "./timeline";

describe("timeline", () => {
  describe("zoom", () => {
    it("zooms in", () => {
      // relativeX = 0 means zooming towards the left edge of the lens
      const lens = createLens(1000);
      const factor = 1.1;

      const zoomedLens = zoomIn(lens, factor);

      expect(getLensLength(zoomedLens)).toBe(910);
    });

    it("zooms in then out and then in again", () => {
      const lens = createLens(1000);
      const factor = 1.1;

      const zoomedLens = zoomIn(lens, factor);
      const zoomedOutLens = zoomOut(zoomedLens, factor);
      const zoomedInLens = zoomIn(zoomedOutLens, factor);

      expect(getLensLength(zoomedInLens)).toBe(910);
    });
  });

  describe("zoomInTowards", () => {
    it("zooms towards the center", () => {
      const lens = createLens(1000);
      const factor = 1.1;
      const relativeX = 0.5;

      const zoomedLens = zoomInTowards(lens, factor, relativeX);

      expect(getLensLength(zoomedLens)).toBe(910);
      expect(zoomedLens.startFrame).toBe(45);
      expect(zoomedLens.endFrame).toBe(955);
    });

    it("zooms towards the start of the timeline", () => {
      const lens = createLens(1000);
      const factor = 1.1;
      // relativeX = 0 is used to zoom towards the start of the timeline
      const relativeX = 0;

      const zoomedLens = zoomInTowards(lens, factor, relativeX);

      expect(zoomedLens.startFrame).toBe(0);
      expect(zoomedLens.endFrame).toBe(909);
    });
  });

  it("zooms back out from a six-frame view using either zoom control", () => {
    const lens = { startFrame: 608, endFrame: 614, durationFrames: 3600 };

    expect(getLensLength(zoomOut(lens, 1.1))).toBe(7);
    expect(getLensLength(zoomOutTowards(lens, 1.1, 0.47))).toBe(7);
  });
});
