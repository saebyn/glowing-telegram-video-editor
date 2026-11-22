import { expect, test } from "vitest";
import type { FrameRate, Sequence, VideoClip } from "@/types";
import { evaluatePlacementFade } from "./fadePlacement";

const frameRate: FrameRate = { numerator: 24, denominator: 1 };
const harbor: VideoClip = {
  id: "harbor",
  sourceId: "harbor-recording",
  sourceFrameRate: frameRate,
  sourceInFrame: 100,
  sourceOutFrame: 148,
};
const placement = {
  id: "open",
  clipId: "harbor",
  sequenceStartFrame: 20,
  sourceInOffsetFrames: 6,
  sourceOutOffsetFrames: -2,
  entryTransitionFrames: 8,
};
const sequence: Sequence = {
  durationFrames: 64,
  tracks: [{ id: "main", label: "Main", placements: [placement] }],
};

test("an entry fade can span the entire effective placement", () => {
  // The placement uses source [106, 146), exactly 40 frames at the project rate.
  expect(
    evaluatePlacementFade(sequence, [harbor], frameRate, "open", "entryTransitionFrames", 40),
  ).toStrictEqual({
    durationFrames: 64,
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [{ ...placement, entryTransitionFrames: 40 }],
      },
    ],
  });
});

test("resubmitting the authored entry fade duration produces no edit", () => {
  expect(
    evaluatePlacementFade(sequence, [harbor], frameRate, "open", "entryTransitionFrames", 8),
  ).toBeNull();
});
