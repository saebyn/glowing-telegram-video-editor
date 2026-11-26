import { expect, test } from "vitest";
import type { FrameRate, Sequence, VideoClip } from "@/types";
import { getFadeSourceExtension } from "./fadePlacement";
import { evaluateTransitionEdit } from "./placementTransition";

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
  transitionIn: { id: "opening-entry", kind: "fade", durationFrames: 8 } as const,
};
const sequence: Sequence = {
  tracks: [{ id: "main", label: "Main", placements: [placement] }],
};

test("an entry fade can span the entire effective placement", () => {
  // The placement uses source [106, 146), exactly 40 frames at the project rate.
  expect(
    evaluateTransitionEdit(sequence, [harbor], {}, frameRate, {
      placementId: "open",
      edge: "leading",
      transition: { kind: "fade", durationFrames: 40 },
    }),
  ).toStrictEqual({
    kind: "edit",
    transition: { id: "opening-entry", kind: "fade", durationFrames: 40 },
    sequence: {
      tracks: [
        {
          id: "main",
          label: "Main",
          placements: [
            {
              ...placement,
              transitionIn: { id: "opening-entry", kind: "fade", durationFrames: 40 },
            },
          ],
        },
      ],
    },
  });
});

test("resubmitting the authored entry fade duration produces no edit", () => {
  expect(
    evaluateTransitionEdit(sequence, [harbor], {}, frameRate, {
      placementId: "open",
      edge: "leading",
      transition: { kind: "fade", durationFrames: 8 },
    }),
  ).toStrictEqual({ kind: "unchanged" });
});

test("an entry extension stops at the source endpoint and a reveal at sequence frame zero", () => {
  const shortened = {
    ...placement,
    sequenceStartFrame: 3,
    sourceInOffsetFrames: 36,
    sourceOutOffsetFrames: -8,
    transitionIn: { id: "entry", kind: "fade", durationFrames: 20 },
    transitionOut: { id: "reveal", kind: "fade", durationFrames: 20 },
  } as const;
  expect(getFadeSourceExtension(shortened, "leading", harbor, frameRate, 60)).toStrictEqual({
    startFrame: 140,
    endFrame: 148,
  });
  expect(getFadeSourceExtension(shortened, "trailing", harbor, frameRate, 60)).toStrictEqual({
    startFrame: 133,
    endFrame: 136,
  });
});
