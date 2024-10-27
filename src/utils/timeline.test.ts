import { describe, it, expect } from "vitest";
import { createLens, zoomIn, getLensLength, zoomOut } from "./timeline";

describe("timeline", () => {
  describe("zoom", () => {
    it("zooms in", () => {
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
});
