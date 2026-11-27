import { expect, it } from "vitest";
import type { Sequence, VideoClip } from "@/types";
import { evaluatePoolDrop, placeClipInGap } from "./placementDrag";

const frameRate = { numerator: 30, denominator: 1 };
const clip: VideoClip = {
  id: "clip",
  sourceId: "source",
  sourceInFrame: 100,
  sourceOutFrame: 120,
  sourceFrameRate: frameRate,
};
const sequence: Sequence = {
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

it("rejects a pool clip that extends past the known source end without blocking a valid clip", () => {
  const invalid = {
    ...clip,
    id: "past-source-end",
    sourceOutFrame: 130,
    sourceDurationFrames: 129,
  };
  const clips = [clip, invalid];

  expect(evaluatePoolDrop(sequence, clips, frameRate, invalid.id, "main", 107)).toBeNull();
  expect(placeClipInGap(sequence, clips, frameRate, invalid.id, "main", 107)).toBeNull();
  expect(evaluatePoolDrop(sequence, clips, frameRate, clip.id, "main", 107)).toStrictEqual({
    kind: "place",
    sequenceStartFrame: 107,
    duration: 20,
  });
});

it("rejects fractional source points before converting to the project frame rate", () => {
  const fractional = {
    ...clip,
    id: "fractional",
    sourceFrameRate: { numerator: 24, denominator: 1 },
    sourceOutFrame: 129.5,
  };

  expect(
    evaluatePoolDrop(sequence, [clip, fractional], frameRate, fractional.id, "main", 107),
  ).toBeNull();
  expect(
    placeClipInGap(sequence, [clip, fractional], frameRate, fractional.id, "main", 107),
  ).toBeNull();
});

it("can place a clip whose exclusive out point equals the known source end", () => {
  const rightUpToEnd = {
    ...clip,
    id: "at-source-end",
    sourceOutFrame: 130,
    sourceDurationFrames: 130,
  };

  expect(
    evaluatePoolDrop(sequence, [clip, rightUpToEnd], frameRate, rightUpToEnd.id, "main", 107),
  ).toStrictEqual({ kind: "place", sequenceStartFrame: 107, duration: 30 });
});

it("places a pool clip at the requested frame past the endpoint using the current clip bounds", () => {
  const next = placeClipInGap(sequence, [clip], frameRate, "clip", "main", 107);
  expect(next).toStrictEqual({
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

it("can fit a valid pool clip before an unresolved placement, not after its unknown end", () => {
  const invalid = { ...clip, id: "invalid", sourceFrameRate: { numerator: 30, denominator: 0 } };
  const loaded: Sequence = {
    ...sequence,
    tracks: [
      {
        ...sequence.tracks[0],
        placements: [{ id: "unknown-end", clipId: "invalid", sequenceStartFrame: 55 }],
      },
    ],
  };
  const clips = [clip, invalid];
  expect(placeClipInGap(loaded, clips, frameRate, "clip", "main", 80)).toBeNull();
  expect(placeClipInGap(loaded, clips, frameRate, "invalid", "main", 0)).toBeNull();
  expect(evaluatePoolDrop(loaded, clips, frameRate, "clip", "main", 50)).toStrictEqual({
    kind: "place",
    sequenceStartFrame: 35,
    duration: 20,
  });
});

it("rejects a clip longer than the bounded gap even when placements are stored out of order", () => {
  const bounded: Sequence = {
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          { id: "later", clipId: "clip", sequenceStartFrame: 104 },
          ...sequence.tracks[0].placements,
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
