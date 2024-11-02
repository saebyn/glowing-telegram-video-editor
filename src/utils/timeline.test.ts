import { describe, expect, it } from "vitest";
import {
  createLens,
  getLensLength,
  zoomIn,
  zoomInTowards,
  zoomOut,
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
      expect(zoomedLens.startMilliseconds).toBe(45);
      expect(zoomedLens.endMilliseconds).toBe(955);
    });

    it("zooms towards the start of the timeline", () => {
      const lens = createLens(1000);
      const factor = 1.1;
      // relativeX = 0 is used to zoom towards the start of the timeline
      const relativeX = 0;

      const zoomedLens = zoomInTowards(lens, factor, relativeX);

      // When zooming towards the start of the timeline, the startMilliseconds should remain 0
      // and the endMilliseconds should be reduced by the zoom factor.
      expect(zoomedLens.startMilliseconds).toBe(0);
      expect(zoomedLens.endMilliseconds).toBe(909);
    });
  });
});
