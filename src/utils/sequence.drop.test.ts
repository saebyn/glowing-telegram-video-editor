import { expect, it } from "vitest";
import type { Sequence, VideoClip } from "@/types";
import { evaluatePoolDrop, placeClipInGap } from "./sequence";

const frameRate = { numerator: 30, denominator: 1 };
const clip: VideoClip = {
  id: "clip",
  sourceId: "source",
  sourceInFrame: 100,
  sourceOutFrame: 120,
  sourceFrameRate: frameRate,
};
const sequence: Sequence = {
  durationFrames: 100,
  tracks: [
    {
      id: "main",
      label: "Main",
      placements: [
        {
          id: "existing",
          clipId: "clip",
          sequenceStartFrame: 55,
          sourceInOffsetFrames: -5,
          sourceOutOffsetFrames: 5,
        },
      ],
    },
  ],
};

it("places a pool clip at the requested frame past the endpoint using the current clip bounds", () => {
  const next = placeClipInGap(sequence, [clip], frameRate, "clip", "main", 107);
  expect(next).toStrictEqual({
    durationFrames: 127,
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          {
            id: "existing",
            clipId: "clip",
            sequenceStartFrame: 55,
            sourceInOffsetFrames: -5,
            sourceOutOffsetFrames: 5,
          },
          { id: expect.any(String), clipId: "clip", sequenceStartFrame: 107 },
        ],
      },
    ],
  });
});

it("rejects an extending drop over the effective source range of a placement on the destination track", () => {
  // The existing placement spans [55, 85); the new clip would cover [81, 101).
  expect(placeClipInGap(sequence, [clip], frameRate, "clip", "main", 81)).toBeNull();
  // At the exclusive end, the next placement may start without overlapping.
  expect(evaluatePoolDrop(sequence, [clip], frameRate, "clip", "main", 85)).toStrictEqual({
    kind: "place",
    sequenceStartFrame: 85,
    duration: 20,
  });
});

it("rejects a clip longer than the bounded gap instead of backing into the preceding placement", () => {
  const bounded: Sequence = {
    durationFrames: 150,
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          ...sequence.tracks[0].placements,
          { id: "later", clipId: "clip", sequenceStartFrame: 104 },
        ],
      },
    ],
  };
  // The existing offsets leave [85, 104): 19 frames for a clip that needs 20.
  expect(evaluatePoolDrop(bounded, [clip], frameRate, "clip", "main", 94)).toStrictEqual({
    kind: "blocked",
    reason: "gap-too-short",
    sequenceStartFrame: 94,
    duration: 20,
  });
  expect(placeClipInGap(bounded, [clip], frameRate, "clip", "main", 94)).toBeNull();
});
