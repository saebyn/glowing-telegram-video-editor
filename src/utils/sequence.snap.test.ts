import { expect, it } from "vitest";
import type { Sequence, VideoClip } from "@/types";
import { evaluatePlacementMove } from "./placementDrag";

const frameRate = { numerator: 30, denominator: 1 };
const clips: readonly VideoClip[] = [
  {
    id: "clip",
    sourceId: "source",
    sourceInFrame: 100,
    sourceOutFrame: 120,
    sourceFrameRate: frameRate,
  },
];
const single: Sequence = {
  tracks: [
    {
      id: "main",
      label: "Main",
      placements: [{ id: "grabbed", clipId: "clip", sequenceStartFrame: 10 }],
    },
  ],
};

function withStationaryPlacement(sequenceStartFrame: number): Sequence {
  return {
    ...single,
    tracks: [
      ...single.tracks,
      {
        id: "stationary",
        label: "Stationary",
        placements: [{ id: "target", clipId: "clip", sequenceStartFrame }],
      },
    ],
  };
}

it("aligns a single placement to the playhead", () => {
  expect(
    evaluatePlacementMove(single, clips, frameRate, "grabbed", "main", 50, ["grabbed"], {
      unroundedStartFrame: 50,
      toleranceFrames: 1,
      playheadFrame: 51,
    }),
  ).toMatchObject({
    kind: "move",
    snapTargetFrame: 51,
    destinations: [{ placementId: "grabbed", trackIndex: 0, sequenceStartFrame: 51 }],
  });
});

it("aligns a companion's effective trailing edge to an effective edge on a locked track", () => {
  const sequence: Sequence = {
    ...single,
    tracks: [
      single.tracks[0],
      {
        id: "middle",
        label: "Middle",
        placements: [
          { id: "companion", clipId: "clip", sequenceStartFrame: 35, sourceOutOffsetFrames: -4 },
        ],
      },
      { id: "lower", label: "Lower", placements: [] },
      {
        id: "locked",
        label: "Locked",
        locked: true,
        placements: [
          { id: "target", clipId: "clip", sequenceStartFrame: 62, sourceOutOffsetFrames: 10 },
        ],
      },
    ],
  };
  // The companion's unaligned [75, 91) should shift to [76, 92).
  expect(
    evaluatePlacementMove(
      sequence,
      clips,
      frameRate,
      "grabbed",
      "middle",
      50,
      ["grabbed", "companion"],
      {
        unroundedStartFrame: 50,
        toleranceFrames: 2,
        playheadFrame: 0,
      },
    ),
  ).toMatchObject({
    kind: "move",
    snapTargetFrame: 92,
    destinations: [
      { placementId: "grabbed", trackIndex: 1, sequenceStartFrame: 51 },
      { placementId: "companion", trackIndex: 2, sequenceStartFrame: 76 },
    ],
  });
});

it("picks the closest candidate rather than preferring the playhead", () => {
  expect(
    evaluatePlacementMove(
      withStationaryPlacement(52),
      clips,
      frameRate,
      "grabbed",
      "main",
      50,
      ["grabbed"],
      {
        unroundedStartFrame: 50.5,
        toleranceFrames: 4,
        playheadFrame: 48,
      },
    ),
  ).toMatchObject({
    snapTargetFrame: 52,
    destinations: [{ sequenceStartFrame: 52 }],
  });
});

it("prefers the earlier grabbed start when two targets are equally close", () => {
  expect(
    evaluatePlacementMove(
      withStationaryPlacement(48),
      clips,
      frameRate,
      "grabbed",
      "main",
      50,
      ["grabbed"],
      {
        unroundedStartFrame: 50,
        toleranceFrames: 4,
        playheadFrame: 52,
      },
    ),
  ).toMatchObject({
    snapTargetFrame: 48,
    destinations: [{ sequenceStartFrame: 48 }],
  });
});

it("shows the earlier guide when both alignments lead to the same destination", () => {
  // Put the companion first in track order so its trailing-edge alignment
  // to the playhead is considered before the grabbed placement's leading edge.
  const sequence = withStationaryPlacement(50);
  const companion = { id: "companion", clipId: "clip", sequenceStartFrame: 25 };
  const group: Sequence = {
    ...sequence,
    tracks: [{ id: "other", label: "Other", placements: [companion] }, ...sequence.tracks],
  };
  // At grabbed frame 49 the companion would span [64, 84); instead use [65, 85).
  expect(
    evaluatePlacementMove(
      group,
      clips,
      frameRate,
      "grabbed",
      "main",
      49,
      ["grabbed", "companion"],
      {
        unroundedStartFrame: 49,
        toleranceFrames: 2,
        playheadFrame: 85,
      },
    ),
  ).toMatchObject({
    snapTargetFrame: 50,
    destinations: [
      { placementId: "companion", sequenceStartFrame: 65 },
      { placementId: "grabbed", sequenceStartFrame: 50 },
    ],
  });
});

it("tries the next candidate when the nearest one would collide on the companion's track", () => {
  const sequence: Sequence = {
    ...single,
    tracks: [
      ...single.tracks,
      {
        id: "other",
        label: "Other",
        placements: [
          { id: "companion", clipId: "clip", sequenceStartFrame: 12, sourceOutOffsetFrames: -5 },
          { id: "target", clipId: "clip", sequenceStartFrame: 31 },
        ],
      },
    ],
  };
  // The companion is 2 frames ahead of the grabbed placement, so a playhead
  // snap to 48 collides with the stationary range [31, 51). The further
  // leading-edge snap to 51 fits.
  expect(
    evaluatePlacementMove(
      sequence,
      clips,
      frameRate,
      "grabbed",
      "main",
      48,
      ["grabbed", "companion"],
      {
        unroundedStartFrame: 47.75,
        toleranceFrames: 4,
        playheadFrame: 48,
      },
    ),
  ).toMatchObject({
    kind: "move",
    snapTargetFrame: 51,
    destinations: [
      { placementId: "grabbed", sequenceStartFrame: 49 },
      { placementId: "companion", sequenceStartFrame: 51 },
    ],
  });
});

it("falls back to the normal destination when the only alignment crosses frame zero", () => {
  const group: Sequence = {
    ...single,
    tracks: [
      ...single.tracks,
      {
        id: "other",
        label: "Other",
        placements: [{ id: "companion", clipId: "clip", sequenceStartFrame: 1 }],
      },
    ],
  };
  const result = evaluatePlacementMove(
    group,
    clips,
    frameRate,
    "grabbed",
    "main",
    9,
    ["grabbed", "companion"],
    {
      unroundedStartFrame: 9,
      toleranceFrames: 1,
      playheadFrame: 8,
    },
  );
  expect(result.snapTargetFrame).toBeUndefined();
  expect(result).toMatchObject({
    kind: "move",
    destinations: [
      { placementId: "grabbed", sequenceStartFrame: 9 },
      { placementId: "companion", sequenceStartFrame: 0 },
    ],
  });
});

it("does not snap to the previous position of any moving placement", () => {
  const group: Sequence = {
    ...single,
    tracks: [
      ...single.tracks,
      {
        id: "other",
        label: "Other",
        placements: [{ id: "companion", clipId: "clip", sequenceStartFrame: 11 }],
      },
    ],
  };
  const result = evaluatePlacementMove(
    group,
    clips,
    frameRate,
    "grabbed",
    "main",
    11,
    ["grabbed", "companion"],
    {
      unroundedStartFrame: 11,
      toleranceFrames: 2,
      playheadFrame: 0,
    },
  );
  expect(result.snapTargetFrame).toBeUndefined();
  expect(result).toMatchObject({
    kind: "move",
    destinations: [
      { placementId: "grabbed", sequenceStartFrame: 11 },
      { placementId: "companion", sequenceStartFrame: 12 },
    ],
  });
});
